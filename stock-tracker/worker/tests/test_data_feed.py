"""Provider selection stays explicit and free-tier historical requests delayed."""
import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, Mock
from lib import alpaca

class FeedTests(unittest.TestCase):
    def test_sip_requests_explicitly_end_outside_realtime_subscription_window(self):
        response = Mock()
        response.json.return_value = {"bars": {"AAPL": [{"t": "2026-09-28T04:00:00Z", "o": 100, "h": 101, "l": 99, "c": 100, "v": 12}]}, "next_page_token": None}
        with patch.object(alpaca, "FEED", "sip"), patch.object(alpaca, "_headers", return_value={}), patch.object(alpaca.requests, "get", return_value=response) as get:
            frames = alpaca.fetch_recent_bars(["AAPL"], interval="1d", lookback="30d", adjustment="split")
        params = get.call_args.kwargs["params"]
        self.assertEqual(params["feed"], "sip")
        self.assertEqual(params["adjustment"], "split")
        self.assertLessEqual(datetime.fromisoformat(params["end"].replace("Z", "+00:00")), datetime.now(timezone.utc) - timedelta(minutes=15))
        self.assertEqual(frames["AAPL"].iloc[-1]["Close"], 100)

if __name__ == "__main__":
    unittest.main()
