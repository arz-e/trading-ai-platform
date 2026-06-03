import { flowAssets } from "../config/flowAssets.js";
import { containsKeyword } from "../utils/textMatching.js";

export function buildMarketFlowSnapshot(marketData = {}, newsItems = [], calendarEvents = []) {
  const rankedFlows = flowAssets.map((asset) => buildFlowRow(asset, marketData[asset.id]));
  const sortedFlows = rankedFlows
    .slice()
    .sort((a, b) => Math.abs(b.flowScore) - Math.abs(a.flowScore));
  const inflows = sortedFlows.filter((row) => row.direction === "inflow").slice(0, 8);
  const outflows = sortedFlows.filter((row) => row.direction === "outflow").slice(0, 8);
  const contradictions = buildFlowContradictions(marketData, rankedFlows);
  const riskTone = resolveRiskTone(marketData);
  const dataQuality = buildDataQuality(rankedFlows);

  return {
    generatedAt: new Date().toISOString(),
    status: dataQuality.availableRows > 0 ? "OK" : "UNAVAILABLE",
    label: "Market Flow Proxy",
    riskTone,
    summary: buildFlowSummary({ riskTone, inflows, outflows, contradictions, newsItems, calendarEvents }),
    rankedFlows: sortedFlows,
    inflows,
    outflows,
    contradictions,
    dataQuality,
  };
}

function buildFlowRow(asset, quote = {}) {
  const percent = numeric(quote?.percent);
  const volume = numeric(quote?.volume);
  const baseScore = Math.max(-100, Math.min(100, percent * 18));
  const volumeBoost = volume && volume > 10000000 ? 5 : 0;
  const flowScore = Number((baseScore + Math.sign(baseScore) * volumeBoost).toFixed(2));
  const direction = flowScore > 3 ? "inflow" : flowScore < -3 ? "outflow" : "neutral";
  const strength = resolveStrength(flowScore);
  const reasons = [];

  if (direction === "inflow") reasons.push(`${asset.displayName} is up ${formatPercent(percent)}, a proxy for possible inflow.`);
  if (direction === "outflow") reasons.push(`${asset.displayName} is down ${formatPercent(percent)}, a proxy for possible outflow.`);
  if (direction === "neutral") reasons.push(`${asset.displayName} is near flat, so flow signal is neutral.`);
  if (volumeBoost) reasons.push("Higher available volume increases flow confidence.");
  if (quote?.stale) reasons.push("Quote timestamp appears stale, so confidence should be reduced.");

  return {
    asset: asset.id,
    displayName: asset.displayName,
    providerSymbol: asset.providerSymbol,
    riskBucket: asset.riskBucket,
    relatedCoreAssets: asset.relatedCoreAssets,
    price: quote?.price ?? null,
    change: quote?.change ?? null,
    percent: quote?.percent ?? null,
    volume: quote?.volume ?? null,
    flowScore,
    direction,
    strength,
    reasons,
    quoteStatus: quote?.quoteStatus ?? (quote?.error ? "ERROR" : "UNKNOWN"),
    stale: Boolean(quote?.stale),
  };
}

function resolveRiskTone(market = {}) {
  const es = numeric(market.ES?.percent);
  const nq = numeric(market.NQ?.percent);
  const ym = numeric(market.YM?.percent);
  const spy = numeric(market.SPY?.percent);
  const qqq = numeric(market.QQQ?.percent);
  const vix = numeric(market.VIX?.percent);
  const dxy = numeric(market.DXY?.percent);
  const us10y = numeric(market.US10Y?.percent);
  const gold = numeric(market.GOLD?.percent);
  const riskScore = es + nq + ym + spy + qqq - vix * 0.8 - dxy * 0.6 - us10y * 0.4 + gold * 0.15;

  if (dxy > 0.25 && us10y > 0.5 && nq < -0.25) return "LIQUIDITY_TIGHTENING";
  if (riskScore > 1.25 && vix <= 0) return "RISK_ON";
  if (riskScore < -1.25 || (vix > 1.5 && es < 0 && nq < 0)) return "RISK_OFF";
  if (Math.abs(riskScore) <= 0.55) return "CHOPPY";
  return riskScore > 0 ? "MILD_RISK_ON" : "MILD_RISK_OFF";
}

