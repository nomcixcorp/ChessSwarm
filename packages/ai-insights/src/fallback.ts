import type { AiInsightsRequest, AiInsightsResult, TrainingPlanItem } from "@chess-swarm/shared-types";

function safePercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Math.round((numerator / denominator) * 100);
}

function topStrengths(request: AiInsightsRequest): string[] {
  const { analytics } = request;
  const winRate = safePercent(analytics.overall.wins, analytics.gamesAnalyzed);
  const bestOpening = analytics.openings[0];
  const strengths: string[] = [];

  if (winRate >= 55) {
    strengths.push(`Consistent conversion: ${winRate}% win rate in the sampled games.`);
  }
  if (bestOpening && bestOpening.games >= 2) {
    const openingWinRate = safePercent(bestOpening.record.wins, bestOpening.games);
    strengths.push(
      `Most-used opening ${bestOpening.displayName} is stable (${openingWinRate}% wins over ${bestOpening.games} games).`,
    );
  }
  if ((analytics.castling.kingside.rate ?? 0) >= 0.6) {
    strengths.push("You castle kingside regularly, which supports safer middlegames.");
  }

  if (strengths.length === 0) {
    strengths.push("Game sample is small but shows workable fundamentals in opening development.");
  }

  return strengths.slice(0, 3);
}

function topWeaknesses(request: AiInsightsRequest): string[] {
  const weaknessTags = request.analytics.weaknesses;
  if (weaknessTags.length === 0) {
    return ["No dominant recurring weakness detected in the current filtered sample."];
  }

  return weaknessTags.slice(0, 3).map((tag) => `${tag.label}: ${tag.description}`);
}

function openingRecommendation(request: AiInsightsRequest): string {
  const weakOpening = request.analytics.weaknesses.find((entry) => entry.id.startsWith("opening-"));
  const bestOpening = request.analytics.openings[0];

  if (weakOpening) {
    return `Opening focus: simplify your repertoire around one structure and review ${weakOpening.label.toLowerCase()} with 3 annotated model games.`;
  }

  if (bestOpening) {
    return `Opening focus: keep building around ${bestOpening.displayName} and prepare one anti-line against common replies.`;
  }

  return "Opening focus: pick one white setup and one black defense, then play only those for a week.";
}

function tacticalRecommendation(request: AiInsightsRequest): string {
  const weaknessIds = new Set(request.analytics.weaknesses.map((entry) => entry.id));

  if (weaknessIds.has("king-safety") || weaknessIds.has("late-castle")) {
    return "Tactical focus: train king-safety motifs (back-rank, Greek gift patterns, and open-file attacks) for 15 minutes daily.";
  }
  if (weaknessIds.has("early-queen")) {
    return "Tactical focus: solve development-punishment puzzles where early queen activity is refuted by tempo gains.";
  }

  return "Tactical focus: do mixed tactical puzzles emphasizing forks, pins, and simple two-move calculations.";
}

function buildTrainingPlan(request: AiInsightsRequest): TrainingPlanItem[] {
  return [
    {
      category: "openings",
      title: "Day 1-2: Opening structure review",
      rationale: openingRecommendation(request),
    },
    {
      category: "tactics",
      title: "Day 3-5: Tactical pattern block",
      rationale: tacticalRecommendation(request),
    },
    {
      category: "game-review",
      title: "Day 6: Annotated self-review",
      rationale:
        "Review 3 recent losses and tag one opening mistake, one tactical oversight, and one time-management decision per game.",
    },
    {
      category: "practical-play",
      title: "Day 7: Focused rapid session",
      rationale:
        "Play 3 rapid games using your simplified opening plan, then immediately review first 12 moves for consistency.",
    },
  ];
}

export function buildDeterministicFallbackInsights(
  request: AiInsightsRequest,
  reason: "missing_api_key" | "provider_error",
): AiInsightsResult {
  const strengthList = topStrengths(request);
  const weaknessList = topWeaknesses(request);
  const opening = openingRecommendation(request);
  const tactical = tacticalRecommendation(request);

  return {
    summary:
      `Grounded coaching for ${request.username} based on ${request.analytics.gamesAnalyzed} games. ` +
      `Primary strength: ${strengthList[0]} Primary weakness: ${weaknessList[0]}`,
    strengths: [...strengthList, opening],
    weaknesses: [...weaknessList, tactical],
    trainingPlan: buildTrainingPlan(request),
    openingRecommendation: opening,
    tacticalRecommendation: tactical,
    caveats: [
      "Insights are derived from filtered public games and deterministic metrics.",
      "No engine evaluation is used, so recommendations focus on practical patterns.",
      reason === "missing_api_key"
        ? "OpenAI key missing: deterministic coaching fallback used."
        : "LLM provider unavailable: deterministic coaching fallback used.",
    ],
    confidence: request.analytics.gamesAnalyzed >= 20 ? 0.7 : 0.5,
    groundedMetricRefs: [
      "analytics.gamesAnalyzed",
      "analytics.overall",
      "analytics.openings",
      "analytics.weaknesses",
      "analytics.castling",
    ],
  };
}

export const buildFallbackAiInsights = buildDeterministicFallbackInsights;
