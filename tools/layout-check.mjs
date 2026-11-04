// OPS PC/MO 레이아웃 점검
// 사용: node tools/layout-check.mjs [파일경로 또는 URL ...]
//   기본 대상: docs/ops_admin/index.html
// 점검: 폭 1280·1366(PC) / 375·390(MO)에서 가로 넘침, 화면 밖 요소, 스크립트 오류
// 실패 시 종료코드 1, 스크린샷은 layout-report/ 에 저장
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const VIEWPORTS = [
  { name: 'PC-1366', width: 1366, height: 768, mobile: false },
  { name: 'PC-1280', width: 1280, height: 800, mobile: false },
  { name: 'MO-390', width: 390, height: 844, mobile: true },
  { name: 'MO-375', width: 375, height: 667, mobile: true },
];
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['docs/ops_admin/index.html'];
const outDir = 'layout-report';
fs.mkdirSync(outDir, { recursive: true });

// 외부 서버 호출(Apps Script 등)은 점검 중 막아 실데이터에 영향이 없게 한다
const BLOCK = /script\.google\.com|script\.googleusercontent\.com|sabangnet|kream|poizon/i;

function toUrl(t) {
  if (/^https?:\/\//.test(t)) return t;
  return pathToFileURL(path.resolve(t)).href;
}

// CI는 기본 브라우저, 로컬은 설치된 Chromium 경로를 선택할 수 있습니다.
const browser = await chromium.launch(process.env.OPS_CHROMIUM_EXECUTABLE ? { executablePath: process.env.OPS_CHROMIUM_EXECUTABLE } : {});
let failed = 0;
const lines = [];

for (const t of targets) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: vp.mobile ? 2 : 1,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message || e)));
    if (!/^https?:/.test(t)) await page.route(BLOCK, r => r.abort());
    try {
      await page.goto(toUrl(t), { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(800);
    } catch (e) {
      errors.push('열기 실패: ' + e.message);
    }
    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const W = de.clientWidth;
      const over = [];
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
        // 가로 스크롤 영역 안의 요소는 허용
        let p = el.parentElement, scrollable = false;
        while (p && p !== document.body) {
          const o = getComputedStyle(p).overflowX;
          if (o === 'auto' || o === 'scroll' || o === 'hidden') { scrollable = true; break; }
          p = p.parentElement;
        }
        if (scrollable) continue;
        const b = el.getBoundingClientRect();
        if (b.width > 0 && b.right > W + 1) {
          const id = el.id ? '#' + el.id : (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '');
          over.push(`${el.tagName.toLowerCase()}${id} (+${Math.round(b.right - W)}px)`);
        }
      }
      return { scrollW: de.scrollWidth, W, over: over.slice(0, 8), overCount: over.length };
    });
    const hScroll = r.scrollW > r.W + 1;
    const ok = !hScroll && r.overCount === 0 && errors.length === 0;
    const shot = path.join(outDir, `${t.replace(/^https?:\/\//,'').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g,'')}-${vp.name}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    lines.push(`${ok ? '✅' : '❌'} ${vp.name.padEnd(8)} ${t}` +
      (hScroll ? `  가로넘침 ${r.scrollW - r.W}px` : '') +
      (r.overCount ? `  화면밖 ${r.overCount}개: ${r.over.join(', ')}` : '') +
      (errors.length ? `  스크립트오류 ${errors.length}: ${errors[0].slice(0, 120)}` : ''));
    if (!ok) failed++;
    await ctx.close();
  }
}
await browser.close();
console.log(lines.join('\n'));
console.log(failed ? `\n점검 실패 ${failed}건 — 고친 뒤 다시 점검하세요. 스크린샷: ${outDir}/` : `\nPC·MO 모두 통과. 스크린샷: ${outDir}/`);
process.exit(failed ? 1 : 0);
