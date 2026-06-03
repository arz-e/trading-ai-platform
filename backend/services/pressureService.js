import { coreFlowAssets } from "../config/flowAssets.js";

export function buildOptionsPressureSnapshot(coreAssets = coreFlowAssets, marketData = {}) {
  const assets = coreAssets.map((asset) => ({
    asset,
    status: "UNAVAILABLE",
    pressureState: "unknown",
    trendImpact: "unknown",
    relatedPrice: marketData?.[asset]?.price ?? null,
    reason: "Options pressure data source not configured yet.",
  }));

  return {
    generatedAt: new Date().toISOString(),
    status: "UNAVAILABLE",
    label: "Estimated Options/Gamma Pressure",
    summary: "Options pressure unavailable. Using flow/news/macro confluence only.",
    assets,
  };
}

export function optionsPressureForAsset(snapshot = {}, asset) {
  return (snapshot.assets ?? []).find((row) => row.asset === asset) ?? {
    asset,
    status: "UNAVAILABLE",
    pressureState: "unknown",
    trendImpact: "unknown",
    reason: "Options pressure data source not configured yet.",
  };
}
