import YahooFinance from "yahoo-finance2";
import { symbols } from "../config/constants.js";

const yahoo = new YahooFinance();

/**
 * Fetches current market data for all configured symbols.
 */
export async function fetchMarketData() {
  const results = {};

  const keys = Object.keys(symbols);

  for (const key of keys) {
    const symbol = symbols[key];

    try {
      const quote = await yahoo.quote(symbol);

      results[key] = {
        symbol,
        price: quote?.regularMarketPrice ?? null,
        change: quote?.regularMarketChange ?? null,
        percent: quote?.regularMarketChangePercent ?? null,
        timestamp: quote?.regularMarketTime
          ? new Date(quote.regularMarketTime * 1000).toISOString()
          : new Date().toISOString(),
      };
    } catch (err) {
      console.error(`Market fetch failed for ${symbol}:`, err.message);

      results[key] = {
        symbol,
        price: null,
        change: null,
        percent: null,
        error: err.message,
      };
    }
  }

  return results;
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