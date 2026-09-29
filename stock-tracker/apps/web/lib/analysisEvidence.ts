/** A saved analysis is a historical record; publishing its price scenario needs current evidence. */
export function hasCurrentPlanEvidence(context: unknown, nowMs = Date.now()): boolean {
  if (!context || typeof context !== "object") return false;
  const ctx = context as Record<string, unknown>;
  const quality = ctx.data_quality as { status?: string } | undefined;
  const asOf = typeof ctx.price_as_of === "string" ? Date.parse(ctx.price_as_of) : NaN;
  const age = nowMs - asOf;
  return ctx.methodology_version === "evidence-v1"
    && ctx.session === "regular"
    && quality?.status === "fresh"
    && typeof ctx.last_price === "number" && Number.isFinite(ctx.last_price) && ctx.last_price > 0
    && Number.isFinite(asOf) && age >= -60_000 && age <= 120_000;
}

export function publishAnalysis<T extends { context?: unknown }>(row: T, nowMs = Date.now()) {
  const context = row.context && typeof row.context === "object"
    ? row.context as Record<string, unknown> : {};
  const current = hasCurrentPlanEvidence(context, nowMs);
  return {
    ...row,
    context: {
      ...context,
      trade_plan: current ? context.trade_plan ?? null : null,
      plan_status: current ? "current_scenario" : "historical_only",
      execution_eligible: false,
    },
  };
}
