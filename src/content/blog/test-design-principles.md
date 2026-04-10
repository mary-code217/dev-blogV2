---
title: "테스트가 어려운 이유는 테스트 코드가 아니라 설계에 있다"
description: "테스트 코드를 잘 짜고 싶어서 공부하다 보니, 문제는 대부분 설계에 있었다. 제어할 수 없는 값, 외부 의존성, 아키텍처 관점에서 테스트하기 좋은 코드란 무엇인지 공부하고 정리한 내용이다."
date: 2026-04-10
category: "Backend"
tags: ["Java", "Test"]
---

테스트 코드를 잘 쓰고 싶은데, 막상 코드를 작성하려고 하면 이런 순간이 자주 온다.

- `LocalDateTime.now()` 때문에 테스트 결과가 매번 달라진다.
- 도메인 메서드 하나를 테스트하려고 해도 DB, Spring Context, 외부 API가 같이 따라온다.
- `private` 검증 로직이 중요한데 직접 테스트할 방법이 없다.
- SQL 안에 `NOW()`나 기간 계산이 들어가 있어서 조회 결과를 고정할 수 없다.

이럴 때 흔히 "내가 테스트를 못 짜는 건가?"라고 생각하기 쉽다.  
하지만 대부분의 원인은 테스트 기술 부족이 아니라, **구현 코드가 테스트하기 어렵게 설계되어 있기 때문**이다.

이 글은 Java/Spring 기준으로 테스트하기 좋은 코드에 대해 공부하면서 이해한 내용과, 그걸 보면서 스스로 정리한 포인트를 함께 적어본 글이다.

---

## 테스트를 어렵게 만드는 두 가지

공부하면서 가장 먼저 정리하게 된 건, 테스트를 힘들게 만드는 원인이 생각보다 복잡하지 않다는 점이었다. 대부분 아래 두 가지로 수렴했다.

1. 제어할 수 없는 값에 의존하는 코드
2. 외부에 영향을 주는 코드

### 1. 제어할 수 없는 값에 의존하는 코드

대표적인 예시는 현재 시간, 난수, 사용자 입력이다.

```java
public class Order {

    private long amount;

    public void discount() {
        LocalDateTime now = LocalDateTime.now();
        if (now.getDayOfWeek() == DayOfWeek.SUNDAY) {
            this.amount = (long) (this.amount * 0.9);
        }
    }
}
```

이 코드는 비즈니스 로직 자체는 단순하지만 테스트는 어렵다.  
테스트가 성공하려면 실제 실행 시점이 일요일이어야 하기 때문이다.

즉, 로직이 틀린 게 아니라 **입력을 개발자가 통제할 수 없다는 점**이 문제다.
내가 이해한 기준으로는, 테스트가 어려운 코드의 시작점은 대체로 "입력을 내가 고를 수 없는 코드"였다.

### 2. 외부에 영향을 주는 코드

여기서 말하는 핵심은 "도메인 로직이 외부 저장 방식에 끌려가면 안 된다"는 점이다.  
즉, 도메인에서는 취소 규칙만 판단하고, 저장은 Service가 맡아야 한다.

예를 들어 주문 취소를 만든다고 했을 때, 도메인에서 해야 할 일은 "취소 주문을 어떻게 표현할 것인가"까지다.

```java
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private long amount;
    private LocalDateTime orderDateTime;
    private String description;

    public Order cancel(LocalDateTime cancelTime) {
        if (!this.orderDateTime.isBefore(cancelTime)) {
            throw new IllegalArgumentException("주문 시간이 주문 취소 시간보다 늦을 수 없습니다.");
        }

        Order cancelOrder = new Order();
        cancelOrder.amount = this.amount * -1;
        cancelOrder.orderDateTime = cancelTime;
        cancelOrder.description = this.description;
        return cancelOrder;
    }

    public static Order create(long amount, LocalDateTime orderDateTime, String description) {
        Order order = new Order();
        order.amount = amount;
        order.orderDateTime = orderDateTime;
        order.description = description;
        return order;
    }
}
```

