const DEFAULT_LOOKBACK = 64;

export function analyzeCvd({ ticker, candles = [], lookback = DEFAULT_LOOKBACK, stale = false }) {
  const valid = candles
    .filter(hasUsableOhlcv)
    .slice(-Math.max(20, lookback));

  if (valid.length < 20) {
    return unavailableCvd(ticker, `Need at least 20 OHLCV bars; received ${valid.length}.`);
  }

  let previousDirection = 0;
  let cumulative = 0;
  const series = valid.map((bar, index) => {
    let direction = Math.sign(bar.close - bar.open);
    if (direction === 0 && index > 0) direction = Math.sign(bar.close - valid[index - 1].close);
    if (direction === 0) direction = previousDirection;
    previousDirection = direction;
    const delta = direction * bar.volume;
    cumulative += delta;
    return { price: bar.close, high: bar.high, low: bar.low, volume: bar.volume, delta, cvd: cumulative };
  });
  const totalVolume = series.reduce((sum, row) => sum + row.volume, 0);
  const cvdIndex = totalVolume > 0 ? clamp((cumulative / totalVolume) * 100, -100, 100) : 0;
  const recent = series.slice(-12);
  const cvdSlope = linearSlope(recent.map((row) => row.cvd));
  const averageVolume = totalVolume / series.length;
  const normalizedSlope = averageVolume > 0 ? cvdSlope / averageVolume : 0;
  const cvdTrend = normalizedSlope > 0.08 ? "rising" : normalizedSlope < -0.08 ? "falling" : "flat";
  const divergence = detectDivergence(series);
  const priceChange = percentChange(series[0].price, series.at(-1).price);
  const priceTrend = priceChange > 0.25 ? "rising" : priceChange < -0.25 ? "falling" : "flat";
  const continuationConfirmation =
    (priceTrend === "rising" && cvdTrend === "rising" && cvdIndex > 5) ||
    (priceTrend === "falling" && cvdTrend === "falling" && cvdIndex < -5);
  const exhaustionSignal =
    divergence.bullishDivergence ||
    divergence.bearishDivergence ||
    (priceTrend === "rising" && cvdTrend === "falling") ||
    (priceTrend === "falling" && cvdTrend === "rising");
  const confidence = Math.round(clamp(
    35 + Math.min(20, valid.length / 4) + Math.min(15, Math.abs(cvdIndex) * 0.3) - (stale ? 20 : 0),
    35,
    70
  ));

  return {
    ticker,
    cvdAvailable: true,
    reason: `Estimated from 15-minute candle direction because bid/ask aggressor volume is unavailable.${stale ? " Latest OHLCV is stale, so confidence is reduced." : ""}`,
    cvdMethod: "estimated",
    currentCvd: round(cumulative),
    cvdIndex: round(cvdIndex),
    cvdTrend,
    priceTrend,
    bullishDivergence: divergence.bullishDivergence,
    bearishDivergence: divergence.bearishDivergence,
    continuationConfirmation,
    exhaustionSignal,
    confidence,
    stale,
    lookbackBars: valid.length,
  };
}

function detectDivergence(series) {
  const recent = series.slice(-24);
  const split = Math.floor(recent.length / 2);
  const earlier = recent.slice(0, split);
  const later = recent.slice(split);
  const earlierLow = minBy(earlier, "low");
  const laterLow = minBy(later, "low");
  const earlierHigh = maxBy(earlier, "high");
  const laterHigh = maxBy(later, "high");

  return {
    bullishDivergence: laterLow.low < earlierLow.low && laterLow.cvd > earlierLow.cvd,
    bearishDivergence: laterHigh.high > earlierHigh.high && laterHigh.cvd < earlierHigh.cvd,
  };
}

function unavailableCvd(ticker, reason) {
  return {
    ticker,
    cvdAvailable: false,
    reason,
    cvdMethod: "unavailable",
    currentCvd: 0,
    cvdIndex: 0,
    cvdTrend: "unknown",
    priceTrend: "unknown",
    bullishDivergence: false,
    bearishDivergence: false,
    continuationConfirmation: false,
    exhaustionSignal: false,
    confidence: 0,
    lookbackBars: 0,
  };
}

function hasUsableOhlcv(bar = {}) {
  return [bar.open, bar.high, bar.low, bar.close, bar.volume].every(isFiniteNumber) && bar.volume > 0;
}

function linearSlope(values) {
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / n;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - xMean) * (value - yMean);
    denominator += (index - xMean) ** 2;
  });
  return denominator > 0 ? numerator / denominator : 0;
}

function minBy(rows, key) {
  return rows.reduce((best, row) => row[key] < best[key] ? row : best, rows[0]);
}

function maxBy(rows, key) {
  return rows.reduce((best, row) => row[key] > best[key] ? row : best, rows[0]);
}

function percentChange(start, end) {
  return start ? ((end - start) / Math.abs(start)) * 100 : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Number(value.toFixed(2));
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
