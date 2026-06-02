import { scoreToBias } from "../utils/scoring.js";

export function buildConfluenceForAsset({
  asset,
  currentBiasOutput = {},
  marketFlow = null,
  newsFlowRelationship = null,
  regime = null,
  eventRisk = null,
  optionsPressure = null,
}) {
  const components = buildComponents({
    currentBiasOutput,
    marketFlow,
    newsFlowRelationship,
    regime,
    optionsPressure,
  });
  const baseScore = components.reduce((sum, component) => sum + component.score, 0);
  const eventRiskAdjustment = buildEventRiskAdjustment(eventRisk);
  const edgeScore = clamp(baseScore + eventRiskAdjustment.score, -100, 100);
  const finalBias = scoreToBias(edgeScore / 18);
  const confidence = clamp(
    45 + Math.abs(edgeScore) * 0.42 - (eventRisk?.confidencePenalty ?? 0),
    25,
    95
  );
  const contradictions = buildContradictions({ marketFlow, newsFlowRelationship, currentBiasOutput });
  const trendState = resolveTrendState({ edgeScore, marketFlow, contradictions, eventRisk });
  const watchReasons = buildWatchReasons({ marketFlow, newsFlowRelationship, regime, trendState });
  const avoidReasons = buildAvoidReasons({ contradictions, eventRisk, trendState, optionsPressure });

  return {
    asset,
    finalBias,
    confidence: Math.round(confidence),
    edgeScore: Number(edgeScore.toFixed(2)),
    trendState,
    flowAlignment: resolveFlowAlignment(marketFlow, currentBiasOutput),
    newsAlignment: newsFlowRelationship?.relationship ?? "insufficient_data",
    macroAlignment: resolveMacroAlignment(regime, currentBiasOutput),
    optionsPressureAlignment: optionsPressure?.status === "OK" ? optionsPressure.trendImpact : "unavailable",
    eventRiskAdjustment,
    components,
    contradictions,
    watchReasons,
    avoidReasons,
    reasons: [
      ...components.map((component) => `${component.label}: ${component.score.toFixed(2)} / ${component.weight}`),
      ...eventRiskAdjustment.reasons,
    ],
  };
}

export function buildConfluenceSummary({
  biasOutput = {},
  marketFlow = null,
  newsFlowRelationships = {},
  regime = null,
  eventRisk = null,
  optionsPressure = null,
}) {
  return {
    generatedAt: new Date().toISOString(),
    assets: Object.fromEntries(
      Object.entries(biasOutput).map(([asset, row]) => [
        asset,
        buildConfluenceForAsset({
          asset,
          currentBiasOutput: row,
          marketFlow: row.flow ?? marketFlow?.rankedFlows?.find((flow) => flow.asset === asset),
          newsFlowRelationship: newsFlowRelationships[asset] ?? row.newsFlowRelationship,
          regime,
          eventRisk,
          optionsPressure: row.optionsPressure ?? optionsPressure?.assets?.find((pressure) => pressure.asset === asset),
        }),
      ])
    ),
  };
}

function buildComponents({ currentBiasOutput, marketFlow, newsFlowRelationship, regime, optionsPressure }) {
  return [
    {
      key: "marketFlow",
      label: "Market Flow Proxy",
      weight: 30,
      score: normalizeDirectionScore(marketFlow?.flowScore, 100) * 30,
      raw: marketFlow ?? null,
    },
    {
      key: "technicalBias",
      label: "Technical Bias",
      weight: 20,
      score: normalizeDirectionScore(currentBiasOutput.technicalBias?.score, 6) * 20,
      raw: currentBiasOutput.technicalBias ?? null,
    },
    {
      key: "macroRegime",
      label: "Macro Regime",
      weight: 15,
      score: macroScore(regime, currentBiasOutput.bias),
      raw: regime ?? null,
    },
    {
      key: "newsFlowRelationship",
      label: "News vs Flow",
      weight: 15,
      score: newsFlowScore(newsFlowRelationship),
      raw: newsFlowRelationship ?? null,
    },
    {
      key: "optionsPressure",
      label: "Options Pressure",
      weight: 10,
      score: optionsPressure?.status === "OK" ? normalizeDirectionScore(optionsPressure.score, 100) * 10 : 0,
      raw: optionsPressure ?? null,
    },
  ];
}

function buildEventRiskAdjustment(eventRisk = {}) {
  const score = eventRisk?.level === "HIGH" || eventRisk?.level === "EXTREME"
    ? -8
    : eventRisk?.level === "MEDIUM"
      ? -4
      : 0;

  return {
    score,
    level: eventRisk?.level ?? "LOW",
    confidencePenalty: eventRisk?.confidencePenalty ?? 0,
    reasons: score < 0 ? [`Event risk ${eventRisk?.level} reduces confluence confidence.`] : [],
  };
}

