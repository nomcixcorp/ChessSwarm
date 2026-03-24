import type { PlayerColor } from "./games.js";

export interface WinLossDraw {
  wins: number;
  losses: number;
  draws: number;
  other: number;
}

export interface OpeningPerformance {
  /** ECO or synthetic grouping key from chess-core. */
  key: string;
  /** Human label (ECO name, opening name, etc.). */
  displayName: string;
  games: number;
  record: WinLossDraw;
}

export interface ColorSplit extends WinLossDraw {
  color: PlayerColor;
  games: number;
}

export type TrendGranularity = "day" | "week";

export interface TrendBucket {
  bucketStartMs: number;
  record: WinLossDraw;
}

export interface TrendSeries {
  granularity: TrendGranularity;
  buckets: TrendBucket[];
}

export interface CastlingSideStats {
  games: number;
  /** Share of games where user castled this side (0–1), undefined if not computed. */
  rate?: number;
  /** Average move number of first castle, optional until computed. */
  averageMoveNumber?: number;
}

export interface CastlingBehavior {
  kingside: CastlingSideStats;
  queenside: CastlingSideStats;
  /** Games where user never castled. */
  neverCastled: { games: number; rate?: number };
}

export interface QueenDevelopmentStats {
  games: number;
  /** Average move number queen first moved from starting file, optional until computed. */
  averageDevelopmentMove?: number;
}

export interface KingSafetyHeuristic {
  /** Normalized score or bucket; interpretation owned by chess-core. */
  score?: number;
  label?: string;
  games: number;
}

export interface DiagonalExposureHeuristic {
  /** Exposed diagonals toward king heuristic; details owned by chess-core. */
  score?: number;
  label?: string;
  games: number;
}

export type WeaknessSeverity = "info" | "low" | "medium" | "high";

export interface WeaknessTag {
  id: string;
  label: string;
  description: string;
  severity: WeaknessSeverity;
  /** Count of supporting games or incidents. */
  evidenceCount: number;
  /** Optional structured evidence (e.g. game ids); keep small for API payloads. */
  sampleGameIds?: string[];
}

/**
 * Deterministic analytics from chess-core (no LLM).
 */
export interface DeterministicAnalytics {
  gamesAnalyzed: number;
  overall: WinLossDraw;
  byColor: ColorSplit[];
  openings: OpeningPerformance[];
  trends: TrendSeries;
  castling: CastlingBehavior;
  queenDevelopment: QueenDevelopmentStats;
  kingSafety: KingSafetyHeuristic;
  diagonalExposure: DiagonalExposureHeuristic;
  weaknesses: WeaknessTag[];
}