그리고 저장은 Service가 처리한다.

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;

    @Transactional
    public void cancel(Long orderId, LocalDateTime cancelTime) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("주문을 찾을 수 없습니다."));

        Order cancelOrder = order.cancel(cancelTime);
        orderRepository.save(cancelOrder);
    }
}
```

이렇게 나누면 도메인 테스트는 DB 없이도 가능하고, 저장 책임도 분리된다.  
내가 이해한 포인트는 "도메인은 규칙을 알고, Service는 흐름을 알고, Repository는 저장만 안다"는 구조였다.

핵심은 간단하다.

> 테스트가 어려운 이유는 보통 테스트 코드의 문제가 아니라,  
> 핵심 로직과 외부 의존성이 너무 가까이 붙어 있기 때문이다.

여기서 내가 정리한 핵심은 "테스트를 잘 쓰는 방법"보다 먼저 "테스트하기 어렵게 만드는 구조가 뭔지 알아보는 것"이 더 중요하다는 점이었다.

---

## 1. 제어할 수 없는 값은 밖에서 주입한다

가장 먼저 해야 할 일은 `now()` 같은 값을 메서드 안에서 직접 만들지 않는 것이다. 이 부분은 알고 나니 단순했지만, 실제로는 무심코 가장 자주 넣게 되는 코드이기도 했다.

예시로 든 코드는 "주문이 일요일에만 10% 할인된다"는 아주 단순한 할인 규칙이다.  
중요한 건 할인 로직 자체보다, 이 로직이 **현재 시간을 어떻게 받아오느냐**였다.

```java
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private long amount;
    private LocalDateTime orderDateTime;
    private String description;

    public static Order create(long amount, LocalDateTime orderDateTime, String description) {
        Order order = new Order();
        order.amount = amount;
        order.orderDateTime = orderDateTime;
        order.description = description;
        return order;
    }

    public void discount(LocalDateTime now) {
        if (now.getDayOfWeek() == DayOfWeek.SUNDAY) {
            this.amount = (long) (this.amount * 0.9);
        }
    }
}
```

기존처럼 `discount()` 내부에서 `LocalDateTime.now()`를 직접 호출하면, 테스트 실행 시점이 일요일인지 아닌지에 따라 결과가 달라진다.  
반대로 지금처럼 `discount(LocalDateTime now)`로 바꾸면, 테스트에서 원하는 날짜를 직접 넣을 수 있다.

그래서 아래 테스트는 "일요일이라는 조건을 내가 직접 만든다"는 점에서 훨씬 단순해진다.

```java
@Test
void discountOnSunday() {
    Order order = Order.create(
            10_000L,
            LocalDateTime.of(2022, 8, 10, 10, 0),
            "신규 주문"
    );
    LocalDateTime sunday = LocalDateTime.of(2022, 8, 14, 10, 15);

    order.discount(sunday);

    assertThat(order.getAmount()).isEqualTo(9_000L);
}
```

즉, 이 테스트는 할인 기능 전체를 검증하는 게 아니라, "일요일이면 10% 할인된다"는 핵심 규칙만 정확히 검증한다.  
내가 이해한 포인트는, 테스트가 쉬워졌다는 건 결국 **조건을 내가 통제할 수 있게 되었다**는 뜻이었다.

설명만 보면 단순한 리팩터링처럼 보이지만, 테스트 관점에서는 영향이 꽤 크다. 내가 정리한 장점은 아래 세 가지다.

- 테스트 입력을 개발자가 완전히 통제할 수 있다.
- 같은 입력이면 항상 같은 결과가 나온다.
- 도메인 로직이 순수해진다.

### 그렇다면 어디서 값을 만들면 될까?

가능하면 가장 바깥쪽에서 만든다.  
예를 들면 Controller나 Service 진입점이다.

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;

    @Transactional
    public void discount(Long orderId, LocalDateTime now) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("주문을 찾을 수 없습니다."));

        order.discount(now);
    }
}
```

```java
@RestController
@RequiredArgsConstructor
@RequestMapping("/orders")
public class OrderController {

    private final OrderService orderService;

    @PostMapping("/{orderId}/discount")
    public ResponseEntity<Void> discount(@PathVariable Long orderId) {
        orderService.discount(orderId, LocalDateTime.now());
        return ResponseEntity.ok().build();
    }
}
```

