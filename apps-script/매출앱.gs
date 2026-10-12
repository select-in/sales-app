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
  CACHE_KEY: 'drData_v2'
};

/* ───────── 앱 API (POST) ─────────
 * 앱 화면(GitHub Pages, select-in/sales-app)이 이 웹앱 주소로 요청합니다.
 *  - {action:'login', password}  → 비밀번호가 맞으면 90일짜리 로그인 토큰 발급
 *  - {action:'data', token, force} → 토큰이 유효하면 매출 데이터(JSON)
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
  return drOut_(JSON.stringify({ error: 'bad request' }));
}

function drOut_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

function drWithRole_(json, role) {
  var d = JSON.parse(json); d.role = role; return JSON.stringify(d);
}

/** 공유용: 입금예정(입금예정일·정산예정액)과 거래처명 제거 */
function drForShare_(json) {
  var d = JSON.parse(json);
  d.role = 'share';
  d.daily = d.daily.map(function (r) {
    var x = r.slice(); x[7] = 0; x[9] = ''; x[10] = 0; return x;
  });
  if (d.tax) d.tax = d.tax.map(function (t) { var x = t.slice(); x[1] = ''; return x; });
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
  var m = String(v || '').trim().match(/^(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/);
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
  var daily = [];
  t.rows.forEach(function (r) {
    var d = drYmd_(col(r, '날짜'));
    if (!d) return;
    var corp = String(col(r, '법인')).trim();
    if (DR.EXCLUDE_CORP.indexOf(corp) >= 0) return;
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
    live: drLive_(ss, today)
  };
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
  });
  if (o.sales == null) return null;
  o.isToday = o.date === today;
  return o;
}
