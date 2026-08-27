import { useEffect, useReducer, useRef } from "react";
import {
  afterMove,
  ChessPosition,
  chooseEngineMove,
  createClocks,
  flagColor,
  snapshotClocks,
  startClock,
  stopClocks,
  type ClockState,
  type EngineStrength,
} from "@chess/chess-core";
import { Board } from "../components/Board";
import { Clocks } from "../components/Clocks";
import { TurnBanner } from "../components/TurnBanner";
import { resultHeadline, winnerFromResult } from "../lib/result";

type Mode = "pvp" | "ai";

type State = {
  fen: string;
  clocks: ClockState;
  incrementMs: number;
  useClocks: boolean;
  over: string | null;
  result: "1-0" | "0-1" | "1/2-1/2" | null;
  reason: string | null;
  sans: string[];
  humanColor: "w" | "b";
  strength: EngineStrength;
  mode: Mode;
};

type Action =
  | { type: "move"; uci: string; now: number }
  | { type: "tick"; now: number }
  | { type: "engine"; uci: string; now: number }
  | { type: "reset"; mode: Mode; strength: EngineStrength; humanColor: "w" | "b"; useClocks: boolean };

function applyUci(state: State, uci: string, now: number): State {
  if (state.over) return state;
  const pos = new ChessPosition(state.fen);
  if (!pos.isLegalUci(uci) && !pos.legalUci().some((m) => m.startsWith(uci))) {
    return state;
  }
  let applied;
  try {
    applied = pos.applyUci(uci.length === 4 && needsPromo(state.fen, uci) ? `${uci}q` : uci);
  } catch {
    return state;
  }
  let clocks = state.clocks;
  if (state.useClocks) {
    clocks = afterMove(state.clocks.lastTickAt === null ? startClock(state.clocks, now) : state.clocks, applied.color, state.incrementMs, now);
    const flagged = flagColor(clocks);
    if (flagged) {
      return {
        ...state,
        fen: pos.fen(),
        clocks: stopClocks(clocks, now),
        over: flagged === "w" ? "Black wins on time" : "White wins on time",
        result: flagged === "w" ? "0-1" : "1-0",
        reason: "on time",
        sans: [...state.sans, applied.san],
      };
    }
  }
  const outcome = pos.outcome();
  let over: string | null = null;
  let result: State["result"] = null;
  let reason: string | null = null;
  if (outcome.over) {
    if (outcome.reason === "checkmate") {
      over = `${outcome.winner === "w" ? "White" : "Black"} wins by checkmate`;
      result = outcome.winner === "w" ? "1-0" : "0-1";
      reason = "checkmate";
    } else {
      over = `Draw (${outcome.reason})`;
      result = "1/2-1/2";
      reason = outcome.reason ?? "draw";
    }
    clocks = stopClocks(clocks, now);
  }
  return { ...state, fen: pos.fen(), clocks, over, result, reason, sans: [...state.sans, applied.san] };
}

function needsPromo(fen: string, uci: string): boolean {
  const pos = new ChessPosition(fen);
  return pos.legalUci().some((m) => m.startsWith(uci) && m.length === 5);
}

function reducer(state: State, action: Action): State {
  if (action.type === "reset") {
    const clocks = createClocks({ initialMs: 600_000, incrementMs: 0 });
    return {
      fen: new ChessPosition().fen(),
      clocks,
      incrementMs: 0,
      useClocks: action.useClocks,
      over: null,
      result: null,
      reason: null,
      sans: [],
      humanColor: action.humanColor,
      strength: action.strength,
      mode: action.mode,
    };
  }
  if (action.type === "tick") {
    if (!state.useClocks || state.over) return state;
    const clocks = snapshotClocks(
      state.clocks.lastTickAt === null ? startClock(state.clocks, action.now) : state.clocks,
      action.now,
    );
    const flagged = flagColor(clocks);
    if (flagged) {
      return {
        ...state,
        clocks: stopClocks(clocks, action.now),
        over: flagged === "w" ? "Black wins on time" : "White wins on time",
        result: flagged === "w" ? "0-1" : "1-0",
        reason: "on time",
      };
    }
    return { ...state, clocks };
  }
  if (action.type === "move" || action.type === "engine") {
    return applyUci(state, action.uci, action.now);
  }
  return state;
}

