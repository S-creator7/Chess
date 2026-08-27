import Redis from "ioredis";
import type { Config } from "../config";

export function createRedis(config: Config): Redis {
  const redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  redis.on("error", () => {
    /* connection errors are handled at startup */
  });
  return redis;
}
