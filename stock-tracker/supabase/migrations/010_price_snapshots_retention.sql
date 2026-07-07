-- 010: bound price_snapshots growth + speed up retention/liveness queries
--
-- Context: price_snapshots was the source of the free-tier blowout that
-- paused this project. Two problems, two fixes:
--   1) EGRESS — the poll worker re-wrote the full 5-day × 200-symbol window
--      every 5 min and PostgREST echoed all ~100k rows back each cycle.
--      Fixed in code (worker/lib/db.py: returning="minimal";
--      worker/poll.py: persist only bars < PERSIST_MAX_AGE_MIN old).
--   2) STORAGE — the table grew unbounded (~38k new rows/day) toward the
--      500MB DB cap. Fixed by the retention below + worker daily prune
--      (refresh_universe.py calls db.prune_price_snapshots()).
--
-- Run this ONCE in the Supabase SQL editor after restoring the project.

-- 1) Index on ts alone. Serves both the retention DELETE (ts < cutoff) and
--    health_check's global "latest bar" probe (order by ts desc limit 1),
--    neither of which the existing (symbol, ts) composite index can satisfy
--    efficiently.
create index if not exists price_snapshots_ts_idx
  on public.price_snapshots (ts desc);

-- 2) ONE-TIME cleanup of the backlog that bloated the table. Keeps 7 days.
--    If the table is very large this DELETE may take a while and generate a
--    lot of WAL — run it in the SQL editor, not via the API. Safe to re-run.
--    (For a huge table you can loop in smaller batches, e.g. delete the
--    oldest month first, but a single statement is usually fine.)
delete from public.price_snapshots
  where ts < now() - interval '7 days';

-- After a large delete, reclaim space + refresh planner stats.
-- (VACUUM cannot run inside a transaction block; run this line on its own.)
vacuum analyze public.price_snapshots;

-- 3) OPTIONAL — automate nightly retention with pg_cron (included on Supabase
--    free tier) so pruning happens even if the worker misses a day. The
--    worker already prunes daily, so this is belt-and-suspenders. Uncomment:
-- create extension if not exists pg_cron;
-- select cron.schedule(
--   'prune_price_snapshots',
--   '0 8 * * *',  -- 08:00 UTC daily
--   $$delete from public.price_snapshots where ts < now() - interval '7 days'$$
-- );
