-- 002_trade_features.sql
-- Adds tables for the on-demand trade-decision feature.
-- IMPORTANT: This migration does NOT modify any existing table from 001_initial.sql.
-- Run in Supabase SQL editor on the same project as the signal tracker.

-- ============================================================
-- 1. assets: full universe of US tradable equities (Alpaca /v2/assets)
--    Kept SEPARATE from `tickers` so the signal-tracker worker (which reads
--    `tickers` for the TOP200 universe) is not affected.
-- ============================================================
create table if not exists public.assets (
  symbol        text primary key,
  name          text,
  exchange      text,                       -- NASDAQ / NYSE / ARCA / AMEX / BATS / OTC
  asset_class   text,                       -- 'us_equity' / 'crypto' (we sync only us_equity)
  status        text,                       -- 'active' / 'inactive'
  tradable      boolean not null default true,
  fractionable  boolean,
  updated_at    timestamptz not null default now()
);

create index if not exists assets_symbol_prefix_idx on public.assets (symbol text_pattern_ops);
create index if not exists assets_name_idx on public.assets using gin (to_tsvector('simple', coalesce(name, '')));
create index if not exists assets_tradable_idx on public.assets (tradable, status) where tradable = true;

-- ============================================================
-- 2. watchlist: user's favorited tickers (single-user app, no auth yet)
-- ============================================================
create table if not exists public.watchlist (
  symbol     text primary key,
  added_at   timestamptz not null default now(),
  sort_order integer not null default 0
);

create index if not exists watchlist_sort_idx on public.watchlist (sort_order, added_at);

-- ============================================================
-- 3. ai_analysis: cached LLM verdicts so repeated clicks don't burn API quota
-- ============================================================
create table if not exists public.ai_analysis (
  id           uuid primary key default gen_random_uuid(),
  symbol       text not null,
  verdict      text not null check (verdict in ('buy', 'hold', 'sell')),
  confidence   numeric not null check (confidence >= 0 and confidence <= 1),
  summary      text not null,                  -- 2-3 sentence rationale
  bull_points  jsonb not null default '[]'::jsonb,  -- string[]
  bear_points  jsonb not null default '[]'::jsonb,  -- string[]
  context      jsonb not null default '{}'::jsonb,  -- inputs we sent: price, news_titles, etc.
  model        text not null,                   -- 'gemini-2.0-flash', 'gemini-flash-latest', etc.
  created_at   timestamptz not null default now()
);

create index if not exists ai_analysis_symbol_recent_idx on public.ai_analysis (symbol, created_at desc);

-- ============================================================
-- 4. position_settings: user's lump-sum / DCA budget per symbol (single-user)
-- ============================================================
create table if not exists public.position_settings (
  symbol           text primary key,
  strategy         text not null check (strategy in ('lump_sum', 'dca')),
  total_budget_krw numeric,                    -- for lump_sum: total ammo to deploy
  dca_per_day_krw  numeric,                    -- for dca: daily slice
  dca_total_days   integer,                    -- for dca: how many days planned
  updated_at       timestamptz not null default now()
);

-- ============================================================
-- 5. RLS: read-only public for assets/ai_analysis (anon UI can read).
--    Writes for watchlist/position_settings/ai_analysis go through API routes
--    using the service-role key, so anon write policies are NOT created.
-- ============================================================
alter table public.assets            enable row level security;
alter table public.watchlist         enable row level security;
alter table public.ai_analysis       enable row level security;
alter table public.position_settings enable row level security;

create policy "assets_read_all"      on public.assets            for select using (true);
create policy "watchlist_read_all"   on public.watchlist         for select using (true);
create policy "ai_analysis_read_all" on public.ai_analysis       for select using (true);
create policy "position_settings_read_all" on public.position_settings for select using (true);
