"""Tech View scanner engine — Python port of apps/web/lib/techview.ts.

Faithful mirror of the TS engine (갭 + 피보나치 + 주봉 고고저 빗각 + 터치 판정) so the
Tech View scanner list agrees with the per-ticker report on the web side. Runs inside
sma200_scan.py, which already fetches split-adjusted daily(400d) + weekly(1600d) bars
for the whole universe — so the scan costs ZERO extra Alpaca calls.

Only the fields the scanner needs are returned (setup + the headline numbers); the
full report (all levels, AI scenario) is computed on demand by /api/techview.
"""
from __future__ import annotations

import math

RECENT_WIN = 60
GAP_MIN_PCT = 1.5
TOUCH_BAND = 0.006
NEAR_PCT = 3.0


def _r(v: float, dp: int = 2) -> float:
    """half-up rounding to mirror JS Number(v.toFixed(dp)) for positive prices."""
    if v is None:
        return None
    f = 10 ** dp
    return math.floor(abs(v) * f + 0.5) / f * (1 if v >= 0 else -1)


def _pivots(highs, lows, k: int):
    out = []
    n = len(highs)
    for i in range(k, n - k):
        is_high = True
        is_low = True
        for j in range(i - k, i + k + 1):
            if j == i:
                continue
            if highs[j] >= highs[i]:
                is_high = False
            if lows[j] <= lows[i]:
                is_low = False
        if is_high:
            out.append({"idx": i, "price": highs[i], "kind": "high"})
        if is_low:
            out.append({"idx": i, "price": lows[i], "kind": "low"})
    return out


def _find_gaps(opens, closes, highs, lows, lookback: int = 150):
    n = len(closes)
    start = max(1, n - lookback)
    out = []
    for i in range(start, n):
        prev_close = closes[i - 1]
        op = opens[i]
        if not prev_close > 0:
            continue
        size_pct = (op - prev_close) / prev_close * 100
        if abs(size_pct) < GAP_MIN_PCT:
            continue
        kind = "down" if size_pct < 0 else "up"
        top = max(prev_close, op)
        bottom = min(prev_close, op)
        span = top - bottom
        deepest = bottom if kind == "down" else top
        for j in range(i, n):
            if kind == "down":
                deepest = max(deepest, highs[j])
            else:
                deepest = min(deepest, lows[j])
        if span > 0:
            raw = (deepest - bottom) if kind == "down" else (top - deepest)
            filled_pct = max(0.0, min(100.0, raw / span * 100))
        else:
            filled_pct = 100.0
        out.append(
            {
                "kind": kind,
                "top": _r(top),
                "bottom": _r(bottom),
                "size_pct": _r(size_pct),
                "bars_ago": n - 1 - i,
                "filled_pct": _r(filled_pct, 0),
                "filled": filled_pct >= 95,
            }
        )
    out.reverse()
    return out


FIB_RATIOS = [(0.236, "0.236"), (0.382, "0.382"), (0.5, "0.5"), (0.618, "0.618"), (0.786, "0.786")]


def _build_fib(highs, lows, gaps, pivots):
    n = len(highs)
    if n < 20:
        return None
    hi_idx = -1
    recent = next((g for g in gaps if g["kind"] == "down" and g["bars_ago"] <= 90), None)
    if recent:
        hi_idx = n - 1 - recent["bars_ago"]
    else:
        ph = [p for p in pivots if p["kind"] == "high"]
        if not ph:
            return None
        hi_idx = ph[-1]["idx"]
    if hi_idx < 0 or hi_idx >= n:
        return None
    anchor_high = max(highs[hi_idx], highs[max(0, hi_idx - 1)])
    anchor_low = lows[hi_idx]
    for j in range(hi_idx, n):
        if lows[j] < anchor_low:
            anchor_low = lows[j]
    span = anchor_high - anchor_low
    if not span > 0:
        return None
    return {
        "anchor_high": _r(anchor_high),
        "anchor_low": _r(anchor_low),
        "levels": [{"ratio": r, "label": lb, "price": _r(anchor_low + span * r)} for r, lb in FIB_RATIOS],
    }


def _build_diagonal(w_highs, w_lows, last_price):
    n = len(w_highs)
    if n < 30:
        return None
    pv = _pivots(w_highs, w_lows, 2)
    highs = [p for p in pv if p["kind"] == "high"]
    lows = [p for p in pv if p["kind"] == "low"]
    if len(highs) < 2 or not lows:
        return None
    h2 = highs[-1]
    h1 = None
    for i in range(len(highs) - 2, -1, -1):
        if h2["idx"] - highs[i]["idx"] >= 6:
            h1 = highs[i]
            break
    if h1 is None:
        h1 = highs[0]
    if h1["idx"] == h2["idx"]:
        return None
    slope = (h2["price"] - h1["price"]) / (h2["idx"] - h1["idx"])
    last_idx = n - 1
    low = lows[0]
    max_dev = -1e18
    for l in lows:
        if l["idx"] < h1["idx"]:
            continue
        line_at = h1["price"] + slope * (l["idx"] - h1["idx"])
        dev = line_at - l["price"]
        if dev > max_dev:
            max_dev = dev
            low = l
    high_line_now = h1["price"] + slope * (last_idx - h1["idx"])
    low_line_now = low["price"] + slope * (last_idx - low["idx"])
    width = abs(high_line_now - low_line_now)
    if not width > 0:
        return None
    base = min(high_line_now, low_line_now)
    lines = []
    for m in range(-2, 4):
        price = base + width * m
        if not price > 0:
            continue
        if m == 0:
            label = "채널 하단(저)"
        elif m == 1:
            label = "채널 상단(고)"
        elif m > 1:
            label = f"상단+{m - 1}"
        else:
            label = f"하단{m}"
        lines.append({"label": label, "price": _r(price)})
    lines.sort(key=lambda x: -x["price"])
    nearest = None
    for l in lines:
        dist = (l["price"] - last_price) / last_price * 100
        if nearest is None or abs(dist) < abs(nearest["dist_pct"]):
            nearest = {"label": l["label"], "price": l["price"], "dist_pct": _r(dist)}
    return {"lines": lines, "nearest": nearest, "width": _r(width)}


