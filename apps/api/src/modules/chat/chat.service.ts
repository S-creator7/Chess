import { AppError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";

export type ChatDto = {
  id: string;
  gameId: string;
  userId: string;
  displayName: string;
  body: string;
  createdAt: string;
};

const lastSent = new Map<string, number>();
const MIN_INTERVAL_MS = 400;
const MAX_LEN = 240;

function sanitize(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
}

export async function listChat(gameId: string, userId: string): Promise<ChatDto[]> {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new AppError("NOT_FOUND", "Game not found", 404);
  if (game.whiteId !== userId && game.blackId !== userId) {
    throw new AppError("FORBIDDEN", "Not a player in this game", 403);
  }
  const rows = await prisma.chatMessage.findMany({
    where: { gameId },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { user: { select: { displayName: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    gameId: row.gameId,
    userId: row.userId,
    displayName: row.user.displayName,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function postChat(gameId: string, userId: string, raw: string): Promise<ChatDto> {
  const body = sanitize(raw);
  if (!body) throw new AppError("VALIDATION", "Message cannot be empty", 400);

  const key = `${userId}:${gameId}`;
  const now = Date.now();
  const prev = lastSent.get(key) ?? 0;
  if (now - prev < MIN_INTERVAL_MS) {
    throw new AppError("RATE_LIMIT", "Please wait before sending another message", 429);
  }

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new AppError("NOT_FOUND", "Game not found", 404);
  if (game.whiteId !== userId && game.blackId !== userId) {
    throw new AppError("FORBIDDEN", "Not a player in this game", 403);
  }

  const row = await prisma.chatMessage.create({
    data: { gameId, userId, body },
    include: { user: { select: { displayName: true } } },
  });
  lastSent.set(key, now);
  return {
    id: row.id,
    gameId: row.gameId,
    userId: row.userId,
    displayName: row.user.displayName,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}
