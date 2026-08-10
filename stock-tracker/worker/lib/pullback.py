"""Daily 눌림목(pullback) classifier — Python port of apps/web/lib/pullback.ts
(the twice-reviewed TS engine), DAILY timeframe only, for the dashboard scanner.

Kept a faithful mirror of the TS thresholds so the dashboard list agrees with
the Trade-tab analyzer's daily read. The Trade tab does the live multi-timeframe
+ Gemini synthesis; this only produces the deterministic daily classification +
the 5 grades for the precomputed NDX-100/NYSE-100 scan.

Input: a pandas DataFrame with Open/High/Low/Close/Volume (chronological), plus
the daily Ichimoku spans (may be None). Output: dict or None (insufficient bars).
"""
from __future__ import annotations

RECENT_WIN = 60
SUPPORT_BAND = 0.03
MIN_SWING_AGE = 2


def _sma(vals: list[float], period: int) -> float | None:
    if len(vals) < period:
        return None
    return sum(vals[-period:]) / period


def _atr(highs, lows, closes, period: int = 14) -> float | None:
    n = len(closes)
    if n < period + 1:
        return None
    trs = []
    for i in range(1, n):
        pc = closes[i - 1]
        trs.append(max(highs[i] - lows[i], abs(highs[i] - pc), abs(lows[i] - pc)))
    a = sum(trs[:period]) / period
    for i in range(period, len(trs)):
        a = (a * (period - 1) + trs[i]) / period
    return a


