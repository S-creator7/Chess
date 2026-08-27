import { describe, expect, it } from "vitest";
import { afterMove, createClocks, flagColor, snapshotClocks } from "../src/clocks";
import { ChessPosition } from "../src/position";
import { chooseEngineMove } from "../src/engine";
import { parseTimeControl } from "../src/types";

describe("ChessPosition", () => {
  it("allows a legal opening move and rejects an illegal one", () => {
    const pos = new ChessPosition();
    expect(pos.isLegalUci("e2e4")).toBe(true);
    pos.applyUci("e2e4");
    expect(pos.turn()).toBe("b");
    expect(() => pos.applyUci("e2e4")).toThrow("ILLEGAL_MOVE");
  });

  it("detects scholars mate checkmate", () => {
    const pos = new ChessPosition();
    for (const uci of ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7"]) {
      pos.applyUci(uci);
    }
    const outcome = pos.outcome();
    expect(outcome.over).toBe(true);
    expect(outcome.reason).toBe("checkmate");
    expect(outcome.winner).toBe("w");
  });

  it("detects stalemate", () => {
    const pos = new ChessPosition("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    const outcome = pos.outcome();
    expect(outcome.over).toBe(true);
    expect(outcome.reason).toBe("stalemate");
  });
});

describe("clocks", () => {
  it("flags white when time hits zero", () => {
    const clocks = createClocks({ initialMs: 1000, incrementMs: 0 });
    const running = { ...clocks, lastTickAt: 0 };
    const later = snapshotClocks(running, 1500);
    expect(flagColor(later)).toBe("w");
  });

  it("adds increment after a move", () => {
    const clocks = createClocks({ initialMs: 10_000, incrementMs: 1000 });
    const after = afterMove({ ...clocks, lastTickAt: 0 }, "w", 1000, 500);
    expect(after.whiteMs).toBe(10_500);
    expect(after.runningFor).toBe("b");
  });
});

describe("parseTimeControl", () => {
  it("parses 10+0", () => {
    expect(parseTimeControl("10+0")).toEqual({ initialMs: 600_000, incrementMs: 0 });
  });
});

describe("engine", () => {
  it("returns a legal move", () => {
    const pos = new ChessPosition();
    const move = chooseEngineMove(pos.fen(), "easy");
    expect(move).toBeTruthy();
    expect(pos.isLegalUci(move!)).toBe(true);
  });
});
