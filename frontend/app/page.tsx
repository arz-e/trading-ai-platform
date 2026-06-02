"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Driver = {
  label: string;
  count: number;
  direction: "positive" | "negative" | "neutral";
  weight: number;
};

type BiasBreakdown = {
  bias: string;
  confidence: number;
  score: number;
  hitCount?: number;
  weightedHitCount?: number;
  matchedHeadlines?: Array<{
    title: string;
    source?: string;
    pubDate?: string;
    link?: string;
    sourceWeight?: number;
    category?: string;
    categoryWeight?: number;
    assetRelevanceWeight?: number;
    matches?: Array<{
      keyword: string;
      direction: string;
      sourceWeight?: number;
      category?: string;
      categoryWeight?: number;
      assetRelevanceWeight?: number;
      contribution?: number;
    }>;
  }>;
  reasons?: Array<{ text: string; direction: string; weight: number }>;
  snapshot?: Record<string, number>;
};

type AssetCard = {
  asset: string;
  price: number | null;
  change: number | null;
  percent: number | null;
  bias: string;
  confidence: number;
  score: number;
  movePoints: number;
  newsBias?: BiasBreakdown | null;
  technicalBias?: BiasBreakdown | null;
  combinedBias?: BiasBreakdown | null;
  regime: string | null;
  regimeConfidence: number | null;
  drivers: Driver[];
  eventRisk?: {
    level: string;
    score: number;
    nextEvent?: {
      title: string;
      datetime: string;
    } | null;
  };
  analysis: string;
  lastUpdated?: string;
};

type Briefing = {
  macroTone: string;
  summary: string;
  keyDrivers: string[];
  riskFactors: string[];
  reversalTriggers: string[];
};

type FlashNewsItem = {
  title: string;
  impactScore: number;
  impactLabel: string;
  category: string;
  sentimentLabel: string;
  source: string;
  pubDate: string;
};

type DashboardResponse = {
  generatedAt: string;
  regime?: {
    regime: string;
    confidence: number;
  };
  eventRisk?: {
    level: string;
    score: number;
    nextEvent?: {
      title: string;
      datetime: string;
    } | null;
  };
  sentimentSummary?: {
    headlineCount: number;
    items: Array<{
      title: string;
      sentimentLabel: string;
      sentimentScore: number;
    }>;
  };
  newsImpactSummary?: {
    headlineCount: number;
    topAverageImpact: number;
    topHeadlines: FlashNewsItem[];
    dominantCategories?: Array<{ category: string; count: number }>;
    mostImpactedAssets?: Array<{ asset: string; count: number }>;
  };
  briefing?: Briefing;
  assets: AssetCard[];
};

type HistorySummaryResponse = {
  asset: string;
  count: number;
  latest: {
    bias: string;
    confidence: number;
    score: number;
    movePoints: number;
    analysis: string;
    generatedAt: string;
  } | null;
  latestDrivers: string[];
  latestChange: {
    biasChanged?: boolean;
    previousBias?: string;
    confidenceDelta?: number;
    scoreDelta?: number;
    moveDelta?: number;
    addedDrivers?: string[];
    removedDrivers?: string[];
  } | null;
  shifts: Array<{
    asset: string;
    generatedAt: string;
    label: string;
  }>;
  chartPoints: Array<{
    generatedAt: string;
    bias: string;
    confidence: number;
    score: number;
    movePoints: number;
  }>;
};

type BiasShift = {
  asset: string;
  generatedAt: string;
  label: string;
  bias: string;
  previousBias?: string;
  confidenceDelta?: number;
  scoreDelta?: number;
  moveDelta?: number;
  addedDrivers?: string[];
  removedDrivers?: string[];
};

type BiasShiftsResponse = {
  count: number;
  shifts: BiasShift[];
  generatedAt: string;
};

type SessionInfo = {
  name: string;
  status: "RUNNING" | "CLOSED";
  message: string;
};

type AppView = "dashboard" | "upcoming-news" | "evaluations" | "ai-analysis";

type SourceStatus = {
  id: string;
  name: string;
  url?: string;
  category?: string;
  source?: string;
  status: string;
  itemCount?: number;
  eventCount?: number;
  upcomingCount?: number;
  error?: string | null;
  checkedAt?: string;
};

type SystemStatus = {
  ok: boolean;
  now: string;
  database?: {
    connected: boolean;
    biasHistoryRows: number;
    biasRunRows: number;
  };
  dataSources?: {
    news?: SourceStatus[];
    calendar?: SourceStatus;
  };
  latestBiasRun?: {
    runId?: number;
    generatedAt?: string;
    loggedAt?: string;
    headlineCount?: number;
    assetCount?: number;
    runType?: string;
  } | null;
};

type CalendarEvent = {
  title: string;
  datetime: string;
  currency: string;
  impact: string;
  actual?: string | null;
  forecast?: string | null;
  previous?: string | null;
  source?: string;
  url?: string | null;
};

type CalendarResponse = {
  events: CalendarEvent[];
  count: number;
  upcomingCount: number;
  source?: SourceStatus;
  generatedAt: string;
};

type NewsImpactItem = {
  title: string;
  link?: string;
  pubDate?: string;
  source: string;
  category: string;
  categories?: string[];
  sentimentLabel: string;
  sentimentScore: number;
  impactedAssets?: string[];
  impactScore: number;
  impactLabel: string;
  urgency: string;
  confidence: number;
  matchedPositive?: string[];
  matchedNegative?: string[];
};

type NewsImpactResponse = {
  headlineCount: number;
  items: NewsImpactItem[];
  summary?: {
    topAverageImpact?: number;
    dominantCategories?: Array<{ category: string; count: number }>;
    mostImpactedAssets?: Array<{ asset: string; count: number }>;
  };
  generatedAt: string;
};

type EvaluationDetail = {
  evaluatedAgainstId: number;
  evaluatedAgainstAt: string;
  predictedBias: string;
  predictedMove: number;
  actualMove: number;
  actualMovePercent: number;
  noiseThreshold: number;
  verdict: string;
  directionCorrect: boolean;
  moveError: number;
  moveAccuracy: number;
  holdingPeriodMinutes: number;
  diagnosis?: {
    label: string;
    summary: string;
    newsTechnicalDisagreement?: boolean;
  };
};

type EvaluationRow = {
  id: number;
  asset: string;
  bias: string;
  confidence: number;
  score: number;
  movePoints: number;
  currentPrice: number;
  analysis: string;
  reasons?: string[];
  drivers?: Driver[];
  newsBias?: BiasBreakdown | null;
  technicalBias?: BiasBreakdown | null;
  combinedBias?: BiasBreakdown | null;
  headlineCount?: number;
  generatedAt: string;
  evaluation?: EvaluationDetail;
};

type EvaluationsResponse = {
  count: number;
  asset: string | null;
  verdict: string | null;
  summary?: {
    totalPredictions?: number;
    directionAccuracy?: number;
    avgMoveAccuracy?: number;
    verdicts?: Record<string, number>;
  };
  evaluations: EvaluationRow[];
  generatedAt: string;
};

type PostMortemResponse = {
  postMortem: EvaluationRow & {
    evaluation: EvaluationDetail;
  };
  generatedAt: string;
};

type ReviewTone = "good" | "warn" | "bad" | "neutral";

type ReviewToneResult = {
  label: string;
  tone: ReviewTone;
};

const labelMap: Record<string, string> = {
  ES: "S&P 500 Futures",
  NQ: "Nasdaq Futures",
  YM: "Dow Futures",
  GOLD: "Gold Futures",
  DXY: "US Dollar Index",
  USOIL: "US Oil",
};

const assetOrder = ["ES", "NQ", "YM", "GOLD", "DXY", "USOIL"];
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

const navItems: Array<{ id: AppView; label: string; disabled?: boolean }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "upcoming-news", label: "Upcoming News" },
  { id: "evaluations", label: "Evaluations" },
  { id: "ai-analysis", label: "AI Analysis", disabled: true },
];

