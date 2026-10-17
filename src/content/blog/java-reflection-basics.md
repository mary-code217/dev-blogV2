---
title: "자바 리플렉션과 Spring·JPA가 객체를 만드는 방식"
description: "실행 중에 클래스 메타데이터를 읽는 리플렉션의 동작 원리와 Spring 생성자 주입, JPA 기본 생성자의 관계를 정리합니다."
date: 2026-08-29
category: "Backend"
tags: ["Java", "Spring", "JPA"]
draft: false
---

Spring 생성자 주입 코드를 보다가 의문이 들었습니다. `final` 필드는 생성자에서 한 번만 값을 넣을 수 있는데, 직접 `new`를 호출하지도 않은 객체를 Spring 컨테이너는 어떻게 만들어서 채우는 걸까요? JPA 엔티티에 쓰지도 않을 기본 생성자를 왜 매번 `protected`로 열어두어야 하는지도 관습처럼 따라 쓰기만 했습니다.

두 질문을 따라가다 보니 리플렉션이 나왔습니다. 흔히 "private 필드도 강제로 여는 기술" 정도로만 알고 있었는데, 그렇게만 이해하면 정작 저 두 질문에는 답하기 어렵습니다.

---

## 어떤 클래스를 다룰지 실행 중에 결정해야 할 때가 있습니다

평소 코드는 어떤 클래스에 어떤 필드와 메서드가 있는지 이미 알고 있다는 전제로 작성됩니다. `member.getName()`을 쓸 때 `Member` 클래스에 `getName()`이 있는지는 컴파일러가 미리 검사합니다.

프레임워크는 사정이 다릅니다. Spring이나 JPA는 개발자가 어떤 이름의 클래스를 만들고 어떤 필드를 선언할지 미리 알 수 없습니다. 프로그램이 돌아가는 도중에 클래스 정보를 읽어서 객체를 만들고 메서드를 호출해야 하는데, 이때 리플렉션을 씁니다.

```java
public static void main(String[] args) throws Exception {
    Member member = new Member();

    // 실행하기 전에는 args[0]에 어떤 필드 이름이 들어올지 알 수 없다
    String fieldName = args[0];
    Field field = Member.class.getDeclaredField(fieldName);
}
```

여기서 실행 중이란 `javac`가 소스 코드를 번역하는 시점이 아니라, JVM이 프로그램을 실제로 돌리는 모든 순간입니다. `main()` 메서드가 실행되는 동안뿐 아니라 Spring 컨테이너가 초기화되는 동안, HTTP 요청을 처리하는 동안도 모두 포함됩니다.

## 리플렉션은 컴파일 시점의 타입 검사를 실행 시점으로 미룹니다

일반 접근과 리플렉션 접근은 오류를 발견하는 시점이 다릅니다.

```java
// 일반 접근: 오타가 있으면 컴파일할 때 바로 걸린다
user.nickname = "Kim";
user.nickmae = "Lee"; // 컴파일 오류

// 리플렉션 접근: 실행해서 해당 줄이 돌아가 봐야 오타를 알 수 있다
Field f = clazz.getDeclaredField("nickmae"); // 실행 중 NoSuchFieldException 발생
f.set(user, "Kim");
```

일반 접근은 컴파일러가 타입과 이름을 검사하지만, 리플렉션은 실행 중에 문자열로 대상을 찾고 결과도 주로 `Object`로 받습니다. 어떤 클래스인지 미리 아는 일반 비즈니스 코드에서는 리플렉션을 쓸 이유가 없습니다.

---

## 생성자·필드·메서드는 모두 먼저 찾고 실행을 요청합니다

JVM은 `.class` 파일을 읽을 때 바이트코드만 가져오지 않습니다. 클래스 이름, 필드, 메서드, 생성자, 접근 제한자, 애너테이션 같은 메타데이터도 메모리에 함께 올립니다. 자바 코드에서 이 메타데이터를 읽을 때 쓰는 객체가 `Class<?>`입니다.

```java
Class<?> a = Member.class;                        // 클래스 리터럴로 조회
Class<?> b = member.getClass();                   // 생성된 객체에서 조회
Class<?> c = Class.forName("com.example.Member"); // 문자열 이름으로 클래스를 로딩하고 초기화
```

`Class.forName()`은 이름으로 클래스를 찾는 데서 끝나지 않고 클래스 초기화까지 수행합니다. 정적 초기화 블록이 있다면 이 시점에 실행됩니다.

`Class<?>` 객체로 생성자, 필드, 메서드를 다루는 코드는 모두 대상을 먼저 찾고 실행을 요청하는 순서로 동작합니다.

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

// 2. private 필드를 찾아 접근 제한을 풀고 값을 바꾼다
Field field = clazz.getDeclaredField("name");
field.setAccessible(true);
field.set(member, "Lee");

// 3. 메서드를 찾아 호출한다
Method method = clazz.getMethod("greet", String.class);
Object result = method.invoke(member, "안녕하세요");

