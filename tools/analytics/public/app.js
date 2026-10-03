const $ = (id) => document.getElementById(id);
const token = document.querySelector('meta[name="dashboard-token"]').content;
const number = new Intl.NumberFormat('ko-KR');
const labels = { 'Organic Search': '검색엔진', Direct: '직접 방문', Referral: '다른 사이트', 'Organic Social': '소셜 미디어', 'Paid Search': '검색 광고', Unassigned: '분류되지 않음', Email: '이메일' };
let state = { days: 30, demo: false, collection: 'all', data: null };
let generation = 0;
let controller;

try {
  const theme = localStorage.getItem('marydev:analytics:theme');
  document.documentElement.dataset.theme = theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
} catch {}

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'X-Dashboard-Token': token, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '데이터를 가져오지 못했습니다.');
  return data;
}

function setup(visible = true) { $('setup-panel').hidden = !visible; if (visible) $('setup-panel').scrollIntoView({ behavior: 'instant', block: 'start' }); }
function escape(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
function duration(value) { if (value == null) return '—'; const seconds = Math.round(value); return seconds >= 60 ? `${Math.floor(seconds / 60)}분 ${seconds % 60}초` : `${seconds}초`; }

function metric(name, current, previous, percent = false) {
  $(name + '-value').textContent = percent ? `${(current * 100).toFixed(1)}%` : number.format(current);
  const delta = $(name + '-delta');
  const difference = percent ? (current - previous) * 100 : previous ? (current - previous) / previous * 100 : null;
  delta.className = 'delta';
  if (difference == null) delta.textContent = previous === 0 && current === 0 ? '이전 기간에도 0' : '이전 기간 데이터 없음';
  else {
    const rounded = difference.toFixed(1);
    delta.textContent = `${difference > 0 ? '↑' : difference < 0 ? '↓' : '·'} ${Math.abs(rounded)}${percent ? '%p' : '%'} · 이전 ${state.days}일 대비`;
    if (difference) delta.classList.add(difference > 0 ? 'positive' : 'negative');
  }
}

function drawChart() {
  if (!state.data) return;
  const container = $('trend-chart');
  const width = Math.max(260, container.clientWidth);
  const height = container.clientHeight;
  const left = 42, right = 14, top = 13, bottom = 30;
  const rows = state.data.trend;
  const maximum = Math.max(10, Math.ceil(Math.max(...rows.map((row) => row.views), 1) / 10) * 10);
  const x = (i) => left + i * (width - left - right) / Math.max(rows.length - 1, 1);
  const y = (value) => height - bottom - value / maximum * (height - bottom - top);
  const points = rows.map((row, i) => `${x(i)},${y(row.views)}`);
  const line = 'M' + points.join(' L');
  const area = `${line} L${x(rows.length - 1)},${height - bottom} L${left},${height - bottom} Z`;
  const grids = [0, 1, 2, 3].map((i) => { const value = maximum * i / 3; return `<line class="chart-grid" x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}"/><text class="chart-label" x="${left - 8}" y="${y(value) + 4}" text-anchor="end">${number.format(Math.round(value))}</text>`; }).join('');
  const ticks = width < 420 ? [0, Math.round((rows.length - 1) / 2), rows.length - 1] : [0, Math.round((rows.length - 1) / 4), Math.round((rows.length - 1) / 2), Math.round((rows.length - 1) * .75), rows.length - 1];
  const dates = [...new Set(ticks)].map((i) => `<text class="chart-label" x="${x(i)}" y="${height - 4}" text-anchor="${i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'}">${escape(rows[i].date.slice(5).replace('-', '.'))}</text>`).join('');
  const markers = rows.map((row, i) => `<circle class="chart-point" cx="${x(i)}" cy="${y(row.views)}" r="${rows.length > 30 ? 2 : 3}"><title>${escape(row.date)} · 조회 ${number.format(row.views)}회</title></circle>`).join('');
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(state.data.range.start)}부터 ${escape(state.data.range.end)}까지 일별 조회수. 총 ${number.format(rows.reduce((sum, row) => sum + row.views, 0))}회"><title>일별 조회수</title>${grids}<path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/>${markers}${dates}</svg>`;
}

function renderPosts() {
  if (!state.data) return;
  const query = $('post-search').value.trim().toLocaleLowerCase('ko-KR');
  const key = $('sort-select').value;
  const posts = state.data.posts.filter((post) => (state.collection === 'all' || post.collection === state.collection) && (!query || `${post.title} ${post.category} ${post.path}`.toLocaleLowerCase('ko-KR').includes(query))).sort((a, b) => (b[key] ?? -1) - (a[key] ?? -1));
  $('posts-count').textContent = `${posts.length}개 글 · 선택한 기간 기준`;
  $('post-rows').innerHTML = posts.length ? posts.map((post) => `<tr><td><div class="post-meta"><span>${escape(post.collection.toUpperCase())}</span>${post.category ? ` · ${escape(post.category)}` : ''}</div><a href="https://marydev.me${escape(encodeURI(post.path))}" target="_blank" rel="noopener noreferrer">${escape(post.title)}</a></td><td class="number">${number.format(post.views)}</td><td class="number">${post.users == null ? '—' : number.format(post.users)}</td><td class="number">${duration(post.engagementSeconds)}</td></tr>`).join('') : '<tr><td colspan="4">이 기간과 조건에 해당하는 글 방문이 없습니다.</td></tr>';
}

