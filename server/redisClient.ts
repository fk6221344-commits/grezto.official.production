import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

// 1. Dual-Tier caching: L1 In-Memory cache storage to shield the database if Redis is offline
interface CacheEntry {
  value: string;
  expiresAt: number;
}
const l1Cache = new Map<string, CacheEntry>();

// Clean up expired L1 cache items periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of l1Cache.entries()) {
    if (now > entry.expiresAt) {
      l1Cache.delete(key);
    }
  }
}, 60000).unref(); // .unref() ensures this interval doesn't block process exit

// 2. Multi-variable auto-detection for Railway internal/external Redis configurations
const rawRedisUrl = 
  process.env.REDISPRIVATE_URL || 
  process.env.REDIS_PRIVATE_URL || 
  process.env.REDIS_URL || 
  process.env.REDISURL || 
  '';

// Clean up quotes from environment variables
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
    console.log(`[REDIS] Initializing client... Connection URL detected: ${redisUrl.split('@')[1] || 'hidden'}`);
    redis = new Redis(redisUrl, {
      connectTimeout: 1500,        // 1.5s connection timeout (kills the 10-second hanging issue!)
      commandTimeout: 1000,        // 1.0s command timeout (fails fast if query blocks)
      maxRetriesPerRequest: 0,     // Command fails instantly if offline, bypassing queue lag
      enableOfflineQueue: false,   // Disable queueing while connection is down
      retryStrategy(times) {
        if (times > 5) {
          console.error(`[REDIS ERROR] Max reconnection attempts (5) exceeded. Suspending active retries.`);
          return null; // Stop retrying to protect container resources
        }
        console.warn(`[REDIS] Retrying connection (attempt: ${times})...`);
        return Math.min(times * 1000, 3000); // Backoff rapidly
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
  console.warn('[REDIS WARNING] No REDISPRIVATE_URL or REDIS_URL found in environment variables. L2 Redis caching will be disabled.');
}

export function isRedisReady(): boolean {
  return redis !== null && redis.status === 'ready';
}

export async function safeGet(key: string): Promise<string | null> {
  // Check L1 (In-Memory) Cache first - 0ms lookup!
  const l1Entry = l1Cache.get(key);
  if (l1Entry) {
    if (Date.now() < l1Entry.expiresAt) {
      console.log(`[CACHE HIT - L1 MEMORY] Instant delivery for key: ${key}`);
      return l1Entry.value;
    } else {
      l1Cache.delete(key); // Evict expired L1 key
    }
  }

  // Check L2 (Redis) Cache
  if (!isRedisReady()) return null;
  try {
    const val = await redis!.get(key);
    if (val) {
      // Rehydrate L1 cache with value fetched from L2
      l1Cache.set(key, {
        value: val,
        expiresAt: Date.now() + 60000 // Cache locally for 1 minute to reduce Redis roundtrips
      });
      console.log(`[CACHE HIT - L2 REDIS] Retreived and populated L1 for key: ${key}`);
    }
    return val;
  } catch (err: any) {
    console.error(`[REDIS ERROR] safeGet failed for key "${key}":`, err.message || err);
    return null;
  }
}

export async function safeSet(key: string, value: string, ttlSeconds: number = 3600): Promise<boolean> {
  // Write to L1 (In-Memory) Cache
  l1Cache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000
  });

  // Write to L2 (Redis) Cache in background
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
  // Delete from L1 Cache
  l1Cache.delete(key);

  // Delete from L2 Cache
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