프로덕션 코드에서 매번 파라미터를 넘기기 번거롭다면 `Clock`을 주입하는 것도 좋은 방법이다.

```java
@Configuration
public class TimeConfig {

    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
```

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final Clock clock;

    @Transactional
    public void discount(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("주문을 찾을 수 없습니다."));

        order.discount(LocalDateTime.now(clock));
    }
}
```

여기서 내가 특히 크게 느낀 건, 좋은 테스트 코드를 만들 때 DI가 거의 중심축처럼 작동한다는 점이었다.  
시간, 저장소, 외부 API처럼 내가 제어할 수 없는 것들을 밖에서 주입받기 시작하면 테스트는 훨씬 단순해진다.

이걸 조금 더 넓게 보면 결국 SOLID와 OOP 이야기로도 이어진다.

- SRP 관점에서는 도메인이 규칙만 알고, Service가 흐름만 담당할수록 테스트 대상이 선명해진다.
- DIP 관점에서는 구체 구현에 직접 매달리지 않고 바깥에서 의존성을 주입받을수록 대체가 쉬워진다.
- OOP 관점에서는 객체가 자기 책임에만 집중할수록 테스트도 객체의 행위를 검증하는 방향으로 단순해진다.

그래서 내가 정리한 결론은, 좋은 테스트 코드는 테스트 스킬만으로 만들어지기보다 **DI가 가능한 구조, 책임이 분리된 구조, 객체가 자기 역할에 집중하는 구조**에서 더 자연스럽게 나온다는 점이었다.

내 기준에서는 이 부분이 테스트 가능한 설계를 만드는 첫 번째 출발점이었다. 정리하면 이 원칙은 한 문장으로 요약된다.

> 제어할 수 없는 값은 로직 안에서 만들지 말고, 외부에서 주입하자.

---

## 2. 외부 의존성은 도메인에서 분리한다

도메인 객체는 비즈니스 규칙에 집중하고, 저장이나 전송 같은 작업은 바깥 계층에서 처리하는 편이 좋다. 공부하면서 특히 많이 보인 메시지도 바로 이 분리였다.

이렇게 나누면 테스트 전략도 명확해진다. 내가 보기에는 설계가 좋아졌는지를 확인하는 가장 쉬운 기준도 여기 있었다.

- 도메인 테스트는 순수 JUnit 기반의 소형 테스트로 가져가기 좋다.
- 서비스 테스트는 저장소를 fake/mock으로 대체하면 소형 테스트로도 갈 수 있다.
- 반대로 실제 DB와 Repository까지 함께 검증하면 중형 테스트에 가깝다.

즉, 중요한 건 계층 이름보다 그 테스트가 실제로 어디까지 붙느냐였다.
다만 여기서도 한 가지 고민이 남았다. 서비스 테스트를 mock이나 fake를 사용하면서까지 꼭 단위테스트로 쪼개야 하는가에 대해서는 아직 의문이 있다.
서비스가 실제로 Repository와 함께 동작하는 흐름 자체가 중요하다면, 그 부분은 오히려 중형 테스트로 있는 그대로 검증하는 편이 더 자연스러울 수도 있다고 느꼈다.

---

## 3. 테스트하고 싶은 private 메서드는 설계 신호다

자주 나오는 장면이 있다.  
검증 로직을 Service 안의 `private` 메서드로 빼두고, 나중에 그 메서드만 따로 검증하고 싶어지는 경우다.

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;

    @Transactional
    public void receipt(long amount, String description) {
        validatePositive(amount);
        Order order = Order.create(amount, description);
        orderRepository.save(order);
    }

    private void validatePositive(long amount) {
        if (amount < 0) {
            throw new IllegalArgumentException("금액은 음수가 될 수 없습니다. amount=" + amount);
        }
    }
}
```

이 상황에서 중요한 건 "private 메서드를 어떻게 테스트하지?"가 아니다.  
오히려 "왜 이 중요한 규칙이 Service 안에 숨어 있지?"를 먼저 봐야 한다.

이 대목은 개인적으로도 많이 공감됐는데, 테스트가 안 되는 문제를 도구나 리플렉션으로 풀기보다 설계를 다시 보는 쪽이 더 본질적이라는 뜻으로 읽혔다.

