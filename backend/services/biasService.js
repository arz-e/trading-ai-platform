import {
  assetRelevanceRules,
  assetRules,
  impactCategoryRules,
} from "../config/constants.js";
import { computeEventRisk } from "./calendarService.js";
import { detectMacroRegime } from "./regimeService.js";
import {
  analyzeHeadlineSentiment,
  buildSentimentSummary,
} from "./sentimentService.js";
import {
  buildAnalysisPayload,
  generateAssetAnalysis,
  summarizeDrivers,
} from "./aiService.js";
import { buildConfluenceForAsset } from "./confluenceService.js";
import { buildMarketFlowSnapshot, flowRowForAsset } from "./flowService.js";
import { compareNewsToFlow } from "./newsFlowService.js";
import { buildOptionsPressureSnapshot, optionsPressureForAsset } from "./pressureService.js";
import { expectedMoveFromAtr } from "./atrService.js";
import { buildSessionContext, buildSessionProjection } from "./sessionService.js";
import { buildPreviousSessionReversal } from "./reversalService.js";
import { analyzeCvd } from "./cvdService.js";
import { analyzeGex } from "./gexService.js";
import { crossAssetAdjustments, scoreToBias, scoreToConfidence } from "../utils/scoring.js";
import { containsKeyword } from "../utils/textMatching.js";

export async function buildBiasEngine(
  market = {},
  news = [],
  calendarEvents = [],
  atrSnapshots = {},
  marketStructureInputs = {}
) {
  const generatedAt = new Date().toISOString();
  const sessionContext = buildSessionContext(generatedAt);
  const regime = detectMacroRegime(market);
  const eventRisk = computeEventRisk(calendarEvents);
  const sentimentItems = analyzeHeadlineSentiment(news);
  const sentiment = buildSentimentSummary(sentimentItems);
  const marketFlow = buildMarketFlowSnapshot(market, news, calendarEvents);
  const optionsPressureSnapshot = buildOptionsPressureSnapshot(Object.keys(assetRules), market);
  const output = {};

  for (const asset in assetRules) {
    const newsBias = buildNewsBias(asset, news);
    const technicalBias = buildTechnicalBias(asset, market, regime);
    const combined = combineBiasSignals({
      asset,
      newsBias,
      technicalBias,
      market,
      regime,
      eventRisk,
    });
    const price = market[asset]?.price ?? null;
    const atrSnapshot = atrSnapshots[asset] ?? null;
    const reversal = buildPreviousSessionReversal({
      market: market[asset],
      atrSnapshot,
    });
    const structureInput = marketStructureInputs[asset] ?? {};
    const cvd = analyzeCvd({
      ticker: asset,
      candles: structureInput.candleData?.candles ?? [],
      stale: Boolean(structureInput.candleData?.stale),
    });
    const gex = analyzeGex({
      ticker: asset,
      spotPrice: price,
      optionsData: structureInput.optionsData ?? {
        status: "UNAVAILABLE",
        error: "Ticker-specific options data was not requested.",
      },
      riskFreeRate: resolveRiskFreeRate(market),
    });
    const rawMovePoints = null;
    const drivers = summarizeDrivers(combined.reasons);
    const sentimentSummary = buildAssetSentimentSummary(asset, sentimentItems);
    const flow = flowRowForAsset(marketFlow, asset);
    const newsFlowRelationship = compareNewsToFlow(news, marketFlow, asset);
    const optionsPressure = optionsPressureForAsset(optionsPressureSnapshot, asset);
    const legacyOutput = {
      bias: combined.bias,
      confidence: combined.confidence,
      score: combined.score,
      movePoints: rawMovePoints,
      currentPrice: price,
      newsBias,
      technicalBias,
      combinedBias: combined,
      regime: regime.regime,
      regimeConfidence: regime.confidence,
      eventRisk,
      drivers,
      sentimentSummary,
    };
    const confluence = buildConfluenceForAsset({
      asset,
      currentBiasOutput: legacyOutput,
      marketFlow: flow,
      newsFlowRelationship,
      regime,
      eventRisk,
      optionsPressure,
      gex,
      cvd,
      reversal,
    });
    const reversalWithConfluence = {
      ...reversal,
      confluenceScore: confluence.confluenceBreakdown.finalReversalConfluence,
      confluenceNotes: confluence.confluenceBreakdown.notes,
    };
    const sessionProjection = buildSessionProjection({
      bias: confluence.finalBias,
      confidence: confluence.confidence,
      trendState: confluence.trendState,
      sessionContext,
    });
    const finalMovePoints = expectedMoveFromAtr(atrSnapshot);
    const expectedMoveBasis = buildExpectedMoveBasis({
      asset,
      rawBiasScore: combined.score,
      confluenceScore: confluence.edgeScore,
      atrSnapshot,
      finalMovePoints,
    });
    const analysisPayload = buildAnalysisPayload({
      asset,
      bias: confluence.finalBias,
      confidence: confluence.confidence,
      score: confluence.edgeScore,
      movePoints: finalMovePoints,
      currentPrice: price,
      atr: atrSnapshot?.atr ?? null,
      regime: regime.regime,
      regimeConfidence: regime.confidence,
      eventRisk,
      drivers,
      sentimentSummary,
      market,
    });

    output[asset] = {
      bias: confluence.finalBias,
      confidence: confluence.confidence,
      score: confluence.edgeScore,
      displayScore: confluence.edgeScore,
      rawBiasScore: combined.score,
      legacyScore: combined.score,
      confluenceScore: confluence.edgeScore,
      edgeScore: confluence.edgeScore,
      movePoints: finalMovePoints,
      rawMovePoints,
      expectedMoveBasis,
      expectedMoveAvailable: finalMovePoints !== null,
      currentPrice: price,
      newsBias,
      technicalBias,
      combinedBias: combined,
      regime: regime.regime,
      regimeConfidence: regime.confidence,
      eventRisk,
      drivers,
      sentimentSummary,
      analysis: generateAssetAnalysis(analysisPayload),
      reasons: combined.reasons.map((reason) => reason.text),
      flow,
      newsFlowRelationship,
      optionsPressure,
      confluence,
      trendState: confluence.trendState,
      sessionProjection,
      reversal: reversalWithConfluence,
      gex,
      cvd,
      confluenceBreakdown: confluence.confluenceBreakdown,
      watchReasons: confluence.watchReasons,
      avoidReasons: confluence.avoidReasons,
      lastUpdated: generatedAt,
    };
  }

  return {
    regime,
    eventRisk,
    sentiment,
    marketFlow,
    optionsPressure: optionsPressureSnapshot,
    atrSnapshots,
    sessionContext,
    marketStructureInputs,
    assets: output,
  };
}

