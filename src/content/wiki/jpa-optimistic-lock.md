---
title: "JPA 낙관적 락이 새는 3가지 지점"
description: "@Version 한 줄로는 끝나지 않습니다. 락이 우회되는 함정, 트랜잭션 안에서 예외를 못 잡는 이유, 진짜 동작을 검증하는 동시성 테스트 패턴까지 정리합니다."
date: 2026-05-22
category: "JPA"
tags: ["JPA", "Hibernate", "Spring", "Concurrency", "Transaction"]
---

> 이 글의 코드는 **Java 21, Spring Boot 3.5, Hibernate 6.x** 기준입니다.

JPA에서 동시성 처리하면 가장 먼저 떠오르는 게 `@Version` 한 줄 추가입니다. 간단합니다. 그런데 정작 붙여놓고 동시성 테스트로 검증해보면 **특정 패턴에서 락이 의도대로 동작하지 않는 경우**가 있습니다. 더 황당한 건, 락이 동작했다 해도 예외를 잡으려는 순간 또 한 번 막힌다는 점입니다.

이 글은 도서관 대출 시스템에서 같은 책에 대한 동시 대출을 막는 과정을 따라가며, **낙관적 락이 의도대로 동작하지 않는 세 가지 함정**(락 우회 · 예외 처리 실패 · 검증 실패)과 **진짜 동작을 검증하는 동시성 테스트 패턴**까지 한 흐름으로 정리합니다.

## 1. 왜 낙관적 락인가

도서관 시스템엔 두 개의 엔티티가 있습니다.

| Entity | 역할 |
|---|---|
| `BookInfo` | 도서 메타정보 (ISBN, 제목, 저자) - 거의 안 바뀜 |
| `Book` | 실제 물리 도서 한 권 - `AVAILABLE ↔ ON_LOAN` 상태가 바뀜 |

같은 ISBN의 책이 여러 권 있을 수 있고, **대출 가능 여부는 `Book` 단건의 `status`로 판단합니다.** 그러면 락은 어디에 걸까요?

> **`Book.status` 가 동시 변경의 대상이므로 `Book`에 겁니다.** `BookInfo`는 메타데이터라 동시 갱신 충돌이 발생할 일이 없습니다.

> **💡 애그리거트 분리의 동시성 이점**
>
> 만약 `BookInfo`와 `Book`을 한 엔티티로 합쳤다면, "도서 정보 수정" 트랜잭션과 "대출" 트랜잭션이 같은 row에서 락 경합을 일으켰을 것입니다. 엔티티를 쪼개둔 덕분에 **락의 범위가 자연스럽게 좁아집니다.** 도메인 모델링이 동시성 성능에도 영향을 줍니다.

### 낙관적 vs 비관적 - 왜 낙관적인가

| 구분 | 낙관적 락 | 비관적 락 |
|---|---|---|
| 방식 | 충돌을 허용하고 커밋 시점에 검증 | 조회 시점에 DB row 락 |
| 적합 | 충돌이 **드문** 경우 | 충돌이 **잦은** 경우 |
| 비용 | 평소엔 0 (version 비교만) | 항상 대기 비용 발생 |
| JPA | `@Version` | `@Lock(LockModeType.PESSIMISTIC_WRITE)` |
| 위험 | 충돌 시 예외 → 재시도 필요 | 데드락 |

도서관에서 "같은 책 한 권"에 정확히 같은 순간 두 명이 대출 버튼을 누를 빈도는 매우 낮습니다. 평소 비용이 0이고 충돌 시에만 실패 처리하면 되는 낙관적 락이 합리적입니다.

> 비관적 락은 좌석 예약, 재고 차감, 잔액 차감처럼 **경합이 높고 충돌 시 재시도 비용이 큰 도메인**에 어울립니다. 도서관은 그런 경우가 아닙니다.

## 2. `@Version` 적용 - 어디에, 어떤 타입으로

`@Version`은 **클래스가 아니라 필드 어노테이션**입니다. "이 필드가 버전 관리 칼럼"이라는 의미이기 때문입니다.

