import test from 'node:test';
import assert from 'node:assert/strict';
import { mechanicalPlan, sanitizeTradePlan } from '../lib/tradePlan.ts';
import { prescribe, regimeAdvice } from '../lib/prescription.ts';

test('rounding cannot collapse stop and entry into the same price', () => {
  const fallback = mechanicalPlan(100, 2, null);
  const result = sanitizeTradePlan({ entry_low: 100.004, entry_high: 100.005, stop: 100.003, target_1: 110, target_2: 120 }, 100, fallback);
  assert.deepEqual(result, fallback);
});

test('mechanical plans reject unusable ATR and preserve strict stop/entry/target ordering', () => {
  assert.equal(mechanicalPlan(100, 50, null), null);
  assert.equal(mechanicalPlan(100, 0.01, null), null);
  const plan = mechanicalPlan(100, 2, 99.5);
  assert.ok(plan.stop < plan.entry_low);
  assert.ok(plan.entry_high < plan.target_1);
});

test('drawdown never authorizes averaging down regardless of regime or tranche capacity', () => {
  for (const regime of ['risk_on', 'neutral', 'risk_off', null]) {
    const rx = prescribe({ unrealizedPct: -0.25, buyFillCount: 1, openQty: 10, regime });
    assert.equal(rx.level, 'avg_blocked');
  }
  assert.equal(prescribe({ unrealizedPct: NaN, buyFillCount: 1, openQty: 10, regime: 'risk_on' }).badge, '가격 대기');
});

test('holding-period daily reset reminder applies only to an identified leveraged product', () => {
  const input = { unrealizedPct: 0, buyFillCount: 1, openQty: 10, regime: 'neutral', firstBuyTs: '2026-01-01' };
  const now = new Date('2026-02-01');
  assert.equal(prescribe(input, undefined, now).level, 'hold');
  assert.equal(prescribe({ ...input, isLeveraged: true }, undefined, now).level, 'time_decay');
  assert.ok(!regimeAdvice('risk_on').advice.includes('롱 방향 우위'));
});
