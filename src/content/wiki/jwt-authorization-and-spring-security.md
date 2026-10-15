---
title: "JWT 권한 클레임과 요청별 DB 조회 비교"
description: "관리자 인가를 예로 JWT의 역할 클레임과 DB 조회를 비교하고, CurrentActor와 Spring Security의 필터·메서드 인가를 구분합니다."
date: 2026-09-13
category: "Spring"
tags: ["JWT", "Spring Security", "Authorization", "RBAC"]
draft: false
---

JWT 액세스 토큰으로 사용자를 식별하더라도 권한 정보를 어디서 가져오는지는 선택이 갈립니다. 토큰에 직접 역할을 담거나, 토큰의 사용자 ID를 이용해 요청마다 데이터베이스에서 조회할 수 있습니다.

두 방식은 역할을 신뢰하는 시점과 조회 비용이 다릅니다. 또한 필터에서 인가할지 메서드에서 인가할지는 권한을 어디서 가져오느냐와는 별개의 선택입니다.

---

## JWT에 담으면 발급 시점의 역할을 사용합니다

- 인증: 너는 누구인가?
- 인가: 무엇을 할 수 있는가?

여기서는 JWT를 API에 제출하는 액세스 토큰으로 쓰는 경우입니다. 회원사 한 곳에 발급한 토큰의 클레임 예시입니다. 서명과 만료 시간은 생략했습니다.

```json
{
  "sub": "user-123",
  "tenant_id": "tenant-A",
  "roles": ["TENANT_ADMIN"]
}
```

특정 역할을 관리자 권한으로 정의하면, 서버는 데이터베이스를 다시 읽지 않고 관리자 기능 접근 여부를 판단할 수 있습니다. 이 글에서 비교하는 권한 정보가 바로 이런 역할입니다.