System.out.println(result); // 안녕하세요, Lee
```

`private`은 메타데이터에서 숨겨진 게 아니라 접근만 제한된 상태입니다. `getDeclaredField()`로 `private` 필드를 찾은 뒤 `setAccessible(true)`로 접근 검사를 완화하면 값을 읽고 쓸 수 있습니다. 다만 Java 9 이후 모듈 시스템이 강하게 캡슐화한 내부 패키지는 이 방식으로도 접근이 막힙니다.

메서드를 찾을 때 쓰는 `getMethod()`와 `getDeclaredMethod()`는 탐색 범위가 다릅니다. `getMethod()`는 상속받은 것까지 포함해 `public` 메서드만 찾고, `getDeclaredMethod()`는 접근 제한자와 무관하게 해당 클래스에 직접 선언된 메서드만 찾습니다.

---

## Spring 생성자 주입은 리플렉션으로 생성자를 찾아 호출합니다

```java
@Service
public class OrderService {
    private final PaymentService paymentService;

    public OrderService(PaymentService paymentService) {
        this.paymentService = paymentService;
    }
}
```

애플리케이션이 시작될 때 Spring 컨테이너는 `@Service`가 붙은 클래스를 찾고, 생성자의 파라미터 타입을 리플렉션으로 확인합니다. 그리고 필요한 빈을 찾아 인자로 넘기면서 생성자를 호출합니다.

```java
// Spring 내부 동작을 단순화한 개념 코드
Constructor<?> ctor = OrderService.class.getConstructor(PaymentService.class);
Object orderService = ctor.newInstance(paymentServiceBean);
```

객체가 만들어지는 시점에 생성자를 통해 값이 들어가므로, `final` 필드를 생성자에서 한 번만 할당한다는 자바 언어 규칙이 그대로 지켜집니다.

반면 필드에 `@Autowired`를 바로 붙이는 필드 주입은 순서가 다릅니다. 기본 생성자로 객체를 먼저 만든 뒤, 리플렉션으로 필드에 값을 직접 넣습니다. 객체 생성이 끝난 뒤에 값을 넣어야 하므로 `final` 필드에는 쓸 수 없습니다.

## JPA 기본 생성자는 명세 조건이자 프록시 상속을 위한 것입니다

```java
@Entity
public class Member {
    @Id
    private Long id;
    private String name;

    protected Member() {} // JPA용 기본 생성자

    public Member(String name) {
        this.name = name;
    }
}
```

JPA 명세는 엔티티 클래스에 `public` 또는 `protected` 기본 생성자를 요구합니다. JPA 구현체가 DB 조회 결과로 엔티티를 만들 때 매개변수 없는 기본 생성자를 리플렉션으로 호출해 객체를 먼저 생성한 다음, 조회된 값을 필드에 채워 넣기 때문입니다.

실제 값이 필요할 때까지 조회를 미루는 Hibernate의 지연 로딩이 들어가면 이유가 하나 더 붙습니다. 지연 로딩은 실제 엔티티 대신 엔티티를 상속한 프록시 객체를 돌려주는데, 자식 클래스인 프록시가 부모 생성자를 호출하려면 생성자가 최소한 `protected`로는 열려 있어야 합니다.

명세와 프록시 상속 조건을 모두 만족시키면서 일반 코드에서 빈 엔티티 객체를 함부로 만들지 못하게 막는 선택이 `protected` 기본 생성자입니다.

---

## 호출된 메서드 안에서 발생한 예외는 InvocationTargetException에 감싸집니다

리플렉션으로 메서드나 생성자를 호출하다가 그 내부에서 예외가 발생하면, 원래 예외가 그대로 나오지 않고 `InvocationTargetException`에 감싸져서 전달됩니다.

```java
try {
    method.invoke(target);
} catch (InvocationTargetException e) {
    // 리플렉션 자체가 아니라 호출된 메서드 내부에서 발생한 실제 예외
    Throwable actualCause = e.getCause();
}
```

로그를 남기거나 예외를 처리할 때는 `getCause()`로 실제 원인을 꺼내서 확인해야 합니다. 그 밖에 리플렉션에서 자주 만나는 예외는 발생 원인이 정해져 있습니다.

* `NoSuchFieldException` / `NoSuchMethodException`: 이름에 오타가 있거나, 파라미터 타입 조합이 맞지 않거나, `private` 멤버를 `Declared`가 빠진 메서드로 찾았을 때 발생합니다.
* `IllegalAccessException`: 접근 권한이 없는 멤버에 `setAccessible(true)` 없이 접근할 때 발생합니다.
* `ClassNotFoundException`: `Class.forName()`으로 요청한 클래스를 클래스패스에서 찾지 못할 때 발생합니다.
* `InaccessibleObjectException`: 자바 모듈 시스템이 외부 접근을 막은 내부 패키지에 `setAccessible(true)`를 시도할 때 발생합니다.