### 방법 1. 도메인 생성 시점으로 이동

검증이 특정 도메인에만 속한다면, 그 도메인의 생성자나 정적 팩토리 메서드로 옮긴다.

```java
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private long amount;
    private String description;

    public static Order create(long amount, String description) {
        validatePositive(amount);

        Order order = new Order();
        order.amount = amount;
        order.description = description;
        return order;
    }

    private static void validatePositive(long amount) {
        if (amount < 0) {
            throw new IllegalArgumentException("금액은 음수가 될 수 없습니다. amount=" + amount);
        }
    }
}
```

그러면 검증은 자연스럽게 도메인 테스트로 확인할 수 있다.

### 방법 2. 값 객체로 분리

여러 곳에서 재사용하는 규칙이라면 값 객체로 분리하는 편이 더 낫다. 정리해보면 검증 로직을 "숨기는 것"보다 "의미 있는 타입으로 드러내는 것"이 훨씬 읽기 좋다.

```java
@Embeddable
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Money {

    private long amount;

    public Money(long amount) {
        if (amount < 0) {
            throw new IllegalArgumentException("금액은 음수가 될 수 없습니다. amount=" + amount);
        }
        this.amount = amount;
    }
}
```

이 경우 `Order`도 `Money`를 받도록 바뀌어야 흐름이 자연스럽다.

```java
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Embedded
    private Money money;
    private String description;

    public static Order create(Money money, String description) {
        Order order = new Order();
        order.money = money;
        order.description = description;
        return order;
    }
}
```

이후 Service는 검증을 몰라도 된다.

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;

    @Transactional
    public void receipt(long amount, String description) {
        Money money = new Money(amount);
        Order order = Order.create(money, description);
        orderRepository.save(order);
    }
}
```

결국 중요한 메시지는 이것이다.

> 테스트가 필요한 private 메서드가 많아질수록,  
> 그 클래스는 역할이 과해졌을 가능성이 높다.

---

## 4. SQL 안에도 비즈니스 로직을 숨기지 않는다

애플리케이션 코드에서는 시간 주입을 신경 쓰면서, SQL에서는 무심코 `NOW()`를 쓰는 경우가 많다.  
하지만 이 역시 같은 문제를 만든다.

```java
public interface BlogRepository extends JpaRepository<Blog, Long> {

    @Query(value = "SELECT * FROM blog WHERE publish_at <= NOW()", nativeQuery = true)
    List<Blog> findAllPublished();
}
```

이 쿼리는 실행 시점에 따라 결과가 달라진다.  
게다가 기간 계산까지 SQL 안에 넣으면 비즈니스 규칙이 저장소 계층으로 숨어버린다.

```java
public interface BlogRepository extends JpaRepository<Blog, Long> {

    @Query(value = """
        SELECT * FROM blog
        WHERE publish_at BETWEEN DATE_SUB(NOW(), INTERVAL 7 DAY) AND NOW()
        """, nativeQuery = true)
    List<Blog> findRecentBlogs();
}
```

더 나은 방식은 애플리케이션에서 기준 시각과 기간을 계산하고, Repository에는 파라미터만 넘기는 것이다. 내가 정리한 포인트는 "SQL도 예외가 아니라 똑같이 테스트 가능한 형태로 만들어야 한다"는 점이었다.

```java
public interface BlogRepository extends JpaRepository<Blog, Long> {

    @Query("SELECT b FROM Blog b WHERE b.publishAt <= :now")
    List<Blog> findAllPublished(@Param("now") LocalDateTime now);
}
```

```java
public interface BlogQueryRepository {

    List<Blog> findAllByPeriod(LocalDateTime startedAt, LocalDateTime endedAt);
}
```

```java
@Service
@RequiredArgsConstructor
public class BlogService {

    private final BlogQueryRepository blogQueryRepository;

