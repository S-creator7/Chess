import { ChessPosition } from "./position";
import type { Color } from "./types";

const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

function material(fen: string): number {
  const board = fen.split(" ")[0] ?? "";
  let score = 0;
  for (const ch of board) {
    if (ch === "/" || ch >= "1") continue;
    const lower = ch.toLowerCase();
    const value = PIECE_VALUE[lower] ?? 0;
    score += ch === lower ? -value : value;
  }
  return score;
}

function scorePosition(pos: ChessPosition): number {
  const outcome = pos.outcome();
  if (outcome.over) {
    if (outcome.reason === "checkmate") {
      return outcome.winner === "w" ? 100_000 : -100_000;
    }
    return 0;
  }
  return material(pos.fen());
}

function minimax(pos: ChessPosition, depth: number, maximizing: boolean): number {
  const outcome = pos.outcome();
  if (depth === 0 || outcome.over) {
    return scorePosition(pos);
  }
  const moves = pos.legalUci();
  if (maximizing) {
    let best = -Infinity;
    for (const uci of moves) {
      const next = pos.clone();
      next.applyUci(uci);
      best = Math.max(best, minimax(next, depth - 1, false));
    }
    return best;
  }
  let best = Infinity;
  for (const uci of moves) {
    const next = pos.clone();
    next.applyUci(uci);
    best = Math.min(best, minimax(next, depth - 1, true));
  }
  return best;
}

export type EngineStrength = "easy" | "medium" | "hard";

const DEPTH: Record<EngineStrength, number> = {
  easy: 1,
  medium: 2,
  hard: 2,
};

/** Local-only engine. Online games must never use this on the client as authority. */
export function chooseEngineMove(fen: string, strength: EngineStrength = "medium"): string | null {
  const pos = new ChessPosition(fen);
  const moves = pos.legalUci();
  if (moves.length === 0) return null;

  if (strength === "easy" && Math.random() < 0.45) {
    return moves[Math.floor(Math.random() * moves.length)] ?? null;
  }

  const maximizing = pos.turn() === "w";
  const depth = DEPTH[strength];
  let bestMove = moves[0]!;
  let bestScore = maximizing ? -Infinity : Infinity;

  for (const uci of moves) {
    const next = pos.clone();
    next.applyUci(uci);
    const score = minimax(next, depth - 1, !maximizing);
    const jitter = strength === "hard" ? 0 : (Math.random() - 0.5) * 40;
    const adjusted = score + jitter;
    if (maximizing ? adjusted > bestScore : adjusted < bestScore) {
      bestScore = adjusted;
      bestMove = uci;
    }
  }
  return bestMove;
}

export function engineColorFromFen(fen: string): Color {
  return new ChessPosition(fen).turn();
}
