-- ===================================================
-- GREZTO PHASE 2: MULTI-CITY ENTERPRISE MIGRATION SCRIPT (CLEAN)
-- ===================================================

-- 1. Drop existing legacy cities table if column schema mismatches
DROP TABLE IF EXISTS cities CASCADE;

-- 2. Create `cities` Master Registry Table
CREATE TABLE cities (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  state VARCHAR DEFAULT 'Assam',
  lat NUMERIC(10, 7) NOT NULL,
  lng NUMERIC(10, 7) NOT NULL,
  radius_km NUMERIC(5, 2) DEFAULT 10.0,
  status VARCHAR DEFAULT 'active',
  base_delivery_fee NUMERIC(6, 2) DEFAULT 20.00,
  manager_name VARCHAR,
  manager_phone VARCHAR,
  manager_pin VARCHAR DEFAULT '1234',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initial Master Cities Seed Data
INSERT INTO cities (id, name, state, lat, lng, radius_km, status, base_delivery_fee, manager_name, manager_phone, manager_pin)
VALUES 
  ('morigaon', 'Morigaon', 'Assam', 26.2458, 92.2618, 12.0, 'active', 20.00, 'Kabir Ahmed', '9876543210', '1234'),
  ('guwahati', 'Guwahati', 'Assam', 26.1445, 91.7362, 25.0, 'active', 35.00, 'Rahul Das', '9101022803', '5678')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  state = EXCLUDED.state,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radius_km = EXCLUDED.radius_km,
  base_delivery_fee = EXCLUDED.base_delivery_fee,
  manager_name = EXCLUDED.manager_name,
  manager_phone = EXCLUDED.manager_phone,
  manager_pin = EXCLUDED.manager_pin;

-- 3. Add `city_id` columns to core tables if they do not exist
ALTER TABLE shops ADD COLUMN IF NOT EXISTS city_id VARCHAR DEFAULT 'morigaon';
ALTER TABLE team ADD COLUMN IF NOT EXISTS city_id VARCHAR DEFAULT 'morigaon';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS city_id VARCHAR DEFAULT 'morigaon';
ALTER TABLE banners ADD COLUMN IF NOT EXISTS city_id VARCHAR DEFAULT NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS city_id VARCHAR DEFAULT NULL;

-- 4. Create `coupons` Table for City-Based Discounts
CREATE TABLE IF NOT EXISTS coupons (
  id VARCHAR PRIMARY KEY,
  code VARCHAR UNIQUE NOT NULL,
  title VARCHAR NOT NULL,
  discount_type VARCHAR DEFAULT 'percent',
  discount_value NUMERIC(6, 2) NOT NULL,
  min_order_amount NUMERIC(6, 2) DEFAULT 0,
  max_discount_cap NUMERIC(6, 2) DEFAULT 100,
  city_id VARCHAR,
  status VARCHAR DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initial Coupons Seed Data
INSERT INTO coupons (id, code, title, discount_type, discount_value, min_order_amount, max_discount_cap, city_id, status)
VALUES
  ('c_welcome50', 'WELCOME50', '50% OFF First Order', 'percent', 50, 199, 100, NULL, 'active'),
  ('c_morigaon20', 'MORIGAON20', 'Flat ₹20 OFF in Morigaon', 'flat', 20, 149, 20, 'morigaon', 'active')
ON CONFLICT (id) DO NOTHING;

-- 5. Multi-City Indexes for High-Performance Queries
CREATE INDEX IF NOT EXISTS idx_shops_city_id ON shops(city_id);
CREATE INDEX IF NOT EXISTS idx_team_city_id ON team(city_id);
CREATE INDEX IF NOT EXISTS idx_orders_city_id ON orders(city_id);
CREATE INDEX IF NOT EXISTS idx_banners_city_id ON banners(city_id);
