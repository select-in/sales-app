/* 셀렉트인 OPS — 사방넷 관리자 동기화 (북마크로 실행)
 * sbadmin*.sabangnet.co.kr 에 로그인한 화면에서 실행 → 사방넷 화면이 쓰는 조회 기능으로 읽어서 OPS 앱으로 보냄 (조회 전용)
 *  1) 단품 전체: 사방넷단품대량수정 목록(현재고·가상재고·재고관리 여부·원가·판매가·바코드·이름·상태) → 앱을 사방넷 값으로 맞춤
 *  2) 쇼핑몰 등록 현황: 쇼핑몰상품수정 목록 → 계정(쇼핑몰+로그인ID)별 등록 상품코드 (비밀번호 같은 값은 읽지도 보내지도 않음)
 * - 창을 켜두면 10분마다 재고, 1시간마다 등록 현황을 다시 가져옴 */
(function () {
  if (!/sbadmin\d*\.sabangnet\.co\.kr$/.test(location.hostname)) { alert('사방넷 관리자(sbadmin) 화면에서 실행해 주세요'); return; }
  if (window.__opsSbn) { window.__opsSbn.show(); return; }
  var HUB = 'https://select-in.github.io/sales-app/hub/', HUB_ORIGIN = 'https://select-in.github.io';
  var EVERY = 10 * 60 * 1000, REG_EVERY = 60 * 60 * 1000, hubWin = null, timer = null, busy = false;
  var LS = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  var pad = function (n) { return ('0' + n).slice(-2); };
  var ymd = function (d) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); };

  /* ---------- 화면 ---------- */
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#fff;border:1px solid #d9e2dc;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.15);padding:14px 16px;width:300px;font:13px/1.5 -apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#1b2a22';
  box.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><b style="font-size:14px">OPS 사방넷 동기화</b><span id="osx" style="cursor:pointer;color:#888;font-size:16px">×</span></div>' +
    '<label style="display:flex;gap:6px;align-items:center;margin-bottom:4px"><input type="checkbox" id="osauto" checked> 창 켜두면 10분마다 재고 자동</label>' +
    '<label style="display:flex;gap:6px;align-items:center;margin-bottom:8px"><input type="checkbox" id="osreg"> 쇼핑몰 등록 현황도 지금 가져오기</label>' +
    '<div id="osm" style="background:#f4f7f5;border-radius:8px;padding:8px;min-height:36px;white-space:pre-line">준비됐어요</div>' +
    '<button id="osgo" style="margin-top:8px;width:100%;padding:8px;border:0;border-radius:8px;background:#1f7a52;color:#fff;font-weight:600;cursor:pointer">지금 동기화</button>';
  document.body.appendChild(box);
  var $ = function (id) { return box.querySelector('#' + id); };
  var msg = function (t) { $('osm').textContent = t; };
  $('osx').onclick = function () { box.style.display = 'none'; };

  /* ---------- 사방넷 조회 (화면과 같은 로그인 사용) ---------- */
  function auth() { var m = document.cookie.match(/(?:^|; )Authorization=([^;]*)/); return m ? 'Bearer ' + decodeURIComponent(m[1]) : ''; }
  function post(path, body) {
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 60000);
    return fetch(path, { method: 'POST', signal: ctl.signal, credentials: 'include', headers: { 'Content-Type': 'application/json;charset=UTF-8', 'Accept': 'application/json, text/plain, */*', 'Authorization': auth() }, body: JSON.stringify(body) })
      .then(function (r) { clearTimeout(t); if (r.status === 401 || r.status === 403) throw new Error('사방넷 로그인이 끊겼어요. 새로고침 후 다시 실행해 주세요'); return r.json(); })
      .then(function (j) { if (!j || !j.data) throw new Error('사방넷 응답이 이상해요 (' + (j && (j.message || j.code)) + ')'); return j.data; });
  }
  function skuBody(page, size) {
    return { dayOption: 'prdFstRegsDt', startDate: '20150101', endDate: ymd(new Date()), pageSize: size, currentPage: page, sortOption: 'prdNo', sortValue: 'ASC', catMpngDivCd: '', stdCatLaclNm: '', stdCatMidclNm: '', stdCatSmclsNm: '', stdCatDtclsNm: '', stdCatCdList: [],
      catLaclCd: '', catMidclCd: '', catSmclsCd: '', catDtclsCd: '', crtinvQtZero: false, vrtlStocQtZero: false, sftinvQtZero: false, setDivCdL: false, setDivCdP: false, setDivCdG: false, prdcYy: '', sesnDivCd: '', prdTgtDivCd: '', taxDivCd: '', dechGvMthdDivCd: '',
      stocUseYn: '', prdDivCd: '', stockUnderSft: false, minUnderStock: '', maxUnderStock: '', useStockSelect: false, stockOption: 'CRTINV_QT', minStock: '', maxStock: '', productStatus: [], skuSplyStsCd: '', skuSplyStsCd1: false, skuSplyStsCd2: false, skuSplyStsCd3: false,
      searchCondition: '', searchKeyword: '', searchKeywordList: [], downloadScale: 'SELECTED' };
  }
  /* 사방넷단품대량수정 목록 = 상품 화면의 현재고(가용)와 같은 값. 전체 단품을 읽음 */
  function readSku() {
    var out = [], seen = {}, page = 1, size = 2000, total = 0;
    var step = function () {
      return post('/prod-api/customer/product/sku-bulk-modify-list', skuBody(page, size)).then(function (d) {
        var L = d.skuBulkModifyDetailForList || []; total = d.total || total;
        L.forEach(function (o) { var k = o.prdNo + '-' + o.skuNo; if (seen[k]) return; seen[k] = 1;
          out.push([o.prdNo, o.skuNo, o.prdNm, o.optDtlNm, o.barcd, o.splyCprc, o.sepr, o.crtinvQt, o.vrtlStocQt, o.stocUseYn, o.skuSplyStsNm, o.setDivCd, o.conPrdNo, o.conSkuNo]); });
        msg('사방넷 단품 읽는 중… ' + out.length + ' / ' + total);
        if (L.length && out.length < total && page < 30) { page++; return step(); }
        return { rows: out, complete: total > 0 && out.length >= total };
      });
    };
    return step();
  }
  /* 쇼핑몰 계정별 주문·클레임 마지막 수집 + 스케줄러 설정 (읽기만) */
  function get(path) {
    return fetch(path, { credentials: 'include', headers: { 'Accept': 'application/json, text/plain, */*', 'Authorization': auth() } }).then(function (r) { return r.json(); }).then(function (j) { return j && j.data; });
  }
  function readCollect() {
    return Promise.all([post('/prod-api/customer/order/OrderCollectAuto/getOrderCollectAutoLists', {}), get('/prod-api/customer/mall/auto-service/search')]).then(function (x) {
      var L = Array.isArray(x[0]) ? x[0] : (x[0].list || []), S = Array.isArray(x[1]) ? x[1] : [], sch = {}, out = [], seen = {};
      var t = function (v) { return String(v || '').replace('T', ' ').slice(0, 16); };
      S.forEach(function (o) { var v = {}; (o.scdlrCdList || []).forEach(function (c) { v[c.code] = c.value; }); sch[o.shmaId + '|' + o.shmaCnctnLoginId] = { on: o.useYn, v: v }; });
      L.forEach(function (o) {
        var k = o.shmaId + '|' + o.shmaCnctnLoginId, s = sch[k] || { on: '', v: {} }; seen[k] = 1;
        out.push({ shma: o.shmaId, mall: o.shmaNm, id: o.shmaCnctnLoginId, orderAt: t(o.orderFstRegsDt), orderBy: o.orderFstRegsUserId || '', orderRes: o.orderResStatus || '', claimAt: t(o.claimFstRegsDt), claimBy: o.claimFstRegsUserId || '',
          on: s.on, sOrd: s.v['01'] || '', sClm: s.v['02'] || '', sStk: s.v['08'] || '', sShip: s.v['03'] || '', msg: String(o.rsltLogMsg || '').slice(0, 200) });
      });
      S.forEach(function (o) { var k = o.shmaId + '|' + o.shmaCnctnLoginId; if (seen[k]) return; var s = sch[k];
        out.push({ shma: o.shmaId, mall: o.shmaNm, id: o.shmaCnctnLoginId, orderAt: '', orderBy: '', orderRes: '', claimAt: '', claimBy: '', on: s.on, sOrd: s.v['01'] || '', sClm: s.v['02'] || '', sStk: s.v['08'] || '', sShip: s.v['03'] || '', msg: '주문수집 목록에 없음' }); });
      return out;
    });
  }
  function regBody(page, size) {
    return { shmaId: '', tbCmmlShmaCnctnAcntD: {}, mode: 'search', searchDateType: 'b.FST_REGS_DT', startDate: '20150101', endDate: ymd(new Date()), startTime: '', endTime: '', svcAcntId: '', catLvl: 0, uprCatSrno: null, catLaclCd: null, catMidclCd: null, catSmclsCd: null, catDtclsCd: null,
      imgExpoYn: '', exlImgExpoYn: '', seprChk1: '', seprChk2: '', searchPriceYn: 'N', searchPrice1: null, searchPrice2: null, skuYn: '', bypcSvcAcntId: '', lgstscSvcAcntId: '', stocUseYn: '', dechGvMthdDivCd: '', taxDivCd: '', prdDivCd: '', prdcYy: '', sesnDivCd: '',
      shmaIdMulti: [], bypcSvcAcntIdMulti: [], prdSplyStsCd3: '', prdSplyStsCd2: '', seprYn: '', prdNmYn: '', prdUpdTrnmSucsYn: '', shmaPrdLnkgStsCd: '', lnkgCrtnDivCd: '', setPrdDivCd: '', sortField: 'b.PRD_REGS_FST_TRNM_DT', sortMethod: 'DESC', scale: 0,
      searchCondition: '', searchKeyword: '', currentPage: page, pageSize: size, total: 0, exclPrtScpDivCd: 'SELECTED', mallProductUpdateArray: [], catDivCd: 'MY_CAT', catMpngDivCd: '', stdCatLaclNm: '', stdCatMidclNm: '', stdCatSmclsNm: '', stdCatDtclsNm: '', stdCatCdList: [],
      fnlChgPrgmNm: 'mall-product-update' };
  }
  function readReg() {
    var seen = {}, g = {}, page = 1, size = 500, total = 0, n = 0, ST = { '공급중': '', '일시중지': 'p', '완전품절': 'x' };
    var step = function () {
      return post('/prod-api/customer/mall/MallProductUpdate/getMallProductUpdateLists', regBody(page, size)).then(function (d) {
        var L = d.list || []; total = (d.metaData && d.metaData.total) || total;
        L.forEach(function (r) {   // 필요한 항목만 꺼냄 (비밀번호 등 나머지 값은 쓰지 않음)
          if (!r.shmaId || seen[r.rowNum]) return; seen[r.rowNum] = 1; n++;
          var k = r.shmaId + '|' + r.shmaNm + '|' + r.shmaCnctnLoginId;
          (g[k] = g[k] || []).push(String(r.prdNo) + (ST[r.prdSplyStsCdNm] != null ? ST[r.prdSplyStsCdNm] : '?'));
        });
        msg('쇼핑몰 등록 현황 읽는 중… ' + n + ' / ' + total);
        if (L.length && n < total && page < 60) { page++; return step(); }
        return Object.keys(g).map(function (k) { var p = k.split('|'); return { shma: p[0], mall: p[1], id: p[2], list: g[k].filter(function (v, i, a) { return a.indexOf(v) === i; }).join(',') }; });
      });
    };
    return step();
  }

  /* ---------- OPS 앱으로 보내기 ---------- */
  function openHub() {
    if (!hubWin || hubWin.closed) hubWin = window.open(HUB + '#products', 'opsHub');
    if (!hubWin) return Promise.reject(new Error('팝업이 막혔어요. 주소창 오른쪽에서 팝업 허용 후 [지금 동기화]를 눌러 주세요'));
    return new Promise(function (res, rej) {
      var n = 0, on = function (e) { if (e.origin === HUB_ORIGIN && e.data && e.data.type === 'hub_ready') { clearInterval(t); window.removeEventListener('message', on); if (!e.data.admin) rej(new Error('OPS에 관리자 계정으로 로그인해 주세요')); else res(hubWin); } };
      window.addEventListener('message', on);
      var ping = function () { try { hubWin.postMessage({ type: 'sbn_ping' }, HUB_ORIGIN); } catch (e) {} };
      var t = setInterval(function () { if (++n > 60) { clearInterval(t); window.removeEventListener('message', on); rej(new Error('OPS 앱이 열리지 않았어요 (OPS 로그인 확인)')); return; } ping(); }, 1000);
      ping();
    });
  }
  function send(type, payload) {
    return openHub().then(function (w) {
      return new Promise(function (ok, bad) {
        var batch = Date.now() + Math.random();
        var on = function (e) {
          if (e.origin !== HUB_ORIGIN || !e.data || e.data.batch !== batch) return;
          window.removeEventListener('message', on);
          if (e.data.type === 'sbx_saved') ok(e.data.res); else bad(new Error(e.data.message || 'OPS 저장 실패'));
        };
        window.addEventListener('message', on);
        w.postMessage(Object.assign({ type: type, batch: batch }, payload), HUB_ORIGIN);
        setTimeout(function () { window.removeEventListener('message', on); bad(new Error('OPS 저장 응답이 없어요')); }, 5 * 60 * 1000);
      });
    });
  }

  function hm() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function run(ev) {
    if (ev && (!hubWin || hubWin.closed)) hubWin = window.open(HUB + '#products', 'opsHub');   // 버튼 클릭 순간에 열어야 팝업이 안 막혀요
    if (busy) return; busy = true; $('osgo').disabled = true;
    var t0 = Date.now(), out = [], wantReg = $('osreg').checked || Date.now() - Number(LS('opsSbnRegAt') || 0) > REG_EVERY;
    readSku().then(function (res) {
      msg('사방넷 단품 ' + res.rows.length + '개 → OPS 저장 중…');
      return send('sbk_rows', res);
    }).then(function (r) {
      var c = r.c || {};
      out.push('사방넷 단품 ' + r.seen + '개 확인 · 바뀐 곳 ' + r.changed + '개' + (r.changed ? '\n(재고 ' + c.stock + ' · 원가 ' + c.cost + ' · 판매가 ' + c.price + ' · 이름/옵션 ' + c.name + ' · 바코드 ' + c.bar + ' · 재고관리 ' + c.mng + ' · 상태 ' + c.status + ' · 새 단품 ' + c.added + (c.missing ? ' · 사방넷없음 ' + c.missing : '') + ')' : '') + (c.skipped ? '\n앱에서 방금 입출고한 ' + c.skipped + '개는 다음에' : ''));
      if (r.sample && r.sample.length) out.push(r.sample.slice(0, 5).join('\n'));
      return readCollect().then(function (A) { return send('sbc_rows', { accts: A }); }).then(function (r3) { out.push('주문수집 상태 ' + r3.accts + '개 계정'); }, function (e) { out.push('주문수집 상태는 못 읽음: ' + (e && e.message || e)); });
    }).then(function () {
      if (!wantReg) return;
      return readReg().then(function (accts) { msg('등록 현황 ' + accts.length + '개 계정 → OPS 저장 중…'); return send('sbr_rows', { accts: accts }); })
        .then(function (r2) { LS('opsSbnRegAt', String(Date.now())); $('osreg').checked = false; out.push('쇼핑몰 등록 현황 ' + r2.accts + '개 계정'); });
    }).then(function () {
      msg('완료 ' + hm() + ' (' + Math.round((Date.now() - t0) / 1000) + '초)\n' + out.join('\n') + ($('osauto').checked ? '\n다음 자동 동기화 10분 뒤' : ''));
    }).catch(function (e) { msg('멈췄어요 ' + hm() + '\n' + (e && e.message || e)); })
      .then(function () { busy = false; $('osgo').disabled = false; plan(); });
  }
  function plan() { clearTimeout(timer); if ($('osauto').checked) timer = setTimeout(function () { run(null); }, EVERY); }
  $('osgo').onclick = run;
  $('osauto').onchange = plan;
  window.__opsSbn = { show: function () { box.style.display = ''; } };
  msg('[지금 동기화]를 누르면 OPS 창이 열리고\n사방넷 현재고를 앱에 맞춰요');
})();
