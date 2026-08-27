import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Config } from "../../config";
import { AppError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";

export type AccessPayload = { sub: string; email: string };

function accessSecret(config: Config) {
  return new TextEncoder().encode(config.JWT_ACCESS_SECRET);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signAccessToken(config: Config, payload: AccessPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${config.ACCESS_TOKEN_TTL_SEC}s`)
    .sign(accessSecret(config));
}

export async function verifyAccessToken(config: Config, token: string): Promise<AccessPayload> {
  try {
    const { payload } = await jwtVerify(token, accessSecret(config));
    if (!payload.sub || typeof payload.email !== "string") {
      throw new AppError("UNAUTHORIZED", "Invalid token", 401);
    }
    return { sub: payload.sub, email: payload.email };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("TOKEN_EXPIRED", "Access token expired or invalid", 401);
  }
}

export function createRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function persistRefreshToken(userId: string, token: string, ttlDays: number) {
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(token),
      expiresAt,
    },
  });
}

export async function rotateRefreshToken(config: Config, presented: string) {
  const tokenHash = hashRefreshToken(presented);
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!row || row.revokedAt || row.expiresAt < new Date()) {
    throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401);
  }
  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });
  const next = createRefreshToken();
  await persistRefreshToken(row.userId, next, config.REFRESH_TOKEN_TTL_DAYS);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: row.userId } });
  const accessToken = await signAccessToken(config, { sub: user.id, email: user.email });
  return { user, accessToken, refreshToken: next };
}

export async function revokeRefreshToken(presented: string) {
  const tokenHash = hashRefreshToken(presented);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function publicUser(user: { id: string; email: string; displayName: string; rating: number }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    rating: user.rating,
  };
}
