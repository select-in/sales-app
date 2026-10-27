/**
 * 사방넷API.gs — 사방넷 API(주문 조회) → 데일리 매출판 자동 반영  (Apps Script '일일매출' 프로젝트)
 * 사방넷 API는 등록 IP에서만 호출 가능 → 카페24 중계 서버(relay.php, 셀렉트인 OPS와 같은 중계)를 거쳐 호출
 * 스크립트 속성: SBX_SECRET (사방넷 개발자센터 시크릿) · SBX_RELAY_KEY (중계키, 셀렉트인 OPS의 HUB_RELAY_KEY와 같은 값)
 * 조회 전용: updateOrderStsYn 'N' → 사방넷 주문 상태를 절대 바꾸지 않음
 * - sbSalesDaily  : 최근 7일 중 '일별입력'에 사방넷 행이 없는 날(오늘 제외)을 주문일 기준으로 채움 (매일 10:30, 12:00)
 * - sbSalesToday  : '오늘현황' 13~299행(사방넷 영역)에 오늘 주문/발송/수집 현황 덮어쓰기 (매시)
 * - sbInstallTriggers : 위 트리거 설치 (한 번만 실행)
 * 집계 규칙(기존 크롬 방식과 동일): 취소 상태 제외, 반품·교환 재생성 행(ORG_SB_ORD_NO≠0) 제외, 설정 ③ '제외' ID 제외
 *   건수=주문 줄 수, 매출=ORDER_TOT_AMT 합, 원가=COST_PRICE 합, 수수료(K)는 비움(시트가 수수료율로 계산)
 * (이 파일의 이름은 모두 sb 접두어. 다른 파일에서 sb* 이름 사용 금지)
 */
var SBX = {
  clientCd: 'ebb78d9a-cc14-4849-acfe-53aab0a9c4da',   // 사방넷 개발자센터 앱 코드 (식별자)
  svc: 'mw76946',                                      // 사방넷 서비스코드
  relay: 'https://sln0217.mycafe24.com/sbapi/relay.php'
};
function sbRelay_(payload) {
  payload.relayKey = PropertiesService.getScriptProperties().getProperty('SBX_RELAY_KEY') || '';
  var res = UrlFetchApp.fetch(SBX.relay, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
  var t = res.getContentText();
  try { return JSON.parse(t); } catch (e) { return { error: 'relay_http_' + res.getResponseCode(), raw: t.slice(0, 300) }; }
}
function sbToken_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('sbx_tok');
  if (hit) return hit;
  var secret = PropertiesService.getScriptProperties().getProperty('SBX_SECRET');
  if (!secret) throw new Error('스크립트 속성 SBX_SECRET 이 없습니다');
  var r = sbRelay_({ action: 'token', mode: 'PRODUCTION', clientCd: SBX.clientCd, secret: secret });
  if (!r.ok || !r.body || !r.body.access_token) throw new Error('사방넷 토큰 발급 실패: ' + JSON.stringify(r.body || r).slice(0, 300));
  cache.put('sbx_tok', r.body.access_token, Math.max(60, Math.min(21600, (Number(r.body.expires_in) || 10800) - 1900)));
  return r.body.access_token;
}
function sbCall_(method, path, body) {
  var r = sbRelay_({ action: 'call', mode: 'PRODUCTION', token: sbToken_(), svc: SBX.svc, method: method, path: path, body: body == null ? null : body });
  if (r.status === 401) CacheService.getScriptCache().remove('sbx_tok');
  if (!r.ok) throw new Error('사방넷 API 오류 ' + (r.status || '') + ' ' + JSON.stringify(r.body || r.error || r).slice(0, 400));
  return r.body;
}
var SBS = {
  SHEET_ID: '1TSYSFjgcqo1Gu1Ryq9CHjdNN1Fm1QYmASKlV77xsjl0',
  TZ: 'Asia/Seoul',
  BACK_DAYS: 7,
  NOTE: '사방넷 API(주문일), 취소·재생성행 제외',
  COND: { ORDER: 2, REG: 1, SEND: 7 },     // 사방넷 API dateSearchCondition: 2 주문일 · 1 수집일 · 7 출고(발송)일
  ITEMS: ['SB_ORD_NO', 'ORDER_STATUS', 'ORDER_DT', 'SHOP_NM', 'SHOP_LOGIN_ID', 'ORDER_TOT_AMT', 'COST_PRICE', 'ORD_CNT', 'ORG_SB_ORD_NO']
};

function sbFetch_(cond, d1, d2) {
  var all = [], page = 1;
  while (page <= 50) {
    var r = sbCall_('POST', '/v3/sb/order', {
      dateSearchCondition: cond, startDate: d1.replace(/-/g, ''), endDate: d2.replace(/-/g, ''),
      updateOrderStsYn: 'N', page: page, perPage: 1000, responseItems: SBS.ITEMS
    });
    var dt = (r && r.data) || {};
    all = all.concat(dt.results || []);
    if (!dt.hasNext) break;
    page++;
  }
  return all;
}

/** 설정 ③ 쇼핑몰ID → 법인 ('제외' 포함) */
function sbCorpMap_(ss) {
  var m = {};
  ss.getSheetByName('설정').getRange('A57:B120').getValues().forEach(function (r) {
    var id = String(r[0]).trim(); if (id) m[id] = String(r[1]).trim();
  });
  return m;
}

function sbKeep_(x, corp) {
  if (/CANCEL/i.test(String(x.ORDER_STATUS))) return false;
  if (x.ORG_SB_ORD_NO && String(x.ORG_SB_ORD_NO) !== '0') return false;
  return corp[String(x.SHOP_LOGIN_ID || '').trim()] !== '제외';
}

