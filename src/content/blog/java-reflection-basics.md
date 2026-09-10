---
title: "리플렉션은 private을 뚫는 기술이 아니라 실행 중에 클래스 메타데이터를 읽는 기술이다"
description: "Spring 생성자 주입과 JPA 기본 생성자를 공부하다가 리플렉션이 정확히 무엇을 하는지 헷갈려서 다시 정리했습니다."
date: 2026-08-29
category: "Backend"
tags: ["Java", "Spring", "JPA"]
draft: false
---

Spring 생성자 주입 코드를 보다가 이상한 생각이 들었습니다. 분명 `final` 필드는 생성자에서 한 번만 값을 넣을 수 있는데, Spring 컨테이너가 내가 만들지도 않은 시점에 어떻게 그 필드를 채워주는 걸까. JPA 엔티티에 기본 생성자를 왜 굳이 `protected`로 열어둬야 하는지도 매번 관습처럼 따라 쓰기만 했습니다.

두 질문을 따라가다 보니 결국 리플렉션으로 이어졌습니다. 다만 "private도 뚫을 수 있는 기술" 정도로만 알고 있었더니 정작 저 두 질문에는 제대로 답을 못 하고 있었습니다. 그래서 리플렉션이 실행 중에 정확히 무엇을 하는 기술인지부터 다시 짚어봤습니다.

## 실행 중이란 main() 이후만이 아니라 JVM이 프로그램을 돌리는 모든 순간이다

평소 코드는 어떤 클래스에 어떤 필드와 메서드가 있는지 이미 알고 있다는 전제로 작성됩니다. `member.getName()`을 쓸 때 `Member`에 `getName()`이 있다는 걸 컴파일러가 이미 검사합니다.

리플렉션은 이 전제가 흔들리는 상황, 즉 어떤 클래스와 멤버에 접근할지를 실행 시점 정보로 결정해야 하는 상황을 다룹니다.

```java
public static void main(String[] args) throws Exception {
    Member member = new Member();

    // 실행하기 전에는 args[0]의 값을 알 수 없다.
    String fieldName = args[0];
    Field field = Member.class.getDeclaredField(fieldName);
}
```

여기서 "실행 중(runtime)"은 `javac`가 코드를 검사하는 시점이 아니라 JVM이 프로그램을 실제로 돌리는 시점을 가리킵니다. `main()`이 실행되는 동안만이 아니라, Spring 컨테이너가 초기화되는 동안, HTTP 요청을 처리하는 동안, 스케줄러가 도는 동안도 전부 여기 포함됩니다.

## private은 숨겨진 게 아니라 접근이 제한된 것뿐이다

JVM은 `.class` 파일을 읽을 때 실행 코드만 가져오는 게 아닙니다. 클래스 이름, 필드, 메서드, 생성자, 접근 제한자, 그리고 런타임까지 유지되도록 설정된 애너테이션 같은 메타데이터도 함께 읽어 들입니다. 이 메타데이터를 자바 코드에서 들여다볼 때 쓰는 게 `Class<?>` 객체입니다.

```java
Class<?> a = Member.class;                  // 클래스 리터럴
Class<?> b = member.getClass();             // 객체에서 조회
Class<?> c = Class.forName("com.example.Member"); // 이름으로 로딩하면서 클래스도 초기화
```

`Class.forName(String)`은 이름으로 클래스를 찾아오는 데서 끝나지 않고 클래스 초기화까지 수행합니다. 대상 클래스에 정적 초기화 블록이 있다면 이 시점에 실행됩니다.

여기서 오해하기 쉬운 부분이 `private`의 의미입니다. 리플렉션은 `getDeclaredField()`로 `private` 필드도 찾을 수 있습니다. 다만 실제로 값을 읽고 쓰려면 `setAccessible(true)`로 접근 검사를 완화해야 하고, 이마저도 모듈 경계 안에서 허용되는 범위를 벗어날 수는 없습니다.

## 오타는 컴파일 오류가 아니라 실행 중 예외로 나타난다

