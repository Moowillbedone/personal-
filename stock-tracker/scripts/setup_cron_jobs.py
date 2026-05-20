#!/usr/bin/env python3
"""Set up cron-job.org cronjobs that trigger our GitHub Actions workflows.

Why we need this: GitHub Actions scheduled triggers have shown 50+ hour
outages in practice. cron-job.org (free, reliable, 1-min minimum interval)
calls our workflow_dispatch endpoint on a predictable schedule, so the
pipeline keeps running even when GH's internal scheduler is dead.

Reads CRONJOB_ORG_API_KEY and GITHUB_PAT from apps/web/.env.local (which
is gitignored). Idempotent: lists existing jobs first and skips any whose
title already exists, so re-running is safe.

Cron-job.org REST API docs: https://docs.cron-job.org/rest-api.html
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# `requests` (already a worker dep) ships with certifi's CA bundle which
# avoids the macOS-default-Python "CERTIFICATE_VERIFY_FAILED" stdlib trap.
import requests


REPO = "Moowillbedone/personal-"
ENV_PATH = Path(__file__).resolve().parents[1] / "apps" / "web" / ".env.local"


def load_env(path: Path) -> dict[str, str]:
    """Minimal .env parser — handles KEY=value, strips quotes/whitespace.
    Skips comments and blank lines. No interpolation."""
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        v = v.strip().strip('"').strip("'")
        out[k.strip()] = v
    return out


def cron_api(
    method: str, path: str, api_key: str, body: dict | None = None
) -> tuple[int, dict]:
    """One cron-job.org REST call. Returns (status, parsed_body)."""
    url = f"https://api.cron-job.org{path}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    try:
        r = requests.request(
            method=method, url=url, headers=headers, json=body, timeout=15
        )
    except Exception as e:
        return 0, {"error": str(e)}
    try:
        parsed = r.json() if r.content else {}
    except Exception:
        parsed = {"raw": r.text[:200]}
    return r.status_code, parsed


def build_job(
    title: str,
    workflow_file: str,
    workflow_body: dict,
    hours_utc: list[int],
    github_pat: str,
) -> dict:
    """Build the PUT /jobs payload for one cronjob.

    - schedule: every weekday at the given UTC hours, minute :00
    - request: POST to GH Actions workflow_dispatch endpoint with auth
    - body: JSON-stringified workflow_dispatch payload (ref + inputs)
    """
    return {
        "job": {
            "title": title,
            "url": (
                f"https://api.github.com/repos/{REPO}"
                f"/actions/workflows/{workflow_file}/dispatches"
            ),
            "enabled": True,
            "saveResponses": True,  # preserve response bodies for debugging in UI
            "schedule": {
                "timezone": "UTC",
                "expiresAt": 0,
                "hours": hours_utc,
                "mdays": [-1],     # every day of month
                "minutes": [0],    # on the hour
                "months": [-1],    # every month
                "wdays": [1, 2, 3, 4, 5],  # Mon-Fri
            },
            "requestMethod": 1,    # 1 = POST
            "extendedData": {
                "headers": {
                    "Authorization": f"Bearer {github_pat}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                "body": json.dumps(workflow_body),
            },
        }
    }


# Cronjob definitions. UTC hours chosen so the workflow fires at the
# right KST/ET moment relative to US market sessions.
#
# UTC 13 = ET 09:00 (EDT) = KST 22:00  (pre-market close / regular open)
# UTC 21 = ET 17:00 (EDT) = KST 06:00  (after-hours close)
# UTC 23 = ET 19:00 (EDT) = KST 08:00  (after market settle, before next day)
JOBS = [
    # Poll: every 5h Mon-Fri, each run starts a 5h20m internal loop so
    # adjacent runs overlap (signal_exists dedupes any duplicate signals).
    (
        "stock-tracker-poll",
        "stock-tracker-poll.yml",
        {"ref": "main", "inputs": {"loop_min": "320"}},
        [6, 11, 16, 21],
    ),
    # AI scan: 2× per US weekday — both during user's waking hours (KST).
    # Dropped to 2x (was 3x) on 2026-05-20 after discovering this project's
    # gemini-2.5-flash free-tier RPD is 20 (not docs' 250). Two scans × 6
    # watchlist = 12 calls/day (60%) leaves 8-call margin for manual clicks.
    #
    # User-chosen times (2026-05-20):
    #   08 UTC = KST 17:00  pre-market session start
    #   13 UTC = KST 22:00  regular open in 30m  ← most actionable digest
    # Dropped: 21 UTC = KST 06:00 (after-hours done) — user prefers
    # notifications during their day rather than at dawn.
    (
        "stock-tracker-ai-scan",
        "stock-tracker-ai-scan.yml",
        {"ref": "main"},
        [8, 13],
    ),
    # Earnings alert: once daily at KST 22:00 (before US regular open).
    (
        "stock-tracker-earnings-alert",
        "stock-tracker-earnings-alert.yml",
        {"ref": "main"},
        [13],
    ),
    # Backtest + realize + ai_realize chain: 4× per weekday so freshly-
    # fired signals get expected_*/realized_* filled within hours instead
    # of waiting 24h. Matches the cron schedule in workflow file.
    #   05 UTC = KST 14:00     11 UTC = KST 20:00
    #   19 UTC = KST 04:00     23 UTC = KST 08:00 (next day)
    (
        "stock-tracker-backtest",
        "stock-tracker-backtest.yml",
        {"ref": "main"},
        [5, 11, 19, 23],
    ),
]


def main() -> int:
    env = load_env(ENV_PATH)
    cron_key = env.get("CRONJOB_ORG_API_KEY", "")
    github_pat = env.get("GITHUB_PAT", "")
    if not cron_key:
        print(f"ERROR: CRONJOB_ORG_API_KEY missing in {ENV_PATH}", file=sys.stderr)
        return 1
    if not github_pat:
        print(f"ERROR: GITHUB_PAT missing in {ENV_PATH}", file=sys.stderr)
        return 1

    print("Fetching existing cronjobs from cron-job.org...")
    code, data = cron_api("GET", "/jobs", cron_key)
    if code != 200:
        print(f"  failed to list jobs: HTTP {code} {data}", file=sys.stderr)
        return 1
    existing = {j.get("title", ""): j.get("jobId") for j in data.get("jobs", [])}
    print(f"  account has {len(existing)} existing job(s)")

    created = 0
    skipped = 0
    failed = 0
    for title, wf, body, hours in JOBS:
        if title in existing:
            print(f"  - {title}: already exists (jobId={existing[title]}), skipping")
            skipped += 1
            continue
        payload = build_job(title, wf, body, hours, github_pat)
        code, data = cron_api("PUT", "/jobs", cron_key, payload)
        if code in (200, 201):
            print(f"  + {title}: created (jobId={data.get('jobId')})")
            created += 1
        else:
            print(f"  ! {title}: failed HTTP {code} {data}", file=sys.stderr)
            failed += 1

    total = len(JOBS)
    print(
        f"\nResult: created={created} skipped(existing)={skipped} "
        f"failed={failed} (of {total})"
    )
    if failed == 0:
        print("Verify at https://console.cron-job.org/jobs — 'Test run' on each "
              "should return HTTP 204 from GitHub.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
