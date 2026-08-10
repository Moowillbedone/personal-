-- 016_pullback_intraday.sql — the dashboard 눌림목 스캐너 is now INTRADAY (15분봉),
-- recomputed every ~15 min during the US session (incl. pre-market) instead of
-- once a day on the daily bar. It reuses the pullback_class/pullback_retrace/
-- pullback_grades columns from 015 (their meaning shifts from daily → 15m), and
-- adds a timestamp so the panel can show how fresh the read is.
--
-- 15m is the shortest timeframe our free consolidated tape supports: bars are
-- ~15 min delayed, so anything shorter is defeated by the delay. Batched
-- multi-symbol fetches keep 200-name recomputes far below any overload line.

alter table public.sma200 add column if not exists pullback_at timestamptz;
