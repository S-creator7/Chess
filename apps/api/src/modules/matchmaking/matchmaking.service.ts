import type Redis from "ioredis";
import { AppError } from "../../lib/errors";
import { createRatedGame } from "../game/game.service";

export type QueueEntry = {
  userId: string;
  rating: number;
  timeControl: string;
  rated: boolean;
  queuedAt: number;
};

const memoryQueue: QueueEntry[] = [];
const QUEUE_KEY = "matchmaking:queue";

export class MatchmakingService {
  constructor(private redis: Redis | null) {}

  async enqueue(entry: QueueEntry): Promise<{ matched: false } | { matched: true; gameId: string; whiteId: string; blackId: string }> {
    const already = await this.findUser(entry.userId);
    if (already) throw new AppError("ALREADY_QUEUED", "Already in queue", 409);

    const opponent = await this.findOpponent(entry);
    if (opponent) {
      await this.removeUser(opponent.userId);
      const whiteFirst = Math.random() < 0.5;
      const whiteId = whiteFirst ? entry.userId : opponent.userId;
      const blackId = whiteFirst ? opponent.userId : entry.userId;
      const game = await createRatedGame({
        whiteId,
        blackId,
        timeControl: entry.timeControl,
        rated: entry.rated && opponent.rated,
      });
      return { matched: true, gameId: game.id, whiteId, blackId };
    }

    await this.add(entry);
    return { matched: false };
  }

  async dequeue(userId: string) {
    await this.removeUser(userId);
  }

  private async add(entry: QueueEntry) {
    if (this.redis) {
      try {
        await this.redis.hset(QUEUE_KEY, entry.userId, JSON.stringify(entry));
        return;
      } catch {
        /* fall through to memory */
      }
    }
    memoryQueue.push(entry);
  }

  private async findUser(userId: string): Promise<QueueEntry | undefined> {
    if (this.redis) {
      try {
        const raw = await this.redis.hget(QUEUE_KEY, userId);
        if (raw) return JSON.parse(raw) as QueueEntry;
        return undefined;
      } catch {
        /* memory */
      }
    }
    return memoryQueue.find((e) => e.userId === userId);
  }

  private async removeUser(userId: string) {
    if (this.redis) {
      try {
        await this.redis.hdel(QUEUE_KEY, userId);
      } catch {
        /* memory */
      }
    }
    const idx = memoryQueue.findIndex((e) => e.userId === userId);
    if (idx >= 0) memoryQueue.splice(idx, 1);
  }

  private async findOpponent(entry: QueueEntry): Promise<QueueEntry | undefined> {
    const all = await this.list();
    return all.find(
      (other) =>
        other.userId !== entry.userId &&
        other.timeControl === entry.timeControl &&
        other.rated === entry.rated,
    );
  }

  private async list(): Promise<QueueEntry[]> {
    if (this.redis) {
      try {
        const hash = await this.redis.hgetall(QUEUE_KEY);
        return Object.values(hash).map((raw) => JSON.parse(raw) as QueueEntry);
      } catch {
        /* memory */
      }
    }
    return [...memoryQueue];
  }
}
