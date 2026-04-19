---
title: "일급 컬렉션 (First Class Collection)"
description: "컬렉션을 클래스로 감싸는 이유와 일급 컬렉션이 가져다주는 네 가지 장점을 정리합니다."
date: 2026-04-19
category: "Java"
tags: ["Java", "OOP"]
---

자바로 도메인 로직을 작성하다 보면 `List`나 `Map`을 여기저기 직접 다루는 코드가 자연스럽게 늘어납니다.
처음에는 단순해 보이지만, 같은 컬렉션을 다루는 로직이 여러 곳에 흩어지고 나면 수정할 때마다 모든 곳을 찾아야 하는 상황이 생깁니다.

이 글에서는 컬렉션을 클래스로 감싸는 패턴인 일급 컬렉션이 무엇인지, 그리고 왜 사용하는지를 순서대로 살펴보겠습니다.

## 1. List를 그냥 쓰면 생기는 문제

로또 번호를 관리하는 코드를 예시로 보겠습니다. 로또 번호는 6개여야 하고, 중복이 없어야 합니다.

```java
List<Long> numbers = new ArrayList<>();
numbers.add(1L);
numbers.add(7L);
numbers.add(13L);
// ...
```

이 규칙을 보장하려면 `numbers`를 사용하는 모든 곳에서 검증 로직을 반복해야 합니다.

```java
// 서비스 A
if (numbers.size() != 6) throw new IllegalArgumentException();

// 서비스 B
if (numbers.size() != 6 || hasDuplicates(numbers)) throw new IllegalArgumentException();

// 서비스 C — 검증을 빠뜨림
```

`List<Long>`은 그냥 숫자의 목록일 뿐입니다. 로또 번호라는 도메인 규칙을 스스로 알지 못하기 때문에, 그 책임이 사용하는 쪽으로 새어나갑니다. 규칙이 바뀌면 흩어진 모든 곳을 찾아 수정해야 하고, 어딘가는 빠뜨리게 됩니다.

## 2. 일급 컬렉션이란

일급 컬렉션은 컬렉션을 하나의 클래스로 감싸되, **그 클래스 안에 컬렉션 외의 다른 멤버 변수를 두지 않는 패턴**입니다.

```java
public class LottoTicket {
    private final List<Long> numbers;

    public LottoTicket(List<Long> numbers) {
        this.numbers = numbers;
    }
}
```

단순히 `List`를 클래스로 감싼 것처럼 보이지만, 이 구조가 가져다주는 이점은 생각보다 큽니다.

## 3. 비즈니스에 종속적인 자료구조

일급 컬렉션의 가장 직접적인 장점은 비즈니스 규칙을 컬렉션 자체에 담을 수 있다는 점입니다.

```java
public class LottoTicket {
    private final List<Long> numbers;

    public LottoTicket(List<Long> numbers) {
        if (numbers.size() != 6) {
            throw new IllegalArgumentException("로또 번호는 6개여야 합니다.");
        }
        if (numbers.size() != new HashSet<>(numbers).size()) {
            throw new IllegalArgumentException("로또 번호는 중복될 수 없습니다.");
        }
        this.numbers = new ArrayList<>(numbers);
    }
}
```

이제 `LottoTicket`은 항상 유효한 상태로만 존재합니다. 유효하지 않은 번호로는 객체 자체가 만들어지지 않습니다.

사용하는 쪽에서는 검증을 신경 쓸 필요가 없습니다. `LottoTicket`을 받았다면 이미 올바른 번호라는 것이 보장되기 때문입니다. 규칙이 바뀔 때도 `LottoTicket` 생성자 한 곳만 수정하면 됩니다.

## 4. 불변성 보장 — final의 한계와 방어적 복사

컬렉션을 불변으로 만들려 할 때 `final` 키워드만으로는 충분하지 않습니다. `final`은 **재할당만 막을 뿐, 컬렉션 안의 값을 변경하는 것은 막지 않습니다.**

```java
final Map<String, Boolean> collection = new HashMap<>();
collection.put("1", true);   // 가능 — 재할당이 아니라 값 추가
collection.put("1", false);  // 가능 — 값 변경도 허용됨
```

일급 컬렉션은 값을 변경하는 메서드 자체를 제공하지 않아 외부에서 직접 수정할 수 없습니다. 단, 요소 객체 자체가 불변이어야 완전한 불변이 달성됩니다. `pay.setAmount(0)` 같은 호출로 내부 요소의 상태는 여전히 바꿀 수 있기 때문입니다.

```java
public class ImmutablePays {
    private final List<Pay> pays;

    public ImmutablePays(List<Pay> pays) {
        this.pays = new ArrayList<>(pays);  // 방어적 복사
    }

    public Long getSum() {
        return pays.stream()
                .mapToLong(Pay::getAmount)
                .sum();
    }
    // add, remove 같은 변경 메서드 없음
}
```

생성자에서 `new ArrayList<>(pays)`로 방어적 복사를 하는 이유도 있습니다. 외부에서 원본 `List`를 계속 참조하고 있을 경우, 그 참조를 통해 내부 상태가 변경되는 것을 막기 위해서입니다.