function resolveRiskFreeRate(market) {
  const yieldPercent = market?.US10Y?.price;
  return typeof yieldPercent === "number" && Number.isFinite(yieldPercent)
    ? Math.max(0, yieldPercent / 100)
    : 0.04;
}

function buildNewsBias(asset, news = []) {
  const rules = assetRules[asset] ?? { positive: [], negative: [] };
  let score = 0;
  let hitCount = 0;
  let weightedHitCount = 0;
  const matchedHeadlines = [];
  const reasons = [];

  for (const item of news) {
    const text = `${item.title} ${item.contentSnippet}`.toLowerCase();
    const headlineMatches = [];
    const sourceWeight = resolveNewsSourceWeight(item.source);
    const categoryMatch = resolveNewsCategoryMatch(text);
    const categoryWeight = resolveNewsCategoryWeight(categoryMatch?.category, asset);
    const assetRelevanceWeight = resolveAssetRelevanceWeight(asset, text);

    for (const word of rules.positive) {
      if (containsKeyword(text, word)) {
        const contribution = roundNewsScore(
          1 * sourceWeight * categoryWeight * assetRelevanceWeight
        );
        score = roundNewsScore(score + contribution);
        hitCount++;
        weightedHitCount = roundNewsScore(weightedHitCount + Math.abs(contribution));
        headlineMatches.push({
          keyword: word,
          direction: "positive",
          sourceWeight,
          category: categoryMatch?.category ?? "GENERAL",
          categoryWeight,
          assetRelevanceWeight,
          contribution,
        });
        reasons.push({
          text: `positive weighted headline signal: "${word}"`,
          direction: "positive",
          weight: Math.abs(contribution),
        });
      }
    }

    for (const word of rules.negative) {
      if (containsKeyword(text, word)) {
        const contribution = roundNewsScore(
          -1 * sourceWeight * categoryWeight * assetRelevanceWeight
        );
        score = roundNewsScore(score + contribution);
        hitCount++;
        weightedHitCount = roundNewsScore(weightedHitCount + Math.abs(contribution));
        headlineMatches.push({
          keyword: word,
          direction: "negative",
          sourceWeight,
          category: categoryMatch?.category ?? "GENERAL",
          categoryWeight,
          assetRelevanceWeight,
          contribution,
        });
        reasons.push({
          text: `negative weighted headline signal: "${word}"`,
          direction: "negative",
          weight: Math.abs(contribution),
        });
      }
    }

    if (headlineMatches.length > 0) {
      matchedHeadlines.push({
        title: item.title,
        source: item.source,
        pubDate: item.pubDate,
        link: item.link,
        sourceWeight,
        category: categoryMatch?.category ?? "GENERAL",
        categoryWeight,
        assetRelevanceWeight,
        matches: headlineMatches,
      });
    }
  }

  return {
    bias: scoreToBias(score),
    confidence: scoreToConfidence(score, weightedHitCount),
    score,
    hitCount,
    weightedHitCount,
    matchedHeadlines,
    reasons,
  };
}

