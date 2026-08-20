-- 018_techview_scan.sql — precomputed Tech View (기술분석) scanner verdict.
--
-- Feeds the Tech View tab's "터치 셋업 스캐너". Computed once a day by the worker
-- (sma200_scan.py → worker/lib/techview.py, a port of apps/web/lib/techview.ts)
-- from the split-adjusted daily+weekly bars it ALREADY fetches — zero extra
-- Alpaca cost. The per-ticker report (all levels + AI scenario) is computed on
-- demand by /api/techview instead.
--   tech_setup        : touch_confirmed | touch_pending | at_level | approaching
--                       | extended | no_structure
--   tech_nearest_*    : the closest 빗각/피보 line and its distance (%)
--   tech_target_upside: % upside to the unfilled gap zone (매도 목표)
--   tech_note         : short Korean headline (터치/근접 요약)

alter table public.sma200 add column if not exists tech_setup         text;
alter table public.sma200 add column if not exists tech_price         numeric;
alter table public.sma200 add column if not exists tech_nearest_label text;
alter table public.sma200 add column if not exists tech_nearest_dist  numeric;
alter table public.sma200 add column if not exists tech_target_upside numeric;
alter table public.sma200 add column if not exists tech_note          text;
alter table public.sma200 add column if not exists tech_at            timestamptz;
