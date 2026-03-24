import type { AiInsightsRequest } from "@chess-swarm/shared-types";

export interface PromptMessages {
  system: string;
  user: string;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function buildGroundedMetricsSnapshot(request: AiInsightsRequest): string {
  const { analytics, username } = request;
  const totalGames = Math.max(analytics.gamesAnalyzed, 1);
  const winRate = analytics.overall.wins / totalGames;
  const drawRate = analytics.overall.draws / totalGames;
  const lossRate = analytics.overall.losses / totalGames;

  return [
    `Username: ${username}`,
    `Games analyzed: ${analytics.gamesAnalyzed}`,
    `Overall: wins=${analytics.overall.wins}, losses=${analytics.overall.losses}, draws=${analytics.overall.draws}, other=${analytics.overall.other}`,
    `Rates: win=${formatPercent(winRate)}, draw=${formatPercent(drawRate)}, loss=${formatPercent(lossRate)}`,
    `By color: ${JSON.stringify(analytics.byColor)}`,
    `Openings: ${JSON.stringify(analytics.openings.slice(0, 10))}`,
    `Trends: ${JSON.stringify(analytics.trends)}`,
    `Castling: ${JSON.stringify(analytics.castling)}`,
    `Queen development: ${JSON.stringify(analytics.queenDevelopment)}`,
    `King safety: ${JSON.stringify(analytics.kingSafety)}`,
    `Diagonal exposure: ${JSON.stringify(analytics.diagonalExposure)}`,
    `Weaknesses: ${JSON.stringify(analytics.weaknesses.slice(0, 10))}`,
  ].join("\n");
}

export function buildPromptMessages(request: AiInsightsRequest): PromptMessages {
  const system = [
    "You are a chess coach assistant.",
    "Use only provided deterministic metrics.",
    "Do not invent engine lines, tactical sequences, or unsupported causes.",
    "Return strict JSON only.",
  ].join(" ");

  const user = [
    "Generate grounded coaching insights using this exact JSON shape:",
    "{",
    '  "summary": string,',
    '  "strengths": string[],',
    '  "weaknesses": string[],',
    '  "openingRecommendation": string,',
    '  "tacticalRecommendation": string,',
    '  "trainingPlan": [{ "title": string, "rationale": string, "category": string }],',
    '  "caveats": string[],',
    '  "confidence": number,',
    '  "groundedMetricRefs": string[]',
    "}",
    "Constraints:",
    "- strengths and weaknesses should each have 2-4 items",
    "- trainingPlan should contain exactly 7 daily items",
    "- confidence must be between 0 and 1",
    "- every recommendation must cite metrics in groundedMetricRefs",
    "",
    "Metrics:",
    buildGroundedMetricsSnapshot(request),
  ].join("\n");

  return { system, user };
}

export function createGroundedPrompt(request: AiInsightsRequest): string {
  const messages = buildPromptMessages(request);
  return `${messages.system}\n\n${messages.user}`;
}
