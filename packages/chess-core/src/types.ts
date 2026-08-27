export type Color = "w" | "b";
export type GameOverReason =
  | "checkmate"
  | "stalemate"
  | "threefold"
  | "insufficient"
  | "fifty_move"
  | "timeout"
  | "resign"
  | "draw_agreement";

export type TimeControl = {
  initialMs: number;
  incrementMs: number;
};

export type ClockState = {
  whiteMs: number;
  blackMs: number;
  runningFor: Color | null;
  lastTickAt: number | null;
};

export type AppliedMove = {
  san: string;
  uci: string;
  fenAfter: string;
  color: Color;
};

export const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function parseTimeControl(value: string): TimeControl {
  const match = /^(\d+)\+(\d+)$/.exec(value.trim());
  if (!match) {
    throw new Error("INVALID_TIME_CONTROL");
  }
  const minutes = Number(match[1]);
  const incrementSec = Number(match[2]);
  return {
    initialMs: minutes * 60 * 1000,
    incrementMs: incrementSec * 1000,
  };
}

export function opponent(color: Color): Color {
  return color === "w" ? "b" : "w";
}
