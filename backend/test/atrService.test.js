import assert from "node:assert/strict";
import test from "node:test";
import { calculateAtr, expectedMoveFromAtr } from "../services/atrService.js";
import { evaluatePrediction } from "../services/performanceService.js";

test("calculates ATR from daily OHLC candles without score or price multipliers", () => {
  const atr = calculateAtr(
    [
      { high: 10, low: 8, close: 9 },
      { high: 12, low: 9, close: 11 },
      { high: 13, low: 10, close: 12 },
      { high: 15, low: 11, close: 14 },
    ],
    3
  );

  assert.equal(atr, 3.333333);
});

test("returns no ATR when the candle history is incomplete", () => {
  const atr = calculateAtr(
    [
      { high: 10, low: 8, close: 9 },
      { high: 12, low: 9, close: 11 },
    ],
    3
  );

  assert.equal(atr, null);
});

test("uses ATR itself as the expected one-session range", () => {
  assert.equal(expectedMoveFromAtr({ atr: 18.75 }), 18.75);
  assert.equal(expectedMoveFromAtr({ atr: null }), null);
});

test("keeps move-fit unavailable when an ATR range was not saved", () => {
  const evaluation = evaluatePrediction(
    {
      id: 1,
      asset: "ES",
      bias: "Bullish",
      movePoints: null,
      currentPrice: 100,
      generatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: 2,
      asset: "ES",
      currentPrice: 102,
      generatedAt: "2026-01-01T01:00:00.000Z",
    }
  );

  assert.equal(evaluation.expectedMoveAvailable, false);
  assert.equal(evaluation.predictedMove, null);
  assert.equal(evaluation.moveError, null);
  assert.equal(evaluation.moveAccuracy, null);
});
