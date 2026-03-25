import sqlite3 from "sqlite3";

const DB_PATH = "./data/trading_ai.db";

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
      market_snapshot_json TEXT,
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
      next_event_title TEXT
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

  db.run(`ALTER TABLE bias_history ADD COLUMN drivers_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_history ADD COLUMN sentiment_json TEXT`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN event_risk_level TEXT`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN event_risk_score REAL`, () => {});
  db.run(`ALTER TABLE bias_runs ADD COLUMN next_event_title TEXT`, () => {});
}

export function logBiasRun({
  biasOutput,
  market,
  headlineCount,
  generatedAt,
  regimeData,
  eventRisk,
}) {
  const insertAssetSql = `
    INSERT INTO bias_history (
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
      market_snapshot_json,
      headline_count,
      generated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      next_event_title
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
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
    ],
    (err) => {
      if (err) {
        console.error("Failed to log bias run summary:", err.message);
      }
    }
  );

  for (const asset of Object.keys(biasOutput)) {
    const row = biasOutput[asset];

    db.run(
      insertAssetSql,
      [
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
        JSON.stringify(market || {}),
        headlineCount,
        generatedAt,
      ],
      (err) => {
        if (err) {
          console.error(`Failed to log bias row for ${asset}:`, err.message);
        }
      }
    );
  }
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
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}