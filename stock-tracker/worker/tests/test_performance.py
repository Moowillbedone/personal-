"""Offline regression tests: no broker, database or production writes."""
import math
import unittest

import pandas as pd

from lib.backtest import HistoricalSignal, aggregate_expected, find_analogues
from lib.returns import forward_close


def daily(rows):
    return pd.DataFrame({"Close": [r[1] for r in rows]}, index=pd.DatetimeIndex([pd.Timestamp(r[0], tz="America/New_York") for r in rows]))


def observation(symbol="AAPL", ts="2026-06-01T14:00Z", available="2026-06-08T20:15Z", value=0.02):
    return HistoricalSignal(symbol, pd.Timestamp(ts), "gap_up", 0.02, 3.0, value, value, value, pd.Timestamp(available) if available else None)


class ForwardCloseTests(unittest.TestCase):
    def test_premarket_uses_next_session_not_same_day(self):
        bars = daily([("2026-06-01", 100), ("2026-06-02", 101)])
        result = forward_close(bars, pd.Timestamp("2026-06-01T10:00Z"), 1, pd.Timestamp("2026-06-03T00:00Z"))
        self.assertEqual(result[0], 101)

    def test_weekend_and_holiday_do_not_count_as_sessions(self):
        bars = daily([("2026-07-02", 100), ("2026-07-06", 106), ("2026-07-07", 107)])
        self.assertEqual(forward_close(bars, pd.Timestamp("2026-07-02T15:00Z"), 1, pd.Timestamp("2026-07-08T00:00Z"))[0], 106)

    def test_daily_timestamp_does_not_make_unfinished_close_available(self):
        bars = daily([("2026-06-02", 105)])
        anchor = pd.Timestamp("2026-06-01T15:00Z")
        self.assertIsNone(forward_close(bars, anchor, 1, pd.Timestamp("2026-06-02T19:00Z")))
        self.assertEqual(forward_close(bars, anchor, 1, pd.Timestamp("2026-06-02T20:15Z"))[0], 105)

    def test_new_york_date_not_utc_date(self):
        bars = daily([("2026-06-02", 105), ("2026-06-03", 106)])
        # 00:30 UTC = after-hours of June 1, still anchored on June 1.
        self.assertEqual(forward_close(bars, pd.Timestamp("2026-06-02T00:30Z"), 1, pd.Timestamp("2026-06-04T00:00Z"))[0], 105)

    def test_dst_close_availability_and_invalid_close(self):
        bars = daily([("2026-11-02", 105)])
        anchor = pd.Timestamp("2026-10-30T14:00Z")
        self.assertIsNone(forward_close(bars, anchor, 1, pd.Timestamp("2026-11-02T20:30Z")))
        self.assertEqual(forward_close(bars, anchor, 1, pd.Timestamp("2026-11-02T21:15Z"))[0], 105)
        bars.iloc[0, 0] = math.nan
        self.assertIsNone(forward_close(bars, anchor, 1, pd.Timestamp("2026-11-03T00:00Z")))


class AnalogueTests(unittest.TestCase):
    def find(self, pool, ts="2026-06-15T14:00Z"):
        return find_analogues("gap_up", 0.02, 3, pool, pd.Timestamp(ts), "NVDA")

    def test_future_other_symbol_and_not_yet_mature_are_excluded(self):
        known = observation()
        immature = observation("MSFT", "2026-06-10T14:00Z", "2026-06-17T20:15Z")
        future = observation("TSLA", "2026-06-16T14:00Z", "2026-06-23T20:15Z")
        self.assertEqual(self.find([known, immature, future]), [known])

    def test_no_maturity_or_target_timestamp_fails_closed(self):
        self.assertEqual(self.find([observation(available=None)]), [])
        self.assertEqual(find_analogues("gap_up", .02, 3, [observation()]), [])

    def test_same_symbol_overlapping_windows_do_not_inflate_sample(self):
        first = observation()
        overlap = observation(ts="2026-06-02T15:00Z", available="2026-06-09T20:15Z")
        next_window = observation(ts="2026-06-09T14:00Z", available="2026-06-16T20:15Z")
        self.assertEqual(self.find([next_window, overlap, first], "2026-06-17T14:00Z"), [first, next_window])

    def test_zero_and_losses_are_kept_invalid_values_excluded(self):
        result = aggregate_expected([observation(value=-.1), observation(value=0), observation(value=math.nan)])
        self.assertEqual(result, (-.05, -.05, -.05, 2))


if __name__ == "__main__":
    unittest.main()
