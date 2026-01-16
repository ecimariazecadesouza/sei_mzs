-- ==============================================================================
-- RLS OPTIMIZATION SCRIPT (CORRIGIDO)
-- ==============================================================================
-- This script optimizes Row Level Security policies to resolve performance 
-- warnings described in your database linter.
--
-- IMPORTANT:
-- 1. Run this in your Supabase SQL Editor.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. Helper Function: is_admin()
-- ------------------------------------------------------------------------------
-- Creating the function first so it can be used in the policies below.
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;


-- ------------------------------------------------------------------------------
-- 1. Optimize 'public.users' policies
-- ------------------------------------------------------------------------------

-- Drop existing multiple policies to replace them with consolidated ones
DROP POLICY IF EXISTS "Leitura total" ON public.users;
DROP POLICY IF EXISTS "Manage users admin" ON public.users;
DROP POLICY IF EXISTS "View users" ON public.users;
DROP POLICY IF EXISTS "First admin setup" ON public.users;
DROP POLICY IF EXISTS "Self update name" ON public.users;
DROP POLICY IF EXISTS "Unified Select Users" ON public.users;
DROP POLICY IF EXISTS "Unified Update Users" ON public.users;
DROP POLICY IF EXISTS "Unified Insert Users" ON public.users;


-- SELECT: Consolidate "Manage users admin" and "View users"
CREATE POLICY "Unified Select Users" ON public.users
FOR SELECT
USING (
  (select auth.uid()) = id 
  OR 
  (public.is_admin()) 
);

-- UPDATE: Consolidate "Manage users admin" and "Self update name"
CREATE POLICY "Unified Update Users" ON public.users
FOR UPDATE
USING (
  (select auth.uid()) = id 
  OR 
  (public.is_admin())
)
WITH CHECK (
  (select auth.uid()) = id 
  OR 
  (public.is_admin())
);

-- INSERT: Consolidate "First admin setup" and "Manage users admin"
CREATE POLICY "Unified Insert Users" ON public.users
FOR INSERT
WITH CHECK (
  -- Allow if first user (setup) OR explicit admin permission
  (NOT EXISTS (SELECT 1 FROM public.users)) 
  OR 
  (public.is_admin())
);


-- ------------------------------------------------------------------------------
-- 2. Optimize 'public.academic_years' policies
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Leitura total" ON public.academic_years;
DROP POLICY IF EXISTS "Write academic_years" ON public.academic_years;
DROP POLICY IF EXISTS "Unified Select Academic Years" ON public.academic_years;
DROP POLICY IF EXISTS "Admin Write Academic Years" ON public.academic_years;


-- SELECT: Consolidate multiple policies
CREATE POLICY "Unified Select Academic Years" ON public.academic_years
FOR SELECT
USING (
  true
);

-- INSERT/UPDATE/DELETE: Restore "Write academic_years" logic
CREATE POLICY "Admin Write Academic Years" ON public.academic_years
FOR ALL
USING (
  (public.is_admin())
);


-- ------------------------------------------------------------------------------
-- 3. Optimize 'public.settings' policies
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Leitura total" ON public.settings;
DROP POLICY IF EXISTS "Write settings" ON public.settings;
DROP POLICY IF EXISTS "Unified Select Settings" ON public.settings;
DROP POLICY IF EXISTS "Admin Write Settings" ON public.settings;


-- SELECT: Consolidate "Leitura total" and "Write settings"
CREATE POLICY "Unified Select Settings" ON public.settings
FOR SELECT
USING (
  true
);

-- WRITE (INSERT/UPDATE): Admin only
CREATE POLICY "Admin Write Settings" ON public.settings
FOR ALL
USING (
  (public.is_admin())
);
