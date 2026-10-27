/**
 * 셀렉트인 매출 앱 (웹앱) — 서버 코드 v2 (고속)
 * - 시트를 한 번 읽어 압축 데이터로 내려주고, 날짜별 계산은 화면(폰)에서 처리
 * - 서버 캐시(10분) + 10분마다 미리 데우는 트리거로 첫 화면을 빠르게
 * 데이터 원천: '일별입력'(확정 매출), '공구입력', '오늘현황'(실시간)
 */
var DR = {
  SPREADSHEET_ID: '1TSYSFjgcqo1Gu1Ryq9CHjdNN1Fm1QYmASKlV77xsjl0',
  TZ: 'Asia/Seoul',
  SHEET_DAILY: '일별입력',
  SHEET_GB: '공구입력',
  SHEET_TODAY: '오늘현황',
  EXCLUDE_CORP: ['제외'],
  MAIN_CORPS: ['겐더샵', '셀렉트인'],
  KEEP_DAYS: 120,      // 앱으로 내려보낼 기간(일). 입금 예정이 남은 행은 기간과 상관없이 포함
  CACHE_SEC: 900,      // 서버 캐시 유지 시간(초)
  CACHE_KEY: 'drData_v2',
  // 통합 탭용 외부 시트 (읽기만)
  GB_PLAN_ID: '1rHbpjZa12ZDfw2OQXLSdd0QexqqXrv2xxjTo0egYtOs',   // 정산(일정) 공동구매 — '일정' 탭
  ORDER_ID: '1HdpGTQ_5BXBAPRPYcFuL32xdzfCaQ6MYWf9xyFjwMGU',     // MASTER_오더 — '마스터'·'오더요청' 탭
  EVENT_ID: '1Vaor2PUoVdXILJJLQ2l9pnEnZNVcHbn0SqKeLdLTMDw',     // 공통) B2C 행사/관리 — '겐)행사 리스트'·'셀)행사 리스트'
  OWNER_SHORT: { '엄지희': '엄', '김혜린': '린', '김승현': '승' }
};

/* ───────── 앱 API (POST) ─────────
 * 앱 화면(GitHub Pages, select-in/sales-app)이 이 웹앱 주소로 요청합니다.
 *  - {action:'login', password}  → 비밀번호가 맞으면 90일짜리 로그인 토큰 발급
 *  - {action:'data', token, force} → 토큰이 유효하면 매출 데이터(JSON) + 메모
 *  - {action:'memo_add', token, date, target, text} / {action:'memo_del', token, id} → 앱 메모 (관리자·공유 모두)
 * 비밀번호 2종 (프로젝트 설정 > 스크립트 속성):
 *  - DR_PASSWORD        관리자: 전체 데이터
 *  - DR_SHARE_PASSWORD  공유(직원·외부): 입금예정·거래처명 제외 (서버에서 아예 빼고 보냄)
 * 각 비밀번호를 바꾸면 그 등급의 기존 로그인만 해제됩니다.
 * (이 프로젝트에서 doPost는 이 파일에만 있어야 합니다)
 */
var DR_AUTH = { SESSION_DAYS: 90, MAX_FAIL: 10, LOCK_SEC: 900 };
var DR_ROLES = { admin: 'DR_PASSWORD', share: 'DR_SHARE_PASSWORD' };

function doPost(e) {
  var req = {};
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) {}
  if (req.action === 'login') return drOut_(JSON.stringify(drLogin_(req.password)));
  if (req.action === 'data') {
    var role = drVerify_(req.token);
    if (!role) return drOut_(JSON.stringify({ error: 'login' }));
    var json = drData(req.force === true);
    return drOut_(role === 'admin' ? drWithRole_(json, 'admin') : drForShare_(json));
  }
  if (req.action === 'memo_add' || req.action === 'memo_del') {
    var mrole = drVerify_(req.token);
    if (!mrole) return drOut_(JSON.stringify({ error: 'login' }));
    return drOut_(JSON.stringify(req.action === 'memo_add' ? drMemoAdd_(req, mrole) : drMemoDel_(req, mrole)));
  }
  return drOut_(JSON.stringify({ error: 'bad request' }));
}

