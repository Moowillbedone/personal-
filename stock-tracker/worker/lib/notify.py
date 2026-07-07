"""Push-notification dispatcher.

Supports Telegram (preferred) and Discord. Backend is auto-detected by which
env vars are present. If neither is set, all notify_* calls are silent no-ops.

ENV VARS:
  TELEGRAM_BOT_TOKEN   + TELEGRAM_CHAT_ID  → Telegram
  DISCORD_WEBHOOK_URL                       → Discord (fallback)
"""
from __future__ import annotations

import os

import requests

TG_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TG_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "").strip()
DISCORD_URL = os.getenv("DISCORD_WEBHOOK_URL", "").strip()

# Empty-string secrets bypass os.getenv's default arg (the key is "set"),
# so we need `or` for a real fallback. Same gotcha as ai_scan.py.
FRONT_URL = (os.getenv("FRONT_URL") or "https://stock-tracker-khaki-mu.vercel.app").rstrip("/")

# Comma-separated allow-list. Defaults exclude `volume_spike` because pure volume
# events without a price move are noisy. Override with NOTIFY_TYPES env var.
NOTIFY_TYPES = set(
    t.strip() for t in os.getenv("NOTIFY_TYPES", "gap_up,gap_down").split(",") if t.strip()
)
# If a single poll fires more than this many alerts, collapse into one summary message.
NOTIFY_BATCH_THRESHOLD = int(os.getenv("NOTIFY_BATCH_THRESHOLD", "5"))

# When true, only notify signals that came with at least one recent headline.
# Default OFF until /stats accumulates enough has_news vs no_news data to
# prove the filter is warranted. Flip to "1" via env once you've seen e.g.
# "no_news gap_up win rate 45% vs has_news gap_up 62%" on /stats.
NOTIFY_REQUIRE_NEWS = os.getenv("NOTIFY_REQUIRE_NEWS", "0").strip() in {"1", "true", "yes"}


def _arrow(typ: str) -> str:
    return "🟢▲" if typ == "gap_up" else "🔴▼" if typ == "gap_down" else "🟡⚡"


def _news_badge(s: dict) -> str:
    n = s.get("recent_news_count")
    if n is None:
        return ""
    if n == 0:
        return "  ·  📭 no news"
    return f"  ·  📰 news×{n}"


def _fmt_telegram(s: dict) -> str:
    sym = s["symbol"]
    pct = float(s["pct_change"]) * 100
    volx = float(s["volume_ratio"])
    price = float(s["price"])
    return (
        f"{_arrow(s['signal_type'])} *{sym}*  ·  `{s['signal_type']}`{_news_badge(s)}\n"
        f"💰 ${price:.2f}    Δ {pct:+.2f}%    Vol×{volx:.1f}\n"
        f"🕒 {s['session']} session\n"
        f"[chart →]({FRONT_URL}/ticker/{sym})"
    )


def _send_telegram(s: dict) -> bool:
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    payload = {
        "chat_id": TG_CHAT_ID,
        "text": _fmt_telegram(s),
        "parse_mode": "Markdown",
        "disable_web_page_preview": True,
    }
    try:
        r = requests.post(url, json=payload, timeout=10)
        if r.status_code >= 300:
            print(f"  telegram failed [{r.status_code}]: {r.text[:200]}")
            return False
        return True
    except Exception as e:
        print(f"  telegram exception: {e}")
        return False


