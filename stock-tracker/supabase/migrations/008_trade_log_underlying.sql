-- 008_trade_log_underlying.sql
--
-- Adds underlying_symbol to trade_log so the user can record trades on a
-- leveraged ETF (e.g. TSLL) while still linking the action to the
-- underlying asset the AI analyzed and the signal fired on (TSLA).
--
-- Without this column the trade journal had two bad options:
--   - Record at the underlying's price (broken P&L — user actually paid
--     a different price for a different number of shares of TSLL)
--   - Record at the leverage ticker's price (clean P&L but loses the
--     link back to "this was AI's TSLA BUY recommendation")
-- Both at once via this column keeps each stat layer clean: AI verdict
-- accuracy and signal realized returns measure the underlying; user
-- P&L measures the actually-traded instrument.
--
-- nullable: existing rows have null, future rows where the user is
-- trading the underlying directly also have null (treated as
-- underlying_symbol == symbol).

alter table public.trade_log
  add column if not exists underlying_symbol text;

-- Composite index for the future "AI BUY recs → my leverage trades"
-- analysis query (group by underlying, filter ai_analysis_id not null).
create index if not exists trade_log_underlying_idx
  on public.trade_log (underlying_symbol, ts desc)
  where underlying_symbol is not null;
