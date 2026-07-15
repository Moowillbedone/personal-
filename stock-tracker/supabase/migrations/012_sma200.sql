-- 012_sma200.sql — precomputed 200-period SMA (daily + weekly) per symbol.
--
-- Feeds the dashboard "200일선 터치 스캐너". The worker (sma200_scan.py) refills
-- this once a day after the US close; the /api/sma200 route reads it + a live
-- snapshot to classify names sitting just above (매수) or just below (주의) their
-- 200-day / 200-week line. Kept tiny (~200 rows) so it never touches egress.

create table if not exists public.sma200 (
  symbol        text primary key references public.tickers(symbol) on delete cascade,
  sma200_daily  numeric,            -- null when < 200 daily bars (recent IPO)
  sma200_weekly numeric,            -- null when < 200 weekly bars (~4y history)
  last_close    numeric,            -- most recent daily close at compute time
  updated_at    timestamptz not null default now()
);

alter table public.sma200 enable row level security;

-- Read-only to the anon key (dashboard). Writes come from the service-role
-- worker, which bypasses RLS.
drop policy if exists "sma200_read_all" on public.sma200;
create policy "sma200_read_all" on public.sma200 for select using (true);
