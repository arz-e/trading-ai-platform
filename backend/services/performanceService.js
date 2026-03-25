/*
  Performance Service

  Evaluates historical bias predictions
  against actual market movement.
*/

export function buildEvaluationRows(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const evaluated = [];

  for (let i = 0; i < rows.length - 1; i++) {
    const current = rows[i];
    const next = rows[i + 1];

    const result = evaluatePrediction(current, next);

    evaluated.push({
      ...current,
      evaluation: result,
    });
  }

  return evaluated;
}

/*
  Evaluate one prediction vs next market state
*/
function evaluatePrediction(current, next) {
  const predictedBias = current.bias;
  const predictedMove = current.movePoints ?? 0;

  const nextPrice = next.currentPrice ?? 0;
  const currentPrice = current.currentPrice ?? 0;

  const actualMove = nextPrice - currentPrice;

  const directionCorrect = checkDirection(predictedBias, actualMove);

  const moveError = Math.abs(Math.abs(actualMove) - Math.abs(predictedMove));

  const moveAccuracy =
    predictedMove === 0
      ? 0
      : Math.max(
          0,
          100 - (moveError / Math.abs(predictedMove)) * 100
        );

  return {
    predictedBias,
    predictedMove,
    actualMove: round(actualMove),
    directionCorrect,
    moveError: round(moveError),
    moveAccuracy: round(moveAccuracy),
  };
}

/*
  Determine if bias direction was correct
*/
function checkDirection(bias, move) {
  if (bias === "Bullish" && move > 0) return true;
  if (bias === "Bearish" && move < 0) return true;

  if (bias === "Neutral" && Math.abs(move) < 0.1) return true;

  return false;
}

/*
  Build overall performance statistics
*/
export function buildPerformanceSummary(rows = []) {
  if (!rows.length) {
    return {
      totalPredictions: 0,
      directionAccuracy: 0,
      avgMoveAccuracy: 0,
    };
  }

  let correct = 0;
  let moveAccuracySum = 0;
  let count = 0;

  for (const row of rows) {
    const evalResult = row.evaluation;

    if (!evalResult) continue;

    count++;

    if (evalResult.directionCorrect) {
      correct++;
    }

    moveAccuracySum += evalResult.moveAccuracy ?? 0;
  }

  return {
    totalPredictions: count,
    directionAccuracy: round((correct / count) * 100),
    avgMoveAccuracy: round(moveAccuracySum / count),
  };
}

function round(value) {
  return Number(Number(value).toFixed(2));
}