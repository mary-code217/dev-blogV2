---
title: "DB 조회 성능 개선기 - 30초를 5초로"
description: "스칼라 서브쿼리를 CTE + PIVOT으로 리팩토링하고, 커버링 인덱스를 적용해 조회 성능을 6배 개선한 과정을 정리합니다."
date: 2026-04-07
category: "Database"
tags: ["Oracle", "SQL"]
---

## 문제 상황

여러 항목의 현황을 한 화면에 보여주는 대시보드를 만들고 있었다. 하나의 목록 행에 9개 영역의 상태값이 들어가야 해서, 통합 조회 쿼리 하나로 전부 가져오는 구조였다.

```
[목록 1행] = 기본정보 + 영역A 상태 + 영역B 상태 + ... + 영역I 상태
```

테이블은 17개, CTE는 16개. 쿼리 하나가 수백 줄이었다. 처음 실행했을 때 **30초 이상**. 실사용은 불가능한 수준이었다.

---

## 왜 느렸나

기존 쿼리 구조는 이랬다.

```sql
SELECT
    col_1, col_2,
    (SELECT ... FROM A테이블 WHERE ...) AS status_a,
    (SELECT ... FROM A테이블 WHERE ...) AS id_a,
    (SELECT ... FROM A테이블 WHERE ...) AS year_a,
    (SELECT ... FROM A테이블 WHERE ...) AS loc_a,
    -- ... 이런 서브쿼리가 15개
FROM (
    SELECT * FROM 기준테이블
    WHERE ...
    ORDER BY ...
    OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
) C
```

SELECT 절에 스칼라 서브쿼리가 잔뜩 달려 있었다. 문제는 **스칼라 서브쿼리는 행마다 실행된다**는 점이다.

- 페이징으로 20행을 가져오면
- 서브쿼리 15개 × 20행 = **300번 테이블 접근**
- 그중 한 영역은 같은 테이블을 15번이나 스캔하고 있었다

Java의 N+1 문제와 같은 원리다. 메인 쿼리의 각 행마다 서브쿼리가 따로따로 실행되니까, 행이 늘어날수록 기하급수적으로 느려진다.

---

## 1차 개선: 서브쿼리 → CTE 리팩토링

동료에게 느린 쿼리를 공유했더니, **CTE(WITH절)로 바꿔보라**는 조언을 받았다.

핵심 아이디어는 단순하다. SELECT에서 행마다 서브쿼리를 실행하는 대신, WITH절에서 영역별로 **미리 집계**해놓고 메인에서 LEFT JOIN하는 것이다.

### Before: 스칼라 서브쿼리 방식

```sql
SELECT
    C.col_1,
    (SELECT x FROM A테이블 WHERE key = C.key) AS val_1,
    (SELECT y FROM A테이블 WHERE key = C.key) AS val_2,
    -- 행마다 A테이블 반복 접근
FROM 기준테이블 C
```

### After: CTE + LEFT JOIN 방식

```sql
WITH
WITH_BASE AS (
    SELECT * FROM 기준테이블
    WHERE ...
    ORDER BY ...
    OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
),
WITH_A AS (
    SELECT key, x AS val_1, y AS val_2
    FROM A테이블
    WHERE key IN (SELECT key FROM WITH_BASE)
    GROUP BY key
),
WITH_B AS ( ... ),
-- 영역별 CTE 9개
SELECT
    C.col_1, A.val_1, A.val_2, B.val_1, ...
FROM WITH_BASE C
LEFT JOIN WITH_A A ON A.key = C.key
LEFT JOIN WITH_B B ON B.key = C.key
...
```

여기서 중요한 포인트가 하나 있다. **기준 CTE에서 페이징을 먼저 적용**한다는 것이다. `WITH_BASE`에서 20건만 걸러놓으면, 이후 CTE들은 `WHERE key IN (SELECT key FROM WITH_BASE)` 조건으로 20건에 해당하는 데이터만 가져온다. 전체 테이블을 스캔할 필요가 없어진다.

| 항목 | Before (서브쿼리) | After (CTE) |
| --- | --- | --- |
| 테이블 접근 | 행마다 반복 (20행 × 15개 = 300회) | 영역별 1회 (약 11회) |
| 메인 쿼리 | CASE + EXISTS 중첩 | 단순 CASE + 플래그 비교 |
| 가독성 | 수백 줄 중첩 | 영역별 분리, 읽기 쉬움 |

**결과: 30초 이상 → 10초 이내.** 구조 변경만으로 큰 폭의 개선이 있었다.

---

## 2차 개선: ROW_NUMBER + PIVOT

