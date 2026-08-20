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
    # biggest 장대음봉 gap in the window (not merely the most recent small one)
    big = [g for g in gaps if g["kind"] == "down" and g["bars_ago"] <= 120 and abs(g["size_pct"]) >= 3]
    big.sort(key=lambda g: -abs(g["size_pct"]))
    if big:
        hi_idx = n - 1 - big[0]["bars_ago"]
    else:
        ph = [p for p in pivots if p["kind"] == "high"]
        if not ph:
            return None
        hi_idx = ph[-1]["idx"]
    if hi_idx < 0 or hi_idx >= n:
        return None
    anchor_high = highs[hi_idx]  # the gap candle's OWN high
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


LOG_BAND = 0.012
K_STEPS = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3]
MIN_PAIR_SEP = 10
TOP_PIVOTS = 14
MAX_NEAR_PCT = 12


def _ch_label(k, kind: str) -> str:
    if k == 0:
        return "빗각(고-고)" if kind == "고고저" else "빗각(저-저)"
    if k == 1:
        return "채널 반대선"
    half = float(k) != int(k)
    return f"{'하프' if half else '채널'}{'+' if k > 0 else ''}{k}"


def _significant_pivots(highs, lows, k: int = 4):
    """'역사적 의미'가 큰 피벗만 — 되돌림 폭(prominence) 상위 TOP_PIVOTS개."""
    pv = _pivots(highs, lows, k)
    n = len(highs)
    scored = []
    for p in pv:
        i = p["idx"]
        f, t = max(0, i - 26), min(n - 1, i + 26)
        opp = min(lows[f:t + 1]) if p["kind"] == "high" else max(highs[f:t + 1])
        if opp <= 0 or p["price"] <= 0:
            continue
        scored.append((abs(math.log(p["price"]) - math.log(opp)), p))
    scored.sort(key=lambda x: -x[0])
    return sorted([p for _, p in scored[:TOP_PIVOTS]], key=lambda p: p["idx"])


def _make_channel(highs, lows, last_price, kind, i1, i2, i3, space):
    n = len(highs)
    last_idx = n - 1
    pick = (lambda i: highs[i]) if kind == "고고저" else (lambda i: lows[i])
    p1, p2 = pick(i1), pick(i2)
    if not (p1 > 0 and p2 > 0):
        return None
    Y = (lambda v: math.log(v)) if space == "log" else (lambda v: v)
    IY = (lambda v: math.exp(v)) if space == "log" else (lambda v: v)
    m = (Y(p2) - Y(p1)) / (i2 - i1)
    line3 = Y(p1) + m * (i3 - i1)
    d = 0.0
    for c in (highs[i3], lows[i3]):
        dv = Y(c) - line3
        if abs(dv) > abs(d):
            d = dv
    if d == 0:
        return None
    if space == "log" and math.exp(abs(d)) > 4:
        return None
    base_now = Y(p1) + m * (last_idx - i1)
    lines = []
    for k in K_STEPS:
        v = IY(base_now + d * k)
        if v <= 0 or math.isinf(v):
            continue
        lines.append({"label": _ch_label(k, kind), "price": _r(v), "half": float(k) != int(k)})
    if not lines:
        return None
    lines.sort(key=lambda x: -x["price"])
    touch = 0
    in_range = set()
    for b in range(i2 + 1, last_idx + 1):
        lo, hi = lows[b], highs[b]
        hit = False
        for k in K_STEPS:
            v = IY(Y(p1) + m * (b - i1) + d * k)
            if v <= 0:
                continue
            if lo * 0.8 <= v <= hi * 1.2:
                in_range.add(k)
            if not hit and lo * (1 - LOG_BAND) <= v <= hi * (1 + LOG_BAND):
                hit = True
        if hit:
            touch += 1
    norm = round(touch / max(1, len(in_range)), 1)
    nearest = None
    for l in lines:
        dist = (l["price"] - last_price) / last_price * 100
        if nearest is None or abs(dist) < abs(nearest["dist_pct"]):
            nearest = {"label": l["label"], "price": l["price"], "dist_pct": _r(dist)}
    if nearest is None or abs(nearest["dist_pct"]) > MAX_NEAR_PCT:
        return None
    return {"kind": kind, "space": space, "lines": lines, "nearest": nearest,
            "touch": touch, "norm": norm}


