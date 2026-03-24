import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardFilters } from "@chess-swarm/shared-types";
import { ARCHIVE_URLS_FIXTURE, MONTHLY_ARCHIVES_FIXTURE } from "./__fixtures__/archives.js";
import { ChessComClient, type ChessComFetchFn } from "./chess-com-client.js";
import { ingestChessComGamesFromFilters } from "./ingestion.js";

const BASE_FILTERS: DashboardFilters = {
  username: "testuser",
  timeClasses: ["blitz", "rapid", "bullet", "daily"],
  timeframe: {
    kind: "custom",
    startMs: Date.UTC(2026, 0, 1),
    endMs: Date.UTC(2026, 2, 31),
  },
  maxGames: 20,
};

interface MockResponseInit {
  status?: number;
  jsonData?: unknown;
}

class MockResponse {
  public readonly ok: boolean;
  public readonly status: number;

  private readonly payload: unknown;

  public constructor(init: MockResponseInit) {
    this.status = init.status ?? 200;
    this.ok = this.status >= 200 && this.status < 300;
    this.payload = init.jsonData ?? {};
  }

  public async json(): Promise<unknown> {
    return this.payload;
  }
}

const asResponse = (value: MockResponse): Response => value as unknown as Response;

interface FetchHarnessOptions {
  delayMs?: number;
  failOnceByUrl?: Set<string>;
}

function createFetchHarness(options: FetchHarnessOptions = {}) {
  const delayMs = options.delayMs ?? 0;
  const failOnceByUrl = options.failOnceByUrl ?? new Set<string>();
  const callCountByUrl = new Map<string, number>();
  const stats = {
    activeArchiveRequests: 0,
    maxActiveArchiveRequests: 0,
  };

  const fetchImpl: ChessComFetchFn = async (input) => {
    const url = String(input);
    callCountByUrl.set(url, (callCountByUrl.get(url) ?? 0) + 1);

    if (url.endsWith("/games/archives")) {
      return asResponse(new MockResponse({ jsonData: { archives: ARCHIVE_URLS_FIXTURE } }));
    }

    if (ARCHIVE_URLS_FIXTURE.includes(url)) {
      stats.activeArchiveRequests += 1;
      stats.maxActiveArchiveRequests = Math.max(
        stats.maxActiveArchiveRequests,
        stats.activeArchiveRequests,
      );

      try {
        if (failOnceByUrl.has(url) && (callCountByUrl.get(url) ?? 0) === 1) {
          return asResponse(new MockResponse({ status: 500, jsonData: {} }));
        }

        if (delayMs > 0) {
          await new Promise((resolve) => {
            setTimeout(resolve, delayMs);
          });
        }

        return asResponse(
          new MockResponse({
            jsonData: MONTHLY_ARCHIVES_FIXTURE[url],
          }),
        );
      } finally {
        stats.activeArchiveRequests -= 1;
      }
    }

    return asResponse(new MockResponse({ status: 404, jsonData: {} }));
  };

  return {
    fetchImpl,
    callCountByUrl,
    stats,
  };
}

test("chess.com client includes descriptive user-agent", async () => {
  let userAgent = "";
  const fetchImpl: ChessComFetchFn = async (_url, init) => {
    const headers = new Headers(init?.headers);
    userAgent = headers.get("User-Agent") ?? "";
    return asResponse(
      new MockResponse({
        jsonData: { archives: [] },
      }),
    );
  };

  const client = new ChessComClient({
    fetchImpl,
  });
  await client.getPlayerArchiveUrls("testuser");
  assert.match(userAgent, /ChessSwarm\/1\.0/);
});

test("chess.com client retries monthly archive fetches with backoff", async () => {
  const archiveUrl = ARCHIVE_URLS_FIXTURE[0];
  const harness = createFetchHarness({
    failOnceByUrl: new Set([archiveUrl]),
  });

  const client = new ChessComClient({
    fetchImpl: harness.fetchImpl,
    retryBaseDelayMs: 1,
    retryMaxDelayMs: 5,
  });

  const payload = await client.getMonthlyArchive(archiveUrl);
  assert.equal((payload.games ?? []).length, 2);
  assert.equal(harness.callCountByUrl.get(archiveUrl), 2);
});

test("ingestion normalizes, filters, and sorts games from fixtures", async () => {
  const harness = createFetchHarness();
  const result = await ingestChessComGamesFromFilters(BASE_FILTERS, {
    fetchImpl: harness.fetchImpl,
    monthlyFetchConcurrency: 2,
  });

  assert.equal(result.warnings.length, 0);
  assert.deepEqual(
    result.games.map((game) => game.gameId),
    [
      "https://www.chess.com/game/live/1001",
      "https://www.chess.com/game/live/1002",
      "https://www.chess.com/game/live/1003",
    ],
  );

  const game = result.games[0];
  assert.equal(game.userColor, "white");
  assert.equal(game.timeClass, "rapid");
  assert.equal(game.result, "win");
  assert.equal(game.openingEco, "D06");
  assert.equal(game.moveCount, 12);
  assert.equal(game.opponentUsername, "opponentA");
});

test("ingestion respects maxGames and emits a warning", async () => {
  const harness = createFetchHarness();
  const result = await ingestChessComGamesFromFilters(
    {
      ...BASE_FILTERS,
      maxGames: 2,
    },
    {
      fetchImpl: harness.fetchImpl,
    },
  );

  assert.equal(result.games.length, 2);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Result capped to maxGames=2/);
});

test("ingestion enforces low archive fetch concurrency", async () => {
  const harness = createFetchHarness({
    delayMs: 10,
  });

  const result = await ingestChessComGamesFromFilters(BASE_FILTERS, {
    fetchImpl: harness.fetchImpl,
    monthlyFetchConcurrency: 2,
  });

  assert.equal(result.games.length, 3);
  assert.ok(harness.stats.maxActiveArchiveRequests <= 2);
});

