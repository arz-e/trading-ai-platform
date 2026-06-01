/*
  Performance Service

  Evaluates logged bias calls against the next later logged price for the
  same asset. This keeps the audit trail local to the user's SQLite DB.
*/

export function buildEvaluationRows(rows = []) {
  return buildBiasEvaluations(rows);
}

export function buildBiasEvaluations(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const evaluated = [];
  const rowsByAsset = groupRowsByAsset(rows);

  for (const assetRows of Object.values(rowsByAsset)) {
    const sorted = [...assetRows].sort(
      (a, b) => new Date(a.generatedAt) - new Date(b.generatedAt)
    );

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      evaluated.push({
        ...current,
        evaluation: evaluatePrediction(current, next),
      });
    }
  }

  return evaluated.sort(
    (a, b) => new Date(b.generatedAt) - new Date(a.generatedAt)
  );
}

export function evaluatePrediction(current, next) {
  const predictedBias = current.bias;
  const predictedMove = current.movePoints ?? 0;

  const nextPrice = next.currentPrice ?? 0;
  const currentPrice = current.currentPrice ?? 0;
  const actualMove = nextPrice - currentPrice;
  const actualMovePercent =
    currentPrice === 0 ? 0 : (actualMove / currentPrice) * 100;
  const noiseThreshold = resolveNoiseThreshold(current);
  const verdict = resolveVerdict(predictedBias, actualMove, noiseThreshold);
  const moveError = Math.abs(Math.abs(actualMove) - Math.abs(predictedMove));
  const moveAccuracy =
    predictedMove === 0
      ? 0
      : Math.max(0, 100 - (moveError / Math.abs(predictedMove)) * 100);
  const holdingPeriodMinutes = round(
    (new Date(next.generatedAt).getTime() -
      new Date(current.generatedAt).getTime()) /
      60000
  );
  const context = {
    next,
    predictedBias,
    predictedMove,
    actualMove: round(actualMove),
    actualMovePercent: round(actualMovePercent),
    moveError: round(moveError),
    moveAccuracy: round(moveAccuracy),
    holdingPeriodMinutes,
    noiseThreshold: round(noiseThreshold),
  };

  return {
    evaluatedAgainstId: next.id,
    evaluatedAgainstAt: next.generatedAt,
    predictedBias,
    predictedMove,
    actualMove: round(actualMove),
    actualMovePercent: round(actualMovePercent),
    noiseThreshold: round(noiseThreshold),
    verdict,
    directionCorrect: verdict === "correct",
    moveError: round(moveError),
    moveAccuracy: round(moveAccuracy),
    holdingPeriodMinutes,
    diagnosis: buildDiagnosis(current, verdict, context),
  };
}

export function buildPerformanceSummary(rows = []) {
  if (!rows.length) {
    return {
      totalPredictions: 0,
      directionAccuracy: 0,
      avgMoveAccuracy: 0,
      verdicts: {
        correct: 0,
        wrong: 0,
        inconclusive: 0,
      },
    };
  }

  let correct = 0;
  let moveAccuracySum = 0;
  let count = 0;

  for (const row of rows) {
    const evalResult = row.evaluation;

    if (!evalResult) continue;

    count++;

    if (evalResult.verdict === "correct") {
      correct++;
    }

    moveAccuracySum += evalResult.moveAccuracy ?? 0;
  }

  return {
    totalPredictions: count,
    directionAccuracy: count === 0 ? 0 : round((correct / count) * 100),
    avgMoveAccuracy: count === 0 ? 0 : round(moveAccuracySum / count),
    verdicts: countVerdicts(rows),
  };
}

export function buildPostMortem(evaluations = [], id) {
  const numericId = Number(id);
  const row = evaluations.find((item) => item.id === numericId);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    asset: row.asset,
    generatedAt: row.generatedAt,
    bias: row.bias,
    confidence: row.confidence,
    score: row.score,
    movePoints: row.movePoints,
    currentPrice: row.currentPrice,
    analysis: row.analysis,
    reasons: row.reasons ?? [],
    drivers: row.drivers ?? [],
    newsBias: row.newsBias ?? null,
    technicalBias: row.technicalBias ?? null,
    combinedBias: row.combinedBias ?? null,
    sentimentSummary: row.sentimentSummary ?? null,
    marketSnapshot: row.marketSnapshot ?? null,
    evaluation: row.evaluation,
  };
}

function groupRowsByAsset(rows) {
  const groups = {};

  for (const row of rows) {
    if (!row?.asset || !row?.generatedAt) continue;

    if (!groups[row.asset]) {
      groups[row.asset] = [];
    }

    groups[row.asset].push(row);
  }

  return groups;
}

