import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { generateKeyPairSync } from 'node:crypto';
import { dateRange, buildDashboard, normalizePath, loadCatalog, SITE } from '../model.mjs';
import { GoogleAnalytics } from '../ga.mjs';
import { createDashboardServer } from '../server.mjs';

const root = path.resolve(import.meta.dirname, '../../..');
function report(dimensions, metrics, rows) {
  return { dimensionHeaders: dimensions.map((name) => ({ name })), metricHeaders: metrics.map((name) => ({ name })), rows: rows.map(([d, m]) => ({ dimensionValues: d.map((value) => ({ value })), metricValues: m.map((value) => ({ value: String(value) })) })) };
}

test('기간은 한국 날짜 기준으로 오늘을 제외하며 비교 기간과 겹치지 않는다', () => {
  assert.deepEqual(dateRange(7, new Date('2026-10-03T15:01:00Z')), { start: '2026-09-27', end: '2026-10-03', previousStart: '2026-09-20', previousEnd: '2026-09-26' });
  assert.equal(dateRange(30, new Date('2026-03-01T00:00:00Z')).start, '2026-01-30');
  assert.throws(() => dateRange(365));
});

test('블로그 실제 제목을 읽고 URL과 연결하며 초안은 제외한다', async () => {
  const catalog = await loadCatalog(root);
  assert(catalog.some((post) => post.path === '/blog/observability-lab-01-setup/' && post.title.includes('모니터링 장애 대응')));
  assert.equal(normalizePath('/wiki/%ED%95%9C%EA%B8%80?x=1'), '/wiki/한글/');
  assert.equal(normalizePath('/'), '/');
});

test('일별 빈 날짜는 0으로 채우고 중복 URL의 사용자 수를 잘못 합산하지 않는다', () => {
  const pages = report(['pagePath'], ['screenPageViews', 'activeUsers', 'userEngagementDuration'], [[['/blog/test'], [5, 2, 100]], [['/blog/test/'], [3, 2, 50]], [['/'], [20, 10, 200]], [['/wiki/other/'], [4, 2, 180]]]);
  const data = buildDashboard([report([], ['screenPageViews', 'activeUsers'], [[[], [32, 12]]]), {}, report(['date'], ['screenPageViews', 'activeUsers'], [[['20261001'], [9, 4]]]), pages, {}], [{ path: '/blog/test/', title: '제목', collection: 'blog', category: 'Backend' }], { start: '2026-10-01', end: '2026-10-03' });
  assert.deepEqual(data.trend.map((row) => row.views), [9, 0, 0]);
  assert.equal(data.posts.length, 2);
  assert.equal(data.posts[0].title, '제목');
  assert.equal(data.posts[0].views, 8);
  assert.equal(data.posts[0].users, null);
  assert.equal(data.posts[0].engagementSeconds, null);
  assert.equal(data.posts[1].engagementSeconds, 90);
  assert.equal(data.totals.activeUsers, 12);
});

test('JWT 인증은 Google 고정 토큰 주소와 읽기 전용 scope를 사용하고 토큰을 재사용한다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'marydev-ga-token-'));
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const file = path.join(dir, 'credentials.json');
  await writeFile(file, JSON.stringify({ type: 'service_account', client_email: 'test@example.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://untrusted.example' }));
  let calls = 0;
  const client = new GoogleAnalytics(file, async (url, options) => {
    calls++;
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    const claims = JSON.parse(Buffer.from(options.body.get('assertion').split('.')[1], 'base64url'));
    assert.equal(claims.scope, 'https://www.googleapis.com/auth/analytics.readonly');
    assert.equal(claims.iss, 'test@example.com');
    assert.equal(claims.exp - claims.iat, 3600);
    return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }));
  });
  assert.equal(await client.accessToken(), 'test-token');
  assert.equal(await client.accessToken(), 'test-token');
  assert.equal(calls, 1);
});

