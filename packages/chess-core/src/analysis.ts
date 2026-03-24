import type {
  CastlingBehavior,
  ColorSplit,
  DeterministicAnalytics,
  DiagonalExposureHeuristic,
  KingSafetyHeuristic,
  OpeningPerformance,
  TrendBucket,
  TrendSeries,
  WeaknessTag,
  WinLossDraw,
} from "@chess-swarm/shared-types";
import type { NormalizedGame, UserPerspectiveResult } from "@chess-swarm/shared-types";

const RESULT_KEYS: Record<UserPerspectiveResult, keyof WinLossDraw> = {
  win: "wins",
  loss: "losses",
  draw: "draws",
  other: "other",
};

interface ParsedPgnSignals {
  castledKingsideMove?: number;
  castledQueensideMove?: number;
  queenFirstMove?: number;
  kingMovedWithoutCastling: boolean;
  earlyQueen: boolean;
  kingInCenterLate: boolean;
  earlyGOrBPush: boolean;
  noCastlingWithLongGame: boolean;
}

export interface RepresentativeGame {
  gameId: string;
  reason: string;
}

export interface AnalyticsBundle {
  analytics: DeterministicAnalytics;
  representativeGames: RepresentativeGame[];
}

export type DeterministicAnalyticsBuildResult = AnalyticsBundle;

function emptyRecord(): WinLossDraw {
  return {
    wins: 0,
    losses: 0,
    draws: 0,
    other: 0,
  };
}

function appendResult(record: WinLossDraw, result: UserPerspectiveResult): void {
  record[RESULT_KEYS[result]] += 1;
}