function resolveNewsSourceWeight(source) {
  const value = String(source ?? "");

  if (/reuters|bloomberg|cnbc|financial times|ft\.com|wall street journal|wsj|marketwatch|federal reserve|fed/i.test(value)) {
    return 1;
  }

  if (/yahoo|investing\.com|trading economics|marketpulse/i.test(value)) {
    return 0.6;
  }

  return 0.3;
}

function resolveNewsCategoryMatch(text) {
  return impactCategoryRules.find((rule) =>
    rule.keywords.some((keyword) => containsKeyword(text, keyword))
  );
}

function resolveNewsCategoryWeight(category = "GENERAL", asset) {
  const highImpact = [
    "CENTRAL_BANK",
    "INFLATION",
    "LABOR",
    "GEOPOLITICS",
    "TRADE_POLICY",
    "ENERGY",
    "BANKING_STRESS",
  ];

  if (category === "EARNINGS") {
    return asset === "NQ" ? 0.75 : 0.45;
  }

  if (category === "ENERGY") {
    return asset === "USOIL" ? 1.35 : 1.1;
  }

  if (highImpact.includes(category)) {
    return 1.25;
  }

  return 0.55;
}

function resolveAssetRelevanceWeight(asset, text) {
  const relevance = assetRelevanceRules[asset] ?? [];
  const matched = relevance.some((keyword) => containsKeyword(text, keyword));
  return matched ? 1 : 0.65;
}

function roundNewsScore(value) {
  return Number(Number(value).toFixed(2));
}

