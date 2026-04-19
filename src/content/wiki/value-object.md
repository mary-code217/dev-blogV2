---
title: "Value Object (VO)"
description: "원시 타입 대신 Value Object를 사용하는 이유와 불변 객체 설계 방법을 정리합니다."
date: 2026-04-19
category: "Java"
tags: ["Java", "OOP"]
---

자바로 금액을 표현할 때 `long amount`라고 쓰는 것은 완벽하게 동작합니다.
그런데 코드베이스가 커지다 보면, 이 단순한 선택이 점점 문제를 만들어 내기 시작합니다.

이 글에서는 왜 원시 타입 대신 Value Object를 사용하는지, 그리고 어떻게 설계하는지를 순서대로 살펴보겠습니다.

## 1. 원시 타입만 쓰면 생기는 세 가지 문제

아래 코드를 보겠습니다.

```java
public void transfer(long accountId, long amount) {
    // accountId로 계좌를 찾고, amount만큼 이체한다
}
```

문법적으로는 아무 문제가 없습니다. 하지만 이 코드에는 숨은 문제가 있습니다.

### 문제 1: 컴파일러가 실수를 잡아주지 못한다

`accountId`와 `amount`는 둘 다 `long`입니다. 호출하는 쪽에서 순서를 바꿔 넘겨도 컴파일러는 아무 말도 하지 않습니다.

```java
transfer(50000L, 1L);  // 사실은 transfer(accountId, amount)인데
                       // 컴파일 오류 없음 — 런타임에서야 문제가 드러남
```

`long` 두 개를 파라미터로 받는 메서드는 호출 순서가 뒤바뀌어도 타입 검사를 통과합니다. 이런 실수는 보통 테스트나 실제 실행 단계에서야 발견됩니다.

### 문제 2: 비즈니스 규칙이 흩어진다

금액은 음수가 될 수 없습니다. 이 규칙을 어디에 둘까요?

```java
// 서비스 A에서
if (amount < 0) throw new IllegalArgumentException();

// 서비스 B에서
if (amount <= 0) throw new IllegalArgumentException();  // 규칙이 미묘하게 다름

// 서비스 C에서는 검증을 빠뜨림
```

원시 타입을 사용하면 금액에 관한 규칙이 시스템 전체에 흩어집니다. 규칙이 바뀔 때 모든 곳을 찾아서 수정해야 하고, 어딘가는 빠뜨리게 됩니다.

### 문제 3: 의미를 코드에서 표현할 수 없다

`long`은 숫자입니다. 이것이 금액인지, 계좌 ID인지, 포인트인지 코드만 봐서는 알 수 없습니다. 변수명에 의존할 수밖에 없고, 이는 안전하지 않습니다.

## 2. Value Object란 무엇인가

Value Object는 값 그 자체를 표현하는 객체입니다. 핵심 특징은 두 가지입니다.

- **식별자가 없다** — Entity처럼 ID로 구분하지 않고, 값이 같으면 같은 것으로 취급합니다.
- **불변이다** — 한번 생성된 후 내부 값이 바뀌지 않습니다.

예를 들어 `Money(50000)`과 `Money(50000)`은 서로 다른 인스턴스지만 같은 금액으로 취급해야 합니다. 반면 `Account(id=1)`과 `Account(id=2)`는 값이 같더라도 다른 계좌입니다.

VO는 "어떤 객체인가"가 아니라 "어떤 값인가"로 동일성을 판단합니다.

## 3. 불변 객체로 설계하는 이유와 방법

금액은 변경되면 안 됩니다. `Money(50000)`에서 금액을 바꾸는 것이 아니라, 연산 결과로 새로운 `Money`를 만들어야 합니다.

```java
public final class Money {       // 상속 금지
    private final long amount;   // 필드 변경 금지

    public Money(long amount) {
        if (amount < 0) throw new IllegalArgumentException("금액은 음수일 수 없습니다.");
        this.amount = amount;
    }

    public Money add(Money other) {
        return new Money(this.amount + other.amount);  // 새 객체 반환
    }
}
```