function resolveNoiseThreshold(row) {
  const predictedMove = Math.abs(row.movePoints ?? 0);
  const priceBasedNoise = Math.abs(row.currentPrice ?? 0) * 0.0002;

  return Math.max(0.1, predictedMove * 0.25, priceBasedNoise);
}

function resolveVerdict(bias, move, noiseThreshold) {
  if (Math.abs(move) < noiseThreshold) {
    return "inconclusive";
  }

  if (bias === "Bullish") return move > 0 ? "correct" : "wrong";
  if (bias === "Bearish") return move < 0 ? "correct" : "wrong";

  return "inconclusive";
}

function buildDiagnosis(row, verdict, context = {}) {
  const newsBias = row.newsBias?.bias ?? null;
  const technicalBias = row.technicalBias?.bias ?? null;
  const combinedBias = row.bias ?? null;
  const disagreed =
    newsBias &&
    technicalBias &&
    newsBias !== "Neutral" &&
    technicalBias !== "Neutral" &&
    newsBias !== technicalBias;
  const expectedText = formatExpectedMoveForReview(
    context.predictedBias,
    context.predictedMove
  );
  const actualText = `${formatSigned(context.actualMove)} pts (${formatSigned(
    context.actualMovePercent
  )}%)`;
  const holdingText = `${context.holdingPeriodMinutes ?? 0} minutes`;
  const moveFit = resolveMoveFitLabel(context.moveAccuracy);
  const conflictText = disagreed
    ? ` News bias was ${newsBias} while technical bias was ${technicalBias}, so this was a mixed input.`
    : ` News and technical inputs were ${newsBias || "not available"} / ${
        technicalBias || "not available"
      }.`;

  if (verdict === "correct") {
    return {
      label: "bias_confirmed",
      summary: `${row.asset} moved in the ${combinedBias?.toLowerCase()} direction over ${holdingText}. The call expected ${expectedText}; the next saved /api/bias run showed ${actualText}. Move fit was ${moveFit} at ${context.moveAccuracy ?? 0}% accuracy.${conflictText}`,
      newsTechnicalDisagreement: disagreed,
    };
  }

  if (verdict === "inconclusive") {
    return {
      label: "move_too_small",
      summary: `${row.asset} moved only ${actualText} over ${holdingText}, inside the noise threshold of ${context.noiseThreshold ?? 0} pts. The direction result is inconclusive even though the saved call expected ${expectedText}. A longer holding period or more saved /api/bias runs would be needed to judge the bias cleanly.${conflictText}`,
      newsTechnicalDisagreement: disagreed,
    };
  }

  if (disagreed) {
    return {
      label: "news_technical_conflict",
      summary: `${row.asset} moved against the ${combinedBias?.toLowerCase()} call over ${holdingText}. The call expected ${expectedText}, but the next saved /api/bias run showed ${actualText}. News and technical bias disagreed (${newsBias} vs ${technicalBias}), so review which side the combined score overweighted.`,
      newsTechnicalDisagreement: true,
    };
  }

  return {
    label: "bias_failed",
    summary: `${row.asset} moved against the ${combinedBias?.toLowerCase()} call over ${holdingText}. The call expected ${expectedText}, but the next saved /api/bias run showed ${actualText}. Review whether headline drivers, technical context, event risk, or cross-asset pressure changed before the next saved run.`,
    newsTechnicalDisagreement: false,
    combinedBias,
  };
}

function resolveMoveFitLabel(moveAccuracy = 0) {
  if (moveAccuracy >= 70) return "good";
  if (moveAccuracy >= 35) return "fair";
  return "poor";
}

function formatExpectedMoveForReview(bias, move = 0) {
  const amount = Math.abs(Number(move) || 0);
  const formatted = amount >= 100 ? amount.toFixed(0) : amount.toFixed(2);

  if (bias === "Bearish") return `${formatted} pts downside`;
  if (bias === "Bullish") return `${formatted} pts upside`;
  return `${formatted} pts range`;
}

function formatSigned(value = 0) {
  const numeric = Number(value) || 0;
  const formatted = Math.abs(numeric) >= 100 ? numeric.toFixed(0) : numeric.toFixed(2);
  return `${numeric >= 0 ? "+" : ""}${formatted}`;
}

function countVerdicts(rows = []) {
  const counts = {
    correct: 0,
    wrong: 0,
    inconclusive: 0,
  };

  for (const row of rows) {
    const verdict = row.evaluation?.verdict;

    if (counts[verdict] !== undefined) {
      counts[verdict]++;
    }
  }

  return counts;
}

function round(value) {
  return Number(Number(value).toFixed(2));
}
