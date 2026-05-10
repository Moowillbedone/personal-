-- 006_signal_news.sql
--
-- News-correlation enrichment on signals. The poll worker now fetches the
-- last ~30 min of headlines for any symbol that just fired a signal and
-- stamps the result onto the signal row. Lets us:
--
--   - Filter Telegram notifications to "news-confirmed" signals only
--     (kills most pure-noise gaps that fire on no catalyst)
--   - Slice /stats win rate by has_news vs no_news so we can prove the
--     filter is warranted before enforcing it
--   - Hand the headline titles to the AI analyzer so it doesn't have to
--     re-fetch news at request time
--
-- Both columns are nullable: NULL means "this signal predates the news
-- enrichment feature" — distinguish from "checked, found 0 news" which
-- is recent_news_count = 0. Stats queries should filter to NOT NULL
-- when comparing the two cohorts.

alter table public.signals
  add column if not exists recent_news_count  integer,             -- null = not checked
  add column if not exists recent_news_titles jsonb;                -- null = not checked

-- Partial index supports the byHasNews stats split (most signals will be
-- on one side or the other and the index keeps both buckets fast).
create index if not exists signals_news_idx
  on public.signals (signal_type, recent_news_count, ts desc)
  where recent_news_count is not null;
