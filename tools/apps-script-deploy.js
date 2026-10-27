/* Apps Script 편집기(셀렉트인 OPS) 탭 콘솔에서 실행: 최신 허브.gs 반영 → 저장 → 배포 관리 → 새 버전 배포
 * 사용: await __opsDeploy('OPS.V22')   (sha 생략 시 main) */
window.__opsDeploy = async function (desc, sha) {
  var W = ms => new Promise(r => setTimeout(r, ms));
  var fire = el => ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(t => el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })));
  var vis = e => e.getClientRects().length > 0, nm = e => (e.textContent || '').replace(/[-\s]/g, '');
  var all = (sel, root) => [...(root || document).querySelectorAll(sel)].filter(vis);
  var src = await (await fetch('https://raw.githubusercontent.com/select-in/sales-app/' + (sha || 'main') + '/apps-script/%ED%97%88%EB%B8%8C.gs?v=' + Date.now(), { cache: 'no-store' })).text();
  if (src.indexOf('function doPost') < 0) return 'bad source';
  monaco.editor.getModels()[0].setValue(src);
  var sv = all('[aria-label="Drive에 프로젝트 저장"]')[0]; if (sv) fire(sv); await W(3000);
  var dep = all('[role=button],button').filter(e => nm(e) === '배포' || nm(e).indexOf('배포새배포') === 0)[0];   // 메뉴가 버튼 안에 들어 있어 글자가 붙어 나옴 if (!dep) return 'no deploy btn'; fire(dep); await W(900);
  var mi = all('[role=menuitem]').filter(e => nm(e).indexOf('배포관리') >= 0)[0]; if (!mi) return 'no menu'; fire(mi); await W(2500);
  var dlg = all('[role=dialog]').pop(); if (!dlg) return 'no dialog';
  var ed = all('[aria-label]', dlg).filter(e => /수정|Edit/.test(e.getAttribute('aria-label')))[0]; if (!ed) return 'no edit'; fire(ed); await W(1500);
  var cb = [...dlg.querySelectorAll('[role=combobox]')].filter(e => nm(e).indexOf('버전') === 0)[0]; if (!cb) return 'no combobox'; fire(cb); await W(900);
  var li = [...document.querySelectorAll('li,[role=option]')].filter(e => nm(e) === '새버전')[0]; if (!li) return 'no new version'; fire(li); await W(900);
  var inp = all('input,textarea', dlg).filter(e => e.type !== 'hidden' && e.type !== 'checkbox')[0];
  if (inp) { inp.focus(); inp.select(); document.execCommand('insertText', false, desc); }
  await W(400);
  var db = all('[role=button],button', dlg).filter(e => nm(e) === '배포')[0]; if (!db) return 'no deploy in dialog'; fire(db);
  for (var i = 0; i < 25; i++) {
    await W(1000); var d2 = all('[role=dialog]').pop(), t = (d2 || {}).textContent || '';
    if (/업데이트되었습니다/.test(t)) { var m = t.match(/버전 (\d+)\(/); var done = all('[role=button],button', d2).filter(e => nm(e) === '완료')[0]; if (done) fire(done); return 'deployed v' + (m ? m[1] : '?') + ' (' + src.length + ' chars)'; }
  }
  return 'timeout';
};
