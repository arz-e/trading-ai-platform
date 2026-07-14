const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function analyzeGex({
  ticker,
  spotPrice,
  optionsData = {},
  riskFreeRate = 0.04,
  now = new Date(),
}) {
  if (optionsData.status !== "OK") {
    return unavailableGex(ticker, optionsData.error ?? "Validated options chain unavailable.");
  }
  if (!isPositiveNumber(spotPrice)) return unavailableGex(ticker, "Current underlying price is unavailable.");

  const contracts = (optionsData.contracts ?? [])
    .map((contract) => enrichContract(contract, spotPrice, riskFreeRate, now))
    .filter((contract) => contract !== null);
  if (contracts.length < 10) {
    return unavailableGex(ticker, `Need at least 10 usable option contracts; received ${contracts.length}.`);
  }

  const strikeRows = aggregateByStrike(contracts);
  const grossGex = strikeRows.reduce((sum, row) => sum + row.grossGex, 0);
  const totalGex = strikeRows.reduce((sum, row) => sum + row.netGex, 0);
  if (!isPositiveNumber(grossGex)) return unavailableGex(ticker, "Open-interest gamma exposure is zero.");

  const regimeRatio = totalGex / grossGex;
  const gammaRegime = regimeRatio > 0.1 ? "positive" : regimeRatio < -0.1 ? "negative" : "neutral";
  const positive = strikeRows.filter((row) => row.netGex > 0).sort((a, b) => b.netGex - a.netGex);
  const negative = strikeRows.filter((row) => row.netGex < 0).sort((a, b) => a.netGex - b.netGex);
  const gammaFlipLevel = findGammaFlip(contracts, spotPrice, riskFreeRate, now);
  const positiveGammaZones = positive.slice(0, 5).map(toZone);
  const negativeGammaZones = negative.slice(0, 5).map(toZone);
  const pinLevels = positive.slice(0, 3).map((row) => row.price);
  const volatilityExpansionLevels = negative.slice(0, 3).map((row) => row.price);
  const nearestGexLevel = findNearestLevel(spotPrice, {
    positiveGammaZones,
    negativeGammaZones,
    gammaFlipLevel,
    pinLevels,
  });
  const openInterest = contracts.reduce((sum, contract) => sum + contract.openInterest, 0);
  const confidence = Math.round(clamp(
    35 + Math.min(25, contracts.length / 10) + Math.min(20, openInterest / 5000),
    35,
    80
  ));

  return {
    ticker,
    gexAvailable: true,
    reason: "Modelled from validated option-chain IV and open interest. Call GEX is positive and put GEX negative as an explicit dealer-position proxy, not observed dealer inventory.",
    method: "black_scholes_oi_proxy",
    source: optionsData.source,
    fetchedAt: optionsData.fetchedAt,
    delayedOrIndicative: Boolean(optionsData.delayedOrIndicative),
    totalGex: round(totalGex),
    grossGex: round(grossGex),
    gammaRegime,
    gammaFlipLevel,
    positiveGammaZones,
    negativeGammaZones,
    pinLevels,
    volatilityExpansionLevels,
    nearestGexLevel,
    confidence,
    contractCount: contracts.length,
    expirationCount: new Set(contracts.map((contract) => contract.expiration)).size,
  };
}

export function calculateBlackScholesGamma({ spot, strike, volatility, timeYears, riskFreeRate = 0.04 }) {
  if (![spot, strike, volatility, timeYears].every(isPositiveNumber)) return null;
  const sigmaRootT = volatility * Math.sqrt(timeYears);
  const d1 = (Math.log(spot / strike) + (riskFreeRate + (volatility ** 2) / 2) * timeYears) / sigmaRootT;
  return normalPdf(d1) / (spot * sigmaRootT);
}

