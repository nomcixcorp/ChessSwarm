import type { DeterministicAnalytics } from "./analytics.js";

export interface TrainingPlanItem {
  title: string;
  rationale: string;
  /** Suggested focus: openings, tactics, endgames, time management, etc. */
  category: string;
}

/**
 * Input to the AI insights package: structured metrics only (no raw PGN required).
 */
export interface AiInsightsRequest {
  username: string;
  analytics: DeterministicAnalytics;
  locale?: string;
}

/**
 * Typed coaching output; claims must be grounded in `analytics` by the AI layer.
 */
export interface AiInsightsResult {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  openingRecommendation: string;
  tacticalRecommendation: string;
  trainingPlan: TrainingPlanItem[];
  caveats: string[];
  /** 0-1 confidence score based on evidence quality and sample size. */
  confidence: number;
  /** Optional trace for debugging: metric keys or ids cited in the summary. */
  groundedMetricRefs?: string[];
}
