import { symbols } from "./constants.js";

export const coreWatchlistItems = [
  {
    symbol: "ES",
    displayName: "S&P 500 Futures",
    assetClass: "futures",
    provider: "yahoo",
    providerSymbol: symbols.ES,
    sortOrder: 10,
  },
  {
    symbol: "NQ",
    displayName: "Nasdaq Futures",
    assetClass: "futures",
    provider: "yahoo",
    providerSymbol: symbols.NQ,
    sortOrder: 20,
  },
  {
    symbol: "YM",
    displayName: "Dow Futures",
    assetClass: "futures",
    provider: "yahoo",
    providerSymbol: symbols.YM,
    sortOrder: 30,
  },
  {
    symbol: "GOLD",
    displayName: "Gold Futures",
    assetClass: "metals",
    provider: "yahoo",
    providerSymbol: symbols.GOLD,
    sortOrder: 40,
  },
  {
    symbol: "DXY",
    displayName: "US Dollar Index",
    assetClass: "indices",
    provider: "yahoo",
    providerSymbol: symbols.DXY,
    sortOrder: 50,
  },
  {
    symbol: "USOIL",
    displayName: "US Oil",
    assetClass: "futures",
    provider: "yahoo",
    providerSymbol: symbols.USOIL,
    sortOrder: 60,
  },
  {
    symbol: "VIX",
    displayName: "CBOE Volatility Index",
    assetClass: "indices",
    provider: "yahoo",
    providerSymbol: symbols.VIX,
    sortOrder: 70,
  },
  {
    symbol: "US10Y",
    displayName: "US 10Y Yield",
    assetClass: "indices",
    provider: "yahoo",
    providerSymbol: symbols.US10Y,
    sortOrder: 80,
  },
];

export const supportedAssetClasses = new Set([
  "futures",
  "stocks",
  "forex",
  "metals",
  "indices",
  "etfs",
  "crypto_later",
]);

export const supportedProviders = new Set(["yahoo", "finnhub"]);
