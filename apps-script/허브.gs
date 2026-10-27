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
  상품: ['id', 'SKU', '바코드', '상품명', '브랜드', '옵션', '법인', '구분', '원가', '판매가', '재고', '안전재고', '위치', '메모', '수정일', '수정자'],
  재고이력: ['일시', '상품id', 'SKU', '상품명', '구분', '수량', '변경후재고', '메모', '작업자'],
  원가이력: ['일시', '상품id', 'SKU', '상품명', '이전원가', '새원가', '작업자'],
  직원: ['이름', '권한', 'PIN', '사용', '등록일'],
  설정: ['키', '값', '수정일', '수정자']
};
var HUB_P_FIELDS = ['id', 'sku', 'barcode', 'name', 'brand', 'option', 'corp', 'type', 'cost', 'price', 'stock', 'safety', 'loc', 'memo', 'updatedAt', 'updatedBy'];
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
      case 'boot': return hubOut_(hubBoot_(me));
      case 'product_save': return hubOut_(hubLocked_(function () { return hubProductSave_(req.p, me); }));
      case 'product_delete': if (!admin) return hubOut_({ error: '관리자만 삭제할 수 있습니다' });
        return hubOut_(hubLocked_(function () { return hubProductDelete_(req.id); }));
      case 'products_import': return hubOut_(hubLocked_(function () { return hubImport_(req.rows, me); }));
      case 'stock_move': return hubOut_(hubLocked_(function () { return hubStockMove_(req, me); }));
      case 'history': return hubOut_({ history: hubHistory_(req.id, 300) });
      case 'cost_history': return hubOut_({ costs: hubCostHistory_(req.id) });
      case 'config_set': if (!admin && req.key !== 'scheduler_check') return hubOut_({ error: '관리자만 바꿀 수 있습니다' });
        return hubOut_(hubLocked_(function () { hubConfigSet_(req.key, req.value, me); return { ok: true, config: hubConfig_() }; }));
      case 'users': if (!admin) return hubOut_({ error: '관리자만 볼 수 있습니다' });
        return hubOut_({ users: hubUsers_() });
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
    hubUserSave_({ name: '대장', role: '관리자', pin: pin, active: true }, { name: '설정' });
    Logger.log('관리자 계정이 만들어졌습니다 → 이름: 대장 / PIN: ' + pin + '  (앱 설정 화면에서 바꿀 수 있습니다)');
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
  ['cost', 'price', 'stock', 'safety'].forEach(function (f) { o[f] = hubNum_(o[f]); });
  ['id', 'sku', 'barcode'].forEach(function (f) { o[f] = String(o[f] == null ? '' : o[f]); });
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
    option: hubStr_(p.option, 80), corp: p.corp === '겐더샵' ? '겐더샵' : '셀렉트인', type: p.type === '위탁' ? '위탁' : '사입',
    cost: hubNum_(p.cost), price: hubNum_(p.price), safety: hubNum_(p.safety), loc: hubStr_(p.loc, 40), memo: hubStr_(p.memo, 300)
  };
}
function hubDupCheck_(c, exceptId) {
  var list = hubProducts_();
  for (var i = 0; i < list.length; i++) {
    var p = list[i]; if (p.id === exceptId) continue;
    if (c.barcode && p.barcode === c.barcode) return '같은 바코드가 이미 있습니다: ' + p.name;
    if (c.sku && p.sku === c.sku) return '같은 상품코드(SKU)가 이미 있습니다: ' + p.name;
  }
  return '';
}
function hubProductSave_(raw, me) {
  if (!raw) return { error: 'bad_request' };
  var c = hubClean_(raw);
  if (!c.name) return { error: '상품명을 입력하세요' };
  var hit = raw.id ? hubFindProduct_(raw.id) : null;
  var dup = hubDupCheck_(c, hit ? hit.p.id : null);
  if (dup) return { error: dup };
  var now = hubNow_(), sh = hubSheet_('상품');
  if (hit) {
    var p = hit.p;
    if (p.cost !== c.cost) hubSheet_('원가이력').appendRow([now, p.id, c.sku, c.name, p.cost, c.cost, me.name]);
    var row = [p.id, c.sku, c.barcode, c.name, c.brand, c.option, c.corp, c.type, c.cost, c.price, p.stock, c.safety, c.loc, c.memo, now, me.name];
    sh.getRange(hit.row, 1, 1, row.length).setNumberFormats([hubFormats_()]).setValues([row]);
    return { ok: true, product: hubProductObj_(row) };
  }
  var id = 'P' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyMMddHHmmss') + hubRandom_(3);
  var stock = hubNum_(raw.stock);
  var nrow = [id, c.sku, c.barcode, c.name, c.brand, c.option, c.corp, c.type, c.cost, c.price, stock, c.safety, c.loc, c.memo, now, me.name];
  sh.getRange(sh.getLastRow() + 1, 1, 1, nrow.length).setNumberFormats([hubFormats_()]).setValues([nrow]);
  if (stock) hubSheet_('재고이력').appendRow([now, id, c.sku, c.name, '기초재고', stock, stock, '상품 등록', me.name]);
  if (c.cost) hubSheet_('원가이력').appendRow([now, id, c.sku, c.name, '', c.cost, me.name]);
  return { ok: true, product: hubProductObj_(nrow) };
}
function hubFormats_() {   // id·SKU·바코드는 글자로 저장 (앞자리 0 보존)
  return HUB_P_FIELDS.map(function (f) { return /^(id|sku|barcode|name|brand|option|corp|type|loc|memo|updatedAt|updatedBy)$/.test(f) ? '@' : '#,##0'; });
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
  var list = hubProducts_(), byKey = {};
  list.forEach(function (p) { if (p.barcode) byKey['b:' + p.barcode] = p; if (p.sku) byKey['s:' + p.sku] = p; });
  var sh = hubSheet_('상품'), now = hubNow_(), added = 0, updated = 0, skipped = 0, out = [], logs = [];
  var all = hubRows_('상품').vals;
  rows.forEach(function (raw) {
    var c = hubClean_(raw);
    if (!c.name) { skipped++; return; }
    var hit = (c.barcode && byKey['b:' + c.barcode]) || (c.sku && byKey['s:' + c.sku]);
    if (hit) {
      for (var i = 0; i < all.length; i++) if (String(all[i][0]) === hit.id) {
        var keep = hubProductObj_(all[i]);
        all[i] = [keep.id, c.sku || keep.sku, c.barcode || keep.barcode, c.name, c.brand || keep.brand, c.option || keep.option, c.corp, c.type,
          raw.cost === '' || raw.cost == null ? keep.cost : c.cost, raw.price === '' || raw.price == null ? keep.price : c.price,
          keep.stock, raw.safety === '' || raw.safety == null ? keep.safety : c.safety, c.loc || keep.loc, c.memo || keep.memo, now, me.name];
        if (keep.cost !== all[i][8]) logs.push(['원가이력', [now, keep.id, all[i][1], c.name, keep.cost, all[i][8], me.name]]);
        updated++; break;
      }
      return;
    }
    var id = 'P' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyMMddHHmmss') + hubRandom_(4);
    var stock = hubNum_(raw.stock);
    var nrow = [id, c.sku, c.barcode, c.name, c.brand, c.option, c.corp, c.type, c.cost, c.price, stock, c.safety, c.loc, c.memo, now, me.name];
    out.push(nrow); added++;
    var nk = hubProductObj_(nrow); if (c.barcode) byKey['b:' + c.barcode] = nk; if (c.sku) byKey['s:' + c.sku] = nk;
    if (stock) logs.push(['재고이력', [now, id, c.sku, c.name, '기초재고', stock, stock, '엑셀 가져오기', me.name]]);
  });
  var fm = hubFormats_();
  if (all.length) sh.getRange(2, 1, all.length, fm.length).setNumberFormats(all.map(function () { return fm; })).setValues(all);
  if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, fm.length).setNumberFormats(out.map(function () { return fm; })).setValues(out);
  ['재고이력', '원가이력'].forEach(function (tab) {
    var rs = logs.filter(function (l) { return l[0] === tab; }).map(function (l) { return l[1]; });
    if (rs.length) { var s = hubSheet_(tab); s.getRange(s.getLastRow() + 1, 1, rs.length, rs[0].length).setValues(rs); }
  });
  return { ok: true, added: added, updated: updated, skipped: skipped, products: hubProducts_() };
}

/* ===================== 재고 ===================== */
function hubStockMove_(req, me) {
  var hit = hubFindProduct_(req.id);
  if (!hit) return { error: '상품을 찾을 수 없습니다' };
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
  return { ok: true, product: hit.p, move: { at: now, id: hit.p.id, sku: hit.p.sku, name: hit.p.name, type: type, qty: delta, after: after, memo: hubStr_(req.memo, 200), by: me.name } };
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
function hubBoot_(me) {
  var out = { me: me, products: hubProducts_(), history: hubHistory_(null, 200), config: hubConfig_() };
  if (me.role === '관리자') out.users = hubUsers_();
  return out;
}
