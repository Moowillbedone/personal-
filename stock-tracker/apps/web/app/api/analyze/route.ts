import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSnapshot, getRecentNews, getRecentBars, type Snapshot, type NewsItem } from "@/lib/alpaca";
import { generateVerdict, ACTIVE_MODEL } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min — same symbol, same window = serve cached

interface PositionInput {
  strategy?: "lump_sum" | "dca";
  total_budget_krw?: number | null;
  dca_per_day_krw?: number | null;
  dca_total_days?: number | null;
}

interface AnalyzeBody {
  symbol?: string;
  position?: PositionInput;
}

// POST /api/analyze  body: { symbol, position? }
//   Returns the verdict + sizing recommendation. Caches per symbol for 5 min.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as AnalyzeBody | null;
  const symbol = body?.symbol?.trim().toUpperCase();
  if (!symbol || !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) {
    return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
  }

  // 1) Cache lookup
  const cutoffIso = new Date(Date.now() - CACHE_TTL_MS).toISOString();
  const { data: cached } = await supabaseAdmin
    .from("ai_analysis")
    .select("*")
    .eq("symbol", symbol)
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let verdictRow = cached;
  let snapshot: Snapshot | null = null;
  let news: NewsItem[] = [];

  if (!verdictRow) {
    // 2) Gather inputs in parallel
    const [snap, newsList, bars] = await Promise.all([
      getSnapshot(symbol),
      getRecentNews(symbol, 8),
      getRecentBars(symbol),
    ]);
    snapshot = snap;
    news = newsList;

    // Compress bars to compact strings for the prompt.
    const fiveMinTail = bars.fiveMin.slice(-30).map(
      (b) => `${b.ts.slice(11, 16)} c=${b.c.toFixed(2)} v=${b.v}`,
    );
    const dailyTail = bars.daily.slice(-20).map(
      (b) => `${b.ts.slice(0, 10)} o=${b.o.toFixed(2)} c=${b.c.toFixed(2)} v=${b.v}`,
    );

    const prompt = buildPrompt(symbol, snap, newsList, fiveMinTail, dailyTail);
    const verdict = await generateVerdict(prompt);

    // 3) Persist
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("ai_analysis")
      .insert({
        symbol,
        verdict: verdict.verdict,
        confidence: verdict.confidence,
        summary: verdict.summary,
        bull_points: verdict.bull_points,
        bear_points: verdict.bear_points,
        context: {
          last_price: snap.lastPrice,
          prev_close: snap.prevClose,
          change_pct: snap.changePct,
          session: snap.session,
          news_titles: newsList.slice(0, 5).map((n) => n.headline),
        },
        model: ACTIVE_MODEL,
      })
      .select("*")
      .single();
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    verdictRow = inserted;
  } else {
    // For cached responses, still attach the freshest snapshot so the UI
    // shows current price next to the cached verdict.
    snapshot = await getSnapshot(symbol).catch(() => null);
  }

  // 4) Sizing recommendation (deterministic, computed from verdict + confidence)
  const sizing = computeSizing(verdictRow.verdict, Number(verdictRow.confidence), body?.position);

  return NextResponse.json({
    cached: !!cached,
    analysis: verdictRow,
    snapshot,
    news,
    sizing,
  });
}