def analyze_tech(daily_df, weekly_df) -> dict | None:
    """Returns the scanner-facing subset of the TS analyzeTech result."""
    if daily_df is None or getattr(daily_df, "empty", True):
        return None
    o = [float(x) for x in daily_df["Open"].tolist()]
    h = [float(x) for x in daily_df["High"].tolist()]
    l = [float(x) for x in daily_df["Low"].tolist()]
    c = [float(x) for x in daily_df["Close"].tolist()]
    n = len(c)
    if n < 40:
        return None
    price = c[-1]
    if not price > 0:
        return None

    gaps = _find_gaps(o, c, h, l, 150)
    pivots = _pivots(h, l, 3)
    fib = _build_fib(h, l, gaps, pivots)

    diagonal = None
    if weekly_df is not None and not getattr(weekly_df, "empty", True):
        wh = [float(x) for x in weekly_df["High"].tolist()]
        wl = [float(x) for x in weekly_df["Low"].tolist()]
        diagonal = _build_diagonal(wh, wl, price)

    # key levels (same filter as TS)
    key_levels = []
    if diagonal:
        for ln in diagonal["lines"]:
            if abs((ln["price"] - price) / price) <= 0.25:
                key_levels.append({"label": f"빗각 {ln['label']}", "price": ln["price"], "source": "diagonal"})
    if fib:
        for ln in fib["levels"]:
            if ln["ratio"] in (0.382, 0.5, 0.618):
                key_levels.append({"label": f"피보 {ln['label']}", "price": ln["price"], "source": "fib"})
    target_gap = next((g for g in gaps if g["kind"] == "down" and not g["filled"] and g["top"] > price), None)

    # touches (last 10 bars, non-gap levels only for classification)
    touches = []
    for lv in key_levels:
        if not lv["price"] > 0:
            continue
        band = lv["price"] * TOUCH_BAND
        for i in range(max(1, n - 10), n):
            if l[i] - band <= lv["price"] <= h[i] + band:
                rng = h[i] - l[i]
                lower_wick = min(o[i], c[i]) - l[i]
                wick = lower_wick / rng if rng > 0 else 0.0
                nxt_ok = i + 1 < n and c[i + 1] > o[i + 1] and c[i + 1] > c[i]
                touches.append(
                    {"label": lv["label"], "price": lv["price"], "bars_ago": n - 1 - i,
                     "wick": _r(wick, 2), "confirmed": bool(nxt_ok), "source": lv["source"]}
                )
    touches.sort(key=lambda t: t["bars_ago"])

    nearest_dist = None
    nearest_label = None
    for lv in key_levels:
        if lv["source"] == "gap":
            continue
        d = (lv["price"] - price) / price * 100
        if nearest_dist is None or abs(d) < abs(nearest_dist):
            nearest_dist = _r(d)
            nearest_label = lv["label"]

    fresh = next((t for t in touches if t["bars_ago"] <= 3 and t["source"] != "gap"), None)
    if not diagonal and not fib:
        setup = "no_structure"
    elif fresh and fresh["confirmed"]:
        setup = "touch_confirmed"
    elif fresh:
        setup = "touch_pending"
    elif nearest_dist is not None and abs(nearest_dist) <= 1:
        setup = "at_level"
    elif nearest_dist is not None and abs(nearest_dist) <= NEAR_PCT:
        setup = "approaching"
    else:
        setup = "extended"

    target_upside = _r((target_gap["bottom"] - price) / price * 100, 1) if target_gap else None

    note = None
    if fresh:
        note = f"{fresh['label']} 터치(꼬리 {int(fresh['wick'] * 100)}%)" + (" +확인" if fresh["confirmed"] else " ·확인대기")
    elif diagonal and diagonal["nearest"]:
        nb = diagonal["nearest"]
        note = f"빗각 {nb['label']} {nb['price']} ({'+' if nb['dist_pct'] >= 0 else ''}{nb['dist_pct']}%)"

    return {
        "setup": setup,
        "price": _r(price),
        "nearest_label": nearest_label,
        "nearest_dist": nearest_dist,
        "target_upside": target_upside,
        "note": note,
    }
