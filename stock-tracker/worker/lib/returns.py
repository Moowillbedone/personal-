"""One forward-return convention: Nth completed NY session after anchor date.

Alpaca daily timestamps mark the session start, not when its close was known.
16:15 ET is a conservative availability cutoff including the delayed feed.
Early-close days remain unavailable until this cutoff; weekends/holidays are
represented by absent daily rows. No synthetic bars or prices are invented.

Returns are split-adjusted price returns, excluding dividends, fees and
slippage. Stored anchors are raw traded prices: rebase them with the same
session's split/raw daily-close ratio before using adjusted forward closes.
"""
from __future__ import annotations

import math
import pandas as pd

ET = "America/New_York"
RETURN_CONVENTION = "ny-session-close/split-adjusted-price/v1"


def utc_timestamp(value) -> pd.Timestamp:
    ts = pd.Timestamp(value)
    return ts.tz_localize("UTC") if ts.tzinfo is None else ts.tz_convert("UTC")


def split_adjusted_anchor(
    raw_daily: pd.DataFrame,
    split_daily: pd.DataFrame,
    anchor_ts: pd.Timestamp,
    raw_price: float,
) -> float | None:
    """Put a stored raw anchor on the adjusted forward bars' share basis.

    The close ratio supplies only the split factor; it does not replace the
    observed intraday entry price with the daily close. Both frames must have
    exactly one valid close for the anchor's NY date. Missing sessions (including
    weekend/holiday AI timestamps) fail closed: legacy AI rows lack the source
    quote timestamp needed to safely infer another session. After-hours prices
    use their NY date. This cannot repair a stale anchor labelled with the wrong
    date, or already-persisted returns computed under the old convention.
    """
    try:
        price = float(raw_price)
    except (TypeError, ValueError, OverflowError):
        return None
    if not math.isfinite(price) or price <= 0:
        return None
    anchor_date = utc_timestamp(anchor_ts).tz_convert(ET).date()
    closes = []
    for frame in (raw_daily, split_daily):
        if frame is None or frame.empty or "Close" not in frame:
            return None
        matches = [
            row["Close"] for ts, row in frame.iterrows()
            if utc_timestamp(ts).tz_convert(ET).date() == anchor_date
        ]
        if len(matches) != 1:
            return None
        try:
            close = float(matches[0])
        except (TypeError, ValueError, OverflowError):
            return None
        if not math.isfinite(close) or close <= 0:
            return None
        closes.append(close)
    adjusted = price * (closes[1] / closes[0])
    return adjusted if math.isfinite(adjusted) and adjusted > 0 else None


def forward_close(
    daily_df: pd.DataFrame,
    anchor_ts: pd.Timestamp,
    n_days: int,
    as_of: pd.Timestamp | None = None,
) -> tuple[float, pd.Timestamp] | None:
    """Return (close, available_at), or None for missing/uncompleted horizons."""
    if daily_df.empty or n_days < 1:
        return None
    anchor_date = utc_timestamp(anchor_ts).tz_convert(ET).date()
    now = utc_timestamp(as_of if as_of is not None else pd.Timestamp.now(tz="UTC"))
    sessions = {}
    for ts, row in daily_df.sort_index().iterrows():
        date = utc_timestamp(ts).tz_convert(ET).date()
        if date <= anchor_date:
            continue
        # Wall-clock localization (not adding 16h across a DST boundary).
        available = pd.Timestamp(f"{date} 16:15", tz=ET).tz_convert("UTC")
        sessions[date] = (row["Close"], available)
    ordered = sorted(sessions)
    if len(ordered) < n_days:
        return None
    raw, available = sessions[ordered[n_days - 1]]
    try:
        close = float(raw)
    except (TypeError, ValueError):
        return None
    if available > now or not math.isfinite(close) or close <= 0:
        return None
    return close, available