각 설계 선택의 이유가 있습니다.

- `final class` — 상속을 통해 불변성이 깨지는 것을 막습니다.
- `final` 필드 — 한 번 할당된 후 절대 변경되지 않음을 컴파일러가 보장합니다.
- 연산 메서드에서 새 객체 반환 — 기존 객체를 수정하지 않으므로 사이드 이펙트가 없습니다.
- 생성자에서 검증 — 유효하지 않은 `Money` 객체 자체가 만들어지지 않습니다.

불변 객체의 가장 큰 장점은 **신뢰성**입니다. 어떤 메서드에 `Money`를 넘겨도 그 값이 변하지 않는다는 것을 코드 작성자가 보장합니다.

## 4. equals와 hashCode — 값 동일성을 코드로 완성하기

앞서 "값이 같으면 같은 것으로 취급한다"고 설명했는데, 사실 이 설명은 아직 코드로 완성되지 않은 상태입니다.

Java에서 객체를 `==`으로 비교하면 값이 아니라 참조(주소)를 비교합니다. `equals()`를 재정의하지 않으면 `Object`의 기본 구현이 사용되고, 이 기본 구현도 참조 비교입니다.

```java
Money a = new Money(50000);
Money b = new Money(50000);

System.out.println(a.equals(b)); // false — 값은 같지만 다른 인스턴스
```

`Money(50000)`과 `Money(50000)`이 같은 금액임에도 다른 객체로 취급됩니다. VO의 정의("값이 같으면 같은 것")를 선언만 해놓고 실제로는 구현하지 않은 셈입니다.

이를 올바르게 만들려면 `equals()`와 `hashCode()`를 함께 재정의해야 합니다.

```java
@EqualsAndHashCode
public final class Money {
    private final long amount;
}
```

이렇게 하면 두 `Money` 객체는 `amount` 값이 같을 때 같은 객체로 취급됩니다.

```java
Money a = new Money(50000);
Money b = new Money(50000);

System.out.println(a.equals(b)); // true
```

### hashCode도 함께 재정의해야 하는 이유

`equals()`만 재정의하고 `hashCode()`를 빠뜨리면 `HashSet`, `HashMap`에서 예상치 못한 동작이 발생합니다.

Java 명세에는 중요한 규칙이 있습니다.

> `equals()`가 true이면 `hashCode()`도 반드시 같아야 한다.

`HashSet`은 중복 검사를 할 때 먼저 `hashCode()`로 버킷을 찾고, 그 안에서 `equals()`로 비교합니다. `hashCode()`를 재정의하지 않으면 값이 같은 두 객체가 서로 다른 버킷에 들어가고, `equals()`가 호출조차 되지 않습니다.

```java
HashSet<Money> set = new HashSet<>();
set.add(new Money(50000));

set.contains(new Money(50000)); // hashCode 미재정의 시 false
                                // hashCode 재정의 시 true
```

`@EqualsAndHashCode`는 두 메서드를 함께 재정의해주므로, VO에서는 이 어노테이션을 쓰는 것이 정석입니다.

## 5. private은 인스턴스가 아니라 클래스 단위다

VO를 처음 설계할 때 종종 혼란스러운 부분이 있습니다. 다음 코드를 보겠습니다.

```java
public final class Money {
    private final long amount;

    public boolean isLessThan(Money other) {
        return this.amount < other.amount;  // other는 다른 인스턴스인데 접근 가능?
    }
}
```

`other`는 `this`와 다른 인스턴스입니다. 그런데 `other.amount`에 접근할 수 있습니다. `private`인데도요.

이것이 가능한 이유는 `private`이 **인스턴스(객체) 단위**가 아니라 **클래스 단위**로 접근을 제어하기 때문입니다.

```
Heap
├── Money@1 { amount: 50000 }  ← this
└── Money@2 { amount: 70000 }  ← other
```

런타임에는 두 객체가 완전히 다른 주소에 존재합니다. 하지만 `private` 접근 제어는 컴파일러가 소스코드 수준에서 검사하는 규칙입니다. 컴파일러는 "이 코드가 같은 클래스 안에 있는가?"를 확인하지, 런타임에 어떤 인스턴스에 접근하는지는 따지지 않습니다.