일반 접근과 리플렉션 접근은 같은 객체 상태를 다룬다는 점에서는 같습니다. 차이는 접근 대상을 언제 결정하고, 오류를 언제 발견하느냐에 있습니다.

일반 접근은 컴파일러가 타입을 검사합니다. 리플렉션은 실행 중에 타입을 검사하며, 결과는 주로 `Object`로 받습니다.

```java
// 일반 접근. 오타는 컴파일할 때 바로 걸린다
user.nickname = "Kim";
user.nickmae = "Lee"; // 컴파일 오류

// 리플렉션 접근. 오타는 실행해야 드러난다
Field f = clazz.getDeclaredField("nickname");
f.set(user, "Kim");
```

클래스가 뭔지 미리 알 수 있는 상황이라면 일반 접근을 쓰는 게 맞고, 리플렉션은 프레임워크처럼 애플리케이션마다 달라지는 클래스를 다뤄야 하는 코드에서 쓸 이유가 생깁니다.

## 생성자·필드·메서드는 전부 먼저 찾고 나서 실행을 요청하는 같은 패턴을 따른다

아래 `Member` 클래스 하나로 생성자, `private` 필드, 메서드를 순서대로 확인했습니다.

```java
public class Member {
    private String name;

    protected Member() {}

    public Member(String name) {
        this.name = name;
    }

    public String greet(String prefix) {
        return prefix + ", " + name;
    }
}
```

```java
Class<Member> clazz = Member.class;

// 1. 생성자를 찾아 객체를 만든다
Constructor<Member> ctor = clazz.getConstructor(String.class);
Member member = ctor.newInstance("Kim");

// 2. private 필드도 setAccessible(true)를 거치면 읽고 바꿀 수 있다
Field field = clazz.getDeclaredField("name");
field.setAccessible(true);
field.set(member, "Lee");

// 3. 메서드는 찾아서 호출한다
Method method = clazz.getMethod("greet", String.class);
Object result = method.invoke(member, "안녕하세요");

System.out.println(result); // 안녕하세요, Lee
```

이때 `getMethod()`와 `getDeclaredMethod()`를 헷갈리기 쉽습니다. `getMethod()`는 상속받은 것까지 포함한 `public` 메서드만 찾고, `getDeclaredMethod()`는 해당 클래스에 직접 선언된 메서드를 접근 제한자와 무관하게 찾습니다.

## Spring 생성자 주입은 final 필드를 몰래 바꾸는 게 아니라 정상적인 생성자 호출이다

처음에 품었던 의문으로 돌아가면, Spring은 개발자마다 다르게 작성하는 클래스를 미리 알 수 없기 때문에 실행 시점에 클래스와 애너테이션을 조사해서 빈 사이의 의존 관계를 구성합니다.

```java
@Service
public class OrderService {
    private final PaymentService paymentService;

    public OrderService(PaymentService paymentService) {
        this.paymentService = paymentService;
    }
}
```

Spring 컨테이너는 `@Service`가 붙은 클래스를 찾고, 생성자의 매개변수 타입을 조사해서 필요한 빈을 검색한 다음, 그 값을 넣어 생성자를 호출합니다. 개념만 놓고 보면 아래 코드와 다르지 않습니다.

```java
// 실제 내부 구현을 단순화한 개념 코드
Constructor<?> ctor = clazz.getConstructor(PaymentService.class);
Object orderService = ctor.newInstance(paymentService);
```

`final` 필드가 생성자 안에서 한 번만 할당된다는 자바 언어 규칙은 그대로 지켜집니다.

반대로 필드 주입(`@Autowired`가 필드에 바로 붙는 방식)은 얘기가 다릅니다. 이 경우 Spring은 생성자 호출이 끝나 객체가 이미 만들어진 뒤에 리플렉션으로 필드에 값을 직접 넣습니다. `final` 필드는 생성자에서만 값을 정할 수 있다는 언어 규칙과 정면으로 부딪히는 지점이 바로 여기입니다.

## JPA 기본 생성자는 프록시 이전에 명세가 요구하는 조건이다

```java
@Entity
public class Member {
    @Id
    private Long id;
    private String name;

    protected Member() {} // JPA용

    public Member(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("이름은 필수");
        }
        this.name = name;
    }
}
```

