import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";
import {
  coreWatchlistItems,
  supportedAssetClasses,
  supportedProviders,
} from "../config/providerSymbols.js";

const DB_PATH = "./data/trading_ai.db";
const DB_DIR = path.dirname(DB_PATH);

fs.mkdirSync(DB_DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("SQLite connection error:", err.message);
  } else {
    console.log(`SQLite connected at ${DB_PATH}`);
  }
});

export function initDb() {
  const createBiasHistoryTableSql = `
    CREATE TABLE IF NOT EXISTS bias_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset TEXT NOT NULL,
      bias TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      score REAL NOT NULL,
      move_points REAL NOT NULL,
      current_price REAL,
      analysis TEXT,
      reasons_json TEXT,
      drivers_json TEXT,
      sentiment_json TEXT,
      news_bias_json TEXT,
      technical_bias_json TEXT,
      combined_bias_json TEXT,
      market_snapshot_json TEXT,
      run_id INTEGER,
      session_context_json TEXT,
      source_status_json TEXT,
      news_context_json TEXT,
      calendar_context_json TEXT,
      event_risk_json TEXT,
      regime_json TEXT,
      formula_components_json TEXT,
      raw_context_json TEXT,
      evaluation_json TEXT,
      manual_review_notes TEXT,
      headline_count INTEGER,
      generated_at TEXT NOT NULL
    );
  `;

  const createBiasRunsTableSql = `
    CREATE TABLE IF NOT EXISTS bias_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      generated_at TEXT NOT NULL,
      headline_count INTEGER NOT NULL,
      asset_count INTEGER NOT NULL,
      regime TEXT,
      regime_confidence INTEGER,
      regime_reasons_json TEXT,
      event_risk_level TEXT,
      event_risk_score REAL,
      next_event_title TEXT,
      run_type TEXT,
      logged_at TEXT,
      session_context_json TEXT,
      source_status_json TEXT,
      market_snapshot_json TEXT,
      news_context_json TEXT,
      calendar_context_json TEXT,
      event_risk_json TEXT,
      regime_json TEXT,
      bias_output_json TEXT,
      formula_components_json TEXT,
      raw_context_json TEXT,
      manual_review_notes TEXT
    );
  `;

  const createWatchlistTableSql = `
    CREATE TABLE IF NOT EXISTS watchlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      display_name TEXT,
      asset_class TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_symbol TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `;

  db.run(createBiasHistoryTableSql, (err) => {
    if (err) {
      console.error("Failed to create bias_history table:", err.message);
    } else {
      console.log("bias_history table ready");
    }
  });

  db.run(createBiasRunsTableSql, (err) => {
    if (err) {
      console.error("Failed to create bias_runs table:", err.message);
    } else {
      console.log("bias_runs table ready");
    }
  });

  db.run(createWatchlistTableSql, (err) => {
    if (err) {
      console.error("Failed to create watchlist_items table:", err.message);
    } else {
      console.log("watchlist_items table ready");
      seedCoreWatchlistItems().catch((seedErr) => {
        console.error("Failed to seed core watchlist:", seedErr.message);
      });
    }
  });

  db.run(`ALTER TABLE bias_history ADD COLUMN drivers_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_history ADD COLUMN sentiment_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_history ADD COLUMN news_bias_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_history ADD COLUMN technical_bias_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_history ADD COLUMN combined_bias_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_history ADD COLUMN run_id INTEGER`, () => {});
  db.run(`ALTER TABLE bias_history ADD COLUMN session_context_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_history ADD COLUMN source_status_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_history ADD COLUMN news_context_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_history ADD COLUMN calendar_context_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_history ADD COLUMN event_risk_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_history ADD COLUMN regime_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_history ADD COLUMN formula_components_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_history ADD COLUMN raw_context_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_history ADD COLUMN evaluation_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_history ADD COLUMN manual_review_notes TEXT`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN event_risk_level TEXT`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN event_risk_score REAL`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN next_event_title TEXT`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN run_type TEXT`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN logged_at TEXT`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN session_context_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN source_status_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN market_snapshot_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN news_context_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN calendar_context_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN event_risk_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN regime_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN bias_output_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN formula_components_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN raw_context_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN manual_review_notes TEXT`, () => {});
}

