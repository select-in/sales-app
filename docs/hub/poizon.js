/* 셀렉트인 OPS — 포이즌 판매자센터 동기화 (북마크로 실행)
 * seller.poizon.com 에 로그인한 화면에서 실행 → 주문 관리 화면을 자동으로 넘겨 보며
 * 화면이 받아온 주문(발송 대기·발송 완료·거래 성공)을 모아 OPS 앱으로 보냄
 * - 로그인 정보·서명 값은 건드리지 않음. 포이즌 화면이 스스로 불러온 데이터만 읽음 (조회 전용)
 * - 창을 켜두면 10분마다 자동으로 다시 가져옴 */
(function () {
  if (!/(^|\.)seller\.poizon\.com$/.test(location.hostname)) { alert('포이즌 판매자센터(seller.poizon.com)에서 실행해 주세요'); return; }
  if (window.__opsPzn) { window.__opsPzn.show(); return; }
  var HUB = 'https://select-in.github.io/sales-app/hub/', HUB_ORIGIN = 'https://select-in.github.io';
  var EVERY = 10 * 60 * 1000, hubWin = null, timer = null, busy = false;
  var LS = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  var W = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* ---------- 화면이 받아온 주문 응답 모으기 ---------- */
  var CAP = [], waiters = [];
  var of = window.fetch;
  window.fetch = function (u, opt) {
    var s = String(u && u.url || u), p = of.apply(this, arguments);
    if (/orderPageList/.test(s)) p.then(function (r) { r.clone().text().then(function (t) { var rec = { body: opt && opt.body, t: t, at: Date.now() }; CAP.push(rec); waiters.splice(0).forEach(function (w) { w(rec); }); }); }).catch(function () {});
    return p;
  };
  function nextResp(ms) { return new Promise(function (ok) { var done = false; waiters.push(function (r) { if (!done) { done = true; ok(r); } }); setTimeout(function () { if (!done) { done = true; ok(null); } }, ms || 15000); }); }

  /* ---------- 화면 ---------- */
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#fff;border:1px solid #d9e2dc;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.15);padding:14px 16px;width:300px;font:13px/1.5 -apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#1b2a22';
  box.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><b style="font-size:14px">OPS 포이즌 동기화</b><span id="opx" style="cursor:pointer;color:#888;font-size:16px">×</span></div>' +
    '<label style="display:flex;gap:8px;align-items:center;margin-bottom:6px">계정 <select id="opa" style="flex:1;padding:4px 6px;border:1px solid #ccc;border-radius:6px"><option>겐더샵</option><option>셀렉트인</option></select></label>' +
    '<label style="display:flex;gap:6px;align-items:center;margin-bottom:8px"><input type="checkbox" id="opauto" checked> 창 켜두면 10분마다 자동</label>' +
    '<div id="opm" style="background:#f4f7f5;border-radius:8px;padding:8px;min-height:36px;white-space:pre-line">준비됐어요</div>' +
    '<button id="opgo" style="margin-top:8px;width:100%;padding:8px;border:0;border-radius:8px;background:#1f7a52;color:#fff;font-weight:600;cursor:pointer">지금 동기화</button>';
  document.body.appendChild(box);
  var $ = function (id) { return box.querySelector('#' + id); };
  var msg = function (t) { $('opm').textContent = t; };
  $('opx').onclick = function () { box.style.display = 'none'; };

  /* ---------- 주문 관리 화면 자동 넘기기 ---------- */
  function goOrders() {
    if (/\/main\/orders\/management/.test(location.pathname)) return Promise.resolve();
    history.pushState({}, '', '/main/orders/management'); dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    return nextResp(20000).then(function () { return W(1500); });
  }
  function findTab(label) {
    var c = [].slice.call(document.querySelectorAll('div,span,li,button,a')).filter(function (e) { var t = (e.textContent || '').trim(); return t.indexOf(label) === 0 && /\(\s*[\d+]+\s*\)\s*$/.test(t) && t.length < 24; });
    c.sort(function (a, b) { return a.querySelectorAll('*').length - b.querySelectorAll('*').length; });
    return c[0] || null;
  }
  function nextBtn() {   // 보이는 페이지네이션의 [다음] (비활성 아니면)
    var L = [].slice.call(document.querySelectorAll('.ant-pagination-next')).filter(function (n) { return n.getClientRects().length; });
    var n = L[L.length - 1]; if (!n || /disabled/.test(n.className) || n.getAttribute('aria-disabled') === 'true') return null;
    return n.querySelector('button,a') || n;
  }
  function click(el) { ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (t) { el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })); }); }
  function pageRows(rec) {
    try { var j = JSON.parse(rec.t), P = j && j.data && j.data.pageOrderList; return { list: (P && P.dataList) || [], total: P && P.totalCount }; } catch (e) { return { list: [] }; }
  }
  function waitTab(label) {   // 화면이 다 그려질 때까지 (최대 20초)
    var n = 0;
    return new Promise(function (ok) { var t = setInterval(function () { var el = findTab(label); if (el || ++n > 40) { clearInterval(t); ok(el); } }, 500); });
  }
  function grab(label, maxPages) {
    var out = [];
    return waitTab(label).then(function (tab) {
    if (!tab) throw new Error('「' + label + '」 탭을 찾지 못했어요. 주문 관리 화면이 다 열린 뒤 다시 눌러 주세요');
    var p = nextResp(); click(tab);
    return p.then(function (rec) {
      var n = 1;
      var step = function (rec) {
        if (!rec) return out;
        out = out.concat(pageRows(rec).list);
        return W(900).then(function () {
        var nb = nextBtn();
        if (!nb || n >= maxPages) return out;
        n++; msg(label + ' 읽는 중… ' + n + '쪽');
        var q = nextResp(); click(nb); return q.then(step);
        });
      };
      return step(rec);
    });
    });
  }
  function money(v) { return v && v.money ? Number(v.money.amount) || 0 : (Number(v) || 0); }
  function row(o, tab) {
    var pi = o.productInfo || {}, tt = o.tradeTime || {};
    return {
      orderNo: String(o.orderNo || ''), status: o.orderItemStatusAdapter || '', tab: o.tabKey || tab, kind: (o.fulfillmentInfoResp && o.fulfillmentInfoResp.fulfillmentModeDesc) || '',
      style: pi.articleNumber || '', name: pi.spuTitle || '', brand: pi.brandName || '', option: pi.size || '',
      price: money(o.skuPrice), fee: o.poundageInfo ? money(o.poundageInfo.totalAmount) : '', payout: money(o.profitIncome),
      orderedAt: (tt.orderCreateTimeStr || '').replace(/\//g, '-'), deadline: (o.deliveryDeadlineStr || '').replace(/\//g, '-'), merchantId: String(o.merchantId || '')
    };
  }
  function collect() {
    var acct = $('opa').value, full = !LS('opsPznFull2_' + acct), res = { account: acct, rows: [], waitNos: [] };
    msg('주문 관리 화면 여는 중…');
    return goOrders().then(function () {
      msg('발송 대기 읽는 중…');
      return grab('발송 대기', 20);
    }).then(function (L) {
      var seen = {}; L.forEach(function (o) { var r = row(o, 'WAIT_SHIPPING'); if (seen[r.orderNo]) return; seen[r.orderNo] = 1; res.rows.push(r); res.waitNos.push(r.orderNo); });
      msg('발송 완료 읽는 중…'); return grab('발송 완료', 10);
    }).then(function (L) {
      L.forEach(function (o) { res.rows.push(row(o, 'SHIPPED')); });
      msg('거래 성공 읽는 중…' + (full ? ' (처음이라 여러 쪽)' : '')); return grab('거래 성공', full ? 15 : 3);
    }).then(function (L) {
      L.forEach(function (o) { res.rows.push(row(o, 'SUCCESS')); });
      res.full = full;
      var m = res.rows[0] && res.rows[0].merchantId; res.merchantId = m || '';
      return res;
    });
  }

  /* ---------- 계정 고정 (포이즌 판매자 번호 ↔ 겐더샵/셀렉트인) ---------- */
  function acctMap() { try { return JSON.parse(LS('opsPznMap') || '{}'); } catch (e) { return {}; } }
  function checkAcct(res, ev) {
    var id = res.merchantId; if (!id) return res;
    var map = acctMap(), sel = $('opa').value;
    if (map[id] && map[id] !== sel) {
      if (ev) throw new Error('이 포이즌 로그인은 「' + map[id] + '」 계정으로 연결돼 있어요. 계정을 바꿔 주세요');
      res.account = map[id]; $('opa').value = map[id];
    }
    if (!map[id]) {
      if (!ev) throw new Error('처음 보는 포이즌 로그인이에요. 계정을 확인하고 [지금 동기화]를 눌러 주세요');
      map[id] = sel; LS('opsPznMap', JSON.stringify(map));
    }
    return res;
  }

  /* ---------- OPS 앱으로 보내기 ---------- */
  function openHub() {
    if (!hubWin || hubWin.closed) hubWin = window.open(HUB + '#channel', 'opsHub');
    if (!hubWin) return Promise.reject(new Error('팝업이 막혔어요. 주소창 오른쪽에서 팝업 허용 후 [지금 동기화]를 눌러 주세요'));
    return new Promise(function (res, rej) {
      var n = 0, on = function (e) { if (e.origin === HUB_ORIGIN && e.data && e.data.type === 'hub_ready') { clearInterval(t); window.removeEventListener('message', on); res(hubWin); } };
      window.addEventListener('message', on);
      var ping = function () { try { hubWin.postMessage({ type: 'pzn_ping' }, HUB_ORIGIN); } catch (e) {} };
      var t = setInterval(function () { if (++n > 60) { clearInterval(t); window.removeEventListener('message', on); rej(new Error('OPS 앱이 열리지 않았어요 (OPS 로그인 확인)')); return; } ping(); }, 1000);
      ping();
    });
  }
  function send(res) {
    return openHub().then(function (w) {
      return new Promise(function (ok, bad) {
        var batch = Date.now();
        var on = function (e) {
          if (e.origin !== HUB_ORIGIN || !e.data || e.data.batch !== batch) return;
          window.removeEventListener('message', on);
          if (e.data.type === 'pzn_saved') ok(e.data); else bad(new Error(e.data.message || 'OPS 저장 실패'));
        };
        window.addEventListener('message', on);
        w.postMessage({ type: 'pzn_rows', batch: batch, account: res.account, rows: res.rows, waitNos: res.waitNos, waitOk: true }, HUB_ORIGIN);
        setTimeout(function () { window.removeEventListener('message', on); bad(new Error('OPS 저장 응답이 없어요')); }, 3 * 60 * 1000);
      });
    });
  }
  function run(ev) {
    if (busy) return; busy = true; $('opgo').disabled = true;
    if (ev && (!hubWin || hubWin.closed)) hubWin = window.open(HUB + '#channel', 'opsHub');
    var t0 = Date.now();
    collect().then(function (res) { return checkAcct(res, ev); }).then(function (res) {
      msg('OPS로 보내는 중… 주문 ' + res.rows.length + '건 (발송 대기 ' + res.waitNos.length + ')');
      return send(res).then(function (r) {
        if (res.full) LS('opsPznFull2_' + res.account, '1');
        LS('opsPznAcct', res.account);
        msg('완료 ' + new Date().toTimeString().slice(0, 5) + ' (' + Math.round((Date.now() - t0) / 1000) + '초)\n발송 대기 ' + res.waitNos.length + '건 · 추가 ' + (r.added || 0) + ' / 갱신 ' + (r.updated || 0) + ($('opauto').checked ? '\n다음 자동 동기화 10분 뒤' : ''));
      });
    }).catch(function (e) { msg('⚠ ' + (e && e.message || e)); })
      .then(function () { busy = false; $('opgo').disabled = false; });
  }
  var saved = LS('opsPznAcct'); if (saved) $('opa').value = saved;
  $('opgo').onclick = run;
  $('opauto').onchange = function () { clearInterval(timer); if (this.checked) timer = setInterval(run, EVERY); };
  timer = setInterval(run, EVERY);
  window.addEventListener('message', function (e) { if (e.origin === HUB_ORIGIN && e.data && e.data.type === 'pzn_run') { if (!hubWin || hubWin.closed) hubWin = e.source; run(); } });
  window.__opsPzn = { show: function () { box.style.display = ''; }, run: run };
  msg(saved ? '계정 ' + saved + ' · [지금 동기화]를 누르면 주문 관리 화면을 넘겨 가며 읽어요' : '계정을 확인하고 [지금 동기화]를 눌러 주세요');
})();