def _send_discord(s: dict) -> bool:
    color = (
        0x10B981 if s["signal_type"] == "gap_up"
        else 0xF43F5E if s["signal_type"] == "gap_down"
        else 0xF59E0B
    )
    payload = {
        "username": "Stock Signal Tracker",
        "embeds": [
            {
                "title": f"{_arrow(s['signal_type'])}  {s['symbol']}  ·  {s['signal_type']}",
                "url": f"{FRONT_URL}/ticker/{s['symbol']}",
                "color": color,
                "fields": [
                    {"name": "Price",   "value": f"${float(s['price']):.2f}",          "inline": True},
                    {"name": "Change",  "value": f"{float(s['pct_change'])*100:+.2f}%", "inline": True},
                    {"name": "Vol×",    "value": f"{float(s['volume_ratio']):.1f}×",   "inline": True},
                    {"name": "Session", "value": s["session"],                          "inline": True},
                ],
                "timestamp": s["ts"],
            }
        ],
    }
    try:
        r = requests.post(DISCORD_URL, json=payload, timeout=10)
        if r.status_code >= 300:
            print(f"  discord failed [{r.status_code}]: {r.text[:200]}")
            return False
        return True
    except Exception as e:
        print(f"  discord exception: {e}")
        return False


def _send_telegram_text(text: str) -> bool:
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    try:
        r = requests.post(
            url,
            json={"chat_id": TG_CHAT_ID, "text": text, "parse_mode": "Markdown",
                  "disable_web_page_preview": True},
            timeout=10,
        )
        return r.status_code < 300
    except Exception as e:
        print(f"  telegram exception: {e}")
        return False


def _summary_message(signals: list[dict]) -> str:
    by_type: dict[str, int] = {}
    for s in signals:
        by_type[s["signal_type"]] = by_type.get(s["signal_type"], 0) + 1
    head = "📊 *Signal burst* — " + ", ".join(f"{n} {t}" for t, n in sorted(by_type.items()))
    # Show top 5 by absolute pct_change for context
    top = sorted(signals, key=lambda x: abs(float(x["pct_change"])), reverse=True)[:5]
    lines = [head, "", f"Top {len(top)} by |Δ%|:"]
    for s in top:
        lines.append(
            f"  {_arrow(s['signal_type'])} *{s['symbol']}*  {float(s['pct_change'])*100:+.2f}% "
            f"vol×{float(s['volume_ratio']):.1f}"
        )
    lines.append(f"\n[full list →]({FRONT_URL})")
    return "\n".join(lines)


def _passes_news_gate(signal: dict) -> bool:
    """When NOTIFY_REQUIRE_NEWS is on, suppress signals that fired without a
    recent headline. recent_news_count == None means enrichment failed —
    we let those through (don't punish a transient news-API outage)."""
    if not NOTIFY_REQUIRE_NEWS:
        return True
    n = signal.get("recent_news_count")
    if n is None:
        return True
    return n > 0


def notify_signal(signal: dict) -> None:
    if signal["signal_type"] not in NOTIFY_TYPES:
        return
    if not _passes_news_gate(signal):
        return
    if TG_TOKEN and TG_CHAT_ID:
        _send_telegram(signal)
    elif DISCORD_URL:
        _send_discord(signal)


def notify_batch(signals: list[dict], allowed_symbols: set[str] | None = None) -> None:
    """Send alerts for eligible signals.

    allowed_symbols: optional ticker allow-list (2026-07: the NASDAQ-100
    proxy set from db.get_nasdaq_top100). None = no symbol filter (legacy
    behavior). An EMPTY set means the filter fetch failed — suppress all
    rather than fall open to the full 200-name universe.
    """
    eligible = [
        s for s in signals
        if s["signal_type"] in NOTIFY_TYPES
        and _passes_news_gate(s)
        and (allowed_symbols is None or s["symbol"] in allowed_symbols)
    ]
    if not eligible:
        return

    if len(eligible) <= NOTIFY_BATCH_THRESHOLD:
        for s in eligible:
            notify_signal(s)
        return

    # Burst: send a single summary instead of N individual messages.
    if TG_TOKEN and TG_CHAT_ID:
        _send_telegram_text(_summary_message(eligible))
    elif DISCORD_URL:
        # Reuse Discord embed shape with the highest-magnitude signal as header
        top = max(eligible, key=lambda x: abs(float(x["pct_change"])))
        top["__summary_count__"] = len(eligible)  # ignored by our embed builder
        _send_discord(top)
    print(f"  notify: collapsed {len(eligible)} alerts into 1 summary (threshold={NOTIFY_BATCH_THRESHOLD})")
