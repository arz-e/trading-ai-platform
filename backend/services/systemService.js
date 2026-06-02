import { dashboardAssets, symbols } from "../config/constants.js";
import { getSystemStats } from "./dbService.js";
import { getCalendarSourceStatus } from "./calendarService.js";
import { getNewsSourceStatus } from "./newsService.js";
import { getWatchlistProviderHealth, getWatchlistStats } from "./watchlistService.js";

/*
  System Service

  Used by /api/system to provide:
  - uptime
  - DB health
  - tracked assets
  - latest bias run metadata
*/

export async function buildSystemStatus({ startedAt, latestBiasRun }) {
  const dbStats = await getSystemStats();
  const watchlist = await getWatchlistStats();
  const watchlistProviders = getWatchlistProviderHealth();

  return {
    ok: true,
    service: "trading-ai-platform-backend",
    now: new Date().toISOString(),

    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),

    trackedAssets: dashboardAssets,
    trackedAssetCount: dashboardAssets.length,

    trackedSymbols: Object.keys(symbols),
    trackedSymbolCount: Object.keys(symbols).length,

    database: {
      connected: true,
      biasHistoryRows: dbStats.biasHistoryRows,
      biasRunRows: dbStats.biasRunRows,
    },

    dataSources: {
      news: getNewsSourceStatus(),
      calendar: getCalendarSourceStatus(),
      marketProviders: watchlistProviders,
    },

    watchlist,

    latestBiasRun: latestBiasRun || null,
  };
}