def _build_diagonal(w_highs, w_lows, last_price, kind="고고저"):
    """주봉 빗각 채널 — linear/log 둘 다 만들고 정규화 터치점수로 고른다.
    (사용자 TSLA 채널이 linear에서만 재현되고 검증점수도 linear가 우월했다.)"""
    n = len(w_highs)
    if n < 60:
        return None
    sig = _significant_pivots(w_highs, w_lows, 4)
    base = [p for p in sig if (p["kind"] == "high" if kind == "고고저" else p["kind"] == "low")]
    if len(base) < 2 or len(sig) < 3:
        return None
    cands = []
    for i in range(1, len(base)):
        for j in range(i):
            if base[i]["idx"] - base[j]["idx"] < MIN_PAIR_SEP:
                continue
            for space in ("linear", "log"):
                Y = (lambda v: math.log(v)) if space == "log" else (lambda v: v)
                pk = (lambda ii: w_highs[ii]) if kind == "고고저" else (lambda ii: w_lows[ii])
                mm = (Y(pk(base[i]["idx"])) - Y(pk(base[j]["idx"]))) / (base[i]["idx"] - base[j]["idx"])
                best3, best_dev = -1, 0.0
                for o in sig:
                    if o["idx"] <= base[j]["idx"]:
                        continue
                    line_y = Y(pk(base[j]["idx"])) + mm * (o["idx"] - base[j]["idx"])
                    gap = Y(o["price"]) - line_y
                    if abs(gap) > abs(best_dev):
                        best_dev, best3 = gap, o["idx"]
                if best3 < 0:
                    continue
                ch = _make_channel(w_highs, w_lows, last_price, kind,
                                   base[j]["idx"], base[i]["idx"], best3, space)
                if ch:
                    cands.append(ch)
    if not cands:
        return None
    cands.sort(key=lambda c: (-c["norm"], abs(c["nearest"]["dist_pct"])))
    return cands[0] if cands[0]["touch"] >= 3 else None


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
                key_levels.append({"label": f"빗각 {ln['label']}", "price": ln["price"],
                                   "source": "diagonal", "trigger": True, "prime": True})
    if fib:
        for ln in fib["levels"]:
            if ln["ratio"] in (0.382, 0.5, 0.618, 0.786):
                key_levels.append({"label": f"피보 {ln['label']}", "price": ln["price"],
                                   "source": "fib", "trigger": ln["ratio"] >= 0.618,
                                   "prime": ln["ratio"] == 0.618})
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
                     "wick": _r(wick, 2), "confirmed": bool(nxt_ok), "source": lv["source"],
                     "trigger": lv.get("trigger", False), "prime": lv.get("prime", False)}
                )
    touches.sort(key=lambda t: t["bars_ago"])

    nearest_dist = None
    nearest_label = None
    for lv in key_levels:
        if not lv.get("trigger"):
            continue
        d = (lv["price"] - price) / price * 100
        if nearest_dist is None or abs(d) < abs(nearest_dist):
            nearest_dist = _r(d)
            nearest_label = lv["label"]

    fresh = next(
        (t for t in touches
         if t.get("trigger") and t["bars_ago"] <= 3 and (t["confirmed"] or t["wick"] >= 0.2)),
        None,
    )
    # confluence = key levels stacked within ±1.5% of the touched price ("확실한 자리")
    confl = 0
    if fresh:
        confl = sum(1 for lv in key_levels if abs((lv["price"] - fresh["price"]) / fresh["price"]) <= 0.015)
    if not diagonal and not fib:
        setup = "no_structure"
    elif fresh and fresh["confirmed"] and (fresh.get("prime") or confl >= 2):
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
        note = (f"{fresh['label']} 터치(꼬리 {int(fresh['wick'] * 100)}%, 겹침 {confl})"
                + (" +확인" if fresh["confirmed"] else " ·확인대기"))
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
