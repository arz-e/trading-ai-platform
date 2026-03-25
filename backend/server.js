import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import { PORT } from "./config/constants.js";
import { fetchMarketData } from "./services/marketService.js";
import { fetchNewsData } from "./services/newsService.js";
import { buildBiasEngine } from "./services/biasService.js";
import { fetchCalendarEvents } from "./services/calendarService.js";
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
} from "./services/performanceService.js";
import { buildSystemStatus } from "./services/systemService.js";

const app = express();
const startedAt = Date.now();

let latestBiasRun = null;

app.use(cors());
app.use(express.json());

initDb();

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

app.get("/api/news", async (req, res) => {
  try {
    const news = await fetchNewsData();
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
    const events = await fetchCalendarEvents();

    res.json({
      count: events.length,
      events,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch calendar data" });
  }
});

app.get("/api/briefing", async (req, res) => {
  try {
    const [market, news, calendarEvents] = await Promise.all([
      fetchMarketData(),
      fetchNewsData(),
      fetchCalendarEvents(),
    ]);

    const biasResult = await buildBiasEngine(market, news, calendarEvents);
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
    const [market, news, calendarEvents] = await Promise.all([
      fetchMarketData(),
      fetchNewsData(),
      fetchCalendarEvents(),
    ]);

    const biasResult = await buildBiasEngine(market, news, calendarEvents);
    const generatedAt = new Date().toISOString();

    latestBiasRun = {
      generatedAt,
      headlineCount: news.length,
      regime: biasResult.regime,
      eventRisk: biasResult.eventRisk,
      assetCount: Object.keys(biasResult.assets).length,
    };

    logBiasRun({
      biasOutput: biasResult.assets,
      market,
      headlineCount: news.length,
      generatedAt,
      regimeData: biasResult.regime,
      eventRisk: biasResult.eventRisk,
    });

    res.json({
      market,
      regime: biasResult.regime,
      eventRisk: biasResult.eventRisk,
      sentiment: biasResult.sentiment,
      bias: biasResult.assets,
      headlineCount: news.length,
      calendarEventCount: calendarEvents.length,
      generatedAt,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to generate bias" });
  }
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const [market, news, calendarEvents] = await Promise.all([
      fetchMarketData(),
      fetchNewsData(),
      fetchCalendarEvents(),
    ]);

    const biasResult = await buildBiasEngine(market, news, calendarEvents);
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
    const limit = Math.max(1, Math.min(1000, Number(req.query.limit || 120)));
    const rawRows = await getAllBiasHistory(limit);
    const evaluated = buildEvaluationRows(rawRows);
    const latestPerAsset = await getLatestRowsPerAsset();

    res.json({
      summary: buildPerformanceSummary(evaluated),
      latestByAsset: latestPerAsset,
      evaluationSample: evaluated.slice(0, 24),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch performance data" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});