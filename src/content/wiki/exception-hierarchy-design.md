---
title: "예외 계층 설계"
description: "커스텀 예외가 늘어날 때 계층 구조로 정리하는 방법, Spring 전역 예외 처리, RFC 9457 표준 에러 응답까지 순서대로 살펴봅니다."
date: 2026-04-26
category: "Spring"
tags: ["Java", "Spring", "Exception"]
---

Spring으로 API를 만들다 보면 커스텀 예외가 하나씩 늘어납니다. 처음에는 괜찮지만, 예외가 다섯 개, 열 개를 넘어가면 `@ExceptionHandler`를 등록하는 코드도 그만큼 늘어납니다.

이 글에서는 예외를 계층 구조로 설계해서 핸들러를 하나로 줄이는 방법과, Spring 6에서 도입된 `ProblemDetail` 표준 응답 형식을 함께 살펴보겠습니다.

## 1. 예외마다 핸들러를 등록하면 생기는 문제

계좌 이체 기능을 예로 들겠습니다. 발생할 수 있는 예외가 세 가지입니다.

```java
// ❌ 예외마다 핸들러를 하나씩 등록
@ExceptionHandler(AccountNotFoundException.class)
public ProblemDetail handleAccountNotFound(...) { ... }

@ExceptionHandler(WithdrawFailException.class)
public ProblemDetail handleWithdrawFail(...) { ... }

@ExceptionHandler(NegativeMoneyException.class)
public ProblemDetail handleNegativeMoney(...) { ... }
```

예외가 늘어날 때마다 핸들러도 늘어납니다. 응답 형식이 바뀌면 모든 핸들러를 찾아서 수정해야 하고, 어딘가 하나를 빠뜨리면 일관성이 깨집니다.

근본적인 문제는 예외들이 서로 연결되어 있지 않다는 점입니다. 세 예외 모두 "도메인 규칙 위반"이라는 공통점이 있는데, 코드에는 그 관계가 없습니다.

## 2. DomainException — 공통 부모로 묶기

공통 부모 예외를 하나 만들면 핸들러 하나로 모든 도메인 예외를 처리할 수 있습니다.

```java
// domain/common/DomainException.java
public class DomainException extends RuntimeException {
    private final HttpStatus status;

    public DomainException(String message, HttpStatus status) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() { return status; }
}
```

`RuntimeException`을 상속하는 것은 의도적인 선택입니다. Spring의 `@Transactional`은 기본적으로 `RuntimeException`이 발생했을 때만 롤백합니다. 체크드 예외(`Exception` 상속)를 사용하면 `@Transactional(rollbackFor = Exception.class)`를 매번 명시해야 합니다. 도메인 규칙 위반은 복구 가능성이 없는 상황이므로 언체크드 예외가 자연스럽고, 호출하는 쪽에서 `try-catch`를 강제할 필요도 없습니다.

각 예외는 `DomainException`을 상속하고, 자신에게 맞는 HTTP 상태 코드를 직접 갖습니다.

```java
public class AccountNotFoundException extends DomainException {
    public AccountNotFoundException() {
        super("계좌를 찾을 수 없습니다.", HttpStatus.NOT_FOUND);  // 404
    }
}

public class WithdrawFailException extends DomainException {
    public WithdrawFailException() {
        super("잔액이 부족합니다.", HttpStatus.BAD_REQUEST);  // 400
    }
}

public class NegativeMoneyException extends DomainException {
    public NegativeMoneyException() {
        super("금액은 음수일 수 없습니다.", HttpStatus.BAD_REQUEST);  // 400
    }
}
```

계층 구조는 이렇게 됩니다.

```
DomainException
├── AccountNotFoundException  — 계좌를 찾을 수 없을 때  (404)
├── WithdrawFailException     — 잔액 부족 등 출금 실패 시 (400)
└── NegativeMoneyException    — 음수 금액 생성 시도 시   (400)
```

새 도메인 예외를 추가해도 핸들러는 수정할 필요가 없습니다. 상태 코드도 각 예외가 스스로 결정하므로 핸들러에서 따로 분기하지 않아도 됩니다.

`detail` 필드는 외부 클라이언트에 그대로 노출됩니다. 내부 식별자(id, 테이블명 등)를 메시지에 포함시키면 의도치 않은 정보가 유출될 수 있습니다. 예외 메시지는 클라이언트가 이해할 수 있는 수준으로만 작성하고, 내부 컨텍스트는 로그에 남기는 것이 좋습니다.

## 3. 예외는 어느 레이어에 두어야 하는가

"계좌를 찾을 수 없다", "잔액이 부족하다"는 인프라 문제가 아니라 **비즈니스 규칙**입니다. 따라서 예외는 도메인 레이어에 위치합니다.

```
domain/
├── account/
│   └── exception/
│       ├── AccountNotFoundException.java
│       ├── WithdrawFailException.java
│       └── NegativeMoneyException.java
└── common/
    └── DomainException.java   ← 모든 도메인 예외의 부모
```

DB 연결 실패처럼 인프라에서 발생하는 예외는 `DomainException`을 상속하지 않습니다. 이런 예외는 `GlobalExceptionHandler`의 `Exception` 폴백 핸들러가 잡아서 `500 Internal Server Error`로 처리합니다.

## 4. @RestControllerAdvice — 전역 예외 처리

`@RestControllerAdvice`는 모든 Controller에서 발생하는 예외를 한 곳에서 처리합니다. `@ControllerAdvice`와 `@ResponseBody`를 합친 메타 어노테이션으로, Spring이 Controller에서 발생한 예외를 이 클래스로 위임하는 메커니즘입니다.