function render() {
  const data = state.data;
  $('dashboard').hidden = false;
  $('empty-state').hidden = true;
  $('demo-notice').hidden = !data.demo;
  $('connection-status').textContent = data.demo ? '샘플 미리보기' : 'GA 연결됨';
  $('connection-status').classList.toggle('connected', !data.demo);
  metric('views', data.totals.screenPageViews || 0, data.previous.screenPageViews || 0);
  metric('users', data.totals.activeUsers || 0, data.previous.activeUsers || 0);
  metric('sessions', data.totals.sessions || 0, data.previous.sessions || 0);
  metric('engagement', data.totals.engagementRate || 0, data.previous.engagementRate || 0, true);
  $('date-label').textContent = `${data.range.start.replaceAll('-', '.')} — ${data.range.end.replaceAll('-', '.')} · 오늘 제외`;
  $('updated-label').textContent = `${data.demo ? '예시 수치' : '최근 조회'} · ${new Date(data.fetchedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
  const channels = [...data.channels].sort((a, b) => b.sessions - a.sessions);
  const total = channels.reduce((sum, row) => sum + row.sessions, 0);
  $('channel-rows').innerHTML = channels.length ? channels.map((row) => `<div class="channel-row"><div class="channel-heading"><span>${escape(labels[row.name] || row.name)}</span><span class="channel-number">${number.format(row.sessions)} · ${total ? Math.round(row.sessions / total * 100) : 0}%</span></div><div class="channel-track"><span></span></div></div>`).join('') : '<p class="help">유입 채널 데이터가 없습니다.</p>';
  [...$('channel-rows').querySelectorAll('.channel-track span')].forEach((element, i) => { element.style.width = `${total ? channels[i].sessions / total * 100 : 0}%`; });
  const warnings = [...(data.warnings || [])];
  if (data.timeZone !== 'Asia/Seoul') warnings.push(`GA 속성 시간대는 ${data.timeZone}입니다. 표시 날짜 범위는 한국 시간을 기준으로 선택했습니다.`);
  if (data.posts.some((post) => post.users == null)) warnings.push('끝 슬래시가 다른 URL을 합친 글은 활성 사용자와 평균 참여 시간을 표시하지 않습니다.');
  $('data-warnings').textContent = warnings.join(' ');
  renderPosts();
  drawChart();
}

async function load(refresh = false) {
  const current = ++generation;
  controller?.abort();
  controller = new AbortController();
  $('refresh-button').disabled = true;
  $('dashboard').setAttribute('aria-busy', 'true');
  $('error-notice').hidden = true;
  try {
    const data = await api(`/api/dashboard?days=${state.days}&demo=${state.demo ? 1 : 0}&refresh=${refresh ? 1 : 0}`, { signal: controller.signal });
    if (current !== generation) return;
    state.data = data;
    render();
  } catch (error) {
    if (error.name === 'AbortError' || current !== generation) return;
    $('error-notice').textContent = error.message + (state.data ? ' 현재 화면은 이전에 가져온 데이터입니다.' : '');
    $('error-notice').hidden = false;
    $('connection-status').textContent = '연결 확인 필요';
    $('connection-status').classList.remove('connected');
    if (!state.data) setup();
  } finally {
    if (current === generation) { $('refresh-button').disabled = false; $('dashboard').setAttribute('aria-busy', 'false'); }
  }
}

$('theme-button').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('marydev:analytics:theme', theme); } catch {}
});
$('settings-button').addEventListener('click', () => setup());
$('mobile-settings-button').addEventListener('click', () => setup());
$('empty-setup-button').addEventListener('click', () => setup());
$('close-setup').addEventListener('click', () => setup(false));
$('overview-button').addEventListener('click', () => { setup(false); window.scrollTo({ top: 0 }); });
$('refresh-button').addEventListener('click', () => load(true));
$('demo-button').addEventListener('click', () => { state.demo = true; setup(false); load(); });
$('live-button').addEventListener('click', () => setup());
document.querySelectorAll('[data-days]').forEach((button) => button.addEventListener('click', () => {
  state.days = Number(button.dataset.days);
  document.querySelectorAll('[data-days]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
  if (state.data) load();
}));
document.querySelectorAll('[data-collection]').forEach((button) => button.addEventListener('click', () => {
  state.collection = button.dataset.collection;
  document.querySelectorAll('[data-collection]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
  renderPosts();
}));
$('post-search').addEventListener('input', renderPosts);
$('sort-select').addEventListener('change', renderPosts);
new ResizeObserver(drawChart).observe($('trend-chart'));
$('settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('connect-button').disabled = true;
  $('setup-message').textContent = '연결 확인 중…';
  try {
    const file = $('credentials-file').files[0];
    if (file && file.size > 65536) throw new Error('JSON 인증 파일은 64KB 이하만 지원합니다.');
    const credentials = file ? JSON.parse(await file.text()) : undefined;
    await api('/api/settings', { method: 'POST', body: JSON.stringify({ propertyId: $('property-id').value.trim(), credentials }) });
    $('credentials-file').value = '';
    $('credential-help').textContent = '선택한 키는 PC에 저장했습니다.';
    state.demo = false;
    state.data = null;
    $('dashboard').hidden = true;
    $('empty-state').hidden = false;
    $('demo-notice').hidden = true;
    await load(true);
    if (state.data) { $('setup-message').textContent = '연결했습니다.'; setup(false); }
    else $('setup-message').textContent = '설정은 저장했습니다. 위의 연결 오류를 확인해 주세요.';
  } catch (error) { $('setup-message').textContent = error instanceof SyntaxError ? 'JSON 파일 형식을 확인해 주세요.' : error.message; }
  finally { $('connect-button').disabled = false; }
});
api('/api/status').then((status) => {
  $('property-id').value = status.propertyId;
  if (status.hasCredentials) load();
  else { $('connection-status').textContent = 'GA 인증 대기'; setup(); }
}).catch((error) => { $('error-notice').textContent = error.message; $('error-notice').hidden = false; });
