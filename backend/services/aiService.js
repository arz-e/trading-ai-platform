/**
 * Summarize raw scoring reasons into cleaner frontend-friendly drivers.
 */
export function summarizeDrivers(reasons = [], limit = 5) {
  const normalizedMap = new Map();

  for (const reason of reasons) {
    if (!reason || typeof reason.text !== "string") {
      continue;
    }

    const normalized = normalizeReason(reason.text);
    if (!normalized) {
      continue;
    }

    const existing = normalizedMap.get(normalized.key);

    if (existing) {
      existing.count += 1;
      existing.weight += normalized.weight;

      if (reason.direction === "positive") existing.positive += 1;
      if (reason.direction === "negative") existing.negative += 1;
      if (reason.direction === "neutral") existing.neutral += 1;
    } else {
      normalizedMap.set(normalized.key, {
        key: normalized.key,
        label: normalized.label,
        weight: normalized.weight,
        count: 1,
        positive: reason.direction === "positive" ? 1 : 0,
        negative: reason.direction === "negative" ? 1 : 0,
        neutral: reason.direction === "neutral" ? 1 : 0,
      });
    }
  }

  return [...normalizedMap.values()]
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    })
    .slice(0, limit)
    .map((item) => ({
      label: item.label,
      count: item.count,
      direction: resolveDirection(item),
      weight: Number(item.weight.toFixed(2)),
    }));
}

/**
 * Structured analysis payload that can later feed an LLM safely.
 */
export function buildAnalysisPayload({
  asset,
  bias,
  confidence,
  score,
  movePoints,
  currentPrice,
  atr,
  regime,
  regimeConfidence,
  eventRisk,
  drivers,
  sentimentSummary,
  market,
}) {
  return {
    asset,
    bias,
    confidence,
    score,
    movePoints,
    currentPrice,
    atr,
    regime,
    regimeConfidence,
    eventRisk: {
      level: eventRisk?.level ?? "LOW",
      score: eventRisk?.score ?? 0,
      nextEventTitle: eventRisk?.nextEvent?.title ?? null,
      nextEventTime: eventRisk?.nextEvent?.datetime ?? null,
    },
    drivers,
    sentiment: sentimentSummary,
    marketContext: {
      VIX: market?.VIX?.price ?? null,
      US10Y: market?.US10Y?.price ?? null,
      DXY: market?.DXY?.price ?? null,
      USOIL: market?.USOIL?.price ?? null,
      GOLD: market?.GOLD?.price ?? null,
      ES: market?.ES?.price ?? null,
      NQ: market?.NQ?.price ?? null,
      YM: market?.YM?.price ?? null,
    },
  };
}

/**
 * Current rule-based narrative generator.
 * Later this can be swapped with an LLM while keeping the same payload.
 */
