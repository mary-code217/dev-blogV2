import http from 'node:http';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleAnalytics, validateCredentials } from './ga.mjs';
import { SITE, loadCatalog, sampleDashboard } from './model.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../..');

async function readJson(filename, fallback) {
  try { return JSON.parse(await readFile(filename, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

export async function createDashboardServer({ projectRoot = root, stateDirectory = path.join(root, '.analytics-local'), environment = process.env, clientFactory = (file) => new GoogleAnalytics(file) } = {}) {
  const token = randomBytes(32).toString('hex');
  const configFile = path.join(stateDirectory, 'config.json');
  const credentialFile = path.join(stateDirectory, 'credentials.json');
  let config = await readJson(configFile, {});
  let client;
  const cache = new Map();
  const catalog = await loadCatalog(projectRoot);
  const credentialPath = async () => {
    const adc = environment.APPDATA ? path.join(environment.APPDATA, 'gcloud/application_default_credentials.json') : '';
    for (const file of [environment.GOOGLE_APPLICATION_CREDENTIALS, credentialFile, adc].filter(Boolean)) {
      try { await access(file); return file; } catch {}
    }
    return null;
  };
  const save = async () => {
    await mkdir(stateDirectory, { recursive: true, mode: 0o700 });
    await writeFile(configFile, JSON.stringify(config, null, 2), { mode: 0o600 });
  };
  const propertyId = () => environment.GA_PROPERTY_ID || config.propertyId || '';
  const send = (response, status, body, type = 'application/json; charset=utf-8') => {
    response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
    response.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  const parseBody = async (request) => {
    let size = 0;
    const chunks = [];
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 65536) throw new Error('설정 파일은 64KB 이하만 지원합니다.');
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  };
  const server = http.createServer(async (request, response) => {
    const expectedHost = `127.0.0.1:${server.address().port}`;
    // DNS rebinding과 다른 웹사이트에서의 로컬 설정 변경을 차단한다.
    if (request.headers.host !== expectedHost || request.headers.origin && request.headers.origin !== `http://${expectedHost}` || request.headers['sec-fetch-site'] === 'cross-site') return send(response, 403, { error: '이 대시보드의 로컬 주소에서만 접근할 수 있습니다.' });
    const url = new URL(request.url, `http://${expectedHost}`);
    if (url.pathname.startsWith('/api/')) {
      const supplied = Buffer.from(String(request.headers['x-dashboard-token'] || ''));
      const expected = Buffer.from(token);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(response, 403, { error: '대시보드 페이지를 새로고침해 주세요.' });
    }
    try {
      if (request.method === 'GET' && url.pathname === '/api/status') return send(response, 200, { site: SITE, hasCredentials: Boolean(await credentialPath()), propertyId: propertyId(), posts: catalog.length });
      if (request.method === 'POST' && url.pathname === '/api/settings') {
        const body = await parseBody(request);
        if (body.propertyId && !/^\d+$/.test(String(body.propertyId))) throw new Error('속성 ID에는 숫자만 입력해 주세요.');
        if (body.credentials) {
          validateCredentials(body.credentials);
          await mkdir(stateDirectory, { recursive: true, mode: 0o700 });
          await writeFile(credentialFile, JSON.stringify(body.credentials), { mode: 0o600 });
        }
        config = { propertyId: String(body.propertyId || '') };
        await save();
        client = null;
        cache.clear();
        return send(response, 200, { saved: true });
      }
      if (request.method === 'GET' && url.pathname === '/api/dashboard') {
        const days = Number(url.searchParams.get('days') || 30);
        if (![7, 30, 90].includes(days)) return send(response, 400, { error: '지원하지 않는 기간입니다.' });
        if (url.searchParams.get('demo') === '1') return send(response, 200, sampleDashboard(catalog, days));
        const file = await credentialPath();
        if (!file) return send(response, 409, { error: 'GA 읽기 권한을 먼저 연결해 주세요.', needsSetup: true });
        if (!client) client = clientFactory(file);
        let id = propertyId();
        if (!id) {
          id = await client.discoverProperty();
          config.propertyId = id;
          await save();
        }
        const key = `${id}:${days}`;
        const cached = cache.get(key);
        if (cached && Date.now() - cached.created < 300000 && url.searchParams.get('refresh') !== '1') return send(response, 200, cached.data);
        const data = await client.dashboard(id, catalog, days);
        cache.set(key, { data, created: Date.now() });
        return send(response, 200, data);
      }
      const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };
      if (request.method === 'GET' && files[url.pathname]) {
        const [filename, type] = files[url.pathname];
        let content = await readFile(path.join(directory, 'public', filename), 'utf8');
        if (filename === 'index.html') content = content.replace('__DASHBOARD_TOKEN__', token);
        return send(response, 200, content, type);
      }
      return send(response, 404, { error: '없는 경로입니다.' });
    } catch (error) {
      const message = /^(ENOENT|EACCES|EPERM)/.test(error.message) ? '인증 파일을 읽을 수 없습니다. 연결 설정을 확인해 주세요.' : error.name === 'TimeoutError' ? 'Google 응답이 지연되고 있습니다. 다시 시도해 주세요.' : error instanceof SyntaxError ? 'JSON 파일 형식을 확인해 주세요.' : error.message;
      send(response, 400, { error: message });
    }
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createDashboardServer();
  const port = Number(process.env.ANALYTICS_PORT || 4322);
  server.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE' ? `포트 ${port}가 사용 중입니다. ANALYTICS_PORT 환경변수로 다른 포트를 지정해 주세요.` : '로컬 대시보드를 시작하지 못했습니다.');
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => console.log(`MaryDev Analytics: http://127.0.0.1:${server.address().port}\n종료하려면 Ctrl+C를 누르세요. GA 키와 설정은 .analytics-local/에만 저장됩니다.`));
}
