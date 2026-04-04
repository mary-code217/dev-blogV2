# 구현 체크리스트

## Phase 1: 프로젝트 초기 설정

- [x] Astro 프로젝트 정리 (기본 템플릿 예시 파일 제거)
- [x] CLAUDE.md 프로젝트에 반영 확인
- [x] TypeScript 설정 확인
- [x] 폰트 설정 (Pretendard CDN, JetBrains Mono)
- [x] CSS 변수 / 디자인 토큰 정의 (`global.css`)
- [x] 다크/라이트 모드 기본 구조 (`data-theme` 속성, localStorage)
- [x] 콘텐츠 컬렉션 스키마 정의 (`content.config.ts` — title, description, date, category, tags, draft)

## Phase 2: 레이아웃 & 네비게이션

- [x] BaseLayout 구현 (2컬럼 그리드: 사이드바 + 콘텐츠)
- [x] 사이드바 컴포넌트 (타이틀, 메뉴, 다크모드 토글)
- [x] 모바일 헤더 (900px 미만에서 사이드바 → 상단 헤더 전환)
- [x] 현재 페이지 메뉴 하이라이팅
- [x] 반응형 테스트 (데스크톱/태블릿/모바일)

## Phase 3: 홈 페이지

- [x] 홈 페이지 (`/`) 구현
- [x] 최신 글 6개 카드 목록
- [x] 글 카드 컴포넌트 (제목, 설명, 날짜, 카테고리)
- [x] "전체 글 보기" 버튼 → `/blog/` 이동

## Phase 4: 글 목록 페이지

- [x] 글 목록 페이지 (`/blog/`) 구현
- [x] 전체 글 목록 (최신순 정렬)
- [x] 카테고리 필터 (탭/버튼)
- [x] 태그 필터
- [x] 카테고리 + 태그 조합 필터
- [x] "더보기" 버튼 페이지네이션 (10개씩 추가 로드)
- [x] 글 없을 때 빈 상태 표시

## Phase 5: 글 상세 페이지

- [x] 글 상세 페이지 (`/blog/{slug}/`) 구현
- [x] 글 헤더 (제목, 날짜, 카테고리, 태그)
- [x] Markdown → HTML 렌더링
- [x] 코드 블록 Syntax Highlighting (Shiki: github-light / github-dark)
- [x] 코드 블록 복사 버튼 + 언어 표시
- [x] 목차 (TOC) — 데스크톱: 우측 플로팅, 모바일: 상단 접이식
- [x] 스크롤 스파이 (현재 섹션 하이라이팅)
- [x] 이전 글 / 다음 글 네비게이션

## Phase 6: 검색

- [x] Pagefind 설치 및 설정
- [x] 빌드 시 검색 인덱스 생성
- [x] 검색 UI (글 목록 페이지 상단)
- [x] 실시간 필터링 (디바운스)
- [x] 검색 결과 하이라이팅

## Phase 7: SEO & 피드

- [x] BaseHead 컴포넌트 (메타 태그, OG 태그)
- [x] 사이트맵 설정 (`@astrojs/sitemap`)
- [x] RSS 피드 (`/rss.xml`)
- [x] canonical URL 설정
- [x] HTML lang="ko" 설정

## Phase 8: 배포

- [x] GitHub 저장소 생성
- [x] GitHub Actions 워크플로우 작성 (빌드 → GitHub Pages 배포)
- [ ] `astro.config.mjs` 사이트 URL 설정 (배포 후 실제 URL로 변경)
- [ ] 배포 테스트
- [ ] 커스텀 도메인 설정 (선택)

## Phase 9: 마무리

- [ ] 샘플 글 작성 (1~2개)
- [ ] 라이트/다크 모드 전체 페이지 점검
- [ ] 모바일 반응형 전체 점검
- [ ] Lighthouse 성능 체크
- [ ] 설계 문서 최종 업데이트
