"""Gap / volume-spike detection.

A signal fires on the LATEST 5-min bar of a symbol when:
  - |pct_change vs previous close| >= GAP_PCT_LARGE  (large/mega caps), OR
  - volume of latest bar >= VOL_RATIO * avg(volume over last N bars excluding latest)

Both conditions are recorded; the signal_type identifies which side.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import os

import pandas as pd

# Tunables (env-overridable for live re-tuning without code changes)
GAP_PCT = float(os.getenv("GAP_PCT", "0.012"))         # 1.2% intra-bar move vs previous close
VOL_RATIO = float(os.getenv("VOL_RATIO", "2.5"))       # current volume must be >= 2.5x rolling avg
LOOKBACK_BARS = int(os.getenv("LOOKBACK_BARS", "20"))  # rolling window for volume baseline


@dataclass
class Signal:
    symbol: str
    ts: pd.Timestamp
    signal_type: str   # 'gap_up' | 'gap_down' | 'volume_spike'
    price: float
    pct_change: float
    volume_ratio: float


def detect_for_symbol(symbol: str, df: pd.DataFrame) -> Optional[Signal]:
    """Inspect the latest bar; return a Signal or None.

    df: DataFrame indexed by tz-aware datetime, with Open/High/Low/Close/Volume.
    """
    if df is None or len(df) < LOOKBACK_BARS + 1:
        return None

    latest = df.iloc[-1]
    prev_close = float(df.iloc[-2]["Close"])
    if prev_close <= 0:
        return None

    close = float(latest["Close"])
    vol = float(latest["Volume"]) if pd.notna(latest["Volume"]) else 0.0
    if close <= 0 or vol <= 0:
        return None

    pct = (close - prev_close) / prev_close

    avg_vol = float(df["Volume"].iloc[-(LOOKBACK_BARS + 1) : -1].mean())
    if avg_vol <= 0:
        return None
    vol_ratio = vol / avg_vol

    gap_hit = abs(pct) >= GAP_PCT
    vol_hit = vol_ratio >= VOL_RATIO

    if not (gap_hit or vol_hit):
        return None

    if gap_hit and pct > 0:
        sig_type = "gap_up"
    elif gap_hit and pct < 0:
        sig_type = "gap_down"
    else:
        sig_type = "volume_spike"

    return Signal(
        symbol=symbol,
        ts=latest.name,  # the bar's timestamp index
        signal_type=sig_type,
        price=close,
        pct_change=round(pct, 6),
        volume_ratio=round(vol_ratio, 4),
    )
