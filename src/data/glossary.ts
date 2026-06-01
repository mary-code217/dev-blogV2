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
		term: '스레드 큐잉',
		category: 'Backend',
		description:
			'처리할 스레드가 부족해 작업이나 스레드가 대기열에 줄 서서 기다리는 상태. 스레드 풀의 작업 큐가 쌓이면 응답 지연으로 이어지고, 락을 못 잡은 스레드는 대기 큐에서 차례를 기다린다.',
	},
];
