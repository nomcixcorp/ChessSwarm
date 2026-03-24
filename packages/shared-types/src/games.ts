import type { ChessComTimeClass } from "./filters.js";

/** Side the searched user played. */
export type PlayerColor = "white" | "black";

/**
 * Terminal result from the searched user's perspective.
 * Maps Chess.com outcomes (win/loss/draw/resign/abandoned/etc.) into analytics buckets.
 */
export type UserPerspectiveResult = "win" | "loss" | "draw" | "other";

/**
 * Normalized game record after ingestion (not raw Chess.com JSON).
 */
export interface NormalizedGame {
  /** Stable id (e.g. derived from official game URL or archive identity). */
  gameId: string;
  playedAtMs: number;
  timeClass: ChessComTimeClass;
  userColor: PlayerColor;
  result: UserPerspectiveResult;
  userRating?: number;
  opponentUsername: string;
  opponentRating?: number;
  /** Full PGN when available; omit in lightweight list responses if desired. */
  pgn?: string;
  /** Original public game URL when available. */
  sourceUrl?: string;
  /** ECO code when derivable from PGN/opening field; optional until analysis runs. */
  openingEco?: string;
  /** Half-moves played (optional until parsed). */
  moveCount?: number;
}
