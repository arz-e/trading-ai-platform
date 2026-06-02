import {
  forexFactoryCalendarSource,
  manualCalendarEvents,
  manualCalendarSource,
} from "../config/manualCalendar.js";

let latestCalendarStatus = buildCalendarStatus("UNKNOWN", 0);
let cachedCalendarBundle = null;
let cachedCalendarFetchedAt = 0;

const CALENDAR_CACHE_TTL_MS = 15 * 60 * 1000;

export async function fetchCalendarEvents() {
  const bundle = await fetchCalendarBundle();
  return bundle.events;
}

export async function fetchCalendarBundle() {
  if (cachedCalendarBundle && Date.now() - cachedCalendarFetchedAt < CALENDAR_CACHE_TTL_MS) {
    return cachedCalendarBundle;
  }

  let forexFactoryError = null;

  try {
    const forexFactoryEvents = await fetchForexFactoryEvents();

    if (forexFactoryEvents.length > 0) {
      return cacheCalendarBundle(buildCalendarBundle({
        events: forexFactoryEvents,
        source: forexFactoryCalendarSource,
        status: "OK",
      }));
    }
  } catch (err) {
    console.error("ForexFactory calendar fetch failed:", err.message);
    forexFactoryError = err.message;

    if (cachedCalendarBundle) {
      latestCalendarStatus = {
        ...cachedCalendarBundle.source,
        status: "STALE",
        error: err.message,
        checkedAt: new Date().toISOString(),
      };

      return {
        ...cachedCalendarBundle,
        source: latestCalendarStatus,
        generatedAt: new Date().toISOString(),
      };
    }

    latestCalendarStatus = buildCalendarStatus("ERROR", 0, 0, forexFactoryCalendarSource, err.message);
  }

  const manualEvents = manualCalendarEvents
    .map(normalizeCalendarEvent)
    .filter(Boolean);

  return cacheCalendarBundle(buildCalendarBundle({
    events: manualEvents,
    source: manualCalendarSource,
    status: manualEvents.length > 0 ? "FALLBACK" : "UNAVAILABLE",
    error: manualEvents.length > 0
      ? `ForexFactory unavailable, using manual fallback. ${forexFactoryError ?? ""}`.trim()
      : `Calendar source unavailable. No fallback events loaded.${forexFactoryError ? ` ForexFactory error: ${forexFactoryError}` : ""}`,
  }));
}

export function getCalendarSourceStatus() {
  return latestCalendarStatus;
}

