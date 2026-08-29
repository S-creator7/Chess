import { useEffect, useReducer, useRef, useState } from "react";
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

const STRENGTHS: { id: EngineStrength; title: string; hint: string }[] = [
  { id: "easy", title: "Easy", hint: "Casual, more mistakes" },
  { id: "medium", title: "Medium", hint: "Balanced play" },
  { id: "hard", title: "Hard", hint: "Deeper search" },
];

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

function initial(mode: Mode, strength: EngineStrength = "medium", humanColor: "w" | "b" = "w"): State {
  return {
    fen: new ChessPosition().fen(),
    over: null,
    result: null,
    reason: null,
    sans: [],
    humanColor,
    strength,
    mode,
  };
}

export function LocalScreen({ mode, onBack }: { mode: Mode; onBack: () => void }) {
  const [state, dispatch] = useReducer(
    (
      s: State,
      a:
        | { type: "move"; uci: string }
        | { type: "reset"; mode: Mode; strength: EngineStrength; humanColor: "w" | "b" },
    ): State => {
      if (a.type === "reset") return initial(a.mode, a.strength, a.humanColor);
      return applyUci(s, a.uci);
    },
    initial(mode),
  );
  const [started, setStarted] = useState(mode !== "ai");
  const [pickStrength, setPickStrength] = useState<EngineStrength>("medium");
  const [pickColor, setPickColor] = useState<"w" | "b">("w");
  const thinking = useRef(false);

  useEffect(() => {
    setStarted(mode !== "ai");
    dispatch({ type: "reset", mode, strength: "medium", humanColor: "w" });
  }, [mode]);

  useEffect(() => {
    if (!started || mode !== "ai" || state.over) return;
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
  }, [started, mode, state.fen, state.over, state.humanColor, state.strength]);

  function startAi() {
    dispatch({ type: "reset", mode: "ai", strength: pickStrength, humanColor: pickColor });
    setStarted(true);
  }

  if (mode === "ai" && !started) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Pressable onPress={onBack}><Text style={styles.back}>← Home</Text></Pressable>
        <Text style={styles.heading}>Vs computer</Text>
        <Text style={styles.muted}>Choose a level, then start. The same engine as the web app.</Text>
        {STRENGTHS.map((opt) => {
          const on = pickStrength === opt.id;
          return (
            <Pressable key={opt.id} style={[styles.card, on && styles.cardOn]} onPress={() => setPickStrength(opt.id)}>
              <Text style={styles.cardTitle}>{opt.title}</Text>
              <Text style={styles.muted}>{opt.hint}</Text>
            </Pressable>
          );
        })}
        <Text style={styles.label}>You play</Text>
        <View style={styles.row}>
          <Pressable style={[styles.chip, pickColor === "w" && styles.chipOn]} onPress={() => setPickColor("w")}>
            <Text style={styles.chipText}>White</Text>
          </Pressable>
          <Pressable style={[styles.chip, pickColor === "b" && styles.chipOn]} onPress={() => setPickColor("b")}>
            <Text style={styles.chipText}>Black</Text>
          </Pressable>
        </View>
        <Pressable style={styles.btn} onPress={startAi}>
          <Text style={styles.btnText}>Start · {pickStrength}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const pos = new ChessPosition(state.fen);
  const canMove = !state.over && (mode === "pvp" || pos.turn() === state.humanColor);
  const you = mode === "ai" ? state.humanColor : undefined;
  const turnText = state.over
    ? resultHeadline(state.result, you, state.reason)
    : mode === "pvp"
      ? `${pos.turn() === "w" ? "White" : "Black"} to move`
      : pos.turn() === state.humanColor
        ? `Your turn · ${state.strength}`
        : `Computer thinking… · ${state.strength}`;

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
      <Pressable
        style={styles.btn}
        onPress={() => {
          if (mode === "ai") {
            setStarted(false);
            return;
          }
          dispatch({ type: "reset", mode, strength: state.strength, humanColor: state.humanColor });
        }}
      >
        <Text style={styles.btnText}>{mode === "ai" ? "Change level" : "New game"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 12, paddingBottom: 40, backgroundColor: "#101114", minHeight: "100%" },
  back: { color: "#d4a017", marginBottom: 10, fontWeight: "700" },
  heading: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 8 },
  muted: { color: "#9ca3af", marginBottom: 16 },
  label: { color: "#9ca3af", marginTop: 8, marginBottom: 8, fontWeight: "700" },
  banner: {
    backgroundColor: "#d4a017",
    color: "#111",
    fontWeight: "800",
    textAlign: "center",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    textTransform: "capitalize",
  },
  card: {
    backgroundColor: "#1a1c22",
    borderColor: "#2a2d36",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardOn: { borderColor: "#d4a017", borderWidth: 2 },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  row: { flexDirection: "row", gap: 10, marginBottom: 16 },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#2a2d36",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  chipOn: { borderColor: "#d4a017", backgroundColor: "#2a2410" },
  chipText: { color: "#fff", fontWeight: "700" },
  moves: { color: "#9ca3af", marginTop: 12 },
  btn: { backgroundColor: "#d4a017", padding: 12, borderRadius: 8, marginTop: 16, alignItems: "center" },
  btnText: { fontWeight: "800", color: "#111", textTransform: "capitalize" },
});