function drOut_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

function drWithRole_(json, role) {
  var d = JSON.parse(json); d.role = role; d.memos = drMemos_(); return JSON.stringify(d);
}

/** 공유용: 입금예정(입금예정일·정산예정액)과 거래처명 제거 */
function drForShare_(json) {
  var d = JSON.parse(json);
  d.role = 'share';
  d.daily = d.daily.map(function (r) {
    var x = r.slice(); x[7] = 0; x[9] = ''; x[10] = 0; return x;
  });
  if (d.tax) d.tax = d.tax.map(function (t) { var x = t.slice(); x[1] = ''; return x; });
  if (d.plan && d.plan.rows) d.plan.rows = d.plan.rows.map(function (r) { var x = r.slice(); x[6] = 0; x[7] = 0; x[8] = ''; x[9] = ''; return x; });
  delete d.alerts;
  d.memos = drMemos_();
  return JSON.stringify(d);
}

/** 처음 1회 실행: 서명키·관리자/공유 비밀번호 생성 + 10분 캐시 트리거 설치. 비밀번호는 실행 로그에 표시 */
function drSetup() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('DR_SECRET')) props.setProperty('DR_SECRET', drRandom_(48));
  if (!props.getProperty('DR_PASSWORD')) props.setProperty('DR_PASSWORD', drRandom_(10));
  if (!props.getProperty('DR_SHARE_PASSWORD')) props.setProperty('DR_SHARE_PASSWORD', drRandom_(10));
  drInstallWarmTrigger();
  Logger.log('관리자 비밀번호(DR_PASSWORD): ' + props.getProperty('DR_PASSWORD'));
  Logger.log('공유 비밀번호(DR_SHARE_PASSWORD): ' + props.getProperty('DR_SHARE_PASSWORD'));
  Logger.log('바꾸려면 프로젝트 설정 > 스크립트 속성에서 값 수정 (그 등급의 기존 로그인만 해제)');
}

function drRandom_(n) {
  var abc = 'abcdefghjkmnpqrstuvwxyz23456789', s = '';
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now());
  while (s.length < n) {
    for (var i = 0; i < bytes.length && s.length < n; i++) s += abc.charAt((bytes[i] + 256) % abc.length);
    bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + s);
  }
  return s;
}

/** 등급별 서명: 키 = 서명키 + 그 등급 비밀번호 */
function drSign_(msg, role) {
  var p = PropertiesService.getScriptProperties();
  var key = (p.getProperty('DR_SECRET') || '') + '|' + role + '|' + (p.getProperty(DR_ROLES[role]) || '');
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(msg, key)).replace(/=+$/, '');
}

function drLogin_(password) {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('drFail') || 0);
  if (fails >= DR_AUTH.MAX_FAIL) return { error: '로그인 시도가 너무 많습니다. 15분 뒤 다시 시도하세요.' };
  var props = PropertiesService.getScriptProperties();
  if (typeof password === 'string' && password) {
    var order = ['admin', 'share'];
    for (var i = 0; i < order.length; i++) {
      var role = order[i], real = props.getProperty(DR_ROLES[role]);
      if (real && drSign_('pw:' + password, role) === drSign_('pw:' + real, role)) {
        var exp = String(Date.now() + DR_AUTH.SESSION_DAYS * 864e5);
        return { token: exp + '.' + role + '.' + drSign_(exp + '.' + role, role), role: role };
      }
    }
  }
  cache.put('drFail', String(fails + 1), DR_AUTH.LOCK_SEC);
  Utilities.sleep(800);
  return { error: '비밀번호가 맞지 않습니다.' };
}

