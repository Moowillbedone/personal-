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

FRONT_URL = os.getenv("FRONT_URL", "https://stock-tracker-khaki-mu.vercel.app").rstrip("/")


def _arrow(typ: str) -> str:
    return "🟢▲" if typ == "gap_up" else "🔴▼" if typ == "gap_down" else "🟡⚡"


def _fmt_telegram(s: dict) -> str:
    sym = s["symbol"]
    pct = float(s["pct_change"]) * 100
    volx = float(s["volume_ratio"])
    price = float(s["price"])
    return (
        f"{_arrow(s['signal_type'])} *{sym}*  ·  `{s['signal_type']}`\n"
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


def notify_signal(signal: dict) -> None:
    if TG_TOKEN and TG_CHAT_ID:
        _send_telegram(signal)
    elif DISCORD_URL:
        _send_discord(signal)
    # else: silent no-op


def notify_batch(signals: list[dict]) -> None:
    for s in signals:
        notify_signal(s)
