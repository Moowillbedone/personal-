-- 007_ai_analysis_realized.sql
--
-- Adds realized forward returns to ai_analysis so we can measure whether
-- AI verdicts have edge — without this, the BUY/SELL/HOLD recommendations
-- coming out of /api/analyze (and the new daily AI-scan worker) are
-- output but never scored.
--
-- realized_Nd is stored as a fraction (0.012 = +1.2%, -0.034 = -3.4%),
-- computed as (close[N trading days after analysis] - context.last_price)
-- / context.last_price. context.last_price already exists in the JSONB
-- payload — no need to copy it into a separate column.
--
-- Backfilled by worker/ai_realize.py once an analysis is at least
--   1d horizon: 2 calendar days old
--   3d horizon: 5 calendar days old
--   5d horizon: 7 calendar days old  ← gating "5d filled" milestone
--   30d horizon: 35 calendar days old (separate gating)

alter table public.ai_analysis
  add column if not exists realized_1d  numeric,
  add column if not exists realized_3d  numeric,
  add column if not exists realized_5d  numeric,
  add column if not exists realized_30d numeric;

-- Partial index for the /api/ai-stats aggregation: filter to measured
-- rows + group by verdict, sort by recency. Small because most rows in
-- the early days won't have realized data yet.
create index if not exists ai_analysis_realized_idx
  on public.ai_analysis (verdict, created_at desc)
  where realized_1d is not null;