```java
@Entity
public class BookJpaEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long bookInfoId;

    @Enumerated(EnumType.STRING)
    private BookStatus status;

    @Version          // ← 필드에
    private Long version;
}
```

타입은 `Long`을 추천합니다. JPA 스펙상 `int`, `Integer`, `short`, `Short`, `long`, `Long`과 시간 타입(`java.sql.Timestamp`, JPA 2.2부터는 `java.time.Instant` / `java.time.LocalDateTime`)이 허용되지만:
- 정수형이 단순하고 안전 - `Long`이 무난한 기본값
- 시간 타입은 **밀리초 정밀도 한계 + 시계 역행(NTP 보정, 멀티 노드 환경)** 으로 신뢰성이 떨어져 비추

**Hibernate가 자동으로 관리합니다.** `version`이 `null`인 채로 INSERT되면 `0`으로 초기화하고, 이후 UPDATE 때마다 `+1` 합니다. 외부에서 빌더나 매퍼로 `version`을 주입할 필요가 없습니다.

UPDATE 쿼리는 이렇게 나갑니다:

```sql
UPDATE book SET status = ?, version = ?
WHERE id = ? AND version = ?
```

`WHERE version = ?` 조건이 핵심입니다. 다른 트랜잭션이 먼저 커밋해서 version이 올라갔으면, 이 UPDATE는 0개 row를 갱신하고, **flush 시점**에 Hibernate가 영향받은 row 수를 검사해 `OptimisticLockException`을 던집니다.

## 3. 함정 ① - `@Version`만 붙이면 락이 동작하지 않는다

여기서 가장 흔한 함정이 나옵니다. 영속성 어댑터의 `updateBook()`을 이렇게 짰다고 해봅시다.

```java
@Repository
@RequiredArgsConstructor
public class BookPersistenceAdapter implements UpdateBookPort {
    private final BookJpaRepository bookJpaRepository;
    private final BookMapper bookMapper;

    @Override
    public void updateBook(Book book) {
        bookJpaRepository.save(bookMapper.mapToJpaEntity(book));  // ❌
    }
}
```

매퍼는 도메인 `Book`을 받아 새 `BookJpaEntity`를 만듭니다. 도메인에 `version` 필드가 없다면 새로 만든 엔티티의 `version`은 `null`입니다.

> **💡 잠깐, managed/detached가 뭐였더라**
>
> JPA의 엔티티는 네 가지 상태를 가집니다. 여기선 두 개만 알면 됩니다.
> - **managed (영속)**: 영속성 컨텍스트가 추적하는 엔티티. 필드를 바꾸면 커밋 시 자동 UPDATE.
> - **detached (준영속)**: ID는 있지만 영속성 컨텍스트 추적 밖에 있는 엔티티. `save()`로 다시 보내면 내부적으로 `merge()`가 호출됩니다.

이 상태로 `save()`를 호출하면 Hibernate는 `merge()` 경로를 탑니다. `merge()`의 동작은:

1. DB(또는 1차 캐시)에서 같은 ID로 row를 SELECT해서 매니지드 엔티티로 만듭니다
2. 그 매니지드 엔티티의 필드를 detached 엔티티의 필드로 **덮어씁니다**
3. 커밋 시 매니지드 엔티티의 dirty 상태로 UPDATE

문제는 2번입니다. detached 엔티티의 `version`이 `null`이라면:

- **Hibernate 버전·매핑에 따라** `PropertyValueException("not-null property references a null or transient value")` 같은 예외가 터질 수 있고,
- 그렇지 않다면 매니지드 엔티티의 version이 매번 **DB의 최신 값으로 새로 읽혀서** 덮어쓰기되므로, 호출자가 "조회 시점에 본 version" 자체가 남지 않습니다 → UPDATE의 `WHERE version = ?`은 항상 **최신 version**으로 나가게 되고 → 다른 트랜잭션이 먼저 커밋했어도 충돌이 검출되지 않습니다. **last-write-wins(마지막 쓰기가 이긴다)** 가 되어 lost update가 그대로 발생합니다.

