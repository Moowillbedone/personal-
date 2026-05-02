"""Discord webhook notifier (Slack-compatible if URL points to a Slack hook).

Set DISCORD_WEBHOOK_URL in env. If absent, all notify_* calls become no-ops.
"""
from __future__ import annotations

import os

import requests

WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "").strip()

# Discord embed colors (hex int)
COLOR = {
    "gap_up": 0x10B981,        # emerald
    "gap_down": 0xF43F5E,      # rose
    "volume_spike": 0xF59E0B,  # amber
}


def notify_signal(signal: dict) -> None:
    """Post a single signal to the configured webhook. No-op if not configured."""
    if not WEBHOOK_URL:
        return

    sym = signal["symbol"]
    typ = signal["signal_type"]
    pct = float(signal["pct_change"]) * 100
    volx = float(signal["volume_ratio"])
    price = float(signal["price"])
    sess = signal["session"]
    ts = signal["ts"]

    arrow = "🟢▲" if typ == "gap_up" else "🔴▼" if typ == "gap_down" else "🟡⚡"

    payload = {
        "username": "Stock Signal Tracker",
        "embeds": [
            {
                "title": f"{arrow}  {sym}  ·  {typ}",
                "url": f"https://stock-tracker-khaki-mu.vercel.app/ticker/{sym}",
                "color": COLOR.get(typ, 0x6B7280),
                "fields": [
                    {"name": "Price",   "value": f"${price:.2f}", "inline": True},
                    {"name": "Change",  "value": f"{pct:+.2f}%",  "inline": True},
                    {"name": "Vol×",    "value": f"{volx:.1f}×",  "inline": True},
                    {"name": "Session", "value": sess,            "inline": True},
                ],
                "timestamp": ts,
            }
        ],
    }

    try:
        r = requests.post(WEBHOOK_URL, json=payload, timeout=10)
        if r.status_code >= 300:
            print(f"  notify failed [{r.status_code}]: {r.text[:200]}")
    except Exception as e:
        # Never crash the poll job over a notification failure.
        print(f"  notify exception: {e}")


def notify_batch(signals: list[dict]) -> None:
    """Convenience: post each signal sequentially."""
    for s in signals:
        notify_signal(s)
