-- 1. Extension For UUID Generation (For Error tracking)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USERS (Pehle ka 'profiles' ab 'users' ho gaya hai)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- Firebase Auth UID use hoga
  phone TEXT UNIQUE,
  name TEXT,
  role TEXT DEFAULT 'Customer', 
  avatar TEXT, -- Profile Image URL
  points INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. SHOPS (Upgraded with Location & Payout Ledgers)
CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  rating NUMERIC(3,1) DEFAULT 0.0,
  "ratingCount" INTEGER DEFAULT 0,
  "minTime" INTEGER,
  "maxTime" INTEGER,
  distance TEXT,
  promo TEXT,
  image TEXT,
  status TEXT DEFAULT 'Open',
  "isOpen" BOOLEAN DEFAULT true, -- For temporary merchant offline
  pinned BOOLEAN DEFAULT false,
  "ownerPhone" TEXT,
  "ownerName" TEXT,
  address TEXT,
  lat NUMERIC(10,6),
  lng NUMERIC(10,6),
  payouts JSONB, -- For Merchant Ledger / Payout tracking
  "ledgerResetDate" TEXT,
  "currentLedgerOTP" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. PRODUCTS (Upgraded with Soft Delete Superpower)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  "shopId" TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  "shopName" TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  "originalPrice" NUMERIC(10,2),
  discount INTEGER DEFAULT 0,
  image TEXT,
  category TEXT,
  rating NUMERIC(3,1) DEFAULT 0.0,
  "isBestSeller" BOOLEAN DEFAULT false,
  "inStock" BOOLEAN DEFAULT true,
  deleted BOOLEAN DEFAULT false, -- Soft delete so old orders don't break
  status TEXT DEFAULT 'Active',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. BANNERS
CREATE TABLE IF NOT EXISTS banners (
  id TEXT PRIMARY KEY,
  title TEXT,
  subtitle TEXT,
  image TEXT,
  link TEXT,
  "isActive" BOOLEAN DEFAULT true
);

-- 6. CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image TEXT,
  "isActive" BOOLEAN DEFAULT true
);

-- 7. CITIES (New for Admin Master Cities module)
CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'Active',
  pincodes JSONB,
  "radiusKm" NUMERIC(10,2) DEFAULT 0,
  image TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. ORDERS (Upgraded with fast Array shopIds & NEW Rider Acceptance Columns)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE SET NULL, 
  "customerName" TEXT,
  "customerPhone" TEXT,
  "partnerName" TEXT, 
  "partnerPhone" TEXT,
  "shopIds" TEXT[], -- Super Fast merchant tracking
  items JSONB NOT NULL,
  "totalAmount" NUMERIC(10,2) NOT NULL,
  "deliveryCharge" NUMERIC(10,2) DEFAULT 0.00,
  "platformFee" NUMERIC(10,2) DEFAULT 0.00,
  "finalAmount" NUMERIC(10,2) NOT NULL,
  address JSONB NOT NULL,
  status TEXT DEFAULT 'Pending',
  "paymentMethod" TEXT DEFAULT 'COD',
  "deliveryOtp" TEXT,
  "riderAccepted" BOOLEAN DEFAULT false, -- 🔥 NAYA COLUMN ADDED
  "acceptedAt" TIMESTAMP WITH TIME ZONE,      -- 🔥 NAYA COLUMN ADDED
  "assignedAt" TIMESTAMP WITH TIME ZONE,
  "deliveredAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. LIVE TRACKING (NAYA: Rider Live Map)