export async function getWatchlistItems({ includeDisabled = true } = {}) {
  const rows = await allSql(
    `
      SELECT
        id,
        symbol,
        display_name AS displayName,
        asset_class AS assetClass,
        provider,
        provider_symbol AS providerSymbol,
        enabled,
        sort_order AS sortOrder,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM watchlist_items
      ${includeDisabled ? "" : "WHERE enabled = 1"}
      ORDER BY sort_order ASC, id ASC
    `
  );

  return rows.map(normalizeWatchlistRow);
}

export async function addWatchlistItem(input = {}) {
  const item = normalizeWatchlistInput(input);
  const existing = await getSql(
    `
      SELECT id, enabled
      FROM watchlist_items
      WHERE provider = ? AND provider_symbol = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [item.provider, item.providerSymbol]
  );

  if (existing?.enabled) {
    const error = new Error("Watchlist item already exists");
    error.statusCode = 409;
    throw error;
  }

  const now = new Date().toISOString();

  if (existing?.id) {
    await runSql(
      `
        UPDATE watchlist_items
        SET symbol = ?, display_name = ?, asset_class = ?, enabled = 1,
            sort_order = ?, updated_at = ?
        WHERE id = ?
      `,
      [
        item.symbol,
        item.displayName,
        item.assetClass,
        item.sortOrder,
        now,
        existing.id,
      ]
    );

    return getWatchlistItem(existing.id);
  }

  const result = await runSql(
    `
      INSERT INTO watchlist_items (
        symbol,
        display_name,
        asset_class,
        provider,
        provider_symbol,
        enabled,
        sort_order,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      item.symbol,
      item.displayName,
      item.assetClass,
      item.provider,
      item.providerSymbol,
      item.enabled ? 1 : 0,
      item.sortOrder,
      now,
      now,
    ]
  );

  return getWatchlistItem(result.lastID);
}

export async function updateWatchlistItem(id, input = {}) {
  const current = await getWatchlistItem(id);

  if (!current) {
    const error = new Error("Watchlist item not found");
    error.statusCode = 404;
    throw error;
  }

  const next = {
    ...current,
    displayName: input.displayName ?? current.displayName,
    providerSymbol: input.providerSymbol ?? current.providerSymbol,
    enabled: input.enabled === undefined ? current.enabled : Boolean(input.enabled),
    sortOrder: input.sortOrder === undefined ? current.sortOrder : Number(input.sortOrder),
  };
  const now = new Date().toISOString();

  await runSql(
    `
      UPDATE watchlist_items
      SET display_name = ?, provider_symbol = ?, enabled = ?, sort_order = ?, updated_at = ?
      WHERE id = ?
    `,
    [
      next.displayName,
      next.providerSymbol,
      next.enabled ? 1 : 0,
      Number.isFinite(next.sortOrder) ? next.sortOrder : current.sortOrder,
      now,
      id,
    ]
  );

  return getWatchlistItem(id);
}

export async function disableWatchlistItem(id) {
  const current = await getWatchlistItem(id);

  if (!current) {
    const error = new Error("Watchlist item not found");
    error.statusCode = 404;
    throw error;
  }

  await runSql(
    `
      UPDATE watchlist_items
      SET enabled = 0, updated_at = ?
      WHERE id = ?
    `,
    [new Date().toISOString(), id]
  );

  return {
    ...current,
    enabled: false,
  };
}

export async function getWatchlistStats() {
  const rows = await getWatchlistItems({ includeDisabled: false });
  const providers = {};

  for (const row of rows) {
    providers[row.provider] = (providers[row.provider] ?? 0) + 1;
  }

  return {
    enabledCount: rows.length,
    providers,
    generatedAt: new Date().toISOString(),
  };
}

