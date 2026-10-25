-- ==============================================================================
-- Migration: 027_roles_and_manager_pin.sql
-- Description:
-- 1. Expanded RBAC Roles (cashier, waiter, kitchen, staff, manager, owner)
-- 2. Permission Matrix Functions (can_discount, can_void, can_refund, can_open_drawer, can_edit_menu, can_see_reports)
-- 3. Manager PIN Hardening:
--    - Remove plaintext manager_pin and default '1234'
--    - Store only cryptographic hash (salt$sha256 or crypt)
--    - Force owner to set it via pos_set_manager_pin
--    - 5-attempt / 15-minute lockout enforcement
--    - Write failed attempts to public.audit_log
-- 4. RLS Policy Hardening for Roles
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXPANDED ROLES CONSTRAINT
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_staff_role'
    ) THEN
        ALTER TABLE public.staff_profiles DROP CONSTRAINT chk_staff_role;
    END IF;

    ALTER TABLE public.staff_profiles 
        ADD CONSTRAINT chk_staff_role 
        CHECK (role IN ('owner', 'manager', 'cashier', 'waiter', 'kitchen', 'staff'));
END $$;

-- ------------------------------------------------------------------------------
-- 2. PERMISSION MATRIX FUNCTIONS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_staff_role(p_uid UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT role FROM public.staff_profiles
    WHERE user_id = p_uid AND active = true
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_discount(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE user_id = p_uid AND active = true AND role IN ('owner', 'manager')
    );
$$;

CREATE OR REPLACE FUNCTION public.can_void(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE user_id = p_uid AND active = true AND role IN ('owner', 'manager')
    );
$$;

CREATE OR REPLACE FUNCTION public.can_refund(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE user_id = p_uid AND active = true AND role IN ('owner', 'manager')
    );
$$;

CREATE OR REPLACE FUNCTION public.can_open_drawer(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE user_id = p_uid AND active = true AND role IN ('owner', 'manager', 'cashier')
    );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_menu(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE user_id = p_uid AND active = true AND role IN ('owner', 'manager')
    );
$$;

CREATE OR REPLACE FUNCTION public.can_see_reports(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE user_id = p_uid AND active = true AND role IN ('owner', 'manager')
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_role(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_discount(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_void(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_refund(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_open_drawer(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_menu(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_see_reports(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. MANAGER PIN SCHEMA HARDENING & LOCKOUT
-- ------------------------------------------------------------------------------
ALTER TABLE public.restaurant_settings ALTER COLUMN tax_rate DROP NOT NULL;

ALTER TABLE public.restaurant_settings
    ADD COLUMN IF NOT EXISTS manager_pin_hash TEXT NULL,
    ADD COLUMN IF NOT EXISTS manager_pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS manager_pin_locked_until TIMESTAMPTZ NULL;

-- Drop legacy plaintext manager_pin column if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'restaurant_settings' AND column_name = 'manager_pin'
    ) THEN
        ALTER TABLE public.restaurant_settings DROP COLUMN manager_pin;
    END IF;
END $$;

-- Cryptographic PIN hash helper
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Cryptographic PIN hash helper (Blowfish bcrypt via pgcrypto)
CREATE OR REPLACE FUNCTION public.hash_manager_pin(p_pin TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_pin IS NULL OR length(trim(p_pin)) < 4 OR length(trim(p_pin)) > 8 OR trim(p_pin) !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'Manager PIN must be between 4 and 8 numeric digits';
    END IF;

    -- Blowfish bcrypt hash via pgcrypto
    RETURN crypt(trim(p_pin), gen_salt('bf', 8));
END;
$$;

-- Cryptographic PIN verify helper
CREATE OR REPLACE FUNCTION public.internal_verify_pin_hash(p_pin TEXT, p_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_salt TEXT;
    v_expected TEXT;
BEGIN
    IF p_pin IS NULL OR p_hash IS NULL OR trim(p_pin) = '' OR trim(p_hash) = '' THEN
        RETURN FALSE;
    END IF;

    -- 1. Blowfish bcrypt ($2a$ or $2b$) check via pgcrypto crypt()
    IF p_hash LIKE '$2%' THEN
        RETURN (crypt(trim(p_pin), p_hash) = p_hash);
    END IF;

    -- 2. Legacy Salted SHA-256 format: "salt$hexhash"
    IF position('$' IN p_hash) > 0 THEN
        v_salt := split_part(p_hash, '$', 1);
        v_expected := v_salt || '$' || encode(sha256((v_salt || ':' || trim(p_pin))::bytea), 'hex');
        RETURN (p_hash = v_expected);
    END IF;

    -- 3. Raw sha256 fallback
    RETURN (p_hash = encode(sha256(trim(p_pin)::bytea), 'hex'));
END;
$$;

-- RPC: pos_set_manager_pin (Owner only)
CREATE OR REPLACE FUNCTION public.pos_set_manager_pin(
    p_new_pin TEXT,
    p_restaurant_id TEXT DEFAULT 'the-cafe-barrackpore'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_hash TEXT;
BEGIN
    -- Only restaurant owner or service_role can set manager PIN
    v_caller_role := COALESCE(public.get_staff_role(auth.uid()), '');
    IF v_caller_role <> 'owner' AND COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: Only restaurant owners can set or update the Manager PIN.';
    END IF;

    v_hash := public.hash_manager_pin(p_new_pin);

    UPDATE public.restaurant_settings
    SET manager_pin_hash = v_hash,
        manager_pin_failed_attempts = 0,
        manager_pin_locked_until = NULL,
        updated_at = now()
    WHERE restaurant_id = p_restaurant_id;

    IF NOT FOUND THEN
        UPDATE public.restaurant_settings
        SET manager_pin_hash = v_hash,
            manager_pin_failed_attempts = 0,
            manager_pin_locked_until = NULL,
            updated_at = now()
        WHERE id = 'current';
    END IF;

    -- Audit log
    INSERT INTO public.audit_log (
        restaurant_id, actor_id, actor_role, action, target_type, target_id, details
    ) VALUES (
        p_restaurant_id,
        COALESCE(auth.uid()::text, 'service_role'),
        COALESCE(v_caller_role, 'owner'),
        'manager_pin_configured',
        'restaurant_settings',
        p_restaurant_id,
        jsonb_build_object('timestamp', now())
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Manager PIN updated successfully.'
    );
END;
$$;

-- RPC: pos_verify_manager_pin (5 attempts lockout + audit log)
CREATE OR REPLACE FUNCTION public.pos_verify_manager_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pin_hash TEXT;
    v_failed_attempts INTEGER;
    v_locked_until TIMESTAMPTZ;
    v_restaurant_id TEXT := 'the-cafe-barrackpore';
    v_is_valid BOOLEAN := FALSE;
BEGIN
    -- 1. Fetch current PIN settings
    SELECT manager_pin_hash, manager_pin_failed_attempts, manager_pin_locked_until, restaurant_id
    INTO v_pin_hash, v_failed_attempts, v_locked_until, v_restaurant_id
    FROM public.restaurant_settings
    ORDER BY (restaurant_id = 'the-cafe-barrackpore') DESC
    LIMIT 1;

    -- 2. Lockout check (5 tries, 15 min)
    IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
        RAISE EXCEPTION 'Manager PIN is temporarily locked due to multiple failed attempts. Try again after %', v_locked_until;
    END IF;

    -- 3. Check if owner has configured PIN
    IF v_pin_hash IS NULL OR trim(v_pin_hash) = '' THEN
        RAISE EXCEPTION 'Manager PIN has not been configured. The owner must set the Manager PIN during setup.';
    END IF;

    -- 4. Verify PIN
    v_is_valid := public.internal_verify_pin_hash(p_pin, v_pin_hash);

    IF v_is_valid THEN
        -- Success: reset failed attempts counter & lockout
        IF COALESCE(v_failed_attempts, 0) > 0 OR v_locked_until IS NOT NULL THEN
            UPDATE public.restaurant_settings
            SET manager_pin_failed_attempts = 0,
                manager_pin_locked_until = NULL
            WHERE restaurant_id = v_restaurant_id;
        END IF;
        RETURN TRUE;
    ELSE
        -- Failure: increment counter and lock if >= 5 attempts
        v_failed_attempts := COALESCE(v_failed_attempts, 0) + 1;
        IF v_failed_attempts >= 5 THEN
            v_locked_until := now() + interval '15 minutes';
        END IF;

        UPDATE public.restaurant_settings
        SET manager_pin_failed_attempts = v_failed_attempts,
            manager_pin_locked_until = v_locked_until
        WHERE restaurant_id = v_restaurant_id;

        -- Write failed attempt to audit log
        INSERT INTO public.audit_log (
            restaurant_id, actor_id, actor_role, action, target_type, target_id, details
        ) VALUES (
            v_restaurant_id,
            COALESCE(auth.uid()::text, 'anonymous'),
            COALESCE(public.get_staff_role(auth.uid()), 'unknown'),
            'manager_pin_failed',
            'restaurant_settings',
            'manager_pin',
            jsonb_build_object(
                'failed_attempts', v_failed_attempts,
                'locked_until', v_locked_until,
                'client_ip', NULL
            )
        );

        RETURN FALSE;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.hash_manager_pin(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_set_manager_pin(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_verify_manager_pin(TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. RLS POLICIES FOR PERMISSION MATRIX
-- ------------------------------------------------------------------------------
-- Menu Items RLS: Only can_edit_menu (owner, manager) can INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "staff_manage_menu_items" ON public.menu_items;
CREATE POLICY "staff_manage_menu_items"
ON public.menu_items
FOR ALL
TO authenticated
USING (public.can_edit_menu(auth.uid()))
WITH CHECK (public.can_edit_menu(auth.uid()));

-- Cash Drawer Transactions RLS: Only can_open_drawer (owner, manager, cashier) can SELECT/INSERT
DROP POLICY IF EXISTS "staff_cash_drawer_transactions" ON public.cash_drawer_transactions;
CREATE POLICY "staff_cash_drawer_transactions"
ON public.cash_drawer_transactions
FOR ALL
TO authenticated
USING (public.can_open_drawer(auth.uid()))
WITH CHECK (public.can_open_drawer(auth.uid()));

-- Audit Log RLS: Only can_see_reports (owner, manager) can view audit log
DROP POLICY IF EXISTS "staff_view_audit_log" ON public.audit_log;
CREATE POLICY "staff_view_audit_log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.can_see_reports(auth.uid()));

-- Table Privileges for Authenticated Staff
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bills TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bill_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bill_splits TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kot_batches TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cash_shifts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cash_drawer_transactions TO authenticated, service_role;

