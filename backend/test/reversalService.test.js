import assert from "node:assert/strict";
import test from "node:test";
import { buildPreviousSessionReversal } from "../services/reversalService.js";

const atrSnapshot = {
  source: "test candles",
  previousSession: {
    high: 110,
    low: 90,
    close: 100,
    asOf: "2026-07-13T00:00:00.000Z",
  },
};

test("detects a bearish reversal after a previous-high sweep and rejection", () => {
  const result = buildPreviousSessionReversal({
    market: { price: 108, high: 112, low: 99 },
    atrSnapshot,
  });

  assert.equal(result.signal, "BEARISH_REVERSAL");
});

test("detects a bullish reversal after a previous-low sweep and reclaim", () => {
  const result = buildPreviousSessionReversal({
    market: { price: 94, high: 105, low: 88 },
    atrSnapshot,
  });

  assert.equal(result.signal, "BULLISH_REVERSAL");
});

test("keeps a held high break classified as breakout instead of reversal", () => {
  const result = buildPreviousSessionReversal({
    market: { price: 113, high: 114, low: 100 },
    atrSnapshot,
  });

  assert.equal(result.signal, "UPSIDE_BREAKOUT");
});
