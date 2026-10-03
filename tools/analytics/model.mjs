import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const SITE = { name: 'MaryDev', hostname: 'marydev.me', url: 'https://marydev.me', measurementId: 'G-GBDJN2XP74' };

export function normalizePath(value) {
  let pathname = String(value || '/').split(/[?#]/)[0];
  try { pathname = decodeURIComponent(pathname); } catch {}
  return '/' + pathname.replace(/^\/+|\/+$/g, '') + (pathname.replace(/\//g, '') ? '/' : '');
}

function scalar(frontmatter, name) {
  const value = frontmatter.match(new RegExp(`^${name}:\\s*(.*?)\\s*$`, 'm'))?.[1] || '';
  if (value.startsWith('"')) {
    try { return JSON.parse(value); } catch { return value.slice(1, value.lastIndexOf('"')); }
  }
  if (value.startsWith("'")) return value.slice(1, value.lastIndexOf("'")).replaceAll("''", "'");
  return value.replace(/\s+#.*$/, '');
}

export async function loadCatalog(root) {
  const catalog = [];
  for (const collection of ['blog', 'wiki', 'ai']) {
    const base = path.join(root, 'src/content', collection);
    let entries;
    try { entries = await readdir(base, { recursive: true, withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const entry of entries) {
      if (!entry.isFile() || !/\.mdx?$/.test(entry.name)) continue;
      const filename = path.join(entry.parentPath, entry.name);
      const source = await readFile(filename, 'utf8');
      const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
      if (!frontmatter || scalar(frontmatter, 'draft') === 'true') continue;
      const slug = path.relative(base, filename).replaceAll('\\', '/').replace(/\.mdx?$/, '');
      catalog.push({ path: normalizePath(`${collection}/${slug}`), title: scalar(frontmatter, 'title') || slug, category: scalar(frontmatter, 'category'), collection });
    }
  }
  return catalog;
}

export function dateRange(days, now = new Date()) {
  if (![7, 30, 90].includes(days)) throw new Error('기간은 7일, 30일, 90일 중에서 선택해 주세요.');
  const current = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const date = new Date(`${current}T00:00:00Z`);
  const offset = (amount) => new Date(date.valueOf() + amount * 86400000).toISOString().slice(0, 10);
  // 오늘의 불완전한 수치를 제외하고 동일한 길이의 두 기간을 비교한다.
  return { start: offset(-days), end: offset(-1), previousStart: offset(-days * 2), previousEnd: offset(-days - 1) };
}

export function reportRows(report = {}) {
  return (report.rows || []).map((row) => Object.fromEntries([
    ...(report.dimensionHeaders || []).map((header, i) => [header.name, row.dimensionValues[i]?.value || '']),
    ...(report.metricHeaders || []).map((header, i) => [header.name, Number(row.metricValues[i]?.value || 0)]),
  ]));
}

export function buildDashboard(reports, catalog, range, now = new Date()) {
  const [current, previous, daily, pages, channels] = reports.map(reportRows);
  const byPath = new Map(catalog.map((post) => [post.path, post]));
  const pageRows = pages.map((row) => ({ ...row, path: normalizePath(row.pagePath) }));
  // 조회수는 합산 가능하지만 활성 사용자는 서로 다른 URL 행을 더하면 중복된다.
  const groups = new Map();
  for (const row of pageRows) {
    const existing = groups.get(row.path);
    if (existing) {
      existing.screenPageViews += row.screenPageViews;
      existing.userEngagementDuration += row.userEngagementDuration;
      existing.activeUsers = null;
    } else groups.set(row.path, { ...row });
  }
  const posts = [...groups.values()].filter((row) => /^\/(blog|wiki|ai)\/[^/]+/.test(row.path)).map((row) => {
    const post = byPath.get(row.path);
    return { path: row.path, title: post?.title || row.path, collection: post?.collection || row.path.split('/')[1], category: post?.category || '', views: row.screenPageViews, users: row.activeUsers, engagementSeconds: row.activeUsers ? row.userEngagementDuration / row.activeUsers : null };
  }).sort((a, b) => b.views - a.views);
  const dailyMap = new Map(daily.map((row) => [row.date, row]));
  const trend = [];
  for (let value = new Date(`${range.start}T00:00:00Z`); value.toISOString().slice(0, 10) <= range.end; value = new Date(value.valueOf() + 86400000)) {
    const date = value.toISOString().slice(0, 10);
    const row = dailyMap.get(date.replaceAll('-', ''));
    trend.push({ date, views: row?.screenPageViews || 0, users: row?.activeUsers || 0 });
  }
  return { site: SITE, range, fetchedAt: now.toISOString(), timeZone: reports[0]?.metadata?.timeZone || 'Asia/Seoul', totals: current[0] || {}, previous: previous[0] || {}, trend, posts, channels: channels.map((row) => ({ name: row.sessionDefaultChannelGroup, sessions: row.sessions })), warnings: reports.some((report) => report.metadata?.subjectToThresholding) ? ['일부 통계에 GA 개인정보 보호 기준이 적용됐습니다.'] : [] };
}

export function sampleDashboard(catalog, days) {
  const range = dateRange(days);
  const trend = Array.from({ length: days }, (_, i) => ({ date: new Date(new Date(`${range.start}T00:00:00Z`).valueOf() + i * 86400000).toISOString().slice(0, 10), views: 38 + (i * 17 % 59) + Math.floor(i / 7) * 8, users: 25 + (i * 11 % 31) }));
  const views = trend.reduce((sum, row) => sum + row.views, 0);
  const posts = catalog.slice(0, 12).map((post, i) => ({ ...post, views: Math.round(views * .28 / (i + 1)), users: Math.round(views * .18 / (i + 1)), engagementSeconds: 58 + (i * 23 % 120) }));
  return { site: SITE, range, fetchedAt: new Date().toISOString(), timeZone: 'Asia/Seoul', demo: true, totals: { screenPageViews: views, activeUsers: Math.round(views * .61), sessions: Math.round(views * .74), engagementRate: .68 }, previous: { screenPageViews: Math.round(views * .83), activeUsers: Math.round(views * .52), sessions: Math.round(views * .65), engagementRate: .63 }, trend, posts, channels: [{ name: 'Organic Search', sessions: 620 }, { name: 'Direct', sessions: 320 }, { name: 'Referral', sessions: 180 }, { name: 'Organic Social', sessions: 95 }].map((row) => ({ ...row, sessions: Math.round(row.sessions * days / 30) })), warnings: [] };
}
