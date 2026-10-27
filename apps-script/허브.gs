/**
 * 셀렉트인 OPS (통합 운영 앱) — 서버 코드
 *
 * 화면: docs/hub/ (GitHub Pages, https://select-in.github.io/sales-app/hub/)
 * 데이터: 이 스크립트가 붙은 구글 시트 '셀렉트인 OPS DB' (탭: 상품·재고이력·원가이력·직원·설정)
 *
 * 기존 프로그램(매출앱.gs, 운영프로그램_Code.gs)과 완전히 별개의 새 Apps Script 프로젝트입니다.
 * 기존 시트·스크립트는 읽지도 쓰지도 않습니다.
 *
 * 처음 한 번
 *  1) 구글 드라이브에서 새 스프레드시트 '셀렉트인 OPS DB' 만들기
 *  2) 확장 프로그램 → Apps Script → 이 파일 내용 붙여넣기 → 저장
 *  3) 함수 목록에서 hubSetup 실행 → 실행 로그에 관리자 PIN 표시
 *  4) 배포 → 새 배포 → 웹 앱 / 실행: 나 / 액세스: 모든 사용자 → …/exec 주소를 docs/hub/config.js 에 기록
 *
 * 모든 이름에 hub 접두어. 이 프로젝트의 doPost는 이 파일에만 있어야 합니다.
 */

var HUB_TABS = {
  상품: ['id', 'SKU', '바코드', '상품명', '브랜드', '옵션', '법인', '구분', '원가', '판매가', '재고', '안전재고', '위치', '메모', '수정일', '수정자', '사방넷상품코드', '단품코드', '이미지', '사방넷상태', '카테고리', '등록상태', '등록정보', '바코드반영대기', '재고관리', '가상재고', '담당자', '연결원본', '상품구분'],
  재고이력: ['일시', '상품id', 'SKU', '상품명', '구분', '수량', '변경후재고', '메모', '작업자'],
  원가이력: ['일시', '상품id', 'SKU', '상품명', '이전원가', '새원가', '작업자'],
  직원: ['이름', '권한', 'PIN', '사용', '등록일'],
  설정: ['키', '값', '수정일', '수정자'],
  채널출고: ['일시', '배치', '채널', '계정', '구분', '상품id', 'SKU', '상품명', '옵션', '바코드', '수량', '주문번호', '판매가', '수수료율', '정산예상', '재고반영', '작업자', '메모'],
  크림입찰: ['계정', '입찰id', '주문번호', '상태', '구분', '품번', '상품명', '브랜드', '옵션', '입찰가', '수수료', '정산예정', '최저판매가', '최근거래가', '등록일', '만료일', '동기화', '내순위', '최저가일반', '최저가보관', '체결가일반', '체결가보관'],
  크림보관: ['계정', '보관id', '주문번호', '단계', '상태', '품번', '상품명', '사이즈', '운송장', '신청일', '수정일', '동기화'],
  크림매핑: ['크림품번', '사방넷상품코드', '컬러', '수정일', '수정자', '사이즈연결'],
  크림판매: ['계정', '주문번호', '입찰id', '상태', '구분', '품번', '상품명', '옵션', '판매가', '수수료', '정산액', '주문일', '정산일', '지급예정일', '동기화']
};
var HUB_P_FIELDS = ['id', 'sku', 'barcode', 'name', 'brand', 'option', 'corp', 'type', 'cost', 'price', 'stock', 'safety', 'loc', 'memo', 'updatedAt', 'updatedBy', 'sbnPrd', 'sbnSku', 'img', 'sbnStatus', 'cat', 'regStatus', 'reg', 'barPending', 'stocMng', 'vstock', 'owner', 'link', 'setDiv'];
var HUB_TOKEN_DAYS = 90;

/* ===================== 진입점 ===================== */
function doPost(e) {
  var req = {};
  try { req = JSON.parse(e.postData.contents || '{}'); } catch (x) { return hubOut_({ error: 'bad_request' }); }
  try {
    if (req.action === 'login') return hubOut_(hubLogin_(req.name, req.pin));
    var me = hubVerify_(req.token);
    if (!me) return hubOut_({ error: 'login' });
    var admin = me.role === '관리자';
    switch (req.action) {
      case 'boot': return hubOut_(hubBoot_(me, req.compact));
      case 'product_save': return hubOut_(hubLocked_(function () { return hubProductSave_(req.p, me); }));
      case 'product_delete': if (!admin) return hubOut_({ error: '관리자만 삭제할 수 있습니다' });
        return hubOut_(hubLocked_(function () { return hubProductDelete_(req.id); }));
      case 'products_import': return hubOut_(hubLocked_(function () { return hubImport_(req.rows, me); }));
      case 'sbn_sync': if (!admin) return hubOut_({ error: '관리자만 사방넷 동기화를 할 수 있습니다' });
        return hubOut_(hubLocked_(function () { return hubSbnSync_(req.rows, me, req.final); }));
      case 'sbn_flags': if (!admin) return hubOut_({ error: '관리자만 사방넷 동기화를 할 수 있습니다' });
        return hubOut_(hubLocked_(function () { return hubSbnFlags_(req.rows, me); }));
      case 'owner_bulk': if (!admin) return hubOut_({ error: '관리자만 담당자를 일괄 변경할 수 있습니다' });
        return hubOut_(hubLocked_(function () { return hubOwnerBulk_(req.rows, me); }));
      case 'channel_ship': return hubOut_(hubLocked_(function () { return hubChannelShip_(req, me); }));
      case 'channel_list': return hubOut_({ rows: hubChannelList_(req.limit || 400) });
      case 'krm_sync': return hubOut_(hubLocked_(function () { return hubKrmSync_(req, me); }));
      case 'krm_list': return hubOut_(hubKrmList_());
      case 'krm_map_set': return hubOut_(hubLocked_(function () { return hubKrmMapSet_(req, me); }));
      case 'sbn_sales_check': if (!admin) return hubOut_({ error: '관리자만 볼 수 있습니다' });   // 사방넷 API(주문일) 기준 일별·법인·쇼핑몰 집계 — 매출판 대조용 (읽기 전용)
        return hubOut_(hubSbnSalesRange_(req.from, req.to));
      case 'sales': return hubOut_(hubSales_(me));
      case 'ops_today': return hubOut_(hubOpsToday_(req.force));
      case 'krm_req': return hubOut_(hubLocked_(function () { hubConfigSet_('krm_req', String(Date.now()), me); return { ok: true }; }));   // 휴대폰에서 [지금 동기화] → PC 크림 창이 받아서 실행
      case 'krm_poll': var kc = hubConfig_(); return hubOut_({ req: kc.krm_req ? Number(kc.krm_req.value) || 0 : 0, by: kc.krm_req ? kc.krm_req.by : '' });
      case 'sbn_get': if (!admin) return hubOut_({ error: '관리자만 조회할 수 있습니다' });   // 읽기 전용 (GET)
        if (!/^\/v3\/sb\/[A-Za-z0-9\/_\-]+(\?[A-Za-z0-9_\-=&%.,:]*)?$/.test(String(req.path || ''))) return hubOut_({ error: 'path_not_allowed' });
        return hubOut_({ ok: true, body: hubSbnCall_('GET', req.path, null, req.mode === 'SANDBOX' ? 'SANDBOX' : 'PRODUCTION') });
      case 'photo_upload': return hubOut_(hubPhotoUpload_(req, me));
      case 'ai_fill': return hubOut_(hubAiFill_(req));
      case 'barsheet_export': return hubOut_(hubLocked_(function () { return hubBarSheetExport_(req, me); }));
      case 'barsheet_match': return hubOut_(hubLocked_(function () { return hubBarSheetMatch_(); }));
      case 'barsheet_apply': return hubOut_(hubLocked_(function () { return hubBarSheetApply_(me); }));
      case 'barcode_set': return hubOut_(hubLocked_(function () { return hubBarcodeSet_(req, me); }));
      case 'reg_send': return hubOut_(hubLocked_(function () { return hubRegSend_(req, me); }));
      case 'sbn_stock_push': return hubOut_(hubSbnStockPush_(req.ids || [], me));
      case 'option_add': return hubOut_(hubLocked_(function () { return hubOptionAdd_(req, me); }));
      case 'reg_save': return hubOut_(hubLocked_(function () { return hubRegSave_(req, me); }));
      case 'stock_move': return hubOut_(hubLocked_(function () { return hubStockMove_(req, me); }));
      case 'history': return hubOut_({ history: hubHistory_(req.id, 300) });
      case 'cost_history': return hubOut_({ costs: hubCostHistory_(req.id) });
      case 'config_set': if (!admin && req.key !== 'scheduler_check') return hubOut_({ error: '관리자만 바꿀 수 있습니다' });
        return hubOut_(hubLocked_(function () { hubConfigSet_(req.key, req.value, me); return { ok: true, config: hubConfig_() }; }));
      case 'users': if (!admin) return hubOut_({ error: '관리자만 볼 수 있습니다' });
        return hubOut_({ users: hubUsers_() });
      case 'user_rename': return hubOut_(hubLocked_(function () { return hubUserRename_(req, me); }));
      case 'user_save': if (!admin) return hubOut_({ error: '관리자만 바꿀 수 있습니다' });
        return hubOut_(hubLocked_(function () { return hubUserSave_(req, me); }));
      default: return hubOut_({ error: 'unknown_action' });
    }
  } catch (err) {
    return hubOut_({ error: String(err && err.message || err) });
  }
}
function doGet() {
  return ContentService.createTextOutput('셀렉트인 OPS 서버가 동작 중입니다. 화면은 https://select-in.github.io/sales-app/hub/ 에서 여세요.');
}
function hubOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function hubLocked_(fn) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ===================== 처음 설정 ===================== */
function hubSetup() {
  var ss = hubBook_();
  Object.keys(HUB_TABS).forEach(function (n) { hubSheet_(n); });
  var first = ss.getSheets()[0];
  if (first && !HUB_TABS[first.getName()] && first.getLastRow() === 0) ss.deleteSheet(first);
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('HUB_SECRET')) p.setProperty('HUB_SECRET', hubRandom_(40));
  var users = hubUsers_();
  if (!users.some(function (u) { return u.role === '관리자'; })) {
    var pin = String(Math.floor(100000 + Math.random() * 900000));
    hubUserSave_({ name: '대표', role: '관리자', pin: pin, active: true }, { name: '설정' });
    Logger.log('관리자 계정이 만들어졌습니다 → 이름: 대표 / PIN: ' + pin + '  (앱 설정 화면에서 바꿀 수 있습니다)');
  } else {
    Logger.log('이미 관리자 계정이 있습니다. PIN을 잊었다면 hubResetAdminPin 을 실행하세요.');
  }
}
/** 관리자 PIN을 새로 발급 (잊어버렸을 때) */
function hubResetAdminPin() {
  var u = hubUsers_().filter(function (x) { return x.role === '관리자'; })[0];
  if (!u) return hubSetup();
  var pin = String(Math.floor(100000 + Math.random() * 900000));
  hubUserSave_({ name: u.name, role: '관리자', pin: pin, active: true }, { name: '설정' });
  Logger.log('관리자 ' + u.name + ' 의 새 PIN: ' + pin);
}

