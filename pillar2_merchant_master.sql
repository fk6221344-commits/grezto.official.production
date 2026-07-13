-- =====================================================================================
-- GREZTO SUPER APP - PILLAR 2: MERCHANT/SHOP OPERATIONAL DATABASE & SECURITY MODULE
-- Designed for 100% Native Android (Capacitor) and Production-Grade Scale
-- Includes: Secure Menu Management, Shop Controls, Realtime Order Dispatch & Financial Ledgers
-- =====================================================================================

-- STEP 1: Ensure Merchant Relationship columns exist in Tables
-- Add shopId relation to Team table if it doesn't already exist
ALTER TABLE public.team 
ADD COLUMN IF NOT EXISTS "shopId" TEXT REFERENCES public.shops(id) ON DELETE SET NULL;

-- Ensure shops table has ownership columns
ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS "ownerPhone" TEXT,
ADD COLUMN IF NOT EXISTS "ownerName" TEXT,
ADD COLUMN IF NOT EXISTS "isOpen" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'Open', -- 'Open', 'Closed', 'Suspended', 'Blocked'
ADD COLUMN IF NOT EXISTS "imageUrl2" TEXT,
ADD COLUMN IF NOT EXISTS "imageUrl3" TEXT,
ADD COLUMN IF NOT EXISTS "imageUrl4" TEXT;

-- Ensure products table has correct merchant operational state columns
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS "inStock" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "unit" TEXT DEFAULT '1 serving',
ADD COLUMN IF NOT EXISTS "stock" INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS "deleted" BOOLEAN DEFAULT false;


-- STEP 2: Create Merchant Action Audit Logs (For operational dispute prevention)
CREATE TABLE IF NOT EXISTS public.merchant_audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "shopId" TEXT REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  "operatorPhone" TEXT NOT NULL,
  action TEXT NOT NULL, -- 'TOGGLE_SHOP', 'UPSERT_PRODUCT', 'DELETE_PRODUCT', 'UPDATE_SETTINGS'
  details JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_audit_logs_shopId ON public.merchant_audit_logs("shopId");


