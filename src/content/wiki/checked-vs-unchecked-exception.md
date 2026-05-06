---
title: "Checked Exception과 Unchecked Exception"
description: "Java의 Checked Exception과 Unchecked Exception의 차이, 선택 기준, Spring 트랜잭션 롤백과 실무에서 주의할 점을 정리합니다."
date: 2026-05-06
category: "Java"
tags: ["Java", "Exception", "Spring"]
---

Java 예외를 처음 배울 때 가장 헷갈리는 구분이 Checked Exception과 Unchecked Exception입니다.

둘의 차이는 단순히 "`try-catch`를 해야 하느냐"로 끝나지 않습니다. 어떤 예외를 메서드 시그니처에 드러낼 것인지, 호출자에게 복구 책임을 강제할 것인지, 트랜잭션을 어떻게 롤백할 것인지까지 이어지는 설계 선택입니다.

이 글에서는 Checked Exception과 Unchecked Exception의 차이를 정리하고, 실무에서 어떤 기준으로 선택하면 좋은지 살펴보겠습니다.

## 1. 예외 계층에서의 위치

Java의 예외 계층은 크게 다음과 같이 나눌 수 있습니다.

```text
Throwable
├── Error
└── Exception
    ├── RuntimeException
    └── 그 외 Exception
```

Checked Exception과 Unchecked Exception의 기준은 컴파일러가 처리 여부를 강제하느냐입니다.

| 구분 | 계층 | 컴파일러 처리 강제 | 예시 |
|------|------|-------------------|------|
| Checked Exception | `Exception` 하위이지만 `RuntimeException`이 아님 | 강제함 | `IOException`, `SQLException`, `InterruptedException` |
| Unchecked Exception | `RuntimeException` 또는 `Error` 하위 | 강제하지 않음 | `IllegalArgumentException`, `NullPointerException`, `IllegalStateException` |

보통 실무에서 "Unchecked Exception"이라고 말할 때는 대부분 `RuntimeException` 계열을 의미합니다. `Error`도 Unchecked Exception 범주에 속하지만, 애플리케이션 코드에서 직접 처리하거나 던지는 대상으로 보지는 않습니다.

## 2. Checked Exception이란 무엇인가

Checked Exception은 호출자가 반드시 처리하거나 다시 선언해야 하는 예외입니다.

```java
public String readFile(String path) throws IOException {
    return Files.readString(Path.of(path));
}
```

이 메서드를 호출하는 쪽은 두 가지 중 하나를 선택해야 합니다.

```java
// 1. 직접 처리
try {
    String content = readFile("config.yml");
} catch (IOException e) {
    // 파일을 다시 선택하게 하거나, 기본 설정으로 대체하는 등
}

// 2. 호출자에게 다시 위임
public void load() throws IOException {
    String content = readFile("config.yml");
}
```

Checked Exception의 핵심은 예외를 **공개 계약**으로 만든다는 점입니다. 메서드 시그니처에 `throws IOException`이 있으면, 이 메서드는 "파일 읽기에 실패할 수 있고, 그 실패를 호출자가 의식해야 한다"고 말하는 셈입니다.

## 3. Unchecked Exception이란 무엇인가

Unchecked Exception은 컴파일러가 처리 여부를 강제하지 않는 예외입니다.

```java
public Money(long amount) {
    if (amount < 0) {
        throw new IllegalArgumentException("금액은 음수일 수 없습니다.");
    }
    this.amount = amount;
}
```

호출자는 `try-catch`를 작성하지 않아도 됩니다.

```java
Money money = new Money(-1000); // 컴파일 오류 없음
```

그렇다고 예외가 발생하지 않는다는 뜻은 아닙니다. 런타임에 조건이 맞으면 예외는 그대로 발생합니다.

Unchecked Exception은 보통 다음 상황에 사용합니다.

- 잘못된 인자 전달
- 객체 상태가 메서드 호출 조건을 만족하지 않음
- 도메인 규칙 위반
- 프로그래밍 오류
- 애플리케이션 경계에서 일괄 처리할 실패

예를 들어 "금액은 음수일 수 없다"는 규칙을 위반했을 때 호출자가 그 자리에서 복구할 가능성은 낮습니다. 이런 경우 매번 `try-catch`를 강제하기보다 Unchecked Exception을 던지고, 상위 경계에서 일관된 방식으로 처리하는 편이 자연스럽습니다.

## 4. 둘의 차이는 컴파일 타임에 드러난다