test('GA 요청은 사이트 도메인으로 제한되고 다섯 보고서와 완료된 기간을 요청한다', async () => {
  const client = new GoogleAnalytics('unused');
  client.accessToken = async () => 'test-token';
  client.fetcher = async (url, options) => {
    assert.equal(url, 'https://analyticsdata.googleapis.com/v1beta/properties/534866872:batchRunReports');
    const body = JSON.parse(options.body);
    assert.equal(body.requests.length, 5);
    assert(body.requests.every((request) => request.dimensionFilter.filter.fieldName === 'hostName'));
    assert.deepEqual(body.requests[0].dimensionFilter.filter.inListFilter.values, ['marydev.me', 'www.marydev.me']);
    assert.deepEqual(body.requests[3].dimensions, [{ name: 'pagePath' }]);
    assert(body.requests.every((request) => /^\d{4}-\d{2}-\d{2}$/.test(request.dateRanges[0].endDate)));
    return new Response(JSON.stringify({ reports: [{}, {}, {}, {}, {}] }));
  };
  const data = await client.dashboard('534866872', [], 7);
  assert.equal(data.trend.length, 7);
  assert.equal(data.posts.length, 0);
});

test('속성 자동 찾기는 계정과 스트림의 다음 페이지도 확인한다', async () => {
  const client = new GoogleAnalytics('unused');
  client.request = async (url) => {
    if (url.includes('accountSummaries') && !url.includes('pageToken')) return { nextPageToken: 'next', accountSummaries: [] };
    if (url.includes('accountSummaries')) return { accountSummaries: [{ propertySummaries: [{ property: 'properties/123' }] }] };
    if (!url.includes('pageToken')) return { nextPageToken: 'stream-next', dataStreams: [] };
    return { dataStreams: [{ webStreamData: { measurementId: SITE.measurementId } }] };
  };
  assert.equal(await client.discoverProperty(), '123');
});

test('로컬 서버는 다른 Host·Origin·API 토큰 없는 요청과 인증 파일 접근을 거부한다', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'marydev-ga-server-'));
  const server = await createDashboardServer({ projectRoot: root, stateDirectory: directory, environment: {} });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const html = await (await fetch(base)).text();
  const token = html.match(/name="dashboard-token" content="([^"]+)"/)[1];
  const headers = { 'X-Dashboard-Token': token };
  assert.equal((await fetch(`${base}/api/status`)).status, 403);
  const foreignHostStatus = await new Promise((resolve, reject) => {
    http.get(base, { headers: { Host: 'evil.example' } }, (response) => { response.resume(); resolve(response.statusCode); }).on('error', reject);
  });
  assert.equal(foreignHostStatus, 403);
  assert.equal((await fetch(`${base}/api/status`, { headers: { ...headers, Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await fetch(`${base}/.analytics-local/credentials.json`)).status, 404);
  assert.equal((await fetch(`${base}/api/dashboard`, { headers })).status, 409);
  assert.equal((await fetch(`${base}/api/dashboard?days=365&demo=1`, { headers })).status, 400);
  const demo = await (await fetch(`${base}/api/dashboard?days=7&demo=1`, { headers })).json();
  assert.equal(demo.demo, true);
  assert.equal(demo.trend.length, 7);
  const save = await fetch(`${base}/api/settings`, { method: 'POST', headers, body: JSON.stringify({ propertyId: '534866872' }) });
  assert.equal(save.status, 200);
  assert.equal(JSON.parse(await readFile(path.join(directory, 'config.json'))).propertyId, '534866872');
  assert.equal((await fetch(`${base}/api/settings`, { method: 'POST', headers, body: JSON.stringify({ propertyId: 'G-INVALID' }) })).status, 400);
});

test('실제 연결은 캐시를 사용하고 강제 업데이트 시 다시 조회한다', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'marydev-ga-cache-'));
  await writeFile(path.join(directory, 'credentials.json'), '{}');
  await writeFile(path.join(directory, 'config.json'), JSON.stringify({ propertyId: '534866872' }));
  let calls = 0;
  const server = await createDashboardServer({ projectRoot: root, stateDirectory: directory, environment: {}, clientFactory: () => ({ dashboard: async () => ({ totals: { screenPageViews: ++calls } }) }) });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const html = await (await fetch(base)).text();
  const headers = { 'X-Dashboard-Token': html.match(/name="dashboard-token" content="([^"]+)"/)[1] };
  await fetch(`${base}/api/dashboard?days=7`, { headers });
  await fetch(`${base}/api/dashboard?days=7`, { headers });
  assert.equal(calls, 1);
  await fetch(`${base}/api/dashboard?days=7&refresh=1`, { headers });
  assert.equal(calls, 2);
});
