const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
// Transpile only the pure helper; importing Next routes would need credentials.
const source = fs.readFileSync(path.join(__dirname, '../lib/performanceAudit.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', compiled)(mod, mod.exports, require);
const { fillMarkout, firstPerSymbolSession, mean, newYorkDate } = mod.exports;

test('buy reference gain can be a loss after a worse actual fill', () => {
  assert.ok(Math.abs(fillMarkout('buy', .1, 100, 120) - (-10 / 120)) < 1e-12);
});
test('sell markout is avoided price movement relative to actual fill', () => {
  assert.ok(Math.abs(fillMarkout('sell', -.1, 100, 95) - (5 / 95)) < 1e-12);
});
test('invalid and missing references do not become zero gains', () => {
  assert.equal(fillMarkout('buy', null, 100, 100), null);
  assert.equal(fillMarkout('buy', .1, null, 100), null);
  assert.equal(fillMarkout('buy', NaN, 100, 100), null);
  assert.equal(fillMarkout('buy', .1, 100, 0), null);
  assert.equal(mean([-.1, 0, .2, Infinity, NaN]), .1 / 3);
});
test('first observation by NY session remains stable across UTC midnight', () => {
  const rows = [
    { symbol: 'AAPL', ts: '2026-06-02T00:00Z', type: 'buy' },
    { symbol: 'AAPL', ts: '2026-06-01T20:00Z', type: 'buy' },
    { symbol: 'MSFT', ts: '2026-06-01T20:00Z', type: 'buy' },
    { symbol: 'AAPL', ts: '2026-06-01T20:00Z', type: 'sell' },
  ];
  const result = firstPerSymbolSession(rows, r => r.symbol, r => r.ts, r => r.type);
  assert.equal(result.length, 3);
  assert.ok(!result.includes(rows[0]));
  assert.equal(newYorkDate('garbage'), null);
});
