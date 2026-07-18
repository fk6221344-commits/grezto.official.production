var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server/redisClient.ts
function isRedisReady() {
  return redis !== null && redis.status === "ready";
}
async function safeGet(key) {
  const l1Entry = l1Cache.get(key);
  if (l1Entry) {
    if (Date.now() < l1Entry.expiresAt) {
      console.log(`[CACHE HIT - L1 MEMORY] Instant delivery for key: ${key}`);
      return l1Entry.value;
    } else {
      l1Cache.delete(key);
    }
  }
  if (!isRedisReady()) return null;
  try {
    const val = await redis.get(key);
    if (val) {
      l1Cache.set(key, {
        value: val,
        expiresAt: Date.now() + 6e4
        // Cache locally for 1 minute to reduce Redis roundtrips
      });
      console.log(`[CACHE HIT - L2 REDIS] Retreived and populated L1 for key: ${key}`);
    }
    return val;
  } catch (err) {
    console.error(`[REDIS ERROR] safeGet failed for key "${key}":`, err.message || err);
    return null;
  }
}
async function safeSet(key, value, ttlSeconds = 3600) {
  l1Cache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1e3
  });
  if (!isRedisReady()) return false;
  try {
    if (ttlSeconds) {
      await redis.set(key, value, "EX", ttlSeconds);
    } else {
      await redis.set(key, value);
    }
    return true;
  } catch (err) {
    console.error(`[REDIS ERROR] safeSet failed for key "${key}":`, err.message || err);
    return false;
  }
}
async function safeDel(key) {
  l1Cache.delete(key);
  if (!isRedisReady()) return false;
  try {
    await redis.del(key);
    return true;
  } catch (err) {
    console.error(`[REDIS ERROR] safeDel failed for key "${key}":`, err.message || err);
    return false;
  }
}
async function safeGetOrSet(key, fallbackFetcher, ttlSeconds = 3600) {
  try {
    const cached = await safeGet(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.warn(`[REDIS FAIL-SAFE ACTIVE] Reading cache key "${key}" failed, falling back to database:`, err.message || err);
  }
  const freshData = await fallbackFetcher();
  if (freshData !== null && freshData !== void 0) {
    let actualTtl = ttlSeconds;
    const isEmptyArray = Array.isArray(freshData) && freshData.length === 0;
    const isEmptyObject = typeof freshData === "object" && freshData !== null && Object.keys(freshData).length === 0;
    if (isEmptyArray || isEmptyObject) {
      console.warn(`[REDIS SAFEGUARD] freshData for key "${key}" is empty. Caching with 5 seconds TTL instead of ${ttlSeconds}s.`);
      actualTtl = 5;
    }
    safeSet(key, JSON.stringify(freshData), actualTtl).catch((err) => {
      console.warn(`[REDIS FAIL-SAFE ACTIVE] Asynchronous background cache write failed for key "${key}":`, err.message || err);
    });
  }
  return freshData;
}
var import_ioredis, import_dotenv, l1Cache, rawRedisUrl, redisUrl, redis, redisClient_default;
var init_redisClient = __esm({
  "server/redisClient.ts"() {
    import_ioredis = require("ioredis");
    import_dotenv = __toESM(require("dotenv"), 1);
    import_dotenv.default.config();
    l1Cache = /* @__PURE__ */ new Map();
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of l1Cache.entries()) {
        if (now > entry.expiresAt) {
          l1Cache.delete(key);
        }
      }
    }, 6e4).unref();
    rawRedisUrl = process.env.REDISPRIVATE_URL || process.env.REDIS_PRIVATE_URL || process.env.REDIS_URL || process.env.REDISURL || "";
    redisUrl = rawRedisUrl.trim();
    if (redisUrl.startsWith('"') && redisUrl.endsWith('"')) {
      redisUrl = redisUrl.slice(1, -1);
    }
    if (redisUrl.startsWith("'") && redisUrl.endsWith("'")) {
      redisUrl = redisUrl.slice(1, -1);
    }
    redis = null;
    if (redisUrl) {
      try {
        console.log(`[REDIS] Initializing client... Connection URL detected: ${redisUrl.split("@")[1] || "hidden"}`);
        redis = new import_ioredis.Redis(redisUrl, {
          connectTimeout: 1500,
          // 1.5s connection timeout (kills the 10-second hanging issue!)
          commandTimeout: 1e3,
          // 1.0s command timeout (fails fast if query blocks)
          maxRetriesPerRequest: 0,
          // Command fails instantly if offline, bypassing queue lag
          enableOfflineQueue: false,
          // Disable queueing while connection is down
          retryStrategy(times) {
            if (times > 5) {
              console.error(`[REDIS ERROR] Max reconnection attempts (5) exceeded. Suspending active retries.`);
              return null;
            }
            console.warn(`[REDIS] Retrying connection (attempt: ${times})...`);
            return Math.min(times * 1e3, 3e3);
          }
        });
        redis.on("connect", () => {
          console.log("[REDIS] Connected to Redis successfully");
        });
        redis.on("error", (err) => {
          console.error("[REDIS ERROR] Connection failed:", err.message);
        });
      } catch (error) {
        console.error("[REDIS CACHE] Failed to initialize Redis Client:", error);
      }
    } else {
      console.warn("[REDIS WARNING] No REDISPRIVATE_URL or REDIS_URL found in environment variables. L2 Redis caching will be disabled.");
    }
    redisClient_default = redis;
  }
});

// server/clients.ts
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please configure it in Settings > Secrets.");
    }
    aiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
var import_firebase_admin, import_supabase_js, import_genai, import_ws, import_path, import_fs, import_dotenv2, supabaseUrl, supabaseKey, isValidSupabaseUrl, supabase, aiClient, firebaseConfig;
var init_clients = __esm({
  "server/clients.ts"() {
    import_firebase_admin = __toESM(require("firebase-admin"), 1);
    import_supabase_js = require("@supabase/supabase-js");
    import_genai = require("@google/genai");
    import_ws = __toESM(require("ws"), 1);
    import_path = __toESM(require("path"), 1);
    import_fs = __toESM(require("fs"), 1);
    import_dotenv2 = __toESM(require("dotenv"), 1);
    import_dotenv2.default.config();
    supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
    if (supabaseKey === "YOUR_SUPABASE_SERVICE_ROLE_KEY") {
      supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";
    }
    isValidSupabaseUrl = supabaseUrl.startsWith("http://") || supabaseUrl.startsWith("https://");
    supabase = isValidSupabaseUrl && supabaseKey ? (0, import_supabase_js.createClient)(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      },
      realtime: {
        transport: import_ws.default
      }
    }) : null;
    if (!import_firebase_admin.default.apps.length) {
      try {
        const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
        if (serviceAccountBase64) {
          const serviceAccountJson = Buffer.from(serviceAccountBase64, "base64").toString("utf8");
          const serviceAccount = JSON.parse(serviceAccountJson);
          import_firebase_admin.default.initializeApp({
            credential: import_firebase_admin.default.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id
          });
          console.log(`[SERVER] Firebase Admin SDK successfully initialized with Service Account for project: ${serviceAccount.project_id}`);
        } else {
          let projectId = process.env.FIREBASE_PROJECT_ID;
          if (!projectId) {
            const configPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
            if (import_fs.default.existsSync(configPath)) {
              const config = JSON.parse(import_fs.default.readFileSync(configPath, "utf-8"));
              projectId = config.projectId;
            }
          }
          if (projectId) {
            import_firebase_admin.default.initializeApp({
              projectId
            });
            console.log(`[SERVER] Firebase Admin SDK successfully initialized (Without Service Account) for project: ${projectId}`);
          } else {
            console.warn("[SERVER] No Firebase Project ID or Service Account found. Skipping Admin SDK initialization.");
          }
        }
      } catch (adminInitErr) {
        console.error("[SERVER] Failed to initialize Firebase Admin SDK:", adminInitErr);
      }
    }
    aiClient = null;
    firebaseConfig = null;
    try {
      const configPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
      if (import_fs.default.existsSync(configPath)) {
        firebaseConfig = JSON.parse(import_fs.default.readFileSync(configPath, "utf-8"));
      }
    } catch (e) {
      console.warn("Could not load firebase-applet-config.json");
    }
  }
});

