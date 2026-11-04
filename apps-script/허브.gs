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
  포이즌입찰: ['계정', '품번', '상품명', '브랜드', '옵션', '입찰가', '입찰수', '판매중수량', '카테고리', 'spuId', '동기화'],
  사방넷수집: ['쇼핑몰코드', '쇼핑몰', '로그인ID', '마지막주문수집', '주문수집자', '주문수집결과', '마지막클레임수집', '클레임수집자', '스케줄러사용', '스케줄주문', '스케줄클레임', '스케줄재고송신', '스케줄송장', '메시지', '동기화'],
  사방넷등록: ['쇼핑몰코드', '쇼핑몰', '로그인ID', '상품수', '목록', '동기화'],
  포이즌판매: ['계정', '주문번호', '상태', '탭', '구분', '품번', '상품명', '브랜드', '사이즈', '판매가', '수수료', '정산액', '주문일', '발송기한', '동기화'],
  크림보관: ['계정', '보관id', '주문번호', '단계', '상태', '품번', '상품명', '사이즈', '운송장', '신청일', '수정일', '동기화'],
  크림매핑: ['크림품번', '사방넷상품코드', '컬러', '수정일', '수정자', '사이즈연결'],
  외부시세: ['상품코드', '검색어', '최저가', '판매처', '링크', '상품명', '일치', '결과수', '우리최저', '조회일시'],
  크림판매: ['계정', '주문번호', '입찰id', '상태', '구분', '품번', '상품명', '옵션', '판매가', '수수료', '정산액', '주문일', '정산일', '지급예정일', '동기화'],
  인스타DM: ['계정', '이름', '상태', '상품', '발송일', '팔로업', '메모', '이력', '수정일', '수정자'],
  인스타발굴: ['계정', '팔로워', '팔로워수', '카테고리', '상품', '출처', '추적', '메모'],
  인스타상품: ['브랜드', '카테고리', '상품수', '라인업', '허들', '타겟', '상태', '조건', '노션링크', '지난공구매출', '상세정보'],
  인스타템플릿: ['이름', '내용', '수정일', '수정자']
};
HUB_TABS['상품삭제보관'] = HUB_TABS['상품'].concat(['삭제일시', '삭제자']);
var HUB_P_FIELDS = ['id', 'sku', 'barcode', 'name', 'brand', 'option', 'corp', 'type', 'cost', 'price', 'stock', 'safety', 'loc', 'memo', 'updatedAt', 'updatedBy', 'sbnPrd', 'sbnSku', 'img', 'sbnStatus', 'cat', 'regStatus', 'reg', 'barPending', 'stocMng', 'vstock', 'owner', 'link', 'setDiv'];
var HUB_TOKEN_DAYS = 90;
var HUB_DEFAULT_PIN = '1234';   // 새 직원·초기화 PIN
/* 권한: 총괄(대장, 전체) > 관리자(진금영 등) > 직원 */
function hubIsAdmin_(role) { return role === '총괄' || role === '관리자'; }
function hubIsOwner_(role) { return role === '총괄'; }
/* 한 번만: 대장 → 총괄, 진금영 관리자 계정(PIN 1234) 추가 */
function hubRolesV2_() {
  var P = PropertiesService.getScriptProperties();
  if (P.getProperty('hub_roles_v2')) return;
  hubLocked_(function () {
    if (P.getProperty('hub_roles_v2')) return;
    var sh = hubSheet_('직원'), r = hubRows_('직원');
    if (!r.vals.some(function (v) { return String(v[1]) === '총괄'; })) {
      var i = -1;
      r.vals.forEach(function (v, k) { if (String(v[0]) === '대장') i = k; });
      if (i < 0) r.vals.forEach(function (v, k) { if (i < 0 && String(v[1]) === '관리자') i = k; });
      if (i >= 0) sh.getRange(i + 2, 2).setValue('총괄');
    }
    if (!hubUserRow_('진금영')) sh.appendRow(['진금영', '관리자', hubHash_('진금영|' + HUB_DEFAULT_PIN), true, hubNow_()]);
    hubUGenBump_();
    P.setProperty('hub_roles_v2', hubNow_());
  });
}

/* ===================== 진입점 ===================== */
function doPost(e) {
  var req = {};
  try { req = JSON.parse(e.postData.contents || '{}'); } catch (x) { return hubOut_({ error: 'bad_request' }); }
  try {
    try { hubRolesV2_(); } catch (x) {}
    if (req.action === 'login') { var lg = hubLogin_(req.name, req.pin); if (lg.token && req.ch === 'next' && !hubIsOwner_(lg.role)) return hubOut_({ error: '총괄 작업판은 총괄 계정만 들어올 수 있어요. 일반 OPS 주소로 접속하세요' }); return hubOut_(lg); }
    var me = hubVerify_(req.token);
    if (!me) return hubOut_({ error: 'login' });
    if (req.ch === 'next' && !hubIsOwner_(me.role)) return hubOut_({ error: 'login' });
    var admin = hubIsAdmin_(me.role), owner = hubIsOwner_(me.role);
    switch (req.action) {
      case 'boot': return hubOut_(hubBoot_(me, req.compact));
      case 'product_save': return hubOut_(hubLocked_(function () { return hubProductSave_(req.p, me); }));
      case 'product_delete': if (!admin) return hubOut_({ error: '관리자만 삭제할 수 있습니다' });
        return hubOut_(hubLocked_(function () { return hubProductDelete_(req.id); }));
      case 'products_purge_missing': if (!owner) return hubOut_({ error: '총괄만 할 수 있어요' });
        return hubOut_(hubLocked_(function () { return hubPurgeMissing_(me, req.dry); }));
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
      case 'pzn_sync': return hubOut_(hubLocked_(function () { return hubPznSync_(req, me); }));
      case 'pzn_list': return hubOut_(hubPznList_());
      case 'sbn_stock_sync': if (!admin) return hubOut_({ error: '관리자만 사방넷 재고를 맞출 수 있습니다' });   // 사방넷 관리자 화면(sbn.js)이 읽은 현재고로 앱 재고만 맞춤
        return hubOut_(hubLocked_(function () { return hubSbnStockSync_(req, me); }));
      case 'sbn_sku_sync': if (!admin) return hubOut_({ error: '관리자만 사방넷 동기화를 할 수 있습니다' });   // 사방넷 단품 전체(sbn.js) → 앱 상품 정보·재고 맞춤
        return hubOut_(hubLocked_(function () { return hubSbnSkuSync_(req, me); }));
      case 'sbr_sync': if (!admin) return hubOut_({ error: '관리자만 저장할 수 있습니다' });   // 쇼핑몰별 상품 등록 현황 (sbn.js)
        return hubOut_(hubLocked_(function () { return hubSbrSync_(req, me); }));
      case 'sbc_sync': if (!admin) return hubOut_({ error: '관리자만 저장할 수 있습니다' });   // 쇼핑몰별 주문수집·스케줄러 상태 (sbn.js)
        return hubOut_(hubLocked_(function () { return hubSbcSync_(req, me); }));
      case 'sbr_list': return hubOut_(hubSbrList_());
      case 'krm_map_set': return hubOut_(hubLocked_(function () { return hubKrmMapSet_(req, me); }));
      case 'sbn_sales_check': if (!admin) return hubOut_({ error: '관리자만 볼 수 있습니다' });   // 사방넷 API(주문일) 기준 일별·법인·쇼핑몰 집계 — 매출판 대조용 (읽기 전용)
        return hubOut_(hubSbnSalesRange_(req.from, req.to));
      case 'sales': return hubOut_(hubSales_(me));
      case 'mc_raw_put': if (!admin) return hubOut_({ error: '관리자만 저장할 수 있습니다' });
        return hubOut_(hubLocked_(function () { return hubMcRawPut_(req); }));
      case 'nv_items': if (!admin) return hubOut_({ error: '관리자만 볼 수 있습니다' });
        return hubOut_(hubNvItems_(req.from, req.to));
      case 'cost_force_set': if (!owner) return hubOut_({ error: '총괄만 할 수 있어요' });
        return hubOut_(hubLocked_(function () { return hubCostForceSet_(req, me); }));
      case 'cost_force_apply': if (!owner) return hubOut_({ error: '총괄만 할 수 있어요' });   // dry=true: 쓰기 없이 미리보기
        return hubOut_(req.dry ? hubCostForceApply_(req.from, req.to, true, req.ordMap) : hubLocked_(function () { return hubCostForceApply_(req.from, req.to, false, req.ordMap); }));
      case 'ig_data': return hubOut_(hubIgData_(me, req.force));   // 인스타그램 공구 영업 (일정 시트 읽기 + DM 기록)
      case 'ig_reply_link': return hubOut_(hubIgReplyLink_(req));   // 셀러 회신 링크 만들기
      case 'ig_ai': return hubOut_(hubIgAi_(req, me));   // DM 작성 중 AI와 대화 (상품 정보·셀러 이력 바탕)
      case 'ig_dm_save': return hubOut_(hubLocked_(function () { return hubIgDmSave_(req.d || {}, me); }));
      case 'ig_tpl_save': if (!admin) return hubOut_({ error: '관리자만 템플릿을 바꿀 수 있습니다' });
        return hubOut_(hubLocked_(function () { return hubIgTplSave_(req.list || [], me); }));
      case 'events': return hubOut_(hubEvents_(req.force));   // 홈 행사 일정 캘린더 (공동구매 일정 시트 「일정」 탭, 읽기 전용)
      case 'sbn_reg_daily': return hubOut_(hubSbnRegDaily_(req.days, req.force));   // 사방넷 수집일 기준 법인별 건수 (조회 전용)
      case 'archive_list': if (!owner) return hubOut_({ error: '총괄만 할 수 있어요' });
        return hubOut_(hubLocked_(function () { var o = hubArchList_(); o.nv = hubNvStatus_(); return o; }));
      case 'archive_save': if (!owner) return hubOut_({ error: '총괄만 할 수 있어요' });
        return hubOut_(hubLocked_(function () { return hubArchSave_(req, me); }));
      case 'nv_save': if (!owner) return hubOut_({ error: '총괄만 할 수 있어요' });   // 스마트스토어 연결 정보 → 스크립트 속성 (화면에는 다시 보내지 않음)
        return hubOut_(hubNvSave_(req));
      case 'nv_check': if (!owner) return hubOut_({ error: '총괄만 할 수 있어요' });   // 하루치 네이버 값과 매출판 비교 (쓰기 없음)
        return hubOut_({ ok: true, date: req.date, rows: hubNvRunDay_(String(req.date || ''), true) });
      case 'nv_sync': if (!owner) return hubOut_({ error: '총괄만 할 수 있어요' });
        return hubOut_((function () { hubNvSync(); return { ok: true, status: hubNvStatus_() }; })());
      case 'month_close': if (!admin) return hubOut_({ error: '관리자만 볼 수 있습니다' });   // 월 마감 미리보기 (읽기 전용)
        return hubOut_(hubMonthClosePreview_(req.ym));
      case 'mc_tpl_put': if (!admin) return hubOut_({ error: '관리자만 저장할 수 있습니다' });   // 월마감 대시보드 템플릿(xlsx→구글시트)
        return hubOut_(hubMcdTplPut_(req));
      case 'mc_hist_put': if (!admin) return hubOut_({ error: '관리자만 저장할 수 있습니다' });   // 월마감 대시보드 비교용 월별 이력
        return hubOut_(hubMcdHistSet_(req.rows, me));
      case 'mc_hist_ops': if (!admin) return hubOut_({ error: '관리자만 실행할 수 있습니다' });   // 지난 달 비교 이력을 OPS 기준으로 다시 계산
        return hubOut_({ ok: true, rows: (req.yms || []).map(function (m) { return hubMcdHistFromOps_(hubMcYm_(m), me && me.name); }) });
      case 'sbn_skip_fix': if (!owner) return hubOut_({ error: '총괄만 할 수 있어요' });   // 스토어팜 중복 계정 사방넷 매출 0 처리
        return hubOut_(hubLocked_(hubSbnSkipFix_));
      case 'pzn_sales': if (!admin) return hubOut_({ error: '관리자만 실행할 수 있습니다' });   // 포이즌 거래 성공 → 매출판 비교(write면 반영)
        return hubOut_(req.write ? hubLocked_(function () { return hubPznSales_(hubMcYm_(req.ym), true, req.account, !!req.upOnly); }) : hubPznSales_(hubMcYm_(req.ym), false, req.account));
      case 'sbn_resync': if (!owner) return hubOut_({ error: '총괄만 할 수 있어요' });   // 매출판 그 달 사방넷 행을 지금 사방넷 API 값으로 맞춤
        return hubOut_(hubLocked_(function () { return hubSbnResync_(hubMcYm_(req.ym)); }));
      case 'mc_dash': if (!admin) return hubOut_({ error: '관리자만 만들 수 있습니다' });   // 월마감 대시보드(내부 회의용) 만들기 → 구글시트 링크
        return hubOut_((function () { var x = hubMcdBuild_(hubMcYm_(req.ym), me && me.name); return { ok: true, url: x.url, sum: x.sum }; })());
      case 'month_close_send': if (!admin) return hubOut_({ error: '관리자만 보낼 수 있습니다' });
        return hubOut_(hubMonthCloseSend_(req.ym, me, !!req.test));
      case 'ops_today': return hubOut_(hubOpsToday_(req.force));
      case 'plat_reco': return hubOut_(hubPlatReco_(req.force));
      case 'ext_price': return hubOut_(hubExtPrice_(req.items || []));      // 네이버 쇼핑 최저가 조회 (조회 전용)
      case 'ext_price_list': return hubOut_(hubExtPriceList_());
      case 'sbn_order_fields': if (!admin) return hubOut_({ error: '관리자만 볼 수 있습니다' });   // 사방넷 주문 API 응답 항목 이름 확인용 (읽기 전용, 개인정보 항목은 값 제외)
        return hubOut_(hubSbnOrderFields_(req.items, req.date, req.zero));
      case 'krm_req': return hubOut_(hubLocked_(function () { var t = String(Date.now()); hubConfigSet_('krm_req', t, me); try { CacheService.getScriptCache().put('hub_krm_req', JSON.stringify({ req: Number(t), by: me.name }), 21600); } catch (e) {} return { ok: true }; }));   // 휴대폰에서 [지금 동기화] → PC 크림 창이 받아서 실행
      case 'krm_poll': try { var kq = CacheService.getScriptCache().get('hub_krm_req'); if (kq) return hubOut_(JSON.parse(kq)); } catch (e) {}   // 30초마다 오는 확인 → 캐시로 바로 응답
        var kc = hubConfig_(); return hubOut_({ req: kc.krm_req ? Number(kc.krm_req.value) || 0 : 0, by: kc.krm_req ? kc.krm_req.by : '' });
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
      case 'user_pin': return hubOut_(hubLocked_(function () { return hubUserPin_(req, me); }));   // 내 PIN 바꾸기
      case 'user_save': if (!admin) return hubOut_({ error: '관리자만 바꿀 수 있습니다' });
        return hubOut_(hubLocked_(function () { return hubUserSave_(req, me); }));
      default: return hubOut_({ error: 'unknown_action' });
    }
  } catch (err) {
    return hubOut_({ error: String(err && err.message || err) });
  }
}
function doGet(e) {
  if (e && e.parameter && e.parameter.r) return hubIgReplyPage_(e.parameter.r);   // 셀러용 공구 제안 회신(수락·거절) 페이지
  return ContentService.createTextOutput('셀렉트인 OPS 서버가 동작 중입니다. 화면은 https://select-in.github.io/sales-app/ops_work/ (대장: /ops_admin/) 에서 여세요.');
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
  if (!users.some(function (u) { return hubIsAdmin_(u.role); })) {
    var pin = String(Math.floor(100000 + Math.random() * 900000));
    hubUserSave_({ name: '대장', role: '총괄', pin: pin, active: true }, { name: '설정', role: '총괄' });
    Logger.log('관리자 계정이 만들어졌습니다 → 이름: 대표 / PIN: ' + pin + '  (앱 설정 화면에서 바꿀 수 있습니다)');
  } else {
    Logger.log('이미 관리자 계정이 있습니다. PIN을 잊었다면 hubResetAdminPin 을 실행하세요.');
  }
}
/** 관리자 PIN을 새로 발급 (잊어버렸을 때) */
function hubResetAdminPin() {
  var u = hubUsers_().filter(function (x) { return x.role === '총괄'; })[0] || hubUsers_().filter(function (x) { return hubIsAdmin_(x.role); })[0];
  if (!u) return hubSetup();
  var pin = String(Math.floor(100000 + Math.random() * 900000));
  hubUserSave_({ name: u.name, role: u.role, pin: pin, active: true }, { name: '설정', role: '총괄' });
  Logger.log('관리자 ' + u.name + ' 의 새 PIN: ' + pin);
}