    public List<Blog> findRecentBlogs(LocalDateTime now) {
        LocalDateTime startedAt = now.minusDays(7);
        return blogQueryRepository.findAllByPeriod(startedAt, now);
    }
}
```

이렇게 하면 테스트에서 기준 시간을 고정할 수 있고, 기간 계산 규칙도 서비스 계층에서 읽기 쉽게 관리할 수 있다.

---

## 한 번에 정리하는 기준

여기까지의 내용을 읽고 나서, 어떤 기준으로 보면 좋을지 나름대로 다시 정리해봤다.

### 1. 도메인 레이어

- 현재 시간, 난수, 외부 API 호출을 직접 만들지 않는다.
- Repository를 파라미터로 받지 않는다.
- 가능한 한 같은 입력이면 같은 결과가 나오는 메서드를 만든다.

### 2. 서비스 레이어

- 외부 의존성을 조합하고 트랜잭션을 관리한다.
- 도메인 로직을 호출하고 저장, 발송, 조회를 연결한다.
- 복잡한 검증이 자꾸 쌓이면 도메인이나 값 객체로 이동할 신호로 본다.

서비스 레이어를 보면서는 DI의 의미가 더 분명해졌다.  
Repository, Clock, 외부 클라이언트 같은 것들을 주입받는 이유는 Spring 스타일을 따르기 위해서가 아니라, 각 책임을 분리하고 테스트에서 바꿔 끼울 수 있게 만들기 위해서다. 이 지점에서 SOLID의 DIP와 OOP의 책임 분리가 테스트 용이성과 바로 연결된다고 느꼈다.

### 3. 저장소 레이어

- SQL은 데이터 조회와 저장에 집중한다.
- `NOW()`, `DATE_SUB()` 같은 실행 시점 의존 로직은 최대한 밖으로 뺀다.
- 비즈니스 규칙을 SQL에 숨기지 않는다.

---

## 설계의 완성: 아키텍처 관점에서 본 테스트 용이성

앞서 살펴본 네 가지 원칙(제어할 수 없는 값 주입, 외부 의존성 분리, private 메서드 설계 신호, SQL 정리)은 결국 하나의 방향을 가리킨다.  
**도메인을 외부로부터 완전히 격리하자.**

이 방향을 가장 체계적으로 실현한 것이 클린 아키텍처와 헥사고날 아키텍처다.

### 클린 아키텍처의 핵심 목표

클린 아키텍처가 말하는 핵심은 단순하다.

> 도메인 로직이 가장 중요하고, 프레임워크는 도구일 뿐이다.  
> 도메인이 프레임워크에 종속되면 안 된다.

이걸 테스트 관점으로 바꿔 읽으면 이렇게 된다.  
"핵심 비즈니스 로직은 Spring도, JPA도, 외부 API도 없이 검증할 수 있어야 한다."

레이어드 아키텍처에서 자주 생기는 문제는, 계층 간 경계가 흐릿해지면서 Controller가 Repository를 직접 알거나, 도메인이 JPA 어노테이션으로 가득 차는 경우다.  
이 상태에서는 도메인 하나를 테스트하려고 해도 Spring Context와 DB가 따라온다.

### 헥사고날 아키텍처: 포트와 어댑터

헥사고날 아키텍처는 클린 아키텍처의 이 문제를 "포트와 어댑터"라는 개념으로 구체화한다.

```
   Input Adapter       ┌──────────────────────┐    Output Adapter
  (Controller) ──→     │   Input Port          │
                       │       ↓               │
                       │   Domain              │──→ Output Port ──→ (Repository, 외부 API)
                       │   (비즈니스 로직)      │
                       └──────────────────────┘
```

| 구성 요소 | 역할 | Spring 대응 |
|----------|------|------|
| **Input Port** | 외부 요청을 받는 인터페이스 | Service 인터페이스 (UseCase) |
| **Input Adapter** | 요청을 Input Port에 전달 | Controller, MessageListener |
| **Output Port** | 도메인이 외부에 요청하는 인터페이스 | Repository 인터페이스 |
| **Output Adapter** | Output Port의 실제 구현 | JpaRepository 구현체 |

핵심은 의존 방향이다. 외부 → 내부 방향으로만 의존이 흐른다.  
도메인은 자신을 감싸고 있는 어댑터가 JPA인지, Redis인지, 테스트용 Map인지 알지 못한다.

### Spring 코드로 보면 이렇게 된다

```java
// Output Port (인터페이스 — 도메인이 아는 것)
public interface OrderRepository {
    Optional<Order> findById(Long id);
    Order save(Order order);
}

