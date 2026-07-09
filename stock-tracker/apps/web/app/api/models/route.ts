// TEMPORARY diagnostic — lists the Gemini model IDs available to THIS API key
// (generateContent-capable), so we can wire the model chain with verified IDs
// instead of guessing. Delete after use. Returns model names only (no secrets).
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(key)}`,
      { cache: "no-store" },
    );
    if (!r.ok) {
      return NextResponse.json({ error: `list ${r.status}: ${(await r.text()).slice(0, 300)}` }, { status: 502 });
    }
    const d = (await r.json()) as {
      models?: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }>;
    };
    const models = (d.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => ({ id: m.name?.replace(/^models\//, ""), display: m.displayName }))
      .filter((m) => /gemini-(2\.5|3|3\.1|3\.5)/.test(m.id ?? ""));
    return NextResponse.json({ count: models.length, models });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
