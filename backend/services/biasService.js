import { assetRules } from "../config/constants.js";
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
import { crossAssetAdjustments, scoreToBias, scoreToConfidence } from "../utils/scoring.js";
import { containsKeyword } from "../utils/textMatching.js";

export async function buildBiasEngine(market = {}, news = [], calendarEvents = []) {
  const regime = detectMacroRegime(market);
  const eventRisk = computeEventRisk(calendarEvents);
  const sentimentItems = analyzeHeadlineSentiment(news);
  const sentiment = buildSentimentSummary(sentimentItems);
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
    const price = market[asset]?.price ?? 0;
    const movePoints = estimateExpectedMove(asset, price, combined.score, eventRisk);
    const drivers = summarizeDrivers(combined.reasons);
    const sentimentSummary = buildAssetSentimentSummary(asset, sentimentItems);
    const analysisPayload = buildAnalysisPayload({
      asset,
      bias: combined.bias,
      confidence: combined.confidence,
      score: combined.score,
      movePoints,
      currentPrice: price,
      atr: null,
      regime: regime.regime,
      regimeConfidence: regime.confidence,
      eventRisk,
      drivers,
      sentimentSummary,
      market,
    });

    output[asset] = {
      bias: combined.bias,
      confidence: combined.confidence,
      score: combined.score,
      movePoints,
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
      lastUpdated: new Date().toISOString(),
    };
  }

  return {
    regime,
    eventRisk,
    sentiment,
    assets: output,
  };
}

function buildNewsBias(asset, news = []) {
  const rules = assetRules[asset] ?? { positive: [], negative: [] };
  let score = 0;
  let hitCount = 0;
  const matchedHeadlines = [];
  const reasons = [];

  for (const item of news) {
    const text = `${item.title} ${item.contentSnippet}`.toLowerCase();
    const headlineMatches = [];

    for (const word of rules.positive) {
      if (containsKeyword(text, word)) {
        score += 1;
        hitCount++;
        headlineMatches.push({ keyword: word, direction: "positive" });
        reasons.push({
          text: `positive headline signal: "${word}"`,
          direction: "positive",
          weight: 1,
        });
      }
    }

    for (const word of rules.negative) {
      if (containsKeyword(text, word)) {
        score -= 1;
        hitCount++;
        headlineMatches.push({ keyword: word, direction: "negative" });
        reasons.push({
          text: `negative headline signal: "${word}"`,
          direction: "negative",
          weight: 1,
        });
      }
    }

    if (headlineMatches.length > 0) {
      matchedHeadlines.push({
        title: item.title,
        source: item.source,
        pubDate: item.pubDate,
        link: item.link,
        matches: headlineMatches,
      });
    }
  }

  return {
    bias: scoreToBias(score),
    confidence: scoreToConfidence(score, hitCount),
    score,
    hitCount,
    matchedHeadlines,
    reasons,
  };
}

function buildTechnicalBias(asset, market = {}, regime = {}) {
  let score = 0;
  const reasons = [];
  const assetMove = market[asset]?.percent ?? 0;
  const esMove = market.ES?.percent ?? 0;
  const nqMove = market.NQ?.percent ?? 0;
  const dxyMove = market.DXY?.percent ?? 0;
  const oilMove = market.USOIL?.percent ?? 0;
  const goldMove = market.GOLD?.percent ?? 0;
  const vixMove = market.VIX?.percent ?? 0;
  const us10yMove = market.US10Y?.percent ?? 0;

  if (assetMove >= 0.35) addTechnicalScore(1, "asset intraday momentum is positive", "positive");
  if (assetMove <= -0.35) addTechnicalScore(-1, "asset intraday momentum is negative", "negative");

  if (asset === "ES" || asset === "NQ" || asset === "YM") {
    if (vixMove > 2) addTechnicalScore(-1, "rising VIX pressures equity risk", "negative");
    if (dxyMove > 0.25) addTechnicalScore(-1, "dollar momentum is a headwind for equities", "negative");
    if (oilMove > 1) addTechnicalScore(-1, "oil shock adds inflation pressure to equities", "negative");
    if (esMove > 0.35 && nqMove > 0.45) addTechnicalScore(1, "broad equity futures momentum is positive", "positive");
  }

  if (asset === "NQ" && us10yMove > 0.8) {
    addTechnicalScore(-1, "rising yields pressure long-duration tech", "negative");
  }

  if (asset === "GOLD") {
    if (dxyMove > 0.25) addTechnicalScore(-1, "stronger dollar limits upside for gold", "negative");
    if (vixMove > 2 || esMove < -0.4) addTechnicalScore(1, "defensive rotation supports gold", "positive");
  }

  if (asset === "DXY") {
    if (us10yMove > 0.6) addTechnicalScore(1, "higher US10Y supports dollar strength", "positive");
    if (vixMove > 2) addTechnicalScore(1, "risk-off tape supports dollar demand", "positive");
  }

  if (asset === "USOIL") {
    if (oilMove > 0.75) addTechnicalScore(1, "oil momentum is positive", "positive");
    if (esMove < -0.5 && nqMove < -0.7) addTechnicalScore(-1, "equity stress points to demand risk for oil", "negative");
  }

  if (regime.regime && regime.regime !== "MIXED") {
    const regimeAdjustment = getRegimeAdjustment(asset, regime.regime);
    if (regimeAdjustment !== 0) {
      addTechnicalScore(
        regimeAdjustment,
        `macro regime adjustment (${regime.regime})`,
        regimeAdjustment > 0 ? "positive" : "negative"
      );
    }
  }

  return {
    bias: scoreToBias(score),
    confidence: scoreToConfidence(score, reasons.length),
    score,
    reasons,
    snapshot: {
      assetPercent: assetMove,
      ES: esMove,
      NQ: nqMove,
      DXY: dxyMove,
      USOIL: oilMove,
      GOLD: goldMove,
      VIX: vixMove,
      US10Y: us10yMove,
    },
  };

  function addTechnicalScore(delta, text, direction) {
    score += delta;
    reasons.push({ text, direction, weight: Math.abs(delta) });
  }
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

function estimateExpectedMove(asset, price, score, eventRisk = {}) {
  const rawMove = Math.abs(score) * (price * 0.0005) * (eventRisk.moveMultiplier ?? 1);

  if (asset === "GOLD" || asset === "USOIL") {
    return Number(rawMove.toFixed(5));
  }

  return Number(rawMove.toFixed(3));
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