/* ===================== 시트 ===================== */
/* 한 번의 요청 안에서 시트 열기·탭 찾기를 되풀이하지 않도록 기억 (요청이 끝나면 사라짐) */
var HUB_MEMO_ = {};
function hubBook_() {
  if (HUB_MEMO_.book) return HUB_MEMO_.book;
  var id = PropertiesService.getScriptProperties().getProperty('HUB_DB_ID');
  return (HUB_MEMO_.book = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet());
}
function hubSheet_(name) {
  var M = HUB_MEMO_.sh || (HUB_MEMO_.sh = {});
  if (M[name]) return M[name];
  return (M[name] = hubSheetOpen_(name));
}
function hubSheetOpen_(name) {
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
  return { token: body + '.' + hubSign_(body, String(u.v[2])), name: name, role: String(u.v[1]), pinDefault: pin === HUB_DEFAULT_PIN };
}
/* 로그인 확인 결과를 5분 기억 → 매 요청마다 직원 탭을 읽지 않음. 직원 정보가 바뀌면 세대값을 바꿔 즉시 무효 */
function hubUGen_() { try { return CacheService.getScriptCache().get('hub_ugen') || '0'; } catch (e) { return '0'; } }
function hubUGenBump_() { try { CacheService.getScriptCache().put('hub_ugen', String(Date.now()), 21600); } catch (e) {} }
function hubVerify_(token) {
  var t = String(token || '').split('.');
  if (t.length !== 3 || Number(t[0]) < Date.now()) return null;
  var ck = null, cache = null;
  try { cache = CacheService.getScriptCache(); ck = 'hubv_' + hubUGen_() + '_' + hubHash_(String(token)).slice(0, 32); var hit = cache.get(ck); if (hit) return JSON.parse(hit); } catch (e) { cache = null; }
  var me = hubVerifySheet_(t);
  if (me && cache) try { cache.put(ck, JSON.stringify(me), 300); } catch (e) {}
  return me;
}
function hubVerifySheet_(t) {
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
  hubSheet_('직원').getRange(u.row, 1, 1, 3).setValues([[to, u.v[1], hubHash_(to + '|' + pin)]]); hubUGenBump_();
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
  var role = ['총괄', '관리자', '직원'].indexOf(req.role) >= 0 ? req.role : '직원';
  var active = req.active !== false;
  var u = hubUserRow_(name), owner = hubIsOwner_(me.role);
  var oldRole = u ? String(u.v[1]) : '';
  if (!owner && (role !== '직원' || hubIsAdmin_(oldRole))) return { error: '관리자·총괄 계정은 총괄만 바꿀 수 있어요' };
  var pin = req.resetPin ? HUB_DEFAULT_PIN : hubStr_(req.pin, 30);
  if (!u && !pin) pin = HUB_DEFAULT_PIN;   // 새 직원 기본 PIN
  if (pin && !/^\d{4,8}$/.test(pin)) return { error: 'PIN은 숫자 4~8자리로 정하세요' };
  if (u && me.name === name && (!active || role !== oldRole)) return { error: '본인 계정 권한·사용 여부는 바꿀 수 없습니다' };
  if (oldRole === '총괄' && role !== '총괄' && hubUsers_().filter(function (x) { return x.role === '총괄' && x.active; }).length < 2) return { error: '총괄 계정은 최소 1개 있어야 해요' };
  var hash = pin ? hubHash_(name + '|' + pin) : String(u.v[2]);
  var row = [name, role, hash, active, u ? u.v[4] : hubNow_()];
  var sh = hubSheet_('직원');
  if (u) sh.getRange(u.row, 1, 1, 5).setValues([row]);
  else sh.appendRow(row);
  hubUGenBump_();
  return { ok: true, users: hubUsers_() };
}
/* 내 PIN 바꾸기 — 현재 PIN 확인 → 새 PIN (숫자 4~8자리). 다른 기기 로그인은 풀리고 새 토큰을 돌려줌 */
function hubUserPin_(req, me) {
  var cur = hubStr_(req.pin, 30), nw = hubStr_(req.newPin, 30);
  var u = hubUserRow_(me.name);
  if (!u || hubHash_(me.name + '|' + cur) !== String(u.v[2])) return { error: '현재 PIN이 맞지 않습니다' };
  if (!/^\d{4,8}$/.test(nw)) return { error: '새 PIN은 숫자 4~8자리로 정하세요' };
  if (nw === cur) return { error: '지금 PIN과 같아요' };
  hubSheet_('직원').getRange(u.row, 3).setValue(hubHash_(me.name + '|' + nw)); hubUGenBump_();
  return hubLogin_(me.name, nw);
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
/** 사방넷에 없는 앱 단품(사방넷상태 '사방넷없음') 한 번에 삭제 — 지운 행은 '상품삭제보관' 탭에 그대로 옮겨 보관 */
function hubPurgeMissing_(me, dry) {
  var r = hubRows_('상품'), col = HUB_TABS['상품'].indexOf('사방넷상태'), keep = [], gone = [], now = hubNow_();
  r.vals.forEach(function (v) { (String(v[col]) === '사방넷없음' ? gone : keep).push(v); });
  if (dry || !gone.length) return { ok: true, count: gone.length, dry: !!dry };
  var bk = hubSheet_('상품삭제보관'), w = HUB_TABS['상품'].length;
  bk.getRange(bk.getLastRow() + 1, 1, gone.length, w + 2).setValues(gone.map(function (v) { return v.concat([now, me.name]); }));
  r.sh.getRange(2, 1, r.vals.length, w).clearContent();
  if (keep.length) r.sh.getRange(2, 1, keep.length, w).setValues(keep);
  hubUGenBump_();
  return { ok: true, count: gone.length, left: keep.length };
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
/* 상품 탭에서 바뀐 줄만 쓰기 — p._r(시트 줄 번호)·p._ch(바뀜) 표시된 목록. 새 상품(_r 없음)은 끝에 추가.
 * 흩어진 줄이 너무 많으면 통째로 다시 씀 */
function hubProductsRows_() {
  var out = []; hubRows_('상품').vals.forEach(function (v, i) { var p = hubProductObj_(v); if (p.id) { p._r = i + 2; out.push(p); } });
  return out;
}
function hubWriteChanged_(list) {
  var sh = hubSheet_('상품'), fm = hubFormats_(), w = fm.length;
  var ch = list.filter(function (p) { return p._r && p._ch; }).sort(function (a, b) { return a._r - b._r; });
  var add = list.filter(function (p) { return !p._r; }), blocks = [], i = 0;
  while (i < ch.length) { var j = i; while (j + 1 < ch.length && ch[j + 1]._r === ch[j]._r + 1) j++; blocks.push(ch.slice(i, j + 1)); i = j + 1; }
  if (blocks.length > 40) { hubWriteAll_(list); return; }
  blocks.forEach(function (b) { sh.getRange(b[0]._r, 1, b.length, w).setValues(b.map(hubRow_)); });
  if (add.length) {
    var start = sh.getLastRow() + 1, need = start + add.length - 1;
    if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());
    sh.getRange(start, 1, add.length, w).setNumberFormats(add.map(function () { return fm; })).setValues(add.map(hubRow_));
  }
}
/* 바뀐 상품을 화면이 바로 끼워 넣을 수 있게 boot(compact)와 같은 모양으로 */
function hubPRows_(L) {
  var iReg = HUB_P_FIELDS.indexOf('reg'), iRs = HUB_P_FIELDS.indexOf('regStatus');
  return L.map(function (p) { var v = hubRow_(p); if (!v[iRs]) v[iReg] = ''; return v; });
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
  // 사방넷 재고도 같이 빼기 (사방넷이 재고 기준 — 안 빼면 다음 자동 동기화 때 앱 재고가 되돌아감)
  var sbn = null, pushIds = changed.filter(function (p) { return p.sbnPrd && p.stocMng !== 'N' && p.type !== '위탁'; }).map(function (p) { return p.id; });
  if (pushIds.length) { try { sbn = hubSbnStockPush_(pushIds, me); } catch (e) { sbn = { error: String(e.message || e).slice(0, 200) }; } }
  return {
    ok: true, batch: batch, sbn: sbn, count: out.length, qty: out.reduce(function (a, o) { return a + o[10]; }, 0),
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
/* ===================== 포이즌 판매자센터 연동 =====================
 * poizon.js(북마크)가 주문 관리 화면에서 읽어온 주문을 저장 — 계정+주문번호 기준 갱신/추가
 * waitNos: 이번에 확인한 발송 대기 주문번호 전체 → 예전에 발송 대기였는데 빠진 주문은 '탭'을 비워 출고 대상에서 뺌 */
var HUB_PZN = ['account', 'orderNo', 'status', 'tab', 'kind', 'style', 'name', 'brand', 'option', 'price', 'fee', 'payout', 'orderedAt', 'deadline', 'syncedAt'];
function hubPznSync_(req, me) {
  var acct = req.account === '셀렉트인' ? '셀렉트인' : '겐더샵', now = hubNow_();
  var s = hubRows_('포이즌판매'), w = HUB_TABS['포이즌판매'].length, idx = {}, upd = 0, ins = [];
  var wait = {}; (req.waitNos || []).forEach(function (n) { wait[String(n)] = 1; });
  s.vals.forEach(function (v, i) { idx[v[0] + '|' + v[1]] = i; if (req.waitOk && v[0] === acct && v[3] === 'WAIT_SHIPPING' && !wait[String(v[1])]) v[3] = 'DONE_OR_MOVED'; });
  (req.rows || []).forEach(function (o) {
    if (!o || !o.orderNo) return;
    var row = hubKrmRow_(o, HUB_PZN, acct, now); row[1] = "'" + String(o.orderNo);
    var k = acct + '|' + String(o.orderNo), i = idx[k];
    if (i != null && i >= 0) { var old = s.vals[i]; s.vals[i] = row.map(function (v, j) { return v === '' ? old[j] : v; }); upd++; }
    else if (i == null) { ins.push(row); idx[k] = -1; }
  });
  if (s.vals.length) s.sh.getRange(2, 1, s.vals.length, w).setValues(s.vals);
  if (ins.length) s.sh.getRange(s.vals.length + 2, 1, ins.length, w).setValues(ins);
  var bidN = null;
  if (Array.isArray(req.bids)) {   // 입찰 중 목록: 이 계정 것을 통째로 바꿈
    var b = hubRows_('포이즌입찰'), bw = HUB_TABS['포이즌입찰'].length;
    var keep = b.vals.filter(function (v) { return v[0] && v[0] !== acct; });
    var add = req.bids.slice(0, 5000).map(function (o) { return [acct, "'" + hubStr_(o.style, 60), hubStr_(o.name, 150), hubStr_(o.brand, 60), hubStr_(o.opt, 80), hubNum_(o.price), hubNum_(o.cnt), hubNum_(o.saleCount), hubStr_(o.cat, 40), "'" + hubStr_(o.spu, 30), now]; });
    var all = keep.concat(add);
    if (b.vals.length) b.sh.getRange(2, 1, b.vals.length, bw).clearContent();
    if (all.length) b.sh.getRange(2, 1, all.length, bw).setValues(all);
    bidN = add.length; hubConfigSet_('pzb_synced_' + acct, now, me);
  }
  hubConfigSet_('pzn_synced_' + acct, now, me);
  return { ok: true, added: ins.length, updated: upd, bids: bidN };
}
function hubPznList_() {
  var fmt = function (v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : v; };
  var rows = hubRows_('포이즌판매').vals.map(function (v) { var o = {}; HUB_PZN.forEach(function (k, i) { o[k] = fmt(v[i]); }); o.orderNo = String(o.orderNo); return o; });
  var c = hubConfig_(), synced = {};
  ['겐더샵', '셀렉트인'].forEach(function (n) { var x = c['pzn_synced_' + n]; if (x) synced[n] = x.value; });
  var bids = hubRows_('포이즌입찰').vals.filter(function (v) { return v[0]; }).map(function (v) { return { account: v[0], style: String(v[1]), name: v[2], brand: v[3], opt: v[4], price: hubNum_(v[5]), cnt: hubNum_(v[6]), saleCount: hubNum_(v[7]), cat: v[8], spu: String(v[9]) }; });
  var bsync = {}; ['겐더샵', '셀렉트인'].forEach(function (n) { var x = c['pzb_synced_' + n]; if (x) bsync[n] = x.value; });
  return { rows: rows, synced: synced, bids: bids, bidSynced: bsync };
}

/* ===================== 사방넷 현재고 → 앱 재고 (sbn.js) =====================
 * rows: [[상품코드, 단품코드, 현재고]] — 창고별 줄은 보내는 쪽에서 합침. 여러 번 나눠 보냄(part/parts)
 * 재고만 바꾸고 차이는 재고이력 '사방넷동기화'. 가상재고(재고관리 사용안함)는 건너뜀.
 * 앱에서 10분 안에 바꾼 단품은 사방넷 반영 전일 수 있어 이번엔 건너뜀(다음 동기화 때 맞춤) */
function hubSbnStockSync_(req, me) {
  var rows = req.rows || []; if (!rows.length) return { error: '재고 행이 없습니다' };
  var m = {}; rows.forEach(function (r) { if (r && r[0]) m[hubStr_(r[0], 30) + '-' + hubStr_(r[1], 20)] = Math.round(hubNum_(r[2])); });
  var list = hubProductsRows_(), now = hubNow_(), logs = [], changed = 0, seen = 0, skipped = 0, recent = Date.now() - 10 * 60 * 1000, ch = [];
  list.forEach(function (p) {
    if (!p.sbnPrd) return;
    var k = p.sbnPrd + '-' + p.sbnSku; if (!(k in m)) return;
    seen++;
    if (p.stocMng === 'N') return;
    var q = m[k]; if (p.stock === q) return;
    var t = Date.parse(String(p.updatedAt).replace(' ', 'T') + ':00+09:00');
    if (p.updatedBy !== '사방넷' && t && t > recent) { skipped++; return; }
    logs.push(['재고이력', [now, p.id, p.sku, p.name, '사방넷동기화', q - p.stock, q, '사방넷 현재고로 맞춤(자동)', me.name]]);
    if (ch.length < 30) ch.push(k + ' ' + p.stock + '→' + q);
    p.stock = q; p.updatedAt = now; p.updatedBy = '사방넷'; p._ch = 1; changed++;
  });
  if (changed) { hubWriteChanged_(list); hubWriteLogs_(logs); }
  if (req.final) hubConfigSet_('sbn_stock_at', now + ' · 단품 ' + (req.total || rows.length) + '개 확인' + (changed ? ' · 변경 ' + changed : ''), me);
  return { ok: true, seen: seen, changed: changed, skipped: skipped, sample: ch };
}

/* ===================== 사방넷 단품 전체 → 앱 (sbn.js, 10분마다) =====================
 * 사방넷 「사방넷단품대량수정」 목록 전체: rows [[상품코드, 단품코드, 상품명, 옵션, 바코드, 원가, 판매가, 현재고, 가상재고, 재고관리Y/N, 단품상태, 세트구분, 원상품코드, 원단품코드]]
 * 사방넷이 기준: 이름·옵션·바코드·원가·판매가·현재고·재고관리 여부·가상재고·상태를 맞춤. 앱에만 있는 위치·메모·담당자·법인은 유지
 *  - 앱에서 바꾼 바코드가 사방넷에 반영 전(barPending)이면 앱 값 유지
 *  - 앱에서 10분 안에 입출고한 단품의 재고는 이번엔 건너뜀(사방넷 반영 대기)
 *  - 사방넷에 새로 생긴 단품은 앱에 추가 (법인: 같은 상품코드의 앱 단품 → 없으면 상품명 [셀렉트인] → 그 외 겐더샵)
 *  - complete(전체를 다 읽음)일 때만, 사방넷에 없는 앱 단품을 상태 '사방넷없음'으로 표시 (지우지 않음) */
function hubSbnSkuSync_(req, me) {
  var rows = req.rows || []; if (!rows.length) return { error: '사방넷 단품 행이 없습니다' };
  var m = {}; rows.forEach(function (r) { if (r && r[0]) m[hubStr_(r[0], 30) + '-' + hubStr_(r[1], 20)] = r; });
  var list = hubProductsRows_(), now = hubNow_(), logs = [], recent = Date.now() - 10 * 60 * 1000, seen = {}, corpOf = {};
  var C = { stock: 0, cost: 0, price: 0, name: 0, bar: 0, mng: 0, vst: 0, status: 0, added: 0, missing: 0, skipped: 0 }, ex = [];
  list.forEach(function (p) { if (p.sbnPrd && !corpOf[p.sbnPrd]) corpOf[p.sbnPrd] = p.corp; });
  list.forEach(function (p) {
    if (!p.sbnPrd) return;
    var k = p.sbnPrd + '-' + p.sbnSku, r = m[k];
    if (!r) { if (req.complete && p.sbnStatus !== '사방넷없음') { p.sbnStatus = '사방넷없음'; C.missing++; p.updatedAt = now; p.updatedBy = '사방넷'; p._ch = 1; } return; }
    seen[k] = 1;
    var ch = false, mng = r[9] === 'N' ? 'N' : 'Y', st = Math.round(hubNum_(r[7])), cost = hubNum_(r[5]), price = hubNum_(r[6]), vst = Math.round(hubNum_(r[8]));
    var nm = hubStr_(r[2], 150), op = hubStr_(r[3], 80), bar = hubStr_(r[4], 60), sts = hubStr_(r[10], 20);
    if (p.stocMng !== mng) { p.stocMng = mng; C.mng++; ch = true; }
    if (mng === 'Y' && p.stock !== st) {
      var t = Date.parse(String(p.updatedAt).replace(' ', 'T') + ':00+09:00');
      if (p.updatedBy !== '사방넷' && t && t > recent) C.skipped++;
      else { logs.push(['재고이력', [now, p.id, p.sku, p.name, '사방넷동기화', st - p.stock, st, '사방넷 현재고로 맞춤(자동)', me.name]]); if (ex.length < 12) ex.push(k + ' 재고 ' + p.stock + '→' + st); p.stock = st; C.stock++; ch = true; }
    }
    if (p.vstock !== vst) { p.vstock = vst; C.vst++; ch = true; }
    if (p.cost !== cost) { logs.push(['원가이력', [now, p.id, p.sku, p.name, p.cost, cost, '사방넷']]); p.cost = cost; C.cost++; ch = true; }
    if (p.price !== price) { p.price = price; C.price++; ch = true; }
    if (nm && (p.name !== nm || p.option !== op)) { p.name = nm; p.option = op; C.name++; ch = true; }
    if (p.barPending) { if (bar === p.barcode) { p.barPending = ''; ch = true; } }
    else if (bar !== p.barcode) { p.barcode = bar; C.bar++; ch = true; }
    if (sts && p.sbnStatus !== sts) { p.sbnStatus = sts; C.status++; ch = true; }
    var link = r[11] === 'L' && r[12] ? hubStr_(r[12], 20) + '-' + hubStr_(r[13], 10) : '';
    if (String(p.link || '') !== link || String(p.setDiv || '') !== hubStr_(r[11], 4)) { p.link = link; p.setDiv = hubStr_(r[11], 4); ch = true; }
    if (ch) { p.updatedAt = now; p.updatedBy = '사방넷'; p._ch = 1; }
  });
  Object.keys(m).forEach(function (k) {
    if (seen[k]) return;
    var r = m[k], prd = hubStr_(r[0], 30), nm = hubStr_(r[2], 150);
    var corp = corpOf[prd] || (/^\s*\[셀렉트인\]/.test(nm) ? '셀렉트인' : '겐더샵');
    var n = { id: hubNewId_() + C.added, sku: k, barcode: hubStr_(r[4], 60), name: nm, brand: '', option: hubStr_(r[3], 80), corp: corp, type: '사입', cat: '',
      cost: hubNum_(r[5]), price: hubNum_(r[6]), stock: r[9] === 'N' ? 0 : Math.round(hubNum_(r[7])), safety: 0, loc: '', memo: '', updatedAt: now, updatedBy: '사방넷',
      sbnPrd: prd, sbnSku: hubStr_(r[1], 20), img: '', sbnStatus: hubStr_(r[10], 20), stocMng: r[9] === 'N' ? 'N' : 'Y', vstock: Math.round(hubNum_(r[8])),
      owner: '', link: r[11] === 'L' && r[12] ? hubStr_(r[12], 20) + '-' + hubStr_(r[13], 10) : '', setDiv: hubStr_(r[11], 4) };
    list.push(n); C.added++; if (ex.length < 12) ex.push(k + ' 새 단품 추가');
    if (n.stock) logs.push(['재고이력', [now, n.id, n.sku, n.name, '기초재고', n.stock, n.stock, '사방넷에서 새로 가져옴', me.name]]);
  });
  var changed = C.stock + C.cost + C.price + C.name + C.bar + C.mng + C.vst + C.status + C.added + C.missing;
  var touched = list.filter(function (p) { return p._ch || !p._r; });
  if (touched.length || logs.length) { hubWriteChanged_(list); hubWriteLogs_(logs); }
  hubConfigSet_('sbn_stock_at', now + ' · 사방넷 단품 ' + rows.length + '개 확인' + (changed ? ' · 바뀜 ' + changed : ''), me);
  var res = { ok: true, seen: rows.length, changed: changed, c: C, sample: ex };
  if (touched.length && touched.length <= 3000) { res.pcols = HUB_P_FIELDS; res.upd = hubPRows_(touched); }   // 화면은 바뀐 상품만 끼워 넣음 (전체 다시 받기 X)
  return res;
}

/* ===================== 쇼핑몰별 상품 등록 현황 (sbn.js) =====================
 * 사방넷 「쇼핑몰상품수정」 목록을 계정별로 묶어 받음: accts: [{shma, mall, id, list:'상품코드[상태],...'}]  (상태 p=일시중지 x=품절, 없으면 공급중)
 * 쇼핑몰 로그인 비밀번호 등은 받지 않음 */
function hubSbrSync_(req, me) {
  var A = req.accts || []; if (!A.length) return { error: '등록 현황이 비어 있어요' };
  var now = hubNow_(), r = hubRows_('사방넷등록'), w = HUB_TABS['사방넷등록'].length;
  var out = A.slice(0, 200).map(function (a) { var l = hubStr_(a.list, 49000); return [hubStr_(a.shma, 20), hubStr_(a.mall, 60), "'" + hubStr_(a.id, 80), l ? l.split(',').length : 0, l, now]; });
  if (r.vals.length) r.sh.getRange(2, 1, r.vals.length, w).clearContent();
  r.sh.getRange(2, 1, out.length, w).setValues(out);
  hubConfigSet_('sbr_synced', now + ' · ' + out.length + '개 계정', me);
  return { ok: true, accts: out.length };
}
function hubSbcSync_(req, me) {
  var A = req.accts || []; if (!A.length) return { error: '수집 상태가 비어 있어요' };
  var now = hubNow_(), r = hubRows_('사방넷수집'), w = HUB_TABS['사방넷수집'].length;
  var out = A.slice(0, 300).map(function (a) { return [hubStr_(a.shma, 20), hubStr_(a.mall, 60), "'" + hubStr_(a.id, 80), hubStr_(a.orderAt, 20), hubStr_(a.orderBy, 30), hubStr_(a.orderRes, 10), hubStr_(a.claimAt, 20), hubStr_(a.claimBy, 30), hubStr_(a.on, 2), hubStr_(a.sOrd, 2), hubStr_(a.sClm, 2), hubStr_(a.sStk, 2), hubStr_(a.sShip, 2), hubStr_(a.msg, 200), now]; });
  if (r.vals.length) r.sh.getRange(2, 1, r.vals.length, w).clearContent();
  r.sh.getRange(2, 1, out.length, w).setValues(out);
  hubConfigSet_('sbc_synced', now, me);
  return { ok: true, accts: out.length };
}
function hubSbrList_() {
  var accts = hubRows_('사방넷등록').vals.filter(function (v) { return v[0]; }).map(function (v) { return { shma: String(v[0]), mall: String(v[1]), id: String(v[2]), n: hubNum_(v[3]), list: String(v[4] || '') }; });
  var corp = {};
  try { SpreadsheetApp.openById(HUB_SALES_ID).getSheetByName('설정').getRange('A57:B120').getValues().forEach(function (r) { var id = String(r[0]).trim(); if (id) corp[id] = String(r[1]).trim(); }); } catch (e) {}
  var c = hubConfig_();
  var H = ['shma', 'mall', 'id', 'orderAt', 'orderBy', 'orderRes', 'claimAt', 'claimBy', 'on', 'sOrd', 'sClm', 'sStk', 'sShip', 'msg'];
  var collect = hubRows_('사방넷수집').vals.filter(function (v) { return v[0]; }).map(function (v) { var o = {}; H.forEach(function (k, i) { o[k] = String(v[i] instanceof Date ? Utilities.formatDate(v[i], 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : v[i]); }); return o; });
  var missing = 0; hubProducts_().forEach(function (p) { if (p.sbnStatus === '사방넷없음') missing++; });
  return { accts: accts, corp: corp, collect: collect, sbnMissing: missing, synced: c.sbr_synced ? c.sbr_synced.value : '', stockAt: c.sbn_stock_at ? c.sbn_stock_at.value : '', collectAt: c.sbc_synced ? c.sbc_synced.value : '' };
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
var HUB_EVENT_ID = '1rHbpjZa12ZDfw2OQXLSdd0QexqqXrv2xxjTo0egYtOs';   // 정산/일정) 셀렉트인 공동구매 일정 정리 및 정산 — 「일정」 탭
var HUB_B2C_ID = '1Vaor2PUoVdXILJJLQ2l9pnEnZNVcHbn0SqKeLdLTMDw';     // 공통) B2C 행사/관리 — 「겐)행사 리스트」「셀)행사 리스트」 탭
/** 행사 일정 = 공동구매 일정 + 플랫폼(B2C) 행사(겐더샵·셀렉트인). 읽기 전용 */
function hubEvents_(force) {
  var cache = CacheService.getScriptCache();
  if (!force) { var hit = cache.get('events_v2'); if (hit) { try { return JSON.parse(hit); } catch (e) {} } }
  var tz = 'Asia/Seoul', from = Utilities.formatDate(new Date(Date.now() - 150 * 864e5), tz, 'yyyy-MM-dd'), rows = [], errs = [];
  var ymd = function (v) {
    if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
    var m = String(v || '').match(/(\d{4})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})/);
    return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
  };
  // 1) 공동구매: A 년/월(yyyymm) · B 시작일-종료일(MMDD-MMDD) · C 확정구분 · D 진행구분 · E 벤더사 · F 제목 · G 셀러 · H 링크 · I 브랜드
  try {
    var sh = SpreadsheetApp.openById(HUB_EVENT_ID).getSheetByName('일정');
    var v = sh.getRange(4, 1, Math.max(1, sh.getLastRow() - 3), 9).getDisplayValues();
    v.forEach(function (r) {
      var ym = String(r[0]).trim(), m = String(r[1]).replace(/\s/g, '').match(/^(\d{2})(\d{2})-(\d{2})(\d{2})$/);
      if (!/^\d{6}$/.test(ym) || !m) return;
      var y = Number(ym.slice(0, 4)), ymM = Number(ym.slice(4)), sm = Number(m[1]), em = Number(m[3]);
      var sy = y + (sm - ymM > 6 ? -1 : ymM - sm > 6 ? 1 : 0), ey = sy + (em < sm ? 1 : 0);
      var a = sy + '-' + m[1] + '-' + m[2], b = ey + '-' + m[3] + '-' + m[4];
      if (b < from) return;
      rows.push({ src: '공구', a: a, b: b, st: String(r[2]).trim(), kind: String(r[3]).trim(), title: String(r[5]).replace(/\s+/g, ' ').trim(), seller: String(r[6]).trim(), link: /^https?:\/\//.test(String(r[7])) ? String(r[7]).trim() : '', brand: String(r[8]).trim() });
    });
  } catch (e) { errs.push('공동구매 일정: ' + String(e.message || e).slice(0, 80)); }
  // 2) 플랫폼 행사: A 기재일 · B 담당자 · C 채널 · D 행사명 · E 상태 · F 행사취합 마감일자 · G 시작 · H 종료
  try {
    var ss = SpreadsheetApp.openById(HUB_B2C_ID);
    [['겐)행사 리스트', '겐더샵'], ['셀)행사 리스트', '셀렉트인']].forEach(function (t) {
      var s2 = ss.getSheetByName(t[0]); if (!s2 || s2.getLastRow() < 2) return;
      s2.getRange(2, 1, s2.getLastRow() - 1, 8).getValues().forEach(function (r) {
        var ch = String(r[2]).trim(), nm = String(r[3]).replace(/\s+/g, ' ').trim(), a = ymd(r[6]), b = ymd(r[7]) || a, dl = ymd(r[5]);
        if (!ch || !nm || !a || b < from) return;
        var base = { src: t[1], st: String(r[4]).trim(), kind: ch, title: ch + ' · ' + nm, seller: ch, owner: String(r[1]).trim() };
        rows.push(Object.assign({ a: a, b: b < a ? a : b }, base));
        if (dl && dl >= from) rows.push(Object.assign({ a: dl, b: dl, dl: 1 }, base, { title: '취합 마감 · ' + ch + ' · ' + nm }));
      });
    });
  } catch (e) { errs.push('B2C 행사: ' + String(e.message || e).slice(0, 80)); }
  var out = { rows: rows, at: Utilities.formatDate(new Date(), tz, 'MM-dd HH:mm'), errs: errs,
    url: 'https://docs.google.com/spreadsheets/d/' + HUB_EVENT_ID + '/edit', url2: 'https://docs.google.com/spreadsheets/d/' + HUB_B2C_ID + '/edit' };
  if (!rows.length && errs.length) return { error: errs.join(' / ') };
  try { cache.put('events_v2', JSON.stringify(out), 600); } catch (e) {}
  return out;
}

function hubSalesYmd_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  var m = String(v || '').trim().match(/^(\d{4})\s*[-.\/]\s*(\d{1,2})\s*[-.\/]\s*(\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function hubSales_(me) {
  var ss = SpreadsheetApp.openById(HUB_SALES_ID), tz = 'Asia/Seoul', today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var admin = me && hubIsOwner_(me.role);   // 입금 예정 금액·일자는 총괄만
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
    if (String(col(r, '채널')).trim() === '사방넷' && hubSbnSkip_(col(r, '쇼핑몰ID'))) return;   // 스토어팜 기준 (중복 수집 계정)
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
      var id = String(x.SHOP_LOGIN_ID || '').trim(), c = corp[id] || '확인필요'; if (c === '제외' || hubSbnSkip_(id)) return;
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
    var id = String(x.SHOP_LOGIN_ID || '').trim(), c = corp[id] || '확인필요'; if (c === '제외' || hubSbnSkip_(id)) return;
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
function hubSbnOrderFields_(items, date, zero) {
  var d = /^\d{4}-?\d{2}-?\d{2}$/.test(String(date || '')) ? String(date).replace(/-/g, '') : Utilities.formatDate(new Date(Date.now() - 864e5), 'Asia/Seoul', 'yyyyMMdd');
  var body = { dateSearchCondition: 2, startDate: d, endDate: d, updateOrderStsYn: 'N', page: 1, perPage: zero ? 1000 : 50 };
  if (Array.isArray(items) && items.length) body.responseItems = items.slice(0, 60).map(String);
  var r = hubSbnCall_('POST', '/v3/sb/order', body), dt = (r && r.data) || {}, L = dt.results || [];
  if (zero) L = L.filter(function (x) { return !(Number(x.COST_PRICE) > 0); }).slice(0, 40);
  var personal = /RCV|RECV|RECEIVE|ADDR|TEL|HP|PHONE|MOBILE|BUYER|ORDERER|ORD_NM|USER_NM|EMAIL|ZIP|PERSONAL|CUSTOMS|MSG|MEMO|NAME_RCV|CUST(?!OM_PRD)/i;
  var keys = {}; L.forEach(function (x) { Object.keys(x).forEach(function (k) { keys[k] = 1; }); });
  var sample = L.slice(0, zero ? 40 : 2).map(function (x) { var o = {}; Object.keys(x).forEach(function (k) { o[k] = personal.test(k) ? '(개인정보)' : String(x[k]).slice(0, 40); }); return o; });
  return { code: r && r.code, message: r && r.message, keys: Object.keys(keys), sample: sample, raw: L.length ? '' : JSON.stringify(r).slice(0, 500) };
}
/* ===================== 플랫폼 추천 (매출 > 플랫폼 추천) =====================
 * 사방넷 API(조회 전용) 최근 30일 주문(주문일)을 상품(사방넷 상품코드) × 쇼핑몰 계정별로 묶어 보냄.
 * 화면에서 상품 마스터(재고·원가·이미지)와 합쳐 채널별 추천(비싼 채널·안 팔리는 채널·재고 소진)을 계산.
 * 매출판과 같은 규칙: 취소 제외, 반품·교환 재생성 행 제외, 설정 ③ '제외' 계정 제외. 30분 캐시(조각 저장). */
function hubPlatReco_(force) {
  var tz = 'Asia/Seoul', cache = CacheService.getScriptCache(), today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  if (!force) {
    var n = Number(cache.get('preco_n') || 0);
    if (n) { var parts = cache.getAll(Array.apply(null, Array(n)).map(function (_, i) { return 'preco_' + i; })), txt = '';
      for (var i = 0; i < n; i++) { if (!parts['preco_' + i]) { txt = ''; break; } txt += parts['preco_' + i]; }
      if (txt) { try { var c = JSON.parse(txt); if (c.today === today) return c; } catch (e) {} } }
  }
  var ss = SpreadsheetApp.openById(HUB_SALES_ID), corp = {};
  ss.getSheetByName('설정').getRange('A57:B120').getValues().forEach(function (r) { var id = String(r[0]).trim(); if (id) corp[id] = String(r[1]).trim(); });
  var ymd = function (k) { return Utilities.formatDate(new Date(Date.now() + k * 864e5), tz, 'yyyyMMdd'); };
  var a = ymd(-30), b = ymd(-1), all = [], page = 1;
  try {
    while (page <= 40) {
      var r = hubSbnCall_('POST', '/v3/sb/order', { dateSearchCondition: 2, startDate: a, endDate: b, updateOrderStsYn: 'N', page: page, perPage: 1000,
        responseItems: ['SB_ORD_NO', 'ORDER_STATUS', 'SHOP_NM', 'SHOP_LOGIN_ID', 'ORDER_TOT_AMT', 'ORD_CNT', 'ORG_SB_ORD_NO', 'SB_PRD_CD', 'CM_PRD_NM', 'ORDER_DT'] });
      var dt = (r && r.data) || {}; all = all.concat(dt.results || []); if (!dt.hasNext) break; page++;
    }
  } catch (e) { return { error: '사방넷 조회 실패: ' + String(e.message || e).slice(0, 150) }; }
  var ch = {}, g = {}, names = {}, wk = Utilities.formatDate(new Date(Date.now() - 7 * 864e5), tz, 'yyyyMMdd');
  all.forEach(function (x) {
    if (/CANCEL/i.test(String(x.ORDER_STATUS))) return;
    if (x.ORG_SB_ORD_NO && String(x.ORG_SB_ORD_NO) !== '0') return;
    var id = String(x.SHOP_LOGIN_ID || '').trim(), c = corp[id] || '확인필요'; if (c === '제외') return;
    var prd = String(x.SB_PRD_CD || '').trim(); if (!prd || prd === 'null') prd = '';
    var key = c + '|' + String(x.SHOP_NM || '').trim(), qty = Number(x.ORD_CNT) || 1, amt = Number(x.ORDER_TOT_AMT) || 0, recent = String(x.ORDER_DT || '').slice(0, 8) >= wk;
    var cc = ch[key] || (ch[key] = { key: key, corp: c, shop: String(x.SHOP_NM || '').trim(), qty: 0, amt: 0, ids: {} }); cc.qty += qty; cc.amt += amt; cc.ids[id] = 1;
    if (!prd) return;
    if (!names[prd] && x.CM_PRD_NM && String(x.CM_PRD_NM) !== 'null') names[prd] = String(x.CM_PRD_NM).slice(0, 80);
    var o = g[prd + '#' + key] || (g[prd + '#' + key] = [prd, key, 0, 0, 0]); o[2] += qty; o[3] += amt; if (recent) o[4] += qty;
  });
  var out = { today: today, from: a, to: b, at: Utilities.formatDate(new Date(), tz, 'HH:mm'), orders: all.length,
    channels: Object.keys(ch).map(function (k) { var o = ch[k]; o.ids = Object.keys(o.ids); return o; }).sort(function (x, y) { return y.amt - x.amt; }),
    rows: Object.keys(g).map(function (k) { return g[k]; }), names: names };
  try { var txt2 = JSON.stringify(out), size = 90000, put = {}, cnt = Math.ceil(txt2.length / size);
    for (var j = 0; j < cnt; j++) put['preco_' + j] = txt2.slice(j * size, (j + 1) * size);
    if (cnt <= 20) { cache.putAll(put, 1800); cache.put('preco_n', String(cnt), 1800); } } catch (e) {}
  return out;
}
/* ===================== 외부 최저가 (네이버 쇼핑 검색 API) =====================
 * 스크립트 속성 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET (네이버 개발자센터 '검색' API 앱) 필요.
 * 상품명에서 모델코드(영문+숫자 5자 이상 또는 숫자 6자 이상)를 찾아 그 코드가 들어간 결과만 비교 → 다른 상품과 섞이지 않게.
 * 모델코드가 없으면 상품명 단어가 60% 이상 겹치는 결과만. 우리 스토어(겐더샵·셀렉트인하우스·모아하우스 등)는 최저가에서 빼고 따로 표시.
 * 결과는 OPS DB '외부시세' 탭에 상품코드별로 저장(덮어쓰기). 조회 전용. */
var HUB_NV_OWN = ['겐더샵', '셀렉트인', '모아하우스', '셀로라', 'gandershop', 'gantheshop', 'selectin', 'select-in', 'sellora'];
function hubNvQuery_(name, brand) {
  var s = String(name || '').replace(/\[[^\]]*\]|【[^】]*】/g, ' ').replace(/^\s*(겐더샵|셀렉트인)\)\s*/, '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  var codes = s.match(/(?:^|\s)((?=[A-Za-z0-9-]*\d)(?=[A-Za-z0-9-]*[A-Za-z])[A-Za-z0-9-]{5,}|\d{6,})(?=\s|$)/g) || [];
  codes = codes.map(function (c) { return c.trim(); }).sort(function (a, b) { return b.length - a.length; });
  var code = codes[0] || '', b = String(brand || '').trim();
  var words = s.split(' ').filter(function (w) { return w.length >= 2 && w !== code; });
  var q = code ? (b ? b + ' ' : (words[0] ? words[0] + ' ' : '')) + code : words.slice(0, 6).join(' ');
  return { q: q.trim(), code: code, words: words.slice(0, 8) };
}
function hubNvNorm_(t) { return String(t || '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').toUpperCase(); }
function hubExtPrice_(items) {
  var pr = PropertiesService.getScriptProperties(), id = pr.getProperty('NAVER_CLIENT_ID') || '', sec = pr.getProperty('NAVER_CLIENT_SECRET') || '';
  if (!id || !sec) return { error: 'naver_key' };
  items = (items || []).slice(0, 40).filter(function (x) { return x && x.prd; });
  var now = hubNow_(), out = [];
  for (var i = 0; i < items.length; i += 8) {
    var chunk = items.slice(i, i + 8).map(function (x) { var q = hubNvQuery_(x.name, x.brand); q.prd = String(x.prd); return q; }).filter(function (q) { return q.q; });
    var res = UrlFetchApp.fetchAll(chunk.map(function (q) {
      return { url: 'https://openapi.naver.com/v1/search/shop.json?display=40&sort=sim&exclude=used:rental&query=' + encodeURIComponent(q.q),
        headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': sec }, muteHttpExceptions: true };
    }));
    res.forEach(function (r, k) {
      var q = chunk[k], code = r.getResponseCode();
      if (code === 401 || code === 403) throw new Error('네이버 API 키가 맞지 않아요 (' + code + ')');
      if (code !== 200) { out.push({ prd: q.prd, q: q.q, err: 'HTTP ' + code }); return; }
      var L = (JSON.parse(r.getContentText()).items || []), nc = q.code.replace(/[-\s]/g, '').toUpperCase();
      var ok = L.filter(function (it) {
        var t = hubNvNorm_(it.title).replace(/[-\s]/g, '');
        if (nc) return t.indexOf(nc) >= 0;
        var tt = hubNvNorm_(it.title), hit = q.words.filter(function (w) { return tt.indexOf(w.toUpperCase()) >= 0; }).length;
        return q.words.length && hit / q.words.length >= 0.6;
      });
      var low = null, own = null;
      ok.forEach(function (it) {
        var price = Number(it.lprice) || 0; if (!price) return;
        var mall = String(it.mallName || ''), mine = HUB_NV_OWN.some(function (w) { return mall.toLowerCase().indexOf(w.toLowerCase()) >= 0; });
        if (mine) { if (!own || price < own) own = price; return; }
        if (!low || price < low.price) low = { price: price, mall: mall, link: String(it.link || ''), title: hubNvNorm_(it.title).slice(0, 80) };
      });
      out.push({ prd: q.prd, q: q.q, low: low ? low.price : 0, mall: low ? low.mall : '', link: low ? low.link : '', title: low ? low.title : '',
        match: nc ? '모델코드' : '상품명', n: ok.length, own: own || 0, at: now });
    });
    if (i + 8 < items.length) Utilities.sleep(800);
  }
  // 저장 (상품코드별 덮어쓰기)
  hubLocked_(function () {
    var r = hubRows_('외부시세'), idx = {};
    r.vals.forEach(function (v, j) { idx[String(v[0])] = j + 2; });
    var add = [];
    out.forEach(function (o) {
      if (o.err) return;
      var row = ["'" + o.prd, o.q, o.low, o.mall, o.link, o.title, o.match, o.n, o.own, o.at];
      if (idx[o.prd]) r.sh.getRange(idx[o.prd], 1, 1, 10).setValues([row]); else add.push(row);
    });
    if (add.length) r.sh.getRange(r.sh.getLastRow() + 1, 1, add.length, 10).setValues(add);
    return true;
  });
  return { ok: true, rows: out };
}
function hubExtPriceList_() {
  var has = !!PropertiesService.getScriptProperties().getProperty('NAVER_CLIENT_ID');
  var map = {};
  hubRows_('외부시세').vals.forEach(function (v) {
    var at = v[9] instanceof Date ? Utilities.formatDate(v[9], 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : String(v[9]);
    map[String(v[0])] = { prd: String(v[0]), q: String(v[1]), low: hubNum_(v[2]), mall: String(v[3]), link: String(v[4]), title: String(v[5]), match: String(v[6]), n: hubNum_(v[7]), own: hubNum_(v[8]), at: at };
  });
  return { key: has, map: map };
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
  var vals, out = [];
  if (id) vals = hubRows_('재고이력').vals;
  else {   // 최근 것만 필요 → 끝부분만 읽음 (이력 탭이 커져도 첫 화면이 느려지지 않게)
    var sh = hubSheet_('재고이력'), last = sh.getLastRow(), n = Math.min(Math.max(0, last - 1), limit + 50);
    vals = n ? sh.getRange(last - n + 1, 1, n, HUB_TABS['재고이력'].length).getValues() : [];
  }
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
  // 조회 결과 0건이면 사방넷이 404 NOT_FOUND로 응답 → 빈 목록으로 처리
  var nb = r.body || {};
  if (!r.ok && Number(r.status) === 404 && String(nb.message) === 'NOT_FOUND' && nb.data && Number(nb.data.totalItemCnt || 0) === 0) {
    nb.data.results = nb.data.results || []; nb.data.hasNext = false; return nb;
  }
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
  if (HUB_MEMO_.cfg) return HUB_MEMO_.cfg;
  var o = {};
  hubRows_('설정').vals.forEach(function (v) { if (v[0]) o[String(v[0])] = { value: String(v[1]), at: String(v[2]), by: String(v[3]) }; });
  return (HUB_MEMO_.cfg = o);
}
function hubConfigSet_(key, value, me) {
  key = hubStr_(key, 60); if (!key) throw new Error('키가 없습니다');
  HUB_MEMO_.cfg = null;
  var r = hubRows_('설정'), row = [key, hubStr_(value, 2000), hubNow_(), me.name];
  for (var i = 0; i < r.vals.length; i++) if (String(r.vals[i][0]) === key) { r.sh.getRange(i + 2, 1, 1, 4).setValues([row]); return; }
  r.sh.appendRow(row);
}

/* ===================== 첫 화면 데이터 ===================== */
function hubBoot_(me, compact) {
  if (!compact) { var o0 = { me: me, products: hubProducts_(), history: hubHistory_(null, 200), config: hubConfig_() }; if (hubIsAdmin_(me.role)) o0.users = hubUsers_(); return o0; }   // 옛 화면 호환
  // 상품은 가볍게: 열 이름 + 값 배열 (객체 키 반복 제거, 등록서 JSON은 등록서 상품만)
  var iReg = HUB_P_FIELDS.indexOf('reg'), iRs = HUB_P_FIELDS.indexOf('regStatus');
  var rows = hubRows_('상품').vals.filter(function (v) { return v[0]; }).map(function (v) {
    return v.map(function (x, i) { if (x instanceof Date) return Utilities.formatDate(x, 'Asia/Seoul', 'yyyy-MM-dd HH:mm'); if (i === iReg && !v[iRs]) return ''; return x === '' ? '' : x; });
  });
  var out = { me: me, pcols: HUB_P_FIELDS, prows: rows, history: hubHistory_(null, 200), config: hubConfig_() };
  if (hubIsAdmin_(me.role)) out.users = hubUsers_();
  return out;
}

/* ===================== 월 마감 (매출 마감 자료 메일) =====================
 * 매출판 「일별입력」(OPS 매출과 같은 원본·같은 규칙)으로 지난달 마감 자료를 만들어 메일로 보냄.
 * 예전 「일일매출」 월말 메일과 다른 점
 *  - 데이터가 다 들어왔는지 먼저 점검: 사방넷·스마트스토어·크림·포이즌·도소매가 말일 이후까지 반영됐는지,
 *    사방넷 API(주문일) 합계와 매출판 사방넷 합계가 맞는지, 법인 '확인필요' 행, 원가 미입력 매출
 *  - 다 맞으면 「확정」, 아니면 기다렸다가(매일 10시 다시 점검) 8일에 「가마감」으로 미반영 항목을 표시해 보냄
 *  - 이익은 매입원가가 입력된 매출만으로 계산 (원가 없는 행은 정산액이 통째로 이익이 되는 문제 제외)
 *  - 첨부 엑셀: 고정 파일 「셀렉트인 OPS 월마감」 하나를 매번 다시 채워서 내보냄 (스프레드시트를 새로 만들지 않음)
 * 처음 한 번: 편집기에서 hubMonthCloseSetup 실행 → 권한 허용 (메일 보내기·트리거) → 매일 10시 자동 점검 */
var HUB_MC_TO = 'biz@select-in.com', HUB_MC_CC = 'select_in@naver.com,skai1464@naver.com';
var HUB_MC_GROUPS = ['사방넷', '스마트스토어', '크림', '포이즌', '도소매'];
var HUB_MC_HOUR = 10, HUB_MC_LAST_DAY = 8;

function hubMcYm_(ym) {
  var tz = 'Asia/Seoul';
  if (/^\d{4}-\d{2}$/.test(String(ym || ''))) return String(ym);
  var t = Utilities.formatDate(new Date(), tz, 'yyyy-MM').split('-');
  var d = new Date(Date.UTC(+t[0], +t[1] - 2, 1));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2);
}
function hubMcEnd_(ym) { var p = ym.split('-'); return ym + '-' + ('0' + new Date(Date.UTC(+p[0], +p[1], 0)).getUTCDate()).slice(-2); }
function hubMcSetting_() {
  var c = hubConfig_(), v = function (k, d) { return c[k] && String(c[k].value).trim() ? String(c[k].value).trim() : d; };
  return { to: v('mc_to', HUB_MC_TO), cc: v('mc_cc', HUB_MC_CC), auto: v('mc_auto', 'Y') !== 'N', cfg: c };
}

/** 마감 자료 계산 (읽기 전용) */
function hubMonthCloseBuild_(ym, opt) {
  opt = opt || {};
  var tz = 'Asia/Seoul', from = ym + '-01', to = hubMcEnd_(ym), today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var ss = SpreadsheetApp.openById(HUB_SALES_ID), sh = ss.getSheetByName('일별입력');
  if (!sh) throw new Error("매출판에 '일별입력' 탭이 없어요");
  var v = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), sh.getLastColumn()).getValues(), h = -1;
  for (var i = 0; i < Math.min(10, v.length); i++) if (String(v[i][0]).trim() === '날짜') { h = i; break; }
  if (h < 0) throw new Error("일별입력 탭에서 '날짜' 머리글을 찾지 못했어요");
  var I = {}; v[h].forEach(function (c, j) { var k = String(c).trim(); if (k && !(k in I)) I[k] = j; });
  var miss = ['날짜', '법인', '채널그룹', '주문건수', '매출액'].filter(function (k) { return I[k] == null; });
  if (miss.length) throw new Error('일별입력 머리글이 바뀌었어요: ' + miss.join(', '));
  var col = function (r, k) { return I[k] == null ? '' : r[I[k]]; };
  var N = hubNum_, last = {}, rows = [];
  v.slice(h + 1).forEach(function (r) {
    var d = hubSalesYmd_(col(r, '날짜'), tz); if (!d) return;
    var corp = String(col(r, '법인')).trim(); if (corp === '제외') return;
    if (String(col(r, '채널')).trim() === '사방넷' && hubSbnSkip_(col(r, '쇼핑몰ID'))) return;   // 스토어팜 기준 (중복 수집 계정)
    var grp = String(col(r, '채널그룹')).trim() || '기타';
    var pf = String(col(r, '플랫폼(자동)') || col(r, '쇼핑몰') || col(r, '채널')).trim() || grp;
    var lk = grp === '리셀' ? (/포이즌/i.test(pf + col(r, '채널')) ? '포이즌' : '크림') : grp;
    if (d <= today && (!last[lk] || d > last[lk])) last[lk] = d;
    if (d < from || d > to) return;
    var amt = N(col(r, '매출액')), settle = N(col(r, '정산예정액')), cost = N(col(r, '매입원가')), etc = N(col(r, '기타비용'));
    var fee = I['수수료'] != null ? N(col(r, '수수료')) : Math.max(0, amt - settle);
    rows.push({
      d: d, corp: corp || '확인필요', grp: grp, lk: lk, pf: pf, ch: String(col(r, '채널')).trim(), mall: String(col(r, '쇼핑몰')).trim(), mid: String(col(r, '쇼핑몰ID')).trim(),
      cnt: N(col(r, '주문건수')), amt: amt, fee: fee, settle: settle, cost: cost, etc: etc,
      costed: cost > 0, profit: cost > 0 ? settle - cost - etc : 0,
      payDay: hubSalesYmd_(col(r, '입금예정일'), tz), paid: String(col(r, '입금확인(Y)')).trim().toUpperCase() === 'Y', memo: String(col(r, '비고')).trim()
    });
  });
  var zero = function (k) { return { k: k, cnt: 0, amt: 0, fee: 0, settle: 0, cost: 0, etc: 0, profit: 0, costedAmt: 0, paid: 0, unpaid: 0 }; };
  var add = function (o, r) {
    o.cnt += r.cnt; o.amt += r.amt; o.fee += r.fee; o.settle += r.settle; o.etc += r.etc;
    if (r.costed) { o.cost += r.cost; o.profit += r.profit; o.costedAmt += r.amt; }
    if (r.paid) o.paid += r.settle; else o.unpaid += r.settle;
  };
  var group = function (key) {
    var M = {}; rows.forEach(function (r) { var k = key(r); add(M[k] || (M[k] = Object.assign(zero(k), { corp: r.corp, grp: r.grp, pf: r.pf })), r); });
    return Object.keys(M).map(function (k) { return M[k]; }).filter(function (o) { return o.amt || o.cnt; }).sort(function (a, b) { return b.amt - a.amt; });
  };
  var tot = zero('합계'); rows.forEach(function (r) { add(tot, r); });
  var byCorp = group(function (r) { return r.corp; });
  var byGrp = group(function (r) { return r.grp; });
  var byCorpGrp = group(function (r) { return r.corp + ' · ' + r.grp; });
  var byPf = group(function (r) { return r.corp + '|' + r.grp + '|' + r.pf; });
  var days = [];
  for (var dd = from; dd <= to; dd = Utilities.formatDate(new Date(new Date(dd + 'T00:00:00+09:00').getTime() + 864e5), tz, 'yyyy-MM-dd')) {
    var o = { d: dd, 겐더샵: 0, 셀렉트인: 0, 기타: 0, cnt: 0, amt: 0, sbn: 0 };
    days.push(o);
  }
  var DI = {}; days.forEach(function (o, k) { DI[o.d] = k; });
  rows.forEach(function (r) { var o = days[DI[r.d]]; if (!o) return; o.cnt += r.cnt; o.amt += r.amt; if (r.corp === '겐더샵' || r.corp === '셀렉트인') o[r.corp] += r.amt; else o.기타 += r.amt; if (r.grp === '사방넷') o.sbn += r.amt; });

  /* ---- 점검 ---- */
  var checks = [], push = function (lv, item, msg) { checks.push({ lv: lv, item: item, msg: msg }); };
  HUB_MC_GROUPS.forEach(function (g) {
    var L = last[g] || '';
    if (g === '도소매') { push(L ? 'ok' : 'warn', '도소매 반영', L ? '마지막 입력 ' + L : '도소매 입력 기록이 없어요 (세금계산서 발행 건 확인)'); return; }
    if (L >= to) { push('ok', g + ' 반영', '말일(' + to.slice(5) + ')까지 반영됨 · 마지막 ' + L); return; }
    if (g === '크림' || g === '포이즌') {   // 판매자센터 동기화가 두 계정 모두 말일 다음 날 이후에 돌았으면 남은 건 아직 확정 전인 주문
      var cfg = hubConfig_(), key = g === '크림' ? 'krm_synced_' : 'pzn_synced_', after = Utilities.formatDate(new Date(new Date(to + 'T00:00:00+09:00').getTime() + 864e5), tz, 'yyyy-MM-dd');
      var sy = ['겐더샵', '셀렉트인'].map(function (a) { var v = cfg[key + a], t = v ? new Date(v.value) : null; return t && !isNaN(t) ? Utilities.formatDate(t, tz, 'yyyy-MM-dd') : ''; });
      if (sy.every(function (d) { return d && d >= after; })) { push('ok', g + ' 반영', '판매자센터 동기화 ' + sy.map(function (d) { return d.slice(5); }).join('·') + ' · 마지막 확정 ' + (L || '없음') + ' (이후 주문은 아직 확정 전)'); return; }
      push('bad', g + ' 반영', '마지막 ' + (L || '없음') + ' — 판매자센터 동기화가 말일 이후에 안 돌았어요 (겐더샵 ' + (sy[0] || '없음') + ' · 셀렉트인 ' + (sy[1] || '없음') + ')'); return;
    }
    push('bad', g + ' 반영', '마지막 ' + (L || '없음') + ' — 말일(' + to.slice(5) + ')까지 아직 안 들어왔어요');
  });
  var noSbn = days.filter(function (o) { return !o.sbn && o.d <= today; }).map(function (o) { return o.d.slice(8) * 1 + '일'; });
  if (noSbn.length) push('bad', '사방넷 빈 날짜', noSbn.join(', ') + ' 사방넷 매출이 0원 — 주문 수집 누락 확인');
  var unk = rows.filter(function (r) { return r.corp === '확인필요' || (r.corp !== '겐더샵' && r.corp !== '셀렉트인'); });
  if (unk.length) push('warn', '법인 미분류', unk.length + '행 · ' + won_(unk.reduce(function (t, r) { return t + r.amt; }, 0)) + '원 — 매출판 설정 ③에 쇼핑몰ID 추가 필요');
  var unc = tot.amt - tot.costedAmt;
  if (unc > 0) push(unc / Math.max(1, tot.amt) > 0.05 ? 'warn' : 'ok', '원가 미입력', won_(unc) + '원 (' + (unc / Math.max(1, tot.amt) * 100).toFixed(1) + '%) — 이익 계산에서 뺐어요');
  var sbnCheck = null;
  if (!opt.noApi) {
    try {
      var api = hubSbnSalesRange_(from, to), A = {}, S = {};
      api.rows.forEach(function (x) { var c = x[1]; A[c] = A[c] || { cnt: 0, amt: 0 }; A[c].cnt += x[3]; A[c].amt += x[4]; A['합계'] = A['합계'] || { cnt: 0, amt: 0 }; A['합계'].cnt += x[3]; A['합계'].amt += x[4]; });
      rows.filter(function (r) { return r.grp === '사방넷'; }).forEach(function (r) { S[r.corp] = S[r.corp] || { cnt: 0, amt: 0 }; S[r.corp].cnt += r.cnt; S[r.corp].amt += r.amt; S['합계'] = S['합계'] || { cnt: 0, amt: 0 }; S['합계'].cnt += r.cnt; S['합계'].amt += r.amt; });
      sbnCheck = ['겐더샵', '셀렉트인', '합계'].map(function (c) { var a = A[c] || { cnt: 0, amt: 0 }, s = S[c] || { cnt: 0, amt: 0 }; return { corp: c, apiCnt: a.cnt, apiAmt: a.amt, sheetCnt: s.cnt, sheetAmt: s.amt, diff: s.amt - a.amt }; });
      var t = sbnCheck[2], rate = Math.abs(t.diff) / Math.max(1, t.apiAmt);
      if (rate <= 0.005) push('ok', '사방넷 대조', '매출판 ' + won_(t.sheetAmt) + ' / 사방넷 API ' + won_(t.apiAmt) + ' (차이 ' + won_(t.diff) + ')');
      else push(rate <= 0.02 ? 'warn' : 'bad', '사방넷 대조', '매출판 ' + won_(t.sheetAmt) + ' / 사방넷 API ' + won_(t.apiAmt) + ' — 차이 ' + won_(t.diff) + '원 (' + (rate * 100).toFixed(1) + '%)');
    } catch (e) { push('warn', '사방넷 대조', '사방넷 API 조회 실패 — ' + String(e.message || e).slice(0, 100)); }
  }
  var bad = checks.filter(function (c) { return c.lv === 'bad'; }).length, warn = checks.filter(function (c) { return c.lv === 'warn'; }).length;
  return {
    ym: ym, from: from, to: to, status: bad ? '가마감' : '확정', bad: bad, warn: warn, at: hubNow_(),
    tot: tot, byCorp: byCorp, byGrp: byGrp, byCorpGrp: byCorpGrp, byPf: byPf, days: days, checks: checks, sbn: sbnCheck, last: last,
    rows: opt.rows ? rows : undefined, rowCount: rows.length
  };
}
function won_(n) { n = Math.round(Number(n) || 0); return (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

/** 첨부 엑셀: 고정 파일 하나를 다시 채워서 xlsx로 내보냄 */
function hubMcBook_() {
  var c = hubConfig_(), id = c.mc_book && c.mc_book.value;
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  var ss = SpreadsheetApp.create('셀렉트인 OPS 월마감 (메일 첨부용 · 자동으로 다시 채움)');
  hubConfigSet_('mc_book', ss.getId(), { name: '자동' });
  return ss;
}
function hubMcXlsx_(rep) {
  var ss = hubMcBook_(), pct = function (a, b) { return b ? Math.round(a / b * 1000) / 10 + '%' : ''; };
  var tabs = [
    ['요약', [['셀렉트인 ' + rep.ym.replace('-', '년 ') + '월 매출 마감 (' + rep.status + ')', '', '', '', '', '', '', '', ''],
      ['기간', rep.from + ' ~ ' + rep.to, '만든 시각', rep.at, '', '', '', '', ''], ['', '', '', '', '', '', '', '', ''],
      ['구분', '주문건수', '매출', '수수료', '정산예정', '매입원가', '이익(원가 입력분)', '이익률', '원가 미입력 매출']]
      .concat([rep.tot].concat(rep.byCorp).map(function (o) { return [o.k, o.cnt, o.amt, o.fee, o.settle, o.cost, o.profit, pct(o.profit, o.costedAmt), o.amt - o.costedAmt]; }))
      .concat([['', '', '', '', '', '', '', '', ''], ['입금', '입금완료(정산)', rep.tot.paid, '미입금(정산)', rep.tot.unpaid, '', '', '', '']])],
    ['법인·채널', [['법인 · 채널그룹', '주문건수', '매출', '비중', '수수료', '정산예정', '매입원가', '이익(원가 입력분)', '이익률', '미입금']]
      .concat(rep.byCorpGrp.map(function (o) { return [o.k, o.cnt, o.amt, pct(o.amt, rep.tot.amt), o.fee, o.settle, o.cost, o.profit, pct(o.profit, o.costedAmt), o.unpaid]; }))],
    ['플랫폼별', [['법인', '채널그룹', '플랫폼', '주문건수', '매출', '비중', '수수료', '정산예정', '매입원가', '이익(원가 입력분)', '미입금']]
      .concat(rep.byPf.map(function (o) { return [o.corp, o.grp, o.pf, o.cnt, o.amt, pct(o.amt, rep.tot.amt), o.fee, o.settle, o.cost, o.profit, o.unpaid]; }))],
    ['일별', [['날짜', '주문건수', '매출', '겐더샵', '셀렉트인', '기타', '사방넷']].concat(rep.days.map(function (o) { return [o.d, o.cnt, o.amt, o.겐더샵, o.셀렉트인, o.기타, o.sbn]; }))],
    ['상세', [['날짜', '법인', '채널그룹', '채널', '쇼핑몰', '쇼핑몰ID', '플랫폼', '주문건수', '매출', '수수료', '정산예정', '매입원가', '기타비용', '이익(원가 입력분)', '입금예정일', '입금확인', '비고']]
      .concat((rep.rows || []).slice().sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; }).map(function (r) { return [r.d, r.corp, r.grp, r.ch, r.mall, r.mid, r.pf, r.cnt, r.amt, r.fee, r.settle, r.cost || '', r.etc || '', r.costed ? r.profit : '', r.payDay, r.paid ? 'Y' : '', r.memo]; }))],
    ['점검', [['결과', '항목', '내용']].concat(rep.checks.map(function (c) { return [{ ok: '정상', warn: '확인', bad: '미반영' }[c.lv], c.item, c.msg]; }))
      .concat(rep.sbn ? [['', '', ''], ['사방넷 대조', '법인', '매출판 / 사방넷 API / 차이']].concat(rep.sbn.map(function (s) { return ['', s.corp, won_(s.sheetAmt) + ' / ' + won_(s.apiAmt) + ' / ' + won_(s.diff)]; })) : [])]
  ];
  tabs.forEach(function (t, k) {
    var sh = ss.getSheetByName(t[0]) || ss.insertSheet(t[0], k);
    sh.clear();
    var w = t[1].reduce(function (m, r) { return Math.max(m, r.length); }, 1);
    var vals = t[1].map(function (r) { r = r.slice(); while (r.length < w) r.push(''); return r; });
    sh.getRange(1, 1, vals.length, w).setValues(vals);
    var hr = t[0] === '요약' ? 4 : 1;
    sh.getRange(hr, 1, 1, w).setFontWeight('bold').setBackground('#e8f5ef');
    sh.setFrozenRows(hr);
    if (vals.length > hr) sh.getRange(hr + 1, 1, vals.length - hr, w).setNumberFormat('#,##0;-#,##0;0');
    if (t[0] === '상세' || t[0] === '일별') { sh.getRange(hr + 1, 1, Math.max(1, vals.length - hr), 1).setNumberFormat('@'); }
    if (t[0] === '상세') sh.getRange(hr + 1, 15, Math.max(1, vals.length - hr), 1).setNumberFormat('@');
    if (t[0] === '요약') sh.getRange(1, 1).setFontWeight('bold').setFontSize(13);
    try { sh.autoResizeColumns(1, w); } catch (e) {}
  });
  ss.getSheets().forEach(function (s) { if (tabs.every(function (t) { return t[0] !== s.getName(); }) && ss.getSheets().length > 1) ss.deleteSheet(s); });
  SpreadsheetApp.flush();
  var resp = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('엑셀 내보내기 실패 ' + resp.getResponseCode());
  return { blob: resp.getBlob().setName('셀렉트인_월마감_' + rep.ym + (rep.status === '확정' ? '' : '_가마감') + '.xlsx'), url: ss.getUrl() };
}

/** 메일 본문 (PC·휴대폰 모두 보기 좋게: 표는 100% 폭, 글자 줄바꿈) */
function hubMcHtml_(rep, note) {
  var pct = function (a, b) { return b ? (a / b * 100).toFixed(1) + '%' : '—'; };
  var man = function (n) { return won_(Math.round(n / 1e4)) + '만'; };
  var C = { ok: ['#0b7a55', '#e8f5ef', '정상'], warn: ['#9a6400', '#fff4dc', '확인'], bad: ['#c62828', '#fdecec', '미반영'] };
  var th = 'style="text-align:left;padding:7px 8px;border-bottom:1px solid #ddd;font-size:12px;color:#666;font-weight:600;white-space:nowrap"';
  var td = 'style="padding:7px 8px;border-bottom:1px solid #eee;font-size:13px;word-break:keep-all"', tdr = 'style="padding:7px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:right;white-space:nowrap"';
  var tbl = function (head, body) { return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:6px 0 18px">' + '<tr>' + head.map(function (x, k) { return '<th ' + th.replace('text-align:left', 'text-align:' + (k ? 'right' : 'left')) + '>' + x + '</th>'; }).join('') + '</tr>' + body.join('') + '</table>'; };
  var line = function (o) { return '<tr><td ' + td + '><b>' + o.k + '</b></td><td ' + tdr + '>' + won_(o.cnt) + '</td><td ' + tdr + '><b>' + won_(o.amt) + '</b></td><td ' + tdr + '>' + won_(o.settle) + '</td><td ' + tdr + '>' + won_(o.profit) + '<br><span style="color:#888;font-size:11px">' + pct(o.profit, o.costedAmt) + '</span></td></tr>'; };
  var st = rep.status === '확정' ? ['#0b7a55', '#e8f5ef', '확정 — 모든 채널이 말일까지 반영됐고 사방넷과 맞아요'] : ['#c62828', '#fdecec', '가마감 — 아래 「미반영」 항목이 아직 남아 있어요. 반영되면 확정본을 다시 보내요'];
  var kpi = function (k, v, s) { return '<td style="padding:10px 12px;border:1px solid #eee;border-radius:8px;vertical-align:top;width:25%"><div style="font-size:12px;color:#666">' + k + '</div><div style="font-size:19px;font-weight:700;margin-top:2px;white-space:nowrap">' + v + '</div><div style="font-size:11px;color:#888;margin-top:2px">' + (s || '') + '</div></td>'; };
  return '<div style="max-width:720px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,\'Apple SD Gothic Neo\',\'Malgun Gothic\',sans-serif;color:#222;line-height:1.5">' +
    '<h2 style="margin:0 0 4px;font-size:19px">셀렉트인 ' + rep.ym.slice(0, 4) + '년 ' + (+rep.ym.slice(5)) + '월 매출 마감</h2>' +
    '<div style="font-size:12px;color:#888;margin-bottom:12px">' + rep.from + ' ~ ' + rep.to + ' · 셀렉트인 OPS · ' + rep.at + ' 기준</div>' +
    (note ? '<div style="padding:10px 12px;background:#f4f5f7;border-radius:8px;font-size:13px;margin-bottom:10px">' + note + '</div>' : '') +
    '<div style="padding:10px 12px;background:' + st[1] + ';color:' + st[0] + ';border-radius:8px;font-size:13px;font-weight:600;margin-bottom:14px">' + st[2] + '</div>' +
    '<table role="presentation" width="100%" cellspacing="6" cellpadding="0" style="border-collapse:separate;width:100%;margin:0 -6px 12px"><tr>' +
      kpi('매출', man(rep.tot.amt), won_(rep.tot.amt) + '원') + kpi('주문', won_(rep.tot.cnt) + '건', '객단가 ' + (rep.tot.cnt ? won_(rep.tot.amt / rep.tot.cnt) : '—')) + '</tr><tr>' +
      kpi('정산 예정', man(rep.tot.settle), '수수료 ' + won_(rep.tot.fee)) + kpi('이익', man(rep.tot.profit), '이익률 ' + pct(rep.tot.profit, rep.tot.costedAmt) + ' · 원가 입력분') + '</tr></table>' +
    '<h3 style="font-size:15px;margin:8px 0 0">법인별</h3>' + tbl(['법인', '주문', '매출', '정산 예정', '이익'], rep.byCorp.map(line)) +
    '<h3 style="font-size:15px;margin:8px 0 0">법인 · 채널별</h3>' + tbl(['법인 · 채널', '주문', '매출', '정산 예정', '이익'], rep.byCorpGrp.map(line)) +
    '<h3 style="font-size:15px;margin:8px 0 0">점검</h3>' + tbl(['결과', '내용'], rep.checks.map(function (c) { var x = C[c.lv]; return '<tr><td ' + td + '><span style="display:inline-block;padding:2px 8px;border-radius:10px;background:' + x[1] + ';color:' + x[0] + ';font-size:12px;font-weight:600;white-space:nowrap">' + x[2] + '</span></td><td ' + td.replace('font-size:13px', 'font-size:13px;text-align:right') + '><b>' + c.item + '</b><br><span style="color:#555">' + c.msg + '</span></td></tr>'; })) +
    '<div style="font-size:12px;color:#888;margin-top:6px">입금완료 ' + won_(rep.tot.paid) + '원 · 미입금 ' + won_(rep.tot.unpaid) + '원 (정산예정액 기준)<br>' +
    '이익은 매입원가가 입력된 매출만으로 계산했어요 (원가 미입력 매출 ' + won_(rep.tot.amt - rep.tot.costedAmt) + '원 제외).<br>' +
    '플랫폼별·일별·상세 행은 첨부 엑셀에 있어요. OPS 매출: <a href="https://select-in.github.io/sales-app/ops_work/#close" style="color:#0b7a55">select-in.github.io/sales-app/hub</a></div></div>';
}

/** 마감 전 사방넷 다시 맞추기 — 매출판 '일별입력'의 그 달 사방넷 행(일×쇼핑몰×ID) 건수·매출을 지금 사방넷 API(주문일) 값으로 갱신.
 *  매일 자동 입력은 다음 날 한 번만 쓰고 끝나서, 그 뒤의 취소·늦은 수집이 빠짐 → 월마감 때 한 번 맞춤.
 *  매입원가(원가강제 반영분 포함)·비고는 건드리지 않음. 없는 조합은 아래에 새 줄로 추가. */
function hubSbnResync_(ym) {
  var tz = 'Asia/Seoul', from = ym + '-01', to = hubMcEnd_(ym), ss = SpreadsheetApp.openById(HUB_SALES_ID), sh = ss.getSheetByName('일별입력');
  var all = [], page = 1, N = hubNum_;
  while (page <= 60) {
    var r = hubSbnCall_('POST', '/v3/sb/order', { dateSearchCondition: 2, startDate: from.replace(/-/g, ''), endDate: to.replace(/-/g, ''), updateOrderStsYn: 'N', page: page, perPage: 1000,
      responseItems: ['SB_ORD_NO', 'ORDER_STATUS', 'ORDER_DT', 'SHOP_NM', 'SHOP_LOGIN_ID', 'ORDER_TOT_AMT', 'COST_PRICE', 'ORD_CNT', 'ORG_SB_ORD_NO', 'CM_PRD_NM', 'SHOP_PRD_CD'] });
    var dt = (r && r.data) || {}; all = all.concat(dt.results || []); if (!dt.hasNext) break; page++;
  }
  if (!all.length) throw new Error('사방넷 API에서 ' + ym + ' 주문을 못 받았어요');
  var fc = hubCostForceMap_(), G = {};
  all.forEach(function (x) {
    if (/CANCEL/i.test(String(x.ORDER_STATUS))) return;
    if (x.ORG_SB_ORD_NO && String(x.ORG_SB_ORD_NO) !== '0') return;
    var d = String(x.ORDER_DT || '').replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3').slice(0, 10); if (d < from || d > to) return;
    var shop = String(x.SHOP_NM || '').trim(), id = String(x.SHOP_LOGIN_ID || '').trim(), k = d + '|' + shop + '|' + id;
    if (hubSbnSkip_(id)) return;
    var g = G[k] || (G[k] = { d: d, shop: shop, id: id, cnt: 0, amt: 0, cost: 0 });
    g.cnt++; g.amt += N(x.ORDER_TOT_AMT); g.cost += N(x.COST_PRICE) || hubCostForceOf_(fc, x);
  });
  var last = sh.getLastRow(), v = sh.getRange(3, 1, Math.max(1, last - 2), 8).getValues(), seen = {}, upd = 0, zero = 0, lastVal = 0;
  v.forEach(function (row, i) {
    if (row[0] !== '') lastVal = i;
    if (String(row[1]).trim() !== '사방넷') return;
    var d = hubSalesYmd_(row[0], tz); if (d < from || d > to) return;
    var k = d + '|' + String(row[2]).trim() + '|' + String(row[3]).replace(/^'/, '').trim(), g = G[k], cnt = g ? g.cnt : 0, amt = g ? g.amt : 0;
    if (seen[k]) { cnt = 0; amt = 0; }   // 같은 조합이 두 줄이면 첫 줄에만
    seen[k] = 1;
    if (N(row[6]) !== cnt || N(row[7]) !== amt) { sh.getRange(i + 3, 7, 1, 2).setValues([[cnt, amt]]); upd++; if (!cnt) zero++; }
  });
  var add = Object.keys(G).filter(function (k) { return !seen[k]; }).sort().map(function (k) { return G[k]; });
  if (add.length) {
    var at = lastVal + 4;
    sh.getRange(at, 1, add.length, 4).setValues(add.map(function (g) { return [g.d, '사방넷', g.shop, /^\d+$/.test(g.id) ? "'" + g.id : g.id]; }));
    sh.getRange(at, 7, add.length, 3).setValues(add.map(function (g) { return [g.cnt, g.amt, Math.round(g.cost)]; }));
    sh.getRange(at, 20, add.length, 1).setValues(add.map(function () { return ['사방넷 API(주문일), 월마감 재동기화']; }));
  }
  return { ym: ym, api: all.length, updated: upd, zeroed: zero, added: add.length };
}
/** 이미 매출판에 들어간 스토어팜 중복 계정(HUB_SBN_SKIP) 사방넷 행을 0으로 (행은 남기고 비고에 사유) */
function hubSbnSkipFix_() {
  var sh = SpreadsheetApp.openById(HUB_SALES_ID).getSheetByName('일별입력'), last = sh.getLastRow(), v = sh.getRange(3, 1, Math.max(1, last - 2), 20).getValues(), n = 0, amt = 0;
  v.forEach(function (r, i) {
    if (String(r[1]).trim() !== '사방넷' || !hubSbnSkip_(r[3])) return;
    if (!hubNum_(r[6]) && !hubNum_(r[7])) return;
    amt += hubNum_(r[7]); n++;
    sh.getRange(i + 3, 7, 1, 3).setValues([[0, 0, 0]]);
    sh.getRange(i + 3, 20).setValue((String(r[19] || '') + ' · 스토어팜 중복 제외(원래 ' + hubNum_(r[6]) + '건 ' + won_(hubNum_(r[7])) + '원)').replace(/^ · /, ''));
  });
  return { ok: true, rows: n, amt: amt };
}
/** 포이즌 → 매출판: '포이즌판매'(판매자센터 동기화) 「거래 성공」 주문을 주문일×계정으로 묶어 '일별입력' 포이즌(계정) 행과 비교/반영.
 *  매출액=판매가, 실제수수료=판매가-정산액. write가 아니면 비교만. 매입원가·비고는 기존 값 유지 */
function hubPznSales_(ym, write, only, upOnly) {
  var tz = 'Asia/Seoul', from = ym + '-01', to = hubMcEnd_(ym), G = {}, pend = {}, N = hubNum_;
  hubRows_('포이즌판매').vals.forEach(function (v) {
    var acct = String(v[0]).trim(), st = String(v[2]).trim(), tab = String(v[3]).trim();
    var d = v[12] instanceof Date ? Utilities.formatDate(v[12], tz, 'yyyy-MM-dd') : String(v[12]).slice(0, 10);
    if (!acct || d < from || d > to || (only && acct !== only)) return;
    var k = d + '|' + acct;
    if (tab === 'TRADE_SUCCEED' || st === '거래 성공') { var g = G[k] || (G[k] = { d: d, acct: acct, cnt: 0, amt: 0, pay: 0 }); g.cnt++; g.amt += N(v[9]); g.pay += N(v[11]); }
    else if (!/TRADE_OFF|종료|취소/.test(tab + st)) { var q = pend[k] || (pend[k] = { d: d, acct: acct, cnt: 0, amt: 0, st: {} }); q.cnt++; q.amt += N(v[9]); q.st[st] = 1; }
  });
  var sh = SpreadsheetApp.openById(HUB_SALES_ID).getSheetByName('일별입력'), last = sh.getLastRow(), v = sh.getRange(3, 1, Math.max(1, last - 2), 11).getValues(), have = {}, lastVal = 0;
  v.forEach(function (r, i) {
    if (r[0] !== '') lastVal = i;
    var m = String(r[1]).trim().match(/^포이즌\((.+)\)$/); if (!m) return;
    var d = hubSalesYmd_(r[0], tz); if (d < from || d > to) return;
    if (only && m[1] !== only) return;
    var k = d + '|' + m[1]; if (have[k]) { have[k].dup = (have[k].dup || 0) + 1; return; }
    have[k] = { row: i + 3, cnt: N(r[6]), amt: N(r[7]), fee: N(r[10]) };
  });
  var diff = [], add = [];
  Object.keys(G).concat(Object.keys(have).filter(function (k) { return !G[k]; })).sort().forEach(function (k) {
    var g = G[k] || { d: k.split('|')[0], acct: k.split('|')[1], cnt: 0, amt: 0, pay: 0 }, h = have[k];
    if (h && h.cnt === g.cnt && h.amt === g.amt) return;
    diff.push({ d: g.d, acct: g.acct, sheet: h ? [h.cnt, h.amt] : null, poizon: [g.cnt, g.amt] });
    if (!write || !G[k]) return;   // 판매자센터 동기화 범위 밖(기록 없음)인 날은 건드리지 않음
    if (upOnly && h && g.cnt <= h.cnt) return;   // 판매자센터 목록이 일부만 읽힌 날은 매출판 값이 더 클 수 있어 줄이지 않음
    if (h) sh.getRange(h.row, 7, 1, 2).setValues([[g.cnt, g.amt]]), sh.getRange(h.row, 11).setValue(g.amt - g.pay);
    else if (g.cnt) add.push(g);
  });
  if (write && add.length) {
    var at = lastVal + 4;
    sh.getRange(at, 1, add.length, 3).setValues(add.map(function (g) { return [g.d, '포이즌(' + g.acct + ')', '포이즌']; }));
    sh.getRange(at, 7, add.length, 2).setValues(add.map(function (g) { return [g.cnt, g.amt]; }));
    sh.getRange(at, 11, add.length, 1).setValues(add.map(function (g) { return [g.amt - g.pay]; }));
    sh.getRange(at, 20, add.length, 1).setValues(add.map(function () { return ['포이즌 판매자센터 「거래 성공」(주문일)']; }));
  }
  var P = Object.keys(pend).sort().map(function (k) { var q = pend[k]; return { d: q.d, acct: q.acct, cnt: q.cnt, amt: q.amt, st: Object.keys(q.st).join('·') }; });
  return { ym: ym, write: !!write, diff: diff, added: add.length, pending: P, synced: { 겐더샵: (hubConfig_()['pzn_synced_겐더샵'] || {}).value, 셀렉트인: (hubConfig_()['pzn_synced_셀렉트인'] || {}).value } };
}
/** 메일 보내기 — kind: '확정'|'가마감'|'시험' */
function hubMonthCloseSend_(ym, me, test) {
  ym = hubMcYm_(ym);
  var rs = null; if (String((hubConfig_().mc_resync || {}).value || '') === 'Y') { try { rs = hubSbnResync_(ym); } catch (e) { rs = { error: String(e.message || e) }; } }   // 대장 승인 후 설정 mc_resync=Y 로 켬
  var rep = hubMonthCloseBuild_(ym, { rows: true }), set = hubMcSetting_();
  var x = hubMcXlsx_(rep), att = [x.blob], dnote = '';
  try { var dash = hubMcdBuild_(ym, me && me.name); att.push(dash.blob); dnote = '첨부 2개: ① 마감 자료(법인·채널·플랫폼·일별·상세·점검) ② 내부 회의용 매출 대시보드(담당자 양식 · ' + hubMcdMl_(ym) + ' 포함 최근 4개월 비교)'; }
  catch (e) { dnote = '내부 회의용 대시보드는 만들지 못했어요 — ' + String(e.message || e).slice(0, 150); }
  var subj = (test ? '[시험] ' : '') + '[OPS 월마감] ' + ym.slice(0, 4) + '년 ' + (+ym.slice(5)) + '월 매출 마감 — ' + rep.status + ' · ' + won_(Math.round(rep.tot.amt / 1e4)) + '만원';
  var note = test ? '시험 발송이에요 (받는 사람: ' + set.to + ' 만).' : (rep.status === '가마감' ? '말일 이후 ' + HUB_MC_LAST_DAY + '일이 지나도 일부 채널이 반영되지 않아 가마감으로 보내요.' : '');
  note = [note, dnote].filter(String).join('<br>');
  var mail = { to: set.to, subject: subj, htmlBody: hubMcHtml_(rep, note), attachments: att, name: '셀렉트인 OPS' };
  if (!test && set.cc) mail.cc = set.cc;
  MailApp.sendEmail(mail);
  if (!test) hubConfigSet_('mc_sent_' + ym, rep.status + ' · ' + won_(rep.tot.amt) + ' · ' + (me && me.name || '자동'), me || { name: '자동' });
  delete rep.rows;
  return { ok: true, sent: { to: set.to, cc: test ? '' : set.cc, subject: subj, status: rep.status, book: x.url }, report: rep };
}

/** 화면용: 미리보기 + 발송 기록 */
function hubMonthClosePreview_(ym) {
  ym = hubMcYm_(ym);
  var rep = hubMonthCloseBuild_(ym), set = hubMcSetting_(), sent = set.cfg['mc_sent_' + ym], wait = set.cfg['mc_wait_' + ym];
  var hist = Object.keys(set.cfg).filter(function (k) { return /^mc_sent_\d{4}-\d{2}$/.test(k); }).sort().reverse().slice(0, 12)
    .map(function (k) { return { ym: k.slice(8), v: set.cfg[k].value, at: set.cfg[k].at, by: set.cfg[k].by }; });
  var trig = false; try { trig = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'hubMonthCloseAuto'; }); } catch (e) { trig = null; }
  return { report: rep, setting: { to: set.to, cc: set.cc, auto: set.auto, hour: HUB_MC_HOUR, lastDay: HUB_MC_LAST_DAY, trigger: trig },
    sent: sent ? { v: sent.value, at: sent.at, by: sent.by } : null, wait: wait ? wait.at : '', hist: hist };
}

/** 매일 10시 자동 (트리거) — 1~8일에 지난달 마감 점검 → 확정되면 바로, 8일엔 가마감이라도 보냄. 한 달에 한 번만 */
function hubMonthCloseAuto() {
  var tz = 'Asia/Seoul', day = +Utilities.formatDate(new Date(), tz, 'd'), set = hubMcSetting_();
  if (!set.auto || day > HUB_MC_LAST_DAY) return;
  var ym = hubMcYm_(), lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var cfg = hubConfig_(); if (cfg['mc_sent_' + ym]) return;
    var rep = hubMonthCloseBuild_(ym);
    if (rep.status === '확정' || day >= HUB_MC_LAST_DAY) { hubMonthCloseSend_(ym, { name: '자동' }, false); return; }
    if (!cfg['mc_wait_' + ym]) {   // 1회만: 마감 대기 안내 (첨부 없음)
      var pend = rep.checks.filter(function (c) { return c.lv === 'bad'; }).map(function (c) { return '· ' + c.item + ' — ' + c.msg; }).join('<br>');
      MailApp.sendEmail({ to: set.to, subject: '[OPS 월마감] ' + ym.slice(0, 4) + '년 ' + (+ym.slice(5)) + '월 마감 대기 — 미반영 ' + rep.bad + '건', name: '셀렉트인 OPS',
        htmlBody: hubMcHtml_(rep, '아직 마감 자료를 확정할 수 없어요. 아래 항목이 반영되면 확정본(엑셀 첨부)을 자동으로 보내요. 늦어도 ' + HUB_MC_LAST_DAY + '일 10시에는 가마감으로 보내요.<br><br>' + pend) });
      hubConfigSet_('mc_wait_' + ym, rep.bad + '건 대기', { name: '자동' });
    }
  } finally { lock.releaseLock(); }
}

/** 처음 한 번 (편집기에서 실행): 권한 허용 + 매일 10시 트리거 */
function hubMonthCloseSetup() {
  Logger.log('메일 남은 한도: ' + MailApp.getRemainingDailyQuota());
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'hubMonthCloseAuto') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('hubMonthCloseAuto').timeBased().everyDays(1).atHour(HUB_MC_HOUR).inTimezone('Asia/Seoul').create();
  hubMcBook_();
  Logger.log('월 마감 자동 점검을 매일 ' + HUB_MC_HOUR + '시로 설정했어요. 지난달(' + hubMcYm_() + ') 상태: ' + hubMonthCloseBuild_(hubMcYm_(), { noApi: true }).status);
}

/* ===================== 스마트스토어 → 매출판 (일일매출 프로젝트에서 이전) =====================
 * 예전 「일일매출」 Code.gs(syncAll·runToday·run_·parseGongu_·onSyncEdit)를 그대로 옮김. 규칙 동일.
 *  - 어제 확정: '일별입력'에 스토어별 [공구]/[일반] 두 줄 (이미 있으면 건너뜀) + '공구입력'에 인플루언서·상품별 줄
 *  - 오늘 실시간: '오늘현황' 300~500행 덮어쓰기 (결제 기준 주문 + 발송)
 *  - 네이버는 등록 IP만 허용 → 카페24 중계(naver_sales.php)를 거쳐 조회
 *  - ID·시크릿·중계 키는 코드에 두지 않음 (저장소가 공개) → 스크립트 속성 NV_STORES / NV_RELAY_KEY
 *    OPS → 설정 → 보관함 화면의 「스마트스토어 연결」에서 관리자가 입력
 * 같은 날짜 줄이 이미 있으면 건너뛰므로 예전 프로젝트와 잠깐 같이 돌아도 중복으로 쓰지 않음 */
var HUB_NV = { relay: 'https://sln0217.mycafe24.com/naver_sales.php', sheet: '일별입력', first: 3, last: 10002, gongu: '공구입력' };
function hubNvStores_() {
  var p = PropertiesService.getScriptProperties(), raw = p.getProperty('NV_STORES'), key = p.getProperty('NV_RELAY_KEY');
  var list = []; try { list = JSON.parse(raw || '[]'); } catch (e) {}
  list = (list || []).filter(function (s) { return s && s.channel && s.id && s.secret; }).map(function (s) { return { channel: String(s.channel).trim(), id: String(s.id).trim(), secret: String(s.secret).trim() }; });
  if (!list.length || !key) throw new Error('스마트스토어 연결 정보가 없어요 (OPS 보관함 → 스마트스토어 연결에서 입력)');
  return { list: list, key: key };
}
function hubNvFetch_(payload) {
  var st = hubNvStores_(); payload.stores = st.list;
  var res = UrlFetchApp.fetch(HUB_NV.relay + '?key=' + encodeURIComponent(st.key), { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(payload) });
  if (res.getResponseCode() !== 200) throw new Error('네이버 중계 ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
  return JSON.parse(res.getContentText());
}
function hubNvGongu_(name) {
  var n = String(name || '').trim(), seps = [/\s+[xX×]\s+/, /×/, /(?<=[가-힣a-zA-Z0-9_.])[xX](?=[가-힣])/];
  for (var k = 0; k < seps.length; k++) {
    var m = n.match(seps[k]);
    if (m && m.index > 0 && m.index <= 20) {
      var inf = n.slice(0, m.index).replace(/^\[[^\]]*\]\s*/, '').trim(), brand = n.slice(m.index + m[0].length).trim();
      brand = brand.replace(/\s*(공동구매|공구)[\s\S]*$/, '').trim() || brand;
      if (inf) return { influencer: inf, brand: brand };
    }
  }
  if (/공동구매|공구/.test(n)) return { influencer: '(미확인)', brand: n };
  return null;
}
/** 하루치 확정 반영 (dry=true면 쓰지 않고 시트와 비교만) */
function hubNvRunDay_(dateStr, dry) {
  var r = hubNvFetch_({ date: dateStr }), ss = SpreadsheetApp.openById(HUB_SALES_ID);
  var sh = ss.getSheetByName(HUB_NV.sheet), gs = ss.getSheetByName(HUB_NV.gongu);
  var abc = sh.getRange(HUB_NV.first, 1, HUB_NV.last - HUB_NV.first + 1, 8).getDisplayValues();
  var gLast = Math.max(gs.getLastRow(), 1), gExist = gLast > 1 ? gs.getRange(2, 1, gLast - 1, 5).getDisplayValues() : [];
  var dateObj = Utilities.parseDate(dateStr, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd'), out = [];
  (r.stores || []).forEach(function (s) {
    if (s.error) { out.push({ ch: s.channel, error: String(s.error).slice(0, 120) }); return; }
    var g = { count: 0, sales: 0, fee: 0 }, n = { count: 0, sales: 0, fee: 0 }, gRows = [];
    (s.items || []).forEach(function (it) {
      var p = hubNvGongu_(it.product), t = p ? g : n;
      t.count += it.count; t.sales += it.sales; t.fee += it.fee;
      if (p) gRows.push([dateObj, s.channel, p.influencer, p.brand, it.product, it.count, it.qty, it.sales, it.fee, it.sales - it.fee, '네이버 커머스API(결제일)']);
    });
    [['공구', g], ['일반', n]].forEach(function (x) {
      var label = x[0], t = x[1], plat = s.channel + ' ' + label;
      var have = abc.filter(function (v) { return v[0] === dateStr && v[1] === s.channel && v[2] === plat; })[0];
      var o = { ch: plat, api: { cnt: t.count, amt: t.sales }, sheet: have ? { cnt: hubNum_(have[6]), amt: hubNum_(have[7]) } : null };
      o.ok = have ? (o.sheet.cnt === t.count && o.sheet.amt === t.sales) : !t.count;
      if (!t.count || have || dry) { o.wrote = false; out.push(o); return; }
      var i = abc.findIndex(function (v) { return v[0] === ''; });
      if (i < 0) throw new Error('일별입력이 가득 찼어요');
      var row = HUB_NV.first + i;
      sh.getRange(row, 1, 1, 3).setValues([[dateObj, s.channel, plat]]);
      sh.getRange(row, 7, 1, 2).setValues([[t.count, t.sales]]);
      sh.getRange(row, 11).setValue(t.fee);
      sh.getRange(row, 20).setValue('네이버 커머스API(결제일), 취소·반품 제외');
      abc[i] = [dateStr, s.channel, plat, '', '', '', String(t.count), String(t.sales)];
      o.wrote = true; out.push(o);
    });
    if (!dry) {
      var newG = gRows.filter(function (x) { return !gExist.some(function (v) { return v[0] === dateStr && v[1] === s.channel && v[4] === x[4]; }); });
      if (newG.length) { gs.getRange(gs.getLastRow() + 1, 1, newG.length, 11).setValues(newG); newG.forEach(function (x) { gExist.push([dateStr, s.channel, '', '', x[4]]); }); }
    }
  });
  return out;
}
/** 오늘 실시간 → 오늘현황 300~500행 */
function hubNvToday_() {
  var tz = 'Asia/Seoul', today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), ss = SpreadsheetApp.openById(HUB_SALES_ID), sh = ss.getSheetByName('오늘현황');
  var now = new Date(), dateObj = Utilities.parseDate(today, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd'), rows = [], got = 0;
  [['주문', 'PAYED_DATETIME'], ['발송', 'DISPATCHED_DATETIME']].forEach(function (lr) {
    var label = lr[0], r;
    try { r = hubNvFetch_({ date: today, rangeType: lr[1] }); } catch (e) { Logger.log(label + ' ' + e.message); return; }
    got++;
    (r.stores || []).forEach(function (s) {
      if (s.error) return;
      var g = { c: 0, s: 0 }, n = { c: 0, s: 0 }, inf = {};
      (s.items || []).forEach(function (it) {
        var p = hubNvGongu_(it.product), t = p ? g : n; t.c += it.count; t.s += it.sales;
        if (p && label === '주문') { var k = p.influencer + '|' + p.brand; inf[k] = inf[k] || { i: p.influencer, b: p.brand, c: 0, s: 0 }; inf[k].c += it.count; inf[k].s += it.sales; }
      });
      Object.keys(inf).forEach(function (k) { var x = inf[k]; rows.push(['공구', s.channel, '셀렉트인', x.i, x.b, x.c, x.s, now, dateObj]); });
      [['공구', g], ['일반', n]].forEach(function (x) { if (x[1].c) rows.push([label, s.channel, '셀렉트인', s.channel + ' ' + x[0], '', x[1].c, x[1].s, now, dateObj]); });
    });
  });
  if (!got) return 0;   // 둘 다 실패하면 기존 값을 지우지 않음
  sh.getRange(300, 1, 201, 9).clearContent();
  if (rows.length) sh.getRange(300, 1, rows.length, 9).setValues(rows);
  return rows.length;
}
/** 트리거: 어제 확정 + 오늘 실시간 (매일 10:30·18:00) */
function hubNvSync() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(60000)) return;
  try {
    var y = Utilities.formatDate(new Date(Date.now() - 864e5), 'Asia/Seoul', 'yyyy-MM-dd');
    try { hubNvRunDay_(y, false); } catch (e) { Logger.log('어제 반영 오류: ' + e.message); }
    hubNvToday_();
    PropertiesService.getScriptProperties().setProperty('NV_LAST', hubNow_());
  } finally { lock.releaseLock(); }
}
/** 매출판 🔄 체크박스 (대시보드 E4 · 오늘현황 E2) — 설치형 수정 트리거 */
function hubNvOnEdit(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet().getName(), a1 = e.range.getA1Notation();
  if (!((sh === '대시보드' && a1 === 'E4') || (sh === '오늘현황' && a1 === 'E2'))) return;
  if (e.range.getValue() !== true) return;
  var ss = e.source || SpreadsheetApp.openById(HUB_SALES_ID);
  try { ss.toast('스마트스토어 동기화 중…', '🔄', 5); hubNvSync(); ss.toast('완료: ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'HH:mm'), '🔄', 5); }
  finally { e.range.setValue(false); }
}
/** 편집기에서 한 번: 트리거 설치 (연결 정보 입력 후) */
function hubNvInstall() {
  hubNvStores_();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['hubNvSync', 'hubNvOnEdit'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('hubNvSync').timeBased().atHour(10).nearMinute(30).everyDays(1).inTimezone('Asia/Seoul').create();
  ScriptApp.newTrigger('hubNvSync').timeBased().atHour(18).nearMinute(0).everyDays(1).inTimezone('Asia/Seoul').create();
  ScriptApp.newTrigger('hubNvOnEdit').forSpreadsheet(HUB_SALES_ID).onEdit().create();
  Logger.log('스마트스토어 동기화: 매일 10:30·18:00 + 매출판 🔄 체크박스 연결 완료');
}
function hubNvStatus_() {
  var p = PropertiesService.getScriptProperties(), list = []; try { list = JSON.parse(p.getProperty('NV_STORES') || '[]'); } catch (e) {}
  var trig = []; try { trig = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }).filter(function (f) { return /^hubNv/.test(f); }); } catch (e) {}
  return { channels: (list || []).map(function (s) { return { channel: s.channel, id: s.id ? String(s.id).slice(0, 4) + '…' : '', secret: !!s.secret }; }), relayKey: !!p.getProperty('NV_RELAY_KEY'), last: p.getProperty('NV_LAST') || '', triggers: trig };
}
function hubNvSave_(req) {
  var p = PropertiesService.getScriptProperties(), cur = []; try { cur = JSON.parse(p.getProperty('NV_STORES') || '[]'); } catch (e) {}
  var next = (req.stores || []).map(function (s, k) {
    var old = cur.filter(function (c) { return c.channel === String(s.channel || '').trim(); })[0] || {};
    return { channel: hubStr_(s.channel, 40), id: hubStr_(s.id, 100) || old.id || '', secret: hubStr_(s.secret, 200) || old.secret || '' };
  }).filter(function (s) { return s.channel; });
  p.setProperty('NV_STORES', JSON.stringify(next));
  if (hubStr_(req.relayKey, 200)) p.setProperty('NV_RELAY_KEY', hubStr_(req.relayKey, 200));
  return { ok: true, status: hubNvStatus_() };
}

/* ===================== 보관함 (예전 프로그램·시트·자동화 목록) =====================
 * OPS로 옮기고 안 쓰는 것은 지우지 않고 '보관'으로 둠. OPS DB '보관' 탭에서 한 곳에 관리 (시트에서 직접 고쳐도 됨) */
var HUB_ARCH_HEAD = ['구분', '이름', '하던 일', '상태', '대체(OPS)', '링크', '보관일', '메모', '수정일', '수정자'];
function hubArchSeed_() {
  var SC = 'https://script.google.com/home/projects/', d = '2026-11-02';
  return [
    ['Apps Script', '일일매출', '스마트스토어 매출 → 매출판(일별입력·공구입력·오늘현황), 예전 매출앱 서버(drWarm), 월말 메일', '이전 중', '매출 · 월 마감 (OPS 서버 hubNvSync)', SC + '1f6_YrvLytqskt90Idtfmp-sW965751JwZVhty5gXq4xZ-BOu-sBya7CS/edit', '', '월말 메일 트리거 삭제(11/2). 스마트스토어 동기화가 OPS에서 확인되면 나머지 트리거 끄고 보관'],
    ['자동화', '일일매출 월말 메일 (monthlyReport)', '매월 1일 매출판 대시보드 스냅샷 메일', '보관', '월 마감', '', d, '기준일·이익 계산 부정확으로 교체'],
    ['자동화', '일일매출 drWarm', '예전 매출 앱 캐시 데우기 (몇 분마다)', '이전 중', '필요 없음 (앱 보관)', '', '', ''],
    ['앱', '예전 데일리 매출 앱', '매출 보기 (select-in.github.io/sales-app/)', '보관', '매출', 'https://github.com/select-in/sales-app/tree/main/archive/daily-sales-app', '2026-10-27', '예전 주소는 OPS 매출로 이동'],
    ['시트', '셀렉트인_데일리매출판', '매출 원본 데이터 (1월~)', '사용중', '매출 · 월 마감이 읽고 씀', 'https://docs.google.com/spreadsheets/d/' + HUB_SALES_ID + '/edit', '', '지우면 안 됨'],
    ['Apps Script', '일일매출 (금영 소유 사본, 10/27 수정)', '확인 필요', '확인 필요', '', 'https://script.google.com/home/all', '', ''],
    ['Apps Script', '일일매출 (10/8 수정 사본)', '확인 필요', '확인 필요', '', 'https://script.google.com/home/all', '', ''],
    ['Apps Script', '공동구매 db자동취합', '공동구매 파일 자동 취합 (지금취합)', '사용중', '', SC + '1BB5chu9Ph4FEAfcrRK2dM04do9ToeL2dVeJwBuqUIzGQH8fr1O6ll-6c/edit', '', ''],
    ['Apps Script', '노션캘린더', '노션 ↔ 캘린더 동기화 (syncAllAuto)', '사용중', '', 'https://script.google.com/home/all', '', ''],
    ['Apps Script', '셀)발주서 통합본', '셀렉트인 발주서 주문 가져오기', '사용중', '', 'https://script.google.com/home/all', '', ''],
    ['Apps Script', '오더자동화_M', '폴더 → 마스터 동기화, 재고·발주 요청', '사용중', '', 'https://script.google.com/home/all', '', ''],
    ['Apps Script', '가격 비교 감시', '네이버 가격비교 묶임 감시', '확인 필요', '', 'https://script.google.com/home/all', '', ''],
    ['Apps Script', '셀렉트인제안서및정산서', '공구 제안서·정산서', '확인 필요', '', 'https://script.google.com/home/all', '', ''],
    ['Apps Script', '오더자동화 (겐더샵)', '확인 필요', '확인 필요', '', 'https://script.google.com/home/all', '', ''],
    ['Apps Script', 'B2C행사 캘린더 자동화', '확인 필요', '확인 필요', '', 'https://script.google.com/home/all', '', ''],
    ['Apps Script', 'B2C행사시트 코드 (겐더샵)', '확인 필요', '확인 필요', '', 'https://script.google.com/home/all', '', ''],
    ['Apps Script', '매크로 기록됨(제목 없는 스프레드시트)', '확인 필요', '확인 필요', '', 'https://script.google.com/home/all', '', '']
  ];
}
function hubArchSheet_() {
  var ss = hubBook_(), sh = ss.getSheetByName('보관');
  if (!sh) {
    sh = ss.insertSheet('보관');
    sh.getRange(1, 1, 1, HUB_ARCH_HEAD.length).setValues([HUB_ARCH_HEAD]).setFontWeight('bold').setBackground('#e8f5ef'); sh.setFrozenRows(1);
    var seed = hubArchSeed_().map(function (r) { return r.concat([hubNow_(), '자동']); });
    sh.getRange(2, 1, seed.length, HUB_ARCH_HEAD.length).setValues(seed);
  }
  return sh;
}
function hubArchList_() {
  var sh = hubArchSheet_(), n = sh.getLastRow() - 1;
  var rows = n > 0 ? sh.getRange(2, 1, n, HUB_ARCH_HEAD.length).getDisplayValues().map(function (r, i) { return { row: i + 2, v: r }; }).filter(function (x) { return x.v[1]; }) : [];
  return { head: HUB_ARCH_HEAD, rows: rows, url: hubBook_().getUrl() + '#gid=' + sh.getSheetId() };
}
function hubArchSave_(req, me) {
  var sh = hubArchSheet_(), v = (req.v || []).slice(0, 8).map(function (x, k) { return hubStr_(x, k === 2 || k === 7 ? 500 : 300); });
  while (v.length < 8) v.push('');
  if (!v[1]) throw new Error('이름을 넣어 주세요');
  if (v[3] === '보관' && !v[6]) v[6] = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var row = Number(req.row) || 0;
  if (req.del && row >= 2) { sh.getRange(row, 4).setValue('삭제됨'); sh.getRange(row, 9, 1, 2).setValues([[hubNow_(), me.name]]); return hubArchList_(); }   // 행은 지우지 않고 표시만
  var vals = [v.concat([hubNow_(), me.name])];
  if (row >= 2 && row <= sh.getLastRow()) sh.getRange(row, 1, 1, HUB_ARCH_HEAD.length).setValues(vals); else sh.appendRow(vals[0]);
  return hubArchList_();
}

/* ===================== 사방넷 수집일 기준 법인별 건수 =====================
 * 송장 출력은 수집일 기준이라 매출(주문일)과 따로 봄. 사방넷 API dateSearchCondition 1(수집일)로 하루씩 조회.
 * 규칙: 취소 제외 · 반품/교환 재생성 행 제외 · 설정 ③ 쇼핑몰ID→법인('제외' 빼기) · 스토어팜도 포함(매출과 달리 사방넷 수집 그대로). 지난 날은 6시간, 오늘은 5분 캐시 */
function hubSbnRegDaily_(days, force) {
  var tz = 'Asia/Seoul', n = Math.max(1, Math.min(31, Number(days) || 14)), cache = CacheService.getScriptCache();
  var ss = SpreadsheetApp.openById(HUB_SALES_ID), corp = {};
  ss.getSheetByName('설정').getRange('A57:B120').getValues().forEach(function (r) { var id = String(r[0]).trim(); if (id) corp[id] = String(r[1]).trim(); });
  var out = [];
  for (var k = 0; k < n; k++) {
    var d = Utilities.formatDate(new Date(Date.now() - k * 864e5), tz, 'yyyyMMdd'), ck = 'sbn_reg2_' + d, hit = force ? null : cache.get(ck);
    if (hit) { try { out.push(JSON.parse(hit)); continue; } catch (e) {} }
    var o = { d: d.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'), 겐더샵: 0, 셀렉트인: 0, 기타: 0, amt: { 겐더샵: 0, 셀렉트인: 0, 기타: 0 } }, page = 1;
    try {
      while (page <= 20) {
        var r = hubSbnCall_('POST', '/v3/sb/order', { dateSearchCondition: 1, startDate: d, endDate: d, updateOrderStsYn: 'N', page: page, perPage: 1000,
          responseItems: ['SB_ORD_NO', 'ORDER_STATUS', 'SHOP_LOGIN_ID', 'ORDER_TOT_AMT', 'ORG_SB_ORD_NO'] });
        var dt = (r && r.data) || {};
        (dt.results || []).forEach(function (x) {
          if (/CANCEL/i.test(String(x.ORDER_STATUS))) return;
          if (x.ORG_SB_ORD_NO && String(x.ORG_SB_ORD_NO) !== '0') return;
          var c = corp[String(x.SHOP_LOGIN_ID || '').trim()] || '기타'; if (c === '제외') return;   // 수집 기준은 송장 출력용이라 스토어팜(ncp_1p0lvc_01)도 포함
          if (c !== '겐더샵' && c !== '셀렉트인') c = '기타';
          o[c]++; o.amt[c] += Number(x.ORDER_TOT_AMT) || 0;
        });
        if (!dt.hasNext) break; page++;
      }
    } catch (e) { o.error = String(e.message || e).slice(0, 80); }
    if (!o.error) { try { cache.put(ck, JSON.stringify(o), k === 0 ? 300 : 21600); } catch (e) {} }
    out.push(o);
  }
  return { rows: out, at: Utilities.formatDate(new Date(), tz, 'HH:mm') };
}


/* ===================== 원가 강제 (사방넷 상품 미매칭 주문) =====================
 * 쇼핑몰 주문이 사방넷 상품과 연결되지 않아 원가 0으로 들어오는 상품 → OPS DB '원가강제' 탭의 상품명별 개당 원가로 강제.
 *  - 매일 사방넷 매출(sbSalesDaily)이 원가 0 + 상품명(CM_PRD_NM) 일치면 개당 원가×수량을 넣음
 *  - hubCostForceApply_: 지난 주문(기간)을 다시 읽어 매출판 '일별입력' 사방넷 행의 매입원가에 더함. 한 번 넣은 주문번호는 기록해서 두 번 더하지 않음 */
var HUB_CF_HEAD = ['상품명', '개당 원가', '수정일', '수정자', '메모', '쇼핑몰상품코드'];
function hubCfNorm_(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
function hubCfSheet_() {
  var ss = hubBook_(), sh = ss.getSheetByName('원가강제');
  if (!sh) { sh = ss.insertSheet('원가강제'); sh.getRange(1, 1, 1, HUB_CF_HEAD.length).setValues([HUB_CF_HEAD]).setFontWeight('bold').setBackground('#e8f5ef'); sh.setFrozenRows(1); }
  return sh;
}
function hubCostForceMap_() {
  var c = CacheService.getScriptCache(), hit = c.get('cf_map'); if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var sh = hubCfSheet_(), n = sh.getLastRow() - 1, m = {};
  if (sh.getLastColumn() < 6) sh.getRange(1, 6).setValue('쇼핑몰상품코드').setFontWeight('bold').setBackground('#e8f5ef');
  if (n > 0) sh.getRange(2, 1, n, 6).getValues().forEach(function (r) { var k = hubCfNorm_(r[0]), v = Number(r[1]); if (!k || !(v > 0)) return; m[k] = v; String(r[5] || '').split(/[,\s]+/).forEach(function (c) { if (c && c !== 'null') m['#' + c] = v; }); });
  try { c.put('cf_map', JSON.stringify(m), 600); } catch (e) {}
  return m;
}
function hubCostForceOf_(m, x) {
  var u = m[hubCfNorm_(x.CM_PRD_NM)] || (x.SHOP_PRD_CD && m['#' + String(x.SHOP_PRD_CD)]); if (!u) return 0;
  return Math.round(u * (Number(x.ORD_CNT) || 1));
}
function hubCostForceSet_(req, me) {
  var sh = hubCfSheet_(); if (sh.getLastColumn() < 6) sh.getRange(1, 6).setValue('쇼핑몰상품코드').setFontWeight('bold').setBackground('#e8f5ef');
  var n = sh.getLastRow() - 1, cur = n > 0 ? sh.getRange(2, 1, n, 6).getValues() : [], idx = {};
  cur.forEach(function (r, i) { idx[hubCfNorm_(r[0])] = i; });
  (req.items || []).forEach(function (it) {
    var k = hubCfNorm_(it[0]), v = Number(it[1]); if (!k || !(v > 0)) return;
    var row = [k, v, hubNow_(), me.name, hubStr_(it[2] || '', 200), hubStr_(it[3] || '', 300)];
    if (k in idx) { if (!row[5]) row[5] = cur[idx[k]][5]; cur[idx[k]] = row; } else { idx[k] = cur.length; cur.push(row); }
  });
  if (cur.length) sh.getRange(2, 1, cur.length, 6).setValues(cur);
  CacheService.getScriptCache().remove('cf_map');
  return { ok: true, n: cur.length };
}
/** 지난 주문 다시 계산. dry=true면 쓰지 않고 맞는 주문만 보여 줌. 한 번에 한 달(from~to)씩 */
function hubCostForceApply_(from, to, dry, ordMap) {
  ordMap = ordMap || {};
  var a = String(from || '').replace(/-/g, ''), b = String(to || '').replace(/-/g, '');
  if (!/^\d{8}$/.test(a) || !/^\d{8}$/.test(b)) throw new Error('날짜 형식');
  var m = hubCostForceMap_(), ss = SpreadsheetApp.openById(HUB_SALES_ID), corp = {};
  ss.getSheetByName('설정').getRange('A57:B120').getValues().forEach(function (r) { var id = String(r[0]).trim(); if (id) corp[id] = String(r[1]).trim(); });
  var props = PropertiesService.getScriptProperties(), done = {}; try { done = JSON.parse(props.getProperty('CF_DONE_' + a.slice(0, 6)) || '{}'); } catch (e) {}
  var all = [], page = 1;
  while (page <= 60) {
    var r = hubSbnCall_('POST', '/v3/sb/order', { dateSearchCondition: 2, startDate: a, endDate: b, updateOrderStsYn: 'N', page: page, perPage: 1000,
      responseItems: ['SB_ORD_NO', 'ORDER_STATUS', 'ORDER_DT', 'SHOP_NM', 'SHOP_LOGIN_ID', 'ORD_CNT', 'COST_PRICE', 'ORDER_TOT_AMT', 'ORG_SB_ORD_NO', 'CM_PRD_NM', 'SHOP_PRD_CD'] });
    var dt = (r && r.data) || {}; all = all.concat(dt.results || []); if (!dt.hasNext) break; page++;
  }
  var add = {}, byName = {}, zeroNames = {}, hit = 0, skipped = 0;
  all.forEach(function (x) {
    if (/CANCEL/i.test(String(x.ORDER_STATUS))) return;
    if (x.ORG_SB_ORD_NO && String(x.ORG_SB_ORD_NO) !== '0') return;
    var id = String(x.SHOP_LOGIN_ID || '').trim(); if (corp[id] === '제외') return;
    if (Number(x.COST_PRICE) > 0) return;
    var om = ordMap[String(x.SB_ORD_NO)], nm = om ? hubCfNorm_(om[1]) : hubCfNorm_(x.CM_PRD_NM), c = om ? Math.round(Number(om[0]) * (Number(x.ORD_CNT) || 1)) : hubCostForceOf_(m, x);
    if (!c) { zeroNames[nm] = (zeroNames[nm] || 0) + 1; return; }
    var no = String(x.SB_ORD_NO); if (done[no]) { skipped++; return; }
    var d = String(x.ORDER_DT || '').replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3'), k = d + '|' + String(x.SHOP_NM || '').trim() + '|' + id;
    var o = add[k] || (add[k] = { cost: 0, nos: [] }); o.cost += c; o.nos.push(no);
    byName[nm] = byName[nm] || [0, 0]; byName[nm][0]++; byName[nm][1] += c; hit++;
  });
  var res = { orders: all.length, hit: hit, skipped: skipped, total: Object.keys(add).reduce(function (t, k) { return t + add[k].cost; }, 0), byName: byName,
    stillZero: Object.keys(zeroNames).sort(function (p, q) { return zeroNames[q] - zeroNames[p]; }).slice(0, 30).map(function (k) { return [k, zeroNames[k]]; }), rows: 0, miss: [] };
  if (dry) return res;
  var sh = ss.getSheetByName('일별입력'), last = sh.getLastRow(), v = sh.getRange(3, 1, last - 2, 9).getValues(), tz = 'Asia/Seoul', touched = {};
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][1]).trim() !== '사방넷') continue;
    var d = hubSalesYmd_(v[i][0], tz), id = String(v[i][3]).replace(/^'/, '').trim(), k = d + '|' + String(v[i][2]).trim() + '|' + id;
    if (!add[k] || touched[k]) continue;
    sh.getRange(i + 3, 9).setValue((Number(v[i][8]) || 0) + Math.round(add[k].cost));
    add[k].nos.forEach(function (no) { done[no] = 1; }); touched[k] = 1; res.rows++;
  }
  Object.keys(add).forEach(function (k) { if (!touched[k]) res.miss.push([k, Math.round(add[k].cost)]); });
  props.setProperty('CF_DONE_' + a.slice(0, 6), JSON.stringify(done));
  return res;
}


/** 스마트스토어(셀렉트인하우스·모아하우스) 상품별 일 판매 — 월마감 대시보드용 (조회 전용, 결제일 기준·취소/반품 제외) */
function hubNvItems_(from, to) {
  var tz = 'Asia/Seoul', a = new Date(String(from) + 'T12:00:00+09:00'), b = new Date(String(to) + 'T12:00:00+09:00'), out = [];
  if (isNaN(a) || isNaN(b) || b < a || (b - a) / 864e5 > 31) throw new Error('기간은 31일 이내');
  for (var d = a; d <= b; d = new Date(d.getTime() + 864e5)) {
    var ds = Utilities.formatDate(d, tz, 'yyyy-MM-dd'), r = hubNvFetch_({ date: ds });
    (r.stores || []).forEach(function (s) {
      if (s.error) { out.push([ds, s.channel, '(오류) ' + String(s.error).slice(0, 80), 0, 0, 0, 0]); return; }
      (s.items || []).forEach(function (it) { out.push([ds, s.channel, it.product, it.count, it.qty, it.sales, it.fee]); });
    });
  }
  return { cols: ['date', 'store', 'product', 'count', 'qty', 'sales', 'fee'], rows: out };
}


/* ===================== 월마감 RAW (주문 단위) =====================
 * 사방넷 관리자 화면(북마크)·스마트스토어 조회 결과를 OPS DB에 월별로 저장 → 월마감 대시보드(엑셀) 원본.
 *  '월마감RAW'(사방넷 주문 줄) · '월마감NV'(스마트스토어 상품별 일 판매). 같은 달을 다시 넣으면 그 달 줄을 지우고 새로 씀 */
var HUB_MCR = {
  '월마감RAW': ['월', '주문번호', '주문일', '쇼핑몰', '쇼핑몰ID', '상품명', '수집상품명', '옵션', '원가', '수량', '주문금액', '주문상태', '상태구분', '품번', '원주문번호'],
  '월마감NV': ['월', '날짜', '스토어', '상품명', '건수', '수량', '매출', '수수료']
};
function hubMcRawPut_(req) {
  var tab = req.tab, head = HUB_MCR[tab]; if (!head) throw new Error('tab');
  var ym = String(req.ym || ''); if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('ym');
  var ss = hubBook_(), sh = ss.getSheetByName(tab);
  if (!sh) { sh = ss.insertSheet(tab); sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); sh.setFrozenRows(1); }
  if (req.reset) {
    var n = sh.getLastRow() - 1;
    if (n > 0) { var v = sh.getRange(2, 1, n, head.length).getValues().filter(function (r) { return String(r[0]) !== ym && r[0] !== ''; }); sh.getRange(2, 1, n, head.length).clearContent(); if (v.length) sh.getRange(2, 1, v.length, head.length).setValues(v); }
  }
  var rows = (req.rows || []).map(function (r) { var o = [ym].concat(r.slice(0, head.length - 1)); while (o.length < head.length) o.push(''); return o.map(function (x) { return typeof x === 'string' && /^\d{9,}$/.test(x) ? "'" + x : x; }); });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, head.length).setValues(rows);
  return { ok: true, added: rows.length, total: sh.getLastRow() - 1, sheetId: ss.getId() };
}


/* ===================== 월마감 대시보드 (내부 회의용 · 담당자 양식 xlsx) =====================
 * 담당자 월 대시보드(통합·법인별·날짜별·쇼핑몰별·TOP상품·월별·교환반품·N개월 비교·RAW) 양식을 그대로 쓰는 엑셀.
 *  - 템플릿: 구글시트(10월분으로 만든 양식)를 복사해서 RAW·목록만 바꿔 채움 → 수식·차트·서식은 템플릿 그대로
 *  - 원본: 사방넷 주문 줄 = OPS DB '월마감RAW'(사방넷 화면에서 넣은 달) 없으면 사방넷 API(주문일)
 *          셀렉트인 스마트스토어 정상 주문 = 네이버 커머스API(상품·일자별, '월마감NV'에 저장)
 *  - 비교: OPS DB '월마감이력'(월별 고정값)에서 직전 3개월 + 이번달(수식)
 *  - 월마감 메일에 기존 마감 엑셀과 함께 첨부 (실패해도 기존 메일은 나감) */
/** 스토어팜(네이버 API)으로 직접 집계하는 계정 — 사방넷에 같은 주문이 수집돼도 매출에서 뺌 (중복 방지, 스토어팜 기준) */
var HUB_SBN_SKIP = ['ncp_1p0lvc_01'];
function hubSbnSkip_(id) { return HUB_SBN_SKIP.indexOf(String(id || '').replace(/^'/, '').trim()) >= 0; }
var HUB_MCD = { tpl: 'mc_dash_tpl', folder: 'mc_dash_folder', hist: '월마감이력', sel: 'ncp_1p0lvc_01', pink: '#e6b8b7',
  head: ['월', '겐더샵', '셀렉트인', '합계', '주문건수', '교환', '반품', '취소', '순매출', '반품차감', '채널', '쇼핑몰', '셀러', '기록'] };

function hubMcdFolder_() {
  var c = hubConfig_(), id = c[HUB_MCD.folder] && c[HUB_MCD.folder].value;
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var f = DriveApp.createFolder('셀렉트인 OPS 월마감 대시보드');
  hubConfigSet_(HUB_MCD.folder, f.getId(), { name: '자동' });
  return f;
}
/** 템플릿 등록: xlsx(base64) → 구글시트로 변환해 저장 */
function hubMcdTplPut_(req) {
  var bytes = Utilities.base64Decode(String(req.b64 || ''));
  if (bytes.length < 1000) throw new Error('파일이 비었어요');
  var meta = { name: String(req.name || '셀렉트인 OPS 월마감 대시보드 템플릿'), mimeType: 'application/vnd.google-apps.spreadsheet' };
  var bd = 'mcd' + Date.now();
  var body = Utilities.newBlob('--' + bd + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + bd +
    '\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n').getBytes().concat(bytes).concat(Utilities.newBlob('\r\n--' + bd + '--').getBytes());
  var r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'post', contentType: 'multipart/related; boundary=' + bd,
    payload: body, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('구글시트 변환 실패 ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200));
  var id = JSON.parse(r.getContentText()).id;
  try { DriveApp.getFileById(id).moveTo(hubMcdFolder_()); } catch (e) {}
  hubConfigSet_(HUB_MCD.tpl, id, { name: '자동' });
  return { ok: true, id: id, url: 'https://docs.google.com/spreadsheets/d/' + id };
}

/* ---- 월별 이력 ---- */
function hubMcdHistSheet_() {
  var ss = hubBook_(), sh = ss.getSheetByName(HUB_MCD.hist);
  if (!sh) { sh = ss.insertSheet(HUB_MCD.hist); sh.getRange(1, 1, 1, HUB_MCD.head.length).setValues([HUB_MCD.head]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function hubMcdYmOf_(v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM') : String(v || '').replace(/^'/, '').trim().slice(0, 7); }
function hubMcdHist_() {
  var sh = hubMcdHistSheet_(), n = sh.getLastRow() - 1, H = {};
  if (n < 1) return H;
  sh.getRange(2, 1, n, HUB_MCD.head.length).getValues().forEach(function (r) {
    var ym = hubMcdYmOf_(r[0]); if (!/^\d{4}-\d{2}$/.test(ym)) return;
    var j = function (x) { try { return JSON.parse(x || '{}'); } catch (e) { return {}; } };
    H[ym] = { g: +r[1] || 0, s: +r[2] || 0, tot: +r[3] || 0, cnt: +r[4] || 0, ex: +r[5] || 0, rt: +r[6] || 0, cc: +r[7] || 0, net: +r[8] || 0, ded: +r[9] || 0, ch: j(r[10]), shops: j(r[11]), sellers: j(r[12]) };
  });
  return H;
}
function hubMcdHistPut_(ym, h, by) {
  var sh = hubMcdHistSheet_(), n = sh.getLastRow() - 1, at = -1;
  if (n > 0) sh.getRange(2, 1, n, 1).getValues().forEach(function (r, i) { if (hubMcdYmOf_(r[0]) === ym) at = i + 2; });
  var row = ["'" + ym, h.g, h.s, h.tot, h.cnt, h.ex, h.rt, h.cc, h.net, h.ded, JSON.stringify(h.ch || {}), JSON.stringify(h.shops || {}), JSON.stringify(h.sellers || {}), hubNow_() + ' ' + (by || '자동')];
  sh.getRange(at > 0 ? at : sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

/* ---- 주문 줄 ---- */
function hubMcdGongu_(name) {
  var n = String(name || '').trim(), seps = [/\s+[xX×]\s+/, /×/, /(?<=[가-힣a-zA-Z0-9_.])[xX](?=[가-힣])/];
  for (var i = 0; i < seps.length; i++) {
    var m = seps[i].exec(n);
    if (m && m.index > 0 && m.index <= 20) { var inf = n.slice(0, m.index).replace(/^\[[^\]]*\]\s*/, '').trim(); if (inf) return inf; }
  }
  return /공동구매|공구/.test(n) ? '(미확인)' : null;
}
function hubMcdSt_(s) { s = String(s || ''); return /취소|CANCEL/i.test(s) ? '취소' : /반품|RETURN/i.test(s) ? '반품' : /교환|EXCHANGE/i.test(s) ? '교환' : '정상구매'; }

function hubMcdLines_(ym) {
  var tz = 'Asia/Seoul', from = ym + '-01', to = hubMcEnd_(ym), corp = {}, out = [], src = {}, N = hubNum_;
  SpreadsheetApp.openById(HUB_SALES_ID).getSheetByName('설정').getRange('A57:B120').getValues().forEach(function (r) { var id = String(r[0]).trim(); if (id) corp[id] = String(r[1]).trim(); });
  var push = function (d, shop, id, name, opt, cost, qty, amt, stx) {
    var c = corp[id] || '확인필요'; if (c === '제외') return;
    var st = hubMcdSt_(stx);
    if (hubSbnSkip_(id) && st === '정상구매') return;   // 스토어팜 기준 (같은 주문이 네이버 API로 들어옴)
    var sel = c === '셀렉트인' ? hubMcdGongu_(name) : null;
    out.push({ d: d, shop: shop, corp: c, name: name, opt: opt, cost: cost, qty: qty, amt: amt, st: st, kind: c === '셀렉트인' ? (sel ? '공동구매' : '일반주문') : '-', seller: sel || '' });
  };
  // 1) 사방넷: OPS 매출과 같은 사방넷 API(주문일) 주문 줄 — 상품명·옵션은 화면에서 넣은 월마감RAW(주문번호)로 보강
  var raw = hubBook_().getSheetByName('월마감RAW'), nmap = {}, got = 0;
  if (raw && raw.getLastRow() > 1) raw.getRange(2, 1, raw.getLastRow() - 1, 8).getValues().forEach(function (r) {
    if (hubMcdYmOf_(r[0]) !== ym) return; var k = String(r[1]).replace(/^'/, '').trim(); if (k && !nmap[k]) { nmap[k] = [String(r[5] || r[6]).trim(), String(r[7] || '')]; got++; }
  });
  var fc = hubCostForceMap_(), all = [], page = 1;
  while (page <= 60) {
    var res = hubSbnCall_('POST', '/v3/sb/order', { dateSearchCondition: 2, startDate: from.replace(/-/g, ''), endDate: to.replace(/-/g, ''), updateOrderStsYn: 'N', page: page, perPage: 1000,
      responseItems: ['SB_ORD_NO', 'ORDER_STATUS', 'ORDER_DT', 'SHOP_NM', 'SHOP_LOGIN_ID', 'ORDER_TOT_AMT', 'COST_PRICE', 'ORD_CNT', 'ORG_SB_ORD_NO', 'CM_PRD_NM', 'SHOP_PRD_CD'] });
    var dt = (res && res.data) || {}; all = all.concat(dt.results || []); if (!dt.hasNext) break; page++;
  }
  var named = 0;
  all.forEach(function (x) {
    if (x.ORG_SB_ORD_NO && String(x.ORG_SB_ORD_NO) !== '0') return;
    var s = String(x.ORDER_DT || ''), d = s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
    if (d < from || d > to) return;
    var w = nmap[String(x.SB_ORD_NO)], nm = (w && w[0]) || String(x.CM_PRD_NM || '').trim();
    if (w) named++;
    if (!nm) nm = '(사방넷 미매칭 상품) ' + String(x.SHOP_PRD_CD || '');
    push(d, String(x.SHOP_NM || '').trim(), String(x.SHOP_LOGIN_ID || '').trim(), nm, w ? w[1] : '', (N(x.COST_PRICE) || hubCostForceOf_(fc, x) / Math.max(1, N(x.ORD_CNT) || 1)), N(x.ORD_CNT) || 1, N(x.ORDER_TOT_AMT), x.ORDER_STATUS);
  });
  src.sbn = '사방넷 API(주문일, OPS 매출과 같은 원본) ' + all.length + '줄' + (got ? ' · 상품명·옵션 ' + named + '줄은 사방넷 주문서확인처리 화면 자료로 보강' : '');
  // 2) 셀렉트인 스마트스토어 정상 주문: OPS DB 월마감NV → 없으면 네이버 조회 후 저장
  var nvSh = hubBook_().getSheetByName('월마감NV'), nv = [];
  if (nvSh && nvSh.getLastRow() > 1) nvSh.getRange(2, 1, nvSh.getLastRow() - 1, 8).getValues().forEach(function (r) { if (hubMcdYmOf_(r[0]) === ym) nv.push(r.slice(1)); });
  if (!nv.length) {
    var q = hubNvItems_(from, to).rows, bad = q.filter(function (r) { return /^\(오류\)/.test(r[2]); });
    if (bad.length) throw new Error('스마트스토어 조회 오류 ' + bad.length + '일 — ' + bad[0][0] + ' ' + bad[0][2]);
    hubMcRawPut_({ tab: '월마감NV', ym: ym, rows: q, reset: true }); nv = q;
  }
  nv.forEach(function (r) {
    var d = hubSalesYmd_(r[0], tz) || String(r[0]).slice(0, 10), cnt = Math.max(1, Math.round(N(r[3]))), qty = N(r[4]), amt = N(r[5]), name = String(r[2]).trim(), sel = hubMcdGongu_(name);
    for (var i = 0; i < cnt; i++) {
      var last = i === cnt - 1, a = last ? amt - Math.round(amt / cnt) * (cnt - 1) : Math.round(amt / cnt), qq = last ? qty - (qty / cnt) * (cnt - 1) : qty / cnt;
      out.push({ d: d, shop: '스마트스토어', corp: '셀렉트인', name: name, opt: '', cost: 0, qty: Math.round(qq * 100) / 100, amt: a, st: '정상구매', kind: sel ? '공동구매' : '일반주문', seller: sel || '' });
    }
  });
  src.nv = '네이버 커머스API ' + nv.length + '줄';
  // 3) 그 외 OPS 매출(리셀·도소매·공동구매 등): 매출판 일별입력 그대로 (상품 단위가 없어 건수만큼 행 분할, 상품 순위에서는 제외)
  var rep = hubMonthCloseBuild_(ym, { rows: true, noApi: true }), ex = 0;
  (rep.rows || []).forEach(function (r) {
    if (r.grp === '사방넷' || r.grp === '스마트스토어' || !r.amt) return;
    var cnt = Math.max(1, Math.round(r.cnt || 1)), shop = r.pf || r.grp, gb = r.corp === '셀렉트인' && (r.grp === '공동구매' || /공구/.test(shop)), sel = gb ? (hubMcdGongu_(r.mall || r.memo) || '(미확인)') : '';
    for (var i = 0; i < cnt; i++) {
      var a = i === cnt - 1 ? r.amt - Math.round(r.amt / cnt) * (cnt - 1) : Math.round(r.amt / cnt);
      out.push({ d: r.d, shop: shop, corp: r.corp, name: shop + ' 판매 (OPS 매출판 ' + r.grp + ')', opt: '', cost: r.costed ? Math.round(r.cost / cnt) : 0, qty: 1, amt: a, st: '정상구매',
        kind: r.corp === '셀렉트인' ? (gb ? '공동구매' : '일반주문') : '-', seller: sel, agg: true });
    }
    ex += r.amt;
  });
  src.ops = 'OPS 매출판(리셀·도소매 등) ' + won_(ex) + '원';
  out.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : a.shop < b.shop ? -1 : a.shop > b.shop ? 1 : a.corp < b.corp ? -1 : a.corp > b.corp ? 1 : 0; });
  return { lines: out, src: src };
}

function hubMcdAgg_(L) {
  var nc = L.filter(function (o) { return o.st !== '취소'; }), G = function (o) { return o.corp === '겐더샵'; }, S = function (o) { return o.corp === '셀렉트인'; };
  var by = function (src, key, pred, cnt) { var c = {}; src.forEach(function (o) { if (pred && !pred(o)) return; var k = key(o); c[k] = (c[k] || 0) + (cnt ? 1 : o.amt); }); return c; };
  var sum = function (src, pred) { return src.reduce(function (t, o) { return t + (!pred || pred(o) ? o.amt : 0); }, 0); };
  var nm = function (o) { return o.name; }, cl = function (st, p) { return by(L, nm, function (o) { return !o.agg && o.st === st && (!p || p(o)); }, true); };
  var P = function (f) { return function (o) { return !o.agg && f(o); }; };
  var R = {
    shops: by(nc, function (o) { return o.shop; }), gshops: by(nc, function (o) { return o.shop; }, G), sshops: by(nc, function (o) { return o.shop; }, S),
    gprod: by(nc, nm, P(G)), sprod: by(nc, nm, P(S)), sellers: by(nc, function (o) { return o.seller; }, function (o) { return S(o) && o.kind === '공동구매' && o.seller; }),
    tot: sum(nc), g: sum(nc, G), s: sum(nc, S), cnt: nc.length,
    ex: L.filter(function (o) { return o.st === '교환'; }).length, rt: L.filter(function (o) { return o.st === '반품'; }).length, cc: L.filter(function (o) { return o.st === '취소'; }).length,
    ded: sum(L, function (o) { return o.st === '반품'; }),
    ch: { '겐더샵': sum(nc, G), '셀렉트인 일반주문': sum(nc, function (o) { return S(o) && o.kind === '일반주문'; }), '셀렉트인 공동구매': sum(nc, function (o) { return S(o) && o.kind === '공동구매'; }) },
    gret: cl('반품', G), sret: cl('반품', S), gex: cl('교환', G), sex: cl('교환', S), ret: cl('반품'), exc: cl('교환'), sellprod: {}
  };
  R.net = R.tot - R.ded;
  var sp = {}; nc.forEach(function (o) { if (S(o) && o.kind === '공동구매' && o.seller) { sp[o.seller] = sp[o.seller] || {}; sp[o.seller][o.name] = (sp[o.seller][o.name] || 0) + o.amt; } });
  Object.keys(sp).forEach(function (k) { R.sellprod[k] = hubMcdTop_(sp[k], 3); });
  return R;
}
function hubMcdTop_(c, n) {
  return Object.keys(c).filter(function (k) { return c[k]; }).sort(function (a, b) { return c[b] - c[a] || (a < b ? -1 : a > b ? 1 : 0); }).slice(0, n);
}

/* ---- 템플릿 채우기 ---- */
function hubMcdResize_(sh, start, cur, want) {   // 목록 줄 수 맞춤 (목록 안쪽에 넣고/빼서 수식·차트 범위가 따라오게)
  want = Math.max(1, want); var lc = sh.getMaxColumns(), proto = cur >= 2 ? start + 1 : start;
  if (want > cur) { sh.insertRowsBefore(start + cur - 1, want - cur); if (proto >= start + cur - 1) proto += want - cur; sh.getRange(proto, 1, 1, lc).copyTo(sh.getRange(start + cur - 1, 1, want - cur, lc)); }
  else if (want < cur) sh.deleteRows(start + want, cur - want);
  return want;
}
function hubMcdCount_(sh, start, col, stop) {   // start부터 stop(값→true) 전까지 줄 수
  var v = sh.getRange(start, col, Math.max(1, sh.getMaxRows() - start + 1), 1).getValues(), n = 0;
  for (; n < v.length; n++) if (stop(v[n][0])) break;
  return n;
}
function hubMcdFind_(sh, col, test, from) {
  var v = sh.getRange(1, col, sh.getMaxRows(), 1).getValues();
  for (var i = (from || 1) - 1; i < v.length; i++) if (test(v[i][0])) return i + 1;
  return 0;
}
function hubMcdCol_(list, n) { var a = []; for (var i = 0; i < n; i++) a.push([i < list.length ? list[i] : '']); return a; }
function hubMcdMl_(ym) { return (+ym.slice(5)) + '월'; }

function hubMcdBuild_(ym, by) {
  var tz = 'Asia/Seoul', cfg = hubConfig_(), tpl = cfg[HUB_MCD.tpl] && cfg[HUB_MCD.tpl].value;
  if (!tpl) throw new Error('대시보드 템플릿이 등록되지 않았어요');
  var D = hubMcdLines_(ym), L = D.lines, R = hubMcdAgg_(L), hist = hubMcdHist_();
  var prevs = Object.keys(hist).filter(function (k) { return k < ym; }).sort().slice(-3);
  if (prevs.length < 3) throw new Error('비교용 이전 3개월 이력이 부족해요 (' + prevs.join(',') + ')');
  var months = prevs.concat([ym]), ML = months.map(hubMcdMl_);
  var p = ym.split('-'), nd = new Date(Date.UTC(+p[0], +p[1], 0)).getUTCDate(), period = ym + '-01 ~ ' + ym + '-' + ('0' + nd).slice(-2);
  var name = ym.replace('-', '') + '_겐더샵_셀렉트인_매출대시보드';
  var file = DriveApp.getFileById(tpl).makeCopy(name, hubMcdFolder_()), ss = SpreadsheetApp.openById(file.getId());
  ss.setSpreadsheetTimeZone(tz);
  var day = function (s) { return Utilities.parseDate(s, tz, 'yyyy-MM-dd'); };
  var days = []; for (var k = 1; k <= nd; k++) days.push(day(ym + '-' + ('0' + k).slice(-2)));
  var sh = function (n) { var s = ss.getSheetByName(n); if (!s) throw new Error('템플릿에 ' + n + ' 시트가 없어요'); return s; };

  // 템플릿이 가진 달 (비교 라벨 치환용)
  var mon = sh('월별매출'), oldM = mon.getRange(5, 1, 4, 1).getValues().map(function (r) { return hubMcdYmOf_(r[0]); });
  var lmap = {}; oldM.forEach(function (m, i) { lmap[hubMcdMl_(m)] = ML[i]; });

  // 1) RAW
  var raw = sh('RAW데이터'), cur = hubMcdCount_(raw, 2, 1, function (v) { return v === '' || v === null; });
  var n = hubMcdResize_(raw, 2, cur, L.length);
  if (L.length) {
    raw.getRange(2, 1, L.length, 13).setValues(L.map(function (o, i) { var dt = day(o.d); return [i + 1, dt, dt, o.shop, o.corp, o.name, o.opt, o.cost || 0, o.qty, o.amt, o.st === '교환' ? 'Y' : '', o.st === '반품' ? 'Y' : '', o.st === '취소' ? 'Y' : '']; }));
    raw.getRange(2, 14, L.length, 1).setFormulaR1C1('=IF(R[0]C[-1]="Y","취소",IF(R[0]C[-2]="Y","반품",IF(R[0]C[-3]="Y","교환","정상구매")))');
    raw.getRange(2, 15, L.length, 2).setValues(L.map(function (o) { return [o.kind, o.seller]; }));
  }
  raw.getRange(n + 3, 1).setValue('※ 데이터 출처: (1) ' + D.src.sbn + ' — 주문일 기준, 원주문 행만 사용(반품회수·교환발송 등 재생성 행 제외) · 겐더샵 전체 채널 + 셀렉트인 스마트스토어 외 채널 + 셀렉트인 스마트스토어의 취소·반품·교환 건 ' +
    '(2) ' + D.src.nv + ' — 셀렉트인 스마트스토어 결제완료 주문(상품·일자별, 건수만큼 행 분할) (3) ' + (D.src.ops || '') + ' — 크림·포이즌·도소매 등은 매출판 일별입력(OPS 월마감과 같은 원본) 일자·채널 합계를 건수만큼 행 분할 · 법인은 OPS 설정(쇼핑몰ID→법인) 기준 (4) 주문구분: 셀렉트인 상품명이 "셀러명 X 제품명" 형식이면 공동구매(셀러명=X 앞부분), 그 외 일반주문 · 생성 ' + hubNow_() + ' OPS 월마감');

  // 2) 기간 문구
  ss.getSheets().forEach(function (s) { s.createTextFinder('\\d{4}-\\d{2}-01 ~ \\d{4}-\\d{2}-\\d{2}').useRegularExpression(true).replaceAllWith(period); });

  // 3) 통합
  var t = sh('통합대시보드');
  t.getRange('C29:C33').setValues(hubMcdCol_(hubMcdTop_(R.shops, 5), 5));
  t.getRange('I29:I33').setValues(hubMcdCol_(hubMcdTop_(R.gprod, 5), 5));
  t.getRange('M29:M33').setValues(hubMcdCol_(hubMcdTop_(R.sprod, 5), 5));

  // 4) 법인 대시보드
  [['겐더샵대시보드', 'g'], ['셀렉트인대시보드', 's']].forEach(function (x) {
    var s = sh(x[0]), key = x[1];
    s.getRange(15, 2, 31, 1).setValues(hubMcdCol_(days, 31));
    if (nd < 31) s.getRange(15 + nd, 2, 31 - nd, 2).clearContent();
    else s.getRange(44, 3).copyTo(s.getRange(45, 3));
    s.getRange('C49:C53').setValues(hubMcdCol_(hubMcdTop_(R[key + 'shops'], 5), 5));
    s.getRange('I49:I58').setValues(hubMcdCol_(hubMcdTop_(R[key + 'prod'], 10), 10));
    var isNum = function (v) { return typeof v !== 'number'; };
    // 반품 TOP
    var rl = hubMcdTop_(R[key + 'ret'], 10), c0 = hubMcdCount_(s, 75, 2, isNum), w = hubMcdResize_(s, 75, c0, rl.length);
    s.getRange(75, 2, w, 2).setValues(rl.length ? rl.map(function (nm, i) { return [i + 1, nm]; }) : [['', '(해당 없음)']]);
    s.getRange(75, 5, w, 1).clearContent();
    s.getRange(75, 3, w, 2).setBackgrounds((rl.length ? rl : ['']).map(function (nm) { var b = (R[key + 'ret'][nm] || 0) >= 5 ? HUB_MCD.pink : '#ffffff'; return [b, b]; }));
    // 교환 TOP
    var er = hubMcdFind_(s, 2, function (v) { return /교환 TOP 10/.test(String(v)); }) + 2, el = hubMcdTop_(R[key + 'ex'], 10);
    if (er > 2) {
      var c1 = hubMcdCount_(s, er, 2, isNum), w1 = hubMcdResize_(s, er, Math.max(1, c1), el.length);
      s.getRange(er, 2, w1, 2).setValues(el.length ? el.map(function (nm, i) { return [i + 1, nm]; }) : [['', '(해당 없음)']]);
      s.getRange(er, 5, w1, 1).clearContent();
    }
    // 공동구매 셀러
    if (key === 's') {
      var hr = hubMcdFind_(s, 3, function (v) { return String(v) === '셀러명'; });
      if (hr) {
        var sl = hubMcdTop_(R.sellers, 60), c2 = hubMcdCount_(s, hr + 1, 3, function (v) { return String(v) === '합계'; }), w2 = hubMcdResize_(s, hr + 1, c2, sl.length);
        s.getRange(hr + 1, 2, w2, 2).setValues(sl.length ? sl.map(function (nm, i) { return [i + 1, nm]; }) : [['', '(없음)']]);
        s.getRange(hr + 1, 9, w2, 1).setValues(sl.length ? sl.map(function (nm) { return [(R.sellprod[nm] || []).join(' / ')]; }) : [['']]);
      }
    }
  });

  // 5) 날짜별
  var dd = sh('날짜별매출'), c3 = hubMcdCount_(dd, 5, 1, function (v) { return String(v) === '합계'; });
  hubMcdResize_(dd, 5, c3, nd); dd.getRange(5, 1, nd, 1).setValues(days.map(function (d) { return [d]; }));
  dd.getRange(5, 10, 1, 2).setValues([[0, 0]]);

  // 6) 쇼핑몰별
  var sm = sh('쇼핑몰별매출'), shl = hubMcdTop_(R.shops, 200), c4 = hubMcdCount_(sm, 5, 2, function (v) { return String(v) === '합계'; }), w4 = hubMcdResize_(sm, 5, c4, shl.length);
  sm.getRange(5, 1, w4, 2).setValues(shl.map(function (nm, i) { return [i + 1, nm]; }));
  sm.getRange(5, 8).setFormula('=G5');

  // 7) TOP상품
  var tp = sh('TOP상품');
  tp.getRange('B5:B24').setValues(hubMcdCol_(hubMcdTop_(R.gprod, 20), 20));
  tp.getRange('H5:H24').setValues(hubMcdCol_(hubMcdTop_(R.sprod, 20), 20));

  // 8) 월별매출 (이전 3개월 고정값 + 이번달 수식)
  prevs.forEach(function (m, i) {
    var h = hist[m], r = 5 + i;
    mon.getRange(r, 1, 1, 3).setValues([["'" + m, h.g, h.s]]);
    mon.getRange(r, 5, 1, 4).setValues([[h.cnt, h.ex, h.rt, h.cc]]);
    mon.getRange(r, 12, 1, 3).setValues([[h.net, h.ded, 'Source: ' + m.replace('-', '') + '_겐더샵_셀렉트인_매출대시보드.xlsx']]);
  });
  mon.getRange(8, 1).setValue("'" + ym);
  mon.getRange(2, 1).setValue('매출(취소제외) 기준 · ' + prevs.join('·') + '은 각 월 대시보드(OPS 월마감 이력) 인용 · ' + ym + '은 본 파일 RAW데이터 기준');

  // 9) 교환반품현황
  var xr = sh('교환반품현황');
  xr.getRange('B10:B19').setValues(hubMcdCol_(hubMcdTop_(R.exc, 10), 10));
  xr.getRange('F10:F19').setValues(hubMcdCol_(hubMcdTop_(R.ret, 10), 10));
  xr.getRange(24, 1, 4, 1).setValues(months.map(function (m) { return ["'" + m]; }));
  var xn = hubMcdFind_(xr, 1, function (v) { return /^※ 정상완료율/.test(String(v)); });
  if (xn) xr.getRange(xn, 1).setValue('※ 정상완료율 = 1-(교환율+반품율+취소율) · ' + prevs.join('·') + ' 수치는 각 월 대시보드 인용, ' + ym + '은 본 파일 RAW데이터 기준');

  // 10) 비교분석
  var cp = ss.getSheets().filter(function (s) { return /_비교분석$/.test(s.getName()); })[0];
  if (cp) {
    cp.setName(ML.join('vs') + '_비교분석');
    var rg = cp.getDataRange(), vals = rg.getValues(), fs = rg.getFormulas();
    for (var i = 0; i < vals.length; i++) for (var j = 0; j < vals[i].length; j++) {
      if (fs[i][j] || typeof vals[i][j] !== 'string' || !/\d월/.test(vals[i][j]) || /^※/.test(vals[i][j]) || i < 2) continue;
      var nv2 = vals[i][j].replace(/(\d{1,2})월/g, function (m0) { return lmap[m0] || m0; });
      if (nv2 !== vals[i][j]) cp.getRange(i + 1, j + 1).setValue(nv2);
    }
    cp.getRange(1, 1).setValue(ym.slice(0, 4) + '년 ' + ML.join(' · ') + ' 매출 비교 분석 대조표');
    cp.getRange(2, 1).setValue(ML.slice(0, 3).join('·') + ' 수치는 OPS 월마감(매출판 일별입력) 이력 · ' + ML[3] + ' 수치는 본 파일 RAW데이터 기준 · 매출은 취소제외(반품 포함) · 교환·반품·취소 건수는 사방넷 주문 기준');
    var colA = function () { return cp.getRange(1, 1, cp.getMaxRows(), 1).getValues().map(function (r) { return String(r[0]); }); };
    var A = colA(), s2 = A.indexOf('2. 채널별 매출 비교 (셀렉트인 일반주문·공동구매 분리)');
    if (s2 < 0) s2 = A.findIndex(function (v) { return /^2\./.test(v); });
    ['겐더샵', '셀렉트인 일반주문', '셀렉트인 공동구매'].forEach(function (lab, k) {
      cp.getRange(s2 + 3 + k, 2, 1, 3).setValues([prevs.map(function (m) { return (hist[m].ch || {})[lab] || 0; })]);
    });
    var s4 = A.findIndex(function (v) { return /^4\./.test(v); }) + 1, top10 = hubMcdTop_(R.shops, 10);   // 1-based 제목행
    var c4 = hubMcdCount_(cp, s4 + 2, 1, function (v) { return v === '' || v === null; }), w4b = hubMcdResize_(cp, s4 + 2, c4, top10.length);
    cp.getRange(s4 + 2, 1, w4b, 4).setValues(hubMcdCol_(top10, w4b).map(function (r) { return [r[0]].concat(prevs.map(function (m) { return r[0] ? ((hist[m].shops || {})[r[0]] || 0) : ''; })); }));
    A = colA();
    var s5 = A.findIndex(function (v) { return /^5\./.test(v); }) + 1, cur5 = hubMcdTop_(R.sellers, 100), rest = {};
    prevs.forEach(function (m) { Object.keys(hist[m].sellers || {}).forEach(function (k) { if (cur5.indexOf(k) < 0) rest[k] = (rest[k] || 0) + hist[m].sellers[k]; }); });
    var sel = cur5.concat(hubMcdTop_(rest, 100)), c5 = hubMcdCount_(cp, s5 + 2, 1, function (v) { return String(v) === '공동구매 합계'; }), w5 = hubMcdResize_(cp, s5 + 2, c5, sel.length);
    cp.getRange(s5 + 2, 1, w5, 4).setValues(sel.map(function (nm) { return [nm].concat(prevs.map(function (m) { return (hist[m].sellers || {})[nm] || 0; })); }));
    var An = hubMcdFind_(cp, 1, function (v) { return /^※/.test(String(v)); }, s5 + 2);
    if (An) cp.getRange(An, 1).setValue('※ ' + ML.slice(0, 3).join('·') + ' 채널·쇼핑몰·셀러별 값은 각 월 마감 데이터에서 해당 월 주문만 집계(취소 제외)한 고정값 · ' + ML[3] +
      '은 OPS 월마감 데이터(사방넷 + 네이버 커머스API) 기준 · 공동구매/일반주문 구분 규칙(상품명 "셀러명 X 제품명") 동일 적용 · 증감률 "-"는 비교월 매출이 0인 경우');
  }
  var chartErr = ''; try { hubMcdCharts_(ss, nd, shl.length); } catch (e) { chartErr = String(e.message || e); }
  SpreadsheetApp.flush();

  // 이력 저장 (다음 달 비교용)
  hubMcdHistPut_(ym, { g: R.g, s: R.s, tot: R.tot, cnt: R.cnt, ex: R.ex, rt: R.rt, cc: R.cc, net: R.net, ded: R.ded, ch: R.ch, shops: R.shops, sellers: R.sellers }, by);
  var resp = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('대시보드 엑셀 내보내기 실패 ' + resp.getResponseCode());
  return { blob: resp.getBlob().setName(name + '.xlsx'), url: ss.getUrl(), id: ss.getId(), sum: { tot: R.tot, g: R.g, s: R.s, cnt: R.cnt, ex: R.ex, rt: R.rt, cc: R.cc, net: R.net, lines: L.length, src: D.src, chartErr: chartErr } };
}
/** 차트: 엑셀→구글시트 변환 때 빠지는 경우가 있어 매번 다시 그림 (담당자 양식과 같은 위치·제목) */
function hubMcdCharts_(ss, nd, ns) {
  var W = 570, H = 285;
  var put = function (name, type, ranges, row, col, title, heads, opt) {
    var sh = ss.getSheetByName(name); if (!sh) return;
    var b = sh.newChart().setChartType(type).setPosition(row, col, 0, 0).setOption('title', title).setOption('width', W).setOption('height', H).setNumHeaders(heads || 0);
    ranges.forEach(function (r) { b.addRange(sh.getRange(r)); });
    Object.keys(opt || {}).forEach(function (k) { b.setOption(k, opt[k]); });
    sh.insertChart(b.build());
  };
  ss.getSheets().forEach(function (sh) { sh.getCharts().forEach(function (c) { sh.removeChart(c); }); });
  var C = Charts.ChartType, noLeg = { legend: { position: 'none' } };
  put('통합대시보드', C.PIE, ['B15:C17'], 13, 6, '채널별 매출 비중', 0, { legend: { position: 'right' } });
  put('통합대시보드', C.COLUMN, ['B38:B41', 'D38:D41'], 36, 12, '주문 상태별 매출금액', 0, noLeg);
  [['겐더샵대시보드', '겐더샵'], ['셀렉트인대시보드', '셀렉트인']].forEach(function (x) {
    put(x[0], C.LINE, ['B15:B' + (14 + nd), 'C15:C' + (14 + nd)], 12, 5, x[1] + ' 일자별 매출 추이', 0, noLeg);
    put(x[0], C.COLUMN, ['B63:B66', 'D63:D66'], 60, 8, x[1] + ' 상태별 매출금액', 0, noLeg);
  });
  put('날짜별매출', C.LINE, ['A4:A' + (4 + nd), 'B4:C' + (4 + nd)], 5 + nd + 3, 1, '일자별 매출 추이 (겐더샵 vs 셀렉트인)', 1, { legend: { position: 'right' } });
  put('쇼핑몰별매출', C.COLUMN, ['B5:B' + (4 + Math.min(10, ns)), 'E5:E' + (4 + Math.min(10, ns))], 5 + ns + 2, 1, '쇼핑몰별 매출 (TOP 10)', 0, noLeg);
  put('월별매출', C.COLUMN, ['A4:A8', 'B4:C8'], 11, 1, '월별 매출 (채널별)', 1, { legend: { position: 'right' } });
}
/** 지난 달 비교 이력을 OPS 월마감(매출판 일별입력) 기준으로 다시 계산 — 교환·반품·취소 건수와 공구 셀러는 기존 값 유지(OPS에 없음) */
function hubMcdHistFromOps_(ym, by) {
  var rep = hubMonthCloseBuild_(ym, { rows: true, noApi: true }), old = hubMcdHist_()[ym] || {}, h = { g: 0, s: 0, tot: 0, cnt: 0, ch: { '겐더샵': 0, '셀렉트인 일반주문': 0, '셀렉트인 공동구매': 0 }, shops: {} };
  (rep.rows || []).forEach(function (r) {
    if (r.corp !== '겐더샵' && r.corp !== '셀렉트인') return;
    var shop = r.grp === '사방넷' ? (r.mall || r.pf) : r.grp === '스마트스토어' ? '스마트스토어' : (r.pf || r.grp);
    h.tot += r.amt; h.cnt += r.cnt; h.shops[shop] = (h.shops[shop] || 0) + r.amt;
    if (r.corp === '겐더샵') { h.g += r.amt; h.ch['겐더샵'] += r.amt; }
    else { h.s += r.amt; h.ch[(r.grp === '공동구매' || /공구/.test(r.pf) || /공구/.test(r.mall)) ? '셀렉트인 공동구매' : '셀렉트인 일반주문'] += r.amt; }
  });
  h.ex = old.ex || 0; h.rt = old.rt || 0; h.cc = old.cc || 0; h.ded = old.ded || 0; h.net = h.tot - h.ded; h.sellers = old.sellers || {};
  hubMcdHistPut_(ym, h, by);
  return { ym: ym, tot: h.tot, g: h.g, s: h.s, cnt: h.cnt, ch: h.ch };
}
/** 이력 직접 넣기 (지난 달 담당자 파일 값) */
function hubMcdHistSet_(rows, me) {
  (rows || []).forEach(function (h) { if (/^\d{4}-\d{2}$/.test(String(h.ym))) hubMcdHistPut_(h.ym, h, me && me.name); });
  return { ok: true, hist: Object.keys(hubMcdHist_()) };
}

/* ===================== 인스타그램 공구 영업 =====================
 * 공동구매 일정 시트 「일정」 탭(읽기 전용) + OPS DB 탭(인스타DM·인스타발굴·인스타상품·인스타템플릿)
 *  - 일정: A 년/월 · B 시작-종료 · C 확정구분 · D 진행구분 · E 벤더사 · F 제목 · G 셀러 · H 링크 · I 브랜드 · J 통수수료 · K 셀러수수료 · Q 매출 · AC 셀렉트인 최종 매출(관리자만)
 *  - 인스타발굴·인스타상품은 아래 HUB_IG_SEED_ 버전이 바뀌면 다시 채움(시트에서 직접 고쳐도 됨, 다음 시드 갱신 전까지 유지)
 *  - DM은 인스타그램 정책상 자동 전송하지 않음: 화면에서 문구 복사 + 대화창 열기 → 직원이 붙여넣고 전송 → 기록 */
var HUB_IG_SEED_ = {"ver": "2026-11-04c", "pros": [["mim.choi._", "52만 7천", 527000, "뷰티디바이스/뷰티", "릴릴", "영업시트", "N"], ["supermom_sujin", "49만", 490000, "뷰티디바이스/뷰티", "글로우엠(뷰티디바이스)", "영업시트", "N"], ["____uzaa", "45만 4천", 454000, "미분류(오두스)", "오두스", "영업시트", "N"], ["yooyoi", "4만 1천", 41000, "리빙/수납/생활잡화/세제·탈취", "셀룰라·JBJ 세탁바구니·보로탈코", "진행셀러/일정", "N"], ["1min.diet", "40만 4천", 404000, "건강기능식품·헬스케어", "비타슈넬 이노시톨 외 2종", "영업시트", "N"], ["u.b1n", "37만 3천", 373000, "미분류(오두스)", "오두스", "영업시트", "N"], ["thanks_kim", "34만 4천", 344000, "미분류(오두스)", "오두스", "영업시트", "N"], ["he1.da", "33만 2천", 332000, "미분류(오두스)", "오두스", "영업시트", "N"], ["darimi_unni", "31만 1천", 311000, "생활잡화/세제·탈취/주방/식품", "클라세제 / 도산회관", "셀러영업(지희)", "N"], ["lovejina12", "33만 7천", 337000, "뷰티디바이스/뷰티", "글로우엠(뷰티디바이스)", "영업시트", "N"], ["goonyyeonee", "23만 9천", 239000, "생활잡화/세제·탈취", "픽싯 탈취제", "셀러영업(지희)", "N"], ["euun_kyung_", "25만 6천", 256000, "생활잡화/세제·탈취", "픽싯(아이엔오) — 취소", "일정", "N"], ["he11o_yeojin", "24만 7천", 247000, "뷰티디바이스/뷰티/소형가전", "데코아르 드라이기", "영업시트", "N"], ["roco_house_", "27만 9천", 279000, "미분류(오두스)", "오두스", "영업시트", "N"], ["mangdoo_noona", "23만 4천", 234000, "건강기능식품·헬스케어/리빙/수납/소형가전/육아(키즈슈즈)/주방/식품", "관심: 식품·건강·뷰티·가전·침구·육아", "셀러영업(지희)", "N"], ["sunhawww", "22만", 220000, "리빙/수납/주방/식품", "도산회관 / JBJ 세탁바구니", "영업시트", "N"], ["jibbab_doumi", "21만 3천", 213000, "주방/식품", "올리브오일", "영업시트", "N"], ["kaone815", "21만 9천", 219000, "육아(키즈슈즈)", "바크(키즈슈즈)", "영업시트", "N"], ["hyoil.kim1", "19만 5천", 195000, "생활잡화/세제·탈취", "픽싯 탈취제", "셀러영업(지희)", "N"], ["sso__ne", "15만 7천", 157000, "육아(키즈슈즈)", "바크(키즈슈즈)", "영업시트", "N"], ["baristayomi", "16만 9천", 169000, "리빙/수납/주방/식품", "도산회관 / JBJ 세탁바구니", "영업시트", "N"], ["cherry_ajung", "17만 8천", 178000, "생활잡화/세제·탈취", "딜라이드 샤워타올·보로탈코(예정)", "진행셀러/일정", "N"], ["sallimplus", "18만 1천", 181000, "생활잡화/세제·탈취", "클라세제", "영업시트", "N"], ["chouchoubelle._", "16만 4천", 164000, "육아(키즈슈즈)", "바크(키즈슈즈)", "영업시트", "N"], ["du_ri_nee", "15만", 150000, "생활잡화/세제·탈취", "클라세제", "셀러영업(지희)", "N"], ["amming_j", "15만 1천", 151000, "미분류(오두스)", "오두스", "영업시트", "N"], ["maison_de_blah", "14만 4천", 144000, "주방/식품", "올리브오일", "영업시트", "N"], ["bbu___", "14만 5천", 145000, "건강기능식품·헬스케어/주방/식품", "관심: 건강/뷰티·생활·식품", "셀러영업(지희)", "N"], ["day_momtable", "14만 1천", 141000, "주방/식품", "도산회관", "셀러영업(지희)", "N"], ["haumjie", "13만 7천", 137000, "뷰티디바이스/뷰티/소형가전", "데코아르 드라이기", "영업시트", "N"], ["linakeemz", "13만 1천", 131000, "미분류(오두스)", "오두스", "영업시트", "N"], ["shj0154", "12만 5천", 125000, "생활잡화/세제·탈취", "클라세제", "셀러영업(지희)", "N"], ["__a.fit.__", "12만 8천", 128000, "운동/요가", "만두카 요가매트", "영업시트", "N"], ["mommyland_kr", "13만 5천", 135000, "육아(키즈슈즈)", "바크(키즈슈즈)", "영업시트", "N"], ["hellochaeyeon", "12만 2천", 122000, "소형가전", "스텐팟 가열식 가습기", "셀러영업(지희)", "N"], ["nari_table_", "11만 6천", 116000, "주방/식품", "올리브오일", "영업시트", "N"], ["bomjubu_sarlim", "10만 8천", 108000, "생활잡화/세제·탈취", "클라세제", "셀러영업(지희)", "N"], ["voyantte__", "10만 1천", 101000, "미분류(오두스)", "오두스", "영업시트", "N"], ["real__siri", "10만 1천", 101000, "건강기능식품·헬스케어/뷰티디바이스/뷰티/소형가전/육아(키즈슈즈)/주방/식품", "뉴트리원 칼마디·이네브 압박스타킹·시노링크·바디프랜드 두피기·도산회관·바크", "진행셀러/일정", "N"], ["___e.you", "9만 7천", 97000, "육아(키즈슈즈)", "바크(키즈슈즈)", "영업시트", "N"], ["boa.mom_", "9만 3천", 93000, "주방/식품", "도산회관", "영업시트", "N"], ["home_taya", "10만 9천", 109000, "운동/요가", "만두카 요가매트", "영업시트", "N"], ["y__blanc", "8만", 80000, "주방/식품", "올리브오일", "영업시트", "N"]], "cats": [["주방/식품", 13, "도산회관(주먹밥) · 올리브오일 · 상국이네 · 경자국밥", "darimi_unni|29.8만|N, mangdoo_noona|23.5만|N, sunhawww|22.1만|N, jibbab_doumi|20.8만|N, baristayomi|17만|N, maison_de_blah|14.7만|N", "도산회관 759만·863만, 상국이네 415만·212만 / 경자국밥 11월 예정"], ["생활잡화/세제·탈취", 11, "픽싯 탈취제 · 보로탈코 · 클라세제 · 셀룰라 · 딜라이드 샤워타올 · 트리오리지널세제", "yooyoi|41만|N, darimi_unni|29.8만|N, goonyyeonee|25.7만|N, euun_kyung_|25.7만|N, hyoil.kim1|19.5만|N, cherry_ajung|17만|N", "픽싯 1차 3,218만·2차 5,387만, 보로탈코 2,904만·1,524만·1,092만, 셀룰라 918만"], ["육아(키즈슈즈)", 8, "바크", "mangdoo_noona|23.5만|N, kaone815|20.7만|N, sso__ne|17.4만|N, chouchoubelle._|15.4만|N, smallmini_3j|10.8만|Y, mommyland_kr|11.5만|N", ""], ["미분류(오두스)", 8, "오두스(카테고리 미확인)", "____uzaa|44.6만|N, u.b1n|38.5만|N, thanks_kim|35.2만|N, he1.da|32.3만|N, roco_house_|24.1만|N, amming_j|14.8만|N", ""], ["뷰티디바이스/뷰티", 6, "글로우엠 · 릴릴 · 데코아르 드라이기 · 뉴메이슨 고데기 · 바디프랜드 두피기", "mim.choi._|50.1만|N, supermom_sujin|49만|N, lovejina12|28.3만|N, he11o_yeojin|24.5만|N, haumjie|13.6만|N, real__siri|9.9만|N", ""], ["소형가전", 5, "스텐팟 가열식 가습기 · 에디르 가습기 · 데코아르 드라이기 · 바디프랜드 두피기", "he11o_yeojin|24.5만|N, mangdoo_noona|23.5만|N, haumjie|13.6만|N, hellochaeyeon|11.5만|N, real__siri|9.9만|N", "뉴메이슨 고데기 1,460만, 에디르 가습기 521만·386만"], ["리빙/수납", 4, "JBJ 세탁바구니", "yooyoi|41만|N, mangdoo_noona|23.5만|N, sunhawww|22.1만|N, baristayomi|17만|N", "JBJ 세탁바구니 1,889만·1,857만·934만"], ["건강기능식품·헬스케어", 4, "뉴트리원 칼마디 · 비타슈넬 이노시톨 · 시노링크 · 이네브 압박스타킹", "1min.diet|40만|N, mangdoo_noona|23.5만|N, bbu___|14.5만|N, real__siri|9.9만|N", "시노링크·칼마디 소규모(수량 8~14)"], ["운동/요가", 2, "만두카 요가매트", "__a.fit.__|12.3만|N, home_taya|8.6만|N", ""]], "prods": [["JBJ 스테인리스", "리빙·주방", 150, "세탁바구니·식기건조대·주방 블럭선반·수납", "매출 2천만원 이상", "리빙·집꾸미기 셀러", "진행가능", "본사링크 필수 · 셀러별 샘플 1세트 무상 · 당일/익일 출고", "https://app.notion.com/3c7a6a91d31b8108b193d12656b124eb", 46803900, "제이비제이(JBJ) 리빙 수납 라인. 대표 상품: 메종드 세탁바구니 3단 151L(정상가 369,000원→공구가 215,000원, 41.7%↓), 리비에르 틈새 세탁바구니 2~4단(47·65·83L), 청담 세탁바구니 2~4단, 올인원 세탁바구니(A·B타입/풀세트 138L), 올인원·루미너스·새틴 식기건조대, 올라 싱크볼 식기건조대, 모딕 적층형 수납 트레이, 후라이팬 정리대·블럭선반. 조건: 인플 수수료 10%, 제안허들 매출 2천만원 이상, 샘플 셀러별 1세트 무상(올스텐 수저통 제외), 결제창 셀렉트인, 대한통운 당일·익일 출고(대전), 대부분 무료배송(블럭선반 3,000원, 2개 이상 무료). 타겟: 리빙·집꾸미기 셀러. 주의: 추가옵션은 단독구매 불가(합포장만), 수저통 최대 2개, 일부 세탁바구니 바퀴 별도구매, 품절 시 마감 후 3~5일 뒤 일괄 출고."], ["데코아르", "리빙·소형가전", 54, "가열식 가습기·전기 오방난로·무선 초퍼·쌀통·에어건·텀블러", "가격비교 노출 금지 · 일정 사전협의 · 가이드가 이하 판매 불가", "리빙·살림 셀러", "진행가능", "겨울 시즌: 가습기·난로·워머 우선", "https://app.notion.com/3c7a6a91d31b8125b527ffa32ef48fb8", 0, "티케이커머스의 데코아르(멜로우·블룸·모멘텀 라인) 생활가전·소품. 대표 상품: 멜로우 비비드 가열식 가습기 2L, 블룸 물멍 스텐304 가열식 가습기, 데코아르x르젠 UV 초슬림 제습기, 멜로우 파워윈드 에어건 프로, 무선 틈새 2in1 멀티청소기, 멜로우 플라즈마 BLDC 미니 드라이기, 모멘텀 무드등 전기 오방난로, 자동센서 스마트 휴지통 20L, 컬러무드 900ml 텀블러 등. 대부분 다양한 파스텔 컬러 옵션. 판매링크는 데코아르 스마트스토어/자사몰 상품 링크. 공구가는 노션 속성에 없음(가격제안서 파일 첨부). 주의: 가격비교 노출 절대 불가, 일정 미협의 진행 시 공급 불가, 비노출 가이드 판매가보다 저렴하게 판매 불가."], ["픽싯", "생활·탈취", 7, "룸데오도란트 탈취제·퍼퓸 세정 롤티슈", "예상매출 1억 이상", "청소 니즈 강한 셀러, 콘텐츠력 좋은 셀러", "내부협의필요", "본사링크(PG 벤더부담) · 제품별 샘플 1개", "https://app.notion.com/3c7a6a91d31b810fb0c7d561475aef08", 93636800, "아이엔오 픽싯 룸데오도란트(젤 타입 탈취제) — 향으로 덮지 않고 악취 원인을 흡착·제거, 은은한 머스크 향, 470g 대용량. 공구가: 머스크/히노끼 470g 1개 38,000→26,900원, 2개 50,900원, 5개 119,900원 / 제로 230g 2개 28,900원 / 퍼퓸 세정 롤티슈 200매 2개 25,900원 / 470g 2종 50,900원 / 스타터 세트 96,000→64,900원. 배송비 3,000원(4만원 이상 무료), 제주 4,000·도서산간 5,000원. 조건: 제안허들 1억 이상, 판매링크 본사(PG 벤더부담), 샘플 최초 1회 제품별 1개 무상. 타겟: 청소 니즈 강한 분, 콘텐츠력 좋은 셀러(화장실·현관·반려동물 공간). 상태: 내부협의필요."], ["보로탈코 (신밧드컴퍼니)", "생활·바디", 1, "보로탈코 바디·롤온", "-", "살림·뷰티 셀러", "진행중", "11~12월 일정 다수 확정", "https://app.notion.com/p/91995ae8a79140d181e71e180c7e0e70", 59429500, "노션 자료 없음"], ["디어커스", "생활잡화", 11, "누볼라 욕실화(성인·키즈)", "-", "생활리빙·잡화 셀러", "진행가능", "", "https://app.notion.com/3c9a6a91d31b8100ab0cdd2a9ba921ca", 3841000, "디어커스 생활잡화. 상품: 퓨메노·누볼라 욕실화(성인 260/280mm, 키즈 170~230mm), 처마 싱크대 물막이(화이트 공구 전용 컬러), 온더꼬끄 퍼즐 매트 6p(얼그레이 공구 전용 컬러), 팝콘 플리츠백(1·2세트, 브레드이발소 콜라보), 뱀부500 미용티슈 150장 6box·두루마리휴지 3겹 30롤, 뱀부 프리미엄 키친타월 3겹 4롤. 조건: 디어커스 링크 사용(PG 디어커스 부담), 샘플 협의. 타겟: 생활리빙·잡화 셀러. 공구가는 노션 속성에 없음(가격제안서 파일 첨부)."], ["도산회관", "식품", 1, "한우 주먹밥 (오리지널·고추장)", "매출 1천만원 이상 · 팔로워 3만 이상", "육아맘, 간편식 수요", "진행가능", "판매링크 자율", "https://app.notion.com/3c7a6a91d31b806b8ecefe684fbe7a06", 21190162, "프리미엄 한우 다이닝 도산회관의 시그니처 한우 소보로 주먹밥(오리지널맛/고추장맛). 100% 한우+국내산 쌀, 전자레인지 약 2분, 100g 개별 포장 — 아침·아이 간식·점심·야식용. 핵심 키워드: 100% 한우·국내산 쌀·맛집 시그니처·전자레인지 2분. 조건: 제안허들 매출 1천만원 이상/팔로워 3만 이상, 판매링크 자율, 샘플 제안 시 종류별 1개·최종 픽스 후 진행 전 1개. 타겟: 육아맘, 간단·건강한 한 끼 원하는 분. 공구가는 노션 본문에 없음(가격표 파일 첨부)."], ["경자국밥", "식품", 1, "냉동 국밥 3종 + 육수", "-", "육아맘·살림", "진행가능", "사전 샘플 제공 가능", "https://app.notion.com/40da6a91d31b8048b4c6ced9fb1f77dd", 0, "경자국밥 냉동 국밥 공구(공급사 셀렉트인). 공구가: 돼지국밥 세트 10,000→6,900원(31%), 순대국밥 세트 10,000→6,900원(31%), 살코기국밥 세트 11,000→7,900원(약 28%), 육수 단품 4,000→2,800원(30%), VAT 포함. 배송: 롯데택배, 기본 3,500원, 8세트 이상 무료, 대전 출고, 오전 9시 마감 당일 출고, 제주·도서산간 발송 불가, 교환/단순변심 반품비 7,000원. 결제처 셀렉트인, 재고 일 1,000봉 이상, 샘플 종류별 1팩 무료. 타겟: 바쁜 직장인·자취생·가족 식사. 상세 중량·원재료·소비기한은 추후 안내."], ["비타슈넬·비비랩 (뉴트리원)", "건강기능식품", 6, "건강기능식품 3종, 올레샷", "매출 3천만원 이상", "임신준비·다이어터·자기관리", "진행가능", "", "https://app.notion.com/3caa6a91d31b8140b2f8dd4ab657dc6d", 566500, "뉴트리원 건강기능식품. 비타슈넬 3종: 이노시톨콜린&엽산(여성 데일리 밸런스, 20~40대 여성·임신준비), 바이탈업 에너지 부스터(활력, 육아맘·직장인), 칼마디 K 투엑스 PGA(칼슘·마그네슘·비타민D/K 뼈 건강, 자몽&오렌지맛 타먹는 타입, 부모님·중장년). 모두 하루 한 포 스틱형. 비비랩 올레샷·올토샷(핵심 한줄 '마시는 위고비', 자기관리·뷰티·헬시 타겟, 2~18박스 구성). 조건: 제안허들 3천만원 이상, 판매링크 본사링크/벤더링크 가능, 샘플 최초 1회 무상. 공구가는 노션 속성에 없음(제안서 파일 첨부)."], ["더존 베트남 쌀국수", "식품", 1, "저칼로리 소고기 쌀국수", "-", "육아맘, 직장인", "검토", "", "https://app.notion.com/3c7a6a91d31b80d986c2ca107cde04c1", 0, "더존 베트남 소고기 쌀국수. 60년 전통 제면 기술로 쉽게 불지 않는 면, 베트남 프리미엄 ST25 쌀 사용(쌀 90.28%), 한 봉 210kcal·나트륨 1,000mg, 조리 4분. 기본 파우더에 고수 없음(취향 따라 추가), 향미유 조절 가능. 타겟: 육아맘·직장인·자취생, 간편식 쟁여두는 분, 고수 때문에 쌀국수 꺼리던 분. 제안서는 20/40/80봉 구성 파일 첨부. 공구가·수수료·샘플 조건은 노션에 없음."], ["머즈·키머즈", "여행·육아", 7, "캐리어·보스턴백·롤링카트·올인원 맘마포트", "팔로워 2만+ · 릴스뷰 1만+ 꾸준", "여행·육아 셀러", "검토", "", "https://app.notion.com/40da6a91d31b8058bd54ff13d5858ec8", 0, "머즈 여행가방·키머즈 육아용품. 머즈 루미 유광 캐리어: 독일 바이엘 PC 100%, 히노모토 저소음 더블휠, TSA 잠금, 7:3 트렁크 수납, 5개 내부 포켓 / 공구가 20인치 169,000→145,000원, 26인치 199,000→169,000원, 28인치 209,000→179,000원, 컬러 5종. 조건: 셀러 제한 없음, 전체 마진율 30%(VAT 포함), 무료배송(제주·도서산간 +3,000원), 교환·반품 왕복 12,000원, CJ대한통운, 발주마감 14:30. 그 외 파일럿 캐리어(상단 오픈)·보스턴백·머즈 롤링카트. 키머즈 올인원 맘마포트(분유+이유식포트+배터리+C타입) 공구가 115,000원, 수수료 23%, 허들 팔로워 2만·릴스뷰 1만 이상(쉘위고 캐리어 동일)."], ["스테나·스텐팟·에디르 가습기", "소형가전(시즌)", 3, "가열식·복합식 가습기", "-", "육아·살림·리빙 중대형 셀러(100개+)", "검토", "겨울 시즌 상품", "https://app.notion.com/3d7a6a91d31b80c3b7cee4381e3d9495", 9078000, "겨울 시즌 가습기 라인. 스테나 밀크팟 가열식 가습기 STENA200: 온라인 최저가 198,000원 대비 공구가 158,000원(약 4만원 차이), 아이방·침실 가습, 육아·살림·리빙 셀러 중 100개 이상 판매 가능한 중대형 셀러 위주. 스테나 아키텍 STN100A: 프리미엄 고단가 가열식. 스텐팟 프리미엄 가열식: 6L 대용량·35dB 저소음·분리세척. 에디르 대용량 복합식 가습기 프로: 15L 수조, 최대 1,300cc 가습량, 거실·사무실용(먼지보호커버·이동식 바퀴·리모컨 등 구성). 타겟: 육아맘·신혼·30~40대 여성. 수수료·샘플 조건은 노션에 없음."], ["CLA 클라 세탁케어", "생활리빙", 1, "세탁케어", "-", "임산부·육아맘·다인가구", "검토", "", "https://app.notion.com/3d5a6a91d31b807fb142f0542d0e7d4f", 0, "클라(CLA) 캡슐형 세탁케어. 공통: 국내 제조 100%, 프랑스 조향사 향, 세계 아토피협회 인증 테스트, 유해물질 14종·성조숙증 관련 5대 성분 불검출, 독일 더마테스트, EWG 그린등급, 비건 테스트. 공구가: 퍼퓸 리필팩 150개 29,900원 / 패밀리 풀케어 세트(본품+리필 170개+미니 100개+섬유유연제 1L) 38,500원 / 컬러 케어 세트 170개 38,900원 / 퍼퓸 케어 세트 170개 38,900원 / 베이비앤키즈 150개 23,500원. 타겟: 임산부·출산준비·영유아 육아맘·워킹맘·3~5인 가구·살림 인플루언서. 주의: 인증·불검출은 정확한 인증 범위 내에서 표현. 수수료·샘플 조건은 노션에 없음."], ["뷰티기기 (레스노베·유라이크·인셀라·케어클)", "뷰티기기", 4, "하이퍼샷·제모기·큐티프로·고주파 마사지기", "-", "뷰티 인플루언서, 워킹맘", "검토", "", "https://app.notion.com/3cea6a91d31b80949f68ffcbcb832f9a", 0, "홈케어 뷰티 디바이스(레스노베·인셀라는 솔레미랩). 레스노베 하이퍼샷: 앰플 흡수·두피 탄력·릴렉싱 마사지, 하루 5분 두피 홈케어. 인셀라 큐티프로: EMS 바디 홈케어, 본품+전용 바디패치 구성. 유라이크 제모기: 강력한 제모 에너지+사파이어 쿨링 홈 제모기. 케어클 CLB 고주파 마사지기: RF 고주파+레드 LED, 얼굴·목 관리, 페이스/아이 전용 헤드, 전용 콜라겐 젤 루틴 — '피부과 갈 시간 없는 육아맘·워킹맘의 탄력 홈케어'. 타겟: 뷰티 인플루언서, 30~50대 육아맘·워킹맘. 공구가·수수료·샘플 조건은 노션에 없음(케어클 제안서 파일 첨부)."], ["만두카 요가매트", "운동", 1, "프로 / 프로라이트", "-", "운동·자기관리", "검토", "", "https://app.notion.com/401a6a91d31b80d29020ffdd4ade1c7c", 0, "프리미엄 요가 브랜드 만두카(MANDUKA). PRO 6mm(180×66cm, 약 3.4kg, 고밀도 쿠셔닝·안정감, 홈 수련용), PROlite 4.7mm(180×61cm, 약 2.1kg, 요가원 이동용). 공통: 밀폐형 표면(수분 흡수↓), 독일 제조, OEKO-TEX STANDARD 100 인증, 뛰어난 내구성, 요가 강사·스튜디오 사용 브랜드. 타겟: 요가·필라테스·홈트 인플루언서, 20~40대 운동 고객. 조건: 공구가·셀러 수수료 협의 후 확정, 컬러·수량 재고 확인 후 확정, 샘플 협의, 배송·정산 별도 협의."], ["랩소 (LAPXO)", "생활잡화", 2, "만능 틈새브러시 7,900원", "-", "살림 셀러", "검토", "저단가 추가구성용", "https://app.notion.com/3ffa6a91d31b80eda1dcdd6de70a6c9b", 0, "LAPXO 욕실 청소용품(스타터킷: 핸들+거치대+부착 스티커+리필 24개, 리필 교체형). 공구가: 스타터킷1+리필24(총 48) 32,900→17,900원 / 스타터킷2+리필48(총 96) 65,800→33,000원 / 리필 48개 15,000원 / 리필 72개 21,000원 / 리필 96개 26,000원(최대 50%↓). 주 1회 기준 최대 24개월 분량. 조건: 셀러 수수료 판매가의 30%, 전 상품 무료배송(제주 +3,000·도서산간 +5,000원), CJ대한통운, 주문 마감 12시·송장 16시, 샘플 협의, 정산 행사 종료 후 15일 현금. 반품: 미개봉 단순변심만, 왕복 8,000원. 타겟: 살림·리빙 셀러, 신혼·자취생. 만능 틈새브러시도 있음."], ["잔스포츠", "패션잡화", 1, "드로우색·하프파인트·슈퍼브레이크", "-", "육아맘, 헬스", "진행가능", "셀렉트인 링크 · 샘플 공급가 구매", "https://app.notion.com/3c7a6a91d31b806eaeb9ff9956894db5", 179858625, "잔스포츠(JANSPORT) 드로우색(스트링백). 브랜드 감성 + 가벼운 데일리 서브백, 남녀공용, 운동·여행·학원·외출용, 접어서 보관 편리. 핵심 키워드: 브랜드 인지도·가벼운 스트링백·남녀공용·데일리/운동/여행 활용. 보유 컬러는 겐더샵/셀렉트인 재고 기준(0825). 조건: 판매링크 셀렉트인 링크, 샘플은 공급가로 구매 가능. 타겟: 육아맘, 헬스. 상태: 진행가능·내부협의필요. 공구가는 노션 속성에 없음(제안서 시트 첨부)."], ["바크", "패션잡화(신발)", 1, "실내화·키즈", "러프한 편", "육아맘", "진행가능", "", "https://app.notion.com/3c7a6a91d31b8030b877f363bfad1f3f", 21065600, "바크(BARC) — 재활의학과 의사들이 발 구조·보행을 연구해 만든 일상용 리커버리 풋웨어. 특허 '밸런스폼'으로 체중 분산, 아치 서포트, 슬라이드·플립플롭·클로그 등 트렌디한 디자인, 아이부터 부모님까지 라인업. 수수료(셀러/벤더): 매출 1천 미만 3%/10%, 2천 이상 7%/20%, 3천 이상 15%/30%. 제안허들 러프한 편. 타겟: 오래 서서 일하는 직군, 육아맘, 러닝·등산 후, 여행객, 부모님 선물. 주의: '족저근막염 치료·통증 치료·교정 효과' 등 의료 효능 표현 금지, '체중 분산·아치 지지·편안한 착화감' 중심 소구."], ["UGG 이어머프·호주어그", "시즌 패션", 1, "양털 이어머프", "-", "", "진행중", "", "https://app.notion.com/40da6a91d31b803bbd7dc796ade6b803", 13519700, "UGG(미국어그) 여성 쉽스킨 자수 이어머프(품번 20955). 천연 쉽스킨(양가죽·양털), 원사이즈, 귀덮개 지름 약 10cm, 측면 UGG 로고 자수, 중국 제조. 컬러: 블랙·체스트넛·샌드·그레이 미스트(재고에 따라). 겨울 코디·연말/크리스마스 선물 아이템, 컬러별 착용 비교 등 숏폼 콘텐츠에 적합. 타겟: 20~40대 여성 패션·데일리룩 셀러, 릴스 제작 가능 셀러. 조건: 정상가·공구가·수수료·일정 모두 협의, 배송 별도 안내(인포크링크 셀러 공구 제안용). 주의: 천연 소재 특성상 털 길이·색감 개체차, 초기 털 빠짐 가능. 호주어그 자료는 노션에 없음."]], "insights": ["모니터링 시트의 8만~50만 추적계정(약 20명)은 모니터링 기간 동안 패션 브랜드만 공구함 — 비패션 셀러 풀은 추적계정 밖(영업시트 리빙·살림·육아 계정)에 있음.", "셀렉트인 실매출 1위 비패션 카테고리는 생활잡화/탈취·세제(픽싯 2회 8,605만, 보로탈코 3회 5,520만), 그다음 리빙(JBJ 3회 4,680만) — 소모품·반복구매 아이템이 회차 공구로 이어짐.", "주방/식품(도산회관·상국이네)은 셀러 제안 수가 가장 많지만 회당 매출은 200만~860만 수준으로, 넓게 뿌리는 볼륨형 카테고리.", "고매출 비패션 공구는 소수 셀러에 집중됨(낭블리 7.4만 픽싯, 요이홈 41만 보로탈코·JBJ, 지쁜이 4.1만 뉴메이슨) — 팔로워보다 리빙/살림 성향 셀러가 중요.", "신규 후보 우선순위: 살림/리빙 성향 20만+ 계정(@darimi_unni, @goonyyeonee, @jibbab_doumi, @sunhawww, @mangdoo_noona)에 픽싯·보로탈코·JBJ처럼 검증된 상품을 먼저 제안하는 것이 효율적."], "note": "「1.브랜드 모니터링」(실데이터 약 240행)·브랜드랭킹·0.모바일은 100% 패션 공구라 비패션 표본 없음. 비패션은 영업시트(제안제품)·셀러영업(지희)·진행셀러/일정 탭 기준이며 대부분 '제안'이지 실제 공구 확인 건이 아님."};

var HUB_IG_MON_ID = '1hzCUpZFyazoLkYG6u9dKn009JbQ9ZGzcXn7_e8HXUGM';   // 셀렉트인_인스타 공구 모니터링
function hubIgSeed_() {
  var cfg = hubConfig_(), ver = HUB_IG_SEED_.ver;
  if (cfg.ig_seed_ver && cfg.ig_seed_ver.value === ver) return;
  hubLocked_(function () {
    HUB_MEMO_.cfg = null; var c2 = hubConfig_(); if (c2.ig_seed_ver && c2.ig_seed_ver.value === ver) return;
    [['인스타발굴', HUB_IG_SEED_.pros.map(function (r) { return r.concat(['']); })], ['인스타상품', HUB_IG_SEED_.prods]].forEach(function (t) {
      var sh = hubSheet_(t[0]), w = HUB_TABS[t[0]].length;
      if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, w).clearContent();
      if (t[1].length) sh.getRange(2, 1, t[1].length, w).setValues(t[1].map(function (r) { var x = r.slice(0, w); while (x.length < w) x.push(''); return x; }));
    });
    if (!hubRows_('인스타템플릿').vals.length) hubSheet_('인스타템플릿').getRange(2, 1, HUB_IG_TPL_.length, 4).setValues(HUB_IG_TPL_.map(function (t) { return [t[0], t[1], hubNow_(), '기본']; }));
    hubConfigSet_('ig_seed_ver', ver, { name: '시드' });
  });
}
var HUB_IG_TPL_ = [
  ['첫 제안 (비패션)', '안녕하세요 {이름}님 :) 셀렉트인 공동구매 담당입니다.\n\n{이름}님 피드 보면서 살림·리빙 콘텐츠 반응이 정말 좋아서 연락드렸어요.\n이번에 저희가 진행 중인 [{상품}] 공구를 제안드리고 싶습니다.\n\n· 상품: {라인}\n· 진행 방식: 셀러님 일정에 맞춰 협의, 샘플 제공 가능\n· 정산: 공구 종료 후 정산서와 계산서 발행까지 저희가 진행\n\n관심 있으시면 편하신 연락처나 이메일 남겨주시면 제안서 바로 보내드릴게요!\n셀렉트인 드림 · biz@select-in.com'],
  ['재진행 제안 (기존 셀러)', '{이름}님 안녕하세요! 셀렉트인입니다 :)\n지난번 {지난공구} 공구 함께해주셔서 정말 감사했어요.\n\n이번 시즌에 [{상품}] 조건이 좋게 나와서 {이름}님께 먼저 여쭤보고 싶었어요.\n· 상품: {라인}\n· 일정: 원하시는 주차로 맞춰드릴게요\n\n괜찮으시면 일정 가능하신 주 알려주세요!'],
  ['팔로업 (3일 무응답)', '{이름}님 안녕하세요, 셀렉트인입니다.\n지난번 보내드린 [{상품}] 공구 제안 혹시 확인하셨을까요?\n부담 없이 의견만 주셔도 괜찮아요. 샘플 먼저 받아보시는 것도 가능합니다 :)']
];
/* 본사(업체) 링크 공구: 시트 P열(수량 칸)에 총 매출, Q열에 셀렉트인이 받은 수수료를 적는 경우 → 매출은 총 매출, comm=셀렉트인 수수료 */
function hubIgExt_(r) { var p = hubNum_(r[15]), q = hubNum_(r[16]); return (p >= 100000 && p > q) ? 1 : 0; }
function hubIgSales_(r) { return hubIgExt_(r) ? hubNum_(r[15]) : hubNum_(r[16]); }
function hubIgSched_(admin, force) {
  var cache = CacheService.getScriptCache(), key = 'ig_sched_v3';
  var base = null;
  if (!force) { var hit = cache.get(key); if (hit) try { base = JSON.parse(hit); } catch (e) {} }
  if (!base) {
    var sh = SpreadsheetApp.openById(HUB_EVENT_ID).getSheetByName('일정');
    var v = sh.getRange(4, 1, Math.max(1, sh.getLastRow() - 3), 29).getDisplayValues(), rows = [];
    v.forEach(function (r) {
      var ym = String(r[0]).trim(), m = String(r[1]).replace(/\s/g, '').match(/^(\d{2})(\d{2})-(\d{2})?(\d{2})?$/);
      if (!/^\d{6}$/.test(ym) || !m) return;
      var y = Number(ym.slice(0, 4)), ymM = Number(ym.slice(4)), sm = Number(m[1]), em = m[3] ? Number(m[3]) : sm;
      var sy = y + (sm - ymM > 6 ? -1 : ymM - sm > 6 ? 1 : 0), ey = sy + (em < sm ? 1 : 0);
      var a = sy + '-' + m[1] + '-' + m[2], b = m[3] ? ey + '-' + m[3] + '-' + m[4] : a;
      var link = String(r[7]).trim(), hm = link.match(/instagram\.com\/([A-Za-z0-9._]+)/);
      rows.push([a, b, String(r[2]).trim(), String(r[3]).trim(), String(r[4]).trim(), String(r[5]).replace(/\s+/g, ' ').trim(), String(r[6]).trim(), hm ? hm[1] : '', String(r[8]).trim(), String(r[9]).trim(), String(r[10]).trim(), hubIgSales_(r), hubNum_(r[28]), hubIgExt_(r), hubIgExt_(r) ? hubNum_(r[16]) : 0]);
    });
    base = { cols: ['a', 'b', 'st', 'kind', 'vendor', 'title', 'seller', 'handle', 'brand', 'fee', 'sfee', 'sales', 'profit', 'ext', 'comm'], rows: rows, at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'MM-dd HH:mm') };
    try { cache.put(key, JSON.stringify(base), 600); } catch (e) {}
  }
  if (!admin) base.rows.forEach(function (r) { r[12] = null; });   // 셀렉트인 수익은 관리자만
  return base;
}
function hubIgData_(me, force) {
  hubIgSeed_();
  var admin = hubIsOwner_(me.role), out = {};   // 셀렉트인 수익은 총괄만
  try { out.sched = hubIgSched_(admin, force); } catch (e) { out.sched = { rows: [], cols: [], err: '공구 일정 시트를 읽지 못했어요: ' + String(e.message || e).slice(0, 80) }; }
  var obj = function (tab, keys) { return hubRows_(tab).vals.filter(function (v) { return v[0] !== ''; }).map(function (v) { var o = {}; keys.forEach(function (k, i) { var x = v[i]; o[k] = x instanceof Date ? Utilities.formatDate(x, 'Asia/Seoul', 'yyyy-MM-dd') : x; }); return o; }); };
  out.dm = obj('인스타DM', ['handle', 'name', 'status', 'product', 'sentAt', 'followUp', 'note', 'log', 'updatedAt', 'by']).map(function (d) { try { d.log = d.log ? JSON.parse(d.log) : []; } catch (e) { d.log = []; } return d; });
  out.pros = obj('인스타발굴', ['handle', 'followers', 'fnum', 'cats', 'products', 'source', 'tracked', 'memo']);
  // 매일 자동 발굴(인스타 공구 모니터링 시트 「4.신규셀러발굴」: 발견일·계정·팔로워·팔로워수·카테고리·상품·근거·태그·상태·메모) — '제외'는 빼고 합침
  try {
    var seen = {}; out.pros.forEach(function (p) { seen[String(p.handle).toLowerCase()] = 1; });
    var ms = SpreadsheetApp.openById(HUB_IG_MON_ID).getSheetByName('4.신규셀러발굴');
    if (ms && ms.getLastRow() > 1) ms.getRange(2, 1, ms.getLastRow() - 1, 10).getDisplayValues().forEach(function (r) {
      var h = String(r[1]).replace(/^@/, '').trim().toLowerCase();
      if (!h || seen[h] || /제외/.test(r[8])) return; seen[h] = 1;
      out.pros.push({ handle: h, followers: r[2], fnum: hubNum_(r[3]), cats: r[4], products: r[5], source: '자동 발굴 ' + String(r[0]).slice(5), tracked: 'N', memo: r[9], post: r[6], found: r[0] });
    });
  } catch (e) { out.prosErr = '자동 발굴 시트를 읽지 못했어요'; }
  out.prods = obj('인스타상품', ['brand', 'cat', 'count', 'line', 'hurdle', 'target', 'status', 'rule', 'url', 'pastSales', 'detail']);
  // 소싱 후보 (모니터링 시트 「6.소싱후보」: 갱신일·상품·카테고리·셀러수·셀러·공구가·게시물·제조사 단서·가능성·이유·상태·메모)
  try {
    var ss6 = SpreadsheetApp.openById(HUB_IG_MON_ID).getSheetByName('6.소싱후보'); out.sourcing = [];
    if (ss6 && ss6.getLastRow() > 1) ss6.getRange(2, 1, ss6.getLastRow() - 1, 12).getDisplayValues().forEach(function (r) {
      if (!String(r[1]).trim() || /제외/.test(r[10])) return;
      out.sourcing.push({ at: r[0], item: r[1], cat: r[2], n: hubNum_(r[3]), sellers: r[4], price: r[5], post: r[6], maker: r[7], level: r[8], why: r[9], status: r[10], memo: r[11] });
    });
  } catch (e) { out.sourcing = []; }
  // 패션 셀러 (모니터링 시트 「1.브랜드 모니터링」: 게시일·브랜드·분류·계정·팔로워·…·게시물 링크·공구 상태 … ) 계정별로 묶음
  try {
    var fs = SpreadsheetApp.openById(HUB_IG_MON_ID).getSheetByName('1.브랜드 모니터링'), F = {};
    if (fs && fs.getLastRow() > 1) fs.getRange(2, 1, fs.getLastRow() - 1, 11).getDisplayValues().forEach(function (r) {
      var h = String(r[3]).replace(/^@/, '').trim().toLowerCase(); if (!h || !/^[a-z0-9._]+$/.test(h)) return;
      var f = F[h] || (F[h] = { handle: h, followers: r[4], fnum: hubIgFnum_(r[4]), brands: {}, n: 0, last: '', post: '', summary: '' });
      f.n++; if (r[1]) f.brands[r[1]] = (f.brands[r[1]] || 0) + 1;
      if (String(r[0]) >= f.last) { f.last = String(r[0]); f.post = r[6]; f.summary = r[10]; }
    });
    out.fashion = Object.keys(F).map(function (k) { var f = F[k]; f.brands = Object.keys(f.brands).sort(function (a, b) { return F[k].brands[b] - F[k].brands[a]; }).join(' · '); return f; });
  } catch (e) { out.fashion = []; }
  out.tpl = obj('인스타템플릿', ['name', 'body']);
  out.cats = HUB_IG_SEED_.cats; out.insights = HUB_IG_SEED_.insights; out.note = HUB_IG_SEED_.note; out.seedVer = HUB_IG_SEED_.ver;
  out.notion = 'https://app.notion.com/p/91995ae8a79140d181e71e180c7e0e70';
  out.sheet = 'https://docs.google.com/spreadsheets/d/' + HUB_EVENT_ID + '/edit';
  return out;
}
function hubIgDmSave_(d, me) {
  var h = hubStr_(d.handle, 60).replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9._]+$/.test(h)) throw new Error('인스타 계정 형식이 아니에요');
  var st = ['후보', '발송', '답장', '수락', '협의', '확정', '거절'].indexOf(d.status) >= 0 ? d.status : '후보';
  var r = hubRows_('인스타DM'), idx = -1, prev = null;
  for (var i = 0; i < r.vals.length; i++) if (String(r.vals[i][0]).toLowerCase() === h) { idx = i; prev = r.vals[i]; break; }
  var log = []; try { log = prev && prev[7] ? JSON.parse(prev[7]) : []; } catch (e) {}
  if (d.logText) log.push({ at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'), text: hubStr_(d.logText, 120), by: me.name });
  log = log.slice(-20);
  var keep = function (k, j, max) { return d[k] != null ? hubStr_(d[k], max || 200) : (prev ? String(prev[j] instanceof Date ? Utilities.formatDate(prev[j], 'Asia/Seoul', 'yyyy-MM-dd') : prev[j]) : ''); };
  var row = [h, keep('name', 1, 40), d.status ? st : (prev ? prev[2] : '후보'), keep('product', 3, 80), keep('sentAt', 4, 10), keep('followUp', 5, 10), keep('note', 6, 400), JSON.stringify(log), hubNow_(), me.name];
  if (idx >= 0) r.sh.getRange(idx + 2, 1, 1, row.length).setValues([row]); else r.sh.appendRow(row);
  r.sh.getRange(idx >= 0 ? idx + 2 : r.sh.getLastRow(), 5, 1, 2).setNumberFormat('@');
  return { ok: true, d: { handle: h, name: row[1], status: row[2], product: row[3], sentAt: row[4], followUp: row[5], note: row[6], log: log, updatedAt: row[8], by: row[9] } };
}
function hubIgTplSave_(list, me) {
  var sh = hubSheet_('인스타템플릿'), rows = (list || []).slice(0, 12).map(function (t) { return [hubStr_(t.name, 40), hubStr_(t.body, 3000), hubNow_(), me.name]; }).filter(function (r) { return r[0] && r[1]; });
  if (!rows.length) throw new Error('템플릿이 비어 있어요');
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 4).clearContent();
  sh.getRange(2, 1, rows.length, 4).setValues(rows);
  return { ok: true, tpl: rows.map(function (r) { return { name: r[0], body: r[1] }; }) };
}

/** DM 작성 중 AI 대화 — 노션 상품 정보(인스타상품 탭)·셀러 공구 이력을 근거로 답하고, DM 문구 제안은 <dm>…</dm>로 감쌈 */
function hubIgAi_(req, me) {
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) return { error: 'AI 키가 없습니다. Apps Script 스크립트 속성에 ANTHROPIC_API_KEY를 넣어주세요' };
  var msgs = (req.messages || []).slice(-12).map(function (m) { return { role: m.role === 'assistant' ? 'assistant' : 'user', content: hubStr_(m.content, 4000) }; }).filter(function (m) { return m.content; });
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return { error: '질문을 입력해 주세요' };
  var brand = hubStr_(req.product, 80), handle = hubStr_(req.handle, 60).replace(/^@/, '').toLowerCase();
  var prod = hubRows_('인스타상품').vals.filter(function (v) { return String(v[0]) === brand; })[0];
  var ctx = [];
  if (prod) ctx.push('제안 상품: ' + prod[0] + ' (' + prod[1] + ')\n라인업: ' + prod[3] + '\n허들: ' + prod[4] + '\n타겟: ' + prod[5] + '\n상태: ' + prod[6] + '\n조건: ' + prod[7] + '\n노션: ' + prod[8] + '\n지난 공구 매출: ' + prod[9] + '\n상세: ' + String(prod[10] || '').slice(0, 2500));
  else if (brand) ctx.push('제안 상품: ' + brand + ' (OPS 상품 자료 없음)');
  if (handle) {
    try {
      var hist = hubIgSched_(hubIsOwner_(me.role), false).rows.filter(function (r) { return String(r[7]).toLowerCase() === handle; }).slice(-8)
        .map(function (r) { return r[0] + '~' + r[1] + ' ' + r[5] + ' (' + r[2] + ', 매출 ' + r[11] + ')'; });
      ctx.push('셀러 @' + handle + ' 지난 공구: ' + (hist.length ? hist.join(' / ') : '없음(신규 셀러)'));
    } catch (e) {}
    var dm = hubRows_('인스타DM').vals.filter(function (v) { return String(v[0]).toLowerCase() === handle; })[0];
    if (dm) ctx.push('DM 진행 상태: ' + dm[2] + ' · 메모: ' + dm[6]);
  }
  if (req.draft) ctx.push('지금 작성 중인 DM 초안:\n' + hubStr_(req.draft, 2000));
  var system = [
    '너는 셀렉트인(인스타그램 인플루언서 공동구매 커머스 회사) 영업 담당을 돕는 어시스턴트다. 직원이 셀러에게 공구 제안 DM을 쓰는 중이다.',
    '아래 [자료]에 있는 사실만 근거로 답하고, 자료에 없는 가격·수수료·스펙은 지어내지 말고 "자료에 없음, 노션·업체 확인 필요"라고 말해라.',
    '짧고 실무적으로 한국어로 답한다. 목록은 3~6줄.',
    'DM 문구를 새로 쓰거나 고쳐 달라고 하면 완성된 DM 전문을 <dm>와 </dm> 사이에 넣어라(인사→셀러 맞춤 한 줄→상품 핵심 2~3줄→조건→연락 요청, 500자 이내, 과장 금지, 이모지 1~2개 이내).',
    '[자료]\n' + (ctx.join('\n\n') || '없음')
  ].join('\n');
  var model = PropertiesService.getScriptProperties().getProperty('HUB_AI_MODEL') || 'claude-sonnet-5-5';
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: model, max_tokens: 1200, system: system, messages: msgs })
  });
  var code = res.getResponseCode(), body = res.getContentText();
  if (code !== 200) return { error: 'AI 호출 실패(' + code + '): ' + body.slice(0, 160) };
  var text = (JSON.parse(body).content || []).map(function (c) { return c.text || ''; }).join('').trim();
  var m = text.match(/<dm>([\s\S]*?)<\/dm>/);
  return { ok: true, text: text.replace(/<\/?dm>/g, ''), dm: m ? m[1].trim() : '' };
}