위치는 HTTP 응답을 다루는 presentation 레이어에 둡니다.

```java
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(DomainException.class)
    public ResponseEntity<ProblemDetail> handleDomainException(DomainException e, HttpServletRequest request) {
        log.warn("[도메인 예외] {}", e.getMessage());
        return response(e.getMessage(), e.getStatus(), request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> handleValidationException(MethodArgumentNotValidException e, HttpServletRequest request) {
        String detail = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining(", "));
        log.warn("[검증 예외] {}", detail);
        return response(detail, HttpStatus.BAD_REQUEST, request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleUnexpectedException(Exception e, HttpServletRequest request) {
        log.error("[예상치 못한 예외]", e);
        return response("서버 오류가 발생했습니다.", HttpStatus.INTERNAL_SERVER_ERROR, request);
    }

    private ResponseEntity<ProblemDetail> response(String detail, HttpStatus status, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatus(status);
        pd.setTitle(status.getReasonPhrase());
        pd.setDetail(detail);
        pd.setInstance(URI.create(request.getRequestURI()));
        pd.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(status).body(pd);
    }
}
```

세 종류의 핸들러가 역할을 나눕니다.

| 핸들러 | 대상 | 상태 코드 | 로그 |
|--------|------|-----------|------|
| `DomainException` | 도메인 규칙 위반 | 예외가 직접 결정 | `WARN` |
| `MethodArgumentNotValidException` | `@Valid` 검증 실패 | 400 | `WARN` |
| `Exception` | 예상치 못한 예외 | 500 | `ERROR` |

`@ExceptionHandler` 메서드에서 `ProblemDetail`을 그냥 반환하면 HTTP 응답 상태 코드가 `200`으로 내려갑니다. `ProblemDetail.forStatus()`는 객체 내부의 `status` 필드만 설정할 뿐, 실제 HTTP 응답 코드와는 무관합니다. `ResponseEntity.status()`로 감싸야 의도한 상태 코드가 응답에 반영됩니다.

`@Valid`로 발생하는 검증 실패는 Spring MVC 내부 예외라 `DomainException` 계층 밖입니다. 별도로 등록하지 않으면 `Exception` 폴백 핸들러가 잡아 `500`으로 내려보내거나, Spring 기본 에러 응답 형식이 반환되어 `ProblemDetail` 형식과 달라집니다.

도메인 예외는 `WARN`, 예상치 못한 예외는 `ERROR`로 구분합니다. 두 로그 레벨을 분리하면 알림 임계값을 다르게 설정할 수 있어 운영에서 불필요한 알림 노이즈를 줄일 수 있습니다.

## 5. ProblemDetail — RFC 9457 표준 에러 응답

`ProblemDetail`은 Spring 6에서 도입된 표준 에러 응답 형식입니다. [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)(RFC 7807을 대체한 최신 스펙)에 정의된 구조를 그대로 구현한 것으로, 클라이언트가 에러 응답을 일관된 형식으로 파싱할 수 있습니다.

응답 예시입니다.

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "계좌를 찾을 수 없습니다.",
  "instance": "/api/accounts/1/transfer",
  "timestamp": "2026-04-26T10:30:00Z"
}
```

각 필드의 역할은 다음과 같습니다.

| 필드 | 설명 |
|------|------|
| `type` | 에러 유형을 나타내는 URI, 기본값은 `about:blank` |
| `title` | HTTP 상태 설명 (`Bad Request`, `Not Found` 등) |
| `status` | HTTP 상태 코드 |
| `detail` | 에러 상세 메시지 |
| `instance` | 에러가 발생한 요청 URI |
| 커스텀 필드 | `setProperty()`로 자유롭게 추가 가능 |

커스텀 에러 응답 클래스를 따로 만들지 않아도 되고, 팀마다 형식이 달라지는 문제도 없어집니다.

## 6. Controller는 성공 흐름만 담당한다

예외 계층을 갖추면 Controller 코드가 단순해집니다.

실패를 반환값으로 처리하면 Controller가 분기를 직접 다뤄야 합니다.

```java
// ❌ 반환값으로 실패를 처리 — 분기가 Controller에 들어옴
boolean result = sendMoneyUseCase.sendMoney(command);
if (!result) {
    return ResponseEntity.badRequest().body("계좌이체 실패");
}
return ResponseEntity.ok("계좌이체 완료");
```

실패를 예외로 처리하면 Controller에는 성공 흐름만 남습니다. UseCase 내부에서 규칙 위반이 발생하면 `DomainException`을 던지고, `GlobalExceptionHandler`가 이를 잡아 일관된 에러 응답으로 변환합니다.

```java
// ✅ 실패는 예외로 — Controller는 성공 흐름만 담당
sendMoneyUseCase.sendMoney(command);
return ResponseEntity.ok("계좌이체가 완료되었습니다.");
```

Controller는 "정상적으로 완료되면 무엇을 반환하는가"에만 집중하면 됩니다.

## 마무리

예외를 도메인 개념으로 다루면 핸들러는 자연스럽게 단순해집니다.

- 공통 부모 `DomainException`에 `HttpStatus`를 담으면 예외 종류마다 적절한 상태 코드를 반환할 수 있고, 핸들러에서 분기할 필요가 없다
- `@Valid` 검증 실패처럼 `DomainException` 밖에서 오는 예외는 별도 핸들러로 처리한다
- 도메인 예외는 `WARN`, 예상치 못한 예외는 `ERROR`로 구분해 로깅하면 운영 알림 노이즈를 줄일 수 있다
- 예외 메시지는 클라이언트에 그대로 노출되므로, 내부 식별자가 포함되지 않도록 주의한다
