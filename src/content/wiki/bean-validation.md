---
title: "Bean Validation과 @Valid"
description: "Bean Validation의 선언-실행 두 단계 구조를 이해하고, @Valid가 동작하지 않는 상황과 SelfValidating 패턴으로 생성 시점에 검증하는 방법을 살펴봅니다."
date: 2026-04-28
category: "Spring"
tags: ["Java", "Spring", "Validation"]
---

Bean Validation을 처음 사용하면 `@NotNull`, `@Positive` 같은 어노테이션을 붙이는
것으로 검증이 끝난다고 생각하기 쉽습니다. 하지만 어노테이션은 규칙을 **선언**할 뿐이고,
실제로 규칙을 **실행**하는 것은 `Validator`입니다.

이 두 단계를 구분하지 않으면 `@Valid`를 붙여도 검증이 실행되지 않는 상황을 마주칩니다.

## 1. Bean Validation의 두 단계

Bean Validation(JSR-380)은 두 단계로 동작합니다.

- **선언**: `@NotNull`, `@Positive`, `@Size` 같은 어노테이션으로 규칙을 필드에 표시한다
- **실행**: `Validator`가 해당 객체를 검사하며 위반 사항을 수집한다

어노테이션만 붙인다고 검증이 실행되지 않습니다. `Validator`가 실행되어야 비로소 규칙이 적용됩니다.

## 2. @Valid의 동작 범위

`@Valid`는 Spring MVC가 HTTP 요청을 처리할 때 파라미터를 역직렬화하는 시점에
`Validator`를 자동으로 실행합니다.

```java
@PostMapping("/accounts/transfer")
ResponseEntity<Void> sendMoney(@Valid @RequestBody SendMoneyRequest request) {
    // @Valid → Spring MVC가 자동으로 Validator 실행
}
```

Spring MVC가 관여하는 **Controller 파라미터**에서만 동작합니다.
`new`로 직접 생성하는 객체에는 Spring이 개입하지 않으므로
`@Valid`를 붙여도 검증이 실행되지 않습니다.

```java
// ❌ 필드에 @NotNull이 있어도 new로 생성하면 검증이 실행되지 않음
SendMoneyCommand command = new SendMoneyCommand(null, null, money);
```

## 3. Validator 직접 실행

Spring 컨텍스트 밖에서 생성하는 객체를 검증하려면 `Validator`를 직접 실행해야 합니다.

```java
ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
Validator validator = factory.getValidator();

SendMoneyCommand command = new SendMoneyCommand(null, null, money);
Set<ConstraintViolation<SendMoneyCommand>> violations = validator.validate(command);
if (!violations.isEmpty()) {
    throw new ConstraintViolationException(violations);
}
```

동작은 하지만 검증이 필요한 곳마다 같은 코드를 반복해야 합니다.
`ValidatorFactory` 생성 비용도 크기 때문에 매번 새로 만드는 것은 비효율적입니다.

## 4. SelfValidating — 생성 시점 검증 패턴

반복을 줄이기 위해 `SelfValidating` 추상 클래스를 두고 Command 객체가 상속받게 합니다.
생성자에서 `validateSelf()`를 호출하면 `new` 시점에 즉시 검증이 실행됩니다.

```java
public abstract class SelfValidating<T> {
    // ValidatorFactory 생성 비용이 크므로 한 번만 생성해 공유
    private static final Validator validator =
        Validation.buildDefaultValidatorFactory().getValidator();

    protected void validateSelf() {
        Set<ConstraintViolation<T>> violations = validator.validate((T) this);
        if (!violations.isEmpty()) {
            throw new ConstraintViolationException(violations);
        }
    }
}
```

```java
public class SendMoneyCommand extends SelfValidating<SendMoneyCommand> {
    @NotNull private final Long sourceAccountId;
    @NotNull private final Long targetAccountId;
    @NotNull private final Money money;

    public SendMoneyCommand(Long sourceAccountId, Long targetAccountId, Money money) {
        this.sourceAccountId = sourceAccountId;
        this.targetAccountId = targetAccountId;
        this.money = money;
        validateSelf(); // 생성 시점에 즉시 검증
    }
}
```

이제 `new SendMoneyCommand(null, null, money)`를 호출하는 순간
`ConstraintViolationException`이 발생합니다.
잘못된 Command 객체가 유스케이스까지 전달될 가능성이 없어집니다.

### Controller에서 @Valid와 함께 쓸 때

`@Valid`로 Request DTO를 검증하고, Command 생성자에서 `validateSelf()`가 다시 검증합니다.
Request DTO는 `@Valid`로, Command는 `SelfValidating`으로 각각 검증 책임을 분리합니다.

```java
@PostMapping("/accounts/transfer")
ResponseEntity<Void> sendMoney(@Valid @RequestBody SendMoneyRequest request) {
    SendMoneyCommand command = new SendMoneyCommand(
        request.getSourceAccountId(),
        request.getTargetAccountId(),
        new Money(request.getAmount())
    );
    // Command 생성자에서 validateSelf() 자동 호출
}
```

## 마무리

- Bean Validation은 어노테이션으로 **선언**하고 `Validator`가 **실행**하는 두 단계로 나뉜다
- `@Valid`는 Spring MVC Controller 파라미터에서만 자동 실행되며, `new`로 생성하는 객체에는 동작하지 않는다
- Spring 컨텍스트 밖의 객체는 `Validator`를 직접 호출해야 한다
- `SelfValidating` 추상 클래스를 두면 생성 시점에 자동으로 검증이 실행되어 잘못된 객체가 유스케이스까지 전달되는 것을 막을 수 있다
