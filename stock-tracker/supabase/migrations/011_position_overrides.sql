-- 011: manual average-cost override per symbol (2026-07)
--
-- Why: positions are DERIVED from trade_log fills (weighted-avg cost). When
-- the journal is incomplete (e.g. a buy/sell that was never recorded), the
-- derived 평단 is wrong, and the dashboard prescription (익절/물타기/손절
-- lines are computed from currentPrice ÷ avgCost) is then wrong too. This
-- table lets the user pin the correct current average cost for a symbol; the
-- dashboard's 내 포지션 처방 uses it as the prescription basis when present.
--
-- Scope: dashboard prescription ONLY. It intentionally does NOT rewrite
-- trade_log or /stats realized-P&L (those stay an immutable audit trail).
-- Clearing the override (DELETE) reverts to the derived average.
--
-- Run once in the Supabase SQL editor.
create table if not exists public.position_overrides (
  symbol      text primary key,
  avg_cost    numeric not null check (avg_cost > 0),
  note        text,
  updated_at  timestamptz not null default now()
);

alter table public.position_overrides enable row level security;

-- Reads open to anon (consistent with the other public tables); all writes
-- go through the service-role API route, which bypasses RLS.
create policy "position_overrides_read_all"
  on public.position_overrides for select using (true);
