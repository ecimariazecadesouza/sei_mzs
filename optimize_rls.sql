-- ==============================================================================
-- RLS OPTIMIZATION SCRIPT (FINAL REVISION)
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
RETURNS boolean 
LANGUAGE sql 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin_ti', 'admin_dir')
  );
$$;

-- 0.1 Helper Function: system_has_users()
-- Allows frontend to check if setup is needed without exposing user data
CREATE OR REPLACE FUNCTION public.system_has_users()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users);
$$;
GRANT EXECUTE ON FUNCTION public.system_has_users TO anon, authenticated, service_role;


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
-- Drops for split policies if re-run
DROP POLICY IF EXISTS "Admin Insert Academic Years" ON public.academic_years;
DROP POLICY IF EXISTS "Admin Update Academic Years" ON public.academic_years;
DROP POLICY IF EXISTS "Admin Delete Academic Years" ON public.academic_years;


-- SELECT: Consolidate multiple policies
CREATE POLICY "Unified Select Academic Years" ON public.academic_years
FOR SELECT
USING (
  true
);

-- WRITE (Split to avoid 'Multiple Permissive Policies' warning with SELECT)
CREATE POLICY "Admin Insert Academic Years" ON public.academic_years
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admin Update Academic Years" ON public.academic_years
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin Delete Academic Years" ON public.academic_years
FOR DELETE USING (public.is_admin());


-- ------------------------------------------------------------------------------
-- 3. Optimize 'public.settings' policies
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Leitura total" ON public.settings;
DROP POLICY IF EXISTS "Write settings" ON public.settings;
DROP POLICY IF EXISTS "Unified Select Settings" ON public.settings;
DROP POLICY IF EXISTS "Admin Write Settings" ON public.settings;
-- Drops for split policies if re-run
DROP POLICY IF EXISTS "Admin Insert Settings" ON public.settings;
DROP POLICY IF EXISTS "Admin Update Settings" ON public.settings;
DROP POLICY IF EXISTS "Admin Delete Settings" ON public.settings;


-- SELECT: Consolidate "Leitura total" and "Write settings"
CREATE POLICY "Unified Select Settings" ON public.settings
FOR SELECT
USING (
  true
);

-- WRITE (Split to avoid 'Multiple Permissive Policies' warning with SELECT)
CREATE POLICY "Admin Insert Settings" ON public.settings
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admin Update Settings" ON public.settings
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin Delete Settings" ON public.settings
FOR DELETE USING (public.is_admin());