요컨대 "낙관적 락 체크가 우회된다"기보다는 **"충돌을 검출할 기회 자체가 사라진다"** 가 더 정확합니다. 어쨌든 결과는 같습니다 - 락이 의미 없습니다.

### 해결책: Dirty Checking 패턴

```java
@Override
public void updateBook(Book book) {
    BookJpaEntity entity = bookJpaRepository.findById(book.getId())
            .orElseThrow(() -> new BookNotFoundException("도서를 찾을 수 없습니다."));
    entity.changeStatus(book.getStatus());
    // 이 패턴에선 save() 불필요 - 매니지드 엔티티라 커밋 시 dirty checking으로 UPDATE 발생
}
```

핵심은:
1. `findById`로 **매니지드 엔티티**를 가져옵니다 (영속성 컨텍스트에 등록됨, `version` 정보 보존)
2. 그 엔티티의 상태만 변경합니다 (`setter`가 아니라 의도 드러나는 메서드)
3. **이 패턴에선** `save()` 호출 불필요 - 매니지드 엔티티이므로 트랜잭션 커밋 시 JPA가 알아서 UPDATE 쿼리를 생성합니다 (새 엔티티 INSERT나 detached 엔티티 갱신은 여전히 `save()`가 필요합니다)

이 흐름이라면 SQL은 이렇게 나갑니다.

```sql
-- updateBook() 호출 시
SELECT id, book_info_id, status, version FROM book WHERE id = ?

-- 트랜잭션 커밋 시
UPDATE book SET status = ?, version = ? WHERE id = ? AND version = ?
```

조회 시점의 version이 매니지드 엔티티에 살아 있으므로 UPDATE의 `WHERE version = ?`이 의미를 가집니다.

> **🤔 "findById가 한 번 더 나가지 않나?"**
>
> 같은 트랜잭션 안이라면 영속성 컨텍스트 1차 캐시에서 반환되어 DB 쿼리가 추가로 나가지 않습니다. 다른 트랜잭션에서 가져온 도메인이라면 SELECT가 한 번 더 나가긴 하지만, **도메인 순수성을 깨면서 얻는 한 번의 SELECT 절약은 가치가 없습니다.**

> **⚠️ 도메인에 `version`을 노출할지 말지는 선택의 문제**
>
> 다른 해결책은 도메인 `Book`에 `version: long` 필드를 두고 매퍼로 주고받는 것입니다. DDD에서는 도메인 모델에 버전(애그리거트의 변경 시퀀스)을 두는 것이 자연스럽기도 합니다. 다만 도메인이 `@Version` 같은 JPA 어노테이션이나 `jakarta.persistence.*` 패키지를 import하기 시작하면 의존성 방향이 깨집니다. **필드 자체보다 패키지 의존이 더 큰 문제입니다.** 이 글에선 단순함을 위해 도메인에 version을 두지 않는 쪽을 택했습니다.

## 4. 함정 ② - `@Transactional` 메서드 안에서는 (대체로) `OptimisticLockException`을 못 잡는다

이제 락이 동작합니다. 그러면 자연스러운 다음 질문이 떠오릅니다.

> "그럼 `LoanBookService.loanBook()` 안에서 `OptimisticLockException`을 잡아서 도메인 예외로 바꾸면 되겠네?"

```java
@Transactional
public Loan loanBook(LoanBookCommand command) {
    try {
        // ... 비즈니스 로직 ...
        updateBookPort.updateBook(book.checkout());
    } catch (OptimisticLockException e) {
        throw new BookNotAvailableException("이미 대출 중인 도서입니다.");
    }
    return loan;
}
```

**이 try-catch는 의도대로 동작하지 않습니다.** 이유는 SQL이 언제 나가는지 알면 명확해집니다.

### Dirty Checking은 커밋 시점에 flush된다

**기억해둡시다 - dirty checking은 메서드 본문 중에는 SQL을 내보내지 않습니다.** 변경 사항은 메모리에만 쌓여 있다가 트랜잭션 커밋 시점에 한꺼번에 flush됩니다.

