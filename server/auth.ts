import express from "express";
import crypto from "crypto";
import { supabase, admin } from "./clients";
import { safeGet, safeSet } from "./redisClient";

// Local high-availability in-memory cache for fast token verification fallback
const localAuthCache = new Map<string, { user: any; expiresAt: number }>();

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
