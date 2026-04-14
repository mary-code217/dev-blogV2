---
title: "자바 메모리 구조 (JVM)"
description: "JVM의 메모리 구조를 영역별로 정리하고, 각 영역의 역할과 동작 방식을 설명합니다."
date: 2026-04-14
category: "Java"
tags: ["Java", "JVM", "Memory"]
---

자바를 공부하다 보면 "힙에 저장된다", "스택에 올라간다"는 표현을 자주 접하게 됩니다.
하지만 이 영역들이 실제로 어떻게 구성되어 있고, 어떤 기준으로 데이터가 나뉘는지는 명확히 정리하지 않으면 헷갈리기 쉽습니다.

이 글에서는 JVM(Java Virtual Machine)의 메모리 구조를 영역별로 정리하고, 각 영역이 어떤 역할을 하는지 설명합니다.

## 1. JVM 메모리 구조 개요

JVM은 자바 프로그램을 실행할 때 메모리를 크게 다음과 같은 영역으로 나누어 관리합니다.

<div style="border: 2px solid currentColor; border-radius: 6px; padding: 1rem; font-family: monospace; font-size: 0.9em; display: inline-block; min-width: 320px;">
  <div style="text-align: center; font-weight: bold; margin-bottom: 0.75rem;">JVM Memory</div>
  <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.5rem 1rem; margin-bottom: 0.5rem;">
    <div style="font-weight: bold;">Method Area</div>
    <div style="font-size: 0.85em; opacity: 0.75;">클래스 정보, static 변수, 상수</div>
  </div>
  <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.5rem 1rem; margin-bottom: 0.5rem;">
    <div style="font-weight: bold;">Heap Area</div>
    <div style="font-size: 0.85em; opacity: 0.75;">객체 인스턴스, 배열</div>
  </div>
  <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
    <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.5rem 0.75rem; flex: 1;">
      <div style="font-weight: bold;">Stack Area</div>
      <div style="font-size: 0.85em; opacity: 0.75;">Thread 1</div>
    </div>
    <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.5rem 0.75rem; flex: 1;">
      <div style="font-weight: bold;">Stack Area</div>
      <div style="font-size: 0.85em; opacity: 0.75;">Thread 2</div>
    </div>
    <div style="display: flex; align-items: center; opacity: 0.6;">...</div>
  </div>
  <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.5rem 1rem;">
    <div style="font-weight: bold;">PC Register / Native Method Stack</div>
    <div style="font-size: 0.85em; opacity: 0.75;">스레드별 독립</div>
  </div>
</div>

크게 **모든 스레드가 공유하는 영역**과 **스레드마다 독립적으로 생성되는 영역**으로 나뉩니다.

| 영역 | 공유 여부 |
|------|----------|
| Method Area | 공유 |
| Heap | 공유 |
| Stack | 스레드별 독립 |
| PC Register | 스레드별 독립 |
| Native Method Stack | 스레드별 독립 |

## 2. Method Area (메서드 영역)

클래스 로더가 클래스를 로딩할 때 메서드 영역에 정보를 저장합니다.

저장되는 내용 (JVM 스펙 기준):
- 클래스의 메타데이터 (클래스 이름, 부모 클래스, 인터페이스 정보 등)
- 런타임 상수 풀 (Runtime Constant Pool) — 숫자 상수, 문자열 리터럴에 대한 심볼릭 레퍼런스 등
- 메서드 바이트코드

> **`static` 변수의 실제 저장 위치 (HotSpot 기준)**: JVM 스펙에서는 static 변수를 Method Area에 두도록 정의하지만, Java 8 이후 HotSpot 구현에서는 `Class<?>` 객체가 힙(Heap)에 올라가며 static 필드는 그 객체에 붙어 힙에 저장됩니다. Metaspace에는 클래스 메타데이터(구조 정보)만 들어갑니다.

JVM 스펙에서는 이 영역을 **Non-Heap**으로 분류하며, Java 8부터는 **Metaspace**라는 이름으로 네이티브 메모리 영역에 위치합니다. (Java 7 이하에서는 PermGen에 위치)

> **Java 8의 변화**: PermGen(Permanent Generation)이 제거되고 Metaspace로 대체되었습니다. PermGen은 JVM 힙 내에 고정 크기로 존재했지만, Metaspace는 OS 네이티브 메모리를 사용하므로 기본적으로 크기 제한이 없습니다.

## 3. Heap Area (힙 영역)

가장 넓은 메모리 영역으로, `new` 키워드로 생성된 **객체 인스턴스와 배열**이 저장됩니다.

```java
String name = new String("Alice");  // "Alice" 객체는 힙에 저장
int[] arr = new int[10];            // 배열도 힙에 저장
```

힙은 GC(Garbage Collector)의 관리 대상입니다. 더 이상 참조되지 않는 객체는 GC에 의해 수거됩니다.

### 힙의 세부 구조 (Generational GC 기준)

