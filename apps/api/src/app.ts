import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { ZodError } from "zod";
import type { Config } from "./config";
import { AppError, errorBody } from "./lib/errors";
import { createRedis } from "./lib/redis";
import { registerAuthRoutes } from "./modules/auth/auth.routes";
import { registerGameRoutes } from "./modules/game/game.routes";
import { MatchmakingService } from "./modules/matchmaking/matchmaking.service";
import { RealtimeHub, registerWebsocket } from "./modules/realtime/realtime.hub";

export async function buildApp(config: Config) {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.NODE_ENV === "production" ? config.WEB_ORIGIN : true,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(websocket);
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  });

  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send(errorBody("VALIDATION", err.issues[0]?.message ?? "Invalid input"));
    }
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send(errorBody(err.code, err.message));
    }
    app.log.error(err);
    return reply.status(500).send(errorBody("INTERNAL", "Internal server error"));
  });

  app.get("/health", async () => ({ ok: true }));

  await registerAuthRoutes(app, config);

  const redisClient = createRedis(config);
  let redis: typeof redisClient | null = null;
  try {
    await Promise.race([
      redisClient.connect(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Redis connect timeout")), 1500);
      }),
    ]);
    redis = redisClient;
  } catch (err) {
    app.log.warn({ err }, "Redis unavailable; matchmaking will use in-memory queue");
    try {
      redisClient.disconnect();
    } catch {
      /* ignore */
    }
  }
  const matchmaking = new MatchmakingService(redis);
  const hub = new RealtimeHub(config);
  await registerGameRoutes(app, config, matchmaking, hub);
  registerWebsocket(app, hub);

  app.addHook("onClose", async () => {
    if (redis) redis.disconnect();
  });

  return app;
}