export default function Home() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [historySummary, setHistorySummary] = useState<HistorySummaryResponse | null>(null);
  const [biasShifts, setBiasShifts] = useState<BiasShift[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
  const [newsImpact, setNewsImpact] = useState<NewsImpactResponse | null>(null);
  const [evaluations, setEvaluations] = useState<EvaluationsResponse | null>(null);
  const [overallEvaluations, setOverallEvaluations] = useState<EvaluationsResponse | null>(null);
  const [postMortem, setPostMortem] = useState<PostMortemResponse["postMortem"] | null>(null);
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState("NQ");
  const [newsCurrencyFilter, setNewsCurrencyFilter] = useState("ALL");
  const [newsImpactFilter, setNewsImpactFilter] = useState("ALL");
  const [evaluationAsset, setEvaluationAsset] = useState("ALL");
  const [evaluationVerdict, setEvaluationVerdict] = useState("ALL");
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<number | null>(null);
  const [expandedEventKeys, setExpandedEventKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [evaluationsLoading, setEvaluationsLoading] = useState(false);
  const [logStatus, setLogStatus] = useState<{
    state: "idle" | "saving" | "saved" | "error";
    message: string;
  }>({ state: "idle", message: "" });
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date>(new Date());

  async function fetchDashboard() {
    const res = await fetch(`${API_BASE_URL}/api/dashboard`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch dashboard");
    const data: DashboardResponse = await res.json();
    setDashboard(data);
  }

  async function fetchHistory(asset: string) {
    const res = await fetch(`${API_BASE_URL}/api/bias-history-summary/${asset}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch history summary");
    const data: HistorySummaryResponse = await res.json();
    setHistorySummary(data);
  }

  async function fetchBiasShifts() {
    const res = await fetch(`${API_BASE_URL}/api/bias-shifts`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch bias shifts");
    const data: BiasShiftsResponse = await res.json();
    setBiasShifts(data.shifts || []);
  }

  async function fetchSystemStatus() {
    const res = await fetch(`${API_BASE_URL}/api/system`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch system status");
    const data: SystemStatus = await res.json();
    setSystemStatus(data);
  }

  async function logCurrentBiasRun() {
    setLogStatus({
      state: "saving",
      message: "Saving current deterministic bias snapshot...",
    });

    try {
      const res = await fetch(`${API_BASE_URL}/api/bias/log`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error("Failed to save bias run");

      const data: { run?: { runId?: number; loggedAt?: string } } = await res.json();
      setLogStatus({
        state: "saved",
        message: `Saved experiment run #${data.run?.runId ?? "--"} at ${formatDateTime(data.run?.loggedAt)}`,
      });

      await Promise.all([
        fetchSystemStatus(),
        fetchBiasShifts(),
        fetchHistory(selected),
        activeView === "evaluations" ? fetchEvaluationsData() : Promise.resolve(),
      ]);
    } catch (err) {
      console.error(err);
      setLogStatus({
        state: "error",
        message: "Could not save the bias run. Check backend logs and data-source health.",
      });
    }
  }

  async function fetchUpcomingNewsData() {
    setUpcomingLoading(true);
    try {
      const [calendarRes, impactRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/calendar`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/api/news-impact`, { cache: "no-store" }),
      ]);

      if (!calendarRes.ok) throw new Error("Failed to fetch calendar");
      if (!impactRes.ok) throw new Error("Failed to fetch news impact");

      const calendarData: CalendarResponse = await calendarRes.json();
      const impactData: NewsImpactResponse = await impactRes.json();
      setCalendar(calendarData);
      setNewsImpact(impactData);
    } finally {
      setUpcomingLoading(false);
    }
  }

  const fetchEvaluationsData = useCallback(async () => {
    setEvaluationsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (evaluationAsset !== "ALL") params.set("asset", evaluationAsset);
      if (evaluationVerdict !== "ALL") params.set("verdict", evaluationVerdict);

      const [res, overallRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/evaluations?${params.toString()}`, {
          cache: "no-store",
        }),
        fetch(`${API_BASE_URL}/api/evaluations?limit=500`, {
          cache: "no-store",
        }),
      ]);
      if (!res.ok) throw new Error("Failed to fetch evaluations");
      if (!overallRes.ok) throw new Error("Failed to fetch overall evaluations");
      const data: EvaluationsResponse = await res.json();
      const overallData: EvaluationsResponse = await overallRes.json();
      setEvaluations(data);
      setOverallEvaluations(overallData);

      const firstId = data.evaluations[0]?.id ?? null;
      setSelectedEvaluationId((current) => {
        if (current && data.evaluations.some((row) => row.id === current)) return current;
        return firstId;
      });
    } finally {
      setEvaluationsLoading(false);
    }
  }, [evaluationAsset, evaluationVerdict]);

  async function fetchPostMortem(id: number) {
    const res = await fetch(`${API_BASE_URL}/api/postmortem/${id}`, { cache: "no-store" });
    if (!res.ok) {
      setPostMortem(null);
      return;
    }
    const data: PostMortemResponse = await res.json();
    setPostMortem(data.postMortem);
  }

  useEffect(() => {
    async function boot() {
      try {
        await Promise.all([fetchDashboard(), fetchBiasShifts(), fetchSystemStatus()]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    boot();

    const interval = setInterval(() => {
      fetchDashboard().catch(console.error);
      fetchBiasShifts().catch(console.error);
      fetchSystemStatus().catch(console.error);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchHistory(selected).catch(console.error);
  }, [selected]);

  useEffect(() => {
    if (activeView === "upcoming-news") {
      fetchUpcomingNewsData().catch(console.error);
    }
  }, [activeView]);

  useEffect(() => {
    if (activeView === "evaluations") {
      fetchEvaluationsData().catch(console.error);
    }
  }, [activeView, fetchEvaluationsData]);

  useEffect(() => {
    if (activeView === "evaluations" && selectedEvaluationId) {
      fetchPostMortem(selectedEvaluationId).catch(console.error);
    } else if (activeView === "evaluations") {
      setPostMortem(null);
    }
  }, [activeView, selectedEvaluationId]);

  useEffect(() => {
    setMounted(true);

    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const assets = useMemo(() => {
    const rows = dashboard?.assets ?? [];
    return [...rows].sort(
      (a, b) => assetOrder.indexOf(a.asset) - assetOrder.indexOf(b.asset)
    );
  }, [dashboard]);

  const selectedAsset = assets.find((a) => a.asset === selected) ?? null;
  const sessions = mounted ? getSessionInfos(now) : [];

  function getBiasColor(value?: string) {
    if (value === "Bullish") return "text-green-400 bg-green-900/30 border-green-700";
    if (value === "Bearish") return "text-red-400 bg-red-900/30 border-red-700";
    return "text-yellow-300 bg-yellow-900/20 border-yellow-700";
  }

  function getChangeColor(value?: number | null) {
    if (typeof value !== "number") return "text-gray-400";
    return value >= 0 ? "text-green-400" : "text-red-400";
  }

  function getDriverColor(direction?: string) {
    if (direction === "positive") return "border-green-700/60 bg-green-950/30 text-green-300";
    if (direction === "negative") return "border-red-700/60 bg-red-950/30 text-red-300";
    return "border-gray-700 bg-[#0d1423] text-gray-300";
  }

  function getImpactBarWidth(weight: number) {
    const max = 12;
    return `${Math.min(100, (weight / max) * 100)}%`;
  }

  function getToneColor(tone?: string) {
    if (tone === "RISK_OFF") return "text-red-300";
    if (tone === "RISK_ON") return "text-green-300";
    return "text-yellow-300";
  }

  function getImpactColor(value?: string) {
    if (value === "EXTREME") return "text-red-300 bg-red-900/30 border-red-700";
    if (value === "HIGH") return "text-orange-300 bg-orange-900/30 border-orange-700";
    if (value === "MEDIUM") return "text-yellow-300 bg-yellow-900/20 border-yellow-700";
    return "text-gray-300 bg-gray-800 border-gray-700";
  }

  function getSessionStatusStyle(status: SessionInfo["status"]) {
    if (status === "RUNNING") {
      return "text-green-300 bg-green-900/20 border-green-700";
    }
    return "text-gray-300 bg-gray-800 border-gray-700";
  }

  return (
    <main className="min-h-screen bg-[#0a0f1a] text-white p-6">
      <div className="mx-auto max-w-7xl">
        <AppShellHeader
          activeView={activeView}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((value) => !value)}
          onSelectView={(view) => {
            setActiveView(view);
            setMenuOpen(false);
          }}
        />

        {activeView === "dashboard" ? (
          <>
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Hybrid Trader Dashboard</h1>
            <p className="mt-2 text-sm text-gray-400">
              Macro bias engine with event risk, drivers, briefing, charts, and shift tracking
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl border border-gray-800 bg-[#111827] px-4 py-2 text-sm text-gray-300">
              Auto refresh: 15s
            </div>
            <div className="rounded-xl border border-gray-800 bg-[#111827] px-4 py-2 text-sm text-gray-300">
              Regime: {dashboard?.regime?.regime ?? "--"}
            </div>
            <div className="rounded-xl border border-gray-800 bg-[#111827] px-4 py-2 text-sm text-gray-300">
              Event Risk: {dashboard?.eventRisk?.level ?? "--"}
            </div>
            <button
              type="button"
              onClick={logCurrentBiasRun}
              disabled={logStatus.state === "saving"}
              className="rounded-xl border border-cyan-700 bg-cyan-950/30 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {logStatus.state === "saving" ? "Saving..." : "Save Bias Run"}
            </button>
          </div>
        </div>

        <BiasLoggingCard systemStatus={systemStatus} logStatus={logStatus} />

        <DataSourceHealthCard systemStatus={systemStatus} />

        <div className="mb-6 rounded-2xl border border-gray-800 bg-[#111827] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Market Sessions</p>
              <h2 className="mt-2 text-2xl font-bold">
                UTC {mounted ? formatUtcClock(now) : "--:--:--"}
              </h2>
            </div>
            <div className="text-sm text-gray-400">
              Based on your device time converted to UTC
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {mounted
              ? sessions.map((session) => (
                  <div
                    key={session.name}
                    className="rounded-2xl border border-gray-800 bg-[#0d1423] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-semibold">{session.name}</p>
                      <span
                        className={`rounded-lg border px-3 py-1 text-xs font-semibold ${getSessionStatusStyle(
                          session.status
                        )}`}
                      >
                        {session.status === "RUNNING" ? "Running" : "Closed"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-gray-300">{session.message}</p>
                  </div>
                ))
              : ["Asia", "London", "New York"].map((session) => (
                  <div
                    key={session}
                    className="rounded-2xl border border-gray-800 bg-[#0d1423] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-semibold">{session}</p>
                      <span className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-300">
                        --
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-gray-300">--</p>
                  </div>
                ))}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-800 bg-[#111827] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Macro Regime</p>
            <h2 className="mt-2 text-2xl font-bold">
              {dashboard?.regime?.regime?.replaceAll("_", " ") ?? "--"}
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Confidence: {dashboard?.regime?.confidence ?? "--"}%
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-[#111827] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Next Macro Event</p>
            <h2 className="mt-2 text-2xl font-bold">
              {dashboard?.eventRisk?.nextEvent?.title ?? "No event"}
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Risk Level: {dashboard?.eventRisk?.level ?? "--"}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-[#111827] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">News Impact</p>
            <h2 className="mt-2 text-2xl font-bold">
              {dashboard?.newsImpactSummary?.topAverageImpact ?? 0}
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Headlines tracked: {dashboard?.newsImpactSummary?.headlineCount ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-[#111827] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Sentiment Feed</p>
            <h2 className="mt-2 text-2xl font-bold">
              {dashboard?.sentimentSummary?.headlineCount ?? 0}
            </h2>
            <p className="mt-2 text-sm text-gray-400">Headlines classified</p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-gray-800 bg-[#111827] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Macro Briefing</p>
              <h2 className={`mt-2 text-2xl font-bold ${getToneColor(dashboard?.briefing?.macroTone)}`}>
                {dashboard?.briefing?.macroTone?.replaceAll("_", " ") ?? "NEUTRAL"}
              </h2>
            </div>
          </div>

          <p className="mt-4 text-base leading-8 text-gray-200">
            {dashboard?.briefing?.summary ?? "No macro briefing available."}
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-800 bg-[#0d1423] p-4">
              <h3 className="text-sm font-semibold text-cyan-300">Key Drivers</h3>
              <div className="mt-3 space-y-2">
                {(dashboard?.briefing?.keyDrivers ?? []).length > 0 ? (
                  dashboard!.briefing!.keyDrivers.map((item, i) => (
                    <div key={`${item}-${i}`} className="text-sm text-gray-300">
                      • {item}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">No major drivers.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-[#0d1423] p-4">
              <h3 className="text-sm font-semibold text-red-300">Risk Factors</h3>
              <div className="mt-3 space-y-2">
                {(dashboard?.briefing?.riskFactors ?? []).length > 0 ? (
                  dashboard!.briefing!.riskFactors.map((item, i) => (
                    <div key={`${item}-${i}`} className="text-sm text-gray-300">
                      • {item}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">No major risks flagged.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-[#0d1423] p-4">
              <h3 className="text-sm font-semibold text-green-300">Reversal Triggers</h3>
              <div className="mt-3 space-y-2">
                {(dashboard?.briefing?.reversalTriggers ?? []).length > 0 ? (
                  dashboard!.briefing!.reversalTriggers.map((item, i) => (
                    <div key={`${item}-${i}`} className="text-sm text-gray-300">
                      • {item}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">No reversal triggers listed.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-gray-800 bg-[#111827] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Flash News</h2>
            <span className="text-sm text-gray-400">Top market-moving headlines</span>
          </div>

          <div className="mt-4 space-y-3">
            {(dashboard?.newsImpactSummary?.topHeadlines ?? []).length > 0 ? (
              dashboard!.newsImpactSummary!.topHeadlines.slice(0, 6).map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  className="rounded-xl border border-gray-800 bg-[#0d1423] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-100 leading-6">
                        {item.title}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
                        <span>{item.source}</span>
                        <span>•</span>
                        <span>{item.category}</span>
                        <span>•</span>
                        <span>{item.sentimentLabel}</span>
                        <span>•</span>
                        <span>
                          {item.pubDate ? new Date(item.pubDate).toLocaleString() : "--"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`rounded-lg border px-3 py-1 text-xs font-semibold ${getImpactColor(
                          item.impactLabel
                        )}`}
                      >
                        {item.impactLabel}
                      </span>
                      <span className="text-xs text-gray-400">Impact {item.impactScore}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">No flash news available.</p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-800 bg-[#111827] p-6">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {assets.map((item) => (
                <button
                  key={item.asset}
                  onClick={() => setSelected(item.asset)}
                  className={`rounded-2xl border p-5 text-left shadow-lg transition ${
                    selected === item.asset
                      ? "border-cyan-500 bg-[#131c2f]"
                      : "border-gray-800 bg-[#111827] hover:bg-[#141b2b]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                        {item.asset}
                      </p>
                      <h2 className="mt-2 text-lg font-semibold">{labelMap[item.asset] || item.asset}</h2>
                    </div>
                    <span
                      className={`rounded-lg border px-3 py-1 text-xs font-semibold ${getBiasColor(
                        item.bias
                      )}`}
                    >
                      {item.bias}
                    </span>
                  </div>

                  <div className="mt-5">
                    <p className="text-3xl font-bold">
                      {typeof item.price === "number" ? item.price.toLocaleString() : "N/A"}
                    </p>
                    <p className={`mt-2 text-sm font-medium ${getChangeColor(item.change)}`}>
                      {typeof item.change === "number"
                        ? `${item.change >= 0 ? "+" : ""}${item.change.toFixed(2)}`
                        : "N/A"}
                      {" · "}
                      {typeof item.percent === "number" ? `${item.percent.toFixed(2)}%` : "N/A"}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-gray-400">Confidence</span>
                    <span className="text-sm font-semibold">{item.confidence}%</span>
                  </div>

                  <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[#1f2937]">
                    <div
                      className="h-full bg-cyan-300"
                      style={{ width: `${item.confidence}%` }}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-gray-400">Expected Move</span>
                    <span className={getChangeColor(item.movePoints)}>{item.movePoints}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-12">
              <div className="xl:col-span-7 rounded-2xl border border-gray-800 bg-[#111827] p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">{labelMap[selected] || selected}</p>
                    <h2 className="mt-1 text-3xl font-bold">{selected}</h2>
                  </div>

                  <div
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold ${getBiasColor(
                      selectedAsset?.bias
                    )}`}
                  >
                    {selectedAsset?.bias || "No Bias"}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-gray-800 bg-[#0d1423] p-4">
                    <p className="text-sm text-gray-400">Confidence</p>
                    <p className="mt-2 text-3xl font-bold">{selectedAsset?.confidence ?? "--"}%</p>
                  </div>
                  <div className="rounded-2xl border border-gray-800 bg-[#0d1423] p-4">
                    <p className="text-sm text-gray-400">Score</p>
                    <p className="mt-2 text-3xl font-bold">{selectedAsset?.score ?? "--"}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-800 bg-[#0d1423] p-4">
                    <p className="text-sm text-gray-400">Expected Move</p>
                    <p className={`mt-2 text-3xl font-bold ${getChangeColor(selectedAsset?.movePoints)}`}>
                      {selectedAsset?.movePoints ?? "--"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-gray-800 bg-[#0d1423] p-5">
                  <h3 className="text-lg font-semibold text-cyan-300">Bias Analysis</h3>
                  <p className="mt-3 text-base leading-8 text-gray-200">
                    {selectedAsset?.analysis || "No analysis available."}
                  </p>
                </div>

                <WhyBiasSection
                  asset={selectedAsset}
                  regime={dashboard?.regime}
                  eventRisk={dashboard?.eventRisk}
                  topHeadlines={dashboard?.newsImpactSummary?.topHeadlines ?? []}
                />

                <div className="mt-6 rounded-2xl border border-gray-800 bg-[#0d1423] p-5">
                  <h3 className="text-lg font-semibold">History Charts</h3>
                  <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <MiniChartCard
                      title="Confidence"
                      values={historySummary?.chartPoints.map((p) => p.confidence) ?? []}
                      labels={historySummary?.chartPoints.map((p) => formatShortTime(p.generatedAt)) ?? []}
                      valueColor="text-cyan-300"
                    />
                    <MiniChartCard
                      title="Score"
                      values={historySummary?.chartPoints.map((p) => p.score) ?? []}
                      labels={historySummary?.chartPoints.map((p) => formatShortTime(p.generatedAt)) ?? []}
                      valueColor="text-yellow-300"
                    />
                    <MiniChartCard
                      title="Expected Move"
                      values={historySummary?.chartPoints.map((p) => p.movePoints) ?? []}
                      labels={historySummary?.chartPoints.map((p) => formatShortTime(p.generatedAt)) ?? []}
                      valueColor="text-green-300"
                    />
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-gray-800 bg-[#0d1423] p-5">
                  <h3 className="text-lg font-semibold">Bias History Snapshot</h3>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-sm text-gray-400">Previous Bias</p>
                      <p className="mt-1 text-lg font-semibold">
                        {historySummary?.latestChange?.previousBias ?? "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Confidence Δ</p>
                      <p className="mt-1 text-lg font-semibold">
                        {historySummary?.latestChange?.confidenceDelta ?? "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Score Δ</p>
                      <p className="mt-1 text-lg font-semibold">
                        {historySummary?.latestChange?.scoreDelta ?? "--"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="mb-3 text-sm text-gray-400">Recent Shifts</p>
                    <div className="space-y-2">
                      {(historySummary?.shifts ?? []).slice(-6).reverse().map((shift, i) => (
                        <div
                          key={`${shift.generatedAt}-${i}`}
                          className="rounded-xl border border-gray-800 bg-[#111827] px-3 py-2 text-sm text-gray-300"
                        >
                          {shift.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="xl:col-span-5 space-y-4">
                <div className="rounded-2xl border border-gray-800 bg-[#111827] p-6">
                  <h3 className="text-lg font-semibold">Confluence Drivers</h3>
                  <div className="mt-4 space-y-3">
                    {(selectedAsset?.drivers ?? []).length > 0 ? (
                      selectedAsset!.drivers.map((driver, index) => (
                        <div
                          key={`${driver.label}-${index}`}
                          className={`rounded-xl border p-3 ${getDriverColor(driver.direction)}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{driver.label}</p>
                              <p className="mt-1 text-xs opacity-80">
                                {driver.direction} · count {driver.count}
                              </p>
                            </div>
                            <div className="text-right text-xs opacity-90">
                              weight {driver.weight}
                            </div>
                          </div>

                          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/20">
                            <div
                              className={`h-full ${
                                driver.direction === "positive"
                                  ? "bg-green-400"
                                  : driver.direction === "negative"
                                  ? "bg-red-400"
                                  : "bg-gray-400"
                              }`}
                              style={{ width: getImpactBarWidth(driver.weight) }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">No drivers detected yet.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-800 bg-[#111827] p-6">
                  <h3 className="text-lg font-semibold">Top News Impact</h3>
                  <div className="mt-4 space-y-3">
                    {(dashboard?.newsImpactSummary?.topHeadlines ?? []).slice(0, 5).map((item, i) => (
                      <div
                        key={`${item.title}-${i}`}
                        className="rounded-xl border border-gray-800 bg-[#0d1423] p-3"
                      >
                        <p className="text-sm font-semibold text-gray-100">{item.title}</p>
                        <p className="mt-2 text-xs text-gray-400">
                          {item.category} · {item.impactLabel} · impact {item.impactScore}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-800 bg-[#111827] p-6">
                  <h3 className="text-lg font-semibold">Latest Bias Shifts</h3>
                  <div className="mt-4 space-y-3">
                    {biasShifts.slice(0, 8).map((shift, i) => (
                      <div
                        key={`${shift.asset}-${shift.generatedAt}-${i}`}
                        className="rounded-xl border border-gray-800 bg-[#0d1423] p-3 text-sm text-gray-300"
                      >
                        <p className="font-semibold text-gray-100">{shift.label}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          {new Date(shift.generatedAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
          </>
        ) : activeView === "upcoming-news" ? (
          <UpcomingNewsView
            calendar={calendar}
            newsImpact={newsImpact}
            systemStatus={systemStatus}
            loading={upcomingLoading}
            now={now}
            mounted={mounted}
            currencyFilter={newsCurrencyFilter}
            impactFilter={newsImpactFilter}
            expandedEventKeys={expandedEventKeys}
            onCurrencyFilterChange={setNewsCurrencyFilter}
            onImpactFilterChange={setNewsImpactFilter}
            onToggleEvent={(key) => {
              setExpandedEventKeys((current) =>
                current.includes(key)
                  ? current.filter((item) => item !== key)
                  : [...current, key]
              );
            }}
            onRefresh={() => fetchUpcomingNewsData().catch(console.error)}
          />
        ) : activeView === "evaluations" ? (
          <EvaluationsView
            evaluations={evaluations}
            overallEvaluations={overallEvaluations}
            postMortem={postMortem}
            loading={evaluationsLoading}
            assetFilter={evaluationAsset}
            verdictFilter={evaluationVerdict}
            selectedEvaluationId={selectedEvaluationId}
            onAssetFilterChange={setEvaluationAsset}
            onVerdictFilterChange={setEvaluationVerdict}
            onSelectEvaluation={setSelectedEvaluationId}
            onRefresh={() => fetchEvaluationsData().catch(console.error)}
          />
        ) : (
          <PlaceholderView view={activeView} />
        )}
      </div>
    </main>
  );
}

function AppShellHeader({
  activeView,
  menuOpen,
  onToggleMenu,
  onSelectView,
}: {
  activeView: AppView;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onSelectView: (view: AppView) => void;
}) {
  const activeLabel = navItems.find((item) => item.id === activeView)?.label ?? "Dashboard";

  return (
    <div className="relative mb-6">
      <div className="flex items-center justify-between rounded-2xl border border-gray-800 bg-[#111827] px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMenu}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-xl border border-gray-700 bg-[#0d1423] transition hover:border-cyan-500"
            aria-label="Open navigation"
          >
            <span className="h-0.5 w-5 rounded-full bg-gray-200" />
            <span className="h-0.5 w-5 rounded-full bg-gray-200" />
            <span className="h-0.5 w-5 rounded-full bg-gray-200" />
          </button>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Trading AI Platform</p>
            <p className="text-lg font-semibold">{activeLabel}</p>
          </div>
        </div>

        <div className="h-10 w-10" aria-hidden="true" />
      </div>

      {menuOpen ? (
        <div className="absolute left-0 top-16 z-20 w-72 rounded-2xl border border-gray-800 bg-[#111827] p-3 shadow-2xl">
          <div className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={() => onSelectView(item.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  activeView === item.id
                    ? "border-cyan-500 bg-cyan-950/30 text-cyan-200"
                    : "border-gray-800 bg-[#0d1423] text-gray-300"
                } ${item.disabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                {item.label}
                {item.disabled ? " · Coming soon" : ""}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BiasLoggingCard({
  systemStatus,
  logStatus,
}: {
  systemStatus: SystemStatus | null;
  logStatus: {
    state: "idle" | "saving" | "saved" | "error";
    message: string;
  };
}) {
  const latest = systemStatus?.latestBiasRun ?? null;
  const statusText =
    logStatus.message ||
    "Save the current deterministic snapshot into the append-only experiment log.";

  return (
    <div className="mb-6 rounded-2xl border border-gray-800 bg-[#111827] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Experiment Logging</p>
          <h2 className="mt-2 text-xl font-semibold">Bias Run Audit Trail</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-gray-300">
            Saving records the full research snapshot: market prices, source health, weighted news matches,
            calendar risk, technical context, formula components, and final bias output. Live dashboard refreshes
            do not automatically save rows.
          </p>
        </div>

        <StatusPill
          status={
            logStatus.state === "error"
              ? "ERROR"
              : logStatus.state === "saved"
                ? "OK"
                : latest?.runId
                  ? "READY"
                  : "IDLE"
          }
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard
          label="Last Saved Run"
          value={latest?.runId ? `#${latest.runId}` : "--"}
          helper={latest?.loggedAt ? formatDateTime(latest.loggedAt) : "no saved run this session"}
        />
        <MetricCard
          label="Saved Assets"
          value={latest?.assetCount ?? "--"}
          helper={`${latest?.headlineCount ?? "--"} headlines captured`}
        />
        <MetricCard
          label="Save Status"
          value={logStatus.state === "idle" ? "Ready" : logStatus.state}
          helper={statusText}
        />
      </div>
    </div>
  );
}

function DataSourceHealthCard({ systemStatus }: { systemStatus: SystemStatus | null }) {
  const newsSources = systemStatus?.dataSources?.news ?? [];
  const calendar = systemStatus?.dataSources?.calendar ?? null;
  const degraded = isDataDegraded(systemStatus);

  return (
    <div className="mb-6 rounded-2xl border border-gray-800 bg-[#111827] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Data Source Health</p>
          <h2 className="mt-2 text-xl font-semibold">
            {degraded ? "Degraded data sources" : "Sources operational"}
          </h2>
        </div>

        <span
          className={`w-fit rounded-xl border px-3 py-1 text-xs font-semibold ${
            degraded
              ? "border-yellow-700 bg-yellow-900/20 text-yellow-300"
              : "border-green-700 bg-green-900/20 text-green-300"
          }`}
        >
          {degraded ? "Warning" : "Healthy"}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-800 bg-[#0d1423] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Database</p>
            <StatusPill status={systemStatus?.database?.connected ? "OK" : "ERROR"} />
          </div>
          <p className="mt-3 text-sm text-gray-400">
            Bias rows: {systemStatus?.database?.biasHistoryRows ?? "--"}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Run rows: {systemStatus?.database?.biasRunRows ?? "--"}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-[#0d1423] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Economic Calendar</p>
            <StatusPill status={calendar?.status ?? "UNKNOWN"} />
          </div>
          <p className="mt-3 text-sm text-gray-400">
            Source: {calendar?.name ?? "--"}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Events: {calendar?.eventCount ?? "--"} · Upcoming: {calendar?.upcomingCount ?? "--"}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Checked: {formatHealthTime(calendar?.checkedAt)}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-[#0d1423] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">News Feeds</p>
            <span className="text-xs text-gray-400">
              {newsSources.filter((source) => source.status === "OK").length}/{newsSources.length || "--"} OK
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {newsSources.length > 0 ? (
              newsSources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#111827] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-200">{source.name}</p>
                    <p className="text-xs text-gray-500">
                      Items: {source.itemCount ?? 0} · Checked: {formatHealthTime(source.checkedAt)}
                    </p>
                  </div>
                  <StatusPill status={source.status} />
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">No source status loaded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const className =
    normalized === "OK"
      ? "border-green-700 bg-green-900/20 text-green-300"
      : normalized === "DISABLED"
        ? "border-gray-700 bg-gray-800 text-gray-300"
        : normalized === "UNKNOWN"
          ? "border-gray-700 bg-[#111827] text-gray-400"
          : "border-yellow-700 bg-yellow-900/20 text-yellow-300";

  return (
    <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {normalized}
    </span>
  );
}

function PlaceholderView({ view }: { view: AppView }) {
  const labels: Record<AppView, { title: string; subtitle: string }> = {
    dashboard: {
      title: "Dashboard",
      subtitle: "Live market bias dashboard.",
    },
    "upcoming-news": {
      title: "Upcoming News",
      subtitle: "Economic calendar and headline detail view will be built in PR #6.",
    },
    evaluations: {
      title: "Evaluations",
      subtitle: "Bias evaluation and post-mortem UI will be built in PR #7.",
    },
    "ai-analysis": {
      title: "AI Analysis",
      subtitle: "Coming soon after the input and review workflows are stable.",
    },
  };

  return (
    <div className="rounded-2xl border border-gray-800 bg-[#111827] p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Workspace</p>
      <h1 className="mt-3 text-3xl font-bold">{labels[view].title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-300">{labels[view].subtitle}</p>
    </div>
  );
}

function WhyBiasSection({
  asset,
  regime,
  eventRisk,
  topHeadlines,
}: {
  asset: AssetCard | null;
  regime?: DashboardResponse["regime"];
  eventRisk?: DashboardResponse["eventRisk"];
  topHeadlines: FlashNewsItem[];
}) {
  const assetHeadlines = topHeadlines.filter((item) => {
    const title = item.title.toLowerCase();
    return title.includes(asset?.asset.toLowerCase() ?? "") || title.includes("fed") || title.includes("inflation");
  });
  const scoreMeaning = explainScore(asset?.score);

  return (
    <div className="mt-6 rounded-2xl border border-gray-800 bg-[#0d1423] p-5">
      <h3 className="text-lg font-semibold text-cyan-300">Why This Bias?</h3>
      <p className="mt-3 text-sm leading-7 text-gray-300">
        Score is directional pressure: positive is bullish pressure, negative is bearish pressure,
        and near zero is mixed or neutral. Current score: {asset?.score ?? "--"} ({scoreMeaning}).
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <BiasContributor
          label="News Bias"
          value={asset?.newsBias?.bias ?? "Neutral"}
          helper={`Weighted headline matches: source reliability, category importance, and asset relevance. ${asset?.newsBias?.confidence ?? 0}% confidence, score ${asset?.newsBias?.score ?? 0}`}
        />
        <BiasContributor
          label="Technical Bias"
          value={asset?.technicalBias?.bias ?? "Neutral"}
          helper={`Live market context: asset momentum, ES/NQ, VIX, DXY, oil, US10Y, gold, and macro regime. ${asset?.technicalBias?.confidence ?? 0}% confidence, score ${asset?.technicalBias?.score ?? 0}`}
        />
        <BiasContributor
          label="Combined Bias"
          value={asset?.combinedBias?.bias ?? asset?.bias ?? "Neutral"}
          helper={`News score + technical score + cross-asset confluence. Event risk can reduce confidence and increase expected-move risk.`}
        />
        <BiasContributor
          label="Macro Regime"
          value={regime?.regime?.replaceAll("_", " ") ?? "--"}
          helper={`${regime?.confidence ?? "--"}% regime confidence`}
        />
        <BiasContributor
          label="Event Risk"
          value={eventRisk?.level ?? "--"}
          helper={`${eventRisk?.nextEvent?.title ?? "No next event"}${eventRisk?.score !== undefined ? `, score ${eventRisk.score}` : ""}`}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div>
          <p className="text-sm font-semibold text-gray-100">Matched News Headlines</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            News Bias is calculated from weighted headline matches. Each match is adjusted by
            source reliability, category importance, and asset relevance.
          </p>
          <div className="mt-3 space-y-2">
            {(asset?.newsBias?.matchedHeadlines ?? []).slice(0, 5).map((headline, index) => (
              <div
                key={`${headline.title}-${index}`}
                className="rounded-xl border border-gray-800 bg-[#111827] px-3 py-2"
              >
                <p className="text-sm leading-6 text-gray-300">{headline.title}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {headline.source ?? "--"} | source {formatWeight(headline.sourceWeight)} |
                  category {headline.category ?? "GENERAL"} {formatWeight(headline.categoryWeight)}
                </p>
                <div className="mt-2 space-y-1">
                  {(headline.matches ?? []).map((match, matchIndex) => (
                    <p key={`${match.keyword}-${matchIndex}`} className="text-xs text-gray-400">
                      {match.direction} &quot;{match.keyword}&quot; | relevance {formatWeight(match.assetRelevanceWeight)} |
                      contribution {formatSignedNumber(match.contribution)}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {(asset?.newsBias?.matchedHeadlines ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No weighted headline matches for this asset yet.</p>
            ) : null}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-100">Technical Snapshot</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Technical Bias is calculated from live percentage moves and cross-market context.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {Object.entries(asset?.technicalBias?.snapshot ?? {}).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-gray-800 bg-[#111827] px-3 py-2">
                <p className="text-xs uppercase tracking-[0.14em] text-gray-500">{key}</p>
                <p className={`mt-1 text-sm font-semibold ${getSignedValueColor(value)}`}>
                  {formatSignedNumber(value)}%
                </p>
              </div>
            ))}
            {Object.keys(asset?.technicalBias?.snapshot ?? {}).length === 0 ? (
              <p className="col-span-2 text-sm text-gray-400">No technical snapshot loaded yet.</p>
            ) : null}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-100">Confluence Drivers</p>
          <div className="mt-3 space-y-2">
            {(asset?.drivers ?? []).slice(0, 6).map((driver, index) => (
              <div
                key={`${driver.label}-${index}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#111827] px-3 py-2 text-sm"
              >
                <span className="text-gray-300">{driver.label}</span>
                <span className="text-xs text-gray-500">{driver.direction} | {driver.weight}</span>
              </div>
            ))}
            {(asset?.drivers ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No confluence drivers logged for this asset yet.</p>
            ) : null}
          </div>
        </div>

      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-gray-100">Top Market Headlines</p>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {(assetHeadlines.length ? assetHeadlines : topHeadlines).slice(0, 4).map((item, index) => (
            <div
              key={`${item.title}-${index}`}
              className="rounded-xl border border-gray-800 bg-[#111827] px-3 py-2"
            >
              <p className="text-sm leading-6 text-gray-300">{item.title}</p>
              <p className="mt-1 text-xs text-gray-500">
                {item.category} | {item.impactLabel} | {item.sentimentLabel}
              </p>
            </div>
          ))}
          {topHeadlines.length === 0 ? (
            <p className="text-sm text-gray-400">No headline drivers loaded yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BiasContributor({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#111827] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{label}</p>
      <p className="mt-2 font-semibold text-gray-100">{value}</p>
      <p className="mt-1 text-sm text-gray-400">{helper}</p>
    </div>
  );
}

function UpcomingNewsView({
  calendar,
  newsImpact,
  systemStatus,
  loading,
  now,
  mounted,
  currencyFilter,
  impactFilter,
  expandedEventKeys,
  onCurrencyFilterChange,
  onImpactFilterChange,
  onToggleEvent,
  onRefresh,
}: {
  calendar: CalendarResponse | null;
  newsImpact: NewsImpactResponse | null;
  systemStatus: SystemStatus | null;
  loading: boolean;
  now: Date;
  mounted: boolean;
  currencyFilter: string;
  impactFilter: string;
  expandedEventKeys: string[];
  onCurrencyFilterChange: (value: string) => void;
  onImpactFilterChange: (value: string) => void;
  onToggleEvent: (key: string) => void;
  onRefresh: () => void;
}) {
  const calendarStatus = calendar?.source ?? systemStatus?.dataSources?.calendar ?? null;
  const events = calendar?.events ?? [];
  const calendarUnavailable = (calendarStatus?.status ?? "").toUpperCase() === "UNAVAILABLE";
  const currencyOptions = ["ALL", ...Array.from(new Set(events.map((event) => event.currency).filter(Boolean)))];
  const filteredEvents = events
    .filter((event) => currencyFilter === "ALL" || event.currency === currencyFilter)
    .filter((event) => impactFilter === "ALL" || event.impact === impactFilter)
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  const headlines = [...(newsImpact?.items ?? [])].sort((a, b) => b.impactScore - a.impactScore);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Upcoming News</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Economic Events & Market Headlines</h1>
          <p className="mt-2 text-sm text-gray-400">
            Calendar risk from ForexFactory/manual sources with market-moving headline context.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="w-fit rounded-xl border border-gray-700 bg-[#111827] px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-cyan-500"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <MetricCard label="Calendar Events" value={calendar?.count ?? 0} helper={`${calendar?.upcomingCount ?? 0} upcoming`} />
        <MetricCard
          label="Calendar Source"
          value={calendarStatus?.name ?? "--"}
          helper={`${calendarStatus?.status ?? "UNKNOWN"} | checked ${formatHealthTime(calendarStatus?.checkedAt)}`}
        />
        <MetricCard label="Headlines" value={newsImpact?.headlineCount ?? 0} helper="classified for impact" />
        <MetricCard label="Average Impact" value={newsImpact?.summary?.topAverageImpact ?? "--"} helper="top headline sample" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="rounded-2xl border border-gray-800 bg-[#111827] p-5 xl:col-span-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Economic Calendar</h2>
              <p className="mt-1 text-sm text-gray-400">
                Status {calendarStatus?.status ?? "UNKNOWN"} | checked {formatHealthTime(calendarStatus?.checkedAt)}
              </p>
              {calendarStatus?.error ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-yellow-300">
                  {calendarStatus.error}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={currencyFilter}
                onChange={(event) => onCurrencyFilterChange(event.target.value)}
                className="rounded-xl border border-gray-700 bg-[#0d1423] px-3 py-2 text-sm text-gray-200"
              >
                {currencyOptions.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency === "ALL" ? "All currencies" : currency}
                  </option>
                ))}
              </select>

              <select
                value={impactFilter}
                onChange={(event) => onImpactFilterChange(event.target.value)}
                className="rounded-xl border border-gray-700 bg-[#0d1423] px-3 py-2 text-sm text-gray-200"
              >
                <option value="ALL">All impact</option>
                <option value="red">High impact</option>
                <option value="orange">Medium-high</option>
                <option value="yellow">Medium</option>
                <option value="white">Low</option>
              </select>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {filteredEvents.length > 0 ? (
              filteredEvents.slice(0, 30).map((event, index) => (
                <CalendarEventRow
                  key={`${event.title}-${event.datetime}-${index}`}
                  event={event}
                  eventKey={buildEventKey(event, index)}
                  expanded={expandedEventKeys.includes(buildEventKey(event, index))}
                  now={now}
                  mounted={mounted}
                  onToggle={onToggleEvent}
                />
              ))
            ) : (
              <CalendarEmptyState
                unavailable={calendarUnavailable}
                status={calendarStatus?.status ?? "UNKNOWN"}
                error={calendarStatus?.error}
                checkedAt={calendarStatus?.checkedAt}
              />
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-[#111827] p-5 xl:col-span-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Market Headlines</h2>
              <p className="mt-1 text-sm text-gray-400">Ranked by impact score</p>
            </div>
            <StatusPill status={isDataDegraded(systemStatus) ? "DEGRADED" : "OK"} />
          </div>

          <div className="mt-5 space-y-3">
            {headlines.length > 0 ? (
              headlines.slice(0, 14).map((item, index) => (
                <HeadlineImpactRow key={`${item.title}-${index}`} item={item} />
              ))
            ) : (
              <p className="rounded-xl border border-gray-800 bg-[#0d1423] p-4 text-sm text-gray-400">
                No headline impact data loaded yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function EvaluationsView({
  evaluations,
  overallEvaluations,
  postMortem,
  loading,
  assetFilter,
  verdictFilter,
  selectedEvaluationId,
  onAssetFilterChange,
  onVerdictFilterChange,
  onSelectEvaluation,
  onRefresh,
}: {
  evaluations: EvaluationsResponse | null;
  overallEvaluations: EvaluationsResponse | null;
  postMortem: PostMortemResponse["postMortem"] | null;
  loading: boolean;
  assetFilter: string;
  verdictFilter: string;
  selectedEvaluationId: number | null;
  onAssetFilterChange: (value: string) => void;
  onVerdictFilterChange: (value: string) => void;
  onSelectEvaluation: (id: number) => void;
  onRefresh: () => void;
}) {
  const rows = evaluations?.evaluations ?? [];
  const overallSummary = overallEvaluations?.summary;
  const filtersActive = assetFilter !== "ALL" || verdictFilter !== "ALL";
  const selectedIndex = Math.max(0, rows.findIndex((row) => row.id === selectedEvaluationId));
  const selectedRow = rows[selectedIndex] ?? rows[0] ?? null;
  const selectedReviewRef = useRef<HTMLElement | null>(null);
  const [queuePanelHeight, setQueuePanelHeight] = useState<number | null>(null);

  useEffect(() => {
    const element = selectedReviewRef.current;
    if (!element) return;

    function updateHeight() {
      const nextHeight = element?.getBoundingClientRect().height ?? 0;
      setQueuePanelHeight(nextHeight > 0 ? nextHeight : null);
    }

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [selectedRow?.id, postMortem?.id, rows.length]);

  function selectByOffset(offset: number) {
    if (!rows.length) return;
    const currentIndex = selectedRow
      ? Math.max(0, rows.findIndex((row) => row.id === selectedRow.id))
      : 0;
    const nextIndex = Math.min(rows.length - 1, Math.max(0, currentIndex + offset));
    onSelectEvaluation(rows[nextIndex].id);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Evaluations</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Bias Review & Post-Mortems</h1>
          <p className="mt-2 text-sm text-gray-400">
            Current evaluations compare each saved /api/bias run against the next saved run
            for the same asset. Logging is manual/API-triggered for now, so holding period
            depends on when bias runs are created.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="w-fit rounded-xl border border-gray-700 bg-[#111827] px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-cyan-500"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <MetricCard label="Overall Predictions" value={overallSummary?.totalPredictions ?? "--"} helper="all stored evaluations" />
        <MetricCard label="Overall Direction" value={formatPercentMetric(overallSummary?.directionAccuracy)} helper="direction only" />
        <MetricCard label="Overall Move Fit" value={formatPercentMetric(overallSummary?.avgMoveAccuracy)} helper="magnitude accuracy" />
        <MetricCard
          label="Filtered Results"
          value={evaluations?.count ?? 0}
          helper={filtersActive ? `${assetFilter} / ${verdictFilter}` : "no filters active"}
        />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-12">
        <section
          className="flex min-h-0 flex-col rounded-2xl border border-gray-800 bg-[#111827] p-5 xl:col-span-4"
          style={queuePanelHeight ? { height: queuePanelHeight } : undefined}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Evaluation Queue</h2>
              <p className="mt-1 text-sm text-gray-400">
                {rows.length ? `${selectedIndex + 1} of ${rows.length}` : "0 rows"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={assetFilter}
                onChange={(event) => onAssetFilterChange(event.target.value)}
                className="rounded-xl border border-gray-700 bg-[#0d1423] px-3 py-2 text-sm text-gray-200"
              >
                <option value="ALL">All assets</option>
                {assetOrder.map((asset) => (
                  <option key={asset} value={asset}>
                    {asset}
                  </option>
                ))}
              </select>

              <select
                value={verdictFilter}
                onChange={(event) => onVerdictFilterChange(event.target.value)}
                className="rounded-xl border border-gray-700 bg-[#0d1423] px-3 py-2 text-sm text-gray-200"
              >
                <option value="ALL">All verdicts</option>
                <option value="wrong">Wrong</option>
                <option value="inconclusive">Inconclusive</option>
                <option value="correct">Correct</option>
              </select>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => selectByOffset(-1)}
              disabled={!rows.length || selectedIndex === 0}
              className="rounded-xl border border-gray-700 bg-[#0d1423] px-4 py-2 text-sm font-semibold text-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <div className="flex flex-wrap justify-center gap-1.5">
              {rows.slice(0, 12).map((row, index) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onSelectEvaluation(row.id)}
                  aria-label={`Select evaluation ${index + 1}`}
                  className={`h-2.5 w-2.5 rounded-full ${
                    selectedRow?.id === row.id ? "bg-cyan-300" : "bg-gray-700"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => selectByOffset(1)}
              disabled={!rows.length || selectedIndex >= rows.length - 1}
              className="rounded-xl border border-gray-700 bg-[#0d1423] px-4 py-2 text-sm font-semibold text-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>

          <div className="dark-scrollbar mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {rows.length > 0 ? (
              rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onSelectEvaluation(row.id)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    selectedEvaluationId === row.id
                      ? "border-cyan-500 bg-cyan-950/20"
                      : "border-gray-800 bg-[#0d1423] hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold">{row.asset}</p>
                        <BiasPill bias={row.bias} />
                        <DirectionPill result={getDirectionResult(row.evaluation)} />
                      </div>
                      <p className="mt-2 text-xs text-gray-500">{formatDateTime(row.generatedAt)}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold text-gray-100">{row.confidence}%</p>
                      <p className="text-xs text-gray-500">confidence</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-400">
                    <span>Score {row.score}</span>
                    <span>{formatExpectedMove(row.bias, row.movePoints)}</span>
                    <span>Actual {formatSignedNumber(row.evaluation?.actualMove)}</span>
                  </div>
                </button>
              ))
            ) : (
              <p className="rounded-xl border border-gray-800 bg-[#0d1423] p-4 text-sm text-gray-400">
                No evaluations match the current filters.
              </p>
            )}
          </div>
        </section>

        <section
          ref={selectedReviewRef}
          className="flex min-h-0 rounded-2xl border border-gray-800 bg-[#111827] p-5 xl:col-span-8"
        >
          {selectedRow ? (
            <SelectedEvaluationPanel row={selectedRow} postMortem={postMortem} />
          ) : (
            <div className="rounded-xl border border-gray-800 bg-[#0d1423] p-6 text-sm text-gray-400">
              Select an evaluated bias row to view the post-mortem.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function CalendarEventRow({
  event,
  eventKey,
  expanded,
  now,
  mounted,
  onToggle,
}: {
  event: CalendarEvent;
  eventKey: string;
  expanded: boolean;
  now: Date;
  mounted: boolean;
  onToggle: (key: string) => void;
}) {
  const affectedAssets = inferCalendarAffectedAssets(event);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onToggle(eventKey)}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key === "Enter" || keyEvent.key === " ") {
          keyEvent.preventDefault();
          onToggle(eventKey);
        }
      }}
      className="w-full rounded-xl border border-gray-800 bg-[#0d1423] p-4 text-left transition hover:border-gray-700"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ImpactDot impact={event.impact} />
            <span className="rounded-lg border border-gray-700 bg-[#111827] px-2.5 py-1 text-xs font-semibold text-gray-300">
              {event.currency || "--"}
            </span>
            <span className="text-xs text-gray-500">{formatDateTime(event.datetime)}</span>
          </div>
          <h3 className="mt-3 text-base font-semibold leading-6 text-gray-100">{event.title}</h3>
          <p className="mt-2 text-xs text-gray-500">
            {event.source ?? "calendar"} | {mounted ? formatTimeUntil(event.datetime, now) : "--"}
          </p>
        </div>

        <div className="grid min-w-64 grid-cols-3 gap-2 text-right text-xs">
          <EventValue label="Actual" value={event.actual} />
          <EventValue label="Forecast" value={event.forecast} />
          <EventValue label="Previous" value={event.previous} />
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 border-t border-gray-800 pt-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <EventValue label="Date / Time" value={formatDateTime(event.datetime)} />
            <EventValue label="Impact" value={formatImpactLabel(event.impact)} />
            <EventValue label="Affected Assets" value={affectedAssets.join(", ")} />
          </div>

          <p className="mt-4 text-sm leading-7 text-gray-300">
            {explainCalendarEvent(event)}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-lg border border-gray-800 bg-[#111827] px-3 py-1 text-xs text-gray-300">
              Source: {event.source ?? "calendar"}
            </span>
            {event.url ? (
              <a
                href={event.url}
                target="_blank"
                rel="noreferrer"
                onClick={(clickEvent) => clickEvent.stopPropagation()}
                className="rounded-lg border border-gray-800 bg-[#111827] px-3 py-1 text-xs text-cyan-300 hover:border-cyan-700"
              >
                Open source
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CalendarEmptyState({
  unavailable,
  status,
  error,
  checkedAt,
}: {
  unavailable: boolean;
  status: string;
  error?: string | null;
  checkedAt?: string;
}) {
  const message = unavailable
    ? "Calendar source unavailable. No fallback events loaded."
    : "No calendar events match the current filters.";

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0d1423] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-100">{message}</p>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            Status: {status}. Last checked: {formatHealthTime(checkedAt)}.
          </p>
        </div>
        <StatusPill status={status} />
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-yellow-800/60 bg-yellow-950/20 p-3 text-sm leading-6 text-yellow-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function HeadlineImpactRow({ item }: { item: NewsImpactItem }) {
  const assets = (item.impactedAssets ?? []).slice(0, 4);
  const content = (
    <div className="rounded-xl border border-gray-800 bg-[#0d1423] p-4 transition hover:border-gray-700">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-6 text-gray-100">{item.title}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
            <span>{item.source}</span>
            <span>|</span>
            <span>{item.category}</span>
            <span>|</span>
            <span>{item.sentimentLabel}</span>
            {assets.length > 0 ? (
              <>
                <span>|</span>
                <span>{assets.join(", ")}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <span className={`rounded-lg border px-3 py-1 text-xs font-semibold ${getHeadlineImpactClass(item.impactLabel)}`}>
            {item.impactLabel}
          </span>
          <p className="mt-2 text-xs text-gray-500">Impact {item.impactScore}</p>
        </div>
      </div>
    </div>
  );

  if (!item.link) return content;

  return (
    <a href={item.link} target="_blank" rel="noreferrer" className="block">
      {content}
    </a>
  );
}

function SelectedEvaluationPanel({
  row,
  postMortem,
}: {
  row: EvaluationRow;
  postMortem: PostMortemResponse["postMortem"] | null;
}) {
  const evaluation = row.evaluation;
  const direction = getDirectionResult(evaluation);
  const moveFit = getMoveFit(evaluation);
  const overall = getOverallReview(evaluation);
  const loadedPostMortem = postMortem?.id === row.id ? postMortem : null;

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold">{row.asset} Review</h2>
            <BiasPill bias={row.bias} />
            <ReviewPill label={overall.label} tone={overall.tone} />
          </div>
          <p className="mt-2 text-sm text-gray-400">
            Logged {formatDateTime(row.generatedAt)} | evaluated after {evaluation?.holdingPeriodMinutes ?? "--"} minutes
          </p>
        </div>

        <div className="text-left md:text-right">
          <p className="text-sm text-gray-400">Against</p>
          <p className="mt-1 font-semibold text-gray-100">
            next saved {row.asset} /api/bias run #{evaluation?.evaluatedAgainstId ?? "--"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Direction" value={direction.label} helper="direction result only" />
        <MetricCard label="Move Fit" value={moveFit.label} helper={formatPercentMetric(evaluation?.moveAccuracy)} />
        <MetricCard
          label="Expected Move"
          value={formatExpectedMove(row.bias, row.movePoints)}
          helper={`holding period ${evaluation?.holdingPeriodMinutes ?? "--"}m`}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard label="Predicted Row" value={formatDateTime(row.generatedAt)} helper={`row #${row.id}`} />
        <MetricCard
          label="Evaluated Against"
          value={formatDateTime(evaluation?.evaluatedAgainstAt)}
          helper={`row #${evaluation?.evaluatedAgainstId ?? "--"}`}
        />
        <MetricCard label="Holding Period" value={`${evaluation?.holdingPeriodMinutes ?? "--"}m`} helper="between saved runs" />
        <MetricCard label="Logging Source" value="/api/bias" helper="manual/API-triggered" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Actual Move" value={formatSignedNumber(evaluation?.actualMove)} helper={`${formatSignedNumber(evaluation?.actualMovePercent)}%`} />
        <MetricCard label="Score" value={row.score} helper={explainScore(row.score)} />
        <MetricCard label="Confidence" value={`${row.confidence}%`} helper="bias engine confidence" />
      </div>

      <div className="mt-5 rounded-xl border border-yellow-800/60 bg-yellow-950/20 p-4">
        <p className="text-sm leading-7 text-yellow-100">
          Direction checks whether price moved the expected way. Move Fit checks whether the size of the move
          matched the expected move. A correct direction can still have poor move fit.
        </p>
      </div>

      {loadedPostMortem ? (
        <PostMortemPanel postMortem={loadedPostMortem} />
      ) : (
        <div className="mt-5 rounded-xl border border-gray-800 bg-[#0d1423] p-6 text-sm text-gray-400">
          Loading post-mortem detail...
        </div>
      )}
    </div>
  );
}

function PostMortemPanel({ postMortem }: { postMortem: PostMortemResponse["postMortem"] }) {
  const evaluation = postMortem.evaluation;
  const direction = getDirectionResult(evaluation);
  const moveFit = getMoveFit(evaluation);
  const overall = getOverallReview(evaluation);

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold">{postMortem.asset} Post-Mortem</h2>
            <BiasPill bias={postMortem.bias} />
            <DirectionPill result={direction} />
            <MoveFitPill result={moveFit} />
            <ReviewPill label={overall.label} tone={overall.tone} />
          </div>
          <p className="mt-2 text-sm text-gray-400">{formatDateTime(postMortem.generatedAt)}</p>
        </div>

        <div className="text-left md:text-right">
          <p className="text-sm text-gray-400">Diagnosis</p>
          <p className="mt-1 font-semibold text-gray-100">{evaluation.diagnosis?.label ?? "--"}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard label="Predicted Move" value={formatExpectedMove(evaluation.predictedBias, evaluation.predictedMove)} helper={evaluation.predictedBias} />
        <MetricCard label="Actual Move" value={formatSignedNumber(evaluation.actualMove)} helper={`${formatSignedNumber(evaluation.actualMovePercent)}%`} />
        <MetricCard label="Move Fit" value={moveFit.label} helper={`${formatPercentMetric(evaluation.moveAccuracy)}, error ${formatCompactNumber(evaluation.moveError)}`} />
        <MetricCard label="Holding Period" value={`${evaluation.holdingPeriodMinutes}m`} helper={`against saved run ${evaluation.evaluatedAgainstId}`} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Predicted Row Time" value={formatDateTime(postMortem.generatedAt)} helper={`row #${postMortem.id}`} />
        <MetricCard label="Evaluated Row Time" value={formatDateTime(evaluation.evaluatedAgainstAt)} helper={`row #${evaluation.evaluatedAgainstId}`} />
        <MetricCard label="Evaluation Basis" value="/api/bias run" helper="next saved run for same asset" />
      </div>

      <div className="mt-5 rounded-xl border border-gray-800 bg-[#0d1423] p-4">
        <h3 className="text-lg font-semibold text-cyan-300">What Happened</h3>
        <p className="mt-3 text-sm leading-7 text-gray-300">
          {evaluation.diagnosis?.summary ?? postMortem.analysis ?? "No diagnosis available."}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <BiasBreakdownCard title="News Bias" breakdown={postMortem.newsBias} />
        <BiasBreakdownCard title="Technical Bias" breakdown={postMortem.technicalBias} />
        <BiasBreakdownCard title="Combined Bias" breakdown={postMortem.combinedBias} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-[#0d1423] p-4">
          <h3 className="text-lg font-semibold">Drivers</h3>
          <div className="mt-3 space-y-2">
            {(postMortem.drivers ?? []).length > 0 ? (
              postMortem.drivers!.slice(0, 8).map((driver, index) => (
                <div key={`${driver.label}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-300">{driver.label}</span>
                  <span className="text-xs text-gray-500">{driver.direction} | {driver.weight}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">No drivers logged.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-[#0d1423] p-4">
          <h3 className="text-lg font-semibold">Manual Review Notes</h3>
          <p className="mt-3 text-sm leading-7 text-gray-300">
            Use this section to manually compare the prediction, drivers, market result,
            and decide whether the rule or theory needs adjustment.
          </p>
          <p className="mt-3 text-xs leading-5 text-gray-500">
            Note saving is intentionally left for a later logging workflow.
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-[#111827] p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-400">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold">{value}</p>
      <p className="mt-2 text-sm text-gray-400">{helper}</p>
    </div>
  );
}

function BiasBreakdownCard({
  title,
  breakdown,
}: {
  title: string;
  breakdown?: BiasBreakdown | null;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#0d1423] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        <BiasPill bias={breakdown?.bias ?? "Neutral"} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500">Confidence</p>
          <p className="mt-1 font-semibold text-gray-100">{breakdown?.confidence ?? "--"}%</p>
        </div>
        <div>
          <p className="text-gray-500">Score</p>
          <p className="mt-1 font-semibold text-gray-100">{breakdown?.score ?? "--"}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {(breakdown?.reasons ?? []).slice(0, 3).map((reason, index) => (
          <p key={`${reason.text}-${index}`} className="text-xs leading-5 text-gray-400">
            {reason.text}
          </p>
        ))}
      </div>
    </div>
  );
}

function EventValue({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-[#111827] px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500">{label}</p>
      <p className="mt-1 truncate font-semibold text-gray-200">{value || "--"}</p>
    </div>
  );
}

function ImpactDot({ impact }: { impact: string }) {
  const className =
    impact === "red"
      ? "bg-red-400"
      : impact === "orange"
        ? "bg-orange-400"
        : impact === "yellow"
          ? "bg-yellow-300"
          : "bg-gray-500";

  return (
    <span className="flex items-center gap-2 text-xs font-semibold text-gray-300">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {formatImpactLabel(impact)}
    </span>
  );
}

function BiasPill({ bias }: { bias: string }) {
  const className =
    bias === "Bullish"
      ? "border-green-700 bg-green-900/20 text-green-300"
      : bias === "Bearish"
        ? "border-red-700 bg-red-900/20 text-red-300"
        : "border-yellow-700 bg-yellow-900/20 text-yellow-300";

  return (
    <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${className}`}>
      {bias}
    </span>
  );
}

function DirectionPill({ result }: { result: ReviewToneResult }) {
  return <ReviewPill label={`Direction: ${result.label}`} tone={result.tone} />;
}

function MoveFitPill({ result }: { result: ReviewToneResult }) {
  return <ReviewPill label={`Move Fit: ${result.label}`} tone={result.tone} />;
}

function ReviewPill({ label, tone }: { label: string; tone: ReviewTone }) {
  const className =
    tone === "good"
      ? "border-green-700 bg-green-900/20 text-green-300"
      : tone === "bad"
        ? "border-red-700 bg-red-900/20 text-red-300"
        : tone === "warn"
          ? "border-yellow-700 bg-yellow-900/20 text-yellow-300"
          : "border-gray-700 bg-gray-800 text-gray-300";

  return (
    <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function MiniChartCard({
  title,
  values,
  labels,
  valueColor,
}: {
  title: string;
  values: number[];
  labels: string[];
  valueColor: string;
}) {
  const latest = values.length ? values[values.length - 1] : null;
  const path = buildLinePath(values, 240, 90);

  return (
    <div className="rounded-2xl border border-gray-800 bg-[#111827] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{title}</p>
        <p className={`text-sm font-semibold ${valueColor}`}>
          {latest !== null ? formatCompactNumber(latest) : "--"}
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-gray-800 bg-[#0a0f1a] p-3">
        <svg viewBox="0 0 240 90" className="h-24 w-full">
          <path d="M0 89 H240" stroke="#1f2937" strokeWidth="1" fill="none" />
          <path d={path} stroke="currentColor" strokeWidth="2.5" fill="none" className={valueColor} />
        </svg>

        <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
          <span>{labels[0] ?? "--"}</span>
          <span>{labels[labels.length - 1] ?? "--"}</span>
        </div>
      </div>
    </div>
  );
}

function buildLinePath(values: number[], width: number, height: number) {
  if (!values.length) return "";
  if (values.length === 1) {
    const y = height / 2;
    return `M 0 ${y} L ${width} ${y}`;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });

  return `M ${points.join(" L ")}`;
}

function formatShortTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCompactNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatHealthTime(value?: string) {
  if (!value) return "--";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeUntil(value: string, now: Date) {
  const eventTime = new Date(value).getTime();
  if (Number.isNaN(eventTime)) return "--";

  const diffMinutes = Math.round((eventTime - now.getTime()) / 60000);
  if (Math.abs(diffMinutes) < 1) return "now";
  if (diffMinutes < 0) return `${formatDuration(Math.abs(diffMinutes))} ago`;
  return `in ${formatDuration(diffMinutes)}`;
}

function formatSignedNumber(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  const formatted = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(2);
  return `${value >= 0 ? "+" : ""}${formatted}`;
}

function formatWeight(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return value.toFixed(2);
}

function getSignedValueColor(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "text-gray-300";
  if (value > 0) return "text-green-300";
  if (value < 0) return "text-red-300";
  return "text-gray-300";
}

function formatExpectedMove(bias?: string, move?: number | null) {
  if (typeof move !== "number" || Number.isNaN(move)) return "--";
  const absMove = Math.abs(move);
  const formatted = absMove >= 100 ? absMove.toFixed(0) : absMove.toFixed(2);

  if (bias === "Bearish") return `${formatted} pts downside`;
  if (bias === "Bullish") return `${formatted} pts upside`;
  return `${formatted} pts range`;
}

function formatPercentMetric(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  const normalized = value <= 1 ? value * 100 : value;
  return `${normalized.toFixed(1)}%`;
}

function formatImpactLabel(value: string) {
  if (value === "red") return "High";
  if (value === "orange") return "Medium-high";
  if (value === "yellow") return "Medium";
  if (value === "white") return "Low";
  return value || "--";
}

function getHeadlineImpactClass(value?: string) {
  if (value === "EXTREME") return "text-red-300 bg-red-900/30 border-red-700";
  if (value === "HIGH") return "text-orange-300 bg-orange-900/30 border-orange-700";
  if (value === "MEDIUM") return "text-yellow-300 bg-yellow-900/20 border-yellow-700";
  return "text-gray-300 bg-gray-800 border-gray-700";
}

function getDirectionResult(evaluation?: EvaluationDetail): ReviewToneResult {
  if (!evaluation) return { label: "Pending", tone: "neutral" };
  if (evaluation.verdict === "correct") return { label: "Correct", tone: "good" };
  if (evaluation.verdict === "wrong") return { label: "Wrong", tone: "bad" };
  return { label: "Inconclusive", tone: "warn" };
}

function getMoveFit(evaluation?: EvaluationDetail): ReviewToneResult {
  const accuracy = evaluation?.moveAccuracy;
  if (typeof accuracy !== "number") return { label: "Pending", tone: "neutral" };
  if (accuracy >= 70) return { label: "Good", tone: "good" };
  if (accuracy >= 35) return { label: "Fair", tone: "warn" };
  return { label: "Poor", tone: "bad" };
}

function getOverallReview(evaluation?: EvaluationDetail): ReviewToneResult {
  const direction = getDirectionResult(evaluation);
  const moveFit = getMoveFit(evaluation);

  if (!evaluation) return { label: "Pending Review", tone: "neutral" };
  if (direction.tone === "bad") return { label: "Direction Failed", tone: "bad" };
  if (direction.tone === "warn") return { label: "Needs More Data", tone: "warn" };
  if (moveFit.tone === "bad") return { label: "Direction OK, Move Poor", tone: "warn" };
  if (moveFit.tone === "warn") return { label: "Direction OK, Move Fair", tone: "warn" };
  return { label: "Confirmed", tone: "good" };
}

function explainScore(value?: number | null) {
  if (typeof value !== "number") return "no score loaded";
  if (value > 1) return "bullish pressure";
  if (value < -1) return "bearish pressure";
  return "neutral or mixed pressure";
}

function buildEventKey(event: CalendarEvent, index: number) {
  return `${event.datetime}-${event.currency}-${event.title}-${index}`;
}

function inferCalendarAffectedAssets(event: CalendarEvent) {
  const currency = event.currency?.toUpperCase();
  if (currency === "USD") return ["ES", "NQ", "YM", "GOLD", "DXY", "USOIL"];
  if (currency === "EUR" || currency === "GBP" || currency === "JPY") return ["DXY", "GOLD", "ES", "NQ"];
  if (currency === "CAD") return ["DXY", "USOIL", "GOLD"];
  return ["ES", "NQ", "GOLD", "DXY"];
}

function explainCalendarEvent(event: CalendarEvent) {
  const impact = formatImpactLabel(event.impact).toLowerCase();
  const assets = inferCalendarAffectedAssets(event).join(", ");
  const title = event.title || "This event";

  if (event.currency?.toUpperCase() === "USD") {
    return `${title} can change US rate, dollar, index, metals, and oil expectations. A ${impact} reading can affect ${assets}, especially when actual data differs from forecast.`;
  }

  return `${title} can shift currency and macro risk expectations. A ${impact} reading may affect ${assets}, especially when actual data surprises versus forecast or previous values.`;
}

function isDataDegraded(systemStatus: SystemStatus | null) {
  if (!systemStatus) return true;

  const databaseDown = !systemStatus.database?.connected;
  const newsSources = systemStatus.dataSources?.news ?? [];
  const calendar = systemStatus.dataSources?.calendar;
  const newsDegraded = newsSources.some((source) => source.status === "ERROR");
  const calendarDegraded =
    calendar?.status === "ERROR" ||
    calendar?.status === "UNAVAILABLE" ||
    calendar?.status === "STALE";

  return databaseDown || newsDegraded || calendarDegraded;
}

function formatUtcClock(date: Date) {
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function getSessionInfos(now: Date): SessionInfo[] {
  const totalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  return [
    buildSessionInfo("Asia", totalMinutes, 0, 9 * 60),
    buildSessionInfo("London", totalMinutes, 8 * 60, 17 * 60),
    buildSessionInfo("New York", totalMinutes, 13 * 60 + 30, 20 * 60),
  ];
}

function buildSessionInfo(
  name: string,
  nowMinutes: number,
  openMinutes: number,
  closeMinutes: number
): SessionInfo {
  const isRunning = nowMinutes >= openMinutes && nowMinutes < closeMinutes;

  if (isRunning) {
    const remaining = closeMinutes - nowMinutes;
    return {
      name,
      status: "RUNNING",
      message: `Running — ends in ${formatDuration(remaining)}`,
    };
  }

  const minutesUntilOpen =
    nowMinutes < openMinutes
      ? openMinutes - nowMinutes
      : 24 * 60 - nowMinutes + openMinutes;

  return {
    name,
    status: "CLOSED",
    message: `Closed — opens in ${formatDuration(minutesUntilOpen)}`,
  };
}

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}
