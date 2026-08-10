-- 015_pullback_scan.sql — precomputed DAILY 눌림목(pullback) classification.
--
-- Feeds the dashboard "눌림목 스캐너". Computed once a day by the worker
-- (sma200_scan.py → worker/lib/pullback.py, a port of the Trade-tab TS engine),
-- from the daily bars it already fetches — so scanning 200 names costs nothing
-- extra and never hits the per-request Alpaca fetch storm we removed.
--   pullback_class  : 'pullback' | 'forming' | 'downtrend' | 'no_uptrend' | null
--   pullback_retrace: retrace depth of the up-leg (0..1+), null if n/a
--   pullback_grades : "trend,volume,structure,support,confirmation" grades
--                     e.g. "pass,warn,warn,pass,warn"

alter table public.sma200 add column if not exists pullback_class    text;
alter table public.sma200 add column if not exists pullback_retrace  numeric;
alter table public.sma200 add column if not exists pullback_grades   text;
