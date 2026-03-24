const ECO_TAG_REGEX = /\[ECO\s+"([^"]+)"\]/i;
const OPENING_TAG_REGEX = /\[Opening\s+"([^"]+)"\]/i;
const MOVE_TEXT_REGEX = /\n\n([\s\S]+)$/;

export interface ParsedPgnMeta {
  eco?: string;
  openingName?: string;
  moveCount?: number;
}

function countHalfMoves(moveSection: string): number {
  if (!moveSection) {
    return 0;
  }

  const withoutComments = moveSection
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\$\d+/g, " ");

  const tokens = withoutComments
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

  return tokens.length;
}

export function parsePgnMeta(pgn?: string): ParsedPgnMeta {
  if (!pgn) {
    return {};
  }

  const eco = ECO_TAG_REGEX.exec(pgn)?.[1];
  const openingName = OPENING_TAG_REGEX.exec(pgn)?.[1];
  const movesRaw = MOVE_TEXT_REGEX.exec(pgn)?.[1] ?? "";
  const moveCount = countHalfMoves(movesRaw);

  return {
    eco,
    openingName,
    moveCount: moveCount > 0 ? moveCount : undefined,
  };
}
