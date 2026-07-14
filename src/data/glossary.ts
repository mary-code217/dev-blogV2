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
		term: 'OSIV',
		category: 'Backend',
		description:
			'Open Session In View. HTTP 요청이 시작될 때 연 영속성 컨텍스트를, 트랜잭션이 끝난 뒤에도 응답이 완료될 때까지(REST는 응답 반환, MVC는 뷰 렌더링까지) 유지하는 설정. 덕분에 트랜잭션 밖에서도 지연 로딩이 가능해 LazyInitializationException을 피하지만, DB 커넥션을 요청 내내 붙잡고 있어 트래픽이 몰리면 커넥션 풀 고갈로 이어진다. Spring Boot 기본값은 켜짐(spring.jpa.open-in-view=true)이라 시작 시 경고 로그를 남기며, 끄면(false) 커넥션은 @Transactional 메서드가 끝나는 즉시 반환된다.',
	},
	{
		term: '백프레셔',
		category: 'Backend',
		description:
			'Backpressure. 리액티브 스트림에서 구독자(Subscriber)가 감당할 수 있는 만큼만 request(n)로 수요를 신호하고, 발행자(Publisher)는 그 수요를 넘겨 데이터를 밀어내지 않도록 하는 흐름 제어. push가 아닌 수요(demand) 기반으로 동작해, 비동기 경계 사이 큐를 유한하게 유지하고 무한정 버퍼링을 막는다. 생산자가 소비자보다 빠를 때 시스템이 무너지는 것을 방지하는 Reactive Streams 표준(Project Reactor·RxJava·Spring WebFlux 등)의 핵심 개념이다.',
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
	{
		term: 'RAG',
		category: 'RAG',
		description:
			'Retrieval-Augmented Generation. LLM이 답하기 전, 외부 지식베이스에서 관련 문서를 검색해 프롬프트에 함께 넣어 생성하는 기법. 모델 재학습 없이 최신·사내 정보를 반영하고 환각을 줄인다.',
	},
	{
		term: '임베딩',
		category: 'RAG',
		description:
			'Embedding. 텍스트를 의미가 가까울수록 벡터 공간에서 가깝게 배치되도록 변환한 고정 차원 실수 벡터(차원 수는 모델마다 다르며 흔히 768·1536 등). 의미 기반 유사도 검색의 토대.',
	},
	{
		term: '벡터 스토어',
		category: 'RAG',
		description:
			'Vector Store. 임베딩 벡터를 저장하고 유사도 검색을 지원하는 저장소. PostgreSQL의 pgvector 확장이 대표적이며, Spring AI는 VectorStore 인터페이스로 구현체(인메모리·pgvector 등)를 추상화한다.',
	},
	{
		term: '청킹',
		category: 'RAG',
		description:
			'Chunking. 긴 문서를 임베딩·검색에 적합한 작은 조각(청크)으로 분할하는 과정. 청크가 작으면 검색은 정확하나 맥락이 부족하고, 크면 그 반대라 크기·오버랩 조정이 품질을 좌우한다.',
	},
	{
		term: '인제스트',
		category: 'RAG',
		description:
			'Ingestion. 원문서를 읽어(Extract) → 청킹·메타데이터 강화(Transform) → 임베딩 후 벡터 스토어에 적재(Load)하는 ETL 파이프라인. RAG의 "검색 재료"를 만드는 단계.',
	},
	{
		term: '코사인 유사도',
		category: 'RAG',
		description:
			'Cosine Similarity. 두 벡터가 이루는 각도의 코사인으로 방향 유사도를 재는 척도. 값 범위는 −1~1이다(1=같은 방향, 0=직교/무관, −1=정반대). 임베딩 검색에서는 보통 양수 영역에 분포하며, 코사인 거리(=1−유사도)의 보수로 쓰인다.',
	},
	{
		term: 'HNSW',
		category: 'RAG',
		description:
			'Hierarchical Navigable Small World. 고차원 벡터의 근사 최근접 이웃(ANN)을 빠르게 찾는 그래프 기반 인덱스. 다층 그래프 위에서 탐욕 탐색으로 후보를 좁히며, pgvector가 지원하고 정확도·속도 균형이 좋다.',
	},
	{
		term: 'Top-K',
		category: 'RAG',
		description:
			'검색 시 유사도 상위 K개 청크만 반환하는 파라미터(topK). 보통 임계값(similarityThreshold) 미만 점수는 버린다. 1차로 넓게 검색한 뒤 Reranker로 좁히는 2단계 전략에 쓰인다.',
	},
	{
		term: 'RRF',
		category: 'RAG',
		description:
			'Reciprocal Rank Fusion. 점수 스케일이 다른 여러 검색 결과를 절대 점수 대신 순위만으로 1/(k+rank) 합산해 병합하는 알고리즘(rank는 1부터). Hybrid Search 결과 결합에 표준적으로 쓰이며 보통 k=60.',
	},
	{
		term: 'HyDE',
		category: 'RAG',
		description:
			'Hypothetical Document Embeddings. 질문을 그대로 임베딩하지 않고 LLM이 가상의 답변을 먼저 생성한 뒤 그 답변을 임베딩해 검색하는 기법. 질문과 문서가 임베딩 공간에서 잘 정렬되지 않는 형식 불일치(query-document 비대칭)를 완화한다.',
	},
	{
		term: 'Reranker',
		category: 'RAG',
		description:
			'1차 검색으로 넓게 가져온 후보를 "이 청크가 질문에 실제로 답할 수 있는가" 기준으로 LLM(또는 cross-encoder 전용 모델)이 다시 채점해 재정렬하는 후처리. 벡터 유사도만으로 놓치는 정답을 상위로 끌어올린다.',
	},
	{
		term: 'Semantic Cache',
		category: 'RAG',
		description:
			'과거 질문의 임베딩과 비교해 유사도가 임계값(예: 0.95) 이상이면 캐시된 답변을 재사용하는 캐시. 표현만 다른 반복 질문에 LLM 호출 0회로 응답한다. 임계값이 낮으면 의미가 다른 질문에 잘못 응답하는 false hit가, 높으면 캐시 미스가 늘어 임계값 튜닝이 관건이다.',
	},
];
