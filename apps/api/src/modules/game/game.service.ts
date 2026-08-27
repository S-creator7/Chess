import {
  afterMove,
  ChessPosition,
  flagColor,
  parseTimeControl,
  snapshotClocks,
  START_FEN,
  stopClocks,
  type ClockState,
} from "@chess/chess-core";
import type { Game, Move } from "@prisma/client";
import { AppError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";

export type GameDto = {
  id: string;
  whiteId: string;
  blackId: string;
  whiteName: string;
  blackName: string;
  timeControl: string;
  rated: boolean;
  status: string;
  result: string | null;
  fen: string;
  turn: "w" | "b";
  whiteClockMs: number;
  blackClockMs: number;
  ply: number;
  you: "w" | "b";
  moves: Array<{ ply: number; san: string; uci: string }>;
};

export function reconstructPosition(startFen: string, moves: Move[]): ChessPosition {
  const pos = new ChessPosition(startFen);
  for (const move of [...moves].sort((a, b) => a.ply - b.ply)) {
    pos.applyUci(move.uci);
  }
  return pos;
}

function liveClocks(game: Game, turn: "w" | "b", now: number): ClockState {
  if (game.status !== "active") {
    return {
      whiteMs: game.whiteClockMs,
      blackMs: game.blackClockMs,
      runningFor: null,
      lastTickAt: null,
    };
  }
  return snapshotClocks(
    {
      whiteMs: game.whiteClockMs,
      blackMs: game.blackClockMs,
      runningFor: turn,
      lastTickAt: (game.lastMoveAt ?? game.createdAt).getTime(),
    },
    now,
  );
}

function colorOf(game: { whiteId: string; blackId: string }, userId: string): "w" | "b" {
  if (game.whiteId === userId) return "w";
  if (game.blackId === userId) return "b";
  throw new AppError("FORBIDDEN", "Not a player in this game", 403);
}

export async function createRatedGame(input: {
  whiteId: string;
  blackId: string;
  timeControl: string;
  rated: boolean;
}) {
  const control = parseTimeControl(input.timeControl);
  const now = new Date();
  return prisma.game.create({
    data: {
      whiteId: input.whiteId,
      blackId: input.blackId,
      timeControl: input.timeControl,
      initialMs: control.initialMs,
      incrementMs: control.incrementMs,
      whiteClockMs: control.initialMs,
      blackClockMs: control.initialMs,
      lastMoveAt: now,
      status: "active",
      rated: input.rated,
      startFen: START_FEN,
    },
  });
}

export async function toGameDto(gameId: string, userId: string, now = Date.now()): Promise<GameDto> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      moves: { orderBy: { ply: "asc" } },
      white: { select: { displayName: true } },
      black: { select: { displayName: true } },
    },
  });
  if (!game) throw new AppError("NOT_FOUND", "Game not found", 404);
  const you = colorOf(game, userId);
  const pos = reconstructPosition(game.startFen, game.moves);
  const clocks = liveClocks(game, pos.turn(), now);
  return {
    id: game.id,
    whiteId: game.whiteId,
    blackId: game.blackId,
    whiteName: game.white.displayName,
    blackName: game.black.displayName,
    timeControl: game.timeControl,
    rated: game.rated,
    status: game.status,
    result: game.result,
    fen: pos.fen(),
    turn: pos.turn(),
    whiteClockMs: clocks.whiteMs,
    blackClockMs: clocks.blackMs,
    ply: game.moves.length,
    you,
    moves: game.moves.map((m) => ({ ply: m.ply, san: m.san, uci: m.uci })),
  };
}

const K = 32;

export async function applyRating(game: Game, result: string) {
  if (!game.rated || result === "*") return;
  const white = await prisma.user.findUniqueOrThrow({ where: { id: game.whiteId } });
  const black = await prisma.user.findUniqueOrThrow({ where: { id: game.blackId } });
  const expectedWhite = 1 / (1 + 10 ** ((black.rating - white.rating) / 400));
  const scoreWhite = result === "1-0" ? 1 : result === "0-1" ? 0 : 0.5;
  const whiteNext = Math.round(white.rating + K * (scoreWhite - expectedWhite));
  const blackNext = Math.round(black.rating + K * ((1 - scoreWhite) - (1 - expectedWhite)));
  await prisma.$transaction([
    prisma.user.update({ where: { id: white.id }, data: { rating: whiteNext } }),
    prisma.user.update({ where: { id: black.id }, data: { rating: blackNext } }),
  ]);
}

