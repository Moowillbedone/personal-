"""Polling worker — runs once or in a long-lived loop.

Run modes (env-controlled):
  LOOP_MIN=0   (default)  → single poll cycle, then exit. Useful for manual runs.
  LOOP_MIN=N>0           → poll every LOOP_INTERVAL_SEC for N minutes total.
                           Used by the GitHub Actions long-running schedule to
                           keep an internal 5-min cadence regardless of when
                           the cron actually fires (GH Actions cron is unreliable).
"""
from __future__ import annotations

import os
import sys
import time
from datetime import datetime, timedelta, timezone

import pandas as pd
from dotenv import load_dotenv

# load_dotenv MUST run before `from lib import ...`: notify.py reads
# TELEGRAM_*/NOTIFY_TYPES at import time (module-level constants), as do
# this module's own MAX_AGE_MIN/LOOP_MIN below. Calling it inside main()
# (the old placement) meant a local .env was silently ignored for all of
# those — telegram would no-op with no error. GH Actions is unaffected
# (job env exists before Python starts) but local runs need this order.
load_dotenv()

from lib import alpaca, data, db, news, notify, signals as sig  # noqa: E402

BATCH_SIZE = 100  # Alpaca multi-symbol query supports ~100/call

# Skip signals where the latest bar is older than this. Prevents stale-data
# fires e.g. running pre-market polls on Friday's last bar (when the feed
# hasn't emitted a Monday bar yet for that symbol).
#
# 2026-05-20 bumped 15→25min. When we switched alpaca.py off feed=iex
# (which dropped a near-real-time but sparse data path) the consolidated
# free-tier feed has a built-in ~15min historical cutoff — fresh bars
# typically arrive 15-18min old by the time poll.py sees them. With
# MAX_AGE_MIN=15, every bar was just over the cutoff and gated out, so
# the poll worker logged "bars=75000 fired=0" all day with zero signals
# making it into the DB. 25min gives ~10min margin past the feed's
# delay while still rejecting truly stale data (e.g. weekend gaps).
MAX_AGE_MIN = int(os.getenv("MAX_AGE_MIN", "25"))

# Only PERSIST bars newer than this many minutes. Signal detection still runs
# on the full fetched window (it needs the 20-bar volume average + prev close),
# but re-writing the entire 5-day × 200-symbol window to Supabase every 5-min
# cycle (~100k row-upserts/cycle) was the egress blowout that paused the
# free-tier project. Older bars are already stored; the (symbol, ts) PK makes
# re-writes pure waste. 30min comfortably exceeds the 5-min poll cadence + the
# feed's ~15min delay, so no freshly-rolled bar is ever missed.
PERSIST_MAX_AGE_MIN = int(os.getenv("PERSIST_MAX_AGE_MIN", "30"))

# Loop-mode controls
LOOP_MIN = int(os.getenv("LOOP_MIN", "0"))                # 0 = single shot
LOOP_INTERVAL_SEC = int(os.getenv("LOOP_INTERVAL_SEC", "300"))  # cycle every 5 min


def _bars_to_rows(symbol: str, df: pd.DataFrame) -> list[dict]:
    rows: list[dict] = []
    for ts, row in df.iterrows():
        if pd.isna(row["Close"]) or pd.isna(row["Volume"]):
            continue
        rows.append(
            {
                "symbol": symbol,
                "ts": data.to_iso_utc(ts),
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": int(row["Volume"]),
                "session": data.classify_session(ts.to_pydatetime()),
            }
        )
    return rows


def _pick_fetcher(now_utc: datetime):
    """Return the per-poll bar fetcher. All sessions now use Alpaca IEX.

    History: pre/after used to route to yfinance with prepost=True because
    IEX's extended-hours volume is thin and yfinance pulled the consolidated
    feed. That broke on 2026-05 when Yahoo started aggressively rate-limiting
    GitHub Actions runner IPs (every batch returned 429, signals fired = 0
    across the entire weekend → Monday premarket window). Same issue we hit
    earlier from Vercel IPs in /api/snapshot.

    Tradeoff of IEX-only extended hours:
      - Top ~50 most-active names (AAPL/NVDA/TSLA/MSFT/AMD/META/AVGO/...,
        plus user's watchlist) still have enough IEX pre/after volume for
        real signals to fire. These are exactly the names the user cares
        about, so coverage where it counts is preserved.
      - Mid-cap names with no IEX extended-hours print won't trigger
        pre/after signals. The MIN_DOLLAR_VOL=$1M floor in the signal
        detector already screens those out as not-actionable.
      - Net effect on ai_scan: signals_24h pool is somewhat smaller during
        weekends/Monday-AM (when only ext-hours bars exist), but the
        conviction-ranked top-22 still gets filled.

    Finnhub was considered as a yfinance replacement but its /stock/candle
    endpoint moved to premium-only on free tier (only /quote remains free,
    which gives current price but no historical OHLCV for volume_ratio).
    """
    return alpaca.fetch_recent_bars, "alpaca-iex"


