const SESSION_WINDOWS = [
  { name: "Asia", openUtcMinutes: 0, closeUtcMinutes: 9 * 60, priority: 1 },
  { name: "London", openUtcMinutes: 8 * 60, closeUtcMinutes: 17 * 60, priority: 2 },
  { name: "New York", openUtcMinutes: 13 * 60 + 30, closeUtcMinutes: 20 * 60, priority: 3 },
];

export function buildSessionContext(generatedAt = new Date().toISOString()) {
  const date = new Date(generatedAt);
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  const totalMinutes = safeDate.getUTCHours() * 60 + safeDate.getUTCMinutes();
  const sessions = SESSION_WINDOWS.map((session) => buildSessionInfo(session, totalMinutes));
  const runningSessions = sessions
    .filter((session) => session.status === "RUNNING")
    .sort((a, b) => b.priority - a.priority);
  const primarySession = runningSessions[0] ?? [...sessions].sort(
    (a, b) => a.minutesUntilOpen - b.minutesUntilOpen
  )[0];

  return {
    generatedAt: safeDate.toISOString(),
    utcTime: safeDate.toISOString(),
    primarySession: {
      name: primarySession.name,
      status: primarySession.status,
      projectionStatus: primarySession.status === "RUNNING" ? "CURRENT" : "UPCOMING",
      openUtcMinutes: primarySession.openUtcMinutes,
      closeUtcMinutes: primarySession.closeUtcMinutes,
      minutesRemaining: primarySession.minutesRemaining,
      minutesUntilOpen: primarySession.minutesUntilOpen,
    },
    sessions: sessions.map(({ priority, ...session }) => session),
  };
}

export function buildSessionProjection({
  bias,
  confidence,
  trendState,
  sessionContext,
}) {
  const primary = sessionContext?.primarySession ?? null;
  const projectedBias = bias === "Neutral" || !bias ? "Ranging" : bias;

  return {
    bias: projectedBias,
    confidence: typeof confidence === "number" ? confidence : null,
    trendState: trendState ?? "ranging",
    session: primary?.name ?? null,
    sessionStatus: primary?.status ?? "UNKNOWN",
    projectionStatus: primary?.projectionStatus ?? "UNKNOWN",
    generatedAt: sessionContext?.generatedAt ?? null,
    basis: "Final deterministic confluence projected through the current main session, or the next session when markets are between sessions.",
  };
}

function buildSessionInfo(session, nowMinutes) {
  const isRunning = nowMinutes >= session.openUtcMinutes && nowMinutes < session.closeUtcMinutes;
  const minutesUntilOpen = isRunning
    ? 0
    : nowMinutes < session.openUtcMinutes
      ? session.openUtcMinutes - nowMinutes
      : 24 * 60 - nowMinutes + session.openUtcMinutes;

  return {
    ...session,
    status: isRunning ? "RUNNING" : "CLOSED",
    minutesRemaining: isRunning ? session.closeUtcMinutes - nowMinutes : 0,
    minutesUntilOpen,
  };
}
