import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Config } from "../../config";
import { AppError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import {
  createRefreshToken,
  hashPassword,
  persistRefreshToken,
  publicUser,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  verifyAccessToken,
  verifyPassword,
} from "./auth.service";

const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(32),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setRefreshCookie(reply: FastifyReply, config: Config, token: string) {
  reply.setCookie("refreshToken", token, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  });
}

function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie("refreshToken", { path: "/" });
}

function readRefresh(request: FastifyRequest, bodyToken?: string): string | undefined {
  return bodyToken || (request.cookies.refreshToken as string | undefined);
}

export function bearerFrom(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return undefined;
}

export async function requireUser(request: FastifyRequest, config: Config) {
  const token = bearerFrom(request);
  if (!token) throw new AppError("UNAUTHORIZED", "Missing access token", 401);
  const payload = await verifyAccessToken(config, token);
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.email.endsWith("@deleted.invalid")) {
    throw new AppError("UNAUTHORIZED", "User not found", 401);
  }
  return user;
}

export async function registerAuthRoutes(app: FastifyInstance, config: Config) {
  app.post("/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const email = body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError("EMAIL_TAKEN", "Email already registered", 409);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(body.password),
        displayName: body.displayName,
      },
    });
    const accessToken = await signAccessToken(config, { sub: user.id, email: user.email });
    const refreshToken = createRefreshToken();
    await persistRefreshToken(user.id, refreshToken, config.REFRESH_TOKEN_TTL_DAYS);
    setRefreshCookie(reply, config, refreshToken);
    return { user: publicUser(user), accessToken, refreshToken };
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || user.email.endsWith("@deleted.invalid") || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);
    }
    const accessToken = await signAccessToken(config, { sub: user.id, email: user.email });
    const refreshToken = createRefreshToken();
    await persistRefreshToken(user.id, refreshToken, config.REFRESH_TOKEN_TTL_DAYS);
    setRefreshCookie(reply, config, refreshToken);
    return { user: publicUser(user), accessToken, refreshToken };
  });

  app.post("/auth/refresh", async (request, reply) => {
    const body = z.object({ refreshToken: z.string().optional() }).parse(request.body ?? {});
    const presented = readRefresh(request, body.refreshToken);
    if (!presented) throw new AppError("UNAUTHORIZED", "Missing refresh token", 401);
    const rotated = await rotateRefreshToken(config, presented);
    setRefreshCookie(reply, config, rotated.refreshToken);
    return {
      user: publicUser(rotated.user),
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
    };
  });

  app.post("/auth/logout", async (request, reply) => {
    const body = z.object({ refreshToken: z.string().optional() }).parse(request.body ?? {});
    const presented = readRefresh(request, body.refreshToken);
    if (presented) await revokeRefreshToken(presented);
    clearRefreshCookie(reply);
    return { ok: true };
  });

  app.post("/auth/delete-account", async (request, reply) => {
    const user = await requireUser(request, config);
    const body = z.object({ password: z.string().min(1) }).parse(request.body ?? {});
    if (!(await verifyPassword(body.password, user.passwordHash))) {
      throw new AppError("INVALID_CREDENTIALS", "Password is incorrect", 401);
    }
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: `deleted-${user.id}@deleted.invalid`,
        displayName: "Deleted player",
        passwordHash: await hashPassword(createRefreshToken()),
      },
    });
    clearRefreshCookie(reply);
    return { ok: true };
  });

  app.get("/me", async (request) => {
    const user = await requireUser(request, config);
    return { user: publicUser(user) };
  });
}
