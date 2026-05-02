-- Stock Tracker initial schema
-- Run this in Supabase SQL editor (or via supabase CLI) on a fresh project.

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. tickers: master list of stocks we track (top 100 NASDAQ + top 100 NYSE)
-- ============================================================
create table if not exists public.tickers (
  symbol        text primary key,
  exchange      text not null check (exchange in ('NASDAQ', 'NYSE')),
  name          text,
  market_cap    numeric,
  rank_in_exch  integer,
  is_active     boolean not null default true,
  updated_at    timestamptz not null default now()
);

create index if not exists tickers_exchange_rank_idx
  on public.tickers (exchange, rank_in_exch);

-- ============================================================
-- 2. price_snapshots: 5-min bars from the worker
-- ============================================================
create table if not exists public.price_snapshots (
  symbol     text not null references public.tickers(symbol) on delete cascade,
  ts         timestamptz not null,
  open       numeric not null,
  high       numeric not null,
  low        numeric not null,
  close      numeric not null,
  volume     bigint  not null,
  session    text not null check (session in ('pre', 'regular', 'after')),
  primary key (symbol, ts)
);

create index if not exists price_snapshots_symbol_ts_desc_idx
  on public.price_snapshots (symbol, ts desc);

-- ============================================================
-- 3. signals: detected gap / volume-spike events
-- ============================================================
create table if not exists public.signals (
  id              uuid primary key default gen_random_uuid(),
  symbol          text not null references public.tickers(symbol) on delete cascade,
  ts              timestamptz not null,
  signal_type     text not null check (signal_type in ('gap_up', 'gap_down', 'volume_spike')),
  price           numeric not null,
  pct_change      numeric not null,           -- vs previous close, e.g. 0.034 = +3.4%
  volume_ratio    numeric not null,           -- current vol / 20-bar avg
  session         text not null check (session in ('pre', 'regular', 'after')),
  -- expected return columns (filled by backtest script, nullable until computed)
  expected_1d     numeric,
  expected_3d     numeric,
  expected_5d     numeric,
  sample_size     integer,                    -- how many historical analogues used
  created_at      timestamptz not null default now()
);

create index if not exists signals_ts_desc_idx       on public.signals (ts desc);
create index if not exists signals_symbol_ts_idx     on public.signals (symbol, ts desc);
create index if not exists signals_type_idx          on public.signals (signal_type);

-- ============================================================
-- 4. RLS: read-only public access for the frontend
-- ============================================================
alter table public.tickers          enable row level security;
alter table public.price_snapshots  enable row level security;
alter table public.signals          enable row level security;

-- Anonymous users can read everything; only the service-role key (worker) can write.
create policy "tickers_read_all"
  on public.tickers for select using (true);

create policy "price_snapshots_read_all"
  on public.price_snapshots for select using (true);

create policy "signals_read_all"
  on public.signals for select using (true);

-- ============================================================
-- 5. Realtime: enable change broadcast for signals (live UI updates)
-- ============================================================
-- In Supabase dashboard: Database > Replication > add `signals` table to `supabase_realtime`.
-- Or run:
alter publication supabase_realtime add table public.signals;
