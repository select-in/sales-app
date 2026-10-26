/**
 * 셀렉트인 운영 프로그램 — Google Apps Script 버전 (claude.ai 없이 사용)
 *
 * 구성
 *  - doGet           : 웹앱 화면(index.html) 열기
 *  - db*             : 팀 저장소 — 이 스프레드시트의 숨김 탭 '_db'에 JSON으로 저장
 *  - sheetsTool      : '사입 원가표 (자동 기록)' 등 다른 구글 시트에 쓰기
 *  - aiCall          : Anthropic API(Claude) 호출 — 스크립트 속성 ANTHROPIC_API_KEY 필요
 *
 * 처음 한 번: 메뉴 [확장 프로그램 → Apps Script] → 프로젝트 설정 → 스크립트 속성에
 *   ANTHROPIC_API_KEY = sk-ant-...   (필수, AI 기능용)
 *   AI_MODEL_DEFAULT  = claude-sonnet-5-5   (선택)
 *   AI_MODEL_QUICK    = claude-haiku-5-5    (선택)
 */

const DB_TAB = '_db';
const DEFAULT_DB_ID = '1Dkh2461Ilq8Tw0fClsYHFmkaQCjMoB1BJfn316RQnpw';   // 드라이브 '셀렉트인 운영 프로그램' 폴더의 DB 시트
const CHUNK = 45000;          // 셀 하나 최대 50,000자 → 여유 있게 나눠 저장
const MAX_CHUNKS = 40;

// 화면은 GitHub(select-in/sales-app)에서 최신본을 불러옴 → Claude가 고치면 다시 붙여넣기·배포할 필요 없음
// 불러오기 실패하면 이 프로젝트의 index.html(예비본)로 열림
const APP_URL = 'https://select-in.github.io/sales-app/ops/index.html';
function appHtml_() {
  try {
    const r = UrlFetchApp.fetch(APP_URL + '?v=' + Date.now(), { muteHttpExceptions: true, followRedirects: true });
    const t = r.getResponseCode() === 200 ? r.getContentText('UTF-8') : '';
    if (t.indexOf('window.claude') > 0) return HtmlService.createHtmlOutput(t);
  } catch (e) {}
  return HtmlService.createHtmlOutputFromFile('index');
}
function doGet() {
  return appHtml_()
    .setTitle('셀렉트인 운영 프로그램')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/* ===================== 팀 저장소 (_db 탭) ===================== */
function dbBook_() {
  const id = PropertiesService.getScriptProperties().getProperty('DB_SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const act = SpreadsheetApp.getActiveSpreadsheet();
  return act || SpreadsheetApp.openById(DEFAULT_DB_ID);
}
function dbSheet_() {
  const ss = dbBook_();
  let sh = ss.getSheetByName(DB_TAB);
  if (!sh) {
    sh = ss.insertSheet(DB_TAB);
    sh.getRange(1, 1, 1, 3).setValues([['path', 'updatedAt', 'parts']]);
    sh.setFrozenRows(1);
    sh.hideSheet();
    const first = ss.getSheets()[0];
    if (first && first.getName() !== DB_TAB && first.getLastRow() === 0) first.getRange('A1').setValue('셀렉트인 운영 프로그램 데이터 — 숨김 탭 _db 에 저장됩니다. 지우지 마세요.');
    seedIfEmpty_(sh);
  }
  return sh;
}
function seedIfEmpty_(sh) {   // 처음 만들 때 기존 claude.ai 데이터 자동으로 옮겨 넣기
  if (typeof SEED === 'undefined' || sh.getLastRow() > 1) return;
  const rows = Object.keys(SEED).map(path => {
    const json = JSON.stringify(SEED[path]), parts = [];
    for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
    return [path, new Date(), parts.length].concat(parts);
  });
  const w = Math.max(...rows.map(r => r.length)); rows.forEach(r => { while (r.length < w) r.push(''); });
  if (sh.getMaxColumns() < w) sh.insertColumnsAfter(sh.getMaxColumns(), w - sh.getMaxColumns());
  sh.getRange(2, 1, rows.length, w).setNumberFormat('@').setValues(rows);
}
function dbAll_() {
  const sh = dbSheet_(), last = sh.getLastRow();
  if (last < 2) return { sh, rows: [] };
  const width = Math.max(4, sh.getLastColumn());
  const vals = sh.getRange(2, 1, last - 1, width).getValues();
  return { sh, rows: vals.map((r, i) => ({ row: i + 2, path: String(r[0]), parts: Number(r[2]) || 1, json: r.slice(3, 3 + (Number(r[2]) || 1)).join('') })) };
}
function dbGet(path) {
  const hit = dbAll_().rows.find(r => r.path === path);
  return hit ? hit.json : null;           // JSON 문자열 (화면에서 파싱)
}
function dbList(col) {
  const pre = col + '/';
  const out = dbAll_().rows.filter(r => r.path.indexOf(pre) === 0 && r.path.slice(pre.length).indexOf('/') < 0)
    .map(r => [r.path.slice(pre.length), r.json]);
  return JSON.stringify(out);
}
function dbSet(path, json) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const { sh, rows } = dbAll_();
    const parts = [];
    for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
    if (!parts.length) parts.push('');
    if (parts.length > MAX_CHUNKS) throw new Error('too_large: 저장할 데이터가 너무 큽니다');
    const line = [path, new Date(), parts.length].concat(parts);
    const hit = rows.find(r => r.path === path);
    const rowNo = hit ? hit.row : sh.getLastRow() + 1;
    const oldWidth = hit ? 3 + hit.parts : 0;
    if (oldWidth > line.length) sh.getRange(rowNo, line.length + 1, 1, oldWidth - line.length).clearContent();
    if (sh.getMaxColumns() < line.length) sh.insertColumnsAfter(sh.getMaxColumns(), line.length - sh.getMaxColumns());
    sh.getRange(rowNo, 1, 1, line.length).setNumberFormat('@').setValues([line]);
    return true;
  } finally { lock.releaseLock(); }
}
function dbUpdate(path, json) {
  const cur = dbGet(path);
  const merged = Object.assign({}, cur ? JSON.parse(cur) : {}, JSON.parse(json));
  return dbSet(path, JSON.stringify(merged));
}
function dbDelete(path) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const { sh, rows } = dbAll_();
    const hit = rows.find(r => r.path === path);
    if (hit) sh.deleteRow(hit.row);
    return true;
  } finally { lock.releaseLock(); }
}