def classify_pullback(df, span_a: float | None, span_b: float | None) -> dict | None:
    if df is None or getattr(df, "empty", True):
        return None
    highs = [float(x) for x in df["High"].tolist()]
    lows = [float(x) for x in df["Low"].tolist()]
    closes = [float(x) for x in df["Close"].tolist()]
    opens = [float(x) for x in df["Open"].tolist()]
    vols = [float(x) for x in df["Volume"].tolist()]
    n = len(closes)
    if n < 30:
        return None
    price = closes[-1]
    if not price > 0:
        return None

    sma20 = _sma(closes, 20)
    sma50 = _sma(closes, 50)
    sma200 = _sma(closes, 200)
    sma50_prev = _sma(closes[:-20], 50)
    sma200_prev = _sma(closes[:-20], 200)
    sma50_rising = (sma50 > sma50_prev) if (sma50 is not None and sma50_prev is not None) else None
    sma200_rising = (sma200 >= sma200_prev) if (sma200 is not None and sma200_prev is not None) else None
    atr14 = _atr(highs, lows, closes, 14)

    # swing structure (exclude last MIN_SWING_AGE bars from the high search)
    start = max(0, n - RECENT_WIN)
    search_to = max(start, n - 1 - MIN_SWING_AGE)
    h_idx = start
    swing_high = -1e18
    for i in range(start, search_to + 1):
        if highs[i] > swing_high:
            swing_high = highs[i]
            h_idx = i
    extended = price > swing_high
    leg_start = max(0, h_idx - RECENT_WIN)
    l_idx = h_idx
    leg_low = lows[h_idx]
    if h_idx > leg_start:
        leg_low = 1e18
        for i in range(leg_start, h_idx + 1):
            if lows[i] < leg_low:
                leg_low = lows[i]
                l_idx = i
    pullback_low = min(lows[h_idx:n])
    swing_high_ago = n - 1 - h_idx

    lower_high = False
    if l_idx - 1 >= 0:
        pp_from = max(0, l_idx - RECENT_WIN)
        prior_peak = max(highs[pp_from:l_idx]) if l_idx > pp_from else -1e18
        if prior_peak > 0 and swing_high < prior_peak * 0.999:
            lower_high = True

    leg_range = swing_high - leg_low
    retrace_depth = (swing_high - pullback_low) / leg_range if leg_range > 0 else None
    broke_low = pullback_low < leg_low

    # volume: baseline = the advance, not a trailing window overlapping the dip
    base_from = max(0, h_idx - 20)
    adv_vols = vols[base_from:h_idx]
    if len(adv_vols) >= 5:
        avg_base = sum(adv_vols) / len(adv_vols)
    else:
        tail = vols[-21:-1]
        avg_base = (sum(tail) / len(tail)) if tail else None
    pb_from = h_idx + 1
    pb_vols = vols[pb_from:n]
    pb_vol_avg = (sum(pb_vols) / len(pb_vols)) if pb_vols else None
    vol_ratio = (pb_vol_avg / avg_base) if (avg_base and pb_vol_avg is not None and avg_base > 0) else None
    up_vol = up_days = down_vol = down_days = 0
    for i in range(pb_from, n):
        if closes[i] >= opens[i]:
            up_vol += vols[i]
            up_days += 1
        else:
            down_vol += vols[i]
            down_days += 1
    avg_up = up_vol / up_days if up_days > 0 else 0.0
    avg_down = down_vol / down_days if down_days > 0 else 0.0
    if avg_up > 0:
        down_up = avg_down / avg_up
    else:
        down_up = float("inf") if avg_down > 0 else None
    du = down_up if (down_up is not None) else 0.0
    dist_days = 0
    for i in range(max(1, pb_from), n):
        chg = (closes[i] - closes[i - 1]) / closes[i - 1]
        if chg <= -0.002 and vols[i] > vols[i - 1]:
            dist_days += 1

    # support confluence (at/below price, +0.5% tolerance)
    cloud_bottom = min(span_a, span_b) if (span_a is not None and span_b is not None) else span_b
    cloud_top = max(span_a, span_b) if (span_a is not None and span_b is not None) else None
    prior_breakout = None
    if l_idx - 1 >= 0:
        pb2 = max(0, l_idx - RECENT_WIN)
        prior_breakout = max(highs[pb2:l_idx]) if l_idx > pb2 else None

    def fib(r: float):
        return swing_high - leg_range * r if leg_range > 0 else None

    if price >= 100:
        step = 10
    elif price >= 20:
        step = 5
    else:
        step = 1
    # half-up to mirror JS Math.round (Python round() is banker's/half-to-even);
    # price/step > 0 so int(x+0.5) == Math.round exactly.
    round_num = int(price / step + 0.5) * step

    candidates = [
        sma20, sma50, sma200, span_b, cloud_bottom, cloud_top, leg_low,
        prior_breakout, fib(0.382), fib(0.5), fib(0.618), round_num,
    ]
    confluence = 0
    for lvl in candidates:
        if lvl is None or not lvl > 0:
            continue
        dist = (lvl - price) / price * 100
        if dist <= 0.5 and dist >= -SUPPORT_BAND * 100:
            confluence += 1

    # confirmation
    last_c, last_o, last_h, last_l = closes[-1], opens[-1], highs[-1], lows[-1]
    prev_c, prev_l = closes[-2], lows[-2]
    rng = last_h - last_l
    close_pos = (last_c - last_l) / rng if rng > 0 else 0.5
    bullish = last_c > last_o and close_pos >= 0.55
    made_new_low = last_l <= pullback_low + 1e-9 and last_c < last_o
    higher_low = last_l > prev_l and last_c > prev_c
    reclaim20 = sma20 is not None and prev_c < sma20 and last_c > sma20
    if bullish or reclaim20:
        confirm = "pass"
    elif made_new_low:
        confirm = "fail"
    elif higher_low:
        confirm = "warn"
    else:
        confirm = "warn"

    # trend
    aligned = sma50 is not None and sma200 is not None and price > sma50 and sma50 > sma200
    above_long = sma200 is not None and price > sma200
    if aligned and sma50_rising is not False and sma200_rising is not False:
        trend = "pass"
    elif above_long and not lower_high:
        trend = "warn"
    elif sma200 is None:
        trend = "warn"  # insufficient history — not a confirmed downtrend
    else:
        trend = "fail"

    # volume
    vr = vol_ratio
    if vr is not None and vr <= 0.9 and dist_days <= 1 and du <= 1.2:
        volume = "pass"
    elif (vr is not None and vr >= 1.3 and du > 1.5) or (dist_days >= 3 and du > 1.2):
        volume = "fail"
    else:
        volume = "warn"

    # structure
    rd = retrace_depth
    if extended:
        structure = "warn"
    elif broke_low or (lower_high and (rd or 0) > 0.9):
        structure = "fail"
    elif rd is not None and rd <= 0.618:
        structure = "pass"
    elif rd is not None and rd <= 1.0:
        structure = "warn"
    else:
        structure = "warn"

    # support
    if confluence >= 2:
        support = "pass"
    elif confluence == 1:
        support = "warn"
    else:
        support = "fail"

    if trend == "fail":
        classification = "no_uptrend"
    elif extended:
        classification = "forming"
    elif structure == "fail" or volume == "fail":
        classification = "downtrend"
    elif confirm == "pass" and support != "fail" and structure == "pass":
        classification = "pullback"
    else:
        classification = "forming"

    return {
        "classification": classification,
        "retrace": round(rd, 3) if rd is not None else None,
        "grades": ",".join([trend, volume, structure, support, confirm]),
        "confluence": confluence,
        "extended": extended,
    }
