import RedisPackage, { RedisOptions } from 'ioredis';
import { config } from './env.js';

// Resolve Redis constructor across ESM/CJS boundaries
const RedisClient = (RedisPackage as any).default || RedisPackage;

export const redisConnectionOptions: RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

// Singleton Redis instance for caching, rate limiting, and Lua scripts
export const redis = new RedisClient(redisConnectionOptions);

redis.on('connect', () => {
  console.log(`[Redis] Connected to ${config.redis.host}:${config.redis.port}`);
});

redis.on('error', (err: Error) => {
  console.error('[Redis] Connection error:', err.message);
});
