/**
 * Minimal shapes aligned with documented Chess.com public player games JSON.
 * Extend deliberately when ingestion is implemented — do not invent fields here.
 *
 * @see https://www.chess.com/clubs/forum/view/api-access-to-games-of-a-player
 */

export interface ChessComPlayerRef {
  username?: string;
  rating?: number;
  result?: string;
}

export interface ChessComGameRaw {
  url?: string;
  pgn?: string;
  time_control?: string;
  end_time?: number;
  rated?: boolean;
  fen?: string;
  time_class?: string;
  rules?: string;
  white?: ChessComPlayerRef;
  black?: ChessComPlayerRef;
}

export interface ChessComMonthlyArchiveRaw {
  games?: ChessComGameRaw[];
}

/**
 * Shape returned by `GET /pub/player/{username}/games/archives`.
 */
export interface ChessComArchivesListRaw {
  archives?: string[];
}
