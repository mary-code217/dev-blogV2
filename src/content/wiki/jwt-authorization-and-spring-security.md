---
title: "JWT에 권한을 담을 것인가, 요청마다 조회할 것인가"
description: "관리자 인가를 예로 JWT의 역할 클레임과 DB 조회를 비교하고, CurrentActor와 Spring Security의 필터·메서드 인가를 구분합니다."
date: 2026-09-13
category: "Spring"
tags: ["JWT", "Spring Security", "Authorization", "RBAC"]
draft: true
---

JWT로 사용자를 식별하면서도, 관리자 기능에 접근할 때마다 DB에서 역할을 다시 조회하는 구현을 접했습니다. 저는 JWT를 인증·인가에 활용한다면 관리자 여부도 토큰에 담아 조회를 줄이는 편이 낫다고 생각했습니다.

특히 Spring Security는 필터에서 관리자 전용 요청을 차단할 수 있습니다. 이 기능을 두고 컨트롤러나 서비스에서 관리자 확인을 반복하는 이유가 궁금했습니다. 이 문제에는 두 가지 선택이 섞여 있었습니다. 권한 정보를 어디서 가져올지, 그리고 인가를 어디서 수행할지입니다.

## JWT의 역할 정보로 인가할 수 있습니다

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

역할은 보통 여러 권한을 묶는 개념입니다. 그래도 역할 기반 접근 제어(RBAC)에서 “관리자만 허용한다”는 규칙을 적용할 때는 역할 자체가 인가의 근거가 됩니다. `role`이라는 이름을 썼다는 이유로 인가 정보가 아닌 것은 아닙니다.

