import test from 'node:test';
import assert from 'node:assert/strict';
import { accountTrades } from '../lib/positionAccounting.ts';

const trade = (action, qty, price, day) => ({ action, qty, price, ts: `2026-01-${String(day).padStart(2, '0')}T15:00:00Z` });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('re-entry never changes realized profit of a previously closed cycle', () => {
  const history = [trade('buy', 10, 100, 1), trade('sell', 10, 120, 2), trade('buy', 10, 200, 3)];
  const result = accountTrades(history.reverse());
  assert.equal(result.realizedPnl, 200);
  assert.equal(result.avgBuyPrice, 200);
  assert.equal(result.costBasisOpen, 2000);
  assert.deepEqual(result.closedCycles, [{ ts: trade('sell', 10, 120, 2).ts, pnl: 200 }]);
});

test('partial sales preserve remaining basis and new purchases affect only future sells', () => {
  const result = accountTrades([trade('buy', 10, 100, 1), trade('sell', 5, 120, 2), trade('buy', 5, 200, 3), trade('sell', 5, 160, 4)]);
  assert.equal(result.realizedEvents[0].pnl, 100);
  assert.equal(result.realizedEvents[1].pnl, 50);
  assert.equal(result.realizedPnl, 150);
  assert.equal(result.avgBuyPrice, 150);
  assert.equal(result.costBasisOpen, 750);
});

test('completed cycles count independently, including breakeven cycles', () => {
  const result = accountTrades([trade('buy', 1, 100, 1), trade('sell', 1, 100, 2), trade('buy', 1, 200, 3), trade('sell', 1, 210, 4)]);
  assert.equal(result.closedCycles.length, 2);
  assert.equal(result.realizedPnl, 10);
  assert.equal(result.openQty, 0);
  assert.equal(result.avgBuyPrice, null);
});

test('missing basis and short sales cannot manufacture realized profit', () => {
  assert.throws(() => accountTrades([trade('sell', 1, 120, 1)]), /매수 기록/);
  assert.throws(() => accountTrades([trade('buy', 1, 100, 1), trade('sell', 2, 120, 2)]), /매수 기록/);
  assert.throws(() => accountTrades([trade('sell', 1, 120, 1), trade('buy', 1, 100, 2)]), /매수 기록/);
});

test('fractional fills close cleanly within floating point tolerance', () => {
  const result = accountTrades([trade('buy', 0.1, 100, 1), trade('buy', 0.2, 100, 2), trade('sell', 0.3, 110, 3)]);
  assert.equal(result.openQty, 0);
  assert.equal(result.costBasisOpen, 0);
  near(result.realizedPnl, 3);
});

test('invalid prices or timestamps do not silently poison accounting', () => {
  assert.throws(() => accountTrades([trade('buy', 1, NaN, 1)]));
  assert.throws(() => accountTrades([{ ...trade('buy', 1, 100, 1), ts: 'invalid' }]));
});