내부 리스트를 반환해야 할 때도 마찬가지입니다. 그대로 반환하면 외부에서 리스트를 수정할 수 있으므로, `Collections.unmodifiableList()`로 감싸서 반환하는 것이 일반적입니다.

```java
public List<Pay> getPays() {
    return Collections.unmodifiableList(pays);
}
```

## 5. 상태와 행위를 한 곳에서 관리

결제 수단별 합계를 계산하는 코드를 예시로 보겠습니다.

일급 컬렉션 없이 작성하면 관련 로직이 서비스 여러 곳에 흩어집니다.

```java
// 서비스 A
Long naverPaySum = pays.stream()
        .filter(pay -> PayType.isNaverPay(pay.getPayType()))
        .mapToLong(Pay::getAmount)
        .sum();

// 서비스 B — 같은 로직이 반복됨
Long naverPaySum = pays.stream()
        .filter(pay -> PayType.isNaverPay(pay.getPayType()))
        .mapToLong(Pay::getAmount)
        .sum();
```

일급 컬렉션으로 감싸면 이 로직이 한 곳에 모입니다.

```java
public class PayGroups {
    private final List<Pay> pays;

    public PayGroups(List<Pay> pays) {
        this.pays = pays;
    }

    public Long getNaverPaySum() {
        return getFilteredSum(pay -> PayType.isNaverPay(pay.getPayType()));
    }

    public Long getKakaoPaySum() {
        return getFilteredSum(pay -> PayType.isKakaoPay(pay.getPayType()));
    }

    private Long getFilteredSum(Predicate<Pay> predicate) {
        return pays.stream()
                .filter(predicate)
                .mapToLong(Pay::getAmount)
                .sum();
    }
}
```

결제 합계 계산 방식이 바뀌더라도 `PayGroups` 한 곳만 수정하면 됩니다. 상태(`pays`)와 그 상태를 다루는 행위(`getNaverPaySum`)가 같은 클래스 안에 있기 때문입니다.

## 6. 이름 있는 컬렉션

`List<Pay>`라는 타입만으로는 이것이 네이버페이 목록인지, 카카오페이 목록인지 알 수 없습니다. 변수명에 의존하게 되고, 변수명은 강제되지 않습니다.

```java
// 변수명만으로 구분 — 강제되지 않음
List<Pay> naverPays = ...;
List<Pay> kakaoPays = ...;
```

일급 컬렉션은 타입 자체가 이름이 됩니다.

```java
public class NaverPayGroup { ... }
public class KakaoPayGroup { ... }
```

클래스 이름이 생기면 몇 가지 실질적인 이점이 따라옵니다.

- 코드베이스에서 `NaverPayGroup`으로 검색이 가능해집니다.
- 팀원과 이야기할 때 "네이버페이 그룹"이라는 명확한 이름으로 소통할 수 있습니다.
- 메서드 파라미터로 `List<Pay>` 대신 `NaverPayGroup`을 받으면, 잘못된 목록이 들어오는 것을 컴파일 타임에 막을 수 있습니다.

## 7. 유틸 클래스와 무엇이 다른가

"로직을 한 곳에 모은다"는 설명을 들으면 유틸 클래스와 비슷해 보일 수 있습니다. 하지만 둘은 성격이 다릅니다.

| | 유틸 클래스 | 일급 컬렉션 |
|--|------------|------------|
| 상태 보유 | 없음 (static 메서드만) | List를 필드로 보유 |
| 도메인 지식 | 없음 | 있음 |
| 예시 | `StringUtils`, `MathUtils` | `LottoTicket`, `PayGroups` |

유틸 클래스는 도메인을 모르는 순수한 계산 도구입니다. `StringUtils`는 문자열을 어떻게 다룰지 알지만, 그 문자열이 어떤 비즈니스 의미를 가지는지는 모릅니다.

일급 컬렉션은 상태를 가지고, 그 상태와 관련된 도메인 규칙을 직접 담습니다. 같은 컬렉션 조작이라도 "로또 번호의 중복 검사"라는 맥락을 알고 있습니다.

## 마무리

정리하면 다음과 같습니다.

- 컬렉션을 그냥 쓰면 비즈니스 규칙이 사용하는 쪽으로 새어나간다
- 일급 컬렉션은 컬렉션 하나만을 멤버 변수로 갖는 클래스다
- 생성자에서 검증하면 유효하지 않은 상태의 객체가 만들어지지 않는다
- `final`만으로는 컬렉션 내부 변경을 막을 수 없고, 변경 메서드를 제공하지 않아야 진정한 불변이 된다
- 관련 상태와 행위가 한 클래스에 모이므로 변경 시 수정 지점이 하나다
- 클래스 이름 자체가 의미를 전달하고, 검색과 소통이 명확해진다

일급 컬렉션은 거창한 패턴이 아닙니다. 컬렉션에 이름을 붙이고, 관련 규칙을 그 안에 담는 것입니다. 작은 변화지만 코드의 응집도와 명확성에 미치는 영향은 큽니다.
