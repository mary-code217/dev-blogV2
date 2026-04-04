---
title: "Astro로 블로그 만들기"
description: "Astro 프레임워크를 활용하여 정적 블로그를 구축하는 과정을 정리합니다."
date: 2026-04-01
category: "Development"
tags: ["Astro", "Blog"]
---

## 왜 Astro인가

Astro는 콘텐츠 중심 웹사이트를 위한 프레임워크입니다. 기본적으로 제로 자바스크립트를 출력하여 빠른 로딩 속도를 제공합니다.

### 주요 특징

- **Island Architecture**: 필요한 부분만 하이드레이션
- **콘텐츠 컬렉션**: 타입 안전한 Markdown 관리
- **다양한 프레임워크 지원**: React, Vue, Svelte 등

## 프로젝트 설정

새 프로젝트를 시작하려면 다음 명령어를 실행합니다:

```bash
npm create astro@latest my-blog
cd my-blog
npm run dev
```

### 설정 파일

`astro.config.mjs` 파일에서 기본 설정을 관리합니다:

```javascript
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://example.com',
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
```

## 콘텐츠 작성

Markdown 파일에 frontmatter를 작성하여 메타데이터를 정의합니다.

```yaml
---
title: "글 제목"
description: "글 설명"
date: 2026-04-01
category: "Development"
---
```

## 마무리

Astro를 활용하면 빠르고 가벼운 블로그를 쉽게 만들 수 있습니다.
