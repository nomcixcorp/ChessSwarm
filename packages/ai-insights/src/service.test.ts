import assert from "node:assert/strict";
import test from "node:test";

import type { AiInsightsRequest, AiInsightsResult, DeterministicAnalytics } from "@chess-swarm/shared-types";
import {
  buildDeterministicFallbackInsights,
  generateAiInsights,
  type GenerateAiInsightsDependencies,
} from "./index.js";

const ANALYTICS_FIXTURE: DeterministicAnalytics = {
  gamesAnalyzed: 24,
  overall: {
    wins: 11,
    losses: 9,
    draws: 4,
    other: 0,
  },
  byColor: [
    {
      color: "white",
      games: 12,
      wins: 7,
      losses: 3,
      draws: 2,
      other: 0,
    },
    {
      color: "black",
      games: 12,
      wins: 4,
      losses: 6,
      draws: 2,
      other: 0,
    },
  ],
  openings: [
    {
      key: "B20",
      displayName: "Sicilian Defense",
      games: 6,
      record: { wins: 2, losses: 3, draws: 1, other: 0 },
    },
    {
      key: "D06",
      displayName: "Queen's Gambit",
      games: 5,
      record: { wins: 4, losses: 1, draws: 0, other: 0 },
    },
  ],
  trends: {
    granularity: "week",
    buckets: [
      {
        bucketStartMs: Date.UTC(2026, 1, 1),
        record: { wins: 3, losses: 4, draws: 1, other: 0 },
      },
      {
        bucketStartMs: Date.UTC(2026, 1, 8),
        record: { wins: 8, losses: 5, draws: 3, other: 0 },
      },
    ],
  },
  castling: {
    kingside: { games: 12, rate: 0.5, averageMoveNumber: 8.4 },
    queenside: { games: 2, rate: 0.083, averageMoveNumber: 11.5 },
    neverCastled: { games: 10, rate: 0.417 },
  },
  queenDevelopment: {
    games: 24,
    averageDevelopmentMove: 5.2,
  },
  kingSafety: {
    games: 24,
    score: 0.58,
    label: "fragile",
  },
  diagonalExposure: {
    games: 24,
    score: 0.62,
    label: "watch",
  },
  weaknesses: [
    {
      id: "king-safety",
      label: "King safety risk",
      description: "Delayed castling appears in many losses.",
      severity: "high",
      evidenceCount: 10,
      sampleGameIds: ["a", "b", "c"],
    },
    {
      id: "early-queen",
      label: "Early queen development",
      description: "Queen leaves home too early in multiple games.",
      severity: "medium",
      evidenceCount: 6,
      sampleGameIds: ["d", "e"],
    },
  ],
};

const REQUEST_FIXTURE: AiInsightsRequest = {
  username: "sample-player",
  analytics: ANALYTICS_FIXTURE,
};

test("fallback insights stay grounded and deterministic", () => {
  const result = buildDeterministicFallbackInsights(REQUEST_FIXTURE, "missing_api_key");

  assert.match(result.summary, /sample-player/i);
  assert.equal(result.trainingPlan.length, 4);
  assert.ok(result.openingRecommendation);
  assert.ok(result.tacticalRecommendation);
  assert.ok(result.caveats.length > 0);
  assert.ok(result.groundedMetricRefs?.includes("analytics.overall"));
  assert.ok(result.groundedMetricRefs?.includes("analytics.weaknesses"));
  assert.equal(result.confidence, 0.7);
});

test("service uses fallback when API key is missing", async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const result = await generateAiInsights(REQUEST_FIXTURE);
    assert.equal(result.trainingPlan.length, 4);
    assert.ok(result.caveats.some((entry) => entry.includes("fallback")));
  } finally {
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
});

test("service can use injected provider", async () => {
  const fakeOptions: GenerateAiInsightsDependencies = {
    createProvider: () => ({
      async generate(request): Promise<AiInsightsResult> {
        return {
          summary: `Injected for ${request.username}`,
          strengths: ["Tempo gains"],
          weaknesses: ["Clock handling"],
          openingRecommendation: "Play stable d4 structures this week.",
          tacticalRecommendation: "Drill undefended piece tactics daily.",
          trainingPlan: [
            {
              title: "Day 1",
              rationale: "Build pattern speed",
              category: "tactics",
            },
          ],
          caveats: ["Injected provider output"],
          confidence: 0.8,
          groundedMetricRefs: ["overall"],
        };
      },
    }),
  };

  const result = await generateAiInsights(REQUEST_FIXTURE, fakeOptions);
  assert.equal(result.summary, "Injected for sample-player");
  assert.equal(result.confidence, 0.8);
  assert.equal(result.trainingPlan.length, 1);
});
