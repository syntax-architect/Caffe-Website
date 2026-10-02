-- ==============================================================================
-- Migration: 003_staff_profiles.sql
-- Description: Staff profiles schema, role constraints, RLS policies, and helper functions
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- 1. STAFF PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_staff_role CHECK (role IN ('owner', 'manager', 'staff')),
    CONSTRAINT chk_staff_name CHECK (length(trim(full_name)) >= 2)
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_staff_profiles_user_id ON public.staff_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_role ON public.staff_profiles(role);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_active ON public.staff_profiles(active);

-- 3. UPDATED_AT TRIGGER
DROP TRIGGER IF EXISTS trg_staff_profiles_updated_at ON public.staff_profiles;
CREATE TRIGGER trg_staff_profiles_updated_at
    BEFORE UPDATE ON public.staff_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

-- Anonymous users: ALL DENIED
-- Authenticated users: Only active staff can view their own profile.
DROP POLICY IF EXISTS "Staff can view own profile" ON public.staff_profiles;
CREATE POLICY "Staff can view own profile"
    ON public.staff_profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Staff members can update basic info on their own profile (name only, not role or active)
DROP POLICY IF EXISTS "Staff can update own name" ON public.staff_profiles;
CREATE POLICY "Staff can update own name"
    ON public.staff_profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id
        AND role = (SELECT sp.role FROM public.staff_profiles sp WHERE sp.user_id = auth.uid())
        AND active = (SELECT sp.active FROM public.staff_profiles sp WHERE sp.user_id = auth.uid())
    );

-- 5. SECURE DATABASE HELPER FUNCTIONS (SECURITY DEFINER)
-- Checks whether a user is active staff
CREATE OR REPLACE FUNCTION public.is_active_staff(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE user_id = p_uid AND active = true
    );
$$;

-- Zero-argument overload defaulting to current authenticated user
CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE user_id = auth.uid() AND active = true
    );
$$;

-- Returns the role of an active staff member
CREATE OR REPLACE FUNCTION public.get_staff_role(p_uid UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT role FROM public.staff_profiles
    WHERE user_id = p_uid AND active = true;
$$;

-- Revoke broad public permissions and grant to authenticated
REVOKE ALL ON FUNCTION public.is_active_staff(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_staff(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_active_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_staff() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_staff_role(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_role(UUID) TO authenticated, service_role;

-- 6. OWNER & MANAGER PRIVILEGES ON STAFF PROFILES
DROP POLICY IF EXISTS "Owners and managers can view all staff profiles" ON public.staff_profiles;
CREATE POLICY "Owners and managers can view all staff profiles"
    ON public.staff_profiles
    FOR SELECT
    TO authenticated
    USING (
        public.get_staff_role(auth.uid()) IN ('owner', 'manager')
    );

DROP POLICY IF EXISTS "Owners can manage staff profiles" ON public.staff_profiles;
CREATE POLICY "Owners can manage staff profiles"
    ON public.staff_profiles
    FOR ALL
    TO authenticated
    USING (
        public.get_staff_role(auth.uid()) = 'owner'
    )
    WITH CHECK (
        public.get_staff_role(auth.uid()) = 'owner'
    );

-- 7. SECURE STAFF ACCESS POLICIES FOR ORDERS AND RESERVATIONS
-- Allows active staff members to view and process orders and reservations
-- without exposing customer data to the anonymous public.

-- Orders: Active staff can view orders
DROP POLICY IF EXISTS "Active staff can view orders" ON public.orders;
CREATE POLICY "Active staff can view orders"
    ON public.orders
    FOR SELECT
    TO authenticated
    USING (public.is_active_staff(auth.uid()));

-- Order Items: Active staff can view order items
DROP POLICY IF EXISTS "Active staff can view order_items" ON public.order_items;
CREATE POLICY "Active staff can view order_items"
    ON public.order_items
    FOR SELECT
    TO authenticated
    USING (public.is_active_staff(auth.uid()));

-- Orders: Active staff can update order status
DROP POLICY IF EXISTS "Active staff can update orders" ON public.orders;
CREATE POLICY "Active staff can update orders"
    ON public.orders
    FOR UPDATE
    TO authenticated
    USING (public.is_active_staff(auth.uid()))
    WITH CHECK (public.is_active_staff(auth.uid()));

-- Reservations: Active staff can view reservations
DROP POLICY IF EXISTS "Active staff can view reservations" ON public.reservations;
CREATE POLICY "Active staff can view reservations"
    ON public.reservations
    FOR SELECT
    TO authenticated
    USING (public.is_active_staff(auth.uid()));

-- Reservations: Active staff can update reservations
DROP POLICY IF EXISTS "Active staff can update reservations" ON public.reservations;
CREATE POLICY "Active staff can update reservations"
    ON public.reservations
    FOR UPDATE
    TO authenticated
    USING (public.is_active_staff(auth.uid()))
    WITH CHECK (public.is_active_staff(auth.uid()));
