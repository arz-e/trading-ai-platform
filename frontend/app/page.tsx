"use client";

import { useEffect, useMemo, useState } from "react";

type Driver = {
  label: string;
  count: number;
  direction: "positive" | "negative" | "neutral";
  weight: number;
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

const labelMap: Record<string, string> = {
  ES: "S&P 500 Futures",
  NQ: "Nasdaq Futures",
  YM: "Dow Futures",
  GOLD: "Gold Futures",
  DXY: "US Dollar Index",
  USOIL: "US Oil",
};

const assetOrder = ["ES", "NQ", "YM", "GOLD", "DXY", "USOIL"];

export default function Home() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [historySummary, setHistorySummary] = useState<HistorySummaryResponse | null>(null);
  const [biasShifts, setBiasShifts] = useState<BiasShift[]>([]);
  const [selected, setSelected] = useState("NQ");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<Date>(new Date());

  async function fetchDashboard() {
    const res = await fetch("http://localhost:5000/api/dashboard", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch dashboard");
    const data: DashboardResponse = await res.json();
    setDashboard(data);
  }

  async function fetchHistory(asset: string) {
    const res = await fetch(`http://localhost:5000/api/bias-history-summary/${asset}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch history summary");
    const data: HistorySummaryResponse = await res.json();
    setHistorySummary(data);
  }

  async function fetchBiasShifts() {
    const res = await fetch("http://localhost:5000/api/bias-shifts", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch bias shifts");
    const data: BiasShiftsResponse = await res.json();
    setBiasShifts(data.shifts || []);
  }

  useEffect(() => {
    async function boot() {
      try {
        await Promise.all([fetchDashboard(), fetchBiasShifts()]);
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
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchHistory(selected).catch(console.error);
  }, [selected]);

  useEffect(() => {
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
  const sessions = getSessionInfos(now);

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
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-gray-800 bg-[#111827] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Market Sessions</p>
              <h2 className="mt-2 text-2xl font-bold">UTC {formatUtcClock(now)}</h2>
            </div>
            <div className="text-sm text-gray-400">
              Based on your device time converted to UTC
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {sessions.map((session) => (
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
                  <h3 className="text-lg font-semibold text-cyan-300">AI Analysis</h3>
                  <p className="mt-3 text-base leading-8 text-gray-200">
                    {selectedAsset?.analysis || "No analysis available."}
                  </p>
                </div>

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
      </div>
    </main>
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