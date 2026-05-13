---
title: "스프링 내부 이벤트, 왜 쓸까?"
description: "스프링 내부 이벤트를 왜 쓰는지, 직접 호출과 무엇이 다른지 정리합니다."
date: 2026-05-13
category: "Spring"
tags: ["Spring", "Event", "Transaction", "OOP"]
---

스프링이 내장하고 있는 `ApplicationEventPublisher` 와 `@EventListener`. 분명 어디선가 봤는데 정작 **왜 쓰는지** 는 흐릿하게 넘어가기 쉽습니다. 그냥 메서드 직접 호출하면 되는 거 아닌가? 컨트롤러에서 A 호출하고 B 호출하면 되는 거 아닌가? 이 글은 "이벤트가 뭐지?"에서 시작해서 "결국 결합도를 끊기 위한 도구구나"까지 도달한 학습 흐름을 그대로 따라가며 정리합니다.

## 1. 이벤트 기반이란?

한 줄로 요약하면 **"이벤트가 발생하면 → 반응한다"** 라는 방식입니다.

일반적인 요청-응답 방식과 비교하면 차이가 분명해집니다.

```
[요청-응답]
A가 B에게 "이거 해줘" → B가 처리 → A에게 결과 반환
(A는 B가 끝날 때까지 기다림, A는 B를 알아야 함)

[이벤트 방식]
A가 "주문됨!" 이라고 외침 → 관심 있는 누구든 알아서 반응
(A는 누가 듣든 말든 신경 안 씀)
```

가장 친숙한 예시는 브라우저의 `addEventListener` 입니다.

```javascript
button.addEventListener('click', () => {
  console.log('버튼이 눌렸다!');
});
```

버튼은 자기를 클릭하는 게 누구인지, 클릭됐을 때 무슨 일이 일어날지 모릅니다. 그저 "클릭됨"이라는 이벤트만 발행할 뿐입니다. 이 개념을 그대로 서버 사이드로 가져온 것이 스프링의 내부 이벤트입니다.

## 2. 스프링부트의 내부 이벤트

스프링부트는 **앱 내부에서** 이벤트를 주고받을 수 있는 메커니즘을 기본 제공합니다. 구성 요소는 세 가지뿐입니다.

```
[Publisher] --발행--> [Event] --수신--> [Listener]
   발행자              이벤트              수신자
```

### 회원가입 예시

**1) 이벤트 정의**

```java
public class MemberRegisteredEvent {
    private final String email;

    public MemberRegisteredEvent(String email) {
        this.email = email;
    }
    public String getEmail() { return email; }
}
```

**2) 발행**

```java
@Service
@RequiredArgsConstructor
public class MemberService {
    private final ApplicationEventPublisher publisher;

    public void register(String email) {
        // 회원 저장 로직...
        publisher.publishEvent(new MemberRegisteredEvent(email));
    }
}
```

**3) 수신**

```java
@Component
public class EmailListener {
    @EventListener
    public void sendWelcomeEmail(MemberRegisteredEvent event) {
        // 환영 이메일 발송
    }
}

@Component
public class CouponListener {
    @EventListener
    public void giveWelcomeCoupon(MemberRegisteredEvent event) {
        // 신규 회원 쿠폰 지급
    }
}
```

`MemberService`는 자기가 회원을 저장한 뒤 누가 무엇을 하는지 모릅니다. 이게 핵심입니다.

## 3. 내장 이벤트의 킬러 기능: `@TransactionalEventListener`

`@EventListener` 만 알아도 동작은 하지만, 실무에서 진짜 가치가 드러나는 건 `@TransactionalEventListener` 입니다.

```java
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
public void sendEmail(OrderPaidEvent event) {
    emailService.send(event.getOrderId());  // DB 커밋이 성공한 후에만 실행됨
}
```

왜 중요할까요? 다음 코드를 봅시다.

```java
// ❌ 위험한 코드
@Transactional
public void pay(...) {
    paymentRepository.save(...);
    emailService.sendReceipt(...);   // 메일 보냄
    // 여기서 예외 발생 → DB 롤백 → 근데 메일은 이미 나감
}
```

`AFTER_COMMIT` 옵션만 알아도 내장 이벤트를 쓸 이유가 충분합니다.

