---
title: "JWT 권한 클레임과 요청별 DB 조회 비교"
description: "관리자 인가를 예로 JWT의 역할 클레임과 DB 조회를 비교하고, CurrentActor와 Spring Security의 필터·메서드 인가를 구분합니다."
date: 2026-09-13
category: "Spring"
tags: ["JWT", "Spring Security", "Authorization", "RBAC"]
draft: false
---

JWT 액세스 토큰으로 사용자를 식별하더라도 권한 정보를 가져오는 방법은 하나가 아닙니다. 토큰에 역할을 함께 담기도 하고, 토큰의 사용자 ID를 기준으로 요청마다 DB에서 역할을 조회하기도 합니다.

두 방식은 역할 정보를 신뢰하는 시점과 요청 처리에 드는 조회 비용이 다릅니다. Spring Security의 필터에서 인가할지, 컨트롤러나 서비스 메서드에서 인가할지는 이와는 별개의 선택입니다.

## JWT에 담으면 발급 시점의 역할을 사용합니다

인증은 요청자의 신원을 확인하는 과정이고, 인가는 그 요청자가 해당 기능이나 데이터에 접근해도 되는지 판단하는 과정입니다. 여기서는 JWT를 API에 제출하는 액세스 토큰으로 사용하는 경우를 다룹니다.

JWT에 사용자 ID와 역할이 들어 있다면 서버는 검증된 토큰에서 이 정보를 꺼내 인가에 사용할 수 있습니다. 예를 들어 다음은 회원사 한 곳을 대상으로 발급한 토큰의 클레임(토큰에 담긴 정보 항목) 일부입니다. 서명과 만료 시간 등 검증에 필요한 요소는 생략했습니다.

```json
{
  "sub": "user-123",
  "tenant_id": "tenant-A",
  "roles": ["TENANT_ADMIN"]
}
```

`TENANT_ADMIN`을 `tenant-A` 안에서의 관리자 역할로 정의하면, 서버는 사용자 역할을 DB에서 다시 읽지 않고도 회원사 관리자 기능에 대한 접근 여부를 판단할 수 있습니다.

역할은 보통 여러 권한을 묶는 개념입니다. 역할 기반 접근 제어(RBAC)에서 “관리자만 허용한다”는 규칙을 적용할 때는 역할 자체가 인가의 근거가 됩니다. 이 글에서 비교하는 권한 정보는 이런 역할 정보입니다.

