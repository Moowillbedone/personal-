-- 013_sma200_sector.sql — add a sector label to the SMA200 scanner rows.
--
-- Stores finnhubIndustry (e.g. 'Semiconductors', 'Banking', 'Oil & Gas') so the
-- dashboard can show which sector each near-the-200-line name belongs to. The
-- worker (sma200_scan.py) fills it incrementally — only for symbols that don't
-- already have one — so it costs ~0 Finnhub calls after the first run. The
-- panel maps the raw industry string to a Korean label at render time.

alter table public.sma200 add column if not exists sector text;
