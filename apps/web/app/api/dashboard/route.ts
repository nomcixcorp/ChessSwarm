import type { DashboardFilters, DashboardResult, DashboardSuccess } from "@chess-swarm/shared-types";
import { buildDeterministicAnalytics } from "@chess-swarm/chess-core";
import { generateAiInsights } from "@chess-swarm/ai-insights";
import { ingestChessComGamesFromFilters } from "@chess-swarm/server";
import { NextResponse } from "next/server";

const ALLOWED_TIME_CLASSES = new Set(["bullet", "blitz", "rapid", "daily"] as const);
const ALLOWED_TIMEFRAMES = new Set(["week", "month", "three_months"] as const);

function badRequest(message: string): NextResponse<DashboardResult> {
  return NextResponse.json(
    {
      error: {
        code: "BAD_REQUEST",
        message,
      },
    },
    { status: 400 },
  );
}

function sanitizeUsername(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

function parseMaxGames(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  const rounded = Math.round(numeric);
  return Math.max(1, Math.min(200, rounded));
}

function parseTimeClasses(value: unknown): DashboardFilters["timeClasses"] {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Set<DashboardFilters["timeClasses"][number]>();
  for (const entry of value) {
    if (typeof entry === "string" && ALLOWED_TIME_CLASSES.has(entry as "bullet")) {
      deduped.add(entry as DashboardFilters["timeClasses"][number]);
    }
  }

  return [...deduped];
}

function parseTimeframe(
  timeframe: unknown,
  customStart: unknown,
  customEnd: unknown,
): DashboardFilters["timeframe"] | null {
  if (typeof timeframe !== "string") {
    return null;
  }

  if (timeframe === "custom") {
    const startMs = Number(customStart);
    const endMs = Number(customEnd);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
      return null;
    }

    return {
      kind: "custom",
      startMs,
      endMs,
    };
  }

  if (!ALLOWED_TIMEFRAMES.has(timeframe as "week")) {
    return null;
  }

  return {
    kind: timeframe as "week" | "month" | "three_months",
  };
}

function toDashboardSuccess(
  filters: DashboardFilters,
  games: DashboardSuccess["games"],
  analytics: DashboardSuccess["analytics"],
  aiInsights: DashboardSuccess["aiInsights"],
  warnings: string[],
): DashboardSuccess {
  return {
    filters,
    games,
    analytics,
    aiInsights,
    meta: {
      fetchedAtMs: Date.now(),
      partial: false,
      warnings: warnings.length > 0 ? warnings : undefined,
    },
  };
}

export async function GET(request: Request): Promise<NextResponse<DashboardResult>> {
  const url = new URL(request.url);

  const username = sanitizeUsername(url.searchParams.get("username"));
  const maxGames = parseMaxGames(url.searchParams.get("maxGames") ?? 50);
  const timeClasses = parseTimeClasses(url.searchParams.getAll("timeClass"));
  const timeframe = parseTimeframe(
    url.searchParams.get("timeframe"),
    url.searchParams.get("startMs"),
    url.searchParams.get("endMs"),
  );

  if (!username) {
    return badRequest("Username is required.");
  }
  if (timeClasses.length === 0) {
    return badRequest("At least one time class must be selected.");
  }
  if (!timeframe) {
    return badRequest("Invalid timeframe filter.");
  }

  const filters: DashboardFilters = {
    username,
    timeClasses,
    timeframe,
    maxGames,
  };

  try {
    const ingestion = await ingestChessComGamesFromFilters(filters, {
      monthlyFetchConcurrency: 3,
      retryAttempts: 3,
      retryBaseDelayMs: 150,
      retryMaxDelayMs: 1200,
    });

    const { analytics } = buildDeterministicAnalytics(ingestion.games);
    const aiInsights = await generateAiInsights({
      username,
      analytics,
    });

    const payload = toDashboardSuccess(
      filters,
      ingestion.games,
      analytics,
      aiInsights,
      ingestion.warnings,
    );

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown dashboard error";
    return NextResponse.json(
      {
        error: {
          code: "UPSTREAM_ERROR",
          message: `Failed to build dashboard: ${message}`,
        },
      },
      { status: 502 },
    );
  }
}