```
[프록시] 트랜잭션 시작
   ↓
[loanBook() 진입]
   ↓ loadBook(), entity.changeStatus() 등 호출
   ↓ → 메모리상의 엔티티만 변경. SQL은 안 나감!
   ↓
[loanBook() 정상 return]
   ↓
[프록시] 트랜잭션 커밋
   ↓ ← 여기서 UPDATE 실행 → OptimisticLockException 발생
```

`@Transactional`은 Spring AOP **프록시**가 메서드를 감싸서 트랜잭션을 시작·커밋합니다. SQL flush와 커밋은 메서드가 정상 종료된 **후** 프록시가 처리합니다. 그러니 메서드 내부의 try-catch 영역은 이미 빠져나온 상태입니다.

### "그럼 `em.flush()`를 명시적으로 호출하면 잡을 수 있지 않나?"

기술적으로는 가능합니다. 메서드 내부에서 `em.flush()`를 호출하면 그 자리에서 SQL이 나가고 `OptimisticLockException`도 그 자리에서 던져집니다. **하지만 잡아도 끝이 아닙니다.**

Spring은 트랜잭션 안에서 런타임 예외가 던져지는 순간 트랜잭션을 **rollback-only**로 마킹합니다. 메서드 안에서 try-catch로 잡아서 정상 return 해도, 메서드 종료 후 프록시는 커밋을 시도하다가 rollback-only를 감지하고 **`UnexpectedRollbackException`을 던집니다.** 결국 호출자에게는 다른 예외가 올라갑니다.

> **한 줄 요약: 같은 트랜잭션 안에서 `OptimisticLockException`을 잡아도, 트랜잭션은 살아나지 않습니다.**

### 그럼 어디서 잡나?

| 위치 | 동작 | 평가 |
|---|---|---|
| A. 같은 메서드에서 `flush()` 후 try-catch | 예외는 잡혀도 트랜잭션은 rollback-only → `UnexpectedRollbackException` | ❌ 동작 안 함 |
| B. 상위에서 `REQUIRES_NEW`로 새 트랜잭션 안에 위임 | 새 트랜잭션을 열고 그 안에서 잡으면 격리됨 | 가능하지만 구조 복잡 |
| **C. `GlobalExceptionHandler`** | 컨트롤러까지 전파된 예외를 변환 | 가장 단순, 위치 자연스러움 ⭐ |

## 5. 인프라 예외 → 도메인 예외 변환

`OptimisticLockException`을 그대로 사용자에게 내보내면 문제가 많습니다.

- Hibernate가 만든 영어 기술 메시지가 그대로 노출됨
- JPA 엔티티 클래스명이 응답에 포함됨 - **내부 구조 누설**
- 같은 의미("이미 대출 중")인데 `BookNotAvailableException`을 던졌을 때와 응답 형식이 달라짐