/** 유효하면 등급('admin'|'share'), 아니면 null */
function drVerify_(token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 3 || !DR_ROLES[parts[1]] || Number(parts[0]) < Date.now()) return null;
  if (!PropertiesService.getScriptProperties().getProperty(DR_ROLES[parts[1]])) return null;
  return parts[2] === drSign_(parts[0] + '.' + parts[1], parts[1]) ? parts[1] : null;
}

/** force=true면 캐시를 무시하고 시트를 새로 읽음 */
function drData(force) {
  var cache = CacheService.getScriptCache();
  if (!force) {
    var hit = drCacheGet_(cache);
    if (hit) return hit;
  }
  var json = JSON.stringify(drCollect_());
  drCachePut_(cache, json);
  return json;
}

/** 트리거용: 캐시를 미리 채워 둠 */
function drWarm() { drData(true); }

/** 한 번만 실행: 10분마다 캐시를 데우는 트리거 설치 */
function drInstallWarmTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'drWarm') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('drWarm').timeBased().everyMinutes(10).create();
  drWarm();
}

/* ───────── 캐시 (값 100KB 제한 → 분할 저장) ───────── */
function drCachePut_(cache, json) {
  var size = 90000, parts = {}, n = Math.ceil(json.length / size);
  for (var i = 0; i < n; i++) parts[DR.CACHE_KEY + '_' + i] = json.substr(i * size, size);
  parts[DR.CACHE_KEY + '_n'] = String(n);
  try { cache.putAll(parts, DR.CACHE_SEC); } catch (e) { /* 캐시 실패는 무시 */ }
}

function drCacheGet_(cache) {
  var n = Number(cache.get(DR.CACHE_KEY + '_n'));
  if (!n) return null;
  var keys = [];
  for (var i = 0; i < n; i++) keys.push(DR.CACHE_KEY + '_' + i);
  var got = cache.getAll(keys), out = '';
  for (var j = 0; j < n; j++) {
    if (got[keys[j]] == null) return null;
    out += got[keys[j]];
  }
  return out;
}

/* ───────── 유틸 ───────── */
function drYmd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, DR.TZ, 'yyyy-MM-dd');
  var m = String(v || '').trim().match(/^(\d{4})\s*[-.\/]\s*(\d{1,2})\s*[-.\/]\s*(\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}

function drNum_(v) {
  if (typeof v === 'number') return v;
  var n = Number(String(v == null ? '' : v).replace(/[,\s원]/g, ''));
  return isNaN(n) ? 0 : n;
}

function drAddDays_(ymd, n) {
  var p = ymd.split('-');
  return Utilities.formatDate(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)), 'UTC', 'yyyy-MM-dd');
}

/** '날짜' 헤더 행을 찾아 {rows, idx} 반환 */
function drTable_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 1) return { rows: [], idx: {} };
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var h = -1;
  for (var i = 0; i < Math.min(10, v.length); i++) {
    if (String(v[i][0]).trim() === '날짜') { h = i; break; }
  }
  if (h < 0) return { rows: [], idx: {} };
  var idx = {};
  v[h].forEach(function (c, j) {
    var k = String(c).trim();
    if (k && !(k in idx)) idx[k] = j;
  });
  return { rows: v.slice(h + 1), idx: idx };
}

