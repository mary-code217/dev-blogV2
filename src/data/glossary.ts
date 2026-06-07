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
			'Really Simple Syndication. 사이트의 새 글 목록을 XML 기반 피드로 제공해, 독자가 피드 리더로 구독할 수 있게 하는 형식. RSS는 0.9x·1.0·2.0 등 여러 버전이 있고, IETF가 표준화한 Atom(RFC 4287)과 함께 대표적인 웹 피드 포맷으로 쓰인다.',
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
			'천둥 떼 현상. 한 자원·이벤트를 대기하던 다수의 요청·프로세스가 동시에 깨어나 몰려들지만 실제로는 하나(소수)만 자원을 차지하고 나머지는 헛되이 깨어났다 다시 대기하며 자원을 낭비해 백엔드가 폭주하는 문제. 캐시가 동시에 만료돼 여러 요청이 한꺼번에 원본을 다시 조회하는 캐시 스탬피드(cache stampede)가 대표 사례다.',
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
			'Cardinality. 메트릭이 만들어내는 고유 시계열의 수, 즉 메트릭 이름과 라벨 값들의 고유 조합 수. 사용자 ID·요청 경로처럼 값 종류가 많은(라벨 자체의 카디널리티가 높은) 라벨을 붙이면 조합이 곱셈으로 불어나 시계열이 폭증(cardinality explosion)하고, Prometheus 같은 시계열 DB의 메모리·저장 부하가 급증한다.',
	},
	{
		term: '메트릭',
		category: 'Observability',
		description:
			'Metric. 시스템 상태를 시간에 따라 수치로 측정한 시계열 데이터(요청 수, 응답 시간, CPU 사용률 등). 라벨로 차원을 나눠 집계·필터하며, 카운터·게이지·히스토그램 같은 타입으로 표현한다. 로그·트레이스와 함께 관측성의 세 기둥을 이룬다.',
	},
	{
		term: '멱등성',
		category: 'Backend',
		description:
			'Idempotence. 같은 작업을 한 번 실행하든 여러 번 실행하든 결과(서버 상태)가 동일하게 유지되는 성질. HTTP에서 GET·PUT·DELETE는 멱등하지만 POST·PATCH는 그렇지 않다. 네트워크 재시도나 중복 요청에도 부작용이 없어, 결제·통계 배치·메시지 처리 설계에서 안전한 재실행을 보장하는 핵심 원칙이다.',
	},
	{
		term: 'CTE',
		category: 'Database',
		description:
			'Common Table Expression. WITH 절로 정의하는, 한 쿼리 안에서만 존재하는 임시 결과 집합. 복잡한 쿼리를 이름 붙인 단계로 쪼개 가독성을 높이고, WITH RECURSIVE로 트리·그래프 같은 계층 구조를 한 번에 조회한다. 재귀 CTE는 문법상 재귀지만 내부적으로는 반복(iterative)으로 평가된다.',
	},
	{
		term: 'EAV',
		category: 'Database',
		description:
			'Entity-Attribute-Value. 속성을 컬럼이 아닌 행(Row)에 (엔티티, 속성, 값) 형태로 저장하는 동적 설계 패턴. 스키마 변경 없이 속성을 자유롭게 추가할 수 있어 상품 스펙·설문처럼 속성이 가변적이고 희소한 데이터에 쓰이지만, 조회 시 조인·피벗이 많아 성능과 무결성 관리가 어렵다.',
	},
	{
		term: '폐쇄 테이블 모델',
		category: 'Database',
		description:
			'Closure Table. 트리의 모든 조상-자손 경로(자기 자신 포함)를 별도 테이블에 미리 저장해 두는 계층 구조 모델. parent_id 방식과 달리 서브트리·조상 조회를 조인 한 번으로 처리해 읽기 성능이 뛰어나지만, 관계 행 수가 늘어 저장 공간을 더 쓴다. Bill Karwin의 『SQL Antipatterns』에서 소개된 대표적 계층 설계 기법이다.',
	},
	{
		term: '역정규화',
		category: 'Database',
		description:
			'Denormalization. 읽기 성능을 위해 의도적으로 정규화를 일부 깨고 중복 데이터(미리 계산된 집계·복제 컬럼 등)를 허용하는 기법. 조인을 줄여 조회를 빠르게 하는 대신 저장 공간과 쓰기 비용이 늘고 데이터 정합성 관리 부담이 커진다. 통계·집계 테이블이나 대시보드처럼 읽기가 많은 환경에서 주로 쓰인다.',
	},
];
