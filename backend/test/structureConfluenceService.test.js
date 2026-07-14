import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConfluenceBreakdown,
  buildCvdBiasComponent,
  buildGexBiasComponent,
} from "../services/structureConfluenceService.js";

test("raises reversal confluence when a sweep aligns with CVD divergence near GEX", () => {
  const gex = {
    gexAvailable: true,
    gammaRegime: "positive",
    nearestGexLevel: { type: "pin", distancePct: 0.4 },
  };
  const cvd = {
    cvdAvailable: true,
    cvdIndex: 20,
    cvdTrend: "rising",
    bullishDivergence: true,
    bearishDivergence: false,
    continuationConfirmation: false,
    exhaustionSignal: true,
  };
  const gexComponent = buildGexBiasComponent(gex, "Ranging", cvd);
  const cvdComponent = buildCvdBiasComponent(cvd);
  const result = buildConfluenceBreakdown({
    reversal: { signal: "BULLISH_REVERSAL", label: "Bull Reversal" },
    gex,
    cvd,
    gexComponent,
    cvdComponent,
  });

  assert.ok(result.finalReversalConfluence >= 70);
  assert.ok(result.notes.some((note) => note.includes("CVD divergence")));
});

test("raises directional bias when negative gamma and CVD confirm continuation", () => {
  const gex = {
    gexAvailable: true,
    gammaRegime: "negative",
    nearestGexLevel: { type: "negative_gamma", distancePct: 0.5 },
  };
  const cvd = {
    cvdAvailable: true,
    cvdIndex: 60,
    cvdTrend: "rising",
    bullishDivergence: false,
    bearishDivergence: false,
    continuationConfirmation: true,
    exhaustionSignal: false,
  };

  const gexComponent = buildGexBiasComponent(gex, "Bullish", cvd);
  const cvdComponent = buildCvdBiasComponent(cvd);

  assert.ok(gexComponent.score > 0);
  assert.ok(cvdComponent.score > 0);
  assert.ok([...gexComponent.notes, ...cvdComponent.notes].some((note) => note.includes("expansion")));
});

test("reduces unsupported reversal confidence when CVD strongly confirms trend", () => {
  const cvd = {
    cvdAvailable: true,
    cvdIndex: -70,
    cvdTrend: "falling",
    bullishDivergence: false,
    bearishDivergence: false,
    continuationConfirmation: true,
    exhaustionSignal: false,
  };
  const result = buildConfluenceBreakdown({
    reversal: { signal: "NO_REVERSAL", label: "No Reversal" },
    gex: { gexAvailable: false, reason: "No chain" },
    cvd,
    gexComponent: buildGexBiasComponent({ gexAvailable: false, reason: "No chain" }, "Bearish", cvd),
    cvdComponent: buildCvdBiasComponent(cvd),
  });

  assert.equal(result.finalReversalConfluence, 0);
});
