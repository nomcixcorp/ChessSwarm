import type {
  ChessComMonthlyArchiveRaw,
  ChessComTimeClass,
  DashboardFilters,
  NormalizedGame,
  TimeframeSelection,
} from "@chess-swarm/shared-types";
import { ChessComClient, type ChessComFetchFn } from "./chess-com-client.js";
import { normalizeGameFromUserPerspective } from "./normalize.js";
import { getTimeframeBounds, withinTimeframe } from "./timeframe.js";

export interface IngestionClient {
  getPlayerArchiveUrls(username: string): Promise<string[]>;
  getMonthlyArchive(archiveUrl: string): Promise<ChessComMonthlyArchiveRaw>;
}

export interface IngestionOptions {
  client?: IngestionClient;
  fetchImpl?: ChessComFetchFn;
  baseUrl?: string;
  userAgent?: string;
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  /**
   * Upper bound on parallel monthly archive fetches.
   * Keep intentionally low to avoid upstream abuse.
   */
  monthlyFetchConcurrency?: number;
}

export interface IngestionInput {
  username: string;
  timeClasses: ChessComTimeClass[];
  timeframe: TimeframeSelection;
  maxGames: number;
}

export interface IngestionResult {
  games: NormalizedGame[];
  warnings: string[];
}

const DEFAULT_MONTHLY_FETCH_CONCURRENCY = 3;

const sanitizeUsername = (username: string): string => username.trim().toLowerCase();

const normalizeArchiveUrlToMonthKey = (url: string): string | null => {
  const match = /\/games\/(\d{4})\/(\d{2})\/?$/.exec(url);
  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}`;
};

const monthKeysForTimeframe = (timeframe: TimeframeSelection): Set<string> | null => {
  if (timeframe.kind !== "custom") {
    return null;
  }

  const result = new Set<string>();
  const cursor = new Date(timeframe.startMs);
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);

  const end = new Date(timeframe.endMs);
  end.setUTCDate(1);
  end.setUTCHours(0, 0, 0, 0);

  while (cursor.getTime() <= end.getTime()) {
    const month = `${cursor.getUTCMonth() + 1}`.padStart(2, "0");
    result.add(`${cursor.getUTCFullYear()}-${month}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return result;
};

const chooseRelevantArchiveUrls = (
  archiveUrls: string[],
  timeframe: TimeframeSelection,
): string[] => {
  const customRangeMonths = monthKeysForTimeframe(timeframe);

  if (customRangeMonths) {
    return archiveUrls.filter((url) => {
      const key = normalizeArchiveUrlToMonthKey(url);
      return Boolean(key && customRangeMonths.has(key));
    });
  }

  // For preset ranges we cannot safely infer exact cutoffs from month URLs alone,
  // so we fetch recent archives and apply exact date filtering per game.
  if (timeframe.kind === "week" || timeframe.kind === "month") {
    return archiveUrls.slice(-2);
  }

  if (timeframe.kind === "three_months") {
    return archiveUrls.slice(-4);
  }

  return archiveUrls;
};

const runWithConcurrencyLimit = async <TItem, TResult>(
  items: TItem[],
  concurrency: number,
  worker: (item: TItem) => Promise<TResult>,
): Promise<TResult[]> => {
  if (items.length === 0) {
    return [];
  }

  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  };

  await Promise.all(Array.from({ length: safeConcurrency }, () => runWorker()));
  return results;
};

const toIngestionInput = (filters: DashboardFilters): IngestionInput => ({
  username: filters.username,
  timeClasses: filters.timeClasses,
  timeframe: filters.timeframe,
  maxGames: filters.maxGames,
});

const filterAndNormalize = (
  username: string,
  monthlyArchives: ChessComMonthlyArchiveRaw[],
  timeClasses: Set<ChessComTimeClass>,
  timeframeBounds: ReturnType<typeof getTimeframeBounds>,
): NormalizedGame[] => {
  const normalized: NormalizedGame[] = [];
  const seenIds = new Set<string>();

  for (const archive of monthlyArchives) {
    const games = archive.games ?? [];

    for (const game of games) {
      const timeClassRaw = game.time_class;
      if (
        !timeClassRaw ||
        !["bullet", "blitz", "rapid", "daily", "classical"].includes(timeClassRaw)
      ) {
        continue;
      }

      const timeClass = timeClassRaw as ChessComTimeClass;
      if (!timeClasses.has(timeClass)) {
        continue;
      }

      const normalizedGame = normalizeGameFromUserPerspective(game, username);
      if (!normalizedGame) {
        continue;
      }

      if (!withinTimeframe(normalizedGame.playedAtMs, timeframeBounds)) {
        continue;
      }

      if (seenIds.has(normalizedGame.gameId)) {
        continue;
      }

      seenIds.add(normalizedGame.gameId);
      normalized.push(normalizedGame);
    }
  }

  normalized.sort((a, b) => b.playedAtMs - a.playedAtMs);
  return normalized;
};

export const ingestChessComGames = async (
  input: IngestionInput,
  options: IngestionOptions = {},
): Promise<IngestionResult> => {
  const username = sanitizeUsername(input.username);
  const warnings: string[] = [];
  const client =
    options.client ??
    new ChessComClient({
      fetchImpl: options.fetchImpl,
      baseUrl: options.baseUrl,
      userAgent: options.userAgent,
      retryAttempts: options.retryAttempts,
      retryBaseDelayMs: options.retryBaseDelayMs,
      retryMaxDelayMs: options.retryMaxDelayMs,
    });
  const timeframeBounds = getTimeframeBounds(input.timeframe);

  const archiveUrls = await client.getPlayerArchiveUrls(username);
  const relevantArchiveUrls = chooseRelevantArchiveUrls(archiveUrls, input.timeframe);

  if (relevantArchiveUrls.length === 0) {
    return { games: [], warnings };
  }

  const recentFirstArchiveUrls = [...relevantArchiveUrls].reverse();
  const concurrency = options.monthlyFetchConcurrency ?? DEFAULT_MONTHLY_FETCH_CONCURRENCY;

  const monthlyArchives = await runWithConcurrencyLimit(
    recentFirstArchiveUrls,
    concurrency,
    async (archiveUrl) => client.getMonthlyArchive(archiveUrl),
  );

  const filtered = filterAndNormalize(
    username,
    monthlyArchives,
    new Set(input.timeClasses),
    timeframeBounds,
  );

  let games = filtered;
  if (filtered.length > input.maxGames) {
    warnings.push(
      `Result capped to maxGames=${input.maxGames}; ${filtered.length - input.maxGames} games omitted.`,
    );
    games = filtered.slice(0, input.maxGames);
  }

  return { games, warnings };
};

export const ingestChessComGamesFromFilters = async (
  filters: DashboardFilters,
  options: IngestionOptions = {},
): Promise<IngestionResult> => ingestChessComGames(toIngestionInput(filters), options);

export const __internal = {
  normalizeArchiveUrlToMonthKey,
  monthKeysForTimeframe,
  chooseRelevantArchiveUrls,
  runWithConcurrencyLimit,
  toIngestionInput,
};
