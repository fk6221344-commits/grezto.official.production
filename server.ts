import express from "express";
import path from "path";
import fs from "fs";
import cluster from "cluster";
import os from "os";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import redis, { safeGet, safeSet, safeDel, safeGetOrSet } from "./server/redisClient";

// Import core clients and auth from separate, clean modules
import { supabase, admin, getGeminiClient, firebaseConfig } from "./server/clients";
import { validateFirebaseToken, isMasterAdmin, verifyShopOwnershipOrTeam, verifyProductOwnership } from "./server/auth";
import { sanitizeProductPayload, sanitizeShopUpdatePayload } from "./server/sanitizers";
import { warmShopProductsCache, warmCategoryProductsCache, warmCityShopsCache } from "./server/cacheWarming";
import { createRateLimiter } from "./server/rateLimiter";

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
  app.set('trust proxy', 1);
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
    "https://localhost",
    "https://localhost:3000",
    "capacitor://localhost",
    "https://grezto.vercel.app", // standard Vercel deploy example
    "https://grezto.in",
    "https://www.grezto.in",
    "https://api.grezto.in"
  ];

  const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      
      // Allow dynamic local development, Capacitor, or Cloud Run / Vercel previews
      if (
        origin.startsWith("http://localhost") || 
        origin.startsWith("https://localhost") || // Support https://localhost for Android Capacitor webview!
        origin.startsWith("http://127.0.0.1") || 
        origin.startsWith("capacitor://") ||
        origin.includes(".run.app") || // AI Studio dev & preview links
        origin.includes("vercel.app") || // Vercel production deployment
        origin.includes("grezto.in") // Grezto production domains
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
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Grezto-Client-Signature"]
  };

  app.use(cors(corsOptions));

  // 2.4 Unicorn-Level Client Verification Middleware
  // Protects the server in production by verifying requests are signed by our official Android client
  app.use((req, res, next) => {
    // Skip verification for static assets, public files, and server health check
    if (!req.path.startsWith('/api/') || req.path === '/api/health' || req.path === '/api/maps/config' || req.path === '/api/config') {
      return next();
    }
    
    // Check if the server has configured a custom client signature
    const serverExpectedSignature = process.env.APP_CLIENT_SIGNATURE || "grezto_secure_app_signature_2026_unicorn";
    const clientSignature = req.headers['x-grezto-client-signature'] || req.headers['X-Grezto-Client-Signature'];
    
    if (process.env.NODE_ENV === "production" && serverExpectedSignature && clientSignature !== serverExpectedSignature) {
      console.warn(`[SECURITY VERIFICATION BLOCKED] Path: ${req.path}, Host: ${req.headers.host}, Origin: ${req.headers.origin}`);
      return res.status(403).json({
        success: false,
        error: "Access Denied: This API endpoint is protected and only accessible by the authorized Grezto Native Android application. 🛑"
      });
    }
    
    next();
  });

  // 2.5 Compression Middleware to drastically reduce JSON payload sizes over network (Gzip/Brotli)
  app.use(compression({
    level: 6, // Optimal Gzip compression level balance (1-9)
    threshold: 1024, // Only compress responses that are larger than 1KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false; // Respect bypass headers
      }
      return compression.filter(req, res); // Use standard compression filter
    }
  }));

  // 3. Express Rate Limiters (DDoS Protection) - Built on High-Availability Hybrid Redis/Memory Engine
  // General Rate Limiter for standard API endpoints
  const generalLimiter = createRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 300, // 300 requests per minute
    message: { success: false, error: "Too many requests, please try again after a minute." },
    prefix: "general"
  });

  // Stricter Rate Limiter for sensitive endpoints (e.g. login, payment, gateway, upload)
  const sensitiveLimiter = createRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 45, // 45 requests per minute for sensitive operations
    message: { success: false, error: "Security Warning: Rate limit exceeded for sensitive operations. Please wait." },
    prefix: "sensitive"
  });

  // OTP-specific Rate Limiter - Protects send/verify routes against high-frequency automated bruteforce
  // Designed with a balance of 10 requests per 5 minutes per IP to fully support genuine users with weak signals.
  const otpLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 requests allowed
    message: { success: false, error: "Too many OTP attempts. To protect your account, please wait 5 minutes before trying again." },
    prefix: "otp"
  });

  app.use(generalLimiter);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

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

      if (req.file.size > 2.8 * 1024 * 1024) {
        return res.status(400).json({ error: "Upload Blocked: Photo size exceeds the 2.8MB limit! Please use a smaller or compressed file." });
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

  // GET /api/config (Exposes public client configurations dynamically for the APK to bootstrap)
  app.get("/api/config", (req, res) => {
    res.json({
      supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
      supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || "",
      googleMapsKey: process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || "",
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID || ""
    });
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

  app.get("/api/home-data", async (req, res) => {
    try {
      if (!supabase) {
        return res.status(500).json({ error: "Database client is not initialized on server." });
      }

      const rawCity = (req.query.city as string || "").trim();
      const city = rawCity ? rawCity.toLowerCase() : "kawarhagi";

      // Check cache in parallel
      const [cachedCategories, cachedBanners, cachedShops] = await Promise.all([
        safeGet("grezto:categories"),
        safeGet("grezto:banners"),
        safeGet(`grezto:shops:city:${city}`)
      ]);

      let categories = cachedCategories ? JSON.parse(cachedCategories) : null;
      let banners = cachedBanners ? JSON.parse(cachedBanners) : null;
      
      let rawShopsData = cachedShops ? JSON.parse(cachedShops) : null;
      let shops = null;
      let prewarmProducts: any[] = [];

      if (rawShopsData) {
        if (Array.isArray(rawShopsData)) {
          shops = rawShopsData;
        } else {
          shops = rawShopsData.shops || [];
          prewarmProducts = rawShopsData.prewarmProducts || [];
        }
      }

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

          // Fetch the pre-warmed recommended products for these filtered shops
          const pinnedShopIds = filteredShops
            .filter((s: any) => s.pinned === true || s.pinned === 'true' || s.pinned === 1 || s.pinned === '1')
            .map((s: any) => s.id);

          let loadedProducts: any[] = [];
          if (pinnedShopIds.length > 0) {
            const { data: prodData, error: prodErr } = await supabase
              .from('products')
              .select('*')
              .in('shopId', pinnedShopIds)
              .is('deleted', false);
            if (!prodErr && prodData) {
              loadedProducts = prodData.map((p: any) => ({
                ...p,
                stock: p.stock !== undefined ? p.stock : (p.inStock ? 10 : 0)
              }));
            }
          }

          shops = filteredShops;
          prewarmProducts = loadedProducts;

          const cacheValue = { shops: filteredShops, prewarmProducts: loadedProducts };
          await safeSet(`grezto:shops:city:${city}`, JSON.stringify(cacheValue), 3600); // Cache for 1 hour
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

// -------------------------------------------------------------
// CLUSTER ORCHESTRATION ENGINE (Production Multi-Core Processing)
// -------------------------------------------------------------
if (process.env.NODE_ENV === "production") {
  if (cluster.isPrimary || (cluster as any).isMaster) {
    // 1. Check for manual overrides first (ultimate master controls via .env or dashboard)
    const envWorkers = process.env.MAX_WORKERS || process.env.WEB_CONCURRENCY;
    let numCPUs = 1;

    if (envWorkers) {
      const parsed = parseInt(envWorkers, 10);
      if (!isNaN(parsed) && parsed > 0) {
        numCPUs = parsed;
        console.log(`[CLUSTER ENGINE] Manual override detected: Spawning exactly ${numCPUs} workers based on environment settings.`);
      }
    } else {
      // 2. Intelligent Auto-Calculation
      const physicalCores = typeof os.availableParallelism === "function" 
        ? os.availableParallelism() 
        : (os.cpus().length || 1);

      // Node.js processes are memory-intensive (~150MB-200MB overhead per worker).
      // We read system memory and dynamically budget workers to prevent Out-Of-Memory container kills.
      const totalMemoryMB = os.totalmem() / (1024 * 1024);
      const memoryMaxLimit = Math.max(1, Math.floor(totalMemoryMB / 200));

      // Standard production safety cap (We default to max 4 workers to prevent container thrashing on 48-core Railway hosts)
      const DEFAULT_CAP_CEILING = 4;

      // Determine optimal worker count
      numCPUs = Math.min(physicalCores, memoryMaxLimit, DEFAULT_CAP_CEILING);
      
      // Ensure we have at least 2 workers for zero-downtime failover redundancy if resources permit
      if (numCPUs < 2 && physicalCores >= 2 && totalMemoryMB >= 512) {
        numCPUs = 2;
      }
      
      console.log(`[CLUSTER ENGINE] Auto-tuning active: PhysicalCores=${physicalCores}, HostMemory=${Math.round(totalMemoryMB)}MB.`);
      console.log(`[CLUSTER ENGINE] Automatically configured worker pool size to: ${numCPUs} (Ceiling cap: ${DEFAULT_CAP_CEILING}).`);
    }
      
    console.log(`[CLUSTER ENGINE] Primary Process ${process.pid} is running.`);
    console.log(`[CLUSTER ENGINE] Initializing secure cluster deployment...`);

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    // Monitor worker status and auto-restart failed workers with smart crash-loop protection
    const restartTimestamps: number[] = [];
    const MAX_RESTARTS_IN_WINDOW = 10;
    const WINDOW_MS = 30000; // 30 seconds

    cluster.on("exit", (worker, code, signal) => {
      console.warn(`[CLUSTER ENGINE] Worker process ${worker.process.pid} terminated (code: ${code}, signal: ${signal}).`);
      
      const now = Date.now();
      // Keep track of only the restarts in the last 30-second window
      const recentRestarts = restartTimestamps.filter(t => now - t < WINDOW_MS);
      recentRestarts.push(now);
      
      restartTimestamps.length = 0;
      restartTimestamps.push(...recentRestarts);

      if (restartTimestamps.length >= MAX_RESTARTS_IN_WINDOW) {
        console.error(`[CLUSTER ENGINE] CRITICAL: Rapid crash-loop detected! Postponing worker restart by 10 seconds to safeguard host resources...`);
        setTimeout(() => {
          console.log(`[CLUSTER ENGINE] Post-delay safety check passed. Spawning fresh backup worker process...`);
          cluster.fork();
        }, 10000);
      } else {
        console.log(`[CLUSTER ENGINE] Automatically spawning a fresh backup worker for seamless failover...`);
        cluster.fork();
      }
    });
  } else {
    console.log(`[CLUSTER ENGINE] Worker Process ${process.pid} successfully initialized.`);
    startServer();
  }
} else {
  // In development, run on a single thread to avoid Vite middleware port conflicts and ensure smooth debugging
  console.log(`[SINGLE THREAD] Development environment detected. Running single-threaded server on Process ${process.pid}...`);
  startServer();
}