/* ───────── 수집 (시트 1회 열기) ───────── */
function drCollect_() {
  var ss = SpreadsheetApp.openById(DR.SPREADSHEET_ID);
  var today = Utilities.formatDate(new Date(), DR.TZ, 'yyyy-MM-dd');
  var from = drAddDays_(today, -DR.KEEP_DAYS);

  // 일별입력 → [날짜, 채널그룹, 법인, 플랫폼, 건수, 매출, 수수료, 정산예정, 이익, 입금예정일, 입금확인]
  var t = drTable_(ss, DR.SHEET_DAILY), I = t.idx;
  var col = function (r, k) { return I[k] == null ? '' : r[I[k]]; };
  var daily = [], mon = {}, gbm = {};
  t.rows.forEach(function (r) {
    var d = drYmd_(col(r, '날짜'));
    if (!d) return;
    var corp = String(col(r, '법인')).trim();
    if (DR.EXCLUDE_CORP.indexOf(corp) >= 0) return;
    if (d >= '2025-01-01') {                       // 월별 합계 (기간 분석용, 전체 기간)
      var mk = d.slice(0, 7) + '|' + (corp || '확인필요'), mm = mon[mk] || (mon[mk] = [d.slice(0, 7), corp || '확인필요', 0, 0, 0]);
      mm[2] += drNum_(col(r, '매출액')); mm[3] += drNum_(col(r, '이익')); mm[4] += drNum_(col(r, '주문건수'));
      // 공구 매출 합산: 국세청 공동구매 세금계산서 + 스토어팜 2곳 '공구'
      var ch = String(col(r, '채널')).trim(), mall = String(col(r, '쇼핑몰')).trim(), gi = -1;
      if (ch === '공동구매(셀렉트인)') gi = 1;
      else if (ch === '셀렉트인하우스' && mall.indexOf('공구') >= 0) gi = 3;
      else if (ch === '모아하우스' && mall.indexOf('공구') >= 0) gi = 5;
      if (gi > 0) {
        var gm = gbm[d.slice(0, 7)] || (gbm[d.slice(0, 7)] = [d.slice(0, 7), 0, 0, 0, 0, 0, 0]);
        gm[gi] += drNum_(col(r, '매출액')); gm[gi + 1] += gi === 1 ? 1 : drNum_(col(r, '주문건수'));
      }
    }
    var payDay = drYmd_(col(r, '입금예정일'));
    var paid = String(col(r, '입금확인(Y)')).trim().toUpperCase() === 'Y';
    if (d < from && !(payDay >= today && !paid)) return;
    daily.push([
      d,
      String(col(r, '채널그룹')).trim(),
      corp || '확인필요',
      String(col(r, '플랫폼(자동)') || col(r, '쇼핑몰') || col(r, '채널')).trim(),
      drNum_(col(r, '주문건수')),
      drNum_(col(r, '매출액')),
      drNum_(col(r, '수수료')),
      drNum_(col(r, '정산예정액')),
      drNum_(col(r, '이익')),
      payDay,
      paid ? 1 : 0
    ]);
  });

  // 공구입력 → [날짜, 인플루언서, 브랜드/상품, 건수, 매출]
  var g = drTable_(ss, DR.SHEET_GB), G = g.idx;
  var gcol = function (r, k) { return G[k] == null ? '' : r[G[k]]; };
  var gonggu = [];
  g.rows.forEach(function (r) {
    var d = drYmd_(gcol(r, '날짜'));
    if (!d || d < from) return;
    gonggu.push([
      d,
      String(gcol(r, '인플루언서')).trim() || '(미지정)',
      String(gcol(r, '브랜드/상품')).trim(),
      drNum_(gcol(r, '주문건수')),
      drNum_(gcol(r, '매출액'))
    ]);
  });

  return {
    v: 2,
    today: today,
    generatedAt: Utilities.formatDate(new Date(), DR.TZ, 'MM/dd HH:mm'),
    mainCorps: DR.MAIN_CORPS,
    daily: daily,
    gonggu: gonggu,
    monthly: Object.keys(mon).sort().map(function (k) { return mon[k]; }),   // [월, 법인, 매출, 이익, 건수]
    gbm: Object.keys(gbm).sort().map(function (k) { return gbm[k]; }),       // [월, 국세청공구, 계산서수, 셀하우스공구, 건수, 모아공구, 건수]
    live: drLive_(ss, today),
    alerts: drAlerts_(ss),
    plan: drSafe_(function () { return drGbPlan_(today); }),
    orders: drSafe_(function () { return drOrders_(today); }),
    events: drSafe_(function () { return drEvents_(today); })
  };
}

