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

/* ───────── 데이터 API 진입점 ─────────
 * 앱 화면은 Cloudflare(sales-app)에 있고, 이 스크립트는 데이터(JSON)만 내려줍니다.
 * API 키가 맞는 요청에만 응답합니다. 키는 drSetupApiKey()를 한 번 실행해 만듭니다.
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var key = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!key || p.key !== key) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(drData(p.force === '1'))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 한 번만 실행: API 키 생성 → 실행 로그에 나온 키를 Cloudflare 설정(GAS_KEY)에 붙여넣기 */
function drSetupApiKey() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('API_KEY');
  if (!key) {
    key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    props.setProperty('API_KEY', key);
  }
  Logger.log('API_KEY = ' + key);
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
