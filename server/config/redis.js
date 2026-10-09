import crypto from 'crypto';
import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { RedisStore } from 'rate-limit-redis';

let redisClient = null;
let isClosing = false;

/**
 * Allows injecting a custom or mock Redis client (useful in tests)
 */
export const setRedisClient = (client) => {
  redisClient = client;
  isClosing = false;
};

/**
 * Creates or retrieves the shared singleton Redis client
 */
export const getRedisClient = () => {
  if (redisClient) return redisClient;
  if (isClosing) return null;

  // Use ioredis-mock when explicitly requested in test suites
  if (process.env.NODE_ENV === 'test' && process.env.USE_REDIS_MOCK === 'true') {
    redisClient = new RedisMock();
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  try {
    const isTls = redisUrl.startsWith('rediss://') || process.env.REDIS_TLS === 'true';
    redisClient = new Redis(redisUrl, {
      tls: isTls ? { rejectUnauthorized: false } : undefined,
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 5000,
      commandTimeout: Number(process.env.REDIS_COMMAND_TIMEOUT_MS) || 3000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false, // Fail fast when disconnected
      retryStrategy: (times) => {
        if (times > 10) {
          console.warn('[Redis] Connection retry threshold reached, backing off to 5s');
          return 5000;
        }
        return Math.min(times * 200, 3000);
      },
      lazyConnect: false,
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connected to Redis instance');
    });

    redisClient.on('ready', () => {
      console.log('[Redis] Ready to accept commands');
    });

    redisClient.on('error', (err) => {
      console.error('[Redis Client Error]:', err.message);
    });

    redisClient.on('close', () => {
      if (!isClosing) console.warn('[Redis] Connection closed');
    });

    return redisClient;
  } catch (error) {
    console.error('[Redis Init Failed]:', error.message);
    return null;
  }
};

/**
 * Cleanly closes the Redis connection during graceful shutdown
 */
export const closeRedis = async () => {
  isClosing = true;
  if (redisClient) {
    try {
      if (typeof redisClient.quit === 'function') {
        await redisClient.quit();
      } else if (typeof redisClient.disconnect === 'function') {
        redisClient.disconnect();
      }
    } catch (err) {
      console.warn('[Redis] Error during quit, disconnecting forcefully:', err.message);
      if (typeof redisClient.disconnect === 'function') redisClient.disconnect();
    } finally {
      redisClient = null;
    }
  }
};

/**
 * Custom sendCommand wrapper supporting both real ioredis and mock instances
 */
export const createRedisSendCommand = (client) => {
  if (!client) return null;
  const scriptCache = new Map();

  return async (...command) => {
    const [cmd, ...args] = command;
    const upper = String(cmd).toUpperCase();

    if (upper === 'SCRIPT') {
      const sub = args[0]?.toUpperCase();
      if (sub === 'LOAD') {
        const lua = args[1];
        const sha = crypto.createHash('sha1').update(lua).digest('hex');
        scriptCache.set(sha, lua);
        if (typeof client.call === 'function') {
          try {
            return await client.call(...command);
          } catch {
            return sha;
          }
        }
        return sha;
      }
    }

    if (upper === 'EVALSHA') {
      const [sha, numKeys, ...rest] = args;
      const lua = scriptCache.get(sha);
      if (typeof client.call === 'function') {
        try {
          return await client.call(...command);
        } catch (err) {
          if (lua && typeof client.eval === 'function') {
            return await client.eval(lua, numKeys, ...rest);
          }
          throw err;
        }
      }
      if (lua && typeof client.eval === 'function') {
        return await client.eval(lua, numKeys, ...rest);
      }
    }

    if (typeof client.call === 'function') {
      return client.call(...command);
    }

    if (typeof client[cmd.toLowerCase()] === 'function') {
      return client[cmd.toLowerCase()](...args);
    }

    throw new Error(`Unsupported Redis command: ${cmd}`);
  };
};

/**
 * Builds a rate-limit-redis store with the requested prefix.
 * Falls back to undefined (in-memory store) when Redis is not configured.
 */
export const createRateLimitStore = (prefix) => {
  const client = getRedisClient();
  if (!client) {
    return undefined; // In-memory MemoryStore fallback
  }

  try {
    const sendCommand = createRedisSendCommand(client);
    return new RedisStore({
      sendCommand,
      prefix,
      resetExpiryOnChange: false,
    });
  } catch (err) {
    console.error(`[RateLimit] Failed to initialize RedisStore for prefix "${prefix}":`, err.message);
    return undefined;
  }
};
