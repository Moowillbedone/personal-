-- 014_ichimoku_spans.sql — Ichimoku (일목균형표) Leading Span A/B per symbol.
--
-- Feeds the "선행스팬 B 터치 스캐너". Both spans are the values AS DISPLAYED at
-- the latest bar — i.e. computed 26 bars ago and projected forward (that forward
-- projection is exactly the cloud level price touches today). Computed by the
-- same worker (sma200_scan.py) from bars it already fetches — zero extra cost.
-- Span A + Span B together give the cloud: floor = min(A,B), ceiling = max(A,B),
-- so the /api/ichimoku route can also say whether price is above / in / below
-- the Kumo (구름), and whether Span B is acting as support or resistance.

alter table public.sma200 add column if not exists spana_daily  numeric;
alter table public.sma200 add column if not exists spanb_daily  numeric;
alter table public.sma200 add column if not exists spana_weekly numeric;
alter table public.sma200 add column if not exists spanb_weekly numeric;