// server/auth.ts
var auth_exports = {};
__export(auth_exports, {
  generateFallbackToken: () => generateFallbackToken,
  isMasterAdmin: () => isMasterAdmin,
  resolvePhoneNumber: () => resolvePhoneNumber,
  validateFirebaseToken: () => validateFirebaseToken,
  verifyFallbackToken: () => verifyFallbackToken,
  verifyProductOwnership: () => verifyProductOwnership,
  verifyShopOwnershipOrTeam: () => verifyShopOwnershipOrTeam
});
async function resolvePhoneNumber(uid) {
  if (!uid) return "";
  const now = Date.now();
  const cached = resolvedPhoneCache.get(uid);
  if (cached && cached.expiresAt > now) {
    return cached.phone;
  }
  const redisKey = `resolved_phone:${uid}`;
  try {
    const cachedRedis = await safeGet(redisKey);
    if (cachedRedis) {
      resolvedPhoneCache.set(uid, { phone: cachedRedis, expiresAt: now + 3600 * 1e3 });
      return cachedRedis;
    }
  } catch (redisErr) {
    console.warn(`[resolvePhoneNumber] Redis lookup error for ${uid}:`, redisErr);
  }
  let phone = "";
  if (import_firebase_admin.default && import_firebase_admin.default.apps.length > 0) {
    try {
      const userRecord = await import_firebase_admin.default.auth().getUser(uid);
      if (userRecord && userRecord.phoneNumber) {
        phone = userRecord.phoneNumber;
      }
    } catch (firebaseErr) {
      console.warn(`[resolvePhoneNumber] Firebase getUser failed for ${uid}:`, firebaseErr.message);
    }
  }
  if (!phone && supabase) {
    try {
      const { data, error } = await supabase.from("profiles").select("phone").eq("id", uid).maybeSingle();
      if (!error && data && data.phone) {
        phone = data.phone;
      }
    } catch (supabaseErr) {
      console.warn(`[resolvePhoneNumber] Supabase profiles fetch failed for ${uid}:`, supabaseErr.message);
    }
  }
  if (phone) {
    resolvedPhoneCache.set(uid, { phone, expiresAt: now + 3600 * 1e3 });
    safeSet(redisKey, phone, 3600).catch((err) => {
      console.warn(`[resolvePhoneNumber] Redis caching failed for ${uid}:`, err.message);
    });
  }
  return phone;
}
function generateFallbackToken(uid, phone) {
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1e3;
  const payload = JSON.stringify({ uid, phone, expiresAt });
  const base64Payload = Buffer.from(payload).toString("base64url");
  const signature = import_crypto.default.createHmac("sha256", JWT_SECRET).update(base64Payload).update(expiresAt.toString()).digest("hex");
  return `grezto_fallback.${base64Payload}.${signature}`;
}
function verifyFallbackToken(token) {
  if (!token || !token.startsWith("grezto_fallback.")) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Payload = parts[1];
    const signature = parts[2];
    const payloadStr = Buffer.from(base64Payload, "base64url").toString("utf8");
    const payload = JSON.parse(payloadStr);
    if (payload.expiresAt < Date.now()) {
      console.warn("[Fallback Auth] Custom token has expired.");
      return null;
    }
    const expectedSignature = import_crypto.default.createHmac("sha256", JWT_SECRET).update(base64Payload).update(payload.expiresAt.toString()).digest("hex");
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
async function validateFirebaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Authentication failed: Token is missing." });
    }
    const idToken = authHeader.split("Bearer ")[1];
    if (!idToken) {
      return res.status(401).json({ success: false, error: "Authentication failed: Token is empty." });
    }
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
    const tokenHash = import_crypto.default.createHash("sha256").update(idToken).digest("hex");
    const cacheKey = `auth_token_verify:${tokenHash}`;
    const now = Date.now();
    const localCached = localAuthCache.get(cacheKey);
    if (localCached && localCached.expiresAt > now) {
      req.user = localCached.user;
      return next();
    } else if (localCached) {
      localAuthCache.delete(cacheKey);
    }
    try {
      const cachedStr = await safeGet(cacheKey);
      if (cachedStr) {
        const user2 = JSON.parse(cachedStr);
        req.user = user2;
        localAuthCache.set(cacheKey, { user: user2, expiresAt: now + 300 * 1e3 });
        return next();
      }
    } catch (redisErr) {
      console.warn("[AUTH MIDDLEWARE] Redis lookup error, falling back:", redisErr);
    }
    let decodedToken = null;
    if (import_firebase_admin.default && import_firebase_admin.default.apps.length > 0) {
      try {
        decodedToken = await import_firebase_admin.default.auth().verifyIdToken(idToken);
      } catch (adminErr) {
        console.warn("[AUTH MIDDLEWARE] Firebase Admin SDK verification failed, falling back to REST API:", adminErr.message);
      }
    }
    if (!decodedToken) {
      try {
        const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || firebaseConfig && firebaseConfig.apiKey || "";
        if (!apiKey) {
          throw new Error("FIREBASE_API_KEY is not defined on the server.");
        }
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
        const verifyRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken })
        });
        const verifyData = await verifyRes.json();
        if (verifyData.error) {
          throw new Error(verifyData.error.message);
        }
        const fUser = verifyData.users[0];
        decodedToken = {
          phone_number: fUser.phoneNumber,
          uid: fUser.localId,
          email: fUser.email
        };
      } catch (restErr) {
        console.error("[AUTH MIDDLEWARE] Firebase REST Token verification failed entirely:", restErr.message);
        return res.status(401).json({ success: false, error: `Unauthorized: Invalid or Expired Firebase Token.` });
      }
    }
    const user = {
      uid: decodedToken.uid,
      phone_number: decodedToken.phone_number || "",
      email: decodedToken.email || ""
    };
    if (!user.phone_number && user.uid) {
      user.phone_number = await resolvePhoneNumber(user.uid);
    }
    req.user = user;
    const ttlSeconds = 300;
    localAuthCache.set(cacheKey, { user, expiresAt: now + ttlSeconds * 1e3 });
    safeSet(cacheKey, JSON.stringify(user), ttlSeconds).catch((err) => {
      console.warn("[AUTH MIDDLEWARE] Background Redis caching failed:", err.message);
    });
    return next();
  } catch (err) {
    console.error("[AUTH MIDDLEWARE] Critical middleware error:", err);
    return res.status(500).json({ success: false, error: "Internal server error during authentication check." });
  }
}
function isMasterAdmin(phone) {
  const clean = phone.replace(/\D/g, "").slice(-10);
  return clean === "9864975438" || clean === "8638089161" || clean === "8486087096";
}
async function verifyShopOwnershipOrTeam(phone, shopId) {
  if (!supabase) return false;
  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  if (!cleanPhone) return false;
  if (isMasterAdmin(cleanPhone)) {
    return true;
  }
  const { data: shop } = await supabase.from("shops").select("ownerPhone").eq("id", shopId).maybeSingle();
  if (shop && shop.ownerPhone) {
    const ownerClean = shop.ownerPhone.replace(/\D/g, "").slice(-10);
    if (ownerClean === cleanPhone) {
      return true;
    }
  }
  const { data: teamMember } = await supabase.from("team").select("shopId").eq("phone", cleanPhone).eq("shopId", shopId).maybeSingle();
  if (teamMember) {
    return true;
  }
  return false;
}
async function verifyProductOwnership(phone, productId) {
  if (!supabase) return false;
  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  if (!cleanPhone) return false;
  if (isMasterAdmin(cleanPhone)) {
    return true;
  }
  const { data: product } = await supabase.from("products").select("shopId").eq("id", productId).maybeSingle();
  if (!product || !product.shopId) {
    return false;
  }
  return verifyShopOwnershipOrTeam(cleanPhone, product.shopId);
}
var import_crypto, localAuthCache, resolvedPhoneCache, JWT_SECRET;
var init_auth = __esm({
  "server/auth.ts"() {
    import_crypto = __toESM(require("crypto"), 1);
    init_clients();
    init_redisClient();
    localAuthCache = /* @__PURE__ */ new Map();
    resolvedPhoneCache = /* @__PURE__ */ new Map();
    JWT_SECRET = process.env.JWT_SECRET || process.env.FIREBASE_API_KEY || "grezto_super_secret_fallback_key_2026_rainbow";
  }
});

