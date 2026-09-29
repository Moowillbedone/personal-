import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRiskBudget } from '../lib/riskBudget.ts';

const input = { equity: 10000, riskPercent: 0.5, entry: 100, stop: 95, target: 110, costBps: 10, maxAllocationPercent: 10 };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('risk sizing includes both entry and exit costs and respects cash cap', () => {
  const plan = calculateRiskBudget(input);
  assert.equal(plan.valid, true);
  assert.equal(plan.quantity, 9);
  near(plan.plannedLoss, 9 * (100.1 - 94.905));
  near(plan.netReward, 9 * (109.89 - 100.1));
  near(plan.netR, (109.89 - 100.1) / (100.1 - 94.905));
  assert.ok(plan.plannedLoss <= plan.riskBudget);
  assert.ok(plan.entryOutlay <= plan.cashBudget);
});

test('quantity is the smaller of cash and risk budgets, without borrowing', () => {
  const cash = calculateRiskBudget({ ...input, stop: 99, costBps: 0 });
  assert.equal(cash.quantity, 10);
  assert.equal(cash.limitingFactor, 'allocation');
  const risk = calculateRiskBudget({ ...input, stop: 80, costBps: 0 });
  assert.equal(risk.quantity, 2);
  assert.equal(risk.limitingFactor, 'risk');
});

test('sub-share budget does not round up to an unaffordable share', () => {
  const plan = calculateRiskBudget({ ...input, equity: 100 });
  assert.equal(plan.quantity, 0);
  assert.equal(plan.plannedLoss, 0);
});

test('invalid long geometry, non-finite inputs and invalid budgets are rejected', () => {
  for (const patch of [{ stop: 100 }, { stop: -5 }, { target: 99 }, { entry: NaN }, { equity: Infinity }, { riskPercent: 0 }, { maxAllocationPercent: 101 }, { costBps: 10000 }]) {
    assert.equal(calculateRiskBudget({ ...input, ...patch }).valid, false, JSON.stringify(patch));
  }
});

test('higher slippage worsens net R and cannot increase quantity', () => {
  const before = calculateRiskBudget(input);
  const after = calculateRiskBudget({ ...input, costBps: 100 });
  assert.ok(after.netR < before.netR);
  assert.ok(after.quantity <= before.quantity);
});

test('net reward can be negative despite a target above entry', () => {
  const plan = calculateRiskBudget({ ...input, target: 100.1, costBps: 100 });
  assert.equal(plan.valid, true);
  assert.ok(plan.netR < 0);
});