다만 토큰에 들어 있다는 사실만으로 값을 신뢰할 수는 없습니다. 서명, 만료 시간, 발급자와 대상 API 등 필요한 검증을 통과한 토큰을 사용해야 합니다. OAuth 2.0 JWT 액세스 토큰의 검증 항목은 [RFC 9068 §4](https://www.rfc-editor.org/rfc/rfc9068.html#section-4)에 명시되어 있습니다.

## 반복되는 코드와 반복되는 조회는 따로 봐야 합니다

관리자 기능마다 사용자를 조회하고 역할을 비교하는 코드를 작성하면 같은 규칙이 여러 곳에 흩어집니다. 기능을 추가할 때 검사를 빠뜨릴 수도 있습니다.

이 중복은 JWT에 역할을 넣지 않아도 줄일 수 있습니다. 인증 처리 중 DB에서 역할을 조회한 뒤, Spring Security의 `Authentication`에 권한을 넣으면 됩니다. 이후 필터나 메서드는 구성된 권한을 사용해 인가합니다.

여기서 `Authentication`은 현재 인증 결과를 담는 객체이고, `GrantedAuthority`는 여기에 부여된 권한을 표현합니다. Spring Security의 JWT 처리도 검증된 클레임을 권한으로 변환해 이 객체를 구성합니다. [JWT 인증 처리 문서](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html#oauth2resourceserver-jwt-authentication)

DB에서 역할을 읽어 권한을 구성하면 비즈니스 코드에 있는 반복 검사를 줄일 수 있습니다. JWT에서 역할을 읽으면 여기에 더해 요청마다 역할을 조회하는 비용도 줄일 수 있습니다. 인가 판단은 어느 쪽이든 요청마다 필요합니다.

조회 한 번이 서비스 전체에서 얼마나 큰 비용인지는 측정해야 합니다. 다만 역할을 최신 상태로 확인할 필요가 없는 요청에서도 같은 조회를 반복한다면, 그 조회의 목적부터 검토할 수 있습니다.

## CurrentActor는 JWT 방식과 함께 사용할 수 있습니다

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

`CurrentActor`를 공통으로 주입받는다고 해서 사용자 정보를 모든 요청이 공유하는 필드에 저장해도 된다는 뜻은 아닙니다. 요청별 상태로 관리하거나 현재 보안 컨텍스트에서 읽어야 다른 사용자의 정보가 섞이지 않습니다.

제가 이 구조를 사용한다면 `CurrentActor`는 유지하고, 필요한 정보의 출처를 구현체에서 결정하겠습니다. 사용자 ID와 역할은 JWT에서 가져오고, 기능 수행에 필요한 추가 정보만 DB에서 읽는 구현도 가능합니다.

## 역할이 드물게 바뀌어도 즉시 회수가 필요할 수 있습니다

처음에는 “변경이 거의 없는 역할을 JWT에 넣으면 된다”고 생각했습니다. 하지만 변경 빈도만으로 판단하면 관리자 권한을 해제하는 순간의 요구사항을 놓칠 수 있습니다.

관리자 역할이 1년에 한 번 바뀌더라도, 해제 직후부터 접근을 막아야 한다면 기존 토큰의 역할만으로는 대응할 수 없습니다. DB의 역할을 바꿔도 이미 발급한 JWT 내용은 바뀌지 않습니다.

가령 액세스 토큰의 수명이 10분이고 별도 폐기 확인이 없다면, 발급 직후 해제한 역할이 만료 전까지 인정될 수 있습니다. 이 지연을 허용할 수 있다면 토큰의 역할을 사용하는 설계가 가능합니다. 새 토큰을 발급할 때는 변경된 역할을 반영해야 합니다.

즉시 접근을 막아야 한다면 현재 역할을 조회하거나 토큰 폐기 여부를 확인하는 장치가 필요합니다. Spring Security는 인가 서버에 토큰 상태를 질의하는 introspection을 지원하며, 폐기가 요구되는 경우에 유용하다고 설명합니다. 애플리케이션 DB에서 역할을 조회하는 방식과는 별개의 선택지입니다. [Introspection 공식 문서](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/opaque-token.html)

JWT에 넣을 역할의 기준은 **허용할 수 있는 반영 지연**입니다. 변경이 드물다는 점은 이 판단을 돕지만, 지연을 허용해도 된다는 근거를 대신하지는 못합니다.

## 공식 문서도 권한 클레임을 사용하는 흐름을 지원합니다

[JWT 기본 규격인 RFC 7519 §4.1](https://www.rfc-editor.org/rfc/rfc7519.html#section-4.1)은 애플리케이션이 어떤 클레임을 필수로 사용할지 정하도록 합니다. JWT라는 형식 자체가 `role`을 강제하지는 않습니다.

OAuth 2.0의 JWT 액세스 토큰을 정의한 [RFC 9068 §2.2.3](https://www.rfc-editor.org/rfc/rfc9068.html#section-2.2.3)은 더 구체적입니다. 인가 요청에 `scope`가 있다면 발급 토큰에도 `scope`를 포함하도록 권고합니다. 역할이나 그룹 정보를 넣으려는 경우에는 `roles`, `groups`, `entitlements` 클레임 사용을 권고합니다.

두 번째 권고에는 조건이 있습니다. 모든 토큰에 역할을 넣으라는 요구가 아니라, 해당 정보를 포함할 때 사용할 클레임에 대한 지침입니다. 이 규격의 적용 범위도 OAuth 2.0 JWT 액세스 토큰입니다.

Spring Security의 Resource Server는 기본적으로 `scope` 또는 `scp`를 읽어 `SCOPE_` 접두사가 붙은 권한으로 변환합니다. `roles`를 쓰려면 매핑을 변경해야 합니다. 기존 보안 설정 클래스에는 다음과 같은 변환기를 등록할 수 있습니다. 예시는 `roles`에 접두사 없는 역할 이름이 담긴 경우입니다. [권한 클레임 매핑 문서](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html#oauth2resourceserver-jwt-authorization)

```java
@Bean
JwtAuthenticationConverter jwtAuthenticationConverter() {
    JwtGrantedAuthoritiesConverter authorities =
        new JwtGrantedAuthoritiesConverter();
    authorities.setAuthoritiesClaimName("roles");
    authorities.setAuthorityPrefix("ROLE_");

    JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(authorities);
    return converter;
}
```

이 설정은 `TENANT_ADMIN`을 `ROLE_TENANT_ADMIN`으로 변환합니다. `hasRole("TENANT_ADMIN")`은 기본 접두사 규칙에 따라 이 권한을 확인합니다. 예시는 권한 출처를 `roles`로 바꾸므로, 기존 `scope` 권한도 필요하다면 두 출처를 함께 변환하도록 별도 구성해야 합니다.

## 필터는 관리자 전용 경로를 한꺼번에 보호합니다

회원사 관리자용 API를 `/tenant-admin/**` 아래에 모았다면 보안 설정에서 경로 전체에 관리자 규칙을 적용할 수 있습니다. 다음은 앞의 변환기를 주입받는 `SecurityFilterChain` 빈 메서드에 넣을 설정 부분입니다. JWT 검증용 `JwtDecoder` 또는 issuer 설정은 별도로 준비되어 있다고 전제합니다.

```java
http
    .authorizeHttpRequests(auth -> auth
        .requestMatchers("/tenant-admin/**").hasRole("TENANT_ADMIN")
        .anyRequest().authenticated()
    )
    .oauth2ResourceServer(oauth2 -> oauth2
        .jwt(jwt -> jwt
            .jwtAuthenticationConverter(jwtAuthenticationConverter)
        )
    );
```

`AuthorizationFilter`는 요청에 맞는 규칙을 평가합니다. 접근이 거부되면 요청은 `DispatcherServlet`까지 진행하지 않습니다. 관리자 여부만으로 거절할 수 있는 요청은 MVC의 핸들러 실행 준비를 거치기 전에 차단할 수 있습니다. 앞선 인증 필터 등의 처리는 이미 수행된 상태입니다. [요청 인가의 동작](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html)

제가 이 방식에서 크게 보는 장점은 새 기능에도 공통 규칙이 적용된다는 점입니다. 같은 경로 아래에 API를 추가하면 개별 메서드에 관리자 어노테이션을 붙이지 않아도 됩니다. URL별 접근 정책을 보안 설정에서 한 번에 확인할 수도 있습니다.

대신 경로와 매처 순서를 관리해야 합니다. 규칙은 처음 일치하는 항목이 적용되므로, 앞에 더 넓은 허용 규칙을 두면 의도한 관리자 검사가 적용되지 않을 수 있습니다. 관리자 기능을 다른 경로로 옮겼을 때도 규칙을 확인해야 합니다. 위 설정의 `authenticated()`는 로그인 여부만 요구하므로 그 밖의 경로에 관리자 권한까지 보장하지는 않습니다. [요청 매칭 규칙](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html#authorize-requests)

## 메서드 인가는 기능 가까이에 규칙을 둡니다

컨트롤러에 `@PreAuthorize("hasRole('TENANT_ADMIN')")`을 붙이면 메서드 본문 실행 전에 권한을 검사합니다. 컨트롤러 본문에서 `if`로 직접 검사하는 코드와는 실행 방식이 다릅니다. `@EnableMethodSecurity`로 메서드 보안을 활성화해야 동작합니다. [메서드 인가 공식 문서](https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html)

규칙이 기능 가까이에 있으므로 해당 메서드를 읽으면서 필요한 권한을 확인할 수 있고, URL을 바꿔도 규칙이 메서드에 남습니다. 메서드 인자를 활용한 세밀한 인가에도 적합합니다. 컨트롤러의 `@PreAuthorize`에 도달하기 전에는 인자 바인딩과 검증 등이 수행될 수 있으므로, 필터와 차단 시점은 다릅니다. [Spring MVC의 메서드 호출 API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/method/support/InvocableHandlerMethod.html)

서비스 메서드에 적용하면 여러 컨트롤러가 같은 서비스를 호출할 때 그 메서드를 보호할 수 있습니다. 기본 AOP 방식에서는 보안 프록시를 거치는 호출에 적용되며, 같은 객체 내부에서 직접 호출하는 경우에는 적용되지 않을 수 있습니다. [Spring AOP의 프록시와 내부 호출](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html)

공식 문서는 요청 인가와 메서드 인가를 비교하면서 규칙을 어디에 둘 것인지가 주요 선택 기준이라고 설명합니다. 메서드 보안 규칙이 없는 곳을 보호하기 위해 `HttpSecurity`에 전체 요청을 포괄하는 규칙을 두라는 안내도 있습니다. [요청 인가와 메서드 인가 비교](https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html#authorization-compare-request-vs-method)

JWT의 역할을 읽는 방식과 DB에서 역할을 읽는 방식 모두 필터와 메서드 인가에 사용할 수 있습니다. 필터에서 확인하려면 그 시점까지 필요한 권한을 구성하거나, 필터의 인가 처리 중 조회해야 합니다. 서비스에서 뒤늦게 채운 `CurrentActor` 정보가 앞서 실행된 필터에 자동으로 전달되지는 않습니다.

## 회원사 관리자 역할만으로 다른 회원사 데이터까지 허용할 수는 없습니다

`tenant-A`의 관리자가 `tenant-B`의 문서 ID를 넣어 수정 요청을 보낼 수 있습니다. 이 요청은 `TENANT_ADMIN` 역할 검사만으로는 막을 수 없습니다. 접근 대상 문서가 현재 회원사에 속하는지 확인해야 합니다.

이때 문서를 문서 ID와 회원사 ID로 함께 조회하면, 업무에 필요한 데이터를 읽으면서 회원사 범위도 제한할 수 있습니다. 역할 확인을 위한 사용자 조회를 생략했더라도 이런 자원 조회는 여전히 필요합니다. RFC 9068도 인가 클레임과 다른 맥락 정보를 함께 사용해 접근 여부를 판단하도록 권고합니다. [RFC 9068 §4](https://www.rfc-editor.org/rfc/rfc9068.html#section-4)

제가 회원사 관리자 기능을 설계한다면, 역할 변경이 토큰 만료까지 늦게 반영돼도 되는지부터 확인하겠습니다. 허용된다면 역할과 회원사 정보를 JWT에 담고, 관리자 전용 경로는 필터에서 제한하겠습니다. 실제 데이터에 대한 회원사 일치 여부와 수정 가능한 상태인지는 서비스에서 확인하겠습니다.

즉시 권한 회수가 필요하다면 현재 상태를 확인하는 조회를 유지할 이유가 있습니다. 그 요구가 없다면, 토큰에 담아 신뢰하기로 한 역할을 매번 다시 조회하는 비용을 줄이는 쪽을 선택하겠습니다.
