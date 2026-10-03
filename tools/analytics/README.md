# MaryDev 개인 방문 통계

기존 GA4 데이터를 내 PC에서 조회합니다. 블로그의 Astro 라우트와 별도로 실행하며 GitHub Pages의 `dist/`에 포함되지 않습니다.

```powershell
npm run analytics
```

브라우저에서 `http://127.0.0.1:4322`를 엽니다. Node.js 22 이상이면 별도 패키지 설치 없이 실행할 수 있습니다. 종료는 터미널에서 Ctrl+C입니다.

## GA 연결

속성 ID `534866872`는 로컬 설정에 저장했습니다. 다른 PC에서는 연결 화면에서 숫자 ID를 입력합니다. 블로그 측정 ID는 `G-GBDJN2XP74`입니다.

1. Google Cloud 프로젝트에서 [Google Analytics Data API](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com)를 활성화합니다. 자동 속성 찾기를 사용할 때만 [Admin API](https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com)도 필요합니다.
2. [서비스 계정](https://console.cloud.google.com/iam-admin/serviceaccounts)을 만듭니다. Cloud 프로젝트 역할은 필요하지 않습니다. 서비스 계정의 **키 → 키 추가 → 새 키 만들기 → JSON**으로 인증 파일을 내려받습니다.
3. GA의 **관리 → 속성 액세스 관리**에서 서비스 계정 이메일을 **뷰어**로 추가합니다.
4. 대시보드의 **GA 연결 설정**에서 JSON 파일을 선택하고 **저장하고 연결**을 누릅니다. 키를 채팅에 보내거나 Git에 추가하지 않습니다.

키와 설정은 Git 추적에서 제외한 `.analytics-local/`에 저장합니다. API는 `analytics.readonly` 범위로만 요청합니다. Google 조직 정책이 서비스 계정 키 발급을 막으면 기존 Application Default Credentials를 사용할 수 있습니다.

인증 파일 탐색 순서는 `GOOGLE_APPLICATION_CREDENTIALS`, `.analytics-local/credentials.json`, Windows의 `%APPDATA%/gcloud/application_default_credentials.json`입니다. 지원하는 JSON 종류는 `service_account`와 `authorized_user`입니다. 기존 ADC에는 `analytics.readonly` scope가 필요합니다.

선택적으로 `GA_PROPERTY_ID`와 `ANALYTICS_PORT` 환경변수로 속성과 포트를 지정할 수 있습니다. 속성 ID를 비우면 Admin API에서 접근 가능한 속성의 측정 ID를 비교해 MaryDev 속성을 찾습니다. 서비스 계정의 접근 범위에 따라 자동 찾기가 실패할 수 있으므로 숫자 ID 입력을 권합니다.

## 통계 기준

- 기간: 한국 날짜 기준으로 어제까지 최근 7·30·90일, 직전 같은 길이의 기간과 비교
- 전체 요약: 사이트 전체 조회수, 활성 사용자, 세션, 참여율
- 일별 그래프: 조회수와 비어 있는 날짜의 0 표시
- 글 목록: `/blog/`, `/wiki/`, `/ai/`의 상세 글만 표시, 현재 발행된 Markdown·MDX 제목·카테고리로 URL을 연결
- 검색·필터·정렬: 글 제목·카테고리·경로 검색, 컬렉션 필터, 조회수·사용자·참여 시간 정렬
- 평균 참여: `userEngagementDuration / activeUsers`. 읽기를 완료했다는 의미는 아님
- 유입: `sessionDefaultChannelGroup`별 세션 수
- 도메인: `marydev.me`, `www.marydev.me`만 조회
- 조회수는 반복 조회 포함. 사용자 수는 날짜·글 사이에 중복될 수 있어 합산하지 않음
- 끝 슬래시만 다른 URL의 조회수는 합치되 정확한 중복 사용자 제거가 불가능하므로 사용자·평균 참여는 비움
- GA 속성 시간대가 한국과 다르면 안내 표시. GA 처리 지연·개인정보 보호 기준에 따른 결과 차이가 있을 수 있음
- 메모리에 5분간 캐시. 새로고침 버튼은 캐시를 건너뜀. 종료하면 통계 캐시가 사라짐
- 샘플 데이터는 별도 버튼으로만 표시하며 샘플 배너 유지. 실데이터 연결 실패 시 샘플로 자동 대체하지 않음

## 로컬 접근

서버는 `127.0.0.1`에만 바인딩합니다. 같은 PC의 브라우저에서만 사용합니다. Host·Origin과 요청 토큰을 확인하며 API에 CORS를 허용하지 않습니다. 인증 파일이나 임의 파일을 제공하는 라우트는 없습니다. 다른 사용자도 접근할 수 있는 공유 PC라면 운영체제 계정과 파일 권한을 별도로 관리해야 합니다.

## 검증

```powershell
npm run analytics:test
npm run build
```

날짜 경계, GA 보고서 변환, 중복 사용자 처리, 읽기 전용 인증, 측정 ID 자동 찾기, 로컬 접근 제한, 캐시 갱신을 테스트합니다. 실제 GA 조회는 인증 연결 후 확인해야 합니다.

공식 문서: [Data API 시작](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart), [보고서 일괄 조회](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/batchRunReports), [지표 정의](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema).
