import YahooFinance from "yahoo-finance2";
import { coreWatchlistItems } from "../config/providerSymbols.js";
import { localSymbolUniverse } from "../config/symbolUniverse.js";
import {
  addWatchlistItem,
  disableWatchlistItem,
  getWatchlistItems,
  getWatchlistStats,
  updateWatchlistItem,
} from "./dbService.js";
import { fetchFinnhubQuote, getFinnhubStatus, searchFinnhubSymbols } from "./finnhubService.js";

const yahoo = new YahooFinance();
const YAHOO_QUOTE_CACHE_TTL_MS = 45 * 1000;
const yahooQuoteCache = new Map();

export {
  addWatchlistItem,
  disableWatchlistItem,
  getWatchlistItems,
  getWatchlistStats,
  updateWatchlistItem,
};

export async function fetchWatchlistQuotes() {
  const items = await getWatchlistItems({ includeDisabled: false });
  const quotes = [];

  for (const item of items) {
    const quote = item.provider === "finnhub"
      ? await fetchFinnhubQuote(item.providerSymbol)
      : await fetchYahooWatchlistQuote(item.providerSymbol);

    quotes.push({
      id: item.id,
      symbol: item.symbol,
      displayName: item.displayName,
      assetClass: item.assetClass,
      provider: item.provider,
      providerSymbol: item.providerSymbol,
      quoteStatus: quote.status,
      ...quote,
    });
  }

  return {
    count: quotes.length,
    quotes,
    providers: buildProviderStatus(quotes),
    generatedAt: new Date().toISOString(),
  };
}

export async function searchSymbols(query, type = "all") {
  const trimmed = String(query ?? "").trim();
  const normalizedType = String(type ?? "all").toLowerCase();

  if (!trimmed) {
    return {
      query: trimmed,
      type: normalizedType,
      results: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const localMatches = searchLocalSymbols(trimmed, normalizedType);

  const shouldSearchFinnhub = ["all", "stocks", "etfs", "forex", "metals"].includes(normalizedType);
  const finnhubResults = shouldSearchFinnhub
    ? await searchFinnhubSymbols(trimmed, normalizedType === "all" ? "stocks" : normalizedType)
    : { results: [], status: "SKIPPED", error: null };

  return {
    query: trimmed,
    type: normalizedType,
    results: mergeSymbolResults(localMatches, finnhubResults.results ?? []).slice(0, 16),
    providerStatus: {
      local: {
        status: "OK",
        error: null,
        resultCount: localMatches.length,
      },
      finnhub: {
        status: finnhubResults.status,
        error: finnhubResults.error,
      },
    },
    generatedAt: new Date().toISOString(),
  };
}

export function getWatchlistProviderHealth() {
  return {
    yahoo: {
      id: "yahoo",
      name: "Yahoo Finance",
      status: "OK",
      configured: true,
      checkedAt: new Date().toISOString(),
      error: null,
    },
    finnhub: getFinnhubStatus(),
  };
}

async function fetchYahooWatchlistQuote(providerSymbol) {
  const cacheKey = String(providerSymbol).toUpperCase();
  const cached = yahooQuoteCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < YAHOO_QUOTE_CACHE_TTL_MS) {
    return cached.quote;
  }

  try {
    const quote = await yahoo.quote(providerSymbol);
    const normalized = normalizeYahooQuote(providerSymbol, quote);
    yahooQuoteCache.set(cacheKey, {
      fetchedAt: Date.now(),
      quote: normalized,
    });
    return normalized;
  } catch (err) {
    return {
      price: null,
      change: null,
      percent: null,
      high: null,
      low: null,
      open: null,
      previousClose: null,
      dayRange: null,
      timestamp: new Date().toISOString(),
      status: "ERROR",
      quoteStatus: "ERROR",
      error: err.message,
      raw: {},
    };
  }
}

function normalizeYahooQuote(providerSymbol, quote = {}) {
  return {
    price: quote?.regularMarketPrice ?? null,
    change: quote?.regularMarketChange ?? null,
    percent: quote?.regularMarketChangePercent ?? null,
    high: quote?.regularMarketDayHigh ?? null,
    low: quote?.regularMarketDayLow ?? null,
    open: quote?.regularMarketOpen ?? null,
    previousClose: quote?.regularMarketPreviousClose ?? null,
    dayRange: buildDayRange(quote?.regularMarketDayLow, quote?.regularMarketDayHigh),
    timestamp: normalizeYahooTimestamp(quote?.regularMarketTime),
    status: "OK",
    quoteStatus: "OK",
    error: null,
    raw: {
      symbol: providerSymbol,
      exchange: quote?.fullExchangeName ?? quote?.exchange ?? null,
      marketState: quote?.marketState ?? null,
    },
  };
}

function searchLocalSymbols(query, type) {
  const normalizedQuery = query.toUpperCase();
  const normalizedType = String(type ?? "all").toLowerCase();
  const universe = [...coreWatchlistItems, ...localSymbolUniverse].filter((item) =>
    normalizedType === "all" || item.assetClass === normalizedType
  );
  const prefixMatches = [];
  const containsMatches = [];

  for (const item of universe) {
    const symbol = item.symbol.toUpperCase();
    const displayName = item.displayName.toUpperCase();
    const providerSymbol = item.providerSymbol.toUpperCase();
    const match = {
      symbol: item.symbol,
      displayName: item.displayName,
      assetClass: item.assetClass,
      provider: item.provider,
      providerSymbol: item.providerSymbol,
    };

    if (symbol.startsWith(normalizedQuery) || providerSymbol.startsWith(normalizedQuery)) {
      prefixMatches.push(match);
    } else if (
      symbol.includes(normalizedQuery) ||
      displayName.includes(normalizedQuery) ||
      providerSymbol.includes(normalizedQuery)
    ) {
      containsMatches.push(match);
    }
  }

  return [...sortSymbols(prefixMatches), ...sortSymbols(containsMatches)];
}

function mergeSymbolResults(localResults = [], providerResults = []) {
  const seen = new Set();
  const merged = [];

  for (const item of [...localResults, ...providerResults]) {
    const key = String(item.symbol ?? item.providerSymbol ?? "").toUpperCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

function sortSymbols(items = []) {
  return [...items].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function buildDayRange(low, high) {
  if (typeof low !== "number" || typeof high !== "number") return null;
  return `${low} - ${high}`;
}

function normalizeYahooTimestamp(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date((value > 1000000000000 ? value : value * 1000)).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function buildProviderStatus(quotes = []) {
  const counts = {};

  for (const quote of quotes) {
    counts[quote.provider] = (counts[quote.provider] ?? 0) + 1;
  }

  return {
    counts,
    health: getWatchlistProviderHealth(),
  };
}