/** 쇼핑몰+ID별 [쇼핑몰, ID, 건수, 매출, 원가, 수량] */
function sbGroup_(rows, corp) {
  var g = {}, order = [];
  rows.forEach(function (x) {
    if (!sbKeep_(x, corp)) return;
    var nm = String(x.SHOP_NM || '').trim(), id = String(x.SHOP_LOGIN_ID || '').trim(), k = nm + '|' + id;
    if (!g[k]) { g[k] = [nm, id, 0, 0, 0, 0]; order.push(k); }
    g[k][2]++; g[k][3] += Number(x.ORDER_TOT_AMT) || 0; g[k][4] += Number(x.COST_PRICE) || 0; g[k][5] += Number(x.ORD_CNT) || 1;
  });
  return order.map(function (k) { return g[k]; });
}

function sbIdText_(id) { return /^\d+$/.test(id) ? "'" + id : id; }
function sbYmd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SBS.TZ, 'yyyy-MM-dd');
  var m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : '';
}
function sbDay_(offset) { return Utilities.formatDate(new Date(Date.now() + offset * 864e5), SBS.TZ, 'yyyy-MM-dd'); }

/** 최근 7일 중 사방넷 행이 없는 날을 채움 (오늘 제외). 이미 있는 날은 건드리지 않음 */
function sbSalesDaily() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return;
  try {
    var ss = SpreadsheetApp.openById(SBS.SHEET_ID), sh = ss.getSheetByName('일별입력');
    var corp = sbCorpMap_(ss);
    var v = sh.getRange(3, 1, 10000, 2).getValues(), have = {}, last = 0;
    v.forEach(function (r, i) { if (r[0] !== '') { last = i; if (String(r[1]).trim() === '사방넷') have[sbYmd_(r[0])] = 1; } });
    var added = [], newIds = {};
    for (var k = SBS.BACK_DAYS; k >= 1; k--) {
      var d = sbDay_(-k);
      if (have[d]) continue;
      var rows = sbGroup_(sbFetch_(SBS.COND.ORDER, d, d), corp);
      if (!rows.length) continue;
      var at = last + 4;   // 마지막 값 행 바로 아래 (시트 행 번호)
      sh.getRange(at, 1, rows.length, 4).setValues(rows.map(function (g) { return [d, '사방넷', g[0], sbIdText_(g[1])]; }));
      sh.getRange(at, 7, rows.length, 3).setValues(rows.map(function (g) { return [g[2], g[3], g[4]]; }));
      sh.getRange(at, 20, rows.length, 1).setValues(rows.map(function () { return [SBS.NOTE]; }));
      last += rows.length;
      rows.forEach(function (g) { if (!corp[g[1]]) newIds[g[0] + ' ' + g[1]] = 1; });
      added.push(d + ' ' + rows.length + '행 ' + rows.reduce(function (a, g) { return a + g[3]; }, 0) + '원');
    }
    PropertiesService.getScriptProperties().setProperty('SBS_LAST_DAILY', sbNow_() + ' ' + (added.join(' / ') || '추가 없음') + (Object.keys(newIds).length ? ' · 새 ID: ' + Object.keys(newIds).join(', ') : ''));
    Logger.log(PropertiesService.getScriptProperties().getProperty('SBS_LAST_DAILY'));
  } finally { lock.releaseLock(); }
}

/** 오늘 실시간: '오늘현황' A13:I299 (사방넷 영역) 덮어쓰기 */
function sbSalesToday() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return;
  try {
    var ss = SpreadsheetApp.openById(SBS.SHEET_ID), sh = ss.getSheetByName('오늘현황');
    var corp = sbCorpMap_(ss), t = sbDay_(0), now = sbNow_(), out = [];
    var line = function (label, g, qty) {
      return [label, '사방넷', corp[g[1]] || '확인필요', g[0], sbIdText_(g[1]), g[2], qty ? g[5] : g[3], now, t];
    };
    sbGroup_(sbFetch_(SBS.COND.ORDER, t, t), corp).forEach(function (g) { out.push(line('주문', g)); });
    sbGroup_(sbFetch_(SBS.COND.SEND, t, t), corp).forEach(function (g) { out.push(line('발송', g)); });
    var byCorp = {};
    sbGroup_(sbFetch_(SBS.COND.REG, t, t), corp).forEach(function (g) {
      var c = corp[g[1]] || '확인필요', o = byCorp[c] || (byCorp[c] = [0, 0]); o[0] += g[2]; o[1] += g[5];
    });
    Object.keys(byCorp).forEach(function (c) { out.push(['수집', '사방넷', c, '전체(수량)', '', byCorp[c][0], byCorp[c][1], now, t]); });
    sh.getRange('A13:I299').clearContent();
    if (out.length) sh.getRange(13, 1, Math.min(out.length, 287), 9).setValues(out.slice(0, 287));
    PropertiesService.getScriptProperties().setProperty('SBS_LAST_TODAY', now + ' ' + out.length + '행');
  } finally { lock.releaseLock(); }
}

function sbNow_() { return Utilities.formatDate(new Date(), SBS.TZ, 'yyyy-MM-dd HH:mm'); }

/** 한 번만 실행: 매일 10:30·12:00 어제분, 매시 오늘 현황 */
function sbInstallTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['sbSalesDaily', 'sbSalesToday'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sbSalesDaily').timeBased().atHour(10).nearMinute(30).everyDays(1).inTimezone(SBS.TZ).create();
  ScriptApp.newTrigger('sbSalesDaily').timeBased().atHour(12).nearMinute(5).everyDays(1).inTimezone(SBS.TZ).create();
  ScriptApp.newTrigger('sbSalesToday').timeBased().everyHours(1).create();
  Logger.log('트리거 설치 완료');
}