`@RestControllerAdvice`에서 변환하면 깔끔합니다.

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(DomainException.class)
    public ProblemDetail domainExceptionHandler(DomainException e, HttpServletRequest request) {
        return createProblemDetail(e, HttpStatus.BAD_REQUEST, request);
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ProblemDetail optimisticLockHandler(HttpServletRequest request) {
        return createProblemDetail(
                new BookNotAvailableException("이미 대출 중인 도서입니다."),
                HttpStatus.CONFLICT,
                request
        );
    }

    private ProblemDetail createProblemDetail(Exception e, HttpStatus status, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatus(status);
        pd.setTitle(status.getReasonPhrase());
        pd.setDetail(e.getMessage());
        pd.setInstance(URI.create(request.getRequestURI()));
        pd.setProperty("timestamp", Instant.now());
        return pd;
    }
}
```

여기서 잡은 건 Spring의 `ObjectOptimisticLockingFailureException`입니다. JPA 표준 `jakarta.persistence.OptimisticLockException`을 Spring Data JPA가 `DataAccessException` 계층으로 감싸 다시 던지기 때문에, **`@Repository`(또는 Spring Data JPA의 리포지토리 프록시)를 통한 호출 경로에서는 컨트롤러까지 올라오는 게 Spring 쪽입니다.** (만약 `EntityManager`를 직접 다룬다면 JPA 표준 예외가 올라올 수 있으므로 두 예외를 모두 핸들링하는 게 안전합니다.)

상태 코드는 **409 Conflict** - 동시성 충돌의 표준 코드입니다. (ETag/If-Match 같은 사전 조건 기반이면 412 Precondition Failed를 쓰기도 합니다.)

## 6. 진짜 동작하는지 어떻게 검증하지? - 동시성 테스트

여기까지 잘 짰다고 해도 **실제로 락이 동작하는지 확인하지 않으면 의미가 없습니다.** 동시성 처리는 코드만 봐서는 잘 짜였는지 알기 어렵습니다.

도구 선택부터 봅시다.

### MockMvc는 동시성 테스트에 부적합

| 도구 | 특징 | 동시성 검증 |
|---|---|---|
| `MockMvc` | 서블릿 컨테이너 없이 `DispatcherServlet`을 호출 스레드에서 시뮬레이션 | ❌ 진짜 톰캣의 동시 요청 모델 재현 불가 |
| `TestRestTemplate` + `@SpringBootTest(webEnvironment = RANDOM_PORT)` | 실제 톰캣 띄우고 HTTP 호출 | ✅ 진짜 멀티스레드 |

`MockMvc` 자체가 "단일 스레드"인 것은 아닙니다. 호출하는 쪽이 멀티스레드면 멀티스레드로 부를 수도 있습니다. 다만 **서블릿 컨테이너의 커넥터·스레드 풀·필터 체인을 거치지 않으므로** 운영 환경의 동시 요청 처리 경로를 재현하지 못합니다. 동시성 테스트는 무조건 실제 톰캣을 띄우는 `RANDOM_PORT`로 가야 합니다.

### 함정 ③ - "동시 호출"이 사실 순차 호출인 경우

가장 흔한 실수는 이런 코드입니다.

```java
ExecutorService executor = Executors.newFixedThreadPool(10);
for (int i = 0; i < 10; i++) {
    executor.submit(() -> 대출요청());
}
```

이걸로는 진짜 동시 충돌이 발생하지 않을 수 있습니다. OS 스케줄러가 스레드를 하나씩 시작시키면, 첫 요청이 commit된 후 두 번째 요청이 시작될 수 있습니다. 그러면:

- 첫 트랜잭션: 대출 성공, version 0→1
- 두 번째 트랜잭션: `loadBook()`했을 때 이미 `version=1, status=ON_LOAN` → 비즈니스 로직(예: `if (book.isOnLoan()) throw ...`)에서 미리 차단됨
- **`OptimisticLockException`이 발생할 기회 자체가 없음**

비즈니스 가드와 낙관적 락은 **충돌 검출 시점이 다른 두 겹의 방어선**입니다. 가드는 트랜잭션 시작 직후에, 락은 커밋 시점에 충돌을 잡습니다. 진짜 동시성 상황 - 두 트랜잭션이 가드를 모두 통과해 커밋 단계에서 부딪치는 - 을 만들려면 출발선을 통일해야 합니다.

### 해결: `CountDownLatch`로 출발선 통일

```java
CountDownLatch startLatch = new CountDownLatch(1);    // 출발 신호
CountDownLatch endLatch = new CountDownLatch(10);     // 종료 대기

for (int i = 0; i < 10; i++) {
    executor.submit(() -> {
        try {
            startLatch.await();   // ① 모든 스레드가 여기서 대기
            대출요청();             // ③ 신호 받으면 동시에 출발
        } finally {
            endLatch.countDown(); // 끝났음 신호
        }
    });
}

