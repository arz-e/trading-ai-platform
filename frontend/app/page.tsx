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
  components?: Array<{
    key: string;
    label: string;
    direction: string;
    weight: number;
    contribution: number;
    rawValue?: unknown;
    threshold?: string | null;
    explanation?: string;
  }>;
  context?: Record<string, unknown> | null;
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
  flow?: FlowRow | null;
  newsFlowRelationship?: NewsFlowRelationship | null;
  optionsPressure?: OptionsPressureAsset | null;
  confluence?: AdvancedConfluence | null;
  trendState?: string | null;
  edgeScore?: number | null;
  watchReasons?: string[];
  avoidReasons?: string[];
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

type FlowRow = {
  asset: string;
  displayName: string;
  providerSymbol: string;
  riskBucket: string;
  relatedCoreAssets: string[];
  price: number | null;
  change: number | null;
  percent: number | null;
  volume?: number | null;
  flowScore: number;
  direction: "inflow" | "outflow" | "neutral";
  strength: "strong" | "moderate" | "weak" | "flat";
  reasons: string[];
};

type MarketFlowSnapshot = {
  generatedAt: string;
  status: string;
  riskTone: string;
  summary: string;
  rankedFlows: FlowRow[];
  inflows: FlowRow[];
  outflows: FlowRow[];
  contradictions?: Array<{ type?: string; message: string; assets?: string[] }>;
  dataQuality?: {
    availableRows: number;
    totalRows: number;
    staleRows: number;
    status: string;
  };
};

type NewsFlowRelationship = {
  relationship: string;
  confidence: number;
  confirmingHeadlines?: Array<{ title: string; source?: string; pubDate?: string }>;
  contradictingHeadlines?: Array<{ title: string; source?: string; pubDate?: string }>;
  explanatoryHeadlines?: Array<{ title: string; source?: string; pubDate?: string }>;
  unrelatedHeadlines?: Array<{ title: string; source?: string; pubDate?: string }>;
  reasons?: string[];
};

type OptionsPressureAsset = {
  asset: string;
  status: string;
  pressureState: string;
  trendImpact: string;
  reason: string;
};

type OptionsPressureSnapshot = {
  generatedAt: string;
  status: string;
  summary: string;
  assets: OptionsPressureAsset[];
};

