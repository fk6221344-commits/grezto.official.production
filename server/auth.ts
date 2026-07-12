import express from "express";
import crypto from "crypto";
import { supabase, admin } from "./clients";
import { safeGet, safeSet } from "./redisClient";

// Local high-availability in-memory cache for fast token verification fallback
const localAuthCache = new Map<string, { user: any; expiresAt: number }>();

// Cache for resolved phone numbers by UID to avoid database/API roundtrips
const resolvedPhoneCache = new Map<string, { phone: string; expiresAt: number }>();

/**
 * Utility to securely resolve the verified phone number of a given Firebase UID
 * from Firebase Admin SDK or Supabase profiles fallback, utilizing high-performance caching.
 */
export async function resolvePhoneNumber(uid: string): Promise<string> {
  if (!uid) return "";

  const now = Date.now();
  const cached = resolvedPhoneCache.get(uid);
  if (cached && cached.expiresAt > now) {
    return cached.phone;
  }

  // 1. Try fetching from Redis distributed cache if available
  const redisKey = `resolved_phone:${uid}`;
  try {
    const cachedRedis = await safeGet(redisKey);
    if (cachedRedis) {
      resolvedPhoneCache.set(uid, { phone: cachedRedis, expiresAt: now + 3600 * 1000 }); // Cache locally for 1 hour
      return cachedRedis;
    }
  } catch (redisErr) {
    console.warn(`[resolvePhoneNumber] Redis lookup error for ${uid}:`, redisErr);
  }

  let phone = "";

  // 2. Try fetching from Firebase Admin User Record
  if (admin && admin.apps.length > 0) {
    try {
      const userRecord = await admin.auth().getUser(uid);
      if (userRecord && userRecord.phoneNumber) {
        phone = userRecord.phoneNumber;
      }
    } catch (firebaseErr: any) {
      console.warn(`[resolvePhoneNumber] Firebase getUser failed for ${uid}:`, firebaseErr.message);
    }
  }

  // 3. Try fetching from Supabase profiles as fallback
  if (!phone && supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', uid)
        .maybeSingle();
      if (!error && data && data.phone) {
        phone = data.phone;
      }
    } catch (supabaseErr: any) {
      console.warn(`[resolvePhoneNumber] Supabase profiles fetch failed for ${uid}:`, supabaseErr.message);
    }
  }

  if (phone) {
    // Cache the result for 1 hour (3600 seconds)
    resolvedPhoneCache.set(uid, { phone, expiresAt: now + 3600 * 1000 });
    safeSet(redisKey, phone, 3600).catch((err) => {
      console.warn(`[resolvePhoneNumber] Redis caching failed for ${uid}:`, err.message);
    });
  }

  return phone;
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.FIREBASE_API_KEY || "grezto_super_secret_fallback_key_2026_rainbow";

/**
 * Generates a securely signed custom fallback token for persistent, high-availability sessions.
 */
export function generateFallbackToken(uid: string, phone: string): string {
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 Days expiration
  const payload = JSON.stringify({ uid, phone, expiresAt });
  const base64Payload = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(base64Payload).update(expiresAt.toString()).digest('hex');
  return `grezto_fallback.${base64Payload}.${signature}`;
}

/**
 * Cryptographically verifies a custom signed fallback token.
 */
export function verifyFallbackToken(token: string): { uid: string; phone_number: string } | null {
  if (!token || !token.startsWith("grezto_fallback.")) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Payload = parts[1];
    const signature = parts[2];
    
    const payloadStr = Buffer.from(base64Payload, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadStr);
    
    if (payload.expiresAt < Date.now()) {
      console.warn("[Fallback Auth] Custom token has expired.");
      return null;
    }
    
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(base64Payload).update(payload.expiresAt.toString()).digest('hex');
    if (signature !== expectedSignature) {
      console.warn("[Fallback Auth] Cryptographic signature verification failed.");
      return null;
    }
    
    return {
      uid: payload.uid,
      phone_number: payload.phone
    };
  } catch (err) {
    console.warn("[Fallback Auth] Error processing token:", err);
    return null;
  }
}

/**
 * Lightweight, non-blocking JWT Authentication Middleware (The Gatekeeper)
 * Verifies the incoming request's Firebase ID token and attaches user details to `req.user`.
 * Utilizes a tiered caching strategy (In-Memory + Redis) for extreme performance.
 */
