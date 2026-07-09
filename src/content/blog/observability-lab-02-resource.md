---
title: "모니터링 장애 대응 실습 2편 - 자원이 마르면 생기는 일, 커넥션 풀 고갈과 느린 쿼리"
description: "HikariCP 풀 고갈은 에러율 93%로 비명을 질렀고, 100만 행 풀스캔은 에러 0건인 채 11배 느려졌다. 같은 자원 장애, 정반대 신호를 추적한 기록."
date: 2026-07-09T12:00:00+09:00
category: "Backend"
tags: ["Monitoring", "Database", "HikariCP", "PostgreSQL", "Performance"]
draft: false
---

> **이 글의 한 줄**: 같은 자원 장애여도 신호는 정반대일 수 있다. 에러로 터지거나, 침묵 속에 느려지거나.
>
> "모니터링 장애 대응 실습" 4부작의 2편이다.
> [1편. 정상이 뭔지 모르면 장애도 못 본다](/dev-blogV2/blog/observability-lab-01-setup/) · **2편(현재 글)** · 3편(예정) · 4편(예정)

[1편](/dev-blogV2/blog/observability-lab-01-setup/)에서 baseline을 확보했다. 처리량 8.3 RPS, p95 41.7ms, 에러 0%. 이번 편에서는 그 위에 첫 장애 두 개를 일으킨다. 커넥션 풀 고갈과 느린 쿼리. 계획할 때는 둘 다 "DB 자원 문제"로 한 묶음이라 신호도 비슷할 줄 알았다. **실제로는 정반대였다.** 하나는 에러율 93%로 대시보드가 뒤집혔고, 하나는 에러가 단 한 건도 없이 조용히 11배 느려졌다.

## 장애 1. 커넥션 5개가 전부 잠들었다

### 이렇게 망가뜨렸다

실무에서 흔한 안티패턴을 그대로 재현했다. **트랜잭션 안에서 외부 API를 기다리는 코드**다. 재현이 잘 보이도록 풀은 작게, 타임아웃은 짧게 잡았다(`maximum-pool-size=5`, `connection-timeout=2000`).

```java
@Transactional(readOnly = true)
public Product findByIdAndHold(Long id, long holdMillis) {
    Product product = productRepository.findById(id)
            .orElseThrow(() -> new ProductNotFoundException(id));
    Thread.sleep(holdMillis);   // ★ 외부 호출 5초를 모사. 커넥션을 쥔 채 대기
    return product;
}
```

트랜잭션이 살아있는 동안 DB 커넥션은 반환되지 않는다. 요청 하나가 커넥션 하나를 5초씩 쥐고 있으니, k6로 50 VU를 걸면 풀(5개)은 즉시 마른다.

### 탐지: pending은 서서히 차오르지 않았다

부하를 걸고 대시보드를 보는데, 예상과 다른 게 두 가지였다.

![active는 5에 붙박이, pending은 45까지 치솟은 커넥션 패널](/dev-blogV2/images/observability-lab/s1-incident-hikari-connections.png)

첫째, **pending(커넥션 대기 스레드)이 "서서히 차오를" 줄 알았는데 첫 scrape 5초 만에 0에서 45로 점프했다.** 50 VU가 동시에 들어오고 커넥션은 5개뿐이니 당연한 산수인데, 그래프로 보기 전엔 이 속도감을 몰랐다. 풀 고갈은 추세형이 아니라 급변형에 가깝게 나타났다.

둘째, 에러율이 **93%까지** 치솟았다. 풀 5개가 동시에 처리하는 5건 말고는 전부 2초 타임아웃으로 떨어졌기 때문이다. `timeout_total`은 분당 약 1,100건씩 증가했다.

![에러율 93%를 찍은 패널](/dev-blogV2/images/observability-lab/s1-incident-http-errorrate.png)

> 고백하자면 위 캡처에서 93%짜리 에러율이 **평화로운 초록색 선**으로 그려져 있다. 당시 패널에 threshold 색상을 안 넣어서다. 값은 장애인데 색은 정상. 이 어색함을 겪고 나서야 에러율 패널에 "5% 초과는 빨강" threshold를 넣었다. 대시보드는 값만 보여주면 되는 게 아니라 **위험을 색으로 말해야 한다**는 걸 배운 대목이다.

