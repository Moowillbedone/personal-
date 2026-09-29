"""Credentials for private front-end APIs, never for third-party requests."""
from __future__ import annotations

import os
from urllib.parse import urlsplit


class OwnerAPIConfigError(ValueError):
    pass


def owner_request_options(front_url: str, request_url: str) -> dict:
    """Return per-request Basic auth only for the configured front-end origin.

    Redirects are disabled so credentials cannot follow an unexpected target.
    Even local workers require configured credentials; no worker auth bypass.
    """
    front, target = urlsplit(front_url), urlsplit(request_url)
    local = front.hostname in {"localhost", "127.0.0.1", "::1"}
    if (
        not front.hostname
        or (front.scheme != "https" and not (front.scheme == "http" and local))
        or front.username is not None
        or front.password is not None
        or front.path not in {"", "/"}
        or front.query
        or front.fragment
        or (target.scheme, target.netloc) != (front.scheme, front.netloc)
        or not target.path.startswith("/api/")
        or target.fragment
    ):
        raise OwnerAPIConfigError("Owner API requires the configured FRONT_URL origin (HTTPS outside localhost).")
    username = os.getenv("STOCK_TRACKER_OWNER_USER") or "owner"
    password = os.getenv("STOCK_TRACKER_OWNER_PASSWORD") or ""
    if not username.isascii() or ":" in username or any(ord(c) < 32 for c in username):
        raise OwnerAPIConfigError("STOCK_TRACKER_OWNER_USER must be an ASCII Basic-auth username without ':'.")
    if len(password) < 20 or not password.isascii() or any(ord(c) < 32 for c in password):
        raise OwnerAPIConfigError("Set STOCK_TRACKER_OWNER_PASSWORD to the matching server secret (ASCII, at least 20 characters).")
    return {"auth": (username, password), "allow_redirects": False}
