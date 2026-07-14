import assert from "node:assert/strict";
import test from "node:test";
import { buildSessionContext, buildSessionProjection } from "../services/sessionService.js";
import { scoreToBias } from "../utils/scoring.js";
import { edgeScoreToBias } from "../services/confluenceService.js";

test("uses Bullish, Bearish, and Ranging as final bias states", () => {
  assert.equal(scoreToBias(3), "Bullish");
  assert.equal(scoreToBias(-3), "Bearish");
  assert.equal(scoreToBias(0), "Ranging");
});

test("uses the confluence score scale for final directional bias", () => {
  assert.equal(edgeScoreToBias(20), "Bullish");
  assert.equal(edgeScoreToBias(-20), "Bearish");
  assert.equal(edgeScoreToBias(19.99), "Ranging");
});

test("prioritizes New York as the main session during the London overlap", () => {
  const context = buildSessionContext("2026-07-14T14:00:00.000Z");

  assert.equal(context.primarySession.name, "New York");
  assert.equal(context.primarySession.projectionStatus, "CURRENT");
});

test("targets the next main session when all tracked sessions are closed", () => {
  const context = buildSessionContext("2026-07-14T22:00:00.000Z");
  const projection = buildSessionProjection({
    bias: "Neutral",
    confidence: 40,
    trendState: "neutral",
    sessionContext: context,
  });

  assert.equal(context.primarySession.name, "Asia");
  assert.equal(projection.projectionStatus, "UPCOMING");
  assert.equal(projection.bias, "Ranging");
});
