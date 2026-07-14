import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import { dashboardAssets, PORT, symbols } from "./config/constants.js";
import { fetchMarketData } from "./services/marketService.js";
import { fetchNewsBundle, fetchNewsData } from "./services/newsService.js";
import { buildBiasEngine } from "./services/biasService.js";
import { fetchAtrSnapshotsForAssets } from "./services/atrService.js";
import {
  fetchCalendarBundle,
  fetchCalendarEvents,
} from "./services/calendarService.js";
import { buildMacroBriefing } from "./services/briefingService.js";
import {
  getAllBiasHistory,
  getBiasHistory,
  getLatestRowsPerAsset,
  initDb,
  logBiasRun,
} from "./services/dbService.js";
import {
  buildCompactHistorySummary,
  buildDashboardSnapshot,
  buildLatestShiftFeed,
} from "./services/dashboardService.js";
import {
  detectBiasShiftTimeline,
  enrichBiasHistoryRows,
} from "./services/historyService.js";
import { buildNewsImpactFeed } from "./services/impactService.js";
import {
  buildEvaluationRows,
  buildPerformanceSummary,
  buildPostMortem,
} from "./services/performanceService.js";
import { buildSystemStatus } from "./services/systemService.js";
import { buildConfluenceSummary } from "./services/confluenceService.js";
import { fetchFinnhubQuote, getFinnhubStatus } from "./services/finnhubService.js";
import { buildMarketFlowSnapshot } from "./services/flowService.js";
import { compareNewsToFlow } from "./services/newsFlowService.js";
import { buildOptionsPressureSnapshot } from "./services/pressureService.js";
import { buildSessionContext } from "./services/sessionService.js";
import { fetchMarketStructureInputs } from "./services/marketStructureDataService.js";
import {
  addWatchlistItem,
  disableWatchlistItem,
  fetchWatchlistQuotes,
  getWatchlistItems,
  searchSymbols,
  updateWatchlistItem,
} from "./services/watchlistService.js";

const app = express();
const startedAt = Date.now();

let latestBiasRun = null;
const expectedMoveSymbols = Object.fromEntries(
  dashboardAssets.map((asset) => [asset, symbols[asset]])
);
const marketStructureTargets = dashboardAssets.map((asset) => ({
  ticker: asset,
  providerSymbol: symbols[asset],
  assetClass: ["ES", "NQ", "YM", "GOLD", "USOIL"].includes(asset) ? "futures" : "index",
}));

app.use(cors());
app.use(express.json());

await initDb();

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "trading-ai-platform-backend",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/system", async (req, res) => {
  try {
    const status = await buildSystemStatus({
      startedAt,
      latestBiasRun,
    });

    res.json(status);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch system status" });
  }
});

app.get("/api/market", async (req, res) => {
  try {
    const market = await fetchMarketData();
    res.json(market);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch market data" });
  }
});

app.get("/api/flow", async (req, res) => {
  try {
    const [market, news, calendarEvents] = await Promise.all([
      fetchMarketData(),
      fetchNewsData(),
      fetchCalendarEvents(),
    ]);

    res.json(buildMarketFlowSnapshot(market, news, calendarEvents));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch market flow proxy" });
  }
});

app.get("/api/options-pressure", async (req, res) => {
  try {
    const market = await fetchMarketData();
    res.json(buildOptionsPressureSnapshot(["ES", "NQ", "YM", "GOLD", "DXY", "USOIL"], market));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch options pressure snapshot" });
  }
});