function roundToThree(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function parsePgnSignals(game: NormalizedGame): ParsedPgnSignals {
  const pgn = game.pgn ?? "";
  const moveSection = pgn.includes("\n\n") ? pgn.split("\n\n").slice(1).join("\n\n") : pgn;
  const clean = moveSection
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\$\d+/g, " ")
    .replace(/\r/g, " ");

  const tokens = clean
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !/^\d+\.(\.\.)?$/.test(token))
    .filter(
      (token) =>
        token !== "1-0" &&
        token !== "0-1" &&
        token !== "1/2-1/2" &&
        token !== "*" &&
        token !== "½-½",
    );

  let castledKingsideMove: number | undefined;
  let castledQueensideMove: number | undefined;
  let queenFirstMove: number | undefined;
  let kingMovedWithoutCastling = false;
  let earlyGOrBPush = false;

  const userMoves = tokens.filter((_, index) =>
    game.userColor === "white" ? index % 2 === 0 : index % 2 === 1,
  );

  for (let index = 0; index < userMoves.length; index += 1) {
    const move = userMoves[index];
    const moveNumber = index + 1;

    if (move === "O-O") {
      castledKingsideMove ??= moveNumber;
    }
    if (move === "O-O-O") {
      castledQueensideMove ??= moveNumber;
    }

    const normalizedMove = move.replace(/[+#?!]/g, "");
    if (!queenFirstMove && /^Q[a-h1-8x]/.test(normalizedMove)) {
      queenFirstMove = moveNumber;
    }

    if (
      !kingMovedWithoutCastling &&
      /^K[a-h1-8x]/.test(normalizedMove) &&
      normalizedMove !== "O-O" &&
      normalizedMove !== "O-O-O"
    ) {
      kingMovedWithoutCastling = true;
    }

    if (!earlyGOrBPush && moveNumber <= 4 && /^[gb][3-5]/i.test(normalizedMove)) {
      earlyGOrBPush = true;
    }
  }

  const moveCount = game.moveCount ?? tokens.length;
  const noCastlingWithLongGame =
    moveCount >= 30 && !castledKingsideMove && !castledQueensideMove;
  const earlyQueen = Boolean(queenFirstMove && queenFirstMove <= 5);
  const kingInCenterLate = moveCount >= 28 && !castledKingsideMove && !castledQueensideMove;

  return {
    castledKingsideMove,
    castledQueensideMove,
    queenFirstMove,
    kingMovedWithoutCastling,
    earlyQueen,
    kingInCenterLate,
    earlyGOrBPush,
    noCastlingWithLongGame,
  };
}

function buildOpenings(games: NormalizedGame[]): OpeningPerformance[] {
  const map = new Map<string, OpeningPerformance>();

  for (const game of games) {
    const key = game.openingEco ?? "UNKNOWN";
    const existing =
      map.get(key) ??
      ({
        key,
        displayName: key === "UNKNOWN" ? "Unknown opening" : key,
        games: 0,
        record: emptyRecord(),
      } satisfies OpeningPerformance);

    existing.games += 1;
    appendResult(existing.record, game.result);
    map.set(key, existing);
  }

  return [...map.values()].sort((a, b) => {
    if (b.games !== a.games) {
      return b.games - a.games;
    }
    return a.key.localeCompare(b.key);
  });
}

function buildColorSplit(games: NormalizedGame[]): ColorSplit[] {
  const white: ColorSplit = {
    color: "white",
    games: 0,
    ...emptyRecord(),
  };
  const black: ColorSplit = {
    color: "black",
    games: 0,
    ...emptyRecord(),
  };

  for (const game of games) {
    const bucket = game.userColor === "white" ? white : black;
    bucket.games += 1;
    appendResult(bucket, game.result);
  }

  return [white, black];
}

function toBucketStartMs(playedAtMs: number, granularity: TrendSeries["granularity"]): number {
  const date = new Date(playedAtMs);
  if (granularity === "day") {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  const utcDay = date.getUTCDay();
  const mondayDelta = utcDay === 0 ? -6 : 1 - utcDay;
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + mondayDelta,
  );
}

function buildTrends(games: NormalizedGame[]): TrendSeries {
  if (games.length === 0) {
    return {
      granularity: "day",
      buckets: [],
    };
  }

  const minTime = games[games.length - 1].playedAtMs;
  const maxTime = games[0].playedAtMs;
  const spanDays = (maxTime - minTime) / (24 * 60 * 60 * 1000);
  const granularity: TrendSeries["granularity"] = spanDays <= 45 ? "day" : "week";

  const bucketMap = new Map<number, TrendBucket>();
  for (const game of games) {
    const bucketStartMs = toBucketStartMs(game.playedAtMs, granularity);
    const bucket =
      bucketMap.get(bucketStartMs) ??
      ({
        bucketStartMs,
        record: emptyRecord(),
      } satisfies TrendBucket);
    appendResult(bucket.record, game.result);
    bucketMap.set(bucketStartMs, bucket);
  }

  const buckets = [...bucketMap.values()].sort((a, b) => a.bucketStartMs - b.bucketStartMs);
  return { granularity, buckets };
}

interface HeuristicIntermediate {
  castledKingside: number;
  castledQueenside: number;
  neverCastled: number;
  castledKingsideMoveTotal: number;
  castledQueensideMoveTotal: number;
  queenMovedCount: number;
  queenMoveTotal: number;
  kingSafetyIncidents: number;
  diagonalExposureIncidents: number;
  weaknessCounts: Map<string, number>;
  weaknessGameIds: Map<string, string[]>;
}

function newHeuristicIntermediate(): HeuristicIntermediate {
  return {
    castledKingside: 0,
    castledQueenside: 0,
    neverCastled: 0,
    castledKingsideMoveTotal: 0,
    castledQueensideMoveTotal: 0,
    queenMovedCount: 0,
    queenMoveTotal: 0,
    kingSafetyIncidents: 0,
    diagonalExposureIncidents: 0,
    weaknessCounts: new Map(),
    weaknessGameIds: new Map(),
  };
}

function recordWeakness(intermediate: HeuristicIntermediate, id: string, gameId: string): void {
  intermediate.weaknessCounts.set(id, (intermediate.weaknessCounts.get(id) ?? 0) + 1);
  const gameIds = intermediate.weaknessGameIds.get(id) ?? [];
  if (gameIds.length < 3 && !gameIds.includes(gameId)) {
    gameIds.push(gameId);
  }
  intermediate.weaknessGameIds.set(id, gameIds);
}

function buildHeuristics(games: NormalizedGame[]): {
  castling: CastlingBehavior;
  queenAverage?: number;
  kingSafety: KingSafetyHeuristic;
  diagonalExposure: DiagonalExposureHeuristic;
  weaknesses: WeaknessTag[];
} {
  const intermediate = newHeuristicIntermediate();

  for (const game of games) {
    const signals = parsePgnSignals(game);

    if (signals.castledKingsideMove) {
      intermediate.castledKingside += 1;
      intermediate.castledKingsideMoveTotal += signals.castledKingsideMove;
    } else if (signals.castledQueensideMove) {
      intermediate.castledQueenside += 1;
      intermediate.castledQueensideMoveTotal += signals.castledQueensideMove;
    } else {
      intermediate.neverCastled += 1;
    }

    if (signals.queenFirstMove) {
      intermediate.queenMovedCount += 1;
      intermediate.queenMoveTotal += signals.queenFirstMove;
    }

    if (signals.noCastlingWithLongGame || signals.kingMovedWithoutCastling) {
      intermediate.kingSafetyIncidents += 1;
      recordWeakness(intermediate, "king-safety", game.gameId);
    }
    if (signals.earlyQueen) {
      recordWeakness(intermediate, "early-queen", game.gameId);
    }
    if (signals.earlyGOrBPush) {
      intermediate.diagonalExposureIncidents += 1;
      recordWeakness(intermediate, "diagonal-exposure", game.gameId);
    }
    if (signals.kingInCenterLate) {
      recordWeakness(intermediate, "late-castle", game.gameId);
    }
  }

  const totalGames = games.length;
  const kingsideRate = totalGames > 0 ? intermediate.castledKingside / totalGames : undefined;
  const queensideRate = totalGames > 0 ? intermediate.castledQueenside / totalGames : undefined;
  const neverRate = totalGames > 0 ? intermediate.neverCastled / totalGames : undefined;

  const castling: CastlingBehavior = {
    kingside: {
      games: intermediate.castledKingside,
      rate: kingsideRate !== undefined ? roundToThree(kingsideRate) : undefined,
      averageMoveNumber:
        intermediate.castledKingside > 0
          ? roundToThree(
              intermediate.castledKingsideMoveTotal / intermediate.castledKingside,
            )
          : undefined,
    },
    queenside: {
      games: intermediate.castledQueenside,
      rate: queensideRate !== undefined ? roundToThree(queensideRate) : undefined,
      averageMoveNumber:
        intermediate.castledQueenside > 0
          ? roundToThree(
              intermediate.castledQueensideMoveTotal / intermediate.castledQueenside,
            )
          : undefined,
    },
    neverCastled: {
      games: intermediate.neverCastled,
      rate: neverRate !== undefined ? roundToThree(neverRate) : undefined,
    },
  };

  const queenAverage =
    intermediate.queenMovedCount > 0
      ? roundToThree(intermediate.queenMoveTotal / intermediate.queenMovedCount)
      : undefined;

  const kingSafetyScore =
    totalGames > 0 ? roundToThree(1 - intermediate.kingSafetyIncidents / totalGames) : undefined;
  const diagonalScore =
    totalGames > 0
      ? roundToThree(1 - intermediate.diagonalExposureIncidents / totalGames)
      : undefined;

  const kingSafetyLabel =
    kingSafetyScore === undefined
      ? undefined
      : kingSafetyScore >= 0.8
        ? "stable"
        : kingSafetyScore >= 0.6
          ? "mixed"
          : "fragile";

  const diagonalLabel =
    diagonalScore === undefined
      ? undefined
      : diagonalScore >= 0.8
        ? "stable"
        : diagonalScore >= 0.6
          ? "watch"
          : "exposed";

  const weaknessMeta: Record<
    string,
    Pick<WeaknessTag, "label" | "description" | "severity">
  > = {
    "king-safety": {
      label: "King safety risk",
      description:
        "Several games show delayed castling or king movement before securing safety.",
      severity: "high",
    },
    "early-queen": {
      label: "Early queen development",
      description:
        "Queen leaves the back rank very early, which can lose time against natural development.",
      severity: "medium",
    },
    "diagonal-exposure": {
      label: "Diagonal exposure",
      description:
        "Early flank pawn pushes can open diagonals toward your king before pieces are coordinated.",
      severity: "medium",
    },
    "late-castle": {
      label: "Late castling",
      description:
        "Long games without castling increase tactical pressure on the king in the center.",
      severity: "low",
    },
  };

  const weaknesses: WeaknessTag[] = [...intermediate.weaknessCounts.entries()]
    .flatMap(([id, evidenceCount]) => {
      const meta = weaknessMeta[id];
      if (!meta) {
        return [];
      }
      return [{
        id,
        ...meta,
        evidenceCount,
        sampleGameIds: intermediate.weaknessGameIds.get(id),
      } satisfies WeaknessTag];
    })
    .sort((a, b) => b.evidenceCount - a.evidenceCount);

  return {
    castling,
    queenAverage,
    kingSafety: {
      games: totalGames,
      score: kingSafetyScore,
      label: kingSafetyLabel,
    },
    diagonalExposure: {
      games: totalGames,
      score: diagonalScore,
      label: diagonalLabel,
    },
    weaknesses,
  };
}

function topWeakOpenings(
  openings: OpeningPerformance[],
): Array<{ key: string; lossRate: number }> {
  return openings
    .filter((opening) => opening.games >= 2)
    .map((opening) => ({
      key: opening.key,
      lossRate: opening.record.losses / opening.games,
    }))
    .sort((a, b) => b.lossRate - a.lossRate)
    .slice(0, 2);
}

export function selectRepresentativeGames(
  games: NormalizedGame[],
  analytics: DeterministicAnalytics,
): RepresentativeGame[] {
  const representatives: RepresentativeGame[] = [];
  const used = new Set<string>();

  const strongestOpening = analytics.openings[0]?.key;
  if (strongestOpening) {
    const game = games.find((candidate) => candidate.openingEco === strongestOpening);
    if (game) {
      representatives.push({
        gameId: game.gameId,
        reason: `most played opening (${strongestOpening})`,
      });
      used.add(game.gameId);
    }
  }

  for (const weakness of analytics.weaknesses.slice(0, 2)) {
    const gameId = weakness.sampleGameIds?.[0];
    if (gameId && !used.has(gameId)) {
      representatives.push({
        gameId,
        reason: `weakness example (${weakness.label})`,
      });
      used.add(gameId);
    }
  }

  const recentLoss = games.find((game) => game.result === "loss" && !used.has(game.gameId));
  if (recentLoss) {
    representatives.push({
      gameId: recentLoss.gameId,
      reason: "recent loss review candidate",
    });
  }

  return representatives.slice(0, 4);
}

export function buildDeterministicAnalytics(
  gamesInput: NormalizedGame[],
): DeterministicAnalyticsBuildResult {
  const games = [...gamesInput].sort((a, b) => b.playedAtMs - a.playedAtMs);

  const overall = emptyRecord();
  for (const game of games) {
    appendResult(overall, game.result);
  }

  const openings = buildOpenings(games);
  const byColor = buildColorSplit(games);
  const trends = buildTrends(games);
  const heuristics = buildHeuristics(games);
  const weakOpenings = topWeakOpenings(openings);

  const openingsWeaknesses = weakOpenings.map((weakOpening) => ({
    id: `opening-${weakOpening.key.toLowerCase()}`,
    label: `Low score in ${weakOpening.key}`,
    description: `Loss rate in ${weakOpening.key} is ${Math.round(
      weakOpening.lossRate * 100,
    )}% across sampled games.`,
    severity: weakOpening.lossRate >= 0.6 ? "high" : "medium",
    evidenceCount:
      openings.find((opening) => opening.key === weakOpening.key)?.record.losses ?? 0,
    sampleGameIds: games
      .filter((game) => game.openingEco === weakOpening.key)
      .slice(0, 3)
      .map((game) => game.gameId),
  })) as WeaknessTag[];

  const analytics: DeterministicAnalytics = {
    gamesAnalyzed: games.length,
    overall,
    byColor,
    openings,
    trends,
    castling: heuristics.castling,
    queenDevelopment: {
      games: games.length,
      averageDevelopmentMove: heuristics.queenAverage,
    },
    kingSafety: heuristics.kingSafety,
    diagonalExposure: heuristics.diagonalExposure,
    weaknesses: [...heuristics.weaknesses, ...openingsWeaknesses].sort(
      (a, b) => b.evidenceCount - a.evidenceCount,
    ),
  };

  return {
    analytics,
    representativeGames: selectRepresentativeGames(games, analytics),
  };
}

export const computeDeterministicAnalytics = buildDeterministicAnalytics;