/* ===================== 시트 ===================== */
function hubBook_() {
  var id = PropertiesService.getScriptProperties().getProperty('HUB_DB_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}
function hubSheet_(name) {
  var ss = hubBook_(), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    var head = HUB_TABS[name];
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#e8f5ef');
    sh.setFrozenRows(1);
    if (name === '직원') sh.getRange('C:C').setFontColor('#999999');
  } else if (sh.getLastColumn() < HUB_TABS[name].length) {
    var hd = HUB_TABS[name];
    if (sh.getMaxColumns() < hd.length) sh.insertColumnsAfter(sh.getMaxColumns(), hd.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, hd.length).setValues([hd]).setFontWeight('bold').setBackground('#e8f5ef');
  }
  return sh;
}
function hubRows_(name) {
  var sh = hubSheet_(name), last = sh.getLastRow(), w = HUB_TABS[name].length;
  if (last < 2) return { sh: sh, vals: [] };
  return { sh: sh, vals: sh.getRange(2, 1, last - 1, w).getValues() };
}
function hubNum_(v) { var n = Number(String(v == null ? '' : v).replace(/[,\s원]/g, '')); return isFinite(n) ? n : 0; }
function hubStr_(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 200); }
function hubNow_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'); }
function hubRandom_(n) {
  var c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', s = '';
  for (var i = 0; i < n; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return s;
}

/* ===================== 로그인 ===================== */
function hubHash_(s) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8));
}
function hubSign_(msg, pinHash) {
  var key = (PropertiesService.getScriptProperties().getProperty('HUB_SECRET') || '') + '|' + pinHash;
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(msg, key)).replace(/=+$/, '');
}
function hubUserRow_(name) {
  var r = hubRows_('직원');
  for (var i = 0; i < r.vals.length; i++) if (String(r.vals[i][0]) === name) return { row: i + 2, v: r.vals[i], sh: r.sh };
  return null;
}
function hubLogin_(name, pin) {
  name = hubStr_(name, 30); pin = hubStr_(pin, 30);
  if (!name || !pin) return { error: '이름과 PIN을 입력하세요' };
  var cache = CacheService.getScriptCache(), k = 'hubfail_' + hubHash_(name).slice(0, 20);
  var fails = Number(cache.get(k) || 0);
  if (fails >= 10) return { error: '10회 틀려서 15분간 잠겼습니다. 잠시 후 다시 시도하세요' };
  var u = hubUserRow_(name);
  var ok = u && u.v[3] !== false && String(u.v[3]) !== 'FALSE' && hubHash_(name + '|' + pin) === String(u.v[2]);
  if (!ok) { cache.put(k, String(fails + 1), 900); return { error: '이름 또는 PIN이 맞지 않습니다' }; }
  cache.remove(k);
  var exp = Date.now() + HUB_TOKEN_DAYS * 864e5;
  var body = exp + '.' + Utilities.base64EncodeWebSafe(name, Utilities.Charset.UTF_8).replace(/=+$/, '');
  return { token: body + '.' + hubSign_(body, String(u.v[2])), name: name, role: String(u.v[1]) };
}
function hubVerify_(token) {
  var t = String(token || '').split('.');
  if (t.length !== 3 || Number(t[0]) < Date.now()) return null;
  var pad = t[1] + '==='.slice((t[1].length + 3) % 4);
  var name = Utilities.newBlob(Utilities.base64DecodeWebSafe(pad)).getDataAsString('UTF-8');
  var u = hubUserRow_(name);
  if (!u || u.v[3] === false || String(u.v[3]) === 'FALSE') return null;
  if (hubSign_(t[0] + '.' + t[1], String(u.v[2])) !== t[2]) return null;
  return { name: name, role: String(u.v[1]) };
}
function hubUsers_() {
  return hubRows_('직원').vals.map(function (v) {
    return { name: String(v[0]), role: String(v[1]), active: !(v[3] === false || String(v[3]) === 'FALSE'), createdAt: String(v[4]) };
  }).filter(function (u) { return u.name; });
}
/* 내 이름 바꾸기 — 현재 PIN 확인 후 새 이름으로 (PIN 해시가 이름을 포함하므로 다시 계산), 기록의 작업자 이름도 함께 변경 */
function hubUserRename_(req, me) {
  var to = hubStr_(req.newName, 30), pin = hubStr_(req.pin, 30);
  if (!to) return { error: '새 이름을 입력하세요' };
  if (to === me.name) return { error: '지금 이름과 같아요' };
  var u = hubUserRow_(me.name);
  if (!u || hubHash_(me.name + '|' + pin) !== String(u.v[2])) return { error: '현재 PIN이 맞지 않습니다' };
  if (hubUserRow_(to)) return { error: '이미 있는 이름이에요' };
  hubSheet_('직원').getRange(u.row, 1, 1, 3).setValues([[to, u.v[1], hubHash_(to + '|' + pin)]]);
  [['재고이력', 9], ['원가이력', 7], ['설정', 4], ['상품', 16]].forEach(function (t) {
    var sh = hubSheet_(t[0]), n = sh.getLastRow() - 1;
    if (n < 1) return;
    var rg = sh.getRange(2, t[1], n, 1), v = rg.getValues(), ch = false;
    v.forEach(function (r) { if (String(r[0]) === me.name) { r[0] = to; ch = true; } });
    if (ch) rg.setValues(v);
  });
  return hubLogin_(to, pin);
}
function hubUserSave_(req, me) {
  var name = hubStr_(req.name, 30);
  if (!name) return { error: '이름을 입력하세요' };
  var role = req.role === '관리자' ? '관리자' : '직원';
  var active = req.active !== false;
  var u = hubUserRow_(name);
  var pin = hubStr_(req.pin, 30);
  if (!u && !/^\d{4,8}$/.test(pin)) return { error: '새 직원은 숫자 4~8자리 PIN이 필요합니다' };
  if (pin && !/^\d{4,8}$/.test(pin)) return { error: 'PIN은 숫자 4~8자리로 정하세요' };
  if (u && me.name === name && (!active || role !== '관리자')) return { error: '본인 관리자 권한은 끌 수 없습니다' };
  var hash = pin ? hubHash_(name + '|' + pin) : String(u.v[2]);
  var row = [name, role, hash, active, u ? u.v[4] : hubNow_()];
  var sh = hubSheet_('직원');
  if (u) sh.getRange(u.row, 1, 1, 5).setValues([row]);
  else sh.appendRow(row);
  return { ok: true, users: hubUsers_() };
}

/* ===================== 상품 ===================== */
function hubProductObj_(v) {
  var o = {};
  HUB_P_FIELDS.forEach(function (f, i) { o[f] = v[i] instanceof Date ? Utilities.formatDate(v[i], 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : v[i]; });
  ['cost', 'price', 'stock', 'safety', 'vstock'].forEach(function (f) { o[f] = hubNum_(o[f]); });
  ['id', 'sku', 'barcode', 'sbnPrd', 'sbnSku', 'img', 'sbnStatus', 'cat', 'regStatus', 'reg', 'barPending', 'stocMng', 'owner', 'link', 'setDiv'].forEach(function (f) { o[f] = String(o[f] == null ? '' : o[f]); });
  return o;
}
function hubProducts_() {
  return hubRows_('상품').vals.map(hubProductObj_).filter(function (p) { return p.id; });
}
function hubFindProduct_(id) {
  var r = hubRows_('상품');
  for (var i = 0; i < r.vals.length; i++) if (String(r.vals[i][0]) === String(id)) return { row: i + 2, p: hubProductObj_(r.vals[i]), sh: r.sh };
  return null;
}
function hubClean_(p) {
  return {
    sku: hubStr_(p.sku, 60), barcode: hubStr_(p.barcode, 60), name: hubStr_(p.name, 150), brand: hubStr_(p.brand, 60),
    option: hubStr_(p.option, 80), owner: hubStr_(p.owner, 30), corp: p.corp === '겐더샵' ? '겐더샵' : '셀렉트인', type: p.type === '위탁' ? '위탁' : '사입',
    cost: hubNum_(p.cost), price: hubNum_(p.price), safety: hubNum_(p.safety), loc: hubStr_(p.loc, 40), memo: hubStr_(p.memo, 300)
  };
}
function hubDupCheck_(c, exceptId) {
  var list = hubProducts_();
  for (var i = 0; i < list.length; i++) {
    var p = list[i]; if (p.id === exceptId) continue;
    if (c.barcode && p.barcode === c.barcode && p.corp === c.corp) return '같은 법인에 같은 바코드가 이미 있습니다: ' + p.name;
    if (c.sku && p.sku === c.sku) return '같은 상품코드(SKU)가 이미 있습니다: ' + p.name;
  }
  return '';
}
function hubRow_(o) { return HUB_P_FIELDS.map(function (f) { return o[f] == null ? '' : o[f]; }); }
function hubNewId_() { return 'P' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyMMddHHmmss') + hubRandom_(4); }
function hubProductSave_(raw, me) {
  if (!raw) return { error: 'bad_request' };
  var c = hubClean_(raw);
  if (!c.name) return { error: '상품명을 입력하세요' };
  var hit = raw.id ? hubFindProduct_(raw.id) : null;
  if (c.barcode && (!hit || c.barcode !== hit.p.barcode)) c.barcode = hubCorpBar_(c.corp, c.barcode);
  var dup = hubDupCheck_(c, hit ? hit.p.id : null);
  if (dup) return { error: dup };
  var now = hubNow_(), sh = hubSheet_('상품'), fm = [hubFormats_()];
  if (hit) {
    var p = hit.p;
    if (p.cost !== c.cost) hubSheet_('원가이력').appendRow([now, p.id, c.sku, c.name, p.cost, c.cost, me.name]);
    var o = Object.assign({}, p, c, { updatedAt: now, updatedBy: me.name });
    if (p.sbnPrd && c.barcode !== p.barcode) o.barPending = hubPendingAfter_(p, c.barcode);
    var row = hubRow_(o);
    sh.getRange(hit.row, 1, 1, row.length).setNumberFormats(fm).setValues([row]);
    return { ok: true, product: hubProductObj_(row) };
  }
  var n = Object.assign({ id: hubNewId_(), stock: hubNum_(raw.stock), updatedAt: now, updatedBy: me.name }, c);
  var nrow = hubRow_(n);
  sh.getRange(sh.getLastRow() + 1, 1, 1, nrow.length).setNumberFormats(fm).setValues([nrow]);
  if (n.stock) hubSheet_('재고이력').appendRow([now, n.id, c.sku, c.name, '기초재고', n.stock, n.stock, '상품 등록', me.name]);
  if (c.cost) hubSheet_('원가이력').appendRow([now, n.id, c.sku, c.name, '', c.cost, me.name]);
  return { ok: true, product: hubProductObj_(nrow) };
}
function hubFormats_() {   // id·SKU·바코드는 글자로 저장 (앞자리 0 보존)
  return HUB_P_FIELDS.map(function (f) { return /^(cost|price|stock|safety|vstock)$/.test(f) ? '#,##0' : '@'; });
}
function hubProductDelete_(id) {
  var hit = hubFindProduct_(id);
  if (!hit) return { error: '상품을 찾을 수 없습니다' };
  hit.sh.deleteRow(hit.row);
  return { ok: true };
}
function hubImport_(rows, me) {
  if (!rows || !rows.length) return { error: '가져올 행이 없습니다' };
  if (rows.length > 3000) return { error: '한 번에 3,000행까지 가져올 수 있습니다' };
  var list = hubProducts_(), byKey = {}, now = hubNow_(), added = 0, updated = 0, skipped = 0, logs = [];
  list.forEach(function (p) { if (p.barcode) byKey['b:' + p.barcode] = p; if (p.sku) byKey['s:' + p.sku] = p; });
  var has = function (r, k) { return r[k] !== '' && r[k] != null; };
  rows.forEach(function (raw) {
    var c = hubClean_(raw);
    if (!c.name) { skipped++; return; }
    var hit = (c.barcode && byKey['b:' + c.barcode]) || (c.sku && byKey['s:' + c.sku]);
    if (hit) {
      var before = hit.cost;
      ['sku', 'barcode', 'brand', 'option', 'loc', 'memo'].forEach(function (k) { if (c[k]) hit[k] = c[k]; });
      hit.name = c.name; hit.corp = c.corp; hit.type = c.type;
      ['cost', 'price', 'safety'].forEach(function (k) { if (has(raw, k)) hit[k] = c[k]; });
      hit.updatedAt = now; hit.updatedBy = me.name;
      if (before !== hit.cost) logs.push(['원가이력', [now, hit.id, hit.sku, hit.name, before, hit.cost, me.name]]);
      updated++; return;
    }
    var n = Object.assign({ id: hubNewId_(), stock: hubNum_(raw.stock), updatedAt: now, updatedBy: me.name }, c);
    list.push(n); added++;
    if (c.barcode) byKey['b:' + c.barcode] = n; if (c.sku) byKey['s:' + c.sku] = n;
    if (n.stock) logs.push(['재고이력', [now, n.id, c.sku, c.name, '기초재고', n.stock, n.stock, '엑셀 가져오기', me.name]]);
  });
  hubWriteAll_(list);
  hubWriteLogs_(logs);
  return { ok: true, added: added, updated: updated, skipped: skipped, products: hubProducts_() };
}
function hubWriteAll_(list) {
  var sh = hubSheet_('상품'), fm = hubFormats_(), w = fm.length;
  var rows = list.map(hubRow_);
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, Math.max(w, sh.getLastColumn())).clearContent();
  if (rows.length) {
    if (sh.getMaxRows() < rows.length + 1) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 1 - sh.getMaxRows());
    sh.getRange(2, 1, rows.length, w).setNumberFormats(rows.map(function () { return fm; })).setValues(rows);
  }
}
function hubWriteLogs_(logs) {
  ['재고이력', '원가이력'].forEach(function (tab) {
    var rs = logs.filter(function (l) { return l[0] === tab; }).map(function (l) { return l[1]; });
    if (rs.length) { var s = hubSheet_(tab); s.getRange(s.getLastRow() + 1, 1, rs.length, rs[0].length).setValues(rs); }
  });
}

/* ===================== 사방넷 동기화 =====================
 * 지금: Claude가 사방넷 관리자 화면(로그인)에서 단품 목록을 읽어 앱으로 전달
 * 나중: 사방넷 API로 같은 rows를 만들어 이 함수에 넣으면 그대로 동작 (구조 동일)
 * rows: [{sbnPrd, sbnSku, barcode, name, option, brand, cost, price, stock, vstock, stocMng, safety, img, sbnStatus, corp}]
 *       stocMng: 사방넷 '재고관리 사용' Y/N — N이면 앱에서 가상재고로만 표시(입출고·품절경고·자동반영 제외)
 * 규칙: 사방넷상품코드+단품코드가 같은 상품을 찾아 갱신(없으면 바코드로), 없으면 새로 등록.
 *       재고는 사방넷 현재고로 맞추고 차이는 재고이력에 '사방넷동기화'로 남김.
 *       법인은 사방넷 마이카테고리로 정함: '셀렉트인전용' → 셀렉트인, 그 외 → 겐더샵 (보내는 쪽에서 corp로 계산해 넘김).
 *       앱에서 직접 입력한 위치·메모·구분은 유지.
 */
