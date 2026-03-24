import type { ChessComMonthlyArchiveRaw } from "@chess-swarm/shared-types";

const PGN_QUEENS_GAMBIT = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.03.10"]
[Round "-"]
[White "testuser"]
[Black "opponentA"]
[Result "1-0"]
[ECO "D06"]
[Opening "Queen's Gambit"]

1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 c6 1-0`;

const PGN_SICILIAN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.02.15"]
[Round "-"]
[White "opponentB"]
[Black "testuser"]
[Result "0-1"]
[ECO "B20"]
[Opening "Sicilian Defense"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 0-1`;

const PGN_ENGLISH = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.01.09"]
[Round "-"]
[White "testuser"]
[Black "opponentC"]
[Result "1/2-1/2"]
[ECO "A13"]
[Opening "English Opening"]

1. c4 e6 2. Nc3 d5 3. d4 Nf6 4. Nf3 Be7 5. Bg5 O-O 1/2-1/2`;

export const ARCHIVE_URLS_FIXTURE = [
  "https://api.chess.com/pub/player/testuser/games/2026/01",
  "https://api.chess.com/pub/player/testuser/games/2026/02",
  "https://api.chess.com/pub/player/testuser/games/2026/03",
];

export const MONTHLY_ARCHIVES_FIXTURE: Record<string, ChessComMonthlyArchiveRaw> = {
  "https://api.chess.com/pub/player/testuser/games/2026/03": {
    games: [
      {
        url: "https://www.chess.com/game/live/1001",
        end_time: 1_773_144_000,
        time_class: "rapid",
        white: {
          username: "testuser",
          rating: 1650,
          result: "win",
        },
        black: {
          username: "opponentA",
          rating: 1685,
          result: "checkmated",
        },
        pgn: PGN_QUEENS_GAMBIT,
      },
    ],
  },
  "https://api.chess.com/pub/player/testuser/games/2026/02": {
    games: [
      {
        url: "https://www.chess.com/game/live/1002",
        end_time: 1_771_156_800,
        time_class: "blitz",
        white: {
          username: "opponentB",
          rating: 1720,
          result: "resigned",
        },
        black: {
          username: "testuser",
          rating: 1662,
          result: "win",
        },
        pgn: PGN_SICILIAN,
      },
    ],
  },
  "https://api.chess.com/pub/player/testuser/games/2026/01": {
    games: [
      {
        url: "https://www.chess.com/game/live/1003",
        end_time: 1_767_960_000,
        time_class: "daily",
        white: {
          username: "testuser",
          rating: 1638,
          result: "agreed",
        },
        black: {
          username: "opponentC",
          rating: 1610,
          result: "agreed",
        },
        pgn: PGN_ENGLISH,
      },
      {
        url: "https://www.chess.com/game/live/ignored-variant",
        end_time: 1_767_961_000,
        time_class: "chess960",
        white: { username: "testuser", result: "win" },
        black: { username: "opponentD", result: "checkmated" },
      },
    ],
  },
};
