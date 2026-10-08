import { isLoggedIn, json } from '../_auth.js';

// 구글 시트(Apps Script)에서 매출 데이터를 받아 앱에 전달.
// GAS_URL / GAS_KEY 는 Cloudflare 설정에만 있고 브라우저에는 노출되지 않습니다.
const EDGE_CACHE_SEC = 120;

export async function onRequestGet({ request, env, waitUntil }) {
  if (!(await isLoggedIn(request, env))) return json({ error: 'login' }, 401);
  if (!env.GAS_URL || !env.GAS_KEY) return json({ error: '서버 설정(GAS_URL, GAS_KEY)이 비어 있습니다.' }, 500);

  const force = new URL(request.url).searchParams.get('force') === '1';
  const cache = caches.default;
  const cacheKey = new Request('https://cache.sales-app.internal/data');

  if (!force) {
    const hit = await cache.match(cacheKey);
    if (hit) return new Response(hit.body, { headers: noStore(hit.headers) });
  }

  const url = `${env.GAS_URL}?key=${encodeURIComponent(env.GAS_KEY)}${force ? '&force=1' : ''}`;
  let text;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    return json({ error: `시트 연결 실패: ${e.message}` }, 502);
  }

  let data;
  try { data = JSON.parse(text); } catch (e) {
    return json({ error: '시트 응답을 읽지 못했습니다. Apps Script 배포 권한(모든 사용자)을 확인하세요.' }, 502);
  }
  if (data.error) return json({ error: `시트 응답 오류: ${data.error}` }, 502);

  const out = new Response(text, {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${EDGE_CACHE_SEC}` },
  });
  waitUntil(cache.put(cacheKey, out.clone()));
  return new Response(text, { headers: noStore(out.headers) });
}

function noStore(h) {
  const headers = new Headers(h);
  headers.set('Cache-Control', 'no-store');
  return headers;
}
