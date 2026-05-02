export type SignalType = "gap_up" | "gap_down" | "volume_spike";

export interface Ticker {
  symbol: string;
  exchange: "NASDAQ" | "NYSE";
  name: string | null;
  market_cap: number | null;
  rank_in_exch: number | null;
  is_active: boolean;
}

export interface Signal {
  id: string;
  symbol: string;
  ts: string;
  signal_type: SignalType;
  price: number;
  pct_change: number;
  volume_ratio: number;
  session: "pre" | "regular" | "after";
  expected_1d: number | null;
  expected_3d: number | null;
  expected_5d: number | null;
  sample_size: number | null;
  created_at: string;
}

export interface PriceBar {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
