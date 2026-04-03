# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**MaryDev** — Markdown/HTML 기반 개인 기술 블로그 (정적 사이트)
- 프레임워크: Astro 6 (TypeScript)
- 호스팅: GitHub Pages
- 배포: GitHub Actions (자동 빌드 & 배포)
- 설계 문서: `docs/`
- 디자인 레퍼런스: [astro-whono](https://astro.whono.me)

## 빌드 및 실행 명령어

```bash
npm run dev       # 로컬 개발 서버
npm run build     # 프로덕션 빌드
npm run preview   # 빌드 결과 미리보기
```

## 프로젝트 구조

```
dev-blog-page/
├── docs/                    # 설계 문서
├── public/                  # 정적 자산 (favicon, 이미지)
├── src/
│   ├── components/          # 재사용 컴포넌트
│   ├── content/
│   │   └── blog/            # 블로그 글 (Markdown)
│   ├── layouts/             # 페이지 레이아웃
│   ├── pages/               # 라우팅 페이지
│   └── styles/              # 글로벌 스타일
├── astro.config.mjs         # Astro 설정
├── package.json
└── tsconfig.json
```

## 콘텐츠 작성 규칙

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

### 글 파일 위치
- `src/content/blog/` 하위에 Markdown 파일로 작성
- 파일명: kebab-case (예: `my-first-post.md`)

## 커밋 규칙

- 접두사: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- 한글로 간결하게, 기능 단위 즉시 커밋
- Co-Authored-By 등 AI 관련 메타데이터 포함 금지

## 설계 문서

구현 전 반드시 아래 문서를 읽고 시작할 것:
- `docs/PROJECT_OVERVIEW.md` — 프로젝트 개요, 기술 스택, 배포 방식
- `docs/FEATURE_SPEC.md` — 기능 상세 정의 (페이지별 동작, 검색, 카테고리, 다크모드 등)
- `docs/DESIGN_SYSTEM.md` — 디자인 토큰 (색상, 폰트, 레이아웃, 컴포넌트 스타일)
- `docs/IMPLEMENTATION_CHECKLIST.md` — 구현 체크리스트 (Phase 1~9)

## 디자인 레퍼런스

- 레퍼런스 프로젝트: `C:\Users\KTG\Desktop\astro-whono\`
- 데모: https://astro.whono.me
- 색상 토큰은 astro-whono와 동일하게 적용
- 레이아웃(2컬럼, 사이드바)도 astro-whono 참고
- 폰트만 다름: Pretendard (본문) + JetBrains Mono (코드)

## 구현 순서

`docs/IMPLEMENTATION_CHECKLIST.md`의 Phase 순서대로 진행:
1. 프로젝트 초기 설정 (디자인 토큰, 폰트, 콘텐츠 스키마)
2. 레이아웃 & 네비게이션 (2컬럼, 사이드바, 반응형)
3. 홈 페이지
4. 글 목록 페이지 (카테고리/태그 필터, 더보기 버튼)
5. 글 상세 페이지 (Markdown 렌더링, 코드 블록, 플로팅 목차)
6. 검색 (Pagefind)
7. SEO & RSS
8. GitHub Pages 배포
9. 마무리 & 점검

## 문서 최신화

기능 구현, 수정, 삭제 등 변경사항 발생 시 관련 설계 문서(`docs/`)를 항상 최신 상태로 유지할 것.
