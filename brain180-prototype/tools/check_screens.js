// Screen checker for the Brain180 prototype.
// usage: node tools/check_screens.js <built index.html> <out dir for screenshots> [SCREEN_ID ...]
// For every screen (or the listed ones): renders each allowed device and each tab with a persona that can see it,
// then reports console errors, PRD items without a pin on screen, pins without a PRD item, and horizontal overflow.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const [src, out, ...only] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  await p.goto('file://' + path.resolve(src));
  await p.waitForTimeout(300);
  const ids = only.length ? only : await p.evaluate(() => B.order.slice());
  const report = [];
  for (const id of ids) {
    const info = await p.evaluate(id => { const d = B.screens[id]; return d ? { devices: d.devices, tabs: (d.tabs || []).map(t => t.id), side: d.side } : null; }, id);
    if (!info) { report.push(`${id}: NOT REGISTERED`); continue; }
    const persona = info.side === 'hq' ? 'hq:super' : 'ct:daechi1:원장';
    const tabs = info.tabs.length ? info.tabs : [null];
    for (const dev of info.devices) {
      for (const tab of tabs) {
        const before = errs.length;
        const r = await p.evaluate(([id, dev, tab, persona]) => {
          B.state.mode = 'free'; B.state.persona = persona; B.state.device = dev;
          B.go(id, { tab: tab || undefined, device: dev, persona });
          const def = B.screens[id];
          const ctx = B.ctx(id);
          const items = (def.prd.items || []).filter(it => !it.tab || it.tab === ctx.tab);
          const pins = Array.from(document.querySelectorAll('#app [data-pin]')).map(e => Number(e.getAttribute('data-pin')));
          const missing = items.filter(it => !it.cond && !pins.includes(it.n)).map(it => it.n);
          const orphan = pins.filter(n => !items.some(it => it.n === n));
          const dup = pins.filter((n, i) => pins.indexOf(n) !== i);
          const main = document.querySelector('#app .main') || document.querySelector('#app .solo');
          const overflow = main ? main.scrollWidth - main.clientWidth : 0;
          const blank = !document.querySelector('#app').innerText.trim();
          return { missing, orphan, dup: Array.from(new Set(dup)), overflow, blank, nItems: items.length };
        }, [id, dev, tab, persona]);
        await p.waitForTimeout(80);
        const name = `${id}${tab ? '-' + tab : ''}-${dev}`;
        await p.screenshot({ path: path.join(out, name + '.png') });
        const problems = [];
        if (r.blank) problems.push('blank screen');
        if (r.nItems === 0) problems.push('no PRD items');
        if (r.missing.length) problems.push('PRD items without pin: ' + r.missing.join(','));
        if (r.orphan.length) problems.push('pins without PRD item: ' + r.orphan.join(','));
        if (r.dup.length) problems.push('duplicate pins: ' + r.dup.join(','));
        if (r.overflow > 2) problems.push('horizontal overflow ' + r.overflow + 'px');
        const newErrs = errs.slice(before);
        if (newErrs.length) problems.push('console: ' + newErrs.join(' | '));
        report.push(`${name}: ${problems.length ? problems.join('; ') : 'OK'}`);
      }
    }
  }
  console.log(report.join('\n'));
  await b.close();
})();
