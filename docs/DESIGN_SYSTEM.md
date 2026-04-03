# 디자인 시스템

## 1. 색상 토큰

### 라이트 모드 (기본)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--bg` | `#fffefc` | 배경색 |
| `--text` | `#292524` | 기본 텍스트 |
| `--muted` | `#57534e` | 보조 텍스트 (날짜, 설명 등) |
| `--faint` | `#a8a29e` | 약한 텍스트 (플레이스홀더 등) |
| `--border` | `#e7e5e4` | 테두리, 구분선 |
| `--accent` | `#b91c1c` | 강조색 (링크, 버튼, 활성 상태) |
| `--panel` | `#f2f2f0` | 패널/카드 배경 |

### 다크 모드

| 토큰 | 값 | 용도 |
|---|---|---|
| `--bg` | `#1a1a1a` | 배경색 |
| `--text` | `#e5e5e5` | 기본 텍스트 |
| `--muted` | `#a3a3a3` | 보조 텍스트 |
| `--faint` | `#737373` | 약한 텍스트 |
| `--border` | `#333333` | 테두리, 구분선 |
| `--accent` | `#f87171` | 강조색 |
| `--panel` | `#2a2a2a` | 패널/카드 배경 |

### 코드 블록

| 토큰 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--code-header-bg` | `#f2f2f0` | `#2a2a2a` | 코드 블록 헤더 배경 |
| `--code-content-bg` | `#fcfcfb` | `#222222` | 코드 블록 본문 배경 |
| `--code-border` | `#e6e6e4` | `#333333` | 코드 블록 테두리 |
| `--code-text` | `#333333` | `#e1e1e1` | 코드 텍스트 |

### CSS 변수 적용

```css
:root {
  color-scheme: light;
  --bg: #fffefc;
  --text: #292524;
  --muted: #57534e;
  --faint: #a8a29e;
  --border: #e7e5e4;
  --accent: #b91c1c;
  --panel: #f2f2f0;
  --code-header-bg: #f2f2f0;
  --code-content-bg: #fcfcfb;
  --code-border: #e6e6e4;
  --code-text: #333333;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #1a1a1a;
  --text: #e5e5e5;
  --muted: #a3a3a3;
  --faint: #737373;
  --border: #333333;
  --accent: #f87171;
  --panel: #2a2a2a;
  --code-header-bg: #2a2a2a;
  --code-content-bg: #222222;
  --code-border: #333333;
  --code-text: #e1e1e1;
}
```

---

## 2. 타이포그래피

### 폰트 패밀리

| 용도 | 폰트 | 비고 |
|---|---|---|
| 본문/UI | **Pretendard** | 한글 최적화 산세리프, CDN 제공 |
| 코드 | **JetBrains Mono** | 개발자용 모노스페이스, 리가처 지원 |
| 폴백 | system-ui, sans-serif | 폰트 로딩 실패 시 |

### 폰트 로딩

```html
<!-- Pretendard (CDN) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.min.css" />

<!-- JetBrains Mono (Google Fonts) -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" />
```

### 타입 스케일

| 요소 | 크기 | 굵기 | 행간 |
|---|---|---|---|
| `h1` | 32px (2rem) | 700 | 1.3 |
| `h2` | 24px (1.5rem) | 700 | 1.4 |
| `h3` | 20px (1.25rem) | 600 | 1.4 |
| `h4` | 18px (1.125rem) | 600 | 1.5 |
| 본문 | 16px (1rem) | 400 | 1.75 |
| 보조 텍스트 | 14px (0.875rem) | 400 | 1.5 |
| 코드 | 14px (0.875rem) | 400 | 1.6 |

### CSS 변수

```css
:root {
  --font-body: "Pretendard Variable", Pretendard, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
```

---

## 3. 레이아웃

### 전체 구조

```
┌─────────────────────────────────────────────┐
│                max-width: 1100px             │
├──────────┬───┬──────────────────────────────┤
│ Sidebar  │ │ │        Content               │
│ 320px    │ 1 │        max 900px             │
│ (sticky) │ p │                              │
│          │ x │                              │
│          │   │                              │
└──────────┴───┴──────────────────────────────┘
```

### 레이아웃 변수

