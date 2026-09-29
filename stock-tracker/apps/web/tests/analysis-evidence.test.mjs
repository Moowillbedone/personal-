import test from "node:test";
import assert from "node:assert/strict";
import { hasCurrentPlanEvidence, publishAnalysis } from "../lib/analysisEvidence.ts";

const now = Date.parse("2026-09-29T14:00:00Z");
const context = {
  methodology_version: "evidence-v1", session: "regular", last_price: 100,
  price_as_of: "2026-09-29T13:59:00Z", data_quality: { status: "fresh" },
  trade_plan: { stop: 95, target_1: 110 },
};
test("only current versioned source evidence can publish a price scenario", () => {
  assert.equal(hasCurrentPlanEvidence(context, now), true);
  for (const change of [
    { methodology_version: undefined }, { price_as_of: undefined },
    { price_as_of: "2026-09-29T13:57:00Z" }, { price_as_of: "2026-09-29T14:02:00Z" },
    { session: "closed" }, { data_quality: { status: "partial" } },
    { last_price: 0 }, { last_price: NaN },
  ]) assert.equal(hasCurrentPlanEvidence({ ...context, ...change }, now), false);
});
test("expired analysis retains its history but loses actionable prices without mutating storage", () => {
  const row = { id: "old", summary: "original evidence", context };
  const current = publishAnalysis(row, now);
  assert.deepEqual(current.context.trade_plan, context.trade_plan);
  const expired = publishAnalysis(row, now + 121_000);
  assert.equal(expired.context.trade_plan, null);
  assert.equal(expired.context.plan_status, "historical_only");
  assert.equal(expired.context.execution_eligible, false);
  assert.equal(expired.summary, row.summary);
  assert.ok(row.context.trade_plan);
  assert.equal(publishAnalysis({ context: null }, now).context.trade_plan, null);
});
