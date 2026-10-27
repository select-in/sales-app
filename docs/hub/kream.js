/* 셀렉트인 OPS — 크림 판매자센터 동기화 (북마크로 실행)
 * partner.kream.co.kr 화면에서 실행 → 입찰중·진행중·정산 데이터를 읽어 OPS 앱으로 보냄
 * - 로그인 정보는 저장하지 않음. 크림 화면의 로그인 세션을 그대로 사용 (읽기 전용 조회만)
 * - 창을 켜두면 10분마다 자동으로 다시 가져옴 */
(function () {
  if (!/(^|\.)partner\.kream\.co\.kr$/.test(location.hostname)) { alert('크림 판매자센터(partner.kream.co.kr)에서 실행해 주세요'); return; }
  if (window.__opsKrm) { window.__opsKrm.show(); return; }
  var API = 'https://partner-api.kream.co.kr/api/v1/';
  var HUB = 'https://select-in.github.io/sales-app/hub/', HUB_ORIGIN = 'https://select-in.github.io';
  var EVERY = 10 * 60 * 1000, hubWin = null, timer = null, busy = false, first = true;
  var LS = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };

  /* ---------- 화면 ---------- */
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#fff;border:1px solid #d9e2dc;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.15);padding:14px 16px;width:300px;font:13px/1.5 -apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#1b2a22';
  box.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><b style="font-size:14px">OPS 크림 동기화</b><span id="okx" style="cursor:pointer;color:#888;font-size:16px">×</span></div>' +
    '<label style="display:flex;gap:8px;align-items:center;margin-bottom:6px">계정 <select id="oka" style="flex:1;padding:4px 6px;border:1px solid #ccc;border-radius:6px"><option>겐더샵</option><option>셀렉트인</option></select></label>' +
    '<label style="display:flex;gap:6px;align-items:center;margin-bottom:8px"><input type="checkbox" id="okauto" checked> 창 켜두면 10분마다 자동</label>' +
    '<div id="okm" style="background:#f4f7f5;border-radius:8px;padding:8px;min-height:36px;white-space:pre-line">준비됐어요</div>' +
    '<button id="okgo" style="margin-top:8px;width:100%;padding:8px;border:0;border-radius:8px;background:#1f7a52;color:#fff;font-weight:600;cursor:pointer">지금 동기화</button>';
  document.body.appendChild(box);
  var $ = function (id) { return box.querySelector('#' + id); };
  var msg = function (t) { $('okm').textContent = t; };
  $('okx').onclick = function () { box.style.display = 'none'; };

  /* ---------- 로그인 세션 ---------- */
  function auth() {
    try { var o = JSON.parse(localStorage.getItem('authorization') || '{}'); return o.accessToken ? 'Bearer ' + o.accessToken : ''; } catch (e) { return ''; }
  }
  function refreshSession() {   // 크림 화면을 숨은 창으로 한 번 열어 사이트가 스스로 세션을 갱신하게 함
    return new Promise(function (res) {
      var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:-3000px;width:800px;height:600px';
      f.src = '/seller'; document.body.appendChild(f);
      setTimeout(function () { f.remove(); res(); }, 9000);
    });
  }
  function get(path, retried) {
    var ac = new AbortController(), to = setTimeout(function () { ac.abort(); }, 25000);
    return fetch(API + path, { headers: { Authorization: auth() }, signal: ac.signal }).then(function (r) {
      clearTimeout(to);
      if (r.status === 401 && !retried) return refreshSession().then(function () { return get(path, true); });
      if (r.status === 401) throw new Error('크림 로그인이 풀렸어요. 크림에 다시 로그인한 뒤 [지금 동기화]를 눌러 주세요');
      if (!r.ok) return r.text().then(function (t) { throw new Error('크림 응답 ' + r.status + ' ' + t.slice(0, 80)); });
      return r.json();
    });
  }

  /* ---------- 날짜 ---------- */
  function ymd(d) { return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10); }
  function kst(s) { if (!s) return ''; var d = new Date(s); if (isNaN(d)) return String(s); return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' '); }
  function daysAgo(n) { return new Date(Date.now() - n * 864e5); }

  /* ---------- 데이터 읽기 ---------- */
  function askRow(it) {
    var r = (it.product && it.product.release) || {}, m = (it.product && it.product.market) || {}, pb = it.price_breakdown || {};
    var fee = pb.processing_fee && typeof pb.processing_fee === 'object' ? pb.processing_fee.value : pb.processing_fee;
    return {
      askId: it.id, oid: it.oid || '', status: it.status_display || it.status, kind: it.is_inventory ? '보관' : '일반',
      style: r.style_code || '', name: r.translated_name || r.name || '', brand: (it.product && it.product.brand && it.product.brand.name) || '',
      option: it.option || '', price: it.price || 0, fee: fee ? Math.abs(fee) : '', payout: pb.total_payout || '',
      lowest: m.lowest_ask || '', last: m.last_sale_price || '',
      rank: it.live_rank || '', lowN: m.lowest_ask_normal || '', lowI: m.lowest_ask_inventory_100 || '',
      lastN: m.last_price_normal || '', lastI: m.last_price_inventory_100 || '',
      createdAt: kst(it.date_created), expiresAt: kst(it.expires_at),
      orderedAt: kst((it.transaction && it.transaction.date_created) || '')
    };
  }
  function asksAll(q) {   // market/asks — cursor 페이지
    var out = [], cur = 1;
    var step = function () {
      return get('market/asks?per_page=500&cursor=' + cur + '&' + q).then(function (j) {
        var items = j.items || []; out = out.concat(items);
        if (j.total > 5000) throw new Error('예상보다 많은 결과(' + j.total + ')라 중단했어요');
        if (items.length === 500 && out.length < (j.total || 0)) { cur++; return step(); }
        return out;
      });
    };
    return step();
  }
  function payoutsAll(from, to) {   // 주문별 정산 — page 페이지
    var out = [], page = 1;
    var step = function () {
      return get('business/payouts/orders?date_column=date_settled&date_start=' + from + 'T00:00:00.000Z&date_end=' + to + 'T00:00:00.000Z&search_category=product_name&per_page=500&page=' + page).then(function (j) {
        var items = j.items || []; out = out.concat(items);
        if (items.length === 500 && out.length < (j.total || 0) && page < 40) { page++; return step(); }
        return out;
      });
    };
    return step();
  }
  function collect() {
    var acct = $('oka').value, today = ymd(new Date());
    var seen = LS('opsKrmFull_' + acct), full = !seen;   // 처음 한 번은 1년치 정산, 이후엔 40일치
    var res = { account: acct, asks: [], sales: [] };
    msg('입찰중 목록 읽는 중…');
    return asksAll('start_date=' + ymd(daysAgo(364)) + '&end_date=' + today + '&status=live&date_column=date_created&price_column=sale_price')
      .then(function (items) {
        res.asks = items.map(askRow);
        var sts = ['shipment_required', 'warehouse_scanned', 'payout_scheduled', 'canceled'], k = 0;
        var from = ymd(daysAgo(60));
        var next = function () {
          if (k >= sts.length) return;
          var st = sts[k++]; msg('진행중 거래 읽는 중… (' + k + '/' + sts.length + ')');
          return asksAll('start_date=' + from + '&end_date=' + today + '&status=' + st + (st === 'canceled' ? '' : '&date_column=transaction_date_created'))
            .then(function (items) { items.forEach(function (it) { var a = askRow(it); res.sales.push({ oid: a.oid, askId: a.askId, status: a.status, kind: a.kind, style: a.style, name: a.name, option: a.option, price: a.price, fee: a.fee, payout: a.payout, orderedAt: a.orderedAt }); }); })
            .catch(function () { /* 상태 하나 실패해도 계속 */ })
            .then(next);
        };
        return next();
      })
      .then(function () {
        msg('정산 내역 읽는 중…' + (full ? ' (처음이라 1년치)' : ''));
        return payoutsAll(ymd(daysAgo(full ? 364 : 40)), ymd(daysAgo(-1)));
      })
      .then(function (items) {
        items.forEach(function (it) {
          res.sales.push({
            oid: it.order_oid || String(it.order_id), askId: it.order_id, status: it.order_status_display || '', kind: it.order_type_display || '',
            style: it.model_number || '', name: it.product_translated_name || it.product_name || '', option: it.option || '',
            price: it.settlement_amount || '', fee: it.processing_fee || '', payout: it.payout_amount || '',
            orderedAt: kst(it.date_ordered), settledAt: kst(it.date_settled), payoutDate: it.date_payout_local || ''
          });
        });
        res.full = full;
        // 보관판매: 보관 신청 후 크림 창고로 보내야 하는 것(발송 필요)·이동 중(입고 대기)·보관 중 수량
        msg('보관 현황 읽는 중…');
        res.inv = []; res.invCount = null;
        var tabs = ['shipment_required', 'storage_pending'], t = 0;
        var nextT = function () {
          if (t >= tabs.length) return res;
          var tab = tabs[t++], page = 1;
          var step = function () {
            return get('inventory/items?page=' + page + '&per_page=100&keyword=&tab=' + tab + '&keyword_type=product_name&date_filter_type=date_requested&start_date=' + ymd(daysAgo(180)) + '&end_date=' + today).then(function (j) {
              if (j.status_count) res.invCount = j.status_count;
              (j.items || []).forEach(function (it) {
                var p = it.product || {}, ii = it.inventory_item || {}, tr = it.tracking || {};
                res.inv.push({ invId: it.id, oid: it.oid || '', stage: tab, status: ii.status_display || '', style: p.style_code || '', name: p.name_korean || p.name || '', option: it.option || '',
                  tracking: tr.tracking_code || '', requestedAt: kst(ii.date_stock_requested || it.date_created), updatedAt: kst(it.date_updated) });
              });
              if ((j.items || []).length === 100 && page < 20) { page++; return step(); }
            });
          };
          return step().catch(function () {}).then(nextT);
        };
        return nextT();
      });
  }

  /* ---------- OPS 앱으로 보내기 ---------- */
  function openHub() {
    if (!hubWin || hubWin.closed) hubWin = window.open(HUB + '#kream', 'opsHub');
    if (!hubWin) return Promise.reject(new Error('팝업이 막혔어요. 주소창 오른쪽에서 팝업 허용 후 [지금 동기화]를 눌러 주세요'));
    return new Promise(function (res, rej) {
      var n = 0, on = function (e) { if (e.origin === HUB_ORIGIN && e.data && e.data.type === 'hub_ready') { clearInterval(t); window.removeEventListener('message', on); res(hubWin); } };
      window.addEventListener('message', on);
      var ping = function () { try { hubWin.postMessage({ type: 'krm_ping' }, HUB_ORIGIN); } catch (e) {} };
      var t = setInterval(function () {
        if (++n > 60) { clearInterval(t); window.removeEventListener('message', on); rej(new Error('OPS 앱이 열리지 않았어요 (OPS 로그인 확인)')); return; }
        ping();
      }, 1000);
      ping();
    });
  }
  function send(res) {
    return openHub().then(function (w) {
      return new Promise(function (ok, bad) {
        var batch = Date.now(), size = 1500, parts = [];
        for (var i = 0; i < res.sales.length; i += size) parts.push(res.sales.slice(i, i + size));
        if (!parts.length) parts.push([]);
        var on = function (e) {
          if (e.origin !== HUB_ORIGIN || !e.data || e.data.batch !== batch) return;
          if (e.data.type === 'krm_saved') { window.removeEventListener('message', on); ok(e.data); }
          if (e.data.type === 'krm_error') { window.removeEventListener('message', on); bad(new Error(e.data.message || 'OPS 저장 실패')); }
        };
        window.addEventListener('message', on);
        parts.forEach(function (p, i) {
          w.postMessage({ type: 'krm_rows', batch: batch, account: res.account, asks: i === 0 ? res.asks : null, inv: i === 0 ? res.inv : null, invCount: i === 0 ? res.invCount : null, sales: p, part: i, parts: parts.length }, HUB_ORIGIN);
        });
        setTimeout(function () { window.removeEventListener('message', on); bad(new Error('OPS 저장 응답이 없어요')); }, 5 * 60 * 1000);
      });
    });
  }

  /* 크림 로그인 계정(이메일) ↔ OPS 계정(겐더샵/셀렉트인) 고정 — 다른 계정으로 로그인했는데 잘못된 이름으로 저장되는 것 방지 */
  function acctMap() { try { return JSON.parse(LS('opsKrmMap') || '{}'); } catch (e) { return {}; } }
  function whoAmI() { return get('user/me').then(function (m) { return String(m.email || m.kream_email || '').toLowerCase(); }); }
  function checkAcct(ev) {
    return whoAmI().then(function (em) {
      if (!em) throw new Error('크림 로그인 정보를 확인할 수 없어요');
      var map = acctMap(), sel = $('oka').value;
      if (map[em] && map[em] !== sel) {
        if (ev) throw new Error('이 크림 로그인(' + em.replace(/(.{3}).*@/, '$1***@') + ')은 「' + map[em] + '」 계정으로 연결돼 있어요. 계정을 「' + map[em] + '」로 바꿔 주세요');
        $('oka').value = map[em];
      }
      if (!map[em]) {
        if (!ev) throw new Error('처음 보는 크림 로그인이에요. 계정을 확인하고 [지금 동기화]를 눌러 주세요');
        var used = Object.keys(map).filter(function (k) { return map[k] === sel; })[0];
        if (used && !confirm('「' + sel + '」은 다른 크림 로그인(' + used.replace(/(.{3}).*@/, '$1***@') + ')에 연결돼 있어요.\n지금 로그인한 계정도 「' + sel + '」로 저장할까요?')) throw new Error('취소했어요');
        map[em] = sel; LS('opsKrmMap', JSON.stringify(map));
      }
      $('oka').title = em;
    });
  }
  function run(ev) {
    if (busy) return; busy = true; $('okgo').disabled = true;
    if (ev && (!hubWin || hubWin.closed)) hubWin = window.open(HUB + '#kream', 'opsHub');   // 버튼 클릭 순간에 열어야 팝업이 안 막혀요
    var t0 = Date.now();
    checkAcct(ev).then(collect).then(function (res) {
      msg('OPS로 보내는 중… 입찰 ' + res.asks.length + ' · 거래 ' + res.sales.length);
      return send(res).then(function (r) {
        if (res.full) LS('opsKrmFull_' + res.account, '1');
        LS('opsKrmAcct', res.account);
        var tm = new Date().toTimeString().slice(0, 5);
        msg('완료 ' + tm + ' (' + Math.round((Date.now() - t0) / 1000) + '초)\n입찰중 ' + (r.asks || 0) + '건 · 거래 추가 ' + (r.salesAdded || 0) + ' / 갱신 ' + (r.salesUpdated || 0) + ($('okauto').checked ? '\n다음 자동 동기화 10분 뒤' : ''));
      });
    }).catch(function (e) { msg('⚠ ' + (e && e.message || e)); })
      .then(function () { busy = false; $('okgo').disabled = false; });
  }

  var saved = LS('opsKrmAcct'); if (saved) $('oka').value = saved;
  if (saved && !Object.keys(acctMap()).length) whoAmI().then(function (em) { if (em) { var m = {}; m[em] = saved; LS('opsKrmMap', JSON.stringify(m)); } }).catch(function () {});
  $('okgo').onclick = run;
  $('okauto').onchange = function () { clearInterval(timer); if (this.checked) timer = setInterval(run, EVERY); };
  timer = setInterval(run, EVERY);
  window.addEventListener('message', function (e) {   // 휴대폰 [지금 동기화] 요청 → OPS 창이 전달
    if (e.origin === HUB_ORIGIN && e.data && e.data.type === 'krm_run') { if (!hubWin || hubWin.closed) hubWin = e.source; run(); }
  });
  window.__opsKrm = { show: function () { box.style.display = ''; }, run: run };
  if (saved) run(); else msg('계정을 확인하고 [지금 동기화]를 눌러 주세요');
})();
