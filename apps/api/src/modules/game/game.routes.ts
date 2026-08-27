import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Config } from "../../config";
import { requireUser } from "../auth/auth.routes";
import { findActiveGame, gamePgn, listGames, toGameDto } from "../game/game.service";
import { listChat } from "../chat/chat.service";
import type { MatchmakingService } from "../matchmaking/matchmaking.service";
import type { RealtimeHub } from "../realtime/realtime.hub";

const queueSchema = z.object({
  timeControl: z.string().regex(/^\d+\+\d+$/),
  rated: z.boolean().default(true),
});

export async function registerGameRoutes(
  app: FastifyInstance,
  config: Config,
  matchmaking: MatchmakingService,
  hub: RealtimeHub,
) {
  app.post("/matchmaking/queue", async (request) => {
    const user = await requireUser(request, config);
    const body = queueSchema.parse(request.body);
    const active = await findActiveGame(user.id);
    if (active) {
      return { matched: true, gameId: active.id };
    }
    const result = await matchmaking.enqueue({
      userId: user.id,
      rating: user.rating,
      timeControl: body.timeControl,
      rated: body.rated,
      queuedAt: Date.now(),
    });
    if (result.matched) {
      await hub.emitToUsers([result.whiteId, result.blackId], {
        type: "game_start",
        gameId: result.gameId,
      });
      return { matched: true, gameId: result.gameId };
    }
    return { matched: false };
  });

  app.delete("/matchmaking/queue", async (request) => {
    const user = await requireUser(request, config);
    await matchmaking.dequeue(user.id);
    return { ok: true };
  });

  app.get("/games", async (request) => {
    const user = await requireUser(request, config);
    const games = await listGames(user.id);
    return {
      games: games.map((g) => ({
        id: g.id,
        timeControl: g.timeControl,
        status: g.status,
        result: g.result,
        rated: g.rated,
        createdAt: g.createdAt,
        white: g.white,
        black: g.black,
        you: g.whiteId === user.id ? "w" : "b",
      })),
    };
  });

  app.get("/games/active", async (request) => {
    const user = await requireUser(request, config);
    const game = await findActiveGame(user.id);
    if (!game) return { game: null };
    return { game: await toGameDto(game.id, user.id) };
  });

  app.get("/games/:id", async (request) => {
    const user = await requireUser(request, config);
    const { id } = request.params as { id: string };
    return { game: await toGameDto(id, user.id) };
  });

  app.get("/games/:id/pgn", async (request) => {
    const user = await requireUser(request, config);
    const { id } = request.params as { id: string };
    const pgn = await gamePgn(id, user.id);
    return { pgn };
  });

  app.get("/games/:id/chat", async (request) => {
    const user = await requireUser(request, config);
    const { id } = request.params as { id: string };
    return { messages: await listChat(id, user.id) };
  });
}
