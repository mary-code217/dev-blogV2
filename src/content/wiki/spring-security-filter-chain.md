---
title: "Spring Security 요청 흐름과 필터 체인"
description: "요청이 Controller에 닿기까지 Spring Security가 어느 길목에서 동작하는지, 어떻게 필터 체인에 끼어들고, 결국 무슨 일을 하는지 큰 그림을 정리합니다."
date: 2026-05-30
category: "Spring"
tags: ["Spring", "Spring Security", "Filter", "Authentication", "Authorization"]
---

Spring Security를 처음 붙이면 가장 헷갈리는 게 "도대체 내 요청이 Controller까지 어떤 길로 오는가"입니다. 분명 `@GetMapping`은 맞는데 401이 떨어지고, 인터셉터에서 보던 것들이 시큐리티에선 안 보입니다. 이유는 간단합니다. **Spring Security는 Controller 한참 앞, 서블릿 필터 영역에서 먼저 동작하기 때문**입니다.

이 글은 요청이 들어와서 Controller까지 도달하는 전체 흐름을 따라가며, Spring Security가 어느 길목에서, 어떻게 필터 체인에 끼어들어, 결국 무슨 일을 하는지 큰 그림을 정리합니다.

---

## 1. 큰 그림: 요청이 Controller까지 가는 길

HTTP 요청 하나가 Controller 메서드에 도달하기까지의 경로는 크게 세 구간으로 나뉩니다.

<div style="font-family: monospace; font-size: 0.9em; display: inline-block; min-width: 340px; line-height: 1.5;">
  <div style="text-align: center; font-weight: bold;">사용자 요청</div>
  <div style="text-align: center; opacity: 0.6;">↓</div>
  <div style="border: 2px solid currentColor; border-radius: 6px; padding: 0.75rem 1rem; margin-bottom: 0.5rem;">
    <div style="font-weight: bold; margin-bottom: 0.5rem;">Servlet Filter Chain
      <span style="opacity: 0.7; font-weight: normal;">(서블릿 컨테이너)</span></div>
    <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.4rem 0.75rem; margin-bottom: 0.4rem;">
      일반 Filter <span style="opacity:0.7;">(인코딩, CORS, 로깅 …)</span></div>
    <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.4rem 0.75rem;">
      DelegatingFilterProxy → <b>Spring Security</b>
      <span style="opacity:0.7;">· URL 기반 인증·인가는 여기서</span></div>
  </div>
  <div style="text-align: center; opacity: 0.6;">↓ <span style="font-size: 0.85em;">필터 체인을 통과해야</span></div>
  <div style="border: 2px solid currentColor; border-radius: 6px; padding: 0.75rem 1rem;">
    <div style="font-weight: bold; margin-bottom: 0.5rem;">DispatcherServlet
      <span style="opacity: 0.7; font-weight: normal;">(Spring MVC 진입점)</span></div>
    <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.4rem 0.75rem; margin-bottom: 0.4rem;">
      HandlerMapping <span style="opacity:0.7;">: URL → Controller 매핑</span></div>
    <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.4rem 0.75rem; margin-bottom: 0.4rem;">
      HandlerInterceptor <span style="opacity:0.7;">: preHandle 등</span></div>
    <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.4rem 0.75rem;">
      Controller <span style="opacity:0.7;">: @GetMapping 실행</span></div>
  </div>
</div>

핵심은 두 가지입니다.

- **Spring Security는 `DispatcherServlet` 앞의 필터 영역에서 동작합니다.** 그래서 인증·인가에서 막히면 요청은 `DispatcherServlet`에 닿지도 못하고, Controller는 실행되지 않습니다.
- **`DispatcherServlet`은 필터가 아닙니다.** 필터 체인이 최종적으로 호출하는 대상 서블릿입니다.

이 구분이 왜 중요하냐면, 필터 단계와 MVC 단계가 가진 정보가 다르기 때문입니다.

| 구간 | 아는 것 | 모르는 것 |
|------|--------|----------|
| **필터(=Security) 단계** | URI, HTTP method, header, token | 어떤 Controller 메서드로 갈지 |
| **MVC 단계 (Interceptor 이후)** | 매핑된 `HandlerMethod` 정보까지 | 없음 |

`HandlerInterceptor`가 `HandlerMethod`(어느 컨트롤러 메서드인지)를 알 수 있는 건, 이미 `HandlerMapping`이 매핑을 끝낸 뒤에 실행되기 때문입니다. 반면 시큐리티 필터는 매핑 전이라 URL·메서드·토큰 같은 요청 자체 정보로만 판단합니다.

---

