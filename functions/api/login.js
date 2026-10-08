import { makeSession, passwordOk, cookieHeader, json, SESSION_DAYS } from '../_auth.js';

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch (e) {}
  if (!(await passwordOk(env, body.password))) {
    await new Promise((r) => setTimeout(r, 800)); // 무작위 대입 지연
    return json({ error: '비밀번호가 맞지 않습니다.' }, 401);
  }
  const session = await makeSession(env);
  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(session, SESSION_DAYS * 86400) });
}
