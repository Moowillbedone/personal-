-- 017_pullback_price.sql — store the price the 15m pullback verdict was computed
-- on, so the dashboard scanner shows a CONSISTENT snapshot (price + 되돌림 + the
-- 5-criterion verdict all as-of the same moment, pullback_at). Previously the
-- route overlaid a LIVE snapshot price on top of a ≤15-min-old verdict, which
-- looked inconsistent (price moved but the checkboxes didn't). Live/real-time
-- now lives only on the Trade tab.

alter table public.sma200 add column if not exists pullback_price numeric;
