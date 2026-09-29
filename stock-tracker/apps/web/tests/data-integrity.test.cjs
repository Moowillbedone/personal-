const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const modules = new Map();
function load(name) {
  const file = path.resolve(__dirname, '../lib', name.endsWith('.ts') ? name : `${name}.ts`);
  if (modules.has(file)) return modules.get(file).exports;
  const mod = { exports: {} };
  modules.set(file, mod);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('module', 'exports', 'require', compiled)(mod, mod.exports,
    (name) => name.startsWith('.') ? load(name) : require(name));
  return mod.exports;
}
const calendar = load('marketCalendar');
const quality = load('dataQuality');
const alpaca = load('alpaca');
const { preferNewerSnapshot } = load('marketData');

test('NYSE holidays and half days are not classified as ordinary open sessions', () => {
  for (const date of ['2026-01-01', '2026-04-03', '2026-06-19', '2026-07-03', '2026-11-26', '2026-12-25']) {
    assert.equal(calendar.isTradingDate(date), false, date);
    assert.equal(calendar.scheduledMarketSession(new Date(`${date}T15:00:00Z`)), 'closed');
  }
  assert.equal(calendar.scheduledMarketSession(new Date('2026-11-27T18:01:00Z')), 'after');
  assert.equal(calendar.scheduledMarketSession(new Date('2026-11-27T22:01:00Z')), 'closed');
  assert.equal(calendar.scheduledMarketSession(new Date('2026-09-29T13:31:00Z')), 'regular');
  assert.equal(calendar.scheduledMarketSession(new Date('2026-01-05T14:31:00Z')), 'regular');
});

test('completed daily windows exclude today until the delayed closing bar can exist', () => {
  const bars = [{ ts: '2026-09-28T04:00:00Z', c: 100 }, { ts: '2026-09-29T04:00:00Z', c: 105 }];
  assert.equal(quality.completedDailyBars(bars, new Date('2026-09-29T19:00Z')).length, 1);
  assert.equal(quality.completedDailyBars(bars, new Date('2026-09-29T20:21Z')).length, 2);
  assert.equal(calendar.lastCompletedTradingDate(new Date('2026-07-06T13:00Z')), '2026-07-02');
});

test('missing and future timestamps never qualify as current prices', () => {
  const now = new Date('2026-09-29T15:00Z');
  assert.equal(quality.timestampQuality(null, 120000, now).status, 'unavailable');
  assert.equal(quality.timestampQuality('2026-09-29T15:03Z', 120000, now).status, 'unavailable');
  assert.equal(quality.snapshotQuality('2026-09-29T14:50Z', 100, 'regular', now).status, 'stale');
  assert.equal(quality.snapshotQuality('2026-09-29T14:59Z', NaN, 'regular', now).status, 'unavailable');
  assert.equal(quality.scannerQuality(now.toISOString(), true, 'regular', now).status, 'partial');
});

test('an old or short daily history cannot produce a current 200-day regime', () => {
  const now = new Date('2026-09-29T15:00Z');
  const history = Array.from({ length: 200 }, () => ({ ts: '2026-09-25T04:00Z', c: 100 }));
  assert.equal(quality.dailyBarsQuality(history, 200, now).status, 'stale');
  assert.equal(quality.dailyBarsQuality([{ ts: '2026-09-28T04:00Z', c: 100 }], 200, now).status, 'unavailable');
});

test('an ask-only snapshot is not presented as a trade', () => {
  const snapshot = alpaca.normalizeSnapshot('AAPL', { latestQuote: { ap: 105, bp: 99, t: new Date().toISOString() } });
  assert.equal(snapshot.lastPrice, null);
  assert.equal(snapshot.lastTradeTs, null);
  assert.equal(snapshot.dataQuality.status, 'unavailable');
});

test('fallback cannot replace a newer price with stale, missing-time or future data', () => {
  const now = new Date('2026-09-29T15:00Z');
  const base = { lastPrice: 100, lastTradeTs: '2026-09-29T14:59Z' };
  for (const lastTradeTs of ['2026-09-28T20:00Z', null, '2026-09-29T16:00Z']) {
    assert.equal(preferNewerSnapshot(base, { lastPrice: 101, lastTradeTs }, now), base);
  }
  assert.equal(preferNewerSnapshot(base, { lastPrice: 101, lastTradeTs: '2026-09-29T15:00Z' }, now).lastPrice, 101);
  assert.equal(preferNewerSnapshot({ lastPrice: 99, lastTradeTs: '2026-09-29T16:00Z' }, base, now), base);
  assert.equal(preferNewerSnapshot({ lastPrice: NaN, lastTradeTs: '2026-09-29T15:00Z' }, base, now), base);
});

test('historical fetch requests the latest bounded SIP window, filters invalid bars and returns ascending time', async () => {
  const original = global.fetch;
  const env = [process.env.ALPACA_KEY_ID, process.env.ALPACA_SECRET];
  process.env.ALPACA_KEY_ID = 'test'; process.env.ALPACA_SECRET = 'test';
  let requested;
  global.fetch = async (url) => {
    requested = new URL(url);
    return { ok: true, json: async () => ({ bars: [
      { t: '2026-09-29T14:30Z', o: 100, h: 102, l: 99, c: 101, v: 500 },
      { t: '2026-09-29T14:25Z', o: 100, h: 102, l: 99, c: 0, v: 500 },
      { t: '2026-09-29T14:20Z', o: 99, h: 101, l: 98, c: 100, v: 600 },
    ] }) };
  };
  try {
    const bars = await alpaca.fetchAlpacaBars('AAPL', '5Min', 5, 600, 'split');
    assert.equal(requested.searchParams.get('sort'), 'desc');
    assert.equal(requested.searchParams.get('feed'), 'sip');
    assert.equal(requested.searchParams.get('adjustment'), 'split');
    assert.ok(Date.now() - Date.parse(requested.searchParams.get('end')) >= 16 * 60000);
    assert.deepEqual(bars.map((b) => b.c), [100, 101]);
  } finally {
    global.fetch = original;
    for (const [i, key] of ['ALPACA_KEY_ID', 'ALPACA_SECRET'].entries()) {
      if (env[i] == null) delete process.env[key]; else process.env[key] = env[i];
    }
  }
});
