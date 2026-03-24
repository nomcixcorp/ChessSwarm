"use client";

import type {
  ChessComTimeClass,
  DashboardFilters,
  DashboardResult,
  DashboardSuccess,
  NormalizedGame,
  TimeframeSelection,
} from "@chess-swarm/shared-types";
import { useEffect, useMemo, useState } from "react";

type TimeClassOption = Exclude<ChessComTimeClass, "classical">;
type TimeframePresetOption = "week" | "month" | "three_months" | "custom";

interface SearchHistoryEntry {
  username: string;
  searchedAtMs: number;
}

const TIME_CLASS_OPTIONS: TimeClassOption[] = ["rapid", "blitz", "bullet", "daily"];
const TIMEFRAME_OPTIONS: Array<{ value: TimeframePresetOption; label: string }> = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "three_months", label: "3 months" },
  { value: "custom", label: "Custom" },
];
const HISTORY_KEY = "chessswarm_recent_searches_v1";

function initialFilters(): DashboardFilters {
  return {
    username: "",
    timeClasses: ["rapid", "blitz"],
    timeframe: { kind: "month" },
    maxGames: 30,
  };
}

function clampMaxGames(value: number): number {
  return Math.max(5, Math.min(200, value));
}

function formatPercent(wins: number, games: number): string {
  if (games <= 0) {
    return "0%";
  }
  return `${Math.round((wins / games) * 100)}%`;
}

function formatDate(valueMs: number): string {
  return new Date(valueMs).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(valueMs: number): string {
  return new Date(valueMs).toLocaleString();
}

function collectHistory(): SearchHistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(HISTORY_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as SearchHistoryEntry[];
    return parsed
      .filter((entry) => typeof entry.username === "string" && typeof entry.searchedAtMs === "number")
      .slice(0, 8);
  } catch {
    return [];
  }
}

function pushHistory(username: string): SearchHistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  const normalized = username.trim();
  if (!normalized) {
    return collectHistory();
  }

  const current = collectHistory().filter(
    (entry) => entry.username.toLowerCase() !== normalized.toLowerCase(),
  );
  const next = [{ username: normalized, searchedAtMs: Date.now() }, ...current].slice(0, 8);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

function timeframeToPreset(timeframe: TimeframeSelection): TimeframePresetOption {
  return timeframe.kind === "custom" ? "custom" : timeframe.kind;
}

function parseError(result: DashboardResult | null): string | null {
  if (!result || "filters" in result) {
    return null;
  }
  return result.error.message;
}

function deriveBestOpening(result: DashboardSuccess): string {
  const opening = result.analytics.openings[0];
  if (!opening) {
    return "Not enough games";
  }
  return `${opening.displayName} (${opening.games})`;
}

function deriveWeakestArea(result: DashboardSuccess): string {
  const weakness = result.analytics.weaknesses[0];
  if (!weakness) {
    return "No major pattern";
  }
  return weakness.label;
}

function buildSparklineData(
  buckets: DashboardSuccess["analytics"]["trends"]["buckets"],
): number[] {
  return buckets.slice(-12).map((bucket) => bucket.record.wins - bucket.record.losses);
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <p className="muted">No trend data</p>;
  }
  const maxAbs = Math.max(1, ...values.map((value) => Math.abs(value)));

  return (
    <div className="sparkline">
      {values.map((value, index) => (
        <div
          key={`${index}-${value}`}
          className={`sparkline-bar ${value >= 0 ? "positive" : "negative"}`}
          style={{
            height: `${Math.round((Math.abs(value) / maxAbs) * 100)}%`,
          }}
          title={`Net score ${value}`}
        />
      ))}
    </div>
  );
}

function RatioBar({
  wins,
  losses,
  draws,
}: {
  wins: number;
  losses: number;
  draws: number;
}) {
  const total = Math.max(1, wins + losses + draws);
  const winPct = (wins / total) * 100;
  const lossPct = (losses / total) * 100;
  const drawPct = (draws / total) * 100;

  return (
    <div className="ratio-bar" aria-label="win loss draw split">
      <span className="ratio-win" style={{ width: `${winPct}%` }} />
      <span className="ratio-loss" style={{ width: `${lossPct}%` }} />
      <span className="ratio-draw" style={{ width: `${drawPct}%` }} />
    </div>
  );
}

