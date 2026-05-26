export const manualCalendarSource = {
  id: "manual-calendar",
  name: "Manual Economic Calendar",
  source: "manual",
  notes:
    "Add upcoming macro events here when no reliable free calendar API is available.",
};

export const forexFactoryCalendarSource = {
  id: "forex-factory-weekly",
  name: "ForexFactory Weekly Calendar",
  source: "forex_factory",
  url: "https://nfs.faireconomy.media/ff_calendar_thisweek.xml",
  timezone: "America/New_York",
};

export const manualCalendarEvents = [
  /*
  Example:
  {
    title: "US CPI",
    datetime: "2026-06-10T12:30:00.000Z",
    currency: "USD",
    impact: "red",
    actual: null,
    forecast: null,
    previous: null,
    source: "manual",
  },
  */
];