export async function validateFirebaseToken(req: any, res: express.Response, next: express.NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Authentication failed: Token is missing." });
    }

    const idToken = authHeader.split("Bearer ")[1];
    if (!idToken) {
      return res.status(401).json({ success: false, error: "Authentication failed: Token is empty." });
    }

    // Secure Custom Signed Fallback Token path
    if (idToken.startsWith("grezto_fallback.")) {
      const fallbackUser = verifyFallbackToken(idToken);
      if (fallbackUser) {
        req.user = {
          uid: fallbackUser.uid,
          phone_number: fallbackUser.phone_number,
          email: ""
        };
        return next();
      } else {
        return res.status(401).json({ success: false, error: "Unauthorized: Invalid or Expired Fallback Session Token." });
      }
    }

    // Generate SHA-256 hash of token to use as a secure cache key
    const tokenHash = crypto.createHash("sha256").update(idToken).digest("hex");
    const cacheKey = `auth_token_verify:${tokenHash}`;

    // 1. Tier 1 Cache: In-Memory (Zero latency, perfect for high-frequency requests)
    const now = Date.now();
    const localCached = localAuthCache.get(cacheKey);
    if (localCached && localCached.expiresAt > now) {
      req.user = localCached.user;
      return next();
    } else if (localCached) {
      localAuthCache.delete(cacheKey); // Clean up expired entries
    }

    // 2. Tier 2 Cache: Redis (Distributed fast cache across instances)
    try {
      const cachedStr = await safeGet(cacheKey);
      if (cachedStr) {
        const user = JSON.parse(cachedStr);
        req.user = user;
        // Backfill Tier 1 local cache to avoid subsequent Redis network hops
        localAuthCache.set(cacheKey, { user, expiresAt: now + 300 * 1000 });
        return next();
      }
    } catch (redisErr) {
      console.warn("[AUTH MIDDLEWARE] Redis lookup error, falling back:", redisErr);
    }

    // 3. Real Verification: Firebase Admin SDK
    let decodedToken: any = null;
    if (admin && admin.apps.length > 0) {
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (adminErr: any) {
        console.warn("[AUTH MIDDLEWARE] Firebase Admin SDK verification failed, falling back to REST API:", adminErr.message);
      }
    }

    // 4. Fallback Verification: Google Identity Toolkit REST API (Ensures high-availability if Admin SDK has initialization issues)
    if (!decodedToken) {
      try {
        const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "";
        if (!apiKey) {
          throw new Error("FIREBASE_API_KEY is not defined on the server.");
        }
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
        const verifyRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken })
        });
        const verifyData: any = await verifyRes.json();
        if (verifyData.error) {
          throw new Error(verifyData.error.message);
        }
        const fUser = verifyData.users[0];
        decodedToken = {
          phone_number: fUser.phoneNumber,
          uid: fUser.localId,
          email: fUser.email
        };
      } catch (restErr: any) {
        console.error("[AUTH MIDDLEWARE] Firebase REST Token verification failed entirely:", restErr.message);
        return res.status(401).json({ success: false, error: `Unauthorized: Invalid or Expired Firebase Token.` });
      }
    }

    // Standardize user properties for downstream request contexts
    const user = {
      uid: decodedToken.uid,
      phone_number: decodedToken.phone_number || "",
      email: decodedToken.email || ""
    };

    if (!user.phone_number && user.uid) {
      user.phone_number = await resolvePhoneNumber(user.uid);
    }

    req.user = user;

    // Save to Cache: 5-minute (300s) TTL is highly optimized and prevents token-expiration lag
    const ttlSeconds = 300;
    localAuthCache.set(cacheKey, { user, expiresAt: now + ttlSeconds * 1000 });
    safeSet(cacheKey, JSON.stringify(user), ttlSeconds).catch((err) => {
      console.warn("[AUTH MIDDLEWARE] Background Redis caching failed:", err.message);
    });

    return next();
  } catch (err: any) {
    console.error("[AUTH MIDDLEWARE] Critical middleware error:", err);
    return res.status(500).json({ success: false, error: "Internal server error during authentication check." });
  }
}

/**
 * Utility to verify if a given phone number belongs to a Master Admin.
 */
export function isMasterAdmin(phone: string): boolean {
  const clean = phone.replace(/\D/g, '').slice(-10);
  return clean === '9864975438' || clean === '8638089161';
}

/**
 * Utility to verify if a given phone number is the owner or team member of a shop.
 * Returns true if user is master admin, direct shop owner, or registered team member.
 */
export async function verifyShopOwnershipOrTeam(phone: string, shopId: string): Promise<boolean> {
  if (!supabase) return false;
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  if (!cleanPhone) return false;

  if (isMasterAdmin(cleanPhone)) {
    return true; // Admin has universal access
  }

  // 1. Check direct shop owner
  const { data: shop } = await supabase
    .from('shops')
    .select('ownerPhone')
    .eq('id', shopId)
    .maybeSingle();

  if (shop && shop.ownerPhone) {
    const ownerClean = shop.ownerPhone.replace(/\D/g, '').slice(-10);
    if (ownerClean === cleanPhone) {
      return true;
    }
  }

  // 2. Check shop team member
  const { data: teamMember } = await supabase
    .from('team')
    .select('shopId')
    .eq('phone', cleanPhone)
    .eq('shopId', shopId)
    .maybeSingle();

  if (teamMember) {
    return true;
  }

  return false;
}

/**
 * Utility to verify if a product belongs to a shop owned/managed by this phone number.
 */
export async function verifyProductOwnership(phone: string, productId: string): Promise<boolean> {
  if (!supabase) return false;
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  if (!cleanPhone) return false;

  if (isMasterAdmin(cleanPhone)) {
    return true; // Admin has universal access
  }

  // Get the product's shopId
  const { data: product } = await supabase
    .from('products')
    .select('shopId')
    .eq('id', productId)
    .maybeSingle();

  if (!product || !product.shopId) {
    return false;
  }

  return verifyShopOwnershipOrTeam(cleanPhone, product.shopId);
}