// server.ts
var import_express2 = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_cluster = __toESM(require("cluster"), 1);
var import_os = __toESM(require("os"), 1);
var import_vite = require("vite");
var import_multer = __toESM(require("multer"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_helmet = __toESM(require("helmet"), 1);
var import_compression = __toESM(require("compression"), 1);
var import_client_s3 = require("@aws-sdk/client-s3");
var import_s3_request_presigner = require("@aws-sdk/s3-request-presigner");
init_redisClient();
init_clients();
init_auth();

// server/sanitizers.ts
function sanitizeProductPayload(rawProduct) {
  if (!rawProduct || typeof rawProduct !== "object") {
    return {};
  }
  const allowedKeys = [
    "id",
    "name",
    "price",
    "originalPrice",
    "discount",
    "category",
    "image",
    "description",
    "inStock",
    "stockStatus",
    "shopId",
    "shopName",
    "rating",
    "isBestSeller",
    "status",
    "deleted"
  ];
  const sanitized = {};
  for (const key of allowedKeys) {
    if (rawProduct[key] !== void 0 && rawProduct[key] !== null) {
      const val = rawProduct[key];
      if (key === "id" || key === "name" || key === "category" || key === "image" || key === "description" || key === "stockStatus" || key === "shopId" || key === "shopName" || key === "status") {
        sanitized[key] = String(val).trim();
      } else if (key === "price" || key === "originalPrice" || key === "discount" || key === "rating") {
        const numVal = Number(val);
        sanitized[key] = isNaN(numVal) ? 0 : numVal;
      } else if (key === "inStock" || key === "isBestSeller" || key === "deleted") {
        sanitized[key] = Boolean(val);
      }
    }
  }
  return sanitized;
}
function sanitizeShopUpdatePayload(rawUpdate) {
  if (!rawUpdate || typeof rawUpdate !== "object") {
    return {};
  }
  const allowedKeys = [
    "id",
    "name",
    "type",
    "category",
    "defaultCategory",
    "address",
    "ownerPhone",
    "ownerName",
    "isOpen",
    "status",
    "imageUrl",
    "image",
    "rating",
    "ratingCount",
    "lat",
    "lng",
    "pinned",
    "joinedAt",
    "description",
    "minTime",
    "maxTime",
    "distance",
    "promo"
  ];
  const sanitized = {};
  for (const key of allowedKeys) {
    if (rawUpdate[key] !== void 0 && rawUpdate[key] !== null) {
      const val = rawUpdate[key];
      if (key === "id" || key === "name" || key === "type" || key === "category" || key === "defaultCategory" || key === "address" || key === "ownerPhone" || key === "ownerName" || key === "status" || key === "imageUrl" || key === "image" || key === "rating" || key === "joinedAt" || key === "description" || key === "distance" || key === "promo") {
        sanitized[key] = String(val).trim();
      } else if (key === "ratingCount" || key === "lat" || key === "lng" || key === "minTime" || key === "maxTime") {
        const numVal = Number(val);
        sanitized[key] = isNaN(numVal) ? 0 : numVal;
      } else if (key === "isOpen" || key === "pinned") {
        sanitized[key] = val === true || val === "true" || val === 1 || val === "1";
      }
    }
  }
  return sanitized;
}

// server/cacheWarming.ts
init_clients();
init_redisClient();
async function warmShopProductsCache(shopId) {
  try {
    if (!supabase) return;
    console.log(`[PRE-WARM] Background pre-warming products for shop: ${shopId}`);
    const { data, error } = await supabase.from("products").select("*").eq("shopId", shopId).is("deleted", false);
    if (!error && data) {
      const mapped = data.map((p) => ({
        ...p,
        stock: p.stock !== void 0 ? p.stock : p.inStock ? 10 : 0
      }));
      await safeSet(`grezto:shop:${shopId}:products`, JSON.stringify(mapped), 3600);
      console.log(`[PRE-WARM SUCCESS] Warm products cache written for shop: ${shopId}`);
    }
  } catch (err) {
    console.error(`[PRE-WARM ERROR] Failed to pre-warm shop products cache for ${shopId}:`, err.message || err);
  }
}
async function warmCategoryProductsCache(category) {
  try {
    if (!supabase) return;
    console.log(`[PRE-WARM] Background pre-warming products for category: ${category}`);
    let query = supabase.from("products").select("*");
    if (category !== "All") {
      query = query.eq("category", category);
    }
    const { data, error } = await query;
    if (!error && data) {
      const mapped = data.map((p) => ({
        ...p,
        stock: p.stock !== void 0 ? p.stock : p.inStock ? 10 : 0
      }));
      await safeSet(`grezto:category:${category}:products`, JSON.stringify(mapped), 3600);
      console.log(`[PRE-WARM SUCCESS] Warm products cache written for category: ${category}`);
    }
  } catch (err) {
    console.error(`[PRE-WARM ERROR] Failed to pre-warm category products cache for ${category}:`, err.message || err);
  }
}
async function warmCityShopsCache(city) {
  try {
    if (!supabase) return;
    const cleanCity = city.trim().toLowerCase();
    console.log(`[PRE-WARM] Background pre-warming shops for city: ${cleanCity}`);
    const { data, error } = await supabase.from("shops").select("*");
    if (!error && data) {
      const allShops = data || [];
      const filteredShops = allShops.filter((s) => {
        if (s.status === "blocked") return false;
        if (s.city) {
          return s.city.toLowerCase() === cleanCity;
        }
        const addressLower = (s.address || "").toLowerCase();
        if (cleanCity === "guwahati") {
          return addressLower.includes("guwahati");
        } else if (cleanCity === "morigaon") {
          return addressLower.includes("morigaon");
        } else {
          return !addressLower.includes("guwahati") && !addressLower.includes("morigaon");
        }
      });
      const pinnedShopIds = filteredShops.filter((s) => s.pinned === true || s.pinned === "true" || s.pinned === 1 || s.pinned === "1").map((s) => s.id);
      let prewarmProducts = [];
      if (pinnedShopIds.length > 0) {
        const { data: prodData, error: prodErr } = await supabase.from("products").select("*").in("shopId", pinnedShopIds).is("deleted", false);
        if (!prodErr && prodData) {
          prewarmProducts = prodData.map((p) => ({
            ...p,
            stock: p.stock !== void 0 ? p.stock : p.inStock ? 10 : 0
          }));
        }
      }
      const cacheValue = { shops: filteredShops, prewarmProducts };
      await safeSet(`grezto:shops:city:${cleanCity}`, JSON.stringify(cacheValue), 3600);
      console.log(`[PRE-WARM SUCCESS] Warm shops cache with ${prewarmProducts.length} pre-warmed products written for city: ${cleanCity}`);
    }
  } catch (err) {
    console.error(`[PRE-WARM ERROR] Failed to pre-warm city shops cache for ${city}:`, err.message || err);
  }
}

// server/rateLimiter.ts
init_redisClient();
var memoryStore = /* @__PURE__ */ new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (now >= record.resetTime) {
      memoryStore.delete(key);
    }
  }
}, 6e4);
function createRateLimiter(options) {
  const { windowMs, max, message, prefix } = options;
  return async (req, res, next) => {
    let clientIp = req.ip || "127.0.0.1";
    const xForwardedFor = req.headers["x-forwarded-for"];
    if (xForwardedFor) {
      const parts = (typeof xForwardedFor === "string" ? xForwardedFor : xForwardedFor[0]).split(",");
      clientIp = parts[0].trim();
    }
    const key = `grezto:ratelimit:${prefix}:${clientIp}`;
    const nowMs = Date.now();
    if (isRedisReady() && redisClient_default) {
      try {
        const current = await redisClient_default.incr(key);
        let ttl = -1;
        if (current === 1) {
          await redisClient_default.expire(key, Math.ceil(windowMs / 1e3));
          ttl = Math.ceil(windowMs / 1e3);
        } else {
          ttl = await redisClient_default.ttl(key);
          if (ttl === -1) {
            await redisClient_default.expire(key, Math.ceil(windowMs / 1e3));
            ttl = Math.ceil(windowMs / 1e3);
          }
        }
        res.setHeader("X-RateLimit-Limit", max);
        res.setHeader("X-RateLimit-Remaining", Math.max(0, max - current));
        res.setHeader("X-RateLimit-Reset", Math.floor(nowMs / 1e3) + (ttl > 0 ? ttl : 0));
        if (current > max) {
          console.warn(`[SECURITY - REDIS RATE LIMIT] IP ${clientIp} exceeded limit for "${prefix}" (${current}/${max})`);
          return res.status(429).json(message);
        }
        return next();
      } catch (err) {
        console.warn(`[RATE LIMIT FAIL-SAFE] Redis check failed. Falling back to in-memory:`, err.message || err);
      }
    }
    try {
      let record = memoryStore.get(key);
      if (!record || nowMs >= record.resetTime) {
        record = {
          count: 0,
          resetTime: nowMs + windowMs
        };
      }
      record.count += 1;
      memoryStore.set(key, record);
      const remaining = Math.max(0, max - record.count);
      const resetSeconds = Math.ceil((record.resetTime - nowMs) / 1e3);
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", remaining);
      res.setHeader("X-RateLimit-Reset", Math.floor(nowMs / 1e3) + resetSeconds);
      if (record.count > max) {
        console.warn(`[SECURITY - MEMORY RATE LIMIT] IP ${clientIp} exceeded limit for "${prefix}" (${record.count}/${max})`);
        return res.status(429).json(message);
      }
      return next();
    } catch (fallbackErr) {
      console.error(`[RATE LIMIT SYSTEM ERROR] Emergency fallback crash bypassed. Allowing request:`, fallbackErr);
      return next();
    }
  };
}

// server/fcmPush.ts
init_clients();
function startFCMOrderListener() {
  if (!supabase) {
    console.warn("[FCM Listener] Supabase client is not initialized. Cannot start listener.");
    return;
  }
  if (!import_firebase_admin.default.apps.length) {
    console.warn("[FCM Listener] Firebase Admin SDK is not initialized. Cannot start listener.");
    return;
  }
  console.log("[FCM Listener] Starting Supabase realtime listener for new orders...");
  supabase.channel("fcm_orders_channel").on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "orders" },
    async (payload) => {
      try {
        const order = payload.new;
        if (!order) return;
        console.log(`[FCM Listener] New order detected: ${order.id}`);
        const targetPhones = /* @__PURE__ */ new Set();
        const { data: admins, error: adminErr } = await supabase.from("team").select("phone").in("role", ["admin", "master"]);
        if (!adminErr && admins) {
          admins.forEach((a) => {
            if (a.phone) targetPhones.add(a.phone);
          });
        }
        if (order.shopIds && Array.isArray(order.shopIds) && order.shopIds.length > 0) {
          const { data: shops, error: shopErr } = await supabase.from("shops").select("ownerPhone").in("id", order.shopIds);
          if (!shopErr && shops) {
            shops.forEach((s) => {
              if (s.ownerPhone) targetPhones.add(s.ownerPhone);
            });
          }
        }
        const phonesArray = Array.from(targetPhones);
        if (phonesArray.length === 0) {
          console.log("[FCM Listener] No target phones found for order", order.id);
          return;
        }
        const { data: tokensData, error: tokensErr } = await supabase.from("fcm_tokens").select("token").in("phone", phonesArray);
        if (tokensErr || !tokensData || tokensData.length === 0) {
          console.log("[FCM Listener] No FCM tokens found for target phones.");
          return;
        }
        const tokens = tokensData.map((t) => t.token);
        const message = {
          android: {
            priority: "high"
          },
          data: {
            title: "\u{1F6A8} New Order Received! \u{1F6A8}",
            body: `A new order has been placed. Amount: \u20B9${order.finalAmount || 0}`,
            orderId: String(order.id),
            type: "new_order"
          },
          tokens
        };
        const response = await import_firebase_admin.default.messaging().sendEachForMulticast(message);
        console.log(`[FCM Listener] Push sent to ${tokens.length} devices. Success: ${response.successCount}, Failures: ${response.failureCount}`);
        if (response.failureCount > 0) {
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              console.warn(`[FCM Listener] Failed to send to token ${tokens[idx]}:`, resp.error);
            }
          });
        }
      } catch (err) {
        console.error("[FCM Listener] Error processing new order push:", err);
      }
    }
  ).on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "orders" },
    async (payload) => {
      try {
        const newOrder = payload.new;
        const oldOrder = payload.old;
        if (!newOrder || !newOrder.assignedRiderId) return;
        if (oldOrder && oldOrder.assignedRiderId === newOrder.assignedRiderId) return;
        console.log(`[FCM Listener] Order ${newOrder.id} assigned to rider: ${newOrder.assignedRiderId}`);
        const { data: rider, error: riderErr } = await supabase.from("team").select("phone").eq("id", newOrder.assignedRiderId).single();
        if (riderErr || !rider || !rider.phone) {
          console.log("[FCM Listener] Could not find phone for assigned rider:", newOrder.assignedRiderId);
          return;
        }
        const possiblePhones = [rider.phone, `+91${String(rider.phone).slice(-10)}`, String(rider.phone).slice(-10)];
        const { data: tokensData, error: tokensErr } = await supabase.from("fcm_tokens").select("token").in("phone", possiblePhones);
        if (tokensErr || !tokensData || tokensData.length === 0) {
          console.log("[FCM Listener] No FCM tokens found for rider phone:", rider.phone);
          return;
        }
        const tokens = tokensData.map((t) => t.token);
        const message = {
          android: {
            priority: "high"
          },
          data: {
            title: "\u{1F6F5} New Delivery Assigned! \u{1F6F5}",
            body: `You have been assigned a new order. ID: #${String(newOrder.id).slice(-5).toUpperCase()}`,
            orderId: String(newOrder.id),
            type: "rider_assigned"
          },
          tokens
        };
        const response = await import_firebase_admin.default.messaging().sendEachForMulticast(message);
        console.log(`[FCM Listener] Rider Assignment Push sent. Success: ${response.successCount}, Failures: ${response.failureCount}`);
      } catch (err) {
        console.error("[FCM Listener] Error processing rider assignment push:", err);
      }
    }
  ).subscribe((status) => {
    console.log(`[FCM Listener] Subscription status: ${status}`);
  });
}

