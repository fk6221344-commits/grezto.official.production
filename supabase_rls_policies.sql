-- =========================================================================================
-- GREZTO APP: STRICT ROW LEVEL SECURITY (RLS) POLICIES
-- Instructions: Copy and paste this script into your Supabase SQL Editor and run it.
-- This will lock down your database to ensure nobody can access or delete data without permission.
-- =========================================================================================

-- 1. Enable RLS on all primary tables
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies (if any, so this script is safe to run multiple times)
DROP POLICY IF EXISTS "Public users can view products" ON public.products;
DROP POLICY IF EXISTS "Public users can view shops" ON public.shops;
DROP POLICY IF EXISTS "Public users can view banners" ON public.banners;
DROP POLICY IF EXISTS "Public users can view categories" ON public.categories;
DROP POLICY IF EXISTS "Users can only read their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can only update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can only view their own orders" ON public.orders;

-- 3. Public READ-ONLY access for core catalog (everyone can see products, shops, etc.)
CREATE POLICY "Public users can view products" 
ON public.products FOR SELECT 
USING (true);

CREATE POLICY "Public users can view shops" 
ON public.shops FOR SELECT 
USING (true);

CREATE POLICY "Public users can view banners" 
ON public.banners FOR SELECT 
USING (true);

CREATE POLICY "Public users can view categories" 
ON public.categories FOR SELECT 
USING (true);

-- 4. Secure Users Table (Strictly locked to the authenticated user's ID)
-- A user can only see their OWN data if auth.uid() matches their id.
CREATE POLICY "Users can only read their own profile"
ON public.users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can only update their own profile"
ON public.users FOR UPDATE
USING (auth.uid() = id);

-- 5. Secure Orders Table (Strictly locked to the authenticated user's ID)
-- A user can only read their own orders.
CREATE POLICY "Users can only view their own orders"
ON public.orders FOR SELECT
USING (auth.uid() = user_id);

-- Note: No policies are created for DELETE on these tables for regular users, 
-- which means DELETE is DENIED by default for everyone except the Supabase service_role.
