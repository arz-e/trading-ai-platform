import assert from "node:assert/strict";
import test from "node:test";
import { analyzeGex } from "../services/gexService.js";

const now = new Date("2026-07-14T12:00:00.000Z");
const expiration = "2026-08-21T00:00:00.000Z";

test("returns unavailable when no validated options chain exists", () => {
  const result = analyzeGex({
    ticker: "ES",
    spotPrice: 100,
    optionsData: { status: "UNAVAILABLE", error: "No futures options chain." },
    now,
  });

  assert.equal(result.gexAvailable, false);
  assert.match(result.reason, /No futures options chain/);
});

test("detects a positive gamma regime", () => {
  const result = analyzeGex({
    ticker: "TEST",
    spotPrice: 100,
    optionsData: optionData({ callOpenInterest: 1200, putOpenInterest: 100 }),
    now,
  });

  assert.equal(result.gexAvailable, true);
  assert.equal(result.gammaRegime, "positive");
  assert.ok(result.positiveGammaZones.length > 0);
});

test("detects a negative gamma regime", () => {
  const result = analyzeGex({
    ticker: "TEST",
    spotPrice: 100,
    optionsData: optionData({ callOpenInterest: 100, putOpenInterest: 1200 }),
    now,
  });

  assert.equal(result.gammaRegime, "negative");
  assert.ok(result.negativeGammaZones.length > 0);
});

test("detects a gamma flip when put and call concentrations sit on opposite sides", () => {
  const contracts = [
    ...Array.from({ length: 8 }, () => contract("put", 90, 1000)),
    ...Array.from({ length: 8 }, () => contract("call", 110, 1000)),
  ];
  const result = analyzeGex({
    ticker: "TEST",
    spotPrice: 100,
    optionsData: { status: "OK", contracts, source: "test", fetchedAt: now.toISOString() },
    now,
  });

  assert.equal(result.gexAvailable, true);
  assert.ok(typeof result.gammaFlipLevel === "number");
  assert.ok(result.gammaFlipLevel > 90 && result.gammaFlipLevel < 110);
});

function optionData({ callOpenInterest, putOpenInterest }) {
  return {
    status: "OK",
    source: "test",
    fetchedAt: now.toISOString(),
    contracts: [95, 97.5, 100, 102.5, 105].flatMap((strike) => [
      contract("call", strike, callOpenInterest),
      contract("put", strike, putOpenInterest),
    ]),
  };
}

function contract(type, strike, openInterest) {
  return {
    type,
    strike,
    expiration,
    impliedVolatility: 0.25,
    openInterest,
    contractSize: 100,
  };
}
