import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import crypto from "crypto";
import admin from "firebase-admin";
import multer from "multer";
import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import redis, { safeGet, safeSet, safeDel, safeGetOrSet } from "./server/redisClient";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// Create Supabase client for Server
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
// Prioritize Service Role Key for secure server-side operations, fall back to Anon Key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const isValidSupabaseUrl = supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://');
const supabase = (isValidSupabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Securely initialize Firebase Admin SDK using the active project ID dynamically
if (!admin.apps.length) {
  try {
    let projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        projectId = config.projectId;
      }
    }
    
    if (projectId) {
      admin.initializeApp({
        projectId: projectId
      });
      console.log(`[SERVER] Firebase Admin SDK successfully initialized on server for project: ${projectId}`);
    } else {
      console.warn("[SERVER] No Firebase Project ID found. Skipping Admin SDK initialization.");
    }
  } catch (adminInitErr) {
    console.error("[SERVER] Failed to initialize Firebase Admin SDK:", adminInitErr);
  }
}

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
    if (admin.apps.length > 0) {
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

/**
 * Phase 4: Schema Sanitization & Anti-Injection Layer (Pure Data Enforcement)
 * Validates and whitelists incoming productData payloads to block extra keys or malicious injections.
 */
export function sanitizeProductPayload(rawProduct: any): any {
  if (!rawProduct || typeof rawProduct !== 'object') {
    return {};
  }

  // Pure Whitelist containing only permitted database fields. Any un-whitelisted properties are discarded.
  const allowedKeys = [
    'id',
    'name',
    'price',
    'originalPrice',
    'discount',
    'category',
    'image',
    'description',
    'inStock',
    'stockStatus',
    'shopId',
    'shopName',
    'rating',
    'isBestSeller',
    'status',
    'deleted'
  ];

  const sanitized: any = {};

  for (const key of allowedKeys) {
    if (rawProduct[key] !== undefined && rawProduct[key] !== null) {
      const val = rawProduct[key];

      // Safe Type-Casting & Anti-Injection Sanitization
      if (key === 'id' || key === 'name' || key === 'category' || key === 'image' || key === 'description' || key === 'stockStatus' || key === 'shopId' || key === 'shopName' || key === 'status') {
        sanitized[key] = String(val).trim();
      } else if (key === 'price' || key === 'originalPrice' || key === 'discount' || key === 'rating') {
        const numVal = Number(val);
        sanitized[key] = isNaN(numVal) ? 0 : numVal;
      } else if (key === 'inStock' || key === 'isBestSeller' || key === 'deleted') {
        sanitized[key] = Boolean(val);
      }
    }
  }

  return sanitized;
}

/**
 * Phase 4: Schema Sanitization & Anti-Injection Layer (Pure Data Enforcement)
 * Validates and whitelists incoming updateData payloads for shops to block extra keys or malicious injections.
 */
export function sanitizeShopUpdatePayload(rawUpdate: any): any {
  if (!rawUpdate || typeof rawUpdate !== 'object') {
    return {};
  }

  const allowedKeys = [
    'id',
    'name',
    'type',
    'category',
    'defaultCategory',
    'address',
    'ownerPhone',
    'ownerName',
    'isOpen',
    'status',
    'imageUrl',
    'image',
    'rating',
    'ratingCount',
    'lat',
    'lng',
    'pinned',
    'joinedAt',
    'description',
    'minTime',
    'maxTime',
    'distance',
    'promo'
  ];

  const sanitized: any = {};

  for (const key of allowedKeys) {
    if (rawUpdate[key] !== undefined && rawUpdate[key] !== null) {
      const val = rawUpdate[key];

      if (key === 'id' || key === 'name' || key === 'type' || key === 'category' || key === 'defaultCategory' || key === 'address' || key === 'ownerPhone' || key === 'ownerName' || key === 'status' || key === 'imageUrl' || key === 'image' || key === 'rating' || key === 'joinedAt' || key === 'description' || key === 'distance' || key === 'promo') {
        sanitized[key] = String(val).trim();
      } else if (key === 'ratingCount' || key === 'lat' || key === 'lng' || key === 'minTime' || key === 'maxTime') {
        const numVal = Number(val);
        sanitized[key] = isNaN(numVal) ? 0 : numVal;
      } else if (key === 'isOpen' || key === 'pinned') {
        sanitized[key] = val === true || val === 'true' || val === 1 || val === '1';
      }
    }
  }

  return sanitized;
}

let aiClient: any = null;

function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please configure it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

let firebaseConfig: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
} catch (e) {
  console.warn("Could not load firebase-applet-config.json");
}

