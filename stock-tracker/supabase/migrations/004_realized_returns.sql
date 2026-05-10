-- 004_realized_returns.sql
--
-- Adds realized_1d/3d/5d to signals: ACTUAL forward returns measured after
-- the fact, by looking up the close price 1/3/5 trading days after the
-- signal fired and comparing to the price at signal time.
--
-- This complements the existing expected_1d/3d/5d which are PREDICTIONS
-- derived from analogue matching against historical signals — useful as
-- priors but not the same as measurement. Without realized_*, we cannot
-- compute win rate or mean realized return for any signal type, which
-- means we have no way to know whether our signals actually have edge.
--
-- realized_Nd is stored as a fraction: 0.012 = +1.2%, -0.034 = -3.4%.
-- Backfilled by worker/realize.py once a signal is at least 7 calendar
-- days old (≥ 5 trading days, enough for the 5d horizon).

alter table public.signals
  add column if not exists realized_1d numeric,
  add column if not exists realized_3d numeric,
  add column if not exists realized_5d numeric;

-- Composite index for the /api/signal-stats aggregation query: filter by
-- ts window + group by signal_type, only over rows where realized_1d is
-- populated. Partial index keeps it small.
create index if not exists signals_realized_ts_idx
  on public.signals (signal_type, session, ts desc)
  where realized_1d is not null;
