export async function fetchCalendarEvents() {

  // Manual placeholder events (can later be replaced with
  // ForexFactory / TradingEconomics / FRED ingestion)

  const events = [
    {
      title: "US CPI",
      datetime: "2026-03-07T13:30:00.000Z",
      currency: "USD",
      impact: "red",
      actual: null,
      forecast: "3.1%",
      previous: "3.0%",
      source: "manual"
    },
    {
      title: "US PPI",
      datetime: "2026-03-08T13:30:00.000Z",
      currency: "USD",
      impact: "orange",
      actual: null,
      forecast: "2.7%",
      previous: "2.6%",
      source: "manual"
    },
    {
      title: "FOMC Minutes",
      datetime: "2026-03-10T19:00:00.000Z",
      currency: "USD",
      impact: "red",
      actual: null,
      forecast: null,
      previous: null,
      source: "manual"
    }
  ];

  return events;
}


/*
Event Risk Calculator
Used by the bias engine
*/

export function computeEventRisk(events = []) {

  if (!events.length) {
    return {
      score: 0,
      level: "LOW",
      confidencePenalty: 0,
      moveMultiplier: 1,
      upcomingCount: 0,
      nextEvent: null,
      reasons: []
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

  const nextEvent = upcoming[0];

  if (!nextEvent) {
    return {
      score: 0,
      level: "LOW",
      confidencePenalty: 0,
      moveMultiplier: 1,
      upcomingCount: 0,
      nextEvent: null,
      reasons: []
    };
  }

  let score = 0;

  if (nextEvent.impact === "red") score += 2;
  if (nextEvent.impact === "orange") score += 1;

  if (nextEvent.hoursUntil < 24) score += 1;
  if (nextEvent.hoursUntil < 6) score += 1;

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
    confidencePenalty,
    moveMultiplier,
    upcomingCount: upcoming.length,
    nextEvent,
    reasons: [
      `next macro event: ${nextEvent.title}`,
      `impact: ${nextEvent.impact}`,
      `hours until event: ${nextEvent.hoursUntil.toFixed(1)}`
    ]
  };
}