function toUserResultLabel(result: NormalizedGame["result"]): string {
  if (result === "win") {
    return "Win";
  }
  if (result === "loss") {
    return "Loss";
  }
  if (result === "draw") {
    return "Draw";
  }
  return "Other";
}

function gameWeaknessTags(
  gameId: string,
  weaknesses: DashboardSuccess["analytics"]["weaknesses"],
): string[] {
  return weaknesses
    .filter((tag) => tag.sampleGameIds?.includes(gameId))
    .map((tag) => tag.label)
    .slice(0, 3);
}

export default function HomePage() {
  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframePresetOption>("month");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DashboardResult | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [history, setHistory] = useState<SearchHistoryEntry[]>(() => collectHistory());
  const [networkError, setNetworkError] = useState<string | null>(null);

  const success = useMemo(
    () => (result && "filters" in result ? result : null),
    [result],
  );
  const errorMessage = networkError ?? parseError(result);

  const selectedGame = useMemo(() => {
    if (!success || !selectedGameId) {
      return null;
    }
    return success.games.find((entry) => entry.gameId === selectedGameId) ?? null;
  }, [success, selectedGameId]);

  const trendData = useMemo(
    () => (success ? buildSparklineData(success.analytics.trends.buckets) : []),
    [success],
  );

  const selectedPreset = useMemo(
    () => (success ? timeframeToPreset(success.filters.timeframe) : selectedTimeframe),
    [selectedTimeframe, success],
  );

  useEffect(() => {
    setHistory(collectHistory());
  }, []);

  async function runSearch() {
    if (!filters.username.trim()) {
      setNetworkError("Please enter a Chess.com username.");
      return;
    }

    let timeframe: TimeframeSelection;
    if (selectedTimeframe === "custom") {
      const startMs = customStartDate ? Date.parse(customStartDate) : Number.NaN;
      const endMs = customEndDate ? Date.parse(customEndDate) : Number.NaN;
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        setNetworkError("Custom timeframe requires valid start and end dates.");
        return;
      }
      timeframe = {
        kind: "custom",
        startMs,
        endMs: endMs + 24 * 60 * 60 * 1000 - 1,
      };
    } else {
      timeframe = { kind: selectedTimeframe };
    }

    setLoading(true);
    setResult(null);
    setNetworkError(null);
    setSelectedGameId(null);

    const payload: DashboardFilters = {
      ...filters,
      username: filters.username.trim(),
      timeframe,
      maxGames: clampMaxGames(filters.maxGames),
    };

    try {
      const params = new URLSearchParams();
      params.set("username", payload.username);
      params.set("maxGames", String(payload.maxGames));
      params.set("timeframe", payload.timeframe.kind);
      for (const timeClass of payload.timeClasses) {
        params.append("timeClass", timeClass);
      }
      if (payload.timeframe.kind === "custom") {
        params.set("startMs", String(payload.timeframe.startMs));
        params.set("endMs", String(payload.timeframe.endMs));
      }

      const responseWithQuery = await fetch(`/api/dashboard?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!responseWithQuery.ok) {
        setNetworkError("Dashboard API returned an error response.");
      }
      const parsed = (await responseWithQuery.json()) as DashboardResult;
      setResult(parsed);
      if ("filters" in parsed) {
        setHistory(pushHistory(payload.username));
      }
    } catch {
      setNetworkError("Unable to reach dashboard API. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function updateUsername(value: string) {
    setFilters((current) => ({ ...current, username: value }));
  }

  function toggleTimeClass(value: TimeClassOption) {
    setFilters((current) => {
      const exists = current.timeClasses.includes(value);
      const next = exists
        ? current.timeClasses.filter((entry) => entry !== value)
        : [...current.timeClasses, value];
      return {
        ...current,
        timeClasses: next.length > 0 ? next : [value],
      };
    });
  }

  return (
    <main className="page">
      <section className="hero card">
        <div>
          <p className="eyebrow">Chess Swarm</p>
          <h1>Premium Chess.com analytics in seconds</h1>
          <p className="subtitle">
            Enter a public username, tune your filters, and get deterministic metrics with grounded
            AI coaching.
          </p>
        </div>
        <div className="hero-badge">V1</div>
      </section>

      <section className="search card">
        <div className="grid search-grid">
          <label className="field">
            <span>Chess.com username</span>
            <input
              value={filters.username}
              onChange={(event) => updateUsername(event.target.value)}
              placeholder="e.g. hikaru"
            />
          </label>

          <label className="field">
            <span>Max recent games</span>
            <input
              type="number"
              min={5}
              max={200}
              value={filters.maxGames}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  maxGames: clampMaxGames(Number(event.target.value) || current.maxGames),
                }))
              }
            />
          </label>

          <label className="field">
            <span>Timeframe</span>
            <select
              value={selectedPreset}
              onChange={(event) => {
                const value = event.target.value as TimeframePresetOption;
                setSelectedTimeframe(value);
              }}
            >
              {TIMEFRAME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedPreset === "custom" ? (
          <div className="grid custom-grid">
            <label className="field">
              <span>Custom start</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(event) => setCustomStartDate(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Custom end</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(event) => setCustomEndDate(event.target.value)}
              />
            </label>
          </div>
        ) : null}

        <div className="timeclass-row">
          {TIME_CLASS_OPTIONS.map((option) => {
            const active = filters.timeClasses.includes(option);
            return (
              <button
                key={option}
                type="button"
                className={`pill ${active ? "active" : ""}`}
                onClick={() => toggleTimeClass(option)}
              >
                {option}
              </button>
            );
          })}
        </div>

        <div className="actions">
          <button type="button" className="primary" disabled={loading} onClick={runSearch}>
            {loading ? "Analyzing..." : "Analyze games"}
          </button>

          {history.length > 0 ? (
            <div className="history">
              <p className="muted tiny">Recent</p>
              <div className="history-items">
                {history.map((entry) => (
                  <button
                    key={`${entry.username}-${entry.searchedAtMs}`}
                    type="button"
                    className="history-chip"
                    onClick={() => updateUsername(entry.username)}
                  >
                    {entry.username}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {errorMessage ? (
        <section className="card error">
          <h2>Could not load dashboard</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {loading ? (
        <section className="card loading">
          <h2>Crunching your games</h2>
          <p>Fetching archives, computing metrics, and generating coaching insights...</p>
        </section>
      ) : null}

      {!loading && success ? (
        <>
          <section className="card summary">
            <div>
              <p className="eyebrow">Player summary</p>
              <h2>{success.filters.username}</h2>
              <p className="muted">
                Last analyzed {formatDateTime(success.meta.fetchedAtMs)} • {success.analytics.gamesAnalyzed}{" "}
                games
              </p>
            </div>
            <div className="warning-list">
              {success.meta.warnings?.map((warning) => (
                <p className="warning" key={warning}>
                  {warning}
                </p>
              ))}
            </div>
          </section>

          <section className="stats-grid">
            <article className="card stat">
              <p className="muted">Win rate</p>
              <h3>
                {formatPercent(success.analytics.overall.wins, success.analytics.gamesAnalyzed)}
              </h3>
            </article>
            <article className="card stat">
              <p className="muted">Games analyzed</p>
              <h3>{success.analytics.gamesAnalyzed}</h3>
            </article>
            <article className="card stat">
              <p className="muted">Best opening</p>
              <h3>{deriveBestOpening(success)}</h3>
            </article>
            <article className="card stat">
              <p className="muted">Weakest area</p>
              <h3>{deriveWeakestArea(success)}</h3>
            </article>
          </section>

          <section className="grid dashboard-grid">
            <article className="card">
              <h3>Trend momentum</h3>
              <Sparkline values={trendData} />
              <p className="muted tiny">
                Positive bars indicate more wins than losses in each {success.analytics.trends.granularity}{" "}
                bucket.
              </p>
            </article>

            <article className="card">
              <h3>Color split</h3>
              {success.analytics.byColor.map((entry) => (
                <div className="stack-xs" key={entry.color}>
                  <p className="muted tiny">
                    {entry.color.toUpperCase()} • {entry.games} games
                  </p>
                  <RatioBar wins={entry.wins} losses={entry.losses} draws={entry.draws} />
                </div>
              ))}
            </article>

            <article className="card">
              <h3>Opening performance</h3>
              <div className="opening-list">
                {success.analytics.openings.slice(0, 6).map((opening) => (
                  <div className="opening-row" key={opening.key}>
                    <div>
                      <p>{opening.displayName}</p>
                      <p className="muted tiny">{opening.games} games</p>
                    </div>
                    <p className="tiny">
                      W{opening.record.wins} L{opening.record.losses} D{opening.record.draws}
                    </p>
                  </div>
                ))}
              </div>
            </article>

            <article className="card">
              <h3>Weakness categories</h3>
              <div className="tag-wrap">
                {success.analytics.weaknesses.map((weakness) => (
                  <span key={weakness.id} className={`tag ${weakness.severity}`}>
                    {weakness.label} ({weakness.evidenceCount})
                  </span>
                ))}
              </div>
            </article>
          </section>

          <section className="grid wide-grid">
            <article className="card">
              <h3>AI coaching summary</h3>
              {success.aiInsights ? (
                <div className="stack-md">
                  <p>{success.aiInsights.summary}</p>
                  <div className="grid two-col">
                    <div>
                      <p className="muted tiny">Strengths</p>
                      <ul>
                        {success.aiInsights.strengths.map((entry) => (
                          <li key={entry}>{entry}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="muted tiny">Weaknesses</p>
                      <ul>
                        {success.aiInsights.weaknesses.map((entry) => (
                          <li key={entry}>{entry}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="stack-xs">
                    <p>
                      <strong>Opening recommendation:</strong> {success.aiInsights.openingRecommendation}
                    </p>
                    <p>
                      <strong>Tactical recommendation:</strong> {success.aiInsights.tacticalRecommendation}
                    </p>
                  </div>
                  <div className="stack-xs">
                    <p className="muted tiny">One-week training plan</p>
                    <ol>
                      {success.aiInsights.trainingPlan.map((entry, index) => (
                        <li key={`${entry.title}-${index}`}>
                          <strong>{entry.title}:</strong> {entry.rationale}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <p className="muted tiny">
                      Confidence {Math.round(success.aiInsights.confidence * 100)}%
                    </p>
                    <ul>
                      {success.aiInsights.caveats.map((entry) => (
                        <li key={entry}>{entry}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="muted">No AI insight payload available for this result.</p>
              )}
            </article>

            <article className="card">
              <h3>Recent games</h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Result</th>
                      <th>Color</th>
                      <th>Class</th>
                      <th>Opponent</th>
                      <th>Opening</th>
                      <th>Weakness tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {success.games.map((game) => (
                      <tr key={game.gameId} onClick={() => setSelectedGameId(game.gameId)}>
                        <td>{formatDate(game.playedAtMs)}</td>
                        <td>{toUserResultLabel(game.result)}</td>
                        <td>{game.userColor}</td>
                        <td>{game.timeClass}</td>
                        <td>{game.opponentUsername}</td>
                        <td>{game.openingEco ?? "Unknown"}</td>
                        <td>
                          <div className="tag-wrap">
                            {gameWeaknessTags(game.gameId, success.analytics.weaknesses).map((tag) => (
                              <span className="tag low" key={`${game.gameId}-${tag}`}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>

          {selectedGame ? (
            <section className="card detail">
              <div className="detail-header">
                <h3>Game detail</h3>
                <button type="button" onClick={() => setSelectedGameId(null)}>
                  Close
                </button>
              </div>
              <p className="muted">
                {selectedGame.gameId} • {formatDateTime(selectedGame.playedAtMs)}
              </p>
              <div className="grid two-col">
                <p>
                  <strong>Result:</strong> {toUserResultLabel(selectedGame.result)}
                </p>
                <p>
                  <strong>Opponent:</strong> {selectedGame.opponentUsername} (
                  {selectedGame.opponentRating ?? "?"})
                </p>
                <p>
                  <strong>Your color:</strong> {selectedGame.userColor}
                </p>
                <p>
                  <strong>Time class:</strong> {selectedGame.timeClass}
                </p>
                <p>
                  <strong>Opening ECO:</strong> {selectedGame.openingEco ?? "Unknown"}
                </p>
                <p>
                  <strong>Move count:</strong> {selectedGame.moveCount ?? "Unknown"}
                </p>
              </div>
              {selectedGame.sourceUrl ? (
                <a href={selectedGame.sourceUrl} target="_blank" rel="noreferrer">
                  Open original game
                </a>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}

      {!loading && !success && !errorMessage ? (
        <section className="card empty">
          <h2>Ready for analysis</h2>
          <p>
            Search a Chess.com username to render your dashboard with deterministic stats and AI
            coaching.
          </p>
        </section>
      ) : null}
    </main>
  );
}