### 원인: 로그의 괄호 안에 답이 다 있었다

Loki에서 ERROR 레벨로 좁히자 스택트레이스가 쏟아졌다.

```
java.sql.SQLTransientConnectionException: HikariPool-1 - Connection is not available,
request timed out after 2010ms (total=5, active=5, idle=0, waiting=2)
```

![타임아웃 스택트레이스가 걸린 Loki 로그 패널](/dev-blogV2/images/observability-lab/s1-incident-logs.png)

괄호 안이 원인 그 자체다. **total=5, active=5, idle=0.** 풀 전체가 점유된 채 놀고 있는 커넥션이 하나도 없다. 메트릭(pending 급증)이 "언제"를 알려줬고, 로그의 이 한 줄이 "왜"를 확정했다.

검색 팁 하나. `request timed out after 2010ms`의 시간값은 설정에 따라 바뀐다. `Connection is not available` 같은 **불변 부분 문자열**로 검색해야 재사용 가능한 쿼리가 된다.

### 해결: 풀을 늘리지 않고 점유 시간을 줄였다

원인이 "트랜잭션 안의 외부 대기"이므로, 고치는 것도 그 지점이다. 지연을 트랜잭션 **밖**으로 옮겼다.

```java
// 조회 트랜잭션은 즉시 커밋되어 커넥션을 곧바로 반환한다
Product product = productService.findById(id);
sleepOutsideTransaction(5000);   // 커넥션을 쥐지 않은 채 대기
```

같은 50 VU를 다시 걸었다. **pending 0, 타임아웃 0, 에러율 0%** (824건 전부 성공). 풀 크기는 여전히 5인데 아무 문제가 없다.

![해결 후 커넥션 패널. 같은 부하에서 pending 0](/dev-blogV2/images/observability-lab/s1-recovery-hikari-connections.png)

`maximum-pool-size`를 50으로 올리는 선택지도 있었지만 그건 증상 완화다. 커넥션 점유 시간이 문제의 본질인데 풀만 키우면 DB 쪽 부담을 늘린 채 같은 장애를 더 큰 규모로 유예할 뿐이다. 재발 방지 규칙은 **"트랜잭션 안에서 외부 I/O 금지"와 pending 알림**으로 정리했다.

## 장애 2. 에러는 0인데 11배 느리다

### 이렇게 망가뜨렸다

이번엔 코드가 아니라 **없는 것**이 원인이다. product 테이블 100만 행, `name` 컬럼에 인덱스 없음. 그 컬럼으로 검색하는 API에 k6 30 VU를 걸었다.

```
GET /api/products/search?name=product-0194756   (WHERE name = ? 풀스캔)
```

### 탐지: 이번엔 에러율 패널이 끝까지 침묵했다

장애 1을 겪은 직후라 에러율 패널부터 봤다. **끝까지 0%였다.** 대신 레이턴시 패널이 울고 있었다.

![p95 450ms, p99 500ms까지 급등한 레이턴시 패널](/dev-blogV2/images/observability-lab/s2-incident-http-latency.png)

| 지표 | baseline | incident |
|------|----------|----------|
| p95 | 41.7ms | **450ms (약 11배)** |
| p99 | 40ms대 | **~500ms (약 12배)** |
| 실패율 | 0% | **0%** (8,871건 전부 성공) |
| 처리량 | 없음 | 74 RPS |

모든 요청이 "성공"하고 있었다. 느리게. 이게 장애 1과의 결정적 차이다. **"느리지만 죽지 않는" 장애는 에러율 패널만 보면 존재 자체를 모른다.** 1편에서 baseline p95(41.7ms)를 박아두지 않았다면 450ms를 보고도 "원래 이런가?" 했을 것이다.

### 원인: 느린 쿼리 로그 926건이 범인을 지목했다

PostgreSQL에 `log_min_duration_statement=100`(100ms 초과 쿼리 기록)을 켜뒀었다. 장애 구간 동안 같은 모양의 쿼리가 **926건** 쌓여 있었다.

