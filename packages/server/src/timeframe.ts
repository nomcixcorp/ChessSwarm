import type { TimeframeSelection } from "@chess-swarm/shared-types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TimeframeBounds {
  startMs: number;
  endMs: number;
}

export function getTimeframeBounds(
  timeframe: TimeframeSelection,
  nowMs: number = Date.now(),
): TimeframeBounds {
  if (timeframe.kind === "custom") {
    return {
      startMs: timeframe.startMs,
      endMs: timeframe.endMs,
    };
  }

  switch (timeframe.kind) {
    case "week":
      return { startMs: nowMs - 7 * DAY_MS, endMs: nowMs };
    case "month":
      return { startMs: nowMs - 30 * DAY_MS, endMs: nowMs };
    case "three_months":
      return { startMs: nowMs - 90 * DAY_MS, endMs: nowMs };
    default: {
      const exhaustiveCheck: never = timeframe;
      return exhaustiveCheck;
    }
  }
}

export function withinTimeframe(
  playedAtMs: number,
  bounds: TimeframeBounds,
): boolean {
  return playedAtMs >= bounds.startMs && playedAtMs <= bounds.endMs;
}

export function isWithinTimeframe(
  playedAtMs: number,
  timeframe: TimeframeSelection,
  nowMs: number = Date.now(),
): boolean {
  const bounds = getTimeframeBounds(timeframe, nowMs);
  return withinTimeframe(playedAtMs, bounds);
}