Checked Exception과 Unchecked Exception의 가장 큰 차이는 컴파일 타임 검증입니다.

```java
// IOException은 Checked Exception
public void checked() {
    throw new IOException(); // 컴파일 오류
}

// IllegalArgumentException은 Unchecked Exception
public void unchecked() {
    throw new IllegalArgumentException(); // 컴파일 가능
}
```

Checked Exception을 던지려면 메서드 시그니처에 `throws`를 붙이거나, 메서드 내부에서 `try-catch`로 처리해야 합니다.

```java
public void checked() throws IOException {
    throw new IOException();
}
```

반면 Unchecked Exception은 메서드 시그니처에 선언하지 않아도 됩니다.

```java
public void unchecked() {
    throw new IllegalArgumentException();
}
```

`throws RuntimeException`을 명시할 수는 있지만, 호출자에게 처리 의무가 생기지는 않습니다. 문서화 목적이 아니라면 보통 생략합니다.

## 5. 언제 Checked Exception을 써야 하는가

Checked Exception은 호출자가 실제로 의미 있는 결정을 할 수 있을 때 적합합니다.

예를 들어 사용자가 파일을 업로드하거나 선택하는 기능에서 파일을 읽지 못했다면, 호출자는 다음 행동을 선택할 수 있습니다.

- 사용자에게 다시 선택하도록 안내한다
- 기본 파일을 사용한다
- 재시도한다
- 작업을 취소한다

이런 상황에서는 실패를 숨기지 않고 호출자에게 강제하는 것이 도움이 됩니다.

```java
public Config loadConfig(Path path) throws IOException {
    String text = Files.readString(path);
    return parse(text);
}
```

하지만 Checked Exception을 쓰기 전에 한 가지를 꼭 물어봐야 합니다.

> 이 예외를 받은 호출자가 정말 복구할 수 있는가?

복구할 방법이 없다면 Checked Exception은 오히려 호출 체인 전체에 `throws`를 퍼뜨리거나, 의미 없는 `try-catch`를 만들 가능성이 큽니다.

```java
try {
    service.process();
} catch (SomeCheckedException e) {
    throw new RuntimeException(e); // 처리하지 못하고 포장만 함
}
```

이런 코드가 반복된다면 Checked Exception이 문제를 명확하게 만든 것이 아니라, 호출자에게 불필요한 의무를 떠넘긴 것일 수 있습니다.

## 6. 언제 Unchecked Exception을 써야 하는가

Unchecked Exception은 호출자가 그 자리에서 복구하기 어렵고, 애플리케이션 경계에서 일관되게 처리하는 실패에 적합합니다.

웹 애플리케이션에서는 도메인 규칙 위반을 보통 Unchecked Exception으로 둡니다.

```java
public class InsufficientBalanceException extends RuntimeException {
    public InsufficientBalanceException() {
        super("잔액이 부족합니다.");
    }
}
```

서비스나 도메인 객체는 규칙 위반이 발생하면 예외를 던집니다.

```java
public void withdraw(Money money) {
    if (balance.isLessThan(money)) {
        throw new InsufficientBalanceException();
    }

    this.balance = balance.subtract(money);
}
```

