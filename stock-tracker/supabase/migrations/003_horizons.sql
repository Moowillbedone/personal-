-- 003_horizons.sql
-- Adds the `horizons` jsonb column on ai_analysis for multi-timeframe verdicts.
-- Existing columns (verdict / confidence / summary / bull_points / bear_points)
-- continue to represent the SHORT-TERM (single-day to 1-week) opinion.
-- The new column carries 3-month / 6-month / 1-year opinions:
--
--   horizons := {
--     "three_month": { "verdict": "buy"|"hold"|"sell", "confidence": number,
--                      "summary": text, "key_points": text[] },
--     "six_month":   { ... same shape ... },
--     "one_year":    { ... same shape ... }
--   }
--
-- jsonb is preferred over per-horizon columns so the schema stays flexible
-- if we add 2y/5y or other horizons later.

alter table public.ai_analysis
  add column if not exists horizons jsonb default '{}'::jsonb;

create index if not exists ai_analysis_horizons_gin_idx
  on public.ai_analysis using gin (horizons);