export async function logBiasRun({
  biasOutput,
  market,
  headlineCount,
  generatedAt,
  regimeData,
  eventRisk,
  newsContext = null,
  calendarContext = null,
  sourceStatus = null,
  sessionContext = null,
  runType = "manual",
  rawContext = null,
}) {
  const insertAssetSql = `
    INSERT INTO bias_history (
      run_id,
      asset,
      bias,
      confidence,
      score,
      move_points,
      current_price,
      analysis,
      reasons_json,
      drivers_json,
      sentiment_json,
      news_bias_json,
      technical_bias_json,
      combined_bias_json,
      market_snapshot_json,
      session_context_json,
      source_status_json,
      news_context_json,
      calendar_context_json,
      event_risk_json,
      regime_json,
      formula_components_json,
      raw_context_json,
      evaluation_json,
      manual_review_notes,
      headline_count,
      generated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const insertRunSql = `
    INSERT INTO bias_runs (
      generated_at,
      headline_count,
      asset_count,
      regime,
      regime_confidence,
      regime_reasons_json,
      event_risk_level,
      event_risk_score,
      next_event_title,
      run_type,
      logged_at,
      session_context_json,
      source_status_json,
      market_snapshot_json,
      news_context_json,
      calendar_context_json,
      event_risk_json,
      regime_json,
      bias_output_json,
      formula_components_json,
      raw_context_json,
      manual_review_notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const loggedAt = new Date().toISOString();
  const formulaComponents = buildFormulaComponents(biasOutput, regimeData, eventRisk);
  const runResult = await runSql(
    insertRunSql,
    [
      generatedAt,
      headlineCount,
      Object.keys(biasOutput).length,
      regimeData?.regime ?? null,
      regimeData?.confidence ?? null,
      JSON.stringify(regimeData?.reasons ?? []),
      eventRisk?.level ?? null,
      eventRisk?.score ?? null,
      eventRisk?.nextEvent?.title ?? null,
      runType,
      loggedAt,
      JSON.stringify(sessionContext || {}),
      JSON.stringify(sourceStatus || {}),
      JSON.stringify(market || {}),
      JSON.stringify(newsContext || {}),
      JSON.stringify(calendarContext || {}),
      JSON.stringify(eventRisk || {}),
      JSON.stringify(regimeData || {}),
      JSON.stringify(biasOutput || {}),
      JSON.stringify(formulaComponents),
      JSON.stringify(rawContext || {}),
      null,
    ]
  );

  const runId = runResult.lastID;

  for (const asset of Object.keys(biasOutput)) {
    const row = biasOutput[asset];
    const assetNewsContext = buildAssetNewsContext(asset, newsContext, row);
    const assetCalendarContext = buildAssetCalendarContext(asset, calendarContext, eventRisk);
    const assetFormulaComponents = buildAssetFormulaComponents({
      asset,
      row,
      market,
      regimeData,
      eventRisk,
      sourceStatus,
    });

    await runSql(
      insertAssetSql,
      [
        runId,
        asset,
        row.bias,
        row.confidence,
        row.score,
        row.movePoints,
        row.currentPrice,
        row.analysis,
        JSON.stringify(row.reasons || []),
        JSON.stringify(row.drivers || []),
        JSON.stringify(row.sentimentSummary || {}),
        JSON.stringify(row.newsBias || {}),
        JSON.stringify(row.technicalBias || {}),
        JSON.stringify(row.combinedBias || {}),
        JSON.stringify(market || {}),
        JSON.stringify(sessionContext || {}),
        JSON.stringify(sourceStatus || {}),
        JSON.stringify(assetNewsContext || {}),
        JSON.stringify(assetCalendarContext || {}),
        JSON.stringify(eventRisk || {}),
        JSON.stringify(regimeData || {}),
        JSON.stringify(assetFormulaComponents),
        JSON.stringify({
          market,
          newsContext: assetNewsContext,
          calendarContext: assetCalendarContext,
          sourceStatus,
        }),
        null,
        null,
        headlineCount,
        generatedAt,
      ]
    );
  }

  return {
    runId,
    generatedAt,
    loggedAt,
    assetCount: Object.keys(biasOutput).length,
    headlineCount,
    regime: regimeData,
    eventRisk,
  };
}

export function getBiasHistory(asset, limit = 24) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        id,
        asset,
        bias,
        confidence,
        score,
        move_points AS movePoints,
        current_price AS currentPrice,
        analysis,
        reasons_json AS reasonsJson,
        drivers_json AS driversJson,
        sentiment_json AS sentimentJson,
        news_bias_json AS newsBiasJson,
        technical_bias_json AS technicalBiasJson,
        combined_bias_json AS combinedBiasJson,
        market_snapshot_json AS marketSnapshotJson,
        run_id AS runId,
        session_context_json AS sessionContextJson,
        source_status_json AS sourceStatusJson,
        news_context_json AS newsContextJson,
        calendar_context_json AS calendarContextJson,
        event_risk_json AS eventRiskJson,
        regime_json AS regimeJson,
        formula_components_json AS formulaComponentsJson,
        raw_context_json AS rawContextJson,
        evaluation_json AS evaluationJson,
        manual_review_notes AS manualReviewNotes,
        headline_count AS headlineCount,
        generated_at AS generatedAt
      FROM bias_history
      WHERE asset = ?
      ORDER BY id DESC
      LIMIT ?
    `;

    db.all(sql, [asset, limit], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(
        rows.map((row) => ({
          ...row,
          reasons: safeJsonParse(row.reasonsJson, []),
          drivers: safeJsonParse(row.driversJson, []),
          sentimentSummary: safeJsonParse(row.sentimentJson, {}),
          newsBias: safeJsonParse(row.newsBiasJson, null),
          technicalBias: safeJsonParse(row.technicalBiasJson, null),
          combinedBias: safeJsonParse(row.combinedBiasJson, null),
          marketSnapshot: safeJsonParse(row.marketSnapshotJson, null),
          sessionContext: safeJsonParse(row.sessionContextJson, null),
          sourceStatus: safeJsonParse(row.sourceStatusJson, null),
          newsContext: safeJsonParse(row.newsContextJson, null),
          calendarContext: safeJsonParse(row.calendarContextJson, null),
          eventRiskContext: safeJsonParse(row.eventRiskJson, null),
          regimeContext: safeJsonParse(row.regimeJson, null),
          formulaComponents: safeJsonParse(row.formulaComponentsJson, null),
          rawContext: safeJsonParse(row.rawContextJson, null),
          storedEvaluation: safeJsonParse(row.evaluationJson, null),
        }))
      );
    });
  });
}

export function getAllBiasHistory(limit = 48) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        id,
        asset,
        bias,
        confidence,
        score,
        move_points AS movePoints,
        current_price AS currentPrice,
        analysis,
        reasons_json AS reasonsJson,
        drivers_json AS driversJson,
        sentiment_json AS sentimentJson,
        news_bias_json AS newsBiasJson,
        technical_bias_json AS technicalBiasJson,
        combined_bias_json AS combinedBiasJson,
        market_snapshot_json AS marketSnapshotJson,
        run_id AS runId,
        session_context_json AS sessionContextJson,
        source_status_json AS sourceStatusJson,
        news_context_json AS newsContextJson,
        calendar_context_json AS calendarContextJson,
        event_risk_json AS eventRiskJson,
        regime_json AS regimeJson,
        formula_components_json AS formulaComponentsJson,
        raw_context_json AS rawContextJson,
        evaluation_json AS evaluationJson,
        manual_review_notes AS manualReviewNotes,
        headline_count AS headlineCount,
        generated_at AS generatedAt
      FROM bias_history
      ORDER BY id DESC
      LIMIT ?
    `;

    db.all(sql, [limit], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(
        rows.map((row) => ({
          ...row,
          reasons: safeJsonParse(row.reasonsJson, []),
          drivers: safeJsonParse(row.driversJson, []),
          sentimentSummary: safeJsonParse(row.sentimentJson, {}),
          newsBias: safeJsonParse(row.newsBiasJson, null),
          technicalBias: safeJsonParse(row.technicalBiasJson, null),
          combinedBias: safeJsonParse(row.combinedBiasJson, null),
          marketSnapshot: safeJsonParse(row.marketSnapshotJson, null),
          sessionContext: safeJsonParse(row.sessionContextJson, null),
          sourceStatus: safeJsonParse(row.sourceStatusJson, null),
          newsContext: safeJsonParse(row.newsContextJson, null),
          calendarContext: safeJsonParse(row.calendarContextJson, null),
          eventRiskContext: safeJsonParse(row.eventRiskJson, null),
          regimeContext: safeJsonParse(row.regimeJson, null),
          formulaComponents: safeJsonParse(row.formulaComponentsJson, null),
          rawContext: safeJsonParse(row.rawContextJson, null),
          storedEvaluation: safeJsonParse(row.evaluationJson, null),
        }))
      );
    });
  });
}

