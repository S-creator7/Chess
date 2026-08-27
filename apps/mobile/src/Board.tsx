import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
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
  onUci?: (uci: string) => boolean;
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
  const { width } = useWindowDimensions();
  const size = Math.min(width - 24, 420);
  const cell = size / 8;
  const [selected, setSelected] = useState<string | null>(null);
  const files = orientation === "white" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const ranks = orientation === "white" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const pieces = useMemo(() => boardMap(fen), [fen]);
  const legalFromSelected = useMemo(() => {
    if (!selected) return new Set<string>();
    const pos = new ChessPosition(fen);
    return new Set(pos.legalUci().filter((u) => u.startsWith(selected)).map((u) => u.slice(2, 4)));
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
    <View
      style={[
        styles.wrap,
        { width: size, height: size },
        yourTurn && !winner ? styles.yourTurn : null,
      ]}
    >
      {ranks.map((rank) =>
        files.map((file) => {
          const square = squareName(file, rank);
          const dark = (file + rank) % 2 === 0;
          const piece = pieces[square];
          const isSel = selected === square;
          const isLegal = legalFromSelected.has(square);
          const isWinKing = winner === "w" || winner === "b" ? piece === `${winner}K` : false;
          return (
            <Pressable
              key={square}
              onPress={() => clickSquare(square)}
              style={[
                styles.sq,
                { width: cell, height: cell },
                dark ? styles.dark : styles.light,
                isSel && styles.sel,
                isLegal && styles.legal,
                isWinKing && styles.winKing,
              ]}
            >
              <Text style={[styles.piece, { fontSize: cell * 0.68 }]}>{piece ? UNICODE[piece] : ""}</Text>
            </Pressable>
          );
        }),
      )}
      {resultLabel ? (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.kicker}>GAME OVER</Text>
          <Text style={styles.title}>{resultLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 3,
    borderColor: "#c4b07a",
    backgroundColor: "#eeeed2",
    overflow: "hidden",
  },
  yourTurn: { borderColor: "#2e7d32" },
  sq: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "rgba(80,70,40,0.35)",
  },
  light: { backgroundColor: "#eeeed2" },
  dark: { backgroundColor: "#769656" },
  sel: { borderWidth: 3, borderColor: "#f4d35e" },
  legal: { borderWidth: 3, borderColor: "#22c55e" },
  winKing: { backgroundColor: "#f59e0b" },
  piece: { color: "#111" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,252,240,0.82)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  kicker: { fontWeight: "700", letterSpacing: 2, color: "#4b5563" },
  title: { fontSize: 28, fontWeight: "800", color: "#14532d", textAlign: "center", marginTop: 6 },
});