startLatch.countDown();  // ② 출발! 카운트 1→0, 대기 중이던 모든 스레드 동시 진입
endLatch.await(10, TimeUnit.SECONDS);  // 모든 작업 끝날 때까지 대기 (타임아웃 권장)
```

- `startLatch` - **출발선 통일**. 모든 스레드가 정확히 같은 순간에 진입하도록
- `endLatch` - **종료 동기화**. 메인 스레드가 검증 코드를 실행하기 전에 모든 워커가 끝났음을 보장
- `await(timeout)` - 데드락 등으로 테스트가 무한 대기하지 않도록 타임아웃 지정

### 전체 테스트

> **참고**: 컨트롤러는 `POST /api/v1/loans/{bookId}` → 성공 시 `201 Created`, 충돌 시 `409 Conflict`를 반환한다고 가정합니다.

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class LibrarySystemConcurrencyTest {

    @LocalServerPort
    private int port;

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private MemberJpaRepository memberJpaRepository;
    @Autowired private BookJpaRepository bookJpaRepository;
    @Autowired private BookInfoJpaRepository bookInfoJpaRepository;
    @Autowired private LoanJpaRepository loanJpaRepository;

    private Long savedBookId;
    private Long savedMemberId;

    @BeforeEach
    void setUp() {
        MemberJpaEntity member = memberJpaRepository.save(
                MemberJpaEntity.builder().name("memberA").email("a@test.com").build());
        BookInfoJpaEntity info = bookInfoJpaRepository.save(
                BookInfoJpaEntity.builder().isbn("isbn-A").title("t").author("a").category("c").build());
        BookJpaEntity book = bookJpaRepository.save(
                BookJpaEntity.builder().bookInfoId(info.getId()).status(BookStatus.AVAILABLE).build());
        savedMemberId = member.getId();
        savedBookId = book.getId();
    }

    @AfterEach
    void tearDown() {
        // FK 참조 순서: Loan → Book → BookInfo → Member
        loanJpaRepository.deleteAllInBatch();
        bookJpaRepository.deleteAllInBatch();
        bookInfoJpaRepository.deleteAllInBatch();
        memberJpaRepository.deleteAllInBatch();
    }

    @Test
    void 동시에_같은_책을_대출하면_한_건만_성공한다() throws InterruptedException {
        int threadCount = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch endLatch = new CountDownLatch(threadCount);

        // 여러 스레드가 동시에 증가시키므로 일반 int 대신 AtomicInteger (i++는 read/add/write 3단계라 race 발생)
        AtomicInteger successCount = new AtomicInteger();
        AtomicInteger conflictCount = new AtomicInteger();
        AtomicInteger otherCount = new AtomicInteger();

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();

                    LoanBookRequest request = LoanBookRequest.builder()
                            .memberId(savedMemberId).loanDays(7).build();

                    ResponseEntity<String> response = restTemplate.postForEntity(
                            "/api/v1/loans/" + savedBookId, request, String.class);

                    int status = response.getStatusCode().value();
                    if (status == 201) successCount.incrementAndGet();
                    else if (status == 409) conflictCount.incrementAndGet();
                    else otherCount.incrementAndGet();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    endLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        endLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();
        if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
            executor.shutdownNow();
        }

        assertThat(otherCount.get()).isZero();  // 예상치 못한 상태 코드 차단
        assertThat(successCount.get()).isEqualTo(1);
        assertThat(conflictCount.get()).isEqualTo(threadCount - 1);

        BookJpaEntity book = bookJpaRepository.findById(savedBookId).orElseThrow();
        assertThat(book.getStatus()).isEqualTo(BookStatus.ON_LOAN);
        assertThat(book.getVersion()).isEqualTo(1L);  // 한 번만 UPDATE 성공
    }
}
```

주의할 점 몇 가지를 짚습니다.

> **`@BeforeEach`에 `@Transactional`을 붙이지 마세요**
>
> `Spring Data JPA`의 `save()`는 자체 트랜잭션으로 즉시 커밋합니다. 만약 setUp에 `@Transactional`을 붙이면 setup 데이터가 **메인 스레드의 트랜잭션 안에 갇혀** 워커 스레드의 새 트랜잭션에서 보이지 않습니다. 워커가 HTTP 요청을 보내봐야 DB에 회원/책이 없는 상태로 보입니다. 그냥 `save()`만 호출하면 됩니다.

> **`deleteAllInBatch()`를 쓰세요 - 단, FK 순서는 직접 맞춰야**
>
> `deleteAll()`은 엔티티별 SELECT 후 DELETE를 날립니다. 테스트 정리 용도엔 `deleteAllInBatch()`(단일 `DELETE FROM table`)가 훨씬 빠릅니다. **단, cascade와 영속성 컨텍스트를 무시하므로** FK 참조 순서는 직접 맞춰야 합니다.

