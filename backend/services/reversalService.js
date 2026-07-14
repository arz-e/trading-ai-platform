export function buildPreviousSessionReversal({ market = {}, atrSnapshot = {} }) {
  const previous = atrSnapshot?.previousSession ?? null;
  const currentPrice = finiteNumber(market?.price);
  const currentHigh = finiteNumber(market?.high);
  const currentLow = finiteNumber(market?.low);
  const previousHigh = finiteNumber(previous?.high);
  const previousLow = finiteNumber(previous?.low);

  if ([currentPrice, currentHigh, currentLow, previousHigh, previousLow].includes(null)) {
    return {
      status: "UNAVAILABLE",
      signal: "UNAVAILABLE",
      label: "Reversal N/A",
      previousHigh,
      previousLow,
      currentPrice,
      currentHigh,
      currentLow,
      crossedPreviousHigh: false,
      crossedPreviousLow: false,
      source: atrSnapshot?.source ?? null,
      previousSessionAsOf: previous?.asOf ?? null,
      reason: "Current session OHLC or previous session levels are unavailable.",
    };
  }

  const crossedPreviousHigh = currentHigh > previousHigh;
  const crossedPreviousLow = currentLow < previousLow;
  const rejectedPreviousHigh = crossedPreviousHigh && currentPrice < previousHigh;
  const reclaimedPreviousLow = crossedPreviousLow && currentPrice > previousLow;

  let signal = "NO_REVERSAL";
  let label = "No Reversal";
  let reason = "Price has not swept and reclaimed a previous-session boundary.";

  if (rejectedPreviousHigh && reclaimedPreviousLow) {
    signal = "TWO_SIDED_SWEEP";
    label = "Two-Sided Sweep";
    reason = "Both previous-session boundaries were crossed and price returned inside the prior range.";
  } else if (reclaimedPreviousLow) {
    signal = "BULLISH_REVERSAL";
    label = "Bull Reversal";
    reason = "Price crossed below the previous-session low and reclaimed it.";
  } else if (rejectedPreviousHigh) {
    signal = "BEARISH_REVERSAL";
    label = "Bear Reversal";
    reason = "Price crossed above the previous-session high and rejected back below it.";
  } else if (crossedPreviousHigh && currentPrice >= previousHigh) {
    signal = "UPSIDE_BREAKOUT";
    label = "Upside Breakout";
    reason = "Price crossed and remains above the previous-session high; this is a breakout, not a reversal.";
  } else if (crossedPreviousLow && currentPrice <= previousLow) {
    signal = "DOWNSIDE_BREAKDOWN";
    label = "Downside Break";
    reason = "Price crossed and remains below the previous-session low; this is a breakdown, not a reversal.";
  }

  return {
    status: "OK",
    signal,
    label,
    previousHigh,
    previousLow,
    currentPrice,
    currentHigh,
    currentLow,
    crossedPreviousHigh,
    crossedPreviousLow,
    source: atrSnapshot?.source ?? null,
    previousSessionAsOf: previous?.asOf ?? null,
    reason,
  };
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
