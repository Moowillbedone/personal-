import test from "node:test";
import assert from "node:assert/strict";
import { buildShortlist } from "../lib/investmentDesk.ts";
import {
  checkOwnerAuthorization,
  isCrossOriginWrite,
} from "../lib/ownerAccess.ts";

test("shortlist rejects missing, stale, future and invalid-price evidence", () => {
  const now = Date.parse("2026-09-29T14:00:00Z");
  const base = {
    symbol: "AAPL",
    sector: "IT",
    price: 100,
    grades: "pass,pass,pass,pass,pass",
    asOf: "2026-09-29T13:30:00Z",
    stale: false,
  };
  for (const change of [
    { asOf: null },
    { asOf: "2026-09-29T12:00Z" },
    { asOf: "2026-09-29T15:00Z" },
    { stale: true },
    { stale: undefined },
    { price: 0 },
    { price: NaN },
  ]) {
    assert.equal(
      buildShortlist([{ ...base, ...change }], now).candidates.length,
      0,
    );
  }
  assert.equal(buildShortlist([base], now).candidates.length, 1);
  assert.equal(
    buildShortlist([{ ...base, grades: "pass,warn,pass,pass,pass" }], now)
      .excludedRules,
    1,
  );
});
test("shortlist caps sectors, unique tickers and total without forecast ranking", () => {
  const now = Date.now();
  const rows = Array.from({ length: 12 }, (_, i) => ({
    symbol: `S${i.toString().padStart(2, "0")}`,
    sector: i < 5 ? "IT" : `sector${i}`,
    price: 100,
    grades: "pass,pass,pass,pass,pass",
    asOf: new Date(now).toISOString(),
    stale: false,
  }));
  const result = buildShortlist([rows[0], ...rows], now).candidates;
  assert.equal(result.length, 5);
  assert.equal(result.filter((r) => r.sector === "IT").length, 2);
  assert.equal(new Set(result.map((r) => r.symbol)).size, 5);
});
test("owner access fails closed for missing, invalid and weak credentials", async () => {
  const password = "test-owner-password-12345";
  assert.equal(await checkOwnerAuthorization(null, "owner", password), false);
  assert.equal(
    await checkOwnerAuthorization("Basic !@#$", "owner", password),
    false,
  );
  assert.equal(
    await checkOwnerAuthorization(
      `Basic ${btoa("owner:wrong")}`,
      "owner",
      password,
    ),
    false,
  );
  assert.equal(
    await checkOwnerAuthorization(
      `Basic ${btoa(`owner:${password}`)}`,
      "owner",
      password,
    ),
    true,
  );
  assert.equal(
    await checkOwnerAuthorization(
      `Basic ${btoa("owner:short")}`,
      "owner",
      "short",
    ),
    false,
  );
});
test("authenticated cross-site write requests are rejected", () => {
  assert.equal(
    isCrossOriginWrite(
      "POST",
      "https://evil.test",
      null,
      "https://tracker.test",
    ),
    true,
  );
  assert.equal(
    isCrossOriginWrite("DELETE", null, "cross-site", "https://tracker.test"),
    true,
  );
  assert.equal(
    isCrossOriginWrite(
      "POST",
      "https://tracker.test",
      "same-origin",
      "https://tracker.test",
    ),
    false,
  );
  assert.equal(
    isCrossOriginWrite(
      "GET",
      "https://evil.test",
      "cross-site",
      "https://tracker.test",
    ),
    false,
  );
});