JPA 명세는 엔티티 클래스에 `public` 또는 `protected` 기본 생성자를 요구합니다. JPA 구현체가 DB 조회 결과로 엔티티를 만들 때 매개변수 없이 객체부터 생성한 다음, 조회된 값을 필드에 채워 넣기 때문입니다. `private`으로 막아두면 이 요구 조건부터 어기게 됩니다.

여기에 Hibernate의 지연 로딩(lazy loading, 실제 값이 필요해질 때까지 조회를 미루는 것)까지 들어오면 이유가 하나 더 붙습니다. 지연 로딩은 실제 엔티티 대신 그 엔티티를 상속한 프록시 객체를 돌려주는데, 자식 클래스인 프록시가 부모 생성자를 호출하려면 그 생성자가 최소한 `protected`로는 열려 있어야 합니다. `public`이 아니라 `protected`를 쓰는 이유는, 명세와 프록시 상속 조건을 모두 만족시키면서 일반 코드에서 의미 없는 빈 객체를 만드는 것만 막기 위해서입니다.

## 참조 타입의 final은 참조만 고정할 뿐 객체 내부까지 불변으로 만들지 않는다

`final` 필드는 자바 언어 규칙상 한 번만 할당됩니다.

```java
private final List<String> names = new ArrayList<>();

names = new ArrayList<>(); // 컴파일 오류: 참조 교체
names.add("Kim");          // 가능: 객체 내부 변경
```

리플렉션으로 `final` 필드의 참조 자체를 바꾸려는 시도는 이 언어 규칙을 우회하는 것이라 Java 버전, 모듈 경계, JVM 최적화에 따라 실패하거나 예상과 다르게 동작할 수 있습니다. 설계 수단으로 쓸 만한 방법은 아닙니다.

그래서 의존성은 생성자로 받고, 객체가 만들어진 다음에 강제로 값을 바꾸는 방법에는 기대지 않는 편이 안전합니다.

## InvocationTargetException은 리플렉션의 예외가 아니라 호출된 메서드나 생성자의 예외를 감싼 것이다

리플렉션은 컴파일 시점에 잡히던 여러 오류를 실행 시점 예외로 미룹니다. 그만큼 어떤 예외가 왜 나는지 구분해서 알아둘 필요가 있습니다.

- `NoSuchFieldException`: 이름과 일치하는 필드가 없을 때. 오타나 상속 관계를 먼저 의심합니다.
- `NoSuchMethodException`: 메서드명 또는 매개변수 타입 조합이 일치하지 않을 때.
- `IllegalAccessException`: 접근 권한이 없는 생성자·필드·메서드에 접근할 때.
- `InvocationTargetException`: 호출한 메서드나 생성자 내부에서 실제로 발생한 예외를 감싸서 전달합니다.
- `ClassNotFoundException`: `Class.forName()`으로 요청한 클래스를 클래스패스에서 찾지 못할 때.
- `InaccessibleObjectException`: 자바 모듈 시스템이 강한 캡슐화로 접근 완화를 막을 때 발생합니다.

이 중 실무에서 가장 헷갈리는 건 `InvocationTargetException`입니다. `getCause()`로 꺼낸 실제 원인을 봐야 합니다.

```java
try {
    method.invoke(target);
} catch (InvocationTargetException e) {
    Throwable actualCause = e.getCause();
    // 리플렉션 자체가 아니라 호출된 메서드나 생성자에서 발생한 예외
}
```

## 리플렉션을 쓰기 전에 확인할 것

리플렉션을 써야 할 상황이 생기면 아래를 확인하는 편입니다.

- 일반 호출이나 인터페이스로 해결할 수 있는 상황은 아닌가
- 문자열로 참조한 필드·메서드 이름이 리팩터링에서 누락되지 않는가
- 반복 조회하는 메타데이터를 캐시할 필요는 없는가
- 호출 대상의 실제 예외 원인(`getCause()`)을 보존하고 있는가
- 모듈 경계와 접근 권한을 억지로 깨고 있지는 않은가
