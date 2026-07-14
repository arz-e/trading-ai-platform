import YahooFinance from "yahoo-finance2";

const yahoo = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

const CANDLE_CACHE_TTL_MS = 5 * 60 * 1000;
const OPTIONS_CACHE_TTL_MS = 15 * 60 * 1000;
const candleCache = new Map();
const optionsCache = new Map();
const optionEligibleAssetClasses = new Set(["stocks", "etfs"]);

export async function fetchMarketStructureInputs(targets = []) {
  const entries = await Promise.all(
    targets.map(async (target) => [
      target.ticker,
      await fetchMarketStructureInput(target),
    ])
  );

  return Object.fromEntries(entries);
}

export async function fetchMarketStructureInput({ ticker, providerSymbol, assetClass }) {
  const [candleData, optionsData] = await Promise.all([
    fetchIntradayCandles(providerSymbol),
    fetchValidatedOptionsChain({ ticker, providerSymbol, assetClass }),
  ]);

  return {
    ticker,
    providerSymbol,
    assetClass,
    candleData,
    optionsData,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchIntradayCandles(providerSymbol) {
  const key = String(providerSymbol ?? "").toUpperCase();
  if (!key) return unavailableCandles("Provider symbol is missing.");
  const cached = candleCache.get(key);
  if (cached && Date.now() - cached.cachedAt < CANDLE_CACHE_TTL_MS) return cached.value;

  const period2 = new Date();
  const period1 = new Date(period2.getTime() - 10 * 24 * 60 * 60 * 1000);

  try {
    const result = await yahoo.chart(providerSymbol, {
      period1,
      period2,
      interval: "15m",
      includePrePost: false,
    });
    const candles = (result?.quotes ?? [])
      .map(normalizeCandle)
      .filter((candle) => candle !== null);
    const value = candles.length > 0
      ? {
          status: "OK",
          source: "Yahoo Finance chart",
          interval: "15m",
          candles,
          fetchedAt: period2.toISOString(),
          stale: isStaleCandle(candles.at(-1), period2),
          error: null,
        }
      : unavailableCandles("No usable 15-minute OHLCV bars were returned.", period2);

    candleCache.set(key, { value, cachedAt: Date.now() });
    return value;
  } catch (error) {
    return unavailableCandles(error.message, period2);
  }
}

async function fetchValidatedOptionsChain({ ticker, providerSymbol, assetClass }) {
  if (!optionEligibleAssetClasses.has(String(assetClass ?? "").toLowerCase())) {
    return unavailableOptions(
      `GEX is unsupported for asset class ${assetClass || "unknown"}; no ticker-specific options chain is requested.`
    );
  }

  const key = String(providerSymbol ?? "").toUpperCase();
  if (!key) return unavailableOptions("Provider symbol is missing.");
  const cached = optionsCache.get(key);
  if (cached && Date.now() - cached.cachedAt < OPTIONS_CACHE_TTL_MS) return cached.value;

  try {
    const initial = await yahoo.options(providerSymbol);
    const expirations = (initial?.expirationDates ?? [])
      .map((value) => new Date(value))
      .filter((value) => Number.isFinite(value.getTime()) && value.getTime() >= Date.now())
      .slice(0, 2);
    const extraChains = expirations.slice(1).length > 0
      ? await Promise.allSettled(
          expirations.slice(1).map((date) => yahoo.options(providerSymbol, { date }))
        )
      : [];
    const results = [initial, ...extraChains.flatMap((result) => result.status === "fulfilled" ? [result.value] : [])];
    const contracts = results.flatMap(normalizeOptionResult);
    const validContracts = contracts.filter(isUsableOptionContract);
    const value = validContracts.length > 0
      ? {
          status: "OK",
          ticker,
          providerSymbol,
          source: "Yahoo Finance options chain",
          contracts: validContracts,
          expirationCount: new Set(validContracts.map((item) => item.expiration)).size,
          fetchedAt: new Date().toISOString(),
          delayedOrIndicative: true,
          error: null,
        }
      : unavailableOptions("Options chain returned no contracts with strike, expiry, IV, and open interest.");

    optionsCache.set(key, { value, cachedAt: Date.now() });
    return value;
  } catch (error) {
    const value = unavailableOptions(`Options chain unavailable: ${error.message}`);
    optionsCache.set(key, { value, cachedAt: Date.now() });
    return value;
  }
}

function normalizeCandle(row = {}) {
  const date = new Date(row.date);
  const values = [row.open, row.high, row.low, row.close];
  if (!Number.isFinite(date.getTime()) || !values.every(isFiniteNumber)) return null;

  return {
    date: date.toISOString(),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: isFiniteNumber(row.volume) && row.volume >= 0 ? row.volume : null,
  };
}

function normalizeOptionResult(result = {}) {
  return (result.options ?? []).flatMap((chain) => [
    ...(chain.calls ?? []).map((contract) => normalizeOptionContract(contract, "call")),
    ...(chain.puts ?? []).map((contract) => normalizeOptionContract(contract, "put")),
  ]);
}

function normalizeOptionContract(contract, type) {
  const expiration = new Date(contract.expiration);
  return {
    type,
    strike: contract.strike,
    expiration: Number.isFinite(expiration.getTime()) ? expiration.toISOString() : null,
    impliedVolatility: contract.impliedVolatility,
    openInterest: contract.openInterest ?? null,
    volume: contract.volume ?? null,
    contractSize: contract.contractSize === "REGULAR" ? 100 : null,
  };
}

function isUsableOptionContract(contract) {
  return (
    isFiniteNumber(contract.strike) &&
    contract.strike > 0 &&
    Boolean(contract.expiration) &&
    isFiniteNumber(contract.impliedVolatility) &&
    contract.impliedVolatility > 0 &&
    isFiniteNumber(contract.openInterest) &&
    contract.openInterest > 0 &&
    contract.contractSize === 100
  );
}

function unavailableCandles(reason, fetchedAt = new Date()) {
  return {
    status: "UNAVAILABLE",
    source: "Yahoo Finance chart",
    interval: "15m",
    candles: [],
    fetchedAt: fetchedAt.toISOString(),
    stale: true,
    error: reason,
  };
}

function unavailableOptions(reason) {
  return {
    status: "UNAVAILABLE",
    source: "Yahoo Finance options chain",
    contracts: [],
    expirationCount: 0,
    fetchedAt: new Date().toISOString(),
    delayedOrIndicative: true,
    error: reason,
  };
}

function isStaleCandle(candle, now) {
  if (!candle?.date) return true;
  const ageMs = now.getTime() - new Date(candle.date).getTime();
  return !Number.isFinite(ageMs) || ageMs > 4 * 24 * 60 * 60 * 1000;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