export function LocalGame({ mode }: { mode: Mode }) {
  const [state, dispatch] = useReducer(reducer, {
    fen: new ChessPosition().fen(),
    clocks: createClocks({ initialMs: 600_000, incrementMs: 0 }),
    incrementMs: 0,
    useClocks: false,
    over: null,
    result: null,
    reason: null,
    sans: [],
    humanColor: "w",
    strength: "medium",
    mode,
  });
  const thinking = useRef(false);

  useEffect(() => {
    dispatch({ type: "reset", mode, strength: "medium", humanColor: "w", useClocks: false });
  }, [mode]);

  useEffect(() => {
    if (!state.useClocks || state.over) return;
    const id = window.setInterval(() => dispatch({ type: "tick", now: Date.now() }), 200);
    return () => window.clearInterval(id);
  }, [state.useClocks, state.over]);

  useEffect(() => {
    if (mode !== "ai" || state.over) return;
    const pos = new ChessPosition(state.fen);
    if (pos.turn() === state.humanColor) return;
    if (thinking.current) return;
    thinking.current = true;
    const id = window.setTimeout(() => {
      const move = chooseEngineMove(state.fen, state.strength);
      if (move) dispatch({ type: "engine", uci: move, now: Date.now() });
      thinking.current = false;
    }, 250);
    return () => {
      window.clearTimeout(id);
      thinking.current = false;
    };
  }, [mode, state.fen, state.over, state.humanColor, state.strength]);

  const pos = new ChessPosition(state.fen);
  const orientation = state.humanColor === "w" ? "white" : "black";
  const canMove = !state.over && (mode === "pvp" || pos.turn() === state.humanColor);

  return (
    <div className="game-layout">
      <div className="board-column">
        <TurnBanner
          turn={pos.turn()}
          you={mode === "ai" ? state.humanColor : undefined}
          over={Boolean(state.over)}
          result={state.result}
          reason={state.reason}
          waitingLabel={mode === "ai" ? "Computer thinking" : undefined}
        />
        <Board
          fen={state.fen}
          orientation={orientation}
          interactive={canMove}
          yourTurn={canMove && !state.over}
          winner={winnerFromResult(state.result)}
          resultLabel={state.over ? resultHeadline(state.result, mode === "ai" ? state.humanColor : undefined, state.reason) : null}
          onUci={(uci) => {
            const next = new ChessPosition(state.fen);
            const legal = next.isLegalUci(uci) || next.legalUci().some((m) => m.startsWith(uci.slice(0, 4)));
            if (!legal) return false;
            dispatch({ type: "move", uci, now: Date.now() });
            return true;
          }}
        />
        {state.useClocks && (
          <Clocks
            whiteMs={state.clocks.whiteMs}
            blackMs={state.clocks.blackMs}
            turn={pos.turn()}
            running={!state.over}
            you={mode === "ai" ? state.humanColor : undefined}
            orientation={orientation}
            winner={winnerFromResult(state.result)}
          />
        )}
      </div>
      <div className="card">
        <h2>{mode === "ai" ? "Play vs computer" : "Pass and play"}</h2>
        <p className={`status ${state.over ? "status-result" : ""}`}>{state.over ? resultHeadline(state.result, mode === "ai" ? state.humanColor : undefined, state.reason) : (mode === "ai" && pos.turn() !== state.humanColor ? "Computer thinking…" : "Your move")}</p>
        <div className="form">
          {mode === "ai" && (
            <>
              <label className="muted">Strength</label>
              <select
                value={state.strength}
                onChange={(e) =>
                  dispatch({
                    type: "reset",
                    mode,
                    strength: e.target.value as EngineStrength,
                    humanColor: state.humanColor,
                    useClocks: state.useClocks,
                  })
                }
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <label className="muted">You play</label>
              <select
                value={state.humanColor}
                onChange={(e) =>
                  dispatch({
                    type: "reset",
                    mode,
                    strength: state.strength,
                    humanColor: e.target.value as "w" | "b",
                    useClocks: state.useClocks,
                  })
                }
              >
                <option value="w">White</option>
                <option value="b">Black</option>
              </select>
            </>
          )}
          <label>
            <input
              type="checkbox"
              checked={state.useClocks}
              onChange={(e) =>
                dispatch({
                  type: "reset",
                  mode,
                  strength: state.strength,
                  humanColor: state.humanColor,
                  useClocks: e.target.checked,
                })
              }
            />{" "}
            10+0 clocks
          </label>
          <button
            className="secondary"
            type="button"
            onClick={() =>
              dispatch({
                type: "reset",
                mode,
                strength: state.strength,
                humanColor: state.humanColor,
                useClocks: state.useClocks,
              })
            }
          >
            New game
          </button>
        </div>
        <h3>Moves</h3>
        <div className="moves">{state.sans.join(" ") || "No moves yet."}</div>
        <p className="muted">Local games stay on this device. No account required.</p>
      </div>
    </div>
  );
}