// Output Adapter — 프로덕션 (JPA)
@Repository
@RequiredArgsConstructor
public class OrderRepositoryImpl implements OrderRepository {
    private final OrderJpaRepository jpaRepository;
    // JPA를 사용하지만 도메인은 이 구현을 모른다
}

// FakeAdapter — 테스트 (DB 불필요)
public class FakeOrderRepository implements OrderRepository {
    private final Map<Long, Order> store = new HashMap<>();
    private long sequence = 1L;

    @Override
    public Optional<Order> findById(Long id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public Order save(Order order) {
        store.put(sequence++, order);
        return order;
    }
}
```

이렇게 분리하면 서비스 테스트는 DB 없이 `FakeOrderRepository`로 돌릴 수 있다.  
이것이 원칙 2에서 말한 "서비스 테스트를 소형 테스트로 가져갈 수 있다"는 방법의 실제 구현이다.

### JPA Repository를 어떻게 다루는가

자주 나오는 패턴은 세 가지다.

```
(1) ServiceImpl → JpaRepository 직접 사용
    → FakeRepository로 교체하기 어렵다

(2) ServiceImpl → Repository 인터페이스 ← JpaRepository 가 직접 구현
    → FakeRepository 교체는 가능하나, 테스트에서 JPA 스펙이 노출됨

(3) ServiceImpl → Repository 인터페이스 ← RepositoryImpl (JpaRepository를 멤버로 보유)
    → FakeRepository 교체가 가장 자연스럽고 테스트 용이성이 높다 ← 추천
```

JpaRepository를 Repository 인터페이스의 구현체가 "멤버"로 가져가면, 테스트 시 FakeRepository만 만들면 되고 JPA에 대한 고려가 테스트 코드에서 사라진다.

### 유스케이스의 역할

클린 아키텍처에서 Use Case는 Input Port와 같다.  
즉, 애플리케이션의 진입점을 "기능 단위"로 구성하는 것이다.

```java
// Input Port (UseCase 인터페이스)
public interface CancelOrderUseCase {
    void cancel(Long orderId, LocalDateTime cancelTime);
}

// Application Layer (UseCase 구현)
@Service
@RequiredArgsConstructor
public class CancelOrderService implements CancelOrderUseCase {

    private final OrderRepository orderRepository;

