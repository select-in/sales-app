/* 「공동구매 정산 및 일정시트」 연결 스크립트(노션캘린더, Code.gs 맨 끝)에 붙인 코드 — 2026-11-06
 * 원본은 시트의 Apps Script 프로젝트(노션캘린더)에 있음. 이 파일은 교차 검증(Claude Code · Codex)용 사본.
 * 역할: 3행 머리글(제목)을 보고 CONFIG·MONTH_CLOSE의 COL_ 번호를 실행할 때마다 다시 계산
 *       → 「일정」 탭에 열을 추가·이동해도 스크립트 수정 불필요.
 *       제목을 못 찾으면 틀린 열에 쓰지 않도록 실행을 멈춘다 (ChatGPT 교차 검증 반영). */

var COL_HEADER_ROW_ = 3;
var COL_BASE_HEADERS_ = ['년/월','시작일-종료일','확정구분','진행구분','벤더사명','셀러명(벤더사명)제품명(업체명)','셀러명','셀러링크','브랜드업체명','통수수료','셀러수수료','샘플여부','정산','업체명','거래처입금','수량','매출','정산금액/공급가','배송비','최종정산액','계산서발급','정산일','셀러입금','최종정산액','내부정산체크','계산서발행','수익(세금차감전)','비고','셀렉트인최종매출','','블랭크샵','입금'];
function colNorm_(v) { return String(v == null ? '' : v).replace(/\s+/g, ''); }
function colAutoMap_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) return null;
  var hdr = sh.getRange(COL_HEADER_ROW_, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(colNorm_);
  if (hdr.indexOf('년/월') !== 0) return null;                       // 머리글 행이 이상하면 손대지 않음
  var find = function (name, occ) { var k = 0; for (var j = 0; j < hdr.length; j++) if (hdr[j] === name) { if (k === occ) return j + 1; k++; } return 0; };
  var changed = {}, missing = [];
  [typeof CONFIG !== 'undefined' ? CONFIG : null, typeof MONTH_CLOSE !== 'undefined' ? MONTH_CLOSE : null].forEach(function (obj) {
    if (!obj) return;
    Object.keys(obj).forEach(function (key) {
      if (!/^COL_/.test(key) || typeof obj[key] !== 'number') return;
      var n = obj[key], name = COL_BASE_HEADERS_[n - 1];
      if (!name) return;
      var occ = 0; for (var j = 0; j < n - 1; j++) if (COL_BASE_HEADERS_[j] === name) occ++;
      var p = find(name, occ);
      if (!p) { missing.push(name); return; }
      if (p !== n) { obj[key] = p; changed[key] = n + '→' + p; }
    });
  });
  if (missing.length) throw new Error('「일정」 탭 3행에서 제목을 못 찾음: ' + missing.join(', ') + ' — 제목을 바꿨다면 COL_BASE_HEADERS_도 같이 바꿔야 함');
  return changed;
}
colAutoMap_();   // 실패하면 이번 실행은 멈춤(틀린 열에 쓰는 것보다 안전). 시간 트리거 실패는 메일로 알림

/** 점검용: 현재 열 매핑을 로그로 확인 (읽기만 함) */
function 열매핑_확인() {
  var out = {}; Object.keys(CONFIG).forEach(function (k) { if (/^COL_/.test(k)) out[k] = CONFIG[k]; });
  Logger.log(JSON.stringify(out));
  return out;
}