> **⚠️ 함정 1. AFTER_COMMIT 리스너에서 DB 작업할 때**
>
> `AFTER_COMMIT` 시점에는 이미 원래 트랜잭션이 끝난 상태입니다. 이때 리스너 안에서 `@Transactional`(기본 `REQUIRED`)만 붙이면 새 트랜잭션은 열리지만, 스프링이 "이미 끝난 트랜잭션의 동기화 단계에서 시작된 트랜잭션"이라며 경고 로그를 남기고 **같은 DataSource일 경우 커밋이 무시될 수 있습니다.** **리스너에서 DB 작업을 한다면 `@Transactional(propagation = Propagation.REQUIRES_NEW)` 로 새 트랜잭션을 명시적으로 열어야 합니다.**

> **⚠️ 함정 2. AFTER_COMMIT 리스너가 실패하면?**
>
> 주문은 커밋됐는데 메일/포인트 처리가 실패하면 **데이터 정합성이 깨집니다.** 이 문제를 진지하게 풀려면 outbox 패턴, 재시도 큐, DLQ(Dead Letter Queue) 같은 장치가 필요합니다. 내장 이벤트의 `AFTER_COMMIT`은 격리를 주지만, 신뢰성까지 공짜로 주진 않습니다.

> **⚠️ 함정 3. 리스너끼리도 결합돼 있다**
>
> 같은 이벤트를 듣는 리스너가 여러 개일 때, **앞 리스너에서 예외가 터지면 뒷 리스너는 호출되지 않습니다** (기본 동기 동작). "리스너만 추가하면 끝"이라는 인상과 달리, 리스너끼리도 실패 영향을 주고받습니다. 격리하려면 각 리스너에 `@Async`를 붙이거나, 리스너 내부에서 예외를 try-catch로 흡수해야 합니다.

## 4. 핵심 질문: "트랜잭션을 분리하고 싶을 때 이벤트를 쓰는 거야?"

이제 진짜 본론입니다. 학습 과정에서 가장 자주 헷갈리는 지점이기도 합니다.

### 첫 번째 직관: "A 후에 B 실행"

```java
@Transactional
public void completeOrder(...) {
    orderRepository.save(order);            // A
    publisher.publishEvent(new Event());    // 이게 B를 부름
}
```

이걸 보면 자연스러운 질문이 따라옵니다.

> **"근데 A에서 예외 터지면 B까지 안 가지 않아? 그러면 그냥 직접 호출과 뭐가 달라?"**

맞습니다. **A 실패 → B 안 감** 은 직접 호출도 똑같이 보장합니다. 이 방향은 이벤트의 이유가 아닙니다.

### 진짜 이유는 **반대 방향**

문제는 **"B가 실패하면 A는 어떻게 되나?"** 입니다.

```java
// ❌ 직접 호출
@Transactional
public void completeOrder(...) {
    orderRepository.save(order);     // A 성공
    emailService.send(...);          // B - 여기서 런타임 예외 발생!
    // → @Transactional이 A까지 롤백시킴
    // → 주문이 사라짐
}
```

| 방향 | 직접 호출 | 이벤트 분리 (AFTER_COMMIT) |
|---|---|---|
| A 실패 → B 안 함 | ✅ (당연) | ✅ (당연) |
| **B 실패 → A는?** | ❌ A도 롤백됨 | ✅ A는 유지됨 |

> **참고:** 스프링 `@Transactional`은 기본적으로 **런타임 예외(`RuntimeException`)와 `Error`** 가 발생했을 때만 롤백합니다. 체크 예외는 기본 롤백 대상이 아닙니다(필요하면 `rollbackFor` 명시). 위 표는 실무에서 흔한 런타임 예외 케이스를 가정한 것입니다.

이벤트의 진짜 가치는 **반대 방향의 격리** 에 있습니다. 한 줄로 요약하면:

> **"B의 실패가 A를 망치지 않게 하려고"** 이벤트를 씁니다.

### 주의: `@EventListener`만 쓰면 격리 효과가 없다

```java
@EventListener   // ❌ 기본은 동기 호출
public void giveCoupon(MemberRegisteredEvent e) {
    couponService.give(...);
    // 여기서 예외 → 회원가입도 같이 롤백됨
}
```

