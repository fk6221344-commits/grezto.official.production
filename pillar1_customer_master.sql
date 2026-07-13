-- =====================================================================================
-- GREZTO SUPER APP - PILLAR 1: CUSTOMER CORE DATABASE SCHEMA & SECURITY MODULE
-- Designed for 100% Native Android (Capacitor) and Production-Grade Scale
-- =====================================================================================

-- STEP 1: Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- STEP 2: Create Profiles Table (Synced with Firebase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY, -- Firebase Auth UID
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'Customer', 
  avatar TEXT, -- Profile Image URL
  points INTEGER DEFAULT 0,
  address TEXT, -- Primary saved text address
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 3: Create Users Table (Secondary/Fallback sync)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'Customer', 
  avatar TEXT,
  points INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 4: Create Master Catalogs (Shops, Products, Banners, Categories, Cities)
CREATE TABLE IF NOT EXISTS public.shops (
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
  "isOpen" BOOLEAN DEFAULT true,
  pinned BOOLEAN DEFAULT false,
  type TEXT DEFAULT 'grocery',
  "defaultCategory" TEXT DEFAULT 'Vegetables',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  "shopId" TEXT REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  "originalPrice" NUMERIC(10,2),
  image TEXT,
  description TEXT,
  category TEXT,
  rating NUMERIC(3,1) DEFAULT 0.0,
  "ratingCount" INTEGER DEFAULT 0,
  "isAvailable" BOOLEAN DEFAULT true,
  "isOrganic" BOOLEAN DEFAULT false,
  "vegType" TEXT DEFAULT 'Veg',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.banners (
  id TEXT PRIMARY KEY,
  image TEXT NOT NULL,
  "shopId" TEXT REFERENCES public.shops(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'Active',
  pincodes JSONB,
  "radiusKm" NUMERIC(10,2) DEFAULT 0,
  image TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 5: Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY DEFAULT ('OR-' || upper(substring(gen_random_uuid()::text from 1 for 6))),
  "userId" TEXT REFERENCES public.profiles(id) ON DELETE SET NULL, 
  "customerName" TEXT,
  "customerPhone" TEXT,
  "partnerName" TEXT, 
  "partnerPhone" TEXT,
  "shopIds" TEXT[], 
  items JSONB NOT NULL,
  "totalAmount" NUMERIC(10,2) NOT NULL,
  "deliveryCharge" NUMERIC(10,2) DEFAULT 0.00,
  "platformFee" NUMERIC(10,2) DEFAULT 0.00,
  "finalAmount" NUMERIC(10,2) NOT NULL,
  address JSONB NOT NULL, -- { "address": "...", "lat": 26.2, "lng": 92.1 }
  status TEXT DEFAULT 'Received',
  "paymentMethod" TEXT DEFAULT 'COD',
  "deliveryOtp" TEXT,
  "riderAccepted" BOOLEAN DEFAULT false,
  "acceptedAt" TIMESTAMP WITH TIME ZONE,
  "assignedAt" TIMESTAMP WITH TIME ZONE,
  "deliveredAt" TIMESTAMP WITH TIME ZONE,
  "parcelPicked" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 6: Create Location Tracking and Device Tokens
CREATE TABLE IF NOT EXISTS public.tracking (
  id TEXT PRIMARY KEY, -- Rider phone or ID
  phone TEXT,
  active BOOLEAN DEFAULT true,
  location JSONB, -- { latitude: 26.1, longitude: 91.7 }
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.users_location (
  phone TEXT PRIMARY KEY,
  name TEXT,
  latitude NUMERIC(10,8),
  longitude NUMERIC(11,8),
  address TEXT,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id TEXT PRIMARY KEY, -- User ID or Phone
  token TEXT NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_config (
  id TEXT PRIMARY KEY DEFAULT 'config',
  "isSystemOnline" BOOLEAN DEFAULT true,
  "systemReopenTime" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.app_errors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "userId" TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  device_info JSONB,
  app_version TEXT,
  resolved BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 7: Performance Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_products_shopId ON public.products("shopId");
CREATE INDEX IF NOT EXISTS idx_orders_userId ON public.orders("userId");
CREATE INDEX IF NOT EXISTS idx_orders_customerPhone ON public.orders("customerPhone");
CREATE INDEX IF NOT EXISTS idx_orders_partnerPhone ON public.orders("partnerPhone");
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_shopIds ON public.orders USING GIN ("shopIds");

-- STEP 8: Automatic Timestamp Update Trigger Setup
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_profiles ON public.profiles;
DROP TRIGGER IF EXISTS set_timestamp_users ON public.users;
DROP TRIGGER IF EXISTS set_timestamp_shops ON public.shops;
DROP TRIGGER IF EXISTS set_timestamp_products ON public.products;
DROP TRIGGER IF EXISTS set_timestamp_orders ON public.orders;
DROP TRIGGER IF EXISTS set_timestamp_cities ON public.cities;
DROP TRIGGER IF EXISTS set_timestamp_tracking ON public.tracking;
DROP TRIGGER IF EXISTS set_timestamp_device_tokens ON public.device_tokens;

CREATE TRIGGER set_timestamp_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER set_timestamp_shops BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER set_timestamp_products BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER set_timestamp_orders BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER set_timestamp_cities BEFORE UPDATE ON public.cities FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER set_timestamp_tracking BEFORE UPDATE ON public.tracking FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER set_timestamp_device_tokens BEFORE UPDATE ON public.device_tokens FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- STEP 9: Supabase Realtime Subscription Setup
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE 
  public.orders, 
  public.shops, 
  public.products, 
  public.tracking, 
  public.system_config, 
  public.categories, 
  public.cities, 
  public.profiles;

-- STEP 10: Secure Server-Side Gateways (SECURITY DEFINER RPCs)
-- This function runs with server-level privileges to bypass RLS securely and write cleanly.
CREATE OR REPLACE FUNCTION place_order(
  p_customer_phone TEXT,
  p_customer_name TEXT,
  p_items JSONB,
  p_total_amount NUMERIC,
  p_delivery_address TEXT,
  p_coordinates JSONB,
  p_shop_ids TEXT[],
  p_user_id TEXT DEFAULT NULL,
  p_delivery_charge NUMERIC DEFAULT 0.00,
  p_platform_fee NUMERIC DEFAULT 0.00,
  p_final_amount NUMERIC DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'COD',
  p_status TEXT DEFAULT 'Received',
  p_order_id TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  v_order_id TEXT;
  v_final_amt NUMERIC;
  v_resolved_user_id TEXT;
BEGIN
  -- 1. Intelligently resolve the customer's User ID to maintain strict relational integrity
  IF p_user_id = 'anonymous_user' OR p_user_id = '' THEN
    v_resolved_user_id := NULL;
  ELSE
    v_resolved_user_id := p_user_id;
  END IF;

  -- Try to locate existing registered user
  IF v_resolved_user_id IS NULL AND p_customer_phone IS NOT NULL AND p_customer_phone <> '' THEN
    SELECT id INTO v_resolved_user_id FROM public.users WHERE phone = p_customer_phone LIMIT 1;
    IF v_resolved_user_id IS NULL THEN
      SELECT id INTO v_resolved_user_id FROM public.profiles WHERE phone = p_customer_phone LIMIT 1;
    END IF;
  END IF;

  -- 2. Ensure registered user exists in both tables to prevent Foreign Key errors
  IF v_resolved_user_id IS NOT NULL THEN
    INSERT INTO public.users (id, phone, name, role, "createdAt", "updatedAt")
    VALUES (
      v_resolved_user_id,
      p_customer_phone,
      COALESCE(p_customer_name, 'Grezto Member'),
      'Customer',
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    )
    ON CONFLICT (phone) DO UPDATE
    SET 
      name = COALESCE(p_customer_name, public.users.name),
      "updatedAt" = timezone('utc'::text, now());

    INSERT INTO public.profiles (id, phone, name, role, "createdAt", "updatedAt")
    VALUES (
      v_resolved_user_id,
      p_customer_phone,
      COALESCE(p_customer_name, 'Grezto Member'),
      'Customer',
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    )
    ON CONFLICT (phone) DO UPDATE
    SET 
      name = COALESCE(p_customer_name, public.profiles.name),
      "updatedAt" = timezone('utc'::text, now());
  END IF;

  -- 3. Set order ID & Final Amount
  v_order_id := COALESCE(p_order_id, 'OR-' || upper(substring(gen_random_uuid()::text from 1 for 6)));
  v_final_amt := COALESCE(p_final_amount, p_total_amount + p_delivery_charge + p_platform_fee);

  -- 4. Insert order securely
  INSERT INTO public.orders (
    id,
    "userId",
    "customerName",
    "customerPhone",
    "shopIds",
    items,
    "totalAmount",
    "deliveryCharge",
    "platformFee",
    "finalAmount",
    address,
    status,
    "paymentMethod",
    "createdAt",
    "updatedAt"
  ) VALUES (
    v_order_id,
    v_resolved_user_id,
    p_customer_name,
    p_customer_phone,
    p_shop_ids,
    p_items,
    p_total_amount,
    p_delivery_charge,
    p_platform_fee,
    v_final_amt,
    jsonb_build_object(
      'address', p_delivery_address,
      'lat', COALESCE((p_coordinates->>'lat')::numeric, 0),
      'lng', COALESCE((p_coordinates->>'lng')::numeric, 0)
    ),
    p_status,
    p_payment_method,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  );

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC for Customer/Rider/Merchant profile synchronization
CREATE OR REPLACE FUNCTION upsert_user_profile(
  p_phone TEXT,
  p_name TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_id TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_id TEXT;
BEGIN
  v_user_id := COALESCE(p_id, 'usr_' || upper(substring(gen_random_uuid()::text from 1 for 8)));

  INSERT INTO public.profiles (id, phone, name, address, "updatedAt")
  VALUES (v_user_id, p_phone, p_name, p_address, timezone('utc'::text, now()))
  ON CONFLICT (phone) DO UPDATE
  SET 
    name = COALESCE(p_name, public.profiles.name),
    address = COALESCE(p_address, public.profiles.address),
    "updatedAt" = timezone('utc'::text, now());
  
  INSERT INTO public.users (id, phone, name, "updatedAt")
  VALUES (v_user_id, p_phone, p_name, timezone('utc'::text, now()))
  ON CONFLICT (phone) DO UPDATE
  SET 
    name = COALESCE(p_name, public.users.name),
    "updatedAt" = timezone('utc'::text, now());

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
