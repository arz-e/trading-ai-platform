import {
  positiveSentimentPatterns,
  negativeSentimentPatterns,
  assetRelevanceRules,
  sentimentSourceWeights,
} from "../config/constants.js";

/**
 * Analyze sentiment of headlines and detect impacted assets.
 */
export function analyzeHeadlineSentiment(news = []) {
  return news.map((item) => {
    const text = `${item.title} ${item.contentSnippet}`.toLowerCase();

    const positiveMatches = positiveSentimentPatterns.filter((p) =>
      text.includes(p)
    );

    const negativeMatches = negativeSentimentPatterns.filter((p) =>
      text.includes(p)
    );

    const positiveScore = positiveMatches.length;
    const negativeScore = negativeMatches.length;

    const rawScore = positiveScore - negativeScore;

    const sentimentLabel =
      rawScore > 0 ? "POSITIVE" : rawScore < 0 ? "NEGATIVE" : "NEUTRAL";

    const impactedAssets = detectImpactedAssets(text);

    const sourceWeight =
      sentimentSourceWeights[item.source] ??
      sentimentSourceWeights.default ??
      1;

    const sentimentScore = Number((rawScore * sourceWeight).toFixed(2));

    const confidence = computeConfidence(
      positiveScore,
      negativeScore,
      impactedAssets.length
    );

    return {
      ...item,
      sentimentLabel,
      sentimentScore,
      impactedAssets,
      confidence,
      matchedPositive: positiveMatches,
      matchedNegative: negativeMatches,
    };
  });
}

/**
 * Detect which assets the headline is most relevant to.
 */
function detectImpactedAssets(text) {
  const assets = [];

  for (const asset in assetRelevanceRules) {
    const keywords = assetRelevanceRules[asset];

    const match = keywords.some((keyword) => text.includes(keyword));

    if (match) {
      assets.push(asset);
    }
  }

  return assets;
}

/**
 * Confidence estimation for sentiment detection.
 */
function computeConfidence(pos, neg, assetMatches) {
  const magnitude = Math.abs(pos - neg);

  let confidence = 50;

  confidence += magnitude * 12;
  confidence += assetMatches * 5;

  return Math.min(95, Math.round(confidence));
}

/**
 * Build a small sentiment overview used in dashboard.
 */
export function buildSentimentSummary(items = []) {
  const counts = {
    POSITIVE: 0,
    NEGATIVE: 0,
    NEUTRAL: 0,
  };

  for (const item of items) {
    if (counts[item.sentimentLabel] !== undefined) {
      counts[item.sentimentLabel]++;
    }
  }

  return {
    headlineCount: items.length,
    distribution: counts,
    items: items.slice(0, 10),
  };
}