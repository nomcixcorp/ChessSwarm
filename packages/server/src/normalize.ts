import type {
  ChessComGameRaw,
  ChessComTimeClass,
  NormalizedGame,
  UserPerspectiveResult,
} from "@chess-swarm/shared-types";
import { parsePgnMeta } from "./pgn.js";

const DRAW_RESULTS = new Set([
  "agreed",
  "repetition",
  "stalemate",
  "50move",
  "timevsinsufficient",
  "insufficient",
  "draw",
]);

const LOSS_RESULTS = new Set(["checkmated", "resigned", "timeout", "lose", "abandoned"]);

const SUPPORTED_TIME_CLASSES = new Set<ChessComTimeClass>([
  "bullet",
  "blitz",
  "rapid",
  "daily",
  "classical",
]);

export function normalizeChessComResult(rawResult: string | undefined): UserPerspectiveResult {
  if (!rawResult) {
    return "other";
  }

  if (rawResult === "win") {
    return "win";
  }

  if (DRAW_RESULTS.has(rawResult)) {
    return "draw";
  }

  if (LOSS_RESULTS.has(rawResult)) {
    return "loss";
  }

  return "other";
}

function normalizeUsername(username?: string): string {
  return (username ?? "").trim().toLowerCase();
}

export function toSupportedTimeClass(rawTimeClass: string | undefined): ChessComTimeClass | null {
  if (!rawTimeClass || !SUPPORTED_TIME_CLASSES.has(rawTimeClass as ChessComTimeClass)) {
    return null;
  }

  return rawTimeClass as ChessComTimeClass;
}

export function normalizeGameFromUserPerspective(
  rawGame: ChessComGameRaw,
  perspectiveUsername: string,
): NormalizedGame | null {
  if (!rawGame.url || !rawGame.end_time) {
    return null;
  }

  const timeClass = toSupportedTimeClass(rawGame.time_class);
  if (!timeClass) {
    return null;
  }

  const normalizedPerspective = normalizeUsername(perspectiveUsername);
  const whiteUsername = normalizeUsername(rawGame.white?.username);
  const blackUsername = normalizeUsername(rawGame.black?.username);

  let userColor: "white" | "black" | null = null;
  if (normalizedPerspective === whiteUsername) {
    userColor = "white";
  } else if (normalizedPerspective === blackUsername) {
    userColor = "black";
  }

  if (!userColor) {
    return null;
  }

  const userRef = userColor === "white" ? rawGame.white : rawGame.black;
  const opponentRef = userColor === "white" ? rawGame.black : rawGame.white;
  const pgnMeta = parsePgnMeta(rawGame.pgn);

  return {
    gameId: rawGame.url,
    playedAtMs: rawGame.end_time * 1000,
    timeClass,
    userColor,
    result: normalizeChessComResult(userRef?.result),
    userRating: userRef?.rating,
    opponentUsername: opponentRef?.username ?? "Unknown",
    opponentRating: opponentRef?.rating,
    pgn: rawGame.pgn,
    sourceUrl: rawGame.url,
    openingEco: pgnMeta.eco,
    moveCount: pgnMeta.moveCount,
  };
}
