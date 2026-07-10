import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

// Use the Redis URL from the environment variables, or a fallback memory mock if missing
const rawRedisUrl = process.env.REDIS_URL || '';

// Clean up any double or single quotes that often get injected from env parsing
let redisUrl = rawRedisUrl.trim();
if (redisUrl.startsWith('"') && redisUrl.endsWith('"')) {
  redisUrl = redisUrl.slice(1, -1);
}
if (redisUrl.startsWith("'") && redisUrl.endsWith("'")) {
  redisUrl = redisUrl.slice(1, -1);
}

let redis: Redis | null = null;

if (redisUrl) {
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false, // Prevents hanging requests by failing fast if disconnected
      retryStrategy(times) {
        console.warn(`[REDIS] Retrying connection (attempt: ${times})...`);
        // Reconnect after (times * 2) seconds, up to a maximum of 30 seconds
        return Math.min(times * 2000, 30000);
      },
    });

    redis.on('connect', () => {
      console.log('[REDIS] Connected to Redis successfully');
    });

    redis.on('error', (err) => {
      console.error('[REDIS ERROR] Connection failed:', err.message);
    });
  } catch (error) {
    console.error('[REDIS CACHE] Failed to initialize Redis Client:', error);
  }
} else {
  console.warn('[REDIS WARNING] No REDIS_URL found in environment variables. Caching will be disabled.');
}

// Redis Client is prepared for fine-grained cache key operations in future phases.

export function isRedisReady(): boolean {
  return redis !== null && redis.status === 'ready';
}

export async function safeGet(key: string): Promise<string | null> {
  if (!isRedisReady()) return null;
  try {
    return await redis!.get(key);
  } catch (err: any) {
    console.error(`[REDIS ERROR] safeGet failed for key "${key}":`, err.message || err);
    return null;
  }
}

export async function safeSet(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  if (!isRedisReady()) return false;
  try {
    if (ttlSeconds) {
      await redis!.set(key, value, 'EX', ttlSeconds);
    } else {
      await redis!.set(key, value);
    }
    return true;
  } catch (err: any) {
    console.error(`[REDIS ERROR] safeSet failed for key "${key}":`, err.message || err);
    return false;
  }
}

export async function safeDel(key: string): Promise<boolean> {
  if (!isRedisReady()) return false;
  try {
    await redis!.del(key);
    return true;
  } catch (err: any) {
    console.error(`[REDIS ERROR] safeDel failed for key "${key}":`, err.message || err);
    return false;
  }
}

/**
 * High-Availability Fail-Safe Wrapper for Redis caching.
 * If Redis is offline, rate-limited, or fails, it falls back seamlessly to the database fetcher.
 * It automatically handles JSON parsing and background asynchronous writing to cache.
 */
export async function safeGetOrSet<T>(
  key: string,
  fallbackFetcher: () => Promise<T>,
  ttlSeconds: number = 3600
): Promise<T> {
  try {
    const cached = await safeGet(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (err: any) {
    console.warn(`[REDIS FAIL-SAFE ACTIVE] Reading cache key "${key}" failed, falling back to database:`, err.message || err);
  }

  // Fetch from database/source
  const freshData = await fallbackFetcher();

  // Asynchronous background cache update (non-blocking)
  if (freshData !== null && freshData !== undefined) {
    // ANTI-EMPTY SAFEGUARD: Do not cache empty arrays or empty objects for a long time (e.g. during server startup, DB lag or glitch)
    let actualTtl = ttlSeconds;
    const isEmptyArray = Array.isArray(freshData) && freshData.length === 0;
    const isEmptyObject = typeof freshData === 'object' && freshData !== null && Object.keys(freshData).length === 0;
    
    if (isEmptyArray || isEmptyObject) {
      console.warn(`[REDIS SAFEGUARD] freshData for key "${key}" is empty. Caching with 5 seconds TTL instead of ${ttlSeconds}s.`);
      actualTtl = 5; // Cache for only 5 seconds to self-correct instantly
    }

    safeSet(key, JSON.stringify(freshData), actualTtl).catch((err: any) => {
      console.warn(`[REDIS FAIL-SAFE ACTIVE] Asynchronous background cache write failed for key "${key}":`, err.message || err);
    });
  }

  return freshData;
}

export default redis;
