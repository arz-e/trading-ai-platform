import YahooFinance from "yahoo-finance2";
import { symbols } from "../config/constants.js";
import { flowAssets } from "../config/flowAssets.js";

const yahoo = new YahooFinance();

/**
 * Fetches current market data for all configured symbols.
 */
export async function fetchMarketData() {
  const results = {};
  const quoteTargets = buildQuoteTargets();

  for (const target of quoteTargets) {
    const symbol = target.providerSymbol;

    try {
      const quote = await yahoo.quote(symbol);
      results[target.id] = normalizeMarketQuote(target, quote);
    } catch (err) {
      console.error(`Market fetch failed for ${symbol}:`, err.message);

      results[target.id] = {
        symbol,
        price: null,
        change: null,
        percent: null,
        open: null,
        high: null,
        low: null,
        previousClose: null,
        volume: null,
        dayRange: null,
        absoluteChange: null,
        intradayReturn: null,
        timestamp: new Date().toISOString(),
        provider: target.provider,
        quoteStatus: "ERROR",
        stale: true,
        error: err.message,
      };
    }
  }

  return results;
}

function buildQuoteTargets() {
  const targets = Object.entries(symbols).map(([id, providerSymbol]) => ({
    id,
    provider: "yahoo",
    providerSymbol,
  }));
  const knownIds = new Set(targets.map((target) => target.id));

  for (const item of flowAssets) {
    if (knownIds.has(item.id)) continue;
    knownIds.add(item.id);
    targets.push({
      id: item.id,
      provider: item.provider,
      providerSymbol: item.providerSymbol,
    });
  }

  return targets;
}

function normalizeMarketQuote(target, quote = {}) {
  const price = quote?.regularMarketPrice ?? null;
  const previousClose = quote?.regularMarketPreviousClose ?? null;
  const open = quote?.regularMarketOpen ?? null;
  const timestamp = normalizeMarketTimestamp(quote?.regularMarketTime);
  const absoluteChange = typeof price === "number" && typeof previousClose === "number"
    ? Number((price - previousClose).toFixed(5))
    : quote?.regularMarketChange ?? null;
  const intradayReturn = typeof price === "number" && typeof open === "number" && open !== 0
    ? Number((((price - open) / open) * 100).toFixed(3))
    : null;

  return {
    symbol: target.providerSymbol,
    price,
    change: quote?.regularMarketChange ?? absoluteChange,
    percent: quote?.regularMarketChangePercent ?? null,
    open,
    high: quote?.regularMarketDayHigh ?? null,
    low: quote?.regularMarketDayLow ?? null,
    previousClose,
    volume: quote?.regularMarketVolume ?? null,
    dayRange: buildDayRange(quote?.regularMarketDayLow, quote?.regularMarketDayHigh),
    absoluteChange,
    intradayReturn,
    timestamp,
    provider: target.provider,
    quoteStatus: "OK",
    stale: isStaleTimestamp(timestamp),
  };
}

function buildDayRange(low, high) {
  if (typeof low !== "number" || typeof high !== "number") return null;
  return `${low} - ${high}`;
}

/**
 * Extracts macro factors used by the bias engine.
 */
export function extractMacroFactors(market = {}) {
  const vix = market.VIX?.price ?? null;
  const us10y = market.US10Y?.price ?? null;
  const dxy = market.DXY?.percent ?? null;
  const oil = market.USOIL?.percent ?? null;
  const gold = market.GOLD?.percent ?? null;

  return {
    VIX: vix,
    US10Y: us10y,
    dollarMomentum: dxy,
    oilMove: oil,
    goldMove: gold,
  };
}

/**
 * Determines macro signal flags used in scoring.
 */
export function computeMacroSignals(market = {}) {
  const signals = [];

  const vix = market.VIX?.price ?? 0;
  const us10y = market.US10Y?.price ?? 0;
  const dxy = market.DXY?.percent ?? 0;
  const oil = market.USOIL?.percent ?? 0;

  if (vix >= 22) {
    signals.push("risingVolatility");
  }

  if (us10y >= 4.1) {
    signals.push("yieldPressure");
  }

  if (dxy >= 0.35) {
    signals.push("dollarMomentum");
  }

  if (oil >= 1.2) {
    signals.push("oilShock");
  }

  if (
    market.ES?.percent <= -0.7 ||
    market.NQ?.percent <= -0.9
  ) {
    signals.push("equityStress");
  }

  return signals;
}

/**
 * Computes simple cross-asset relationships used by the bias engine.
 */
export function computeCrossAssetState(market = {}) {
  const state = {
    riskTone: "NEUTRAL",
    inflationPressure: false,
    dollarStrength: false,
  };

  const vix = market.VIX?.price ?? 0;
  const us10y = market.US10Y?.price ?? 0;
  const dxy = market.DXY?.percent ?? 0;

  if (vix > 24) {
    state.riskTone = "RISK_OFF";
  } else if (vix < 18) {
    state.riskTone = "RISK_ON";
  }

  if (us10y > 4.2) {
    state.inflationPressure = true;
  }

  if (dxy > 0.4) {
    state.dollarStrength = true;
  }

  return state;
}

function normalizeMarketTimestamp(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const timestampMs = value > 1000000000000 ? value : value * 1000;
    return new Date(timestampMs).toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);

    if (Number.isFinite(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function isStaleTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return true;
  return Date.now() - date.getTime() > 30 * 60 * 1000;
}
