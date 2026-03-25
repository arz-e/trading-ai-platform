import { assetRules } from "../config/constants.js";
import { crossAssetAdjustments, scoreToBias, scoreToConfidence } from "../utils/scoring.js";

export async function buildBiasEngine(market = {}, news = [], calendarEvents = []) {

  const output = {};

  for (const asset in assetRules) {
    const rules = assetRules[asset];

    let score = 0;
    let hitCount = 0;
    const reasons = [];

    for (const item of news) {
      const text = `${item.title} ${item.contentSnippet}`.toLowerCase();

      for (const word of rules.positive) {
        if (text.includes(word)) {
          score += 1;
          hitCount++;
          reasons.push(`positive headline signal: "${word}"`);
        }
      }

      for (const word of rules.negative) {
        if (text.includes(word)) {
          score -= 1;
          hitCount++;
          reasons.push(`negative headline signal: "${word}"`);
        }
      }
    }

    const cross = crossAssetAdjustments(asset, market);

    if (cross !== 0) {
      score += cross;
      reasons.push(`cross-asset confluence adjustment: ${cross}`);
    }

    const bias = scoreToBias(score);
    const confidence = scoreToConfidence(score, hitCount);

    const price = market[asset]?.price ?? 0;

    const rawMove = Math.abs(score) * (price * 0.0005);

    let movePoints;

    if (asset === "GOLD" || asset === "USOIL") {
      movePoints = Number(rawMove.toFixed(5));
    } else {
      movePoints = Number(rawMove.toFixed(3));
    }

    output[asset] = {
      bias,
      confidence,
      score,
      movePoints,
      currentPrice: price,
      analysis: `${asset} bias is ${bias.toLowerCase()} with ${confidence}% confidence.`,
      reasons,
      lastUpdated: new Date().toISOString()
    };
  }

  return {
    regime: { regime: "UNKNOWN", confidence: 0 },
    eventRisk: { level: "LOW", score: 0 },
    sentiment: {},
    assets: output
  };
}