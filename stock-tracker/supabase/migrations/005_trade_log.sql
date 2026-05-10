-- 005_trade_log.sql
--
-- Trade journal: every buy/sell the user records, paper or real. The closed
-- loop the system has been missing — without this we know which signals
-- fired and what the AI recommended, but not what the user actually did
-- nor what came of it.
--
-- Schema choices:
--   - One row per transaction (no implicit position). Open position is
--     derived as sum(buys.qty) - sum(sells.qty) per (symbol, mode).
--   - mode separates 'paper' (simulated) from 'real' so realized P&L can
--     be computed independently for each — useful for letting AI pre-test
--     ideas in paper before risking capital.
--   - Optional FK to ai_analysis / signals so we can later answer
--     "did I act on AI buy recommendations? what was the realized return?"
--   - Cost basis uses weighted-average (computed in the API layer), not
--     FIFO, to keep the math obvious. Specific-lot matching can be added
--     later as a column without a schema break.

create table if not exists public.trade_log (
  id              uuid primary key default gen_random_uuid(),
  symbol          text not null,
  action          text not null check (action in ('buy', 'sell')),
  qty             numeric not null check (qty > 0),                 -- shares (fractional ok)
  price           numeric not null check (price > 0),               -- USD per share at execution
  mode            text not null default 'paper' check (mode in ('paper', 'real')),
  ts              timestamptz not null default now(),               -- when the trade happened
  notes           text,                                              -- free-form rationale
  ai_analysis_id  uuid references public.ai_analysis(id) on delete set null,
  signal_id       uuid references public.signals(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- Hot paths: per-symbol history (UI), per-symbol+mode position computation,
-- and time-windowed P&L aggregations on the stats page.
create index if not exists trade_log_symbol_ts_idx
  on public.trade_log (symbol, ts desc);
create index if not exists trade_log_symbol_mode_idx
  on public.trade_log (symbol, mode);
create index if not exists trade_log_ts_desc_idx
  on public.trade_log (ts desc);

-- RLS: read-only public (single-user app, no per-user filtering needed yet).
-- Writes go through API routes using the service-role key, same pattern as
-- ai_analysis and watchlist.
alter table public.trade_log enable row level security;
create policy "trade_log_read_all" on public.trade_log for select using (true);