`@EventListener` 의 기본 동작은 **같은 스레드에서 동기 호출** 입니다. 호출자의 트랜잭션이 그대로 전파되기 때문에, 결과적으로 그냥 메서드 호출과 다를 게 없습니다. 격리가 필요하면 `@TransactionalEventListener(AFTER_COMMIT)` 이나 `@Async` (또는 `Propagation.REQUIRES_NEW`) 같은 장치가 함께 필요합니다.

> **⚠️ `@Async`는 `@EnableAsync` 가 활성화돼 있어야 동작합니다.** 설정 클래스에 `@EnableAsync` 가 없으면 `@Async`는 그냥 동기 호출이 됩니다.

> **⚠️ 이벤트 객체에 엔티티를 그대로 담지 말 것.** 비동기/AFTER_COMMIT 리스너 시점에는 영속성 컨텍스트가 닫혀 있어 `LazyInitializationException`이 발생할 수 있습니다. **엔티티 대신 ID나 필요한 값만 담아 전달**하는 것이 안전합니다.

## 5. 그러면 컨트롤러에서 A 호출 후 B 호출하면 똑같지 않아?

이게 두 번째 결정적 질문입니다.

```java
// 방법 1: 컨트롤러에서 순차 호출
@PostMapping("/orders")
public void create(...) {
    orderService.complete(...);   // A
    emailService.send(...);       // B - A가 던진 예외면 여기 안 옴
}

// 방법 2: 이벤트
public void complete(...) {
    orderRepository.save(...);
    publisher.publishEvent(...);  // B는 리스너가 처리
}
```

**기능 동작만 보면 둘 다 거의 같습니다.** 그래서 이 질문이 정확한 것입니다.

진짜 차이는 다른 곳에 있습니다. 5가지로 정리합니다.

### 차이 1. 누가 B의 존재를 아느냐 (결합도와 책임)

컨트롤러 방식은 컨트롤러가 메일, 슬랙, 포인트 등 모든 부가 기능을 알아야 합니다. 부가 기능이 늘어날 때마다 컨트롤러를 수정해야 합니다. 이벤트 방식에선 컨트롤러는 B의 존재 자체를 모릅니다.

게다가 "주문 완료 시 메일을 보낸다"는 **비즈니스 규칙**입니다. 컨트롤러는 원래 요청-응답을 다루는 계층이지, 비즈니스 규칙을 결정하는 곳이 아닙니다.

### 차이 2. 호출 경로가 여러 개일 때

주문 완료가 컨트롤러, 어드민 페이지, 배치 잡 등 **여러 경로**에서 일어난다면?

```java
// 컨트롤러 방식: 모든 호출 지점에서 부가 로직 중복
public class OrderController { /* email, slack 호출 */ }
public class AdminController { /* email, slack 호출 - 중복 */ }
public class BatchJob       { /* email, slack 호출 - 빠뜨리면 버그 */ }

// 이벤트 방식: 도메인 안에서 한 번만 발행
public class OrderService {
    public void complete(...) {
        orderRepository.save(...);
        publisher.publishEvent(...);  // 어디서 호출하든 동일하게 발행
    }
}
```

### 차이 3. 트랜잭션 경계 보장

컨트롤러 방식은 **상황에 따라 트랜잭션 경계가 흔들립니다.** 컨트롤러에 `@Transactional`이 붙거나, 서비스 안에서 다른 서비스를 호출하면 같은 트랜잭션으로 묶여버립니다.

```java
@PostMapping
@Transactional  // ← 누군가 트랜잭션을 추가하면
public void create(...) {
    orderService.complete(...);
    emailService.send(...);   // 같은 트랜잭션! 메일 실패 → 주문 롤백
}
```

`@TransactionalEventListener(AFTER_COMMIT)` 은 **어디서 호출하든 "커밋 후"가 보장됩니다.**

### 차이 4. 비동기/병렬

```java
// 컨트롤러 순차: 응답 3.1초
orderService.complete(...);  // 0.1초
emailService.send(...);      // 2초
slackService.notify(...);    // 1초

// 이벤트 + @Async: 응답 0.1초
@Async @EventListener
public void sendEmail(OrderPaidEvent e) { /* 2초 */ }

@Async @EventListener
public void notifySlack(OrderPaidEvent e) { /* 1초 */ }
```

