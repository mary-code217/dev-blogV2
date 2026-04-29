---
title: "ReentrantLock 기반 동시성 제어"
description: "멀티스레드 환경에서 공유 자원을 보호하는 방법. ReentrantLock, ConcurrentHashMap, computeIfAbsent를 조합해 계좌별 인메모리 락을 구현하고, 인메모리 락과 분산 락의 선택 기준을 살펴봅니다."
date: 2026-04-29
category: "Java"
tags: ["Java", "Concurrency", "Thread", "ReentrantLock"]
---

멀티스레드 환경에서 여러 스레드가 같은 자원에 동시에 접근하면 의도하지 않은 결과가 발생합니다. 한 스레드가 값을 읽고 갱신하기 전에 다른 스레드가 끼어들면, 두 스레드 모두 같은 초기값을 기준으로 판단하게 됩니다.

이 글에서는 계좌 이체 시나리오를 통해 레이스 컨디션이 어떻게 발생하는지 살펴보고, `ReentrantLock`과 `ConcurrentHashMap`을 조합해 계좌별 인메모리 락을 구현하는 방법을 알아봅니다.

## 1. 레이스 컨디션

두 스레드가 같은 계좌 잔액을 동시에 조회하면 다음과 같은 문제가 생깁니다.

```
스레드 A: 계좌 1번 잔액 조회 → 100,000원 확인
스레드 B: 계좌 1번 잔액 조회 → 100,000원 확인
스레드 A: 50,000원 출금 → 잔액 50,000원으로 갱신
스레드 B: 80,000원 출금 → 잔액 20,000원으로 갱신 (잔액 부족인데 성공!)
```

두 스레드가 각자 잔액이 충분하다고 판단해서 출금이 모두 통과됩니다. 이처럼 연산의 결과가 실행 순서에 따라 달라지는 현상을 **레이스 컨디션(Race Condition)**이라 합니다.

해결책은 "조회 → 검증 → 갱신"을 한 스레드만 실행할 수 있는 임계 구역으로 묶는 것입니다.

## 2. ReentrantLock

`java.util.concurrent.locks.ReentrantLock`은 임계 구역을 직접 지정할 수 있는 명시적 락입니다.

```java
ReentrantLock lock = new ReentrantLock();

lock.lock();    // 락 획득 — 다른 스레드는 여기서 대기
try {
    // 임계 구역: 동시에 하나의 스레드만 실행
} finally {
    lock.unlock(); // 락 해제 — 반드시 finally에서 실행
}
```

`finally`에서 해제해야 하는 이유는 임계 구역에서 예외가 발생해도 락이 반드시 풀려야 하기 때문입니다. 해제하지 않으면 다른 스레드가 영원히 대기하는 **무한 대기(lock leak)**가 생깁니다.

**Reentrant(재진입)** 이란 같은 스레드가 이미 획득한 락을 다시 획득할 수 있다는 의미입니다. 덕분에 중첩 메서드 호출에서 같은 락을 요청해도 데드락이 발생하지 않습니다. 단, **서로 다른 스레드** 간의 데드락(A가 락1 보유 후 락2 대기, B가 락2 보유 후 락1 대기)은 여전히 주의해야 합니다.

## 3. ConcurrentHashMap

계좌별로 락을 관리하려면 `Map<계좌ID, Lock>` 구조가 필요합니다. 일반 `HashMap`은 멀티스레드 환경에서 내부 상태가 꼬일 수 있습니다.

```java
// ❌ HashMap — 멀티스레드 환경에서 위험
Map<Long, ReentrantLock> locks = new HashMap<>();

// ✅ ConcurrentHashMap — 내부적으로 동기화되어 스레드 안전
ConcurrentHashMap<Long, ReentrantLock> locks = new ConcurrentHashMap<>();
```

`ConcurrentHashMap`은 맵 자체의 읽기/쓰기를 스레드 안전하게 처리합니다. 다만 이는 맵 연산의 안전성이고, 맵에서 꺼낸 `ReentrantLock` 객체를 통한 임계 구역 보호는 별도로 처리해야 합니다.

## 4. computeIfAbsent — 원자적 생성