CTE로 바꿨는데도, 특정 영역이 여전히 느렸다. 원인을 파보니 CTE **안에서** 여전히 스칼라 서브쿼리를 쓰고 있었다.

이 영역은 하나의 테이블에서 3가지 종류의 데이터를 뽑아야 했다.

- 종류1: `type = 'R'`인 것 중 **가장 오래된** 것
- 종류2: `type = 'R'`인 것 중 **가장 최근** 것
- 종류3: `type = 'F'`인 것 중 **가장 최근** 것

각 종류마다 ID, 연도, 지역코드1, 지역코드2, 결재여부를 가져와야 해서, 서브쿼리가 **15개**(5개 × 3종류)였다. 같은 테이블을 15번 스캔하고 있었던 것이다.

### Before: 스칼라 서브쿼리 15개

```sql
WITH_A AS (
    SELECT key,
        (SELECT id FROM A테이블 WHERE type = 'R' AND key = x.key
         ORDER BY dt ASC FETCH FIRST 1 ROW ONLY) AS first_id,
        (SELECT yr FROM A테이블 WHERE type = 'R' AND key = x.key
         ORDER BY dt ASC FETCH FIRST 1 ROW ONLY) AS first_yr,
        -- ... 이런 서브쿼리가 15개
    FROM WITH_BASE x
)
```

### After: ROW_NUMBER + PIVOT 2단계

**1단계**: 테이블을 딱 1번만 스캔하면서 ROW_NUMBER를 부여한다.

```sql
WITH_A_BASE AS (
    SELECT key, type, id, dt, yr, loc_1, loc_2, appr_key,
        ROW_NUMBER() OVER (
            PARTITION BY key, type ORDER BY dt ASC, id ASC
        ) AS rn_asc,
        ROW_NUMBER() OVER (
            PARTITION BY key, type ORDER BY dt DESC, id DESC
        ) AS rn_desc
    FROM A테이블
    WHERE key IN (SELECT key FROM WITH_BASE)
      AND type IN ('R', 'F')
)
```

같은 `PARTITION BY`에 정렬 방향만 다른 ROW_NUMBER를 동시에 계산한다. `rn_asc = 1`이면 가장 오래된 것, `rn_desc = 1`이면 가장 최근 것이다.

**2단계**: `rn = 1`인 행만 필터한 뒤, MAX(CASE WHEN)으로 PIVOT 집계한다.

```sql
WITH_A_PIVOT AS (
    SELECT key,
        MAX(CASE WHEN type = 'R' AND rn_asc  = 1 THEN id END) AS first_id,
        MAX(CASE WHEN type = 'R' AND rn_asc  = 1 THEN yr END) AS first_yr,
        MAX(CASE WHEN type = 'R' AND rn_asc  = 1 THEN loc_1 END) AS first_loc_1,
        MAX(CASE WHEN type = 'R' AND rn_desc = 1 THEN id END) AS latest_id,
        MAX(CASE WHEN type = 'R' AND rn_desc = 1 THEN yr END) AS latest_yr,
        MAX(CASE WHEN type = 'F' AND rn_desc = 1 THEN id END) AS adhoc_id,
        -- ...
    FROM WITH_A_BASE
    LEFT JOIN 결재테이블 w ON w.appr_key = appr_key
    WHERE rn_asc = 1 OR rn_desc = 1
    GROUP BY key
)
```

`MAX(CASE WHEN 조건 THEN 값 END)` 패턴으로, 한 번의 GROUP BY에서 여러 종류의 값을 한 행으로 PIVOT한다. 이렇게 하면 key 하나당 정확히 1행이 나오고, 메인 쿼리에서 깔끔하게 LEFT JOIN할 수 있다.

| 항목 | Before | After |
| --- | --- | --- |
| 테이블 스캔 | 15회 (서브쿼리마다) | **1회** |
| 구조 | 스칼라 서브쿼리 15개 | 2단계 CTE (ROW_NUMBER → PIVOT) |
| 실행시간 | 10초 이내 | **6~8초** |

---

## 3차 개선: 커버링 인덱스

쿼리 구조를 바꾼 뒤, 인덱스도 손봤다.

### 커버링 인덱스란?

일반적인 인덱스는 **WHERE 조건에 맞는 행을 빨리 찾는 것**이 목적이다. 인덱스로 위치를 찾은 뒤, 실제 데이터는 테이블에서 다시 읽어온다.

```
일반 인덱스: 인덱스 탐색 → 테이블 액세스 (Table Access by ROWID)
커버링 인덱스: 인덱스 탐색 → 끝! (Index Only Scan)
```