    @Override
    public void cancel(Long orderId, LocalDateTime cancelTime) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("주문을 찾을 수 없습니다."));
        Order cancelOrder = order.cancel(cancelTime);
        orderRepository.save(cancelOrder);
    }
}
```

Controller에서 알아야 할 건 `CancelOrderUseCase`뿐이다.  
구현체가 바뀌어도 Controller는 영향을 받지 않는다.

### 레이어별 모델을 분리한다

단일 모델로 모든 레이어를 커버하려 하면 각 레이어의 요구사항이 충돌한다.  
(JPA Entity에 Controller 응답 로직이 들어가거나, 도메인 객체에 @JsonProperty 같은 어노테이션이 붙는 식이다.)

| 레이어 | 모델 | 역할 |
|--------|------|------|
| Controller | RequestDto, ResponseDto | HTTP 요청/응답 표현 |
| Application (Service) | Domain Model | 비즈니스 규칙 표현 |
| Repository | JPA Entity | 영속성 표현 |

레이어 간에는 변환 메서드(`from()`, `toModel()` 등)로 연결한다.  
변환 코드가 늘어나는 단점이 있지만, 각 레이어가 외부 변화에 독립적이 된다는 이점이 있다.

---

## 테스트 전략도 함께 달라진다

설계가 바뀌면 테스트 분포도 자연스럽게 건강해진다. 결국 테스트 전략은 프레임워크 선택보다 설계 결과에 더 가깝다는 생각이 들었다.

개인적으로는 여기서 구글이 말하는 소형, 중형, 대형 테스트 분류를 많이 참고하게 됐다.

- 소형 테스트는 순수 자바 코드 중심으로, 외부 I/O 없이 빠르게 도는 테스트에 가깝다.
- 중형 테스트는 DB나 JPA 같은 실제 저장소 계층을 어느 정도 포함하는 테스트에 가깝다.
- 대형 테스트는 전체 애플리케이션 흐름이나 시스템 통합에 가까운 테스트다.

이 기준으로 보면 내 생각에는 도메인 테스트는 대부분 소형 테스트로 가져가는 게 맞다.  
반면 서비스 레이어는 조금 더 고민이 필요하다.

서비스에서도 mock이나 fake를 써서 소형 테스트처럼 가져갈 수는 있다.  
다만 실제로 서비스가 Repository를 통해 데이터를 읽고 저장하는 흐름 자체를 확인하고 싶다면, 굳이 그걸 억지로 소형 테스트로 밀어 넣을 필요는 없다고 느꼈다.

그래서 지금은 이렇게 정리하고 있다.

| 테스트 대상 | 주로 보는 분류 | 목적 |
|------|------|------|
| Domain, Value Object | 소형 테스트 | 핵심 규칙을 빠르게 검증 |
| Service | 소형 또는 중형 테스트 | orchestration 로직 검증, 필요시 저장 흐름 확인 |
| Repository | 중형 테스트 | 쿼리/JPA 매핑 검증 |
| 전체 흐름 | 대형 테스트 | 실제 통합 시나리오 확인 |

내가 지금 더 공감하는 방향은 "서비스는 무조건 mock으로 쪼개서 소형 테스트로 만들어야 한다"보다는,  
"서비스에 들어있는 책임이 무엇인지 보고 소형으로 가져갈지, 중형으로 검증할지 결정하자"에 가깝다.

즉, 테스트를 많이 쓰는 것이 중요한 게 아니라 **비용 대비 효과가 좋은 테스트를 적절한 크기로 배치하는 것**이 더 중요하다고 느꼈다.

---

## 마무리

테스트하기 좋은 코드는 특별한 기술로 만들어지지 않는다.  
지금까지 살펴본 원칙들은 모두 아주 기본적인 설계 원칙에서 출발한다.

내가 이번에 정리하면서 가장 크게 남은 문장은 결국 이것이었다. 테스트 코드는 설계의 결과물이다.  
테스트가 어렵다면 테스트 코드를 더 열심히 짜기 전에, 먼저 구현 코드의 경계를 다시 보는 편이 훨씬 효과적이다.

### 하지만, 정답이 아니라 기준이다

지금까지 정리한 내용들 — 값 주입, 도메인 격리, 헥사고날 아키텍처, FakeAdapter, 레이어별 모델 분리 — 은 "좋은 테스트란 무엇인가"라는 질문에 대한 정석에 가깝다고 생각한다.

하지만 이것들을 전부 따라야 하는 건 아니다.

클린 아키텍처를 완벽하게 구현하는 것도, 모든 서비스 테스트를 소형 테스트로 유지하는 것도, 팀과 시스템의 상황에 따라 오히려 비용이 더 클 수 있다.  
단순한 CRUD 서비스에 헥사고날 아키텍처를 완전히 적용하면 변환 코드만 늘어나고, 소규모 팀에서 레이어별 모델을 모두 분리하면 유지보수 부담이 커진다.

내가 생각하는 올바른 방향은 이렇다.

> 이 원칙들을 알고 있되, 우리 시스템과 팀의 환경에 맞게 선택적으로 적용한다.

어디서 어느 정도의 격리가 필요한지, 어떤 테스트가 가장 비용 대비 효과가 좋은지는 결국 그 시스템을 가장 잘 아는 개발자가 판단해야 한다.  
이 글에서 정리한 원칙들은 그 판단을 위한 기준이지, 무조건 따라야 할 규칙이 아니다.

---

## 한 번에 점검하는 체크리스트

- 내 도메인 메서드 안에서 `now()`, `random()`, 외부 SDK를 직접 호출하고 있지 않은가?
- 도메인 객체가 Repository, HTTP 클라이언트, 메시지 발송기를 알고 있지 않은가?
- 테스트하고 싶은 `private` 메서드가 많아지고 있지 않은가?
- SQL 안에 시간 계산이나 비즈니스 규칙이 숨어 있지 않은가?
- 핵심 규칙을 Spring 없이도 검증할 수 있는가?

위 질문에 여러 개가 걸린다면, 테스트 코드보다 먼저 설계를 정리할 시점일 가능성이 높다.
