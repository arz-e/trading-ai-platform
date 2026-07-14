export function scoreToBias(score) {
  if (score >= 2) return "Bullish";
  if (score <= -2) return "Bearish";
  return "Ranging";
}

export function scoreToConfidence(score, hits = 0) {
  const raw = 50 + Math.abs(score) * 10 + hits * 2;
  return Math.max(35, Math.min(95, Math.round(raw)));
}

export function crossAssetAdjustments(asset, market = {}) {
  let score = 0;

  const dxy = market?.DXY?.percent ?? 0;
  const oil = market?.USOIL?.percent ?? 0;
  const gold = market?.GOLD?.percent ?? 0;

  if (asset === "ES" || asset === "NQ" || asset === "YM") {
    if (dxy > 0.25) score -= 1;
    if (oil > 1) score -= 1;
    if (gold > 0.8) score -= 1;
  }

  if (asset === "GOLD") {
    if (dxy > 0.3) score -= 1;
  }

  return score;
}
