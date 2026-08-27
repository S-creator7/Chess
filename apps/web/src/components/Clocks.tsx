export function formatMs(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  whiteMs: number;
  blackMs: number;
  turn: "w" | "b";
  running: boolean;
  you?: "w" | "b";
  orientation?: "white" | "black";
  winner?: "w" | "b" | "draw" | null;
};

export function Clocks({ whiteMs, blackMs, turn, running, you, orientation = "white", winner = null }: Props) {
  const topIsWhite = orientation === "black";
  const top: "w" | "b" = topIsWhite ? "w" : "b";
  const bottom: "w" | "b" = topIsWhite ? "b" : "w";

  function label(color: "w" | "b") {
    const name = color === "w" ? "White" : "Black";
    if (!you) return name;
    return you === color ? `You · ${name}` : `Opponent · ${name}`;
  }

  function clock(color: "w" | "b") {
    const ms = color === "w" ? whiteMs : blackMs;
    const active = running && turn === color;
    const mine = you === color;
    return (
      <div className={`clock ${active ? "active" : ""} ${mine && active ? "clock-you" : ""} ${winner === color ? "clock-winner" : ""} ${winner && winner !== "draw" && winner !== color ? "clock-loser" : ""}`}>
        <span className="clock-label">{label(color)}{winner === color ? " · Winner" : ""}</span>
        <span className="clock-time">{formatMs(ms)}</span>
      </div>
    );
  }

  return (
    <div className="clocks">
      {clock(top)}
      {clock(bottom)}
    </div>
  );
}