-- STEP 3: Create Merchant Settlements & Financial Ledger Schema
CREATE TABLE IF NOT EXISTS public.merchant_payouts (
  id TEXT PRIMARY KEY DEFAULT ('PAY-' || upper(substring(gen_random_uuid()::text from 1 for 6))),
  "shopId" TEXT REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  "amount" NUMERIC(10,2) NOT NULL,
  "status" TEXT DEFAULT 'Pending', -- 'Pending', 'Processing', 'Settled', 'Failed'
  "referenceId" TEXT, -- Bank/UPI transaction ref ID
  "periodStart" TIMESTAMP WITH TIME ZONE NOT NULL,
  "periodEnd" TIMESTAMP WITH TIME ZONE NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_payouts_shopId ON public.merchant_payouts("shopId");


-- STEP 4: Helper Security Function for RBAC verification (Internal use only)
CREATE OR REPLACE FUNCTION internal_verify_merchant_access(
  p_operator_phone TEXT,
  p_shop_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_clean_operator TEXT;
  v_clean_owner TEXT;
  v_team_shop TEXT;
BEGIN
  -- Standardize the operator's phone number to last 10 digits
  v_clean_operator := right(regexp_replace(p_operator_phone, '\D', '', 'g'), 10);
  
  -- 1. Master Admin Bypass
  IF v_clean_operator IN ('9864975438', '8638089161') THEN
    RETURN TRUE;
  END IF;

  -- 2. Verify Shop Ownership
  SELECT right(regexp_replace("ownerPhone", '\D', '', 'g'), 10) INTO v_clean_owner 
  FROM public.shops 
  WHERE id = p_shop_id;

  IF v_clean_owner = v_clean_operator THEN
    RETURN TRUE;
  END IF;

  -- 3. Verify Team Member Membership with Merchant role
  SELECT "shopId" INTO v_team_shop 
  FROM public.team 
  WHERE right(regexp_replace(phone, '\D', '', 'g'), 10) = v_clean_operator 
    AND "shopId" = p_shop_id 
  LIMIT 1;

  IF v_team_shop IS NOT NULL THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- STEP 5: SECURE MERCHANT OPERATION GATEWAYS (SECURITY DEFINER RPCs)

-- RPC 1: Toggle Shop Operational Status (Open/Close)
CREATE OR REPLACE FUNCTION toggle_shop_open_status(
  p_operator_phone TEXT,
  p_shop_id TEXT,
  p_is_open BOOLEAN
) RETURNS BOOLEAN AS $$
DECLARE
  v_authorized BOOLEAN;
BEGIN
  -- Verify permission
  v_authorized := internal_verify_merchant_access(p_operator_phone, p_shop_id);
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Access Denied: Operator % is not authorized to manage Shop %', p_operator_phone, p_shop_id;
  END IF;

  -- Perform status update
  UPDATE public.shops
  SET 
    "isOpen" = p_is_open,
    status = CASE WHEN p_is_open THEN 'Open' ELSE 'Closed' END,
    "updatedAt" = timezone('utc'::text, now())
  WHERE id = p_shop_id;

  -- Insert audit log
  INSERT INTO public.merchant_audit_logs ("shopId", "operatorPhone", action, details)
  VALUES (p_shop_id, p_operator_phone, 'TOGGLE_SHOP', jsonb_build_object('isOpen', p_is_open));

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 2: Toggle Product Stock Status
CREATE OR REPLACE FUNCTION toggle_product_stock_status(
  p_operator_phone TEXT,
  p_product_id TEXT,
  p_in_stock BOOLEAN,
  p_stock_count INTEGER DEFAULT 15
) RETURNS BOOLEAN AS $$
DECLARE
  v_shop_id TEXT;
  v_authorized BOOLEAN;
BEGIN
  -- Retrieve product's shop relationship
  SELECT "shopId" INTO v_shop_id 
  FROM public.products 
  WHERE id = p_product_id;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Product % does not exist.', p_product_id;
  END IF;

  -- Verify access
  v_authorized := internal_verify_merchant_access(p_operator_phone, v_shop_id);
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Access Denied: Operator % is not authorized to manage catalog of Shop %', p_operator_phone, v_shop_id;
  END IF;

  -- Update product operational state
  UPDATE public.products
  SET 
    "inStock" = p_in_stock,
    "isAvailable" = p_in_stock,
    stock = CASE WHEN p_in_stock THEN p_stock_count ELSE 0 END,
    "updatedAt" = timezone('utc'::text, now())
  WHERE id = p_product_id;

  -- Insert audit log
  INSERT INTO public.merchant_audit_logs ("shopId", "operatorPhone", action, details)
  VALUES (v_shop_id, p_operator_phone, 'TOGGLE_STOCK', jsonb_build_object('productId', p_product_id, 'inStock', p_in_stock, 'stock', p_stock_count));

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 3: Upsert Product (Add or Update menu item)
CREATE OR REPLACE FUNCTION merchant_upsert_product(
  p_operator_phone TEXT,
  p_product_id TEXT,
  p_shop_id TEXT,
  p_name TEXT,
  p_price NUMERIC,
  p_original_price NUMERIC DEFAULT NULL,
  p_image TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_veg_type TEXT DEFAULT 'Veg',
  p_in_stock BOOLEAN DEFAULT true,
  p_unit TEXT DEFAULT '1 serving',
  p_stock INTEGER DEFAULT 15
) RETURNS TEXT AS $$
DECLARE
  v_authorized BOOLEAN;
  v_prod_id TEXT;
BEGIN
  -- Verify permission
  v_authorized := internal_verify_merchant_access(p_operator_phone, p_shop_id);
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Access Denied: Operator % is not authorized to add/modify catalog of Shop %', p_operator_phone, p_shop_id;
  END IF;

  -- Resolve Product ID
  v_prod_id := COALESCE(p_product_id, 'prd_' || upper(substring(gen_random_uuid()::text from 1 for 8)));

  -- Perform Upsert
  INSERT INTO public.products (
    id,
    "shopId",
    name,
    price,
    "originalPrice",
    image,
    description,
    category,
    "vegType",
    "inStock",
    "isAvailable",
    unit,
    stock,
    deleted,
    "updatedAt"
  ) VALUES (
    v_prod_id,
    p_shop_id,
    p_name,
    p_price,
    p_original_price,
    p_image,
    p_description,
    p_category,
    p_veg_type,
    p_in_stock,
    p_in_stock,
    p_unit,
    p_stock,
    false,
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    "originalPrice" = EXCLUDED."originalPrice",
    image = COALESCE(EXCLUDED.image, public.products.image),
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    "vegType" = EXCLUDED."vegType",
    "inStock" = EXCLUDED."inStock",
    "isAvailable" = EXCLUDED."isAvailable",
    unit = EXCLUDED.unit,
    stock = EXCLUDED.stock,
    deleted = false,
    "updatedAt" = timezone('utc'::text, now());

  -- Audit entry
  INSERT INTO public.merchant_audit_logs ("shopId", "operatorPhone", action, details)
  VALUES (p_shop_id, p_operator_phone, 'UPSERT_PRODUCT', jsonb_build_object('productId', v_prod_id, 'name', p_name, 'price', p_price));

  RETURN v_prod_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 4: Delete Product (Soft delete for relational order consistency)
CREATE OR REPLACE FUNCTION merchant_delete_product(
  p_operator_phone TEXT,
  p_product_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_shop_id TEXT;
  v_authorized BOOLEAN;
BEGIN
  -- Get shop ID
  SELECT "shopId" INTO v_shop_id FROM public.products WHERE id = p_product_id;
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Product % not found.', p_product_id;
  END IF;

  -- Authorize
  v_authorized := internal_verify_merchant_access(p_operator_phone, v_shop_id);
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Access Denied: Operator % is not authorized to delete product %', p_operator_phone, p_product_id;
  END IF;

  -- Soft delete product so previous historic orders don't break relations
  UPDATE public.products
  SET 
    deleted = true,
    "inStock" = false,
    "isAvailable" = false,
    "updatedAt" = timezone('utc'::text, now())
  WHERE id = p_product_id;

  -- Audit entry
  INSERT INTO public.merchant_audit_logs ("shopId", "operatorPhone", action, details)
  VALUES (v_shop_id, p_operator_phone, 'DELETE_PRODUCT', jsonb_build_object('productId', p_product_id));

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- STEP 6: SECURE MERCHANT FINANCIAL ANALYTICS & EARNINGS LEDGER VIEW
CREATE OR REPLACE FUNCTION get_merchant_financial_ledger(
  p_operator_phone TEXT,
  p_shop_id TEXT,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() - INTERVAL '30 days'),
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS TABLE (
  total_orders_received BIGINT,
  total_orders_completed BIGINT,
  total_gross_revenue NUMERIC,
  net_merchant_earnings NUMERIC,
  platform_commissions NUMERIC,
  cod_cash_collected NUMERIC,
  online_payments_settled NUMERIC,
  pending_settlement_amount NUMERIC
) AS $$
DECLARE
  v_authorized BOOLEAN;
BEGIN
  -- Verify permission
  v_authorized := internal_verify_merchant_access(p_operator_phone, p_shop_id);
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Access Denied: Operator is not authorized to access financial ledger for Shop %', p_shop_id;
  END IF;

  RETURN QUERY
  SELECT 
    COUNT(o.id) as total_orders_received,
    COUNT(CASE WHEN o.status = 'Delivered' THEN 1 END) as total_orders_completed,
    COALESCE(SUM(CASE WHEN o.status = 'Delivered' THEN o."totalAmount" ELSE 0 END), 0.00) as total_gross_revenue,
    COALESCE(SUM(CASE WHEN o.status = 'Delivered' THEN (o."totalAmount" * 0.90) ELSE 0 END), 0.00) as net_merchant_earnings, -- Assumes 10% Platform fee
    COALESCE(SUM(CASE WHEN o.status = 'Delivered' THEN (o."totalAmount" * 0.10) ELSE 0 END), 0.00) as platform_commissions,
    COALESCE(SUM(CASE WHEN o.status = 'Delivered' AND o."paymentMethod" = 'COD' THEN o."finalAmount" ELSE 0 END), 0.00) as cod_cash_collected,
    COALESCE(SUM(CASE WHEN o.status = 'Delivered' AND o."paymentMethod" <> 'COD' THEN o."finalAmount" ELSE 0 END), 0.00) as online_payments_settled,
    COALESCE(
      SUM(CASE WHEN o.status = 'Delivered' THEN (o."totalAmount" * 0.90) ELSE 0 END) - 
      COALESCE((SELECT SUM(amount) FROM public.merchant_payouts WHERE "shopId" = p_shop_id AND status = 'Settled'), 0.00),
      0.00
    ) as pending_settlement_amount
  FROM public.orders o
  WHERE o."shopIds" @> ARRAY[p_shop_id]
    AND o."createdAt" >= p_start_date
    AND o."createdAt" <= p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- STEP 7: MERCHANT NOTIFICATION CDC PUBLICATION ATTACHMENT
-- Auto warm-up and sync on CDC
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_audit_logs, public.merchant_payouts;