## 2. Spring Security는 어떻게 필터 체인에 끼어드는가

서블릿 컨테이너(Tomcat 등)는 Spring의 빈을 모릅니다. 컨테이너가 아는 건 표준 `Filter`뿐입니다. 그래서 다리를 놓는 게 `DelegatingFilterProxy`입니다.

<div style="font-family: monospace; font-size: 0.9em; display: inline-block; min-width: 340px; line-height: 1.5;">
  <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.5rem 0.9rem;">
    서블릿 컨테이너에 등록된 표준 Filter</div>
  <div style="text-align: center; opacity: 0.6;">↓</div>
  <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.5rem 0.9rem;">
    <b>DelegatingFilterProxy</b>
    <div style="font-size: 0.85em; opacity: 0.7;">spring-web이 제공하는 "위임용" 필터 (Security 소속 아님)</div></div>
  <div style="text-align: center; opacity: 0.6;">↓ <span style="font-size: 0.85em;">위임(delegate)</span></div>
  <div style="border: 2px solid currentColor; border-radius: 4px; padding: 0.5rem 0.9rem;">
    <b>FilterChainProxy</b>
    <div style="font-size: 0.85em; opacity: 0.7;">Spring Security의 실제 진입점 (Spring Bean)</div></div>
  <div style="text-align: center; opacity: 0.6;">↓</div>
  <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.5rem 0.9rem;">
    <b>SecurityFilterChain</b>
    <div style="font-size: 0.85em; opacity: 0.7;">요청에 맞는 보안 필터들의 묶음</div></div>
</div>

- `DelegatingFilterProxy`: 서블릿 컨테이너 생명주기와 Spring `ApplicationContext`를 이어주는 범용 위임 필터입니다. 자기는 일을 안 하고, Spring 빈인 `Filter`에게 처리를 넘깁니다. (Security 전용 클래스가 아니라는 점이 포인트입니다.)
- `FilterChainProxy`: 시큐리티가 제공하는 특별한 `Filter`입니다. **실제 보안 진입점**입니다. 요청 URL/조건에 맞는 `SecurityFilterChain`을 골라 그 안의 필터들을 순서대로 실행합니다.

> 흔히 "DelegatingFilterProxy로 시큐리티에 들어간다"고 말하는데, 더 정확히는 DelegatingFilterProxy가 FilterChainProxy에 위임하고, 실제 진입점은 FilterChainProxy라는 뜻입니다.

`SecurityFilterChain` 안에서는 여러 보안 필터가 정해진 순서로 돕니다. 인증 정보를 불러오는 필터, 로그인을 처리하는 필터, 마지막에 권한을 검사하는 필터처럼 각자 역할이 다릅니다. 개별 필터가 구체적으로 어떻게 동작하는지는 별도의 문서에서 정리합니다.

---

## 3. 그래서 Spring Security가 하는 일은 결국 무엇인가

앞의 큰 그림을 한 단계 더 들어가 정리하면, 시큐리티가 하는 일은 결국 두 가지입니다.

1. **인증 (Authentication): "너 누구냐?"**
   요청자가 누구인지 확인하고 그 신원을 `SecurityContext`에 저장합니다.
   담당: 인증 필터들 + `AuthenticationManager → AuthenticationProvider → UserDetailsService + PasswordEncoder`

2. **인가 (Authorization): "너 이거 해도 되냐?"**
   인증된 사용자가 자원/기능에 접근할 권한이 있는지 판단합니다.
   담당: `AuthorizationFilter`(URL 기반), `@PreAuthorize`/`@Secured`(메서드 기반)

한 문장으로 묶으면, Spring Security는 **"이 요청자가 누구인지 확인(인증)하고, 그가 이 작업을 해도 되는지 판단(인가)한다"**, 이 일을 **DispatcherServlet에 도달하기 전 필터 영역에서 일괄 처리**해주는 보안 프레임워크입니다.

---

## 정리

- Spring Security는 `DispatcherServlet` 앞 **필터 영역**에서 동작합니다. 막히면 Controller까지 가지 않습니다.
- 필터 단계는 URL·토큰 같은 요청 자체 정보만 알고, MVC 단계(`HandlerInterceptor`)는 "어떤 컨트롤러 메서드에 매핑됐는가"까지 압니다. 이 정보 차이가 곧 둘의 역할 분담 기준입니다.
- 진입은 `DelegatingFilterProxy → FilterChainProxy → SecurityFilterChain` 순입니다. 실제 진입점은 `FilterChainProxy`.
- 시큐리티의 궁극적 역할은 결국 **인증과 인가**, 이 두 가지입니다.