export function generateAssetAnalysis(payload) {
  const {
    asset,
    bias,
    confidence,
    movePoints,
    atr,
    regime,
    regimeConfidence,
    eventRisk,
    drivers = [],
    sentiment,
    marketContext,
  } = payload;

  const rangeText =
    typeof movePoints === "number"
      ? `The 14-session ATR range for the next trading session is ${movePoints} points/units.`
      : "A market-derived ATR range is unavailable for this asset right now.";
  const opening = `${asset} is biased ${String(bias).toLowerCase()} with ${confidence}% confidence. ${rangeText}`;

  const macroSentence = `The current macro regime is ${formatLabel(regime)} (${regimeConfidence}% confidence), with VIX at ${marketContext?.VIX ?? "n/a"}, US10Y at ${marketContext?.US10Y ?? "n/a"}, and DXY at ${marketContext?.DXY ?? "n/a"}.`;

  const driverSentence = buildDriverSentence(drivers);
  const sentimentSentence = buildSentimentSentence(sentiment);
  const eventSentence = buildEventSentence(eventRisk);
  const riskSentence = buildRiskSentence(asset, atr, marketContext);

  return [
    opening,
    macroSentence,
    driverSentence,
    sentimentSentence,
    eventSentence,
    riskSentence,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildDriverSentence(drivers) {
  if (!drivers.length) {
    return "No dominant cross-asset or headline driver was identified.";
  }

  const labels = drivers.map((driver) => driver.label);

  if (labels.length === 1) {
    return `The main driver is ${labels[0]}.`;
  }

  if (labels.length === 2) {
    return `The main drivers are ${labels[0]} and ${labels[1]}.`;
  }

  return `The main drivers are ${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}.`;
}

function buildSentimentSentence(sentiment) {
  if (!sentiment || sentiment.relevantHeadlineCount === 0) {
    return "Headline sentiment is limited for this asset and is not materially shifting the setup.";
  }

  const biasText =
    sentiment.weightedBias === "positive"
      ? "net supportive"
      : sentiment.weightedBias === "negative"
        ? "net negative"
        : "mixed";

  return `Headline sentiment is currently ${biasText}, based on ${sentiment.relevantHeadlineCount} relevant headlines and an average sentiment score of ${sentiment.averageSentimentScore}.`;
}

function buildEventSentence(eventRisk) {
  if (!eventRisk || !eventRisk.nextEventTitle || (eventRisk.score ?? 0) <= 0) {
    return "No immediate macro event is materially distorting the setup.";
  }

  return `Event risk is ${String(eventRisk.level).toLowerCase()} due to the upcoming ${eventRisk.nextEventTitle}, which reduces confidence and slightly increases expected move risk.`;
}

function buildRiskSentence(asset, atr, marketContext) {
  const atrText = atr ?? "n/a";

  if (asset === "NQ") {
    return `Nasdaq sensitivity to rates remains important here, and ATR currently sits at ${atrText}.`;
  }

  if (asset === "ES" || asset === "YM") {
    return `Equity index risk remains sensitive to volatility and growth expectations, with ATR at ${atrText}.`;
  }

  if (asset === "GOLD") {
    return `Gold remains sensitive to dollar and yield direction, with ATR at ${atrText}.`;
  }

  if (asset === "DXY") {
    return `Dollar direction remains tied to rate pressure and defensive positioning, with ATR at ${atrText}.`;
  }

  if (asset === "USOIL") {
    return `Oil remains exposed to both supply narratives and demand-risk, with ATR at ${atrText} and spot oil around ${marketContext?.USOIL ?? "n/a"}.`;
  }

  return `${asset} currently has ATR at ${atrText}.`;
}

function normalizeReason(text) {
  const lower = text.toLowerCase().trim();

  if (!lower) {
    return null;
  }

  const patterns = [
    { match: /headline signal: "war"/, key: "geopolitical-war-risk", label: "geopolitical war risk", weight: 2.2 },
    { match: /headline signal: "geopolitics"/, key: "geopolitical-tension", label: "geopolitical tension", weight: 2 },
    { match: /headline signal: "tariff"/, key: "tariff-risk", label: "tariff risk", weight: 1.9 },
    { match: /headline signal: "higher yields"/, key: "higher-yields", label: "higher yields", weight: 2 },
    { match: /headline signal: "hawkish"/, key: "hawkish-policy-tone", label: "hawkish policy tone", weight: 1.8 },
    { match: /headline signal: "risk-off"/, key: "risk-off-sentiment", label: "risk-off sentiment", weight: 1.8 },
    { match: /headline signal: "risk-on"/, key: "risk-on-sentiment", label: "risk-on sentiment", weight: 1.7 },
    { match: /headline signal: "recession"/, key: "recession-risk", label: "recession risk", weight: 1.9 },
    { match: /cross-asset confluence adjustment/, key: "cross-asset-confluence", label: "cross-asset confluence", weight: 2.1 },
    { match: /macro regime adjustment/, key: "macro-regime-alignment", label: "macro regime alignment", weight: 2 },
    { match: /rising vix/, key: "rising-volatility", label: "rising volatility", weight: 2 },
    { match: /rising us10y yield/, key: "rising-yield-pressure", label: "rising yield pressure", weight: 2.1 },
    { match: /nasdaq is especially sensitive to higher yields/, key: "nasdaq-rate-sensitivity", label: "Nasdaq rate sensitivity", weight: 1.8 },
    { match: /stronger dollar limits upside for gold/, key: "strong-dollar-headwind", label: "strong dollar headwind", weight: 1.8 },
    { match: /higher us10y supports dollar strength/, key: "yield-supported-dollar-strength", label: "yield-supported dollar strength", weight: 1.8 },
    { match: /strong oil momentum confirms upside pressure/, key: "oil-momentum", label: "oil momentum", weight: 1.7 },
    { match: /dollar momentum is strong/, key: "strong-dollar-momentum", label: "strong dollar momentum", weight: 2 },
    { match: /dollar momentum is moderate/, key: "moderate-dollar-momentum", label: "dollar momentum", weight: 1.5 },
    { match: /weaker dollar supports equity risk appetite/, key: "weaker-dollar-support", label: "weaker dollar support", weight: 1.6 },
    { match: /weaker dollar supports gold/, key: "weaker-dollar-gold-support", label: "weaker dollar support for gold", weight: 1.6 },
    { match: /rising yields pressure long-duration tech/, key: "duration-pressure", label: "duration pressure on tech", weight: 2.2 },
    { match: /rising yields tighten equity financial conditions/, key: "tighter-financial-conditions", label: "tighter financial conditions", weight: 2 },
    { match: /oil shock adds inflation and growth pressure to equities/, key: "oil-shock-equity-pressure", label: "oil shock pressure on equities", weight: 1.9 },
    { match: /equity stress is strong/, key: "strong-equity-stress", label: "strong equity stress", weight: 2.1 },
    { match: /equity stress is moderate/, key: "equity-stress", label: "equity stress", weight: 1.7 },
    { match: /equity stress supports defensive assets/, key: "defensive-rotation", label: "defensive rotation", weight: 1.9 },
    { match: /calendar risk:/, key: "calendar-risk", label: "calendar event risk", weight: 1.7 },
    { match: /event risk:/, key: "event-proximity-risk", label: "event proximity risk", weight: 1.8 },
    { match: /detected macro regime:/, key: "macro-regime-detected", label: "macro regime signal", weight: 1.5 },
    { match: /sentiment signal:/, key: "headline-sentiment", label: "headline sentiment", weight: 1.8 },
    { match: /sentiment backdrop:/, key: "headline-sentiment-backdrop", label: "headline sentiment", weight: 1.7 },
  ];

  for (const pattern of patterns) {
    if (pattern.match.test(lower)) {
      return {
        key: pattern.key,
        label: pattern.label,
        weight: pattern.weight,
      };
    }
  }

  return {
    key: lower,
    label: cleanupFallbackLabel(text),
    weight: 1,
  };
}

function cleanupFallbackLabel(text) {
  return text
    .replace(/^positive headline signal:\s*/i, "")
    .replace(/^negative headline signal:\s*/i, "")
    .replace(/^macro signal:\s*/i, "")
    .replace(/^macro factor:\s*/i, "")
    .replace(/^macro backdrop:\s*/i, "")
    .replace(/^cross-asset confluence adjustment:\s*/i, "cross-asset confluence ")
    .replace(/^macro regime adjustment \([^)]+\):\s*/i, "macro regime adjustment ")
    .replace(/^event risk:\s*/i, "")
    .replace(/^calendar risk:\s*/i, "")
    .replace(/^detected macro regime:\s*/i, "")
    .replace(/^sentiment signal:\s*/i, "")
    .replace(/^sentiment backdrop:\s*/i, "")
    .replace(/"/g, "")
    .trim();
}

function resolveDirection(item) {
  if (item.positive > item.negative && item.positive > item.neutral) return "positive";
  if (item.negative > item.positive && item.negative > item.neutral) return "negative";
  return "neutral";
}

function formatLabel(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/_/g, " ");
}