function hubSbnSync_(rows, me) {
  if (!rows || !rows.length) return { error: '가져올 행이 없습니다' };
  var list = hubProducts_(), byKey = {}, byBar = {}, now = hubNow_(), logs = [], added = 0, updated = 0, stockChanged = 0, mngY = 0, mngN = 0;
  list.forEach(function (p) { if (p.sbnPrd) byKey[p.sbnPrd + '-' + p.sbnSku] = p; if (p.barcode) byBar[p.barcode] = p; });
  rows.forEach(function (r) {
    var key = hubStr_(r.sbnPrd, 30) + '-' + hubStr_(r.sbnSku, 20);
    if (!r.sbnPrd || !r.name) return;
    var bar = hubStr_(r.barcode, 60);
    // 바코드로 찾는 건 앱에서 직접 만든(사방넷 코드 없는) 상품만 — 사방넷 안에 같은 바코드를 쓰는 단품이 있어서
    var byB = bar && byBar[bar];
    var hit = byKey[key] || (byB && !byB.sbnPrd ? byB : null);
    var stock = Math.round(hubNum_(r.stock)), cost = hubNum_(r.cost);
    var mng = r.stocMng === 'N' ? 'N' : r.stocMng === 'Y' ? 'Y' : (hit && hit.stocMng) || '';
    var vst = r.vstock == null || r.vstock === '' ? (hit ? hit.vstock : 0) : Math.round(hubNum_(r.vstock));
    if (mng === 'N') mngN++; else if (mng === 'Y') mngY++;
    if (hit) {
      if (hit.cost !== cost) logs.push(['원가이력', [now, hit.id, hit.sku, hit.name, hit.cost, cost, '사방넷']]);
      if (hit.stock !== stock && mng !== 'N') { logs.push(['재고이력', [now, hit.id, hit.sku, hit.name, '사방넷동기화', stock - hit.stock, stock, '사방넷 현재고로 맞춤', me.name]]); stockChanged++; }
      var keepBar = hit.barPending && bar !== hit.barcode;   // 앱에서 바꾼 바코드가 아직 사방넷에 반영 전이면 앱 값 유지
      if (hit.barPending && bar === hit.barcode) hit.barPending = '';
      Object.assign(hit, {
        sbnPrd: hubStr_(r.sbnPrd, 30), sbnSku: hubStr_(r.sbnSku, 20), barcode: keepBar ? hit.barcode : (bar || hit.barcode), sku: hit.sku || key,
        name: hubStr_(r.name, 150), option: hubStr_(r.option, 80), brand: hubStr_(r.brand, 60) || hit.brand,
        cost: cost, price: hubNum_(r.price), stock: stock, safety: hubNum_(r.safety), img: hubStr_(r.img, 300) || hit.img,
        sbnStatus: hubStr_(r.sbnStatus, 20), cat: hubStr_(r.cat, 60), corp: r.corp === '셀렉트인' ? '셀렉트인' : '겐더샵',
        regStatus: hit.regStatus === '등록요청' ? '등록완료' : hit.regStatus, stocMng: mng, vstock: vst,
        updatedAt: now, updatedBy: '사방넷'
      });
      updated++;
    } else {
      var n = {
        id: hubNewId_(), sku: key, barcode: bar, name: hubStr_(r.name, 150), brand: hubStr_(r.brand, 60), option: hubStr_(r.option, 80),
        corp: r.corp === '셀렉트인' ? '셀렉트인' : '겐더샵', type: '사입', cat: hubStr_(r.cat, 60), cost: cost, price: hubNum_(r.price), stock: stock,
        safety: hubNum_(r.safety), loc: '', memo: '', updatedAt: now, updatedBy: '사방넷',
        sbnPrd: hubStr_(r.sbnPrd, 30), sbnSku: hubStr_(r.sbnSku, 20), img: hubStr_(r.img, 300), sbnStatus: hubStr_(r.sbnStatus, 20), stocMng: mng, vstock: vst, owner: hubStr_(r.owner, 30)
      };
      list.push(n); byKey[key] = n; if (bar && !byBar[bar]) byBar[bar] = n; added++;
    }
  });
  hubWriteAll_(list);
  hubWriteLogs_(logs);
  hubConfigSet_('sbn_sync', '추가 ' + added + ' · 갱신 ' + updated + ' · 재고변경 ' + stockChanged + (mngY + mngN ? ' · 재고관리 ' + mngY + ' / 가상재고 ' + mngN : ''), me);
  return { ok: true, added: added, updated: updated, stockChanged: stockChanged, mngY: mngY, mngN: mngN };
}

/* 재고관리 사용여부·가상재고만 갱신 (다른 값은 건드리지 않음)
 * rows: [{sbnPrd, sbnSku, stocMng:'Y'|'N', vstock, owner}] — owner(사방넷 등록자)는 앱 담당자가 비어 있을 때만 채움 */
function hubSbnFlags_(rows, me) {
  if (!rows || !rows.length) return { error: '가져올 행이 없습니다' };
  var map = {};
  rows.forEach(function (r) { if (r && r.sbnPrd) map[hubStr_(r.sbnPrd, 30) + '-' + hubStr_(r.sbnSku, 20)] = r; });
  var list = hubProducts_(), y = 0, n = 0, hitN = 0, byCorp = {}, ownerSet = 0, costN = 0, priceN = 0, logs = [], now = hubNow_();
  list.forEach(function (p) {
    var r = p.sbnPrd && map[p.sbnPrd + '-' + p.sbnSku];
    if (!r) return;
    hitN++; delete map[p.sbnPrd + '-' + p.sbnSku];
    if (r.stocMng === 'Y' || r.stocMng === 'N') p.stocMng = r.stocMng;
    if (r.vstock != null && r.vstock !== '') p.vstock = Math.round(hubNum_(r.vstock));
    if (r.owner && !p.owner) { p.owner = hubStr_(r.owner, 30); ownerSet++; }
    if (r.link !== undefined) p.link = hubStr_(r.link, 40);
    if (r.setDiv !== undefined) p.setDiv = hubStr_(r.setDiv, 4);
    if (r.cost != null && r.cost !== '') { var nc = hubNum_(r.cost); if (nc !== p.cost) { logs.push(['원가이력', [now, p.id, p.sku, p.name, p.cost, nc, '사방넷']]); p.cost = nc; costN++; } }
    if (r.price != null && r.price !== '') { var np = hubNum_(r.price); if (np !== p.price) { p.price = np; priceN++; } }
    var c = byCorp[p.corp] || (byCorp[p.corp] = { y: 0, n: 0 });
    if (p.stocMng === 'N') { n++; c.n++; } else if (p.stocMng === 'Y') { y++; c.y++; }
  });
  hubWriteAll_(list);
  hubWriteLogs_(logs);
  var missing = Object.keys(map).length;
  hubConfigSet_('sbn_flags', '재고관리 ' + y + ' · 가상재고 ' + n + (missing ? ' · 앱에 없음 ' + missing : ''), me);
  return { ok: true, matched: hitN, y: y, n: n, missing: missing, byCorp: byCorp, ownerSet: ownerSet, costChanged: costN, priceChanged: priceN };
}

/* 담당자 일괄 변경 rows: [{id, owner}] — 담당자 칸만 바꿈 */
function hubOwnerBulk_(rows, me) {
  if (!rows || !rows.length) return { error: '바꿀 행이 없습니다' };
  var m = {}; rows.forEach(function (r) { if (r && r.id) m[String(r.id)] = hubStr_(r.owner, 30); });
  var list = hubProducts_(), n = 0;
  list.forEach(function (p) { if (m.hasOwnProperty(p.id) && p.owner !== m[p.id]) { p.owner = m[p.id]; n++; } });
  hubWriteAll_(list);
  hubConfigSet_('owner_bulk', '담당자 ' + n + '개 변경', me);
  return { ok: true, changed: n };
}

/* ===================== 크림 · 포이즌 출고 =====================
 * 휴대폰으로 바코드를 연속 스캔해 담고 → [출고 확정] 하면
 *  - 현재고 상품은 재고에서 빠지고(재고이력 '출고', 메모에 채널·주문번호), 가상재고 상품은 기록만 남김
 *  - 채널출고 탭에 한 줄씩 기록 (수수료율로 정산 예상 금액 계산)
 * req: {channel:'KREAM'|'POIZON', account:'겐더샵'|'셀렉트인', kind:'일반판매'|'보관판매', memo, items:[{id, qty, orderNo, price}]} */