function drSafe_(fn) { try { return fn(); } catch (e) { return { error: String(e.message || e) }; } }

/** 매출판 '역마진상품'·'원가미등록' 개수 */
function drAlerts_(ss) {
  var o = { neg: 0, negLoss: 0, noCost: 0 };
  var a = ss.getSheetByName('역마진상품');
  if (a && a.getLastRow() >= 4) a.getRange(4, 1, a.getLastRow() - 3, 8).getValues().forEach(function (r) {
    if (String(r[2]).trim()) { o.neg++; o.negLoss += drNum_(r[7]); }
  });
  var b = ss.getSheetByName('원가미등록');
  if (b && b.getLastRow() >= 4) b.getRange(4, 1, b.getLastRow() - 3, 9).getValues().forEach(function (r) {
    if (String(r[1]).trim() && r[8] !== true && String(r[8]).toUpperCase() !== 'TRUE') o.noCost++;
  });
  return o;
}

/** 공구 일정: 지난달 1일 이후 시작 ~ 앞으로. [시작, 종료, 구분, 제목, 셀러, 브랜드, 매출, 셀렉트인수익, 계산서발행, 셀러정산일] */
function drGbPlan_(today) {
  var sh = SpreadsheetApp.openById(DR.GB_PLAN_ID).getSheetByName('일정');
  if (!sh || sh.getLastRow() < 4) return { rows: [] };
  var v = sh.getRange(4, 1, sh.getLastRow() - 3, 27).getValues();
  var p = today.split('-'), from = drAddDays_(p[0] + '-' + p[1] + '-01', -1).slice(0, 8) + '01';
  var rows = [];
  v.forEach(function (r) {
    var ym = String(r[0]).replace(/\D/g, ''), per = String(r[1]).replace(/\s/g, ''), st = String(r[2]).trim();
    var m = per.match(/^(\d{2})(\d{2})-(\d{2})(\d{2})$/);
    if (ym.length !== 6 || !m || !st) return;
    var y = +ym.slice(0, 4), sm = +m[1], em = +m[3];
    if (sm < +ym.slice(4) - 6) y++;                       // 12월 행에 1월 일정 등
    var s = y + '-' + m[1] + '-' + m[2], e = (em < sm ? y + 1 : y) + '-' + m[3] + '-' + m[4];
    if (s < from) return;
    rows.push([s, e, st, String(r[3]).trim(), String(r[4]).trim(), String(r[6]).trim(),
      drNum_(r[13]), drNum_(r[26]), String(r[25]).trim(), r[18] instanceof Date ? Utilities.formatDate(r[18], DR.TZ, 'M/d') : String(r[18]).trim()]);
  });
  rows.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
  return { rows: rows };
}

/** 플랫폼 행사: 지난달 1일 이후 끝나는 것. rows: [시작, 종료, 법인(겐/셀), 담당약칭, 채널, 행사명, 상태] */
function drEvents_(today) {
  var ss = SpreadsheetApp.openById(DR.EVENT_ID), rows = [];
  var p = today.split('-'), from = drAddDays_(p[0] + '-' + p[1] + '-01', -1).slice(0, 8) + '01';
  [['겐)행사 리스트', '겐'], ['셀)행사 리스트', '셀']].forEach(function (t) {
    var sh = ss.getSheetByName(t[0]);
    if (!sh || sh.getLastRow() < 3) return;
    sh.getRange(3, 1, sh.getLastRow() - 2, 7).getValues().forEach(function (r) {
      var s = drYmd_(r[5]), e = drYmd_(r[6]) || s;
      if (!s || e < from || !String(r[3]).trim()) return;
      var ow = String(r[1]).trim();
      rows.push([s, e, t[1], DR.OWNER_SHORT[ow] || ow, String(r[2]).trim(), String(r[3]).trim(), String(r[4]).trim()]);
    });
  });
  rows.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
  return { rows: rows };
}

