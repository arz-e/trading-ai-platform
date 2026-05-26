import Parser from "rss-parser";
import { newsSources } from "../config/constants.js";
import { containsAnyKeyword } from "../utils/textMatching.js";

const parser = new Parser({
  headers: {
    "User-Agent": "trading-ai-platform/1.0",
  },
  timeout: 12000,
});
const MAX_ITEMS_PER_SOURCE = 15;
const MAX_NEWS_ITEMS = 60;

let latestSourceStatus = buildInitialSourceStatus();

/**
 * Fetch and normalize RSS news items from configured feeds.
 */
export async function fetchNewsData() {
  const bundle = await fetchNewsBundle();
  return bundle.items;
}

/**
 * Fetch news plus source-health metadata for API/system reporting.
 */
export async function fetchNewsBundle() {
  const results = await Promise.all(newsSources.map(fetchOneNewsSource));
  const allItems = results.flatMap((result) => result.items);
  const sourceStatus = results.map((result) => result.status);

  const items = dedupeNewsItems(
    allItems
      .filter((item) => item.title)
      .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
      .slice(0, MAX_NEWS_ITEMS)
  );

  latestSourceStatus = sourceStatus;

  return {
    count: items.length,
    items,
    sources: sourceStatus,
    healthySourceCount: sourceStatus.filter((source) => source.status === "OK").length,
    generatedAt: new Date().toISOString(),
  };
}

export function getNewsSourceStatus() {
  return latestSourceStatus;
}

async function fetchOneNewsSource(source) {
  if (!source.enabled) {
    return {
      items: [],
      status: buildSourceStatus(source, "DISABLED", 0),
    };
  }

  try {
    const feed = await parser.parseURL(source.url);

    const items = (feed.items || []).slice(0, MAX_ITEMS_PER_SOURCE).map((item) => ({
      title: item.title || "",
      link: item.link || "",
      pubDate: item.pubDate || item.isoDate || "",
      contentSnippet: item.contentSnippet || item.content || "",
      source: source.name || feed.title || source.url,
      sourceId: source.id,
      sourceCategory: source.category,
    }));

    return {
      items,
      status: buildSourceStatus(source, "OK", items.length),
    };
  } catch (err) {
    const status = buildSourceStatus(source, "ERROR", 0, err.message);
    console.error(`RSS fetch failed for ${source.name} (${source.url}):`, err.message);
    return {
      items: [],
      status,
    };
  }
}

function buildInitialSourceStatus() {
  return newsSources.map((source) => buildSourceStatus(source, source.enabled ? "UNKNOWN" : "DISABLED", 0));
}

function buildSourceStatus(source, status, itemCount, error = null) {
  return {
    id: source.id,
    name: source.name,
    url: source.url,
    category: source.category,
    status,
    itemCount,
    error,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Remove duplicate/near-duplicate headlines.
 */
export function dedupeNewsItems(items = []) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = normalizeHeadline(item.title);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(item);
  }

  return output;
}

/**
 * Filter headlines that are likely macro/market relevant.
 */
export function filterMacroRelevantNews(items = []) {
  return items.filter((item) => {
    const text = `${item.title} ${item.contentSnippet}`.toLowerCase();

    return containsAnyKeyword(text, [
      "fed",
      "fomc",
      "powell",
      "cpi",
      "pce",
      "inflation",
      "rates",
      "yield",
      "recession",
      "tariff",
      "war",
      "geopolitics",
      "opec",
      "oil",
      "dollar",
      "usd",
      "jobs",
      "payroll",
      "risk-off",
      "risk-on",
      "bank",
      "stimulus",
      "earnings",
      "manufacturing",
      "economy",
    ]);
  });
}

/**
 * Group headlines by source for UI/debugging.
 */
export function groupNewsBySource(items = []) {
  const grouped = {};

  for (const item of items) {
    const source = item.source || "Unknown";

    if (!grouped[source]) {
      grouped[source] = [];
    }

    grouped[source].push(item);
  }

  return grouped;
}

/**
 * Very simple headline recency bucket.
 */
export function tagHeadlineRecency(items = []) {
  const now = Date.now();

  return items.map((item) => {
    const published = new Date(item.pubDate).getTime();
    const ageHours = Number.isFinite(published)
      ? (now - published) / (1000 * 60 * 60)
      : null;

    let recency = "UNKNOWN";

    if (ageHours !== null) {
      if (ageHours <= 2) recency = "VERY_RECENT";
      else if (ageHours <= 6) recency = "RECENT";
      else if (ageHours <= 24) recency = "TODAY";
      else recency = "OLDER";
    }

    return {
      ...item,
      recency,
    };
  });
}

function normalizeHeadline(title = "") {
  return String(title)
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
