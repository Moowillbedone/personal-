-- The Next.js owner gate protects the API. Remove direct public reads too.
-- Server routes and scheduled workers use service_role and remain unaffected.
-- Apply together with STOCK_TRACKER_OWNER_PASSWORD before exposing this release.
begin;
drop policy if exists "trade_log_read_all" on public.trade_log;
drop policy if exists "position_overrides_read_all" on public.position_overrides;
drop policy if exists "position_settings_read_all" on public.position_settings;
drop policy if exists "watchlist_read_all" on public.watchlist;
drop policy if exists "ai_analysis_read_all" on public.ai_analysis;
revoke all on table public.trade_log, public.position_overrides,
  public.position_settings, public.watchlist, public.ai_analysis from anon, authenticated;
commit;