/** 쉬핑일 문구 → 비교용 날짜 ('2026년 10월 중순' → 2026-10-15) */
function drShipKey_(t) {
  t = String(t || '');
  var d = drYmd_(t); if (d) return d;
  var m = t.match(/(\d{4})\s*년\s*(\d{1,2})\s*월/); if (!m) return '';
  var day = /초/.test(t) ? '05' : /중/.test(t) ? '15' : /말/.test(t) ? '28' : '01';
  return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + day;
}

/** 미입고 오더 + 오더요청 미처리 건수. rows: [오더일, 업체, 브랜드, 파일명, 오더수량, 실입고, 쉬핑일, 쉬핑키] */
function drOrders_(today) {
  var ss = SpreadsheetApp.openById(DR.ORDER_ID), out = { rows: [], reqPending: 0 };
  var sh = ss.getSheetByName('마스터');
  if (sh && sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues().forEach(function (r) {
    if (!String(r[0]).trim() || String(r[8]).trim() === '유') return;
    out.rows.push([drYmd_(r[2]), String(r[1]).trim(), String(r[3]).trim(), String(r[0]).replace(/\.xlsx$/i, '').trim(),
      String(r[5]).trim(), String(r[6]).trim(), String(r[7]).trim(), drShipKey_(r[7])]);
  });
  out.rows.sort(function (a, b) { var x = a[7] || '9999', y = b[7] || '9999'; return x < y ? -1 : x > y ? 1 : 0; });
  var rq = ss.getSheetByName('오더요청');
  if (rq && rq.getLastRow() >= 2) rq.getRange(2, 1, rq.getLastRow() - 1, 10).getValues().forEach(function (r) {
    if (drNum_(r[8]) > 0 && String(r[9]).trim() !== '처리완료' && String(r[9]).trim() !== '완료') out.reqPending++;
  });
  return out;
}

/** '오늘현황' 상단 요약(실시간) */
function drLive_(ss, today) {
  var sh = ss.getSheetByName(DR.SHEET_TODAY);
  if (!sh || sh.getLastRow() < 1) return null;
  var tz = ss.getSpreadsheetTimeZone();
  var v = sh.getRange(1, 1, Math.min(15, sh.getLastRow()), 6).getValues();
  var hm = function (x) { return x instanceof Date ? Utilities.formatDate(x, tz, 'HH:mm') : String(x || ''); };
  var o = {};
  v.forEach(function (r) {
    var k = String(r[0]).trim();
    if (k === '오늘') o.date = drYmd_(r[1]);
    else if (k.indexOf('주문 매출') === 0) {
      o.gs = drNum_(r[1]); o.si = drNum_(r[2]); o.sales = drNum_(r[3]);
      o.updSabang = hm(r[4]); o.updStore = hm(r[5]);
    }
    else if (k === '주문 건수') o.cnt = drNum_(r[3]);
    else if (k.indexOf('발송 매출') === 0) o.shipSales = drNum_(r[3]);
    else if (k === '발송 건수') o.shipCnt = drNum_(r[3]);
    else if (k.indexOf('수집 수량') === 0) { o.colGs = drNum_(r[1]); o.colSi = drNum_(r[2]); o.colQty = drNum_(r[3]); }
  });
  if (o.sales == null) return null;
  o.isToday = o.date === today;
  return o;
}

/* ───────── 앱 메모 ('앱메모' 탭) ─────────
 * A 날짜(yyyy-MM-dd) · B 대상(빈칸=전체, 사이트명·인플루언서명 등) · C 내용 · D 작성(관리자/공유) · E 작성시각 · F ID
 * 메모는 캐시하지 않고 매번 시트에서 읽음 (작고 바로 보여야 하므로)
 * 공유 등급은 공유 등급이 쓴 메모만 지울 수 있음. 시트에서 직접 고치거나 지워도 됨.
 */
var DR_MEMO = { SHEET: '앱메모', MAX_LEN: 500, MAX_TARGET: 40, KEEP: 1500 };
var DR_ROLE_LABEL = { admin: '관리자', share: '공유' };

function drMemoSheet_(create) {
  var ss = SpreadsheetApp.openById(DR.SPREADSHEET_ID);
  var sh = ss.getSheetByName(DR_MEMO.SHEET);
  if (!sh && create) {
    sh = ss.insertSheet(DR_MEMO.SHEET);
    sh.getRange(1, 1, 1, 6).setValues([['날짜', '대상', '내용', '작성', '작성시각', 'ID']]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:F').setNumberFormat('@');
    sh.setColumnWidth(3, 420);
  }
  return sh;
}

/** [[id, 날짜, 대상, 내용, 작성, 작성시각], …] 날짜순 */
function drMemos_() {
  try {
    var sh = drMemoSheet_(false);
    if (!sh || sh.getLastRow() < 2) return [];
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues(), out = [];
    v.forEach(function (r, i) {
      var d = drYmd_(r[0]), t = String(r[2] || '').replace(/^'/, '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !t) return;
      var ts = r[4] instanceof Date ? Utilities.formatDate(r[4], DR.TZ, 'yyyy-MM-dd HH:mm') : String(r[4] || '');
      out.push([String(r[5] || ('row' + (i + 2))), d, String(r[1] || '').trim(), t, String(r[3] || ''), ts]);
    });
    out.sort(function (a, b) { return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : (a[5] < b[5] ? -1 : 1); });
    return out.slice(-DR_MEMO.KEEP);
  } catch (e) { return []; }
}

function drMemoText_(s, max) {
  s = String(s == null ? '' : s).replace(/\r/g, '').trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;   // 수식으로 해석되지 않게
}

function drMemoAdd_(req, role) {
  var d = String(req.date || ''), text = drMemoText_(req.text, DR_MEMO.MAX_LEN), target = drMemoText_(req.target, DR_MEMO.MAX_TARGET);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: '날짜가 올바르지 않습니다' };
  if (!text) return { error: '내용을 입력하세요' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = drMemoSheet_(true);
    var id = Date.now().toString(36) + Utilities.getUuid().slice(0, 4);
    var now = Utilities.formatDate(new Date(), DR.TZ, 'yyyy-MM-dd HH:mm');
    sh.getRange(sh.getLastRow() + 1, 1, 1, 6).setNumberFormat('@').setValues([[d, target, text, DR_ROLE_LABEL[role] || role, now, id]]);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  return { ok: true, memos: drMemos_() };
}

function drMemoDel_(req, role) {
  var id = String(req.id || '');
  if (!id) return { error: '메모를 찾을 수 없습니다' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = drMemoSheet_(false);
    if (!sh || sh.getLastRow() < 2) return { error: '메모를 찾을 수 없습니다' };
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
    for (var i = v.length - 1; i >= 0; i--) {
      if (String(v[i][5] || ('row' + (i + 2))) !== id) continue;
      if (role !== 'admin' && String(v[i][3]) !== DR_ROLE_LABEL[role]) return { error: '관리자가 쓴 메모는 지울 수 없습니다' };
      sh.deleteRow(i + 2);
      SpreadsheetApp.flush();
      return { ok: true, memos: drMemos_() };
    }
  } finally { lock.releaseLock(); }
  return { error: '이미 지워진 메모입니다', memos: drMemos_() };
}

/** 로그인 잠금(비밀번호 10회 오류 → 15분) 즉시 해제: 편집기에서 이 함수 선택 후 실행 */
function drUnlock() {
  CacheService.getScriptCache().remove('drFail');
  Logger.log('로그인 잠금 해제됨');
}
