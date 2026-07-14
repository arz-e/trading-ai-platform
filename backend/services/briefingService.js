export function buildMacroBriefing({ market = {}, bias = {}, newsImpact = null }) {

  const briefing = {
    macroTone: "RANGING",
    summary: "",
    keyDrivers: [],
    riskFactors: [],
    reversalTriggers: []
  };

  const vix = market?.VIX?.price ?? null;
  const dxy = market?.DXY?.percent ?? 0;
  const oil = market?.USOIL?.percent ?? 0;

  /*
  Determine macro tone
  */

  if (vix && vix > 22) {
    briefing.macroTone = "RISK_OFF";
    briefing.keyDrivers.push("Rising volatility (VIX)");
  }

  if (dxy > 0.4) {
    briefing.keyDrivers.push("Dollar strength tightening financial conditions");
  }

  if (oil > 1) {
    briefing.riskFactors.push("Oil spike increasing inflation pressure");
  }

  /*
  Scan bias engine output
  */

  const bearishEquities =
    bias?.ES?.bias === "Bearish" &&
    bias?.NQ?.bias === "Bearish";

  if (bearishEquities) {
    briefing.macroTone = "RISK_OFF";
    briefing.keyDrivers.push("Equity index downside momentum");
  }

  /*
  News impact integration
  */

  const dominantCategories = (newsImpact?.summary?.dominantCategories ?? []).map(
    (item) => String(item.category ?? "").toUpperCase()
  );

  if (dominantCategories.includes("GEOPOLITICS")) {
    briefing.riskFactors.push("Geopolitical tensions dominating headlines");
  }

  if (dominantCategories.includes("INFLATION")) {
    briefing.riskFactors.push("Inflation headlines increasing rate fears");
  }

  /*
  Reversal triggers
  */

  briefing.reversalTriggers = [
    "Cooling inflation data",
    "Dovish central bank signals",
    "Volatility compression"
  ];

  /*
  Build summary text
  */

  const toneText =
    briefing.macroTone === "RISK_OFF"
      ? "Markets are currently in a risk-off environment."
      : "Markets are trading in a mixed macro environment.";

  const driversText =
    briefing.keyDrivers.length > 0
      ? briefing.keyDrivers.slice(0, 3).join(", ")
      : "no dominant macro driver detected";

  briefing.summary = `${toneText} The primary drivers include ${driversText}.`;

  return briefing;
}