/* ===================== 다른 구글 시트에 쓰기 ===================== */
function splitRange_(range) {
  const i = range.lastIndexOf('!');
  const name = (i >= 0 ? range.slice(0, i) : '').replace(/^'(.*)'$/, '$1').replace(/''/g, "'");
  return { name, a1: i >= 0 ? range.slice(i + 1) : range };
}
function sheetOf_(ss, name) {
  const sh = name ? ss.getSheetByName(name) : ss.getSheets()[0];
  if (!sh) throw new Error('tool_error: 시트 탭이 없습니다 — ' + name);
  return sh;
}
function colNum_(letters) { let n = 0; for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
function sheetsTool(tool, inputJson) {
  const input = JSON.parse(inputJson);
  const ss = SpreadsheetApp.openById(input.spreadsheetId);
  if (tool === 'update_values') {
    const { name, a1 } = splitRange_(input.range), sh = sheetOf_(ss, name);
    const m = a1.match(/^([A-Z]+)(\d+)/i); const r0 = m ? Number(m[2]) : 1, c0 = m ? colNum_(m[1]) : 1;
    const vals = input.values || []; const w = Math.max(1, ...vals.map(r => r.length));
    if (!vals.length) return '{}';
    const grid = vals.map(r => { const o = r.map(v => v === null || v === undefined ? '' : v); while (o.length < w) o.push(''); return o; });
    if (sh.getMaxRows() < r0 + grid.length - 1) sh.insertRowsAfter(sh.getMaxRows(), r0 + grid.length - 1 - sh.getMaxRows());
    if (sh.getMaxColumns() < c0 + w - 1) sh.insertColumnsAfter(sh.getMaxColumns(), c0 + w - 1 - sh.getMaxColumns());
    sh.getRange(r0, c0, grid.length, w).setValues(grid);
    return JSON.stringify({ updatedRows: grid.length });
  }
  if (tool === 'batch_clear_values') {
    (input.ranges || []).forEach(rg => {
      const { name, a1 } = splitRange_(rg), sh = sheetOf_(ss, name);
      const m = a1.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
      if (!m) { sh.getRange(a1).clearContent(); return; }
      const r0 = Number(m[2]), c0 = colNum_(m[1]);
      const r1 = Math.min(m[4] ? Number(m[4]) : r0, sh.getMaxRows()), c1 = Math.min(m[3] ? colNum_(m[3]) : c0, sh.getMaxColumns());
      if (r1 >= r0 && c1 >= c0) sh.getRange(r0, c0, r1 - r0 + 1, c1 - c0 + 1).clearContent();
    });
    return '{}';
  }
  if (tool === 'append_values') {
    const { name } = splitRange_(input.range), sh = sheetOf_(ss, name);
    const vals = (input.values || []).map(r => r.map(v => v === null || v === undefined ? '' : v));
    if (!vals.length) return '{}';
    const w = Math.max(...vals.map(r => r.length)); vals.forEach(r => { while (r.length < w) r.push(''); });
    sh.getRange(sh.getLastRow() + 1, 1, vals.length, w).setValues(vals);
    return JSON.stringify({ appended: vals.length });
  }
  throw new Error('tool_error: 지원하지 않는 기능 ' + tool);
}

/* ===================== AI (Anthropic API) ===================== */
function aiStatus() { return JSON.stringify({ hasKey: !!PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY') }); }
function setApiKey(key) {   // 처음 한 번만 화면에서 등록 가능 (이후 변경은 Apps Script → 프로젝트 설정 → 스크립트 속성)
  const P = PropertiesService.getScriptProperties();
  if (P.getProperty('ANTHROPIC_API_KEY')) return JSON.stringify({ ok: false, message: '이미 등록돼 있습니다. 바꾸려면 Apps Script → 프로젝트 설정 → 스크립트 속성에서 수정하세요.' });
  key = String(key || '').trim();
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, payload: JSON.stringify({ model: P.getProperty('AI_MODEL_QUICK') || 'claude-haiku-5-5', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }) });
  if (res.getResponseCode() === 401) return JSON.stringify({ ok: false, message: '키가 올바르지 않습니다. 다시 확인해 주세요.' });
  P.setProperty('ANTHROPIC_API_KEY', key);
  return JSON.stringify({ ok: true });
}

function aiCall(reqJson) {
  const req = JSON.parse(reqJson), P = PropertiesService.getScriptProperties();
  const key = P.getProperty('ANTHROPIC_API_KEY');
  if (!key) throw new Error('no_key: [Apps Script → 프로젝트 설정 → 스크립트 속성]에 ANTHROPIC_API_KEY를 넣어주세요');
  const model = req.model || (req.modelTier === 'quick' ? (P.getProperty('AI_MODEL_QUICK') || 'claude-haiku-5-5')
    : req.modelTier === 'complex' ? (P.getProperty('AI_MODEL_COMPLEX') || 'claude-opus-5-5')
    : (P.getProperty('AI_MODEL_DEFAULT') || 'claude-sonnet-5-5'));
  const imgs = (req.images || []).map(im => ({ type: 'image', source: { type: 'base64', media_type: im.mime || 'image/png', data: im.b64 } }));
  let messages;
  if (typeof req.input === 'string') messages = [{ role: 'user', content: imgs.concat([{ type: 'text', text: req.input }]) }];
  else {
    messages = (req.input || []).map(m => ({ role: m.role, content: [{ type: 'text', text: m.content }] }));
    const lastUser = messages.map(m => m.role).lastIndexOf('user');
    if (lastUser >= 0) messages[lastUser].content = imgs.concat(messages[lastUser].content);
  }
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: model, max_tokens: req.maxTokens || 16000, messages: messages })
  });
  const code = res.getResponseCode(), body = res.getContentText();
  if (code === 429 || code === 529) throw new Error('rate_limited: 요청이 많습니다. 잠시 후 다시 시도해 주세요');
  if (code === 401) throw new Error('no_key: API 키가 올바르지 않습니다 (스크립트 속성 ANTHROPIC_API_KEY 확인)');
  if (code === 413 || /prompt is too long/i.test(body)) throw new Error('prompt_too_large: 내용이 너무 깁니다');
  if (code >= 400) throw new Error('api_error: ' + code + ' ' + body.slice(0, 300));
  const out = JSON.parse(body);
  const text = (out.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  return JSON.stringify({ text: text, truncated: out.stop_reason === 'max_tokens', model: out.model });
}

/* ===================== 파일 저장 (다운로드가 막힐 때 드라이브에 저장) ===================== */
function saveToDrive(name, b64, mime) {
  const blob = Utilities.newBlob(Utilities.base64Decode(b64), mime || 'application/octet-stream', name);
  const file = DriveApp.createFile(blob);
  return file.getUrl();
}