export async function playMove(gameId: string, userId: string, uci: string, now = Date.now()) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { moves: { orderBy: { ply: "asc" } } },
  });
  if (!game) throw new AppError("NOT_FOUND", "Game not found", 404);
  if (game.status !== "active") throw new AppError("GAME_OVER", "Game is over", 409);
  const you = colorOf(game, userId);
  const pos = reconstructPosition(game.startFen, game.moves);
  const clocks = liveClocks(game, pos.turn(), now);
  const flagged = flagColor(clocks);
  if (flagged) {
    const result = flagged === "w" ? "0-1" : "1-0";
    const updated = await prisma.game.update({
      where: { id: game.id },
      data: {
        status: "completed",
        result,
        whiteClockMs: Math.max(0, clocks.whiteMs),
        blackClockMs: Math.max(0, clocks.blackMs),
      },
    });
    await applyRating(updated, result);
    throw new AppError("GAME_OVER", "Time expired", 409);
  }
  if (you !== pos.turn()) throw new AppError("NOT_YOUR_TURN", "Not your turn", 409);
  let applied;
  try {
    applied = pos.applyUci(uci);
  } catch {
    throw new AppError("ILLEGAL_MOVE", "Illegal move", 400);
  }
  const nextClocks = afterMove(clocks, applied.color, game.incrementMs, now);
  const ply = game.moves.length + 1;
  const outcome = pos.outcome();
  let status = "active";
  let result: string | null = null;
  if (outcome.over) {
    status = "completed";
    result = outcome.reason === "checkmate" ? (outcome.winner === "w" ? "1-0" : "0-1") : "1/2-1/2";
  }
  const updated = await prisma.$transaction(async (tx) => {
    await tx.move.create({
      data: {
        gameId: game.id,
        ply,
        san: applied.san,
        uci: applied.uci,
        fenAfter: applied.fenAfter,
        timeMs: applied.color === "w" ? nextClocks.whiteMs : nextClocks.blackMs,
      },
    });
    return tx.game.update({
      where: { id: game.id },
      data: {
        whiteClockMs: nextClocks.whiteMs,
        blackClockMs: nextClocks.blackMs,
        lastMoveAt: new Date(now),
        status,
        result,
      },
    });
  });
  if (status === "completed" && result) {
    await applyRating(updated, result);
  }
  return {
    gameId: game.id,
    fen: pos.fen(),
    clocks: nextClocks,
    status,
    result,
    san: applied.san,
    uci: applied.uci,
    ply,
  };
}

export async function resignGame(gameId: string, userId: string, now = Date.now()) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { moves: true },
  });
  if (!game) throw new AppError("NOT_FOUND", "Game not found", 404);
  if (game.status !== "active") throw new AppError("GAME_OVER", "Game is over", 409);
  const you = colorOf(game, userId);
  const pos = reconstructPosition(game.startFen, game.moves);
  const clocks = stopClocks(liveClocks(game, pos.turn(), now), now);
  const result = you === "w" ? "0-1" : "1-0";
  const updated = await prisma.game.update({
    where: { id: game.id },
    data: {
      status: "completed",
      result,
      whiteClockMs: Math.max(0, clocks.whiteMs),
      blackClockMs: Math.max(0, clocks.blackMs),
    },
  });
  await applyRating(updated, result);
  return { result, status: "completed" as const };
}

export async function agreeDraw(gameId: string, userId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new AppError("NOT_FOUND", "Game not found", 404);
  if (game.status !== "active") throw new AppError("GAME_OVER", "Game is over", 409);
  colorOf(game, userId);
  const updated = await prisma.game.update({
    where: { id: game.id },
    data: { status: "completed", result: "1/2-1/2" },
  });
  await applyRating(updated, "1/2-1/2");
  return { result: "1/2-1/2", status: "completed" as const };
}

export async function findActiveGame(userId: string) {
  return prisma.game.findFirst({
    where: {
      status: "active",
      OR: [{ whiteId: userId }, { blackId: userId }],
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listGames(userId: string) {
  return prisma.game.findMany({
    where: { OR: [{ whiteId: userId }, { blackId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      white: { select: { displayName: true, rating: true } },
      black: { select: { displayName: true, rating: true } },
    },
  });
}

export async function gamePgn(gameId: string, userId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { moves: { orderBy: { ply: "asc" } }, white: true, black: true },
  });
  if (!game) throw new AppError("NOT_FOUND", "Game not found", 404);
  colorOf(game, userId);
  const pos = reconstructPosition(game.startFen, game.moves);
  const headers = [
    `[White "${game.white.displayName}"]`,
    `[Black "${game.black.displayName}"]`,
    `[Result "${game.result ?? "*"}"]`,
    `[TimeControl "${game.timeControl}"]`,
  ];
  return `${headers.join("\n")}\n\n${pos.pgn()} ${game.result ?? "*"}\n`;
}
