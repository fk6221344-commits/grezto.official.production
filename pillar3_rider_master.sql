-- =====================================================================================
-- GREZTO SUPER APP - PILLAR 3: RIDER CORE & LOGISTICS DISPATCH MODULE
-- Designed for 100% Native Android (Capacitor) and Production-Grade Scale
-- Includes: Atomic Dispatch Assignments, Realtime OTP Verification, Live GPS & COD Ledgers
-- =====================================================================================

-- STEP 1: Ensure Rider Operations Schema Alignment
-- Standardize columns on the public.team table (for Rider role)
ALTER TABLE public.team
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Offline', -- 'Online', 'Offline', 'Busy'
ADD COLUMN IF NOT EXISTS vehicle TEXT, -- 'Bike', 'Scooter', 'Bicycle', 'None'
ADD COLUMN IF NOT EXISTS "codBalanceInit" NUMERIC DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "totalCollectedCash" NUMERIC DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "codBalance" NUMERIC DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "totalOrdersDelivered" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "liveEarnings" NUMERIC DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "rating" TEXT DEFAULT '5.0',
ADD COLUMN IF NOT EXISTS "unregistered" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "dailySettlements" JSONB DEFAULT '{}'::jsonb;

-- Ensure tracking table has optimal types for Native GPS coordinates stream
CREATE TABLE IF NOT EXISTS public.tracking (
  id TEXT PRIMARY KEY, -- Matches Rider phone number or ID
  phone TEXT NOT NULL,
  active BOOLEAN DEFAULT false,
  location JSONB, -- { "lat": 26.12, "lng": 91.73, "speed": 0, "bearing": 0 }
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_phone ON public.tracking(phone);
CREATE INDEX IF NOT EXISTS idx_tracking_active ON public.tracking(active);


-- STEP 2: Create Rider Cash-On-Delivery (COD) Transaction Ledger Table
-- Tracks every individual cash deposit, collection, or administrative cash collection
CREATE TABLE IF NOT EXISTS public.rider_cod_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "riderPhone" TEXT NOT NULL,
  "orderId" TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'COLLECTION' (from delivery), 'HANDOVER' (cash paid to admin), 'RESET'
  amount NUMERIC(10,2) NOT NULL,
  "adminUser" TEXT, -- Admin UID who accepted/authorized handover
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rider_cod_tx_phone ON public.rider_cod_transactions("riderPhone");


-- STEP 3: SECURE TRANSACTIONAL DISPATCH GATEWAYS (SECURITY DEFINER RPCs)

-- RPC 1: Atomic Order Assignment (Prevents race conditions where two riders accept the same order)
CREATE OR REPLACE FUNCTION rider_accept_order_assignment(
  p_order_id TEXT,
  p_rider_phone TEXT,
  p_rider_name TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_status TEXT;
  v_assigned_partner TEXT;
  v_clean_rider_phone TEXT;
BEGIN
  -- Standardize phone number format
  v_clean_rider_phone := right(regexp_replace(p_rider_phone, '\D', '', 'g'), 10);

  -- 1. Lock the order row to prevent concurrent race updates
  SELECT status, "partnerPhone" INTO v_current_status, v_assigned_partner
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  -- 2. Verify that the order is not already claimed by another rider
  IF v_assigned_partner IS NOT NULL AND v_assigned_partner <> '' AND right(regexp_replace(v_assigned_partner, '\D', '', 'g'), 10) <> v_clean_rider_phone THEN
    RAISE EXCEPTION 'Order already accepted by another Delivery Partner! 🛵🛑';
  END IF;

  -- 3. Verify order is in a state acceptable for courier dispatch
  IF v_current_status IN ('Delivered', 'Cancelled') THEN
    RAISE EXCEPTION 'This order has already been completed or cancelled! 🛑';
  END IF;

  -- 4. Perform atomic assignment update
  UPDATE public.orders
  SET
    "partnerPhone" = p_rider_phone,
    "partnerName" = p_rider_name,
    "riderAccepted" = true,
    "assignedAt" = COALESCE("assignedAt", timezone('utc'::text, now())),
    "updatedAt" = timezone('utc'::text, now())
  WHERE id = p_order_id;

  -- 5. Set Rider Status to 'Busy' while on active dispatch
  UPDATE public.team
  SET 
    status = 'Busy',
    "updatedAt" = timezone('utc'::text, now())
  WHERE phone = p_rider_phone AND role = 'Rider';

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 2: Parcel Pickup (Transitions order state to Out for Delivery)
CREATE OR REPLACE FUNCTION rider_pickup_parcel(
  p_order_id TEXT,
  p_rider_phone TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_assigned_partner TEXT;
  v_clean_rider_phone TEXT;
BEGIN
  v_clean_rider_phone := right(regexp_replace(p_rider_phone, '\D', '', 'g'), 10);

  -- Check and verify the rider claiming the parcel is actually assigned to it
  SELECT "partnerPhone" INTO v_assigned_partner FROM public.orders WHERE id = p_order_id;
  IF v_assigned_partner IS NULL OR right(regexp_replace(v_assigned_partner, '\D', '', 'g'), 10) <> v_clean_rider_phone THEN
    RAISE EXCEPTION 'Access Denied: You are not authorized to pick up this parcel. 🛑';
  END IF;

  -- Update order progression to Out For Delivery
  UPDATE public.orders
  SET
    status = 'Out for Delivery',
    "parcelPicked" = true,
    "updatedAt" = timezone('utc'::text, now())
  WHERE id = p_order_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 3: OTP Delivery Completion (Verifies OTP and automatically handles financial ledgers in database)
CREATE OR REPLACE FUNCTION rider_complete_delivery_with_otp(
  p_order_id TEXT,
  p_rider_phone TEXT,
  p_input_otp TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_stored_otp TEXT;
  v_assigned_partner TEXT;
  v_clean_rider_phone TEXT;
  v_payment_method TEXT;
  v_final_amount NUMERIC;
  v_delivery_charge NUMERIC;
  v_earnings_cut NUMERIC;
BEGIN
  v_clean_rider_phone := right(regexp_replace(p_rider_phone, '\D', '', 'g'), 10);

  -- 1. Fetch order details with a write lock
  SELECT "deliveryOtp", "partnerPhone", "paymentMethod", "finalAmount", "deliveryCharge"
  INTO v_stored_otp, v_assigned_partner, v_payment_method, v_final_amount, v_delivery_charge
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  -- 2. Verify rider assignment authorization
  IF v_assigned_partner IS NULL OR right(regexp_replace(v_assigned_partner, '\D', '', 'g'), 10) <> v_clean_rider_phone THEN
    RAISE EXCEPTION 'Access Denied: You are not authorized to complete this order. 🛑';
  END IF;

  -- 3. Verify OTP code matches exactly (Allowing master OTP bypass '2026' for emergency/offline native testing)
  IF p_input_otp <> v_stored_otp AND p_input_otp <> '2026' THEN
    RAISE EXCEPTION 'Invalid OTP! Please enter the correct customer delivery OTP. 🔑❌';
  END IF;

  -- 4. Mark order as successfully Delivered
  UPDATE public.orders
  SET
    status = 'Delivered',
    "deliveredAt" = timezone('utc'::text, now()),
    "updatedAt" = timezone('utc'::text, now())
  WHERE id = p_order_id;

  -- 5. Calculate Rider earnings share (85% of customer delivery fee is paid to Rider)
  v_earnings_cut := COALESCE(v_delivery_charge, 0) * 0.85;

  -- 6. Perform automatic Financial Ledger Accounting
  IF v_payment_method = 'COD' THEN
    -- If Cash on Delivery, the rider collected actual physical cash. Update cash balances and register ledger transaction.
    UPDATE public.team
    SET
      "totalOrdersDelivered" = "totalOrdersDelivered" + 1,
      "codBalance" = "codBalance" + v_final_amount,
      "liveEarnings" = "liveEarnings" + v_earnings_cut,
      status = 'Online', -- Set back to online available
      "updatedAt" = timezone('utc'::text, now())
    WHERE phone = p_rider_phone AND role = 'Rider';

    INSERT INTO public.rider_cod_transactions ("riderPhone", "orderId", type, amount)
    VALUES (p_rider_phone, p_order_id, 'COLLECTION', v_final_amount);
  ELSE
    -- If prepaid (Online/Card), no physical cash is held by rider. Just increment earnings and order delivery counts.
    UPDATE public.team
    SET
      "totalOrdersDelivered" = "totalOrdersDelivered" + 1,
      "liveEarnings" = "liveEarnings" + v_earnings_cut,
      status = 'Online',
      "updatedAt" = timezone('utc'::text, now())
    WHERE phone = p_rider_phone AND role = 'Rider';
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 4: GPS Tracking Ping (For live coordinates stream directly from Native Capacitor Geolocation API)
CREATE OR REPLACE FUNCTION rider_ping_location(
  p_rider_phone TEXT,
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_speed NUMERIC DEFAULT 0,
  p_bearing NUMERIC DEFAULT 0
) RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO public.tracking (id, phone, active, location, "updatedAt")
  VALUES (
    p_rider_phone,
    p_rider_phone,
    true,
    jsonb_build_object(
      'lat', p_latitude,
      'lng', p_longitude,
      'speed', p_speed,
      'bearing', p_bearing
    ),
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE
  SET
    active = true,
    location = EXCLUDED.location,
    "updatedAt" = timezone('utc'::text, now());

  -- Mirror update inside user's location tracking for high performance sync
  INSERT INTO public.users_location (phone, name, latitude, longitude, "updatedAt")
  VALUES (p_rider_phone, 'Delivery Partner', p_latitude, p_longitude, timezone('utc'::text, now()))
  ON CONFLICT (phone) DO UPDATE
  SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    "updatedAt" = timezone('utc'::text, now());

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- STEP 4: REALTIME PIPELINE ATTACHMENT
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking, public.rider_cod_transactions;
