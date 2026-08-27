import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import type { Config } from "../../config";
import { AppError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { verifyAccessToken } from "../auth/auth.service";
import { agreeDraw, playMove, resignGame, toGameDto } from "../game/game.service";
import { postChat } from "../chat/chat.service";
import type { ChatDto } from "../chat/chat.service";

export type Outgoing =
  | { type: "auth_ok" }
  | { type: "game_start"; gameId: string }
  | { type: "position"; gameId: string; payload: unknown }
  | { type: "clock"; gameId: string; whiteClockMs: number; blackClockMs: number }
  | { type: "game_over"; gameId: string; result: string | null }
  | { type: "chat"; message: ChatDto }
  | { type: "draw_offer"; gameId: string; from: "w" | "b" }
  | { type: "error"; code: string; message: string };

type Incoming =
  | { type: "auth"; accessToken: string }
  | { type: "move"; gameId: string; uci: string }
  | { type: "resign"; gameId: string }
  | { type: "draw_offer"; gameId: string }
  | { type: "draw_response"; gameId: string; accept: boolean }
  | { type: "chat"; gameId: string; body: string };

export class RealtimeHub {
  private sockets = new Map<string, Set<WebSocket>>();
  private drawOffers = new Map<string, "w" | "b">();

  constructor(private config: Config) {}

  attach(socket: WebSocket) {
    let userId: string | null = null;
    const send = (msg: Outgoing) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
    };

    socket.on("message", async (raw) => {
      try {
        const data = JSON.parse(String(raw)) as Incoming;
        if (data.type === "auth") {
          const payload = await verifyAccessToken(this.config, data.accessToken);
          userId = payload.sub;
          this.add(userId, socket);
          send({ type: "auth_ok" });
          return;
        }
        if (!userId) {
          send({ type: "error", code: "UNAUTHORIZED", message: "Authenticate first" });
          return;
        }
        if (data.type === "move") {
          const played = await playMove(data.gameId, userId, data.uci);
          await this.broadcastGame(data.gameId);
          if (played.status === "completed") {
            await this.emitToGame(data.gameId, {
              type: "game_over",
              gameId: data.gameId,
              result: played.result,
            });
          }
          return;
        }
        if (data.type === "resign") {
          const res = await resignGame(data.gameId, userId);
          await this.broadcastGame(data.gameId);
          await this.emitToGame(data.gameId, {
            type: "game_over",
            gameId: data.gameId,
            result: res.result,
          });
          return;
        }
        if (data.type === "draw_offer") {
          const dto = await toGameDto(data.gameId, userId);
          this.drawOffers.set(data.gameId, dto.you);
          await this.broadcastGame(data.gameId);
          await this.emitToGame(data.gameId, { type: "draw_offer", gameId: data.gameId, from: dto.you });
          return;
        }
        if (data.type === "draw_response") {
          const offer = this.drawOffers.get(data.gameId);
          const dto = await toGameDto(data.gameId, userId);
          if (data.accept && offer && offer !== dto.you) {
            const res = await agreeDraw(data.gameId, userId);
            this.drawOffers.delete(data.gameId);
            await this.broadcastGame(data.gameId);
            await this.emitToGame(data.gameId, {
              type: "game_over",
              gameId: data.gameId,
              result: res.result,
            });
          } else {
            this.drawOffers.delete(data.gameId);
            await this.broadcastGame(data.gameId);
          }
          return;
        }
        if (data.type === "chat") {
          const message = await postChat(data.gameId, userId, data.body);
          await this.emitToGame(data.gameId, { type: "chat", message });
        }
      } catch (err) {
        const code = err instanceof AppError ? err.code : "INTERNAL";
        const message = err instanceof Error ? err.message : "Unexpected error";
        send({ type: "error", code, message });
      }
    });

    socket.on("close", () => {
      if (userId) this.remove(userId, socket);
    });
  }

  add(userId: string, socket: WebSocket) {
    const set = this.sockets.get(userId) ?? new Set();
    set.add(socket);
    this.sockets.set(userId, set);
  }

  remove(userId: string, socket: WebSocket) {
    const set = this.sockets.get(userId);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) this.sockets.delete(userId);
  }

  async emitToUsers(userIds: string[], msg: Outgoing) {
    for (const id of userIds) {
      const set = this.sockets.get(id);
      if (!set) continue;
      for (const sock of set) {
        if (sock.readyState === sock.OPEN) sock.send(JSON.stringify(msg));
      }
    }
  }

  async emitToGame(gameId: string, msg: Outgoing) {
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) return;
    await this.emitToUsers([game.whiteId, game.blackId], msg);
  }

  async broadcastGame(gameId: string) {
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) return;
    for (const userId of [game.whiteId, game.blackId]) {
      const dto = await toGameDto(gameId, userId);
      await this.emitToUsers([userId], { type: "position", gameId, payload: dto });
      await this.emitToUsers([userId], {
        type: "clock",
        gameId,
        whiteClockMs: dto.whiteClockMs,
        blackClockMs: dto.blackClockMs,
      });
    }
  }
}

export function registerWebsocket(app: FastifyInstance, hub: RealtimeHub) {
  app.get("/ws", { websocket: true }, (socket) => {
    hub.attach(socket);
  });
}
