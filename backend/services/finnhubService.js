const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const QUOTE_CACHE_TTL_MS = 45 * 1000;

const quoteCache = new Map();
let latestStatus = buildStatus(process.env.FINNHUB_API_KEY ? "UNKNOWN" : "DISABLED");

export function getFinnhubStatus() {
  if (!process.env.FINNHUB_API_KEY) {
    latestStatus = buildStatus("DISABLED", "FINNHUB_API_KEY is not configured");
  }

  return latestStatus;
}

export async function fetchFinnhubQuote(providerSymbol) {
  const disabled = getDisabledResult();

  if (disabled) {
    return normalizeFinnhubQuote({
      providerSymbol,
      status: disabled.status,
      error: disabled.error,
    });
  }

  const cacheKey = String(providerSymbol).toUpperCase();
  const cached = quoteCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < QUOTE_CACHE_TTL_MS) {
    return cached.quote;
  }

  try {
    const data = await fetchFinnhubJson(`/quote?symbol=${encodeURIComponent(providerSymbol)}`);
    const quote = normalizeFinnhubQuote({
      providerSymbol,
      raw: data,
      status: "OK",
      error: null,
    });

    quoteCache.set(cacheKey, {
      fetchedAt: Date.now(),
      quote,
    });
    latestStatus = buildStatus("OK");

    return quote;
  } catch (err) {
    const error = sanitizeFinnhubError(err);
    latestStatus = buildStatus("ERROR", error);

    return normalizeFinnhubQuote({
      providerSymbol,
      status: "ERROR",
      error,
    });
  }
}

export async function searchFinnhubSymbols(query, type = "stocks") {
  const disabled = getDisabledResult();

  if (disabled) {
    return {
      available: false,
      status: disabled.status,
      error: disabled.error,
      results: [],
    };
  }

  try {
    const normalizedType = String(type || "stocks").toLowerCase();
    const endpoint =
      normalizedType === "forex"
        ? `/search?q=${encodeURIComponent(query)}`
        : `/search?q=${encodeURIComponent(query)}`;
    const data = await fetchFinnhubJson(endpoint);
    latestStatus = buildStatus("OK");

    return {
      available: true,
      status: "OK",
      error: null,
      results: (data.result ?? []).slice(0, 12).map((item) => ({
        symbol: item.symbol,
        displayName: item.description || item.symbol,
        assetClass: normalizedType === "forex" ? "forex" : inferAssetClass(item),
        provider: "finnhub",
        providerSymbol: item.symbol,
      })),
    };
  } catch (err) {
    const error = sanitizeFinnhubError(err);
    latestStatus = buildStatus("ERROR", error);

    return {
      available: false,
      status: "ERROR",
      error,
      results: [],
    };
  }
}

function getDisabledResult() {
  if (!process.env.FINNHUB_API_KEY) {
    latestStatus = buildStatus("DISABLED", "FINNHUB_API_KEY is not configured");
    return {
      status: "DISABLED",
      error: "FINNHUB_API_KEY is not configured",
    };
  }

  return null;
}

async function fetchFinnhubJson(path) {
  const url = `${FINNHUB_BASE_URL}${path}${path.includes("?") ? "&" : "?"}token=${process.env.FINNHUB_API_KEY}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Finnhub status ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeFinnhubQuote({ providerSymbol, raw = {}, status, error }) {
  const timestamp = raw.t ? new Date(raw.t * 1000).toISOString() : new Date().toISOString();

  return {
    provider: "finnhub",
    providerSymbol,
    price: raw.c ?? null,
    change: raw.d ?? null,
    percent: raw.dp ?? null,
    high: raw.h ?? null,
    low: raw.l ?? null,
    open: raw.o ?? null,
    previousClose: raw.pc ?? null,
    dayRange:
      typeof raw.l === "number" && typeof raw.h === "number"
        ? `${raw.l} - ${raw.h}`
        : null,
    timestamp,
    status,
    quoteStatus: status,
    error,
    raw: status === "OK" ? raw : {},
  };
}

function buildStatus(status, error = null) {
  return {
    id: "finnhub",
    name: "Finnhub",
    available: status !== "DISABLED" && status !== "ERROR",
    configured: Boolean(process.env.FINNHUB_API_KEY),
    status,
    error,
    checkedAt: new Date().toISOString(),
  };
}

function inferAssetClass(item) {
  const type = String(item.type ?? "").toLowerCase();
  const symbol = String(item.symbol ?? "").toUpperCase();

  if (type.includes("etf") || ["SPY", "QQQ", "IWM", "DIA"].includes(symbol)) return "etfs";
  return "stocks";
}

function sanitizeFinnhubError(err) {
  const message = String(err?.message ?? err ?? "Finnhub request failed");

  if (message.includes("429")) return "Finnhub rate limit reached";
  if (message.toLowerCase().includes("abort")) return "Finnhub request timed out";
  return message.replace(process.env.FINNHUB_API_KEY ?? "", "[redacted]");
}