type AdvancedConfluence = {
  asset: string;
  finalBias: string;
  confidence: number;
  edgeScore: number;
  trendState: string;
  flowAlignment: string;
  newsAlignment: string;
  macroAlignment: string;
  optionsPressureAlignment: string;
  eventRiskAdjustment?: { score: number; level: string; reasons?: string[] };
  components: Array<{ key: string; label: string; weight: number; score: number }>;
  contradictions: string[];
  watchReasons: string[];
  avoidReasons: string[];
  reasons: string[];
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
  marketFlow?: MarketFlowSnapshot;
  optionsPressure?: OptionsPressureSnapshot;
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
    marketProviders?: Record<string, SourceStatus & {
      configured?: boolean;
      available?: boolean;
    }>;
  };
  watchlist?: {
    enabledCount: number;
    providers: Record<string, number>;
    generatedAt: string;
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

type WatchlistItem = {
  id: number;
  symbol: string;
  displayName?: string;
  assetClass: string;
  provider: string;
  providerSymbol: string;
  enabled: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
};

type WatchlistQuote = WatchlistItem & {
  price: number | null;
  change: number | null;
  percent: number | null;
  high?: number | null;
  low?: number | null;
  open?: number | null;
  previousClose?: number | null;
  dayRange?: string | null;
  timestamp?: string;
  status: string;
  quoteStatus?: string;
  error?: string | null;
  raw?: Record<string, unknown>;
};

type WatchlistResponse = {
  count: number;
  items: WatchlistItem[];
  generatedAt: string;
};

type WatchlistQuotesResponse = {
  count: number;
  quotes: WatchlistQuote[];
  generatedAt: string;
};

type SymbolSearchResult = {
  symbol: string;
  displayName: string;
  assetClass: string;
  provider: string;
  providerSymbol: string;
};

type SymbolSearchResponse = {
  query: string;
  type: string;
  results: SymbolSearchResult[];
  providerStatus?: Record<string, { status?: string; error?: string | null }>;
  generatedAt: string;
};

type GroupedAsset = AssetCard & {
  symbol: string;
  name: string;
  currentPrice?: number;
  reasons?: string[];
  lastUpdated?: string;
  changePercent: number | null;
  quoteStatus?: string;
  isCustom: boolean;
  hasBiasData: boolean;
  provider?: string;
  providerSymbol?: string;
  assetClass?: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  previousClose?: number | null;
  dayRange?: string | null;
  quoteTimestamp?: string;
  quoteError?: string | null;
  watchlistId?: number;
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
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistQuotes, setWatchlistQuotes] = useState<WatchlistQuote[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [symbolQuery, setSymbolQuery] = useState("");
  const [symbolResults, setSymbolResults] = useState<SymbolSearchResult[]>([]);
  const [symbolSearchLoading, setSymbolSearchLoading] = useState(false);
  const [watchlistMessage, setWatchlistMessage] = useState("");
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
  const symbolSearchRequestId = useRef(0);

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

  async function fetchWatchlist() {
    const res = await fetch(`${API_BASE_URL}/api/watchlist`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch watchlist");
    const data: WatchlistResponse = await res.json();
    setWatchlist(data.items ?? []);
  }

  async function fetchWatchlistQuotes() {
    setWatchlistLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/watchlist/quotes`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch watchlist quotes");
      const data: WatchlistQuotesResponse = await res.json();
      setWatchlistQuotes(data.quotes ?? []);
    } finally {
      setWatchlistLoading(false);
    }
  }

  const performSymbolSearch = useCallback(async (value: string) => {
    const query = value.trim();
    const requestId = symbolSearchRequestId.current + 1;
    symbolSearchRequestId.current = requestId;

    if (!query) {
      setSymbolResults([]);
      setWatchlistMessage("");
      setSymbolSearchLoading(false);
      return;
    }

    setSymbolSearchLoading(true);
    setWatchlistMessage("");

    try {
      const params = new URLSearchParams({ query });
      const res = await fetch(`${API_BASE_URL}/api/symbol-search?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to search symbols");
      const data: SymbolSearchResponse = await res.json();
      if (requestId !== symbolSearchRequestId.current) return;
      setSymbolResults(data.results ?? []);
      const finnhubError = data.providerStatus?.finnhub?.error;
      if ((data.results ?? []).length === 0 && finnhubError) {
        setWatchlistMessage(finnhubError);
      }
    } catch (err) {
      if (requestId !== symbolSearchRequestId.current) return;
      console.error(err);
      setWatchlistMessage("Could not search symbols. Check backend provider status.");
    } finally {
      if (requestId === symbolSearchRequestId.current) {
        setSymbolSearchLoading(false);
      }
    }
  }, []);

  async function searchWatchlistSymbols() {
    await performSymbolSearch(symbolQuery);
  }

  async function addSymbolToWatchlist(result: SymbolSearchResult) {
    setWatchlistMessage("Adding symbol...");

    try {
      const res = await fetch(`${API_BASE_URL}/api/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      const data: { item?: WatchlistItem; error?: string } = await res.json();
      if (!res.ok) {
        const message = data.error ?? "Failed to add symbol";
        if (res.status === 409 || message.toLowerCase().includes("watchlist item already exists")) {
          setWatchlistMessage(`${result.symbol} is already in your watchlist.`);
          await Promise.all([fetchWatchlist(), fetchWatchlistQuotes(), fetchSystemStatus()]);
          return;
        }
        throw new Error(message);
      }
      setWatchlistMessage(`Added ${data.item?.symbol ?? result.symbol} to watchlist.`);
      setSymbolResults([]);
      await Promise.all([fetchWatchlist(), fetchWatchlistQuotes(), fetchSystemStatus()]);
    } catch (err) {
      console.error(err);
      setWatchlistMessage(err instanceof Error ? err.message : "Could not add symbol.");
    }
  }

  async function removeWatchlistItem(asset: GroupedAsset) {
    if (!asset.watchlistId || !asset.isCustom) return;
    setWatchlistMessage(`Removing ${asset.symbol}...`);

    try {
      const res = await fetch(`${API_BASE_URL}/api/watchlist/${asset.watchlistId}`, {
        method: "DELETE",
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to remove symbol");

      setWatchlistMessage(`Removed ${asset.symbol} from watchlist.`);
      await Promise.all([fetchWatchlist(), fetchWatchlistQuotes(), fetchSystemStatus()]);

      if (selected === asset.symbol) {
        setSelected(assetOrder[0]);
      }
    } catch (err) {
      console.error(err);
      setWatchlistMessage(err instanceof Error ? err.message : "Could not remove symbol.");
    }
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
        assetOrder.includes(selected) ? fetchHistory(selected) : Promise.resolve(),
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
        await Promise.all([
          fetchDashboard(),
          fetchBiasShifts(),
          fetchSystemStatus(),
          fetchWatchlist(),
          fetchWatchlistQuotes(),
        ]);
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
      fetchWatchlistQuotes().catch(console.error);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (assetOrder.includes(selected)) {
      fetchHistory(selected).catch(console.error);
    } else {
      setHistorySummary(null);
    }
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
    const query = symbolQuery.trim();

    if (!query) {
      symbolSearchRequestId.current += 1;
      setSymbolResults([]);
      setWatchlistMessage("");
      setSymbolSearchLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      performSymbolSearch(query).catch(console.error);
    }, 300);

    return () => clearTimeout(timer);
  }, [performSymbolSearch, symbolQuery]);

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

  const groupedAssets = useMemo(
    () => buildGroupedAssets(assets, watchlistQuotes),
    [assets, watchlistQuotes]
  );
  const selectedAsset = groupedAssets.find((a) => a.symbol === selected) ?? groupedAssets[0] ?? null;
  const sessions = mounted ? getSessionInfos(now) : [];

  function getBiasColor(value?: string) {
    if (value === "Bullish") return "text-green-400 bg-green-900/30 border-green-700";
    if (value === "Bearish") return "text-red-400 bg-red-900/30 border-red-700";
    if (value === "N/A") return "text-gray-300 bg-gray-800 border-gray-700";
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

        <MarketFlowProxyCard
          marketFlow={dashboard?.marketFlow}
          headlines={dashboard?.newsImpactSummary?.topHeadlines ?? []}
        />

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
              Confidence: {formatScoreOrDash(dashboard?.regime?.confidence)}%
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
                      <span className="text-xs text-gray-400">Impact {formatScore(item.impactScore)}</span>
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
            <WatchlistSearchBar
              watchlist={watchlist}
              loading={watchlistLoading}
              symbolQuery={symbolQuery}
              symbolResults={symbolResults}
              searchLoading={symbolSearchLoading}
              message={watchlistMessage}
              onQueryChange={setSymbolQuery}
              onSearch={searchWatchlistSymbols}
              onAdd={addSymbolToWatchlist}
              onRefresh={fetchWatchlistQuotes}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {groupedAssets.map((item) => (
                <div
                  key={item.symbol}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(item.symbol)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(item.symbol);
                    }
                  }}
                  className={`rounded-2xl border p-5 text-left shadow-lg transition ${
                    selected === item.symbol
                      ? "border-cyan-500 bg-[#131c2f]"
                      : "border-gray-800 bg-[#111827] hover:bg-[#141b2b]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={`text-xs uppercase text-gray-400 ${item.isCustom ? "tracking-normal" : "tracking-[0.2em]"}`}>
                        {item.symbol}
                      </p>
                      <h2 className="mt-2 text-lg font-semibold">{item.name}</h2>
                    </div>
                    <span
                      className={`rounded-lg border px-3 py-1 text-xs font-semibold ${getBiasColor(
                        item.hasBiasData ? item.bias : "N/A"
                      )}`}
                    >
                      {item.hasBiasData ? item.bias : "Quote only"}
                    </span>
                  </div>

                  {item.isCustom && item.watchlistId ? (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeWatchlistItem(item);
                        }}
                        className="rounded-lg border border-red-900/70 bg-red-950/20 px-2.5 py-1 text-xs font-semibold text-red-200 transition hover:border-red-500"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-5">
                    <p className="text-3xl font-bold">
                      {formatQuoteValue(item.price)}
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
                    <span className="text-sm font-semibold">
                      {item.hasBiasData ? `${formatScore(item.confidence)}%` : "N/A"}
                    </span>
                  </div>

                  <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[#1f2937]">
                    <div
                      className="h-full bg-cyan-300"
                      style={{ width: `${item.hasBiasData ? item.confidence : 0}%` }}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-gray-400">Expected Move</span>
                    <span className={item.hasBiasData ? getChangeColor(item.movePoints) : "text-gray-400"}>
                      {formatExpectedMoveValue(item)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-12">
              <div className="xl:col-span-7 rounded-2xl border border-gray-800 bg-[#111827] p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">{selectedAsset?.name ?? labelMap[selected] ?? selected}</p>
                    <h2 className="mt-1 text-3xl font-bold">{selectedAsset?.symbol ?? selected}</h2>
                  </div>

                  <div
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold ${getBiasColor(
                      selectedAsset?.hasBiasData ? selectedAsset?.bias : "N/A"
                    )}`}
                  >
                    {selectedAsset?.hasBiasData ? selectedAsset.bias : "N/A"}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-gray-800 bg-[#0d1423] p-4">
                    <p className="text-sm text-gray-400">Confidence</p>
                    <p className="mt-2 text-3xl font-bold">
                      {selectedAsset?.hasBiasData ? `${formatScore(selectedAsset.confidence)}%` : "N/A"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-800 bg-[#0d1423] p-4">
                    <p className="text-sm text-gray-400">Score</p>
                    <p className="mt-2 text-3xl font-bold">
                      {selectedAsset?.hasBiasData ? formatScore(selectedAsset.score) : "N/A"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-800 bg-[#0d1423] p-4">
                    <p className="text-sm text-gray-400">Expected Move</p>
                    <p className={`mt-2 text-3xl font-bold ${selectedAsset?.hasBiasData ? getChangeColor(selectedAsset?.movePoints) : "text-gray-400"}`}>
                      {formatExpectedMoveValue(selectedAsset)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-gray-800 bg-[#0d1423] p-5">
                  <h3 className="text-lg font-semibold text-cyan-300">Bias Analysis</h3>
                  <p className="mt-3 text-base leading-8 text-gray-200">
                    {selectedAsset?.hasBiasData
                      ? selectedAsset.analysis || "No analysis available."
                      : `${selectedAsset?.symbol ?? selected} is available as a watchlist quote. Full deterministic macro/news/technical bias is unavailable until this symbol is added to backend assetRules and scoring rules.`}
                  </p>
                </div>

                <WhyBiasSection
                  asset={selectedAsset}
                  regime={dashboard?.regime}
                  eventRisk={dashboard?.eventRisk}
                  topHeadlines={dashboard?.newsImpactSummary?.topHeadlines ?? []}
                />

                {selectedAsset?.hasBiasData ? (
                  <AdvancedConfluencePanel asset={selectedAsset} />
                ) : null}

                {!selectedAsset?.hasBiasData ? (
                  <QuoteOnlyDetailsPanel asset={selectedAsset} />
                ) : null}

                {selectedAsset?.hasBiasData ? (
                  <>
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
                      {formatScoreOrDash(historySummary?.latestChange?.confidenceDelta)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Score Δ</p>
                      <p className="mt-1 text-lg font-semibold">
                        {formatScoreOrDash(historySummary?.latestChange?.scoreDelta)}
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
                  </>
                ) : null}
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
                              weight {formatScore(driver.weight)}
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
                  <h3 className="text-lg font-semibold">
                    {selectedAsset?.hasBiasData ? "Top News Impact" : "Global News Impact"}
                  </h3>
                  <div className="mt-4 space-y-3">
                    {(dashboard?.newsImpactSummary?.topHeadlines ?? []).slice(0, 5).map((item, i) => (
                      <div
                        key={`${item.title}-${i}`}
                        className="rounded-xl border border-gray-800 bg-[#0d1423] p-3"
                      >
                        <p className="text-sm font-semibold text-gray-100">{item.title}</p>
                        <p className="mt-2 text-xs text-gray-400">
                          {item.category} · {item.impactLabel} · impact {formatScore(item.impactScore)}
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
  const marketProviders = Object.values(systemStatus?.dataSources?.marketProviders ?? {});
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

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-4">
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
            <p className="text-sm font-semibold">Market Providers</p>
            <span className="text-xs text-gray-400">
              {systemStatus?.watchlist?.enabledCount ?? "--"} symbols
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {marketProviders.length > 0 ? (
              marketProviders.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#111827] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-200">{source.name}</p>
                    <p className="text-xs text-gray-500">
                      {source.configured === false ? "No API key configured" : `Checked: ${formatHealthTime(source.checkedAt)}`}
                    </p>
                  </div>
                  <StatusPill status={source.status} />
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">No provider health loaded.</p>
            )}
          </div>
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

function WatchlistSearchBar({
  watchlist,
  loading,
  symbolQuery,
  symbolResults,
  searchLoading,
  message,
  onQueryChange,
  onSearch,
  onAdd,
  onRefresh,
}: {
  watchlist: WatchlistItem[];
  loading: boolean;
  symbolQuery: string;
  symbolResults: SymbolSearchResult[];
  searchLoading: boolean;
  message: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onAdd: (result: SymbolSearchResult) => void;
  onRefresh: () => void;
}) {
  const enabledCount = watchlist.filter((item) => item.enabled).length;
  const enabledKeys = new Set(
    watchlist
      .filter((item) => item.enabled)
      .flatMap((item) => [normalizeAssetKey(item.symbol), normalizeAssetKey(item.providerSymbol)])
      .filter(Boolean)
  );

  return (
    <section className="mb-6 rounded-2xl border border-gray-800 bg-[#111827] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Add Symbol</p>
          <h2 className="mt-2 text-xl font-semibold">Search Watchlist</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
          <span>{enabledCount} enabled</span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-xl border border-gray-700 bg-[#0d1423] px-3 py-2 text-sm font-semibold text-gray-200 transition hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_120px]">
        <input
          value={symbolQuery}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSearch();
          }}
          placeholder="Search symbol, company, forex pair..."
          className="rounded-xl border border-gray-800 bg-[#0d1423] px-4 py-3 text-sm text-gray-100 outline-none transition placeholder:text-gray-600 focus:border-cyan-500"
        />
        <button
          type="button"
          onClick={onSearch}
          disabled={searchLoading}
          className="rounded-xl border border-cyan-700 bg-cyan-950/30 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {searchLoading ? "Searching..." : "Search"}
        </button>
      </div>

      {message ? <p className="mt-3 text-sm text-gray-400">{message}</p> : null}

      {symbolResults.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {symbolResults.map((result) => {
            const alreadyEnabled =
              enabledKeys.has(normalizeAssetKey(result.symbol)) ||
              enabledKeys.has(normalizeAssetKey(result.providerSymbol));

            return (
              <div
                key={`${result.provider}-${result.providerSymbol}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#0d1423] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-100">{result.displayName}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {result.symbol} | {result.provider} | {result.assetClass}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onAdd(result)}
                  disabled={alreadyEnabled}
                  className="shrink-0 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-200 transition hover:border-cyan-500 disabled:cursor-not-allowed disabled:border-gray-800 disabled:text-gray-500"
                >
                  {alreadyEnabled ? "Added" : "Add"}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function MarketFlowProxyCard({
  marketFlow,
  headlines,
}: {
  marketFlow?: MarketFlowSnapshot;
  headlines: FlashNewsItem[];
}) {
  const rankedRows = (marketFlow?.rankedFlows ?? []).length
    ? [...(marketFlow?.rankedFlows ?? [])].sort((a, b) => b.flowScore - a.flowScore)
    : [...(marketFlow?.inflows ?? []), ...(marketFlow?.outflows ?? [])].sort((a, b) => b.flowScore - a.flowScore);
  const contextHeadlines = getFlowContextHeadlines(headlines);

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-gray-800 bg-[#111827]">
      <div className="border-b border-gray-800 bg-[#0d1423]/70 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Market Flow Proxy</p>
            <h2 className="mt-2 text-xl font-semibold capitalize">
              {marketFlow?.riskTone?.replaceAll("_", " ") ?? "Loading flow context"}
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-400">
              {marketFlow?.summary ?? "Comparing proxy moves across risk assets, safe havens, dollar, rates, energy, and volatility."}
            </p>
          </div>
          <StatusPill status={marketFlow?.status ?? "UNKNOWN"} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
        <FlowDashboard rows={rankedRows} />
        <FlowContextNewsPanel headlines={contextHeadlines} />
      </div>
    </section>
  );
}

function FlowDashboard({ rows }: { rows: FlowRow[] }) {
  const visibleRows = rows.slice(0, 14);

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-100">Ranked Proxy Pressure</h3>
          <p className="mt-1 text-xs text-gray-500">Negative pressure points left. Positive pressure points right.</p>
        </div>
        <div className="hidden items-center gap-3 text-[11px] text-gray-500 sm:flex">
          <span className="text-red-300">Outflow</span>
          <span className="h-px w-8 bg-gray-700" />
          <span className="text-green-300">Inflow</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-800 bg-[#0b1220]">
        <div className="hidden grid-cols-[86px_74px_minmax(180px,1fr)_64px] border-b border-gray-800 bg-[#111827]/70 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-gray-500 md:grid">
          <span>Symbol</span>
          <span>Direction</span>
          <span>Pressure</span>
          <span className="text-right">Score</span>
        </div>
        <div className="divide-y divide-gray-800/80">
          {visibleRows.map((row) => (
            <FlowPressureRow key={`flow-row-${row.asset}`} row={row} />
          ))}
          {visibleRows.length === 0 ? (
            <p className="px-3 py-4 text-sm text-gray-400">
              Market flow proxy rows are still loading.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FlowPressureRow({ row }: { row: FlowRow }) {
  const isNeutral = row.direction === "neutral" || row.flowScore === 0;
  const isPositive = !isNeutral && (row.flowScore > 0 || row.direction === "inflow");
  const width = `${Math.min(100, Math.abs(row.flowScore))}%`;
  const directionLabel = row.direction === "inflow" ? "Inflow" : row.direction === "outflow" ? "Outflow" : "Neutral";
  const reason = row.reasons?.[0];
  const directionClass = isNeutral ? "text-gray-300" : isPositive ? "text-green-300" : "text-red-300";

  return (
    <div
      className="relative grid grid-cols-[72px_74px_minmax(120px,1fr)_58px] items-center gap-2 px-3 py-1.5 transition hover:bg-[#111827]/75 md:grid-cols-[86px_74px_minmax(180px,1fr)_64px]"
      title={reason}
    >
      <span className="text-xs font-semibold text-gray-100">{row.asset}</span>
      <span className={`text-xs font-semibold ${directionClass}`}>{directionLabel}</span>

      <div>
        <div className="grid grid-cols-2 gap-0">
          <div className="flex h-2 items-center justify-end rounded-l-full bg-gray-800/80">
            {!isPositive && !isNeutral ? <div className="h-2 rounded-l-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.25)]" style={{ width }} /> : null}
          </div>
          <div className="flex h-2 items-center rounded-r-full bg-gray-800/80">
            {isPositive ? <div className="h-2 rounded-r-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.25)]" style={{ width }} /> : null}
          </div>
        </div>
      </div>

      <p className={`text-sm font-semibold md:text-right ${getSignedValueColor(row.flowScore)}`}>{formatScore(row.flowScore)}</p>
    </div>
  );
}

function FlowContextNewsPanel({ headlines }: { headlines: FlashNewsItem[] }) {
  return (
    <aside className="border-t border-gray-800 bg-[#0b1220] p-4 xl:border-l xl:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-100">News vs Flow</h3>
          <p className="mt-1 text-xs text-gray-500">Context only, not AI analysis.</p>
        </div>
        <span className="rounded-lg border border-gray-800 bg-[#111827] px-2 py-1 text-[11px] font-semibold text-gray-400">
          Context
        </span>
      </div>

      <div className="dark-scrollbar mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
        {headlines.length > 0 ? (
          headlines.slice(0, 6).map((headline, index) => (
            <div key={`${headline.title}-${index}`} className="rounded-lg border border-gray-800 bg-[#111827] px-3 py-2">
              <p className="line-clamp-2 text-sm font-semibold leading-5 text-gray-100">{headline.title}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                <span>{headline.source}</span>
                <span>{headline.category}</span>
                <span className={getImpactTextColor(headline.impactLabel)}>{headline.impactLabel}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-gray-800 bg-[#111827] p-3 text-sm leading-6 text-gray-400">
            No clear flow-related news context detected.
          </p>
        )}
      </div>
    </aside>
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

function QuoteOnlyDetailsPanel({ asset }: { asset: GroupedAsset | null }) {
  return (
    <div className="mt-6 rounded-2xl border border-gray-800 bg-[#0d1423] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Quote-Only Details</p>
          <h3 className="mt-2 text-xl font-semibold">{asset?.symbol ?? "N/A"}</h3>
          <p className="mt-1 text-sm text-gray-400">{asset?.name ?? "N/A"}</p>
        </div>
        <StatusPill status={asset?.quoteStatus ?? "UNKNOWN"} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <QuoteOnlyMetric label="Current Price" value={formatQuoteValue(asset?.price)} />
        <QuoteOnlyMetric
          label="Current Move"
          value={`${formatSignedNumber(asset?.change)} / ${formatSignedNumber(asset?.changePercent)}%`}
          tone={getSignedValueColor(asset?.change)}
        />
        <QuoteOnlyMetric label="Day Range" value={asset?.dayRange ?? "N/A"} />
        <QuoteOnlyMetric label="Open" value={formatQuoteValue(asset?.open)} />
        <QuoteOnlyMetric label="High" value={formatQuoteValue(asset?.high)} />
        <QuoteOnlyMetric label="Low" value={formatQuoteValue(asset?.low)} />
        <QuoteOnlyMetric label="Previous Close" value={formatQuoteValue(asset?.previousClose)} />
        <QuoteOnlyMetric label="Provider" value={asset?.provider ?? "N/A"} />
        <QuoteOnlyMetric label="Provider Symbol" value={asset?.providerSymbol ?? "N/A"} />
        <QuoteOnlyMetric label="Asset Class" value={asset?.assetClass ?? "N/A"} />
        <QuoteOnlyMetric label="Last Updated" value={formatDateTime(asset?.quoteTimestamp)} />
        <QuoteOnlyMetric label="Bias Engine" value="Not configured" />
      </div>

      {asset?.quoteError ? (
        <p className="mt-4 rounded-xl border border-yellow-800/60 bg-yellow-950/20 p-3 text-sm text-yellow-200">
          {asset.quoteError}
        </p>
      ) : null}
    </div>
  );
}

function AdvancedConfluencePanel({ asset }: { asset: GroupedAsset }) {
  const confluence = asset.confluence;
  const optionsMessage =
    asset.optionsPressure?.status === "OK"
      ? `${asset.optionsPressure.pressureState} / ${asset.optionsPressure.trendImpact}`
      : "Options pressure unavailable. Using flow/news/macro confluence only.";

  return (
    <div className="mt-6 rounded-2xl border border-gray-800 bg-[#0d1423] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Advanced Confluence</p>
          <h3 className="mt-2 text-xl font-semibold">
            Trend State: {asset.trendState?.replaceAll("_", " ") ?? confluence?.trendState?.replaceAll("_", " ") ?? "neutral"}
          </h3>
          <p className="mt-2 text-sm text-gray-400">
            Edge Score: {formatScore(asset.edgeScore ?? confluence?.edgeScore)} | News vs Flow: {asset.newsFlowRelationship?.relationship?.replaceAll("_", " ") ?? "--"}
          </p>
        </div>
        <BiasPill bias={confluence?.finalBias ?? asset.bias} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <BiasContributor
          label="Market Flow"
          value={asset.flow?.direction ?? "neutral"}
          helper={`${asset.flow?.strength ?? "flat"} | score ${formatScore(asset.flow?.flowScore)}`}
        />
        <BiasContributor
          label="News vs Flow"
          value={asset.newsFlowRelationship?.relationship?.replaceAll("_", " ") ?? "insufficient data"}
          helper={`${formatScore(asset.newsFlowRelationship?.confidence)}% relationship confidence`}
        />
        <BiasContributor label="Options Pressure" value={asset.optionsPressure?.status ?? "UNAVAILABLE"} helper={optionsMessage} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-[#111827] p-4">
          <h4 className="text-sm font-semibold text-gray-100">Confluence Breakdown</h4>
          <div className="mt-3 space-y-2">
            {(confluence?.components ?? []).map((component) => (
              <div key={component.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-300">{component.label}</span>
                <span className="text-xs text-gray-500">
                  {formatScore(component.score)} / {component.weight}
                </span>
              </div>
            ))}
            {(confluence?.components ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No confluence components loaded.</p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1">
          <ReasonList title="Watch Reasons" reasons={asset.watchReasons ?? confluence?.watchReasons ?? []} />
          <ReasonList title="Avoid Reasons" reasons={asset.avoidReasons ?? confluence?.avoidReasons ?? []} />
        </div>
      </div>
    </div>
  );
}

function ReasonList({ title, reasons }: { title: string; reasons: string[] }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#111827] p-4">
      <h4 className="text-sm font-semibold text-gray-100">{title}</h4>
      <div className="mt-3 space-y-2">
        {reasons.slice(0, 5).map((reason, index) => (
          <p key={`${title}-${index}`} className="text-xs leading-5 text-gray-400">{reason}</p>
        ))}
        {reasons.length === 0 ? <p className="text-sm text-gray-400">None logged.</p> : null}
      </div>
    </div>
  );
}

function QuoteOnlyMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#111827] px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500">{label}</p>
      <p className={`mt-2 break-words text-sm font-semibold ${tone ?? "text-gray-200"}`}>
        {value || "N/A"}
      </p>
    </div>
  );
}

function WhyBiasSection({
  asset,
  regime,
  eventRisk,
  topHeadlines,
}: {
  asset: GroupedAsset | null;
  regime?: DashboardResponse["regime"];
  eventRisk?: DashboardResponse["eventRisk"];
  topHeadlines: FlashNewsItem[];
}) {
  if (asset && !asset.hasBiasData) {
    return (
      <div className="mt-6 rounded-2xl border border-gray-800 bg-[#0d1423] p-5">
        <h3 className="text-lg font-semibold text-cyan-300">Quote-Only Context</h3>
        <p className="mt-3 text-sm leading-7 text-gray-300">
          {asset.symbol} is tracked as a watchlist quote. Full macro/news/technical bias is unavailable
          because this symbol is not configured in backend assetRules.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <BiasContributor label="Quote Status" value={asset.quoteStatus ?? "UNKNOWN"} helper="Latest provider quote state" />
          <BiasContributor label="Provider" value={asset.provider ?? "N/A"} helper={`Provider symbol ${asset.providerSymbol ?? "N/A"}`} />
          <BiasContributor
            label="Price Movement"
            value={`${formatSignedNumber(asset.changePercent)}%`}
            helper={`Change ${formatSignedNumber(asset.change)}, price ${formatQuoteValue(asset.price)}`}
          />
          <BiasContributor label="Technical Context" value="Quote only" helper="OHLC and percent move are available for manual inspection." />
          <BiasContributor label="Macro Bias" value="Unavailable" helper="No deterministic macro rule exists for this symbol yet." />
          <BiasContributor label="News Bias" value="Unavailable" helper="No asset-specific keyword rules are configured for this symbol yet." />
        </div>
      </div>
    );
  }

  const assetHeadlines = topHeadlines.filter((item) => {
    const title = item.title.toLowerCase();
    return title.includes(asset?.asset.toLowerCase() ?? "") || title.includes("fed") || title.includes("inflation");
  });
  const scoreMeaning = asset?.hasBiasData ? explainScore(asset.score) : "bias unavailable";

  return (
    <div className="mt-6 rounded-2xl border border-gray-800 bg-[#0d1423] p-5">
      <h3 className="text-lg font-semibold text-cyan-300">Why This Bias?</h3>
      <p className="mt-3 text-sm leading-7 text-gray-300">
        Score is directional pressure: positive is bullish pressure, negative is bearish pressure,
        and near zero is mixed or neutral. Current score: {asset?.hasBiasData ? formatScore(asset.score) : "N/A"} ({scoreMeaning}).
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <BiasContributor
          label="News Bias"
          value={asset?.hasBiasData ? asset?.newsBias?.bias ?? "Neutral" : "N/A"}
          helper={
            asset?.hasBiasData
              ? `Weighted headline matches: source reliability, category importance, and asset relevance. ${formatScore(asset?.newsBias?.confidence)}% confidence, score ${formatScore(asset?.newsBias?.score)}`
              : "News bias unavailable for quote-only watchlist symbols."
          }
        />
        <BiasContributor
          label="Technical Bias"
          value={asset?.technicalBias?.bias ?? "Neutral"}
          helper={
            asset?.hasBiasData
              ? `Live market context: asset momentum, ES/NQ, VIX, DXY, oil, US10Y, gold, and macro regime. ${formatScore(asset?.technicalBias?.confidence)}% confidence, score ${formatScore(asset?.technicalBias?.score)}`
              : `Quote-only technical context. Status: ${asset?.quoteStatus ?? "UNKNOWN"}`
          }
        />
        <BiasContributor
          label="Combined Bias"
          value={asset?.hasBiasData ? asset?.combinedBias?.bias ?? asset?.bias ?? "Neutral" : "N/A"}
          helper={
            asset?.hasBiasData
              ? "News score + technical score + cross-asset confluence. Event risk can reduce confidence and increase expected-move risk."
              : "Combined bias unavailable until deterministic rules are configured for this symbol."
          }
        />
        <BiasContributor
          label="Macro Regime"
          value={regime?.regime?.replaceAll("_", " ") ?? "--"}
          helper={`${formatScoreOrDash(regime?.confidence)}% regime confidence`}
        />
        <BiasContributor
          label="Event Risk"
          value={eventRisk?.level ?? "--"}
          helper={`${eventRisk?.nextEvent?.title ?? "No next event"}${eventRisk?.score !== undefined ? `, score ${formatScore(eventRisk.score)}` : ""}`}
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
                  {formatTechnicalSnapshotValue(key, value, asset?.isCustom)}
                </p>
              </div>
            ))}
            {Object.keys(asset?.technicalBias?.snapshot ?? {}).length === 0 ? (
              <p className="col-span-2 text-sm text-gray-400">No technical snapshot loaded yet.</p>
            ) : null}
          </div>

          <div className="mt-3 space-y-2">
            {(asset?.technicalBias?.components ?? []).slice(0, 5).map((component) => (
              <div
                key={component.key}
                className="rounded-xl border border-gray-800 bg-[#111827] px-3 py-2 text-xs text-gray-400"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-gray-200">{component.label}</span>
                  <span className={getSignedValueColor(component.contribution)}>
                    {formatSignedNumber(component.contribution)}
                  </span>
                </div>
                <p className="mt-1">
                  {component.direction} | threshold {component.threshold ?? "--"}
                </p>
              </div>
            ))}
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
                <span className="text-xs text-gray-500">{driver.direction} | {formatScore(driver.weight)}</span>
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

      <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-12 xl:[height:calc(100vh-220px)] xl:min-h-[520px]">
        <section className="flex min-h-0 flex-col rounded-2xl border border-gray-800 bg-[#111827] p-5 xl:col-span-7">
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

          <div className="dark-scrollbar mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
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

        <section className="flex min-h-0 flex-col rounded-2xl border border-gray-800 bg-[#111827] p-5 xl:col-span-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Market Headlines</h2>
              <p className="mt-1 text-sm text-gray-400">Ranked by impact score</p>
            </div>
            <StatusPill status={isDataDegraded(systemStatus) ? "DEGRADED" : "OK"} />
          </div>

          <div className="dark-scrollbar mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
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

      <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-12 xl:[height:calc(100vh-220px)] xl:min-h-[560px]">
        <section
          className="flex min-h-0 flex-col rounded-2xl border border-gray-800 bg-[#111827] p-5 xl:col-span-4"
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
                    <p className="font-semibold text-gray-100">{formatScore(row.confidence)}%</p>
                      <p className="text-xs text-gray-500">confidence</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-400">
                    <span>Score {formatScore(row.score)}</span>
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
          className="dark-scrollbar flex min-h-0 overflow-y-auto rounded-2xl border border-gray-800 bg-[#111827] p-5 xl:col-span-8"
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
          <p className="mt-2 text-xs text-gray-500">Impact {formatScore(item.impactScore)}</p>
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
        <MetricCard label="Score" value={formatScore(row.score)} helper={explainScore(row.score)} />
        <MetricCard label="Confidence" value={`${formatScore(row.confidence)}%`} helper="bias engine confidence" />
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
                  <span className="text-xs text-gray-500">{driver.direction} | {formatScore(driver.weight)}</span>
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
          <p className="mt-1 font-semibold text-gray-100">{formatScoreOrDash(breakdown?.confidence)}%</p>
        </div>
        <div>
          <p className="text-gray-500">Score</p>
          <p className="mt-1 font-semibold text-gray-100">{formatScoreOrDash(breakdown?.score)}</p>
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

function buildGroupedAssets(defaultAssets: AssetCard[], watchlistQuotes: WatchlistQuote[]): GroupedAsset[] {
  const coreSymbols = new Set(defaultAssets.map((asset) => normalizeAssetKey(asset.asset)));
  const normalizedDefault = defaultAssets.map((asset) => ({
    ...asset,
    symbol: asset.asset,
    name: labelMap[asset.asset] || asset.asset,
    changePercent: asset.percent,
    quoteStatus: "OK",
    isCustom: false,
    hasBiasData: true,
    assetClass: "bias-asset",
  }));
  const customQuoteMap = new Map<string, GroupedAsset>();

  watchlistQuotes.forEach((quote) => {
    const symbolKey = normalizeAssetKey(quote.symbol);
    const providerKey = normalizeAssetKey(quote.providerSymbol);
    if (!symbolKey || coreSymbols.has(symbolKey) || (providerKey && coreSymbols.has(providerKey))) return;

    const dedupeKey = symbolKey || providerKey;
    if (!dedupeKey || customQuoteMap.has(dedupeKey)) return;

    const technicalSnapshot = {
      price: quote.price ?? 0,
      change: quote.change ?? 0,
      percent: quote.percent ?? 0,
      open: quote.open ?? 0,
      high: quote.high ?? 0,
      low: quote.low ?? 0,
      previousClose: quote.previousClose ?? 0,
    };

    customQuoteMap.set(dedupeKey, {
      asset: quote.symbol,
      symbol: quote.symbol,
      name: quote.displayName || quote.symbol,
      price: quote.price,
      change: quote.change,
      percent: quote.percent,
      changePercent: quote.percent,
      bias: "N/A",
      confidence: 0,
      score: 0,
      movePoints: 0,
      currentPrice: quote.price ?? 0,
      newsBias: null,
      technicalBias: {
        bias: "N/A",
        confidence: 0,
        score: 0,
        reasons: [
          {
            text: `${quote.symbol} has quote data only. Deterministic bias rules are not configured for this symbol yet.`,
            direction: "neutral",
            weight: 0,
          },
        ],
        snapshot: technicalSnapshot,
      },
      combinedBias: null,
      regime: null,
      regimeConfidence: null,
      drivers: [],
      eventRisk: undefined,
      analysis: "Bias analysis unavailable for this watchlist symbol.",
      reasons: [],
      lastUpdated: quote.timestamp,
      quoteStatus: quote.quoteStatus ?? quote.status,
      isCustom: true,
      hasBiasData: false,
      provider: quote.provider,
      providerSymbol: quote.providerSymbol,
      assetClass: quote.assetClass,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      previousClose: quote.previousClose,
      dayRange: quote.dayRange,
      quoteTimestamp: quote.timestamp,
      quoteError: quote.error,
      watchlistId: quote.id,
    });
  });

  return [...normalizedDefault, ...customQuoteMap.values()];
}

function normalizeAssetKey(value?: string | null) {
  return (value ?? "").trim().toUpperCase();
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

function formatScore(value?: number | string | null) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "N/A";
}

function formatScoreOrDash(value?: number | string | null) {
  const formatted = formatScore(value);
  return formatted === "N/A" ? "--" : formatted;
}

function formatQuoteValue(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  if (Math.abs(value) >= 1000) return value.toLocaleString([], { maximumFractionDigits: 2 });
  if (Math.abs(value) >= 100) return value.toFixed(2);
  return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function formatTechnicalSnapshotValue(key: string, value: number, isCustom?: boolean) {
  if (!isCustom) return `${formatSignedNumber(value)}%`;
  if (key === "percent" || key === "change") return key === "percent" ? `${formatSignedNumber(value)}%` : formatSignedNumber(value);
  return formatQuoteValue(value);
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

function formatExpectedMoveValue(asset?: GroupedAsset | null) {
  if (!asset?.hasBiasData) return "N/A";
  if (typeof asset.movePoints !== "number" || Number.isNaN(asset.movePoints)) return "N/A";

  if (asset.symbol === "GOLD" || asset.symbol === "USOIL") {
    return asset.movePoints.toFixed(5);
  }

  return asset.movePoints.toFixed(3);
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

function getImpactTextColor(value?: string) {
  if (value === "EXTREME") return "text-red-300";
  if (value === "HIGH") return "text-orange-300";
  if (value === "MEDIUM") return "text-yellow-300";
  return "text-gray-400";
}

function getFlowContextHeadlines(headlines: FlashNewsItem[]) {
  const flowTerms = [
    "dollar",
    "dxy",
    "yield",
    "treasury",
    "fed",
    "rate",
    "inflation",
    "cpi",
    "jobs",
    "oil",
    "energy",
    "gold",
    "safe haven",
    "volatility",
    "vix",
    "risk-off",
    "risk on",
    "equity",
    "stocks",
    "tech",
    "nasdaq",
  ];

  return headlines
    .filter((headline) => {
      const searchable = `${headline.title} ${headline.category} ${headline.source}`.toLowerCase();
      return flowTerms.some((term) => searchable.includes(term));
    })
    .sort((a, b) => b.impactScore - a.impactScore);
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
  const marketProviders = Object.values(systemStatus.dataSources?.marketProviders ?? {});
  const newsDegraded = newsSources.some((source) => source.status === "ERROR");
  const calendarDegraded =
    calendar?.status === "ERROR" ||
    calendar?.status === "UNAVAILABLE" ||
    calendar?.status === "STALE";
  const providerDegraded = marketProviders.some(
    (source) => source.status === "ERROR" || source.status === "UNAVAILABLE"
  );

  return databaseDown || newsDegraded || calendarDegraded || providerDegraded;
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