function buildFlowContradictions(market = {}, rows = []) {
  const contradictions = [];
  const rowByAsset = Object.fromEntries(rows.map((row) => [row.asset, row]));
  const es = numeric(market.ES?.percent);
  const nq = numeric(market.NQ?.percent);
  const vix = numeric(market.VIX?.percent);
  const dxy = numeric(market.DXY?.percent);
  const gold = numeric(market.GOLD?.percent);
  const oil = numeric(market.USOIL?.percent);

  if ((es > 0.3 || nq > 0.3) && vix > 1) {
    contradictions.push({
      type: "equities_up_vix_up",
      message: "Equities are bid while volatility is rising, which can indicate unstable risk appetite.",
      assets: ["ES", "NQ", "VIX"],
    });
  }

  if (gold > 0.4 && dxy > 0.25) {
    contradictions.push({
      type: "gold_up_dollar_up",
      message: "Gold and dollar are both rising, suggesting defensive demand or mixed macro pressure.",
      assets: ["GOLD", "DXY"],
    });
  }

  if (oil > 1 && (es < -0.3 || nq < -0.3)) {
    contradictions.push({
      type: "oil_up_equities_down",
      message: "Oil strength while equities weaken can point to inflation or supply-shock pressure.",
      assets: ["USOIL", "ES", "NQ"],
    });
  }

  if (rowByAsset.SPY?.direction !== rowByAsset.ES?.direction && rowByAsset.SPY?.direction !== "neutral") {
    contradictions.push({
      type: "spy_es_divergence",
      message: "SPY is not confirming ES direction.",
      assets: ["SPY", "ES"],
    });
  }

  if (rowByAsset.QQQ?.direction !== rowByAsset.NQ?.direction && rowByAsset.QQQ?.direction !== "neutral") {
    contradictions.push({
      type: "qqq_nq_divergence",
      message: "QQQ is not confirming NQ direction.",
      assets: ["QQQ", "NQ"],
    });
  }

  return contradictions;
}

function buildFlowSummary({ riskTone, inflows, outflows, contradictions, newsItems, calendarEvents }) {
  const leadInflow = inflows[0]?.asset ?? "none";
  const leadOutflow = outflows[0]?.asset ?? "none";
  const newsCount = Array.isArray(newsItems) ? newsItems.length : 0;
  const highImpactEvents = (calendarEvents ?? []).filter((event) => event.impact === "red").length;

  return `${riskTone.replaceAll("_", " ")}: strongest proxy inflow ${leadInflow}, strongest proxy outflow ${leadOutflow}. ${contradictions.length} flow contradiction(s), ${newsCount} headline(s), ${highImpactEvents} high-impact calendar event(s).`;
}

function buildDataQuality(rows = []) {
  const availableRows = rows.filter((row) => row.price !== null && row.quoteStatus !== "ERROR").length;
  const staleRows = rows.filter((row) => row.stale).length;

  return {
    availableRows,
    totalRows: rows.length,
    staleRows,
    status: availableRows >= 6 ? "OK" : "DEGRADED",
  };
}

function resolveStrength(score) {
  const value = Math.abs(score);
  if (value >= 25) return "strong";
  if (value >= 12) return "moderate";
  if (value >= 3) return "weak";
  return "flat";
}

function numeric(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatPercent(value) {
  return `${Number(value).toFixed(2)}%`;
}

export function flowRowForAsset(flowSnapshot = {}, asset) {
  const rows = flowSnapshot.rankedFlows ?? [];
  const direct = rows.find((row) => row.asset === asset);
  if (direct) return direct;
  return rows.find((row) => (row.relatedCoreAssets ?? []).includes(asset)) ?? null;
}

export function headlineMentionsFlow(text = "") {
  return [
    "fed",
    "rate",
    "dollar",
    "yield",
    "oil",
    "war",
    "inflation",
    "jobs",
    "earnings",
    "supply",
  ].some((keyword) => containsKeyword(text, keyword));
}
