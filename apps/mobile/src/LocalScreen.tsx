import { useEffect, useReducer, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  ChessPosition,
  chooseEngineMove,
  type EngineStrength,
} from "@chess/chess-core";
import { Board } from "./Board";
import { resultHeadline, winnerFromResult } from "./result";

type Mode = "pvp" | "ai";
type State = {
  fen: string;
  over: string | null;
  result: "1-0" | "0-1" | "1/2-1/2" | null;
  reason: string | null;
  sans: string[];
  humanColor: "w" | "b";
  strength: EngineStrength;
  mode: Mode;
};

function applyUci(state: State, uci: string): State {
  if (state.over) return state;
  const pos = new ChessPosition(state.fen);
  try {
    pos.applyUci(uci.length === 4 && pos.legalUci().some((m) => m.startsWith(uci) && m.length === 5) ? `${uci}q` : uci);
  } catch {
    return state;
  }
  const outcome = pos.outcome();
  let over: string | null = null;
  let result: State["result"] = null;
  let reason: string | null = null;
  if (outcome.over) {
    if (outcome.reason === "checkmate") {
      over = "checkmate";
      result = outcome.winner === "w" ? "1-0" : "0-1";
      reason = "checkmate";
    } else {
      over = "draw";
      result = "1/2-1/2";
      reason = outcome.reason ?? "draw";
    }
  }
  const last = pos.historySan().at(-1);
  return { ...state, fen: pos.fen(), over, result, reason, sans: last ? [...state.sans, last] : state.sans };
}

function initial(mode: Mode): State {
  return {
    fen: new ChessPosition().fen(),
    over: null,
    result: null,
    reason: null,
    sans: [],
    humanColor: "w",
    strength: "medium",
    mode,
  };
}

export function LocalScreen({ mode, onBack }: { mode: Mode; onBack: () => void }) {
  const [state, dispatch] = useReducer(
    (s: State, a: { type: "move"; uci: string } | { type: "reset"; mode: Mode }): State => {
      if (a.type === "reset") return initial(a.mode);
      return applyUci(s, a.uci);
    },
    initial(mode),
  );
  const thinking = useRef(false);

  useEffect(() => {
    dispatch({ type: "reset", mode });
  }, [mode]);

  useEffect(() => {
    if (mode !== "ai" || state.over) return;
    const pos = new ChessPosition(state.fen);
    if (pos.turn() === state.humanColor) return;
    if (thinking.current) return;
    thinking.current = true;
    const id = setTimeout(() => {
      const move = chooseEngineMove(state.fen, state.strength);
      if (move) dispatch({ type: "move", uci: move });
      thinking.current = false;
    }, 250);
    return () => {
      clearTimeout(id);
      thinking.current = false;
    };
  }, [mode, state.fen, state.over, state.humanColor, state.strength]);

  const pos = new ChessPosition(state.fen);
  const canMove = !state.over && (mode === "pvp" || pos.turn() === state.humanColor);
  const you = mode === "ai" ? state.humanColor : undefined;
  const turnText = state.over
    ? resultHeadline(state.result, you, state.reason)
    : mode === "pvp"
      ? `${pos.turn() === "w" ? "White" : "Black"} to move`
      : pos.turn() === state.humanColor
        ? "Your turn"
        : "Computer thinking…";

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={onBack}><Text style={styles.back}>← Home</Text></Pressable>
      <Text style={styles.banner}>{turnText}</Text>
      <Board
        fen={state.fen}
        orientation={state.humanColor === "w" ? "white" : "black"}
        interactive={canMove}
        yourTurn={canMove}
        winner={winnerFromResult(state.result)}
        resultLabel={state.over ? resultHeadline(state.result, you, state.reason) : null}
        onUci={(uci) => {
          const next = new ChessPosition(state.fen);
          const legal = next.isLegalUci(uci) || next.legalUci().some((m) => m.startsWith(uci.slice(0, 4)));
          if (!legal) return false;
          dispatch({ type: "move", uci });
          return true;
        }}
      />
      <Text style={styles.moves}>{state.sans.join(" ") || "No moves yet."}</Text>
      <Pressable style={styles.btn} onPress={() => dispatch({ type: "reset", mode })}>
        <Text style={styles.btnText}>New game</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 12, paddingBottom: 40, backgroundColor: "#101114", minHeight: "100%" },
  back: { color: "#d4a017", marginBottom: 10, fontWeight: "700" },
  banner: {
    backgroundColor: "#d4a017",
    color: "#111",
    fontWeight: "800",
    textAlign: "center",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  moves: { color: "#9ca3af", marginTop: 12 },
  btn: { backgroundColor: "#d4a017", padding: 12, borderRadius: 8, marginTop: 16, alignItems: "center" },
  btnText: { fontWeight: "800", color: "#111" },
});
