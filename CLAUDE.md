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

## 문서 최신화

기능 구현, 수정, 삭제 등 변경사항 발생 시 관련 설계 문서(`docs/`)를 항상 최신 상태로 유지할 것.