async function fetchForexFactoryEvents() {
  const response = await fetch(forexFactoryCalendarSource.url, {
    headers: {
      "User-Agent": "trading-ai-platform/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Status code ${response.status}`);
  }

  const xml = await response.text();
  return parseForexFactoryXml(xml);
}

function parseForexFactoryXml(xml) {
  const eventBlocks = String(xml).match(/<event>[\s\S]*?<\/event>/g) ?? [];

  return eventBlocks
    .map((block) => normalizeCalendarEvent({
      title: readXmlField(block, "title"),
      datetime: buildForexFactoryDatetime(
        readXmlField(block, "date"),
        readXmlField(block, "time")
      ),
      currency: readXmlField(block, "country"),
      impact: mapForexFactoryImpact(readXmlField(block, "impact")),
      forecast: readXmlField(block, "forecast") || null,
      previous: readXmlField(block, "previous") || null,
      actual: readXmlField(block, "actual") || null,
      source: forexFactoryCalendarSource.source,
      url: readXmlField(block, "url") || null,
    }))
    .filter(Boolean);
}

function buildCalendarBundle({ events, source, status, error = null }) {
  const normalizedEvents = events
    .map(normalizeCalendarEvent)
    .filter(Boolean)
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

  const upcomingCount = normalizedEvents.filter((event) => new Date(event.datetime).getTime() > Date.now()).length;
  const finalStatus = normalizedEvents.length > 0 ? status : "UNAVAILABLE";

  latestCalendarStatus = buildCalendarStatus(
    finalStatus,
    normalizedEvents.length,
    upcomingCount,
    source,
    error
  );

  return {
    events: normalizedEvents,
    count: normalizedEvents.length,
    upcomingCount,
    source: latestCalendarStatus,
    generatedAt: new Date().toISOString(),
  };
}


/*
Event Risk Calculator
Used by the bias engine
*/

export function computeEventRisk(events = []) {

  if (!events.length) {
    return {
      score: 0,
      level: "UNAVAILABLE",
      calendarAvailable: false,
      confidencePenalty: 0,
      moveMultiplier: 1,
      upcomingCount: 0,
      nextEvent: null,
      reasons: ["No calendar events loaded"]
    };
  }

  const now = Date.now();

  const upcoming = events
    .map(event => ({
      ...event,
      hoursUntil: (new Date(event.datetime).getTime() - now) / 3600000
    }))
    .filter(e => e.hoursUntil > 0)
    .sort((a, b) => a.hoursUntil - b.hoursUntil);

  const riskRelevantEvents = upcoming.filter((event) =>
    event.currency === "USD" || event.impact === "red" || event.impact === "orange"
  );
  const nextEvent = riskRelevantEvents[0] ?? upcoming[0];

  if (!nextEvent) {
    return {
      score: 0,
      level: "LOW",
      calendarAvailable: true,
      confidencePenalty: 0,
      moveMultiplier: 1,
      upcomingCount: 0,
      nextEvent: null,
      reasons: ["No upcoming calendar events"]
    };
  }

  let score = 0;

  if (nextEvent.impact === "red") score += 2;
  if (nextEvent.impact === "orange") score += 1;
  if (nextEvent.currency === "USD") score += 0.5;

  if (score > 0 && nextEvent.hoursUntil < 24) score += 1;
  if (score > 0 && nextEvent.hoursUntil < 6) score += 1;

  let level = "LOW";
  let confidencePenalty = 0;
  let moveMultiplier = 1;

  if (score >= 4) {
    level = "EXTREME";
    confidencePenalty = 15;
    moveMultiplier = 1.35;
  } else if (score >= 2) {
    level = "MEDIUM";
    confidencePenalty = 7;
    moveMultiplier = 1.18;
  }

  return {
    score,
    level,
    calendarAvailable: true,
    confidencePenalty,
    moveMultiplier,
    upcomingCount: riskRelevantEvents.length,
    nextEvent,
    reasons: [
      `next macro event: ${nextEvent.title}`,
      `impact: ${nextEvent.impact}`,
      `hours until event: ${nextEvent.hoursUntil.toFixed(1)}`
    ]
  };
}

function normalizeCalendarEvent(event) {
  if (!event?.title || !event?.datetime) {
    return null;
  }

  const timestamp = new Date(event.datetime).getTime();

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return {
    title: String(event.title),
    datetime: new Date(timestamp).toISOString(),
    currency: event.currency ?? "USD",
    impact: normalizeImpact(event.impact),
    actual: event.actual ?? null,
    forecast: event.forecast ?? null,
    previous: event.previous ?? null,
    source: event.source ?? manualCalendarSource.source,
    url: event.url ?? null,
  };
}

function normalizeImpact(value) {
  const impact = String(value ?? "yellow").toLowerCase();
  return ["white", "yellow", "orange", "red"].includes(impact) ? impact : "yellow";
}

function buildCalendarStatus(status, eventCount, upcomingCount = 0, source = manualCalendarSource, error = null) {
  return {
    ...source,
    status,
    eventCount,
    upcomingCount,
    error,
    checkedAt: new Date().toISOString(),
  };
}

function cacheCalendarBundle(bundle) {
  cachedCalendarBundle = bundle;
  cachedCalendarFetchedAt = Date.now();
  return bundle;
}

function readXmlField(block, fieldName) {
  const match = block.match(new RegExp(`<${fieldName}>([\\s\\S]*?)<\\/${fieldName}>`, "i"));

  if (!match) {
    return "";
  }

  return decodeXmlValue(match[1]);
}

function decodeXmlValue(value) {
  return String(value)
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function buildForexFactoryDatetime(dateValue, timeValue) {
  const dateMatch = String(dateValue).match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (!dateMatch) {
    return null;
  }

  const [, month, day, year] = dateMatch;
  const time = parseForexFactoryTime(timeValue);

  if (!time) {
    return null;
  }

  return zonedTimeToUtcIso({
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: time.hour,
    minute: time.minute,
    timeZone: forexFactoryCalendarSource.timezone,
  });
}

function parseForexFactoryTime(value) {
  const raw = String(value ?? "").trim().toLowerCase();

  if (!raw || raw === "all day" || raw === "tentative") {
    return { hour: 0, minute: 0 };
  }

  const match = raw.match(/^(\d{1,2}):(\d{2})(am|pm)$/);

  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3];

  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  return { hour, minute };
}

function mapForexFactoryImpact(value) {
  const impact = String(value ?? "").toLowerCase();

  if (impact.includes("high")) return "red";
  if (impact.includes("medium")) return "orange";
  if (impact.includes("low")) return "yellow";
  if (impact.includes("holiday")) return "white";

  return "yellow";
}

function zonedTimeToUtcIso({ year, month, day, hour, minute, timeZone }) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const firstPass = new Date(utcGuess - offset);
  const secondOffset = getTimeZoneOffsetMs(firstPass, timeZone);

  return new Date(utcGuess - secondOffset).toISOString();
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return asUtc - date.getTime();
}
