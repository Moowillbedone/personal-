-- 010: bound price_snapshots growth + speed up retention/liveness queries
--
-- Context: price_snapshots was the source of the free-tier blowout that
-- paused this project. Two SEPARATE limits, don't conflate them:
--   * EGRESS (5GB/mo bandwidth) — the actual thing that tripped the pause.
--     Cause: poll re-wrote the full 5-day × 200-symbol window every 5 min and
--     PostgREST echoed all ~100k rows back each cycle. Fixed IN CODE only
--     (worker/lib/db.py returning="minimal"; poll.py PERSIST_MAX_AGE_MIN).
--     Nothing in THIS file affects egress — egress resets each billing month.
--   * STORAGE (500MB DB) — a slower, separate concern. Bounded by the
--     retention below + the worker's daily db.prune_price_snapshots().
--
-- ── HOW TO RUN in the Supabase SQL editor ────────────────────────────────
-- The editor wraps a multi-statement run in ONE transaction, and VACUUM
-- cannot run in a transaction. So run STEP 1 (index + delete) as one shot,
-- then STEP 2 (vacuum) SEPARATELY, and only if storage is actually the
-- constraint. STEP 3 is optional automation.

-- ===== STEP 1 — paste + Run (safe together) ==============================
create index if not exists price_snapshots_ts_idx
  on public.price_snapshots (ts desc);

delete from public.price_snapshots
  where ts < now() - interval '7 days';
-- If this DELETE times out on a large backlog, delete oldest-first in chunks,
-- e.g. repeatedly:  delete from public.price_snapshots
--                   where ts < now() - interval '7 days'
--                   and ctid = any (array(
--                     select ctid from public.price_snapshots
--                     where ts < now() - interval '7 days' limit 100000));

-- ===== STEP 2 — OPTIONAL, run BY ITSELF (paste only this line, then Run) ==
-- Only worth it if the DB size (Dashboard → Settings → Usage, or
--   select pg_size_pretty(pg_database_size(current_database())); )
-- is near the 500MB cap. VACUUM FULL rewrites the table to actually return
-- disk to the OS (plain VACUUM does not). It takes an ACCESS EXCLUSIVE lock
-- and needs free headroom, so run it while the app is idle.
--   vacuum full analyze public.price_snapshots;

-- ===== STEP 3 — OPTIONAL nightly automation via pg_cron (free tier) =======
-- Belt-and-suspenders; the worker already prunes daily. Uncomment to enable:
-- create extension if not exists pg_cron;
-- select cron.schedule(
--   'prune_price_snapshots',
--   '0 8 * * *',  -- 08:00 UTC daily
--   $$delete from public.price_snapshots where ts < now() - interval '7 days'$$
-- );
