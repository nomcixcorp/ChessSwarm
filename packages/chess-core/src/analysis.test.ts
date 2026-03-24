import assert from "node:assert/strict";
import test from "node:test";

import type { NormalizedGame } from "@chess-swarm/shared-types";
import { buildDeterministicAnalytics } from "./analysis.js";

function pgnWithMoves(moves: string, tags: Record<string, string> = {}): string {
  const headerEntries = Object.entries(tags);
  const header =
    headerEntries.length > 0
      ? `${headerEntries.map(([k, v]) => `[${k} "${v}"]`).join("\n")}\n\n`
      : "\n\n";
  return `${header}${moves}`;
}

const SAMPLE_GAMES: NormalizedGame[] = [
  {
    gameId: "g1",
    playedAtMs: Date.UTC(2026, 2, 10),
    timeClass: "rapid",
    userColor: "white",
    result: "win",
    opponentUsername: "op1",
    openingEco: "D06",
    moveCount: 42,
    pgn: pgnWithMoves(
      "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 c6 7. Bd3 Nbd7 8. O-O",
      { ECO: "D06", Opening: "QGD" },
    ),
  },
  {
    gameId: "g2",
    playedAtMs: Date.UTC(2026, 2, 9),
    timeClass: "blitz",
    userColor: "black",
    result: "loss",
    opponentUsername: "op2",
    openingEco: "B20",
    moveCount: 26,
    pgn: pgnWithMoves(
      "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Qh5 g6 7. Qh4 Bg7",
      { ECO: "B20", Opening: "Sicilian" },
    ),
  },
  {
    gameId: "g3",
    playedAtMs: Date.UTC(2026, 2, 7),
    timeClass: "daily",
    userColor: "white",
    result: "draw",
    opponentUsername: "op3",
    openingEco: "A13",
    moveCount: 18,
    pgn: pgnWithMoves("1. c4 e6 2. Nc3 d5 3. d4 Nf6 4. Qd3 Be7 5. Bg5 O-O"),
  },
  {
    gameId: "g4",
    playedAtMs: Date.UTC(2026, 2, 5),
    timeClass: "blitz",
    userColor: "white",
    result: "loss",
    opponentUsername: "op4",
    openingEco: "C20",
    moveCount: 14,
    pgn: pgnWithMoves("1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#"),
  },
  {
    gameId: "g5",
    playedAtMs: Date.UTC(2026, 2, 1),
    timeClass: "rapid",
    userColor: "black",
    result: "loss",
    opponentUsername: "op5",
    openingEco: "D06",
    moveCount: 38,
    pgn: pgnWithMoves("1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 c6"),
  },
];

test("buildDeterministicAnalytics computes expected aggregates", () => {
  const result = buildDeterministicAnalytics(SAMPLE_GAMES);
  const { analytics } = result;

  assert.equal(analytics.gamesAnalyzed, 5);
  assert.deepEqual(analytics.overall, {
    wins: 1,
    losses: 3,
    draws: 1,
    other: 0,
  });

  const whiteSplit = analytics.byColor.find((entry) => entry.color === "white");
  const blackSplit = analytics.byColor.find((entry) => entry.color === "black");
  assert.ok(whiteSplit);
  assert.ok(blackSplit);
  assert.equal(whiteSplit.games, 3);
  assert.equal(blackSplit.games, 2);

  assert.equal(analytics.openings[0].key, "D06");
  assert.equal(analytics.openings[0].games, 2);

  assert.equal(analytics.castling.neverCastled.games, 3);
  assert.equal(analytics.queenDevelopment.games, 5);
  assert.ok((analytics.queenDevelopment.averageDevelopmentMove ?? 0) > 0);
  assert.equal(analytics.kingSafety.games, 5);
  assert.equal(analytics.diagonalExposure.games, 5);

  assert.ok(analytics.weaknesses.length > 0);
  const weaknessIds = analytics.weaknesses.map((entry) => entry.id);
  assert.ok(weaknessIds.includes("early-queen"));
});

test("buildDeterministicAnalytics returns representative game picks", () => {
  const result = buildDeterministicAnalytics(SAMPLE_GAMES);
  assert.ok(result.representativeGames.length > 0);
  assert.ok(
    result.representativeGames.some((pick) =>
      pick.reason.startsWith("most played opening"),
    ),
  );
});

test("buildDeterministicAnalytics handles empty input", () => {
  const result = buildDeterministicAnalytics([]);
  assert.equal(result.analytics.gamesAnalyzed, 0);
  assert.equal(result.analytics.openings.length, 0);
  assert.equal(result.analytics.weaknesses.length, 0);
  assert.equal(result.representativeGames.length, 0);
});