function buildTechnicalBias(asset, market = {}, regime = {}) {
  let score = 0;
  const reasons = [];
  const components = [];
  const assetMove = market[asset]?.percent ?? 0;
  const esMove = market.ES?.percent ?? 0;
  const nqMove = market.NQ?.percent ?? 0;
  const ymMove = market.YM?.percent ?? 0;
  const dxyMove = market.DXY?.percent ?? 0;
  const oilMove = market.USOIL?.percent ?? 0;
  const goldMove = market.GOLD?.percent ?? 0;
  const vixMove = market.VIX?.percent ?? 0;
  const us10yMove = market.US10Y?.percent ?? 0;
  const context = buildTechnicalContext({
    asset,
    market,
    regime,
    snapshot: {
      assetPercent: assetMove,
      ES: esMove,
      NQ: nqMove,
      YM: ymMove,
      DXY: dxyMove,
      USOIL: oilMove,
      GOLD: goldMove,
      VIX: vixMove,
      US10Y: us10yMove,
    },
  });

  if (assetMove >= 0.35) {
    addTechnicalScore(1, "asset intraday momentum is positive", "positive", {
      key: "asset_momentum_positive",
      label: `${asset} positive intraday momentum`,
      rawValue: assetMove,
      threshold: ">= 0.35%",
    });
  }
  if (assetMove <= -0.35) {
    addTechnicalScore(-1, "asset intraday momentum is negative", "negative", {
      key: "asset_momentum_negative",
      label: `${asset} negative intraday momentum`,
      rawValue: assetMove,
      threshold: "<= -0.35%",
    });
  }

  if (asset === "ES" || asset === "NQ" || asset === "YM") {
    if (vixMove > 2) {
      addTechnicalScore(-1, "rising VIX pressures equity risk", "negative", {
        key: "equity_vix_pressure",
        label: "VIX risk pressure",
        rawValue: vixMove,
        threshold: "> 2%",
      });
    }
    if (dxyMove > 0.25) {
      addTechnicalScore(-1, "dollar momentum is a headwind for equities", "negative", {
        key: "equity_dxy_headwind",
        label: "Dollar headwind",
        rawValue: dxyMove,
        threshold: "> 0.25%",
      });
    }
    if (oilMove > 1) {
      addTechnicalScore(-1, "oil shock adds inflation pressure to equities", "negative", {
        key: "equity_oil_inflation_pressure",
        label: "Oil inflation pressure",
        rawValue: oilMove,
        threshold: "> 1%",
      });
    }
    if (esMove > 0.35 && nqMove > 0.45) {
      addTechnicalScore(1, "broad equity futures momentum is positive", "positive", {
        key: "equity_broad_momentum_positive",
        label: "ES/NQ aligned positive momentum",
        rawValue: { ES: esMove, NQ: nqMove, YM: ymMove },
        threshold: "ES > 0.35% and NQ > 0.45%",
      });
    }
  }

  if (asset === "NQ" && us10yMove > 0.8) {
    addTechnicalScore(-1, "rising yields pressure long-duration tech", "negative", {
      key: "nq_yield_pressure",
      label: "US10Y tech duration pressure",
      rawValue: us10yMove,
      threshold: "> 0.8%",
    });
  }

  if (asset === "GOLD") {
    if (dxyMove > 0.25) {
      addTechnicalScore(-1, "stronger dollar limits upside for gold", "negative", {
        key: "gold_dxy_headwind",
        label: "Dollar headwind for gold",
        rawValue: dxyMove,
        threshold: "> 0.25%",
      });
    }
    if (vixMove > 2 || esMove < -0.4) {
      addTechnicalScore(1, "defensive rotation supports gold", "positive", {
        key: "gold_defensive_rotation",
        label: "Defensive rotation",
        rawValue: { VIX: vixMove, ES: esMove },
        threshold: "VIX > 2% or ES < -0.4%",
      });
    }
  }

  if (asset === "DXY") {
    if (us10yMove > 0.6) {
      addTechnicalScore(1, "higher US10Y supports dollar strength", "positive", {
        key: "dxy_yield_support",
        label: "US10Y dollar support",
        rawValue: us10yMove,
        threshold: "> 0.6%",
      });
    }
    if (vixMove > 2) {
      addTechnicalScore(1, "risk-off tape supports dollar demand", "positive", {
        key: "dxy_risk_off_support",
        label: "Risk-off dollar demand",
        rawValue: vixMove,
        threshold: "> 2%",
      });
    }
  }

  if (asset === "USOIL") {
    if (oilMove > 0.75) {
      addTechnicalScore(1, "oil momentum is positive", "positive", {
        key: "oil_momentum_positive",
        label: "Oil positive momentum",
        rawValue: oilMove,
        threshold: "> 0.75%",
      });
    }
    if (esMove < -0.5 && nqMove < -0.7) {
      addTechnicalScore(-1, "equity stress points to demand risk for oil", "negative", {
        key: "oil_equity_demand_risk",
        label: "Equity stress demand risk",
        rawValue: { ES: esMove, NQ: nqMove },
        threshold: "ES < -0.5% and NQ < -0.7%",
      });
    }
  }

  if (regime.regime && regime.regime !== "MIXED") {
    const regimeAdjustment = getRegimeAdjustment(asset, regime.regime);
    if (regimeAdjustment !== 0) {
      addTechnicalScore(
        regimeAdjustment,
        `macro regime adjustment (${regime.regime})`,
        regimeAdjustment > 0 ? "positive" : "negative",
        {
          key: "macro_regime_adjustment",
          label: `Macro regime ${regime.regime}`,
          rawValue: regime.regime,
          threshold: "regime-adjustment matrix",
        }
      );
    }
  }

  return {
    bias: scoreToBias(score),
    confidence: scoreToConfidence(score, reasons.length),
    score,
    reasons,
    components,
    context,
    snapshot: {
      assetPercent: assetMove,
      ES: esMove,
      NQ: nqMove,
      YM: ymMove,
      DXY: dxyMove,
      USOIL: oilMove,
      GOLD: goldMove,
      VIX: vixMove,
      US10Y: us10yMove,
    },
  };

  function addTechnicalScore(delta, text, direction, component = {}) {
    score += delta;
    reasons.push({ text, direction, weight: Math.abs(delta) });
    components.push({
      key: component.key ?? text.toLowerCase().replaceAll(" ", "_"),
      label: component.label ?? text,
      direction,
      weight: Math.abs(delta),
      contribution: delta,
      rawValue: component.rawValue ?? null,
      threshold: component.threshold ?? null,
      explanation: text,
    });
  }
}