export function getLatestRowsPerAsset() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT h1.*
      FROM bias_history h1
      INNER JOIN (
        SELECT asset, MAX(id) AS max_id
        FROM bias_history
        GROUP BY asset
      ) h2
      ON h1.asset = h2.asset AND h1.id = h2.max_id
      ORDER BY h1.asset ASC
    `;

    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(
        rows.map((row) => ({
          id: row.id,
          asset: row.asset,
          bias: row.bias,
          confidence: row.confidence,
          score: row.score,
          movePoints: row.move_points,
          currentPrice: row.current_price,
          analysis: row.analysis,
          reasons: safeJsonParse(row.reasons_json, []),
          drivers: safeJsonParse(row.drivers_json, []),
          sentimentSummary: safeJsonParse(row.sentiment_json, {}),
          newsBias: safeJsonParse(row.news_bias_json, null),
          technicalBias: safeJsonParse(row.technical_bias_json, null),
          combinedBias: safeJsonParse(row.combined_bias_json, null),
          marketSnapshot: safeJsonParse(row.market_snapshot_json, null),
          runId: row.run_id,
          sessionContext: safeJsonParse(row.session_context_json, null),
          sourceStatus: safeJsonParse(row.source_status_json, null),
          newsContext: safeJsonParse(row.news_context_json, null),
          calendarContext: safeJsonParse(row.calendar_context_json, null),
          eventRiskContext: safeJsonParse(row.event_risk_json, null),
          regimeContext: safeJsonParse(row.regime_json, null),
          formulaComponents: safeJsonParse(row.formula_components_json, null),
          rawContext: safeJsonParse(row.raw_context_json, null),
          storedEvaluation: safeJsonParse(row.evaluation_json, null),
          headlineCount: row.headline_count,
          generatedAt: row.generated_at,
        }))
      );
    });
  });
}

export function getSystemStats() {
  return new Promise((resolve, reject) => {
    const stats = {
      biasHistoryRows: 0,
      biasRunRows: 0,
    };

    db.get(`SELECT COUNT(*) AS count FROM bias_history`, [], (historyErr, historyRow) => {
      if (historyErr) {
        reject(historyErr);
        return;
      }

      stats.biasHistoryRows = historyRow?.count ?? 0;

      db.get(`SELECT COUNT(*) AS count FROM bias_runs`, [], (runsErr, runsRow) => {
        if (runsErr) {
          reject(runsErr);
          return;
        }

        stats.biasRunRows = runsRow?.count ?? 0;
        resolve(stats);
      });
    });
  });
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function runSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        lastID: this.lastID,
        changes: this.changes,
      });
    });
  });
}

function getSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row);
    });
  });
}

function allSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows);
    });
  });
}

async function seedCoreWatchlistItems() {
  const row = await getSql(`SELECT COUNT(*) AS count FROM watchlist_items`);

  if ((row?.count ?? 0) > 0) {
    return;
  }

  for (const item of coreWatchlistItems) {
    await addWatchlistItem(item);
  }
}

async function getWatchlistItem(id) {
  const row = await getSql(
    `
      SELECT
        id,
        symbol,
        display_name AS displayName,
        asset_class AS assetClass,
        provider,
        provider_symbol AS providerSymbol,
        enabled,
        sort_order AS sortOrder,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM watchlist_items
      WHERE id = ?
    `,
    [id]
  );

  return row ? normalizeWatchlistRow(row) : null;
}

function normalizeWatchlistInput(input = {}) {
  const symbol = String(input.symbol ?? "").trim().toUpperCase();
  const displayName = String(input.displayName ?? input.symbol ?? "").trim();
  const assetClass = String(input.assetClass ?? "").trim().toLowerCase();
  const provider = String(input.provider ?? "").trim().toLowerCase();
  const providerSymbol = String(input.providerSymbol ?? "").trim();

  if (!symbol || !assetClass || !provider || !providerSymbol) {
    const error = new Error("symbol, assetClass, provider, and providerSymbol are required");
    error.statusCode = 400;
    throw error;
  }

  if (!supportedAssetClasses.has(assetClass)) {
    const error = new Error("Unsupported assetClass");
    error.statusCode = 400;
    throw error;
  }

  if (!supportedProviders.has(provider)) {
    const error = new Error("Unsupported provider");
    error.statusCode = 400;
    throw error;
  }

  return {
    symbol,
    displayName,
    assetClass,
    provider,
    providerSymbol,
    enabled: input.enabled === undefined ? true : Boolean(input.enabled),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 100,
  };
}

function normalizeWatchlistRow(row = {}) {
  return {
    ...row,
    enabled: Boolean(row.enabled),
    sortOrder: row.sortOrder ?? 0,
  };
}

function buildFormulaComponents(biasOutput = {}, regimeData = null, eventRisk = null) {
  return Object.fromEntries(
    Object.entries(biasOutput).map(([asset, row]) => [
      asset,
      buildAssetFormulaComponents({
        asset,
        row,
        regimeData,
        eventRisk,
      }),
    ])
  );
}

function buildAssetFormulaComponents({
  asset,
  row = {},
  market = null,
  regimeData = null,
  eventRisk = null,
  sourceStatus = null,
}) {
  const combined = row.combinedBias ?? {};

  return {
    asset,
    scoringModel: "deterministic_news_plus_technical_plus_confluence",
    final: {
      bias: row.bias,
      confidence: row.confidence,
      score: row.score,
      expectedMove: row.movePoints,
    },
    components: {
      newsScore: combined.newsScore ?? row.newsBias?.score ?? 0,
      technicalScore: combined.technicalScore ?? row.technicalBias?.score ?? 0,
      combinedScore: combined.score ?? row.score,
      crossAssetConfluence: extractCrossAssetConfluence(row.combinedBias?.reasons),
      eventRiskLevel: eventRisk?.level ?? row.eventRisk?.level ?? null,
      eventRiskScore: eventRisk?.score ?? row.eventRisk?.score ?? null,
      confidencePenalty: eventRisk?.confidencePenalty ?? null,
      moveMultiplier: eventRisk?.moveMultiplier ?? null,
      macroRegime: regimeData?.regime ?? row.regime ?? null,
      regimeConfidence: regimeData?.confidence ?? row.regimeConfidence ?? null,
    },
    technicalComponents: row.technicalBias?.components ?? [],
    technicalContext: row.technicalBias?.context ?? null,
    newsComponents: row.newsBias?.matchedHeadlines ?? [],
    marketFlowSnapshot: row.flow ?? null,
    newsFlowRelationship: row.newsFlowRelationship ?? null,
    optionsPressureSnapshot: row.optionsPressure ?? null,
    confluence: row.confluence ?? null,
    trendState: row.trendState ?? null,
    edgeScore: row.edgeScore ?? null,
    watchReasons: row.watchReasons ?? [],
    avoidReasons: row.avoidReasons ?? [],
    formulas: {
      combinedBias: "scoreToBias(newsScore + technicalScore + crossAssetConfluence)",
      advancedConfluence:
        "weighted marketFlow + technicalBias + macroRegime + newsFlowRelationship + optionsPressure - eventRiskAdjustment",
      confidence:
        "scoreToConfidence(combinedScore, reasonCount) - eventRisk.confidencePenalty",
      expectedMove:
        "abs(combinedScore) * (currentPrice * 0.0005) * eventRisk.moveMultiplier",
    },
    reasons: row.combinedBias?.reasons ?? row.reasons ?? [],
    marketSnapshot: market,
    sourceStatus,
  };
}

function buildAssetNewsContext(asset, newsContext = null, row = {}) {
  const matchedTitles = new Set(
    (row.newsBias?.matchedHeadlines ?? []).map((headline) => headline.title)
  );
  const relevantItems = (newsContext?.items ?? []).filter((item) =>
    matchedTitles.has(item.title)
  );

  return {
    sourceStatus: newsContext?.sources ?? [],
    fetchedAt: newsContext?.generatedAt ?? null,
    headlineCount: newsContext?.count ?? relevantItems.length,
    matchedHeadlines: row.newsBias?.matchedHeadlines ?? [],
    relevantHeadlines: relevantItems,
    newsBias: row.newsBias ?? null,
    sentimentSummary: row.sentimentSummary ?? null,
    asset,
  };
}

function buildAssetCalendarContext(asset, calendarContext = null, eventRisk = null) {
  const events = (calendarContext?.events ?? []).map((event) => ({
    ...event,
    relatedAssets: inferCalendarRelatedAssets(event),
    hoursUntil:
      event?.datetime
        ? (new Date(event.datetime).getTime() - Date.now()) / 3600000
        : null,
  }));

  return {
    asset,
    source: calendarContext?.source ?? null,
    generatedAt: calendarContext?.generatedAt ?? null,
    events,
    eventRisk,
  };
}

function inferCalendarRelatedAssets(event = {}) {
  const currency = String(event.currency ?? "").toUpperCase();

  if (currency === "USD") return ["ES", "NQ", "YM", "GOLD", "DXY", "USOIL"];
  if (["EUR", "GBP", "JPY"].includes(currency)) return ["DXY", "GOLD", "ES", "NQ"];
  if (currency === "CAD") return ["DXY", "USOIL", "GOLD"];
  return ["ES", "NQ", "GOLD", "DXY"];
}

function extractCrossAssetConfluence(reasons = []) {
  const reason = (reasons ?? []).find((item) =>
    String(item?.text ?? "").startsWith("cross-asset confluence adjustment")
  );

  return reason?.weight
    ? reason.direction === "negative"
      ? -Math.abs(reason.weight)
      : Math.abs(reason.weight)
    : 0;
}