def run_once(sb, symbols: list[str]) -> tuple[int, int]:
    """A single poll pass. Returns (#bars_persisted, #signals_fired)."""
    all_price_rows: list[dict] = []
    fired: list[dict] = []
    now = datetime.now(timezone.utc)
    fetcher, fetcher_label = _pick_fetcher(now)
    print(f"poll: source={fetcher_label} session={data.classify_session(now)}")

    for i in range(0, len(symbols), BATCH_SIZE):
        batch = symbols[i : i + BATCH_SIZE]
        try:
            frames = fetcher(batch, interval="5m", lookback="5d")
        except Exception as e:
            print(f"  batch {i} failed: {e}", file=sys.stderr)
            time.sleep(2)
            continue

        now = datetime.now(timezone.utc)
        persist_cutoff = now - timedelta(minutes=PERSIST_MAX_AGE_MIN)
        for sym, df in frames.items():
            # Persist ONLY the newest bars (egress discipline — see
            # PERSIST_MAX_AGE_MIN). Detection below still uses the full df.
            try:
                recent = df[df.index >= persist_cutoff]
            except TypeError:
                recent = df  # tz-naive index (non-Alpaca fetcher) — keep all
            all_price_rows.extend(_bars_to_rows(sym, recent))
            signal = sig.detect_for_symbol(sym, df)
            if not signal:
                continue
            age_min = (now - signal.ts.to_pydatetime()).total_seconds() / 60
            if age_min > MAX_AGE_MIN:
                continue
            ts_iso = data.to_iso_utc(signal.ts)
            if db.signal_exists(sb, sym, ts_iso):
                continue
            fired.append(
                {
                    "symbol": signal.symbol,
                    "ts": ts_iso,
                    "signal_type": signal.signal_type,
                    "price": signal.price,
                    "pct_change": signal.pct_change,
                    "volume_ratio": signal.volume_ratio,
                    "session": data.classify_session(signal.ts.to_pydatetime()),
                }
            )
        time.sleep(1)

    db.upsert_price_snapshots(sb, all_price_rows)

    # Enrich each firing signal with the last ~30 min of headlines for that
    # symbol BEFORE insert. Fail-soft: if Alpaca news errors, signals still
    # get inserted with recent_news_count = None and notify still fires.
    if fired:
        try:
            news.enrich_signals_with_news(fired)
        except Exception as e:
            print(f"  news enrichment failed (continuing): {e}", file=sys.stderr)

    db.insert_signals(sb, fired)

    if fired:
        for f in fired:
            n_news = f.get("recent_news_count")
            news_tag = f"news×{n_news}" if n_news else ("no-news" if n_news == 0 else "news?")
            print(
                f"  [{f['signal_type']}] {f['symbol']} "
                f"{f['pct_change']*100:+.2f}% volx{f['volume_ratio']:.1f} @ {f['price']}  ·  {news_tag}"
            )
        # Telegram gate (2026-07 swing pivot): only NASDAQ-100-proxy names
        # get pushed. All signals still land in the DB / signals page.
        try:
            ndx = db.get_nasdaq_top100(sb)
        except Exception as e:
            print(f"  ndx-100 fetch failed (suppressing notifications): {e}", file=sys.stderr)
            ndx = set()
        notify.notify_batch(fired, allowed_symbols=ndx)

    return len(all_price_rows), len(fired)


def main() -> int:
    sb = db.client()

    symbols = db.get_active_symbols(sb)
    if not symbols:
        print("WARN: no active tickers; run refresh_universe.py first", file=sys.stderr)
        return 0

    if LOOP_MIN <= 0:
        print(f"single-shot poll over {len(symbols)} symbols")
        bars, signals_n = run_once(sb, symbols)
        print(f"persisted {bars} bars, fired {signals_n} new signals")
        return 0

    end = time.time() + LOOP_MIN * 60
    print(
        f"loop mode: polling {len(symbols)} symbols every "
        f"{LOOP_INTERVAL_SEC}s for {LOOP_MIN} min"
    )
    cycle = 0
    while time.time() < end:
        cycle += 1
        cycle_start = time.time()
        try:
            bars, signals_n = run_once(sb, symbols)
            print(
                f"[cycle {cycle}] {datetime.now(timezone.utc).isoformat(timespec='seconds')}  "
                f"bars={bars}  fired={signals_n}",
                flush=True,
            )
        except Exception as e:
            print(f"[cycle {cycle}] FAILED: {e}", file=sys.stderr, flush=True)
        # Sleep to next interval boundary, but not past the deadline.
        sleep_for = max(0, LOOP_INTERVAL_SEC - (time.time() - cycle_start))
        sleep_for = min(sleep_for, max(0, end - time.time()))
        if sleep_for > 0:
            time.sleep(sleep_for)
    print(f"loop done: completed {cycle} cycles")
    return 0


if __name__ == "__main__":
    sys.exit(main())