function buildTechnicalContext({ asset, market = {}, regime = {}, snapshot = {} }) {
  const equityMoves = {
    ES: snapshot.ES ?? 0,
    NQ: snapshot.NQ ?? 0,
    YM: snapshot.YM ?? 0,
  };
  const alignedEquityDirection = resolveAlignedDirection(Object.values(equityMoves));

  return {
    asset,
    macroRegime: regime.regime ?? "MIXED",
    regimeConfidence: regime.confidence ?? null,
    snapshot,
    assetMomentum: classifyMove(snapshot.assetPercent),
    equityAlignment: {
      ...equityMoves,
      direction: alignedEquityDirection,
      note: "ES, NQ, and YM usually share direction, but divergence is preserved for review.",
    },
    riskInputs: {
      vixPressure: classifyMove(snapshot.VIX, 2),
      dollarPressure: classifyMove(snapshot.DXY, 0.25),
      ratesPressure: classifyMove(snapshot.US10Y, 0.6),
      oilShock: classifyMove(snapshot.USOIL, 1),
      goldContext: classifyMove(snapshot.GOLD, 0.35),
    },
    staleFlags: Object.fromEntries(
      Object.entries(market).map(([symbol, row]) => [symbol, buildMarketDataFlags(row)])
    ),
  };
}

function resolveAlignedDirection(values = []) {
  const positives = values.filter((value) => value > 0).length;
  const negatives = values.filter((value) => value < 0).length;

  if (positives >= 2) return "positive";
  if (negatives >= 2) return "negative";
  return "mixed";
}

function classifyMove(value = 0, threshold = 0.35) {
  if (value >= threshold) return "positive";
  if (value <= -threshold) return "negative";
  return "neutral";
}

function buildMarketDataFlags(row = {}) {
  const timestamp = row.timestamp ? new Date(row.timestamp) : null;
  const ageMinutes =
    timestamp && Number.isFinite(timestamp.getTime())
      ? Math.round((Date.now() - timestamp.getTime()) / 60000)
      : null;

  return {
    missingPrice: typeof row.price !== "number",
    missingPercent: typeof row.percent !== "number",
    malformedTimestamp: Boolean(row.timestamp) && !Number.isFinite(timestamp?.getTime()),
    staleTimestamp: typeof ageMinutes === "number" ? ageMinutes > 30 : true,
    ageMinutes,
    sourceTimestamp: row.timestamp ?? null,
  };
}