function buildPrompt(
  symbol: string,
  snap: Snapshot,
  news: NewsItem[],
  fiveMinTail: string[],
  dailyTail: string[],
): string {
  const newsBlock = news.length
    ? news
        .slice(0, 8)
        .map(
          (n, i) =>
            `${i + 1}. [${n.source}] ${n.headline}${n.summary ? ` — ${n.summary.slice(0, 200)}` : ""} (${n.createdAt.slice(0, 10)})`,
        )
        .join("\n")
    : "(no recent news available)";

  return [
    `You are a short-term US-equity trading assistant. Analyze ${symbol} and output a JSON verdict.`,
    "",
    "Current snapshot:",
    `- last price: ${snap.lastPrice ?? "?"} (${snap.session})`,
    `- prev close: ${snap.prevClose ?? "?"}`,
    `- change vs prev close: ${snap.changePct != null ? (snap.changePct * 100).toFixed(2) + "%" : "?"}`,
    `- today OHLC: O=${snap.todayOpen ?? "?"} H=${snap.todayHigh ?? "?"} L=${snap.todayLow ?? "?"} C=${snap.todayClose ?? "?"} V=${snap.todayVolume ?? "?"}`,
    "",
    "Recent 5-min bars (most-recent last):",
    fiveMinTail.join("\n") || "(none)",
    "",
    "Recent daily bars:",
    dailyTail.join("\n") || "(none)",
    "",
    "Recent news headlines:",
    newsBlock,
    "",
    "Task:",
    "- Decide a verdict ('buy', 'hold', or 'sell') for a SHORT-TERM swing/day trade.",
    "- Be concrete: cite price action, volume, news catalysts. No generic disclaimers.",
    "- Confidence is 0..1; never claim >0.85 unless multiple strong, mutually reinforcing factors agree.",
    "- summary: 2-3 sentences in Korean.",
    "- bull_points / bear_points: 2-4 short Korean bullets each.",
    "- If news is conflicting or absent, prefer 'hold' with low confidence.",
    "Return JSON only, matching the schema.",
  ].join("\n");
}

function computeSizing(
  verdict: string,
  confidence: number,
  pos: PositionInput | undefined,
): {
  action: "buy" | "hold" | "sell";
  weight: number;
  amount_krw: number;
  rationale: string;
} {
  // weight = how much of the configured slice to deploy now, scaled by confidence.
  // For 'hold' / 'sell' on a buy budget, weight=0. Sell weight is informational.
  const w = Math.round(confidence * 100) / 100;
  let amount = 0;
  let rationale = "";

  if (!pos || (!pos.total_budget_krw && !pos.dca_per_day_krw)) {
    return {
      action: verdict as "buy" | "hold" | "sell",
      weight: 0,
      amount_krw: 0,
      rationale: "포지션 설정이 없어 권장 금액을 계산할 수 없음.",
    };
  }

  if (verdict === "buy") {
    if (pos.strategy === "lump_sum" && pos.total_budget_krw) {
      // Deploy weight × budget now.
      amount = Math.round(pos.total_budget_krw * w);
      rationale = `거치식 예산 ${pos.total_budget_krw.toLocaleString()}원의 ${(w * 100).toFixed(0)}% (신뢰도 ${(confidence * 100).toFixed(0)}%) 즉시 매수 권장.`;
    } else if (pos.strategy === "dca" && pos.dca_per_day_krw) {
      // For DCA: scale today's slice up by (1 + w). Cap at 3× to avoid blowout.
      const mult = Math.min(1 + w * 2, 3);
      amount = Math.round(pos.dca_per_day_krw * mult);
      rationale = `DCA 일 ${pos.dca_per_day_krw.toLocaleString()}원 × ${mult.toFixed(2)}배 (강세 가중) 매수 권장.`;
    }
  } else if (verdict === "hold") {
    if (pos.strategy === "dca" && pos.dca_per_day_krw) {
      amount = pos.dca_per_day_krw;
      rationale = `관망 구간 — DCA 평소 슬라이스 ${pos.dca_per_day_krw.toLocaleString()}원만 유지.`;
    } else {
      amount = 0;
      rationale = "관망 — 거치식은 신호가 약해 진입 보류.";
    }
  } else if (verdict === "sell") {
    if (pos.strategy === "lump_sum" && pos.total_budget_krw) {
      amount = Math.round(pos.total_budget_krw * w);
      rationale = `매도 신호 — 보유 포지션 중 ${(w * 100).toFixed(0)}% 익절/손절 권장.`;
    } else if (pos.strategy === "dca" && pos.dca_per_day_krw) {
      amount = 0;
      rationale = `매도 신호 — 오늘 DCA 매수 0원, 기존 보유분 점진 매도 검토.`;
    }
  }

  return {
    action: verdict as "buy" | "hold" | "sell",
    weight: w,
    amount_krw: amount,
    rationale,
  };
}