function buildContradictions({ marketFlow, newsFlowRelationship, currentBiasOutput }) {
  const contradictions = [];
  const bias = currentBiasOutput.bias;

  if (marketFlow?.direction === "inflow" && bias === "Bearish") {
    contradictions.push("Flow is positive while legacy bias is bearish.");
  }
  if (marketFlow?.direction === "outflow" && bias === "Bullish") {
    contradictions.push("Flow is negative while legacy bias is bullish.");
  }
  if (newsFlowRelationship?.relationship === "contradicts_flow") {
    contradictions.push("Headlines contradict the observed market flow.");
  }

  return contradictions;
}

function resolveTrendState({ edgeScore, marketFlow, contradictions, eventRisk }) {
  const abs = Math.abs(edgeScore);
  if (contradictions.length >= 2) return "chop";
  if (eventRisk?.level === "HIGH" || eventRisk?.level === "EXTREME") return "exhaustion_risk";
  if (marketFlow?.strength === "strong" && abs >= 45) return "continuing";
  if (marketFlow?.strength === "moderate" && abs >= 25) return "building";
  if (marketFlow?.strength === "strong" && abs < 20) return "reversal_risk";
  if (abs >= 65) return "mature";
  return abs < 12 ? "neutral" : "building";
}

function resolveFlowAlignment(marketFlow, currentBiasOutput) {
  if (!marketFlow || marketFlow.direction === "neutral") return "neutral";
  if (marketFlow.direction === "inflow" && currentBiasOutput.bias === "Bullish") return "aligned";
  if (marketFlow.direction === "outflow" && currentBiasOutput.bias === "Bearish") return "aligned";
  return "conflict";
}

function resolveMacroAlignment(regime, currentBiasOutput) {
  if (!regime?.regime || regime.regime === "MIXED") return "neutral";
  if (regime.regime === "RISK_ON" && currentBiasOutput.bias === "Bullish") return "aligned";
  if ((regime.regime === "RISK_OFF" || regime.regime === "LIQUIDITY_TIGHTENING") && currentBiasOutput.bias === "Bearish") return "aligned";
  return "mixed";
}

function buildWatchReasons({ marketFlow, newsFlowRelationship, regime, trendState }) {
  const reasons = [];
  if (marketFlow?.direction !== "neutral") reasons.push(`${marketFlow?.asset} has ${marketFlow?.strength} ${marketFlow?.direction} flow proxy.`);
  if (newsFlowRelationship?.relationship === "confirms_flow") reasons.push("News confirms the observed flow.");
  if (newsFlowRelationship?.relationship === "explains_flow") reasons.push("News may explain the observed flow.");
  if (regime?.regime && regime.regime !== "MIXED") reasons.push(`Macro regime is ${regime.regime}.`);
  if (trendState === "building") reasons.push("Trend state is building.");
  if (trendState === "continuing") reasons.push("Trend state is continuing.");
  return reasons;
}

function buildAvoidReasons({ contradictions, eventRisk, trendState, optionsPressure }) {
  const reasons = [...contradictions];
  if (eventRisk?.level === "HIGH" || eventRisk?.level === "EXTREME") reasons.push("High event risk can distort follow-through.");
  if (trendState === "chop") reasons.push("Confluence is choppy.");
  if (trendState === "exhaustion_risk") reasons.push("Move may be mature or event-risk sensitive.");
  if (optionsPressure?.status !== "OK") reasons.push("Options pressure unavailable. Using flow/news/macro confluence only.");
  return reasons;
}

function newsFlowScore(newsFlowRelationship = {}) {
  const relationship = newsFlowRelationship?.relationship;
  if (relationship === "confirms_flow") return 15;
  if (relationship === "explains_flow") return 9;
  if (relationship === "contradicts_flow") return -12;
  if (relationship === "unrelated") return -2;
  return 0;
}

function macroScore(regime = {}, bias) {
  if (!regime?.regime || regime.regime === "MIXED") return 0;
  if (regime.regime === "RISK_ON") return bias === "Bullish" ? 12 : -8;
  if (regime.regime === "RISK_OFF" || regime.regime === "LIQUIDITY_TIGHTENING") {
    return bias === "Bearish" ? 12 : -8;
  }
  if (regime.regime === "INFLATION_PRESSURE") return bias === "Bearish" ? 6 : -4;
  return 0;
}

function normalizeDirectionScore(value, maxAbs) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return clamp(value / maxAbs, -1, 1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