| 토큰 | 값 | 용도 |
|---|---|---|
| `--max` | `900px` | 콘텐츠 최대 너비 |
| `--sidebar` | `320px` | 사이드바 너비 |
| `--pad-x` | `48px` | 좌우 패딩 |
| `--tap-min-h` | `44px` | 터치 타겟 최소 높이 |

### 그리드

```css
.shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: var(--sidebar) 1px 1fr;
  max-width: 1100px;
  margin: 0 auto;
}
```

### 브레이크포인트

| 구분 | 너비 | 레이아웃 |
|---|---|---|
| 데스크톱 | 900px 이상 | 2컬럼 (사이드바 + 콘텐츠) |
| 태블릿 | 641px ~ 899px | 단일 컬럼, 상단 헤더 |
| 모바일 | 640px 이하 | 단일 컬럼, 축소 패딩 |

### 반응형 변경사항

**태블릿/모바일 (900px 미만):**
- 사이드바 → 상단 헤더로 전환
- 그리드 → 단일 컬럼
- 패딩 축소

**모바일 (640px 이하):**
- 패딩 추가 축소
- 폰트 크기 미세 조정

---

## 4. 간격 시스템

| 토큰 | 값 | 용도 |
|---|---|---|
| `--space-xs` | `4px` | 아이콘 간격 등 |
| `--space-sm` | `8px` | 태그 간격, 인라인 요소 |
| `--space-md` | `16px` | 카드 내부 패딩, 요소 간 간격 |
| `--space-lg` | `24px` | 섹션 간 간격 |
| `--space-xl` | `48px` | 페이지 패딩, 큰 섹션 구분 |

---

## 5. 컴포넌트 스타일

### 글 카드

```
┌──────────────────────────────────────┐
│ 카테고리                    2026.04.03│
│                                      │
│ 글 제목 (h3, 700)                    │
│ 글 설명 텍스트 (muted, 1-2줄)       │
│                                      │
│ [태그1] [태그2]                      │
└──────────────────────────────────────┘
```

- 배경: 투명 (hover 시 `--panel`)
- 테두리: 하단 `--border` 1px
- 패딩: `12px 14px`

### 태그

- 배경: `--panel`
- 텍스트: `--muted`
- 패딩: `2px 8px`
- 보더 라디우스: `4px`
- 폰트 크기: `0.8rem`
- hover: `--accent` 텍스트 색상

### 버튼 (더보기, 필터 등)

- 기본: 투명 배경, `--border` 테두리
- hover: `--panel` 배경
- 활성: `--accent` 배경, 흰색 텍스트
- 보더 라디우스: `6px`
- 최소 높이: `44px` (터치 타겟)

### 검색 입력

- 배경: `--bg`
- 테두리: `--border` 1px
- 포커스: `--accent` 테두리
- 패딩: `10px 16px`
- 보더 라디우스: `6px`
- 너비: 100%

### 코드 블록

```
┌─ 언어 표시 ──────────────── [복사] ─┐
│ header (--code-header-bg)           │
├─────────────────────────────────────┤
│                                     │
│ 코드 내용 (--code-content-bg)       │
│                                     │
└─────────────────────────────────────┘
```

- Shiki 테마: `github-light` (라이트) / `github-dark` (다크)
- 보더 라디우스: `8px`
- 테두리: `--code-border` 1px

### 목차 (TOC)

**데스크톱 (플로팅):**
- 위치: 콘텐츠 우측 고정
- 너비: `200px`
- 폰트 크기: `0.8rem`
- 현재 섹션: `--accent` 색상 + 좌측 보더
- 스크롤 스파이 연동

**모바일 (접이식):**
- 글 상단에 접이식 패널
- 기본 접힌 상태
- 클릭 시 펼침

### 네비게이션 링크

- 기본: `--text` 색상
- hover: `--accent` 색상
- 활성 (현재 페이지): `--accent` 색상, 굵게
- 언더라인: hover 시만 표시

---

## 6. 애니메이션

| 대상 | 속성 | 지속 시간 | 이징 |
|---|---|---|---|
| 링크/버튼 hover | color, background | 0.2s | ease |
| 다크모드 전환 | background, color | 0.3s | ease |
| 코드 복사 피드백 | opacity | 0.15s | ease-in-out |
| 스무스 스크롤 (목차) | scroll-behavior | smooth | - |

> `prefers-reduced-motion` 설정 시 모든 애니메이션 비활성화
