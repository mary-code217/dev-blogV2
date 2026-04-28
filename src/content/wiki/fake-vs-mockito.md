---
title: "Fake 객체와 Mockito"
description: "테스트에서 외부 의존성을 대체하는 두 가지 방법, Fake 객체와 Mockito의 차이와 언제 어떤 것을 선택해야 하는지 살펴봅니다."
date: 2026-04-28
category: "Testing"
tags: ["Java", "Test", "Mockito", "CleanArchitecture"]
---

테스트를 작성하다 보면 외부 의존성(데이터베이스, 외부 API, 포트 인터페이스)을 실제로 연결하지 않고 대체해야 할 상황이 생깁니다. 이때 선택지가 두 가지입니다. 직접 구현체를 만드는 Fake 객체, 그리고 프레임워크가 자동 생성해주는 Mockito입니다.

어떤 것을 쓸지 막연하게 결정하면 나중에 테스트가 깨지거나, 검증하지 않아야 할 것을 검증하게 됩니다. 이 글에서는 두 방법의 차이와 선택 기준을 살펴보겠습니다.

## 1. 테스트 더블이란

테스트 더블(Test Double)은 테스트에서 실제 협력 객체 대신 사용하는 대역입니다. 영화 촬영의 스턴트 더블처럼, 실제 객체 대신 테스트에 맞는 가짜 객체를 세웁니다.

종류가 여러 가지(Stub, Mock, Spy, Fake, Dummy)지만, 실무에서 자주 마주치는 선택은 **Fake 객체**와 **Mockito Mock** 두 가지입니다.

## 2. Fake 객체: 직접 만든 테스트용 구현체

Fake 객체는 인터페이스를 직접 구현한 테스트 전용 클래스입니다. 실제 로직 대신 테스트에 필요한 최소한의 데이터를 하드코딩해서 반환합니다.

```java
static class FakeLoadAccountPort implements LoadAccountPort {
    @Override
    public Account loadAccount(Long accountId, LocalDateTime start, LocalDateTime end) {
        return Account.builder()
                .accountId(accountId)
                .baselineBalance(new Money(30000))
                .activityWindow(new ActivityWindow(List.of()))
                .build();
    }
}
```

- 도메인 로직을 실행할 수 있는 상태의 객체를 반환합니다
- DB에 접근하지 않고, 테스트에 필요한 데이터만 돌려줍니다
- 호출 여부를 별도로 추적하지 않습니다

엄밀히 따지면 이처럼 고정된 값을 반환하는 구현체는 Stub에 가깝습니다. 다만 실무에서는 직접 구현한 테스트용 객체를 통칭 Fake라고 부르는 경우가 많습니다.

## 3. Mockito: 프레임워크가 생성하는 가짜 객체

Mockito는 인터페이스나 클래스의 가짜 구현체를 런타임에 자동 생성합니다. 동작은 `when().thenReturn()`으로 한 줄로 설정하고, 호출 여부는 `verify()`로 확인합니다.

```java
@MockitoBean  // Spring Boot 3.4.0+, 기존 @MockBean deprecated
SendMoneyUseCase sendMoneyUseCase;

// 동작 설정
when(sendMoneyUseCase.sendMoney(any())).thenReturn(true);

// 호출 검증
verify(sendMoneyUseCase).sendMoney(any());
```

- 구현 클래스를 직접 작성할 필요가 없습니다
- 어떤 인수로 몇 번 호출됐는지 검증할 수 있습니다
- 실제 비즈니스 로직은 수행하지 않습니다

## 4. 무엇을 검증하느냐가 선택 기준이다

두 방법의 차이는 결국 **"무엇을 검증하느냐"** 로 귀결됩니다.

| | Fake 객체 | Mockito |
|---|---|---|
| 적합한 상황 | 실제 동작이 필요할 때 | 호출 여부 / 반환값만 필요할 때 |
| 코드 작성 | 클래스 직접 작성 | 한 줄 설정 |
| 주요 쓰임새 | 도메인 / 유스케이스 테스트 | 컨트롤러 / 어댑터 테스트 |

구체적인 사례로 보겠습니다.

**`SendMoneyServiceTest`에서 Fake를 쓰는 이유**