function enrichContract(contract, spot, riskFreeRate, now) {
  const expiry = new Date(contract.expiration);
  if (!Number.isFinite(expiry.getTime())) return null;
  expiry.setUTCHours(21, 0, 0, 0);
  const timeYears = Math.max((expiry.getTime() - now.getTime()) / YEAR_MS, 1 / (365 * 24));
  const gamma = calculateBlackScholesGamma({
    spot,
    strike: contract.strike,
    volatility: contract.impliedVolatility,
    timeYears,
    riskFreeRate,
  });
  if (!isPositiveNumber(gamma) || !isPositiveNumber(contract.openInterest)) return null;
  const unsignedGex = gamma * contract.openInterest * (contract.contractSize ?? 100) * spot * spot * 0.01;

  return {
    ...contract,
    timeYears,
    gamma,
    signedGex: contract.type === "put" ? -unsignedGex : unsignedGex,
    grossGex: unsignedGex,
  };
}

function aggregateByStrike(contracts) {
  const rows = new Map();
  contracts.forEach((contract) => {
    const current = rows.get(contract.strike) ?? {
      price: contract.strike,
      netGex: 0,
      grossGex: 0,
      callGex: 0,
      putGex: 0,
    };
    current.netGex += contract.signedGex;
    current.grossGex += contract.grossGex;
    if (contract.type === "call") current.callGex += contract.grossGex;
    if (contract.type === "put") current.putGex += contract.grossGex;
    rows.set(contract.strike, current);
  });
  return [...rows.values()].sort((a, b) => a.price - b.price);
}

function findGammaFlip(contracts, spot, riskFreeRate, now) {
  const levels = Array.from({ length: 31 }, (_, index) => spot * (0.85 + index * 0.01));
  const profile = levels.map((level) => ({
    level,
    gex: contracts.reduce((sum, contract) => {
      const gamma = calculateBlackScholesGamma({
        spot: level,
        strike: contract.strike,
        volatility: contract.impliedVolatility,
        timeYears: contract.timeYears,
        riskFreeRate,
      });
      if (!gamma) return sum;
      const exposure = gamma * contract.openInterest * (contract.contractSize ?? 100) * level * level * 0.01;
      return sum + (contract.type === "put" ? -exposure : exposure);
    }, 0),
  }));
  const crossings = [];
  for (let index = 1; index < profile.length; index++) {
    const left = profile[index - 1];
    const right = profile[index];
    if (left.gex === 0) crossings.push(left.level);
    if (Math.sign(left.gex) !== Math.sign(right.gex)) {
      const ratio = Math.abs(left.gex) / (Math.abs(left.gex) + Math.abs(right.gex));
      crossings.push(left.level + (right.level - left.level) * ratio);
    }
  }
  if (crossings.length === 0) return null;
  return round(crossings.sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot))[0]);
}

function findNearestLevel(spot, levels) {
  const candidates = [
    ...levels.positiveGammaZones.map((zone) => ({ price: zone.center, type: "positive_gamma" })),
    ...levels.negativeGammaZones.map((zone) => ({ price: zone.center, type: "negative_gamma" })),
    ...levels.pinLevels.map((price) => ({ price, type: "pin" })),
    ...(isPositiveNumber(levels.gammaFlipLevel) ? [{ price: levels.gammaFlipLevel, type: "gamma_flip" }] : []),
  ];
  if (candidates.length === 0) return null;
  const nearest = candidates.sort((a, b) => Math.abs(a.price - spot) - Math.abs(b.price - spot))[0];
  return {
    ...nearest,
    distancePct: round((Math.abs(nearest.price - spot) / spot) * 100),
  };
}

function toZone(row) {
  return {
    lower: row.price,
    upper: row.price,
    center: row.price,
    netGex: round(row.netGex),
    grossGex: round(row.grossGex),
  };
}

function unavailableGex(ticker, reason) {
  return {
    ticker,
    gexAvailable: false,
    reason,
    totalGex: null,
    gammaRegime: "unknown",
    gammaFlipLevel: null,
    positiveGammaZones: [],
    negativeGammaZones: [],
    pinLevels: [],
    volatilityExpansionLevels: [],
    nearestGexLevel: null,
    confidence: 0,
  };
}

function normalPdf(value) {
  return Math.exp(-0.5 * value * value) / Math.sqrt(2 * Math.PI);
}

function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Number(value.toFixed(2));
}