function hubIgFnum_(t) {   // '13만 9천' → 139000, '1.2만' → 12000
  t = String(t || '').replace(/\s/g, ''); var n = 0, m;
  if ((m = t.match(/([\d.]+)만/))) n += Number(m[1]) * 10000;
  if ((m = t.match(/([\d.]+)천/))) n += Number(m[1]) * 1000;
  if (!n) n = hubNum_(t);
  return Math.round(n);
}
/* ---------- 셀러 회신 링크 (수락·거절) ----------
 * DM에 붙이는 링크 → 셀러가 열면 제안 요약 + [참여할게요]/[이번엔 어려워요] → 인스타DM 탭 상태가 수락/거절로 바뀜 */
function hubIgSig_(payload) {
  var k = PropertiesService.getScriptProperties().getProperty('HUB_SECRET') || '';
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, k + '|igreply')).replace(/=+$/, '').slice(0, 12);
}
function hubIgReplyLink_(req) {
  var h = hubStr_(req.handle, 60).replace(/^@/, '').toLowerCase(), p = hubStr_(req.product, 80);
  if (!/^[a-z0-9._]+$/.test(h)) return { error: '인스타 계정을 먼저 입력하세요' };
  var payload = Utilities.base64EncodeWebSafe(JSON.stringify({ h: h, p: p }), Utilities.Charset.UTF_8).replace(/=+$/, '');
  return { ok: true, url: ScriptApp.getService().getUrl() + '?r=' + payload + '.' + hubIgSig_(payload) };
}
function hubIgReplyParse_(tok) {
  var parts = String(tok || '').split('.'); if (parts.length !== 2 || hubIgSig_(parts[0]) !== parts[1]) return null;
  try { var pad = parts[0] + '==='.slice((parts[0].length + 3) % 4); return JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(pad)).getDataAsString('UTF-8')); } catch (e) { return null; }
}
function hubIgReplyPage_(tok) {
  var d = hubIgReplyParse_(tok);
  var esc = function (x) { return String(x || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var prod = d ? hubRows_('인스타상품').vals.filter(function (v) { return String(v[0]) === d.p; })[0] : null;
  var html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>셀렉트인 공동구매 제안</title>' +
    '<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;background:#f4f5f7;color:#15171a}.w{max-width:440px;margin:0 auto;padding:28px 18px}' +
    '.c{background:#fff;border:1px solid #e3e6ea;border-radius:16px;padding:22px}h1{font-size:19px;margin:0 0 6px}p{margin:0 0 14px;color:#5b6370;font-size:14px;line-height:1.6}.b{display:block;width:100%;border:0;border-radius:12px;padding:15px;font-size:16px;font-weight:700;margin-top:10px;cursor:pointer}' +
    '.y{background:#0b4a35;color:#fff}.n{background:#eef0f3;color:#15171a}textarea{width:100%;box-sizing:border-box;border:1px solid #d3d8de;border-radius:10px;padding:10px;font:inherit;font-size:14px;min-height:70px}.k{font-size:12px;color:#8a919c;margin-top:14px}</style></head><body><div class="w"><div class="c">' +
    (d ? '<h1>셀렉트인 공동구매 제안</h1><p>@' + esc(d.h) + '님, 제안 드린 <b>' + esc(d.p || '공동구매') + '</b> 공구 참여 여부를 알려주세요.' + (prod && prod[3] ? '<br>· ' + esc(prod[3]) : '') + '</p>' +
      '<div id="f"><textarea id="m" placeholder="연락처(카톡·이메일)나 희망 일정을 남겨주시면 바로 연락드릴게요 (선택)"></textarea>' +
      '<button class="b y" onclick="go(\'수락\')">참여할게요</button><button class="b n" onclick="go(\'거절\')">이번엔 어려워요</button></div><div id="ok" style="display:none"><h1>감사합니다!</h1><p id="okt"></p></div>' +
      '<p class="k">셀렉트인 · biz@select-in.com</p>' +
      '<script>function go(c){document.querySelectorAll("button").forEach(function(b){b.disabled=true;});google.script.run.withSuccessHandler(function(){document.getElementById("f").style.display="none";document.getElementById("ok").style.display="block";document.getElementById("okt").textContent=c==="수락"?"담당자가 곧 연락드릴게요.":"다음에 더 잘 맞는 제안으로 찾아뵐게요.";}).withFailureHandler(function(){alert("저장하지 못했어요. 잠시 후 다시 눌러주세요");document.querySelectorAll("button").forEach(function(b){b.disabled=false;});}).hubIgReply("' + esc(tok) + '",c,document.getElementById("m").value);}</script>'
      : '<h1>링크가 올바르지 않아요</h1><p>셀렉트인 담당자에게 다시 요청해 주세요.</p>') +
    '</div></div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('셀렉트인 공동구매 제안').addMetaTag('viewport', 'width=device-width, initial-scale=1').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}
/** 셀러 회신 페이지에서 호출 (google.script.run) */
function hubIgReply(tok, choice, memo) {
  var d = hubIgReplyParse_(tok); if (!d) throw new Error('bad link');
  var c = choice === '수락' ? '수락' : '거절';
  return hubLocked_(function () {
    var r = hubRows_('인스타DM'), prevNote = '';
    for (var i = 0; i < r.vals.length; i++) if (String(r.vals[i][0]).toLowerCase() === d.h) { prevNote = String(r.vals[i][6] || ''); break; }
    var note = hubStr_(memo, 200); 
    hubIgDmSave_({ handle: d.h, status: c, product: d.p || undefined, note: note ? (note + (prevNote ? ' / ' + prevNote : '')).slice(0, 400) : undefined, logText: '셀러 회신: ' + c + (note ? ' · ' + note : '') }, { name: '셀러' });
    return true;
  });
}