function combineBiasSignals({ asset, newsBias, technicalBias, market, regime, eventRisk }) {
  const cross = crossAssetAdjustments(asset, market);
  const reasons = [...newsBias.reasons, ...technicalBias.reasons];
  let score = newsBias.score + technicalBias.score + cross;

  if (cross !== 0) {
    reasons.push({
      text: `cross-asset confluence adjustment: ${cross}`,
      direction: cross > 0 ? "positive" : "negative",
      weight: Math.abs(cross),
    });
  }

  if (eventRisk?.score > 0) {
    reasons.push({
      text: `event risk: ${eventRisk.level}`,
      direction: "neutral",
      weight: eventRisk.score,
    });
  }

  const rawConfidence = scoreToConfidence(score, reasons.length);
  const confidence = Math.max(35, rawConfidence - (eventRisk?.confidencePenalty ?? 0));

  return {
    bias: scoreToBias(score),
    confidence,
    score,
    newsScore: newsBias.score,
    technicalScore: technicalBias.score,
    regime: regime.regime,
    eventRiskLevel: eventRisk?.level ?? "LOW",
    reasons,
  };
}

function buildExpectedMoveBasis({
  asset,
  rawBiasScore,
  confluenceScore,
  atrSnapshot = null,
  finalMovePoints,
}) {
  const available = typeof finalMovePoints === "number" && finalMovePoints > 0;

  return {
    asset,
    basis: "ATR",
    model: "average_true_range",
    status: available ? "OK" : "UNAVAILABLE",
    displayScoreField: "score",
    rawBiasScore,
    legacyScore: rawBiasScore,
    confluenceScore,
    edgeScore: confluenceScore,
    source: atrSnapshot?.source ?? "Yahoo Finance chart",
    interval: atrSnapshot?.interval ?? "1d",
    horizon: atrSnapshot?.horizon ?? "1 trading session",
    lookbackSessions: atrSnapshot?.lookbackSessions ?? null,
    atr: atrSnapshot?.atr ?? null,
    candleCount: atrSnapshot?.candleCount ?? 0,
    asOf: atrSnapshot?.asOf ?? null,
    fetchedAt: atrSnapshot?.fetchedAt ?? null,
    unavailableReason: available ? null : atrSnapshot?.error ?? "ATR data unavailable.",
    finalMovePoints,
    formula: available ? "ATR(14 daily trading sessions)" : null,
    eventRiskEffect: "Event risk can reduce confidence but does not alter the ATR range.",
  };
}

function buildAssetSentimentSummary(asset, sentimentItems = []) {
  const relevant = sentimentItems.filter((item) =>
    Array.isArray(item.impactedAssets) && item.impactedAssets.includes(asset)
  );

  const totalScore = relevant.reduce((sum, item) => sum + (item.sentimentScore ?? 0), 0);
  const averageSentimentScore =
    relevant.length > 0 ? Number((totalScore / relevant.length).toFixed(2)) : 0;

  return {
    relevantHeadlineCount: relevant.length,
    averageSentimentScore,
    weightedBias:
      averageSentimentScore > 0
        ? "positive"
        : averageSentimentScore < 0
          ? "negative"
          : "neutral",
    headlines: relevant.slice(0, 5).map((item) => ({
      title: item.title,
      sentimentLabel: item.sentimentLabel,
      sentimentScore: item.sentimentScore,
      source: item.source,
      pubDate: item.pubDate,
    })),
  };
}

function getRegimeAdjustment(asset, regime) {
  const equityAssets = ["ES", "NQ", "YM"];

  if (regime === "RISK_ON") {
    if (equityAssets.includes(asset) || asset === "USOIL") return 1;
    if (asset === "GOLD" || asset === "DXY") return -1;
  }

  if (regime === "RISK_OFF" || regime === "LIQUIDITY_TIGHTENING") {
    if (equityAssets.includes(asset) || asset === "USOIL") return -1;
    if (asset === "GOLD" || asset === "DXY") return 1;
  }

  if (regime === "INFLATION_PRESSURE") {
    if (asset === "USOIL" || asset === "DXY") return 1;
    if (asset === "NQ") return -1;
  }

  return 0;
}
