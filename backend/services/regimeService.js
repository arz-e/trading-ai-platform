/**
 * Detect the current macro regime from cross-asset market behavior.
 */
export function detectMacroRegime(market = {}) {
  const es = market.ES?.percent ?? 0;
  const nq = market.NQ?.percent ?? 0;
  const ym = market.YM?.percent ?? 0;
  const dxy = market.DXY?.percent ?? 0;
  const oil = market.USOIL?.percent ?? 0;
  const gold = market.GOLD?.percent ?? 0;
  const vix = market.VIX?.percent ?? 0;
  const us10y = market.US10Y?.percent ?? 0;

  const reasons = [];
  const scores = {
    RISK_ON: 0,
    RISK_OFF: 0,
    INFLATION_PRESSURE: 0,
    LIQUIDITY_TIGHTENING: 0,
    MIXED: 0,
  };

  // RISK OFF
  if (vix > 2.5) {
    scores.RISK_OFF += 2;
    reasons.push("VIX is rising sharply");
  }

  if (dxy > 0.25) {
    scores.RISK_OFF += 1;
    reasons.push("Dollar strength suggests defensive demand");
  }

  if (es < -0.4 || nq < -0.6 || ym < -0.4) {
    scores.RISK_OFF += 2;
    reasons.push("Equity futures are under pressure");
  }

  if (gold > 0.6) {
    scores.RISK_OFF += 1;
    reasons.push("Gold strength supports defensive positioning");
  }

  // RISK ON
  if (es > 0.35 && nq > 0.5) {
    scores.RISK_ON += 2;
    reasons.push("Equity futures are broadly firm");
  }

  if (dxy < -0.2) {
    scores.RISK_ON += 1;
    reasons.push("Dollar weakness supports risk appetite");
  }

  if (vix < -1.5) {
    scores.RISK_ON += 1.5;
    reasons.push("VIX compression supports risk-on conditions");
  }

  if (us10y < -0.5) {
    scores.RISK_ON += 1;
    reasons.push("Falling yields ease financial conditions");
  }

  // INFLATION PRESSURE
  if (oil > 1.2) {
    scores.INFLATION_PRESSURE += 2;
    reasons.push("Oil strength points to inflation pressure");
  }

  if (us10y > 1.0) {
    scores.INFLATION_PRESSURE += 1.5;
    reasons.push("US10Y is rising, reflecting rate and inflation pressure");
  }

  if (dxy > 0.2) {
    scores.INFLATION_PRESSURE += 0.5;
    reasons.push("Dollar firmness aligns with tighter macro conditions");
  }

  // LIQUIDITY TIGHTENING
  if (us10y > 1.0) {
    scores.LIQUIDITY_TIGHTENING += 2;
    reasons.push("Higher yields imply tighter liquidity conditions");
  }

  if (dxy > 0.25) {
    scores.LIQUIDITY_TIGHTENING += 1;
    reasons.push("Dollar strength reinforces tightening conditions");
  }

  if (nq < -0.6) {
    scores.LIQUIDITY_TIGHTENING += 1.5;
    reasons.push("Nasdaq weakness reflects growth-duration pressure");
  }

  // MIXED / indecisive
  if (
    Math.abs(es) < 0.25 &&
    Math.abs(nq) < 0.35 &&
    Math.abs(dxy) < 0.2 &&
    Math.abs(us10y) < 0.5
  ) {
    scores.MIXED += 1.5;
    reasons.push("Cross-asset moves are relatively muted");
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topRegime, topScore] = ranked[0];
  const [, secondScore] = ranked[1];

  let regime = "MIXED";
  let confidence = 45;

  if (topScore > 0) {
    regime = topRegime;
    confidence = Math.max(
      40,
      Math.min(90, Math.round(50 + topScore * 8 + (topScore - secondScore) * 6))
    );
  }

  return {
    regime,
    confidence,
    scores,
    reasons: uniqueReasons(reasons).slice(0, 6),
  };
}

function uniqueReasons(arr = []) {
  return [...new Set(arr)];
}