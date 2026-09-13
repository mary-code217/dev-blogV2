---
title: "JWT 권한 클레임과 요청별 DB 조회 비교"
description: "관리자 인가를 예로 JWT의 역할 클레임과 DB 조회를 비교하고, CurrentActor와 Spring Security의 필터·메서드 인가를 구분합니다."
date: 2026-09-13
category: "Spring"
tags: ["JWT", "Spring Security", "Authorization", "RBAC"]
draft: false
---

JWT 액세스 토큰으로 사용자를 식별하더라도 권한 정보를 어디서 가져오는지는 갈립니다. 토큰에 역할을 담거나, 토큰의 사용자 ID로 요청마다 DB에서 조회합니다.

두 방식은 역할을 신뢰하는 시점과 조회 비용이 다릅니다. 필터에서 인가할지 메서드에서 인가할지는 별개의 선택입니다.

## JWT에 담으면 발급 시점의 역할을 사용합니다

- 인증: 너는 누구인가?
- 인가: 무엇을 할 수 있는가?

여기서는 JWT를 API에 제출하는 액세스 토큰으로 쓰는 경우입니다. 회원사 한 곳에 발급한 토큰의 클레임(토큰에 담긴 정보 항목) 예시입니다. 서명과 만료 시간은 생략했습니다.

```json
{
  "sub": "user-123",
  "tenant_id": "tenant-A",
  "roles": ["TENANT_ADMIN"]
}
```

`TENANT_ADMIN`을 `tenant-A`의 관리자 역할로 정의하면, 서버는 DB를 다시 읽지 않고 관리자 기능 접근 여부를 판단할 수 있습니다. 이 글에서 비교하는 권한 정보는 이런 역할입니다.

