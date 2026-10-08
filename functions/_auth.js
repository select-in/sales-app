// 로그인 세션 쿠키: "만료시각.서명" (HMAC-SHA256)
// 서명 키 = SESSION_SECRET + APP_PASSWORD → 비밀번호를 바꾸면 기존 로그인은 모두 풀립니다.

export const COOKIE = 'sa_session';
export const SESSION_DAYS = 90;

const enc = new TextEncoder();

async function hmac(env, msg) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(`${env.SESSION_SECRET || ''}|${env.APP_PASSWORD || ''}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function makeSession(env) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  return `${exp}.${await hmac(env, String(exp))}`;
}

export async function isLoggedIn(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = decodeURIComponent(m[1]).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(env, exp));
}

export async function passwordOk(env, input) {
  if (!env.APP_PASSWORD || typeof input !== 'string') return false;
  // 길이 차이로 정보가 새지 않도록 해시끼리 비교
  return safeEqual(await hmac(env, `pw:${input}`), await hmac(env, `pw:${env.APP_PASSWORD}`));
}

export function cookieHeader(value, maxAgeSec) {
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=Lax`;
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}
