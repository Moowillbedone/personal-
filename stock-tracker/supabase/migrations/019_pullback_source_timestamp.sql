-- Do not backfill with pullback_at: that is a computation timestamp and says
-- nothing about the age of the last price bar. Legacy rows remain unverified.
alter table public.sma200
  add column if not exists pullback_bar_at timestamptz;

comment on column public.sma200.pullback_bar_at is
  'Open timestamp of the final completed 15-minute source bar used by pullback_intraday; NULL means provenance unavailable.';