var HUB_CH_FEE = { KREAM: 0.05, POIZON: 0.10 };
function hubFindByKey_(key) {
  var r = hubRows_('상품'), ip = HUB_P_FIELDS.indexOf('sbnPrd'), is = HUB_P_FIELDS.indexOf('sbnSku');
  for (var i = 0; i < r.vals.length; i++) if (String(r.vals[i][ip]) + '-' + String(r.vals[i][is]) === key) return { row: i + 2, p: hubProductObj_(r.vals[i]), sh: r.sh };
  return null;
}
function hubChannelShip_(req, me) {
  var ch = req.channel === 'POIZON' ? 'POIZON' : 'KREAM';
  var acct = req.account === '셀렉트인' ? '셀렉트인' : '겐더샵';
  var kind = req.kind === '보관판매' ? '보관판매' : '일반판매';
  var items = (req.items || []).filter(function (it) { return it && it.id && Math.round(hubNum_(it.qty)) > 0; });
  if (!items.length) return { error: '출고할 상품이 없습니다' };
  var r = hubRows_('상품'), byId = {};
  var byKey = {};
  r.vals.forEach(function (v, i) { if (v[0]) { var o = { row: i + 2, p: hubProductObj_(v) }; byId[String(v[0])] = o; if (o.p.sbnPrd) byKey[o.p.sbnPrd + '-' + o.p.sbnSku] = o; } });
  items.forEach(function (it) { var h = byId[it.id]; if (h && h.p.link && byKey[h.p.link]) { it.via = h.p.sbnPrd + '-' + h.p.sbnSku; it.id = byKey[h.p.link].p.id; } });
  var miss = items.filter(function (it) { return !byId[it.id]; });
  if (miss.length) return { error: '앱에서 찾을 수 없는 상품이 있어요 (' + miss.length + '개)' };
  var now = hubNow_(), batch = Utilities.formatDate(new Date(), 'Asia/Seoul', 'MMdd-HHmmss'), fee = HUB_CH_FEE[ch];
  var stockCol = HUB_P_FIELDS.indexOf('stock') + 1, logs = [], out = [], changed = [];
  items.forEach(function (it) {
    var h = byId[it.id], p = h.p, q = Math.round(hubNum_(it.qty)), price = hubNum_(it.price);
    var real = p.stocMng !== 'N' && p.type !== '위탁';
    var memo = ch + ' ' + kind + (it.orderNo ? ' · ' + hubStr_(it.orderNo, 60) : '') + (it.via ? ' · 모음전 ' + it.via : '') + ' · 배치 ' + batch;
    if (real) {
      p.stock = p.stock - q;
      r.sh.getRange(h.row, stockCol).setValue(p.stock);
      r.sh.getRange(h.row, 15, 1, 2).setValues([[now, me.name]]);
      logs.push([now, p.id, p.sku, p.name, '출고', -q, p.stock, memo, me.name]);
      changed.push(p);
    }
    out.push([now, batch, ch, acct, kind, p.id, p.sku, p.name, p.option, p.barcode, q, hubStr_(it.orderNo, 60), price || '', fee, price ? Math.round(price * q * (1 - fee)) : '', real ? '재고 -' + q : '가상재고(기록만)', me.name, hubStr_(req.memo, 200)]);
  });
  if (logs.length) { var hs = hubSheet_('재고이력'); hs.getRange(hs.getLastRow() + 1, 1, logs.length, logs[0].length).setValues(logs); }
  var cs = hubSheet_('채널출고'); cs.getRange(cs.getLastRow() + 1, 1, out.length, out[0].length).setValues(out);
  return {
    ok: true, batch: batch, count: out.length, qty: out.reduce(function (a, o) { return a + o[10]; }, 0),
    products: changed, moves: logs.map(function (l) { return { at: l[0], id: l[1], sku: l[2], name: l[3], type: l[4], qty: l[5], after: l[6], memo: l[7], by: l[8] }; })
  };
}
function hubChannelList_(limit) {
  var r = hubRows_('채널출고'), H = ['at', 'batch', 'channel', 'account', 'kind', 'id', 'sku', 'name', 'option', 'barcode', 'qty', 'orderNo', 'price', 'fee', 'settle', 'stockNote', 'by', 'memo'];
  return r.vals.slice(-Math.min(2000, limit)).reverse().map(function (v) {
    var o = {}; H.forEach(function (k, i) { o[k] = v[i] instanceof Date ? Utilities.formatDate(v[i], 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : v[i]; }); return o;
  });
}

/* ===================== 크림 판매자센터 연동 =====================
 * 크림 판매자센터 화면에서 kream.js(북마크)가 읽어온 데이터를 받아 저장
 *  - 크림입찰: 계정별 「입찰중」 스냅샷 (매번 통째로 교체)
 *  - 크림판매: 진행중(발송·검수)·정산 내역 — 계정+주문번호 기준으로 갱신/추가
 * req: {account, asks:[...]|null, sales:[...]} */
var HUB_KRM_A = ['account', 'askId', 'oid', 'status', 'kind', 'style', 'name', 'brand', 'option', 'price', 'fee', 'payout', 'lowest', 'last', 'createdAt', 'expiresAt', 'syncedAt', 'rank', 'lowN', 'lowI', 'lastN', 'lastI'];
var HUB_KRM_I = ['account', 'invId', 'oid', 'stage', 'status', 'style', 'name', 'option', 'tracking', 'requestedAt', 'updatedAt', 'syncedAt'];
var HUB_KRM_S = ['account', 'oid', 'askId', 'status', 'kind', 'style', 'name', 'option', 'price', 'fee', 'payout', 'orderedAt', 'settledAt', 'payoutDate', 'syncedAt'];
function hubKrmRow_(o, keys, acct, now) {
  return keys.map(function (k) {
    if (k === 'account') return acct; if (k === 'syncedAt') return now;
    var v = o[k]; if (v == null) return '';
    return typeof v === 'number' ? v : hubStr_(v, 200);
  });
}
function hubKrmSync_(req, me) {
  var acct = req.account === '셀렉트인' ? '셀렉트인' : '겐더샵', now = hubNow_(), res = { ok: true, account: acct };
  if (Array.isArray(req.inv)) {   // 보관판매: 발송 필요·입고 대기 스냅샷 (계정별 통째 교체)
    var bv = hubRows_('크림보관'), keepB = bv.vals.filter(function (v) { return v[0] !== acct; }), wB = HUB_TABS['크림보관'].length;
    var addB = req.inv.map(function (o) { return hubKrmRow_(o, HUB_KRM_I, acct, now); });
    var allB = keepB.concat(addB);
    if (bv.vals.length) bv.sh.getRange(2, 1, bv.vals.length, wB).clearContent();
    if (allB.length) bv.sh.getRange(2, 1, allB.length, wB).setValues(allB);
    res.inv = addB.length;
    if (req.invCount && typeof req.invCount === 'object') hubConfigSet_('krm_invcnt_' + acct, JSON.stringify(req.invCount), me);
  }
  if (Array.isArray(req.asks)) {
    var a = hubRows_('크림입찰'), keep = a.vals.filter(function (v) { return v[0] !== acct; });
    var add = req.asks.map(function (o) { return hubKrmRow_(o, HUB_KRM_A, acct, now); });
    var all = keep.concat(add), w = HUB_TABS['크림입찰'].length;
    if (a.vals.length) a.sh.getRange(2, 1, a.vals.length, w).clearContent();
    if (all.length) a.sh.getRange(2, 1, all.length, w).setValues(all);
    res.asks = add.length;
  }
  if (Array.isArray(req.sales) && req.sales.length) {
    var s = hubRows_('크림판매'), idx = {}, w2 = HUB_TABS['크림판매'].length, upd = 0, ins = [];
    s.vals.forEach(function (v, i) { idx[v[0] + '|' + v[1]] = i; });
    req.sales.forEach(function (o) {
      if (!o || !o.oid) return;
      var row = hubKrmRow_(o, HUB_KRM_S, acct, now), k = acct + '|' + row[1], i = idx[k];
      var merge = function (old) { return row.map(function (v, j) { return v === '' ? old[j] : v; }); };   // 비어 있는 값은 기존 값 유지 (정산 내역 ↔ 진행 내역 합치기)
      if (i != null && i >= 0) { s.vals[i] = merge(s.vals[i]); upd++; }
      else if (i != null) { ins[-i - 1] = merge(ins[-i - 1]); }
      else { ins.push(row); idx[k] = -ins.length; }
    });
    if (s.vals.length) s.sh.getRange(2, 1, s.vals.length, w2).setValues(s.vals);
    if (ins.length) s.sh.getRange(s.vals.length + 2, 1, ins.length, w2).setValues(ins);
    res.salesUpdated = upd; res.salesAdded = ins.length;
  }
  hubConfigSet_('krm_synced_' + acct, now, me);
  return res;
}
function hubKrmList_() {
  var fmt = function (v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : v; };
  var a = hubRows_('크림입찰').vals.map(function (v) { var o = {}; HUB_KRM_A.forEach(function (k, i) { o[k] = fmt(v[i]); }); return o; });
  var s = hubRows_('크림판매').vals.map(function (v) { var o = {}; HUB_KRM_S.forEach(function (k, i) { o[k] = fmt(v[i]); }); return o; });
  var c = hubConfig_(), synced = {};
  ['겐더샵', '셀렉트인'].forEach(function (n) { var x = c['krm_synced_' + n]; if (x) synced[n] = x.value; });
  var inv = hubRows_('크림보관').vals.map(function (v) { var o = {}; HUB_KRM_I.forEach(function (k, i) { o[k] = fmt(v[i]); }); return o; }), invCount = {};
  ['겐더샵', '셀렉트인'].forEach(function (n) { var x = c['krm_invcnt_' + n]; if (x) try { invCount[n] = JSON.parse(x.value); } catch (e) {} });
  return { asks: a, sales: s, synced: synced, maps: hubKrmMaps_(), inv: inv, invCount: invCount };
}
/* 크림 품번 ↔ 사방넷 상품코드(+컬러) 연결표 */
function hubKrmMaps_() {
  return hubRows_('크림매핑').vals.filter(function (v) { return v[0]; }).map(function (v) {
    var sz = {}; try { sz = JSON.parse(String(v[5] || '{}')) || {}; } catch (e) { sz = {}; }
    return { style: String(v[0]), sbnPrd: String(v[1]), color: String(v[2] || ''), at: v[3] instanceof Date ? Utilities.formatDate(v[3], 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : String(v[3] || ''), by: String(v[4] || ''), sizes: sz };
  });
}
function hubKrmMapSet_(req, me) {
  var style = hubStr_(req.style, 80); if (!style) return { error: '크림 품번이 없어요' };
  var prd = hubStr_(req.sbnPrd, 20).replace(/\D/g, ''), color = hubStr_(req.color, 40);
  var r = hubRows_('크림매핑'), row = -1;
  for (var i = 0; i < r.vals.length; i++) if (String(r.vals[i][0]) === style) { row = i + 2; break; }
  if (!prd) { if (row > 0) r.sh.deleteRow(row); return { ok: true, maps: hubKrmMaps_() }; }   // 연결 해제 (연결표 한 줄만 지움)
  var sz = {}; if (req.sizes && typeof req.sizes === 'object') Object.keys(req.sizes).slice(0, 80).forEach(function (k) { var v = hubStr_(req.sizes[k], 10).replace(/\D/g, ''); if (v) sz[hubStr_(k, 30)] = v; });   // 크림 사이즈 → 사방넷 단품코드
  var vals = [[style, "'" + prd, color, hubNow_(), me.name, JSON.stringify(sz)]];
  if (row > 0) r.sh.getRange(row, 1, 1, 6).setValues(vals); else r.sh.getRange(r.vals.length + 2, 1, 1, 6).setValues(vals);
  return { ok: true, maps: hubKrmMaps_() };
}

/* ===================== 매출 =====================
 * 「셀렉트인_데일리매출판」 시트를 직접 읽음 (쓰기 없음). 기존 매출 앱(매출앱.gs)을 거치지 않음.
 *  - 일별입력: 열 위치가 아니라 '날짜' 머리글 행의 열 이름으로 찾음 → 열을 옮기거나 추가해도 안전
 *  - 법인 '제외' 행은 집계에서 뺌 (매출판·기존 앱과 같은 규칙)
 *  - 오늘: 일별입력에 이미 들어온 채널그룹은 확정값을 쓰고, 없는 그룹(사방넷·스마트스토어)만 오늘현황 실시간으로 채움
 *  - 검증: 매출판 '대시보드' 탭의 월누적 매출과 같은 기간 합계를 맞춰 보고 결과를 함께 보냄
 *  - 입금예정일·입금확인은 관리자에게만 보냄 */
var HUB_SALES_ID = '1TSYSFjgcqo1Gu1Ryq9CHjdNN1Fm1QYmASKlV77xsjl0';
function hubSalesYmd_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  var m = String(v || '').trim().match(/^(\d{4})\s*[-.\/]\s*(\d{1,2})\s*[-.\/]\s*(\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function hubSales_(me) {
  var ss = SpreadsheetApp.openById(HUB_SALES_ID), tz = 'Asia/Seoul', today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var admin = me && me.role === '관리자';
  var sh = ss.getSheetByName('일별입력');
  if (!sh) return { error: "매출판에 '일별입력' 탭이 없어요" };
  var v = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), sh.getLastColumn()).getValues();
  var h = -1;
  for (var i = 0; i < Math.min(10, v.length); i++) if (String(v[i][0]).trim() === '날짜') { h = i; break; }
  if (h < 0) return { error: "일별입력 탭에서 '날짜' 머리글을 찾지 못했어요" };
  var I = {};
  v[h].forEach(function (c, j) { var k = String(c).trim(); if (k && !(k in I)) I[k] = j; });
  var need = ['날짜', '법인', '채널그룹', '주문건수', '매출액'], miss = need.filter(function (k) { return I[k] == null; });
  if (miss.length) return { error: '일별입력 머리글이 바뀌었어요: ' + miss.join(', ') + ' 열을 찾지 못함' };
  var col = function (r, k) { return I[k] == null ? '' : r[I[k]]; };
  var rows = [], todayGroups = {}, last = {}, skipped = 0;
  v.slice(h + 1).forEach(function (r) {
    var d = hubSalesYmd_(col(r, '날짜'), tz);
    if (!d) { if (r.some(function (x) { return x !== '' && x != null; })) skipped++; return; }
    var corp = String(col(r, '법인')).trim();
    if (corp === '제외') return;
    var grp = String(col(r, '채널그룹')).trim() || '기타';
    var pf = String(col(r, '플랫폼(자동)') || col(r, '쇼핑몰') || col(r, '채널')).trim() || grp;
    if (d === today) todayGroups[grp] = 1;
    var lk = grp === '리셀' ? (/포이즌/i.test(pf + col(r, '채널')) ? '포이즌' : '크림') : grp;
    if (d <= today && (!last[lk] || d > last[lk])) last[lk] = d;
    var row = [d, corp || '확인필요', grp, pf, hubNum_(col(r, '주문건수')), hubNum_(col(r, '매출액')), hubNum_(col(r, '정산예정액')), hubNum_(col(r, '이익')), hubNum_(col(r, '매입원가')), 0];
    if (admin) row.push(hubSalesYmd_(col(r, '입금예정일'), tz), String(col(r, '입금확인(Y)')).trim().toUpperCase() === 'Y' ? 1 : 0);
    rows.push(row);
  });
  // 오늘 실시간 (일별입력에 아직 없는 채널그룹만)
  //  - 사방넷: 사방넷 API로 바로 조회 (5분 캐시) → 오늘현황 시트 갱신(하루 몇 번)을 기다리지 않음. 실패하면 오늘현황 사용
  var live = [], at = { sabang: '', store: '' }, th = ss.getSheetByName('오늘현황');
  var apiLive = todayGroups['사방넷'] ? null : hubSalesSbnToday_(ss, today, tz);
  if (apiLive) { apiLive.rows.forEach(function (row) { if (admin) row.push('', 0); live.push(row); }); }
  if (th && th.getLastRow() >= 1) {
    var tv = th.getRange(1, 1, Math.min(th.getLastRow(), 600), 9).getValues();
    tv.forEach(function (r) {
      if (String(r[0]).trim().indexOf('주문 매출') === 0) { at.sabang = hubSalesHm_(r[4], tz); at.store = hubSalesHm_(r[5], tz); }
      if (String(r[0]).trim() !== '주문' || hubSalesYmd_(r[8], tz) !== today) return;
      var g = String(r[1] || '').trim() === '사방넷' ? '사방넷' : '스마트스토어';
      if (todayGroups[g] || (g === '사방넷' && apiLive)) return;
      var row = [today, String(r[2] || '').trim() || '확인필요', g, String(r[3] || '').trim(), hubNum_(r[5]), hubNum_(r[6]), 0, 0, 0, 1];
      if (admin) row.push('', 0);
      live.push(row);
    });
  }
  if (apiLive) at.sabang = apiLive.at;
  // 매출판 대시보드와 대조 (월 선택이 '이번달'일 때만: 월초 ~ 어제 확정 합계)
  var verify = null;
  try {
    var dv = ss.getSheetByName('대시보드').getRange('A1:B12').getValues(), dm = {};
    dv.forEach(function (r) { dm[String(r[0]).trim()] = r[1]; });
    var base = hubSalesYmd_(dm['기준일(확정)'], tz), from = hubSalesYmd_(dm['월초'], tz), sheetMtd = hubNum_(dm['월누적 매출']);
    if (base && from) {
      var mine = rows.reduce(function (t, r) { return r[0] >= from && r[0] <= base ? t + r[5] : t; }, 0);
      verify = { from: from, base: base, sheet: sheetMtd, app: mine, ok: Math.abs(mine - sheetMtd) < 1 };
    }
  } catch (e) { verify = { error: String(e.message || e).slice(0, 120) }; }
  return {
    cols: ['date', 'corp', 'group', 'platform', 'cnt', 'amt', 'settle', 'profit', 'cost', 'live'].concat(admin ? ['payDay', 'paid'] : []),
    rows: rows.concat(live), today: today, liveAt: at.sabang, live: at, liveRows: live.length,
    last: last, verify: verify, skipped: skipped, at: Utilities.formatDate(new Date(), tz, 'HH:mm')
  };
}
/** 오늘 사방넷 주문 (주문일 기준) — 매출판과 같은 규칙: 취소 제외·반품/교환 재생성행 제외·설정 ③ 쇼핑몰ID→법인('제외' 빼기). 조회 전용(updateOrderStsYn N) */
function hubSalesSbnToday_(ss, today, tz) {
  var cache = CacheService.getScriptCache(), hit = cache.get('sales_sbn_today');
  if (hit) { try { var c = JSON.parse(hit); if (c.today === today) return c; } catch (e) {} }
  try {
    var corp = {};
    ss.getSheetByName('설정').getRange('A57:B120').getValues().forEach(function (r) { var id = String(r[0]).trim(); if (id) corp[id] = String(r[1]).trim(); });
    var d = today.replace(/-/g, ''), all = [], page = 1;
    while (page <= 20) {
      var r = hubSbnCall_('POST', '/v3/sb/order', { dateSearchCondition: 2, startDate: d, endDate: d, updateOrderStsYn: 'N', page: page, perPage: 1000,
        responseItems: ['SB_ORD_NO', 'ORDER_STATUS', 'SHOP_NM', 'SHOP_LOGIN_ID', 'ORDER_TOT_AMT', 'ORD_CNT', 'ORG_SB_ORD_NO'] });
      var dt = (r && r.data) || {}; all = all.concat(dt.results || []); if (!dt.hasNext) break; page++;
    }
    var g = {};
    all.forEach(function (x) {
      if (/CANCEL/i.test(String(x.ORDER_STATUS))) return;
      if (x.ORG_SB_ORD_NO && String(x.ORG_SB_ORD_NO) !== '0') return;
      var id = String(x.SHOP_LOGIN_ID || '').trim(), c = corp[id] || '확인필요'; if (c === '제외') return;
      var k = c + '|' + String(x.SHOP_NM || '').trim(), o = g[k] || (g[k] = [today, c, '사방넷', String(x.SHOP_NM || '').trim(), 0, 0, 0, 0, 0, 1]);
      o[4]++; o[5] += Number(x.ORDER_TOT_AMT) || 0;
    });
    var out = { today: today, at: Utilities.formatDate(new Date(), tz, 'HH:mm'), rows: Object.keys(g).map(function (k) { return g[k]; }) };
    cache.put('sales_sbn_today', JSON.stringify(out), 300);
    return out;
  } catch (e) { return null; }
}
function hubSbnSalesRange_(from, to) {
  var ss = SpreadsheetApp.openById(HUB_SALES_ID), corp = {};
  ss.getSheetByName('설정').getRange('A57:B120').getValues().forEach(function (r) { var id = String(r[0]).trim(); if (id) corp[id] = String(r[1]).trim(); });
  var a = String(from || '').replace(/-/g, ''), b = String(to || '').replace(/-/g, ''); if (!/^\d{8}$/.test(a) || !/^\d{8}$/.test(b)) return { error: '날짜 형식' };
  var all = [], page = 1;
  while (page <= 30) {
    var r = hubSbnCall_('POST', '/v3/sb/order', { dateSearchCondition: 2, startDate: a, endDate: b, updateOrderStsYn: 'N', page: page, perPage: 1000,
      responseItems: ['SB_ORD_NO', 'ORDER_STATUS', 'ORDER_DT', 'SHOP_NM', 'SHOP_LOGIN_ID', 'ORDER_TOT_AMT', 'ORG_SB_ORD_NO'] });
    var dt = (r && r.data) || {}; all = all.concat(dt.results || []); if (!dt.hasNext) break; page++;
  }
  var g = {};
  all.forEach(function (x) {
    if (/CANCEL/i.test(String(x.ORDER_STATUS))) return;
    if (x.ORG_SB_ORD_NO && String(x.ORG_SB_ORD_NO) !== '0') return;
    var id = String(x.SHOP_LOGIN_ID || '').trim(), c = corp[id] || '확인필요'; if (c === '제외') return;
    var d = String(x.ORDER_DT || '').replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3').slice(0, 10);
    var k = d + '|' + c + '|' + String(x.SHOP_NM || '').trim(), o = g[k] || (g[k] = [d, c, String(x.SHOP_NM || '').trim(), 0, 0]);
    o[3]++; o[4] += Number(x.ORDER_TOT_AMT) || 0;
  });
  return { n: all.length, rows: Object.keys(g).sort().map(function (k) { return g[k]; }) };
}
/* ===================== 오늘 처리 현황 (홈) =====================
 * 사방넷 API(조회 전용)로 쇼핑몰 계정별 오늘 주문(주문일)·수집(수집일)·발송(출고일)과 최근 7일 하루 평균 주문을 함께 냄.
 * 평소 주문이 있는 계정인데 오늘 주문이 0건이면 '수집 확인' 경고 → 셀렉트인 계정 수집 누락 같은 일을 바로 알 수 있게.
 * 규칙은 매출판과 같음: 취소 제외, 반품·교환 재생성 행 제외, 설정 ③ 쇼핑몰ID→법인('제외' 빼기). 5분 캐시. */
function hubOpsToday_(force) {
  var tz = 'Asia/Seoul', today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), cache = CacheService.getScriptCache();
  if (!force) { var hit = cache.get('ops_today'); if (hit) { try { var c = JSON.parse(hit); if (c.today === today) return c; } catch (e) {} } }
  var ss = SpreadsheetApp.openById(HUB_SALES_ID), corp = {};
  ss.getSheetByName('설정').getRange('A57:B120').getValues().forEach(function (r) { var id = String(r[0]).trim(); if (id) corp[id] = String(r[1]).trim(); });
  var ymd = function (k) { return Utilities.formatDate(new Date(Date.now() + k * 864e5), tz, 'yyyyMMdd'); };
  var fetch = function (cond, a, b) {
    var all = [], page = 1;
    while (page <= 30) {
      var r = hubSbnCall_('POST', '/v3/sb/order', { dateSearchCondition: cond, startDate: a, endDate: b, updateOrderStsYn: 'N', page: page, perPage: 1000,
        responseItems: ['SB_ORD_NO', 'ORDER_STATUS', 'SHOP_NM', 'SHOP_LOGIN_ID', 'ORDER_TOT_AMT', 'ORG_SB_ORD_NO'] });
      var dt = (r && r.data) || {}; all = all.concat(dt.results || []); if (!dt.hasNext) break; page++;
    }
    return all.filter(function (x) { return !/CANCEL/i.test(String(x.ORDER_STATUS)) && !(x.ORG_SB_ORD_NO && String(x.ORG_SB_ORD_NO) !== '0') && corp[String(x.SHOP_LOGIN_ID || '').trim()] !== '제외'; });
  };
  var A = {}, acc = function (x) {
    var id = String(x.SHOP_LOGIN_ID || '').trim(), nm = String(x.SHOP_NM || '').trim(), k = nm + '|' + id;
    return A[k] || (A[k] = { shop: nm, id: id, corp: corp[id] || '확인필요', ord: 0, ordAmt: 0, reg: 0, send: 0, sendAmt: 0, wk: 0 });
  };
  try {
    var t = ymd(0);
    fetch(2, t, t).forEach(function (x) { var o = acc(x); o.ord++; o.ordAmt += Number(x.ORDER_TOT_AMT) || 0; });
    fetch(1, t, t).forEach(function (x) { acc(x).reg++; });
    fetch(7, t, t).forEach(function (x) { var o = acc(x); o.send++; o.sendAmt += Number(x.ORDER_TOT_AMT) || 0; });
    fetch(2, ymd(-7), ymd(-1)).forEach(function (x) { acc(x).wk++; });
  } catch (e) { return { error: '사방넷 조회 실패: ' + String(e.message || e).slice(0, 150) }; }
  var hour = Number(Utilities.formatDate(new Date(), tz, 'H'));
  var rows = Object.keys(A).map(function (k) { var o = A[k]; o.avg = Math.round(o.wk / 7 * 10) / 10; o.warn = hour >= 13 && o.avg >= 2 && o.ord === 0; return o; })
    .sort(function (a, b) { return (b.warn - a.warn) || (b.ordAmt - a.ordAmt) || (b.avg - a.avg); });
  var out = { today: today, at: Utilities.formatDate(new Date(), tz, 'HH:mm'), rows: rows };
  try { cache.put('ops_today', JSON.stringify(out), 300); } catch (e) {}
  return out;
}
function hubSalesHm_(x, tz) { return x instanceof Date ? Utilities.formatDate(x, tz, 'HH:mm') : String(x || '').trim(); }

/* ===================== 재고 ===================== */
function hubStockMove_(req, me) {
  var hit = hubFindProduct_(req.id);
  if (!hit) return { error: '상품을 찾을 수 없습니다' };
  if (hit.p.link) { var org = hubFindByKey_(hit.p.link); if (!org) return { error: '모음전(연결상품)인데 원본 ' + hit.p.link + '을 앱에서 찾을 수 없어요' }; req.memo = '모음전 ' + hit.p.sbnPrd + '-' + hit.p.sbnSku + (req.memo ? ' · ' + req.memo : ''); hit = org; }
  if (hit.p.stocMng === 'N') return { error: '사방넷에서 「재고관리 사용안함」인 상품이라 입출고를 기록하지 않아요 (가상재고)' };
  var type = { in: '입고', out: '출고', adjust: '실사조정' }[req.type];
  if (!type) return { error: '구분이 올바르지 않습니다' };
  var qty = Math.round(hubNum_(req.qty));
  if (type !== '실사조정' && qty <= 0) return { error: '수량을 1 이상 입력하세요' };
  if (type === '실사조정' && qty < 0) return { error: '실제 재고 수량은 0 이상이어야 합니다' };
  var before = hit.p.stock;
  var after = type === '입고' ? before + qty : type === '출고' ? before - qty : qty;
  var delta = after - before;
  var col = HUB_P_FIELDS.indexOf('stock') + 1, now = hubNow_();
  hit.sh.getRange(hit.row, col).setValue(after);
  hit.sh.getRange(hit.row, 15, 1, 2).setValues([[now, me.name]]);
  hubSheet_('재고이력').appendRow([now, hit.p.id, hit.p.sku, hit.p.name, type, delta, after, hubStr_(req.memo, 200), me.name]);
  hit.p.stock = after; hit.p.updatedAt = now; hit.p.updatedBy = me.name;
  // 사방넷 재고 바로 반영 (현재고 상품만 · 실패해도 입출고 저장은 유지)
  var sbn = null;
  if (hit.p.sbnPrd && hit.p.stocMng !== 'N' && hit.p.type !== '위탁' && req.sbn !== false) {
    try { sbn = hubSbnStockPush_([hit.p.id], me, [hit.p]); } catch (e) { sbn = { error: String(e.message || e).slice(0, 200) }; }
  }
  return { ok: true, product: hit.p, sbn: sbn, move: { at: now, id: hit.p.id, sku: hit.p.sku, name: hit.p.name, type: type, qty: delta, after: after, memo: hubStr_(req.memo, 200), by: me.name } };
}
function hubHistory_(id, limit) {
  var vals = hubRows_('재고이력').vals, out = [];
  for (var i = vals.length - 1; i >= 0 && out.length < limit; i--) {
    var v = vals[i]; if (id && String(v[1]) !== String(id)) continue;
    out.push({ at: v[0] instanceof Date ? Utilities.formatDate(v[0], 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : String(v[0]), id: String(v[1]), sku: String(v[2]), name: String(v[3]), type: String(v[4]), qty: hubNum_(v[5]), after: hubNum_(v[6]), memo: String(v[7]), by: String(v[8]) });
  }
  return out;
}
function hubCostHistory_(id) {
  return hubRows_('원가이력').vals.filter(function (v) { return String(v[1]) === String(id); }).reverse().map(function (v) {
    return { at: v[0] instanceof Date ? Utilities.formatDate(v[0], 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : String(v[0]), before: v[4] === '' ? null : hubNum_(v[4]), after: hubNum_(v[5]), by: String(v[6]) };
  });
}

/* ===================== 바코드 점검 =====================
 * 앱에서 사방넷 단품의 바코드를 바꾸면 '바코드반영대기'에 사방넷에 있던 원래 바코드를 남김 → 사방넷 반영 후 동기화하면 자동으로 지워짐 */
function hubPendingAfter_(p, newBar) {
  var orig = p.barPending || p.barcode;          // 사방넷에 실제로 들어있는 값
  return newBar === orig ? '' : orig;
}
/* 셀렉트인 상품에 새로 넣는 바코드는 앞에 S를 붙여 겐더샵(같은 실물)과 구분: 888999493016 → S888999493016 */
function hubCorpBar_(corp, bar) {
  bar = String(bar || '').replace(/\s+/g, '').toUpperCase();
  if (!bar || corp !== '셀렉트인' || /^S/.test(bar)) return bar;
  return 'S' + bar;
}
function hubBarcodeSet_(req, me) {
  var bar = hubStr_(req.barcode, 60).replace(/\s+/g, '');
  if (!/^[0-9A-Za-z\-]{4,40}$/.test(bar)) return { error: '바코드 형식이 올바르지 않습니다: ' + bar };
  var list = hubProducts_(), hit = null, dup = null;
  list.forEach(function (p) { if (p.id === req.id) hit = p; });
  if (!hit) return { error: '상품을 찾을 수 없습니다' };
  bar = hubCorpBar_(hit.corp, bar);
  // 같은 실물을 셀렉트인·겐더샵이 각각 등록해 쓰므로, 중복은 같은 법인 안에서만 막음 (force면 같은 법인도 허용)
  list.forEach(function (p) { if (p.id !== hit.id && p.barcode === bar && p.corp === hit.corp) dup = dup || p; });
  if (dup && !req.force) return { dupSameCorp: true, error: '같은 법인(' + hit.corp + ')에서 이미 쓰는 바코드예요: ' + dup.name + (dup.option ? ' (' + dup.option + ')' : '') + (dup.sbnPrd ? ' · 사방넷 ' + dup.sbnPrd + '-' + dup.sbnSku : '') };
  if (hit.barcode === bar) return { ok: true, product: hit };
  var row = hubFindProduct_(hit.id), now = hubNow_();
  var o = Object.assign({}, hit, { barcode: bar, updatedAt: now, updatedBy: me.name });
  if (hit.sbnPrd) o.barPending = hubPendingAfter_(hit, bar);
  var vals = hubRow_(o);
  row.sh.getRange(row.row, 1, 1, vals.length).setNumberFormats([hubFormats_()]).setValues([vals]);
  hubSheet_('재고이력').appendRow([now, hit.id, hit.sku, hit.name, '바코드변경', 0, hit.stock, hit.barcode + ' → ' + bar, me.name]);
  return { ok: true, product: hubProductObj_(vals) };
}

/* ===================== 바코드 일괄 작업 (시트) =====================
 * 바코드작업 탭: 앱에서 내보낸 목록 → '새 바코드' 칸 채우기(직접 또는 공급처바코드로 자동) → 앱에서 [시트 내용 반영]
 * 공급처바코드 탭: 공급처·브랜드 리스트를 붙여넣는 곳 (품번 · 색상 · 사이즈 · 바코드) */
var HUB_BS_HEAD = ['상품id', '사방넷코드', '법인', '상품명', '옵션', '재고', '현재 바코드', '새 바코드', '결과'];
var HUB_SUP_HEAD = ['품번', '색상', '사이즈', '바코드', '메모'];
function hubBsSheet_() {
  var ss = hubBook_(), sh = ss.getSheetByName('바코드작업');
  if (!sh) {
    sh = ss.insertSheet('바코드작업');
    sh.setFrozenRows(1); sh.hideColumns(1);
  }
  sh.getRange(1, 1, 1, HUB_BS_HEAD.length).setValues([HUB_BS_HEAD]).setFontWeight('bold').setBackground('#e8f5ef');
  sh.getRange(1, 8).setBackground('#fff4e0');
  return sh;
}
function hubSupSheet_() {
  var ss = hubBook_(), sh = ss.getSheetByName('공급처바코드');
  if (!sh) {
    sh = ss.insertSheet('공급처바코드');
    sh.getRange(1, 1, 1, HUB_SUP_HEAD.length).setValues([HUB_SUP_HEAD]).setFontWeight('bold').setBackground('#e8f0fd');
    sh.setFrozenRows(1); sh.getRange('A:D').setNumberFormat('@');
  }
  return sh;
}
function hubSheetUrl_(sh) { return sh.getParent().getUrl() + '#gid=' + sh.getSheetId(); }
function hubBarSheetExport_(req, me) {
  var ids = req.ids || []; if (!ids.length) return { error: '내보낼 상품이 없습니다' };
  if (ids.length > 15000) return { error: '한 번에 15,000개까지 내보낼 수 있습니다' };
  var want = {}; ids.forEach(function (id) { want[id] = 1; });
  var rows = hubProducts_().filter(function (p) { return want[p.id]; }).map(function (p) {
    return [p.id, p.sbnPrd ? p.sbnPrd + '-' + p.sbnSku : '', p.corp, p.name, p.option, p.stock, p.barcode, '', ''];
  });
  var sh = hubBsSheet_(), last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, HUB_BS_HEAD.length).clearContent().setBackground(null);
  if (rows.length) {
    if (sh.getMaxRows() < rows.length + 1) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 1 - sh.getMaxRows());
    sh.getRange(2, 1, rows.length, HUB_BS_HEAD.length).setNumberFormat('@').setValues(rows);
    sh.getRange(2, 8, rows.length, 1).setBackground('#fffaf0');
  }
  hubSupSheet_();
  hubConfigSet_('barsheet', rows.length + '개 내보냄', me);
  return { ok: true, n: rows.length, url: hubSheetUrl_(sh), supUrl: hubSheetUrl_(hubSupSheet_()) };
}
function hubNorm_(v) { return String(v == null ? '' : v).toUpperCase().replace(/[\s\-_\/().,:]/g, ''); }
function hubSizeOf_(opt) { var parts = String(opt).split(':'); return hubNorm_(String(parts[parts.length - 1]).split('(')[0]); }
/** 공급처바코드 탭 → 바코드작업 탭의 빈 '새 바코드' 자동 채우기 (품번 필수, 색상·사이즈로 좁힘) */
function hubBarSheetMatch_() {
  var sup = hubSupSheet_(), sl = sup.getLastRow();
  if (sl < 2) return { error: '공급처바코드 탭에 리스트를 먼저 붙여넣어 주세요 (품번 · 색상 · 사이즈 · 바코드)' };
  var S = sup.getRange(2, 1, sl - 1, 4).getValues().filter(function (r) { return r[0] && r[3]; });
  var sh = hubBsSheet_(), last = sh.getLastRow(); if (last < 2) return { error: '바코드작업 탭이 비어 있어요. 앱에서 먼저 내보내기 하세요' };
  var W = sh.getRange(2, 1, last - 1, HUB_BS_HEAD.length).getValues();
  var filled = 0, multi = 0;
  var hay = W.map(function (w) { return hubNorm_(w[3] + ' ' + w[4]); });
  W.forEach(function (w, i) {
    if (String(w[7]).trim()) return;
    var opt = String(w[4]), optN = hubNorm_(opt), size = hubSizeOf_(opt);
    var cand = S.filter(function (r) {
      var model = hubNorm_(r[0]); if (model.length < 3 || hay[i].indexOf(model) < 0) return false;
      var c = hubNorm_(r[1]); if (c && optN.indexOf(c) < 0 && hay[i].indexOf(c) < 0) return false;
      var z = hubNorm_(r[2]); if (z && z !== size) return false;   // 사이즈는 정확히 같아야 (L이 XL에 섞이지 않게)
      return true;
    });
    var bars = cand.map(function (r) { return String(r[3]).trim(); }).filter(function (b, k, a) { return a.indexOf(b) === k; });
    if (bars.length === 1) { w[7] = bars[0]; w[8] = '자동매칭 — 확인 후 반영'; filled++; }
    else if (bars.length > 1) { w[8] = '후보 ' + bars.length + '개 — 직접 확인 (' + bars.slice(0, 3).join(', ') + ')'; multi++; }
  });
  sh.getRange(2, 8, W.length, 2).setNumberFormat('@').setValues(W.map(function (w) { return [w[7], w[8]]; }));
  return { ok: true, filled: filled, multi: multi, url: hubSheetUrl_(sh) };
}
/** 바코드작업 탭의 '새 바코드' 검사 후 반영 → 사방넷 반영 대기 */
function hubBarSheetApply_(me) {
  var sh = hubBsSheet_(), last = sh.getLastRow(); if (last < 2) return { error: '바코드작업 탭이 비어 있어요' };
  var W = sh.getRange(2, 1, last - 1, HUB_BS_HEAD.length).getValues();
  var list = hubProducts_(), byId = {}, byBar = {};
  list.forEach(function (p) { byId[p.id] = p; if (p.barcode) (byBar[p.barcode] = byBar[p.barcode] || []).push(p.id); });
  var inSheet = {};
  W.forEach(function (w) { var b = String(w[7]).replace(/\s+/g, ''); if (b) inSheet[b] = (inSheet[b] || 0) + 1; });
  var now = hubNow_(), ok = 0, bad = 0, logs = [];
  W.forEach(function (w) {
    var b = String(w[7]).replace(/\s+/g, ''); if (!b) return;
    var p = byId[w[0]];
    if (p) b = hubCorpBar_(p.corp, b);
    var err = !p ? '앱에서 상품을 찾을 수 없음'
      : !/^[0-9A-Za-z\-]{8,40}$/.test(b) ? '형식 오류 (8자리 이상 숫자·영문)'
      : inSheet[b] > 1 ? '시트 안에 같은 바코드가 ' + inSheet[b] + '개'
      : (byBar[b] || []).some(function (id) { return id !== p.id; }) ? '다른 상품이 이미 사용: ' + byId[(byBar[b] || []).filter(function (id) { return id !== p.id; })[0]].name
      : '';
    if (err) { w[8] = '✗ ' + err; bad++; return; }
    if (p.barcode === b) { w[8] = '변경 없음'; return; }
    var old = p.barcode;
    if (p.sbnPrd) p.barPending = hubPendingAfter_(p, b);
    (byBar[old] || []).splice((byBar[old] || []).indexOf(p.id), 1);
    p.barcode = b; p.updatedAt = now; p.updatedBy = me.name; (byBar[b] = byBar[b] || []).push(p.id);
    logs.push(['재고이력', [now, p.id, p.sku, p.name, '바코드변경', 0, p.stock, old + ' → ' + b + ' (시트)', me.name]]);
    w[8] = '✓ 반영됨 (사방넷 반영 대기)'; ok++;
  });
  if (ok) { hubWriteAll_(list); hubWriteLogs_(logs); }
  sh.getRange(2, 9, W.length, 1).setValues(W.map(function (w) { return [w[8]]; }));
  return { ok: true, applied: ok, failed: bad, url: hubSheetUrl_(sh) };
}

/* ===================== 사방넷 등록서 (사진 → AI 정리 → 등록 요청) ===================== */
var HUB_MYCATS = ['셀렉트인전용', '의류', '남성화', '여성화', '모자/비니', '가방', '목도리', '속옷', '아동화', '벨트,지갑,귀마개', '텀블러'];
function hubPhotoFolder_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('HUB_PHOTO_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var f = DriveApp.createFolder('셀렉트인 OPS 상품사진');
  p.setProperty('HUB_PHOTO_FOLDER', f.getId());
  return f;
}
/** 사진 저장 → 링크가 있는 사람 보기 → 앱·사방넷 등록에 쓰는 주소 반환 */
function hubPhotoUpload_(req, me) {
  var b64 = String(req.b64 || ''); if (!b64) return { error: '사진이 없습니다' };
  if (b64.length > 8e6) return { error: '사진이 너무 큽니다' };
  var mime = /^image\/(jpeg|png|webp)$/.test(req.mime) ? req.mime : 'image/jpeg';
  var name = hubStr_(req.name, 80) || ('photo_' + Date.now());
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, name + (mime === 'image/png' ? '.png' : '.jpg'));
  var file = hubPhotoFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  file.setDescription('업로드: ' + me.name + ' ' + hubNow_());
  return { ok: true, id: file.getId(), url: 'https://lh3.googleusercontent.com/d/' + file.getId() };
}
/** 사진(들)을 보고 사방넷 등록에 필요한 정보를 채움 — 스크립트 속성 ANTHROPIC_API_KEY 필요 */
function hubAiFill_(req) {
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) return { error: 'AI 키가 없습니다. Apps Script 스크립트 속성에 ANTHROPIC_API_KEY를 넣어주세요' };
  var ids = (req.photoIds || []).slice(0, 4);
  if (!ids.length) return { error: '사진을 먼저 찍어주세요' };
  var content = ids.map(function (id) {
    var blob = DriveApp.getFileById(id).getBlob();
    return { type: 'image', source: { type: 'base64', media_type: blob.getContentType() || 'image/jpeg', data: Utilities.base64Encode(blob.getBytes()) } };
  });
  var prompt = [
    '너는 한국 패션 커머스 회사(셀렉트인/겐더샵)의 상품 등록 담당자다. 사진(상품, 태그, 라벨)을 보고 사방넷 상품 등록용 정보를 채워라.',
    '사진에서 확인되지 않는 정보는 지어내지 말고 빈 문자열("")로 둬라. 추정한 값은 notes에 "추정"이라고 적어라.',
    '상품명 규칙: "브랜드 + 성별/대상(있으면) + 핵심 아이템명 + 색상 + 모델번호(있으면)" 형태의 한국어, 60자 이내.',
    '마이카테고리는 다음 중 하나: ' + HUB_MYCATS.join(' / ') + ' (셀렉트인 법인 상품이면 "셀렉트인전용").',
    '사이즈·색상이 여러 개로 보이면 options에 나열하고, 하나면 그 값만 넣어라.',
    '상세설명(detail)은 쇼핑몰 상세페이지에 들어갈 짧은 소개 3~5문장 (과장·최상급 표현 금지).',
    '태그에 가격이 보이면 tagPrice에 숫자만 넣어라.',
    '반드시 아래 JSON만 출력:',
    '{"name":"","brand":"","modelNo":"","myCategory":"","stdCategory":"대분류>중분류>소분류","gender":"남성|여성|공용|아동|","season":"","color":"","optionTitle":"색상:사이즈 등","options":[""],"material":"","maker":"","origin":"","tagPrice":0,"keywords":"쉼표로 구분","detail":"","notes":""}'
  ].join('\n');
  if (req.hint) prompt += '\n담당자 메모: ' + hubStr_(req.hint, 300);
  content.push({ type: 'text', text: prompt });
  var model = PropertiesService.getScriptProperties().getProperty('HUB_AI_MODEL') || 'claude-sonnet-5-5';
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: model, max_tokens: 1500, messages: [{ role: 'user', content: content }] })
  });
  var code = res.getResponseCode(), body = res.getContentText();
  if (code !== 200) return { error: 'AI 호출 실패(' + code + '): ' + body.slice(0, 200) };
  var text = (JSON.parse(body).content || []).map(function (c) { return c.text || ''; }).join('');
  var m = text.match(/\{[\s\S]*\}/);
  if (!m) return { error: 'AI 응답을 읽지 못했습니다' };
  try { return { ok: true, fill: JSON.parse(m[0]) }; } catch (e) { return { error: 'AI 응답 형식 오류' }; }
}
/** 등록서 저장 — 상품 행에 등록정보(JSON)와 등록상태를 함께 저장 */
function hubRegSave_(req, me) {
  var p = req.p || {}, reg = req.reg || {};
  var status = { draft: '작성중', request: '등록요청' }[req.status] || '작성중';
  if (status === '등록요청') {
    var miss = [];
    if (!p.name) miss.push('상품명'); if (!hubNum_(p.price)) miss.push('판매가'); if (!(reg.photos || []).length) miss.push('대표이미지');
    if (!reg.myCategory) miss.push('마이카테고리');   // 상세설명·고시정보 등은 등록할 때 Claude가 정리 (B 방식)
    if (miss.length) return { error: '사방넷 등록에 필요한 항목이 비어 있어요: ' + miss.join(', ') };
  }
  p.corp = reg.myCategory === '셀렉트인전용' ? '셀렉트인' : (p.corp || '겐더샵');
  var r = hubProductSave_(p, me);
  if (r.error) return r;
  var hit = hubFindProduct_(r.product.id);
  var row = hubRow_(Object.assign({}, hit.p, {
    img: (reg.photos && reg.photos[0] && reg.photos[0].url) || hit.p.img, cat: reg.myCategory || hit.p.cat,
    regStatus: status, reg: JSON.stringify(reg).slice(0, 45000)
  }));
  hit.sh.getRange(hit.row, 1, 1, row.length).setNumberFormats([hubFormats_()]).setValues([row]);
  return { ok: true, product: hubProductObj_(row) };
}
/* ===================== 등록서 → 사방넷 바로 등록 (API: POST /v3/sb/product/upsert) =====================
 * 자체상품코드 = 앱 상품 id → 같은 등록서를 다시 보내면 사방넷에서 '수정'으로 처리됨
 * 상품정보제공고시는 카테고리별 유형의 모든 항목을 '상세페이지 참조'로 채움 (원산지 입력 시 제조국만 그 값)
 * 원산지 코드 123 = 상세설명참조, 배송비 무료, 과세, 사입 */
