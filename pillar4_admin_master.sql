-- =====================================================================================
-- GREZTO SUPER APP - PILLAR 4: MASTER ADMIN CORE & GLOBAL SYSTEM CONTROL MODULE
-- Designed for 100% Native Android (Capacitor) and Production-Grade Scale
-- Provides Master Admin (Superuser) bypass, Emergency System Controls, and Financial Settlement Ledgers
-- =====================================================================================

-- STEP 1: Helper function to verify if an operator is a verified Master Admin
CREATE OR REPLACE FUNCTION internal_verify_master_admin(
  p_operator_phone TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_clean_operator TEXT;
BEGIN
  v_clean_operator := right(regexp_replace(p_operator_phone, '\D', '', 'g'), 10);
  
  -- Strict Hardcoded Master Admin Numbers (Founder, MD, Core Lead Developers)
  IF v_clean_operator IN ('9864975438', '8638089161') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- STEP 2: MASTER ADMIN RPC GATEWAYS (SECURITY DEFINER)

-- RPC 1: Global System Online/Offline Toggle (Emergency Switch)
CREATE OR REPLACE FUNCTION admin_toggle_global_system(
  p_operator_phone TEXT,
  p_is_online BOOLEAN,
  p_reopen_time TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_authorized BOOLEAN;
BEGIN
  v_authorized := internal_verify_master_admin(p_operator_phone);
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Hacker Alert: Access Denied! Only Master Admins can toggle global system state. 🛑';
  END IF;

  INSERT INTO public.system_config (id, "isSystemOnline", "systemReopenTime")
  VALUES ('config', p_is_online, p_reopen_time)
  ON CONFLICT (id) DO UPDATE
  SET 
    "isSystemOnline" = EXCLUDED."isSystemOnline",
    "systemReopenTime" = EXCLUDED."systemReopenTime";

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 2: Settle Rider Collected COD Cash (Cash Handover to Office)
CREATE OR REPLACE FUNCTION admin_settle_rider_cod(
  p_operator_phone TEXT,
  p_rider_phone TEXT,
  p_amount_to_handover NUMERIC,
  p_reset_all BOOLEAN DEFAULT FALSE
) RETURNS NUMERIC AS $$
DECLARE
  v_authorized BOOLEAN;
  v_current_balance NUMERIC;
  v_settled_amount NUMERIC;
BEGIN
  v_authorized := internal_verify_master_admin(p_operator_phone);
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Access Denied: Only authorized administrators can perform Rider COD handovers. 🛑';
  END IF;

  -- Lock rider row for transaction
  SELECT COALESCE("codBalance", 0.00) INTO v_current_balance
  FROM public.team
  WHERE phone = p_rider_phone AND role = 'Rider'
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Rider with phone % not found.', p_rider_phone;
  END IF;

  IF p_reset_all THEN
    v_settled_amount := v_current_balance;
  ELSE
    v_settled_amount := p_amount_to_handover;
  END IF;

  IF v_settled_amount <= 0 THEN
    RETURN v_current_balance;
  END IF;

  -- Deduct cash balance and update log
  UPDATE public.team
  SET 
    "codBalance" = "codBalance" - v_settled_amount,
    "totalCollectedCash" = "totalCollectedCash" + v_settled_amount,
    "updatedAt" = timezone('utc'::text, now())
  WHERE phone = p_rider_phone AND role = 'Rider';

  -- Record Handover transaction in the ledger
  INSERT INTO public.rider_cod_transactions ("riderPhone", type, amount, "adminUser")
  VALUES (p_rider_phone, 'HANDOVER', v_settled_amount, p_operator_phone);

  RETURN v_current_balance - v_settled_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 3: Manage Merchant Payouts (Record payment settlement to Bank accounts/UPI)
CREATE OR REPLACE FUNCTION admin_settle_merchant_payout(
  p_operator_phone TEXT,
  p_shop_id TEXT,
  p_amount NUMERIC,
  p_reference_id TEXT,
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE
) RETURNS TEXT AS $$
DECLARE
  v_authorized BOOLEAN;
  v_payout_id TEXT;
BEGIN
  v_authorized := internal_verify_master_admin(p_operator_phone);
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Access Denied: Only Master Admins can process payout settlements. 🛑';
  END IF;

  v_payout_id := 'PAY-' || upper(substring(gen_random_uuid()::text from 1 for 6));

  INSERT INTO public.merchant_payouts (
    id,
    "shopId",
    amount,
    status,
    "referenceId",
    "periodStart",
    "periodEnd",
    "createdAt",
    "updatedAt"
  ) VALUES (
    v_payout_id,
    p_shop_id,
    p_amount,
    'Settled',
    p_reference_id,
    p_period_start,
    p_period_end,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  );

  RETURN v_payout_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 4: Manage Team Registration & Active Status (Riders / Staff)
CREATE OR REPLACE FUNCTION admin_manage_team(
  p_operator_phone TEXT,
  p_id TEXT,
  p_phone TEXT,
  p_name TEXT,
  p_role TEXT, -- 'Rider', 'Merchant', 'Admin'
  p_vehicle TEXT DEFAULT NULL,
  p_shop_id TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'Offline',
  p_action TEXT DEFAULT 'UPSERT' -- 'UPSERT' or 'DELETE'
) RETURNS BOOLEAN AS $$
DECLARE
  v_authorized BOOLEAN;
BEGIN
  v_authorized := internal_verify_master_admin(p_operator_phone);
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Access Denied: Team management is reserved for Master Admins. 🛑';
  END IF;

  IF p_action = 'DELETE' THEN
    DELETE FROM public.team WHERE id = p_id;
    RETURN TRUE;
  END IF;

  INSERT INTO public.team (
    id,
    phone,
    name,
    role,
    vehicle,
    "shopId",
    status,
    "unregistered",
    "updatedAt"
  ) VALUES (
    p_id,
    p_phone,
    p_name,
    p_role,
    p_vehicle,
    p_shop_id,
    p_status,
    false,
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    phone = EXCLUDED.phone,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    vehicle = COALESCE(EXCLUDED.vehicle, public.team.vehicle),
    "shopId" = COALESCE(EXCLUDED."shopId", public.team."shopId"),
    status = EXCLUDED.status,
    "updatedAt" = timezone('utc'::text, now());

  -- Ensure profile row aligns correctly for security
  INSERT INTO public.profiles (id, phone, name, role, "updatedAt")
  VALUES (p_id, p_phone, p_name, p_role, timezone('utc'::text, now()))
  ON CONFLICT (id) DO UPDATE
  SET 
    role = EXCLUDED.role,
    "updatedAt" = timezone('utc'::text, now());

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 5: Settle/Resolve Native Android Crash & App Errors logs
CREATE OR REPLACE FUNCTION admin_resolve_app_error(
  p_operator_phone TEXT,
  p_error_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_authorized BOOLEAN;
BEGIN
  v_authorized := internal_verify_master_admin(p_operator_phone);
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Access Denied: Unauthorized error log management. 🛑';
  END IF;

  UPDATE public.app_errors
  SET resolved = true
  WHERE id = p_error_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 6: Get Real-time Global Business KPI Metrics Dashboard (Industrial Grade Analytics)
CREATE OR REPLACE FUNCTION admin_get_global_system_metrics(
  p_operator_phone TEXT
) RETURNS TABLE (
  total_users_registered BIGINT,
  total_shops_active BIGINT,
  total_orders_today BIGINT,
  total_sales_volume NUMERIC,
  cash_in_hand_riders NUMERIC,
  active_delivery_riders BIGINT,
  busy_delivery_riders BIGINT,
  active_cities_count BIGINT,
  system_online_status BOOLEAN
) AS $$
DECLARE
  v_authorized BOOLEAN;
  v_system_online BOOLEAN;
BEGIN
  v_authorized := internal_verify_master_admin(p_operator_phone);
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Access Denied: Unauthorized analytical monitoring request. 🛑';
  END IF;

  -- Read current global configurations
  SELECT COALESCE("isSystemOnline", true) INTO v_system_online 
  FROM public.system_config 
  WHERE id = 'config' 
  LIMIT 1;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'Customer') as total_users_registered,
    (SELECT COUNT(*) FROM public.shops WHERE status = 'Open' OR status = 'active') as total_shops_active,
    (SELECT COUNT(*) FROM public.orders WHERE "createdAt" >= CURRENT_DATE) as total_orders_today,
    COALESCE((SELECT SUM("finalAmount") FROM public.orders WHERE status = 'Delivered'), 0.00) as total_sales_volume,
    COALESCE((SELECT SUM("codBalance") FROM public.team WHERE role = 'Rider'), 0.00) as cash_in_hand_riders,
    (SELECT COUNT(*) FROM public.team WHERE role = 'Rider' AND status <> 'Offline') as active_delivery_riders,
    (SELECT COUNT(*) FROM public.team WHERE role = 'Rider' AND status = 'Busy') as busy_delivery_riders,
    (SELECT COUNT(*) FROM public.cities WHERE status = 'Active') as active_cities_count,
    COALESCE(v_system_online, true) as system_online_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
