import { resultHeadline, winnerFromResult } from "../lib/result";

type Props = {
  turn: "w" | "b";
  you?: "w" | "b";
  over?: boolean;
  result?: string | null;
  reason?: string | null;
  waitingLabel?: string;
};

export function TurnBanner({ turn, you, over, result, reason, waitingLabel }: Props) {
  if (over) {
    const winner = winnerFromResult(result);
    const cls =
      winner === "draw"
        ? "turn-draw"
        : you && winner === you
          ? "turn-win"
          : you && winner && winner !== you
            ? "turn-loss"
            : "turn-win";
    return (
      <div className={`turn-banner ${cls}`} role="status">
        {resultHeadline(result, you, reason)}
      </div>
    );
  }

  const isYou = you ? turn === you : undefined;
  const side = turn === "w" ? "White" : "Black";

  if (isYou === true) {
    return (
      <div className="turn-banner turn-you" role="status">
        Your turn — {side} to move
      </div>
    );
  }
  if (isYou === false) {
    return (
      <div className="turn-banner turn-them" role="status">
        {waitingLabel ?? "Opponent to move"} — {side}
      </div>
    );
  }
  return (
    <div className={`turn-banner ${turn === "w" ? "turn-white" : "turn-black"}`} role="status">
      {side} to move
    </div>
  );
}