> **`executor.shutdown()`만으로는 충분하지 않습니다**
>
> `shutdown()`은 새 작업을 받지 않을 뿐, 실행 중인 작업의 종료를 보장하지 않습니다. `awaitTermination`으로 완료를 기다리고, 타임아웃 시 `shutdownNow()`로 강제 종료해야 워커 스레드가 다음 테스트로 새지 않습니다. Java 21이라면 `try (var executor = Executors.newFixedThreadPool(threadCount))` 패턴도 가능합니다.

> **H2 vs 운영 DB 동작 차이 주의**
>
> 동시성 테스트의 신뢰성은 사용하는 DB의 격리 수준·MVCC 구현에 영향을 받습니다. H2 인메모리는 PostgreSQL/MySQL과 락 정책이 다를 수 있습니다. 운영 환경 DB에서도 한 번 더 검증하려면 Testcontainers로 같은 DB를 띄워 돌려보는 게 안전합니다.

## 7. 충돌이 나면 끝? 재시도라는 다른 선택지

이 글은 충돌을 그대로 **409 Conflict**로 사용자에게 돌려주는 패턴을 다룹니다. 도서관처럼 사용자가 "다시 시도"하는 것이 자연스러운 도메인에선 합리적입니다. 하지만 어떤 도메인에선 **시스템이 자동으로 재시도**하는 게 더 적절합니다 (예: 재고 차감, 포인트 적립처럼 어차피 결과가 같아야 하는 경우).

Spring Retry로 간단히 구현 가능합니다.

```java
@Retryable(
    retryFor = ObjectOptimisticLockingFailureException.class,
    maxAttempts = 3,
    backoff = @Backoff(delay = 50)
)
@Transactional
public Loan loanBook(LoanBookCommand command) { ... }
```

다만 두 가지 주의가 필요합니다.

1. **재시도되는 메서드는 반드시 새 트랜잭션이어야 합니다.** 기존 트랜잭션은 이미 rollback-only이므로, 같은 트랜잭션 안에서 재시도해봐야 결과는 같습니다.
2. **멱등성**을 보장해야 합니다. 재시도가 의미 있으려면 같은 호출이 여러 번 일어나도 같은 결과여야 합니다.

## 8. 정리

| 잘못된 이해 | 올바른 이해 |
|---|---|
| "`@Version`만 붙이면 낙관적 락 끝" | "Dirty Checking 패턴과 함께 써야 version이 살아남는다" |
| "`LoanBookService` 안에서 `OptimisticLockException` 잡으면 된다" | "잡아도 rollback-only 마킹 때문에 트랜잭션이 살아나지 않는다 → `@RestControllerAdvice`에서 잡아야 한다" |
| "그냥 `ExecutorService`로 N개 던지면 동시성 테스트" | "`CountDownLatch`로 출발선을 통일해야 진짜 동시 충돌이 발생" |
| "`MockMvc`로 동시성 테스트 가능" | "`@SpringBootTest(RANDOM_PORT)` + `TestRestTemplate`이 필요" |

### 한 줄 요약

> **낙관적 락은 `@Version` 한 줄로 끝나지 않습니다.** 적용(Dirty Checking) - 변환(`GlobalExceptionHandler`) - 검증(`CountDownLatch` 동시성 테스트) 세 단계를 다 갖춰야 비로소 동작합니다. 셋 중 하나라도 빠지면 락이 새거나, 동작하는지 알 수 없습니다.

다음에 `@Version`을 붙일 때 떠올릴 체크리스트입니다.

> - [ ] 매퍼로 새 엔티티 만들어 save하고 있지 않은가? → Dirty Checking 패턴으로
> - [ ] 충돌 응답이 사용자 친화적 메시지로 변환되어 있는가? → `GlobalExceptionHandler`에서 409
> - [ ] 진짜 동시 충돌 시나리오를 테스트로 검증했는가? → `CountDownLatch` + `TestRestTemplate`
