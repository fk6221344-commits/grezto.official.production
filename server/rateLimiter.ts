import { Request, Response, NextFunction } from "express";
import redis, { isRedisReady } from "./redisClient";

interface RateLimiterOptions {
  windowMs: number;      // Duration in milliseconds
  max: number;           // Max requests allowed in the window
  message: any;          // Custom JSON response on failure
  prefix: string;        // Prefix for Redis keys
}

// In-memory fallback store structure for high-availability zero-downtime
interface MemoryRecord {
  count: number;
  resetTime: number;
}
const memoryStore = new Map<string, MemoryRecord>();

// Periodic memory store cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (now >= record.resetTime) {
      memoryStore.delete(key);
    }
  }
}, 60000); // Run cleanup every minute

/**
 * Creates an ultra-powerful, high-availability, zero-downtime rate limiter.
 * Seamlessly uses Redis when online, and automatically falls back to an in-memory
 * store if Redis is offline, disconnected, or slow.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, max, message, prefix } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Extract IP address safely supporting proxy setups (e.g. Cloud Run, Railway)
    let clientIp = req.ip || "127.0.0.1";
    const xForwardedFor = req.headers["x-forwarded-for"];
    if (xForwardedFor) {
      const parts = (typeof xForwardedFor === "string" ? xForwardedFor : xForwardedFor[0]).split(",");
      clientIp = parts[0].trim();
    }

    const key = `grezto:ratelimit:${prefix}:${clientIp}`;
    const nowMs = Date.now();

    // 2. Redis-backed Rate Limiter Implementation (Primary Engine)
    if (isRedisReady() && redis) {
      try {
        // Increment the request counter
        const current = await redis.incr(key);
        let ttl = -1;

        if (current === 1) {
          // Set expiry if key is newly created
          await redis.expire(key, Math.ceil(windowMs / 1000));
          ttl = Math.ceil(windowMs / 1000);
        } else {
          // Double check TTL to prevent infinite keys on edge-case failures
          ttl = await redis.ttl(key);
          if (ttl === -1) {
            await redis.expire(key, Math.ceil(windowMs / 1000));
            ttl = Math.ceil(windowMs / 1000);
          }
        }

        // Set standard rate limit headers
        res.setHeader("X-RateLimit-Limit", max);
        res.setHeader("X-RateLimit-Remaining", Math.max(0, max - current));
        res.setHeader("X-RateLimit-Reset", Math.floor(nowMs / 1000) + (ttl > 0 ? ttl : 0));

        if (current > max) {
          console.warn(`[SECURITY - REDIS RATE LIMIT] IP ${clientIp} exceeded limit for "${prefix}" (${current}/${max})`);
          return res.status(429).json(message);
        }

        return next();
      } catch (err: any) {
        console.warn(`[RATE LIMIT FAIL-SAFE] Redis check failed. Falling back to in-memory:`, err.message || err);
        // Fall through to in-memory store
      }
    }

    // 3. Resilient In-Memory Fallback Engine (Zero-Downtime Guarantee)
    try {
      let record = memoryStore.get(key);

      if (!record || nowMs >= record.resetTime) {
        record = {
          count: 0,
          resetTime: nowMs + windowMs,
        };
      }

      record.count += 1;
      memoryStore.set(key, record);

      const remaining = Math.max(0, max - record.count);
      const resetSeconds = Math.ceil((record.resetTime - nowMs) / 1000);

      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", remaining);
      res.setHeader("X-RateLimit-Reset", Math.floor(nowMs / 1000) + resetSeconds);

      if (record.count > max) {
        console.warn(`[SECURITY - MEMORY RATE LIMIT] IP ${clientIp} exceeded limit for "${prefix}" (${record.count}/${max})`);
        return res.status(429).json(message);
      }

      return next();
    } catch (fallbackErr: any) {
      console.error(`[RATE LIMIT SYSTEM ERROR] Emergency fallback crash bypassed. Allowing request:`, fallbackErr);
      return next(); // Emergency bypass: System should NEVER crash or block genuine customers on rate-limiter bugs
    }
  };
}
