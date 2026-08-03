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
	{
		term: '백분위',
		category: 'Observability',
		description:
			'Percentile. 측정값을 빠른 순서로 정렬했을 때 특정 위치에 오는 값. 요청 1,000건의 p99는 990번째 요청의 응답 시간이고, "요청의 99%가 이 값 이내"라는 뜻이다. 평균이 소수의 느린 요청을 희석해 감추는 것과 달리 느림이 얼마나 흔한지를 드러낸다. 표본이 적거나 느린 요청이 경계에 몰려 있으면 한두 건 차이로 크게 튀므로 알람 기준으로 쓸 때 주의가 필요하다.',
	},
	{
		term: '꼬리 지연',
		category: 'Observability',
		description:
			'Tail Latency. 응답 시간 분포에서 가장 느린 쪽 끝(꼬리)에 해당하는 소수 요청의 지연. p99·p99.9로 관측하며 GC 정지, 커넥션 대기, 캐시 미스 등이 원인이 된다. 요청 하나가 내부 서비스 여러 개를 호출하는 구조에서는 각 호출의 꼬리가 겹치면서 사용자 체감 지연으로 증폭된다.',
	},
	{
		term: 'SLO',
		category: 'Observability',
		description:
			'Service Level Objective. 서비스가 지키기로 정한 목표치(예: "p95 응답 시간 300ms 이내"). 목표를 재는 데 쓰는 실측 지표는 SLI(Service Level Indicator)라 부르고, 목표에서 허용되는 실패분은 에러 버짓이라 한다. 고객과 맺는 계약인 SLA와 달리 내부 기준이라 더 엄격하게 잡는 것이 보통이다.',
	},
	{
		term: 'TTL',
		category: 'Backend',
		description:
			'Time To Live. 키가 자동으로 삭제되기까지 남은 시간(초)을 뜻한다. Redis에서 TTL이 지나면 값이 사라지고, TTL이 없는 키를 조회하면 -1, 키 자체가 없으면 -2가 반환된다.',
	},
	{
		term: '캡드 리스트',
		category: 'Backend',
		description:
			'Capped List. LTRIM으로 항상 최근 N개만 남도록 잘라내는 Redis List 활용 패턴. 알림 목록처럼 전체 이력이 아니라 최근 것 몇 개만 보여주면 되는 데이터에 쓴다.',
	},
	{
		term: 'RDB/AOF',
		category: 'Backend',
		description:
			'Redis Database / Append Only File. Redis가 메모리 데이터를 디스크에 남기는 두 가지 영속성 방식. RDB는 특정 시점의 스냅숏을 통째로 저장하고, AOF는 실행된 쓰기 명령을 순서대로 기록해 재실행한다. 둘 다 켜지 않으면 재시작 시 데이터가 전부 유실된다.',
	},
	{
		term: 'CGLIB 프록시',
		category: 'Backend',
		description:
			'Code Generation Library Proxy. 스프링이 @Cacheable 같은 AOP 기능을 적용하기 위해 대상 클래스를 상속해서 만드는 대리 객체. Objenesis로 생성자를 거치지 않고 만들어지므로, 이 프록시의 필드에 직접 접근하면 초기화되지 않은 값(null)을 읽게 된다. AOP가 걸린 빈은 상태를 항상 getter로 노출해야 하는 이유다.',
	},
	{
		term: 'Fixed Window Counter',
		category: 'Backend',
		description:
			'정해진 시간 창(윈도우) 안에서 요청 횟수를 세는 레이트리밋 방식. INCR로 카운트를 올리고 그 카운트가 1이 되는 순간(윈도우의 첫 요청)에만 TTL을 걸어 구현한다. INCR와 EXPIRE가 원자적으로 묶여 있지 않으면, 그 사이 프로세스가 죽었을 때 TTL 없는 카운터가 영영 안 풀릴 수 있다.',
	},
	{
		term: 'EVALSHA',
		category: 'Backend',
		description:
			'Redis에 미리 캐싱된 Lua 스크립트를 SHA1 해시로 실행하는 명령어. 스크립트를 한 번 EVAL로 실행하면 Redis가 스크립트 본문을 해시로 캐싱해 두고, 이후 호출부터는 본문 재전송 없이 이 해시만으로 실행을 요청한다.',
	},
	{
		term: '분산락',
		category: 'Backend',
		description:
			'Distributed Lock. 여러 서버(프로세스)가 공유하는 락. 자바 인메모리 락은 서버 한 대 안에서만 유효하므로, 서버를 여러 대로 스케일아웃하면 Redis 같은 공유 저장소 기반의 락이 필요해진다.',
	},
	{
		term: 'RLock',
		category: 'Backend',
		description:
			'Redisson이 제공하는 분산락 객체. lock()/unlock()으로 락을 잡고 풀며, 재진입과 워치독 자동 연장을 함께 지원한다.',
	},
	{
		term: '재진입(락)',
		category: 'Backend',
		description:
			'Reentrant Lock. 같은 스레드가 이미 잡고 있는 락을 다시 요청해도 즉시 성공하는 성질. Redisson의 RLock은 재진입을 지원해 같은 락을 두 번 lock()해도 통과하지만, hold count가 2가 되므로 unlock()도 정확히 두 번 해야 완전히 풀린다.',
	},
	{
		term: '워치독',
		category: 'Backend',
		description:
			'Watchdog. Redisson이 락을 자동 연장해 주는 백그라운드 메커니즘. leaseTime을 지정하지 않고 락을 걸면, 락을 쥔 스레드가 살아있는 동안 내부적으로 TTL을 계속 갱신해 락이 중간에 풀리지 않는다. 스레드가 죽으면 갱신이 멈춰 결국 TTL대로 풀린다.',
	},
	{
		term: 'HyperLogLog',
		category: 'Backend',
		description:
			'개별 원소를 저장하지 않고 서로 다른 원소의 개수(카디널리티)만 아주 작은 고정 메모리(약 12KB)로 근사 추정하는 확률적 자료구조. 해시값 비트 패턴에서 선행 0이 연속된 길이를 여러 그룹(레지스터)에 나눠 기록해 두고, 그 값들을 조합해 개수를 역산한다. Redis에서는 PFADD/PFCOUNT/PFMERGE 명령어로 쓴다.',
	},
	{
		term: 'PFADD',
		category: 'Backend',
		description:
			'HyperLogLog에 원소를 추가하는 Redis 명령어. 원소를 해시해 어느 레지스터에 속하는지 계산하고, 그 레지스터에 이미 기록된 값보다 클 때만 갱신한다. 같은 원소를 몇 번을 추가해도 항상 같은 레지스터의 같은 값이 나올 뿐이라 카운트가 늘지 않는 멱등적 명령이다.',
	},
	{
		term: 'PFCOUNT',
		category: 'Backend',
		description:
			'HyperLogLog가 추정한 카디널리티를 조회하는 Redis 명령어. 개별 원소를 저장하지 않고 근사 추정하는 구조라 정확한 값이 아니며, Redis 구현 기준 표준 오차는 약 0.81%다.',
	},
	{
		term: 'PFMERGE',
		category: 'Backend',
		description:
			'여러 HyperLogLog 키를 하나로 합치는 Redis 명령어. 합친 결과의 PFCOUNT는 원본 키들의 개수를 단순히 더한 값이 아니라, 겹치는 원소를 한 번만 세는 합집합 기준 유니크 개수를 근사한다.',
	},
	{
		term: 'Count-Min Sketch',
		category: 'Backend',
		description:
			'HyperLogLog와 같은 확률적 자료구조 계열이지만, 카디널리티가 아니라 원소별 등장 빈도를 근사하는 데 쓰인다. Redis 코어에는 없고 RedisBloom 모듈의 CMS.INCRBY 등으로 제공된다.',
	},
	{
		term: 'Lettuce',
		category: 'Backend',
		description:
			'Spring Data Redis가 기본으로 쓰는 Redis 클라이언트. Netty 기반이라 커넥션 하나로 여러 요청을 동시에 처리(멀티플렉싱)할 수 있어, JDBC처럼 요청마다 커넥션을 물고 있을 필요가 없다.',
	},
];