<div style="border: 2px solid currentColor; border-radius: 6px; padding: 1rem; font-family: monospace; font-size: 0.9em; display: inline-block; min-width: 360px;">
  <div style="text-align: center; font-weight: bold; margin-bottom: 0.75rem;">Heap</div>
  <div style="display: flex; gap: 0.5rem;">
    <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.5rem 0.75rem; flex: 1;">
      <div style="font-weight: bold; margin-bottom: 0.5rem;">Young Generation</div>
      <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.4rem 0.75rem; text-align: center; margin-bottom: 0.4rem;">Eden</div>
      <div style="display: flex; gap: 0.4rem;">
        <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.4rem 0; text-align: center; flex: 1;">S0</div>
        <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.4rem 0; text-align: center; flex: 1;">S1</div>
      </div>
    </div>
    <div style="border: 1px solid currentColor; border-radius: 4px; padding: 0.5rem 0.75rem; flex: 1; display: flex; flex-direction: column; justify-content: center;">
      <div style="font-weight: bold; margin-bottom: 0.5rem;">Old Generation</div>
      <div style="font-size: 0.85em; opacity: 0.75;">오래 살아남은 객체들</div>
    </div>
  </div>
</div>

- **Eden**: 새로 생성된 객체가 위치하는 공간
- **Survivor (S0, S1)**: Minor GC에서 살아남은 객체가 이동하는 공간
- **Old Generation**: 여러 번의 GC에서 살아남아 오래된 것으로 판단된 객체가 이동하는 공간

## 4. Stack Area (스택 영역)

스레드가 생성될 때 각 스레드마다 독립적인 스택이 만들어집니다.
메서드가 호출될 때마다 **스택 프레임(Stack Frame)**이 쌓이고, 메서드가 종료되면 해당 프레임이 제거됩니다.

스택 프레임에는 다음이 저장됩니다:
- 지역 변수 (Local Variables)
- 메서드 호출 시 전달되는 매개변수
- 연산 중간 결과 (Operand Stack)
- 현재 클래스의 런타임 상수 풀 참조

```java
void foo() {
    int x = 10;       // x는 스택 프레임에 저장
    String s = "hi";  // s(참조값)는 스택, "hi" 객체는 힙
    bar(x);
}

void bar(int n) {
    // bar의 스택 프레임이 foo 위에 쌓임
}
```

스택은 크기가 제한되어 있어, 재귀 호출이 너무 깊어지면 `StackOverflowError`가 발생합니다.

## 5. PC Register (프로그램 카운터 레지스터)

각 스레드마다 독립적으로 존재하며, **현재 실행 중인 JVM 명령어의 주소**를 저장합니다.
스레드 스케줄링 후 재개 시 어느 명령어부터 실행해야 하는지 추적하는 용도입니다.

네이티브 메서드를 실행 중일 때는 값이 undefined입니다.

## 6. Native Method Stack (네이티브 메서드 스택)

Java가 아닌 **C/C++ 등의 네이티브 코드**(`native` 키워드 메서드)를 실행할 때 사용되는 스택입니다.
JNI(Java Native Interface)를 통해 호출되는 네이티브 메서드의 실행 컨텍스트를 저장합니다.

## 7. 스택 vs 힙 정리

| 구분 | Stack | Heap |
|------|-------|------|
| 저장 대상 | 지역 변수, 지역 참조 변수(참조값), 메서드 호출 정보 | 객체 인스턴스, 배열, 객체 필드의 참조값 |
| 생명주기 | 메서드 종료 시 자동 해제 | GC가 회수할 때까지 유지 |
| 크기 | 작고 고정적 | 크고 동적 |
| 공유 | 스레드별 독립 | 모든 스레드 공유 |
| 속도 | 빠름 | 상대적으로 느림 |

## 8. 자주 묻는 질문

### String은 어디에 저장되나?

두 개념을 구분해야 합니다.

- **Runtime Constant Pool** (Method Area): 소스 코드의 문자열 리터럴에 대한 **심볼릭 레퍼런스**를 보관합니다. 실제 객체가 아닌 "어디에 있는 String을 가리킬지"에 대한 참조 엔트리입니다.
- **String Pool** (Heap): intern된 실제 `String` 객체가 저장되는 곳입니다. 리터럴로 선언한 문자열은 JVM이 자동으로 intern하여 이곳에 보관하고, 동일한 리터럴이 등장하면 같은 객체를 재사용합니다.

```java
String a = "hello";              // String Pool의 객체를 가리킴
String b = "hello";              // 동일한 객체 재사용
String c = new String("hello");  // 힙의 일반 영역에 새 객체 생성

System.out.println(a == b);  // true  (같은 객체)
System.out.println(a == c);  // false (다른 객체)
```

### static 변수는 어디에 저장되나?

JVM 스펙에서는 Method Area에 두도록 정의하지만, **Java 8 이후 HotSpot 기준으로는 힙(Heap)에 저장**됩니다. `Class<?>` 객체가 힙에 생성되고, static 필드는 그 객체에 속해 있습니다. 클래스가 로딩되는 시점에 메모리가 할당되고, 해당 클래스가 언로드될 때까지 유지됩니다.

### 메서드 내 지역 변수로 선언한 객체 참조는?

참조 변수(주소값)는 스택에, 실제 객체는 힙에 저장됩니다.

```java
void example() {
    User user = new User();
    // user 참조값 → 스택
    // User 객체    → 힙
}
```