정리하면 이렇습니다.

| 영역 | 역할 |
|------|------|
| 컴파일러 | `private` 접근 제어 검사 — 같은 클래스인가? |
| JVM | 객체를 힙에 생성하고 실행 |

`private`은 다른 클래스로부터 감추는 것이지, 같은 클래스의 다른 인스턴스로부터 감추는 것이 아닙니다. 이 점을 이해하면 VO 안에서 `other.amount`처럼 직접 접근하는 코드가 자연스럽게 느껴집니다.

## 6. Tell, Don't Ask — VO에게 판단을 맡겨라

VO를 만들었다면 값을 꺼내서 외부에서 판단하는 방식은 지양하는 것이 좋습니다.

```java
// 값을 꺼내서 외부에서 판단
if (balance.getAmount() < money.getAmount()) {
    throw new InsufficientBalanceException();
}

// VO에게 판단을 맡김
if (balance.isLessThan(money)) {
    throw new InsufficientBalanceException();
}
```

첫 번째 방식의 문제는 "잔액이 부족한지" 판단하는 로직이 VO 밖으로 새어나온다는 점입니다. 이 판단이 여러 곳에 반복되면, 앞서 본 비즈니스 규칙 분산 문제가 그대로 재현됩니다.

두 번째 방식은 `isLessThan`이라는 의미 있는 메서드를 VO 안에 두고, 외부에서는 그 결과만 사용합니다. 금액 비교에 관한 로직이 `Money` 안에 모입니다.

이 원칙을 **Tell, Don't Ask**라고 합니다. 객체에게 값을 물어본 후 외부에서 판단하는 것이 아니라, 객체에게 직접 판단을 시키라는 뜻입니다.

## 7. getter를 완전히 없애야 하는가

Tell, Don't Ask를 처음 접하면 "그럼 getter를 전혀 쓰면 안 되는 건가?"라는 의문이 생깁니다.

결론부터 말하면, 아닙니다. 상황에 따라 다릅니다.

| 상황 | 권장 방식 |
|------|----------|
| 도메인 내부 로직 | 의미 있는 메서드 사용 (`isLessThan`, `isNegative`) |
| JPA Entity 변환 | `getAmount()`로 값을 꺼내는 것이 불가피 |
| API 응답 직렬화 | `getAmount()`로 값을 꺼내는 것이 불가피 |

도메인 로직 안에서 `getAmount()`를 꺼내 직접 비교하는 것이 문제입니다. 반면 영속성 레이어에서 JPA Entity로 변환하거나, 외부 API 응답을 만들 때는 값을 꺼낼 수밖에 없습니다.

원칙을 지키는 것이 중요하지만, 인프라 경계에서 어쩔 수 없이 값을 꺼내는 경우와 도메인 로직에서 습관적으로 꺼내는 경우를 구분하는 것이 핵심입니다.

## 마무리

정리하면 다음과 같습니다.

- 원시 타입은 타입 안전성이 없고, 관련 규칙이 흩어지며, 의미를 표현하기 어렵다
- Value Object는 값의 동일성을 기준으로 하고, 불변으로 설계한다
- 불변 설계는 `final class`, `final` 필드, 새 객체 반환의 세 가지로 구현한다
- `equals()`와 `hashCode()`를 함께 재정의해야 값 동일성이 완성된다
- `private`은 클래스 단위로 접근을 제어하므로, 같은 클래스의 다른 인스턴스 필드에는 접근 가능하다
- 도메인 로직에서는 값을 꺼내지 말고 VO에게 판단을 맡겨라
- getter가 나쁜 것이 아니라, 도메인 로직 안에서 습관적으로 꺼내는 것이 문제다

Value Object는 단순히 "원시 타입을 감싼 클래스"가 아닙니다. 도메인 개념을 코드로 표현하고, 관련 규칙을 한 곳에 모으며, 실수를 컴파일 타임에 잡아내는 설계 도구입니다.
