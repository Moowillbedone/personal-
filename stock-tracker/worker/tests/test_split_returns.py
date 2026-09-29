"""Corporate-action regressions using synthetic bars and mocked local workers."""
from contextlib import redirect_stdout
from io import StringIO
from types import SimpleNamespace
import math
import unittest
from unittest.mock import MagicMock, patch

import pandas as pd

import ai_realize
import realize
from lib import backtest
from lib.returns import forward_close, split_adjusted_anchor
from lib.signals import Signal


ANCHOR = pd.Timestamp("2020-06-01T15:00Z")
DATES = ["2020-06-01", "2020-06-02", "2020-06-03", "2020-06-04", "2020-06-05", "2020-06-08"]


def daily(prices, dates=DATES):
    return pd.DataFrame({"Close": prices}, index=pd.DatetimeIndex([
        pd.Timestamp(date, tz="America/New_York") for date in dates
    ]))


class SplitAnchorTests(unittest.TestCase):
    def return_after(self, raw, adjusted, price):
        base = split_adjusted_anchor(raw, adjusted, ANCHOR, price)
        self.assertIsNotNone(base)
        close = forward_close(adjusted, ANCHOR, 1, pd.Timestamp("2020-06-10T00:00Z"))[0]
        return close / base - 1

    def test_two_for_one_split_is_not_a_fifty_percent_loss(self):
        self.assertAlmostEqual(self.return_after(daily([100, 50, 50, 50, 50, 50]), daily([50] * 6), 100), 0)

    def test_reverse_split_is_not_a_nine_hundred_percent_gain(self):
        self.assertAlmostEqual(self.return_after(daily([10, 100, 100, 100, 100, 100]), daily([100] * 6), 10), 0)

    def test_ordinary_price_return_is_unchanged(self):
        bars = daily([100, 110, 110, 110, 110, 110])
        self.assertAlmostEqual(self.return_after(bars, bars, 100), .1)

    def test_preserves_intraday_entry_instead_of_using_anchor_close(self):
        # The signal occurred at 100, then closed at 120, before a 2:1 split.
        self.assertAlmostEqual(self.return_after(daily([120, 55, 55, 55, 55, 55]), daily([60, 55, 55, 55, 55, 55]), 100), .1)

    def test_adjustments_after_forward_window_cancel_out(self):
        raw = daily([100, 110, 110, 110, 110, 110])
        # A subsequent 10:1 split rebases both entry and exit equally.
        adjusted = daily([10, 11, 11, 11, 11, 11])
        self.assertAlmostEqual(self.return_after(raw, adjusted, 100), .1)

    def test_missing_or_duplicate_anchor_session_fails_closed(self):
        bars = daily([100] * 6)
        for incomplete in (bars.iloc[1:], pd.DataFrame(), pd.concat([bars.iloc[:1], bars])):
            with self.subTest(rows=len(incomplete)):
                self.assertIsNone(split_adjusted_anchor(incomplete, bars, ANCHOR, 100))
                self.assertIsNone(split_adjusted_anchor(bars, incomplete, ANCHOR, 100))

    def test_holiday_anchor_is_not_assigned_a_guessed_prior_session(self):
        bars = daily([100, 110], ["2020-07-02", "2020-07-06"])
        self.assertIsNone(split_adjusted_anchor(bars, bars, pd.Timestamp("2020-07-03T15:00Z"), 100))

    def test_after_hours_uses_new_york_date(self):
        raw, adjusted = daily([100] * 6), daily([50] * 6)
        self.assertEqual(split_adjusted_anchor(raw, adjusted, pd.Timestamp("2020-06-02T00:30Z"), 110), 55)

    def test_invalid_prices_and_adjustment_factors_fail_closed(self):
        bars = daily([100] * 6)
        for invalid in (None, 0, -1, math.nan, math.inf, "not-a-price"):
            with self.subTest(value=invalid):
                invalid_frame = daily([invalid, 100, 100, 100, 100, 100])
                self.assertIsNone(split_adjusted_anchor(bars, bars, ANCHOR, invalid))
                self.assertIsNone(split_adjusted_anchor(invalid_frame, bars, ANCHOR, 100))
                self.assertIsNone(split_adjusted_anchor(bars, invalid_frame, ANCHOR, 100))


