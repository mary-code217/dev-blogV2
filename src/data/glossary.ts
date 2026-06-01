export interface GlossaryTerm {
	term: string;
	description: string;
	category: string;
}

// 용어를 여기에 한 줄씩 추가하세요. (가나다/알파벳 정렬은 페이지에서 자동 처리)
export const glossary: GlossaryTerm[] = [
	{
		term: 'RSS',
		category: 'Web',
		description:
			'Really Simple Syndication. 사이트의 새 글 목록을 정해진 XML 형식으로 제공해, 독자가 RSS 리더로 구독할 수 있게 하는 표준 포맷.',
	},
	{
		term: '구글 애널리틱스',
		category: 'Web',
		description:
			'방문자가 어떤 페이지를 얼마나 보는지 등 사이트 이용 통계를 수집·분석해 주는 구글의 무료 서비스. 측정 ID를 페이지에 심어 데이터를 보낸다.',
	},
	{
		term: 'Pagefind',
		category: 'Web',
		description:
			'정적 사이트용 클라이언트 검색 라이브러리. 빌드 시 본문을 색인해, 서버 없이 브라우저에서 전문(full-text) 검색을 제공한다.',
	},
	{
		term: 'Astro',
		category: 'Frontend',
		description:
			'콘텐츠 중심 웹사이트를 위한 프레임워크. 기본적으로 JS를 거의 보내지 않는 정적 HTML을 생성해 빠른 페이지를 만든다.',
	},
	{
		term: '정적 사이트',
		category: 'Web',
		description:
			'미리 생성해 둔 HTML 파일을 그대로 제공하는 사이트. 서버 연산이나 DB 없이 동작해 빠르고 배포가 간단하다.',
	},
];
