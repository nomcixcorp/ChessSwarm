import type { AiInsightsResult } from "./ai-insights.js";
import type { DeterministicAnalytics } from "./analytics.js";
import type { DashboardFilters } from "./filters.js";
import type { NormalizedGame } from "./games.js";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, string>;
}

/**
 * Successful dashboard payload: games + deterministic analytics + optional AI layer.
 */
export interface DashboardSuccess {
  filters: DashboardFilters;
  games: NormalizedGame[];
  analytics: DeterministicAnalytics;
  aiInsights?: AiInsightsResult | null;
  meta: DashboardResponseMeta;
}

export interface DashboardResponseMeta {
  fetchedAtMs: number;
  /** True if upstream pagination or caps left unprocessed games. */
  partial?: boolean;
  /** Non-fatal ingestion or analysis warnings. */
  warnings?: string[];
}

export type DashboardResult = DashboardSuccess | { error: ApiErrorBody };
