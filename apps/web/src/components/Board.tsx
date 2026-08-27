import { useMemo, useState } from "react";
import { ChessPosition } from "@chess/chess-core";

const UNICODE: Record<string, string> = {
  wK: "♔",
  wQ: "♕",
  wR: "♖",
  wB: "♗",
  wN: "♘",
  wP: "♙",
  bK: "♚",
  bQ: "♛",
  bR: "♜",
  bB: "♝",
  bN: "♞",
  bP: "♟",
};

function squareName(file: number, rank: number): string {
  return `${"abcdefgh"[file]}${rank + 1}`;
}

function boardMap(fen: string): Record<string, string> {
  const map: Record<string, string> = {};
  const boardFen = fen.split(" ")[0] ?? "";
  const ranks = boardFen.split("/");
  ranks.forEach((row, rankFromTop) => {
    const rank = 7 - rankFromTop;
    let file = 0;
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") {
        file += Number(ch);
        continue;
      }
      const color = ch === ch.toUpperCase() ? "w" : "b";
      map[squareName(file, rank)] = color + ch.toUpperCase();
      file += 1;
    }
  });
  return map;
}

type Props = {
  fen: string;
  orientation?: "white" | "black";
  interactive?: boolean;
  yourTurn?: boolean;
  winner?: "w" | "b" | "draw" | null;
  resultLabel?: string | null;
  onUci?: (uci: string) => boolean | Promise<boolean>;
};

export function Board({
  fen,
  orientation = "white",
  interactive = true,
  yourTurn = false,
  winner = null,
  resultLabel = null,
  onUci,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const files = orientation === "white" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const ranks = orientation === "white" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const pieces = useMemo(() => boardMap(fen), [fen]);

  const legalFromSelected = useMemo(() => {
    if (!selected) return new Set<string>();
    const pos = new ChessPosition(fen);
    return new Set(
      pos
        .legalUci()
        .filter((u) => u.startsWith(selected))
        .map((u) => u.slice(2, 4)),
    );
  }, [fen, selected]);

  function clickSquare(square: string) {
    if (!interactive || !onUci) return;
    if (!selected) {
      if (pieces[square]) setSelected(square);
      return;
    }
    if (selected === square) {
      setSelected(null);
      return;
    }
    const pos = new ChessPosition(fen);
    const promo = pos.legalUci().some((u) => u.startsWith(selected + square) && u.length === 5) ? "q" : "";
    const uci = `${selected}${square}${promo}`;
    const ok = onUci(uci);
    if (ok !== false) setSelected(null);
    else setSelected(square);
  }

  return (
    <div
      className={`board-wrap ${winner ? "board-finished" : yourTurn ? "board-your-turn" : "board-their-turn"} ${winner === "w" || winner === "b" ? "board-has-winner" : ""}`}
    >
      <div className="board-grid" role="grid" aria-label="Chessboard">
        {ranks.map((rank) =>
          files.map((file) => {
            const square = squareName(file, rank);
            const dark = (file + rank) % 2 === 0;
            const piece = pieces[square];
            const isSel = selected === square;
            const isLegal = legalFromSelected.has(square);
            const isWinKing = winner === "w" || winner === "b" ? piece === `${winner}K` : false;
            const isLoseKing =
              winner === "w" || winner === "b" ? piece === `${winner === "w" ? "b" : "w"}K` : false;
            return (
              <button
                key={square}
                type="button"
                className={`sq ${dark ? "sq-dark" : "sq-light"} ${isSel ? "sq-sel" : ""} ${isLegal ? "sq-legal" : ""} ${isWinKing ? "sq-winner-king" : ""} ${isLoseKing ? "sq-loser-king" : ""}`}
                onClick={() => clickSquare(square)}
                aria-label={square}
              >
                {piece ? <span className="piece">{UNICODE[piece]}</span> : null}
              </button>
            );
          }),
        )}
      </div>
      {resultLabel ? (
        <div className="board-result-overlay" role="status">
          <div>
            <div className="board-result-kicker">Game over</div>
            <div className="board-result-title">{resultLabel}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
