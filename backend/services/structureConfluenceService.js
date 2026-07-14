export function buildGexBiasComponent(gex = {}, currentBias = "Ranging", cvd = {}) {
  const notes = [];
  if (!gex.gexAvailable) {
    return { score: 0, weight: 10, notes: [`GEX unavailable: ${gex.reason ?? "no validated options chain"}`] };
  }

  const biasDirection = currentBias === "Bullish" ? 1 : currentBias === "Bearish" ? -1 : 0;
  const cvdDirection = cvd.cvdTrend === "rising" ? 1 : cvd.cvdTrend === "falling" ? -1 : 0;
  const nearest = gex.nearestGexLevel;
  const isNear = typeof nearest?.distancePct === "number" && nearest.distancePct <= 1;
  let score = 0;

  if (gex.gammaRegime === "negative" && cvd.continuationConfirmation && cvdDirection !== 0) {
    score += cvdDirection * 7;
    notes.push("Negative gamma regime supports volatility expansion with CVD confirmation.");
  }
  if (gex.gammaRegime === "positive" && isNear && biasDirection !== 0) {
    score -= biasDirection * 6;
    notes.push("Price near positive gamma pin level; continuation confidence reduced.");
  }
  if (nearest?.type === "negative_gamma" && isNear && cvdDirection !== 0) {
    score += cvdDirection * 3;
    notes.push("Price is near a negative gamma zone with directional CVD pressure.");
  }
  if (nearest?.type === "gamma_flip" && isNear && biasDirection !== 0) {
    score -= biasDirection * 3;
    notes.push("Price is near the gamma-flip area; directional confidence is reduced.");
  }

  return { score: clamp(score, -10, 10), weight: 10, notes };
}

export function buildCvdBiasComponent(cvd = {}) {
  if (!cvd.cvdAvailable) {
    return { score: 0, weight: 15, notes: [`CVD unavailable: ${cvd.reason ?? "volume data missing"}`] };
  }

  const notes = [];
  let score = clamp((cvd.cvdIndex / 100) * 8, -8, 8);
  if (cvd.bullishDivergence) {
    score += 5;
    notes.push("Bullish CVD divergence detected: price weakened while cumulative buy pressure improved.");
  }
  if (cvd.bearishDivergence) {
    score -= 5;
    notes.push("Bearish CVD divergence detected: price strengthened while cumulative buy pressure weakened.");
  }
  if (cvd.continuationConfirmation) {
    const direction = cvd.cvdTrend === "rising" ? 1 : -1;
    score += direction * 4;
    notes.push(`${cvd.cvdTrend === "rising" ? "Bullish" : "Bearish"} price trend is confirmed by CVD.`);
  }
  if (cvd.exhaustionSignal) {
    notes.push("CVD exhaustion conflicts with the current price trend.");
  }

  return { score: clamp(score, -15, 15), weight: 15, notes };
}

export function buildConfluenceBreakdown({
  rawBiasScore = 0,
  finalBiasScore = 0,
  trendState,
  reversal = {},
  gex = {},
  cvd = {},
  gexComponent = {},
  cvdComponent = {},
}) {
  const notes = [...(gexComponent.notes ?? []), ...(cvdComponent.notes ?? [])];
  const reversalPatternScore = reversalScore(reversal, notes);
  const continuationPatternScore = continuationScore(trendState, reversal, notes);
  let reversalGexAdjustment = 0;
  let reversalCvdAdjustment = 0;
  const nearest = gex.nearestGexLevel;
  const nearGex = gex.gexAvailable && typeof nearest?.distancePct === "number" && nearest.distancePct <= 1;

  if (nearGex && ["positive_gamma", "pin", "gamma_flip"].includes(nearest.type)) {
    reversalGexAdjustment += 12;
    notes.push("Existing reversal structure is near a major GEX reaction level.");
  }
  if (gex.gammaRegime === "negative" && !isReversalSignal(reversal.signal)) {
    reversalGexAdjustment -= 8;
    notes.push("Negative gamma expansion has no confirmed rejection; reversal confidence reduced.");
  }
  if (cvd.bullishDivergence || cvd.bearishDivergence) {
    reversalCvdAdjustment += 18;
    notes.push(`${cvd.bullishDivergence ? "Bullish" : "Bearish"} CVD divergence confirms reversal pressure.`);
  }
  if (cvd.exhaustionSignal) {
    reversalCvdAdjustment += 8;
    notes.push("CVD exhaustion supports reversal monitoring.");
  }
  if (cvd.continuationConfirmation && !isReversalSignal(reversal.signal)) {
    reversalCvdAdjustment -= 12;
    notes.push("Strong CVD continuation reduces unsupported reversal confidence.");
  }

  const finalReversalConfluence = clamp(
    10 + reversalPatternScore + reversalGexAdjustment + reversalCvdAdjustment,
    0,
    100
  );

  return {
    existingPatternScore: clamp(rawBiasScore * 10, -25, 25),
    reversalPatternScore,
    continuationPatternScore,
    gexScore: round(gexComponent.score ?? 0),
    cvdScore: round(cvdComponent.score ?? 0),
    reversalGexAdjustment,
    reversalCvdAdjustment,
    finalReversalConfluence: round(finalReversalConfluence),
    finalBiasConfluence: round(finalBiasScore),
    notes: [...new Set(notes)],
  };
}

function reversalScore(reversal, notes) {
  if (reversal.signal === "BULLISH_REVERSAL" || reversal.signal === "BEARISH_REVERSAL") {
    notes.push(`${reversal.label} structure is confirmed by a previous-session sweep and reclaim.`);
    return 30;
  }
  if (reversal.signal === "TWO_SIDED_SWEEP") {
    notes.push("Two-sided liquidity sweep raises reversal risk but lacks clean direction.");
    return 18;
  }
  return 0;
}

function continuationScore(trendState, reversal, notes) {
  let score = trendState === "continuing" ? 25 : trendState === "building" ? 15 : trendState === "mature" ? 6 : 0;
  if (reversal.signal === "UPSIDE_BREAKOUT" || reversal.signal === "DOWNSIDE_BREAKDOWN") {
    score += 12;
    notes.push(`${reversal.label} supports continuation rather than reversal.`);
  }
  return score;
}

function isReversalSignal(signal) {
  return ["BULLISH_REVERSAL", "BEARISH_REVERSAL", "TWO_SIDED_SWEEP"].includes(signal);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Number(value.toFixed(2));
}