계좌별 락을 처음 사용할 때 생성하는 방식에도 주의가 필요합니다.

```java
// ❌ put — 매번 새 락을 생성해서 기존 락을 덮어씀
locks.put(accountId, new ReentrantLock());

// ✅ computeIfAbsent — 없을 때만 생성
ReentrantLock lock = locks.computeIfAbsent(accountId, id -> new ReentrantLock());
```

`put`을 사용하면 다음과 같은 문제가 생깁니다.

```
스레드 A: 계좌 1번 락 획득 (로컬 변수로 참조 보유)
스레드 B: put으로 새 락을 생성해 맵에 덮어씀
→ A와 B가 서로 다른 락 객체를 사용하게 되어 동기화가 깨짐
```

`computeIfAbsent`는 **원자적(atomic) 연산**이라 여러 스레드가 동시에 호출해도 Value가 한 번만 생성됩니다. 한 번 생성된 계좌 락은 덮어쓰이지 않으므로 락의 동일성이 유지됩니다.

## 5. InMemoryAccountLock 구현

앞선 세 가지를 조합하면 계좌별 인메모리 락을 구현할 수 있습니다.

```java
@Component
public class InMemoryAccountLock implements AccountLock {

    private final ConcurrentHashMap<Long, ReentrantLock> locks = new ConcurrentHashMap<>();

    @Override
    public void lockAccount(Long accountId) {
        ReentrantLock lock = locks.computeIfAbsent(accountId, id -> new ReentrantLock());
        lock.lock();
    }

    @Override
    public void releaseAccount(Long accountId) {
        ReentrantLock lock = locks.get(accountId);
        // isHeldByCurrentThread() — 현재 스레드가 보유한 락만 해제
        // 보유하지 않은 락을 unlock()하면 IllegalMonitorStateException 발생
        if (lock != null && lock.isHeldByCurrentThread()) {
            lock.unlock();
        }
    }
}
```

계좌별로 독립적인 락을 가지므로 서로 다른 계좌는 동시에 이체할 수 있습니다.

```
계좌 1번 이체 중     → locks = { 1L: locked }
계좌 2번 이체 시도   → locks = { 1L: locked, 2L: locked }  ← 동시에 가능
계좌 1번 이체 재시도 → 1L이 이미 locked → 대기
```

## 6. 인메모리 락 vs 분산 락

인메모리 락은 단일 서버 내에서만 유효합니다. 여러 서버 인스턴스가 실행되는 환경이라면 각 서버가 독립적인 락 맵을 가지기 때문에 서버 간 동기화가 되지 않습니다.

| | 인메모리 락 | 분산 락 (Redis) |
|--|------------|----------------|
| 범위 | 단일 서버 내에서만 유효 | 여러 서버 간 공유 |
| 속도 | 빠름 (메모리 접근) | 네트워크 오버헤드 있음 |
| 서버 재시작 | 락 초기화됨 | Redis에 유지됨 |
| 구현 복잡도 | 단순 | Redisson 등 라이브러리 필요 |
| 적합한 환경 | 단일 서버 애플리케이션 | MSA, 다중 인스턴스 환경 |

단일 서버 환경이라면 인메모리 락으로 충분합니다. MSA나 수평 확장이 필요한 환경이라면 Redis 기반 분산 락(Redisson)을 고려해야 합니다.

## 마무리

- 레이스 컨디션은 "조회 → 검증 → 갱신"을 원자적으로 묶지 않을 때 발생한다
- `ReentrantLock`으로 임계 구역을 지정하고, `unlock()`은 반드시 `finally`에서 실행한다
- 락 맵은 `ConcurrentHashMap`을 사용해야 맵 자체의 스레드 안전성이 보장된다
- `computeIfAbsent`는 원자적 연산이라 동시에 호출해도 락이 한 번만 생성된다
- `isHeldByCurrentThread()`로 현재 스레드가 보유한 락만 해제해 `IllegalMonitorStateException`을 방지한다
- 인메모리 락은 단일 서버에서만 유효하며, 다중 인스턴스 환경에서는 분산 락으로 전환해야 한다