### 차이 5. 확장성

부가 기능이 늘어날 때 컨트롤러 방식은 **호출자를 수정**해야 하지만, 이벤트 방식은 **리스너 클래스만 추가**하면 끝입니다. 기존 코드는 한 줄도 안 바뀝니다.

### 비교표

| 측면 | 컨트롤러 순차 호출 | 이벤트 |
|---|---|---|
| A 실패 시 B 안 감 | ✅ | ✅ |
| B 실패가 A에 영향 X | ✅ | ✅ |
| 트랜잭션 경계 통제 | ❌ 호출 위치에 따라 깨짐 | ✅ AFTER_COMMIT 보장 |
| 호출 경로 여러 개일 때 | ❌ 코드 중복 | ✅ 한 곳에서 발행 |
| 부가 기능 추가 시 | ❌ 호출자 수정 | ✅ 리스너만 추가 |
| 비동기 처리 | ⚠️ 직접 구현 | ✅ `@Async` 한 줄 |
| 계층 책임 | ❌ 컨트롤러가 비즈니스 결정 | ✅ 도메인이 발행, 부가 기능이 구독 |

## 6. 결론: 내부 이벤트는 결합도를 끊기 위한 도구다

여기까지 따라왔다면 자연스럽게 이런 결론에 도달합니다.

> **내부 이벤트는 결합도를 낮추기 위한 도구다. OOP가 오랫동안 추구해온 그 목표를 코드 레벨에서 구체화한 장치다.**

특히 **SOLID** 원칙과 정확히 맞닿아 있습니다.

### OCP (개방-폐쇄 원칙)

> "확장에는 열려있고, 수정에는 닫혀있어야 한다"

새 기능을 추가할 때 기존 `OrderService`를 건드리지 않습니다. 리스너만 추가하면 끝.

### SRP (단일 책임 원칙)

> "한 클래스는 하나의 책임만"

`OrderService`는 주문만, `EmailListener`는 메일만, `PointListener`는 포인트만 책임집니다.

### DIP (의존성 역전 원칙)

> "구체 구현이 아닌 추상에 의존하라"

```java
// ❌ 주문 도메인이 메일/슬랙/포인트 같은 구체 구현에 직접 의존
public class OrderService {
    private final EmailService emailService;
    private final SlackService slackService;
}

// ✅ 주문 도메인은 "이벤트 발행"이라는 추상에만 의존
public class OrderService {
    private final ApplicationEventPublisher publisher;
}
```

### 디자인 패턴으로는 옵저버 패턴

스프링의 내부 이벤트는 사실 **옵저버 패턴(Observer Pattern)** 의 구현체에 가깝습니다. 정확히는 `ApplicationEventMulticaster` 가 중간에 끼는 Pub-Sub 모델이지만, 결합도 문제를 해결한다는 정신은 같습니다.

```
Publisher ──이벤트──> Listener 1
                └──> Listener 2
                └──> Listener 3
```

## 정리

| 잘못된 이해 | 올바른 이해 |
|---|---|
| "A 후에 B 실행하려고 이벤트 쓴다" | "**B 실패가 A에 영향 안 가도록** 이벤트 쓴다" |
| "기능을 분리하려고 이벤트 쓴다" | "**결합도를 끊으려고** 이벤트 쓴다" |
| "`@EventListener` 만 붙이면 격리된다" | "격리하려면 `@TransactionalEventListener(AFTER_COMMIT)` 이나 `@Async` 가 필요하다" |
| "결합도가 싫으니 같은 트랜잭션 흐름도 이벤트로 빼자" | "**같이 롤백돼야 하면 이벤트가 아니라** 그냥 메서드 분리로 풀어야 한다" |

판단이 헷갈릴 때 떠올릴 한 문장.

> **"B가 터지면 A도 같이 터져야 해?"**
> - YES → 직접 호출 (한 트랜잭션)
> - NO → 이벤트 (A 보호)

이 한 문장이면 대부분의 상황에서 올바르게 판단할 수 있습니다.