Controller는 실패 분기를 직접 처리하지 않고, 전역 예외 처리기가 HTTP 응답으로 변환합니다.

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(InsufficientBalanceException.class)
    public ResponseEntity<String> handle(InsufficientBalanceException e) {
        return ResponseEntity.badRequest().body(e.getMessage());
    }
}
```

이 방식은 Controller에 성공 흐름만 남기고, 실패 응답 형식은 한 곳에서 관리할 수 있게 합니다. 자세한 예외 계층 설계는 [예외 계층 설계](/wiki/exception-hierarchy-design/) 글에서 이어서 볼 수 있습니다.

## 7. Spring 트랜잭션과 예외

Spring에서 Checked Exception과 Unchecked Exception의 차이는 트랜잭션 롤백에도 영향을 줍니다.

`@Transactional`은 기본적으로 다음 예외가 발생했을 때 롤백합니다.

- `RuntimeException`
- `Error`

반대로 Checked Exception이 발생하면 기본 설정에서는 롤백하지 않습니다.

```java
@Transactional
public void transfer() throws IOException {
    account.withdraw();
    account.deposit();

    throw new IOException(); // 기본 설정에서는 롤백되지 않음
}
```

Checked Exception에도 롤백이 필요하다면 `rollbackFor`를 명시해야 합니다.

```java
@Transactional(rollbackFor = IOException.class)
public void transfer() throws IOException {
    account.withdraw();
    account.deposit();

    throw new IOException();
}
```

이 때문에 Spring 기반 애플리케이션의 서비스/도메인 계층에서는 비즈니스 예외를 `RuntimeException` 계열로 설계하는 경우가 많습니다. 도메인 규칙 위반이 발생하면 트랜잭션이 자연스럽게 롤백되고, 호출자에게 불필요한 `throws`도 강제하지 않습니다.

## 8. Checked Exception을 Unchecked Exception으로 감쌀 때

Checked Exception을 처리할 수 없는 계층에서는 Unchecked Exception으로 감싸서 올릴 수 있습니다. 이때 원인 예외를 반드시 함께 넘겨야 합니다.

```java
try {
    Files.readString(path);
} catch (IOException e) {
    throw new FileLoadException("파일을 읽을 수 없습니다.", e);
}
```

커스텀 예외는 `cause`를 받는 생성자를 둡니다.

```java
public class FileLoadException extends RuntimeException {
    public FileLoadException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

원인 예외를 버리면 스택 트레이스에서 실제 실패 지점을 추적하기 어려워집니다.

```java
// 피해야 할 방식
catch (IOException e) {
    throw new FileLoadException("파일을 읽을 수 없습니다.");
}
```

예외를 감싸는 목적은 Checked Exception의 처리 강제를 없애는 것이지, 실패 원인을 지우는 것이 아닙니다.

## 9. InterruptedException은 특별하게 다룬다

`InterruptedException`은 Checked Exception이지만, 단순히 `RuntimeException`으로 감싸고 끝내면 안 됩니다.

```java
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    throw new RuntimeException(e); // 인터럽트 상태가 사라짐
}
```

스레드가 인터럽트되었다는 신호는 상위 코드나 실행 프레임워크가 알아야 할 수 있습니다. 따라서 직접 처리하지 못하고 감싸서 올릴 때는 인터럽트 상태를 복구해야 합니다.

```java
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
    throw new RuntimeException(e);
}
```

`InterruptedException`은 "실패했다"는 정보뿐 아니라 "이 스레드를 멈추라는 요청이 왔다"는 협력 신호입니다. 일반적인 `IOException`과 같은 방식으로 무심코 삼키면 안 됩니다.

## 10. 선택 기준 정리

Checked Exception과 Unchecked Exception을 선택할 때는 다음 기준으로 판단할 수 있습니다.

| 질문 | Checked Exception | Unchecked Exception |
|------|-------------|---------------|
| 호출자가 복구할 수 있는가 | 가능할 때 적합 | 어렵다면 적합 |
| 호출자가 반드시 알아야 하는가 | 메서드 계약에 드러냄 | 문서화하거나 경계에서 처리 |
| 호출 체인에 `throws`가 퍼지는가 | 퍼질 수 있음 | 퍼지지 않음 |
| Spring 기본 트랜잭션 롤백 | 롤백 안 됨 | 롤백됨 |
| 주 사용 위치 | 라이브러리, I/O, 외부 자원 | 도메인 규칙, 애플리케이션 예외 |

실무에서 무조건 한쪽만 쓰는 규칙은 위험합니다. 중요한 것은 호출자에게 처리 책임을 강제할 만한 이유가 있는지입니다.

## 마무리

정리하면 다음과 같습니다.

- Checked Exception은 컴파일러가 처리 여부를 강제하고, 메서드의 공개 계약이 된다
- Unchecked Exception은 처리 강제가 없고, 보통 도메인 규칙 위반이나 프로그래밍 오류에 사용한다
- Checked Exception은 호출자가 실제로 복구할 수 있을 때 의미가 있다
- Spring의 `@Transactional`은 기본적으로 Unchecked Exception에서 롤백하고, Checked Exception은 `rollbackFor`가 필요하다
- Checked Exception을 Unchecked Exception으로 감쌀 때는 반드시 원인 예외를 보존한다
- `InterruptedException`은 인터럽트 상태를 복구한 뒤 처리해야 한다

예외 설계의 핵심은 "무엇을 던질까"보다 "누가 이 실패를 책임지고 처리할 수 있는가"입니다. 호출자가 책임질 수 있으면 Checked Exception으로 드러내고, 애플리케이션 경계에서 일관되게 처리할 실패라면 Unchecked Exception으로 설계하는 편이 좋습니다.
