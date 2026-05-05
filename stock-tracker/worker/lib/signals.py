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
import pytz

# Tunables (env-overridable for live re-tuning without code changes)
GAP_PCT = float(os.getenv("GAP_PCT", "0.012"))         # 1.2% intra-bar move vs previous close
VOL_RATIO = float(os.getenv("VOL_RATIO", "2.5"))       # current volume must be >= 2.5x rolling avg
# A solo vol-spike must clear this much higher bar to qualify — ensures a price-less
# volume blip alone is only flagged when truly extraordinary (e.g. block trade).
VOL_RATIO_STRONG = float(os.getenv("VOL_RATIO_STRONG", "4.0"))
LOOKBACK_BARS = int(os.getenv("LOOKBACK_BARS", "20"))  # rolling window for volume baseline
MIN_VOLUME = int(os.getenv("MIN_VOLUME", "5000"))      # absolute floor: skip thin bars (esp. extended hrs)
MIN_BASELINE_VOL = int(os.getenv("MIN_BASELINE_VOL", "2000"))  # baseline avg must clear this too
# Dollar-volume floor (price * shares for the latest 5-min bar).
# Default $2,000,000 ≈ 27억원 — filters out noise from low-priced thinly-traded
# names where 5000-share thresholds in cheap stocks (e.g. $10 stock = $50k) are meaningless.
MIN_DOLLAR_VOL = float(os.getenv("MIN_DOLLAR_VOL", "2000000"))


_ET = pytz.timezone("America/New_York")


def _is_regular_session(ts: pd.Timestamp) -> bool:
    """09:30-16:00 America/New_York. Handles DST automatically via pytz."""
    et = ts.tz_convert(_ET) if ts.tzinfo else ts.tz_localize("UTC").tz_convert(_ET)
    hm = et.hour * 60 + et.minute
    return 9 * 60 + 30 <= hm < 16 * 60


def _is_volume_eligible_window(ts: pd.Timestamp) -> bool:
    """Volume_spike active window. Configurable via VOLUME_WINDOW env:
      - 'midday' (10:00-15:30 ET): excludes open/close 30 min routine volume
      - 'regular' (09:30-16:00 ET): full regular session (default — opted in)
    Pre/after-hours are always excluded.
    """
    et = ts.tz_convert(_ET) if ts.tzinfo else ts.tz_localize("UTC").tz_convert(_ET)
    hm = et.hour * 60 + et.minute
    mode = os.getenv("VOLUME_WINDOW", "regular").lower()
    if mode == "midday":
        return 10 * 60 <= hm < 15 * 60 + 30
    # default 'regular' = full session
    return 9 * 60 + 30 <= hm < 16 * 60


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

    # Dollar-volume floor — universal credibility filter applied to ALL signal types.
    # A price move on tiny dollar volume is just bid/ask wobble, not a real signal.
    if close * vol < MIN_DOLLAR_VOL:
        return None

    pct = (close - prev_close) / prev_close

    avg_vol = float(df["Volume"].iloc[-(LOOKBACK_BARS + 1) : -1].mean())
    if avg_vol <= 0:
        return None
    vol_ratio = vol / avg_vol

    gap_hit = abs(pct) >= GAP_PCT
    vol_hit = (
        vol_ratio >= VOL_RATIO
        and vol >= MIN_VOLUME
        and avg_vol >= MIN_BASELINE_VOL
        and _is_volume_eligible_window(latest.name)
    )

    # High-conviction: BOTH a meaningful price move AND volume confirmation.
    # This is the "real buy/sell candidate" filter — a 1% gap with no volume
    # is just noise, and a volume spike with no price move is wash trading or
    # block crossing. Together they signal genuine directional pressure.
    high_conviction = gap_hit and vol_hit

    # Standalone volume spikes only qualify if EXTRAORDINARILY strong (e.g.
    # 4x+ rolling average) — captures rare unusual-activity events without
    # flooding the feed with routine 2-3x ticks. DB-only by default.
    extreme_vol = vol_hit and (not gap_hit) and vol_ratio >= VOL_RATIO_STRONG

    if not (high_conviction or extreme_vol):
        return None

    if high_conviction:
        sig_type = "gap_up" if pct > 0 else "gap_down"
    else:
        # extreme_vol path
        sig_type = "volume_spike"

    return Signal(
        symbol=symbol,
        ts=latest.name,  # the bar's timestamp index
        signal_type=sig_type,
        price=close,
        pct_change=round(pct, 6),
        volume_ratio=round(vol_ratio, 4),
    )
