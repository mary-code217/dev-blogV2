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
	{
		term: 'SKIP LOCKED',
		category: 'Database',
		description:
			'SELECT ... FOR UPDATE SKIP LOCKED. 다른 트랜잭션이 잠가 둔 행은 건너뛰고 잠기지 않은 행만 가져오는 잠금 옵션(MySQL 8.0+, PostgreSQL 등 지원). 같은 자원을 두고 대기(블로킹)하지 않아 작업을 여러 워커에 나눠 처리할 때 유리하다.',
	},
	{
		term: '데드락',
		category: 'Database',
		description:
			'Deadlock. 두 트랜잭션이 서로가 쥔 잠금이 풀리길 기다리며 둘 다 멈추는 상황. DB는 보통 한쪽 트랜잭션을 강제 종료(rollback)해 교착을 푼다.',
	},
	{
		term: '갭 락',
		category: 'Database',
		description:
			'Gap Lock. InnoDB가 인덱스 레코드 사이의 빈 구간을 잠그는 잠금. 기본 격리 수준(REPEATABLE READ)에서 넥스트키 락의 일부로 팬텀 리드를 막지만, READ COMMITTED에서는 거의 쓰이지 않는다. 의도치 않은 락 충돌·데드락의 원인이 되기도 한다.',
	},
	{
		term: 'ACID',
		category: 'Database',
		description:
			'트랜잭션이 보장해야 할 네 가지 성질: 원자성(Atomicity), 일관성(Consistency), 고립성(Isolation), 지속성(Durability).',
	},
	{
		term: 'READ COMMITTED',
		category: 'Database',
		description:
			'트랜잭션 격리 수준의 하나로, 커밋된 데이터만 읽는다. MySQL 기본값(REPEATABLE READ)보다 락을 덜 잡아 동시성이 높지만, 같은 쿼리가 매번 다른 결과를 볼 수 있다(비반복 읽기).',
	},
	{
		term: 'InnoDB',
		category: 'Database',
		description:
			'MySQL의 기본 스토리지 엔진. 행 단위 잠금, 트랜잭션(ACID), 외래 키, 클러스터드 인덱스를 지원한다.',
	},
	{
		term: '클러스터드 인덱스',
		category: 'Database',
		description:
			'Clustered Index. 테이블 데이터 자체가 기본 키 순서로 정렬·저장되는 구조. MySQL InnoDB에서는 기본 키가 곧 클러스터드 인덱스이며, 보조 인덱스는 이를 거쳐 실제 행을 찾는다.',
	},
	{
		term: 'Shadow Mode',
		category: 'Backend',
		description:
			'섀도 모드. 새 시스템을 실제 트래픽에 결과는 반영하지 않고 병렬로만 실행해, 기존 시스템과 결과를 비교·검증하는 배포 기법.',
	},
	{
		term: 'Thundering Herd',
		category: 'Backend',
		description:
			'천둥 떼 현상. 대기하던 다수의 요청·프로세스가 동시에 깨어나 같은 자원으로 몰려 백엔드가 폭주하는 문제. 캐시 동시 만료(cache stampede)가 대표 사례다.',
	},
	{
		term: '라운드트립',
		category: 'Backend',
		description:
			'Round-trip. 클라이언트와 서버 간 왕복 통신 1회. 횟수가 많을수록 네트워크 지연이 누적되므로 줄이는 것이 성능에 유리하다.',
	},
	{
		term: 'APM',
		category: 'Observability',
		description:
			'Application Performance Monitoring. 애플리케이션의 응답 시간, 처리량, 오류율, 트랜잭션 흐름 등을 추적해 성능 문제와 병목을 진단하는 모니터링. 코드 레벨까지 들여다봐 느린 쿼리·외부 호출 등을 짚어낸다.',
	},
	{
		term: '카디널리티',
		category: 'Observability',
		description:
			'Cardinality. 메트릭에서 라벨(태그) 값이 가질 수 있는 고유 조합의 수. 사용자 ID·요청 경로처럼 값 종류가 많은 라벨을 붙이면 시계열이 폭증(cardinality explosion)해 Prometheus 같은 시계열 DB의 메모리·저장 부하가 급증한다.',
	},
	{
		term: '메트릭',
		category: 'Observability',
		description:
			'Metric. 시스템 상태를 시간에 따라 수치로 측정한 시계열 데이터(요청 수, 응답 시간, CPU 사용률 등). 라벨로 차원을 나눠 집계·필터하며, 카운터·게이지·히스토그램 같은 타입으로 표현한다. 로그·트레이스와 함께 관측성의 세 기둥을 이룬다.',
	},
];
