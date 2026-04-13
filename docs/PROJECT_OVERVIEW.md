# 프로젝트 개요

## 1. 소개

| 항목 | 내용 |
|---|---|
| 프로젝트명 | **MaryDev** |
| 목적 | Markdown/HTML 기반 개인 기술 블로그 |
| 유형 | 정적 사이트 (서버/DB 불필요) |
| 레퍼런스 | [astro-whono](https://astro.whono.me) |

## 2. 기술 스택

| 구분 | 기술 | 비고 |
|---|---|---|
| 프레임워크 | Astro 6 | 정적 사이트 생성기 (SSG) |
| 언어 | TypeScript | Astro 기본 지원 |
| 스타일 | CSS (커스텀) | 디자인 토큰 기반 |
| 검색 | Pagefind | 빌드 타임 인덱싱, 클라이언트 검색 |
| 호스팅 | GitHub Pages | 무료, HTTPS 기본 제공 |
| CI/CD | GitHub Actions | push → 빌드 → 배포 자동화 |
| 버전 관리 | Git + GitHub | 콘텐츠도 Git으로 관리 |

### 의존성

| 패키지 | 버전 | 용도 |
|---|---|---|
| `astro` | ^6.1.3 | 프레임워크 |
| `@astrojs/mdx` | ^5.0.3 | MDX 지원 |
| `@astrojs/rss` | ^4.0.18 | RSS 피드 생성 |
| `@astrojs/sitemap` | ^3.7.2 | 사이트맵 생성 |
| `pagefind` | ^1.4.0 | 검색 인덱싱 |
| `sharp` | ^0.34.3 | 이미지 최적화 |

- Node.js >= 22.12.0

## 3. 주요 기능

### 콘텐츠
- Markdown / HTML 글 작성
- 코드 하이라이팅 (Shiki)
- 이미지 삽입
- **블로그**: 개인 생각, 경험, 에세이 (주관적 글)
- **위키**: 공부 내용 정리, 레퍼런스 (학습 기록)

### 탐색
- 카테고리별 분류 및 정렬
- 클라이언트 사이드 검색 (Pagefind)
- 페이지네이션

### UI
- 다크/라이트 모드 토글
- 반응형 디자인 (모바일 대응)

### 배포
- RSS 피드 제공
- 사이트맵 자동 생성

## 4. 디자인 방향

- **스타일**: 미니멀, 콘텐츠 중심
- **레이아웃**: 2컬럼 (사이드바 네비게이션 + 콘텐츠 영역)
- **모바일**: 사이드바 → 상단 헤더로 전환
- **레퍼런스**: astro-whono의 깔끔한 레이아웃과 타이포그래피 참고

## 5. 페이지 구성

| 페이지 | 경로 | 설명 |
|---|---|---|
| 홈 | `/` | 최신 블로그 글 + 위키 글 목록 |
| 글 목록 | `/blog/` | 블로그 글 목록, 카테고리 필터, 검색, 페이지네이션 |
| 글 상세 | `/blog/{slug}/` | 블로그 글 Markdown 렌더링 |
| 위키 목록 | `/wiki/` | 위키 글 목록, 카테고리 필터, 검색, 페이지네이션 |
| 위키 상세 | `/wiki/{slug}/` | 위키 글 Markdown 렌더링 |

## 6. 콘텐츠 구조

### 디렉토리
```
src/content/
  ├── blog/              # 블로그 글 (생각, 경험, 에세이)
  │   ├── my-first-post.md
  │   └── ...
  └── wiki/              # 위키 글 (공부 정리, 레퍼런스)
      ├── spring-security-study-1.md
      └── ...
```

### Frontmatter 스키마
```yaml
---
title: "글 제목"              # 필수
description: "글 설명"        # 필수
date: 2026-04-03              # 필수, 발행일
category: "Development"       # 필수, 카테고리
tags: ["Astro", "Blog"]       # 선택, 태그 목록
draft: false                  # 선택, true면 빌드에서 제외
---
```

### 카테고리 (예시)
- Development (개발)
- DevOps (인프라/배포)
- TIL (Today I Learned)
- Retrospective (회고)

> 카테고리는 추후 필요에 따라 추가/변경 가능

## 7. 배포 방식

```
글 작성 (Markdown)
    ↓
Git commit & push
    ↓
GitHub Actions (자동 빌드)
    ↓
GitHub Pages (배포)
```

- **브랜치**: `main` 브랜치 push 시 자동 배포
- **빌드**: Astro 정적 빌드 → `dist/` 출력
- **호스팅**: GitHub Pages (`gh-pages` 브랜치 또는 Actions artifact)

## 8. 워크플로우

1. 사용자가 Claude에게 글 내용을 전달
2. Claude가 Markdown 파일 생성 (`src/content/blog/`)
3. Git commit & push
4. GitHub Actions가 자동 빌드 & 배포
5. GitHub Pages에서 즉시 반영

## 9. 프로젝트 구조

```
dev-blog-page/
├── docs/                    # 설계 문서
├── public/                  # 정적 자산 (favicon, 이미지)
├── src/
│   ├── components/          # 재사용 컴포넌트
│   ├── content/
│   │   ├── blog/            # 블로그 글 (Markdown)
│   │   └── wiki/            # 위키 글 (Markdown)
│   ├── layouts/             # 페이지 레이아웃
│   ├── pages/               # 라우팅 페이지
│   └── styles/              # 글로벌 스타일
├── astro.config.mjs         # Astro 설정
├── package.json
└── tsconfig.json
```
