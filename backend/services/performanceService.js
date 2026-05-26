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
    holdingPeriodMinutes: round(
      (new Date(next.generatedAt).getTime() -
        new Date(current.generatedAt).getTime()) /
        60000
    ),
    diagnosis: buildDiagnosis(current, verdict),
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
    reviewQuestions: buildReviewQuestions(row),
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

function buildDiagnosis(row, verdict) {
  const newsBias = row.newsBias?.bias ?? null;
  const technicalBias = row.technicalBias?.bias ?? null;
  const combinedBias = row.bias ?? null;
  const disagreed =
    newsBias &&
    technicalBias &&
    newsBias !== "Neutral" &&
    technicalBias !== "Neutral" &&
    newsBias !== technicalBias;

  if (verdict === "correct") {
    return {
      label: "bias_confirmed",
      summary:
        "The next logged price moved in the same direction as the combined bias.",
      newsTechnicalDisagreement: disagreed,
    };
  }

  if (verdict === "inconclusive") {
    return {
      label: "move_too_small",
      summary: "The next logged price move was too small to judge the bias cleanly.",
      newsTechnicalDisagreement: disagreed,
    };
  }

  if (disagreed) {
    return {
      label: "news_technical_conflict",
      summary:
        "The combined bias was wrong while news and technical bias were not aligned. Review which side was overweighted.",
      newsTechnicalDisagreement: true,
    };
  }

  return {
    label: "bias_failed",
    summary:
      "The next logged price moved against the combined bias. Review headline drivers, technical context, and event risk.",
    newsTechnicalDisagreement: false,
    combinedBias,
  };
}

function buildReviewQuestions(row) {
  const questions = [
    "Did the news bias and technical bias agree, or was this a mixed setup?",
    "Were the strongest drivers still relevant by the next logged price?",
    "Was there an economic calendar event or volatility shock between the two logs?",
  ];

  if (row.evaluation?.diagnosis?.label === "news_technical_conflict") {
    questions.unshift("Did the combined score overweight news or technicals?");
  }

  if (row.evaluation?.verdict === "wrong") {
    questions.unshift("What changed after this bias was logged?");
  }

  return questions;
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