물론 서명, 만료, 발급자, 대상 API 검증을 통과한 토큰이어야 합니다. 검증 항목은 [RFC 9068 4절](https://www.rfc-editor.org/rfc/rfc9068.html#section-4)에 있습니다.

요청마다 DB를 안 봐도 되고, 여러 API 서버가 같은 토큰으로 인가할 수 있습니다. 대신 역할은 발급 시점 기준입니다. DB에서 바꿔도 이미 나간 토큰은 그대로입니다.

## DB에서 조회하면 조회 시점의 역할을 사용합니다

JWT에는 사용자 식별 정보만 두고, 역할은 요청마다 DB에서 읽습니다. 토큰을 검증한 뒤 사용자 ID와 회원사 범위로 역할을 조회합니다.

역할이 바뀌면 다음 요청부터 반영됩니다. 같은 조회에서 계정 정지나 회원사 소속도 확인할 수 있습니다.

대신 요청마다 조회 비용이 붙고, DB 장애가 곧 인가 장애가 됩니다. 캐시나 레플리카(원본 DB를 복사해 조회 전용으로 쓰는 DB. 복제에 시차가 있음)를 끼우면 "즉시 반영"도 보장되지 않습니다.

컨트롤러마다 조회 코드를 쓸 필요는 없습니다. 인증 단계에서 읽은 역할을 `Authentication`의 `GrantedAuthority`로 넣어 두면 필터와 메서드 인가가 그대로 씁니다. [JWT 클레임도 같은 권한 모델로 변환됩니다](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html#oauth2resourceserver-jwt-authentication).

## CurrentActor는 권한 정보의 출처를 감출 수 있습니다

현재 요청자 정보를 제공하는 인터페이스입니다.

```java
import java.util.Optional;

public interface CurrentActor {
    String userId();
    String tenantId();
    Optional<String> findUserId();
    boolean isTenantAdministrator();
}
```

서비스는 이 인터페이스만 보고, `isTenantAdministrator()`가 DB를 읽는지 JWT를 읽는지는 모릅니다.

- 요청 안에서 결과를 재사용하면 중복 조회가 줄어듭니다
- 요청을 넘어 캐시하면 역할 변경 시 무효화 방법이 필요합니다
- 싱글톤 빈이면 요청자 정보를 인스턴스 필드에 두지 말고 보안 컨텍스트에서 읽어야 합니다

값이 발급 시점 것인지 조회 시점 것인지는 인터페이스가 말해 주지 않습니다. 설계 계약으로 정해야 합니다.

## 역할이 드물게 바뀌어도 즉시 반영이 필요할 수 있습니다

관리자 역할이 1년에 한 번 바뀌더라도, 해제 즉시 막아야 한다면 기존 토큰으로는 대응할 수 없습니다.

액세스 토큰 수명이 10분이고 폐기 확인이 없다면, 발급 직후 역할을 해제해도 10분간은 이전 역할이 통합니다. 이 지연을 허용할 수 있으면 JWT 방식이 됩니다. 재발급 때 바뀐 역할을 반영하면 됩니다.

즉시 막아야 하면 현재 역할을 조회하거나 토큰 폐기 여부를 확인해야 합니다. Spring Security의 [introspection](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/opaque-token.html)은 인가 서버에 토큰 상태를 묻는 방식으로, 폐기가 필요할 때 쓰라고 안내합니다. 애플리케이션 DB 조회와는 별개의 선택지입니다.

## 공식 문서는 어느 한쪽을 강제하지 않습니다

[RFC 7519 4.1절](https://www.rfc-editor.org/rfc/rfc7519.html#section-4.1)은 어떤 클레임을 쓸지 애플리케이션이 정하라고 합니다. JWT 자체는 `role`을 강제하지 않습니다.

[RFC 9068 2.2.3절](https://www.rfc-editor.org/rfc/rfc9068.html#section-2.2.3)은 인가 요청에 `scope`가 있으면 토큰에도 `scope`를 넣고, 역할이나 그룹을 넣을 때는 `roles`, `groups`, `entitlements` 클레임을 쓰라고 권고합니다. 역할을 넣으라는 말이 아니라, 넣을 거면 이 이름을 쓰라는 말입니다.

Spring Security Resource Server는 기본으로 `scope`나 `scp`를 읽어 `SCOPE_` 접두사 권한으로 만듭니다. `roles`를 쓰려면 [`JwtAuthenticationConverter`로 매핑을 바꿉니다](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html#oauth2resourceserver-jwt-authorization). 토큰에서 권한을 만드는 지원 기능이지, DB 조회를 생략하라는 지침은 아닙니다.

그래서 어느 쪽이 항상 우선이라고 볼 근거는 없습니다. 필요한 최신성과 조회 비용으로 판단합니다.

## 필터는 관리자 전용 경로를 한꺼번에 보호합니다

관리자 API를 `/tenant-admin/**` 아래에 모았다면 경로 전체에 규칙을 겁니다. 인증 단계에서 역할을 `ROLE_TENANT_ADMIN` 권한으로 만들어 뒀다고 전제합니다.

```java
http.authorizeHttpRequests(auth -> auth
    .requestMatchers("/tenant-admin/**").hasRole("TENANT_ADMIN")
    .anyRequest().authenticated()
);
```

[`AuthorizationFilter`](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html)가 규칙을 평가하고, 거부되면 요청은 `DispatcherServlet`까지 가지 않습니다. 핸들러 매핑과 인자 바인딩 전에 끊깁니다.

경로 아래에 API를 추가해도 어노테이션 없이 규칙이 적용되고, 접근 정책을 설정 한 곳에서 볼 수 있습니다. 역할을 어디서 가져왔든 마찬가지입니다.

대신 매처 순서를 관리해야 합니다. [처음 일치하는 규칙이 적용되므로](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html#authorize-requests) 앞에 넓은 허용 규칙이 있으면 관리자 검사가 무시됩니다. 위 설정의 `authenticated()`는 로그인만 요구하므로 다른 경로에 관리자 권한을 보장하지 않습니다.

## 메서드 인가는 기능 가까이에 규칙을 둡니다

`@PreAuthorize("hasRole('TENANT_ADMIN')")`을 붙이면 메서드 본문 실행 전에 검사합니다. [`@EnableMethodSecurity`](https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html)를 켜야 동작합니다.

메서드를 읽으면서 필요한 권한이 보이고, URL을 바꿔도 규칙이 따라갑니다. 메서드 인자를 쓰는 세밀한 인가에도 맞습니다. 다만 컨트롤러의 `@PreAuthorize`는 [인자 바인딩과 검증이 끝난 뒤](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/method/support/InvocableHandlerMethod.html) 실행되므로 필터보다 차단이 늦습니다.

서비스 메서드에 붙이면 여러 컨트롤러가 호출해도 한 곳에서 보호됩니다. [프록시를 거치는 호출에만 적용되므로](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html) 같은 객체 안의 내부 호출에는 적용되지 않을 수 있습니다.

[공식 문서](https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html#authorization-compare-request-vs-method)는 규칙을 어디에 둘 것인지가 주요 선택 기준이라고 하면서, 어노테이션 없는 메서드를 보호하려면 `HttpSecurity`에 전체 요청 규칙을 두라고 안내합니다.

JWT 역할이든 DB 역할이든 필터와 메서드 인가 모두에 쓸 수 있습니다. 다만 필터는 서비스보다 먼저 실행되므로, 서비스 단계에서 조회한 `CurrentActor` 정보를 필터 인가에 쓸 수는 없습니다.

## 관리자 역할 검사만으로는 다른 회원사 데이터 접근을 막지 못합니다

`tenant-A` 관리자가 `tenant-B`의 문서 ID로 수정 요청을 보낼 수 있습니다. `TENANT_ADMIN` 검사는 이걸 못 막습니다.

문서를 문서 ID와 회원사 ID로 함께 조회하면 데이터를 읽으면서 범위도 제한됩니다. 역할 출처와 무관하게 필요한 확인이고, [RFC 9068 4절](https://www.rfc-editor.org/rfc/rfc9068.html#section-4)도 인가 클레임을 다른 맥락 정보와 함께 쓰라고 권고합니다.

## 조회 비용과 변경 반영 요구를 함께 비교해야 합니다

- 요청마다 계정 상태와 회원사 소속을 확인해야 하고 역할 변경을 바로 반영해야 하면 DB 조회. 조회 지연과 부하, 캐시를 검토합니다
- 토큰 수명 동안 발급 시점 역할을 인정할 수 있고 DB 의존을 줄여야 하면 JWT 클레임. 만료 시간, 재발급 시 역할 갱신, 긴급 폐기를 검토합니다
- 일반 요청은 JWT 역할로, 민감한 작업만 추가 조회하는 혼합도 가능합니다

어느 쪽이든 기능마다 어느 시점의 권한을 쓰는지 정해 두어야 합니다.
