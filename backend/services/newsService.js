import Parser from "rss-parser";
import { newsFeeds } from "../config/constants.js";

const parser = new Parser();

/**
 * Fetch and normalize RSS news items from configured feeds.
 */
export async function fetchNewsData() {
  const allItems = [];

  for (const url of newsFeeds) {
    try {
      const feed = await parser.parseURL(url);

      const items = (feed.items || []).slice(0, 15).map((item) => ({
        title: item.title || "",
        link: item.link || "",
        pubDate: item.pubDate || item.isoDate || "",
        contentSnippet: item.contentSnippet || item.content || "",
        source: feed.title || url,
      }));

      allItems.push(...items);
    } catch (err) {
      console.error(`RSS fetch failed for ${url}:`, err.message);
    }
  }

  return dedupeNewsItems(
    allItems
      .filter((item) => item.title)
      .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
      .slice(0, 40)
  );
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

    return [
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
    ].some((keyword) => text.includes(keyword));
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