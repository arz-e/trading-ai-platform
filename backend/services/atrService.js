import YahooFinance from "yahoo-finance2";

const yahoo = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

export const ATR_LOOKBACK_SESSIONS = 14;
export const ATR_INTERVAL = "1d";
export const ATR_HORIZON = "1 trading session";

const ATR_CACHE_TTL_MS = 15 * 60 * 1000;
const atrCache = new Map();

export async function fetchAtrSnapshot(symbol, options = {}) {
  const lookback = options.lookback ?? ATR_LOOKBACK_SESSIONS;
  const interval = options.interval ?? ATR_INTERVAL;
  const cacheKey = `${symbol}:${lookback}:${interval}`;
  const cached = atrCache.get(cacheKey);

  if (cached && Date.now() - cached.cachedAt < ATR_CACHE_TTL_MS) {
    return cached.snapshot;
  }

  const period2 = new Date();
  const period1 = buildStartDate(period2, lookback);

  try {
    const result = await yahoo.chart(symbol, {
      period1,
      period2,
      interval,
    });
    const snapshot = buildAtrSnapshot({
      symbol,
      candles: result?.quotes ?? [],
      lookback,
      interval,
      fetchedAt: period2.toISOString(),
    });

    if (snapshot.status === "OK") {
      atrCache.set(cacheKey, { snapshot, cachedAt: Date.now() });
    }

    return snapshot;
  } catch (err) {
    console.error(`ATR fetch failed for ${symbol}:`, err.message);
    return buildUnavailableSnapshot({
      symbol,
      lookback,
      interval,
      fetchedAt: period2.toISOString(),
      error: err.message,
    });
  }
}

export async function fetchAtrSnapshotsForAssets(symbolMap = {}) {
  const entries = await Promise.all(
    Object.entries(symbolMap).map(async ([asset, symbol]) => [
      asset,
      await fetchAtrSnapshot(symbol),
    ])
  );

  return Object.fromEntries(entries);
}

// Compatibility helpers for callers that only need the numeric ATR value.
export async function fetchATR(symbol) {
  const snapshot = await fetchAtrSnapshot(symbol);
  return snapshot.atr;
}

export async function fetchATRForAssets(symbolMap = {}) {
  const snapshots = await fetchAtrSnapshotsForAssets(symbolMap);
  return Object.fromEntries(
    Object.entries(snapshots).map(([asset, snapshot]) => [asset, snapshot.atr])
  );
}

export function calculateAtr(candles = [], lookback = ATR_LOOKBACK_SESSIONS) {
  const validCandles = candles.filter(hasValidOhlc);

  if (validCandles.length < lookback + 1) {
    return null;
  }

  const recentCandles = validCandles.slice(-(lookback + 1));
  const trueRanges = [];

  for (let index = 1; index < recentCandles.length; index++) {
    const previousClose = recentCandles[index - 1].close;
    const { high, low } = recentCandles[index];

    trueRanges.push(
      Math.max(
        high - low,
        Math.abs(high - previousClose),
        Math.abs(low - previousClose)
      )
    );
  }

  if (trueRanges.length !== lookback) {
    return null;
  }

  const atr = trueRanges.reduce((sum, value) => sum + value, 0) / trueRanges.length;
  return Number.isFinite(atr) && atr > 0 ? Number(atr.toFixed(6)) : null;
}

export function expectedMoveFromAtr(snapshot = {}) {
  return typeof snapshot.atr === "number" && snapshot.atr > 0 ? snapshot.atr : null;
}

function buildAtrSnapshot({ symbol, candles, lookback, interval, fetchedAt }) {
  const validCandles = candles.filter(hasValidOhlc);
  const atr = calculateAtr(validCandles, lookback);
  const latestCandle = validCandles.at(-1) ?? null;

  if (atr === null || !latestCandle) {
    return buildUnavailableSnapshot({
      symbol,
      lookback,
      interval,
      fetchedAt,
      error: `Need at least ${lookback + 1} valid daily candles to calculate ATR.`,
      candleCount: candles.length,
    });
  }

  const previousSession = resolvePreviousCompletedSession(validCandles, fetchedAt);

  return {
    status: "OK",
    symbol,
    source: "Yahoo Finance chart",
    interval,
    lookbackSessions: lookback,
    horizon: ATR_HORIZON,
    atr,
    candleCount: candles.length,
    asOf: normalizeDate(latestCandle.date),
    previousSession,
    fetchedAt,
    error: null,
  };
}

function resolvePreviousCompletedSession(candles, fetchedAt) {
  const latest = candles.at(-1) ?? null;
  if (!latest) return null;

  const latestDate = new Date(latest.date);
  const fetchedDate = new Date(fetchedAt);
  const latestIsCurrentUtcDate =
    Number.isFinite(latestDate.getTime()) &&
    Number.isFinite(fetchedDate.getTime()) &&
    latestDate.getUTCFullYear() === fetchedDate.getUTCFullYear() &&
    latestDate.getUTCMonth() === fetchedDate.getUTCMonth() &&
    latestDate.getUTCDate() === fetchedDate.getUTCDate();
  const previous = latestIsCurrentUtcDate ? candles.at(-2) : latest;

  if (!previous) return null;

  return {
    high: previous.high,
    low: previous.low,
    close: previous.close,
    asOf: normalizeDate(previous.date),
  };
}

function buildUnavailableSnapshot({
  symbol,
  lookback,
  interval,
  fetchedAt,
  error,
  candleCount = 0,
}) {
  return {
    status: "UNAVAILABLE",
    symbol,
    source: "Yahoo Finance chart",
    interval,
    lookbackSessions: lookback,
    horizon: ATR_HORIZON,
    atr: null,
    candleCount,
    asOf: null,
    previousSession: null,
    fetchedAt,
    error,
  };
}

function buildStartDate(period2, lookback) {
  const period1 = new Date(period2);
  period1.setUTCDate(period1.getUTCDate() - Math.max(lookback * 4, 60));
  return period1;
}

function hasValidOhlc(candle = {}) {
  return [candle.high, candle.low, candle.close].every(
    (value) => typeof value === "number" && Number.isFinite(value)
  );
}

function normalizeDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
