import type { ClockState, Color, TimeControl } from "./types";

export function createClocks(control: TimeControl): ClockState {
  return {
    whiteMs: control.initialMs,
    blackMs: control.initialMs,
    runningFor: "w",
    lastTickAt: null,
  };
}

export function startClock(clocks: ClockState, now: number): ClockState {
  return { ...clocks, lastTickAt: now };
}

export function snapshotClocks(clocks: ClockState, now: number): ClockState {
  if (!clocks.runningFor || clocks.lastTickAt === null) {
    return { ...clocks };
  }
  const elapsed = Math.max(0, now - clocks.lastTickAt);
  if (clocks.runningFor === "w") {
    return { ...clocks, whiteMs: clocks.whiteMs - elapsed, lastTickAt: now };
  }
  return { ...clocks, blackMs: clocks.blackMs - elapsed, lastTickAt: now };
}

export function flagColor(clocks: ClockState): Color | null {
  if (clocks.whiteMs <= 0) return "w";
  if (clocks.blackMs <= 0) return "b";
  return null;
}

/** After a legal move by `moved`, deduct time, add increment, switch side. */
export function afterMove(
  clocks: ClockState,
  moved: Color,
  incrementMs: number,
  now: number,
): ClockState {
  const snapped = snapshotClocks(
    {
      ...clocks,
      runningFor: moved,
      lastTickAt: clocks.lastTickAt ?? now,
    },
    now,
  );
  if (moved === "w") {
    return {
      whiteMs: snapped.whiteMs + incrementMs,
      blackMs: snapped.blackMs,
      runningFor: "b",
      lastTickAt: now,
    };
  }
  return {
    whiteMs: snapped.whiteMs,
    blackMs: snapped.blackMs + incrementMs,
    runningFor: "w",
    lastTickAt: now,
  };
}

export function stopClocks(clocks: ClockState, now: number): ClockState {
  const snapped = snapshotClocks(clocks, now);
  return { ...snapped, runningFor: null, lastTickAt: null };
}
