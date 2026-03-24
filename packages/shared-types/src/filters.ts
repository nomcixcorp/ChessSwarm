/**
 * Filter dimensions for dashboard queries (product: time class, timeframe, max games).
 */

/** Chess.com `time_class` values commonly returned by the public games API. */
export type ChessComTimeClass = "bullet" | "blitz" | "rapid" | "daily" | "classical";

export type TimeframePreset = "week" | "month" | "three_months";

export interface CustomTimeRange {
  kind: "custom";
  /** Inclusive start, Unix ms */
  startMs: number;
  /** Inclusive end, Unix ms */
  endMs: number;
}

export type TimeframeSelection = { kind: TimeframePreset } | CustomTimeRange;

/**
 * Normalized filter set submitted by the client and echoed on responses.
 */
export interface DashboardFilters {
  username: string;
  timeClasses: ChessComTimeClass[];
  timeframe: TimeframeSelection;
  maxGames: number;
}