CREATE TABLE IF NOT EXISTS tracking (
  id TEXT PRIMARY KEY, -- Rider partnerPhone or ID
  phone TEXT,
  active BOOLEAN DEFAULT true,
  location JSONB, -- { latitude: 26.1, longitude: 91.7 }
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. SYSTEM CONFIG (NAYA: Global Duty)
CREATE TABLE IF NOT EXISTS system_config (
  id TEXT PRIMARY KEY DEFAULT 'config',
  "isSystemOnline" BOOLEAN DEFAULT true,
  "systemReopenTime" TIMESTAMP WITH TIME ZONE
);

-- 11. DEVICE TOKENS (NAYA: Push Notifications)
CREATE TABLE IF NOT EXISTS device_tokens (
  id TEXT PRIMARY KEY, -- User ID or Phone
  token TEXT NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. APP ERRORS (Crash Logger)
CREATE TABLE IF NOT EXISTS app_errors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE SET NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  device_info JSONB,
  app_version TEXT,
  resolved BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. TEAM / RIDER TABLE (Upgraded & Unified)
CREATE TABLE IF NOT EXISTS public.team (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'Rider',
  status TEXT DEFAULT 'Offline',
  vehicle TEXT,
  "codBalanceInit" NUMERIC DEFAULT 0,
  "totalCollectedCash" NUMERIC DEFAULT 0,
  "codBalance" NUMERIC DEFAULT 0,
  "lastSettledDate" TEXT,
  "rating" TEXT,
  "unregistered" BOOLEAN DEFAULT false,
  "dailySettlements" JSONB,
  "totalOrdersDelivered" NUMERIC DEFAULT 0,
  "liveEarnings" NUMERIC DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

---------------------------------------------------
-- 🔥 SPEED BOOSTERS: Array Indexes (Lightning Fast)
---------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_shopId ON products("shopId");
CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders("userId");
CREATE INDEX IF NOT EXISTS idx_orders_customerPhone ON orders("customerPhone");
CREATE INDEX IF NOT EXISTS idx_orders_partnerPhone ON orders("partnerPhone");
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_shopIds ON orders USING GIN ("shopIds");

---------------------------------------------------
-- 🔥 AUTOMATION: Auto Timestamp Triggers (SAFELY DROPPED FIRST)
---------------------------------------------------
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Purane triggers ko safely drop kar rahe hain taaki error na aaye
DROP TRIGGER IF EXISTS set_timestamp_users ON users;
DROP TRIGGER IF EXISTS set_timestamp_shops ON shops;
DROP TRIGGER IF EXISTS set_timestamp_products ON products;
DROP TRIGGER IF EXISTS set_timestamp_orders ON orders;
DROP TRIGGER IF EXISTS set_timestamp_cities ON cities;
DROP TRIGGER IF EXISTS set_timestamp_tracking ON tracking;
DROP TRIGGER IF EXISTS set_timestamp_device_tokens ON device_tokens;
DROP TRIGGER IF EXISTS set_timestamp_team ON public.team;

-- Naye triggers apply kar rahe hain safely
CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER set_timestamp_shops BEFORE UPDATE ON shops FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER set_timestamp_products BEFORE UPDATE ON products FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER set_timestamp_orders BEFORE UPDATE ON orders FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER set_timestamp_cities BEFORE UPDATE ON cities FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER set_timestamp_tracking BEFORE UPDATE ON tracking FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER set_timestamp_device_tokens BEFORE UPDATE ON device_tokens FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER set_timestamp_team BEFORE UPDATE ON public.team FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

---------------------------------------------------
-- ⚡ AUTOMATIC REALTIME SUBSCRIPTION MAKER
---------------------------------------------------
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE orders, shops, products, tracking, system_config, categories, cities, users;

---------------------------------------------------
-- SECURITY: RLS & POLICIES (SAFELY RE-CREATED)
---------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team ENABLE ROW LEVEL SECURITY;

-- Purani policies drop karke fresh copy bana rahe hain safely
DROP POLICY IF EXISTS "Public Users" ON users;
DROP POLICY IF EXISTS "Public Shops" ON shops;
DROP POLICY IF EXISTS "Public Products" ON products;
DROP POLICY IF EXISTS "Public Banners" ON banners;
DROP POLICY IF EXISTS "Public Categories" ON categories;
DROP POLICY IF EXISTS "Public Orders" ON orders;
DROP POLICY IF EXISTS "Public Tracking" ON tracking;
DROP POLICY IF EXISTS "Public System Config" ON system_config;
DROP POLICY IF EXISTS "Public Cities" ON cities;
DROP POLICY IF EXISTS "Public Device Tokens" ON device_tokens;
DROP POLICY IF EXISTS "Public Errors" ON app_errors;
DROP POLICY IF EXISTS "Public Team" ON public.team;

CREATE POLICY "Public Users" ON users FOR ALL USING (true);
CREATE POLICY "Public Shops" ON shops FOR ALL USING (true);
CREATE POLICY "Public Products" ON products FOR ALL USING (true);
CREATE POLICY "Public Banners" ON banners FOR ALL USING (true);
CREATE POLICY "Public Categories" ON categories FOR ALL USING (true);
CREATE POLICY "Public Orders" ON orders FOR ALL USING (true);
CREATE POLICY "Public Tracking" ON tracking FOR ALL USING (true);
CREATE POLICY "Public System Config" ON system_config FOR ALL USING (true);
CREATE POLICY "Public Cities" ON cities FOR ALL USING (true);
CREATE POLICY "Public Device Tokens" ON device_tokens FOR ALL USING (true);
CREATE POLICY "Public Errors" ON app_errors FOR ALL USING (true);
CREATE POLICY "Public Team" ON public.team FOR ALL USING (true);

-- Realtime main team table ko safely add karna
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.team;
EXCEPTION WHEN OTHERS THEN
  -- Already added hoto skip karega
END;
$$;