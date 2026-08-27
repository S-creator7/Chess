import { Chess } from "chess.js";
import { START_FEN, type AppliedMove, type Color } from "./types";

function toUci(from: string, to: string, promotion?: string | null): string {
  return `${from}${to}${promotion ?? ""}`;
}

export class ChessPosition {
  private chess: Chess;

  constructor(fen: string = START_FEN) {
    this.chess = new Chess(fen);
  }

  fen(): string {
    return this.chess.fen();
  }

  turn(): Color {
    return this.chess.turn();
  }

  ply(): number {
    return this.chess.history().length;
  }

  legalUci(): string[] {
    return this.chess.moves({ verbose: true }).map((m) => toUci(m.from, m.to, m.promotion));
  }

  isLegalUci(uci: string): boolean {
    return this.legalUci().includes(uci);
  }

  applyUci(uci: string): AppliedMove {
    if (uci.length < 4) {
      throw new Error("ILLEGAL_MOVE");
    }
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined;
    let move;
    try {
      move = this.chess.move({ from, to, promotion });
    } catch {
      throw new Error("ILLEGAL_MOVE");
    }
    if (!move) {
      throw new Error("ILLEGAL_MOVE");
    }
    return {
      san: move.san,
      uci: toUci(move.from, move.to, move.promotion),
      fenAfter: this.chess.fen(),
      color: move.color,
    };
  }

  clone(): ChessPosition {
    return new ChessPosition(this.fen());
  }

  isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  isStalemate(): boolean {
    return this.chess.isStalemate();
  }

  isThreefold(): boolean {
    return this.chess.isThreefoldRepetition();
  }

  isInsufficient(): boolean {
    return this.chess.isInsufficientMaterial();
  }

  isFiftyMove(): boolean {
    return this.chess.isDraw() && this.chess.isCheckmate() === false && this.chess.fen().split(" ")[4] === "100";
  }

  isDrawByFifty(): boolean {
    const halfmove = Number(this.chess.fen().split(" ")[4]);
    return halfmove >= 100;
  }

  outcome(): { over: boolean; reason?: "checkmate" | "stalemate" | "threefold" | "insufficient" | "fifty_move"; winner?: Color } {
    if (this.chess.isCheckmate()) {
      return { over: true, reason: "checkmate", winner: this.turn() === "w" ? "b" : "w" };
    }
    if (this.chess.isStalemate()) {
      return { over: true, reason: "stalemate" };
    }
    if (this.chess.isThreefoldRepetition()) {
      return { over: true, reason: "threefold" };
    }
    if (this.chess.isInsufficientMaterial()) {
      return { over: true, reason: "insufficient" };
    }
    if (this.isDrawByFifty()) {
      return { over: true, reason: "fifty_move" };
    }
    return { over: false };
  }

  ascii(): string {
    return this.chess.ascii();
  }

  pgn(): string {
    return this.chess.pgn();
  }

  historySan(): string[] {
    return this.chess.history();
  }
}