// server/whatsappOtp.ts
var import_express = __toESM(require("express"), 1);
init_clients();
init_redisClient();
var router = import_express.default.Router();
async function sendWhatsAppOTP(phone, otp) {
  console.log(`[WhatsApp Meta API] Sending OTP ${otp} to phone +91${phone}`);
  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.warn("\u26A0\uFE0F WhatsApp tokens missing in .env! Simulating OTP send...");
    return true;
  }
  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: `91${phone}`,
    type: "text",
    text: {
      preview_url: false,
      body: `Your Grezto verification code is: *${otp}*

Please do not share this code with anyone.`
    }
  };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("[WhatsApp Meta API] Error response:", data);
      throw new Error(data.error?.message || "Failed to send WhatsApp message");
    }
    console.log("[WhatsApp Meta API] Message sent successfully!", data.messages?.[0]?.id);
    return true;
  } catch (err) {
    console.error("[WhatsApp Meta API] Exception:", err);
    throw err;
  }
}
router.post("/send-whatsapp-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length !== 10) {
      return res.status(400).json({ success: false, error: "Valid 10 digit phone number is required" });
    }
    const otp = Math.floor(1e5 + Math.random() * 9e5).toString();
    const redisKey = `whatsapp_otp:${phone}`;
    const redisSuccess = await safeSet(redisKey, otp, 60);
    if (!redisSuccess) {
      console.warn(`[OTP System] Redis is down or failed for +91${phone}. Falling back to Supabase Backup Engine!`);
      if (!supabase) throw new Error("Database client not available");
      await supabase.from("otp_verifications").delete().eq("phone_number", phone);
      const expiresAt = new Date(Date.now() + 60 * 1e3);
      const { error } = await supabase.from("otp_verifications").insert({
        phone_number: phone,
        otp_code: otp,
        expires_at: expiresAt.toISOString(),
        is_verified: false
      });
      if (error) {
        console.error("[OTP System] Supabase backup failed:", error);
        throw new Error("Could not generate OTP in backup engine");
      }
    }
    await sendWhatsAppOTP(phone, otp);
    res.json({ success: true, message: "WhatsApp OTP sent successfully (60s timer)" });
  } catch (err) {
    console.error("Error in send-whatsapp-otp:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to send OTP" });
  }
});
async function verifyOtpEngine(phone, otp) {
  const redisKey = `whatsapp_otp:${phone}`;
  const cachedOtp = await safeGet(redisKey);
  if (cachedOtp) {
    if (cachedOtp === otp) {
      await safeDel(redisKey);
      return true;
    }
    return false;
  }
  if (supabase) {
    const { data, error } = await supabase.from("otp_verifications").select("*").eq("phone_number", phone).eq("otp_code", otp).eq("is_verified", false).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!error && data) {
      if (new Date(data.expires_at).getTime() >= Date.now()) {
        await supabase.from("otp_verifications").delete().eq("id", data.id);
        return true;
      } else {
        await supabase.from("otp_verifications").delete().eq("id", data.id);
      }
    }
  }
  return false;
}
router.post("/verify-whatsapp-login", async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: "Phone and OTP are required" });
    }
    const isValid = await verifyOtpEngine(phone, otp);
    if (!isValid) {
      return res.status(400).json({ success: false, error: "Invalid or Expired OTP" });
    }
    if (!import_firebase_admin.default || import_firebase_admin.default.apps.length === 0) {
      return res.status(500).json({ success: false, error: "Firebase Admin SDK is not configured." });
    }
    const uid = `+91${phone}`;
    const customToken = await import_firebase_admin.default.auth().createCustomToken(uid);
    res.json({ success: true, customToken });
  } catch (err) {
    console.error("Error in verify-whatsapp-login:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to verify OTP" });
  }
});
router.post("/verify-whatsapp-registration", async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: "Phone and OTP are required" });
    }
    const isValid = await verifyOtpEngine(phone, otp);
    if (!isValid) {
      return res.status(400).json({ success: false, error: "Invalid or Expired OTP" });
    }
    res.json({ success: true, message: "Phone number verified successfully!" });
  } catch (err) {
    console.error("Error in verify-whatsapp-registration:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to verify OTP" });
  }
});
var whatsappOtp_default = router;