```
duration: 100~128ms ... where p1_0.name=$1
```

Loki의 Logbook 로그에서 같은 시각 `GET /api/products/search?name=...` 요청들을 requestId와 함께 확인해 엔드포인트를 특정했고, EXPLAIN으로 확정했다.

```
[BEFORE] 인덱스 없음: Parallel Seq Scan
  워커 3개가 100만 행 전수 스캔, Buffers 14,290 read
  Execution Time: 30.657 ms

[AFTER] CREATE INDEX idx_product_name ON product (name);
  Index Scan, Buffers 4
  Execution Time: 0.080 ms   (약 380배)
```

EXPLAIN의 30.657ms는 단건 실행 계획을 확인한 값이고, 앞서 느린 쿼리 로그의 100~128ms는 30 VU 부하 중 병렬 스캔이 경합하며 관측된 값이다. 둘의 성격이 다르니 수치도 다르다.

### 해결: 인덱스 한 줄, 그리고 헛다리 하나

인덱스를 만들고 곧바로 같은 부하를 다시 걸었다. 그런데 **p99가 325ms.** 순간 "인덱스가 안 먹나?" 싶어 EXPLAIN을 다시 돌릴 뻔했다. 40초쯤 지나자 20ms대로 뚝 떨어졌다. **cold cache 워밍업, 또는 `rate(...[1m])`의 1분 집계 윈도우에 남아 있던 직전 느린 요청의 잔상**으로 보였다. 후자라면 실제 요청은 이미 빨라졌어도 분위수 계산이 직전 1분치 버킷을 계속 포함해 p99가 한동안 높게 유지된다. 어느 쪽이든 새 인덱스 직후의 과도기였고, 아래 캡처의 마지막 스파이크가 그 순간이다.

![incident 고원, 인덱스 후 복귀, 마지막의 cold cache 스파이크까지 한 시간축에](/dev-blogV2/images/observability-lab/s2-compare-http-latency.png)

워밍업 후 최종 수치:

| 지표 | incident | recovery |
|------|----------|----------|
| p95 | 450ms | **19.6ms** (baseline 수준) |
| 처리량 | 74 RPS | **약 1,500 RPS (20배)** |
| 실패율 | 0% | 0.01% (총 요청 197,509건) |

의외의 수확은 처리량이었다. 인덱스는 레이턴시만 고치는 게 아니었다. 같은 30 VU에서 처리량이 20배 뛰었다. 요청 하나가 빨리 끝나니 같은 시간에 더 많이 처리되는, 당연하지만 그래프로 보면 통쾌한 결과다.

재발 방지는 **느린 쿼리 로깅 상시화, 조회 컬럼 인덱스 점검, 엔드포인트별 레이턴시 SLO 패널**로 정리했다.

## 두 장애가 남긴 것

| | 장애 1. 풀 고갈 | 장애 2. 느린 쿼리 |
|---|---|---|
| 가장 먼저 운 신호 | `pending` (5초 만에 0에서 45) | p95/p99 (11배 급등) |
| 에러율 | **93%** | **0%** |
| 원인을 확정한 로그 | `Connection is not available (total=5, active=5...)` | `duration: ...` 느린 쿼리 926건 |
| 해결 | 점유 시간 단축 (트랜잭션 밖으로) | 인덱스 추가 |
| 풀·인프라 증설 | 불필요 | 불필요 |

같은 "자원 경합"인데 하나는 에러로 비명을 지르고 하나는 조용히 느려진다. 이번 실습에서 얻은 운영 감각을 한 문장으로 줄이면 이렇다. **에러율 패널만 보면 절반의 장애를 놓친다.** 레이턴시와 자원 패널(pending, active)까지가 한 세트다.

다음 편은 더 고약한 놈이다. 메모리 누수는 에러 한 줄 없이 힙만 우상향하다 앱째로 죽었고, 정작 죽는 순간의 **로그는 어디에도 남지 않았다.** 로그로 원인을 좁힌다는 이 시리즈의 공식이 처음으로 막히는 이야기다.

다음 편: 모니터링 장애 대응 실습 3편 - 앱이 죽어가는 신호 (작성 예정)
