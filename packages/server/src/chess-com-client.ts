import type { ChessComMonthlyArchiveRaw } from "@chess-swarm/shared-types";
import { HttpRequestError, withRetry } from "./retry.js";

const DEFAULT_USER_AGENT = "ChessSwarm/1.0 (+https://github.com/chess-swarm/chess-swarm)";
const DEFAULT_BASE_URL = "https://api.chess.com";

export type ChessComFetchFn = (
  input: string | URL,
  init?: RequestInit,
) => Promise<ChessComResponse>;

export interface ChessComResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

interface ChessComArchivesListRaw {
  archives?: unknown[];
}

export interface ChessComClientOptions {
  fetchImpl?: ChessComFetchFn;
  userAgent?: string;
  baseUrl?: string;
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
}

export class ChessComClient {
  private readonly fetchImpl: ChessComFetchFn;
  private readonly userAgent: string;
  private readonly baseUrl: string;
  private readonly retryAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly retryMaxDelayMs: number;

  public constructor(options: ChessComClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.retryAttempts = options.retryAttempts ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 150;
    this.retryMaxDelayMs = options.retryMaxDelayMs ?? 1200;
  }

  public async getPlayerArchiveUrls(username: string): Promise<string[]> {
    const encodedUsername = encodeURIComponent(username.trim());
    const data = await this.getJson<ChessComArchivesListRaw>(
      `${this.baseUrl}/pub/player/${encodedUsername}/games/archives`,
    );

    return (
      data.archives?.filter(
        (value): value is string => typeof value === "string",
      ) ?? []
    );
  }

  public async getMonthlyArchive(
    archiveUrl: string,
  ): Promise<ChessComMonthlyArchiveRaw> {
    return this.getJson<ChessComMonthlyArchiveRaw>(archiveUrl);
  }

  private async getJson<T>(url: string): Promise<T> {
    return withRetry(
      async () => {
        const response = await this.fetchImpl(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": this.userAgent,
          },
        });

        if (!response.ok) {
          throw new HttpRequestError(
            `Chess.com request failed for ${url}`,
            response.status,
            response.status >= 500 || response.status === 429,
          );
        }

        return (await response.json()) as T;
      },
      {
        attempts: this.retryAttempts,
        baseDelayMs: this.retryBaseDelayMs,
        maxDelayMs: this.retryMaxDelayMs,
      },
    );
  }
}

export const createChessComClient = (options: ChessComClientOptions = {}): ChessComClient =>
  new ChessComClient(options);