물론 서명, 만료, 발급자, 대상 API 검증을 통과한 토큰이어야 합니다. 검증 항목은 [공식 표준 문서에서 안내하는 기준](https://www.rfc-editor.org/rfc/rfc9068.html#section-4)을 따릅니다.

이 방식을 쓰면 요청마다 데이터베이스를 보지 않아도 되고, 여러 API 서버가 같은 토큰으로 인가할 수 있습니다. 대신 역할은 발급 시점 기준이므로, 데이터베이스에서 권한을 바꿔도 이미 발급된 토큰은 그대로 유지됩니다.

## DB에서 조회하면 조회 시점의 역할을 사용합니다

JWT에는 사용자 식별 정보만 두고, 역할은 요청마다 데이터베이스에서 읽어오는 방식입니다. 토큰을 검증한 뒤 사용자 ID와 회원사 범위로 역할을 조회합니다.

이 방식을 쓰면 역할이 바뀔 경우 다음 요청부터 즉시 반영됩니다. 같은 조회 과정에서 계정 정지 여부나 회원사 소속 변경도 확인할 수 있습니다.

대신 요청마다 조회 비용이 발생하고, 데이터베이스 장애가 곧 인가 장애로 이어집니다. 조회 부담을 줄이려고 캐시나 읽기 전용 복제 데이터베이스를 도입하면 즉시 반영도 완벽히 보장되지는 않습니다.

그렇다고 컨트롤러마다 일일이 조회 코드를 넣을 필요는 없습니다. 인증 단계에서 읽은 역할을 인증 객체에 담아두면 필터와 메서드 인가가 그대로 활용할 수 있습니다. [JWT 클레임도 같은 방식으로 인증 객체의 권한으로 변환됩니다](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html#oauth2resourceserver-jwt-architecture).

## CurrentActor는 권한 정보의 출처를 감출 수 있습니다

현재 요청자 정보를 제공하는 인터페이스를 구현하는 방식입니다.

```java
public interface CurrentActor {
    String userId();
    String tenantId();
    Optional<String> findUserId();
    boolean isTenantAdministrator();
}
```

비즈니스 로직은 이 인터페이스만 바라보며, 관리자 여부를 확인하는 메서드가 데이터베이스를 읽는지 JWT를 읽는지는 알지 못합니다.

- 요청 안에서 결과를 재사용하면 중복 조회가 줄어듭니다.
- 요청 범위를 넘어 캐시하면 역할 변경 시 무효화 처리 방법이 필요합니다.
- 싱글톤 빈으로 관리할 때는 요청자 정보를 인스턴스 필드에 두지 말고 보안 컨텍스트에서 읽어야 합니다.

값이 발급 시점 것인지 조회 시점 것인지는 인터페이스만 봐서는 알 수 없으므로 설계 단계에서 명확히 정해야 합니다.

## 역할이 드물게 바뀌어도 즉시 반영이 필요할 수 있습니다

관리자 역할이 1년에 한 번 바뀌더라도, 권한 해제 즉시 차단해야 한다면 기존 토큰만으로는 대응할 수 없습니다.

예를 들어 액세스 토큰 수명이 10분이고 별도의 폐기 확인 절차가 없다면, 발급 직후에 역할을 해제해도 10분 동안은 이전 권한이 유효하게 작동합니다. 이 정도의 지연을 허용할 수 있다면 JWT에 역할을 담는 방식이 적합하며, 토큰이 재발급될 때 바뀐 권한이 반영됩니다.

반대로 즉시 차단해야 한다면 현재 역할을 직접 조회하거나 [토큰 폐기 여부를 확인해야 합니다](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/opaque-token.html).

## 공식 문서는 어느 한쪽을 강제하지 않습니다

JWT 표준 사양에서는 [어떤 클레임을 사용할지 애플리케이션이 자율적으로 정하도록 합니다](https://www.rfc-editor.org/rfc/rfc7519.html#section-4.1). JWT 자체에 특정 역할 필드가 필수로 포함되지는 않습니다.

액세스 토큰 형식을 정한 표준은 [인가 요청에 범위가 있으면 토큰에도 포함하고, 역할이나 그룹을 넣을 때는 정해진 이름의 클레임을 쓰라고 권고합니다](https://www.rfc-editor.org/rfc/rfc9068.html#section-2.2.3). 역할을 반드시 토큰에 넣으라는 의미가 아니라, 넣는다면 표준 이름을 사용하라는 뜻입니다.

Spring Security Resource Server는 기본적으로 범위를 읽어 권한으로 변환합니다. 토큰의 다른 속성을 쓰려면 [별도의 변환기를 설정해야 하지만](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html#oauth2resourceserver-jwt-authorization), 이는 토큰에서 권한을 안전하게 추출하기 위한 지원 기능일 뿐 데이터베이스 조회를 생략하라는 지침은 아닙니다.

따라서 어느 방식이 항상 우선한다고 볼 근거는 없습니다. 필요한 최신성과 감수할 수 있는 조회 비용을 저울질해서 판단해야 합니다.

## 필터는 관리자 전용 경로를 한꺼번에 보호합니다

관리자 API를 특정 경로 아래에 모아두었다면 경로 전체에 규칙을 적용할 수 있습니다. 인증 단계에서 역할을 권한 형태로 미리 만들어 뒀다고 전제합니다.

```java
http.authorizeHttpRequests(auth -> auth
    .requestMatchers("/tenant-admin/**").hasRole("TENANT_ADMIN")
    .anyRequest().authenticated()
);
```

[보안 필터가 규칙을 평가하고](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html), 조건에 맞지 않으면 요청은 컨트롤러를 찾아가는 `DispatcherServlet`에 도달하기 전에 차단됩니다.

경로 아래에 새로운 API를 추가해도 어노테이션을 붙일 필요 없이 일괄 적용되며, 접근 정책을 한곳에서 모아볼 수 있다는 장점이 있습니다.

대신 매처의 순서를 신경 써야 합니다. [먼저 일치하는 규칙이 우선 적용되므로](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html#authorize-requests), 앞에 허용 범위가 넓은 규칙이 있으면 관리자 검사가 무시될 수 있습니다.

## 메서드 인가는 기능 가까이에 규칙을 둡니다

메서드에 직접 보안 어노테이션을 붙이면 해당 로직이 실행되기 전에 권한을 검사합니다. 이 기능을 쓰려면 [메서드 보안 활성화 설정](https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html)이 필요합니다.

코드를 읽으면서 필요한 권한이 한눈에 보이고, URL 주소가 바뀌어도 규칙이 그대로 유지됩니다. 세밀한 파라미터 기반 인가에도 적합합니다. 다만 컨트롤러 메서드에 붙일 경우 [인자 바인딩과 검증이 끝난 뒤에 실행되므로](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/method/support/InvocableHandlerMethod.html) 필터 방식보다는 차단 시점이 조금 늦습니다.

서비스 메서드에 적용하면 여러 컨트롤러에서 호출하더라도 한곳에서 안전하게 보호할 수 있습니다. 다만 [프록시 기반으로 동작하기 때문에](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html) 같은 객체 내부에서 호출하는 경우에는 보안 검사가 우회될 수 있으므로 주의해야 합니다.

필터와 메서드 인가 모두 JWT 역할이든 데이터베이스 역할이든 활용할 수 있습니다. 다만 필터는 비즈니스 로직보다 먼저 실행되므로, 서비스 단계에서 조회한 별도의 정보를 필터 인가에 직접 활용할 수는 없습니다.

## 관리자 역할 검사만으로는 다른 회원사 데이터 접근을 막지 못합니다

`tenant-A` 관리자가 `tenant-B`의 문서 ID로 수정 요청을 보내도 관리자 역할 검사는 통과합니다. 관리자 권한이 있다고 해서 다른 회원사의 데이터까지 조회나 수정 권한이 자동으로 주어지는 것은 아닙니다.

문서를 조회할 때는 문서 ID뿐만 아니라 회원사 ID까지 함께 조건으로 걸어 데이터를 읽으면서 접근 범위를 엄격히 제한해야 합니다. 이는 권한의 출처가 어디든 상관없이 반드시 지켜야 하는 원칙이고, 액세스 토큰 표준도 [인가 클레임을 다른 맥락 정보와 함께 쓰라고 권고합니다](https://www.rfc-editor.org/rfc/rfc9068.html#section-4).

## 조회 비용과 변경 반영 요구를 함께 비교해야 합니다

- 요청마다 계정 상태와 소속을 엄격히 확인해야 하고 권한 변경을 바로 반영해야 한다면 데이터베이스 조회를 선택합니다.
- 토큰 유지 시간 동안 발급 시점의 역할을 인정할 수 있고 데이터베이스 의존도를 줄이고 싶다면 JWT 클레임 방식을 선택합니다.
- 일반적인 요청은 가벼운 JWT 역할로 처리하고, 민감한 작업만 추가로 조회하는 혼합 방식도 대안이 될 수 있습니다.

어떤 방식을 택하든 기능마다 어느 시점의 권한을 기준으로 삼을 것인지 명확히 합의하고 설계해야 합니다.