async function ensureDefaultDirectShop() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from('shops')
      .select('id')
      .eq('id', 'direct')
      .maybeSingle();
    
    if (error) {
      console.warn("[INIT] Checking direct shop error:", error.message);
    }

    if (!data) {
      console.log("[INIT] 'direct' shop is missing in database. Creating auto-initialized 'direct' shop...");
      const defaultShop = {
        id: 'direct',
        name: 'Grezto VIP',
        category: 'All',
        rating: 5.0,
        ratingCount: 1,
        minTime: 10,
        maxTime: 45,
        distance: '0.1 km',
        status: 'Open',
        isOpen: true,
        pinned: false,
        lat: 26.1522,
        lng: 91.7589
      };
      const { error: insertError } = await supabase.from('shops').upsert(defaultShop);
      if (insertError) {
        console.error("[INIT] Failed to auto-initialize 'direct' shop:", insertError.message);
      } else {
        console.log("[INIT] Successfully auto-initialized 'direct' shop.");
      }
    } else {
      console.log("[INIT] Verified that 'direct' shop exists.");
    }
  } catch (err: any) {
    console.error("[INIT] ensureDefaultDirectShop exception:", err.message || err);
  }
}

async function startServer() {
  // Ensure default direct shop exists so foreign key references on products do not fail
  ensureDefaultDirectShop();

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // 1. Helmet Integration to secure HTTP headers & prevent XSS attacks
  app.use(helmet({
    contentSecurityPolicy: false, // Set to false to avoid breaking Vite SPA rendering, hot reload, and maps
    crossOriginEmbedderPolicy: false
  }));

  // 2. CORS Setup: Strict Origin Policy for security
  const allowedOrigins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
    "capacitor://localhost",
    "https://grezto.vercel.app", // standard Vercel deploy example
  ];

  const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      
      // Allow dynamic local development, Capacitor, or Cloud Run / Vercel previews
      if (
        origin.startsWith("http://localhost") || 
        origin.startsWith("http://127.0.0.1") || 
        origin.startsWith("capacitor://") ||
        origin.includes(".run.app") || // AI Studio dev & preview links
        origin.includes("vercel.app") // Vercel production deployment
      ) {
        return callback(null, true);
      }

      const isAllowed = allowedOrigins.some(ao => origin === ao);
      if (isAllowed) {
        return callback(null, true);
      }

      return callback(new Error("CORS Policy: This origin is not allowed to access this API."));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  };

  app.use(cors(corsOptions));

  // 3. Express Rate Limiters (DDoS Protection)
  // General Rate Limiter for standard API endpoints
  const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 300, // 300 requests per minute
    message: { success: false, error: "Too many requests, please try again after a minute." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Stricter Rate Limiter for sensitive endpoints (e.g. login, payment, gateway, upload)
  const sensitiveLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 45, // 45 requests per minute for sensitive operations
    message: { success: false, error: "Security Warning: Rate limit exceeded for sensitive operations. Please wait." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(generalLimiter);
  app.use(express.json());

  // 4. Advanced Anti-SQL Injection and Request Sanitization Layer
  const antiSqlInjection = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const sqlRegex = /union\s+select|select\s+.*\s+from|insert\s+into|delete\s+from|drop\s+table|update\s+.*\s+set|' OR '1'='1|--|#|; --/i;

    const scan = (obj: any): boolean => {
      if (!obj) return false;
      if (typeof obj === 'string') {
        if (sqlRegex.test(obj)) {
          return true;
        }
      } else if (typeof obj === 'object') {
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

  // Setup S3 Client (Cloudflare R2)
  const getS3Client = () => {
    return new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });
  };

  // Setup multer for memory storage
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
  });

  // POST /api/upload (Proxy upload to bypass CORS)
  app.post("/api/upload", sensitiveLimiter, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { folder, cleanName } = req.body;
      const bucketName = process.env.R2_BUCKET_NAME || 'grezto-assets';
      
      const fileName = cleanName || req.file.originalname;
      const fileKey = `${folder || 'uploads'}/${Date.now()}-${fileName.replace(/\s+/g, '_')}`;

      const s3Client = getS3Client();
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });

      await s3Client.send(command);

      const publicUrl = process.env.VITE_R2_PUBLIC_URL 
        ? `${process.env.VITE_R2_PUBLIC_URL.replace(/\/$/, '')}/${fileKey}`
        : `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}/${fileKey}`;

      res.json({ success: true, url: publicUrl, path: fileKey });
    } catch (err: any) {
      console.error("Backend Upload Proxy error:", err);
      res.status(500).json({ error: err.message || "Upload failed on the backend proxy" });
    }
  });

  // GET /api/get-upload-url
  app.get("/api/get-upload-url", async (req, res) => {
    try {
      const { fileName, contentType, folder } = req.query;
      
      if (!fileName || !contentType) {
        return res.status(400).json({ error: "fileName and contentType are required" });
      }

      const bucketName = process.env.R2_BUCKET_NAME || 'grezto-assets';
      const cleanName = `${folder || 'uploads'}/${Date.now()}-${fileName}`;

      const s3Client = getS3Client();
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: cleanName,
        ContentType: contentType as string,
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

      const publicUrl = process.env.VITE_R2_PUBLIC_URL 
        ? `${process.env.VITE_R2_PUBLIC_URL.replace(/\/$/, '')}/${cleanName}`
        : `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}/${cleanName}`;

      res.json({ success: true, uploadUrl, publicUrl, path: cleanName });
    } catch (err: any) {
      console.error("Presigned URL generation error:", err);
      res.status(500).json({ error: err.message || "Failed to generate presigned upload URL" });
    }
  });

  // GET /api/health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "Grezto" });
  });

  // POST /api/gateway - Secure Edge-Proxy Gateway (Phase 2)
  app.post("/api/gateway", sensitiveLimiter, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, error: "Token missing hai!" });
      }

      const idToken = authHeader.split("Bearer ")[1];
      let decodedToken: any = null;

      // 1. Verify token with Firebase Admin SDK
      if (admin.apps.length > 0) {
        try {
          decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch (adminErr: any) {
          console.warn("[GATEWAY] Admin SDK Token verification failed, trying Identity Toolkit REST API...", adminErr.message);
        }
      }

      // 2. Fallback to Identity Toolkit REST verification if Admin SDK failed or skipped
      if (!decodedToken) {
        try {
          const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "";
          if (!apiKey) {
            throw new Error("FIREBASE_API_KEY server-side is missing.");
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
          console.error("[GATEWAY] Token verification failed entirely:", restErr.message);
          return res.status(401).json({ success: false, error: `Invalid or Expired Firebase Token: ${restErr.message}` });
        }
      }

      const phone = decodedToken.phone_number || "";

      // 3. Connect to Supabase
      if (!supabase) {
        return res.status(500).json({ success: false, error: "Database not configured on server." });
      }

      const { action, payload } = req.body;
      let dbResult = null;

      const cleanGatewayPhone = (p: string) => (p || '').replace(/\D/g, '').slice(-10);

      if (action === "place_order") {
        if (phone) {
          const tokPhoneClean = cleanGatewayPhone(phone);
          const payPhoneClean = cleanGatewayPhone(payload.p_customer_phone);
          if (tokPhoneClean !== payPhoneClean) {
            return res.status(403).json({ success: false, error: "Hacker Alert: Apne account ke alawa kisi dusre number se order nahi daal sakte! 🛑" });
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
            return res.status(403).json({ success: false, error: "Hacker Alert: Dusre rider ki status change karna mana hai! 🛑" });
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
            return res.status(403).json({ success: false, error: "Hacker Alert: Dusre user ki profile change karna mana hai! 🛑" });
          }
        }

        const { data, error } = await supabase.rpc("upsert_user_profile", payload);
        if (error) throw error;
        dbResult = data;

      } else {
        return res.status(400).json({ success: false, error: `Invalid action command: ${action}` });
      }

      return res.status(200).json({ success: true, data: dbResult });

    } catch (err: any) {
      console.error("[GATEWAY ERROR]:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to execute database action through Gateway." });
    }
  });

  // GET /api/maps/config
  app.get("/api/maps/config", (req, res) => {
    const key = process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || "";
    res.json({ key });
  });

  // GET /api/distance (Google Distance Proxy with fallback)
  app.get("/api/distance", async (req, res) => {
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
        const R = 6371; // Earth's radius in km
        const dLatRad = (dLat - oLat) * Math.PI / 180;
        const dLonRad = (dLng - oLng) * Math.PI / 180;
        const a = 
          Math.sin(dLatRad/2) * Math.sin(dLatRad/2) +
          Math.cos(oLat * Math.PI / 180) * Math.cos(dLat * Math.PI / 180) * 
          Math.sin(dLonRad/2) * Math.sin(dLonRad/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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
        const distanceInKm = distanceValueInMeters / 1000;
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
        message: `Distance Matrix returned status ${data.status || 'not OK'}. Fallback used.`
      });
    } catch (err: any) {
      console.error("Error in /api/distance route:", err);
      return res.status(500).json({ error: "Internal distance calculation failure" });
    }
  });

  // GET /api/home-data (Dual-Layer Segmented Cache via Redis/Supabase - Fail-safe & Extremely Optimized)
  async function warmShopProductsCache(shopId: string) {
    try {
      if (!supabase) return;
      console.log(`[PRE-WARM] Background pre-warming products for shop: ${shopId}`);
      const { data, error } = await supabase.from('products').select('*').eq('shopId', shopId).is('deleted', false);
      if (!error && data) {
        const mapped = data.map((p: any) => ({
          ...p,
          stock: p.stock !== undefined ? p.stock : (p.inStock ? 10 : 0)
        }));
        await safeSet(`grezto:shop:${shopId}:products`, JSON.stringify(mapped), 3600);
        console.log(`[PRE-WARM SUCCESS] Warm products cache written for shop: ${shopId}`);
      }
    } catch (err: any) {
      console.error(`[PRE-WARM ERROR] Failed to pre-warm shop products cache for ${shopId}:`, err.message || err);
    }
  }

  async function warmCategoryProductsCache(category: string) {
    try {
      if (!supabase) return;
      console.log(`[PRE-WARM] Background pre-warming products for category: ${category}`);
      let query = supabase.from('products').select('*');
      if (category !== 'All') {
        query = query.eq('category', category);
      }
      const { data, error } = await query;
      if (!error && data) {
        const mapped = data.map((p: any) => ({
          ...p,
          stock: p.stock !== undefined ? p.stock : (p.inStock ? 10 : 0)
        }));
        await safeSet(`grezto:category:${category}:products`, JSON.stringify(mapped), 3600);
        console.log(`[PRE-WARM SUCCESS] Warm products cache written for category: ${category}`);
      }
    } catch (err: any) {
      console.error(`[PRE-WARM ERROR] Failed to pre-warm category products cache for ${category}:`, err.message || err);
    }
  }

  async function warmCityShopsCache(city: string) {
    try {
      if (!supabase) return;
      const cleanCity = city.trim().toLowerCase();
      console.log(`[PRE-WARM] Background pre-warming shops for city: ${cleanCity}`);
      const { data, error } = await supabase.from('shops').select('*');
      if (!error && data) {
        const allShops = data || [];
        const filteredShops = allShops.filter((s: any) => {
          if (s.status === 'blocked') return false;
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
        await safeSet(`grezto:shops:city:${cleanCity}`, JSON.stringify(filteredShops), 3600);
        console.log(`[PRE-WARM SUCCESS] Warm shops cache written for city: ${cleanCity}`);
      }
    } catch (err: any) {
      console.error(`[PRE-WARM ERROR] Failed to pre-warm city shops cache for ${city}:`, err.message || err);
    }
  }

  app.get("/api/home-data", async (req, res) => {
    try {
      if (!supabase) {
        return res.status(500).json({ error: "Database client is not initialized on server." });
      }

      const rawCity = req.query.city as string || "Kawarhagi";
      const city = rawCity.trim().toLowerCase();

      // Check cache in parallel
      const [cachedCategories, cachedBanners, cachedShops] = await Promise.all([
        safeGet("grezto:categories"),
        safeGet("grezto:banners"),
        safeGet(`grezto:shops:city:${city}`)
      ]);

      let categories = cachedCategories ? JSON.parse(cachedCategories) : null;
      let banners = cachedBanners ? JSON.parse(cachedBanners) : null;
      let shops = cachedShops ? JSON.parse(cachedShops) : null;

      const dbQueries: Promise<any>[] = [];

      if (!categories) {
        dbQueries.push((async () => {
          const { data, error } = await supabase.from('categories').select('*');
          if (error) throw error;
          categories = data || [];
          await safeSet("grezto:categories", JSON.stringify(categories), 86400); // Cache for 24 hours
        })());
      }

      if (!banners) {
        dbQueries.push((async () => {
          const { data, error } = await supabase.from('banners').select('*');
          if (error) throw error;
          banners = data || [];
          await safeSet("grezto:banners", JSON.stringify(banners), 86400); // Cache for 24 hours
        })());
      }

      if (!shops) {
        dbQueries.push((async () => {
          const { data, error } = await supabase.from('shops').select('*');
          if (error) throw error;
          const allShops = data || [];
          // Filter shops by city before caching
          const filteredShops = allShops.filter((s: any) => {
            if (s.status === 'blocked') return false;
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
          shops = filteredShops;
          await safeSet(`grezto:shops:city:${city}`, JSON.stringify(filteredShops), 3600); // Cache for 1 hour
        })());
      }

      if (dbQueries.length > 0) {
        console.log(`[REDIS] Cache MISS for some home segments. Loading from Supabase... (${dbQueries.length} segments)`);
        await Promise.all(dbQueries);
      } else {
        console.log(`[REDIS] Full cache HIT for home-data (city: ${city})`);
      }

      return res.json({
        shops: shops || [],
        banners: banners || [],
        categories: categories || [],
        timestamp: Date.now()
      });
    } catch (e: any) {
      console.error('[API] /api/home-data error:', e);
      res.status(500).json({ error: 'Failed to fetch home data' });
    }
  });

  // GET /api/products (Lazy-Load Segmented Category/Shop Products from Redis/Supabase - Fail-safe & Extremely Optimized)
  app.get("/api/products", async (req, res) => {
    try {
      const category = req.query.category as string;
      const shopId = req.query.shopId as string;

      if (!supabase) {
        return res.status(500).json({ error: "Database client is not initialized on server." });
      }

      // Pattern 1: Shop-based cache using high-availability safeGetOrSet
      if (shopId) {
        const cacheKey = `grezto:shop:${shopId}:products`;
        const products = await safeGetOrSet(cacheKey, async () => {
          console.log(`[DATABASE FETCH] Fetching products for shop: ${shopId} from Supabase...`);
          const { data, error } = await supabase.from('products').select('*').eq('shopId', shopId).is('deleted', false);
          if (error) throw error;
          const mapped = (data || []).map((p: any) => ({
            ...p,
            stock: p.stock !== undefined ? p.stock : (p.inStock ? 10 : 0)
          }));
          return mapped;
        }, 3600);

        return res.json({ products });
      }

      // Pattern 2: Category-based cache using high-availability safeGetOrSet
      if (category) {
        const cacheKey = `grezto:category:${category}:products`;
        const products = await safeGetOrSet(cacheKey, async () => {
          console.log(`[DATABASE FETCH] Fetching products for category: ${category} from Supabase...`);
          let query = supabase.from('products').select('*');
          if (category !== 'All') {
            query = query.eq('category', category);
          }
          const { data, error } = await query;
          if (error) throw error;
          const mapped = (data || []).map((p: any) => ({
            ...p,
            stock: p.stock !== undefined ? p.stock : (p.inStock ? 10 : 0)
          }));
          return mapped;
        }, 3600);

        return res.json({ products });
      }

      return res.status(400).json({ error: "Either category or shopId query parameter is required" });
    } catch (e: any) {
      console.error('[API] /api/products error:', e);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  // POST /api/products/toggle-stock (Merchant/Admin toggles stock status)
  app.post("/api/products/toggle-stock", validateFirebaseToken, async (req, res) => {
    try {
      const rawProductId = req.body.productId;
      const rawInStock = req.body.inStock;
      const rawShopId = req.body.shopId;
      const rawCategory = req.body.category;

      // Pure Data Enforcement / Sanitization
      if (!rawProductId || typeof rawInStock !== 'boolean') {
        return res.status(400).json({ error: "productId and inStock are required parameters." });
      }

      const productId = String(rawProductId).trim();
      const inStock = Boolean(rawInStock);
      const shopId = rawShopId ? String(rawShopId).trim() : undefined;
      const category = rawCategory ? String(rawCategory).trim() : undefined;

      if (!supabase) {
        return res.status(500).json({ error: "Database client is not initialized on server." });
      }

      // [PHASE 3: DATABASE OWNERSHIP VALIDATION & RBAC Check]
      const userPhone = (req as any).user?.phone_number || "";
      const isAuthorized = await verifyProductOwnership(userPhone, productId);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, error: "Access Denied: You are not authorized to modify this product's stock status." });
      }

      console.log(`[WRITE API] Toggling stock status for product ${productId} to ${inStock}`);
      const { error } = await supabase.from('products').update({ inStock }).eq('id', productId);
      if (error) throw error;

      // [PILLAR 2: WRITE-THROUGH & INVALIDATION FLOW]
      // 1. Database Write was successful at this point.
      // 2. Selective Invalidation: Instantly clear only the affected shop's cache key.
      if (shopId) {
        await safeDel(`grezto:shop:${shopId}:products`);
        console.log(`[PILLAR 2 - REDIS EVICTION] Selective eviction complete for shop: ${shopId}`);
        
        // 3. Background Pre-Warming: Run query in background and warm the cache
        // Use setImmediate to ensure it runs completely asynchronously without delaying the client response
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
    } catch (e: any) {
      console.error('[WRITE API] /api/products/toggle-stock error:', e);
      res.status(500).json({ error: 'Failed to toggle product stock status' });
    }
  });

  // POST /api/products/upsert (Merchant/Admin inserts or edits a product)
  app.post("/api/products/upsert", validateFirebaseToken, async (req, res) => {
    try {
      const rawProductData = req.body.productData;
      if (!rawProductData || !rawProductData.id) {
        return res.status(400).json({ error: "productData containing id is required." });
      }

      // Phase 4: Schema Sanitization & Pure Data Enforcement Whitelisting
      const productData = sanitizeProductPayload(rawProductData);

      if (!supabase) {
        return res.status(500).json({ error: "Database client is not initialized on server." });
      }

      // [PHASE 3: DATABASE OWNERSHIP VALIDATION & RBAC Check]
      const userPhone = (req as any).user?.phone_number || "";
      const shopId = productData.shopId;
      if (!shopId) {
        return res.status(400).json({ error: "shopId is required inside productData." });
      }

      // 1. If editing an existing product, verify they own the original product's shop
      const { data: existingProd } = await supabase
        .from('products')
        .select('shopId')
        .eq('id', productData.id)
        .maybeSingle();

      if (existingProd) {
        const isAuthorizedExisting = await verifyShopOwnershipOrTeam(userPhone, existingProd.shopId);
        if (!isAuthorizedExisting) {
          return res.status(403).json({ success: false, error: "Access Denied: You are not authorized to update this product." });
        }
      }

      // 2. Verify they own the destination shop
      const isAuthorizedTarget = await verifyShopOwnershipOrTeam(userPhone, shopId);
      if (!isAuthorizedTarget) {
        return res.status(403).json({ success: false, error: "Access Denied: You are not authorized to add/modify products for this shop." });
      }

      console.log(`[WRITE API] Upserting product ${productData.id}`);
      const { error } = await supabase.from('products').upsert(productData);
      if (error) throw error;

      // [PILLAR 2: WRITE-THROUGH & INVALIDATION FLOW]
      // 1. Database Write was successful at this point.
      // 2. Selective Invalidation: Instantly clear only the affected shop's cache key.
      if (productData.shopId) {
        await safeDel(`grezto:shop:${productData.shopId}:products`);
        console.log(`[PILLAR 2 - REDIS EVICTION] Selective eviction complete for shop: ${productData.shopId}`);
        
        // 3. Background Pre-Warming: Run query in background and warm the cache
        // Use setImmediate to ensure it runs completely asynchronously without delaying the client response
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
      }

      return res.json({ success: true, message: "Product upserted, selective cache invalidated, and background pre-warming triggered.", data: productData });
    } catch (e: any) {
      console.error('[WRITE API] /api/products/upsert error:', e);
      res.status(500).json({ error: 'Failed to upsert product' });
    }
  });

  // POST /api/products/delete (Merchant/Admin deletes a product)
  app.post("/api/products/delete", validateFirebaseToken, async (req, res) => {
    try {
      const { productId, shopId, category } = req.body;
      if (!productId) {
        return res.status(400).json({ error: "productId is required." });
      }

      if (!supabase) {
        return res.status(500).json({ error: "Database client is not initialized on server." });
      }

      // [PHASE 3: DATABASE OWNERSHIP VALIDATION & RBAC Check]
      const userPhone = (req as any).user?.phone_number || "";
      const isAuthorized = await verifyProductOwnership(userPhone, productId);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, error: "Access Denied: You are not authorized to delete this product." });
      }

      console.log(`[WRITE API] Deleting product ${productId}`);
      const { error } = await supabase.from('products').delete().eq('id', productId);
      if (error) throw error;

      // [PILLAR 2: WRITE-THROUGH & INVALIDATION FLOW]
      // 1. Database Write was successful at this point.
      // 2. Selective Invalidation: Instantly clear only the affected shop's cache key.
      if (shopId) {
        await safeDel(`grezto:shop:${shopId}:products`);
        console.log(`[PILLAR 2 - REDIS EVICTION] Selective eviction complete for shop: ${shopId}`);
        
        // 3. Background Pre-Warming: Run query in background and warm the cache
        // Use setImmediate to ensure it runs completely asynchronously without delaying the client response
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

      return res.json({ success: true, message: "Product deleted, selective cache invalidated, and background pre-warming triggered." });
    } catch (e: any) {
      console.error('[WRITE API] /api/products/delete error:', e);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  // POST /api/shops/update (Merchant/Admin updates, pins, deletes, or toggles shop status)
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

      // Phase 4: Schema Sanitization & Pure Data Enforcement Whitelisting
      const shopId = String(rawShopId).trim();
      const city = rawCity ? String(rawCity).trim() : undefined;
      const updateData = sanitizeShopUpdatePayload(rawUpdateData);
      const isUpsert = Boolean(rawIsUpsert);
      const isDelete = Boolean(rawIsDelete);

      if (!supabase) {
        return res.status(500).json({ error: "Database client is not initialized on server." });
      }

      // [PHASE 3: DATABASE OWNERSHIP VALIDATION & RBAC Check]
      const userPhone = (req as any).user?.phone_number || "";

      if (isDelete || isUpsert) {
        // High risk: delete or upsert (create new shop) must be restricted to Master Admins
        if (!isMasterAdmin(userPhone)) {
          return res.status(403).json({ success: false, error: "Access Denied: Only Master Admins can create or delete shops." });
        }
      } else {
        // General updates must be restricted to the shop's owner or active team members
        const isAuthorized = await verifyShopOwnershipOrTeam(userPhone, shopId);
        if (!isAuthorized) {
          return res.status(403).json({ success: false, error: "Access Denied: You are not authorized to update settings for this shop." });
        }
      }

      console.log(`[WRITE API] Modifying shop ${shopId} (isDelete: ${!!isDelete}, isUpsert: ${!!isUpsert})`);
      if (isDelete) {
        const { error } = await supabase.from('shops').delete().eq('id', shopId);
        if (error) throw error;
      } else if (isUpsert) {
        const { error } = await supabase.from('shops').upsert({ id: shopId, ...updateData });
        if (error) {
          if (error.code === '42703') {
            console.warn('[SUPABASE UPSERT] Missing columns. Retrying upsert without type and defaultCategory.');
            const safeUpdateData = { id: shopId, ...updateData };
            delete safeUpdateData.type;
            delete safeUpdateData.defaultCategory;
            const { error: retryError } = await supabase.from('shops').upsert(safeUpdateData);
            if (retryError) throw retryError;
          } else {
            throw error;
          }
        }
      } else {
        const { error } = await supabase.from('shops').update(updateData).eq('id', shopId);
        if (error) {
          if (error.code === '42703') {
            console.warn('[SUPABASE UPDATE] Missing columns. Retrying update without type and defaultCategory.');
            const safeUpdateData = { ...updateData };
            delete safeUpdateData.type;
            delete safeUpdateData.defaultCategory;
            const { error: retryError } = await supabase.from('shops').update(safeUpdateData).eq('id', shopId);
            if (retryError) throw retryError;
          } else {
            throw error;
          }
        }
      }

      // Active Cache Eviction for Shop lists in the specified city (and Kawarhagi, Guwahati, Morigaon to be extremely thorough)
      const citiesToEvict = new Set<string>(["kawarhagi", "guwahati", "morigaon"]);
      if (city) {
        citiesToEvict.add(city.trim().toLowerCase());
      }
      for (const c of citiesToEvict) {
        await safeDel(`grezto:shops:city:${c}`);
        warmCityShopsCache(c); // Trigger background pre-warming for city lists!
      }
      console.log(`[REDIS EVICTION] Evicted shop lists cache for cities: ${Array.from(citiesToEvict).join(", ")}`);

      return res.json({ success: true, message: "Shop modified, city list caches evicted, and background pre-warming triggered." });
    } catch (e: any) {
      console.error('[WRITE API] /api/shops/update error:', e);
      res.status(500).json({ error: 'Failed to update shop' });
    }
  });

  // POST /api/auth/verify-otp
  app.post("/api/auth/verify-otp", sensitiveLimiter, async (req, res) => {
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
          if (idToken && admin.apps.length > 0) {
            try {
              const decodedToken = await admin.auth().verifyIdToken(idToken);
              verifiedUid = decodedToken.uid;
            } catch (tokenVerifyErr: any) {
              console.warn("[OTP] Token verify bypassed:", tokenVerifyErr.message);
            }
          }

          if (admin.apps.length > 0) {
            if (verifiedUid) {
              try {
                userRecord = await admin.auth().getUser(verifiedUid);
              } catch {
                try {
                  userRecord = await admin.auth().getUserByPhoneNumber(resPhone);
                } catch {
                  userRecord = await admin.auth().createUser({
                    uid: verifiedUid,
                    phoneNumber: resPhone,
                    disabled: false,
                  });
                }
              }
            } else {
              try {
                userRecord = await admin.auth().getUserByPhoneNumber(resPhone);
              } catch {
                userRecord = await admin.auth().createUser({
                  phoneNumber: resPhone,
                  disabled: false,
                });
              }
            }

            const customToken = await admin.auth().createCustomToken(userRecord.uid);
            return res.json({
              success: true,
              message: "SMS OTP synced securely!",
              uid: userRecord.uid,
              phoneNumber: userRecord.phoneNumber,
              customToken
            });
          }

          return res.json({
            success: true,
            message: "Client verification accepted!",
            uid: verifiedUid || `temp_${formattedPhone}`,
            phoneNumber: resPhone
          });
        } catch (adminErr: any) {
          return res.json({
            success: true,
            message: "SMS OTP validated successfully (bypass mode)!",
            uid: verifiedUid || `temp_${formattedPhone}`,
            phoneNumber: resPhone
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
          
          const resultData: any = await checkResponse.json();
          if (!checkResponse.ok || resultData.error) {
            const rawErrorMsg = resultData.error?.message || "Invalid or expired OTP code.";
            let userFriendlyMsg = "Verification failed. Please check the OTP code and try again.";
            if (rawErrorMsg.includes("INVALID_CODE")) {
              userFriendlyMsg = "Galat OTP! Kripya sahi 6-digit code enter karein. 🛑";
            } else if (rawErrorMsg.includes("SESSION_EXPIRED")) {
              userFriendlyMsg = "OTP verification session expired ho chuka hai. Kripya naya OTP request karein. ⌛";
            }
            return res.status(400).json({ error: userFriendlyMsg, rawError: rawErrorMsg });
          }
          
          let resPhoneVal = resultData.phoneNumber || "";
          const cleanedResPhone = resPhoneVal.replace(/\D/g, "");
          if (resPhoneVal && !cleanedResPhone.endsWith(formattedPhone)) {
            return res.status(400).json({ error: "Security Alert: Verified phone number does not match!" });
          }

          if (admin.apps.length > 0) {
            let userRecord;
            try {
              userRecord = await admin.auth().getUserByPhoneNumber(resPhoneVal || `+91${formattedPhone}`);
            } catch {
              userRecord = await admin.auth().createUser({
                phoneNumber: resPhoneVal || `+91${formattedPhone}`,
                disabled: false,
              });
            }

            const customToken = await admin.auth().createCustomToken(userRecord.uid);
            return res.json({
              success: true,
              message: "Firebase SMS OTP verified!",
              uid: userRecord.uid,
              phoneNumber: userRecord.phoneNumber,
              customToken,
              isNewUser: resultData.isNewUser || false
            });
          }

          return res.json({
            success: true,
            message: "Firebase SMS OTP verified successfully!",
            uid: resultData.localId,
            phoneNumber: resultData.phoneNumber || `+91${formattedPhone}`,
            idToken: resultData.idToken
          });
        } catch (fetchErr: any) {
          console.error("[OTP] Network fetch failed:", fetchErr);
          return res.status(500).json({ error: "Unable to reach verification servers. Please try again." });
        }
      }
      
      return res.status(400).json({ error: "Missing configuration or verification ID" });
    } catch (err: any) {
      console.error("Verify OTP Error:", err);
      res.status(500).json({ error: "Failed to verify. Please try again." });
    }
  });

  // Server-side Gemini AI support chat route
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
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      res.status(500).json({ error: err.message || "Something went wrong with the AI Assistant." });
    }
  });

  // POST /api/orders/notify (Send updates/notifications)
  app.post("/api/orders/notify", async (req, res) => {
    const { orderId, amount, customerName, userId, status } = req.body;
    console.log(`NEW ORDER UPDATE: ${orderId} - Status: ${status || 'New'} - ₹${amount} - ${customerName}`);
    
    try {
      if (admin.apps.length > 0 && userId) {
        if (firebaseConfig?.projectId && firebaseConfig?.apiKey) {
          const { projectId, apiKey } = firebaseConfig;
          const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/device_tokens/${userId}?key=${apiKey}`;
          const docRes = await fetch(url);
          if (docRes.ok) {
            const docData: any = await docRes.json();
            let token = null;
            if (docData.fields?.token?.stringValue) {
              token = docData.fields.token.stringValue;
            }
            
            if (token) {
              await admin.messaging().send({
                token: token,
                notification: {
                  title: 'Order Status Update 🚀',
                  body: `Order ${orderId?.slice(-5).toUpperCase()} is now ${status || 'updated'}`
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
    } catch (e: any) {
      console.warn("Failed to send push notification:", e.message);
    }
    
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const indexHtml = path.join(distPath, 'index.html');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(200).json({
          success: true,
          message: "Grezto Secure Backend API Service is active 🚀",
          status: "healthy",
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