var HUB_NOTICE_BY_CAT = { '의류': 'WEAR', '속옷': 'WEAR', '남성화': 'SHOES', '여성화': 'SHOES', '아동화': 'SHOES', '가방': 'BAG',
  '모자/비니': 'FASHION_ITEMS', '목도리': 'FASHION_ITEMS', '벨트,지갑,귀마개': 'FASHION_ITEMS', '텀블러': 'KITCHENWARE' };
var HUB_NOTICE_TYPES = ['WEAR', 'SHOES', 'BAG', 'FASHION_ITEMS', 'KITCHENWARE', 'ETC'];
function hubSbnCached_(key, path, sec) {
  var c = CacheService.getScriptCache(), v = c.get(key);
  if (v) return JSON.parse(v);
  var b = hubSbnCall_('GET', path, null, 'PRODUCTION'); var d = b && b.data ? b.data : b;
  try { c.put(key, JSON.stringify(d), sec || 21600); } catch (e) {}
  return d;
}
function hubSbnCatCode_(name) {
  var d = hubSbnCached_('sbn_cats', '/v3/sb/category', 21600), hit = null;
  (d.items || []).forEach(function (it) { (it.category || []).forEach(function (c) { if (String(c.name).trim() === String(name).trim()) hit = it.leafCode || c.code; }); });
  return hit;
}
function hubRegPayload_(p, reg) {
  var type = HUB_NOTICE_TYPES.indexOf(reg.noticeType) >= 0 ? reg.noticeType : (HUB_NOTICE_BY_CAT[reg.myCategory] || 'ETC');
  var nt = hubSbnCached_('sbn_notice_' + type, '/v3/sb/product-info-notice/' + type, 21600);
  var REF = '상세페이지 참조', origin = hubStr_(reg.origin, 40);
  var attrs = (nt.details || []).map(function (d) {
    return { attributeClassificationCode: nt.productInfoNoticeTypeCode, attributeSrno: d.productInfoNoticeDetailCode,
      attributeText: origin && /제조국|원산지/.test(d.productInfoNoticeDetailName) ? origin : REF };
  });
  var cat = hubSbnCatCode_(reg.myCategory);
  if (!cat) throw new Error('사방넷 마이카테고리를 찾을 수 없어요: ' + reg.myCategory);
  // 옵션: [{color, size, qty}] (예전 형식 '블랙:M' 문자열도 허용)
  var opts = (reg.options || []).map(function (o) {
    if (o && typeof o === 'object') return { color: hubStr_(o.color, 40), size: hubStr_(o.size, 40), qty: Math.max(0, Math.round(hubNum_(o.qty))), barcode: o.barcode ? hubCorpBar_(p.corp, o.barcode) : '' };
    var a = String(o || '').split(':'); return { color: hubStr_(a[0], 40), size: hubStr_(a[1], 40), qty: 0, barcode: '' };
  }).filter(function (o) { return o.color || o.size; });
  var hasC = opts.some(function (o) { return o.color; }), hasS = opts.some(function (o) { return o.size; });
  var oname = hasC && hasS ? '컬러/사이즈' : hasC ? '컬러' : '사이즈';   // 사방넷은 ':'를 '/'로 바꿔 저장 → 처음부터 '/' 사용
  var stock = Math.max(0, Math.round(hubNum_(reg.stock != null ? reg.stock : p.stock)));
  var options = opts.length ? opts.map(function (o, i) {
    return { optionName: oname, optionDetailName: hasC && hasS ? (o.color || '-') + '/' + (o.size || '-') : (o.color || o.size), stockQuantity: o.qty, additionalAmount: 0, optionSupplyStatusCode: 'SALE', barcode: o.barcode || (opts.length === 1 ? (p.barcode || '') : ''), safetyStockQuantity: 0 };
  }) : [{ optionName: '단품', optionDetailName: '단품', stockQuantity: stock, additionalAmount: 0, optionSupplyStatusCode: 'SALE', barcode: p.barcode || '', safetyStockQuantity: 0 }];
  var photos = (reg.photos || []).filter(function (x) { return x && x.url; }).slice(0, 10);
  var esc = function (t) { return String(t || '').replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
  var desc = '<div style="text-align:center;max-width:860px;margin:0 auto;font-family:sans-serif;">' +
    (reg.detail ? '<p style="font-size:16px;line-height:1.7;margin:24px 0;">' + esc(reg.detail).replace(/\n/g, '<br>') + '</p>' : '') +
    photos.map(function (ph) { return '<img src="' + ph.url + '" style="width:100%;display:block;margin:0 auto 8px;">'; }).join('') + '</div>';
  var target = { '남성': 'MALE', '여성': 'FEMALE', '공용': 'UNISEX', '아동': 'JUNIOR' }[reg.gender];
  var o = {
    customProductCode: p.id, productName: hubStr_(p.name, 200), brandName: hubStr_(p.brand, 60), manufacturerName: hubStr_(p.brand, 60) || '상세페이지 참조',
    modelNo: hubStr_(reg.modelNo, 60), modelName: hubStr_(reg.modelNo, 60),
    productDivisionCode: 'PURCHASE', myCategoryCodeL: cat, originName: '123',
    productSupplyStatusCode: reg.supply === 'IN_SUPPLY' ? 'IN_SUPPLY' : 'WAITING', deliveryCostCode: 'FREE', deliveryCost: 0, taxCode: 'TAXABLE',
    costPrice: hubNum_(p.cost), sellingPrice: hubNum_(p.price), consumerPrice: hubNum_(reg.tagPrice) || hubNum_(p.price),
    attributeInfo: attrs,
    optionInfo: { stockUseYn: 'Y', optionEditCode: 'RESET', options: options },
    imageInfo: photos.map(function (ph, i) { return { imageSrno: String(i + 1), imagePath: ph.url }; }),
    productDetailDescription: desc,
    adminMemo: '셀렉트인 OPS 등록서 ' + p.id + (reg.note ? ' · ' + hubStr_(reg.note, 200) : '')
  };
  if (target) o.productTargetCode = target;
  if (!o.modelNo) { delete o.modelNo; delete o.modelName; }
  if (p.sbnPrd || reg.sbnProductCode) o.optionInfo.options.forEach(function (x) { delete x.stockQuantity; });   // 이미 등록된 상품 수정 시 재고는 건드리지 않음
  return { product: o, noticeType: type };
}
function hubRegSend_(req, me) {
  var reg = req.reg || {};
  var saved = hubRegSave_(Object.assign({}, req, { status: 'request' }), me);
  if (saved.error) return saved;
  var p = saved.product;
  var built = hubRegPayload_(p, reg);
  var res = hubSbnCall_('POST', '/v3/sb/product/upsert', { products: [built.product] }, 'PRODUCTION');
  var d = res && res.data ? res.data : res, r0 = (d && d.results && d.results[0]) || {};
  if (d && d.failCount) return { error: '사방넷 등록 실패: ' + JSON.stringify(r0).slice(0, 300), product: p };
  var code = r0.productCode || r0.prdNo || '';
  if (!code) { try { var g = hubSbnCall_('GET', '/v3/sb/product?customProductCode=' + encodeURIComponent(p.id), null, 'PRODUCTION'); code = String((g.data || g).productCode || ''); } catch (e) {} }
  var hit = hubFindProduct_(p.id), rg = {};
  try { rg = JSON.parse(hit.p.reg || '{}'); } catch (e) {}
  rg.sbnProductCode = code; rg.sentAt = hubNow_(); rg.sentBy = me.name; rg.noticeType = built.noticeType;
  var sts = built.product.productSupplyStatusCode === 'IN_SUPPLY' ? '판매' : '대기중', now = hubNow_();
  var row = hubRow_(Object.assign({}, hit.p, { sbnPrd: code || hit.p.sbnPrd, sbnSku: hit.p.sbnSku || '0001', regStatus: '등록완료',
    sbnStatus: sts, reg: JSON.stringify(rg).slice(0, 45000), updatedAt: now, updatedBy: me.name }));
  hit.sh.getRange(hit.row, 1, 1, row.length).setNumberFormats([hubFormats_()]).setValues([row]);
  var regQty = (reg.options || []).map(function (o) { return o && typeof o === 'object' ? Math.max(0, Math.round(hubNum_(o.qty))) : null; });
  var split = code ? hubRegSplitOptions_(hubProductObj_(row), built.product.optionInfo.options, code, sts, me, regQty) : { added: 0 };
  var fin = hubFindProduct_(p.id);
  return { ok: true, product: fin.p, productCode: code, result: r0, optionRows: split.added, products: split.products || [] };
}
/* 옵션이 여러 개면 앱에서도 단품(옵션)마다 한 줄씩 — 사방넷 단품코드 0001, 0002 … 순서와 맞춤
 * 첫 옵션 = 등록서 상품 줄, 나머지는 새 줄 (이미 있으면 갱신). 재고는 옵션별 수량으로 맞추고 이력 남김 */
function hubRegSplitOptions_(base, options, code, sts, me, regQty) {
  if (!options || options.length < 2) return { added: 0 };
  var list = hubProducts_(), byKey = {}, now = hubNow_(), logs = [], added = 0, out = [];
  list.forEach(function (x) { if (x.sbnPrd) byKey[x.sbnPrd + '-' + x.sbnSku] = x; });
  var first = !byKey[code + '-0002'];   // 처음 나눌 때만 재고를 옵션 수량으로 맞춤 (이후엔 입출고 기준)
  options.forEach(function (o, i) {
    var sku = ('000' + (i + 1)).slice(-4), key = code + '-' + sku, qty = first ? (o.stockQuantity != null ? o.stockQuantity : (regQty && regQty[i] != null ? regQty[i] : null)) : null;
    var opt = String(o.optionDetailName || '').replace(/^-\/|\/-$/g, '');
    var t = i === 0 ? list.filter(function (x) { return x.id === base.id; })[0] : byKey[key];
    if (t) {
      t.option = opt; t.sbnPrd = code; t.sbnSku = sku; if (o.barcode) t.barcode = o.barcode;
      if (qty != null && t.stock !== qty) { logs.push(['재고이력', [now, t.id, t.sku, t.name, '옵션분리', qty - t.stock, qty, '등록서 옵션 재고', me.name]]); t.stock = qty; }
      t.updatedAt = now; t.updatedBy = me.name; out.push(t);
    } else {
      var n = Object.assign({}, base, { id: hubNewId_(), sku: key, option: opt, barcode: o.barcode || '', stock: qty || 0, sbnPrd: code, sbnSku: sku,
        sbnStatus: sts, regStatus: '', reg: '', barPending: '', updatedAt: now, updatedBy: me.name });
      list.push(n); added++; out.push(n);
      if (qty) logs.push(['재고이력', [now, n.id, n.sku, n.name, '기초재고', qty, qty, '등록서 옵션', me.name]]);
    }
  });
  hubWriteAll_(list); hubWriteLogs_(logs);
  return { added: added, products: out };
}

/* ===================== 앱 재고 → 사방넷 재고 (API) =====================
 * 사방넷 상품을 조회해 자체상품코드·옵션명을 확인한 뒤, 해당 옵션의 재고수량(stockQuantity)만 앱 재고로 수정
 * 모음전은 원본으로, 가상재고(재고관리 사용안함)·위탁은 건너뜀 */
function hubSbnStockPush_(ids, me, preload) {
  if (!ids.length) return { error: '반영할 상품이 없습니다' };
  var all = preload || hubProducts_(), byId = {}, byKey = {};
  all.forEach(function (x) { byId[x.id] = x; if (x.sbnPrd) byKey[x.sbnPrd + '-' + x.sbnSku] = x; });
  var groups = {}, skipped = [];
  ids.forEach(function (id) {
    var x = byId[id]; if (!x) return;
    if (x.link && byKey[x.link]) x = byKey[x.link];
    if (!x.sbnPrd) { skipped.push(x.name + ' (사방넷 코드 없음)'); return; }
    if (x.stocMng === 'N' || x.type === '위탁') { skipped.push(x.name + ' (가상재고)'); return; }
    (groups[x.sbnPrd] = groups[x.sbnPrd] || {})[x.sbnSku] = x;
  });
  var done = [], failed = [];
  Object.keys(groups).forEach(function (prd) {
    try {
      var g = hubSbnCall_('GET', '/v3/sb/product?productCode=' + prd, null, 'PRODUCTION'); var d = g.data || g;
      var opts = (d.optionInfo && d.optionInfo.options) || [];
      var send = [];
      Object.keys(groups[prd]).forEach(function (sku) {
        var x = groups[prd][sku], idx = parseInt(sku, 10) - 1;
        var o = opts.filter(function (z) { return String(z.optionDetailName).replace(/\s/g, '') === String(x.option || '').replace(/\s/g, ''); })[0] || opts[idx];
        if (!o) { failed.push(prd + '-' + sku + ' 옵션 못 찾음'); return; }
        send.push({ optionDetailName: o.optionDetailName, stockQuantity: Math.max(0, Math.round(x.stock)) });
        done.push({ key: prd + '-' + sku, name: x.name, option: o.optionDetailName, qty: Math.max(0, Math.round(x.stock)) });
      });
      if (!send.length) return;
      var res = hubSbnCall_('POST', '/v3/sb/product/upsert', { products: [{ customProductCode: d.customProductCode, optionInfo: { optionEditCode: 'RESET', options: send } }] }, 'PRODUCTION');
      var rd = res.data || res, r0 = (rd.results || [])[0] || {};
      if (rd.failCount || r0.status === false) { failed.push(prd + ' ' + (r0.errorMessage || '실패')); done = done.filter(function (z) { return z.key.indexOf(prd + '-') !== 0; }); }
    } catch (e) { failed.push(prd + ' ' + String(e.message).slice(0, 120)); }
  });
  if (done.length && !preload) hubSheet_('재고이력').appendRow([hubNow_(), '', '', done.length + '개 단품', '사방넷반영', 0, '', done.map(function (z) { return z.key + '=' + z.qty; }).join(', ').slice(0, 900), me.name]);
  return { ok: true, done: done, failed: failed, skipped: skipped };
}

/* 입고하면서 새 컬러·옵션 추가: 사방넷 상품에 단품 추가(API) → 앱에 단품 줄 추가 + 입고 기록
 * req: {id(같은 품번의 아무 단품), color, size, qty, barcode} */
function hubOptionAdd_(req, me) {
  var base = hubFindProduct_(req.id); if (!base) return { error: '상품을 찾을 수 없습니다' };
  var p = base.p; if (!p.sbnPrd) return { error: '사방넷 상품코드가 없는 상품이에요' };
  var color = hubStr_(req.color, 40), size = hubStr_(req.size, 40), qty = Math.max(0, Math.round(hubNum_(req.qty)));
  if (!color && !size) return { error: '컬러나 사이즈를 입력하세요' };
  var g = hubSbnCall_('GET', '/v3/sb/product?productCode=' + p.sbnPrd, null, 'PRODUCTION'), d = g.data || g;
  var opts = (d.optionInfo && d.optionInfo.options) || [], oname = (opts[0] && opts[0].optionName) || '컬러/사이즈';
  var sep = oname.indexOf('/') >= 0 ? '/' : oname.indexOf(':') >= 0 ? ':' : '';
  var detail = sep ? (color || '-') + sep + (size || '-') : (color || size);
  var norm = function (t) { return String(t || '').replace(/\s/g, '').toUpperCase(); };
  if (opts.some(function (o) { return norm(o.optionDetailName) === norm(detail); })) return { error: '이미 있는 옵션이에요: ' + detail };
  var bar = req.barcode ? hubCorpBar_(p.corp, req.barcode) : '';
  var res = hubSbnCall_('POST', '/v3/sb/product/upsert', { products: [{ customProductCode: d.customProductCode, optionInfo: { optionEditCode: 'RESET',
    options: [{ optionName: oname, optionDetailName: detail, stockQuantity: qty, additionalAmount: 0, optionSupplyStatusCode: 'SALE', barcode: bar, safetyStockQuantity: 0 }] } }] }, 'PRODUCTION');
  var rd = res.data || res, r0 = (rd.results || [])[0] || {};
  if (rd.failCount || r0.status === false) return { error: '사방넷 옵션 추가 실패: ' + (r0.errorMessage || '') };
  var g2 = hubSbnCall_('GET', '/v3/sb/product?productCode=' + p.sbnPrd, null, 'PRODUCTION'), d2 = g2.data || g2, o2 = (d2.optionInfo && d2.optionInfo.options) || [];
  var idx = -1; o2.forEach(function (o, i) { if (norm(o.optionDetailName) === norm(detail)) idx = i; });
  var sku = ('000' + (idx >= 0 ? idx + 1 : o2.length)).slice(-4), now = hubNow_();
  var n = Object.assign({}, p, { id: hubNewId_(), sku: p.sbnPrd + '-' + sku, sbnSku: sku, option: (idx >= 0 ? o2[idx].optionDetailName : detail),
    barcode: bar || (idx >= 0 ? String(o2[idx].barcode || '') : ''), stock: qty, regStatus: '', reg: '', barPending: '', updatedAt: now, updatedBy: me.name, link: '', stocMng: 'Y' });
  var sh = hubSheet_('상품'), row = hubRow_(n);
  sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setNumberFormats([hubFormats_()]).setValues([row]);
  if (qty) hubSheet_('재고이력').appendRow([now, n.id, n.sku, n.name, '입고', qty, qty, '새 옵션 추가 · ' + n.option, me.name]);
  return { ok: true, product: hubProductObj_(row), move: qty ? { at: now, id: n.id, sku: n.sku, name: n.name, type: '입고', qty: qty, after: qty, memo: '새 옵션 추가 · ' + n.option, by: me.name } : null };
}

/** 처음 한 번: 드라이브·외부 호출 권한 승인용 (실행만 하면 됨) */
function hubAuthorize() {
  hubPhotoFolder_();
  UrlFetchApp.fetch('https://api.anthropic.com', { muteHttpExceptions: true });
  Logger.log('권한 승인 완료. 사진 폴더: ' + hubPhotoFolder_().getUrl());
}

/* ===================== 사방넷 API (중계 서버 경유) =====================
 * 사방넷 API는 등록된 고정 IP에서만 호출 가능 → 카페24 웹호스팅(222.122.39.21)의 relay.php 를 거쳐 호출
 * 스크립트 속성: SBN_SECRET (프로덕션 시크릿, 필수) · SBN_SANDBOX_SECRET (선택) · HUB_RELAY_KEY (자동 생성)
 */
var HUB_SBN = {
  clientCd: 'ebb78d9a-cc14-4849-acfe-53aab0a9c4da',   // 개발자센터 앱 코드 (공개돼도 되는 식별자)
  svc: 'mw76946',                                      // 사방넷 서비스코드
  relay: 'https://sln0217.mycafe24.com/sbapi/relay.php'
};
function hubRelayKey_() {
  var p = PropertiesService.getScriptProperties(), k = p.getProperty('HUB_RELAY_KEY');
  if (!k) { k = hubRandom_(48); p.setProperty('HUB_RELAY_KEY', k); }
  return k;
}
function hubRelay_(payload) {
  payload.relayKey = hubRelayKey_();
  var res = UrlFetchApp.fetch(HUB_SBN.relay, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
  var t = res.getContentText();
  try { return JSON.parse(t); } catch (e) { return { error: 'relay_http_' + res.getResponseCode(), raw: t.slice(0, 300) }; }
}
function hubSbnToken_(mode) {
  mode = mode === 'SANDBOX' ? 'SANDBOX' : 'PRODUCTION';
  var cache = CacheService.getScriptCache(), ck = 'sbn_tok_' + mode, hit = cache.get(ck);
  if (hit) return hit;
  var secret = PropertiesService.getScriptProperties().getProperty(mode === 'SANDBOX' ? 'SBN_SANDBOX_SECRET' : 'SBN_SECRET');
  if (!secret) throw new Error('사방넷 시크릿이 없습니다. 스크립트 속성 ' + (mode === 'SANDBOX' ? 'SBN_SANDBOX_SECRET' : 'SBN_SECRET') + ' 를 넣어주세요');
  var r = hubRelay_({ action: 'token', mode: mode, clientCd: HUB_SBN.clientCd, secret: secret });
  if (!r.ok || !r.body || !r.body.access_token) throw new Error('사방넷 토큰 발급 실패: ' + JSON.stringify(r.body || r).slice(0, 300));
  var ttl = Math.max(60, Math.min(21600, (Number(r.body.expires_in) || 10800) - 1900));   // 만료 30분 전에 새로 받음
  cache.put(ck, r.body.access_token, ttl);
  return r.body.access_token;
}
/** 사방넷 API 호출 — 실패하면 예외 */
function hubSbnCall_(method, path, body, mode) {
  var r = hubRelay_({ action: 'call', mode: mode || 'PRODUCTION', token: hubSbnToken_(mode), svc: HUB_SBN.svc, method: method, path: path, body: body == null ? null : body });
  if (r.status === 401) { CacheService.getScriptCache().remove('sbn_tok_' + (mode === 'SANDBOX' ? 'SANDBOX' : 'PRODUCTION')); }
  if (!r.ok) throw new Error('사방넷 API 오류 ' + (r.status || '') + ' ' + JSON.stringify(r.body || r.error || r).slice(0, 400));
  return r.body;
}
/** 연결 점검 (편집기에서 실행) — 중계 서버 IP · 토큰 · 읽기 전용 호출(쇼핑몰 목록) */
function hubSbnTest() {
  var ip = hubRelay_({ action: 'ip' });
  Logger.log('중계 서버: ' + JSON.stringify(ip));
  var p = PropertiesService.getScriptProperties();
  ['SANDBOX', 'PRODUCTION'].forEach(function (m) {
    if (!p.getProperty(m === 'SANDBOX' ? 'SBN_SANDBOX_SECRET' : 'SBN_SECRET')) { Logger.log(m + ': 시크릿 없음 — 건너뜀'); return; }
    try {
      hubSbnToken_(m); Logger.log(m + ': 토큰 발급 성공');
      var malls = hubSbnCall_('GET', '/v3/sb/mall/SHOP', null, m);
      Logger.log(m + ': 쇼핑몰 ' + (malls && malls.totalCount) + '개 조회 성공');
    } catch (e) { Logger.log(m + ': ' + e.message); }
  });
}

/* ===================== 설정 ===================== */
function hubConfig_() {
  var o = {};
  hubRows_('설정').vals.forEach(function (v) { if (v[0]) o[String(v[0])] = { value: String(v[1]), at: String(v[2]), by: String(v[3]) }; });
  return o;
}
function hubConfigSet_(key, value, me) {
  key = hubStr_(key, 60); if (!key) throw new Error('키가 없습니다');
  var r = hubRows_('설정'), row = [key, hubStr_(value, 2000), hubNow_(), me.name];
  for (var i = 0; i < r.vals.length; i++) if (String(r.vals[i][0]) === key) { r.sh.getRange(i + 2, 1, 1, 4).setValues([row]); return; }
  r.sh.appendRow(row);
}

/* ===================== 첫 화면 데이터 ===================== */
function hubBoot_(me, compact) {
  if (!compact) { var o0 = { me: me, products: hubProducts_(), history: hubHistory_(null, 200), config: hubConfig_() }; if (me.role === '관리자') o0.users = hubUsers_(); return o0; }   // 옛 화면 호환
  // 상품은 가볍게: 열 이름 + 값 배열 (객체 키 반복 제거, 등록서 JSON은 등록서 상품만)
  var iReg = HUB_P_FIELDS.indexOf('reg'), iRs = HUB_P_FIELDS.indexOf('regStatus');
  var rows = hubRows_('상품').vals.filter(function (v) { return v[0]; }).map(function (v) {
    return v.map(function (x, i) { if (x instanceof Date) return Utilities.formatDate(x, 'Asia/Seoul', 'yyyy-MM-dd HH:mm'); if (i === iReg && !v[iRs]) return ''; return x === '' ? '' : x; });
  });
  var out = { me: me, pcols: HUB_P_FIELDS, prows: rows, history: hubHistory_(null, 200), config: hubConfig_() };
  if (me.role === '관리자') out.users = hubUsers_();
  return out;
}