다만 토큰에 들어 있다는 사실만으로 값을 신뢰할 수는 없습니다. 서명, 만료 시간, 발급자와 대상 API 등 필요한 검증을 통과한 토큰을 사용해야 합니다. OAuth 2.0 JWT 액세스 토큰의 검증 항목은 [RFC 9068 4절](https://www.rfc-editor.org/rfc/rfc9068.html#section-4)에 명시되어 있습니다.

이 방식은 요청마다 역할 저장소에 접근하는 비용과 의존성을 줄입니다. 여러 API 서버가 같은 토큰의 역할을 읽어 인가할 수도 있습니다. 다만 검증된 역할은 발급 시점의 정보입니다. DB에서 역할을 변경해도 기존 토큰의 내용은 바뀌지 않으므로, 변경 반영 시점을 토큰 수명이나 별도의 폐기 정책과 함께 정해야 합니다.

## DB에서 조회하면 조회 시점의 역할을 사용합니다

JWT에는 사용자 식별에 필요한 정보를 두고, 역할은 요청을 처리할 때 DB에서 읽는 방식입니다. 서버는 토큰을 검증한 뒤 사용자 ID와 필요한 회원사 범위를 기준으로 역할을 조회합니다.

역할이 변경되면 토큰을 재발급하지 않고 이후 요청의 조회 결과로 반영할 수 있습니다. 같은 조회에서 계정 정지나 회원사 소속 상태를 확인하도록 구성할 수도 있습니다. 이런 상태를 요청마다 확인해야 하는 서비스에서는 조회 자체가 접근 정책을 적용하는 과정입니다.

대신 요청 처리에 조회 시간이 더해지고 DB 부하가 늘어납니다. 역할 저장소에 장애가 나면 인가 판단에도 영향을 받습니다. 또한 캐시나 지연이 있는 읽기 복제본을 사용한다면 변경 사항이 즉시 보인다고 단정할 수 없습니다. 조회 시점 이후에 일어난 변경도 이미 진행 중인 요청을 자동으로 중단시키지는 않습니다.

DB 조회 방식을 택했다고 컨트롤러마다 조회 코드를 작성해야 하는 것은 아닙니다. 인증 처리 중 읽은 역할을 Spring Security의 `Authentication`에 권한으로 구성하면 이후 필터나 메서드에서 사용할 수 있습니다. `Authentication`은 인증 결과를 담는 객체이고, `GrantedAuthority`는 여기에 부여된 권한을 표현합니다. JWT 처리에서도 클레임을 변환해 같은 권한 모델을 사용합니다. [JWT 인증 처리 문서](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html#oauth2resourceserver-jwt-authentication)

코드 중복은 조회와 인가 규칙을 어디에 모으느냐에 달려 있습니다. 두 방식 모두 인가는 요청마다 수행하며, JWT에 역할을 담았다고 개별 기능의 접근 규칙까지 자동으로 정해지는 것은 아닙니다.

## CurrentActor는 권한 정보의 출처를 감출 수 있습니다

현재 요청자의 정보를 제공하는 인터페이스를 다음처럼 둘 수 있습니다.

```java
import java.util.Optional;

public interface CurrentActor {
    String userId();
    String tenantId();
    Optional<String> findUserId();
    boolean isTenantAdministrator();
}
```

이 인터페이스는 서비스가 사용자 ID, 회원사 ID, 관리자 여부를 얻는 방법을 통일합니다. 메서드 선언만으로는 DB 조회 여부나 캐시 범위를 알 수 없습니다. `isTenantAdministrator()`가 DB를 조회할 수도 있고, 검증된 JWT에서 구성한 권한을 읽을 수도 있습니다.

DB 조회 결과를 요청 안에서 재사용한다면 같은 요청에서 중복 조회를 줄일 수 있습니다. 다음 요청에서 다시 조회하면 그 시점에 읽은 역할을 사용합니다. 여러 요청에 걸쳐 캐시한다면 조회 비용은 더 줄지만, 역할이 바뀌었을 때 캐시를 갱신하거나 무효화할 방법이 필요합니다.

`CurrentActor`를 싱글톤 빈으로 사용한다면, 현재 요청자의 정보를 인스턴스 필드에 저장해서는 안 됩니다. 요청별 상태로 관리하거나 현재 보안 컨텍스트에서 읽어야 다른 사용자의 정보가 섞이지 않습니다.

DB 방식의 구현체는 조회 결과를, JWT 방식의 구현체는 검증된 클레임이나 변환된 권한을 제공할 수 있습니다. 서비스는 같은 인터페이스를 사용하더라도, 각 값이 발급 시점의 정보인지 조회 시점의 정보인지는 설계 계약으로 정해 두어야 합니다.

## 역할이 드물게 바뀌어도 즉시 반영이 필요할 수 있습니다

역할이 얼마나 자주 바뀌는지는 선택에 영향을 줍니다. 여기에 변경된 역할을 언제부터 적용해야 하는지도 함께 확인해야 합니다.

관리자 역할이 1년에 한 번 바뀌더라도, 해제 직후부터 접근을 막아야 한다면 기존 토큰의 역할만으로는 대응할 수 없습니다. DB의 역할을 바꿔도 이미 발급한 JWT 내용은 바뀌지 않습니다.

액세스 토큰의 수명이 10분이고 별도 폐기 확인이 없다면, 토큰 발급 직후 역할을 해제해도 서버는 토큰 만료 전까지 이전 역할을 인정할 수 있습니다. 이 지연을 허용할 수 있다면 토큰의 역할을 사용하는 설계가 가능합니다. 새 토큰을 발급할 때는 변경된 역할을 반영해야 합니다.

즉시 접근을 막아야 한다면 현재 역할을 조회하거나 토큰 폐기 여부를 확인하는 장치가 필요합니다. Spring Security는 인가 서버에 토큰 상태를 질의하는 introspection을 지원하며, 폐기가 요구되는 경우에 유용하다고 설명합니다. 애플리케이션 DB에서 역할을 조회하는 방식과는 별개의 선택지입니다. [Introspection 공식 문서](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/opaque-token.html)

DB 방식에서는 변경된 값을 어느 저장소에서 언제 읽는지, JWT 방식에서는 기존 토큰을 언제까지 인정하는지가 반영 지연을 결정합니다. 캐시나 토큰 폐기 확인을 추가하면 조회 비용과 반영 지연도 함께 달라집니다.

## 공식 문서의 권고에는 적용 범위와 조건이 있습니다

[JWT 기본 규격인 RFC 7519 4.1절](https://www.rfc-editor.org/rfc/rfc7519.html#section-4.1)은 애플리케이션이 어떤 클레임을 필수로 사용할지 정하도록 합니다. JWT라는 형식 자체가 `role`을 강제하지는 않습니다.

OAuth 2.0의 JWT 액세스 토큰을 정의한 [RFC 9068 2.2.3절](https://www.rfc-editor.org/rfc/rfc9068.html#section-2.2.3)은 더 구체적입니다. 인가 요청에 `scope`가 있다면 발급 토큰에도 `scope`를 포함하도록 권고합니다. 역할이나 그룹 정보를 넣으려는 경우에는 `roles`, `groups`, `entitlements` 클레임 사용을 권고합니다.

두 번째 권고에는 조건이 있습니다. 모든 토큰에 역할을 넣으라는 요구가 아니라, 해당 정보를 포함할 때 사용할 클레임에 대한 지침입니다. 이 규격의 적용 범위도 OAuth 2.0 JWT 액세스 토큰입니다.

Spring Security의 Resource Server는 기본적으로 `scope` 또는 `scp`를 읽어 `SCOPE_` 접두사가 붙은 권한으로 변환합니다. `roles` 같은 다른 클레임을 사용할 때는 `JwtAuthenticationConverter`로 매핑을 바꿀 수 있습니다. 이는 토큰에서 권한을 구성하는 지원 기능이며, 모든 애플리케이션에서 DB 조회를 생략하라는 지침은 아닙니다. [권한 클레임 매핑 문서](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html#oauth2resourceserver-jwt-authorization)

이 문서들을 근거로 어느 한 방식을 항상 우선해야 한다고 보기는 어렵습니다. 토큰의 역할을 사용할지 현재 역할을 조회할지는 필요한 최신성과 조회 비용을 기준으로 판단해야 합니다.

## 필터는 관리자 전용 경로를 한꺼번에 보호합니다

회원사 관리자용 API를 `/tenant-admin/**` 아래에 모았다면 보안 설정에서 경로 전체에 관리자 규칙을 적용할 수 있습니다. 다음은 `SecurityFilterChain` 설정 중 요청 인가 부분입니다. 앞선 인증 처리에서 JWT 또는 DB의 역할을 `ROLE_TENANT_ADMIN` 권한으로 구성했다고 전제합니다.

```java
http.authorizeHttpRequests(auth -> auth
    .requestMatchers("/tenant-admin/**").hasRole("TENANT_ADMIN")
    .anyRequest().authenticated()
);
```

`AuthorizationFilter`는 요청에 맞는 규칙을 평가합니다. 접근이 거부되면 요청은 `DispatcherServlet`까지 도달하지 않습니다. 관리자 여부만으로 거절할 수 있는 요청은 핸들러 매핑과 인자 바인딩을 거치기 전에 차단할 수 있습니다. 앞선 인증 필터 등의 처리는 이미 수행된 상태입니다. [요청 인가의 동작](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html)

같은 경로 아래에 API를 추가하면 개별 메서드에 관리자 어노테이션을 붙이지 않아도 공통 규칙이 적용됩니다. URL별 접근 정책을 보안 설정에서 한 번에 확인할 수도 있습니다. 이 장점은 역할을 JWT와 DB 중 어디에서 가져왔는지에 관계없이 얻을 수 있습니다.

대신 경로와 매처 순서를 관리해야 합니다. 규칙은 처음 일치하는 항목이 적용되므로, 앞에 더 넓은 허용 규칙을 두면 의도한 관리자 검사가 적용되지 않을 수 있습니다. 관리자 기능을 다른 경로로 옮겼을 때도 규칙을 확인해야 합니다. 위 설정의 `authenticated()`는 로그인 여부만 요구하므로 그 밖의 경로에 관리자 권한까지 보장하지는 않습니다. [요청 매칭 규칙](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html#authorize-requests)

## 메서드 인가는 기능 가까이에 규칙을 둡니다

컨트롤러에 `@PreAuthorize("hasRole('TENANT_ADMIN')")`을 붙이면 메서드 본문 실행 전에 권한을 검사합니다. 컨트롤러 본문에서 `if`로 직접 검사하는 코드와는 실행 방식이 다릅니다. `@EnableMethodSecurity`로 메서드 보안을 활성화해야 동작합니다. [메서드 인가 공식 문서](https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html)

규칙이 기능 가까이에 있으므로 해당 메서드를 읽으면서 필요한 권한을 확인할 수 있고, URL을 바꿔도 규칙이 메서드에 남습니다. 메서드 인자를 활용한 세밀한 인가에도 적합합니다. 컨트롤러의 `@PreAuthorize`에 도달하기 전에는 인자 바인딩과 검증 등이 수행될 수 있으므로, 필터와 차단 시점은 다릅니다. [Spring MVC의 메서드 호출 API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/method/support/InvocableHandlerMethod.html)

서비스 메서드에 적용하면 여러 컨트롤러가 같은 서비스를 호출할 때 그 메서드를 보호할 수 있습니다. 기본 AOP 방식에서는 보안 프록시를 거치는 호출에 적용되며, 같은 객체 내부에서 직접 호출하는 경우에는 적용되지 않을 수 있습니다. [Spring AOP의 프록시와 내부 호출](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html)

공식 문서는 요청 인가와 메서드 인가를 비교하면서 규칙을 어디에 둘 것인지가 주요 선택 기준이라고 설명합니다. 메서드 보안 규칙이 없는 곳을 보호하기 위해 `HttpSecurity`에 전체 요청을 포괄하는 규칙을 두라는 안내도 있습니다. [요청 인가와 메서드 인가 비교](https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html#authorization-compare-request-vs-method)

JWT의 역할을 읽는 방식과 DB에서 역할을 읽는 방식 모두 필터와 메서드 인가에 사용할 수 있습니다. 필터에서 확인하려면 그 시점까지 필요한 권한을 구성하거나, 필터의 인가 처리 중 조회해야 합니다. 필터는 서비스보다 먼저 실행되므로, 서비스 단계에서 조회한 `CurrentActor` 정보를 필터 인가에 쓸 수는 없습니다.

## 관리자 역할 검사만으로는 다른 회원사 데이터 접근을 막지 못합니다

`tenant-A`의 관리자가 `tenant-B`의 문서 ID를 넣어 수정 요청을 보낼 수 있습니다. 이 요청은 `TENANT_ADMIN` 역할 검사만으로는 막을 수 없습니다. 접근 대상 문서가 현재 회원사에 속하는지 확인해야 합니다.

이때 문서를 문서 ID와 회원사 ID로 함께 조회하면, 업무에 필요한 데이터를 읽으면서 회원사 범위도 제한할 수 있습니다. 역할을 JWT에서 읽든 DB에서 읽든 대상 데이터에 대한 접근 범위는 확인해야 합니다. RFC 9068도 인가 클레임과 다른 맥락 정보를 함께 사용해 접근 여부를 판단하도록 권고합니다. [RFC 9068 4절](https://www.rfc-editor.org/rfc/rfc9068.html#section-4)

## 조회 비용과 변경 반영 요구를 함께 비교해야 합니다

요청마다 계정 상태와 회원사 소속을 확인해야 하고, 역할 변경도 다음 조회부터 반영해야 하는 서비스라면 DB 조회 방식이 요구사항에 맞습니다. 이때는 조회 지연과 부하, 캐시 사용 여부를 함께 검토해야 합니다.

토큰 수명 동안 발급 시점의 역할을 인정할 수 있고, 역할 저장소를 매번 호출하는 비용이나 의존성을 줄여야 한다면 JWT 클레임 방식이 맞을 수 있습니다. 이때는 만료 시간과 재발급 시 역할 갱신, 긴급 폐기 필요성을 함께 검토해야 합니다.

일반 요청은 JWT의 역할로 판단하고, 민감한 작업에서는 현재 권한을 추가 조회하는 구성도 가능합니다. 어떤 방식을 선택하든 요청별로 적용할 기준을 정해 두어야 같은 기능에서 서로 다른 시점의 권한을 사용해 판단이 엇갈리는 일을 줄일 수 있습니다.