class WorkerIntegrationTests(unittest.TestCase):
    def run_worker(self, module, targets, raw, adjusted):
        table = MagicMock()
        for method in ("select", "is_", "lt", "order", "limit", "or_", "update", "eq"):
            getattr(table, method).return_value = table
        table.execute.return_value = SimpleNamespace(data=targets)
        client = MagicMock()
        client.table.return_value = table

        def fetch(symbols, **kwargs):
            self.assertEqual(kwargs["interval"], "1d")
            return {"TEST": raw if kwargs.get("adjustment") == "raw" else adjusted}

        with patch.object(module, "load_dotenv"), patch.object(module.db, "client", return_value=client), patch.object(module.alpaca, "fetch_recent_bars", side_effect=fetch) as fetcher, redirect_stdout(StringIO()):
            self.assertEqual(module.main(), 0)
        self.assertEqual([c.kwargs["adjustment"] for c in fetcher.call_args_list], ["raw", "split"])
        return table.update

    def test_signal_worker_rebases_raw_entry_before_persisting_returns(self):
        row = {"id": 1, "symbol": "TEST", "ts": ANCHOR.isoformat(), "price": 100}
        update = self.run_worker(realize, [row], daily([100, 55, 55, 55, 55, 55]), daily([50, 55, 55, 55, 55, 55]))
        update.assert_called_once()
        self.assertEqual(set(update.call_args.args[0]), {"realized_1d", "realized_3d", "realized_5d"})
        for value in update.call_args.args[0].values():
            self.assertAlmostEqual(value, .1)

    def test_ai_worker_rebases_entry_and_preserves_existing_results(self):
        row = {"id": 2, "symbol": "TEST", "created_at": ANCHOR.isoformat(), "last_price": "100", "realized_1d": .99}
        update = self.run_worker(ai_realize, [row], daily([100, 55, 55, 55, 55, 55]), daily([50, 55, 55, 55, 55, 55]))
        update.assert_called_once()
        values = update.call_args.args[0]
        self.assertEqual(set(values), {"realized_3d", "realized_5d"})
        for value in values.values():
            self.assertAlmostEqual(value, .1)

    def test_ai_worker_uses_quote_session_for_factor_and_analysis_for_horizon(self):
        # A split occurs Tuesday. A premarket request still carries Monday's
        # raw quote; Tuesday's factor would falsely turn its return into -45%.
        row = {"id": 2, "symbol": "TEST", "created_at": "2020-06-02T09:00Z", "price_as_of": ANCHOR.isoformat(), "last_price": 100}
        update = self.run_worker(ai_realize, [row], daily([100, 50, 55, 55, 55, 55]), daily([50, 50, 55, 55, 55, 55]))
        update.assert_called_once()
        self.assertAlmostEqual(update.call_args.args[0]["realized_1d"], .1)

    def test_ai_worker_does_not_ignore_invalid_or_future_quote_timestamp(self):
        for price_as_of in ("bad timestamp", "2020-06-02T15:00Z", "NaT"):
            with self.subTest(price_as_of=price_as_of):
                row = {"id": 2, "symbol": "TEST", "created_at": ANCHOR.isoformat(), "price_as_of": price_as_of, "last_price": 100}
                update = self.run_worker(ai_realize, [row], daily([100] * 6), daily([100] * 6))
                update.assert_not_called()

    def test_both_workers_skip_missing_anchor_factor_without_writing(self):
        for module in (realize, ai_realize):
            with self.subTest(worker=module.__name__):
                row = {"id": 1, "symbol": "TEST", "ts": ANCHOR.isoformat(), "created_at": ANCHOR.isoformat(), "price": 100, "last_price": 100}
                update = self.run_worker(module, [row], daily([100] * 6).iloc[1:], daily([50] * 6))
                update.assert_not_called()

    def test_analogue_entry_and_forward_bars_share_split_adjustment(self):
        count = backtest.sig.LOOKBACK_BARS + 1
        raw_intraday = pd.DataFrame({"Close": [100] * count}, index=pd.date_range("2020-06-01T13:30Z", periods=count, freq="5min"))
        raw_daily = daily([100, 55, 55, 55, 55, 55])
        adjusted_daily = daily([50, 55, 55, 55, 55, 55])

        def fetch(symbols, interval, lookback, adjustment="raw"):
            if interval == "5m":
                return {"TEST": raw_intraday / 2 if adjustment == "split" else raw_intraday}
            return {"TEST": adjusted_daily if adjustment == "split" else raw_daily}

        def detect(symbol, frame, idx):
            return Signal(symbol, frame.index[idx], "gap_up", float(frame.iloc[idx]["Close"]), .02, 3)

        with patch.object(backtest.alpaca, "fetch_recent_bars", side_effect=fetch) as fetcher, patch.object(backtest, "_detect_at_bar", side_effect=detect), redirect_stdout(StringIO()):
            pool = backtest.collect_historical(["TEST"])
        self.assertEqual(len(pool), 1)
        for value in (pool[0].realized_1d, pool[0].realized_3d, pool[0].realized_5d):
            self.assertAlmostEqual(value, .1)
        self.assertEqual([(c.kwargs["interval"], c.kwargs["adjustment"]) for c in fetcher.call_args_list], [("5m", "split"), ("1d", "split")])


if __name__ == "__main__":
    unittest.main()
