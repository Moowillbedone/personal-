"""Backtest: fill expected_1d/3d/5d on signals using historical analogues.

Approach:
  1. For each active ticker, fetch the last 60 days of 5-min bars (yfinance batch).
  2. Run the live signal detector over EVERY bar (not just the latest), producing
     a pool of historical signal candidates.
  3. For each historical candidate, compute its REALIZED forward return at
     +78 / +234 / +390 bars (≈ 1, 3, 5 trading days; 78 5-min bars per session).
  4. For each NEW signal in the DB whose expected_1d is NULL, find historical
     analogues (same type, ±50% pct_change, ±50% vol_ratio) and store the mean
     realized 1d/3d/5d as expected_*.

We deliberately do NOT include same-symbol-same-day matches (lookahead bias).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import pandas as pd

from . import alpaca, signals as sig

# Trading day = 6.5h regular session = 78 5-min bars.
BARS_1D = 78
BARS_3D = 78 * 3
BARS_5D = 78 * 5

ANALOGUE_PCT_TOL = 0.50   # ±50% relative magnitude tolerance
ANALOGUE_VOL_TOL = 0.50


@dataclass
class HistoricalSignal:
    symbol: str
    ts: pd.Timestamp
    signal_type: str
    pct_change: float
    volume_ratio: float
    realized_1d: float | None
    realized_3d: float | None
    realized_5d: float | None


def _detect_at_bar(symbol: str, df: pd.DataFrame, idx: int) -> sig.Signal | None:
    """Run the same detector as live, but over a slice ending at idx (inclusive)."""
    if idx < sig.LOOKBACK_BARS:
        return None
    window = df.iloc[: idx + 1]
    return sig.detect_for_symbol(symbol, window)


def _realized_return(close_series: pd.Series, idx: int, fwd_bars: int) -> float | None:
    target_idx = idx + fwd_bars
    if target_idx >= len(close_series):
        return None
    base = float(close_series.iloc[idx])
    fwd = float(close_series.iloc[target_idx])
    if base <= 0:
        return None
    return (fwd - base) / base


def collect_historical(
    symbols: list[str], lookback_days: int = 60, batch_size: int = 50
) -> list[HistoricalSignal]:
    """Run the detector across all bars in the lookback window for every symbol."""
    out: list[HistoricalSignal] = []
    total_batches = (len(symbols) + batch_size - 1) // batch_size
    for i in range(0, len(symbols), batch_size):
        batch = symbols[i : i + batch_size]
        b_no = i // batch_size + 1
        try:
            frames = alpaca.fetch_recent_bars(batch, interval="5m", lookback=f"{lookback_days}d")
        except Exception as e:
            print(f"  batch {b_no}/{total_batches} fetch FAILED: {e}")
            continue
        if not frames:
            print(f"  batch {b_no}/{total_batches} returned empty — symbols: {batch[:3]}…")
            continue
        b_signals = 0
        for sym, df in frames.items():
            if df is None or len(df) < sig.LOOKBACK_BARS + BARS_1D:
                continue
            closes = df["Close"]
            for idx in range(sig.LOOKBACK_BARS, len(df)):
                s = _detect_at_bar(sym, df, idx)
                if s is None:
                    continue
                out.append(
                    HistoricalSignal(
                        symbol=sym,
                        ts=s.ts,
                        signal_type=s.signal_type,
                        pct_change=s.pct_change,
                        volume_ratio=s.volume_ratio,
                        realized_1d=_realized_return(closes, idx, BARS_1D),
                        realized_3d=_realized_return(closes, idx, BARS_3D),
                        realized_5d=_realized_return(closes, idx, BARS_5D),
                    )
                )
                b_signals += 1
        print(f"  batch {b_no}/{total_batches}: {len(frames)} frames, {b_signals} signals")
    return out


def find_analogues(
    target_type: str,
    target_pct: float,
    target_vol: float,
    pool: Iterable[HistoricalSignal],
    target_ts: pd.Timestamp | None = None,
    target_symbol: str | None = None,
) -> list[HistoricalSignal]:
    """Filter the pool by type + magnitude similarity (and exclude same-day-same-symbol)."""
    pct_lo = target_pct * (1 - ANALOGUE_PCT_TOL) if target_pct >= 0 else target_pct * (1 + ANALOGUE_PCT_TOL)
    pct_hi = target_pct * (1 + ANALOGUE_PCT_TOL) if target_pct >= 0 else target_pct * (1 - ANALOGUE_PCT_TOL)
    if pct_lo > pct_hi:
        pct_lo, pct_hi = pct_hi, pct_lo
    vol_lo = target_vol * (1 - ANALOGUE_VOL_TOL)
    vol_hi = target_vol * (1 + ANALOGUE_VOL_TOL)

    out: list[HistoricalSignal] = []
    for h in pool:
        if h.signal_type != target_type:
            continue
        if not (pct_lo <= h.pct_change <= pct_hi):
            continue
        if not (vol_lo <= h.volume_ratio <= vol_hi):
            continue
        # Exclude same symbol on same day (avoid forward-looking bias from the very signal we're estimating).
        if target_symbol == h.symbol and target_ts is not None:
            if abs((h.ts.tz_localize(None) if h.ts.tzinfo else h.ts) -
                   (target_ts.tz_localize(None) if target_ts.tzinfo else target_ts)) < pd.Timedelta(days=1):
                continue
        out.append(h)
    return out


def aggregate_expected(analogues: list[HistoricalSignal]) -> tuple[float | None, float | None, float | None, int]:
    if not analogues:
        return None, None, None, 0

    def mean(getter):
        vals = [getter(a) for a in analogues if getter(a) is not None]
        return float(sum(vals) / len(vals)) if vals else None

    return (
        mean(lambda a: a.realized_1d),
        mean(lambda a: a.realized_3d),
        mean(lambda a: a.realized_5d),
        len(analogues),
    )
