"""Private worker requests fail closed and never send owner auth elsewhere."""
import os
import unittest
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

import ai_scan
import market_wrap
from lib.owner_api import OwnerAPIConfigError, owner_request_options


FRONT = "https://tracker.example"
SECRET = "example-only-password-12345"


def fresh_response(session="regular", age_seconds=30):
    return {"dataQuality": {"status": "fresh"}, "analysis": {
        "symbol": "AAPL", "context": {
            "methodology_version": "evidence-v1", "session": session,
            "data_quality": {"status": "fresh"}, "last_price": 100,
            "price_as_of": (datetime.now(timezone.utc) - timedelta(seconds=age_seconds)).isoformat(),
        },
    }}


class OwnerAPITests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"STOCK_TRACKER_OWNER_USER": "", "STOCK_TRACKER_OWNER_PASSWORD": SECRET})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_default_user_and_no_redirects(self):
        options = owner_request_options(FRONT, FRONT + "/api/analyze")
        self.assertEqual(options, {"auth": ("owner", SECRET), "allow_redirects": False})

    def test_missing_short_or_non_ascii_password_fails_closed(self):
        for secret in ("", "short", "가" * 20):
            with self.subTest(secret_length=len(secret)), patch.dict(os.environ, {"STOCK_TRACKER_OWNER_PASSWORD": secret}):
                with self.assertRaises(OwnerAPIConfigError):
                    owner_request_options(FRONT, FRONT + "/api/analyze")

    def test_other_origin_and_remote_http_are_rejected(self):
        for front, target in (
            (FRONT, "https://api.telegram.org/api/analyze"),
            (FRONT, FRONT + ".evil.example/api/analyze"),
            ("http://tracker.example", "http://tracker.example/api/analyze"),
            ("https://user:pass@tracker.example", "https://user:pass@tracker.example/api/analyze"),
        ):
            with self.subTest(front=front, target=target), self.assertRaises(OwnerAPIConfigError):
                owner_request_options(front, target)

    def test_analyze_auth_is_per_request(self):
        response = Mock(status_code=200)
        response.json.return_value = fresh_response()
        with patch.object(ai_scan, "FRONT_URL", FRONT), patch.object(ai_scan.requests, "post", return_value=response) as post:
            result = ai_scan._http_post_once(FRONT + "/api/analyze", "AAPL")
        self.assertEqual(result[0], response.json.return_value["analysis"])
        self.assertFalse(post.call_args.kwargs["json"]["allowStale"])
        self.assertEqual(post.call_args.kwargs["auth"], ("owner", SECRET))
        self.assertFalse(post.call_args.kwargs["allow_redirects"])

    def test_stale_or_unverified_success_never_publishes_a_verdict(self):
        cases = [fresh_response(age_seconds=180), fresh_response("pre", 360), fresh_response("closed"), {"analysis": {"symbol": "AAPL"}}]
        for field, value in (("stale", True), ("dataQuality", {"status": "stale"}), ("dataQuality", None)):
            payload = fresh_response()
            payload[field] = value
            cases.append(payload)
        for field, value in (("methodology_version", "legacy"), ("price_as_of", "invalid"), ("last_price", float("nan")), ("data_quality", {"status": "partial"})):
            payload = fresh_response()
            payload["analysis"]["context"][field] = value
            cases.append(payload)
        for payload in cases:
            response = Mock(status_code=200)
            response.json.return_value = deepcopy(payload)
            with self.subTest(payload=payload), patch.object(ai_scan, "FRONT_URL", FRONT), patch.object(ai_scan.requests, "post", return_value=response), patch.object(ai_scan.time, "sleep") as sleep:
                self.assertEqual(ai_scan.call_analyze("AAPL"), (None, ai_scan.FAIL_REASON_EVIDENCE))
                sleep.assert_not_called()

    def test_fresh_extended_session_summary_is_allowed(self):
        for session in ("pre", "after"):
            with self.subTest(session=session):
                self.assertTrue(ai_scan._has_current_evidence(fresh_response(session, 240)))

    def test_digest_rechecks_plan_age_after_a_long_scan(self):
        plan = {"entry_low": 99, "entry_high": 100, "stop": 95, "target_1": 110, "target_2": 115}
        analysis = fresh_response()["analysis"]
        analysis["context"]["trade_plan"] = plan
        self.assertEqual(ai_scan._plan_of(analysis), plan)
        analysis["context"]["price_as_of"] = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        rendered = ai_scan._format_pick({**analysis, "plan": plan}, full=True)
        self.assertIn("시나리오 만료", rendered)
        self.assertNotIn("99.00~100.00", rendered)
        self.assertIn("가격 근거:", rendered)

    def test_missing_auth_makes_no_protected_request(self):
        with patch.dict(os.environ, {"STOCK_TRACKER_OWNER_PASSWORD": ""}), patch.object(ai_scan, "FRONT_URL", FRONT), patch.object(market_wrap, "FRONT_URL", FRONT), patch.object(ai_scan.requests, "post") as post, patch.object(market_wrap.requests, "get") as get:
            self.assertEqual(ai_scan._http_post_once(FRONT + "/api/analyze", "AAPL")[1], ai_scan.FAIL_REASON_AUTH)
            self.assertIsNone(market_wrap._get_json("/api/positions/override"))
        post.assert_not_called()
        get.assert_not_called()

    def test_wrap_auth_only_on_private_routes(self):
        response = Mock(status_code=200)
        response.json.return_value = {}
        with patch.object(market_wrap, "FRONT_URL", FRONT), patch.object(market_wrap.requests, "get", return_value=response) as get:
            market_wrap._get_json("/api/trades/positions?mode=real")
            self.assertEqual(get.call_args.kwargs["auth"], ("owner", SECRET))
            self.assertFalse(get.call_args.kwargs["allow_redirects"])
            market_wrap._get_json("/api/regime")
            self.assertNotIn("auth", get.call_args.kwargs)

    def test_auth_denial_is_not_retried(self):
        response = Mock(status_code=401, text="Owner login required")
        with patch.object(ai_scan, "FRONT_URL", FRONT), patch.object(ai_scan.requests, "post", return_value=response) as post, patch.object(ai_scan.time, "sleep") as sleep:
            self.assertEqual(ai_scan.call_analyze("AAPL"), (None, ai_scan.FAIL_REASON_AUTH))
        post.assert_called_once()
        sleep.assert_not_called()


if __name__ == "__main__":
    unittest.main()
