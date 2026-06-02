import { containsKeyword } from "../utils/textMatching.js";
import { flowRowForAsset, headlineMentionsFlow } from "./flowService.js";

const assetNewsRules = {
  ES: {
    confirmsUp: ["soft landing", "rate cut", "cooling inflation", "strong earnings", "risk-on"],
    confirmsDown: ["hot inflation", "hawkish", "recession", "tariff", "risk-off", "higher yields"],
  },
  NQ: {
    confirmsUp: ["ai", "chip", "rate cut", "cooling inflation", "tech rally", "strong earnings"],
    confirmsDown: ["higher yields", "hawkish", "antitrust", "chip restrictions", "tech selloff"],
  },
  YM: {
    confirmsUp: ["manufacturing", "industrial", "strong payrolls", "soft landing"],
    confirmsDown: ["manufacturing slowdown", "tariff", "recession", "weak payrolls"],
  },
  GOLD: {
    confirmsUp: ["war", "geopolitics", "safe haven", "weak dollar", "rate cut", "lower yields"],
    confirmsDown: ["strong dollar", "higher yields", "hawkish", "risk-on"],
  },
  DXY: {
    confirmsUp: ["hawkish", "higher yields", "hot inflation", "safe haven", "risk-off"],
    confirmsDown: ["dovish", "rate cut", "cooling inflation", "dollar weakness"],
  },
  USOIL: {
    confirmsUp: ["supply cut", "opec", "inventory draw", "war", "middle east", "strong demand"],
    confirmsDown: ["inventory build", "weak demand", "oversupply", "recession"],
  },
};

export function compareNewsToFlow(newsItems = [], flowSnapshot = {}, asset) {
  const flow = flowRowForAsset(flowSnapshot, asset);
  const rules = assetNewsRules[asset] ?? { confirmsUp: [], confirmsDown: [] };
  const confirmingHeadlines = [];
  const contradictingHeadlines = [];
  const explanatoryHeadlines = [];
  const unrelatedHeadlines = [];
  const direction = flow?.direction ?? "neutral";

  for (const item of newsItems.slice(0, 40)) {
    const text = `${item.title ?? ""} ${item.contentSnippet ?? ""}`.toLowerCase();
    const upMatch = rules.confirmsUp.some((keyword) => containsKeyword(text, keyword));
    const downMatch = rules.confirmsDown.some((keyword) => containsKeyword(text, keyword));
    const isExplanatory = headlineMentionsFlow(text);
    const normalized = {
      title: item.title,
      source: item.source,
      pubDate: item.pubDate,
      link: item.link,
    };

    if (direction === "inflow" && upMatch) confirmingHeadlines.push(normalized);
    else if (direction === "outflow" && downMatch) confirmingHeadlines.push(normalized);
    else if (direction === "inflow" && downMatch) contradictingHeadlines.push(normalized);
    else if (direction === "outflow" && upMatch) contradictingHeadlines.push(normalized);
    else if (isExplanatory) explanatoryHeadlines.push(normalized);
    else unrelatedHeadlines.push(normalized);
  }

  const relationship = resolveRelationship({
    flow,
    confirmingHeadlines,
    contradictingHeadlines,
    explanatoryHeadlines,
  });
  const confidence = resolveConfidence(relationship, confirmingHeadlines, contradictingHeadlines, explanatoryHeadlines);

  return {
    relationship,
    confidence,
    confirmingHeadlines: confirmingHeadlines.slice(0, 6),
    contradictingHeadlines: contradictingHeadlines.slice(0, 6),
    explanatoryHeadlines: explanatoryHeadlines.slice(0, 6),
    unrelatedHeadlines: unrelatedHeadlines.slice(0, 6),
    reasons: buildReasons({ asset, flow, relationship, confirmingHeadlines, contradictingHeadlines, explanatoryHeadlines }),
  };
}

function resolveRelationship({ flow, confirmingHeadlines, contradictingHeadlines, explanatoryHeadlines }) {
  if (!flow || flow.direction === "neutral") return "insufficient_data";
  if (contradictingHeadlines.length > confirmingHeadlines.length) return "contradicts_flow";
  if (confirmingHeadlines.length > 0) return "confirms_flow";
  if (explanatoryHeadlines.length > 0) return "explains_flow";
  return "unrelated";
}

function resolveConfidence(relationship, confirming, contradicting, explanatory) {
  if (relationship === "insufficient_data") return 20;
  if (relationship === "confirms_flow") return Math.min(85, 55 + confirming.length * 8);
  if (relationship === "contradicts_flow") return Math.min(80, 50 + contradicting.length * 8);
  if (relationship === "explains_flow") return Math.min(70, 45 + explanatory.length * 5);
  return 30;
}

function buildReasons({ asset, flow, relationship, confirmingHeadlines, contradictingHeadlines, explanatoryHeadlines }) {
  const reasons = [];

  if (!flow) {
    reasons.push(`${asset} has no usable market flow proxy row.`);
    return reasons;
  }

  reasons.push(`${asset} flow proxy is ${flow.direction} with ${flow.strength} strength.`);
  if (relationship === "confirms_flow") reasons.push(`${confirmingHeadlines.length} headline(s) confirm the observed flow.`);
  if (relationship === "contradicts_flow") reasons.push(`${contradictingHeadlines.length} headline(s) contradict the observed flow.`);
  if (relationship === "explains_flow") reasons.push(`${explanatoryHeadlines.length} headline(s) may explain the move.`);
  if (relationship === "unrelated") reasons.push("Current headlines do not clearly explain this flow.");
  return reasons;
}
