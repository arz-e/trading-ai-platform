import { impactCategoryRules, urgencyKeywords } from "../config/constants.js";
import { analyzeHeadlineSentiment } from "./sentimentService.js";
import { containsKeyword } from "../utils/textMatching.js";

const sourceWeightRules = [
  { match: /reuters/i, weight: 1.25 },
  { match: /cnbc/i, weight: 1.05 },
];

/**
 * Build scored, market-impact-aware news feed.
 */
export function buildNewsImpactFeed(news = []) {
  const sentimentItems = analyzeHeadlineSentiment(news);

  const items = sentimentItems
    .map((item) => scoreHeadlineImpact(item))
    .sort((a, b) => b.impactScore - a.impactScore);

  return {
    headlineCount: items.length,
    items,
    summary: buildImpactSummary(items),
  };
}

/**
 * Score one headline for market importance.
 */
export function scoreHeadlineImpact(item) {
  const titleText = String(item.title ?? "").toLowerCase();
  const sourceWeight = resolveSourceWeight(item.source);

  const categoryMatches = impactCategoryRules.filter((rule) =>
    rule.keywords.some((keyword) => containsKeyword(titleText, keyword))
  );

  const categoryWeight = categoryMatches.reduce((sum, rule) => sum + rule.weight, 0);

  const urgencyScore = urgencyKeywords.some((keyword) => containsKeyword(titleText, keyword))
    ? 1.2
    : 0;

  const assetRelevanceScore = Math.min(2, (item.impactedAssets?.length ?? 0) * 0.35);
  const sentimentMagnitude = Math.min(2.2, Math.abs(item.sentimentScore ?? 0) * 0.9);
  const recencyScore = computeRecencyScore(item.pubDate);

  const rawImpact =
    1 +
    categoryWeight +
    urgencyScore +
    assetRelevanceScore +
    sentimentMagnitude +
    recencyScore;

  const impactScore = Number((rawImpact * sourceWeight).toFixed(2));

  return {
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
    source: item.source,
    category: categoryMatches.length ? categoryMatches[0].category : "GENERAL",
    categories: categoryMatches.map((rule) => rule.category),
    sentimentLabel: item.sentimentLabel,
    sentimentScore: item.sentimentScore,
    sourceWeight,
    impactedAssets: item.impactedAssets,
    impactScore,
    impactLabel: resolveImpactLabel(impactScore),
    urgency: urgencyScore > 0 ? "HIGH" : "NORMAL",
    confidence: item.confidence,
    matchedPositive: item.matchedPositive,
    matchedNegative: item.matchedNegative,
  };
}

/**
 * Compact summary used by dashboard and briefing layer.
 */
export function buildImpactSummary(items = []) {
  const top = items.slice(0, 8);
  const categories = {};
  const assets = {};

  for (const item of top) {
    categories[item.category] = (categories[item.category] ?? 0) + 1;

    for (const asset of item.impactedAssets ?? []) {
      assets[asset] = (assets[asset] ?? 0) + 1;
    }
  }

  return {
    topHeadlineCount: top.length,
    topAverageImpact:
      top.length > 0
        ? Number(
            (top.reduce((sum, item) => sum + item.impactScore, 0) / top.length).toFixed(2)
          )
        : 0,
    dominantCategories: Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([category, count]) => ({ category, count })),
    mostImpactedAssets: Object.entries(assets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([asset, count]) => ({ asset, count })),
    topHeadlines: top.slice(0, 5).map((item) => ({
      title: item.title,
      impactScore: item.impactScore,
      impactLabel: item.impactLabel,
      category: item.category,
      sentimentLabel: item.sentimentLabel,
      impactedAssets: item.impactedAssets,
      source: item.source,
      pubDate: item.pubDate,
    })),
  };
}

function resolveSourceWeight(source) {
  const match = sourceWeightRules.find((rule) => rule.match.test(String(source ?? "")));
  return match ? match.weight : 0.95;
}

function resolveImpactLabel(score) {
  if (score >= 8.5) return "EXTREME";
  if (score >= 6.5) return "HIGH";
  if (score >= 4.5) return "MEDIUM";
  return "LOW";
}

function computeRecencyScore(pubDate) {
  const timestamp = new Date(pubDate).getTime();

  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);

  if (ageHours <= 2) return 1.3;
  if (ageHours <= 6) return 1;
  if (ageHours <= 12) return 0.7;
  if (ageHours <= 24) return 0.4;
  return 0.1;
}
