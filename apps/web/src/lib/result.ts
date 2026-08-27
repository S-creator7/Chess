export type ChessResult = "1-0" | "0-1" | "1/2-1/2";
export type Winner = "w" | "b" | "draw";

export function winnerFromResult(result: string | null | undefined): Winner | null {
  if (result === "1-0") return "w";
  if (result === "0-1") return "b";
  if (result === "1/2-1/2") return "draw";
  return null;
}

export function resultHeadline(result: string | null | undefined, you?: "w" | "b", reason?: string | null) {
  const winner = winnerFromResult(result);
  if (!winner) return "Game over";
  if (winner === "draw") return reason ? `Draw — ${reason}` : "Draw";
  const side = winner === "w" ? "White" : "Black";
  if (you === winner) return reason ? `You win — ${reason}` : "You win!";
  if (you && you !== winner) return reason ? `You lost — ${reason}` : "You lost";
  return reason ? `${side} wins — ${reason}` : `${side} wins`;
}