app.get("/api/confluence", async (req, res) => {
  try {
    const { market, news, calendarEvents, atrSnapshots, marketStructureInputs } = await fetchBiasInputs();
    const biasResult = await buildBiasEngine(market, news, calendarEvents, atrSnapshots, marketStructureInputs);
    const relationships = Object.fromEntries(
      Object.keys(biasResult.assets ?? {}).map((asset) => [
        asset,
        compareNewsToFlow(news, biasResult.marketFlow, asset),
      ])
    );

    res.json({
      ...buildConfluenceSummary({
        biasOutput: biasResult.assets,
        marketFlow: biasResult.marketFlow,
        newsFlowRelationships: relationships,
        regime: biasResult.regime,
        eventRisk: biasResult.eventRisk,
        optionsPressure: biasResult.optionsPressure,
      }),
      marketFlow: biasResult.marketFlow,
      optionsPressure: biasResult.optionsPressure,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch confluence summary" });
  }
});

app.get("/api/watchlist", async (req, res) => {
  try {
    const includeDisabled = String(req.query.includeDisabled ?? "true") !== "false";
    const items = await getWatchlistItems({ includeDisabled });

    res.json({
      count: items.length,
      items,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch watchlist" });
  }
});

app.post("/api/watchlist", async (req, res) => {
  try {
    const item = await addWatchlistItem(req.body ?? {});

    res.status(201).json({
      item,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err.message);
    res.status(err.statusCode ?? 500).json({ error: err.message || "Failed to add watchlist item" });
  }
});

app.patch("/api/watchlist/:id", async (req, res) => {
  try {
    const item = await updateWatchlistItem(req.params.id, req.body ?? {});

    res.json({
      item,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err.message);
    res.status(err.statusCode ?? 500).json({ error: err.message || "Failed to update watchlist item" });
  }
});

app.delete("/api/watchlist/:id", async (req, res) => {
  try {
    const item = await disableWatchlistItem(req.params.id);

    res.json({
      item,
      disabled: true,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err.message);
    res.status(err.statusCode ?? 500).json({ error: err.message || "Failed to disable watchlist item" });
  }
});

app.get("/api/watchlist/quotes", async (req, res) => {
  try {
    const quotes = await fetchWatchlistQuotes();
    res.json(quotes);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch watchlist quotes" });
  }
});

app.get("/api/symbol-search", async (req, res) => {
  try {
    const query = String(req.query.query ?? "");
    const type = String(req.query.type ?? "all");
    const result = await searchSymbols(query, type);

    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to search symbols" });
  }
});

app.get("/api/finnhub/status", (req, res) => {
  res.json(getFinnhubStatus());
});

app.get("/api/finnhub/quote/:symbol", async (req, res) => {
  try {
    const quote = await fetchFinnhubQuote(req.params.symbol);
    res.json({
      ...quote,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch Finnhub quote" });
  }
});

app.get("/api/news", async (req, res) => {
  try {
    const news = await fetchNewsBundle();
    res.json(news);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch news data" });
  }
});

app.get("/api/news-impact", async (req, res) => {
  try {
    const news = await fetchNewsData();
    const impactFeed = buildNewsImpactFeed(news);

    res.json({
      ...impactFeed,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch news impact data" });
  }
});

app.get("/api/calendar", async (req, res) => {
  try {
    const calendar = await fetchCalendarBundle();
    res.json(calendar);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch calendar data" });
  }
});

app.get("/api/briefing", async (req, res) => {
  try {
    const { market, news, calendarEvents, atrSnapshots, marketStructureInputs } = await fetchBiasInputs();
    const biasResult = await buildBiasEngine(market, news, calendarEvents, atrSnapshots, marketStructureInputs);
    const newsImpact = buildNewsImpactFeed(news);
    const briefing = buildMacroBriefing({
      market,
      bias: biasResult.assets,
      newsImpact,
    });

    res.json({
      briefing,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch macro briefing" });
  }
});

app.get("/api/bias", async (req, res) => {
  try {
    const snapshot = await buildBiasSnapshot();
    res.json(snapshot);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to generate bias" });
  }
});

app.post("/api/bias/log", async (req, res) => {
  try {
    const snapshot = await buildBiasSnapshot();
    const savedRun = await logBiasRun({
      biasOutput: snapshot.bias,
      market: snapshot.market,
      headlineCount: snapshot.headlineCount,
      generatedAt: snapshot.generatedAt,
      regimeData: snapshot.regime,
      eventRisk: snapshot.eventRisk,
      newsContext: snapshot.newsContext,
      calendarContext: snapshot.calendarContext,
      sourceStatus: snapshot.sourceStatus,
      sessionContext: snapshot.sessionContext,
      rawContext: snapshot.rawContext,
      runType: "manual",
    });

    latestBiasRun = {
      runId: savedRun.runId,
      generatedAt: savedRun.generatedAt,
      loggedAt: savedRun.loggedAt,
      headlineCount: savedRun.headlineCount,
      regime: savedRun.regime,
      eventRisk: savedRun.eventRisk,
      assetCount: savedRun.assetCount,
      runType: "manual",
    };

    res.status(201).json({
      saved: true,
      run: latestBiasRun,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to log bias run" });
  }
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const { market, news, calendarEvents, atrSnapshots, marketStructureInputs } = await fetchBiasInputs();
    const biasResult = await buildBiasEngine(market, news, calendarEvents, atrSnapshots, marketStructureInputs);
    const newsImpact = buildNewsImpactFeed(news);
    const briefing = buildMacroBriefing({
      market,
      bias: biasResult.assets,
      newsImpact,
    });
    const generatedAt = new Date().toISOString();

    const snapshot = buildDashboardSnapshot({
      market,
      bias: biasResult.assets,
      regime: biasResult.regime,
      eventRisk: biasResult.eventRisk,
      sentiment: biasResult.sentiment,
      newsImpact,
      marketFlow: biasResult.marketFlow,
      optionsPressure: biasResult.optionsPressure,
      atrSnapshots: biasResult.atrSnapshots,
      sessionContext: biasResult.sessionContext,
      generatedAt,
    });

    res.json({
      ...snapshot,
      briefing,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch dashboard snapshot" });
  }
});

app.get("/api/bias-history/:asset", async (req, res) => {
  try {
    const asset = String(req.params.asset || "").toUpperCase();
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 24)));

    const rawRows = await getBiasHistory(asset, limit);
    const history = enrichBiasHistoryRows(rawRows);
    const shifts = detectBiasShiftTimeline(history);

    res.json({
      asset,
      count: history.length,
      history,
      shifts,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch bias history" });
  }
});

app.get("/api/bias-history-summary/:asset", async (req, res) => {
  try {
    const asset = String(req.params.asset || "").toUpperCase();
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 24)));

    const rawRows = await getBiasHistory(asset, limit);
    const history = enrichBiasHistoryRows(rawRows);
    const shifts = detectBiasShiftTimeline(history);

    res.json(
      buildCompactHistorySummary({
        asset,
        history,
        shifts,
      })
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch bias history summary" });
  }
});

app.get("/api/bias-history-all", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 48)));
    const rawRows = await getAllBiasHistory(limit);
    const enriched = enrichBiasHistoryRows(rawRows);
    const evaluated = buildEvaluationRows(enriched);

    res.json({
      count: evaluated.length,
      history: evaluated,
      summary: buildPerformanceSummary(evaluated),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch all bias history" });
  }
});

app.get("/api/bias-shifts", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 120)));
    const rawRows = await getAllBiasHistory(limit);
    const enriched = enrichBiasHistoryRows(rawRows);

    res.json({
      count: enriched.length,
      shifts: buildLatestShiftFeed(enriched),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch bias shifts" });
  }
});

app.get("/api/performance", async (req, res) => {
  try {
    const limit = normalizeLimit(req.query.limit, 120, 1000);
    const historyLimit = normalizeHistoryLimit(limit);
    const asset = req.query.asset
      ? String(req.query.asset).toUpperCase()
      : null;
    const rawRows = asset
      ? await getBiasHistory(asset, historyLimit)
      : await getAllBiasHistory(historyLimit);
    const evaluated = buildEvaluationRows(rawRows);
    const latestPerAsset = await getLatestRowsPerAsset();

    res.json({
      asset,
      summary: buildPerformanceSummary(evaluated),
      latestByAsset: latestPerAsset,
      evaluationSample: evaluated.slice(0, Math.min(24, limit)),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch performance data" });
  }
});

app.get("/api/evaluations", async (req, res) => {
  try {
    const limit = normalizeLimit(req.query.limit, 500, 2000);
    const historyLimit = normalizeHistoryLimit(limit);
    const asset = req.query.asset
      ? String(req.query.asset).toUpperCase()
      : null;
    const verdict = req.query.verdict
      ? String(req.query.verdict).toLowerCase()
      : null;
    const rawRows = asset
      ? await getBiasHistory(asset, historyLimit)
      : await getAllBiasHistory(historyLimit);
    const filteredEvaluations = buildEvaluationRows(rawRows).filter((row) =>
      verdict ? row.evaluation?.verdict === verdict : true
    );
    const evaluations = filteredEvaluations.slice(0, limit);

    res.json({
      count: evaluations.length,
      asset,
      verdict,
      summary: buildPerformanceSummary(filteredEvaluations),
      evaluations,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch evaluations" });
  }
});

app.get("/api/postmortem/:id", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(5000, Number(req.query.limit || 2000)));
    const rawRows = await getAllBiasHistory(limit);
    const evaluations = buildEvaluationRows(rawRows);
    const postMortem = buildPostMortem(evaluations, req.params.id);

    if (!postMortem) {
      res.status(404).json({ error: "Post-mortem row not found or not evaluable yet" });
      return;
    }

    res.json({
      postMortem,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch post-mortem" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

function normalizeLimit(value, fallback, max) {
  const parsed = Number(value ?? fallback);
  return Math.max(1, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
}

function normalizeHistoryLimit(resultLimit) {
  return Math.max(200, Math.min(5000, resultLimit * 50));
}

async function buildBiasSnapshot() {
  const {
    market,
    news,
    calendarEvents,
    newsBundle,
    calendarBundle,
    atrSnapshots,
    marketStructureInputs,
  } = await fetchBiasInputs();
  const biasResult = await buildBiasEngine(market, news, calendarEvents, atrSnapshots, marketStructureInputs);
  const newsImpact = buildNewsImpactFeed(news);
  const generatedAt = new Date().toISOString();

  return {
    market,
    regime: biasResult.regime,
    eventRisk: biasResult.eventRisk,
    marketFlow: biasResult.marketFlow,
    optionsPressure: biasResult.optionsPressure,
    atrSnapshots: biasResult.atrSnapshots,
    sentiment: biasResult.sentiment,
    bias: biasResult.assets,
    headlineCount: news.length,
    calendarEventCount: calendarEvents.length,
    newsContext: newsBundle,
    calendarContext: calendarBundle,
    sourceStatus: {
      news: newsBundle.sources ?? [],
      calendar: calendarBundle.source ?? null,
    },
    sessionContext: biasResult.sessionContext ?? buildSessionContext(generatedAt),
    rawContext: {
      market,
      news: newsBundle,
      marketNews: {
        fetchedAt: newsBundle.generatedAt ?? generatedAt,
        sourceStatus: newsBundle.sources ?? [],
        healthySourceCount: newsBundle.healthySourceCount ?? 0,
        headlineCount: newsImpact.headlineCount,
        impactSummary: newsImpact.summary,
        topMarketHeadlines: (newsImpact.items ?? []).slice(0, 12),
        freshness: buildNewsFreshnessStatus(newsBundle, generatedAt),
      },
      newsImpact,
      calendar: calendarBundle,
      atrSnapshots,
      marketFlow: biasResult.marketFlow,
      optionsPressure: biasResult.optionsPressure,
      marketStructure: Object.fromEntries(
        Object.entries(biasResult.assets).map(([asset, row]) => [asset, {
          gex: row.gex,
          cvd: row.cvd,
          reversal: row.reversal,
          confluenceBreakdown: row.confluenceBreakdown,
        }])
      ),
      scoreContract: {
        score: "final confluence display score",
        rawBiasScore: "legacy combined news/technical/macro/event score",
        edgeScore: "advanced confluence score",
        expectedMove: "based on normalized confluence score, not raw bias score",
      },
    },
    generatedAt,
  };
}

async function fetchBiasInputs() {
  const [market, newsBundle, calendarBundle, atrSnapshots, marketStructureInputs] = await Promise.all([
    fetchMarketData(),
    fetchNewsBundle(),
    fetchCalendarBundle(),
    fetchAtrSnapshotsForAssets(expectedMoveSymbols),
    fetchMarketStructureInputs(marketStructureTargets),
  ]);

  return {
    market,
    news: newsBundle.items ?? [],
    calendarEvents: calendarBundle.events ?? [],
    newsBundle,
    calendarBundle,
    atrSnapshots,
    marketStructureInputs,
  };
}

function buildNewsFreshnessStatus(newsBundle = {}, fallbackTime) {
  const items = newsBundle.items ?? [];
  const latestTimestamp = items
    .map((item) => new Date(item.pubDate).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  const checkedAt = newsBundle.generatedAt ?? fallbackTime;
  const ageHours =
    latestTimestamp && Number.isFinite(latestTimestamp)
      ? (new Date(checkedAt).getTime() - latestTimestamp) / 3600000
      : null;

  return {
    checkedAt,
    latestPublishedAt: latestTimestamp ? new Date(latestTimestamp).toISOString() : null,
    ageHours: typeof ageHours === "number" ? Number(ageHours.toFixed(2)) : null,
    status:
      items.length === 0
        ? "UNAVAILABLE"
        : typeof ageHours === "number" && ageHours > 24
          ? "STALE"
          : "FRESH",
  };
}
