"""Descriptive historical analogues, not a deployable strategy backtest.

Use identical N-session close horizons to the realized-return worker. Every
selected analogue must have all five-session outcomes available BEFORE the
target signal. Same-symbol observation windows may not overlap.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import pandas as pd

from . import alpaca, signals as sig
from .returns import RETURN_CONVENTION, forward_close, utc_timestamp

import math

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
    available_at: pd.Timestamp | None = None


def _detect_at_bar(symbol: str, df: pd.DataFrame, idx: int) -> sig.Signal | None:
    """Run the same detector as live, but over a slice ending at idx (inclusive)."""
    if idx < sig.LOOKBACK_BARS:
        return None
    window = df.iloc[: idx + 1]
    return sig.detect_for_symbol(symbol, window)


def collect_historical(
    symbols: list[str], lookback_days: int = 60, batch_size: int = 50
) -> list[HistoricalSignal]:
    """Run the detector across all bars in the lookback window for every symbol."""
    out: list[HistoricalSignal] = []
    print(f"  historical return convention: {RETURN_CONVENTION}; dividends/costs excluded")
    total_batches = (len(symbols) + batch_size - 1) // batch_size
    for i in range(0, len(symbols), batch_size):
        batch = symbols[i : i + batch_size]
        b_no = i // batch_size + 1
        try:
            # Both the detected entry and forward close must use the same share
            # basis. Adjusting daily bars alone creates false returns at splits.
            frames = alpaca.fetch_recent_bars(batch, interval="5m", lookback=f"{lookback_days}d", adjustment="split")
            daily_frames = alpaca.fetch_recent_bars(batch, interval="1d", lookback=f"{lookback_days}d", adjustment="split")
        except Exception as e:
            print(f"  batch {b_no}/{total_batches} fetch FAILED: {e}")
            continue
        if not frames:
            print(f"  batch {b_no}/{total_batches} returned empty — symbols: {batch[:3]}…")
            continue
        b_signals = 0
        for sym, df in frames.items():
            if df is None or len(df) < sig.LOOKBACK_BARS + 1:
                continue
            daily = daily_frames.get(sym)
            if daily is None or daily.empty:
                continue
            for idx in range(sig.LOOKBACK_BARS, len(df)):
                s = _detect_at_bar(sym, df, idx)
                if s is None:
                    continue
                if not math.isfinite(s.price) or s.price <= 0:
                    continue
                outcomes = [forward_close(daily, s.ts, n) for n in (1, 3, 5)]
                if any(value is None for value in outcomes):
                    continue
                returns = [(value[0] - s.price) / s.price for value in outcomes]
                if not all(math.isfinite(value) for value in returns):
                    continue
                out.append(
                    HistoricalSignal(
                        symbol=sym,
                        ts=s.ts,
                        signal_type=s.signal_type,
                        pct_change=s.pct_change,
                        volume_ratio=s.volume_ratio,
                        realized_1d=returns[0],
                        realized_3d=returns[1],
                        realized_5d=returns[2],
                        available_at=outcomes[2][1],
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
    """Select known outcomes, then remove overlapping same-symbol windows.

    Missing target or maturity timestamps fail closed. A date-only same-symbol
    exclusion cannot prevent leakage from other symbols or future sessions.
    """
    if target_ts is None:
        return []
    cutoff = utc_timestamp(target_ts)
    pct_lo = target_pct * (1 - ANALOGUE_PCT_TOL) if target_pct >= 0 else target_pct * (1 + ANALOGUE_PCT_TOL)
    pct_hi = target_pct * (1 + ANALOGUE_PCT_TOL) if target_pct >= 0 else target_pct * (1 - ANALOGUE_PCT_TOL)
    if pct_lo > pct_hi:
        pct_lo, pct_hi = pct_hi, pct_lo
    vol_lo = target_vol * (1 - ANALOGUE_VOL_TOL)
    vol_hi = target_vol * (1 + ANALOGUE_VOL_TOL)

    out: list[HistoricalSignal] = []
    last_end: dict[str, pd.Timestamp] = {}
    for h in sorted(pool, key=lambda item: utc_timestamp(item.ts)):
        if h.available_at is None or utc_timestamp(h.available_at) >= cutoff:
            continue
        if utc_timestamp(h.ts) >= cutoff:
            continue
        if h.symbol in last_end and utc_timestamp(h.ts) <= last_end[h.symbol]:
            continue
        if h.signal_type != target_type:
            continue
        if not (pct_lo <= h.pct_change <= pct_hi):
            continue
        if not (vol_lo <= h.volume_ratio <= vol_hi):
            continue
        last_end[h.symbol] = utc_timestamp(h.available_at)
        out.append(h)
    return out


def aggregate_expected(analogues: list[HistoricalSignal]) -> tuple[float | None, float | None, float | None, int]:
    analogues = [a for a in analogues if all(
        value is not None and math.isfinite(value)
        for value in (a.realized_1d, a.realized_3d, a.realized_5d)
    )]
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
