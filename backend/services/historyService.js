/*
  History Service

  This service detects:
  - bias changes
  - confidence shifts
  - score shifts
  - driver changes
*/

export function enrichBiasHistoryRows(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const enriched = [];

  for (let i = 0; i < rows.length; i++) {
    const current = rows[i];
    const previous = rows[i + 1];

    const change = detectChange(current, previous);

    enriched.push({
      ...current,
      change,
    });
  }

  return enriched;
}

/*
  Detect change between two bias states
*/
function detectChange(current, previous) {
  if (!previous) {
    return {
      isInitial: true,
      biasChanged: false,
      confidenceDelta: 0,
      scoreDelta: 0,
      moveDelta: 0,
      addedDrivers: [],
      removedDrivers: [],
    };
  }

  const biasChanged = current.bias !== previous.bias;

  const confidenceDelta = round(
    (current.confidence ?? 0) - (previous.confidence ?? 0)
  );

  const scoreDelta = round(
    (current.score ?? 0) - (previous.score ?? 0)
  );

  const moveDelta =
    typeof current.movePoints === "number" && typeof previous.movePoints === "number"
      ? round(current.movePoints - previous.movePoints)
      : null;

  const currentDrivers = (current.drivers ?? []).map((d) => d.label);
  const previousDrivers = (previous.drivers ?? []).map((d) => d.label);

  const addedDrivers = currentDrivers.filter(
    (d) => !previousDrivers.includes(d)
  );

  const removedDrivers = previousDrivers.filter(
    (d) => !currentDrivers.includes(d)
  );

  return {
    isInitial: false,
    previousBias: previous.bias,
    biasChanged,
    confidenceDelta,
    scoreDelta,
    moveDelta,
    addedDrivers,
    removedDrivers,
  };
}

/*
  Build a timeline of major bias shifts
*/
export function detectBiasShiftTimeline(rows = []) {
  if (!rows.length) return [];

  const timeline = [];

  for (const row of rows) {
    const change = row.change;

    if (!change || change.isInitial) continue;

    if (
      change.biasChanged ||
      Math.abs(change.confidenceDelta) >= 8 ||
      Math.abs(change.scoreDelta) >= 2
    ) {
      timeline.push({
        asset: row.asset,
        generatedAt: row.generatedAt,
        bias: row.bias,
        previousBias: change.previousBias,
        biasChanged: change.biasChanged,
        confidenceDelta: change.confidenceDelta,
        scoreDelta: change.scoreDelta,
        moveDelta: change.moveDelta,
        addedDrivers: change.addedDrivers ?? [],
        removedDrivers: change.removedDrivers ?? [],
        label: buildShiftLabel(row),
      });
    }
  }

  return timeline.sort(
    (a, b) => new Date(b.generatedAt) - new Date(a.generatedAt)
  );
}

/*
  Generate readable label
*/
function buildShiftLabel(row) {
  const change = row.change;

  if (change.biasChanged) {
    return `${row.asset}: ${change.previousBias} → ${row.bias}`;
  }

  if (Math.abs(change.confidenceDelta) >= 8) {
    return `${row.asset}: confidence ${
      change.confidenceDelta > 0 ? "up" : "down"
    } ${Math.abs(change.confidenceDelta)}`;
  }

  if (Math.abs(change.scoreDelta) >= 2) {
    return `${row.asset}: score ${
      change.scoreDelta > 0 ? "up" : "down"
    } ${Math.abs(change.scoreDelta)}`;
  }

  return `${row.asset}: driver update`;
}

function round(value) {
  return Number(Number(value).toFixed(2));
}
