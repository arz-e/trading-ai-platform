import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCvd } from "../services/cvdService.js";

test("calculates rising and falling estimated CVD", () => {
  const rising = analyzeCvd({ ticker: "UP", candles: directionalCandles(30, 1) });
  const falling = analyzeCvd({ ticker: "DOWN", candles: directionalCandles(30, -1) });

  assert.equal(rising.cvdTrend, "rising");
  assert.ok(rising.cvdIndex > 0);
  assert.equal(falling.cvdTrend, "falling");
  assert.ok(falling.cvdIndex < 0);
});

test("detects bullish CVD divergence", () => {
  const earlier = Array.from({ length: 12 }, (_, index) => candle(100 - index * 0.3, -1, 1000, 99 - index * 0.2));
  const later = Array.from({ length: 12 }, (_, index) => candle(96 - index * 0.35, 1, 1400, 95 - index * 0.3));
  const result = analyzeCvd({ ticker: "BULL-DIV", candles: [...earlier, ...later] });

  assert.equal(result.bullishDivergence, true);
});

test("detects bearish CVD divergence", () => {
  const earlier = Array.from({ length: 12 }, (_, index) => candle(100 + index * 0.3, 1, 1000, 101 + index * 0.2));
  const later = Array.from({ length: 12 }, (_, index) => candle(104 + index * 0.35, -1, 1400, 105 + index * 0.3));
  const result = analyzeCvd({ ticker: "BEAR-DIV", candles: [...earlier, ...later] });

  assert.equal(result.bearishDivergence, true);
});

test("handles missing volume without inventing CVD", () => {
  const result = analyzeCvd({
    ticker: "NO-VOLUME",
    candles: Array.from({ length: 30 }, () => ({ open: 1, high: 2, low: 0, close: 1.5, volume: null })),
  });

  assert.equal(result.cvdAvailable, false);
  assert.equal(result.cvdMethod, "unavailable");
});

function directionalCandles(count, direction) {
  return Array.from({ length: count }, (_, index) => {
    const base = 100 + index * direction;
    return candle(base, direction, 1000, base + direction * 0.5);
  });
}

function candle(base, direction, volume, extreme) {
  const open = base;
  const close = base + direction * 0.5;
  return {
    open,
    close,
    high: direction > 0 ? Math.max(close, extreme) : open + 0.2,
    low: direction < 0 ? Math.min(close, extreme) : open - 0.2,
    volume,
  };
}
