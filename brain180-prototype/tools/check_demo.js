// Demo guide checker. usage: node tools/check_demo.js <built index.html> <out dir> [--shots]
// Steps through every demo step with B.demoGo(i) and reports: console errors, unknown screen, missing focus pins,
// empty narration, and whether the "next" button works from the toolbar.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const [src, out, flag] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  await p.goto('file://' + path.resolve(src));
  await p.waitForTimeout(300);
  const n = await p.evaluate(() => B.demoSteps.length);
  const lines = [];
  for (let i = 0; i < n; i++) {
    const before = errs.length;
    const r = await p.evaluate(i => {
      B.demoGo(i);
      const s = B.demoSteps[i];
      const def = B.screens[s.screen];
      const missing = (s.pins || []).filter(x => !document.querySelector('#app [data-pin="' + x + '"]'));
      return {
        screen: s.screen, ok: !!def, missing, title: s.title, say: (s.say || '').length, persona: s.persona,
        device: B.state.device, devOk: def ? def.devices.includes(s.device || def.devices[0]) : false,
        cur: B.state.screenId, perm: def ? B.perm(s.screen, B.persona(s.persona)) : '?',
      };
    }, i);
    await p.waitForTimeout(60);
    if (flag === '--shots') await p.screenshot({ path: path.join(out, `step-${String(i + 1).padStart(2, '0')}.png`) });
    const probs = [];
    if (!r.ok) probs.push('unknown screen ' + r.screen);
    if (r.cur !== r.screen) probs.push('landed on ' + r.cur);
    if (r.missing.length) probs.push('focus pins not on screen: ' + r.missing.join(','));
    if (r.say < 30) probs.push('narration too short');
    if (!r.devOk) probs.push('device not allowed');
    if (r.perm === '–') probs.push('persona cannot see this screen');
    const e = errs.slice(before); if (e.length) probs.push('console: ' + e.join(' | '));
    lines.push(`${String(i + 1).padStart(2, '0')} ${r.screen} ${r.title}: ${probs.length ? probs.join('; ') : 'OK'}`);
  }
  // toolbar next/prev
  await p.evaluate(() => B.demoGo(0));
  await p.click('#nextBtn');
  const step = await p.evaluate(() => B.state.step);
  lines.push('toolbar next from step 1 lands on step ' + (step + 1) + (step === 1 ? ' OK' : ' FAIL'));
  await p.keyboard.press('ArrowLeft');
  const step2 = await p.evaluate(() => B.state.step);
  lines.push('keyboard left goes back to step ' + (step2 + 1) + (step2 === 0 ? ' OK' : ' FAIL'));
  console.log(lines.join('\n'));
  await b.close();
})();