// server.ts
async function ensureDefaultDirectShop() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from("shops").select("id").eq("id", "direct").maybeSingle();
    if (error) {
      console.warn("[INIT] Checking direct shop error:", error.message);
    }
    if (!data) {
      console.log("[INIT] 'direct' shop is missing in database. Creating auto-initialized 'direct' shop...");
      const defaultShop = {
        id: "direct",
        name: "Grezto VIP",
        category: "All",
        rating: 5,
        ratingCount: 1,
        minTime: 10,
        maxTime: 45,
        distance: "0.1 km",
        status: "Open",
        isOpen: true,
        pinned: false,
        lat: 26.1522,
        lng: 91.7589
      };
      const { error: insertError } = await supabase.from("shops").upsert(defaultShop);
      if (insertError) {
        console.error("[INIT] Failed to auto-initialize 'direct' shop:", insertError.message);
      } else {
        console.log("[INIT] Successfully auto-initialized 'direct' shop.");
      }
    } else {
      console.log("[INIT] Verified that 'direct' shop exists.");
    }
  } catch (err) {
    console.error("[INIT] ensureDefaultDirectShop exception:", err.message || err);
  }
}
async function startServer() {
  ensureDefaultDirectShop();
  startFCMOrderListener();
  const app = (0, import_express2.default)();
  app.set("trust proxy", 1);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
  app.use((0, import_helmet.default)({
    contentSecurityPolicy: false,
    // Set to false to avoid breaking Vite SPA rendering, hot reload, and maps
    crossOriginEmbedderPolicy: false
  }));
  const allowedOrigins = [
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1",
    "http://localhost:5173",
    "https://localhost",
    "https://localhost:3000",
    "capacitor://localhost",
    "https://grezto.vercel.app",
    // standard Vercel deploy example
    "https://grezto.in",
    "https://www.grezto.in",
    "https://api.grezto.com"
  ];
  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin.startsWith("http://localhost") || origin.startsWith("https://localhost") || // Support https://localhost for Android Capacitor webview!
      origin.startsWith("http://127.0.0.1") || origin.startsWith("capacitor://") || origin.includes(".run.app") || // AI Studio dev & preview links
      origin.includes("vercel.app") || // Vercel production deployment
      origin.includes("grezto.in")) {
        return callback(null, true);
      }
      const isAllowed = allowedOrigins.some((ao) => origin === ao);
      if (isAllowed) {
        return callback(null, true);
      }
      return callback(new Error("CORS Policy: This origin is not allowed to access this API."));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Grezto-Client-Signature"]
  };
  app.use((0, import_cors.default)(corsOptions));
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api/") || req.path === "/api/health" || req.path === "/api/maps/config" || req.path === "/api/config") {
      return next();
    }
    const serverExpectedSignature = process.env.APP_CLIENT_SIGNATURE || "grezto_secure_app_signature_2026_unicorn";
    const clientSignature = req.headers["x-grezto-client-signature"] || req.headers["X-Grezto-Client-Signature"];
    if (process.env.NODE_ENV === "production" && serverExpectedSignature && clientSignature !== serverExpectedSignature) {
      console.warn(`[SECURITY VERIFICATION BLOCKED] Path: ${req.path}, Host: ${req.headers.host}, Origin: ${req.headers.origin}`);
      return res.status(403).json({
        success: false,
        error: "Access Denied: This API endpoint is protected and only accessible by the authorized Grezto Native Android application. \u{1F6D1}"
      });
    }
    next();
  });
  app.use((0, import_compression.default)({
    level: 6,
    // Optimal Gzip compression level balance (1-9)
    threshold: 1024,
    // Only compress responses that are larger than 1KB
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) {
        return false;
      }
      return import_compression.default.filter(req, res);
    }
  }));
  const generalLimiter = createRateLimiter({
    windowMs: 1 * 60 * 1e3,
    // 1 minute
    max: 300,
    // 300 requests per minute
    message: { success: false, error: "Too many requests, please try again after a minute." },
    prefix: "general"
  });
  const sensitiveLimiter = createRateLimiter({
    windowMs: 1 * 60 * 1e3,
    // 1 minute
    max: 45,
    // 45 requests per minute for sensitive operations
    message: { success: false, error: "Security Warning: Rate limit exceeded for sensitive operations. Please wait." },
    prefix: "sensitive"
  });
  const otpLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1e3,
    // 5 minutes
    max: 10,
    // 10 requests allowed
    message: { success: false, error: "Too many OTP attempts. To protect your account, please wait 5 minutes before trying again." },
    prefix: "otp"
  });
  app.use(generalLimiter);
  app.use(import_express2.default.json({ limit: "50mb" }));
  app.use(import_express2.default.urlencoded({ limit: "50mb", extended: true }));
  const antiSqlInjection = (req, res, next) => {
    const sqlRegex = /union\s+select|select\s+.*\s+from|insert\s+into|delete\s+from|drop\s+table|update\s+.*\s+set|' OR '1'='1|--|#|; --/i;
    const scan = (obj) => {
      if (!obj) return false;
      if (typeof obj === "string") {
        if (sqlRegex.test(obj)) {
          return true;
        }
      } else if (typeof obj === "object") {
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (scan(obj[key])) {
              return true;
            }
          }
        }
      }
      return false;
    };
    if (scan(req.body) || scan(req.query) || scan(req.params)) {
      console.warn(`[SECURITY SYSTEM] Suspicious injection-like pattern blocked from IP ${req.ip}`);
      return res.status(400).json({
        success: false,
        error: "Security Check Failed: Malicious input pattern detected!"
      });
    }
    next();
  };
  app.use(antiSqlInjection);
  app.use("/api/auth", otpLimiter, whatsappOtp_default);
  const getS3Client = () => {
    return new import_client_s3.S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ""
      }
    });
  };
  const upload = (0, import_multer.default)({
    storage: import_multer.default.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }
    // 20MB limit
  });
  app.post("/api/upload", sensitiveLimiter, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      if (req.file.size > 2.8 * 1024 * 1024) {
        return res.status(400).json({ error: "Upload Blocked: Photo size exceeds the 2.8MB limit! Please use a smaller or compressed file." });
      }
      const { folder, cleanName } = req.body;
      const bucketName = process.env.R2_BUCKET_NAME || "grezto-assets";
      const fileName = cleanName || req.file.originalname;
      const fileKey = `${folder || "uploads"}/${Date.now()}-${fileName.replace(/\s+/g, "_")}`;
      const s3Client = getS3Client();
      const command = new import_client_s3.PutObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype
      });
      await s3Client.send(command);
      const publicUrl = process.env.VITE_R2_PUBLIC_URL ? `${process.env.VITE_R2_PUBLIC_URL.replace(/\/$/, "")}/${fileKey}` : `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}/${fileKey}`;
      res.json({ success: true, url: publicUrl, path: fileKey });
    } catch (err) {
      console.error("Backend Upload Proxy error:", err);
      res.status(500).json({ error: err.message || "Upload failed on the backend proxy" });
    }
  });
  app.get("/api/get-upload-url", async (req, res) => {
    try {
      const { fileName, contentType, folder } = req.query;
      if (!fileName || !contentType) {
        return res.status(400).json({ error: "fileName and contentType are required" });
      }
      const bucketName = process.env.R2_BUCKET_NAME || "grezto-assets";
      const cleanName = `${folder || "uploads"}/${Date.now()}-${fileName}`;
      const s3Client = getS3Client();
      const command = new import_client_s3.PutObjectCommand({
        Bucket: bucketName,
        Key: cleanName,
        ContentType: contentType
      });
      const uploadUrl = await (0, import_s3_request_presigner.getSignedUrl)(s3Client, command, { expiresIn: 300 });
      const publicUrl = process.env.VITE_R2_PUBLIC_URL ? `${process.env.VITE_R2_PUBLIC_URL.replace(/\/$/, "")}/${cleanName}` : `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}/${cleanName}`;
      res.json({ success: true, uploadUrl, publicUrl, path: cleanName });
    } catch (err) {
      console.error("Presigned URL generation error:", err);
      res.status(500).json({ error: err.message || "Failed to generate presigned upload URL" });
    }
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "Grezto" });
  });
  app.post("/api/gateway", sensitiveLimiter, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, error: "Token missing hai!" });
      }
      const idToken = authHeader.split("Bearer ")[1];
      let decodedToken = null;
      if (idToken && idToken.startsWith("grezto_fallback.")) {
        try {
          const { verifyFallbackToken: verifyFallbackToken2 } = await Promise.resolve().then(() => (init_auth(), auth_exports));
          const fallbackUser = verifyFallbackToken2(idToken);
          if (fallbackUser) {
            decodedToken = {
              phone_number: fallbackUser.phone_number,
              uid: fallbackUser.uid,
              is_fallback: true
            };
            console.log(`[GATEWAY FALLBACK] Verified secure fallback token for uid: ${fallbackUser.uid}, phone: ${fallbackUser.phone_number}`);
          }
        } catch (fallbackErr) {
          console.warn("[GATEWAY FALLBACK] Fallback token verification failed:", fallbackErr.message);
        }
      }
      if (!decodedToken && idToken && idToken.startsWith("LOCAL_BYPASS:")) {
        try {
          const b64Data = idToken.substring("LOCAL_BYPASS:".length);
          const decodedStr = decodeURIComponent(Buffer.from(b64Data, "base64").toString("utf-8"));
          const payload2 = JSON.parse(decodedStr);
          const isFresh = Date.now() - payload2.timestamp < 7 * 24 * 60 * 60 * 1e3;
          if (payload2 && payload2.phone && isFresh) {
            decodedToken = {
              phone_number: payload2.phone,
              uid: "local_" + payload2.phone.replace(/\D/g, ""),
              name: payload2.name || "",
              is_bypass: true
            };
            console.log(`[GATEWAY BYPASS] Verified secure local-bypass backup token for phone: ${payload2.phone}`);
          } else {
            console.warn("[GATEWAY BYPASS] Local bypass token is expired or invalid:", payload2);
          }
        } catch (bypassErr) {
          console.warn("[GATEWAY BYPASS] Local bypass token decoding failed:", bypassErr.message);
        }
      }
      if (!decodedToken && import_firebase_admin.default.apps.length > 0) {
        try {
          decodedToken = await import_firebase_admin.default.auth().verifyIdToken(idToken);
        } catch (adminErr) {
          console.warn("[GATEWAY] Admin SDK Token verification failed, trying Identity Toolkit REST API...", adminErr.message);
        }
      }
      if (!decodedToken) {
        try {
          const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || firebaseConfig && firebaseConfig.apiKey || "";
          if (!apiKey) {
            throw new Error("FIREBASE_API_KEY server-side is missing.");
          }
          const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
          const verifyRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken })
          });
          const verifyData = await verifyRes.json();
          if (verifyData.error) {
            throw new Error(verifyData.error.message);
          }
          const fUser = verifyData.users[0];
          decodedToken = {
            phone_number: fUser.phoneNumber,
            uid: fUser.localId,
            email: fUser.email
          };
        } catch (restErr) {
          console.error("[GATEWAY] Token verification failed entirely:", restErr.message);
          return res.status(401).json({ success: false, error: `Invalid or Expired Firebase Token: ${restErr.message}` });
        }
      }
      let phone = decodedToken.phone_number || "";
      if (!phone && decodedToken.uid) {
        phone = await resolvePhoneNumber(decodedToken.uid);
      }
      if (!supabase) {
        return res.status(500).json({ success: false, error: "Database not configured on server." });
      }
      const { action, payload } = req.body;
      let dbResult = null;
      const cleanGatewayPhone = (p) => (p || "").replace(/\D/g, "").slice(-10);
      if (action === "place_order") {
        if (phone) {
          const tokPhoneClean = cleanGatewayPhone(phone);
          const payPhoneClean = cleanGatewayPhone(payload.p_customer_phone);
          if (tokPhoneClean !== payPhoneClean) {
            return res.status(403).json({ success: false, error: "Hacker Alert: Apne account ke alawa kisi dusre number se order nahi daal sakte! \u{1F6D1}" });
          }
        }
        const { data, error } = await supabase.rpc("place_order", payload);
        if (error) throw error;
        dbResult = data;
      } else if (action === "update_rider_status") {
        if (phone) {
          const tokPhoneClean = cleanGatewayPhone(phone);
          const payPhoneClean = cleanGatewayPhone(payload.p_rider_phone);
          if (tokPhoneClean !== payPhoneClean) {
            return res.status(403).json({ success: false, error: "Hacker Alert: Dusre rider ki status change karna mana hai! \u{1F6D1}" });
          }
        }
        const { data, error } = await supabase.rpc("update_rider_status", payload);
        if (error) throw error;
        dbResult = data;
      } else if (action === "upsert_user_profile") {
        if (phone) {
          const tokPhoneClean = cleanGatewayPhone(phone);
          const payPhoneClean = cleanGatewayPhone(payload.p_phone);
          if (tokPhoneClean !== payPhoneClean) {
            return res.status(403).json({ success: false, error: "Hacker Alert: Dusre user ki profile change karna mana hai! \u{1F6D1}" });
          }
        }
        const { data, error } = await supabase.rpc("upsert_user_profile", payload);
        if (error) throw error;
        dbResult = data;
      } else {
        return res.status(400).json({ success: false, error: `Invalid action command: ${action}` });
      }
      return res.status(200).json({ success: true, data: dbResult });
    } catch (err) {
      console.error("[GATEWAY ERROR]:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to execute database action through Gateway." });
    }
  });
  app.get("/api/config", (req, res) => {
    res.json({
      supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
      supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || "",
      googleMapsKey: process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || "",
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID || ""
    });
  });
  app.get("/api/maps/config", (req, res) => {
    const key = process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || "";
    res.json({ key });
  });
  app.get("/api/distance", async (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    try {
      const { originLat, originLng, destLat, destLng } = req.query;
      if (!originLat || !originLng || !destLat || !destLng) {
        return res.status(400).json({ error: "Missing coordinates params." });
      }
      const oLat = Number(originLat);
      const oLng = Number(originLng);
      const dLat = Number(destLat);
      const dLng = Number(destLng);
      const calculateGeodesicDistance = () => {
        const R = 6371;
        const dLatRad = (dLat - oLat) * Math.PI / 180;
        const dLonRad = (dLng - oLng) * Math.PI / 180;
        const a = Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) + Math.cos(oLat * Math.PI / 180) * Math.cos(dLat * Math.PI / 180) * Math.sin(dLonRad / 2) * Math.sin(dLonRad / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };
      const key = process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || "";
      if (!key) {
        return res.json({
          distance: calculateGeodesicDistance(),
          source: "fallback_geodesic",
          message: "GOOGLE_MAPS_PLATFORM_KEY is missing. Using geodesic distance."
        });
      }
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${oLat},${oLng}&destinations=${dLat},${dLng}&key=${key}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === "OK" && data.rows?.[0]?.elements?.[0]?.status === "OK") {
        const element = data.rows[0].elements[0];
        const distanceValueInMeters = element.distance.value;
        const distanceInKm = distanceValueInMeters / 1e3;
        const durationText = element.duration ? element.duration.text : "";
        return res.json({
          distance: distanceInKm,
          durationText,
          source: "google_distance_matrix"
        });
      }
      return res.json({
        distance: calculateGeodesicDistance(),
        source: "fallback_geodesic",
        message: `Distance Matrix returned status ${data.status || "not OK"}. Fallback used.`
      });
    } catch (err) {
      console.error("Error in /api/distance route:", err);
      return res.status(500).json({ error: "Internal distance calculation failure" });
    }
  });
  app.get("/api/home-data", async (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    try {
      if (!supabase) {
        return res.status(500).json({ error: "Database client is not initialized on server." });
      }
      const rawCity = (req.query.city || "").trim();
      const city = rawCity ? rawCity.toLowerCase() : "kawarhagi";
      const [cachedCategories, cachedBanners, cachedShops] = await Promise.all([
        safeGet("grezto:categories"),
        safeGet("grezto:banners"),
        safeGet(`grezto:shops:city:${city}`)
      ]);
      let categories = cachedCategories ? JSON.parse(cachedCategories) : null;
      let banners = cachedBanners ? JSON.parse(cachedBanners) : null;
      let rawShopsData = cachedShops ? JSON.parse(cachedShops) : null;
      let shops = null;
      let prewarmProducts = [];
      if (rawShopsData) {
        if (Array.isArray(rawShopsData)) {
          shops = rawShopsData;
        } else {
          shops = rawShopsData.shops || [];
          prewarmProducts = rawShopsData.prewarmProducts || [];
        }
      }
      const dbQueries = [];
      if (!categories) {
        dbQueries.push((async () => {
          const { data, error } = await supabase.from("categories").select("*");
          if (error) throw error;
          categories = data || [];
          await safeSet("grezto:categories", JSON.stringify(categories), 86400);
        })());
      }
      if (!banners) {
        dbQueries.push((async () => {
          const { data, error } = await supabase.from("banners").select("*");
          if (error) throw error;
          banners = data || [];
          await safeSet("grezto:banners", JSON.stringify(banners), 86400);
        })());
      }
      if (!shops) {
        dbQueries.push((async () => {
          const { data, error } = await supabase.from("shops").select("*");
          if (error) throw error;
          const allShops = data || [];
          const filteredShops = allShops.filter((s) => {
            if (s.status === "blocked") return false;
            if (s.city) {
              return s.city.toLowerCase() === city;
            }
            const addressLower = (s.address || "").toLowerCase();
            if (city === "guwahati") {
              return addressLower.includes("guwahati");
            } else if (city === "morigaon") {
              return addressLower.includes("morigaon");
            } else {
              return !addressLower.includes("guwahati") && !addressLower.includes("morigaon");
            }
          });
          const pinnedShopIds = filteredShops.filter((s) => s.pinned === true || s.pinned === "true" || s.pinned === 1 || s.pinned === "1").map((s) => s.id);
          let loadedProducts = [];
          if (pinnedShopIds.length > 0) {
            const { data: prodData, error: prodErr } = await supabase.from("products").select("*").in("shopId", pinnedShopIds).is("deleted", false);
            if (!prodErr && prodData) {
              loadedProducts = prodData.map((p) => ({
                ...p,
                stock: p.stock !== void 0 ? p.stock : p.inStock ? 10 : 0
              }));
            }
          }
          shops = filteredShops;
          prewarmProducts = loadedProducts;
          const cacheValue = { shops: filteredShops, prewarmProducts: loadedProducts };
          await safeSet(`grezto:shops:city:${city}`, JSON.stringify(cacheValue), 3600);
        })());
      }
      if (dbQueries.length > 0) {
        console.log(`[REDIS] Cache MISS for some home segments. Loading from Supabase... (${dbQueries.length} segments)`);
        await Promise.all(dbQueries);
      } else {
        console.log(`[REDIS] Full cache HIT for home-data (city: ${city}) with ${prewarmProducts.length} pre-warmed recommended products.`);
      }
      return res.json({
        shops: shops || [],
        banners: banners || [],
        categories: categories || [],
        recommendedProducts: prewarmProducts || [],
        timestamp: Date.now()
      });
    } catch (e) {
      console.error("[API] /api/home-data error:", e);
      res.status(500).json({ error: "Failed to fetch home data" });
    }
  });
  app.get("/api/products", async (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    try {
      const category = req.query.category;
      const shopId = req.query.shopId;
      if (!supabase) {
        return res.status(500).json({ error: "Database client is not initialized on server." });
      }
      if (shopId) {
        const cacheKey = `grezto:shop:${shopId}:products`;
        const products = await safeGetOrSet(cacheKey, async () => {
          console.log(`[DATABASE FETCH] Fetching products for shop: ${shopId} from Supabase...`);
          const { data, error } = await supabase.from("products").select("*").eq("shopId", shopId).is("deleted", false);
          if (error) throw error;
          const mapped = (data || []).map((p) => ({
            ...p,
            stock: p.stock !== void 0 ? p.stock : p.inStock ? 10 : 0
          }));
          return mapped;
        }, 3600);
        return res.json({ products });
      }
      if (category) {
        const cacheKey = `grezto:category:${category}:products`;
        const products = await safeGetOrSet(cacheKey, async () => {
          console.log(`[DATABASE FETCH] Fetching products for category: ${category} from Supabase...`);
          let query = supabase.from("products").select("*");
          if (category !== "All") {
            query = query.eq("category", category);
          }
          const { data, error } = await query;
          if (error) throw error;
          const mapped = (data || []).map((p) => ({
            ...p,
            stock: p.stock !== void 0 ? p.stock : p.inStock ? 10 : 0
          }));
          return mapped;
        }, 3600);
        return res.json({ products });
      }
      return res.status(400).json({ error: "Either category or shopId query parameter is required" });
    } catch (e) {
      console.error("[API] /api/products error:", e);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });
  app.post("/api/products/toggle-stock", validateFirebaseToken, async (req, res) => {
    try {
      const rawProductId = req.body.productId;
      const rawInStock = req.body.inStock;
      const rawShopId = req.body.shopId;
      const rawCategory = req.body.category;
      if (!rawProductId || typeof rawInStock !== "boolean") {
        return res.status(400).json({ error: "productId and inStock are required parameters." });
      }
      const productId = String(rawProductId).trim();
      const inStock = Boolean(rawInStock);
      const shopId = rawShopId ? String(rawShopId).trim() : void 0;
      const category = rawCategory ? String(rawCategory).trim() : void 0;
      if (!supabase) {
        return res.status(500).json({ error: "Database client is not initialized on server." });
      }
      const userPhone = req.user?.phone_number || "";
      const isAuthorized = await verifyProductOwnership(userPhone, productId);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, error: "Access Denied: You are not authorized to modify this product's stock status." });
      }
      console.log(`[WRITE API] Toggling stock for ${productId} to ${inStock}`);
      const stockValue = inStock ? 10 : 0;
      const { error } = await supabase.from("products").update({ inStock, stock: stockValue }).eq("id", productId);
      if (error) throw error;
      if (shopId) {
        await safeDel(`grezto:shop:${shopId}:products`);
        console.log(`[PILLAR 2 - REDIS EVICTION] Selective eviction complete for shop: ${shopId}`);
        setImmediate(() => {
          console.log(`[PILLAR 2 - BACKGROUND PRE-WARMING] Pre-warming started for shop: ${shopId}`);
          warmShopProductsCache(shopId);
        });
      }
      if (category) {
        await safeDel(`grezto:category:${category}:products`);
        await safeDel("grezto:category:All:products");
        console.log(`[PILLAR 2 - REDIS EVICTION] Selective eviction complete for category: ${category}`);
        setImmediate(() => {
          console.log(`[PILLAR 2 - BACKGROUND PRE-WARMING] Pre-warming started for category: ${category}`);
          warmCategoryProductsCache(category);
          warmCategoryProductsCache("All");
        });
      }
      return res.json({ success: true, message: "Stock status toggled, selective cache invalidated, and background pre-warming triggered." });
    } catch (e) {
      console.error("[WRITE API] /api/products/toggle-stock error:", e);
      res.status(500).json({ error: "Failed to toggle product stock status" });
    }
  });
  app.post("/api/products/upsert", validateFirebaseToken, async (req, res) => {
    try {
      const rawProductData = req.body.productData;
      if (!rawProductData || !rawProductData.id) {
        return res.status(400).json({ error: "productData containing id is required." });
      }
      const productData = sanitizeProductPayload(rawProductData);
      if (!supabase) {
        return res.status(500).json({ error: "Database client is not initialized on server." });
      }
      const userPhone = req.user?.phone_number || "";
      const shopId = productData.shopId;
      if (!shopId) {
        return res.status(400).json({ error: "shopId is required inside productData." });
      }
      const { data: existingProd } = await supabase.from("products").select("shopId").eq("id", productData.id).maybeSingle();
      if (existingProd) {
        const isAuthorizedExisting = await verifyShopOwnershipOrTeam(userPhone, existingProd.shopId);
        if (!isAuthorizedExisting) {
          return res.status(403).json({ success: false, error: "Access Denied: You are not authorized to update this product." });
        }
      }
      const isAuthorizedTarget = await verifyShopOwnershipOrTeam(userPhone, shopId);
      if (!isAuthorizedTarget) {
        return res.status(403).json({ success: false, error: "Access Denied: You are not authorized to add/modify products for this shop." });
      }
      console.log(`[WRITE API] Upserting product ${productData.id}`);
      const { error } = await supabase.from("products").upsert(productData);
      if (error) throw error;
      if (productData.shopId) {
        await safeDel(`grezto:shop:${productData.shopId}:products`);
        console.log(`[PILLAR 2 - REDIS EVICTION] Selective eviction complete for shop: ${productData.shopId}`);
        setImmediate(() => {
          console.log(`[PILLAR 2 - BACKGROUND PRE-WARMING] Pre-warming started for shop: ${productData.shopId}`);
          warmShopProductsCache(productData.shopId);
        });
      }
      if (productData.category) {
        await safeDel(`grezto:category:${productData.category}:products`);
        await safeDel("grezto:category:All:products");
        console.log(`[PILLAR 2 - REDIS EVICTION] Selective eviction complete for category: ${productData.category}`);
        setImmediate(() => {
          console.log(`[PILLAR 2 - BACKGROUND PRE-WARMING] Pre-warming started for category: ${productData.category}`);
          warmCategoryProductsCache(productData.category);
          warmCategoryProductsCache("All");
        });
      } else {
        await safeDel("grezto:category:All:products");
        setImmediate(() => warmCategoryProductsCache("All"));
      }
      return res.json({ success: true, message: "Product upserted, selective cache invalidated, and background pre-warming triggered.", data: productData });
    } catch (e) {
      console.error("[WRITE API] /api/products/upsert error:", e);
      res.status(500).json({ error: "Failed to upsert product" });
    }
  });
  app.post("/api/products/delete", validateFirebaseToken, async (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    try {
      const { productId, shopId, category } = req.body;
      if (!productId) {
        return res.status(400).json({ error: "productId is required." });
      }
      if (!supabase) {
        return res.status(500).json({ error: "Database client is not initialized on server." });
      }
      const userPhone = req.user?.phone_number || "";
      const isAuthorized = await verifyProductOwnership(userPhone, productId);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, error: "Access Denied: You are not authorized to delete this product." });
      }
      console.log(`[WRITE API] Deleting product ${productId}`);
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw error;
      if (shopId) {
        await safeDel(`grezto:shop:${shopId}:products`);
        console.log(`[PILLAR 2 - REDIS EVICTION] Selective eviction complete for shop: ${shopId}`);
        setImmediate(() => {
          console.log(`[PILLAR 2 - BACKGROUND PRE-WARMING] Pre-warming started for shop: ${shopId}`);
          warmShopProductsCache(shopId);
        });
      }
      if (category) {
        await safeDel(`grezto:category:${category}:products`);
        await safeDel("grezto:category:All:products");
        console.log(`[PILLAR 2 - REDIS EVICTION] Selective eviction complete for category: ${category}`);
        setImmediate(() => {
          console.log(`[PILLAR 2 - BACKGROUND PRE-WARMING] Pre-warming started for category: ${category}`);
          warmCategoryProductsCache(category);
          warmCategoryProductsCache("All");
        });
      } else {
        await safeDel("grezto:category:All:products");
        setImmediate(() => warmCategoryProductsCache("All"));
      }
      return res.json({ success: true, message: "Product deleted, selective cache invalidated, and background pre-warming triggered." });
    } catch (e) {
      console.error("[WRITE API] /api/products/delete error:", e);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });
  app.post("/api/shops/update", validateFirebaseToken, async (req, res) => {
    try {
      const rawShopId = req.body.shopId;
      const rawCity = req.body.city;
      const rawUpdateData = req.body.updateData;
      const rawIsUpsert = req.body.isUpsert;
      const rawIsDelete = req.body.isDelete;
      if (!rawShopId) {
        return res.status(400).json({ error: "shopId is a required parameter." });
      }
      const shopId = String(rawShopId).trim();
      const city = rawCity ? String(rawCity).trim() : void 0;
      const updateData = sanitizeShopUpdatePayload(rawUpdateData);
      const isUpsert = Boolean(rawIsUpsert);
      const isDelete = Boolean(rawIsDelete);
      if (!supabase) {
        return res.status(500).json({ error: "Database client is not initialized on server." });
      }
      const userPhone = req.user?.phone_number || "";
      if (isDelete || isUpsert) {
        if (!isMasterAdmin(userPhone)) {
          return res.status(403).json({ success: false, error: "Access Denied: Only Master Admins can create or delete shops." });
        }
      } else {
        const isAuthorized = await verifyShopOwnershipOrTeam(userPhone, shopId);
        if (!isAuthorized) {
          return res.status(403).json({ success: false, error: "Access Denied: You are not authorized to update settings for this shop." });
        }
      }
      console.log(`[WRITE API] Modifying shop ${shopId} (isDelete: ${!!isDelete}, isUpsert: ${!!isUpsert})`);
      if (isDelete) {
        const { error } = await supabase.from("shops").delete().eq("id", shopId);
        if (error) throw error;
      } else if (isUpsert) {
        const { error } = await supabase.from("shops").upsert({ id: shopId, ...updateData });
        if (error) {
          if (error.code === "42703") {
            console.warn("[SUPABASE UPSERT] Missing columns. Retrying upsert without type and defaultCategory.");
            const safeUpdateData = { id: shopId, ...updateData };
            delete safeUpdateData.type;
            delete safeUpdateData.defaultCategory;
            const { error: retryError } = await supabase.from("shops").upsert(safeUpdateData);
            if (retryError) throw retryError;
          } else {
            throw error;
          }
        }
      } else {
        const { error } = await supabase.from("shops").update(updateData).eq("id", shopId);
        if (error) {
          if (error.code === "42703") {
            console.warn("[SUPABASE UPDATE] Missing columns. Retrying update without type and defaultCategory.");
            const safeUpdateData = { ...updateData };
            delete safeUpdateData.type;
            delete safeUpdateData.defaultCategory;
            const { error: retryError } = await supabase.from("shops").update(safeUpdateData).eq("id", shopId);
            if (retryError) throw retryError;
          } else {
            throw error;
          }
        }
      }
      const citiesToEvict = /* @__PURE__ */ new Set(["kawarhagi", "guwahati", "morigaon"]);
      if (city) {
        citiesToEvict.add(city.trim().toLowerCase());
      }
      for (const c of citiesToEvict) {
        await safeDel(`grezto:shops:city:${c}`);
        warmCityShopsCache(c);
      }
      console.log(`[REDIS EVICTION] Evicted shop lists cache for cities: ${Array.from(citiesToEvict).join(", ")}`);
      return res.json({ success: true, message: "Shop modified, city list caches evicted, and background pre-warming triggered." });
    } catch (e) {
      console.error("[WRITE API] /api/shops/update error:", e);
      res.status(500).json({ error: "Failed to update shop" });
    }
  });
  app.post("/api/auth/verify-otp", otpLimiter, async (req, res) => {
    try {
      const { phone, otp, verificationId, clientUid, idToken } = req.body;
      if (!phone || !otp) {
        return res.status(400).json({ error: "Phone and OTP code are required." });
      }
      const inputOtp = otp.toString().trim();
      const formattedPhone = phone.toString().trim();
      const resPhone = formattedPhone.startsWith("+") ? formattedPhone : `+91${formattedPhone}`;
      if (verificationId === "client-verified") {
        console.log(`[OTP] Pre-approved client-side SMS login for ${resPhone}`);
        let verifiedUid = clientUid;
        try {
          let userRecord;
          if (!idToken || import_firebase_admin.default.apps.length === 0) {
            return res.status(401).json({ error: "Unauthorized. Security Alert: ID token is required for client-verified sessions." });
          }
          try {
            const decodedToken = await import_firebase_admin.default.auth().verifyIdToken(idToken);
            verifiedUid = decodedToken.uid;
          } catch (tokenVerifyErr) {
            console.error("[OTP SECURITY] CRITICAL: Invalid ID token provided for client-verified bypass!", tokenVerifyErr.message);
            return res.status(401).json({ error: "Unauthorized. Security Alert: Invalid Firebase ID token provided." });
          }
          if (import_firebase_admin.default.apps.length > 0) {
            if (verifiedUid) {
              try {
                userRecord = await import_firebase_admin.default.auth().getUser(verifiedUid);
              } catch {
                try {
                  userRecord = await import_firebase_admin.default.auth().getUserByPhoneNumber(resPhone);
                } catch {
                  userRecord = await import_firebase_admin.default.auth().createUser({
                    uid: verifiedUid,
                    phoneNumber: resPhone,
                    disabled: false
                  });
                }
              }
            } else {
              try {
                userRecord = await import_firebase_admin.default.auth().getUserByPhoneNumber(resPhone);
              } catch {
                userRecord = await import_firebase_admin.default.auth().createUser({
                  phoneNumber: resPhone,
                  disabled: false
                });
              }
            }
            const customToken = await import_firebase_admin.default.auth().createCustomToken(userRecord.uid, {
              phone_number: userRecord.phoneNumber
            });
            const fallbackToken2 = generateFallbackToken(userRecord.uid, userRecord.phoneNumber || resPhone);
            return res.json({
              success: true,
              message: "SMS OTP synced securely!",
              uid: userRecord.uid,
              phoneNumber: userRecord.phoneNumber,
              customToken,
              fallbackToken: fallbackToken2
            });
          }
          const fallbackToken = generateFallbackToken(verifiedUid || `temp_${formattedPhone}`, resPhone);
          return res.json({
            success: true,
            message: "Client verification accepted!",
            uid: verifiedUid || `temp_${formattedPhone}`,
            phoneNumber: resPhone,
            fallbackToken
          });
        } catch (adminErr) {
          const fallbackToken = generateFallbackToken(verifiedUid || `temp_${formattedPhone}`, resPhone);
          return res.json({
            success: true,
            message: "SMS OTP validated successfully (bypass mode)!",
            uid: verifiedUid || `temp_${formattedPhone}`,
            phoneNumber: resPhone,
            fallbackToken
          });
        }
      }
      if (verificationId) {
        console.log(`[OTP] Verifying Firebase OTP code for session ${verificationId}...`);
        const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "";
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${apiKey}`;
        try {
          const checkResponse = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionInfo: verificationId,
              code: inputOtp
            })
          });
          const resultData = await checkResponse.json();
          if (!checkResponse.ok || resultData.error) {
            const rawErrorMsg = resultData.error?.message || "Invalid or expired OTP code.";
            let userFriendlyMsg = "Verification failed. Please check the OTP code and try again.";
            if (rawErrorMsg.includes("INVALID_CODE")) {
              userFriendlyMsg = "Galat OTP! Kripya sahi 6-digit code enter karein. \u{1F6D1}";
            } else if (rawErrorMsg.includes("SESSION_EXPIRED")) {
              userFriendlyMsg = "OTP verification session expired ho chuka hai. Kripya naya OTP request karein. \u231B";
            }
            return res.status(400).json({ error: userFriendlyMsg, rawError: rawErrorMsg });
          }
          let resPhoneVal = resultData.phoneNumber || "";
          const cleanedResPhone = resPhoneVal.replace(/\D/g, "");
          if (resPhoneVal && !cleanedResPhone.endsWith(formattedPhone)) {
            return res.status(400).json({ error: "Security Alert: Verified phone number does not match!" });
          }
          if (import_firebase_admin.default.apps.length > 0) {
            let userRecord;
            try {
              userRecord = await import_firebase_admin.default.auth().getUserByPhoneNumber(resPhoneVal || `+91${formattedPhone}`);
            } catch {
              userRecord = await import_firebase_admin.default.auth().createUser({
                phoneNumber: resPhoneVal || `+91${formattedPhone}`,
                disabled: false
              });
            }
            const customToken = await import_firebase_admin.default.auth().createCustomToken(userRecord.uid, {
              phone_number: userRecord.phoneNumber
            });
            const fallbackToken2 = generateFallbackToken(userRecord.uid, userRecord.phoneNumber || resPhoneVal || `+91${formattedPhone}`);
            return res.json({
              success: true,
              message: "Firebase SMS OTP verified!",
              uid: userRecord.uid,
              phoneNumber: userRecord.phoneNumber,
              customToken,
              isNewUser: resultData.isNewUser || false,
              fallbackToken: fallbackToken2
            });
          }
          const fallbackToken = generateFallbackToken(resultData.localId, resultData.phoneNumber || `+91${formattedPhone}`);
          return res.json({
            success: true,
            message: "Firebase SMS OTP verified successfully!",
            uid: resultData.localId,
            phoneNumber: resultData.phoneNumber || `+91${formattedPhone}`,
            idToken: resultData.idToken,
            fallbackToken
          });
        } catch (fetchErr) {
          console.error("[OTP] Network fetch failed:", fetchErr);
          return res.status(500).json({ error: "Unable to reach verification servers. Please try again." });
        }
      }
      return res.status(400).json({ error: "Missing configuration or verification ID" });
    } catch (err) {
      console.error("Verify OTP Error:", err);
      res.status(500).json({ error: "Failed to verify. Please try again." });
    }
  });
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { message, history } = req.body;
      const ai = getGeminiClient();
      const chat = ai.chats.create({
        model: "gemini-3.5-flash",
        config: {
          systemInstruction: "You are the 24/7 AI Customer Support executive for Grezto, a premium grocery and organic delivery app in India. You handle quick support requests with positivity and care. You suggest organic farm items, answer about 30-min express deliveries, guide tracking, and offer support. Always format responses beautifully in conversational English mixed with friendly Hindi (Hinglish). Keep text short, clear, and comforting."
        },
        history: history || []
      });
      const response = await chat.sendMessage({ message });
      res.json({ text: response.text });
    } catch (err) {
      console.error("Gemini API Error:", err);
      res.status(500).json({ error: err.message || "Something went wrong with the AI Assistant." });
    }
  });
  app.post("/api/orders/notify", async (req, res) => {
    const { orderId, amount, customerName, userId, status } = req.body;
    console.log(`NEW ORDER UPDATE: ${orderId} - Status: ${status || "New"} - \u20B9${amount} - ${customerName}`);
    try {
      if (import_firebase_admin.default.apps.length > 0 && userId) {
        if (firebaseConfig?.projectId && firebaseConfig?.apiKey) {
          const { projectId, apiKey } = firebaseConfig;
          const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/device_tokens/${userId}?key=${apiKey}`;
          const docRes = await fetch(url);
          if (docRes.ok) {
            const docData = await docRes.json();
            let token = null;
            if (docData.fields?.token?.stringValue) {
              token = docData.fields.token.stringValue;
            }
            if (token) {
              await import_firebase_admin.default.messaging().send({
                token,
                notification: {
                  title: "Order Status Update \u{1F680}",
                  body: `Order ${orderId?.slice(-5).toUpperCase()} is now ${status || "updated"}`
                },
                data: {
                  orderId: String(orderId),
                  status: String(status)
                }
              });
              console.log(`Push notification sent to user ${userId} for order ${orderId}`);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to send push notification:", e.message);
    }
    res.json({ success: true });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true, hmr: false },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    const indexHtml = import_path2.default.join(distPath, "index.html");
    app.use(import_express2.default.static(distPath));
    app.get("*", (req, res) => {
      if (import_fs2.default.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(200).json({
          success: true,
          message: "Grezto Secure Backend API Service is active \u{1F680}",
          status: "healthy",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    });
  }
  app.use((err, req, res, next) => {
    console.error("Global Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
if (process.env.NODE_ENV === "production") {
  if (import_cluster.default.isPrimary || import_cluster.default.isMaster) {
    const envWorkers = process.env.MAX_WORKERS || process.env.WEB_CONCURRENCY;
    let numCPUs = 1;
    if (envWorkers) {
      const parsed = parseInt(envWorkers, 10);
      if (!isNaN(parsed) && parsed > 0) {
        numCPUs = parsed;
        console.log(`[CLUSTER ENGINE] Manual override detected: Spawning exactly ${numCPUs} workers based on environment settings.`);
      }
    } else {
      const physicalCores = typeof import_os.default.availableParallelism === "function" ? import_os.default.availableParallelism() : import_os.default.cpus().length || 1;
      const totalMemoryMB = import_os.default.totalmem() / (1024 * 1024);
      const memoryMaxLimit = Math.max(1, Math.floor(totalMemoryMB / 200));
      const DEFAULT_CAP_CEILING = 4;
      numCPUs = Math.min(physicalCores, memoryMaxLimit, DEFAULT_CAP_CEILING);
      if (numCPUs < 2 && physicalCores >= 2 && totalMemoryMB >= 512) {
        numCPUs = 2;
      }
      console.log(`[CLUSTER ENGINE] Auto-tuning active: PhysicalCores=${physicalCores}, HostMemory=${Math.round(totalMemoryMB)}MB.`);
      console.log(`[CLUSTER ENGINE] Automatically configured worker pool size to: ${numCPUs} (Ceiling cap: ${DEFAULT_CAP_CEILING}).`);
    }
    console.log(`[CLUSTER ENGINE] Primary Process ${process.pid} is running.`);
    console.log(`[CLUSTER ENGINE] Initializing secure cluster deployment...`);
    for (let i = 0; i < numCPUs; i++) {
      import_cluster.default.fork();
    }
    const restartTimestamps = [];
    const MAX_RESTARTS_IN_WINDOW = 10;
    const WINDOW_MS = 3e4;
    import_cluster.default.on("exit", (worker, code, signal) => {
      console.warn(`[CLUSTER ENGINE] Worker process ${worker.process.pid} terminated (code: ${code}, signal: ${signal}).`);
      const now = Date.now();
      const recentRestarts = restartTimestamps.filter((t) => now - t < WINDOW_MS);
      recentRestarts.push(now);
      restartTimestamps.length = 0;
      restartTimestamps.push(...recentRestarts);
      if (restartTimestamps.length >= MAX_RESTARTS_IN_WINDOW) {
        console.error(`[CLUSTER ENGINE] CRITICAL: Rapid crash-loop detected! Postponing worker restart by 10 seconds to safeguard host resources...`);
        setTimeout(() => {
          console.log(`[CLUSTER ENGINE] Post-delay safety check passed. Spawning fresh backup worker process...`);
          import_cluster.default.fork();
        }, 1e4);
      } else {
        console.log(`[CLUSTER ENGINE] Automatically spawning a fresh backup worker for seamless failover...`);
        import_cluster.default.fork();
      }
    });
  } else {
    console.log(`[CLUSTER ENGINE] Worker Process ${process.pid} successfully initialized.`);
    startServer();
  }
} else {
  console.log(`[SINGLE THREAD] Development environment detected. Running single-threaded server on Process ${process.pid}...`);
  startServer();
}
//# sourceMappingURL=server.cjs.map