유스케이스는 "잠금 → 출금 → 입금" 흐름이 올바른지 검증해야 합니다. 이 흐름을 실행하려면 실제로 동작하는 계좌 데이터가 필요합니다. Mockito로 `loadAccount()`가 호출됐는지만 확인해서는 부족합니다. 계좌 잔액이 실제로 변했는지, 트랜잭션 흐름이 맞는지 확인하려면 Fake가 반환하는 실제 객체가 있어야 합니다.

```java
@Test
void 계좌이체_성공() {
    SendMoneyCommand command = new SendMoneyCommand(1L, 2L, new Money(1000));

    boolean result = sendMoneyService.sendMoney(command);

    assertThat(result).isTrue();
    // Fake가 반환한 실제 Account 객체 위에서 도메인 로직이 실행됨
    // 잔액 변경, 잠금 해제 등 흐름 전체를 검증할 수 있음
}
```

**`SendMoneyControllerTest`에서 Mockito를 쓰는 이유**

컨트롤러 테스트는 HTTP 요청/응답 형식이 올바른지를 검증합니다. UseCase가 실제로 이체 로직을 수행할 필요가 없습니다. `sendMoney()`가 호출됐는지, 그 결과로 어떤 HTTP 응답이 나오는지만 확인하면 되므로 Mockito로 충분합니다.

```java
@MockitoBean
SendMoneyUseCase sendMoneyUseCase;

@Test
void 계좌이체_요청시_200_응답() throws Exception {
    when(sendMoneyUseCase.sendMoney(any())).thenReturn(true);

    mockMvc.perform(post("/accounts/transfer")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"sourceAccountId\":1,\"targetAccountId\":2,\"amount\":1000}"))
            .andExpect(status().isOk());

    verify(sendMoneyUseCase).sendMoney(any());  // 호출 여부만 검증
}
```

## 5. Fake 객체 설계 원칙

Fake를 쓰기로 결정했다면, 몇 가지 원칙을 지켜야 테스트가 명확해집니다.

### static inner class로 만들기

Fake가 하나의 테스트 클래스 안에서만 쓰인다면 내부 클래스로 만드는 것이 가장 단순합니다. `static`을 붙이는 이유는 외부 클래스 인스턴스 없이 독립적으로 생성할 수 있어야 하기 때문입니다.

```java
class SendMoneyServiceTest {
    static class FakeLoadAccountPort implements LoadAccountPort {
        @Override
        public Account loadAccount(...) { ... }
    }
}
```

Fake를 별도 파일로 분리하면 어떤 테스트에서 쓰이는지 파악하기 위해 파일을 오가야 합니다. 한 테스트에서만 쓰인다면 내부 클래스가 더 명확합니다.

### 최소한의 데이터만 반환하기

Fake는 테스트에 필요한 최소한의 데이터만 반환해야 합니다. 불필요한 데이터를 추가하면 테스트가 복잡해지고, 무엇을 검증하는지 의도가 흐려집니다.

```java
// ❌ 불필요한 Activity 추가: 테스트 의도가 흐려짐
activities.add(Activity.builder()...build());

// ✅ 빈 ActivityWindow: 단순하고 의도가 명확함
new ActivityWindow(List.of())
```

### YAGNI: 실제로 필요해지기 전까지는 분리하지 않기

"나중에 여러 테스트에서 쓸 것 같다"는 생각으로 Fake를 미리 별도 클래스로 빼는 것은 YAGNI(You Aren't Gonna Need It) 원칙에 어긋납니다. 지금 한 곳에서만 쓰인다면 내부 클래스가 맞습니다. 실제로 재사용이 필요해지는 시점에 분리하면 됩니다.

## 마무리

- Fake는 실제 동작하는 객체가 필요할 때, Mockito는 호출 여부나 반환값만 필요할 때 선택한다
- 도메인 / 유스케이스 테스트에는 Fake, 컨트롤러 / 어댑터 테스트에는 Mockito가 어울린다
- Fake는 테스트 클래스 안에 `static inner class`로 두는 것이 기본이다
- 반환 데이터는 테스트에 필요한 최소한으로만 유지해야 의도가 명확해진다
- 재사용이 확실히 필요해지기 전까지는 Fake를 별도 파일로 분리하지 않는다
