/*
  Dashboard Service

  Converts raw engine outputs into frontend-ready structures.
*/

export function buildDashboardSnapshot({
  market = {},
  bias = {},
  regime = null,
  eventRisk = null,
  sentiment = null,
  newsImpact = null,
  marketFlow = null,
  optionsPressure = null,
  generatedAt = null,
}) {
  const assets = Object.keys(bias).map((asset) => {
    const assetBias = bias[asset] ?? {};
    const assetMarket = market[asset] ?? {};

    return {
      asset,

      price: assetMarket.price ?? null,
      change: assetMarket.change ?? null,
      percent: assetMarket.percent ?? null,

      bias: assetBias.bias ?? "Neutral",
      confidence: assetBias.confidence ?? 0,
      score: assetBias.score ?? 0,
      displayScore: assetBias.displayScore ?? assetBias.score ?? 0,
      rawBiasScore: assetBias.rawBiasScore ?? assetBias.combinedBias?.score ?? null,
      legacyScore: assetBias.legacyScore ?? assetBias.rawBiasScore ?? assetBias.combinedBias?.score ?? null,
      confluenceScore: assetBias.confluenceScore ?? assetBias.edgeScore ?? assetBias.confluence?.edgeScore ?? null,
      movePoints: assetBias.movePoints ?? 0,
      rawMovePoints: assetBias.rawMovePoints ?? null,
      expectedMoveBasis: assetBias.expectedMoveBasis ?? null,
      newsBias: assetBias.newsBias ?? null,
      technicalBias: assetBias.technicalBias ?? null,
      combinedBias: assetBias.combinedBias ?? null,
      flow: assetBias.flow ?? null,
      newsFlowRelationship: assetBias.newsFlowRelationship ?? null,
      optionsPressure: assetBias.optionsPressure ?? null,
      confluence: assetBias.confluence ?? null,
      trendState: assetBias.trendState ?? null,
      edgeScore: assetBias.edgeScore ?? null,
      watchReasons: assetBias.watchReasons ?? [],
      avoidReasons: assetBias.avoidReasons ?? [],

      regime: assetBias.regime ?? regime?.regime ?? null,
      regimeConfidence: assetBias.regimeConfidence ?? regime?.confidence ?? null,

      drivers: Array.isArray(assetBias.drivers) ? assetBias.drivers : [],

      eventRisk: assetBias.eventRisk ?? {
        level: eventRisk?.level ?? "LOW",
        score: eventRisk?.score ?? 0,
        nextEvent: eventRisk?.nextEvent ?? null,
      },

      analysis: assetBias.analysis ?? "",

      lastUpdated: assetBias.lastUpdated ?? generatedAt,
    };
  });

  return {
    generatedAt,

    regime,

    eventRisk,

    sentimentSummary: buildCompactSentimentSummary(sentiment),

    newsImpactSummary: buildCompactNewsImpactSummary(newsImpact),

    marketFlow,

    optionsPressure,

    assets,
  };
}

/*
  Build compact history summary for asset panel
*/
export function buildCompactHistorySummary(historyResponse = {}) {
  const history = Array.isArray(historyResponse.history)
    ? historyResponse.history
    : [];

  const shifts = Array.isArray(historyResponse.shifts)
    ? historyResponse.shifts
    : [];

  return {
    asset: historyResponse.asset ?? null,

    count: history.length,

    latest: history[0] ?? null,

    latestDrivers: history[0]?.drivers ?? [],
    latestNewsBias: history[0]?.newsBias ?? null,
    latestTechnicalBias: history[0]?.technicalBias ?? null,
    latestCombinedBias: history[0]?.combinedBias ?? null,

    latestChange: history[0]?.change ?? null,

    shifts: shifts.slice(-12),

    chartPoints: history
      .slice()
      .reverse()
      .map((row) => ({
        generatedAt: row.generatedAt,
        bias: row.bias,
        confidence: row.confidence,
        score: row.score,
        movePoints: row.movePoints,
      })),
  };
}

/*
  Build latest shift feed
*/
export function buildLatestShiftFeed(historyRows = []) {
  if (!Array.isArray(historyRows) || historyRows.length === 0) {
    return [];
  }

  return historyRows
    .filter((row) => row?.change && !row.change.isInitial)
    .map((row) => ({
      asset: row.asset,

      generatedAt: row.generatedAt,

      bias: row.bias,

      confidence: row.confidence,

      score: row.score,

      previousBias: row.change.previousBias,

      biasChanged: row.change.biasChanged,

      confidenceDelta: row.change.confidenceDelta,

      scoreDelta: row.change.scoreDelta,

      moveDelta: row.change.moveDelta,

      addedDrivers: row.change.addedDrivers ?? [],

      removedDrivers: row.change.removedDrivers ?? [],

      label: buildShiftLabel(row),
    }))
    .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))
    .slice(0, 30);
}

/*
  Build label for UI feed
*/
function buildShiftLabel(row) {
  if (row?.change?.biasChanged) {
    return `${row.asset}: ${row.change.previousBias} → ${row.bias}`;
  }

  const confidenceDelta = row?.change?.confidenceDelta ?? 0;
  const scoreDelta = row?.change?.scoreDelta ?? 0;

  if (Math.abs(confidenceDelta) >= 8) {
    return `${row.asset}: confidence ${
      confidenceDelta > 0 ? "up" : "down"
    } ${Math.abs(confidenceDelta)}`;
  }

  if (Math.abs(scoreDelta) >= 2) {
    return `${row.asset}: score ${
      scoreDelta > 0 ? "up" : "down"
    } ${Math.abs(scoreDelta)}`;
  }

  return `${row.asset}: driver update`;
}

/*
  Sentiment summary for dashboard
*/
function buildCompactSentimentSummary(sentiment) {
  if (!sentiment || typeof sentiment !== "object") {
    return {
      headlineCount: 0,
      items: [],
    };
  }

  return {
    headlineCount: sentiment.headlineCount ?? 0,
    items: Array.isArray(sentiment.items)
      ? sentiment.items.slice(0, 6)
      : [],
  };
}

/*
  News impact summary
*/
function buildCompactNewsImpactSummary(newsImpact) {
  if (!newsImpact || typeof newsImpact !== "object") {
    return {
      headlineCount: 0,
      topAverageImpact: 0,
      topHeadlines: [],
      dominantCategories: [],
      mostImpactedAssets: [],
    };
  }

  return {
    headlineCount: newsImpact.headlineCount ?? 0,

    topAverageImpact: newsImpact.summary?.topAverageImpact ?? 0,

    topHeadlines: Array.isArray(newsImpact.summary?.topHeadlines)
      ? newsImpact.summary.topHeadlines.slice(0, 5)
      : [],

    dominantCategories: Array.isArray(
      newsImpact.summary?.dominantCategories
    )
      ? newsImpact.summary.dominantCategories.slice(0, 4)
      : [],

    mostImpactedAssets: Array.isArray(
      newsImpact.summary?.mostImpactedAssets
    )
      ? newsImpact.summary.mostImpactedAssets.slice(0, 6)
      : [],
  };
}
