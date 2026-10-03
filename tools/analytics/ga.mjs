import { createPrivateKey, createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { SITE, dateRange, buildDashboard } from './model.mjs';

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function validateCredentials(credentials) {
  if (credentials.type === 'service_account' && credentials.client_email && credentials.private_key) {
    createPrivateKey(credentials.private_key);
    return;
  }
  if (credentials.type === 'authorized_user' && credentials.client_id && credentials.client_secret && credentials.refresh_token) return;
  throw new Error('Google 서비스 계정 키 또는 Application Default Credentials JSON 파일을 선택해 주세요.');
}

export class GoogleAnalytics {
  constructor(credentialsFile, fetcher = fetch) {
    this.credentialsFile = credentialsFile;
    this.fetcher = fetcher;
    this.token = null;
  }

  async request(url, options = {}, authenticated = true) {
    const headers = { ...options.headers };
    if (authenticated) headers.Authorization = `Bearer ${await this.accessToken()}`;
    const response = await this.fetcher(url, { ...options, headers, signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) this.token = null;
      // Google의 원문 에러에 요청/인증 정보가 섞일 수 있으므로 정해진 안내만 노출한다.
      const reason = data.error?.details?.flatMap((item) => item.reason || []) || [];
      if (reason.includes('SERVICE_DISABLED')) throw new Error('Google Cloud에서 Google Analytics Data API와 Admin API를 활성화해 주세요.');
      if (response.status === 403) throw new Error('GA 읽기 권한을 확인해 주세요. 서비스 계정 이메일을 MaryDev 속성의 뷰어로 추가하고 Data API·Admin API를 활성화해야 합니다.');
      if (response.status === 401 || response.status === 400 && !authenticated) throw new Error('Google 인증이 만료됐거나 키가 유효하지 않습니다. 연결 설정에서 인증 파일을 다시 선택해 주세요.');
      if (response.status === 429) throw new Error('Google API 요청 한도에 도달했습니다. 잠시 후 새로고침해 주세요.');
      throw new Error(`Google API 요청에 실패했습니다 (HTTP ${response.status}). 연결 설정과 속성 ID를 확인해 주세요.`);
    }
    return data;
  }

  async accessToken() {
    if (this.token && this.token.expiresAt > Date.now() + 60000) return this.token.value;
    const credentials = JSON.parse(await readFile(this.credentialsFile, 'utf8'));
    validateCredentials(credentials);
    let body;
    if (credentials.type === 'authorized_user') {
      body = new URLSearchParams({ grant_type: 'refresh_token', client_id: credentials.client_id, client_secret: credentials.client_secret, refresh_token: credentials.refresh_token });
    } else {
      const now = Math.floor(Date.now() / 1000);
      const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: credentials.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
      const signature = createSign('RSA-SHA256').update(unsigned).sign(credentials.private_key).toString('base64url');
      body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` });
    }
    const data = await this.request(TOKEN_URL, { method: 'POST', body }, false);
    if (!data.access_token) throw new Error('Google 인증 토큰을 받지 못했습니다.');
    this.token = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
    return this.token.value;
  }

  async discoverProperty() {
    let nextPageToken;
    const candidates = new Set();
    do {
      const query = new URLSearchParams({ pageSize: '200', ...(nextPageToken ? { pageToken: nextPageToken } : {}) });
      const data = await this.request(`https://analyticsadmin.googleapis.com/v1beta/accountSummaries?${query}`);
      for (const account of data.accountSummaries || []) {
        for (const property of account.propertySummaries || []) candidates.add(property.property);
      }
      nextPageToken = data.nextPageToken;
    } while (nextPageToken);
    for (const property of candidates) {
      let pageToken;
      do {
        const query = new URLSearchParams({ pageSize: '200', ...(pageToken ? { pageToken } : {}) });
        const data = await this.request(`https://analyticsadmin.googleapis.com/v1beta/${property}/dataStreams?${query}`);
        if ((data.dataStreams || []).some((stream) => stream.webStreamData?.measurementId === SITE.measurementId)) return property.split('/')[1];
        pageToken = data.nextPageToken;
      } while (pageToken);
    }
    throw new Error('측정 ID에 해당하는 GA 속성을 찾지 못했습니다. 연결 설정에 숫자로 된 속성 ID를 입력해 주세요.');
  }

  async dashboard(propertyId, catalog, days) {
    if (!/^\d+$/.test(propertyId)) throw new Error('숫자로 된 GA4 속성 ID가 필요합니다.');
    const range = dateRange(days);
    const common = { dimensionFilter: { filter: { fieldName: 'hostName', inListFilter: { values: [SITE.hostname, `www.${SITE.hostname}`] } } } };
    const request = (start, end, metrics, dimensions = []) => ({ ...common, dateRanges: [{ startDate: start, endDate: end }], metrics: metrics.map((name) => ({ name })), dimensions: dimensions.map((name) => ({ name })), limit: '10000' });
    const totals = ['screenPageViews', 'activeUsers', 'sessions', 'engagementRate'];
    const requests = [
      request(range.start, range.end, totals),
      request(range.previousStart, range.previousEnd, totals),
      request(range.start, range.end, ['screenPageViews', 'activeUsers'], ['date']),
      request(range.start, range.end, ['screenPageViews', 'activeUsers', 'userEngagementDuration'], ['pagePath']),
      request(range.start, range.end, ['sessions'], ['sessionDefaultChannelGroup']),
    ];
    const data = await this.request(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }) });
    if (!Array.isArray(data.reports) || data.reports.length !== 5) throw new Error('Google API가 완전한 보고서를 반환하지 않았습니다.');
    if (data.reports.some((report) => report.rowCount > 10000)) throw new Error('보고서 행 수가 10,000개를 넘습니다. 기간을 줄여 주세요.');
    return buildDashboard(data.reports, catalog, range);
  }
}