커버링 인덱스는 쿼리가 필요로 하는 **모든 컬럼**을 인덱스에 포함시킨다. 그러면 인덱스만 읽고 테이블은 아예 안 가도 된다. 디스크 I/O가 크게 줄어든다.

### 적용한 인덱스들

총 7개 인덱스를 생성했다. 이 중 2개는 커버링 인덱스, 나머지 5개는 조인/필터 성능 개선용이다.

**커버링 인덱스 (Index Only Scan)**

```sql
-- A테이블: ROW_NUMBER + PIVOT에 필요한 컬럼 전부 포함
CREATE INDEX IDX_A_COV ON A테이블 (
    key,          -- WHERE IN + PARTITION BY
    type,         -- PARTITION BY + WHERE
    category,     -- WHERE 필터
    del_flag,     -- WHERE 필터
    dt,           -- ORDER BY
    id,           -- ORDER BY (타이브레이킹) + SELECT
    loc_1,        -- SELECT
    loc_2,        -- SELECT
    appr_key      -- SELECT (결재테이블 JOIN용)
);

-- B테이블: 점검 이력 조회용
CREATE INDEX IDX_B_COV ON B테이블 (
    key,          -- WHERE
    type,         -- WHERE 필터 (구분)
    dt,           -- ORDER BY
    id            -- SELECT
);
```

핵심은 **인덱스 컬럼 순서**다.

1. **선두 컬럼**: WHERE/JOIN 조건에 쓰이는 컬럼 (등치 조건이 먼저)
2. **중간 컬럼**: PARTITION BY, 추가 필터 조건
3. **정렬 컬럼**: ORDER BY에 쓰이는 컬럼
4. **후미 컬럼**: SELECT에서만 읽는 컬럼 (커버링 목적)

이 순서를 지켜야 인덱스 스캔 범위가 최소화된다. 선두 컬럼이 WHERE 조건과 일치해야 인덱스 범위 스캔(Index Range Scan)이 가능하기 때문이다.

**조인/필터용 복합 인덱스**

```sql
-- C테이블: 조인 + 필터
CREATE INDEX IDX_C ON C테이블 (key, doc_type);

-- D테이블: 조인
CREATE INDEX IDX_D ON D테이블 (loc_1, loc_2);

-- E테이블: FK 조인
CREATE INDEX IDX_E ON E테이블 (appr_key);

-- F테이블: 조인 + 결재완료일
CREATE INDEX IDX_F ON F테이블 (ref_id, completed_dt);

-- G테이블: 상태 필터 + 날짜
CREATE INDEX IDX_G ON G테이블 (status, start_dt);
```

이 인덱스들은 커버링까지는 아니지만, JOIN이나 WHERE 조건에서 Full Table Scan을 방지한다.

다만 커버링 인덱스는 컬럼이 많아지는 만큼 INSERT/UPDATE/DELETE 시 인덱스 유지 비용이 늘어난다. 이 화면은 조회 전용 대시보드라 DML이 거의 없어서 적합했지만, 쓰기가 빈번한 테이블이라면 신중하게 판단해야 한다.

---

## 최종 결과

| 단계 | 개선 내용 | 실행시간 |
| --- | --- | --- |
| 원본 | 스칼라 서브쿼리 방식 | **30초 이상** |
| 1차 | CTE + LEFT JOIN 구조로 변경 | **10초 이내** |
| 2차 | ROW_NUMBER + PIVOT으로 테이블 스캔 15→1회 | **6~8초** |
| 3차 | 커버링 인덱스로 테이블 액세스 제거 | **5~6초** |

---

## 배운 것들

- **스칼라 서브쿼리는 행마다 실행된다.** Java의 N+1과 같은 원리다. 쿼리 안에 서브쿼리가 있으면 가장 먼저 의심해볼 것.
- **CTE로 선집계 후 JOIN하면 테이블 접근 횟수가 급감한다.** 300회 → 11회. 구조만 바꿔도 이 정도 차이가 난다.
- **ROW_NUMBER + PIVOT 패턴은 같은 테이블에서 여러 종류의 값을 뽑을 때 강력하다.** 1회 스캔으로 모든 종류를 동시에 처리한다.
- **커버링 인덱스는 "테이블을 아예 안 읽게" 만든다.** WHERE/ORDER BY뿐 아니라 SELECT 절의 컬럼까지 인덱스에 넣으면 Index Only Scan이 가능해진다.
- **페이징은 가장 먼저 적용해야 한다.** 기준 CTE에서 20건만 걸러놓으면, 이후 CTE들은 20건만 처리하면 된다.

