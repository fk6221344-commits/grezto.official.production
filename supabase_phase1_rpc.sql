-- =====================================================================================
-- PHASE 1: DATABASE LOCKDOWN (THE SHIELD)
-- =====================================================================================
-- Instructions: Copy this entire script and run it in your Supabase SQL Editor.
-- These functions use "SECURITY DEFINER", meaning they can safely write to the database 
-- even if we lock down direct inserts/updates using Row Level Security (RLS) later.
-- =====================================================================================

-- 1. Secure RPC for Placing an Order
CREATE OR REPLACE FUNCTION place_order(
  p_customer_phone TEXT,
  p_customer_name TEXT,
  p_items JSONB,
  p_total_amount NUMERIC,
  p_delivery_address TEXT,
  p_coordinates JSONB,
  p_shop_ids TEXT[]
) RETURNS UUID AS $$
DECLARE
  v_order_id UUID;
BEGIN
  INSERT INTO public.orders (
    "customerPhone",
    "customerName",
    "items",
    "totalAmount",
    "deliveryAddress",
    "coordinates",
    "shopIds",
    "status"
  ) VALUES (
    p_customer_phone,
    p_customer_name,
    p_items,
    p_total_amount,
    p_delivery_address,
    p_coordinates,
    p_shop_ids,
    'Pending'
  ) RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Secure RPC for Updating Rider Status (Online/Offline)
CREATE OR REPLACE FUNCTION update_rider_status(
  p_rider_phone TEXT,
  p_status TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.team
  SET 
    status = p_status,
    "updatedAt" = timezone('utc'::text, now())
  WHERE phone = p_rider_phone AND role = 'Rider';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Secure RPC for Fetching/Updating User Profile
CREATE OR REPLACE FUNCTION upsert_user_profile(
  p_phone TEXT,
  p_name TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_id TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, name, address)
  VALUES (COALESCE(p_id, gen_random_uuid()::text), p_phone, p_name, p_address)
  ON CONFLICT (phone) DO UPDATE
  SET 
    name = COALESCE(p_name, public.profiles.name),
    address = COALESCE(p_address, public.profiles.address),
    "updatedAt" = timezone('utc'::text, now());
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
