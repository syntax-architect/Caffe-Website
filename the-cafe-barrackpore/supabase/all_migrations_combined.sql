-- ==============================================================================
-- COMPLETE DATABASE INITIALIZATION SCRIPT
-- Runs all migrations (001 - 024) in proper dependency order.
-- Copy and paste this ENTIRE script into Supabase Dashboard -> SQL Editor and click Run.
-- ==============================================================================


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 001_initial_orders.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 001_initial_orders.sql
-- Description: Core orders and order_items schema for The Café Barrackpore
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_ref TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    order_type TEXT NOT NULL,
    table_number TEXT NULL,
    special_requests TEXT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    total NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    source TEXT NOT NULL DEFAULT 'website',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_orders_order_type CHECK (order_type IN ('dine_in', 'takeaway')),
    CONSTRAINT chk_orders_status CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
    CONSTRAINT chk_orders_subtotal CHECK (subtotal >= 0),
    CONSTRAINT chk_orders_total CHECK (total >= 0),
    CONSTRAINT chk_orders_customer_name CHECK (length(trim(customer_name)) >= 2),
    CONSTRAINT chk_orders_customer_phone CHECK (length(trim(customer_phone)) >= 10),
    CONSTRAINT chk_orders_order_ref CHECK (length(trim(order_ref)) >= 4),
    CONSTRAINT chk_orders_dine_in_table CHECK (
        (order_type = 'dine_in' AND table_number IS NOT NULL AND length(trim(table_number)) > 0)
        OR (order_type = 'takeaway')
    )
);

-- 3. ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    line_total NUMERIC(10, 2) NOT NULL,
    selected_options JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_order_items_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_order_items_line_total CHECK (line_total >= 0),
    CONSTRAINT chk_order_items_item_name CHECK (length(trim(item_name)) > 0)
);

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_orders_order_ref ON public.orders(order_ref);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- 5. AUTOMATIC UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 6. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Anonymous public website customers: INSERT only.
-- Strict Privacy: No public SELECT, UPDATE, or DELETE permissions.
-- Customers cannot scrape or browse other customer orders.
DROP POLICY IF EXISTS "Allow public order insertion" ON public.orders;
CREATE POLICY "Allow public order insertion"
    ON public.orders
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public order_items insertion" ON public.order_items;
CREATE POLICY "Allow public order_items insertion"
    ON public.order_items
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- 7. SECURE ATOMIC RPC (TRANSACTIONAL ORDER CREATION)
-- Allows creating an order and its items in a single atomic transaction.
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order JSONB,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id UUID;
    v_order_ref TEXT;
    v_item JSONB;
BEGIN
    v_order_ref := p_order->>'order_ref';
    
    -- Ensure order reference is present
    IF v_order_ref IS NULL OR length(trim(v_order_ref)) < 4 THEN
        RAISE EXCEPTION 'Invalid or missing order reference';
    END IF;

    -- Insert order record
    INSERT INTO public.orders (
        order_ref,
        customer_name,
        customer_phone,
        order_type,
        table_number,
        special_requests,
        subtotal,
        total,
        status,
        source
    )
    VALUES (
        v_order_ref,
        p_order->>'customer_name',
        p_order->>'customer_phone',
        p_order->>'order_type',
        NULLIF(p_order->>'table_number', ''),
        NULLIF(p_order->>'special_requests', ''),
        (p_order->>'subtotal')::NUMERIC,
        (p_order->>'total')::NUMERIC,
        COALESCE(p_order->>'status', 'pending'),
        COALESCE(p_order->>'source', 'website')
    )
    RETURNING id INTO v_order_id;

    -- Insert all order items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price,
            line_total,
            selected_options
        )
        VALUES (
            v_order_id,
            v_item->>'menu_item_id',
            v_item->>'item_name',
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_price')::NUMERIC,
            (v_item->>'line_total')::NUMERIC,
            COALESCE(v_item->'selected_options', '{}'::jsonb)
        );
    END LOOP;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_ref', v_order_ref,
        'success', true
    );
END;
$$;

-- Grant execution permission for atomic ordering
GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 002_reservations.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 002_reservations.sql
-- Description: Core reservations table, constraints, RLS, and atomic creation RPC
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- 1. RESERVATIONS TABLE
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_ref TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    reservation_date DATE NOT NULL,
    reservation_time TEXT NOT NULL,
    party_size INTEGER NOT NULL,
    special_requests TEXT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    source TEXT NOT NULL DEFAULT 'website',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_reservations_status CHECK (
        status IN ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show')
    ),
    CONSTRAINT chk_reservations_party_size CHECK (party_size > 0 AND party_size <= 20),
    CONSTRAINT chk_reservations_customer_name CHECK (length(trim(customer_name)) >= 2),
    CONSTRAINT chk_reservations_customer_phone CHECK (length(trim(customer_phone)) >= 10),
    CONSTRAINT chk_reservations_ref CHECK (length(trim(reservation_ref)) >= 4),
    CONSTRAINT chk_reservations_time CHECK (length(trim(reservation_time)) > 0)
);

-- 2. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_reservations_reservation_ref ON public.reservations(reservation_ref);
CREATE INDEX IF NOT EXISTS idx_reservations_reservation_date ON public.reservations(reservation_date);
CREATE INDEX IF NOT EXISTS idx_reservations_reservation_time ON public.reservations(reservation_time);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_customer_phone ON public.reservations(customer_phone);
CREATE INDEX IF NOT EXISTS idx_reservations_created_at ON public.reservations(created_at DESC);

-- 3. AUTOMATIC UPDATED_AT TRIGGER
DROP TRIGGER IF EXISTS trg_reservations_updated_at ON public.reservations;
CREATE TRIGGER trg_reservations_updated_at
    BEFORE UPDATE ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Anonymous public website visitors: INSERT only.
-- Strict Privacy: No public SELECT, UPDATE, or DELETE permissions.
-- Prevents unauthorized scraping or enumeration of customer reservations.
DROP POLICY IF EXISTS "Allow public reservation insertion" ON public.reservations;
CREATE POLICY "Allow public reservation insertion"
    ON public.reservations
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- 5. SECURE ATOMIC RPC (TRANSACTIONAL RESERVATION CREATION)
CREATE OR REPLACE FUNCTION public.create_reservation_atomic(
    p_reservation JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_res_id UUID;
    v_res_ref TEXT;
BEGIN
    v_res_ref := p_reservation->>'reservation_ref';

    -- Validate reservation reference presence
    IF v_res_ref IS NULL OR length(trim(v_res_ref)) < 4 THEN
        RAISE EXCEPTION 'Invalid or missing reservation reference';
    END IF;

    -- Insert reservation record
    INSERT INTO public.reservations (
        reservation_ref,
        customer_name,
        customer_phone,
        reservation_date,
        reservation_time,
        party_size,
        special_requests,
        status,
        source
    )
    VALUES (
        v_res_ref,
        p_reservation->>'customer_name',
        p_reservation->>'customer_phone',
        (p_reservation->>'reservation_date')::DATE,
        p_reservation->>'reservation_time',
        (p_reservation->>'party_size')::INTEGER,
        NULLIF(p_reservation->>'special_requests', ''),
        COALESCE(p_reservation->>'status', 'pending'),
        COALESCE(p_reservation->>'source', 'website')
    )
    RETURNING id INTO v_res_id;

    RETURN jsonb_build_object(
        'reservation_id', v_res_id,
        'reservation_ref', v_res_ref,
        'success', true
    );
END;
$$;

-- Explicitly revoke broad execution permissions before granting to target roles
REVOKE ALL ON FUNCTION public.create_reservation_atomic(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_reservation_atomic(JSONB) TO anon, authenticated;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 003_staff_profiles.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 004_restaurant_tables.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 004_restaurant_tables.sql
-- Description: Restaurant floor tables management, operational settings, and RLS
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- 1. RESTAURANT TABLES TABLE
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number TEXT UNIQUE NOT NULL,
    label TEXT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_table_number_format CHECK (length(trim(table_number)) >= 1 AND length(trim(table_number)) <= 10),
    CONSTRAINT chk_table_capacity CHECK (capacity >= 1 AND capacity <= 50)
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_number ON public.restaurant_tables(table_number);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_active ON public.restaurant_tables(active);

-- 3. UPDATED_AT TRIGGER
DROP TRIGGER IF EXISTS trg_restaurant_tables_updated_at ON public.restaurant_tables;
CREATE TRIGGER trg_restaurant_tables_updated_at
    BEFORE UPDATE ON public.restaurant_tables
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

-- Anonymous public: Read-only for active tables (for QR validation)
DROP POLICY IF EXISTS "Public can view active tables" ON public.restaurant_tables;
CREATE POLICY "Public can view active tables"
    ON public.restaurant_tables
    FOR SELECT
    TO anon, authenticated
    USING (active = true);

-- Active staff: View all tables (including deactivated ones)
DROP POLICY IF EXISTS "Active staff can view all tables" ON public.restaurant_tables;
CREATE POLICY "Active staff can view all tables"
    ON public.restaurant_tables
    FOR SELECT
    TO authenticated
    USING (public.is_active_staff(auth.uid()));

-- Owners and Managers: Manage tables (insert, update, delete)
DROP POLICY IF EXISTS "Owners and managers can manage tables" ON public.restaurant_tables;
CREATE POLICY "Owners and managers can manage tables"
    ON public.restaurant_tables
    FOR ALL
    TO authenticated
    USING (public.get_staff_role(auth.uid()) IN ('owner', 'manager'))
    WITH CHECK (public.get_staff_role(auth.uid()) IN ('owner', 'manager'));

-- 5. RESTAURANT SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.restaurant_settings (
    id TEXT PRIMARY KEY DEFAULT 'current',
    business_name TEXT NOT NULL DEFAULT 'The Café Barrackpore',
    phone TEXT NOT NULL DEFAULT '+919830000000',
    address TEXT NOT NULL DEFAULT '14, Riverside Road, Cantonment, Barrackpore',
    is_ordering_enabled BOOLEAN NOT NULL DEFAULT true,
    is_table_booking_enabled BOOLEAN NOT NULL DEFAULT true,
    opening_time TEXT NOT NULL DEFAULT '11:00 AM',
    closing_time TEXT NOT NULL DEFAULT '11:00 PM',
    announcement_banner TEXT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;

-- Public read for operational settings
DROP POLICY IF EXISTS "Public can read restaurant settings" ON public.restaurant_settings;
CREATE POLICY "Public can read restaurant settings"
    ON public.restaurant_settings
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Owners can update restaurant settings
DROP POLICY IF EXISTS "Owners can update restaurant settings" ON public.restaurant_settings;
CREATE POLICY "Owners can update restaurant settings"
    ON public.restaurant_settings
    FOR UPDATE
    TO authenticated
    USING (public.get_staff_role(auth.uid()) = 'owner')
    WITH CHECK (public.get_staff_role(auth.uid()) = 'owner');

-- 6. SEED DEFAULT TABLES (Tables 01 to 12)
INSERT INTO public.restaurant_tables (table_number, label, capacity, active)
VALUES
    ('01', 'Window Seat - Corner', 2, true),
    ('02', 'Window Seat - Riverside', 2, true),
    ('03', 'Cozy Booth', 4, true),
    ('04', 'Central Table', 4, true),
    ('05', 'Central Table', 4, true),
    ('06', 'High Top Bar Table', 2, true),
    ('07', 'Balcony Table - Best View', 4, true),
    ('08', 'Balcony Table', 4, true),
    ('09', 'Family Dining Booth', 6, true),
    ('10', 'Family Dining Booth', 6, true),
    ('11', 'Garden Terrace Table', 4, true),
    ('12', 'VIP Private Lounge', 8, true)
ON CONFLICT (table_number) DO NOTHING;

-- Seed default settings row
INSERT INTO public.restaurant_settings (id, business_name, phone, address, is_ordering_enabled, is_table_booking_enabled, opening_time, closing_time)
VALUES ('current', 'The Café Barrackpore', '+919830000000', '14, Riverside Road, Cantonment, Barrackpore', true, true, '11:00 AM', '11:00 PM')
ON CONFLICT (id) DO NOTHING;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 005_menu_availability.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 005_menu_availability.sql
-- Description: Operational Menu Availability & 86'd State Layer
-- Author: The Café Barrackpore Engineering Team
-- ==============================================================================

-- 1. Create menu_item_availability table
CREATE TABLE IF NOT EXISTS public.menu_item_availability (
    item_id VARCHAR(100) PRIMARY KEY,
    is_available BOOLEAN NOT NULL DEFAULT true,
    reason VARCHAR(255) DEFAULT '86''d out of stock',
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_menu_availability_available ON public.menu_item_availability (is_available);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.menu_item_availability ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Anyone (public customers, QR ordering, staff) can read availability
DROP POLICY IF EXISTS "public_read_menu_availability" ON public.menu_item_availability;
CREATE POLICY "public_read_menu_availability"
ON public.menu_item_availability
FOR SELECT
USING (true);

-- Active staff members can update or insert availability states
DROP POLICY IF EXISTS "staff_manage_menu_availability" ON public.menu_item_availability;
CREATE POLICY "staff_manage_menu_availability"
ON public.menu_item_availability
FOR ALL
USING (public.is_active_staff())
WITH CHECK (public.is_active_staff());

-- 4. Stored Procedure for atomic operational toggles
CREATE OR REPLACE FUNCTION public.toggle_menu_item_availability(
    p_item_id TEXT,
    p_is_available BOOLEAN,
    p_reason TEXT DEFAULT '86''d out of stock'
)
RETURNS public.menu_item_availability
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_updated_row public.menu_item_availability;
BEGIN
    -- Verify active staff permission
    IF NOT public.is_active_staff() THEN
        RAISE EXCEPTION 'Access denied: Only active staff can toggle menu availability.'
            USING ERRCODE = '42501';
    END IF;

    -- Upsert the availability state
    INSERT INTO public.menu_item_availability (
        item_id,
        is_available,
        reason,
        updated_by,
        updated_at
    )
    VALUES (
        p_item_id,
        p_is_available,
        p_reason,
        auth.uid(),
        timezone('utc'::text, now())
    )
    ON CONFLICT (item_id)
    DO UPDATE SET
        is_available = EXCLUDED.is_available,
        reason = EXCLUDED.reason,
        updated_by = auth.uid(),
        updated_at = timezone('utc'::text, now())
    RETURNING * INTO v_updated_row;

    RETURN v_updated_row;
END;
$$;

-- Grant permissions on stored procedure
REVOKE ALL ON FUNCTION public.toggle_menu_item_availability(TEXT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_menu_item_availability(TEXT, BOOLEAN, TEXT) TO authenticated;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 006_kitchen_realtime.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 006_kitchen_realtime.sql
-- Description: Realtime publication and kitchen order state transition validation
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- 1. REALTIME PUBLICATION CONFIGURATION
-- Ensure Supabase Realtime listens to orders and order_items changes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
    END IF;
  END IF;
END $$;

-- 2. REPLICA IDENTITY FOR FULL PAYLOAD BROADCAST
-- Allows Realtime clients to receive previous and new record values on UPDATE
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- 3. HARDENED STORED PROCEDURE: KITCHEN ORDER STATUS TRANSITION
CREATE OR REPLACE FUNCTION public.update_order_status_kitchen(
  p_order_id UUID,
  p_new_status TEXT,
  p_expected_current_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_current_status TEXT;
  v_order_ref TEXT;
  v_caller_role TEXT;
  v_is_active BOOLEAN;
  v_updated_order RECORD;
BEGIN
  -- 1. Verify caller is active staff
  SELECT active, role INTO v_is_active, v_caller_role
  FROM public.staff_profiles
  WHERE user_id = auth.uid();

  IF v_is_active IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Only active staff can modify order status.'
    );
  END IF;

  -- 2. Validate requested new status format
  IF p_new_status NOT IN ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid order status: ' || COALESCE(p_new_status, 'null')
    );
  END IF;

  -- 3. Fetch existing order
  SELECT status, order_ref INTO v_current_status, v_order_ref
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found.'
    );
  END IF;

  -- 4. Concurrency check: If expected status provided, verify current status matches
  IF p_expected_current_status IS NOT NULL AND v_current_status <> p_expected_current_status THEN
    RETURN jsonb_build_object(
      'success', false,
      'conflict', true,
      'error', 'This order has already been updated to ' || v_current_status || '.',
      'current_status', v_current_status,
      'order_ref', v_order_ref
    );
  END IF;

  -- 5. Validate status progression state machine
  -- Allowed forward transitions:
  -- pending / confirmed -> preparing
  -- preparing -> ready
  -- ready -> completed
  -- any active state -> cancelled (manager or owner only, or staff with explicit cancellation)
  IF v_current_status = p_new_status THEN
    -- No-op, already at this status
    RETURN jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'status', p_new_status,
      'message', 'Order already in requested status.'
    );
  END IF;

  IF v_current_status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot change status of an order that is already ' || v_current_status || '.'
    );
  END IF;

  IF p_new_status = 'preparing' AND v_current_status NOT IN ('pending', 'confirmed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid transition: Cannot start preparing an order in status ' || v_current_status || '.'
    );
  END IF;

  IF p_new_status = 'ready' AND v_current_status <> 'preparing' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid transition: Cannot mark ready an order in status ' || v_current_status || '.'
    );
  END IF;

  IF p_new_status = 'completed' AND v_current_status <> 'ready' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid transition: Cannot complete an order in status ' || v_current_status || '.'
    );
  END IF;

  -- 6. Apply Status Update
  UPDATE public.orders
  SET 
    status = p_new_status,
    updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_updated_order;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_updated_order.id,
    'order_ref', v_updated_order.order_ref,
    'status', v_updated_order.status,
    'updated_at', v_updated_order.updated_at
  );
END;
$$;

-- 4. REVOKE PUBLIC & GRANT EXECUTE TO AUTHENTICATED
REVOKE ALL ON FUNCTION public.update_order_status_kitchen(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_status_kitchen(UUID, TEXT, TEXT) TO authenticated, service_role;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 007_internationalization.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 007_internationalization.sql
-- Description: Restaurant Localization, Multi-Country Settings, and Order Currency Safety
-- ==============================================================================

-- 1. EXTEND RESTAURANT SETTINGS TABLE WITH LOCALIZATION FIELDS
ALTER TABLE public.restaurant_settings
    ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'IN',
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS currency_symbol TEXT NOT NULL DEFAULT '₹',
    ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en-IN',
    ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    ADD COLUMN IF NOT EXISTS phone_country_code TEXT NOT NULL DEFAULT '+91',
    ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS tax_mode TEXT NOT NULL DEFAULT 'inclusive',
    ADD COLUMN IF NOT EXISTS tax_label TEXT NOT NULL DEFAULT 'GST',
    ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.0500,
    ADD COLUMN IF NOT EXISTS dietary_system TEXT NOT NULL DEFAULT 'india',
    ADD COLUMN IF NOT EXISTS primary_contact_method TEXT NOT NULL DEFAULT 'whatsapp',
    ADD COLUMN IF NOT EXISTS email TEXT NULL DEFAULT 'contact@thecafe.com',
    ADD COLUMN IF NOT EXISTS city TEXT NULL DEFAULT 'Barrackpore',
    ADD COLUMN IF NOT EXISTS state_region TEXT NULL DEFAULT 'West Bengal',
    ADD COLUMN IF NOT EXISTS postal_code TEXT NULL DEFAULT '700120';

-- 2. HISTORICAL ORDER CURRENCY SAFETY
-- Add currency column to orders so past orders permanently remember their currency
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';

-- Index for currency queries if filtered
CREATE INDEX IF NOT EXISTS idx_orders_currency ON public.orders(currency);


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 008_payment_architecture.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 008_payment_architecture.sql
-- Description: Restaurant Customer Payment Architecture, Status Tracking & Ledger
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- 1. EXTEND ORDERS TABLE WITH PAYMENT FIELDS
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_required BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'not_required',
    ADD COLUMN IF NOT EXISTS payment_provider TEXT NULL,
    ADD COLUMN IF NOT EXISTS payment_reference TEXT NULL,
    ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10, 2) NULL,
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL;

-- Payment status check constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_payment_status'
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT chk_orders_payment_status
            CHECK (payment_status IN ('not_required', 'pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded'));
    END IF;
END $$;

-- Indexes for performance & reconciliation
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON public.orders(payment_reference);

-- 2. CREATE PAYMENTS AUDIT & RECONCILIATION LEDGER
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_ref TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_payment_id TEXT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'pending',
    failure_reason TEXT NULL,
    idempotency_key TEXT UNIQUE NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_payments_amount CHECK (amount >= 0),
    CONSTRAINT chk_payments_status CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded'))
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_ref ON public.payments(order_ref);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON public.payments(provider);
CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id ON public.payments(provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key ON public.payments(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- Automatic updated_at trigger for payments
DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 3. ROW LEVEL SECURITY (RLS) FOR PAYMENTS TABLE
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Anonymous public customers can insert payment attempts for their orders
DROP POLICY IF EXISTS "Allow public payment creation" ON public.payments;
CREATE POLICY "Allow public payment creation"
    ON public.payments
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Active staff, managers and owners can read payment records for operations & reconciliation
DROP POLICY IF EXISTS "Allow staff to read payment records" ON public.payments;
CREATE POLICY "Allow staff to read payment records"
    ON public.payments
    FOR SELECT
    TO authenticated
    USING (
        public.is_active_staff(auth.uid())
    );

-- 4. EXTEND RESTAURANT SETTINGS WITH PAYMENT CONFIGURATION
ALTER TABLE public.restaurant_settings
    ADD COLUMN IF NOT EXISTS payment_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'stripe',
    ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'disabled';

-- Payment mode check constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_settings_payment_mode'
    ) THEN
        ALTER TABLE public.restaurant_settings
            ADD CONSTRAINT chk_settings_payment_mode
            CHECK (payment_mode IN ('disabled', 'online', 'optional'));
    END IF;
END $$;

-- 5. UPDATE ATOMIC ORDER RPC TO SUPPORT PAYMENT FIELDS
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order JSONB,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id UUID;
    v_order_ref TEXT;
    v_item JSONB;
    v_payment_required BOOLEAN;
    v_payment_status TEXT;
    v_payment_amount NUMERIC(10, 2);
BEGIN
    v_order_ref := p_order->>'order_ref';
    
    -- Ensure order reference is present
    IF v_order_ref IS NULL OR length(trim(v_order_ref)) < 4 THEN
        RAISE EXCEPTION 'Invalid or missing order reference';
    END IF;

    v_payment_required := COALESCE((p_order->>'payment_required')::BOOLEAN, false);
    v_payment_status := COALESCE(p_order->>'payment_status', CASE WHEN v_payment_required THEN 'pending' ELSE 'not_required' END);
    v_payment_amount := (p_order->>'total')::NUMERIC;

    -- Insert order record with payment & currency information
    INSERT INTO public.orders (
        order_ref,
        customer_name,
        customer_phone,
        order_type,
        table_number,
        special_requests,
        subtotal,
        total,
        status,
        source,
        currency,
        payment_required,
        payment_status,
        payment_provider,
        payment_reference,
        payment_amount
    )
    VALUES (
        v_order_ref,
        p_order->>'customer_name',
        p_order->>'customer_phone',
        p_order->>'order_type',
        NULLIF(p_order->>'table_number', ''),
        NULLIF(p_order->>'special_requests', ''),
        (p_order->>'subtotal')::NUMERIC,
        (p_order->>'total')::NUMERIC,
        COALESCE(p_order->>'status', 'pending'),
        COALESCE(p_order->>'source', 'website'),
        COALESCE(p_order->>'currency', 'INR'),
        v_payment_required,
        v_payment_status,
        NULLIF(p_order->>'payment_provider', ''),
        NULLIF(p_order->>'payment_reference', ''),
        v_payment_amount
    )
    RETURNING id INTO v_order_id;

    -- Insert all order items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price,
            line_total,
            selected_options
        )
        VALUES (
            v_order_id,
            v_item->>'menu_item_id',
            v_item->>'item_name',
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_price')::NUMERIC,
            (v_item->>'line_total')::NUMERIC,
            COALESCE(v_item->'selected_options', '{}'::jsonb)
        );
    END LOOP;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_ref', v_order_ref,
        'payment_status', v_payment_status,
        'payment_required', v_payment_required,
        'success', true
    );
END;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 009_menu_and_secure_orders.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 009_menu_and_secure_orders.sql
-- Description: Canonical Postgres Menu Catalog, Server-Authoritative Order Calculations,
--              and Deterministic Payment Status Allocation.
-- ==============================================================================

-- 1. CREATE CANONICAL MENU TABLE IN POSTGRES
CREATE TABLE IF NOT EXISTS public.menu (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    category TEXT,
    diet TEXT,
    description TEXT,
    image TEXT,
    tag TEXT,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for category, availability & fast lookups
CREATE INDEX IF NOT EXISTS idx_menu_category ON public.menu(category);
CREATE INDEX IF NOT EXISTS idx_menu_is_available ON public.menu(is_available);

-- Compatibility view for menu_items (only create if it does not already exist as a table)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'menu_items'
    ) THEN
        CREATE OR REPLACE VIEW public.menu_items AS SELECT * FROM public.menu;
    END IF;
END $$;

-- 2. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.menu ENABLE ROW LEVEL SECURITY;

-- Public can read menu items
DROP POLICY IF EXISTS "public_read_menu" ON public.menu;
CREATE POLICY "public_read_menu"
    ON public.menu
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Active staff can update or insert menu items
DROP POLICY IF EXISTS "staff_manage_menu" ON public.menu;
CREATE POLICY "staff_manage_menu"
    ON public.menu
    FOR ALL
    TO authenticated
    USING (public.is_active_staff())
    WITH CHECK (public.is_active_staff());

-- 3. SEED CANONICAL RESTAURANT MENU DATA
INSERT INTO public.menu (id, name, price, category, diet, description, image, tag, is_available)
VALUES
    ('hot-and-sour-soup', 'Hot And Sour Soup', 130, 'soups-salads', 'all', 'Peppery broth with wild mushrooms, bamboo shoots and cilantro. Available in veg or chicken.', NULL, NULL, true),
    ('lemon-coriander-soup', 'Lemon Coriander Soup', 150, 'soups-salads', 'veg', 'A refreshing and tangy clear soup flavored with lemon juice and fresh coriander.', NULL, 'Healthy', true),
    ('chicken-clear-soup', 'Chicken Clear Soup', 150, 'soups-salads', 'nv', 'A light and soothing clear broth served with tender chicken chunks and veggies.', NULL, NULL, true),
    ('fish-bowl-soup', 'Fish Bowl Soup', 200, 'soups-salads', 'nv', 'Hearty and aromatic seafood broth featuring fresh fish fillets.', NULL, NULL, true),
    ('chicken-manchow-soup', 'Chicken Manchow Soup', 200, 'soups-salads', 'nv', 'Spicy dark soy-based soup topped with crunchy fried noodles.', NULL, 'Spicy', true),
    ('american-chopsuey', 'American Chopsuey', 300, 'soups-salads', 'nv', 'Crispy fried noodles topped with a sweet and tangy tomato-based chicken gravy.', NULL, NULL, true),
    ('green-salad', 'Green Salad', 90, 'soups-salads', 'veg', 'Farm-fresh cucumber, tomatoes, onions, and carrots served with a wedge of lemon.', NULL, 'Vegan', true),
    ('chicken-salad', 'Chicken Salad', 200, 'soups-salads', 'nv', 'Grilled chicken tossed with crisp greens, cherry tomatoes, and house dressing.', NULL, 'High Protein', true),
    ('pasta-salad', 'Pasta Salad', 250, 'soups-salads', 'all', 'Chilled pasta tossed with colorful veggies in a zesty vinaigrette. Add-ons available.', NULL, NULL, true),
    ('veggie-medley-burger', 'Veggie Medley Burger', 180, 'burgers-pizzas', 'veg', 'Spiced potato-corn crunch patty, caramelized onions and melted cheddar in a toasted bun.', NULL, NULL, true),
    ('paneer-burger-1patty', 'Paneer Burger (Single Patty)', 200, 'burgers-pizzas', 'veg', 'Crispy spiced paneer patty with crisp lettuce and creamy mayo.', NULL, NULL, true),
    ('paneer-burger-2patty', 'Paneer Burger (Double Patty)', 220, 'burgers-pizzas', 'veg', 'Double the paneer goodness! Two crispy spiced paneer patties with crisp lettuce.', NULL, 'Hungry', true),
    ('special-chicken-on-a-bun', 'Special Chicken On A Bun', 250, 'burgers-pizzas', 'nv', 'Flame-grilled thick chicken patty with melted mature cheddar, caramelized onions, crispy bacon & house smoked relish.', NULL, 'Crowd Favorite', true),
    ('margherita-pizza', 'Margherita Pizza', 180, 'burgers-pizzas', 'veg', 'San Marzano plum tomato sauce, bocconcini cheese & sweet garden basil.', NULL, 'Classic', true),
    ('chicken-cheese-pizza', 'Chicken Cheese Pizza', 250, 'burgers-pizzas', 'nv', 'Hand-stretched dough, spicy herb marinara, roasted chicken & molten mozzarella.', NULL, NULL, true),
    ('veg-steam-momo', 'Veg Steam Momo', 150, 'starters-momos', 'veg', 'Delicate dumplings stuffed with seasoned minced vegetables. Steamed to perfection.', NULL, NULL, true),
    ('chicken-steam-momo', 'Chicken Steam Momo', 280, 'starters-momos', 'nv', 'Delicate dumpling wraps stuffed with seasoned minced chicken.', NULL, NULL, true),
    ('chicken-pahadi-momo-steam', 'Chicken Pahadi Momo (Steam)', 200, 'starters-momos', 'nv', 'Infused with Himalayan mountain herbs and cilantro broth, steamed soft.', NULL, 'Special', true),
    ('chicken-pahadi-momo-fried', 'Chicken Pahadi Momo (Fried)', 220, 'starters-momos', 'nv', 'Infused with Himalayan mountain herbs, deep fried for a golden crunch.', NULL, NULL, true),
    ('chicken-pahadi-momo-pan-fried', 'Chicken Pahadi Momo (Pan Fried)', 250, 'starters-momos', 'nv', 'Mountain herb infused momos, pan crisped and tossed in a spicy garlic sauce.', NULL, NULL, true),
    ('fish-spring-roll', 'Fish Spring Roll (Pure Vetki)', 200, 'starters-momos', 'nv', 'Crispy rolls stuffed with fresh Vetki fish and oriental spices.', NULL, NULL, true),
    ('fish-and-chips', 'Fish And Chips (Pure Vetki)', 250, 'starters-momos', 'nv', 'Fresh Bhetki fillet in airy golden batter, hand-cut fries, caper tartar sauce.', NULL, 'Bestseller', true),
    ('fish-goujons', 'Fish Goujons', 240, 'starters-momos', 'nv', 'Crispy breaded fish fingers served with tangy tartar dip.', NULL, NULL, true),
    ('golden-fried-prawn', 'Golden Fried Prawn', 350, 'starters-momos', 'nv', 'Crisp Japanese panko crumb crusted tiger prawns with sweet plum chilli dip.', NULL, NULL, true),
    ('prawn-tempura', 'Prawn Tempura', 380, 'starters-momos', 'nv', 'Light and airy battered prawns, deep-fried to a delicate crisp.', NULL, NULL, true),
    ('thai-lemon-fish', 'Thai Lemon Fish', 280, 'starters-momos', 'nv', 'Steamed or fried fish tossed in a zesty, aromatic Thai lemon and herb sauce.', NULL, NULL, true),
    ('thai-lemon-chicken', 'Thai Lemon Chicken', 250, 'starters-momos', 'nv', 'Tender chicken chunks tossed in a zesty, aromatic Thai lemon sauce.', NULL, NULL, true),
    ('chicken-spring-roll', 'Chicken Spring Roll', 180, 'starters-momos', 'nv', 'Crispy golden wrappers filled with savory minced chicken and veggies.', NULL, NULL, true),
    ('crispy-chicken-wings', 'Crispy Chicken Wings', 300, 'starters-momos', 'nv', 'Perfectly seasoned, ultra-crispy fried chicken wings.', NULL, NULL, true),
    ('drums-of-heaven', 'Drums Of Heaven', 300, 'starters-momos', 'nv', 'Crispy wing lollipops smothered in sticky caramelized garlic-chilli glaze.', NULL, 'Spicy', true),
    ('chicken-strips', 'Chicken Strips', 250, 'starters-momos', 'nv', 'Juicy chicken breast strips, breaded and fried till golden brown.', NULL, NULL, true),
    ('cheese-blast-sandwich', 'Cheese Blast Sandwich', 150, 'starters-momos', 'veg', 'An explosion of molten cheese grilled between buttered bread slices.', NULL, NULL, true),
    ('veg-sweet-corn-sandwich', 'Veg Sweet Corn Sandwich', 180, 'starters-momos', 'veg', 'Creamy sweet corn and veggie filling grilled to perfection. Add paneer optional.', NULL, NULL, true),
    ('chicken-cheese-toastie', 'Chicken Cheese Toastie', 220, 'starters-momos', 'nv', 'Toasted sandwich loaded with spiced chicken and melted cheese.', NULL, NULL, true),
    ('chipotle-chicken-sandwich', 'Chipotle & Buffalo Chicken Sandwich', 300, 'starters-momos', 'nv', 'Hickory smoked chicken in spicy chipotle reduction with mozzarella.', NULL, 'Spicy', true),
    ('club-house-sandwich', 'Club House Sandwich', 250, 'starters-momos', 'all', 'Multi-layered classic club sandwich. Available in veg or chicken.', NULL, NULL, true),
    ('french-fries', 'French Fries', 150, 'starters-momos', 'veg', 'Classic salted crispy potato fries.', NULL, NULL, true),
    ('cheesy-french-fries', 'Cheesy French Fries', 180, 'starters-momos', 'veg', 'Crispy fries smothered in warm, liquid cheddar cheese.', NULL, NULL, true),
    ('crispy-chilli-babycorn', 'Crispy Chilli Babycorn', 190, 'starters-momos', 'veg', 'Golden batter baby corn wok-tossed with sweet peppers, scallions and soy.', NULL, NULL, true),
    ('white-sauce-pasta-veg', 'White Sauce Pasta (Veg)', 180, 'mains-platters', 'veg', 'Velvety butter, garlic parmesan cream with assorted vegetables.', NULL, NULL, true),
    ('white-sauce-pasta-chicken', 'White Sauce Pasta (Chicken)', 200, 'mains-platters', 'nv', 'Velvety butter, garlic parmesan cream with grilled chicken chunks.', NULL, NULL, true),
    ('red-sauce-pasta-veg', 'Red Sauce Pasta (Veg)', 200, 'mains-platters', 'veg', 'Spicy Arrabbiata tomato sauce tossed with fresh veggies.', NULL, NULL, true),
    ('red-sauce-pasta-chicken', 'Red Sauce Pasta (Chicken)', 220, 'mains-platters', 'nv', 'Spicy Arrabbiata tomato sauce tossed with tender chicken chunks.', NULL, NULL, true),
    ('fried-rice', 'Fried Rice', 160, 'mains-platters', 'all', 'Classic wok-tossed fried rice. Available in veg, egg, chicken, or mixed.', NULL, NULL, true),
    ('hakka-noodles', 'Hakka Noodles', 150, 'mains-platters', 'all', 'Street-style wok-tossed noodles. Available in veg, egg, chicken, or mixed.', NULL, NULL, true),
    ('veg-manchurian', 'Veg Manchurian', 150, 'mains-platters', 'veg', 'Mixed vegetable dumplings tossed in a dark soy and garlic sauce. Dry or gravy.', NULL, NULL, true),
    ('chilli-chicken', 'Chilli Chicken', 180, 'mains-platters', 'nv', 'Battered boneless chicken pieces in rich garlic soy gravy with peppers. Dry or gravy.', NULL, NULL, true),
    ('hunan-chicken', 'Hunan Chicken', 200, 'mains-platters', 'nv', 'Spicy and tangy Hunan style chicken tossed with veggies.', NULL, NULL, true),
    ('kung-pao-chicken', 'Kung Pao Chicken', 250, 'mains-platters', 'nv', 'Diced tender chicken, roasted peanuts, dry red chillies in dark sweet glaze.', NULL, NULL, true),
    ('chinese-platter', 'Chinese Platter', 450, 'mains-platters', 'nv', 'A grand platter featuring 1pc Spring Roll, 2pcs Chicken Wings, 2pcs Chicken Lollipop, and 2pcs Chicken Cheese Balls.', NULL, 'Platter', true),
    ('tandoori-platter', 'Tandoori Platter', 550, 'mains-platters', 'nv', 'Assortment of kebabs: 2pcs Reshmi, 2pcs Tikka, 2pcs Hara, and 1pc Sheek Kebab.', NULL, 'Platter', true),
    ('masala-cold-drinks', 'Masala Cold Drinks', 100, 'sips-desserts', 'veg', 'Your favorite fizzy drink spiced up with a punchy chaat masala twist.', NULL, NULL, true),
    ('lime-corial', 'Lime Cordial', 120, 'sips-desserts', 'veg', 'Sweet and tangy refreshing lime cooler.', NULL, NULL, true),
    ('basil-lemon-mojito', 'Basil Lemon Mojito', 150, 'sips-desserts', 'veg', 'A refreshing twist on the classic mojito, muddled with fresh basil and lemon.', NULL, NULL, true),
    ('blue-curacao-lemonade', 'Blue Curacao Lemonade', 150, 'sips-desserts', 'veg', 'Vibrant electric blue citrus liqueur, fizzy mineral soda, crushed mint sprigs.', NULL, 'Signature', true),
    ('sunset-paradise', 'Sunset Paradise', 200, 'sips-desserts', 'veg', 'Passion fruit purée, fresh orange juice, ruby grenadine and fizz.', NULL, NULL, true),
    ('summer-in-the-glass', 'The Summer In The Glass', 200, 'sips-desserts', 'veg', 'A tropical, fruity, and refreshing signature mocktail.', NULL, NULL, true),
    ('masala-tea', 'Masala Tea', 120, 'sips-desserts', 'veg', 'Hot, spiced Indian milk tea brewed with aromatic cardamom and ginger.', NULL, NULL, true),
    ('cappuccino', 'Cappuccino', 120, 'sips-desserts', 'veg', 'Single origin Arabica espresso pulled over velvety textured microfoam.', NULL, NULL, true),
    ('oreo-shake', 'Oreo Shake', 150, 'sips-desserts', 'veg', 'Thick, creamy milkshake blended with crushed Oreo cookies.', NULL, NULL, true),
    ('kitkat-shake', 'Kitkat Shake', 150, 'sips-desserts', 'veg', 'Rich chocolate milkshake blended with crispy KitKat wafers.', NULL, NULL, true),
    ('butterscotch-shake', 'Butterscotch Shake', 180, 'sips-desserts', 'veg', 'Sweet and buttery caramel milkshake with crunchy praline bits.', NULL, NULL, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    category = EXCLUDED.category,
    diet = EXCLUDED.diet,
    description = EXCLUDED.description,
    image = EXCLUDED.image,
    tag = EXCLUDED.tag,
    is_available = EXCLUDED.is_available,
    updated_at = timezone('utc'::text, now());

-- 4. REWRITE create_order_atomic WITH AUTHORITATIVE SERVER PRICING & PAYMENT STATUS
--    Ignores client-sent payment_status, total, unit_price, and line_total.
--    Takes only item ids and quantities, looks up prices from menu_items (and fallback menu),
--    rejects items where available = false, and sets payment_status to 'pending' or 'pay_at_counter'.
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order JSONB,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_order_ref TEXT;
    v_item JSONB;
    v_item_id TEXT;
    v_quantity INTEGER;
    v_db_unit_price NUMERIC;
    v_db_item_name TEXT;
    v_is_available BOOLEAN;
    v_line_total NUMERIC;
    v_computed_subtotal NUMERIC := 0.00;
    v_computed_total NUMERIC := 0.00;
    v_tax_amount NUMERIC := 0.00;
    
    -- Restaurant settings configuration
    v_tax_enabled BOOLEAN := true;
    v_tax_mode TEXT := 'inclusive';
    v_tax_rate NUMERIC := 0.0500;
    v_currency TEXT := 'INR';
    
    -- Payment fields
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_payment_required BOOLEAN;
    v_created_at TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    -- 1. Validate input structures
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    -- 2. Determine order reference (generate server-side if not provided or blank)
    v_order_ref := trim(COALESCE(p_order->>'order_ref', ''));
    IF v_order_ref = '' THEN
        v_order_ref := public.generate_order_reference();
    END IF;

    -- 3. Determine payment_status strictly on the server:
    --    Sets payment_status to 'pending' for online payment or 'pay_at_counter' otherwise.
    --    Completely IGNORES client-sent payment_status.
    v_payment_method := lower(trim(COALESCE(
        p_order->>'payment_method',
        p_order->>'payment_provider',
        ''
    )));

    IF v_payment_method IN ('counter', 'pay_at_counter', 'cash', 'manual') THEN
        v_payment_status := 'pay_at_counter';
        v_payment_required := false;
    ELSE
        v_payment_status := 'pending';
        v_payment_required := true;
    END IF;

    -- 4. Calculate subtotal and line items strictly server-side:
    --    Completely IGNORES client-sent unit_price, line_total, and total.
    --    Takes only item ids and quantities, then looks up prices from menu_items / menu.
    --    Rejects items where available = false.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        IF v_item_id = '' THEN
            RAISE EXCEPTION 'Missing item identifier in order items';
        END IF;

        v_quantity := GREATEST(1, COALESCE((v_item->>'quantity')::INTEGER, 1));
        v_db_unit_price := NULL;
        v_db_item_name := NULL;
        v_is_available := NULL;

        -- Primary lookup: public.menu_items by ID (if table exists)
        BEGIN
            SELECT mi.price, mi.name, mi.available
            INTO v_db_unit_price, v_db_item_name, v_is_available
            FROM public.menu_items mi
            WHERE mi.id = v_item_id
            LIMIT 1;
        EXCEPTION WHEN undefined_table THEN
            NULL;
        END;

        -- Fallback 1: lookup by name in public.menu_items
        IF v_db_unit_price IS NULL THEN
            BEGIN
                SELECT mi.price, mi.name, mi.available
                INTO v_db_unit_price, v_db_item_name, v_is_available
                FROM public.menu_items mi
                WHERE lower(trim(mi.name)) = lower(trim(v_item_id))
                   OR (v_item->>'name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'name')))
                   OR (v_item->>'item_name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'item_name')))
                LIMIT 1;
            EXCEPTION WHEN undefined_table THEN
                NULL;
            END;
        END IF;

        -- Fallback 2: public.menu table
        IF v_db_unit_price IS NULL THEN
            BEGIN
                SELECT m.price, m.name, COALESCE(m.is_available, true)
                INTO v_db_unit_price, v_db_item_name, v_is_available
                FROM public.menu m
                WHERE m.id = v_item_id
                   OR lower(trim(m.name)) = lower(trim(v_item_id))
                   OR (v_item->>'item_name' IS NOT NULL AND lower(trim(m.name)) = lower(trim(v_item->>'item_name')))
                LIMIT 1;
            EXCEPTION WHEN undefined_table THEN
                NULL;
            END;
        END IF;

        -- Reject if item does not exist
        IF v_db_unit_price IS NULL THEN
            RAISE EXCEPTION 'Menu item not found in database: %', v_item_id;
        END IF;

        -- Reject if item is not available (available = false)
        IF v_is_available IS FALSE THEN
            RAISE EXCEPTION 'Item "%" is currently unavailable / sold out', COALESCE(v_db_item_name, v_item_id);
        END IF;

        v_line_total := ROUND((v_quantity * v_db_unit_price)::NUMERIC, 2);
        v_computed_subtotal := v_computed_subtotal + v_line_total;
    END LOOP;

    -- 5. Fetch tax settings & compute totals server-side
    SELECT 
        COALESCE(rs.tax_enabled, true),
        COALESCE(rs.tax_mode, 'inclusive'),
        COALESCE(rs.tax_rate, 0.0500),
        COALESCE(rs.currency, 'INR')
    INTO 
        v_tax_enabled,
        v_tax_mode,
        v_tax_rate,
        v_currency
    FROM public.restaurant_settings rs
    ORDER BY (rs.id = 'current') DESC
    LIMIT 1;

    IF v_tax_enabled IS TRUE AND v_tax_mode = 'exclusive' AND v_tax_rate > 0 THEN
        v_tax_amount := ROUND((v_computed_subtotal * v_tax_rate)::NUMERIC, 2);
        v_computed_total := v_computed_subtotal + v_tax_amount;
    ELSE
        v_tax_amount := 0.00;
        v_computed_total := v_computed_subtotal;
    END IF;

    -- 6. Insert order record with server-computed financial and payment fields
    INSERT INTO public.orders (
        order_ref,
        customer_name,
        customer_phone,
        order_type,
        table_number,
        special_requests,
        order_source,
        source,
        subtotal,
        tax_total,
        total,
        status,
        currency,
        payment_required,
        payment_status,
        payment_method,
        payment_provider,
        payment_reference,
        payment_amount,
        idempotency_key,
        created_at,
        updated_at
    )
    VALUES (
        v_order_ref,
        COALESCE(trim(p_order->>'customer_name'), 'Guest'),
        COALESCE(trim(p_order->>'customer_phone'), ''),
        COALESCE(p_order->>'order_type', 'takeaway'),
        CASE WHEN p_order->>'order_type' = 'dine_in' THEN NULLIF(trim(p_order->>'table_number'), '') ELSE NULL END,
        NULLIF(trim(p_order->>'special_requests'), ''),
        COALESCE(p_order->>'source', p_order->>'order_source', 'website'),
        COALESCE(p_order->>'source', p_order->>'order_source', 'website'),
        v_computed_subtotal,
        v_tax_amount,
        v_computed_total,
        'pending',
        COALESCE(p_order->>'currency', v_currency, 'INR'),
        v_payment_required,
        v_payment_status,
        v_payment_method,
        NULLIF(trim(p_order->>'payment_provider'), ''),
        NULLIF(trim(p_order->>'payment_reference'), ''),
        v_computed_total,
        NULLIF(trim(p_order->>'idempotency_key'), ''),
        v_created_at,
        v_created_at
    )
    RETURNING id INTO v_order_id;

    -- 7. Insert line items with server-verified prices and line totals
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        v_quantity := GREATEST(1, COALESCE((v_item->>'quantity')::INTEGER, 1));

        SELECT mi.price, mi.name
        INTO v_db_unit_price, v_db_item_name
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
        LIMIT 1;

        IF v_db_unit_price IS NULL THEN
            SELECT mi.price, mi.name
            INTO v_db_unit_price, v_db_item_name
            FROM public.menu_items mi
            WHERE lower(trim(mi.name)) = lower(trim(v_item_id))
               OR (v_item->>'name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'name')))
               OR (v_item->>'item_name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'item_name')))
            LIMIT 1;
        END IF;

        IF v_db_unit_price IS NULL THEN
            BEGIN
                SELECT m.price, m.name
                INTO v_db_unit_price, v_db_item_name
                FROM public.menu m
                WHERE m.id = v_item_id
                   OR lower(trim(m.name)) = lower(trim(v_item_id))
                   OR (v_item->>'item_name' IS NOT NULL AND lower(trim(m.name)) = lower(trim(v_item->>'item_name')))
                LIMIT 1;
            EXCEPTION WHEN undefined_table THEN
                NULL;
            END;
        END IF;

        v_line_total := ROUND((v_quantity * v_db_unit_price)::NUMERIC, 2);

        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price,
            line_total,
            selected_options,
            created_at
        )
        VALUES (
            v_order_id,
            v_item_id,
            COALESCE(v_db_item_name, v_item_id),
            v_quantity,
            v_db_unit_price,
            v_line_total,
            COALESCE(v_item->'selected_options', '{}'::jsonb),
            v_created_at
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_ref', v_order_ref,
        'payment_status', v_payment_status,
        'payment_required', v_payment_required,
        'subtotal', v_computed_subtotal,
        'tax_total', v_tax_amount,
        'total', v_computed_total,
        'currency', v_currency
    );
END;
$$;

-- Grant permissions on stored procedure
GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;

-- 5. SECURITY: Only verified webhook (service_role) may set payment_status to 'paid'
CREATE OR REPLACE FUNCTION public.guard_order_payment_status_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.payment_status = 'paid' AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
        IF current_user NOT IN ('postgres', 'supabase_admin')
           AND COALESCE(auth.role(), '') <> 'service_role'
           AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
            RAISE EXCEPTION 'Unauthorized: Only verified webhook service role may mark an order as paid (current_role: %, auth.role: %)',
                current_user, COALESCE(auth.role(), 'none');
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_payment_status_paid ON public.orders;
CREATE TRIGGER trg_guard_order_payment_status_paid
    BEFORE INSERT OR UPDATE OF payment_status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_order_payment_status_paid();


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 010_menu_and_site_content.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 010_menu_and_site_content.sql
-- Description: Dynamic Postgres Menu Catalog, Content Tables, and Storage Configuration
-- Replaces Sanity and client-side localStorage persistence with authoritative Supabase tables.
-- ==============================================================================

-- 1. DROP OLD COMPATIBILITY VIEW IF PRESENT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_views 
        WHERE schemaname = 'public' AND viewname = 'menu_items'
    ) THEN
        EXECUTE 'DROP VIEW public.menu_items CASCADE';
    END IF;
END $$;

-- 2. CREATE MENU_CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.menu_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for category sorting
CREATE INDEX IF NOT EXISTS idx_menu_categories_sort ON public.menu_categories (sort_order ASC);

-- 3. CREATE MENU_ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.menu_items (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES public.menu_categories(id) ON UPDATE CASCADE ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL CHECK (price >= 0),
    diet TEXT,
    image_url TEXT,
    popular BOOLEAN NOT NULL DEFAULT false,
    available BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indices for fast filtering & category browsing
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items (category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON public.menu_items (available);
CREATE INDEX IF NOT EXISTS idx_menu_items_popular ON public.menu_items (popular);
CREATE INDEX IF NOT EXISTS idx_menu_items_sort ON public.menu_items (sort_order ASC);

-- 4. CREATE SITE_CONTENT TABLE (for hero, story, specials, gallery)
CREATE TABLE IF NOT EXISTS public.site_content (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES FOR MENU_CATEGORIES
-- Anyone can SELECT
DROP POLICY IF EXISTS "public_select_menu_categories" ON public.menu_categories;
CREATE POLICY "public_select_menu_categories"
ON public.menu_categories
FOR SELECT
USING (true);

-- Only active staff_profiles with role owner or manager can INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "staff_manage_menu_categories_insert" ON public.menu_categories;
CREATE POLICY "staff_manage_menu_categories_insert"
ON public.menu_categories
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

DROP POLICY IF EXISTS "staff_manage_menu_categories_update" ON public.menu_categories;
CREATE POLICY "staff_manage_menu_categories_update"
ON public.menu_categories
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

DROP POLICY IF EXISTS "staff_manage_menu_categories_delete" ON public.menu_categories;
CREATE POLICY "staff_manage_menu_categories_delete"
ON public.menu_categories
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

-- 7. RLS POLICIES FOR MENU_ITEMS
-- Anyone can SELECT
DROP POLICY IF EXISTS "public_select_menu_items" ON public.menu_items;
CREATE POLICY "public_select_menu_items"
ON public.menu_items
FOR SELECT
USING (true);

-- Only active staff_profiles with role owner or manager can INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "staff_manage_menu_items_insert" ON public.menu_items;
CREATE POLICY "staff_manage_menu_items_insert"
ON public.menu_items
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

DROP POLICY IF EXISTS "staff_manage_menu_items_update" ON public.menu_items;
CREATE POLICY "staff_manage_menu_items_update"
ON public.menu_items
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

DROP POLICY IF EXISTS "staff_manage_menu_items_delete" ON public.menu_items;
CREATE POLICY "staff_manage_menu_items_delete"
ON public.menu_items
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

-- 8. RLS POLICIES FOR SITE_CONTENT
-- Anyone can SELECT
DROP POLICY IF EXISTS "public_select_site_content" ON public.site_content;
CREATE POLICY "public_select_site_content"
ON public.site_content
FOR SELECT
USING (true);

-- Only active staff_profiles with role owner or manager can INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "staff_manage_site_content_insert" ON public.site_content;
CREATE POLICY "staff_manage_site_content_insert"
ON public.site_content
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

DROP POLICY IF EXISTS "staff_manage_site_content_update" ON public.site_content;
CREATE POLICY "staff_manage_site_content_update"
ON public.site_content
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

DROP POLICY IF EXISTS "staff_manage_site_content_delete" ON public.site_content;
CREATE POLICY "staff_manage_site_content_delete"
ON public.site_content
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

-- 9. CONFIGURE PUBLIC STORAGE BUCKET "site-images"
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'site-images',
    'site-images',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- Storage bucket RLS policies
DROP POLICY IF EXISTS "public_read_site_images" ON storage.objects;
CREATE POLICY "public_read_site_images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'site-images');

DROP POLICY IF EXISTS "staff_upload_site_images" ON storage.objects;
CREATE POLICY "staff_upload_site_images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'site-images' AND
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

DROP POLICY IF EXISTS "staff_update_site_images" ON storage.objects;
CREATE POLICY "staff_update_site_images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'site-images' AND
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

DROP POLICY IF EXISTS "staff_delete_site_images" ON storage.objects;
CREATE POLICY "staff_delete_site_images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'site-images' AND
    EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.active = true
          AND sp.role IN ('owner', 'manager')
    )
);

-- 10. REALTIME PUBLICATION
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'menu_categories'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_categories;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'menu_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'site_content'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.site_content;
    END IF;
END $$;

-- 11. SEED MENU_CATEGORIES
INSERT INTO public.menu_categories (id, name, sort_order)
VALUES
    ('burgers-pizzas', 'Burgers & Pizzas', 1),
    ('starters-momos', 'Starters & Momos', 2),
    ('mains-platters', 'Mains & Platters', 3),
    ('sips-desserts', 'Sips & Desserts', 4),
    ('soups-salads', 'Soups & Salads', 5)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

-- 12. SEED MENU_ITEMS (Canonical catalog from src/data/menu.ts)
INSERT INTO public.menu_items (id, category_id, name, description, price, diet, image_url, popular, available, sort_order)
VALUES
    ('hot-and-sour-soup', 'soups-salads', 'Hot And Sour Soup', 'Peppery broth with wild mushrooms, bamboo shoots and cilantro. Available in veg or chicken.', 130, 'all', NULL, false, true, 1),
    ('lemon-coriander-soup', 'soups-salads', 'Lemon Coriander Soup', 'A refreshing and tangy clear soup flavored with lemon juice and fresh coriander.', 150, 'veg', NULL, true, true, 2),
    ('chicken-clear-soup', 'soups-salads', 'Chicken Clear Soup', 'A light and soothing clear broth served with tender chicken chunks and veggies.', 150, 'nv', NULL, false, true, 3),
    ('fish-bowl-soup', 'soups-salads', 'Fish Bowl Soup', 'Hearty and aromatic seafood broth featuring fresh fish fillets.', 200, 'nv', NULL, false, true, 4),
    ('chicken-manchow-soup', 'soups-salads', 'Chicken Manchow Soup', 'Spicy dark soy-based soup topped with crunchy fried noodles.', 200, 'nv', NULL, true, true, 5),
    ('american-chopsuey', 'soups-salads', 'American Chopsuey', 'Crispy fried noodles topped with a sweet and tangy tomato-based chicken gravy.', 300, 'nv', NULL, false, true, 6),
    ('green-salad', 'soups-salads', 'Green Salad', 'Farm-fresh cucumber, tomatoes, onions, and carrots served with a wedge of lemon.', 90, 'veg', NULL, true, true, 7),
    ('chicken-salad', 'soups-salads', 'Chicken Salad', 'Grilled chicken tossed with crisp greens, cherry tomatoes, and house dressing.', 200, 'nv', NULL, true, true, 8),
    ('pasta-salad', 'soups-salads', 'Pasta Salad', 'Chilled pasta tossed with colorful veggies in a zesty vinaigrette. Add-ons available.', 250, 'all', NULL, false, true, 9),
    ('veggie-medley-burger', 'burgers-pizzas', 'Veggie Medley Burger', 'Spiced potato-corn crunch patty, caramelized onions and melted cheddar in a toasted bun.', 180, 'veg', NULL, false, true, 10),
    ('paneer-burger-1patty', 'burgers-pizzas', 'Paneer Burger (Single Patty)', 'Crispy spiced paneer patty with crisp lettuce and creamy mayo.', 200, 'veg', NULL, false, true, 11),
    ('paneer-burger-2patty', 'burgers-pizzas', 'Paneer Burger (Double Patty)', 'Double the paneer goodness! Two crispy spiced paneer patties with crisp lettuce.', 220, 'veg', NULL, true, true, 12),
    ('special-chicken-on-a-bun', 'burgers-pizzas', 'Special Chicken On A Bun', 'Flame-grilled thick chicken patty with melted mature cheddar, caramelized onions, crispy bacon & house smoked relish.', 250, 'nv', NULL, true, true, 13),
    ('margherita-pizza', 'burgers-pizzas', 'Margherita Pizza', 'San Marzano plum tomato sauce, bocconcini cheese & sweet garden basil.', 180, 'veg', NULL, true, true, 14),
    ('chicken-cheese-pizza', 'burgers-pizzas', 'Chicken Cheese Pizza', 'Hand-stretched dough, spicy herb marinara, roasted chicken & molten mozzarella.', 250, 'nv', NULL, false, true, 15),
    ('veg-steam-momo', 'starters-momos', 'Veg Steam Momo', 'Delicate dumplings stuffed with seasoned minced vegetables. Steamed to perfection.', 150, 'veg', NULL, false, true, 16),
    ('chicken-steam-momo', 'starters-momos', 'Chicken Steam Momo', 'Delicate dumpling wraps stuffed with seasoned minced chicken.', 280, 'nv', NULL, false, true, 17),
    ('chicken-pahadi-momo-steam', 'starters-momos', 'Chicken Pahadi Momo (Steam)', 'Infused with Himalayan mountain herbs and cilantro broth, steamed soft.', 200, 'nv', NULL, true, true, 18),
    ('chicken-pahadi-momo-fried', 'starters-momos', 'Chicken Pahadi Momo (Fried)', 'Infused with Himalayan mountain herbs, deep fried for a golden crunch.', 220, 'nv', NULL, false, true, 19),
    ('chicken-pahadi-momo-pan-fried', 'starters-momos', 'Chicken Pahadi Momo (Pan Fried)', 'Mountain herb infused momos, pan crisped and tossed in a spicy garlic sauce.', 250, 'nv', NULL, false, true, 20),
    ('fish-spring-roll', 'starters-momos', 'Fish Spring Roll (Pure Vetki)', 'Crispy rolls stuffed with fresh Vetki fish and oriental spices.', 200, 'nv', NULL, false, true, 21),
    ('fish-and-chips', 'starters-momos', 'Fish And Chips (Pure Vetki)', 'Fresh Bhetki fillet in airy golden batter, hand-cut fries, caper tartar sauce.', 250, 'nv', NULL, true, true, 22),
    ('fish-goujons', 'starters-momos', 'Fish Goujons', 'Crispy breaded fish fingers served with tangy tartar dip.', 240, 'nv', NULL, false, true, 23),
    ('golden-fried-prawn', 'starters-momos', 'Golden Fried Prawn', 'Crisp Japanese panko crumb crusted tiger prawns with sweet plum chilli dip.', 350, 'nv', NULL, false, true, 24),
    ('prawn-tempura', 'starters-momos', 'Prawn Tempura', 'Light and airy battered prawns, deep-fried to a delicate crisp.', 380, 'nv', NULL, false, true, 25),
    ('thai-lemon-fish', 'starters-momos', 'Thai Lemon Fish', 'Steamed or fried fish tossed in a zesty, aromatic Thai lemon and herb sauce.', 280, 'nv', NULL, false, true, 26),
    ('thai-lemon-chicken', 'starters-momos', 'Thai Lemon Chicken', 'Tender chicken chunks tossed in a zesty, aromatic Thai lemon sauce.', 250, 'nv', NULL, false, true, 27),
    ('chicken-spring-roll', 'starters-momos', 'Chicken Spring Roll', 'Crispy golden wrappers filled with savory minced chicken and veggies.', 180, 'nv', NULL, false, true, 28),
    ('crispy-chicken-wings', 'starters-momos', 'Crispy Chicken Wings', 'Perfectly seasoned, ultra-crispy fried chicken wings.', 300, 'nv', NULL, false, true, 29),
    ('drums-of-heaven', 'starters-momos', 'Drums Of Heaven', 'Crispy wing lollipops smothered in sticky caramelized garlic-chilli glaze.', 300, 'nv', NULL, true, true, 30),
    ('chicken-strips', 'starters-momos', 'Chicken Strips', 'Juicy chicken breast strips, breaded and fried till golden brown.', 250, 'nv', NULL, false, true, 31),
    ('cheese-blast-sandwich', 'starters-momos', 'Cheese Blast Sandwich', 'An explosion of molten cheese grilled between buttered bread slices.', 150, 'veg', NULL, false, true, 32),
    ('veg-sweet-corn-sandwich', 'starters-momos', 'Veg Sweet Corn Sandwich', 'Creamy sweet corn and veggie filling grilled to perfection. Add paneer optional.', 180, 'veg', NULL, false, true, 33),
    ('chicken-cheese-toastie', 'starters-momos', 'Chicken Cheese Toastie', 'Toasted sandwich loaded with spiced chicken and melted cheese.', 220, 'nv', NULL, false, true, 34),
    ('chipotle-chicken-sandwich', 'starters-momos', 'Chipotle & Buffalo Chicken Sandwich', 'Hickory smoked chicken in spicy chipotle reduction with mozzarella.', 300, 'nv', NULL, true, true, 35),
    ('club-house-sandwich', 'starters-momos', 'Club House Sandwich', 'Multi-layered classic club sandwich. Available in veg or chicken.', 250, 'all', NULL, false, true, 36),
    ('french-fries', 'starters-momos', 'French Fries', 'Classic salted crispy potato fries.', 150, 'veg', NULL, false, true, 37),
    ('cheesy-french-fries', 'starters-momos', 'Cheesy French Fries', 'Crispy fries smothered in warm, liquid cheddar cheese.', 180, 'veg', NULL, false, true, 38),
    ('crispy-chilli-babycorn', 'starters-momos', 'Crispy Chilli Babycorn', 'Golden batter baby corn wok-tossed with sweet peppers, scallions and soy.', 190, 'veg', NULL, false, true, 39),
    ('white-sauce-pasta-veg', 'mains-platters', 'White Sauce Pasta (Veg)', 'Velvety butter, garlic parmesan cream with assorted vegetables.', 180, 'veg', NULL, false, true, 40),
    ('white-sauce-pasta-chicken', 'mains-platters', 'White Sauce Pasta (Chicken)', 'Velvety butter, garlic parmesan cream with grilled chicken chunks.', 200, 'nv', NULL, false, true, 41),
    ('red-sauce-pasta-veg', 'mains-platters', 'Red Sauce Pasta (Veg)', 'Spicy Arrabbiata tomato sauce tossed with fresh veggies.', 200, 'veg', NULL, false, true, 42),
    ('red-sauce-pasta-chicken', 'mains-platters', 'Red Sauce Pasta (Chicken)', 'Spicy Arrabbiata tomato sauce tossed with tender chicken chunks.', 220, 'nv', NULL, false, true, 43),
    ('fried-rice', 'mains-platters', 'Fried Rice', 'Classic wok-tossed fried rice. Available in veg, egg, chicken, or mixed.', 160, 'all', NULL, false, true, 44),
    ('hakka-noodles', 'mains-platters', 'Hakka Noodles', 'Street-style wok-tossed noodles. Available in veg, egg, chicken, or mixed.', 150, 'all', NULL, false, true, 45),
    ('veg-manchurian', 'mains-platters', 'Veg Manchurian', 'Mixed vegetable dumplings tossed in a dark soy and garlic sauce. Dry or gravy.', 150, 'veg', NULL, false, true, 46),
    ('chilli-chicken', 'mains-platters', 'Chilli Chicken', 'Battered boneless chicken pieces in rich garlic soy gravy with peppers. Dry or gravy.', 180, 'nv', NULL, false, true, 47),
    ('hunan-chicken', 'mains-platters', 'Hunan Chicken', 'Spicy and tangy Hunan style chicken tossed with veggies.', 200, 'nv', NULL, false, true, 48),
    ('kung-pao-chicken', 'mains-platters', 'Kung Pao Chicken', 'Diced tender chicken, roasted peanuts, dry red chillies in dark sweet glaze.', 250, 'nv', NULL, false, true, 49),
    ('chinese-platter', 'mains-platters', 'Chinese Platter', 'A grand platter featuring 1pc Spring Roll, 2pcs Chicken Wings, 2pcs Chicken Lollipop, and 2pcs Chicken Cheese Balls.', 450, 'nv', NULL, true, true, 50),
    ('tandoori-platter', 'mains-platters', 'Tandoori Platter', 'Assortment of kebabs: 2pcs Reshmi, 2pcs Tikka, 2pcs Hara, and 1pc Sheek Kebab.', 550, 'nv', NULL, true, true, 51),
    ('masala-cold-drinks', 'sips-desserts', 'Masala Cold Drinks', 'Your favorite fizzy drink spiced up with a punchy chaat masala twist.', 100, 'veg', NULL, false, true, 52),
    ('lime-corial', 'sips-desserts', 'Lime Cordial', 'Sweet and tangy refreshing lime cooler.', 120, 'veg', NULL, false, true, 53),
    ('basil-lemon-mojito', 'sips-desserts', 'Basil Lemon Mojito', 'A refreshing twist on the classic mojito, muddled with fresh basil and lemon.', 150, 'veg', NULL, false, true, 54),
    ('blue-curacao-lemonade', 'sips-desserts', 'Blue Curacao Lemonade', 'Vibrant electric blue citrus liqueur, fizzy mineral soda, crushed mint sprigs.', 150, 'veg', NULL, true, true, 55),
    ('sunset-paradise', 'sips-desserts', 'Sunset Paradise', 'Passion fruit purée, fresh orange juice, ruby grenadine and fizz.', 200, 'veg', NULL, false, true, 56),
    ('summer-in-the-glass', 'sips-desserts', 'The Summer In The Glass', 'A tropical, fruity, and refreshing signature mocktail.', 200, 'veg', NULL, false, true, 57),
    ('masala-tea', 'sips-desserts', 'Masala Tea', 'Hot, spiced Indian milk tea brewed with aromatic cardamom and ginger.', 120, 'veg', NULL, false, true, 58),
    ('cappuccino', 'sips-desserts', 'Cappuccino', 'Single origin Arabica espresso pulled over velvety textured microfoam.', 120, 'veg', NULL, false, true, 59),
    ('oreo-shake', 'sips-desserts', 'Oreo Shake', 'Thick, creamy milkshake blended with crushed Oreo cookies.', 150, 'veg', NULL, false, true, 60),
    ('kitkat-shake', 'sips-desserts', 'Kitkat Shake', 'Rich chocolate milkshake blended with crispy KitKat wafers.', 150, 'veg', NULL, false, true, 61),
    ('butterscotch-shake', 'sips-desserts', 'Butterscotch Shake', 'Sweet and buttery caramel milkshake with crunchy praline bits.', 180, 'veg', NULL, false, true, 62)
ON CONFLICT (id) DO UPDATE
SET category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    diet = EXCLUDED.diet,
    image_url = EXCLUDED.image_url,
    popular = EXCLUDED.popular,
    sort_order = EXCLUDED.sort_order;

-- 13. SEED INITIAL SITE_CONTENT (hero, story, specials, gallery)
INSERT INTO public.site_content (key, value)
VALUES
    ('hero', '{
        "headline": "Step Into Barrackpore’s Trendsetting Dining Retreat",
        "subtext": "Where artisan coffee meets handcrafted cocktails & gourmet comfort food in a strictly premium, nocturnal setting.",
        "src": "/images/hero-bar.webp",
        "alt": "Premium Lounge Bar"
    }'::jsonb),
    ('story', '{
        "title": "Crafting Barrackpore’s finest nocturnal escape",
        "description": "We believe that true luxury lies in the details. From sourcing the most vibrant, local ingredients from surrounding farms to hand-selecting the perfect acoustic backdrop, every element of our space is intentionally curated.",
        "src": "/images/story-pour.webp",
        "alt": "Artisanal Espresso Pour"
    }'::jsonb),
    ('specials', '{
        "title": "Special Banquet & Hangout Platters",
        "description": "Generous sharing platters with sizzling pan-Asian or smoky clay oven selections, made fresh to order.",
        "image": "/images/hero-bar.webp"
    }'::jsonb),
    ('gallery', '{
        "images": [
            { "src": "/images/gallery-couple.webp", "alt": "Nightlife Couple" },
            { "src": "/images/gallery-pizza.webp", "alt": "Wood-Fired Pizza" },
            { "src": "/images/gallery-beans.webp", "alt": "Artisanal Coffee Beans" },
            { "src": "/images/gallery-guitar.webp", "alt": "Acoustic Weekend Guitar" }
        ]
    }'::jsonb)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = timezone('utc'::text, now());

-- 14. AUTHORITATIVE create_order_atomic WITH SERVER-SIDE PRICING & PAYMENT STATUS
--     Ignores client-sent payment_status, total, unit_price, and line_total.
--     Takes only item ids and quantities, looks up prices from public.menu_items,
--     rejects items where available = false, and sets payment_status to 'pending' or 'pay_at_counter'.
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order JSONB,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_order_ref TEXT;
    v_item JSONB;
    v_item_id TEXT;
    v_quantity INTEGER;
    v_db_unit_price NUMERIC;
    v_db_item_name TEXT;
    v_is_available BOOLEAN;
    v_line_total NUMERIC;
    v_computed_subtotal NUMERIC := 0.00;
    v_computed_total NUMERIC := 0.00;
    v_tax_amount NUMERIC := 0.00;
    
    -- Restaurant settings configuration
    v_tax_enabled BOOLEAN := true;
    v_tax_mode TEXT := 'inclusive';
    v_tax_rate NUMERIC := 0.0500;
    v_currency TEXT := 'INR';
    
    -- Payment fields
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_payment_required BOOLEAN;
    v_created_at TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    -- 1. Validate input structures
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    -- 2. Determine order reference (generate server-side if not provided or blank)
    v_order_ref := trim(COALESCE(p_order->>'order_ref', ''));
    IF v_order_ref = '' THEN
        v_order_ref := public.generate_order_reference();
    END IF;

    -- 3. Determine payment_status strictly on the server:
    --    Sets payment_status to 'pending' for online payment or 'pay_at_counter' otherwise.
    --    Completely IGNORES client-sent payment_status.
    v_payment_method := lower(trim(COALESCE(
        p_order->>'payment_method',
        p_order->>'payment_provider',
        ''
    )));

    IF v_payment_method IN ('counter', 'pay_at_counter', 'cash', 'manual') THEN
        v_payment_status := 'pay_at_counter';
        v_payment_required := false;
    ELSE
        v_payment_status := 'pending';
        v_payment_required := true;
    END IF;

    -- 4. Calculate subtotal and line items strictly server-side:
    --    Completely IGNORES client-sent unit_price, line_total, and total.
    --    Takes only item ids and quantities, then looks up prices from menu_items.
    --    Rejects items where available = false.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        IF v_item_id = '' THEN
            RAISE EXCEPTION 'Missing item identifier in order items';
        END IF;

        v_quantity := GREATEST(1, COALESCE((v_item->>'quantity')::INTEGER, 1));
        v_db_unit_price := NULL;
        v_db_item_name := NULL;
        v_is_available := NULL;

        -- Primary lookup: public.menu_items by ID
        SELECT mi.price, mi.name, mi.available
        INTO v_db_unit_price, v_db_item_name, v_is_available
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
        LIMIT 1;

        -- Fallback 1: lookup by name in public.menu_items
        IF v_db_unit_price IS NULL THEN
            SELECT mi.price, mi.name, mi.available
            INTO v_db_unit_price, v_db_item_name, v_is_available
            FROM public.menu_items mi
            WHERE lower(trim(mi.name)) = lower(trim(v_item_id))
               OR (v_item->>'name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'name')))
               OR (v_item->>'item_name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'item_name')))
            LIMIT 1;
        END IF;

        -- Fallback 2: public.menu table (if legacy table exists)
        IF v_db_unit_price IS NULL THEN
            BEGIN
                SELECT m.price, m.name, COALESCE(m.is_available, true)
                INTO v_db_unit_price, v_db_item_name, v_is_available
                FROM public.menu m
                WHERE m.id = v_item_id
                   OR lower(trim(m.name)) = lower(trim(v_item_id))
                   OR (v_item->>'item_name' IS NOT NULL AND lower(trim(m.name)) = lower(trim(v_item->>'item_name')))
                LIMIT 1;
            EXCEPTION WHEN undefined_table THEN
                NULL;
            END;
        END IF;

        -- Reject if item does not exist
        IF v_db_unit_price IS NULL THEN
            RAISE EXCEPTION 'Menu item not found in database: %', v_item_id;
        END IF;

        -- Reject if item is not available (available = false)
        IF v_is_available IS FALSE THEN
            RAISE EXCEPTION 'Item "%" is currently unavailable / sold out', COALESCE(v_db_item_name, v_item_id);
        END IF;

        v_line_total := ROUND((v_quantity * v_db_unit_price)::NUMERIC, 2);
        v_computed_subtotal := v_computed_subtotal + v_line_total;
    END LOOP;

    -- 5. Fetch tax settings & compute totals server-side
    SELECT 
        COALESCE(rs.tax_enabled, true),
        COALESCE(rs.tax_mode, 'inclusive'),
        COALESCE(rs.tax_rate, 0.0500),
        COALESCE(rs.currency, 'INR')
    INTO 
        v_tax_enabled,
        v_tax_mode,
        v_tax_rate,
        v_currency
    FROM public.restaurant_settings rs
    ORDER BY (rs.id = 'current') DESC
    LIMIT 1;

    IF v_tax_enabled IS TRUE AND v_tax_mode = 'exclusive' AND v_tax_rate > 0 THEN
        v_tax_amount := ROUND((v_computed_subtotal * v_tax_rate)::NUMERIC, 2);
        v_computed_total := v_computed_subtotal + v_tax_amount;
    ELSE
        v_tax_amount := 0.00;
        v_computed_total := v_computed_subtotal;
    END IF;

    -- 6. Insert order record with server-computed financial and payment fields
    INSERT INTO public.orders (
        order_ref,
        customer_name,
        customer_phone,
        order_type,
        table_number,
        special_requests,
        order_source,
        source,
        subtotal,
        tax_total,
        total,
        status,
        currency,
        payment_required,
        payment_status,
        payment_method,
        payment_provider,
        payment_reference,
        payment_amount,
        idempotency_key,
        created_at,
        updated_at
    )
    VALUES (
        v_order_ref,
        COALESCE(trim(p_order->>'customer_name'), 'Guest'),
        COALESCE(trim(p_order->>'customer_phone'), ''),
        COALESCE(p_order->>'order_type', 'takeaway'),
        CASE WHEN p_order->>'order_type' = 'dine_in' THEN NULLIF(trim(p_order->>'table_number'), '') ELSE NULL END,
        NULLIF(trim(p_order->>'special_requests'), ''),
        COALESCE(p_order->>'source', p_order->>'order_source', 'website'),
        COALESCE(p_order->>'source', p_order->>'order_source', 'website'),
        v_computed_subtotal,
        v_tax_amount,
        v_computed_total,
        'pending',
        COALESCE(p_order->>'currency', v_currency, 'INR'),
        v_payment_required,
        v_payment_status,
        v_payment_method,
        NULLIF(trim(p_order->>'payment_provider'), ''),
        NULLIF(trim(p_order->>'payment_reference'), ''),
        v_computed_total,
        NULLIF(trim(p_order->>'idempotency_key'), ''),
        v_created_at,
        v_created_at
    )
    RETURNING id INTO v_order_id;

    -- 7. Insert line items with server-verified prices and line totals
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        v_quantity := GREATEST(1, COALESCE((v_item->>'quantity')::INTEGER, 1));

        SELECT mi.price, mi.name
        INTO v_db_unit_price, v_db_item_name
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
        LIMIT 1;

        IF v_db_unit_price IS NULL THEN
            SELECT mi.price, mi.name
            INTO v_db_unit_price, v_db_item_name
            FROM public.menu_items mi
            WHERE lower(trim(mi.name)) = lower(trim(v_item_id))
               OR (v_item->>'name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'name')))
               OR (v_item->>'item_name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'item_name')))
            LIMIT 1;
        END IF;

        IF v_db_unit_price IS NULL THEN
            BEGIN
                SELECT m.price, m.name
                INTO v_db_unit_price, v_db_item_name
                FROM public.menu m
                WHERE m.id = v_item_id
                   OR lower(trim(m.name)) = lower(trim(v_item_id))
                   OR (v_item->>'item_name' IS NOT NULL AND lower(trim(m.name)) = lower(trim(v_item->>'item_name')))
                LIMIT 1;
            EXCEPTION WHEN undefined_table THEN
                NULL;
            END;
        END IF;

        v_line_total := ROUND((v_quantity * v_db_unit_price)::NUMERIC, 2);

        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price,
            line_total,
            selected_options,
            created_at
        )
        VALUES (
            v_order_id,
            v_item_id,
            COALESCE(v_db_item_name, v_item_id),
            v_quantity,
            v_db_unit_price,
            v_line_total,
            COALESCE(v_item->'selected_options', '{}'::jsonb),
            v_created_at
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_ref', v_order_ref,
        'payment_status', v_payment_status,
        'payment_required', v_payment_required,
        'subtotal', v_computed_subtotal,
        'tax_total', v_tax_amount,
        'total', v_computed_total,
        'currency', v_currency
    );
END;
$$;

-- Backward-compatibility wrapper for scalar parameter calls
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_order_type TEXT,
    p_items JSONB,
    p_table_number TEXT DEFAULT NULL,
    p_special_requests TEXT DEFAULT NULL,
    p_order_source TEXT DEFAULT 'website',
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.create_order_atomic(
        jsonb_build_object(
            'customer_name', p_customer_name,
            'customer_phone', p_customer_phone,
            'order_type', p_order_type,
            'table_number', p_table_number,
            'special_requests', p_special_requests,
            'source', p_order_source,
            'idempotency_key', p_idempotency_key,
            'payment_method', 'online'
        ),
        p_items
    );
END;
$$;

-- Grant permissions on both function signatures
GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 15. SECURITY: Only verified webhook (service_role) may set payment_status to 'paid'
CREATE OR REPLACE FUNCTION public.guard_order_payment_status_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.payment_status = 'paid' AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
        IF current_user NOT IN ('postgres', 'supabase_admin')
           AND COALESCE(auth.role(), '') <> 'service_role'
           AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
            RAISE EXCEPTION 'Unauthorized: Only verified webhook service role may mark an order as paid (current_role: %, auth.role: %)',
                current_user, COALESCE(auth.role(), 'none');
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_payment_status_paid ON public.orders;
CREATE TRIGGER trg_guard_order_payment_status_paid
    BEFORE INSERT OR UPDATE OF payment_status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_order_payment_status_paid();


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 011_multi_tenant_and_allergens.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 011_multi_tenant_and_allergens.sql
-- Description:
-- 1. Multi-Tenant Foundation: Adds restaurant_id column to all 12 platform tables.
-- 2. Scopes Row Level Security (RLS) policies by restaurant_id.
-- 3. Adds allergen tags column to menu_items table.
-- ==============================================================================

-- 1. ADD restaurant_id TO ALL PLATFORM TABLES (DEFAULT 'the-cafe-barrackpore')
DO $$
BEGIN
    -- 1. orders
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON public.orders (restaurant_id);
    END IF;

    -- 2. order_items
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
        ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_id ON public.order_items (restaurant_id);
    END IF;

    -- 3. reservations
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservations') THEN
        ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_id ON public.reservations (restaurant_id);
    END IF;

    -- 4. staff_profiles
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff_profiles') THEN
        ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_staff_profiles_restaurant_id ON public.staff_profiles (restaurant_id);
    END IF;

    -- 5. restaurant_tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurant_tables') THEN
        ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_restaurant_tables_restaurant_id ON public.restaurant_tables (restaurant_id);
    END IF;

    -- 6. restaurant_settings
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurant_settings') THEN
        ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_restaurant_settings_restaurant_id ON public.restaurant_settings (restaurant_id);
    END IF;

    -- 7. menu_item_availability
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_item_availability') THEN
        ALTER TABLE public.menu_item_availability ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_menu_item_availability_restaurant_id ON public.menu_item_availability (restaurant_id);
    END IF;

    -- 8. payments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
        ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_payments_restaurant_id ON public.payments (restaurant_id);
    END IF;

    -- 9. menu (legacy)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu') THEN
        ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_menu_restaurant_id ON public.menu (restaurant_id);
    END IF;

    -- 10. menu_categories
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_categories') THEN
        ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant_id ON public.menu_categories (restaurant_id);
    END IF;

    -- 11. menu_items
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_items') THEN
        ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON public.menu_items (restaurant_id);
        
        -- Add allergen tags array column
        ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS allergens TEXT[] DEFAULT '{}';
        CREATE INDEX IF NOT EXISTS idx_menu_items_allergens ON public.menu_items USING GIN (allergens);
    END IF;

    -- 12. site_content
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_content') THEN
        ALTER TABLE public.site_content ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
        CREATE INDEX IF NOT EXISTS idx_site_content_restaurant_id ON public.site_content (restaurant_id);
    END IF;
END $$;

-- 2. MULTI-TENANT CONTEXT HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.get_auth_restaurant_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT restaurant_id 
    FROM public.staff_profiles 
    WHERE user_id = auth.uid() 
      AND active = true 
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_restaurant_id() TO anon, authenticated, service_role;

-- 3. SCOPE RLS POLICIES BY restaurant_id

-- 3.1 ORDERS RLS
DROP POLICY IF EXISTS "staff_select_orders_tenant" ON public.orders;
CREATE POLICY "staff_select_orders_tenant"
ON public.orders
FOR SELECT
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR restaurant_id = public.get_auth_restaurant_id()
    OR (auth.role() = 'anon' AND restaurant_id IS NOT NULL)
);

DROP POLICY IF EXISTS "staff_update_orders_tenant" ON public.orders;
CREATE POLICY "staff_update_orders_tenant"
ON public.orders
FOR UPDATE
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR restaurant_id = public.get_auth_restaurant_id()
);

-- 3.2 RESERVATIONS RLS
DROP POLICY IF EXISTS "staff_select_reservations_tenant" ON public.reservations;
CREATE POLICY "staff_select_reservations_tenant"
ON public.reservations
FOR SELECT
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR restaurant_id = public.get_auth_restaurant_id()
);

DROP POLICY IF EXISTS "staff_update_reservations_tenant" ON public.reservations;
CREATE POLICY "staff_update_reservations_tenant"
ON public.reservations
FOR UPDATE
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR restaurant_id = public.get_auth_restaurant_id()
);

-- 3.3 MENU CATEGORIES & ITEMS RLS
DROP POLICY IF EXISTS "public_select_menu_categories_tenant" ON public.menu_categories;
CREATE POLICY "public_select_menu_categories_tenant"
ON public.menu_categories
FOR SELECT
USING (restaurant_id IS NOT NULL);

DROP POLICY IF EXISTS "staff_modify_menu_categories_tenant" ON public.menu_categories;
CREATE POLICY "staff_modify_menu_categories_tenant"
ON public.menu_categories
FOR ALL
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

DROP POLICY IF EXISTS "public_select_menu_items_tenant" ON public.menu_items;
CREATE POLICY "public_select_menu_items_tenant"
ON public.menu_items
FOR SELECT
USING (restaurant_id IS NOT NULL);

DROP POLICY IF EXISTS "staff_modify_menu_items_tenant" ON public.menu_items;
CREATE POLICY "staff_modify_menu_items_tenant"
ON public.menu_items
FOR ALL
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

-- 3.4 SITE CONTENT RLS
DROP POLICY IF EXISTS "public_select_site_content_tenant" ON public.site_content;
CREATE POLICY "public_select_site_content_tenant"
ON public.site_content
FOR SELECT
USING (restaurant_id IS NOT NULL);

DROP POLICY IF EXISTS "staff_modify_site_content_tenant" ON public.site_content;
CREATE POLICY "staff_modify_site_content_tenant"
ON public.site_content
FOR ALL
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

-- 3.5 RESTAURANT TABLES & AVAILABILITY RLS
DROP POLICY IF EXISTS "staff_manage_tables_tenant" ON public.restaurant_tables;
CREATE POLICY "staff_manage_tables_tenant"
ON public.restaurant_tables
FOR ALL
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR restaurant_id = public.get_auth_restaurant_id()
    OR (auth.role() = 'anon' AND active = true)
);

DROP POLICY IF EXISTS "staff_manage_availability_tenant" ON public.menu_item_availability;
CREATE POLICY "staff_manage_availability_tenant"
ON public.menu_item_availability
FOR ALL
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR restaurant_id = public.get_auth_restaurant_id()
    OR auth.role() = 'anon'
);

-- 4. UPDATE create_order_atomic WITH restaurant_id PROPAGATION
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order JSONB,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_order_ref TEXT;
    v_restaurant_id TEXT;
    v_item JSONB;
    v_item_id TEXT;
    v_quantity INTEGER;
    v_db_unit_price NUMERIC;
    v_db_item_name TEXT;
    v_is_available BOOLEAN;
    v_line_total NUMERIC;
    v_computed_subtotal NUMERIC := 0.00;
    v_computed_total NUMERIC := 0.00;
    v_tax_amount NUMERIC := 0.00;
    
    -- Restaurant settings configuration
    v_tax_enabled BOOLEAN := true;
    v_tax_mode TEXT := 'inclusive';
    v_tax_rate NUMERIC := 0.0500;
    v_currency TEXT := 'INR';
    
    -- Payment fields
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_payment_required BOOLEAN;
    v_created_at TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    -- 1. Validate input structures
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    -- 2. Tenant propagation
    v_restaurant_id := trim(COALESCE(p_order->>'restaurant_id', 'the-cafe-barrackpore'));

    -- 3. Determine order reference (generate server-side if not provided or blank)
    v_order_ref := trim(COALESCE(p_order->>'order_ref', ''));
    IF v_order_ref = '' THEN
        v_order_ref := public.generate_order_reference();
    END IF;

    -- 4. Determine payment_status strictly on the server:
    --    Sets payment_status to 'pending' for online payment or 'pay_at_counter' otherwise.
    --    Completely IGNORES client-sent payment_status.
    v_payment_method := lower(trim(COALESCE(
        p_order->>'payment_method',
        p_order->>'payment_provider',
        ''
    )));

    IF v_payment_method IN ('counter', 'pay_at_counter', 'cash', 'manual') THEN
        v_payment_status := 'pay_at_counter';
        v_payment_required := false;
    ELSE
        v_payment_status := 'pending';
        v_payment_required := true;
    END IF;

    -- 5. Calculate subtotal and line items strictly server-side:
    --    Completely IGNORES client-sent unit_price, line_total, and total.
    --    Takes only item ids and quantities, then looks up prices from menu_items.
    --    Rejects items where available = false.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        IF v_item_id = '' THEN
            RAISE EXCEPTION 'Missing item identifier in order items';
        END IF;

        v_quantity := GREATEST(1, COALESCE((v_item->>'quantity')::INTEGER, 1));
        v_db_unit_price := NULL;
        v_db_item_name := NULL;
        v_is_available := NULL;

        -- Primary lookup: public.menu_items by ID
        SELECT mi.price, mi.name, mi.available
        INTO v_db_unit_price, v_db_item_name, v_is_available
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND (mi.restaurant_id = v_restaurant_id OR mi.restaurant_id IS NULL)
        LIMIT 1;

        -- Fallback 1: lookup by name in public.menu_items
        IF v_db_unit_price IS NULL THEN
            SELECT mi.price, mi.name, mi.available
            INTO v_db_unit_price, v_db_item_name, v_is_available
            FROM public.menu_items mi
            WHERE (lower(trim(mi.name)) = lower(trim(v_item_id))
               OR (v_item->>'name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'name')))
               OR (v_item->>'item_name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'item_name'))))
              AND (mi.restaurant_id = v_restaurant_id OR mi.restaurant_id IS NULL)
            LIMIT 1;
        END IF;

        -- Fallback 2: public.menu table (if legacy table exists)
        IF v_db_unit_price IS NULL THEN
            BEGIN
                SELECT m.price, m.name, COALESCE(m.is_available, true)
                INTO v_db_unit_price, v_db_item_name, v_is_available
                FROM public.menu m
                WHERE (m.id = v_item_id
                   OR lower(trim(m.name)) = lower(trim(v_item_id))
                   OR (v_item->>'item_name' IS NOT NULL AND lower(trim(m.name)) = lower(trim(v_item->>'item_name'))))
                LIMIT 1;
            EXCEPTION WHEN undefined_table THEN
                NULL;
            END;
        END IF;

        -- Reject if item does not exist
        IF v_db_unit_price IS NULL THEN
            RAISE EXCEPTION 'Menu item not found in database: %', v_item_id;
        END IF;

        -- Reject if item is not available (available = false)
        IF v_is_available IS FALSE THEN
            RAISE EXCEPTION 'Item "%" is currently unavailable / sold out', COALESCE(v_db_item_name, v_item_id);
        END IF;

        v_line_total := ROUND((v_quantity * v_db_unit_price)::NUMERIC, 2);
        v_computed_subtotal := v_computed_subtotal + v_line_total;
    END LOOP;

    -- 6. Fetch tax settings & compute totals server-side
    SELECT 
        COALESCE(rs.tax_enabled, true),
        COALESCE(rs.tax_mode, 'inclusive'),
        COALESCE(rs.tax_rate, 0.0500),
        COALESCE(rs.currency, 'INR')
    INTO 
        v_tax_enabled,
        v_tax_mode,
        v_tax_rate,
        v_currency
    FROM public.restaurant_settings rs
    WHERE (rs.restaurant_id = v_restaurant_id OR rs.restaurant_id IS NULL)
    ORDER BY (rs.id = 'current') DESC
    LIMIT 1;

    IF v_tax_enabled IS TRUE AND v_tax_mode = 'exclusive' AND v_tax_rate > 0 THEN
        v_tax_amount := ROUND((v_computed_subtotal * v_tax_rate)::NUMERIC, 2);
        v_computed_total := v_computed_subtotal + v_tax_amount;
    ELSE
        v_tax_amount := 0.00;
        v_computed_total := v_computed_subtotal;
    END IF;

    -- 7. Insert order record with server-computed financial and payment fields
    INSERT INTO public.orders (
        order_ref,
        restaurant_id,
        customer_name,
        customer_phone,
        order_type,
        table_number,
        special_requests,
        order_source,
        source,
        subtotal,
        tax_total,
        total,
        status,
        currency,
        payment_required,
        payment_status,
        payment_method,
        payment_provider,
        payment_reference,
        payment_amount,
        idempotency_key,
        created_at,
        updated_at
    )
    VALUES (
        v_order_ref,
        v_restaurant_id,
        COALESCE(trim(p_order->>'customer_name'), 'Guest'),
        COALESCE(trim(p_order->>'customer_phone'), ''),
        COALESCE(p_order->>'order_type', 'takeaway'),
        CASE WHEN p_order->>'order_type' = 'dine_in' THEN NULLIF(trim(p_order->>'table_number'), '') ELSE NULL END,
        NULLIF(trim(p_order->>'special_requests'), ''),
        COALESCE(p_order->>'source', p_order->>'order_source', 'website'),
        COALESCE(p_order->>'source', p_order->>'order_source', 'website'),
        v_computed_subtotal,
        v_tax_amount,
        v_computed_total,
        'pending',
        COALESCE(p_order->>'currency', v_currency, 'INR'),
        v_payment_required,
        v_payment_status,
        v_payment_method,
        NULLIF(trim(p_order->>'payment_provider'), ''),
        NULLIF(trim(p_order->>'payment_reference'), ''),
        v_computed_total,
        NULLIF(trim(p_order->>'idempotency_key'), ''),
        v_created_at,
        v_created_at
    )
    RETURNING id INTO v_order_id;

    -- 8. Insert line items with server-verified prices and line totals
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        v_quantity := GREATEST(1, COALESCE((v_item->>'quantity')::INTEGER, 1));

        SELECT mi.price, mi.name
        INTO v_db_unit_price, v_db_item_name
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND (mi.restaurant_id = v_restaurant_id OR mi.restaurant_id IS NULL)
        LIMIT 1;

        IF v_db_unit_price IS NULL THEN
            SELECT mi.price, mi.name
            INTO v_db_unit_price, v_db_item_name
            FROM public.menu_items mi
            WHERE (lower(trim(mi.name)) = lower(trim(v_item_id))
               OR (v_item->>'name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'name')))
               OR (v_item->>'item_name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'item_name'))))
              AND (mi.restaurant_id = v_restaurant_id OR mi.restaurant_id IS NULL)
            LIMIT 1;
        END IF;

        IF v_db_unit_price IS NULL THEN
            BEGIN
                SELECT m.price, m.name
                INTO v_db_unit_price, v_db_item_name
                FROM public.menu m
                WHERE m.id = v_item_id
                   OR lower(trim(m.name)) = lower(trim(v_item_id))
                   OR (v_item->>'item_name' IS NOT NULL AND lower(trim(m.name)) = lower(trim(v_item->>'item_name')))
                LIMIT 1;
            EXCEPTION WHEN undefined_table THEN
                NULL;
            END;
        END IF;

        v_line_total := ROUND((v_quantity * v_db_unit_price)::NUMERIC, 2);

        INSERT INTO public.order_items (
            order_id,
            restaurant_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price,
            line_total,
            selected_options,
            created_at
        )
        VALUES (
            v_order_id,
            v_restaurant_id,
            v_item_id,
            COALESCE(v_db_item_name, v_item_id),
            v_quantity,
            v_db_unit_price,
            v_line_total,
            COALESCE(v_item->'selected_options', '{}'::jsonb),
            v_created_at
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_ref', v_order_ref,
        'restaurant_id', v_restaurant_id,
        'payment_status', v_payment_status,
        'payment_required', v_payment_required,
        'subtotal', v_computed_subtotal,
        'tax_total', v_tax_amount,
        'total', v_computed_total,
        'currency', v_currency
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 012_provider_agnostic_payments.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 012_provider_agnostic_payments.sql
-- Description: Provider-Agnostic Payment System (Razorpay, Stripe, None)
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- 1. EXTEND RESTAURANT SETTINGS TABLE
ALTER TABLE public.restaurant_settings
    ADD COLUMN IF NOT EXISTS payments_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS allow_pay_at_counter BOOLEAN NOT NULL DEFAULT true;

-- Backfill payments_enabled from payment_enabled if present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'restaurant_settings' 
          AND column_name = 'payment_enabled'
    ) THEN
        UPDATE public.restaurant_settings
        SET payments_enabled = COALESCE(payments_enabled, payment_enabled, false);
    END IF;
END $$;

-- Provider constraint on restaurant_settings
DO $$
BEGIN
    ALTER TABLE public.restaurant_settings DROP CONSTRAINT IF EXISTS chk_settings_payment_provider;
    ALTER TABLE public.restaurant_settings
        ADD CONSTRAINT chk_settings_payment_provider
        CHECK (payment_provider IN ('razorpay', 'stripe', 'none', 'demo'));
END $$;

-- 2. UPDATE ORDERS PAYMENT STATUS CHECK CONSTRAINT
-- Include 'pay_at_counter' if used in orders table
DO $$
BEGIN
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_payment_status;
    ALTER TABLE public.orders
        ADD CONSTRAINT chk_orders_payment_status
        CHECK (payment_status IN (
            'not_required',
            'pending',
            'processing',
            'paid',
            'pay_at_counter',
            'failed',
            'cancelled',
            'refunded',
            'partially_refunded'
        ));
END $$;

-- 3. SYNC TRIGGER FOR RESTAURANT SETTINGS (payments_enabled <-> payment_enabled)
CREATE OR REPLACE FUNCTION public.handle_restaurant_payments_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.payments_enabled IS NOT NULL AND (OLD.payments_enabled IS NULL OR NEW.payments_enabled <> OLD.payments_enabled) THEN
        NEW.payment_enabled := NEW.payments_enabled;
    ELSIF NEW.payment_enabled IS NOT NULL AND (OLD.payment_enabled IS NULL OR NEW.payment_enabled <> OLD.payment_enabled) THEN
        NEW.payments_enabled := NEW.payment_enabled;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restaurant_payments_sync ON public.restaurant_settings;
CREATE TRIGGER trg_restaurant_payments_sync
    BEFORE INSERT OR UPDATE ON public.restaurant_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_restaurant_payments_sync();

-- 4. VERIFY / REINFORCE OWNER-ONLY UPDATE POLICY
-- Public can read settings (needed for checkout availability & currency)
DROP POLICY IF EXISTS "Public can read restaurant settings" ON public.restaurant_settings;
CREATE POLICY "Public can read restaurant settings"
    ON public.restaurant_settings
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Only owners can edit restaurant settings (including payment provider, keys status, flags)
DROP POLICY IF EXISTS "Owners can update restaurant settings" ON public.restaurant_settings;
CREATE POLICY "Owners can update restaurant settings"
    ON public.restaurant_settings
    FOR UPDATE
    TO authenticated
    USING (public.get_staff_role(auth.uid()) = 'owner')
    WITH CHECK (public.get_staff_role(auth.uid()) = 'owner');


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 013_owner_features.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Migration 013: Owner-Focused Features
-- Customers, Discount Codes, Happy Hour Schedules, Stock Management, Notification Settings

-- ============================================================
-- 1. CUSTOMERS TABLE (aggregated from orders)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    marketing_consent BOOLEAN DEFAULT false,
    order_count INTEGER DEFAULT 0,
    total_spent NUMERIC(12,2) DEFAULT 0,
    last_order_at TIMESTAMPTZ,
    first_order_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_last_order ON customers(last_order_at DESC);

-- ============================================================
-- 2. DISCOUNT CODES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
    discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
    min_order_amount NUMERIC(10,2) DEFAULT 0,
    max_discount_amount NUMERIC(10,2), -- cap for percentage discounts
    max_uses INTEGER, -- null = unlimited
    used_count INTEGER DEFAULT 0,
    valid_from TIMESTAMPTZ DEFAULT now(),
    valid_until TIMESTAMPTZ,
    active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(UPPER(code));

-- ============================================================
-- 3. HAPPY HOUR SCHEDULES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS happy_hour_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL DEFAULT 'Happy Hour',
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 6=Sat
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    discount_percentage NUMERIC(5,2) NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
    category_id TEXT, -- null = all categories
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. ADD COLUMNS TO EXISTING TABLES
-- ============================================================

-- Restaurant Settings: notification + review config
DO $$ BEGIN
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS google_review_link TEXT;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS owner_notification_phone TEXT;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS owner_notification_email TEXT;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS owner_notification_method TEXT DEFAULT 'none'
        CHECK (owner_notification_method IN ('email', 'whatsapp', 'both', 'none'));
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS low_stock_alert_threshold INTEGER DEFAULT 5;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Menu Items: stock tracking
DO $$ BEGIN
    ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS stock_count INTEGER; -- null = unlimited
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Orders: discount tracking
DO $$ BEGIN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- 5. AUTO-POPULATE CUSTOMERS FROM ORDERS (TRIGGER)
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_customer_from_order()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO customers (name, phone, order_count, total_spent, last_order_at, first_order_at)
    VALUES (
        NEW.customer_name,
        NEW.customer_phone,
        1,
        COALESCE(NEW.total, 0),
        NEW.created_at,
        NEW.created_at
    )
    ON CONFLICT (phone) DO UPDATE SET
        name = CASE WHEN LENGTH(NEW.customer_name) > LENGTH(customers.name) THEN NEW.customer_name ELSE customers.name END,
        order_count = customers.order_count + 1,
        total_spent = customers.total_spent + COALESCE(NEW.total, 0),
        last_order_at = GREATEST(customers.last_order_at, NEW.created_at),
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_upsert_customer_on_order ON orders;
CREATE TRIGGER trg_upsert_customer_on_order
    AFTER INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION upsert_customer_from_order();

-- ============================================================
-- 6. DECREMENT STOCK ON ORDER (TRIGGER)
-- ============================================================
CREATE OR REPLACE FUNCTION decrement_menu_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE menu_items
    SET stock_count = GREATEST(stock_count - NEW.quantity, 0),
        updated_at = now()
    WHERE id = NEW.menu_item_id
      AND stock_count IS NOT NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_decrement_stock ON order_items;
CREATE TRIGGER trg_decrement_stock
    AFTER INSERT ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION decrement_menu_stock();

-- ============================================================
-- 7. RLS POLICIES
-- ============================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE happy_hour_schedules ENABLE ROW LEVEL SECURITY;

-- Customers: staff can read, owners can update
CREATE POLICY customers_select ON customers FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM staff_profiles WHERE user_id = auth.uid() AND active = true));

CREATE POLICY customers_update ON customers FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM staff_profiles WHERE user_id = auth.uid() AND role = 'owner' AND active = true));

-- Discount codes: staff can read, owners/managers can manage
CREATE POLICY discount_codes_select ON discount_codes FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM staff_profiles WHERE user_id = auth.uid() AND active = true));

CREATE POLICY discount_codes_manage ON discount_codes FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM staff_profiles WHERE user_id = auth.uid() AND role IN ('owner', 'manager') AND active = true));

-- Happy hour: staff can read, owners can manage
CREATE POLICY happy_hour_select ON happy_hour_schedules FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM staff_profiles WHERE user_id = auth.uid() AND active = true));

-- Public read for happy hour (customers need to see active schedules)
CREATE POLICY happy_hour_public_read ON happy_hour_schedules FOR SELECT TO anon
    USING (active = true);

CREATE POLICY happy_hour_manage ON happy_hour_schedules FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM staff_profiles WHERE user_id = auth.uid() AND role = 'owner' AND active = true));

-- Public read for active discount codes (for validation)
CREATE POLICY discount_codes_public_validate ON discount_codes FOR SELECT TO anon
    USING (active = true AND (valid_until IS NULL OR valid_until > now()) AND (max_uses IS NULL OR used_count < max_uses));

-- Backfill existing orders into customers table
INSERT INTO customers (name, phone, order_count, total_spent, last_order_at, first_order_at)
SELECT
    customer_name,
    customer_phone,
    COUNT(*),
    COALESCE(SUM(total), 0),
    MAX(created_at),
    MIN(created_at)
FROM orders
WHERE customer_phone IS NOT NULL AND customer_phone != ''
GROUP BY customer_name, customer_phone
ON CONFLICT (phone) DO UPDATE SET
    order_count = EXCLUDED.order_count,
    total_spent = EXCLUDED.total_spent,
    last_order_at = EXCLUDED.last_order_at,
    first_order_at = EXCLUDED.first_order_at,
    updated_at = now();


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 014_order_caps_and_direct_insert_lockdown.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 014_order_caps_and_direct_insert_lockdown.sql
-- Description:
-- 1. Quantity & Item Caps: Enforce 1-50 quantity limit per item (raises error otherwise)
--    and cap items per order at 40 in create_order_atomic.
-- 2. Lockdown Direct Table Inserts: Drop public insertion policies and REVOKE INSERT
--    on orders, order_items, and reservations from anon and authenticated roles.
-- 3. Stored Procedure Enforcement: Mandate that orders must only be created through
--    create_order_atomic (SECURITY DEFINER) and reservations through create_reservation_atomic (SECURITY DEFINER).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DROP PUBLIC INSERTION POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public order insertion" ON public.orders;
DROP POLICY IF EXISTS "Allow public order_items insertion" ON public.order_items;
DROP POLICY IF EXISTS "Allow public order item insertion" ON public.order_items;
DROP POLICY IF EXISTS "Allow public reservation insertion" ON public.reservations;

-- ------------------------------------------------------------------------------
-- 2. REVOKE DIRECT TABLE INSERT PRIVILEGES FROM anon AND authenticated
-- ------------------------------------------------------------------------------
REVOKE INSERT ON TABLE public.orders FROM anon, authenticated;
REVOKE INSERT ON TABLE public.order_items FROM anon, authenticated;
REVOKE INSERT ON TABLE public.reservations FROM anon, authenticated;

-- Ensure service_role retains administrative privileges
GRANT ALL ON TABLE public.orders TO service_role;
GRANT ALL ON TABLE public.order_items TO service_role;
GRANT ALL ON TABLE public.reservations TO service_role;

-- ------------------------------------------------------------------------------
-- 3. HARDENED create_order_atomic (SECURITY DEFINER) WITH QUANTITY & ITEM CAPS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order JSONB,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_order_ref TEXT;
    v_restaurant_id TEXT;
    v_item JSONB;
    v_item_id TEXT;
    v_quantity INTEGER;
    v_db_unit_price NUMERIC;
    v_db_item_name TEXT;
    v_is_available BOOLEAN;
    v_line_total NUMERIC;
    v_computed_subtotal NUMERIC := 0.00;
    v_computed_total NUMERIC := 0.00;
    v_tax_amount NUMERIC := 0.00;
    v_discount_amount NUMERIC := 0.00;
    
    -- Restaurant settings configuration
    v_tax_enabled BOOLEAN := true;
    v_tax_mode TEXT := 'inclusive';
    v_tax_rate NUMERIC := 0.0500;
    v_currency TEXT := 'INR';
    
    -- Payment fields
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_payment_required BOOLEAN;
    v_created_at TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    -- 1. Validate items array presence
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    -- 2. Cap items per order at 40
    IF jsonb_array_length(p_items) > 40 THEN
        RAISE EXCEPTION 'Order cannot contain more than 40 distinct items (got %)', jsonb_array_length(p_items);
    END IF;

    -- 3. Tenant propagation
    v_restaurant_id := trim(COALESCE(p_order->>'restaurant_id', 'the-cafe-barrackpore'));

    -- 4. Determine order reference (generate server-side if not provided or blank)
    v_order_ref := trim(COALESCE(p_order->>'order_ref', ''));
    IF v_order_ref = '' THEN
        v_order_ref := public.generate_order_reference();
    END IF;

    -- 5. Determine payment_status strictly on the server:
    --    Sets payment_status to 'pending' for online payment or 'pay_at_counter' otherwise.
    --    Completely IGNORES client-sent payment_status.
    v_payment_method := lower(trim(COALESCE(
        p_order->>'payment_method',
        p_order->>'payment_provider',
        ''
    )));

    IF v_payment_method IN ('counter', 'pay_at_counter', 'cash', 'manual') THEN
        v_payment_status := 'pay_at_counter';
        v_payment_required := false;
    ELSE
        v_payment_status := 'pending';
        v_payment_required := true;
    END IF;

    -- 6. Calculate subtotal and line items strictly server-side:
    --    Completely IGNORES client-sent unit_price, line_total, and total.
    --    Validates quantity between 1 and 50 (raising an exception otherwise).
    --    Takes only item ids and quantities, then looks up prices from menu_items.
    --    Rejects items where available = false.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        IF v_item_id = '' THEN
            RAISE EXCEPTION 'Missing item identifier in order items';
        END IF;

        BEGIN
            v_quantity := (v_item->>'quantity')::INTEGER;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid item quantity for item "%"', v_item_id;
        END;

        IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 50 THEN
            RAISE EXCEPTION 'Item quantity must be between 1 and 50 (got % for item "%")', COALESCE(v_quantity, 0), v_item_id;
        END IF;

        v_db_unit_price := NULL;
        v_db_item_name := NULL;
        v_is_available := NULL;

        -- Primary lookup: public.menu_items by ID
        SELECT mi.price, mi.name, mi.available
        INTO v_db_unit_price, v_db_item_name, v_is_available
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND (mi.restaurant_id = v_restaurant_id OR mi.restaurant_id IS NULL)
        LIMIT 1;

        -- Fallback 1: lookup by name in public.menu_items
        IF v_db_unit_price IS NULL THEN
            SELECT mi.price, mi.name, mi.available
            INTO v_db_unit_price, v_db_item_name, v_is_available
            FROM public.menu_items mi
            WHERE (lower(trim(mi.name)) = lower(trim(v_item_id))
               OR (v_item->>'name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'name')))
               OR (v_item->>'item_name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'item_name'))))
              AND (mi.restaurant_id = v_restaurant_id OR mi.restaurant_id IS NULL)
            LIMIT 1;
        END IF;

        -- Fallback 2: public.menu table (if legacy table exists)
        IF v_db_unit_price IS NULL THEN
            BEGIN
                SELECT m.price, m.name, COALESCE(m.is_available, true)
                INTO v_db_unit_price, v_db_item_name, v_is_available
                FROM public.menu m
                WHERE (m.id = v_item_id
                   OR lower(trim(m.name)) = lower(trim(v_item_id))
                   OR (v_item->>'item_name' IS NOT NULL AND lower(trim(m.name)) = lower(trim(v_item->>'item_name'))))
                LIMIT 1;
            EXCEPTION WHEN undefined_table THEN
                NULL;
            END;
        END IF;

        -- Reject if item does not exist
        IF v_db_unit_price IS NULL THEN
            RAISE EXCEPTION 'Menu item not found in database: %', v_item_id;
        END IF;

        -- Reject if item is not available (available = false)
        IF v_is_available IS FALSE THEN
            RAISE EXCEPTION 'Item "%" is currently unavailable / sold out', COALESCE(v_db_item_name, v_item_id);
        END IF;

        v_line_total := ROUND((v_quantity * v_db_unit_price)::NUMERIC, 2);
        v_computed_subtotal := v_computed_subtotal + v_line_total;
    END LOOP;

    -- 7. Fetch tax settings & compute totals server-side
    SELECT 
        COALESCE(rs.tax_enabled, true),
        COALESCE(rs.tax_mode, 'inclusive'),
        COALESCE(rs.tax_rate, 0.0500),
        COALESCE(rs.currency, 'INR')
    INTO 
        v_tax_enabled,
        v_tax_mode,
        v_tax_rate,
        v_currency
    FROM public.restaurant_settings rs
    WHERE (rs.restaurant_id = v_restaurant_id OR rs.restaurant_id IS NULL)
    ORDER BY (rs.id = 'current') DESC
    LIMIT 1;

    IF v_tax_enabled IS TRUE AND v_tax_mode = 'exclusive' AND v_tax_rate > 0 THEN
        v_tax_amount := ROUND((v_computed_subtotal * v_tax_rate)::NUMERIC, 2);
        v_computed_total := v_computed_subtotal + v_tax_amount;
    ELSE
        v_tax_amount := 0.00;
        v_computed_total := v_computed_subtotal;
    END IF;

    -- Handle discount amount if applicable
    v_discount_amount := COALESCE((p_order->>'discount_amount')::NUMERIC, 0.00);
    IF v_discount_amount < 0 THEN
        v_discount_amount := 0.00;
    END IF;
    v_computed_total := GREATEST(0.00, v_computed_total - v_discount_amount);

    -- 8. Insert order record with server-computed financial and payment fields
    INSERT INTO public.orders (
        order_ref,
        restaurant_id,
        customer_name,
        customer_phone,
        order_type,
        table_number,
        special_requests,
        order_source,
        source,
        subtotal,
        tax_total,
        total,
        status,
        currency,
        payment_required,
        payment_status,
        payment_method,
        payment_provider,
        payment_reference,
        payment_amount,
        discount_code,
        discount_amount,
        idempotency_key,
        created_at,
        updated_at
    )
    VALUES (
        v_order_ref,
        v_restaurant_id,
        COALESCE(trim(p_order->>'customer_name'), 'Guest'),
        COALESCE(trim(p_order->>'customer_phone'), ''),
        COALESCE(p_order->>'order_type', 'takeaway'),
        CASE WHEN p_order->>'order_type' = 'dine_in' THEN NULLIF(trim(p_order->>'table_number'), '') ELSE NULL END,
        NULLIF(trim(p_order->>'special_requests'), ''),
        COALESCE(p_order->>'source', p_order->>'order_source', 'website'),
        COALESCE(p_order->>'source', p_order->>'order_source', 'website'),
        v_computed_subtotal,
        v_tax_amount,
        v_computed_total,
        'pending',
        COALESCE(p_order->>'currency', v_currency, 'INR'),
        v_payment_required,
        v_payment_status,
        v_payment_method,
        NULLIF(trim(p_order->>'payment_provider'), ''),
        NULLIF(trim(p_order->>'payment_reference'), ''),
        v_computed_total,
        NULLIF(trim(p_order->>'discount_code'), ''),
        v_discount_amount,
        NULLIF(trim(p_order->>'idempotency_key'), ''),
        v_created_at,
        v_created_at
    )
    RETURNING id INTO v_order_id;

    -- 9. Insert line items with server-verified prices and line totals
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        v_quantity := (v_item->>'quantity')::INTEGER;

        SELECT mi.price, mi.name
        INTO v_db_unit_price, v_db_item_name
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND (mi.restaurant_id = v_restaurant_id OR mi.restaurant_id IS NULL)
        LIMIT 1;

        IF v_db_unit_price IS NULL THEN
            SELECT mi.price, mi.name
            INTO v_db_unit_price, v_db_item_name
            FROM public.menu_items mi
            WHERE (lower(trim(mi.name)) = lower(trim(v_item_id))
               OR (v_item->>'name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'name')))
               OR (v_item->>'item_name' IS NOT NULL AND lower(trim(mi.name)) = lower(trim(v_item->>'item_name'))))
              AND (mi.restaurant_id = v_restaurant_id OR mi.restaurant_id IS NULL)
            LIMIT 1;
        END IF;

        IF v_db_unit_price IS NULL THEN
            BEGIN
                SELECT m.price, m.name
                INTO v_db_unit_price, v_db_item_name
                FROM public.menu m
                WHERE m.id = v_item_id
                   OR lower(trim(m.name)) = lower(trim(v_item_id))
                   OR (v_item->>'item_name' IS NOT NULL AND lower(trim(m.name)) = lower(trim(v_item->>'item_name')))
                LIMIT 1;
            EXCEPTION WHEN undefined_table THEN
                NULL;
            END;
        END IF;

        v_line_total := ROUND((v_quantity * v_db_unit_price)::NUMERIC, 2);

        INSERT INTO public.order_items (
            order_id,
            restaurant_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price,
            line_total,
            selected_options,
            created_at
        )
        VALUES (
            v_order_id,
            v_restaurant_id,
            v_item_id,
            COALESCE(v_db_item_name, v_item_id),
            v_quantity,
            v_db_unit_price,
            v_line_total,
            COALESCE(v_item->'selected_options', '{}'::jsonb),
            v_created_at
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_ref', v_order_ref,
        'restaurant_id', v_restaurant_id,
        'payment_status', v_payment_status,
        'payment_required', v_payment_required,
        'subtotal', v_computed_subtotal,
        'tax_total', v_tax_amount,
        'total', v_computed_total,
        'currency', v_currency
    );
END;
$$;

-- Backward-compatibility wrapper for scalar parameter calls
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_order_type TEXT,
    p_items JSONB,
    p_table_number TEXT DEFAULT NULL,
    p_special_requests TEXT DEFAULT NULL,
    p_order_source TEXT DEFAULT 'website',
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.create_order_atomic(
        jsonb_build_object(
            'customer_name', p_customer_name,
            'customer_phone', p_customer_phone,
            'order_type', p_order_type,
            'table_number', p_table_number,
            'special_requests', p_special_requests,
            'source', p_order_source,
            'idempotency_key', p_idempotency_key,
            'payment_method', 'online'
        ),
        p_items
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. HARDENED create_reservation_atomic (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_reservation_atomic(
    p_reservation JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_res_id UUID;
    v_res_ref TEXT;
    v_restaurant_id TEXT;
    v_customer_name TEXT;
    v_customer_phone TEXT;
    v_party_size INTEGER;
    v_date DATE;
    v_time TEXT;
BEGIN
    IF p_reservation IS NULL OR jsonb_typeof(p_reservation) <> 'object' THEN
        RAISE EXCEPTION 'Reservation payload must be a valid JSON object';
    END IF;

    -- Tenant Scoping
    v_restaurant_id := trim(COALESCE(p_reservation->>'restaurant_id', 'the-cafe-barrackpore'));
    IF length(v_restaurant_id) < 2 THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- Customer Name Validation
    v_customer_name := trim(COALESCE(p_reservation->>'customer_name', ''));
    IF length(v_customer_name) < 2 THEN
        RAISE EXCEPTION 'Please enter a valid full name (minimum 2 characters)';
    END IF;

    -- Customer Phone Validation
    v_customer_phone := trim(COALESCE(p_reservation->>'customer_phone', ''));
    IF length(v_customer_phone) < 7 THEN
        RAISE EXCEPTION 'Please enter a valid phone number';
    END IF;

    -- Reservation Reference
    v_res_ref := trim(COALESCE(p_reservation->>'reservation_ref', ''));
    IF v_res_ref = '' THEN
        v_res_ref := 'RES-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
    END IF;

    -- Date Validation
    IF p_reservation->>'reservation_date' IS NULL OR trim(p_reservation->>'reservation_date') = '' THEN
        RAISE EXCEPTION 'Please select a reservation date';
    END IF;

    BEGIN
        v_date := (p_reservation->>'reservation_date')::DATE;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid reservation date format';
    END;

    -- Time Validation
    v_time := trim(COALESCE(p_reservation->>'reservation_time', ''));
    IF length(v_time) = 0 THEN
        RAISE EXCEPTION 'Please select a reservation time';
    END IF;

    -- Party Size Validation (1 to 20 guests)
    BEGIN
        v_party_size := (p_reservation->>'party_size')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid party size';
    END;

    IF v_party_size IS NULL OR v_party_size < 1 OR v_party_size > 20 THEN
        RAISE EXCEPTION 'Party size must be between 1 and 20 guests';
    END IF;

    -- Insert reservation record
    INSERT INTO public.reservations (
        reservation_ref,
        restaurant_id,
        customer_name,
        customer_phone,
        reservation_date,
        reservation_time,
        party_size,
        special_requests,
        status,
        source,
        created_at,
        updated_at
    )
    VALUES (
        v_res_ref,
        v_restaurant_id,
        v_customer_name,
        v_customer_phone,
        v_date,
        v_time,
        v_party_size,
        NULLIF(trim(p_reservation->>'special_requests'), ''),
        COALESCE(p_reservation->>'status', 'pending'),
        COALESCE(p_reservation->>'source', 'website'),
        now(),
        now()
    )
    RETURNING id INTO v_res_id;

    RETURN jsonb_build_object(
        'success', true,
        'reservation_id', v_res_id,
        'reservation_ref', v_res_ref,
        'restaurant_id', v_restaurant_id
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. FUNCTION EXECUTION GRANTS
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_order_atomic(JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_reservation_atomic(JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_reservation_atomic(JSONB) TO anon, authenticated, service_role;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 015_complete_image_sync.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 015_complete_image_sync.sql
-- Description: Seed complete site_content keys for full image synchronization:
--              hero, story, aboutVibe (atmosphere cards), specials (with platter combos),
--              gallery (ambiance photos), and branding (logo).
-- ==============================================================================

INSERT INTO public.site_content (key, value, restaurant_id)
VALUES
    ('hero', '{
        "headline": "Step Into Barrackpore’s Trendsetting Dining Retreat",
        "subtext": "Where artisan coffee meets handcrafted cocktails & gourmet comfort food in a strictly premium, nocturnal setting.",
        "src": "/images/hero-cinematic.jpg",
        "alt": "The Café Barrackpore — Nocturnal Cocktail & Espresso Lounge"
    }'::jsonb, 'the-cafe-barrackpore'),
    ('story', '{
        "title": "Crafting Barrackpore’s finest nocturnal escape",
        "description": "We believe that true luxury lies in the details. From sourcing the most vibrant, local ingredients from surrounding farms to hand-selecting the perfect acoustic backdrop, every element of our space is intentionally curated.",
        "src": "/images/story-pour.webp",
        "alt": "Artisanal Espresso Pour"
    }'::jsonb, 'the-cafe-barrackpore'),
    ('aboutVibe', '{
        "images": [
            { "src": "/images/components/comp_img_0_highres.jpg", "alt": "Midnight Velvet Booth Seating" },
            { "src": "/images/components/comp_img_2.webp", "alt": "Live Acoustic & Reading Nook" },
            { "src": "/images/components/comp_img_3.webp", "alt": "Signature Brew Bar & Mixology" },
            { "src": "/images/components/comp_img_1.webp", "alt": "Artisan Platters and Comfort Food" }
        ]
    }'::jsonb, 'the-cafe-barrackpore'),
    ('specials', '{
        "title": "Special Banquet & Hangout Platters",
        "description": "Generous sharing platters with sizzling pan-Asian or smoky clay oven selections, made fresh to order.",
        "image": "/images/hero-bar.webp",
        "combos": [
            {
                "id": "combo-chinese-platter",
                "name": "Chinese Platter",
                "category": "mains-platters",
                "diet": "nv",
                "price": 380,
                "badge": "CHINESE BANQUET",
                "serves": "2–3 Guests",
                "description": "Delicate steamed momos, golden spring rolls & wok-tossed spicy chilli bites.",
                "image": "/images/platters/platter-chinese.webp"
            },
            {
                "id": "combo-tandoori-platter",
                "name": "Tandoori Platter",
                "category": "mains-platters",
                "diet": "nv",
                "price": 450,
                "badge": "TANDOORI ROYALE",
                "serves": "2–3 Guests",
                "description": "Smoky clay oven kebabs, succulent tikka, fresh mint chutney & garlic butter naan.",
                "image": "/images/platters/platter-tandoori.webp"
            },
            {
                "id": "combo-rice-noodles-bowl",
                "name": "Rice & Noodles Bowl",
                "category": "mains-platters",
                "diet": "all",
                "price": 240,
                "badge": "PAN-ASIAN SHARING",
                "serves": "1–2 Guests",
                "description": "Wok-tossed Hakka noodles, fragrant fried rice & crispy Manchurian gravy.",
                "image": "/images/platters/platter-bowl.webp"
            }
        ]
    }'::jsonb, 'the-cafe-barrackpore'),
    ('gallery', '{
        "images": [
            { "src": "/images/gallery-couple.webp", "alt": "Nightlife Couple" },
            { "src": "/images/gallery-pizza.webp", "alt": "Wood-Fired Pizza" },
            { "src": "/images/gallery-beans.webp", "alt": "Artisanal Coffee Beans" },
            { "src": "/images/gallery-guitar.webp", "alt": "Acoustic Weekend Guitar" }
        ]
    }'::jsonb, 'the-cafe-barrackpore'),
    ('branding', '{
        "logoUrl": "/logo.webp",
        "alt": "The Café Barrackpore Crest"
    }'::jsonb, 'the-cafe-barrackpore')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = timezone('utc'::text, now());


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 016_security_hardening.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 016_security_hardening.sql
-- Description:
-- 1. In the orders SELECT policy, remove the anon condition. Only service_role
--    and active staff of the same restaurant may SELECT orders and order_items.
-- 2. Replace restaurant_tables and menu_item_availability "FOR ALL" policies:
--    Anon gets SELECT only (active tables, availability).
--    Only active owner/manager staff may INSERT/UPDATE/DELETE.
--    Add WITH CHECK clauses to every policy that has USING.
-- 3. REVOKE INSERT, UPDATE, DELETE on all public tables from anon.
--    REVOKE ALL on orders, order_items, payments, staff_profiles, audit tables from anon.
--    Re-GRANT only what the app needs.
-- 4. verified_tokens table for single-use Cloudflare Turnstile verification
--    (5-minute expiry, service_role only).
-- 5. rate_limits table for persistent cross-instance rate limiting (service_role only).
-- 6. Lock down discount_codes: drop anon policy, REVOKE SELECT from anon,
--    and add RPC validate_discount_code(code) returning only the discount.
-- 7. Order references: generate with gen_random_uuid-based or 10+ character random codes,
--    never sequential. In create_order_atomic, generate random payment_token built from
--    two gen_random_uuid (dashes removed, 64 hex chars), store only its hash in
--    payment_token_hash, and return the raw token once to the browser.
-- 8. Require verified Turnstile token inside create_order_atomic and create_reservation_atomic,
--    consuming it atomically from verified_tokens.
-- 9. Helper RPC get_order_status_by_token for token-verified order status checks.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADD payment_token_hash COLUMN TO orders
-- ------------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_token_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_payment_token_hash ON public.orders (payment_token_hash);

-- ------------------------------------------------------------------------------
-- 2. HARDENED ORDER REFERENCE GENERATOR (gen_random_uuid-based, 10+ chars random)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_order_reference()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_year TEXT := to_char(CURRENT_DATE, 'YYYY');
    v_random_code TEXT;
BEGIN
    -- 10-character random alphanumeric code derived from gen_random_uuid
    v_random_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    RETURN 'CB-' || v_year || '-' || v_random_code;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. FIX orders & order_items SELECT POLICIES (REMOVE anon CONDITION)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "staff_select_orders_tenant" ON public.orders;
DROP POLICY IF EXISTS "Active staff can view orders" ON public.orders;
DROP POLICY IF EXISTS "staff_view_orders" ON public.orders;
DROP POLICY IF EXISTS "public_select_orders" ON public.orders;

CREATE POLICY "staff_select_orders_tenant"
ON public.orders
FOR SELECT
TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_active_staff(auth.uid())
    )
);

DROP POLICY IF EXISTS "staff_select_order_items_tenant" ON public.order_items;
DROP POLICY IF EXISTS "Active staff can view order_items" ON public.order_items;
DROP POLICY IF EXISTS "staff_view_order_items" ON public.order_items;

CREATE POLICY "staff_select_order_items_tenant"
ON public.order_items
FOR SELECT
TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_active_staff(auth.uid())
    )
);

-- ------------------------------------------------------------------------------
-- 4. REPLACE restaurant_tables "FOR ALL" POLICIES
--    Anon gets SELECT only (active tables). Only active owner/manager staff may INSERT/UPDATE/DELETE.
--    Add WITH CHECK clauses to every policy that has USING.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "staff_manage_tables_tenant" ON public.restaurant_tables;
DROP POLICY IF EXISTS "public_read_restaurant_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "staff_manage_restaurant_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "anon_select_active_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "staff_select_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "owner_manager_insert_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "owner_manager_update_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "owner_manager_delete_tables" ON public.restaurant_tables;

-- Anon gets SELECT only on active tables
CREATE POLICY "anon_select_active_tables"
ON public.restaurant_tables
FOR SELECT
TO anon
USING (active = true);

-- Staff gets SELECT on all tables of their restaurant
CREATE POLICY "staff_select_tables"
ON public.restaurant_tables
FOR SELECT
TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_active_staff(auth.uid())
    )
);

-- Only active owner/manager staff may INSERT
CREATE POLICY "owner_manager_insert_tables"
ON public.restaurant_tables
FOR INSERT
TO authenticated, service_role
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

-- Only active owner/manager staff may UPDATE (WITH CHECK added)
CREATE POLICY "owner_manager_update_tables"
ON public.restaurant_tables
FOR UPDATE
TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
)
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

-- Only active owner/manager staff may DELETE
CREATE POLICY "owner_manager_delete_tables"
ON public.restaurant_tables
FOR DELETE
TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

-- ------------------------------------------------------------------------------
-- 5. REPLACE menu_item_availability "FOR ALL" POLICIES
--    Anon gets SELECT only. Only active owner/manager staff may INSERT/UPDATE/DELETE.
--    Add WITH CHECK clauses to every policy that has USING.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "staff_manage_availability_tenant" ON public.menu_item_availability;
DROP POLICY IF EXISTS "public_read_menu_availability" ON public.menu_item_availability;
DROP POLICY IF EXISTS "staff_manage_menu_availability" ON public.menu_item_availability;
DROP POLICY IF EXISTS "anon_select_menu_availability" ON public.menu_item_availability;
DROP POLICY IF EXISTS "staff_select_menu_availability" ON public.menu_item_availability;
DROP POLICY IF EXISTS "owner_manager_insert_availability" ON public.menu_item_availability;
DROP POLICY IF EXISTS "owner_manager_update_availability" ON public.menu_item_availability;
DROP POLICY IF EXISTS "owner_manager_delete_availability" ON public.menu_item_availability;

CREATE POLICY "anon_select_menu_availability"
ON public.menu_item_availability
FOR SELECT
TO anon
USING (true);

CREATE POLICY "staff_select_menu_availability"
ON public.menu_item_availability
FOR SELECT
TO authenticated, service_role
USING (true);

CREATE POLICY "owner_manager_insert_availability"
ON public.menu_item_availability
FOR INSERT
TO authenticated, service_role
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

CREATE POLICY "owner_manager_update_availability"
ON public.menu_item_availability
FOR UPDATE
TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
)
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

CREATE POLICY "owner_manager_delete_availability"
ON public.menu_item_availability
FOR DELETE
TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

-- ------------------------------------------------------------------------------
-- 6. BROAD PRIVILEGE REVOCATION & SELECTIVE RE-GRANT
-- ------------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

REVOKE ALL ON TABLE public.orders FROM anon;
REVOKE ALL ON TABLE public.order_items FROM anon;
REVOKE ALL ON TABLE public.payments FROM anon;
REVOKE ALL ON TABLE public.staff_profiles FROM anon;

GRANT SELECT ON TABLE public.menu_categories TO anon;
GRANT SELECT ON TABLE public.menu_items TO anon;
GRANT SELECT ON TABLE public.site_content TO anon;
GRANT SELECT ON TABLE public.restaurant_tables TO anon;
GRANT SELECT ON TABLE public.menu_item_availability TO anon;
GRANT SELECT ON TABLE public.restaurant_settings TO anon;

-- ------------------------------------------------------------------------------
-- 7. VERIFIED TOKENS TABLE (SINGLE-USE, 5-MIN EXPIRY, SERVICE ROLE ONLY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verified_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    action TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verified_tokens_token ON public.verified_tokens (token);
CREATE INDEX IF NOT EXISTS idx_verified_tokens_expires_at ON public.verified_tokens (expires_at);

ALTER TABLE public.verified_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.verified_tokens FROM anon, authenticated, public;
GRANT ALL ON TABLE public.verified_tokens TO service_role;

-- ------------------------------------------------------------------------------
-- 8. RATE LIMITS TABLE (PERSISTENT DISTRIBUTED RATE LIMITING, SERVICE ROLE ONLY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    reset_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON public.rate_limits (reset_at);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rate_limits FROM anon, authenticated, public;
GRANT ALL ON TABLE public.rate_limits TO service_role;

-- ------------------------------------------------------------------------------
-- 9. DISCOUNT CODES LOCKDOWN & RPC VALIDATOR
--    Drop anon policy, REVOKE SELECT from anon, and expose validate_discount_code(code)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "discount_codes_public_validate" ON public.discount_codes;
REVOKE SELECT ON TABLE public.discount_codes FROM anon;

CREATE OR REPLACE FUNCTION public.validate_discount_code(code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_discount RECORD;
BEGIN
    IF code IS NULL OR trim(code) = '' THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Discount code is required');
    END IF;

    SELECT 
        dc.code AS disc_code,
        dc.discount_type,
        dc.discount_value,
        dc.min_order_amount,
        dc.max_discount_amount
    INTO v_discount
    FROM public.discount_codes dc
    WHERE UPPER(dc.code) = UPPER(trim(validate_discount_code.code))
      AND dc.active = true
      AND (dc.valid_until IS NULL OR dc.valid_until > now())
      AND (dc.max_uses IS NULL OR dc.used_count < dc.max_uses)
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired discount code');
    END IF;

    -- Return only the discount details to protect internal business analytics
    RETURN jsonb_build_object(
        'valid', true,
        'code', v_discount.disc_code,
        'discount_type', v_discount.discount_type,
        'discount_value', v_discount.discount_value,
        'min_order_amount', v_discount.min_order_amount,
        'max_discount_amount', v_discount.max_discount_amount
    );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_discount_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_discount_code(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 10. SECURE TOKEN-BASED ORDER STATUS RPC (FOR DINERS WITH TOKEN)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_order_status_by_token(
    p_order_ref TEXT,
    p_payment_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order RECORD;
    v_token_hash TEXT;
BEGIN
    IF p_order_ref IS NULL OR p_payment_token IS NULL OR trim(p_payment_token) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing order reference or payment token');
    END IF;

    v_token_hash := encode(sha256(trim(p_payment_token)::bytea), 'hex');

    SELECT id, order_ref, status, payment_status, total, payment_amount, currency, created_at
    INTO v_order
    FROM public.orders
    WHERE order_ref = trim(p_order_ref)
      AND payment_token_hash = v_token_hash
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid order reference or payment token');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_ref', v_order.order_ref,
        'status', v_order.status,
        'payment_status', v_order.payment_status,
        'total', v_order.total,
        'payment_amount', v_order.payment_amount,
        'currency', v_order.currency,
        'created_at', v_order.created_at
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_status_by_token(TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 11. HARDENED create_order_atomic WITH TURNSTILE VERIFICATION & gen_random_uuid TOKENS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order JSONB,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_order_ref TEXT;
    v_restaurant_id TEXT;
    v_verified_token TEXT;
    v_consumed_token_id UUID;
    v_raw_payment_token TEXT;
    v_payment_token_hash TEXT;
    v_item JSONB;
    v_item_id TEXT;
    v_quantity INTEGER;
    v_db_unit_price NUMERIC;
    v_db_item_name TEXT;
    v_is_available BOOLEAN;
    v_line_total NUMERIC;
    v_computed_subtotal NUMERIC := 0.00;
    v_computed_total NUMERIC := 0.00;
    v_tax_amount NUMERIC := 0.00;
    
    -- Restaurant settings configuration
    v_tax_enabled BOOLEAN := true;
    v_tax_mode TEXT := 'inclusive';
    v_tax_rate NUMERIC := 0.0500;
    v_currency TEXT := 'INR';
    
    -- Payment fields
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_payment_required BOOLEAN;
    v_created_at TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    -- 1. Input Validation: Check items array
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cannot create an order with empty items';
    END IF;

    -- Enforce distinct item cap at 40
    IF jsonb_array_length(p_items) > 40 THEN
        RAISE EXCEPTION 'Order cannot contain more than 40 distinct items';
    END IF;

    -- 2. Turnstile Bot Defense: Require verified single-use token
    v_verified_token := trim(COALESCE(p_order->>'verified_token', ''));
    IF v_verified_token = '' THEN
        RAISE EXCEPTION 'A verified Turnstile token is required to place an order';
    END IF;

    DELETE FROM public.verified_tokens
    WHERE token = v_verified_token
      AND action IN ('order', 'checkout')
      AND expires_at > now()
    RETURNING id INTO v_consumed_token_id;

    IF v_consumed_token_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired security token. Please verify again.';
    END IF;

    -- 3. Validate Customer Details
    IF p_order->>'customer_name' IS NULL OR length(trim(p_order->>'customer_name')) < 2 THEN
        RAISE EXCEPTION 'Invalid customer name: minimum 2 characters required';
    END IF;

    IF p_order->>'customer_phone' IS NULL OR length(trim(p_order->>'customer_phone')) < 10 THEN
        RAISE EXCEPTION 'Invalid customer phone: minimum 10 digits required';
    END IF;

    IF p_order->>'order_type' NOT IN ('dine_in', 'takeaway') THEN
        RAISE EXCEPTION 'Invalid order_type: must be dine_in or takeaway';
    END IF;

    IF p_order->>'order_type' = 'dine_in' AND (p_order->>'table_number' IS NULL OR length(trim(p_order->>'table_number')) = 0) THEN
        RAISE EXCEPTION 'Dine-in orders require a valid table_number';
    END IF;

    -- 4. Read restaurant_id strictly from restaurant_settings (IGNORE client-supplied p_order.restaurant_id)
    SELECT rs.restaurant_id
    INTO v_restaurant_id
    FROM public.restaurant_settings rs
    LIMIT 1;

    IF v_restaurant_id IS NULL OR trim(v_restaurant_id) = '' THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- 5. Generate order reference using gen_random_uuid-based 10+ character random code (never sequential)
    v_order_ref := 'CB-' || to_char(CURRENT_DATE, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    -- Generate random payment_token built from two gen_random_uuid (dashes removed)
    v_raw_payment_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_payment_token_hash := encode(sha256(v_raw_payment_token::bytea), 'hex');

    -- 6. Determine payment_status strictly on the server
    v_payment_method := lower(trim(COALESCE(
        p_order->>'payment_method',
        p_order->>'payment_provider',
        ''
    )));

    IF v_payment_method IN ('counter', 'pay_at_counter', 'cash', 'manual') THEN
        v_payment_status := 'pay_at_counter';
        v_payment_required := false;
    ELSE
        v_payment_status := 'pending';
        v_payment_required := true;
    END IF;

    -- 7. Calculate subtotal and line items strictly server-side
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        IF v_item_id = '' THEN
            RAISE EXCEPTION 'Missing item identifier in order items';
        END IF;

        BEGIN
            v_quantity := (v_item->>'quantity')::INTEGER;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid item quantity for item "%"', v_item_id;
        END;

        -- Enforce quantity cap 1-50
        IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 50 THEN
            RAISE EXCEPTION 'Item quantity must be between 1 and 50 (got % for item "%")', COALESCE(v_quantity, 0), v_item_id;
        END IF;

        v_db_unit_price := NULL;
        v_db_item_name := NULL;
        v_is_available := NULL;

        SELECT mi.price, mi.name, mi.available
        INTO v_db_unit_price, v_db_item_name, v_is_available
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND (mi.restaurant_id = v_restaurant_id OR mi.restaurant_id IS NULL)
        LIMIT 1;

        IF v_db_unit_price IS NULL THEN
            SELECT m.price, m.name, m.available
            INTO v_db_unit_price, v_db_item_name, v_is_available
            FROM public.menu m
            WHERE m.id = v_item_id
            LIMIT 1;
        END IF;

        IF v_db_unit_price IS NULL THEN
            RAISE EXCEPTION 'Menu item not found in database: %', v_item_id;
        END IF;

        IF v_is_available = false THEN
            RAISE EXCEPTION 'Item "%" is currently marked as unavailable', v_db_item_name;
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.menu_item_availability mia
            WHERE mia.item_id = v_item_id AND mia.is_available = false
        ) THEN
            RAISE EXCEPTION 'Item "%" is currently marked 86''d out of stock', v_db_item_name;
        END IF;

        v_line_total := round((v_quantity * v_db_unit_price)::numeric, 2);
        v_computed_subtotal := v_computed_subtotal + v_line_total;
    END LOOP;

    -- 8. Read tax & currency settings
    SELECT
        COALESCE(rs.tax_enabled, true),
        COALESCE(rs.tax_mode, 'inclusive'),
        COALESCE(rs.tax_rate, 0.0500),
        COALESCE(rs.currency, 'INR')
    INTO
        v_tax_enabled,
        v_tax_mode,
        v_tax_rate,
        v_currency
    FROM public.restaurant_settings rs
    LIMIT 1;

    -- Compute tax
    IF v_tax_enabled THEN
        IF v_tax_mode = 'exclusive' THEN
            v_tax_amount := round((v_computed_subtotal * v_tax_rate)::numeric, 2);
            v_computed_total := v_computed_subtotal + v_tax_amount;
        ELSE
            v_tax_amount := round((v_computed_subtotal - (v_computed_subtotal / (1 + v_tax_rate)))::numeric, 2);
            v_computed_total := v_computed_subtotal;
        END IF;
    ELSE
        v_tax_amount := 0.00;
        v_computed_total := v_computed_subtotal;
    END IF;

    -- 9. Insert Order Header with payment_token_hash
    INSERT INTO public.orders (
        order_ref,
        restaurant_id,
        customer_name,
        customer_phone,
        order_type,
        table_number,
        special_requests,
        subtotal,
        total,
        status,
        source,
        currency,
        payment_required,
        payment_status,
        payment_provider,
        payment_reference,
        payment_token_hash,
        created_at,
        updated_at
    )
    VALUES (
        v_order_ref,
        v_restaurant_id,
        trim(p_order->>'customer_name'),
        trim(p_order->>'customer_phone'),
        p_order->>'order_type',
        CASE WHEN p_order->>'order_type' = 'dine_in' THEN trim(p_order->>'table_number') ELSE NULL END,
        trim(COALESCE(p_order->>'special_requests', '')),
        v_computed_subtotal,
        v_computed_total,
        'pending',
        COALESCE(p_order->>'source', 'website'),
        v_currency,
        v_payment_required,
        v_payment_status,
        NULLIF(p_order->>'payment_provider', ''),
        NULLIF(p_order->>'payment_reference', ''),
        v_payment_token_hash,
        v_created_at,
        v_created_at
    )
    RETURNING id INTO v_order_id;

    -- 10. Insert Line Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        v_quantity := (v_item->>'quantity')::INTEGER;

        SELECT mi.price, mi.name
        INTO v_db_unit_price, v_db_item_name
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND (mi.restaurant_id = v_restaurant_id OR mi.restaurant_id IS NULL)
        LIMIT 1;

        IF v_db_unit_price IS NULL THEN
            SELECT m.price, m.name
            INTO v_db_unit_price, v_db_item_name
            FROM public.menu m
            WHERE m.id = v_item_id
            LIMIT 1;
        END IF;

        v_line_total := round((v_quantity * v_db_unit_price)::numeric, 2);

        INSERT INTO public.order_items (
            order_id,
            restaurant_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price,
            line_total,
            selected_options,
            created_at
        )
        VALUES (
            v_order_id,
            v_restaurant_id,
            v_item_id,
            v_db_item_name,
            v_quantity,
            v_db_unit_price,
            v_line_total,
            COALESCE(v_item->'selected_options', '{}'::jsonb),
            v_created_at
        );
    END LOOP;

    -- 11. Return order details including raw payment_token ONCE to browser
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_ref', v_order_ref,
        'payment_token', v_raw_payment_token,
        'payment_status', v_payment_status,
        'payment_required', v_payment_required,
        'subtotal', v_computed_subtotal,
        'tax_amount', v_tax_amount,
        'total', v_computed_total,
        'currency', v_currency,
        'restaurant_id', v_restaurant_id
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 12. HARDENED create_reservation_atomic WITH TURNSTILE VERIFICATION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_reservation_atomic(
    p_reservation JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_res_id UUID;
    v_res_ref TEXT;
    v_restaurant_id TEXT;
    v_verified_token TEXT;
    v_consumed_token_id UUID;
    v_customer_name TEXT;
    v_customer_phone TEXT;
    v_party_size INTEGER;
    v_date DATE;
    v_time TEXT;
BEGIN
    IF p_reservation IS NULL OR jsonb_typeof(p_reservation) <> 'object' THEN
        RAISE EXCEPTION 'Reservation payload must be a valid JSON object';
    END IF;

    -- 1. Turnstile Bot Defense: Require verified single-use token
    v_verified_token := trim(COALESCE(p_reservation->>'verified_token', ''));
    IF v_verified_token = '' THEN
        RAISE EXCEPTION 'A verified Turnstile token is required to make a reservation';
    END IF;

    DELETE FROM public.verified_tokens
    WHERE token = v_verified_token
      AND action = 'reservation'
      AND expires_at > now()
    RETURNING id INTO v_consumed_token_id;

    IF v_consumed_token_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired security token. Please verify again.';
    END IF;

    -- 2. Tenant Scoping
    v_restaurant_id := trim(COALESCE(p_reservation->>'restaurant_id', 'the-cafe-barrackpore'));
    IF length(v_restaurant_id) < 2 THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- 3. Customer Name Validation
    v_customer_name := trim(COALESCE(p_reservation->>'customer_name', ''));
    IF length(v_customer_name) < 2 THEN
        RAISE EXCEPTION 'Please enter a valid full name (minimum 2 characters)';
    END IF;

    -- 4. Customer Phone Validation
    v_customer_phone := trim(COALESCE(p_reservation->>'customer_phone', ''));
    IF length(v_customer_phone) < 7 THEN
        RAISE EXCEPTION 'Please enter a valid phone number';
    END IF;

    -- 5. Reservation Reference
    v_res_ref := trim(COALESCE(p_reservation->>'reservation_ref', ''));
    IF v_res_ref = '' THEN
        v_res_ref := 'RES-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
    END IF;

    -- 6. Date Validation
    IF p_reservation->>'reservation_date' IS NULL OR trim(p_reservation->>'reservation_date') = '' THEN
        RAISE EXCEPTION 'Please select a reservation date';
    END IF;

    BEGIN
        v_date := (p_reservation->>'reservation_date')::DATE;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid reservation date format';
    END;

    -- 7. Time Validation
    v_time := trim(COALESCE(p_reservation->>'reservation_time', ''));
    IF length(v_time) = 0 THEN
        RAISE EXCEPTION 'Please select a reservation time';
    END IF;

    -- 8. Party Size Validation (1 to 20 guests)
    BEGIN
        v_party_size := (p_reservation->>'party_size')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid party size';
    END;

    IF v_party_size IS NULL OR v_party_size < 1 OR v_party_size > 20 THEN
        RAISE EXCEPTION 'Party size must be between 1 and 20 guests';
    END IF;

    -- 9. Insert reservation record
    INSERT INTO public.reservations (
        reservation_ref,
        restaurant_id,
        customer_name,
        customer_phone,
        reservation_date,
        reservation_time,
        party_size,
        special_requests,
        status,
        source,
        created_at,
        updated_at
    )
    VALUES (
        v_res_ref,
        v_restaurant_id,
        v_customer_name,
        v_customer_phone,
        v_date,
        v_time,
        v_party_size,
        NULLIF(trim(p_reservation->>'special_requests'), ''),
        COALESCE(p_reservation->>'status', 'pending'),
        COALESCE(p_reservation->>'source', 'website'),
        now(),
        now()
    )
    RETURNING id INTO v_res_id;

    RETURN jsonb_build_object(
        'success', true,
        'reservation_id', v_res_id,
        'reservation_ref', v_res_ref,
        'restaurant_id', v_restaurant_id
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 13. EXECUTE PRIVILEGES ON FUNCTIONS
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_order_atomic(JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_reservation_atomic(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_order_status_by_token(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_discount_code(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_reservation_atomic(JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_order_status_by_token(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_discount_code(TEXT) TO anon, authenticated, service_role;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 017_indexing_and_audit_log.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 017_indexing_and_audit_log.sql
-- Description:
-- 1. Ensure prerequisite schema columns exist on menu_items, restaurant_settings, and orders.
-- 2. Create audit_log table with granular multi-tenant RLS for dashboard security & audit tracking.
-- 3. Foreign Key Indexes:
--    - idx_order_items_menu_item_id on order_items(menu_item_id)
--    - idx_discount_codes_created_by on discount_codes(created_by)
--    - idx_happy_hour_category_id on happy_hour_schedules(category_id)
-- 4. High-Performance Composite & Partial Query Indexes:
--    - idx_orders_kds_active_queue: (restaurant_id, created_at ASC) WHERE status IN ('confirmed', 'preparing', 'ready')
--    - idx_orders_restaurant_created_at: (restaurant_id, created_at DESC)
--    - idx_reservations_tenant_date_time: (restaurant_id, reservation_date, reservation_time ASC)
--    - idx_reservations_tenant_status_date: (restaurant_id, status, reservation_date)
--    - idx_restaurant_tables_tenant_active: (restaurant_id, active, table_number ASC)
--    - idx_menu_items_tenant_avail_sort: (restaurant_id, available, sort_order ASC)
--    - idx_menu_items_stock_alerts: (restaurant_id, stock_count ASC) WHERE stock_count IS NOT NULL
--    - idx_menu_categories_tenant_sort: (restaurant_id, sort_order ASC)
--    - idx_happy_hour_active_day_time: (active, day_of_week, start_time)
--    - idx_payments_tenant_created_at: (restaurant_id, created_at DESC)
--    - idx_customers_marketing_consent: (marketing_consent, last_order_at DESC) WHERE marketing_consent = true
--    - idx_audit_log_tenant_created: (restaurant_id, created_at DESC)
--    - idx_audit_log_action: (action)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. PREREQUISITE COLUMN GUARDS (Ensure schema columns exist before indexing)
-- ------------------------------------------------------------------------------
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS stock_count INTEGER;

ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS google_review_link TEXT;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS owner_notification_phone TEXT;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS owner_notification_email TEXT;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS owner_notification_method TEXT DEFAULT 'none';
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS low_stock_alert_threshold INTEGER DEFAULT 5;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;

-- ------------------------------------------------------------------------------
-- 1. AUDIT LOG TABLE & SECURITY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    actor_id TEXT NULL,
    actor_role TEXT NULL,
    actor_name TEXT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.audit_log FROM anon, public;
GRANT SELECT, INSERT ON TABLE public.audit_log TO authenticated;
GRANT ALL ON TABLE public.audit_log TO service_role;

DROP POLICY IF EXISTS "staff_view_audit_log" ON public.audit_log;
CREATE POLICY "staff_view_audit_log"
ON public.audit_log
FOR SELECT
TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

DROP POLICY IF EXISTS "staff_insert_audit_log" ON public.audit_log;
CREATE POLICY "staff_insert_audit_log"
ON public.audit_log
FOR INSERT
TO authenticated, service_role
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_active_staff(auth.uid())
    )
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created ON public.audit_log (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log (action);

-- ------------------------------------------------------------------------------
-- 2. FOREIGN KEY INDEXES
-- ------------------------------------------------------------------------------

-- Order items referencing menu items (speed up reporting and joins)
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON public.order_items (menu_item_id);

-- Discount codes referencing creator auth user
CREATE INDEX IF NOT EXISTS idx_discount_codes_created_by ON public.discount_codes (created_by);

-- Happy hour schedules category reference
CREATE INDEX IF NOT EXISTS idx_happy_hour_category_id ON public.happy_hour_schedules (category_id);

-- ------------------------------------------------------------------------------
-- 3. HIGH-FREQUENCY QUERY & COMPOSITE PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------

-- Orders: Real-time Kitchen Display System (KDS) Active Queue
-- Partial composite index covering only open/in-progress kitchen orders
CREATE INDEX IF NOT EXISTS idx_orders_kds_active_queue 
ON public.orders (restaurant_id, created_at ASC) 
WHERE status IN ('confirmed', 'preparing', 'ready');

-- Orders: Multi-tenant date-range & dashboard queries
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created_at 
ON public.orders (restaurant_id, created_at DESC);

-- Reservations: Multi-tenant date & time schedule lookups
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_date_time 
ON public.reservations (restaurant_id, reservation_date, reservation_time ASC);

-- Reservations: Status by date lookups
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_status_date 
ON public.reservations (restaurant_id, status, reservation_date);

-- Restaurant Tables: Multi-tenant active tables lookup
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_tenant_active 
ON public.restaurant_tables (restaurant_id, active, table_number ASC);

-- Menu Items: Public storefront active menu query with ordering
CREATE INDEX IF NOT EXISTS idx_menu_items_tenant_avail_sort 
ON public.menu_items (restaurant_id, available, sort_order ASC);

-- Menu Items: Low-stock monitoring query
CREATE INDEX IF NOT EXISTS idx_menu_items_stock_alerts 
ON public.menu_items (restaurant_id, stock_count ASC) 
WHERE stock_count IS NOT NULL;

-- Menu Categories: Multi-tenant sort order
CREATE INDEX IF NOT EXISTS idx_menu_categories_tenant_sort 
ON public.menu_categories (restaurant_id, sort_order ASC);

-- Happy Hour Schedules: Active schedule lookup by day and time
CREATE INDEX IF NOT EXISTS idx_happy_hour_active_day_time 
ON public.happy_hour_schedules (active, day_of_week, start_time);

-- Payments: Multi-tenant payment reconciliation list
CREATE INDEX IF NOT EXISTS idx_payments_tenant_created_at 
ON public.payments (restaurant_id, created_at DESC);

-- Customers: Target marketing consent list
CREATE INDEX IF NOT EXISTS idx_customers_marketing_consent 
ON public.customers (marketing_consent, last_order_at DESC) 
WHERE marketing_consent = true;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 018_contact_inquiries.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 018_contact_inquiries.sql
-- Description:
-- 1. Contact inquiries schema & multi-tenant RLS (guests can INSERT, staff can SELECT/UPDATE).
-- 2. Turnstile-verified atomic RPC: submit_contact_inquiry(JSONB, TEXT).
-- 3. Guest inquiry lookup RPC: get_contact_inquiry_status(TEXT).
-- 4. Single-use token helper for test suites: create_verified_token_for_test(TEXT, TEXT).
-- 5. Payments hardening: Drop "Allow public payment creation" policy, REVOKE INSERT, UPDATE, DELETE
--    on payments from authenticated and anon.
-- 6. Function hardening: Add SET search_path = public, pg_temp to guard_order_payment_status_paid.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CONTACT INQUIRIES TABLE & RLS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_ref TEXT UNIQUE NOT NULL,
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NULL,
    subject TEXT NOT NULL DEFAULT 'general',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unread',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_contact_name CHECK (length(trim(name)) >= 2),
    CONSTRAINT chk_contact_phone CHECK (length(trim(phone)) >= 7),
    CONSTRAINT chk_contact_message CHECK (length(trim(message)) >= 10),
    CONSTRAINT chk_contact_subject CHECK (subject IN ('general', 'event', 'catering', 'feedback')),
    CONSTRAINT chk_contact_status CHECK (status IN ('unread', 'in_progress', 'resolved', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_ref ON public.contact_inquiries (inquiry_ref);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_tenant_created ON public.contact_inquiries (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status ON public.contact_inquiries (restaurant_id, status);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_contact_inquiries_updated_at ON public.contact_inquiries;
CREATE TRIGGER trg_contact_inquiries_updated_at
    BEFORE UPDATE ON public.contact_inquiries
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

-- Revoke unauthorized mutations from public and anon
REVOKE ALL ON TABLE public.contact_inquiries FROM anon, public;

-- Allow guests (anon) and customers (authenticated) to INSERT contact inquiries
GRANT INSERT ON TABLE public.contact_inquiries TO anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.contact_inquiries TO authenticated;
GRANT ALL ON TABLE public.contact_inquiries TO service_role;

-- Policy: Guests can submit inquiry with valid length constraints
DROP POLICY IF EXISTS "guest_insert_contact_inquiries" ON public.contact_inquiries;
CREATE POLICY "guest_insert_contact_inquiries"
ON public.contact_inquiries
FOR INSERT
TO anon, authenticated
WITH CHECK (
    length(trim(name)) >= 2
    AND length(trim(phone)) >= 7
    AND length(trim(message)) >= 10
    AND subject IN ('general', 'event', 'catering', 'feedback')
);

-- Policies for staff owners & managers to view inquiries
DROP POLICY IF EXISTS "staff_view_contact_inquiries" ON public.contact_inquiries;
CREATE POLICY "staff_view_contact_inquiries"
ON public.contact_inquiries
FOR SELECT
TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

-- Policies for staff owners & managers to update status (e.g. mark resolved)
DROP POLICY IF EXISTS "staff_update_contact_inquiries" ON public.contact_inquiries;
CREATE POLICY "staff_update_contact_inquiries"
ON public.contact_inquiries
FOR UPDATE
TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
)
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid()
              AND sp.active = true
              AND sp.role IN ('owner', 'manager')
        )
    )
);

-- ------------------------------------------------------------------------------
-- 2. GUEST STATUS LOOKUP RPC (CONFIRM MESSAGE WAS RECORDED BY INQUIRY_REF)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_contact_inquiry_status(p_inquiry_ref TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inq RECORD;
BEGIN
    IF p_inquiry_ref IS NULL OR trim(p_inquiry_ref) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing inquiry reference');
    END IF;

    SELECT id, inquiry_ref, name, subject, message, created_at, status
    INTO v_inq
    FROM public.contact_inquiries
    WHERE inquiry_ref = trim(p_inquiry_ref)
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Inquiry not found');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'inquiry_ref', v_inq.inquiry_ref,
        'name', v_inq.name,
        'subject', v_inq.subject,
        'message', v_inq.message,
        'created_at', v_inq.created_at,
        'status', v_inq.status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_contact_inquiry_status(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. TURNSTILE-VERIFIED ATOMIC INQUIRY SUBMISSION RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_contact_inquiry(
    payload JSONB,
    verified_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inquiry JSONB;
    v_inquiry_id UUID;
    v_inquiry_ref TEXT;
    v_restaurant_id TEXT;
    v_verified_token TEXT;
    v_consumed_token_id UUID;
    v_name TEXT;
    v_phone TEXT;
    v_email TEXT;
    v_subject TEXT;
    v_message TEXT;
BEGIN
    v_inquiry := payload;
    IF v_inquiry IS NULL OR jsonb_typeof(v_inquiry) <> 'object' THEN
        RAISE EXCEPTION 'Inquiry payload must be a valid JSON object';
    END IF;

    -- 1. Turnstile Bot Defense: Require verified single-use token if provided or enforced
    v_verified_token := trim(COALESCE(v_inquiry->>'verified_token', verified_token, ''));
    IF v_verified_token <> '' THEN
        DELETE FROM public.verified_tokens
        WHERE token = v_verified_token
          AND action IN ('contact', 'inquiry')
          AND expires_at > now()
        RETURNING id INTO v_consumed_token_id;
    END IF;

    -- 2. Tenant Scoping
    v_restaurant_id := trim(COALESCE(v_inquiry->>'restaurant_id', 'the-cafe-barrackpore'));
    IF length(v_restaurant_id) < 2 THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- 3. Customer Name Validation
    v_name := trim(COALESCE(v_inquiry->>'name', ''));
    IF length(v_name) < 2 THEN
        RAISE EXCEPTION 'Please enter your name (minimum 2 characters)';
    END IF;

    -- 4. Customer Phone Validation
    v_phone := trim(COALESCE(v_inquiry->>'phone', ''));
    IF length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7 THEN
        RAISE EXCEPTION 'Please enter a valid phone number (minimum 7 digits)';
    END IF;

    -- 5. Email (Optional)
    v_email := trim(COALESCE(v_inquiry->>'email', ''));
    IF v_email = '' THEN
        v_email := NULL;
    END IF;

    -- 6. Subject Validation
    v_subject := lower(trim(COALESCE(v_inquiry->>'subject', 'general')));
    IF v_subject NOT IN ('general', 'event', 'catering', 'feedback') THEN
        v_subject := 'general';
    END IF;

    -- 7. Message Validation
    v_message := trim(COALESCE(v_inquiry->>'message', ''));
    IF length(v_message) < 10 THEN
        RAISE EXCEPTION 'Please write a message with at least 10 characters';
    END IF;

    -- 8. Inquiry Reference Number
    v_inquiry_ref := trim(COALESCE(v_inquiry->>'inquiry_ref', ''));
    IF v_inquiry_ref = '' THEN
        v_inquiry_ref := 'INQ-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
    END IF;

    -- 9. Insert Record
    INSERT INTO public.contact_inquiries (
        inquiry_ref,
        restaurant_id,
        name,
        phone,
        email,
        subject,
        message,
        status,
        created_at,
        updated_at
    ) VALUES (
        v_inquiry_ref,
        v_restaurant_id,
        v_name,
        v_phone,
        v_email,
        v_subject,
        v_message,
        'unread',
        now(),
        now()
    )
    RETURNING id INTO v_inquiry_id;

    RETURN jsonb_build_object(
        'success', true,
        'inquiry_id', v_inquiry_id,
        'inquiry_ref', v_inquiry_ref
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_contact_inquiry(JSONB, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. SINGLE-USE VERIFIED TOKEN SEEDER (FOR INTEGRATION TESTS & TEST SUITES)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_verified_token_for_test(
    p_token TEXT,
    p_action TEXT DEFAULT 'order'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.verified_tokens (token, action, expires_at)
    VALUES (trim(p_token), trim(p_action), now() + interval '15 minutes')
    ON CONFLICT (token) DO UPDATE SET expires_at = now() + interval '15 minutes';
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_verified_token_for_test(TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. PAYMENTS HARDENING: LOCK DOWN DIRECT MUTATIONS & DROP PUBLIC POLICY
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public payment creation" ON public.payments;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.payments FROM authenticated, anon, public;

GRANT SELECT ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.payments TO service_role;

-- ------------------------------------------------------------------------------
-- 6. GUARD FUNCTION HARDENING: ADD search_path TO guard_order_payment_status_paid
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_order_payment_status_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.payment_status = 'paid' AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
        IF current_user NOT IN ('postgres', 'supabase_admin')
           AND COALESCE(auth.role(), '') <> 'service_role'
           AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
            RAISE EXCEPTION 'Unauthorized: Only verified webhook service role may mark an order as paid (current_role: %, auth.role: %)',
                current_user, COALESCE(auth.role(), 'none');
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 019_contact_inquiries_hardening.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 019_contact_inquiries_hardening.sql
-- Description:
-- 1. Security hardening: DROP FUNCTION public.create_verified_token_for_test(TEXT, TEXT).
-- 2. contact_inquiries lockdown: DROP POLICY "guest_insert_contact_inquiries",
--    REVOKE INSERT, UPDATE, DELETE on contact_inquiries from anon and authenticated.
--    Only the SECURITY DEFINER submit_contact_inquiry RPC may insert.
-- 3. submit_contact_inquiry hardening:
--    - Always require a valid single-use token with action 'contact' (raise exception otherwise).
--    - Ignore client restaurant_id and read strictly from restaurant_settings.
--    - Ignore any client-supplied inquiry_ref and generate server-side with 16+ random characters.
-- 4. Inquiry refs: generate with 16+ random characters.
-- 5. get_contact_inquiry_status hardening:
--    - Drop legacy 1-arg signature.
--    - Require matching customer phone number.
--    - Return only status, never the customer message.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DROP TEST TOKEN SEEDER FUNCTION (SECURITY HARDENING)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_verified_token_for_test(TEXT, TEXT);

-- ------------------------------------------------------------------------------
-- 2. LOCK DOWN contact_inquiries TABLE DIRECT MUTATIONS
-- ------------------------------------------------------------------------------
-- Drop guest insert policy so no client can directly INSERT
DROP POLICY IF EXISTS "guest_insert_contact_inquiries" ON public.contact_inquiries;

-- Revoke direct mutations from anon and authenticated (and public)
REVOKE INSERT, UPDATE, DELETE ON TABLE public.contact_inquiries FROM anon, authenticated, public;

-- Ensure service_role has full table access for internal RPCs and admin
GRANT ALL ON TABLE public.contact_inquiries TO service_role;

-- ------------------------------------------------------------------------------
-- 3. HARDENED submit_contact_inquiry RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_contact_inquiry(
    payload JSONB,
    verified_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inquiry JSONB;
    v_inquiry_id UUID;
    v_inquiry_ref TEXT;
    v_restaurant_id TEXT;
    v_verified_token TEXT;
    v_consumed_token_id UUID;
    v_name TEXT;
    v_phone TEXT;
    v_email TEXT;
    v_subject TEXT;
    v_message TEXT;
BEGIN
    v_inquiry := payload;
    IF v_inquiry IS NULL OR jsonb_typeof(v_inquiry) <> 'object' THEN
        RAISE EXCEPTION 'Inquiry payload must be a valid JSON object';
    END IF;

    -- 1. Bot Defense: Strictly require valid single-use token with action 'contact'
    v_verified_token := trim(COALESCE(v_inquiry->>'verified_token', verified_token, ''));
    IF v_verified_token = '' THEN
        RAISE EXCEPTION 'Valid single-use verified token is required for contact inquiry';
    END IF;

    DELETE FROM public.verified_tokens
    WHERE token = v_verified_token
      AND action = 'contact'
      AND expires_at > now()
    RETURNING id INTO v_consumed_token_id;

    IF v_consumed_token_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired verified token for contact inquiry';
    END IF;

    -- 2. Tenant Scoping: Strictly read restaurant_id from restaurant_settings (ignore client restaurant_id)
    SELECT rs.restaurant_id
    INTO v_restaurant_id
    FROM public.restaurant_settings rs
    LIMIT 1;

    IF v_restaurant_id IS NULL OR trim(v_restaurant_id) = '' THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- 3. Customer Name Validation
    v_name := trim(COALESCE(v_inquiry->>'name', ''));
    IF length(v_name) < 2 THEN
        RAISE EXCEPTION 'Please enter your name (minimum 2 characters)';
    END IF;

    -- 4. Customer Phone Validation
    v_phone := trim(COALESCE(v_inquiry->>'phone', ''));
    IF length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7 THEN
        RAISE EXCEPTION 'Please enter a valid phone number (minimum 7 digits)';
    END IF;

    -- 5. Email (Optional)
    v_email := trim(COALESCE(v_inquiry->>'email', ''));
    IF v_email = '' THEN
        v_email := NULL;
    END IF;

    -- 6. Subject Validation
    v_subject := lower(trim(COALESCE(v_inquiry->>'subject', 'general')));
    IF v_subject NOT IN ('general', 'event', 'catering', 'feedback') THEN
        v_subject := 'general';
    END IF;

    -- 7. Message Validation
    v_message := trim(COALESCE(v_inquiry->>'message', ''));
    IF length(v_message) < 10 THEN
        RAISE EXCEPTION 'Please write a message with at least 10 characters';
    END IF;

    -- 8. Inquiry Reference Number: Ignore any client-supplied inquiry_ref; generate 16+ random characters
    v_inquiry_ref := 'INQ-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 16));

    -- 9. Insert Record
    INSERT INTO public.contact_inquiries (
        inquiry_ref,
        restaurant_id,
        name,
        phone,
        email,
        subject,
        message,
        status,
        created_at,
        updated_at
    ) VALUES (
        v_inquiry_ref,
        v_restaurant_id,
        v_name,
        v_phone,
        v_email,
        v_subject,
        v_message,
        'unread',
        now(),
        now()
    )
    RETURNING id INTO v_inquiry_id;

    RETURN jsonb_build_object(
        'success', true,
        'inquiry_id', v_inquiry_id,
        'inquiry_ref', v_inquiry_ref
    );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_contact_inquiry(JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_contact_inquiry(JSONB, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. HARDENED get_contact_inquiry_status RPC
-- ------------------------------------------------------------------------------
-- Drop old single-argument signature
DROP FUNCTION IF EXISTS public.get_contact_inquiry_status(TEXT);

-- Require matching phone number and return ONLY status, never the message
CREATE OR REPLACE FUNCTION public.get_contact_inquiry_status(
    p_inquiry_ref TEXT,
    p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_status TEXT;
    v_clean_phone TEXT;
BEGIN
    IF p_inquiry_ref IS NULL OR trim(p_inquiry_ref) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing inquiry reference');
    END IF;

    IF p_phone IS NULL OR trim(p_phone) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing phone number');
    END IF;

    v_clean_phone := regexp_replace(trim(p_phone), '[^0-9]', '', 'g');

    SELECT status
    INTO v_status
    FROM public.contact_inquiries
    WHERE inquiry_ref = trim(p_inquiry_ref)
      AND (
          phone = trim(p_phone)
          OR regexp_replace(phone, '[^0-9]', '', 'g') = v_clean_phone
      )
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Inquiry not found');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'status', v_status
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_contact_inquiry_status(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contact_inquiry_status(TEXT, TEXT) TO anon, authenticated, service_role;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 020_payment_ledger_and_order_status.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 020_payment_ledger_and_order_status.sql
-- Description: Ensure unique index on payments(order_ref) and expose guest receipt
--              metadata in get_order_status_by_token
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- 1. Ensure unique index on public.payments(order_ref)
-- Deduplicate any legacy pending records if any exist prior to unique constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
          AND tablename = 'payments' 
          AND indexname = 'idx_payments_order_ref_unique'
    ) THEN
        -- Keep most recently updated payment record if duplicates exist
        DELETE FROM public.payments p1
        USING public.payments p2
        WHERE p1.order_ref = p2.order_ref
          AND p1.updated_at < p2.updated_at;

        CREATE UNIQUE INDEX idx_payments_order_ref_unique 
        ON public.payments (order_ref);
    END IF;
END $$;

-- 2. Update get_order_status_by_token to expose receipt fields
-- Allows order-success page to display dining mode (dine_in vs takeaway),
-- assigned table number, and customer name for verified token holders.
CREATE OR REPLACE FUNCTION public.get_order_status_by_token(
    p_order_ref TEXT,
    p_payment_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_token_hash TEXT;
BEGIN
    IF p_order_ref IS NULL OR p_payment_token IS NULL OR trim(p_payment_token) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing order reference or payment token');
    END IF;

    v_token_hash := encode(sha256(trim(p_payment_token)::bytea), 'hex');

    SELECT id, order_ref, status, payment_status, total, payment_amount, currency, created_at,
           order_type, table_number, customer_name
    INTO v_order
    FROM public.orders
    WHERE order_ref = trim(p_order_ref)
      AND payment_token_hash = v_token_hash
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid order reference or payment token');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_ref', v_order.order_ref,
        'status', v_order.status,
        'payment_status', v_order.payment_status,
        'total', v_order.total,
        'payment_amount', v_order.payment_amount,
        'currency', v_order.currency,
        'created_at', v_order.created_at,
        'order_type', v_order.order_type,
        'table_number', v_order.table_number,
        'customer_name', v_order.customer_name
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_status_by_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_status_by_token(TEXT, TEXT) TO anon, authenticated, service_role;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 021_pos_billing_shifts_and_drawer.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 021_pos_billing_shifts_and_drawer.sql
-- Description:
-- 1. Staff RBAC: Expand staff roles to ('owner', 'manager', 'cashier', 'waiter', 'staff')
--    and establish role-checking helper functions.
-- 2. Restaurant Settings: Manager PIN and manager void limit in minor units.
-- 3. Cash Drawer Shifts & Transactions: Cash drawer shifts, cash-in, cash-out, drawer open audit.
-- 4. POS Running Bills, KOT Batches & Bill Items: Multi-tenant tables in integer minor units.
-- 5. Bill Splitting & Multi-Tender Settlement: Equal, item, and custom splits with minor units.
-- 6. RLS: Strict multi-tenant and role-based policies (owner, manager, cashier, waiter).
-- 7. Audit Log: Automated logging on EVERY void, discount, refund, and drawer open.
-- 8. Server-Authoritative RPCs (SECURITY DEFINER): Server computes all totals, taxes,
--    discounts, and split remainder distribution in integer minor units.
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. STAFF ROLES EXTENSION (owner, manager, cashier, waiter, staff)
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
        CHECK (role IN ('owner', 'manager', 'cashier', 'waiter', 'staff'));
END $$;

-- Role verification helper functions
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

CREATE OR REPLACE FUNCTION public.is_manager_or_above(p_uid UUID DEFAULT auth.uid())
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

CREATE OR REPLACE FUNCTION public.is_cashier_or_above(p_uid UUID DEFAULT auth.uid())
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

CREATE OR REPLACE FUNCTION public.is_waiter_or_above(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE user_id = p_uid AND active = true AND role IN ('owner', 'manager', 'cashier', 'waiter', 'staff')
    );
$$;

REVOKE ALL ON FUNCTION public.get_staff_role(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_role(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_manager_or_above(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_manager_or_above(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_cashier_or_above(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_cashier_or_above(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_waiter_or_above(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_waiter_or_above(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. RESTAURANT SETTINGS EXTENSION: Manager PIN & Void Limit (Minor Units)
-- ------------------------------------------------------------------------------
ALTER TABLE public.restaurant_settings 
    ADD COLUMN IF NOT EXISTS manager_pin TEXT DEFAULT '1234',
    ADD COLUMN IF NOT EXISTS manager_void_limit_minor INTEGER DEFAULT 0;

-- ------------------------------------------------------------------------------
-- 3. CASH DRAWER SHIFTS TABLE (Integer Minor Units)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    shift_number SERIAL,
    opened_by_id TEXT NOT NULL,
    opened_by_name TEXT NOT NULL,
    opening_float_minor INTEGER NOT NULL DEFAULT 0 CHECK (opening_float_minor >= 0),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    closed_by_id TEXT NULL,
    closed_by_name TEXT NULL,
    closed_at TIMESTAMPTZ NULL,
    counted_cash_minor INTEGER NULL,
    expected_cash_minor INTEGER NULL,
    difference_minor INTEGER NULL,
    z_report_summary JSONB NULL,
    closing_notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_shifts_tenant_status ON public.cash_shifts (restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_opened_at ON public.cash_shifts (opened_at DESC);

-- ------------------------------------------------------------------------------
-- 4. CASH DRAWER TRANSACTIONS TABLE (Integer Minor Units)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_drawer_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    shift_id UUID NOT NULL REFERENCES public.cash_shifts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('cash_in', 'cash_out', 'sale', 'refund', 'drawer_open')),
    amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
    reason TEXT NOT NULL,
    bill_number TEXT NULL,
    order_ref TEXT NULL,
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL DEFAULT 'cashier',
    idempotency_key TEXT UNIQUE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_transactions_shift ON public.cash_drawer_transactions (shift_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_transactions_tenant ON public.cash_drawer_transactions (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_transactions_idempotency ON public.cash_drawer_transactions (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 5. POS RUNNING BILLS TABLE (Integer Minor Units)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    bill_number TEXT UNIQUE NOT NULL,
    order_type TEXT NOT NULL DEFAULT 'dine_in' CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),
    table_number TEXT NULL,
    customer_name TEXT NULL,
    customer_phone TEXT NULL,
    delivery_address TEXT NULL,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'printed', 'paid', 'voided', 'transferred', 'merged')),
    subtotal_minor INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
    discount_type TEXT NULL CHECK (discount_type IN ('percentage', 'flat', 'manual')),
    discount_code TEXT NULL,
    discount_value_minor INTEGER NOT NULL DEFAULT 0,
    discount_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount_minor >= 0),
    discount_approved_by TEXT NULL,
    tax_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_amount_minor >= 0),
    tax_details JSONB NOT NULL DEFAULT '[]'::jsonb,
    service_charge_minor INTEGER NOT NULL DEFAULT 0 CHECK (service_charge_minor >= 0),
    grand_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (grand_total_minor >= 0),
    tips_minor INTEGER NOT NULL DEFAULT 0 CHECK (tips_minor >= 0),
    payment_method TEXT NULL CHECK (payment_method IN ('cash', 'card', 'upi', 'counter', 'split', 'online')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'processing', 'paid', 'refunded', 'voided')),
    is_split BOOLEAN NOT NULL DEFAULT false,
    split_type TEXT NULL CHECK (split_type IN ('equal', 'item', 'custom')),
    split_count INTEGER NOT NULL DEFAULT 1,
    notes TEXT NULL,
    shift_id UUID NULL REFERENCES public.cash_shifts(id) ON DELETE SET NULL,
    printed_at TIMESTAMPTZ NULL,
    paid_at TIMESTAMPTZ NULL,
    created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bills_restaurant_status ON public.bills (restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_bills_table_number ON public.bills (table_number) WHERE status IN ('running', 'printed');
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON public.bills (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bills_shift_id ON public.bills (shift_id) WHERE shift_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 6. KOT BATCHES TABLE (Kitchen Order Tickets)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kot_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    kot_number TEXT NOT NULL,
    batch_index INTEGER NOT NULL DEFAULT 1,
    order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'preparing', 'ready', 'served', 'cancelled')),
    special_instructions TEXT NULL,
    created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kot_batches_bill_id ON public.kot_batches (bill_id, batch_index);
CREATE INDEX IF NOT EXISTS idx_kot_batches_restaurant ON public.kot_batches (restaurant_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 7. BILL ITEMS TABLE (Integer Minor Units)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    kot_batch_id UUID NULL REFERENCES public.kot_batches(id) ON DELETE SET NULL,
    menu_item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price_minor INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_minor >= 0),
    line_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (line_total_minor >= 0),
    tax_category TEXT DEFAULT 'food',
    modifiers JSONB NULL DEFAULT '[]'::jsonb,
    notes TEXT NULL,
    is_voided BOOLEAN NOT NULL DEFAULT false,
    void_reason TEXT NULL,
    void_approved_by TEXT NULL,
    voided_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON public.bill_items (bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_kot_batch_id ON public.bill_items (kot_batch_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_restaurant ON public.bill_items (restaurant_id);

-- ------------------------------------------------------------------------------
-- 8. BILL SPLITS TABLE (Integer Minor Units)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bill_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    bill_number TEXT NOT NULL,
    order_ref TEXT NULL,
    split_type TEXT NOT NULL CHECK (split_type IN ('equal', 'item', 'custom')),
    part_number INTEGER NOT NULL,
    total_parts INTEGER NOT NULL,
    payer_label TEXT NULL,
    items JSONB DEFAULT '[]'::jsonb,
    subtotal_minor INTEGER NOT NULL DEFAULT 0,
    tax_amount_minor INTEGER NOT NULL DEFAULT 0,
    tip_amount_minor INTEGER NOT NULL DEFAULT 0,
    amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
    total_paid_minor INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'refunded', 'cancelled')),
    tender_type TEXT NULL CHECK (tender_type IN ('cash', 'card', 'upi', 'stripe', 'other', 'counter', 'demo')),
    payment_reference TEXT NULL,
    change_due_minor INTEGER NOT NULL DEFAULT 0,
    tendered_amount_minor INTEGER NOT NULL DEFAULT 0,
    paid_at TIMESTAMPTZ NULL,
    idempotency_key TEXT UNIQUE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_splits_bill_number ON public.bill_splits (bill_number);
CREATE INDEX IF NOT EXISTS idx_bill_splits_bill_id ON public.bill_splits (bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_splits_restaurant ON public.bill_splits (restaurant_id, status);

-- ------------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) BY ROLE (owner, manager, cashier, waiter)
-- ------------------------------------------------------------------------------
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kot_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_drawer_transactions ENABLE ROW LEVEL SECURITY;

-- 9.1 BILLS RLS
DROP POLICY IF EXISTS "staff_select_bills" ON public.bills;
CREATE POLICY "staff_select_bills" ON public.bills
FOR SELECT TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_waiter_or_above(auth.uid())
    )
);

DROP POLICY IF EXISTS "staff_modify_bills" ON public.bills;
CREATE POLICY "staff_modify_bills" ON public.bills
FOR ALL TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_waiter_or_above(auth.uid())
    )
)
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_waiter_or_above(auth.uid())
    )
);

-- 9.2 KOT BATCHES RLS
DROP POLICY IF EXISTS "staff_access_kot_batches" ON public.kot_batches;
CREATE POLICY "staff_access_kot_batches" ON public.kot_batches
FOR ALL TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_waiter_or_above(auth.uid())
    )
)
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_waiter_or_above(auth.uid())
    )
);

-- 9.3 BILL ITEMS RLS
DROP POLICY IF EXISTS "staff_access_bill_items" ON public.bill_items;
CREATE POLICY "staff_access_bill_items" ON public.bill_items
FOR ALL TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_waiter_or_above(auth.uid())
    )
)
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_waiter_or_above(auth.uid())
    )
);

-- 9.4 BILL SPLITS RLS
DROP POLICY IF EXISTS "staff_access_bill_splits" ON public.bill_splits;
CREATE POLICY "staff_access_bill_splits" ON public.bill_splits
FOR ALL TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_cashier_or_above(auth.uid())
    )
)
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_cashier_or_above(auth.uid())
    )
);

-- 9.5 CASH SHIFTS RLS (Cashier, Manager, Owner)
DROP POLICY IF EXISTS "staff_select_cash_shifts" ON public.cash_shifts;
CREATE POLICY "staff_select_cash_shifts" ON public.cash_shifts
FOR SELECT TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_cashier_or_above(auth.uid())
    )
);

DROP POLICY IF EXISTS "staff_modify_cash_shifts" ON public.cash_shifts;
CREATE POLICY "staff_modify_cash_shifts" ON public.cash_shifts
FOR ALL TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_cashier_or_above(auth.uid())
    )
)
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_cashier_or_above(auth.uid())
    )
);

-- 9.6 CASH DRAWER TRANSACTIONS RLS
DROP POLICY IF EXISTS "staff_select_cash_drawer_tx" ON public.cash_drawer_transactions;
CREATE POLICY "staff_select_cash_drawer_tx" ON public.cash_drawer_transactions
FOR SELECT TO authenticated, service_role
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_cashier_or_above(auth.uid())
    )
);

DROP POLICY IF EXISTS "staff_insert_cash_drawer_tx" ON public.cash_drawer_transactions;
CREATE POLICY "staff_insert_cash_drawer_tx" ON public.cash_drawer_transactions
FOR INSERT TO authenticated, service_role
WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
        restaurant_id = public.get_auth_restaurant_id()
        AND public.is_cashier_or_above(auth.uid())
    )
);

-- ------------------------------------------------------------------------------
-- 10. SERVER-AUTHORITATIVE POS & FINANCIAL RPC FUNCTIONS (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

-- Helper: Verify Manager PIN securely
CREATE OR REPLACE FUNCTION public.pos_verify_manager_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_correct_pin TEXT;
BEGIN
    SELECT COALESCE(manager_pin, '1234') INTO v_correct_pin
    FROM public.restaurant_settings
    ORDER BY (id = 'current') DESC
    LIMIT 1;

    RETURN (trim(p_pin) = trim(v_correct_pin));
END;
$$;

-- 10.1 POS CREATE OR APPEND KOT (Calculates all money in minor units strictly server-side)
CREATE OR REPLACE FUNCTION public.pos_create_or_append_kot(
    p_bill_number TEXT,
    p_order_type TEXT,
    p_table_number TEXT,
    p_items JSONB,
    p_customer_name TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL,
    p_special_instructions TEXT DEFAULT NULL,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill_id UUID;
    v_kot_batch_id UUID;
    v_kot_number TEXT;
    v_batch_index INTEGER := 1;
    v_item JSONB;
    v_menu_id TEXT;
    v_quantity INTEGER;
    v_db_price NUMERIC(10,2);
    v_db_name TEXT;
    v_unit_minor INTEGER;
    v_mod_minor INTEGER := 0;
    v_mod JSONB;
    v_line_minor INTEGER;
    v_subtotal_minor INTEGER := 0;
    v_tax_minor INTEGER := 0;
    v_grand_total_minor INTEGER := 0;
    v_tax_rate NUMERIC := 0.0500;
    v_restaurant_id TEXT := 'the-cafe-barrackpore';
    v_existing_bill RECORD;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'KOT must contain at least one item');
    END IF;

    -- Look for existing running bill with this bill_number or for this table
    IF p_bill_number IS NOT NULL AND trim(p_bill_number) <> '' THEN
        SELECT * INTO v_existing_bill FROM public.bills WHERE bill_number = trim(p_bill_number) LIMIT 1;
    ELSIF p_table_number IS NOT NULL AND trim(p_table_number) <> '' THEN
        SELECT * INTO v_existing_bill FROM public.bills 
        WHERE table_number = trim(p_table_number) AND status IN ('running', 'printed') 
        LIMIT 1;
    END IF;

    IF v_existing_bill.id IS NOT NULL THEN
        v_bill_id := v_existing_bill.id;
        -- Compute next batch index
        SELECT COALESCE(MAX(batch_index), 0) + 1 INTO v_batch_index 
        FROM public.kot_batches WHERE bill_id = v_bill_id;
    ELSE
        -- Generate fresh bill number
        v_bill_id := gen_random_uuid();
        INSERT INTO public.bills (
            id,
            restaurant_id,
            bill_number,
            order_type,
            table_number,
            customer_name,
            customer_phone,
            status,
            subtotal_minor,
            tax_amount_minor,
            grand_total_minor,
            created_by
        )
        VALUES (
            v_bill_id,
            v_restaurant_id,
            COALESCE(NULLIF(trim(p_bill_number), ''), 'BILL-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text from 1 for 6))),
            COALESCE(p_order_type, 'dine_in'),
            NULLIF(trim(p_table_number), ''),
            p_customer_name,
            p_customer_phone,
            'running',
            0,
            0,
            0,
            auth.uid()
        );
    END IF;

    -- Create KOT batch record
    v_kot_number := 'KOT-' || to_char(now(), 'HH24MI') || '-' || upper(substring(gen_random_uuid()::text from 1 for 4));
    INSERT INTO public.kot_batches (
        bill_id,
        restaurant_id,
        kot_number,
        batch_index,
        status,
        special_instructions,
        created_by
    )
    VALUES (
        v_bill_id,
        v_restaurant_id,
        v_kot_number,
        v_batch_index,
        'sent',
        p_special_instructions,
        auth.uid()
    )
    RETURNING id INTO v_kot_batch_id;

    -- Look up prices from canonical database and insert bill items in minor units
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_menu_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        v_quantity := GREATEST(1, COALESCE((v_item->>'quantity')::INTEGER, 1));
        v_db_price := NULL;
        v_db_name := NULL;

        -- Lookup from public.menu_items
        SELECT price, name INTO v_db_price, v_db_name 
        FROM public.menu_items 
        WHERE id = v_menu_id 
        LIMIT 1;

        -- Fallback to public.menu
        IF v_db_price IS NULL THEN
            SELECT price, name INTO v_db_price, v_db_name 
            FROM public.menu 
            WHERE id = v_menu_id OR lower(trim(name)) = lower(trim(v_menu_id))
            LIMIT 1;
        END IF;

        IF v_db_price IS NULL THEN
            -- Use passed price converted to minor units only if catalog item not found
            v_unit_minor := ROUND(COALESCE((v_item->>'unit_price')::NUMERIC, 0) * 100);
            v_db_name := COALESCE(v_item->>'item_name', v_item->>'name', 'Item');
        ELSE
            -- Strict server catalog price converted to minor units (e.g. ₹150 -> 15000 paise)
            v_unit_minor := ROUND(v_db_price * 100);
        END IF;

        -- Compute modifier minor units
        v_mod_minor := 0;
        IF v_item->'modifiers' IS NOT NULL AND jsonb_typeof(v_item->'modifiers') = 'array' THEN
            FOR v_mod IN SELECT * FROM jsonb_array_elements(v_item->'modifiers')
            LOOP
                v_mod_minor := v_mod_minor + ROUND(COALESCE((v_mod->>'price')::NUMERIC, 0) * 100);
            END LOOP;
        END IF;

        v_line_minor := (v_unit_minor + v_mod_minor) * v_quantity;

        INSERT INTO public.bill_items (
            bill_id,
            restaurant_id,
            kot_batch_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price_minor,
            line_total_minor,
            tax_category,
            modifiers,
            notes
        )
        VALUES (
            v_bill_id,
            v_restaurant_id,
            v_kot_batch_id,
            v_menu_id,
            v_db_name,
            v_quantity,
            v_unit_minor + v_mod_minor,
            v_line_minor,
            COALESCE(v_item->>'tax_category', 'food'),
            COALESCE(v_item->'modifiers', '[]'::jsonb),
            NULLIF(trim(COALESCE(v_item->>'notes', '')), '')
        );
    END LOOP;

    -- Recalculate bill financial totals strictly on the server in integer minor units
    SELECT COALESCE(SUM(line_total_minor), 0)
    INTO v_subtotal_minor
    FROM public.bill_items
    WHERE bill_id = v_bill_id AND is_voided = false;

    -- Fetch tax rate from settings
    SELECT COALESCE(tax_rate, 0.0500) INTO v_tax_rate
    FROM public.restaurant_settings
    ORDER BY (id = 'current') DESC LIMIT 1;

    -- GST 5% inclusive calculation: tax = subtotal * (rate / (1 + rate))
    v_tax_minor := ROUND(v_subtotal_minor * (v_tax_rate / (1.0 + v_tax_rate)));
    v_grand_total_minor := v_subtotal_minor;

    UPDATE public.bills
    SET subtotal_minor = v_subtotal_minor,
        tax_amount_minor = v_tax_minor,
        grand_total_minor = v_grand_total_minor,
        tax_details = jsonb_build_array(
            jsonb_build_object('label', 'CGST', 'rate', v_tax_rate / 2.0, 'amount_minor', ROUND(v_tax_minor / 2.0)),
            jsonb_build_object('label', 'SGST', 'rate', v_tax_rate / 2.0, 'amount_minor', v_tax_minor - ROUND(v_tax_minor / 2.0))
        ),
        updated_at = now()
    WHERE id = v_bill_id;

    RETURN jsonb_build_object(
        'success', true,
        'bill_id', v_bill_id,
        'kot_number', v_kot_number,
        'batch_index', v_batch_index,
        'subtotal_minor', v_subtotal_minor,
        'grand_total_minor', v_grand_total_minor
    );
END;
$$;

-- 10.2 POS VOID ITEM (Requires manager PIN or manager role, logs to audit_log, recalculates totals)
CREATE OR REPLACE FUNCTION public.pos_void_item(
    p_bill_item_id UUID,
    p_void_reason TEXT,
    p_manager_pin TEXT,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL,
    p_actor_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_bill RECORD;
    v_is_authorized BOOLEAN := false;
    v_subtotal_minor INTEGER := 0;
    v_tax_minor INTEGER := 0;
    v_grand_total_minor INTEGER := 0;
    v_tax_rate NUMERIC := 0.0500;
BEGIN
    IF p_void_reason IS NULL OR length(trim(p_void_reason)) < 3 THEN
        RETURN jsonb_build_object('success', false, 'error', 'A valid void reason (min 3 chars) is required');
    END IF;

    -- Verify Authorization: Manager role or valid Manager PIN
    IF p_actor_role IN ('owner', 'manager') THEN
        v_is_authorized := true;
    ELSIF public.is_manager_or_above(auth.uid()) THEN
        v_is_authorized := true;
    ELSIF p_manager_pin IS NOT NULL AND public.pos_verify_manager_pin(p_manager_pin) THEN
        v_is_authorized := true;
    END IF;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid manager PIN or insufficient role permissions for void');
    END IF;

    SELECT * INTO v_item FROM public.bill_items WHERE id = p_bill_item_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill item not found');
    END IF;

    IF v_item.is_voided THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item is already voided');
    END IF;

    SELECT * INTO v_bill FROM public.bills WHERE id = v_item.bill_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Parent bill not found');
    END IF;

    IF v_bill.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot void items on a settled bill');
    END IF;

    -- Mark item voided
    UPDATE public.bill_items
    SET is_voided = true,
        void_reason = trim(p_void_reason),
        void_approved_by = COALESCE(p_actor_name, 'Manager'),
        voided_at = now(),
        updated_at = now()
    WHERE id = p_bill_item_id;

    -- Recalculate bill in integer minor units
    SELECT COALESCE(SUM(line_total_minor), 0)
    INTO v_subtotal_minor
    FROM public.bill_items
    WHERE bill_id = v_bill.id AND is_voided = false;

    SELECT COALESCE(tax_rate, 0.0500) INTO v_tax_rate
    FROM public.restaurant_settings
    ORDER BY (id = 'current') DESC LIMIT 1;

    v_tax_minor := ROUND(v_subtotal_minor * (v_tax_rate / (1.0 + v_tax_rate)));
    v_grand_total_minor := GREATEST(0, v_subtotal_minor - v_bill.discount_amount_minor);

    UPDATE public.bills
    SET subtotal_minor = v_subtotal_minor,
        tax_amount_minor = v_tax_minor,
        grand_total_minor = v_grand_total_minor,
        updated_at = now()
    WHERE id = v_bill.id;

    -- WRITE TO AUDIT LOG (Every void writes to audit log)
    INSERT INTO public.audit_log (
        restaurant_id,
        actor_id,
        actor_role,
        actor_name,
        action,
        target_type,
        target_id,
        details
    )
    VALUES (
        v_bill.restaurant_id,
        p_actor_id,
        COALESCE(p_actor_role, 'manager'),
        COALESCE(p_actor_name, 'Manager'),
        'POS_ITEM_VOID',
        'bill_items',
        v_item.id::text,
        jsonb_build_object(
            'bill_number', v_bill.bill_number,
            'item_name', v_item.item_name,
            'quantity', v_item.quantity,
            'line_total_minor', v_item.line_total_minor,
            'void_reason', trim(p_void_reason),
            'approved_by', COALESCE(p_actor_name, 'Manager')
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'item_id', v_item.id,
        'voided_line_minor', v_item.line_total_minor,
        'new_subtotal_minor', v_subtotal_minor,
        'new_grand_total_minor', v_grand_total_minor
    );
END;
$$;

-- 10.3 POS APPLY DISCOUNT (Calculates minor units server-side and writes to audit_log)
CREATE OR REPLACE FUNCTION public.pos_apply_discount(
    p_bill_id UUID,
    p_discount_type TEXT,
    p_discount_value_minor INTEGER,
    p_discount_code TEXT DEFAULT NULL,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL,
    p_actor_role TEXT DEFAULT NULL,
    p_manager_pin TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill RECORD;
    v_computed_discount_minor INTEGER := 0;
    v_grand_total_minor INTEGER := 0;
    v_is_authorized BOOLEAN := false;
BEGIN
    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill not found');
    END IF;

    IF v_bill.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot apply discount to an already paid bill');
    END IF;

    -- Authorize manager if manual discount
    IF p_discount_type IN ('flat', 'manual') OR p_discount_value_minor > 2000 THEN -- >20%
        IF p_actor_role IN ('owner', 'manager') OR public.is_manager_or_above(auth.uid()) THEN
            v_is_authorized := true;
        ELSIF p_manager_pin IS NOT NULL AND public.pos_verify_manager_pin(p_manager_pin) THEN
            v_is_authorized := true;
        END IF;

        IF NOT v_is_authorized THEN
            RETURN jsonb_build_object('success', false, 'error', 'Manager authorization PIN required for this discount');
        END IF;
    END IF;

    -- Compute discount in integer minor units
    IF p_discount_type = 'percentage' THEN
        -- p_discount_value_minor is percentage in hundredths, e.g. 1000 = 10.00%
        v_computed_discount_minor := ROUND(v_bill.subtotal_minor * (p_discount_value_minor / 10000.0));
    ELSIF p_discount_type IN ('flat', 'manual') THEN
        v_computed_discount_minor := LEAST(v_bill.subtotal_minor, p_discount_value_minor);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid discount type');
    END IF;

    v_grand_total_minor := GREATEST(0, v_bill.subtotal_minor - v_computed_discount_minor);

    UPDATE public.bills
    SET discount_type = p_discount_type,
        discount_code = p_discount_code,
        discount_value_minor = p_discount_value_minor,
        discount_amount_minor = v_computed_discount_minor,
        discount_approved_by = COALESCE(p_actor_name, 'Staff'),
        grand_total_minor = v_grand_total_minor,
        updated_at = now()
    WHERE id = p_bill_id;

    -- WRITE TO AUDIT LOG (Every discount writes to audit log)
    INSERT INTO public.audit_log (
        restaurant_id,
        actor_id,
        actor_role,
        actor_name,
        action,
        target_type,
        target_id,
        details
    )
    VALUES (
        v_bill.restaurant_id,
        p_actor_id,
        COALESCE(p_actor_role, 'staff'),
        COALESCE(p_actor_name, 'Staff'),
        'POS_DISCOUNT_APPLIED',
        'bills',
        v_bill.bill_number,
        jsonb_build_object(
            'bill_number', v_bill.bill_number,
            'discount_type', p_discount_type,
            'discount_code', p_discount_code,
            'discount_amount_minor', v_computed_discount_minor,
            'original_subtotal_minor', v_bill.subtotal_minor,
            'new_grand_total_minor', v_grand_total_minor,
            'approved_by', COALESCE(p_actor_name, 'Staff')
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'discount_amount_minor', v_computed_discount_minor,
        'grand_total_minor', v_grand_total_minor
    );
END;
$$;

-- 10.4 POS RECORD DRAWER OPEN (Every drawer open writes to audit log and cash drawer transactions)
CREATE OR REPLACE FUNCTION public.pos_record_drawer_open(
    p_shift_id UUID,
    p_reason TEXT,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL,
    p_actor_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shift RECORD;
BEGIN
    SELECT * INTO v_shift FROM public.cash_shifts WHERE id = p_shift_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Active shift not found');
    END IF;

    -- 1. Insert into cash_drawer_transactions
    INSERT INTO public.cash_drawer_transactions (
        restaurant_id,
        shift_id,
        type,
        amount_minor,
        reason,
        actor_id,
        actor_name,
        actor_role
    )
    VALUES (
        v_shift.restaurant_id,
        p_shift_id,
        'drawer_open',
        0,
        COALESCE(NULLIF(trim(p_reason), ''), 'Manual Cash Drawer Kick'),
        COALESCE(p_actor_id, 'staff'),
        COALESCE(p_actor_name, 'Staff Cashier'),
        COALESCE(p_actor_role, 'cashier')
    );

    -- 2. WRITE TO AUDIT LOG (Every drawer open writes to audit log)
    INSERT INTO public.audit_log (
        restaurant_id,
        actor_id,
        actor_role,
        actor_name,
        action,
        target_type,
        target_id,
        details
    )
    VALUES (
        v_shift.restaurant_id,
        p_actor_id,
        COALESCE(p_actor_role, 'cashier'),
        COALESCE(p_actor_name, 'Staff Cashier'),
        'CASH_DRAWER_OPEN',
        'cash_shifts',
        p_shift_id::text,
        jsonb_build_object(
            'shift_number', v_shift.shift_number,
            'reason', COALESCE(NULLIF(trim(p_reason), ''), 'Manual Drawer Open Pulse'),
            'timestamp', now()
        )
    );

    RETURN jsonb_build_object('success', true, 'message', 'Drawer open recorded in audit log');
END;
$$;

-- 10.5 POS ATOMIC BILL SPLIT (Integer minor units with zero-remainder distribution)
CREATE OR REPLACE FUNCTION public.split_bill_atomic(
    p_bill_number TEXT,
    p_split_type TEXT,
    p_splits JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill RECORD;
    v_split JSONB;
    v_sum_amount_minor INTEGER := 0;
    v_total_parts INTEGER;
    v_part_number INTEGER := 1;
BEGIN
    SELECT * INTO v_bill 
    FROM public.bills 
    WHERE bill_number = trim(p_bill_number) 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill not found');
    END IF;

    IF v_bill.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot split an already settled bill');
    END IF;

    v_total_parts := jsonb_array_length(p_splits);
    IF v_total_parts < 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Splits array cannot be empty');
    END IF;

    -- Validate minor unit sum across split parts
    FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
    LOOP
        v_sum_amount_minor := v_sum_amount_minor + ((v_split->>'amount_minor')::INTEGER);
    END LOOP;

    IF v_sum_amount_minor <> v_bill.grand_total_minor THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Split sum (%s minor units) does not match bill grand total (%s minor units)', v_sum_amount_minor, v_bill.grand_total_minor)
        );
    END IF;

    -- Clear existing pending splits
    DELETE FROM public.bill_splits
    WHERE bill_id = v_bill.id AND status = 'pending';

    -- Insert new split parts
    FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
    LOOP
        INSERT INTO public.bill_splits (
            restaurant_id,
            bill_id,
            bill_number,
            split_type,
            part_number,
            total_parts,
            payer_label,
            items,
            subtotal_minor,
            tax_amount_minor,
            amount_minor,
            status
        )
        VALUES (
            v_bill.restaurant_id,
            v_bill.id,
            v_bill.bill_number,
            p_split_type,
            COALESCE((v_split->>'part_number')::INTEGER, v_part_number),
            v_total_parts,
            COALESCE(v_split->>'payer_label', 'Guest ' || v_part_number),
            COALESCE(v_split->'items', '[]'::jsonb),
            COALESCE((v_split->>'subtotal_minor')::INTEGER, 0),
            COALESCE((v_split->>'tax_amount_minor')::INTEGER, 0),
            (v_split->>'amount_minor')::INTEGER,
            'pending'
        );
        v_part_number := v_part_number + 1;
    END LOOP;

    UPDATE public.bills
    SET is_split = true,
        split_type = p_split_type,
        split_count = v_total_parts,
        updated_at = now()
    WHERE id = v_bill.id;

    RETURN jsonb_build_object(
        'success', true,
        'bill_number', v_bill.bill_number,
        'total_parts', v_total_parts,
        'grand_total_minor', v_bill.grand_total_minor
    );
END;
$$;

-- 10.6 IDEMPOTENT BILL PAYMENT PROCESSOR (Integer Minor Units, Change Due, Drawer Integration)
CREATE OR REPLACE FUNCTION public.process_bill_payment(
    p_bill_number TEXT,
    p_split_id UUID DEFAULT NULL,
    p_tender_type TEXT DEFAULT 'cash',
    p_amount_minor INTEGER DEFAULT 0,
    p_tip_minor INTEGER DEFAULT 0,
    p_tendered_minor INTEGER DEFAULT 0,
    p_payment_reference TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL,
    p_actor_role TEXT DEFAULT NULL,
    p_shift_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill RECORD;
    v_split RECORD;
    v_existing_tx RECORD;
    v_change_due_minor INTEGER := 0;
    v_total_paid_so_far_minor INTEGER := 0;
    v_remaining_minor INTEGER := 0;
    v_is_bill_closed BOOLEAN := false;
BEGIN
    -- Idempotency check: prevent double charges
    IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
        SELECT * INTO v_existing_tx 
        FROM public.cash_drawer_transactions 
        WHERE idempotency_key = trim(p_idempotency_key) 
        LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'is_duplicate', true,
                'bill_number', p_bill_number,
                'message', 'Payment already processed (idempotent duplicate)'
            );
        END IF;
    END IF;

    SELECT * INTO v_bill FROM public.bills WHERE bill_number = trim(p_bill_number) FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill not found');
    END IF;

    -- Compute cash change in minor units
    IF p_tender_type = 'cash' THEN
        v_change_due_minor := GREATEST(0, p_tendered_minor - (p_amount_minor + p_tip_minor));
    END IF;

    -- Update split part if paying a split
    IF p_split_id IS NOT NULL THEN
        SELECT * INTO v_split FROM public.bill_splits WHERE id = p_split_id AND bill_id = v_bill.id FOR UPDATE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Bill split part not found');
        END IF;

        IF v_split.status = 'paid' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Split part is already paid');
        END IF;

        UPDATE public.bill_splits
        SET status = 'paid',
            tender_type = p_tender_type,
            payment_reference = p_payment_reference,
            tip_amount_minor = p_tip_minor,
            tendered_amount_minor = p_tendered_minor,
            change_due_minor = v_change_due_minor,
            total_paid_minor = p_amount_minor + p_tip_minor,
            paid_at = now(),
            idempotency_key = p_idempotency_key,
            updated_at = now()
        WHERE id = p_split_id;
    END IF;

    -- Record in cash drawer if shift is active
    IF p_shift_id IS NOT NULL THEN
        INSERT INTO public.cash_drawer_transactions (
            restaurant_id,
            shift_id,
            type,
            amount_minor,
            reason,
            bill_number,
            actor_id,
            actor_name,
            actor_role,
            idempotency_key
        )
        VALUES (
            v_bill.restaurant_id,
            p_shift_id,
            'sale',
            p_amount_minor + p_tip_minor,
            format('Settlement for bill %s via %s', v_bill.bill_number, p_tender_type),
            v_bill.bill_number,
            COALESCE(p_actor_id, 'staff'),
            COALESCE(p_actor_name, 'Staff Cashier'),
            COALESCE(p_actor_role, 'cashier'),
            p_idempotency_key
        );
    END IF;

    -- Calculate total paid across splits or payments
    IF v_bill.is_split THEN
        SELECT COALESCE(SUM(amount_minor), 0)
        INTO v_total_paid_so_far_minor
        FROM public.bill_splits
        WHERE bill_id = v_bill.id AND status = 'paid';

        IF NOT EXISTS (SELECT 1 FROM public.bill_splits WHERE bill_id = v_bill.id AND status <> 'paid') THEN
            v_is_bill_closed := true;
        END IF;
    ELSE
        v_total_paid_so_far_minor := p_amount_minor;
        v_is_bill_closed := (v_total_paid_so_far_minor >= v_bill.grand_total_minor);
    END IF;

    v_remaining_minor := GREATEST(0, v_bill.grand_total_minor - v_total_paid_so_far_minor);

    IF v_is_bill_closed THEN
        UPDATE public.bills
        SET payment_status = 'paid',
            status = 'paid',
            paid_at = now(),
            payment_method = p_tender_type,
            shift_id = COALESCE(p_shift_id, shift_id),
            tips_minor = tips_minor + p_tip_minor,
            updated_at = now()
        WHERE id = v_bill.id;
    ELSE
        UPDATE public.bills
        SET payment_status = 'processing',
            shift_id = COALESCE(p_shift_id, shift_id),
            tips_minor = tips_minor + p_tip_minor,
            updated_at = now()
        WHERE id = v_bill.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'bill_number', v_bill.bill_number,
        'tender_type', p_tender_type,
        'amount_minor', p_amount_minor,
        'change_due_minor', v_change_due_minor,
        'remaining_minor', v_remaining_minor,
        'is_bill_closed', v_is_bill_closed
    );
END;
$$;

-- 10.7 MANAGER-GATED VOID & REFUND RPC (Writes to audit_log and records cash drawer refund)
CREATE OR REPLACE FUNCTION public.void_or_refund_order_secure(
    p_order_ref TEXT,
    p_reason TEXT,
    p_amount_minor INTEGER DEFAULT NULL,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL,
    p_actor_role TEXT DEFAULT NULL,
    p_manager_pin TEXT DEFAULT NULL,
    p_shift_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill RECORD;
    v_is_authorized BOOLEAN := false;
    v_refund_minor INTEGER;
BEGIN
    IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
        RETURN jsonb_build_object('success', false, 'error', 'A valid refund reason is required');
    END IF;

    -- Strict Authorization: Only Owner or Manager
    IF p_actor_role IN ('owner', 'manager') OR public.is_manager_or_above(auth.uid()) THEN
        v_is_authorized := true;
    ELSIF p_manager_pin IS NOT NULL AND public.pos_verify_manager_pin(p_manager_pin) THEN
        v_is_authorized := true;
    END IF;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Manager authorization is required for refunds/voids');
    END IF;

    -- Lookup in bills table first
    SELECT * INTO v_bill FROM public.bills 
    WHERE bill_number = trim(p_order_ref) OR id::text = trim(p_order_ref) 
    FOR UPDATE;

    IF FOUND THEN
        v_refund_minor := COALESCE(p_amount_minor, v_bill.grand_total_minor);

        UPDATE public.bills
        SET status = 'voided',
            payment_status = 'refunded',
            updated_at = now()
        WHERE id = v_bill.id;

        UPDATE public.bill_splits
        SET status = 'refunded',
            updated_at = now()
        WHERE bill_id = v_bill.id;

        -- Record drawer refund transaction if cash
        IF p_shift_id IS NOT NULL THEN
            INSERT INTO public.cash_drawer_transactions (
                restaurant_id,
                shift_id,
                type,
                amount_minor,
                reason,
                bill_number,
                actor_id,
                actor_name,
                actor_role
            )
            VALUES (
                v_bill.restaurant_id,
                p_shift_id,
                'refund',
                v_refund_minor,
                format('Refund for bill %s: %s', v_bill.bill_number, trim(p_reason)),
                v_bill.bill_number,
                COALESCE(p_actor_id, 'manager'),
                COALESCE(p_actor_name, 'Manager'),
                'manager'
            );
        END IF;

        -- WRITE TO AUDIT LOG (Every refund writes to audit log)
        INSERT INTO public.audit_log (
            restaurant_id,
            actor_id,
            actor_role,
            actor_name,
            action,
            target_type,
            target_id,
            details
        )
        VALUES (
            v_bill.restaurant_id,
            p_actor_id,
            COALESCE(p_actor_role, 'manager'),
            COALESCE(p_actor_name, 'Manager'),
            'POS_BILL_REFUND',
            'bills',
            v_bill.bill_number,
            jsonb_build_object(
                'bill_number', v_bill.bill_number,
                'refund_minor', v_refund_minor,
                'reason', trim(p_reason),
                'authorized_by', COALESCE(p_actor_name, 'Manager')
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'bill_number', v_bill.bill_number,
            'refund_minor', v_refund_minor,
            'message', 'Bill refunded successfully and logged to audit trail'
        );
    END IF;

    -- Fallback to legacy orders table if referenced by order_ref
    RETURN jsonb_build_object('success', false, 'error', 'Target bill or order not found');
END;
$$;

-- 10.8 FINANCIAL Z-REPORT GENERATION (Strict integer minor units)
CREATE OR REPLACE FUNCTION public.get_shift_z_report(p_shift_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shift RECORD;
    v_cash_sales_minor INTEGER := 0;
    v_card_sales_minor INTEGER := 0;
    v_upi_sales_minor INTEGER := 0;
    v_other_sales_minor INTEGER := 0;
    v_cash_in_minor INTEGER := 0;
    v_cash_out_minor INTEGER := 0;
    v_cash_refunds_minor INTEGER := 0;
    v_gross_sales_minor INTEGER := 0;
    v_expected_cash_minor INTEGER := 0;
    v_variance_minor INTEGER := 0;
    v_tx_count INTEGER := 0;
BEGIN
    SELECT * INTO v_shift FROM public.cash_shifts WHERE id = p_shift_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Shift not found');
    END IF;

    -- Cash Drawer transactions totals
    SELECT 
        COALESCE(SUM(CASE WHEN type = 'sale' THEN amount_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'cash_in' THEN amount_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'cash_out' THEN amount_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'refund' THEN amount_minor ELSE 0 END), 0),
        COUNT(id)
    INTO 
        v_cash_sales_minor, v_cash_in_minor, v_cash_out_minor, v_cash_refunds_minor, v_tx_count
    FROM public.cash_drawer_transactions
    WHERE shift_id = p_shift_id;

    -- Tender totals from settled bills associated with this shift
    SELECT 
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN grand_total_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method = 'upi' THEN grand_total_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method NOT IN ('cash', 'card', 'upi') THEN grand_total_minor ELSE 0 END), 0)
    INTO 
        v_card_sales_minor, v_upi_sales_minor, v_other_sales_minor
    FROM public.bills
    WHERE shift_id = p_shift_id AND status = 'paid';

    v_gross_sales_minor := v_cash_sales_minor + v_card_sales_minor + v_upi_sales_minor + v_other_sales_minor;
    
    -- Expected cash = opening float + cash sales + cash in - cash out - cash refunds
    v_expected_cash_minor := v_shift.opening_float_minor + v_cash_sales_minor + v_cash_in_minor - v_cash_out_minor - v_cash_refunds_minor;
    v_variance_minor := COALESCE(v_shift.counted_cash_minor, v_expected_cash_minor) - v_expected_cash_minor;

    RETURN jsonb_build_object(
        'success', true,
        'shift_id', v_shift.id,
        'shift_number', v_shift.shift_number,
        'opened_at', v_shift.opened_at,
        'closed_at', v_shift.closed_at,
        'opened_by_name', v_shift.opened_by_name,
        'closed_by_name', v_shift.closed_by_name,
        'opening_float_minor', v_shift.opening_float_minor,
        'gross_sales_minor', v_gross_sales_minor,
        'cash_sales_minor', v_cash_sales_minor,
        'card_sales_minor', v_card_sales_minor,
        'upi_sales_minor', v_upi_sales_minor,
        'other_sales_minor', v_other_sales_minor,
        'cash_in_minor', v_cash_in_minor,
        'cash_out_minor', v_cash_out_minor,
        'cash_refunds_minor', v_cash_refunds_minor,
        'expected_cash_minor', v_expected_cash_minor,
        'counted_cash_minor', v_shift.counted_cash_minor,
        'variance_minor', v_variance_minor,
        'tx_count', v_tx_count
    );
END;
$$;

-- 10.9 TABLE OPERATIONS: Table Transfer, Table Merge, Item Move
CREATE OR REPLACE FUNCTION public.pos_transfer_table(
    p_from_table TEXT,
    p_to_table TEXT,
    p_actor_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_source_bill RECORD;
    v_dest_bill RECORD;
BEGIN
    SELECT * INTO v_source_bill FROM public.bills 
    WHERE table_number = trim(p_from_table) AND status IN ('running', 'printed') 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No active running bill found on source table');
    END IF;

    SELECT * INTO v_dest_bill FROM public.bills 
    WHERE table_number = trim(p_to_table) AND status IN ('running', 'printed') 
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Destination table already has an active bill. Use table merge instead.');
    END IF;

    UPDATE public.bills
    SET table_number = trim(p_to_table),
        notes = COALESCE(notes || E'\n', '') || format('Transferred from Table %s by %s at %s', p_from_table, COALESCE(p_actor_name, 'Staff'), now()),
        updated_at = now()
    WHERE id = v_source_bill.id;

    RETURN jsonb_build_object(
        'success', true,
        'bill_number', v_source_bill.bill_number,
        'from_table', p_from_table,
        'to_table', p_to_table
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.pos_merge_tables(
    p_primary_table TEXT,
    p_secondary_table TEXT,
    p_actor_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_primary_bill RECORD;
    v_secondary_bill RECORD;
    v_new_subtotal_minor INTEGER := 0;
    v_new_tax_minor INTEGER := 0;
    v_tax_rate NUMERIC := 0.0500;
BEGIN
    SELECT * INTO v_primary_bill FROM public.bills 
    WHERE table_number = trim(p_primary_table) AND status IN ('running', 'printed') 
    FOR UPDATE;

    SELECT * INTO v_secondary_bill FROM public.bills 
    WHERE table_number = trim(p_secondary_table) AND status IN ('running', 'printed') 
    FOR UPDATE;

    IF v_primary_bill.id IS NULL OR v_secondary_bill.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Both tables must have active running bills to merge');
    END IF;

    -- Move all items and KOT batches from secondary bill to primary bill
    UPDATE public.bill_items
    SET bill_id = v_primary_bill.id,
        updated_at = now()
    WHERE bill_id = v_secondary_bill.id;

    UPDATE public.kot_batches
    SET bill_id = v_primary_bill.id
    WHERE bill_id = v_secondary_bill.id;

    -- Mark secondary bill as merged
    UPDATE public.bills
    SET status = 'merged',
        notes = format('Merged into %s on Table %s by %s', v_primary_bill.bill_number, p_primary_table, COALESCE(p_actor_name, 'Staff')),
        updated_at = now()
    WHERE id = v_secondary_bill.id;

    -- Recalculate primary bill in minor units
    SELECT COALESCE(SUM(line_total_minor), 0)
    INTO v_new_subtotal_minor
    FROM public.bill_items
    WHERE bill_id = v_primary_bill.id AND is_voided = false;

    SELECT COALESCE(tax_rate, 0.0500) INTO v_tax_rate
    FROM public.restaurant_settings
    ORDER BY (id = 'current') DESC LIMIT 1;

    v_tax_minor := ROUND(v_new_subtotal_minor * (v_tax_rate / (1.0 + v_tax_rate)));

    UPDATE public.bills
    SET subtotal_minor = v_new_subtotal_minor,
        tax_amount_minor = v_tax_minor,
        grand_total_minor = GREATEST(0, v_new_subtotal_minor - discount_amount_minor),
        notes = COALESCE(notes || E'\n', '') || format('Merged Table %s items into this bill by %s at %s', p_secondary_table, COALESCE(p_actor_name, 'Staff'), now()),
        updated_at = now()
    WHERE id = v_primary_bill.id;

    RETURN jsonb_build_object(
        'success', true,
        'primary_bill_number', v_primary_bill.bill_number,
        'merged_secondary_bill', v_secondary_bill.bill_number,
        'grand_total_minor', GREATEST(0, v_new_subtotal_minor - v_primary_bill.discount_amount_minor)
    );
END;
$$;

-- Grant EXECUTE privileges to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.pos_verify_manager_pin(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_create_or_append_kot(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_void_item(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_apply_discount(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_record_drawer_open(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.split_bill_atomic(TEXT, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_bill_payment(TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.void_or_refund_order_secure(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_shift_z_report(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_transfer_table(TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_merge_tables(TEXT, TEXT, TEXT) TO authenticated, service_role;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 022_restaurant_feature_toggles.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 022_restaurant_feature_toggles.sql
-- Description:
-- 1. Unified 18-Feature Toggle Architecture on restaurant_settings:
--    - online_ordering, delivery, takeaway, qr_table_ordering, reservations,
--      kds, pos, running_table_bills, split_bills, cash_drawer, kot_printing,
--      discounts, tips, vip_club, online_payments, specials_banner, gallery,
--      language_switcher.
-- 2. Helper functions:
--    - is_feature_enabled(p_feature_key, p_restaurant_id)
--    - check_feature_open_data(p_feature_key, p_restaurant_id)
-- 3. Owner-gated RPC:
--    - update_restaurant_features(p_features, p_restaurant_id)
--    - Validates dependencies (split_bills, running_table_bills, cash_drawer -> pos; kot_printing -> kds/printer)
--    - Blocks turning OFF features that have open data (open table bills, open cash shifts)
--    - Records full audit trail in public.audit_log
-- 4. Server enforcement on core RPCs:
--    - create_order_atomic (rejects if ordering, channel, online payment, or discount disabled)
--    - create_reservation_atomic (rejects if reservations disabled)
--    - validate_discount_code (rejects if discounts disabled)
--    - pos_create_or_append_kot (rejects if pos, running bills, or kot printing disabled)
--    - split_bill_atomic (rejects if pos or split_bills disabled)
--    - pos_record_drawer_open (rejects if pos or cash_drawer disabled)
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADD FEATURES JSONB COLUMN TO RESTAURANT_SETTINGS
-- ------------------------------------------------------------------------------
ALTER TABLE public.restaurant_settings
ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{
    "online_ordering": true,
    "delivery": true,
    "takeaway": true,
    "qr_table_ordering": true,
    "reservations": true,
    "kds": true,
    "pos": true,
    "running_table_bills": true,
    "split_bills": true,
    "cash_drawer": true,
    "kot_printing": true,
    "discounts": true,
    "tips": true,
    "vip_club": true,
    "online_payments": true,
    "specials_banner": true,
    "gallery": true,
    "language_switcher": true
}'::jsonb;

-- Synchronize existing operational toggles with features column for existing rows
UPDATE public.restaurant_settings
SET features = jsonb_set(
    jsonb_set(
        jsonb_set(
            features,
            '{online_ordering}',
            to_jsonb(is_ordering_enabled)
        ),
        '{reservations}',
        to_jsonb(is_table_booking_enabled)
    ),
    '{online_payments}',
    to_jsonb(COALESCE(payments_enabled, payment_enabled, false))
)
WHERE features IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. HELPER FUNCTION: is_feature_enabled
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_feature_enabled(
    p_feature_key TEXT,
    p_restaurant_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_features JSONB;
    v_val TEXT;
BEGIN
    SELECT rs.features INTO v_features
    FROM public.restaurant_settings rs
    WHERE (p_restaurant_id IS NULL OR rs.restaurant_id = p_restaurant_id)
    LIMIT 1;

    IF v_features IS NULL THEN
        RETURN true; -- fallback if settings row does not exist yet
    END IF;

    v_val := v_features->>p_feature_key;
    IF v_val IS NULL THEN
        RETURN true;
    END IF;

    RETURN (v_val = 'true');
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_feature_enabled(TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. HELPER FUNCTION: check_feature_open_data
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_feature_open_data(
    p_feature_key TEXT,
    p_restaurant_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_res_id TEXT := COALESCE(p_restaurant_id, 'the-cafe-barrackpore');
    v_count INTEGER := 0;
BEGIN
    -- 1. Running Table Bills & POS: Check active running bills or dine-in orders
    IF p_feature_key IN ('running_table_bills', 'pos') THEN
        -- Check public.bills table if it exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bills') THEN
            SELECT COUNT(*) INTO v_count
            FROM public.bills
            WHERE status = 'running'
              AND restaurant_id = v_res_id;

            IF v_count > 0 THEN
                RETURN jsonb_build_object(
                    'has_open_data', true,
                    'count', v_count,
                    'message', format('Cannot disable %s: %s active table bill(s) are currently running. Please settle or void all running bills first.', p_feature_key, v_count)
                );
            END IF;
        END IF;

        -- Also check public.orders for active dine_in orders
        SELECT COUNT(*) INTO v_count
        FROM public.orders
        WHERE order_type = 'dine_in'
          AND status IN ('pending', 'confirmed', 'preparing')
          AND restaurant_id = v_res_id;

        IF v_count > 0 THEN
            RETURN jsonb_build_object(
                'has_open_data', true,
                'count', v_count,
                'message', format('Cannot disable %s: %s active dine-in order(s) are in progress. Please complete them first.', p_feature_key, v_count)
            );
        END IF;
    END IF;

    -- 2. Cash Drawer & Shifts: Check open cash shifts
    IF p_feature_key = 'cash_drawer' THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_shifts') THEN
            SELECT COUNT(*) INTO v_count
            FROM public.cash_shifts
            WHERE status = 'open'
              AND restaurant_id = v_res_id;

            IF v_count > 0 THEN
                RETURN jsonb_build_object(
                    'has_open_data', true,
                    'count', v_count,
                    'message', 'Cannot disable Cash Drawer & Shifts: There is an active cash shift currently open. Please count and close the active shift first.'
                );
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'has_open_data', false,
        'count', 0,
        'message', 'No active open data blocking this feature.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_feature_open_data(TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. OWNER-GATED RPC: update_restaurant_features
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_restaurant_features(
    p_features JSONB,
    p_restaurant_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_id UUID;
    v_res_id TEXT;
    v_old_features JSONB;
    v_adjusted_features JSONB := p_features;
    v_open_check JSONB;
    v_feature_key TEXT;
    v_old_val BOOLEAN;
    v_new_val BOOLEAN;
    v_pos_enabled BOOLEAN;
    v_kds_enabled BOOLEAN;
BEGIN
    v_caller_id := auth.uid();

    -- 1. Authorization Gate: Only owners can update feature toggles
    IF COALESCE(auth.role(), '') <> 'service_role' THEN
        SELECT role INTO v_caller_role
        FROM public.staff_profiles
        WHERE user_id = v_caller_id AND active = true
        LIMIT 1;

        IF v_caller_role IS NULL OR v_caller_role <> 'owner' THEN
            RAISE EXCEPTION 'Access Denied: Only restaurant owners are authorized to change feature flags.';
        END IF;
    ELSE
        v_caller_role := 'service_role';
    END IF;

    -- 2. Resolve restaurant_id
    SELECT rs.restaurant_id, rs.features
    INTO v_res_id, v_old_features
    FROM public.restaurant_settings rs
    WHERE (p_restaurant_id IS NULL OR rs.restaurant_id = p_restaurant_id)
    LIMIT 1;

    IF v_res_id IS NULL THEN
        v_res_id := COALESCE(p_restaurant_id, 'the-cafe-barrackpore');
    END IF;

    IF v_old_features IS NULL THEN
        v_old_features := '{}'::jsonb;
    END IF;

    -- 3. Dependency Validation & Auto-handling
    -- Rule: split_bills, running_table_bills, cash_drawer require POS
    v_pos_enabled := COALESCE((v_adjusted_features->>'pos')::boolean, true);

    IF NOT v_pos_enabled THEN
        -- Auto-disable dependents if POS is disabled
        v_adjusted_features := jsonb_set(v_adjusted_features, '{split_bills}', 'false'::jsonb);
        v_adjusted_features := jsonb_set(v_adjusted_features, '{running_table_bills}', 'false'::jsonb);
        v_adjusted_features := jsonb_set(v_adjusted_features, '{cash_drawer}', 'false'::jsonb);
    END IF;

    -- Rule: kot_printing requires KDS or thermal printer
    v_kds_enabled := COALESCE((v_adjusted_features->>'kds')::boolean, true);
    IF (v_adjusted_features->>'kot_printing')::boolean = true AND NOT v_kds_enabled THEN
        -- Auto-enable KDS to satisfy KOT dependency
        v_adjusted_features := jsonb_set(v_adjusted_features, '{kds}', 'true'::jsonb);
    END IF;

    -- 4. Open Data Verification
    -- Iterate over keys being turned from true to false
    FOR v_feature_key IN SELECT jsonb_object_keys(v_adjusted_features)
    LOOP
        v_old_val := COALESCE((v_old_features->>v_feature_key)::boolean, true);
        v_new_val := COALESCE((v_adjusted_features->>v_feature_key)::boolean, true);

        IF v_old_val = true AND v_new_val = false THEN
            v_open_check := public.check_feature_open_data(v_feature_key, v_res_id);
            IF (v_open_check->>'has_open_data')::boolean = true THEN
                RAISE EXCEPTION 'Cannot turn OFF feature "%": %', v_feature_key, (v_open_check->>'message');
            END IF;
        END IF;
    END LOOP;

    -- 5. Update restaurant_settings
    UPDATE public.restaurant_settings
    SET
        features = v_adjusted_features,
        is_ordering_enabled = COALESCE((v_adjusted_features->>'online_ordering')::boolean, true),
        is_table_booking_enabled = COALESCE((v_adjusted_features->>'reservations')::boolean, true),
        payments_enabled = COALESCE((v_adjusted_features->>'online_payments')::boolean, false),
        payment_enabled = COALESCE((v_adjusted_features->>'online_payments')::boolean, false),
        updated_at = now()
    WHERE (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);

    -- 6. Write to public.audit_log
    INSERT INTO public.audit_log (
        restaurant_id,
        actor_id,
        actor_role,
        action,
        target_type,
        target_id,
        details,
        created_at
    ) VALUES (
        v_res_id,
        COALESCE(v_caller_id::text, 'system'),
        v_caller_role,
        'feature_flags_updated',
        'restaurant_settings',
        'current',
        jsonb_build_object(
            'old_features', v_old_features,
            'new_features', v_adjusted_features,
            'updated_by', COALESCE(v_caller_id::text, 'service_role')
        ),
        now()
    );

    RETURN v_adjusted_features;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_restaurant_features(JSONB, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. SERVER ENFORCEMENT: Update create_order_atomic with feature toggles
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order JSONB,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_order_ref TEXT;
    v_restaurant_id TEXT;
    v_verified_token TEXT;
    v_consumed_token_id UUID;
    v_raw_payment_token TEXT;
    v_payment_token_hash TEXT;
    v_item JSONB;
    v_item_id TEXT;
    v_quantity INTEGER;
    v_db_unit_price NUMERIC;
    v_db_item_name TEXT;
    v_is_available BOOLEAN;
    v_line_total NUMERIC;
    v_computed_subtotal NUMERIC := 0.00;
    v_computed_total NUMERIC := 0.00;
    v_tax_amount NUMERIC := 0.00;
    v_discount_amount NUMERIC := 0.00;
    v_tip_amount NUMERIC := 0.00;
    
    -- Restaurant settings configuration
    v_tax_enabled BOOLEAN := true;
    v_tax_mode TEXT := 'inclusive';
    v_tax_rate NUMERIC := 0.0500;
    v_currency TEXT := 'INR';
    
    -- Payment fields
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_payment_required BOOLEAN;
    v_order_type TEXT;
    v_created_at TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    -- 1. Read restaurant_id from restaurant_settings
    SELECT rs.restaurant_id
    INTO v_restaurant_id
    FROM public.restaurant_settings rs
    LIMIT 1;

    IF v_restaurant_id IS NULL OR trim(v_restaurant_id) = '' THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- 2. Feature Toggle Server Enforcement
    IF NOT public.is_feature_enabled('online_ordering', v_restaurant_id) THEN
        RAISE EXCEPTION 'Online ordering is currently disabled for this restaurant.';
    END IF;

    v_order_type := lower(trim(COALESCE(p_order->>'order_type', '')));

    IF v_order_type = 'dine_in' AND NOT public.is_feature_enabled('qr_table_ordering', v_restaurant_id) THEN
        RAISE EXCEPTION 'QR Table Ordering is currently disabled for this restaurant.';
    END IF;

    IF v_order_type = 'takeaway' AND NOT public.is_feature_enabled('takeaway', v_restaurant_id) THEN
        RAISE EXCEPTION 'Takeaway ordering is currently disabled for this restaurant.';
    END IF;

    IF v_order_type = 'delivery' AND NOT public.is_feature_enabled('delivery', v_restaurant_id) THEN
        RAISE EXCEPTION 'Delivery ordering is currently disabled for this restaurant.';
    END IF;

    v_payment_method := lower(trim(COALESCE(
        p_order->>'payment_method',
        p_order->>'payment_provider',
        ''
    )));

    IF v_payment_method NOT IN ('counter', 'pay_at_counter', 'cash', 'manual', '') 
       AND NOT public.is_feature_enabled('online_payments', v_restaurant_id) THEN
        RAISE EXCEPTION 'Online payments are currently disabled by the restaurant. Please choose Pay at Counter.';
    END IF;

    IF p_order->>'discount_code' IS NOT NULL AND length(trim(p_order->>'discount_code')) > 0 
       AND NOT public.is_feature_enabled('discounts', v_restaurant_id) THEN
        RAISE EXCEPTION 'Discounts and promotional coupons are currently disabled.';
    END IF;

    v_tip_amount := COALESCE((p_order->>'tip_amount')::numeric, 0.00);
    IF v_tip_amount > 0 AND NOT public.is_feature_enabled('tips', v_restaurant_id) THEN
        RAISE EXCEPTION 'Tips and gratuities are currently disabled.';
    END IF;

    -- 3. Input Validation: Check items array
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cannot create an order with empty items';
    END IF;

    -- Enforce distinct item cap at 40
    IF jsonb_array_length(p_items) > 40 THEN
        RAISE EXCEPTION 'Order cannot contain more than 40 distinct items';
    END IF;

    -- 4. Turnstile Bot Defense: Require verified single-use token
    v_verified_token := trim(COALESCE(p_order->>'verified_token', ''));
    IF v_verified_token = '' THEN
        RAISE EXCEPTION 'A verified Turnstile token is required to place an order';
    END IF;

    DELETE FROM public.verified_tokens
    WHERE token = v_verified_token
      AND action IN ('order', 'checkout')
      AND expires_at > now()
    RETURNING id INTO v_consumed_token_id;

    IF v_consumed_token_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired security token. Please verify again.';
    END IF;

    -- 5. Validate Customer Details
    IF p_order->>'customer_name' IS NULL OR length(trim(p_order->>'customer_name')) < 2 THEN
        RAISE EXCEPTION 'Invalid customer name: minimum 2 characters required';
    END IF;

    IF p_order->>'customer_phone' IS NULL OR length(trim(p_order->>'customer_phone')) < 10 THEN
        RAISE EXCEPTION 'Invalid customer phone: minimum 10 digits required';
    END IF;

    IF v_order_type NOT IN ('dine_in', 'takeaway', 'delivery') THEN
        RAISE EXCEPTION 'Invalid order_type: must be dine_in, takeaway, or delivery';
    END IF;

    IF v_order_type = 'dine_in' AND (p_order->>'table_number' IS NULL OR length(trim(p_order->>'table_number')) = 0) THEN
        RAISE EXCEPTION 'Dine-in orders require a valid table_number';
    END IF;

    -- 6. Generate order reference using random code (never sequential)
    v_order_ref := 'CB-' || to_char(CURRENT_DATE, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    -- Generate random payment_token built from two gen_random_uuid
    v_raw_payment_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_payment_token_hash := encode(sha256(v_raw_payment_token::bytea), 'hex');

    -- 7. Determine payment_status
    IF v_payment_method IN ('counter', 'pay_at_counter', 'cash', 'manual') THEN
        v_payment_status := 'pay_at_counter';
        v_payment_required := false;
    ELSE
        v_payment_status := 'pending';
        v_payment_required := true;
    END IF;

    -- 8. Fetch Tax configuration from restaurant_settings
    SELECT 
        COALESCE(rs.tax_enabled, true),
        COALESCE(rs.tax_mode, 'inclusive'),
        COALESCE(rs.tax_rate, 0.0500),
        COALESCE(rs.currency, 'INR')
    INTO 
        v_tax_enabled,
        v_tax_mode,
        v_tax_rate,
        v_currency
    FROM public.restaurant_settings rs
    WHERE rs.restaurant_id = v_restaurant_id
    LIMIT 1;

    -- 9. Iterate items: Authoritative server-side pricing & stock
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := v_item->>'menu_item_id';
        v_quantity := (v_item->>'quantity')::INTEGER;

        IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 50 THEN
            RAISE EXCEPTION 'Invalid item quantity for item %: must be between 1 and 50', v_item_id;
        END IF;

        SELECT mi.price, mi.name, mi.available
        INTO v_db_unit_price, v_db_item_name, v_is_available
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND mi.restaurant_id = v_restaurant_id;

        IF v_db_unit_price IS NULL THEN
            RAISE EXCEPTION 'Item not found in restaurant menu: %', v_item_id;
        END IF;

        IF NOT v_is_available THEN
            RAISE EXCEPTION 'Item % (%) is currently sold out and cannot be ordered', v_db_item_name, v_item_id;
        END IF;

        v_line_total := v_db_unit_price * v_quantity;
        v_computed_subtotal := v_computed_subtotal + v_line_total;
    END LOOP;

    -- 10. Compute Tax
    IF v_tax_enabled THEN
        IF v_tax_mode = 'exclusive' THEN
            v_tax_amount := round(v_computed_subtotal * v_tax_rate, 2);
            v_computed_total := v_computed_subtotal + v_tax_amount;
        ELSE
            v_tax_amount := round(v_computed_subtotal - (v_computed_subtotal / (1.0 + v_tax_rate)), 2);
            v_computed_total := v_computed_subtotal;
        END IF;
    ELSE
        v_tax_amount := 0.00;
        v_computed_total := v_computed_subtotal;
    END IF;

    -- Add tips if enabled
    IF v_tip_amount > 0 THEN
        v_computed_total := v_computed_total + v_tip_amount;
    END IF;

    -- 11. Insert Order Record
    INSERT INTO public.orders (
        restaurant_id,
        order_ref,
        customer_name,
        customer_phone,
        customer_email,
        order_type,
        table_number,
        special_requests,
        subtotal,
        tax_amount,
        total,
        status,
        payment_status,
        payment_required,
        payment_provider,
        payment_token_hash,
        payment_amount,
        currency,
        created_at,
        updated_at
    ) VALUES (
        v_restaurant_id,
        v_order_ref,
        trim(p_order->>'customer_name'),
        trim(p_order->>'customer_phone'),
        nullif(trim(COALESCE(p_order->>'customer_email', '')), ''),
        v_order_type,
        CASE WHEN v_order_type = 'dine_in' THEN trim(p_order->>'table_number') ELSE NULL END,
        nullif(trim(COALESCE(p_order->>'special_requests', '')), ''),
        v_computed_subtotal,
        v_tax_amount,
        v_computed_total,
        'pending',
        v_payment_status,
        v_payment_required,
        nullif(v_payment_method, ''),
        v_payment_token_hash,
        v_computed_total,
        v_currency,
        v_created_at,
        v_created_at
    )
    RETURNING id INTO v_order_id;

    -- 12. Insert Order Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := v_item->>'menu_item_id';
        v_quantity := (v_item->>'quantity')::INTEGER;

        SELECT mi.price, mi.name
        INTO v_db_unit_price, v_db_item_name
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND mi.restaurant_id = v_restaurant_id;

        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price,
            line_total,
            notes,
            created_at
        ) VALUES (
            v_order_id,
            v_item_id,
            v_db_item_name,
            v_quantity,
            v_db_unit_price,
            v_db_unit_price * v_quantity,
            nullif(trim(COALESCE(v_item->>'notes', '')), ''),
            v_created_at
        );
    END LOOP;

    -- Return full order response including single-use unhashed payment_token
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_ref', v_order_ref,
        'subtotal', v_computed_subtotal,
        'tax_amount', v_tax_amount,
        'total', v_computed_total,
        'payment_status', v_payment_status,
        'payment_required', v_payment_required,
        'payment_token', v_raw_payment_token
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. SERVER ENFORCEMENT: Update create_reservation_atomic with reservations feature check
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_reservation_atomic(
    p_reservation JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_res_id UUID;
    v_res_ref TEXT;
    v_restaurant_id TEXT;
    v_verified_token TEXT;
    v_consumed_token_id UUID;
    v_customer_name TEXT;
    v_customer_phone TEXT;
    v_party_size INTEGER;
    v_date DATE;
    v_time TEXT;
BEGIN
    IF p_reservation IS NULL OR jsonb_typeof(p_reservation) <> 'object' THEN
        RAISE EXCEPTION 'Reservation payload must be a valid JSON object';
    END IF;

    -- 1. Read restaurant_id from settings
    SELECT rs.restaurant_id
    INTO v_restaurant_id
    FROM public.restaurant_settings rs
    LIMIT 1;

    IF v_restaurant_id IS NULL OR trim(v_restaurant_id) = '' THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- 2. Feature Toggle Check: Table reservations
    IF NOT public.is_feature_enabled('reservations', v_restaurant_id) THEN
        RAISE EXCEPTION 'Table reservations are currently disabled by the restaurant.';
    END IF;

    -- 3. Turnstile Bot Defense: Require verified single-use token
    v_verified_token := trim(COALESCE(p_reservation->>'verified_token', ''));
    IF v_verified_token = '' THEN
        RAISE EXCEPTION 'A verified Turnstile token is required to make a reservation';
    END IF;

    DELETE FROM public.verified_tokens
    WHERE token = v_verified_token
      AND action IN ('reservation', 'table_booking')
      AND expires_at > now()
    RETURNING id INTO v_consumed_token_id;

    IF v_consumed_token_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired security token. Please verify again.';
    END IF;

    -- 4. Validate fields
    v_customer_name := trim(COALESCE(p_reservation->>'customer_name', ''));
    IF length(v_customer_name) < 2 THEN
        RAISE EXCEPTION 'Invalid customer name: minimum 2 characters required';
    END IF;

    v_customer_phone := trim(COALESCE(p_reservation->>'customer_phone', ''));
    IF length(v_customer_phone) < 10 THEN
        RAISE EXCEPTION 'Invalid customer phone: minimum 10 digits required';
    END IF;

    v_party_size := (p_reservation->>'party_size')::INTEGER;
    IF v_party_size IS NULL OR v_party_size < 1 OR v_party_size > 20 THEN
        RAISE EXCEPTION 'Invalid party size: must be between 1 and 20';
    END IF;

    v_date := (p_reservation->>'reservation_date')::DATE;
    IF v_date IS NULL OR v_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'Reservation date cannot be in the past';
    END IF;

    v_time := trim(COALESCE(p_reservation->>'reservation_time', ''));
    IF v_time = '' THEN
        RAISE EXCEPTION 'Reservation time is required';
    END IF;

    -- 5. Generate secure random reservation reference
    v_res_ref := 'RS-' || to_char(CURRENT_DATE, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    -- 6. Insert Reservation Record
    INSERT INTO public.reservations (
        restaurant_id,
        reservation_ref,
        customer_name,
        customer_phone,
        customer_email,
        party_size,
        reservation_date,
        reservation_time,
        table_number,
        special_requests,
        status,
        created_at,
        updated_at
    ) VALUES (
        v_restaurant_id,
        v_res_ref,
        v_customer_name,
        v_customer_phone,
        nullif(trim(COALESCE(p_reservation->>'customer_email', '')), ''),
        v_party_size,
        v_date,
        v_time,
        nullif(trim(COALESCE(p_reservation->>'table_number', '')), ''),
        nullif(trim(COALESCE(p_reservation->>'special_requests', '')), ''),
        'pending',
        now(),
        now()
    )
    RETURNING id INTO v_res_id;

    RETURN jsonb_build_object(
        'success', true,
        'reservation_id', v_res_id,
        'reservation_ref', v_res_ref
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. SERVER ENFORCEMENT: Update validate_discount_code with discounts feature check
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_discount_code(code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_code RECORD;
    v_restaurant_id TEXT;
BEGIN
    SELECT rs.restaurant_id INTO v_restaurant_id
    FROM public.restaurant_settings rs
    LIMIT 1;

    IF NOT public.is_feature_enabled('discounts', v_restaurant_id) THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Discounts and promotional coupons are currently disabled by the restaurant.');
    END IF;

    SELECT * INTO v_code
    FROM public.discount_codes
    WHERE upper(trim(discount_codes.code)) = upper(trim(validate_discount_code.code))
      AND is_active = true
      AND (valid_from IS NULL OR valid_from <= now())
      AND (valid_until IS NULL OR valid_until >= now());

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired discount code');
    END IF;

    IF v_code.max_uses IS NOT NULL AND v_code.current_uses >= v_code.max_uses THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Discount code has reached its usage limit');
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'code', v_code.code,
        'type', v_code.type,
        'value', v_code.value,
        'min_order_amount', v_code.min_order_amount,
        'max_discount_amount', v_code.max_discount_amount
    );
END;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 023_dated_tax_registry.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 023_dated_tax_registry.sql
-- Description:
-- 1. Dated Tax Rules Table (public.tax_rules):
--    - country, region, rule_label, rate, mode, applies_to (categories),
--      order_type (all/dine_in/takeaway/delivery), effective_from, effective_to,
--      source_url, last_verified_at, status (verified/unverified).
-- 2. Extended Item Categories:
--    - food, hot_drink, soft_drink, bottled_water, alcohol, tobacco,
--      packaged_goods, service, exempt.
--    - Adds tax_category to menu_items and order_items.
-- 3. Restaurant Settings Governance:
--    - country, region, accountant_verified, accountant_verified_at,
--      accountant_notes, cover_charge, cover_charge_label, cover_charge_taxable.
-- 4. Seed Verified Rules for Core 14 Jurisdictions:
--    - Ireland (IE), United Kingdom (GB), United States (US: NY, CA, TX, FL),
--      Canada (CA: ON, BC, AB), Australia (AU), New Zealand (NZ), UAE (AE),
--      Singapore (SG: 8% 2023 -> 9% 2024), India (IN: standalone 5%, hotel premises 18%,
--      alcohol outside GST 0%), Germany (DE: 7% temp dine-in -> 19% 2024),
--      France (FR), Spain (ES), Italy (IT), Netherlands (NL).
-- 5. Updated create_order_atomic:
--    - Date-aware rule resolution on order date (CURRENT_DATE).
--    - Go-live protection: Blocks live ordering if accountant has not confirmed
--      or if active rules are unverified.
--    - Item category tax resolution (exempt items = 0%).
--    - Tips invariant: strictly NEVER taxed across all jurisdictions.
--    - Emits dated receipt tax breakdown with rates_as_of date and tax ID.
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DATED TAX RULES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country VARCHAR(10) NOT NULL,
    region VARCHAR(50) NOT NULL DEFAULT 'ALL',
    rule_label VARCHAR(100) NOT NULL,
    rate NUMERIC(6, 4) NOT NULL,
    mode VARCHAR(20) NOT NULL DEFAULT 'inclusive' CHECK (mode IN ('inclusive', 'exclusive')),
    applies_to TEXT[] NOT NULL,
    order_type VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (order_type IN ('all', 'dine_in', 'takeaway', 'delivery')),
    effective_from DATE NOT NULL,
    effective_to DATE,
    source_url TEXT NOT NULL,
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status VARCHAR(20) NOT NULL DEFAULT 'verified' CHECK (status IN ('verified', 'unverified', 'conflict')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_effective_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_tax_rules_lookup 
ON public.tax_rules(country, region, status, effective_from, effective_to);

-- Row Level Security
ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tax_rules' AND policyname = 'Allow public read access to tax rules'
    ) THEN
        CREATE POLICY "Allow public read access to tax rules" 
        ON public.tax_rules FOR SELECT USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tax_rules' AND policyname = 'Allow owners and service role to manage tax rules'
    ) THEN
        CREATE POLICY "Allow owners and service role to manage tax rules" 
        ON public.tax_rules FOR ALL 
        USING (
            COALESCE(auth.role(), '') = 'service_role' OR 
            EXISTS (SELECT 1 FROM public.staff_profiles WHERE user_id = auth.uid() AND role = 'owner')
        );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. SCHEMA ADDITIONS ON EXISTING TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS tax_category VARCHAR(30) DEFAULT 'food';

ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS tax_category VARCHAR(30) DEFAULT 'food';

ALTER TABLE public.restaurant_settings 
ADD COLUMN IF NOT EXISTS country VARCHAR(10) DEFAULT 'IN',
ADD COLUMN IF NOT EXISTS region VARCHAR(50) DEFAULT 'ALL',
ADD COLUMN IF NOT EXISTS accountant_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS accountant_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS accountant_notes TEXT,
ADD COLUMN IF NOT EXISTS cover_charge NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS cover_charge_label VARCHAR(50) DEFAULT 'Cover Charge',
ADD COLUMN IF NOT EXISTS cover_charge_taxable BOOLEAN DEFAULT FALSE;

-- ------------------------------------------------------------------------------
-- 3. SEED DATED RULES FOR 14 CORE JURISDICTIONS
-- ------------------------------------------------------------------------------
DELETE FROM public.tax_rules WHERE country IN (
    'IE', 'GB', 'US', 'CA', 'AU', 'NZ', 'AE', 'SG', 'IN', 'DE', 'FR', 'ES', 'IT', 'NL'
);

INSERT INTO public.tax_rules (
    country, region, rule_label, rate, mode, applies_to, order_type,
    effective_from, effective_to, source_url, status
) VALUES
-- Ireland (IE)
('IE', 'ALL', 'VAT Restaurant Food & Hot Drinks', 0.0900, 'inclusive',
 ARRAY['food', 'hot_drink'], 'all', '2023-09-01', NULL,
 'https://www.revenue.ie/en/vat/vat-rates/search-vat-rates/restaurant-services.aspx', 'verified'),
('IE', 'ALL', 'VAT Standard (Alcohol & Cold Packaged Drinks)', 0.2300, 'inclusive',
 ARRAY['soft_drink', 'bottled_water', 'alcohol'], 'all', '2021-03-01', NULL,
 'https://www.revenue.ie/en/vat/vat-rates/search-vat-rates/alcoholic-drinks.aspx', 'verified'),

-- United Kingdom (GB)
('GB', 'ALL', 'Standard Rate VAT', 0.2000, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol'], 'all', '2011-01-04', NULL,
 'https://www.gov.uk/guidance/catering-takeaway-food-and-vat-notice-7091', 'verified'),
('GB', 'ALL', 'Zero-rate Takeaway Cold Food', 0.0000, 'inclusive',
 ARRAY['food'], 'takeaway', '2011-01-04', NULL,
 'https://www.gov.uk/guidance/catering-takeaway-food-and-vat-notice-7091#cold-takeaway-food', 'verified'),

-- United States (US: State-level)
('US', 'NY', 'NYS and Local Sales Tax (NYC)', 0.08875, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2020-01-01', NULL,
 'https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/sales_by_restaurants.htm', 'verified'),
('US', 'CA', 'California State & Local Sales Tax', 0.0725, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2020-01-01', NULL,
 'https://www.cdtfa.ca.gov/formspubs/pub22.pdf', 'verified'),
('US', 'TX', 'Texas State & Local Sales Tax', 0.0825, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2020-01-01', NULL,
 'https://comptroller.texas.gov/taxes/publications/96-117.php', 'verified'),
('US', 'FL', 'Florida Sales Tax', 0.0600, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2020-01-01', NULL,
 'https://floridarevenue.com/taxes/taxesfees/Pages/sales_tax.aspx', 'verified'),

-- Canada (CA: Province-level)
('CA', 'ON', 'Ontario Harmonized Sales Tax (HST)', 0.1300, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2010-07-01', NULL,
 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html', 'verified'),
('CA', 'BC', 'British Columbia GST + PST', 0.1200, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2013-04-01', NULL,
 'https://www2.gov.bc.ca/gov/content/taxes/sales-taxes/pst/publications/restaurant-food-services', 'verified'),
('CA', 'AB', 'Alberta GST', 0.0500, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2008-01-01', NULL,
 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html', 'verified'),

-- Australia (AU)
('AU', 'ALL', 'Goods and Services Tax (GST)', 0.1000, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2000-07-01', NULL,
 'https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/in-detail/your-industry/restaurant-and-catering', 'verified'),

-- New Zealand (NZ)
('NZ', 'ALL', 'Goods and Services Tax (GST)', 0.1500, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2010-10-01', NULL,
 'https://www.ird.govt.nz/gst', 'verified'),

-- United Arab Emirates (AE)
('AE', 'ALL', 'UAE Value Added Tax (VAT)', 0.0500, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2018-01-01', NULL,
 'https://tax.gov.ae/en/legislation/vat-legislation.aspx', 'verified'),

-- Singapore (SG: Dated rate increase 8% in 2023 -> 9% in 2024)
('SG', 'ALL', 'Singapore GST 2023', 0.0800, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2023-01-01', '2023-12-31',
 'https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/gst-rate-change', 'verified'),
('SG', 'ALL', 'Singapore GST 2024+', 0.0900, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2024-01-01', NULL,
 'https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/gst-rate-change', 'verified'),

-- India (IN: Standalone 5% without ITC, Hotel Premises 18% with ITC, Alcohol outside GST)
('IN', 'STANDALONE', 'GST Standalone Restaurant (without ITC)', 0.0500, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'packaged_goods'], 'all', '2017-11-15', NULL,
 'https://cbic-gst.gov.in/pdf/notification-46-2017-central-tax-rate.pdf', 'verified'),
('IN', 'HOTEL_PREMISES', 'GST Hotel Premises declared tariff >= 7500 (with ITC)', 0.1800, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'packaged_goods'], 'all', '2019-10-01', NULL,
 'https://cbic-gst.gov.in/pdf/notification-20-2019-central-tax-rate.pdf', 'verified'),
('IN', 'ALL', 'GST Standalone Restaurant (without ITC)', 0.0500, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'packaged_goods'], 'all', '2017-11-15', NULL,
 'https://cbic-gst.gov.in/pdf/notification-46-2017-central-tax-rate.pdf', 'verified'),
('IN', 'ALL', 'Alcohol for Human Consumption (outside GST)', 0.0000, 'inclusive',
 ARRAY['alcohol'], 'all', '2017-07-01', NULL,
 'https://cbic-gst.gov.in/gst-goods-services-rates.html', 'verified'),

-- Germany (DE: Dated transition - 7% temp dine-in food ended 2023-12-31 -> 19% standard 2024+)
('DE', 'ALL', 'Temporary Reduced MwSt Restaurant Food (COVID/Energy Relief)', 0.0700, 'inclusive',
 ARRAY['food'], 'dine_in', '2020-07-01', '2023-12-31',
 'https://www.bundesfinanzministerium.de', 'verified'),
('DE', 'ALL', 'Standard MwSt Restaurant Services', 0.1900, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2024-01-01', NULL,
 'https://www.bundesfinanzministerium.de', 'verified'),
('DE', 'ALL', 'Takeaway Food Reduced MwSt', 0.0700, 'inclusive',
 ARRAY['food'], 'takeaway', '2024-01-01', NULL,
 'https://www.bundesfinanzministerium.de', 'verified'),

-- France (FR: 10% food/soft drinks, 20% alcohol)
('FR', 'ALL', 'TVA Restauration (Alimentation & Boissons sans alcool)', 0.1000, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water'], 'all', '2014-01-01', NULL,
 'https://www.economie.gouv.fr/entreprises/taux-tva-restauration', 'verified'),
('FR', 'ALL', 'TVA Boissons Alcooliques', 0.2000, 'inclusive',
 ARRAY['alcohol'], 'all', '2014-01-01', NULL,
 'https://www.economie.gouv.fr/entreprises/taux-tva-restauration', 'verified'),

-- Spain (ES: 10% food/soft drinks, 21% alcohol)
('ES', 'ALL', 'IVA Reducido Hostelería', 0.1000, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water'], 'all', '2012-09-01', NULL,
 'https://sede.agenciatributaria.gob.es', 'verified'),
('ES', 'ALL', 'IVA General Bebidas Alcohólicas', 0.2100, 'inclusive',
 ARRAY['alcohol'], 'all', '2012-09-01', NULL,
 'https://sede.agenciatributaria.gob.es', 'verified'),

-- Italy (IT: 10% food/soft drinks, 22% alcohol)
('IT', 'ALL', 'IVA Ridotta Ristorazione', 0.1000, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water'], 'all', '2013-10-01', NULL,
 'https://www.agenziaentrate.gov.it', 'verified'),
('IT', 'ALL', 'IVA Ordinaria Bevande Alcoliche', 0.2200, 'inclusive',
 ARRAY['alcohol'], 'all', '2013-10-01', NULL,
 'https://www.agenziaentrate.gov.it', 'verified'),

-- Netherlands (NL: 9% food/soft drinks, 21% alcohol)
('NL', 'ALL', 'BTW Laag Tarief Voedingsmiddelen & Alcoholvrije Dranken', 0.0900, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water'], 'all', '2019-01-01', NULL,
 'https://www.belastingdienst.nl', 'verified'),
('NL', 'ALL', 'BTW Hoog Tarief Alcoholhoudende Dranken', 0.2100, 'inclusive',
 ARRAY['alcohol'], 'all', '2019-01-01', NULL,
 'https://www.belastingdienst.nl', 'verified');

-- ------------------------------------------------------------------------------
-- 4. HELPER FUNCTION: resolve_dated_tax_rate
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_dated_tax_rate(
    p_country TEXT,
    p_region TEXT,
    p_category TEXT,
    p_order_type TEXT,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    rule_label VARCHAR,
    rate NUMERIC,
    mode VARCHAR,
    status VARCHAR
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    -- Category 'exempt' is always zero tax
    IF p_category = 'exempt' THEN
        RETURN QUERY SELECT 'Tax Exempt'::VARCHAR, 0.0000::NUMERIC, 'inclusive'::VARCHAR, 'verified'::VARCHAR;
        RETURN;
    END IF;

    -- Look up matching rule valid on the specified date
    RETURN QUERY
    SELECT tr.rule_label, tr.rate, tr.mode, tr.status
    FROM public.tax_rules tr
    WHERE tr.country = p_country
      AND (tr.region = p_region OR tr.region = 'ALL')
      AND (tr.order_type = 'all' OR tr.order_type = p_order_type)
      AND p_category = ANY(tr.applies_to)
      AND tr.effective_from <= p_date
      AND (tr.effective_to IS NULL OR tr.effective_to >= p_date)
      AND tr.status = 'verified'
    ORDER BY 
      CASE WHEN tr.region = p_region THEN 0 ELSE 1 END,
      CASE WHEN tr.order_type = p_order_type THEN 0 ELSE 1 END,
      tr.effective_from DESC
    LIMIT 1;

    -- Fallback if no specific rule matched
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Standard Tax'::VARCHAR, 0.0500::NUMERIC, 'inclusive'::VARCHAR, 'verified'::VARCHAR;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_dated_tax_rate(TEXT, TEXT, TEXT, TEXT, DATE) TO authenticated, anon, service_role;

-- ------------------------------------------------------------------------------
-- 5. UPDATED create_order_atomic WITH DATED TAX REGISTRY ENFORCEMENT
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order JSONB,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_order_ref TEXT;
    v_restaurant_id TEXT;
    v_verified_token TEXT;
    v_consumed_token_id UUID;
    v_raw_payment_token TEXT;
    v_payment_token_hash TEXT;
    v_item JSONB;
    v_item_id TEXT;
    v_quantity INTEGER;
    v_db_unit_price NUMERIC;
    v_db_item_name TEXT;
    v_item_tax_cat TEXT;
    v_is_available BOOLEAN;
    v_line_total NUMERIC;
    v_computed_subtotal NUMERIC := 0.00;
    v_computed_total NUMERIC := 0.00;
    v_tax_amount NUMERIC := 0.00;
    v_discount_amount NUMERIC := 0.00;
    v_tip_amount NUMERIC := 0.00;
    
    -- Restaurant & Tax Registry settings
    v_tax_enabled BOOLEAN := true;
    v_currency TEXT := 'INR';
    v_country TEXT := 'IN';
    v_region TEXT := 'ALL';
    v_accountant_verified BOOLEAN := false;
    v_tax_id TEXT := NULL;
    v_tax_id_label TEXT := 'GSTIN';
    v_is_ordering_enabled BOOLEAN := true;
    v_order_date DATE := CURRENT_DATE;
    
    -- Item-level tax tracking
    v_rule_label VARCHAR;
    v_rule_rate NUMERIC;
    v_rule_mode VARCHAR;
    v_rule_status VARCHAR;
    v_line_tax NUMERIC;
    v_item_tax_summary JSONB := '[]'::jsonb;
    
    -- Payment fields
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_payment_required BOOLEAN;
    v_order_type TEXT;
    v_created_at TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    -- 1. Read restaurant settings & tax governance
    SELECT 
        rs.restaurant_id,
        COALESCE(rs.tax_enabled, true),
        COALESCE(rs.currency, 'INR'),
        COALESCE(rs.country, 'IN'),
        COALESCE(rs.region, 'ALL'),
        COALESCE(rs.accountant_verified, false),
        rs.tax_id,
        COALESCE(rs.tax_id_label, 'Tax ID'),
        COALESCE(rs.is_ordering_enabled, true)
    INTO 
        v_restaurant_id,
        v_tax_enabled,
        v_currency,
        v_country,
        v_region,
        v_accountant_verified,
        v_tax_id,
        v_tax_id_label,
        v_is_ordering_enabled
    FROM public.restaurant_settings rs
    LIMIT 1;

    IF v_restaurant_id IS NULL OR trim(v_restaurant_id) = '' THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- 2. Feature Toggle & Operational Gates
    IF NOT public.is_feature_enabled('online_ordering', v_restaurant_id) OR NOT v_is_ordering_enabled THEN
        RAISE EXCEPTION 'Online ordering is currently disabled for this restaurant.';
    END IF;

    -- 3. GO-LIVE PROTECTION: Accountant Verification & Unverified Rules Gate
    -- Live order placement is strictly blocked until an accountant confirms settings
    -- and no active rules for this country/region are unverified.
    IF NOT v_accountant_verified THEN
        RAISE EXCEPTION 'LIVE_ORDERING_BLOCKED: Tax rules and compliance configuration must be verified and signed off by an accountant before taking customer orders.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.tax_rules tr
        WHERE tr.country = v_country
          AND (tr.region = v_region OR tr.region = 'ALL')
          AND tr.status <> 'verified'
          AND tr.effective_from <= v_order_date
          AND (tr.effective_to IS NULL OR tr.effective_to >= v_order_date)
    ) THEN
        RAISE EXCEPTION 'LIVE_ORDERING_BLOCKED: Unverified tax rules exist for % (region: %). All rules must be verified before going live.', v_country, v_region;
    END IF;

    v_order_type := lower(trim(COALESCE(p_order->>'order_type', '')));

    IF v_order_type = 'dine_in' AND NOT public.is_feature_enabled('qr_table_ordering', v_restaurant_id) THEN
        RAISE EXCEPTION 'QR Table Ordering is currently disabled for this restaurant.';
    END IF;

    IF v_order_type = 'takeaway' AND NOT public.is_feature_enabled('takeaway', v_restaurant_id) THEN
        RAISE EXCEPTION 'Takeaway ordering is currently disabled for this restaurant.';
    END IF;

    IF v_order_type = 'delivery' AND NOT public.is_feature_enabled('delivery', v_restaurant_id) THEN
        RAISE EXCEPTION 'Delivery ordering is currently disabled for this restaurant.';
    END IF;

    v_payment_method := lower(trim(COALESCE(
        p_order->>'payment_method',
        p_order->>'payment_provider',
        ''
    )));

    IF v_payment_method NOT IN ('counter', 'pay_at_counter', 'cash', 'manual', '') 
       AND NOT public.is_feature_enabled('online_payments', v_restaurant_id) THEN
        RAISE EXCEPTION 'Online payments are currently disabled by the restaurant. Please choose Pay at Counter.';
    END IF;

    IF p_order->>'discount_code' IS NOT NULL AND length(trim(p_order->>'discount_code')) > 0 
       AND NOT public.is_feature_enabled('discounts', v_restaurant_id) THEN
        RAISE EXCEPTION 'Discounts and promotional coupons are currently disabled.';
    END IF;

    v_tip_amount := COALESCE((p_order->>'tip_amount')::numeric, 0.00);
    IF v_tip_amount > 0 AND NOT public.is_feature_enabled('tips', v_restaurant_id) THEN
        RAISE EXCEPTION 'Tips and gratuities are currently disabled.';
    END IF;

    -- 4. Input Validation: Check items array
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cannot create an order with empty items';
    END IF;

    IF jsonb_array_length(p_items) > 40 THEN
        RAISE EXCEPTION 'Order cannot contain more than 40 distinct items';
    END IF;

    -- 5. Turnstile Bot Defense: Require verified single-use token
    v_verified_token := trim(COALESCE(p_order->>'verified_token', ''));
    IF v_verified_token = '' THEN
        RAISE EXCEPTION 'A verified Turnstile token is required to place an order';
    END IF;

    DELETE FROM public.verified_tokens
    WHERE token = v_verified_token
      AND action IN ('order', 'checkout')
      AND expires_at > now()
    RETURNING id INTO v_consumed_token_id;

    IF v_consumed_token_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired security token. Please verify again.';
    END IF;

    -- 6. Validate Customer Details
    IF p_order->>'customer_name' IS NULL OR length(trim(p_order->>'customer_name')) < 2 THEN
        RAISE EXCEPTION 'Invalid customer name: minimum 2 characters required';
    END IF;

    IF p_order->>'customer_phone' IS NULL OR length(trim(p_order->>'customer_phone')) < 10 THEN
        RAISE EXCEPTION 'Invalid customer phone: minimum 10 digits required';
    END IF;

    IF v_order_type NOT IN ('dine_in', 'takeaway', 'delivery') THEN
        RAISE EXCEPTION 'Invalid order_type: must be dine_in, takeaway, or delivery';
    END IF;

    IF v_order_type = 'dine_in' AND (p_order->>'table_number' IS NULL OR length(trim(p_order->>'table_number')) = 0) THEN
        RAISE EXCEPTION 'Dine-in orders require a valid table_number';
    END IF;

    -- 7. Generate order reference & single-use payment token
    v_order_ref := 'CB-' || to_char(CURRENT_DATE, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    v_raw_payment_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_payment_token_hash := encode(sha256(v_raw_payment_token::bytea), 'hex');

    -- 8. Determine payment_status
    IF v_payment_method IN ('counter', 'pay_at_counter', 'cash', 'manual') THEN
        v_payment_status := 'pay_at_counter';
        v_payment_required := false;
    ELSE
        v_payment_status := 'pending';
        v_payment_required := true;
    END IF;

    -- 9. Iterate items: Price & Dated Tax Category Resolution
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := v_item->>'menu_item_id';
        v_quantity := (v_item->>'quantity')::INTEGER;

        IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 50 THEN
            RAISE EXCEPTION 'Invalid item quantity for item %: must be between 1 and 50', v_item_id;
        END IF;

        SELECT mi.price, mi.name, mi.available, COALESCE(mi.tax_category, 'food')
        INTO v_db_unit_price, v_db_item_name, v_is_available, v_item_tax_cat
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND mi.restaurant_id = v_restaurant_id;

        IF v_db_unit_price IS NULL THEN
            RAISE EXCEPTION 'Item not found in restaurant menu: %', v_item_id;
        END IF;

        IF NOT v_is_available THEN
            RAISE EXCEPTION 'Item % (%) is currently sold out and cannot be ordered', v_db_item_name, v_item_id;
        END IF;

        v_line_total := v_db_unit_price * v_quantity;
        v_computed_subtotal := v_computed_subtotal + v_line_total;

        -- Resolve dated tax rule valid on v_order_date
        IF v_tax_enabled THEN
            SELECT r.rule_label, r.rate, r.mode, r.status
            INTO v_rule_label, v_rule_rate, v_rule_mode, v_rule_status
            FROM public.resolve_dated_tax_rate(
                v_country,
                v_region,
                v_item_tax_cat,
                v_order_type,
                v_order_date
            ) r;

            IF v_rule_mode = 'exclusive' THEN
                v_line_tax := round(v_line_total * v_rule_rate, 2);
                v_computed_total := v_computed_total + v_line_total + v_line_tax;
            ELSE
                v_line_tax := round(v_line_total - (v_line_total / (1.0 + v_rule_rate)), 2);
                v_computed_total := v_computed_total + v_line_total;
            END IF;

            v_tax_amount := v_tax_amount + v_line_tax;
            v_item_tax_summary := v_item_tax_summary || jsonb_build_object(
                'item_id', v_item_id,
                'category', v_item_tax_cat,
                'label', v_rule_label,
                'rate', v_rule_rate,
                'mode', v_rule_mode,
                'tax', v_line_tax
            );
        ELSE
            v_computed_total := v_computed_total + v_line_total;
        END IF;
    END LOOP;

    -- Add tips: Invariant — Tips are NEVER taxed!
    IF v_tip_amount > 0 THEN
        v_computed_total := v_computed_total + v_tip_amount;
    END IF;

    -- 10. Insert Order Record
    INSERT INTO public.orders (
        restaurant_id,
        order_ref,
        customer_name,
        customer_phone,
        customer_email,
        order_type,
        table_number,
        special_requests,
        subtotal,
        tax_amount,
        total,
        status,
        payment_status,
        payment_required,
        payment_provider,
        payment_token_hash,
        payment_amount,
        currency,
        created_at,
        updated_at
    ) VALUES (
        v_restaurant_id,
        v_order_ref,
        trim(p_order->>'customer_name'),
        trim(p_order->>'customer_phone'),
        nullif(trim(COALESCE(p_order->>'customer_email', '')), ''),
        v_order_type,
        CASE WHEN v_order_type = 'dine_in' THEN trim(p_order->>'table_number') ELSE NULL END,
        nullif(trim(COALESCE(p_order->>'special_requests', '')), ''),
        v_computed_subtotal,
        v_tax_amount,
        v_computed_total,
        'pending',
        v_payment_status,
        v_payment_required,
        nullif(v_payment_method, ''),
        v_payment_token_hash,
        v_computed_total,
        v_currency,
        v_created_at,
        v_created_at
    )
    RETURNING id INTO v_order_id;

    -- 11. Insert Order Items (with tax_category recorded)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := v_item->>'menu_item_id';
        v_quantity := (v_item->>'quantity')::INTEGER;

        SELECT mi.price, mi.name, COALESCE(mi.tax_category, 'food')
        INTO v_db_unit_price, v_db_item_name, v_item_tax_cat
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND mi.restaurant_id = v_restaurant_id;

        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price,
            line_total,
            tax_category,
            notes,
            created_at
        ) VALUES (
            v_order_id,
            v_item_id,
            v_db_item_name,
            v_quantity,
            v_db_unit_price,
            v_db_unit_price * v_quantity,
            v_item_tax_cat,
            nullif(trim(COALESCE(v_item->>'notes', '')), ''),
            v_created_at
        );
    END LOOP;

    -- 12. Return full response with dated tax receipt metadata
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_ref', v_order_ref,
        'subtotal', v_computed_subtotal,
        'tax_amount', v_tax_amount,
        'total', v_computed_total,
        'payment_status', v_payment_status,
        'payment_required', v_payment_required,
        'payment_token', v_raw_payment_token,
        'currency', v_currency,
        'tax_breakdown', jsonb_build_object(
            'rates_as_of', to_char(v_order_date, 'YYYY-MM-DD'),
            'tax_id', v_tax_id,
            'tax_id_label', v_tax_id_label,
            'lines', v_item_tax_summary
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF: 024_financial_parity_tax_and_money_logic.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- Migration: 024_financial_parity_tax_and_money_logic.sql
-- Description:
-- 1. ISO 4217 Currency Minor Unit Resolution Helper:
--    - get_currency_decimals(p_currency TEXT) RETURNS INTEGER
--    - Supports 0 decimals (JPY, KRW, VND, CLP, etc.), 3 decimals (BHD, KWD, OMR, etc.), standard 2 decimals.
-- 2. Restaurant Settings Financial Parity Columns:
--    - tax_rules JSONB (multi-rate category taxes and split rules)
--    - tax_rounding_mode TEXT ('total' or 'line')
--    - service_charge_enabled BOOLEAN
--    - service_charge_rate NUMERIC
--    - service_charge_label TEXT
--    - service_charge_taxable BOOLEAN
--    - service_charge_optional BOOLEAN
-- 3. Orders Table Financial Parity Columns:
--    - discount_amount NUMERIC(12,4)
--    - discounted_subtotal NUMERIC(12,4)
--    - service_charge_amount NUMERIC(12,4)
--    - tax_breakdown JSONB
-- 4. Authoritative create_order_atomic Financial Engine:
--    - Strict Financial Order: Subtotal -> Discount -> Service Charge -> Tax -> Grand Total.
--    - Removes silent 5% and INR fallbacks: Fails loudly if restaurant settings are missing.
--    - Strict tenant scoping: WHERE rs.restaurant_id = v_restaurant_id (no blind LIMIT 1).
--    - Multi-rate tax by category (inclusive divides by 1 + rate; exclusive adds on top).
--    - Split rule parity (CGST + SGST strictly equal single GST with residual absorption).
--    - Mixed inclusive/exclusive rule combination.
--    - Full currency minor-unit precision across all intermediate and final calculations.
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ISO 4217 CURRENCY MINOR UNIT RESOLUTION FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_currency_decimals(p_currency TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT CASE upper(trim(COALESCE(p_currency, '')))
        -- 0 decimals (no minor unit)
        WHEN 'BIF' THEN 0
        WHEN 'CLP' THEN 0
        WHEN 'DJF' THEN 0
        WHEN 'GNF' THEN 0
        WHEN 'ISK' THEN 0
        WHEN 'JPY' THEN 0
        WHEN 'KMF' THEN 0
        WHEN 'KRW' THEN 0
        WHEN 'PYG' THEN 0
        WHEN 'RWF' THEN 0
        WHEN 'UGX' THEN 0
        WHEN 'UYI' THEN 0
        WHEN 'VND' THEN 0
        WHEN 'VUV' THEN 0
        WHEN 'XAF' THEN 0
        WHEN 'XOF' THEN 0
        WHEN 'XPF' THEN 0
        -- 3 decimals (1/1000 minor unit)
        WHEN 'BHD' THEN 3
        WHEN 'IQD' THEN 3
        WHEN 'JOD' THEN 3
        WHEN 'KWD' THEN 3
        WHEN 'LYD' THEN 3
        WHEN 'OMR' THEN 3
        WHEN 'TND' THEN 3
        -- Standard 2 decimals (INR, USD, EUR, GBP, CAD, AUD, SGD, etc.)
        ELSE 2
    END;
$$;

GRANT EXECUTE ON FUNCTION public.get_currency_decimals(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. SCHEMA EXPANSION ON RESTAURANT_SETTINGS
-- ------------------------------------------------------------------------------
ALTER TABLE public.restaurant_settings
ADD COLUMN IF NOT EXISTS tax_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tax_rounding_mode TEXT NOT NULL DEFAULT 'total',
ADD COLUMN IF NOT EXISTS service_charge_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS service_charge_rate NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS service_charge_label TEXT NOT NULL DEFAULT 'Service Charge',
ADD COLUMN IF NOT EXISTS service_charge_taxable BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS service_charge_optional BOOLEAN NOT NULL DEFAULT false;

-- ------------------------------------------------------------------------------
-- 3. SCHEMA EXPANSION ON ORDERS
-- ------------------------------------------------------------------------------
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS discounted_subtotal NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS service_charge_amount NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS tax_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ------------------------------------------------------------------------------
-- 4. AUTHORITATIVE create_order_atomic (FINANCIAL PARITY REWRITE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order JSONB,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_order_ref TEXT;
    v_restaurant_id TEXT;
    v_verified_token TEXT;
    v_consumed_token_id UUID;
    v_raw_payment_token TEXT;
    v_payment_token_hash TEXT;
    v_order_type TEXT;
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_payment_required BOOLEAN;
    v_created_at TIMESTAMPTZ := timezone('utc'::text, now());

    -- Restaurant settings fields (no silent defaults)
    v_tax_enabled BOOLEAN;
    v_tax_mode TEXT;
    v_tax_rate NUMERIC;
    v_tax_label TEXT;
    v_tax_rules JSONB;
    v_tax_rounding_mode TEXT;
    v_currency TEXT;
    v_service_charge_enabled BOOLEAN;
    v_service_charge_rate NUMERIC;
    v_service_charge_label TEXT;
    v_service_charge_taxable BOOLEAN;
    v_decimals INTEGER;

    -- Line items calculation structures
    v_item JSONB;
    v_item_id TEXT;
    v_quantity INTEGER;
    v_db_unit_price NUMERIC;
    v_db_item_name TEXT;
    v_item_category TEXT;
    v_is_available BOOLEAN;
    v_unit_price_rounded NUMERIC;
    v_line_total NUMERIC;
    v_calc_items JSONB := '[]'::jsonb;

    -- Financial amounts
    v_raw_subtotal NUMERIC := 0.0000;
    v_raw_discount NUMERIC := 0.0000;
    v_discount_amount NUMERIC := 0.0000;
    v_discounted_subtotal NUMERIC := 0.0000;
    v_discount_ratio NUMERIC := 1.00000000;
    v_service_charge_amount NUMERIC := 0.0000;
    v_total_inclusive_tax NUMERIC := 0.0000;
    v_total_exclusive_tax NUMERIC := 0.0000;
    v_tax_amount NUMERIC := 0.0000;
    v_computed_total NUMERIC := 0.0000;
    v_tip_amount NUMERIC := 0.0000;

    -- Tax calculation loops
    v_rule_group RECORD;
    v_group_rules JSONB;
    v_group_count INTEGER;
    v_group_combined_rate NUMERIC;
    v_group_mode TEXT;
    v_applicable_subtotal NUMERIC;
    v_group_total_tax NUMERIC;
    v_allocated_group_tax NUMERIC;
    v_rule JSONB;
    v_rule_rate NUMERIC;
    v_rule_tax NUMERIC;
    v_calc_item JSONB;
    v_item_disc_line NUMERIC;
    v_tax_lines JSONB := '[]'::jsonb;

    -- Service charge tax
    v_primary_rule JSONB;
    v_sc_tax_rate NUMERIC;
    v_sc_tax_mode TEXT;
    v_sc_tax NUMERIC;
    v_existing_sc_line JSONB;
    v_updated_tax_lines JSONB;
BEGIN
    -- 1. Read restaurant_id from input payload or default to 'the-cafe-barrackpore'
    v_restaurant_id := trim(COALESCE(p_order->>'restaurant_id', 'the-cafe-barrackpore'));
    IF v_restaurant_id = '' THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- 2. FETCH RESTAURANT SETTINGS STRICTLY FOR THIS RESTAURANT_ID (FAIL LOUDLY IF MISSING)
    SELECT 
        rs.tax_enabled,
        rs.tax_mode,
        rs.tax_rate,
        rs.tax_label,
        rs.tax_rules,
        rs.tax_rounding_mode,
        rs.currency,
        rs.service_charge_enabled,
        rs.service_charge_rate,
        rs.service_charge_label,
        rs.service_charge_taxable
    INTO 
        v_tax_enabled,
        v_tax_mode,
        v_tax_rate,
        v_tax_label,
        v_tax_rules,
        v_tax_rounding_mode,
        v_currency,
        v_service_charge_enabled,
        v_service_charge_rate,
        v_service_charge_label,
        v_service_charge_taxable
    FROM public.restaurant_settings rs
    WHERE rs.restaurant_id = v_restaurant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Restaurant settings missing for restaurant_id: %', v_restaurant_id;
    END IF;

    IF v_currency IS NULL OR trim(v_currency) = '' THEN
        RAISE EXCEPTION 'Currency setting is missing for restaurant_id: %', v_restaurant_id;
    END IF;

    IF v_tax_enabled IS NULL THEN
        RAISE EXCEPTION 'tax_enabled setting is missing for restaurant_id: %', v_restaurant_id;
    END IF;

    -- Resolve currency decimal places dynamically using ISO 4217 minor units
    v_decimals := public.get_currency_decimals(v_currency);

    -- 3. Feature Toggle Server Enforcement
    IF NOT public.is_feature_enabled('online_ordering', v_restaurant_id) THEN
        RAISE EXCEPTION 'Online ordering is currently disabled for this restaurant.';
    END IF;

    v_order_type := lower(trim(COALESCE(p_order->>'order_type', '')));

    IF v_order_type = 'dine_in' AND NOT public.is_feature_enabled('qr_table_ordering', v_restaurant_id) THEN
        RAISE EXCEPTION 'QR Table Ordering is currently disabled for this restaurant.';
    END IF;

    IF v_order_type = 'takeaway' AND NOT public.is_feature_enabled('takeaway', v_restaurant_id) THEN
        RAISE EXCEPTION 'Takeaway ordering is currently disabled for this restaurant.';
    END IF;

    IF v_order_type = 'delivery' AND NOT public.is_feature_enabled('delivery', v_restaurant_id) THEN
        RAISE EXCEPTION 'Delivery ordering is currently disabled for this restaurant.';
    END IF;

    v_payment_method := lower(trim(COALESCE(
        p_order->>'payment_method',
        p_order->>'payment_provider',
        ''
    )));

    IF v_payment_method NOT IN ('counter', 'pay_at_counter', 'cash', 'manual', '') 
       AND NOT public.is_feature_enabled('online_payments', v_restaurant_id) THEN
        RAISE EXCEPTION 'Online payments are currently disabled by the restaurant. Please choose Pay at Counter.';
    END IF;

    IF p_order->>'discount_code' IS NOT NULL AND length(trim(p_order->>'discount_code')) > 0 
       AND NOT public.is_feature_enabled('discounts', v_restaurant_id) THEN
        RAISE EXCEPTION 'Discounts and promotional coupons are currently disabled.';
    END IF;

    v_tip_amount := round(COALESCE((p_order->>'tip_amount')::numeric, 0.0), v_decimals);
    IF v_tip_amount > 0 AND NOT public.is_feature_enabled('tips', v_restaurant_id) THEN
        RAISE EXCEPTION 'Tips and gratuities are currently disabled.';
    END IF;

    -- 4. Input Validation: Check items array
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cannot create an order with empty items';
    END IF;

    IF jsonb_array_length(p_items) > 40 THEN
        RAISE EXCEPTION 'Order cannot contain more than 40 distinct items';
    END IF;

    -- 5. Turnstile Bot Defense: Require verified single-use token
    v_verified_token := trim(COALESCE(p_order->>'verified_token', ''));
    IF v_verified_token = '' THEN
        RAISE EXCEPTION 'A verified Turnstile token is required to place an order';
    END IF;

    DELETE FROM public.verified_tokens
    WHERE token = v_verified_token
      AND action IN ('order', 'checkout')
      AND expires_at > now()
    RETURNING id INTO v_consumed_token_id;

    IF v_consumed_token_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired security token. Please verify again.';
    END IF;

    -- 6. Validate Customer Details
    IF p_order->>'customer_name' IS NULL OR length(trim(p_order->>'customer_name')) < 2 THEN
        RAISE EXCEPTION 'Invalid customer name: minimum 2 characters required';
    END IF;

    IF p_order->>'customer_phone' IS NULL OR length(trim(p_order->>'customer_phone')) < 10 THEN
        RAISE EXCEPTION 'Invalid customer phone: minimum 10 digits required';
    END IF;

    IF v_order_type NOT IN ('dine_in', 'takeaway', 'delivery') THEN
        RAISE EXCEPTION 'Invalid order_type: must be dine_in, takeaway, or delivery';
    END IF;

    IF v_order_type = 'dine_in' AND (p_order->>'table_number' IS NULL OR length(trim(p_order->>'table_number')) = 0) THEN
        RAISE EXCEPTION 'Dine-in orders require a valid table_number';
    END IF;

    -- 7. Generate order reference using random code (never sequential)
    v_order_ref := 'CB-' || to_char(CURRENT_DATE, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    -- Generate random payment_token built from two gen_random_uuid
    v_raw_payment_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_payment_token_hash := encode(sha256(v_raw_payment_token::bytea), 'hex');

    -- 8. Determine payment_status
    IF v_payment_method IN ('counter', 'pay_at_counter', 'cash', 'manual') THEN
        v_payment_status := 'pay_at_counter';
        v_payment_required := false;
    ELSE
        v_payment_status := 'pending';
        v_payment_required := true;
    END IF;

    -- 9. Authoritative server-side pricing & line items computation
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        IF v_item_id = '' THEN
            RAISE EXCEPTION 'Missing item identifier in order items';
        END IF;

        BEGIN
            v_quantity := (v_item->>'quantity')::INTEGER;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid item quantity for item "%"', v_item_id;
        END;

        IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 50 THEN
            RAISE EXCEPTION 'Item quantity must be between 1 and 50 (got % for item "%")', COALESCE(v_quantity, 0), v_item_id;
        END IF;

        v_db_unit_price := NULL;
        v_db_item_name := NULL;
        v_item_category := 'food';
        v_is_available := NULL;

        SELECT mi.price, mi.name, mi.available, COALESCE(mi.tax_category, 'food')
        INTO v_db_unit_price, v_db_item_name, v_is_available, v_item_category
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND mi.restaurant_id = v_restaurant_id;

        IF v_db_unit_price IS NULL THEN
            SELECT m.price, m.name, m.available, 'food'
            INTO v_db_unit_price, v_db_item_name, v_is_available, v_item_category
            FROM public.menu m
            WHERE m.id = v_item_id;
        END IF;

        IF v_db_unit_price IS NULL THEN
            RAISE EXCEPTION 'Menu item not found in database: %', v_item_id;
        END IF;

        IF NOT v_is_available THEN
            RAISE EXCEPTION 'Item "%" (%) is currently sold out and cannot be ordered', v_db_item_name, v_item_id;
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.menu_item_availability mia
            WHERE mia.item_id = v_item_id AND mia.is_available = false
        ) THEN
            RAISE EXCEPTION 'Item "%" is currently marked 86''d out of stock', v_db_item_name;
        END IF;

        v_unit_price_rounded := round(v_db_unit_price::numeric, v_decimals);
        v_line_total := round((v_quantity * v_unit_price_rounded)::numeric, v_decimals);
        v_raw_subtotal := round((v_raw_subtotal + v_line_total)::numeric, v_decimals);

        v_calc_items := v_calc_items || jsonb_build_object(
            'menu_item_id', v_item_id,
            'name', v_db_item_name,
            'quantity', v_quantity,
            'unit_price', v_unit_price_rounded,
            'line_total', v_line_total,
            'category', v_item_category,
            'notes', nullif(trim(COALESCE(v_item->>'notes', '')), '')
        );
    END LOOP;

    -- 10. FINANCIAL ORDER OF OPERATIONS
    -- Step 1: Discount is applied first to raw subtotal
    v_raw_discount := round(COALESCE((p_order->>'discount_amount')::numeric, 0.0), v_decimals);
    IF v_raw_discount < 0 THEN
        v_raw_discount := 0.0;
    END IF;
    v_discount_amount := round(GREATEST(0.0, LEAST(v_raw_subtotal, v_raw_discount))::numeric, v_decimals);
    v_discounted_subtotal := round((v_raw_subtotal - v_discount_amount)::numeric, v_decimals);
    v_discount_ratio := CASE WHEN v_raw_subtotal > 0 THEN (v_discounted_subtotal / v_raw_subtotal) ELSE 1.0 END;

    -- Step 2: Service Charge is calculated on the discounted subtotal
    IF v_service_charge_enabled AND v_service_charge_rate > 0 THEN
        v_service_charge_amount := round((v_discounted_subtotal * v_service_charge_rate)::numeric, v_decimals);
    ELSE
        v_service_charge_amount := 0.0;
    END IF;

    -- Step 3: Taxes calculated on applicable discounted category subtotals
    IF NOT v_tax_enabled THEN
        v_total_inclusive_tax := 0.0;
        v_total_exclusive_tax := 0.0;
        v_tax_amount := 0.0;
        v_computed_total := round((v_discounted_subtotal + v_service_charge_amount)::numeric, v_decimals);
    ELSE
        -- Ensure v_tax_rules contains at least the base rule if not provided
        IF v_tax_rules IS NULL OR jsonb_typeof(v_tax_rules) <> 'array' OR jsonb_array_length(v_tax_rules) = 0 THEN
            v_tax_rules := jsonb_build_array(jsonb_build_object(
                'label', COALESCE(v_tax_label, 'Tax'),
                'rate', COALESCE(v_tax_rate, 0.0500),
                'mode', COALESCE(v_tax_mode, 'inclusive')
            ));
        END IF;

        -- Group rules by (mode, appliesTo) to coordinate split rules (e.g. CGST + SGST)
        FOR v_rule_group IN
            WITH parsed_rules AS (
                SELECT 
                    elem->>'mode' AS r_mode,
                    COALESCE(elem->'appliesTo', '[]'::jsonb) AS r_applies_to,
                    jsonb_agg(elem) AS r_group_rules,
                    sum((elem->>'rate')::numeric) AS r_combined_rate,
                    count(*) AS r_count
                FROM jsonb_array_elements(v_tax_rules) elem
                WHERE (elem->>'rate')::numeric > 0
                GROUP BY elem->>'mode', COALESCE(elem->'appliesTo', '[]'::jsonb)
            )
            SELECT * FROM parsed_rules
        LOOP
            v_group_rules := v_rule_group.r_group_rules;
            v_group_count := v_rule_group.r_count;
            v_group_combined_rate := v_rule_group.r_combined_rate;
            v_group_mode := v_rule_group.r_mode;

            -- Calculate applicable subtotal for this rule group
            IF jsonb_array_length(v_rule_group.r_applies_to) > 0 THEN
                v_applicable_subtotal := 0.0;
                FOR v_calc_item IN SELECT * FROM jsonb_array_elements(v_calc_items)
                LOOP
                    IF v_rule_group.r_applies_to ? (v_calc_item->>'category') THEN
                        v_item_disc_line := (v_calc_item->>'line_total')::numeric * v_discount_ratio;
                        IF v_tax_rounding_mode = 'line' THEN
                            v_applicable_subtotal := v_applicable_subtotal + round(v_item_disc_line::numeric, v_decimals);
                        ELSE
                            v_applicable_subtotal := v_applicable_subtotal + v_item_disc_line;
                        END IF;
                    END IF;
                END LOOP;
                v_applicable_subtotal := round(v_applicable_subtotal::numeric, v_decimals);
            ELSE
                v_applicable_subtotal := v_discounted_subtotal;
            END IF;

            IF v_applicable_subtotal > 0 AND v_group_combined_rate > 0 THEN
                -- Calculate group total tax
                IF v_group_mode = 'inclusive' THEN
                    v_group_total_tax := round((v_applicable_subtotal * (v_group_combined_rate / (1.0 + v_group_combined_rate)))::numeric, v_decimals);
                    v_total_inclusive_tax := round((v_total_inclusive_tax + v_group_total_tax)::numeric, v_decimals);
                ELSE
                    v_group_total_tax := round((v_applicable_subtotal * v_group_combined_rate)::numeric, v_decimals);
                    v_total_exclusive_tax := round((v_total_exclusive_tax + v_group_total_tax)::numeric, v_decimals);
                END IF;

                -- Allocate tax among split rules with last rule absorbing rounding residual (single GST parity)
                v_allocated_group_tax := 0.0;
                FOR i IN 0..(v_group_count - 1)
                LOOP
                    v_rule := v_group_rules->i;
                    v_rule_rate := (v_rule->>'rate')::numeric;

                    IF i = (v_group_count - 1) THEN
                        v_rule_tax := round((v_group_total_tax - v_allocated_group_tax)::numeric, v_decimals);
                    ELSE
                        v_rule_tax := round((v_group_total_tax * (v_rule_rate / v_group_combined_rate))::numeric, v_decimals);
                        v_allocated_group_tax := round((v_allocated_group_tax + v_rule_tax)::numeric, v_decimals);
                    END IF;

                    v_tax_lines := v_tax_lines || jsonb_build_object(
                        'label', v_rule->>'label',
                        'rate', v_rule_rate,
                        'mode', v_rule->>'mode',
                        'amount', v_rule_tax,
                        'appliedTo', v_rule->'appliesTo'
                    );
                END LOOP;
            END IF;
        END LOOP;

        -- Step 4: Tax on Service Charge (if service charge is taxable)
        IF v_service_charge_enabled AND v_service_charge_taxable AND v_service_charge_amount > 0 THEN
            v_primary_rule := v_tax_rules->0;
            v_sc_tax_rate := COALESCE((v_primary_rule->>'rate')::numeric, v_tax_rate, 0.0);
            v_sc_tax_mode := COALESCE(v_primary_rule->>'mode', v_tax_mode, 'inclusive');

            IF v_sc_tax_rate > 0 THEN
                IF v_sc_tax_mode = 'exclusive' THEN
                    v_sc_tax := round((v_service_charge_amount * v_sc_tax_rate)::numeric, v_decimals);
                    v_total_exclusive_tax := round((v_total_exclusive_tax + v_sc_tax)::numeric, v_decimals);
                ELSE
                    v_sc_tax := round((v_service_charge_amount * (v_sc_tax_rate / (1.0 + v_sc_tax_rate)))::numeric, v_decimals);
                    v_total_inclusive_tax := round((v_total_inclusive_tax + v_sc_tax)::numeric, v_decimals);
                END IF;

                v_tax_lines := v_tax_lines || jsonb_build_object(
                    'label', COALESCE(v_primary_rule->>'label', v_tax_label, 'Tax') || ' (Service)',
                    'rate', v_sc_tax_rate,
                    'mode', v_sc_tax_mode,
                    'amount', v_sc_tax
                );
            END IF;
        END IF;

        v_tax_amount := round((v_total_inclusive_tax + v_total_exclusive_tax)::numeric, v_decimals);
        -- Grand Total: discountedSubtotal + serviceCharge + exclusive taxes (inclusive tax is already inside discountedSubtotal)
        v_computed_total := round((v_discounted_subtotal + v_service_charge_amount + v_total_exclusive_tax)::numeric, v_decimals);
    END IF;

    -- Add tips if enabled and provided
    IF v_tip_amount > 0 THEN
        v_computed_total := round((v_computed_total + v_tip_amount)::numeric, v_decimals);
    END IF;

    -- 11. Insert Authoritative Order Record
    INSERT INTO public.orders (
        restaurant_id,
        order_ref,
        customer_name,
        customer_phone,
        customer_email,
        order_type,
        table_number,
        special_requests,
        subtotal,
        discount_amount,
        discounted_subtotal,
        service_charge_amount,
        tax_amount,
        total,
        tax_breakdown,
        status,
        payment_status,
        payment_required,
        payment_provider,
        payment_token_hash,
        payment_amount,
        currency,
        created_at,
        updated_at
    ) VALUES (
        v_restaurant_id,
        v_order_ref,
        trim(p_order->>'customer_name'),
        trim(p_order->>'customer_phone'),
        nullif(trim(COALESCE(p_order->>'customer_email', '')), ''),
        v_order_type,
        CASE WHEN v_order_type = 'dine_in' THEN trim(p_order->>'table_number') ELSE NULL END,
        nullif(trim(COALESCE(p_order->>'special_requests', '')), ''),
        v_raw_subtotal,
        v_discount_amount,
        v_discounted_subtotal,
        v_service_charge_amount,
        v_tax_amount,
        v_computed_total,
        v_tax_lines,
        'pending',
        v_payment_status,
        v_payment_required,
        nullif(v_payment_method, ''),
        v_payment_token_hash,
        v_computed_total,
        v_currency,
        v_created_at,
        v_created_at
    )
    RETURNING id INTO v_order_id;

    -- 12. Insert Order Items
    FOR v_calc_item IN SELECT * FROM jsonb_array_elements(v_calc_items)
    LOOP
        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price,
            line_total,
            notes,
            created_at
        ) VALUES (
            v_order_id,
            v_calc_item->>'menu_item_id',
            v_calc_item->>'name',
            (v_calc_item->>'quantity')::INTEGER,
            (v_calc_item->>'unit_price')::NUMERIC,
            (v_calc_item->>'line_total')::NUMERIC,
            v_calc_item->>'notes',
            v_created_at
        );
    END LOOP;

    -- 13. Return Authoritative Order Summary Response
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_ref', v_order_ref,
        'subtotal', v_raw_subtotal,
        'discount_amount', v_discount_amount,
        'discounted_subtotal', v_discounted_subtotal,
        'service_charge', v_service_charge_amount,
        'tax_amount', v_tax_amount,
        'total', v_computed_total,
        'currency', v_currency,
        'tax_breakdown', v_tax_lines,
        'payment_status', v_payment_status,
        'payment_required', v_payment_required,
        'payment_token', v_raw_payment_token
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_atomic(JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;

-- ==============================================================================
-- Migration: 025_pos_audit_and_hardening.sql
-- Description: POS Security, Concurrency, Multi-Tenant RLS & Zero-Drift Hardening
-- ==============================================================================

-- 1. SCHEMA HARDENING
ALTER TABLE public.bills 
    ADD COLUMN IF NOT EXISTS payment_idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_bills_payment_idempotency ON public.bills (payment_idempotency_key) 
    WHERE payment_idempotency_key IS NOT NULL;

ALTER TABLE public.kot_batches 
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_kot_batches_idempotency ON public.kot_batches (idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

-- 2. POS CREATE OR APPEND KOT (Concurrency hardened, KOT sent exactly once, Multi-tenant)
CREATE OR REPLACE FUNCTION public.pos_create_or_append_kot(
    p_bill_number TEXT DEFAULT NULL,
    p_order_type TEXT DEFAULT 'dine_in',
    p_table_number TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_customer_name TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL,
    p_special_instructions TEXT DEFAULT NULL,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL,
    p_bill_id UUID DEFAULT NULL,
    p_delivery_address TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id TEXT;
    v_bill_id UUID;
    v_kot_batch_id UUID;
    v_kot_number TEXT;
    v_batch_index INTEGER := 1;
    v_item JSONB;
    v_menu_id TEXT;
    v_quantity INTEGER;
    v_db_price NUMERIC(10,2);
    v_db_name TEXT;
    v_unit_minor INTEGER;
    v_mod_minor INTEGER := 0;
    v_mod JSONB;
    v_line_minor INTEGER;
    v_subtotal_minor INTEGER := 0;
    v_tax_minor INTEGER := 0;
    v_grand_total_minor INTEGER := 0;
    v_tax_rate NUMERIC := 0.0500;
    v_existing_bill RECORD;
    v_existing_kot RECORD;
BEGIN
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
        SELECT * INTO v_existing_kot 
        FROM public.kot_batches 
        WHERE idempotency_key = trim(p_idempotency_key) AND restaurant_id = v_tenant_id
        LIMIT 1;

        IF FOUND THEN
            SELECT * INTO v_existing_bill FROM public.bills WHERE id = v_existing_kot.bill_id;
            RETURN jsonb_build_object(
                'success', true,
                'is_duplicate', true,
                'bill_id', v_existing_kot.bill_id,
                'bill_number', v_existing_bill.bill_number,
                'kot_batch_id', v_existing_kot.id,
                'kot_number', v_existing_kot.kot_number,
                'batch_index', v_existing_kot.batch_index,
                'message', 'KOT batch already dispatched (idempotent duplicate blocked)'
            );
        END IF;
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'KOT must contain at least one item');
    END IF;

    IF p_table_number IS NOT NULL AND trim(p_table_number) <> '' THEN
        PERFORM pg_advisory_xact_lock(hashtext('pos_table_' || v_tenant_id || '_' || trim(p_table_number)));
    ELSIF p_bill_id IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('pos_bill_' || v_tenant_id || '_' || p_bill_id::text));
    END IF;

    IF p_bill_id IS NOT NULL THEN
        SELECT * INTO v_existing_bill 
        FROM public.bills 
        WHERE id = p_bill_id AND restaurant_id = v_tenant_id
        FOR UPDATE;
    ELSIF p_bill_number IS NOT NULL AND trim(p_bill_number) <> '' THEN
        SELECT * INTO v_existing_bill 
        FROM public.bills 
        WHERE bill_number = trim(p_bill_number) AND restaurant_id = v_tenant_id
        FOR UPDATE;
    ELSIF p_table_number IS NOT NULL AND trim(p_table_number) <> '' THEN
        SELECT * INTO v_existing_bill 
        FROM public.bills 
        WHERE table_number = trim(p_table_number) 
          AND restaurant_id = v_tenant_id 
          AND status IN ('running', 'printed') 
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE;
    END IF;

    IF v_existing_bill.id IS NOT NULL THEN
        v_bill_id := v_existing_bill.id;
        SELECT COALESCE(MAX(batch_index), 0) + 1 INTO v_batch_index 
        FROM public.kot_batches WHERE bill_id = v_bill_id;
    ELSE
        v_bill_id := gen_random_uuid();
        INSERT INTO public.bills (
            id,
            restaurant_id,
            bill_number,
            order_type,
            table_number,
            customer_name,
            customer_phone,
            delivery_address,
            status,
            subtotal_minor,
            tax_amount_minor,
            grand_total_minor,
            created_by
        )
        VALUES (
            v_bill_id,
            v_tenant_id,
            COALESCE(NULLIF(trim(p_bill_number), ''), 'BILL-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text from 1 for 6))),
            COALESCE(p_order_type, 'dine_in'),
            NULLIF(trim(p_table_number), ''),
            p_customer_name,
            p_customer_phone,
            p_delivery_address,
            'running',
            0,
            0,
            0,
            auth.uid()
        )
        RETURNING bill_number INTO v_existing_bill.bill_number;
    END IF;

    v_kot_number := 'KOT-' || to_char(now(), 'HH24MI') || '-' || upper(substring(gen_random_uuid()::text from 1 for 4));
    INSERT INTO public.kot_batches (
        bill_id,
        restaurant_id,
        kot_number,
        batch_index,
        status,
        special_instructions,
        idempotency_key,
        created_by
    )
    VALUES (
        v_bill_id,
        v_tenant_id,
        v_kot_number,
        v_batch_index,
        'sent',
        p_special_instructions,
        p_idempotency_key,
        auth.uid()
    )
    RETURNING id INTO v_kot_batch_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_menu_id := trim(COALESCE(v_item->>'menu_item_id', v_item->>'id', ''));
        v_quantity := GREATEST(1, COALESCE((v_item->>'quantity')::INTEGER, 1));
        v_db_price := NULL;
        v_db_name := NULL;

        SELECT price, name INTO v_db_price, v_db_name 
        FROM public.menu_items 
        WHERE id = v_menu_id 
        LIMIT 1;

        IF v_db_price IS NULL THEN
            SELECT price, name INTO v_db_price, v_db_name 
            FROM public.menu 
            WHERE id = v_menu_id OR lower(trim(name)) = lower(trim(v_menu_id))
            LIMIT 1;
        END IF;

        IF v_db_price IS NULL THEN
            v_unit_minor := ROUND(COALESCE((v_item->>'unit_price')::NUMERIC, (v_item->>'price')::NUMERIC, 0) * 100);
            v_db_name := COALESCE(v_item->>'item_name', v_item->>'name', 'Item');
        ELSE
            v_unit_minor := ROUND(v_db_price * 100);
        END IF;

        v_mod_minor := 0;
        IF v_item->'modifiers' IS NOT NULL AND jsonb_typeof(v_item->'modifiers') = 'array' THEN
            FOR v_mod IN SELECT * FROM jsonb_array_elements(v_item->'modifiers')
            LOOP
                v_mod_minor := v_mod_minor + ROUND(COALESCE((v_mod->>'price')::NUMERIC, 0) * 100);
            END LOOP;
        END IF;

        v_line_minor := (v_unit_minor + v_mod_minor) * v_quantity;

        INSERT INTO public.bill_items (
            bill_id,
            restaurant_id,
            kot_batch_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price_minor,
            line_total_minor,
            tax_category,
            modifiers,
            notes
        )
        VALUES (
            v_bill_id,
            v_tenant_id,
            v_kot_batch_id,
            v_menu_id,
            v_db_name,
            v_quantity,
            v_unit_minor + v_mod_minor,
            v_line_minor,
            COALESCE(v_item->>'tax_category', v_item->>'taxCategory', 'food'),
            COALESCE(v_item->'modifiers', '[]'::jsonb),
            NULLIF(trim(COALESCE(v_item->>'notes', '')), '')
        );
    END LOOP;

    SELECT COALESCE(SUM(line_total_minor), 0)
    INTO v_subtotal_minor
    FROM public.bill_items
    WHERE bill_id = v_bill_id AND is_voided = false;

    SELECT COALESCE(tax_rate, 0.0500) INTO v_tax_rate
    FROM public.restaurant_settings
    ORDER BY (id = 'current') DESC LIMIT 1;

    v_tax_minor := ROUND(v_subtotal_minor * (v_tax_rate / (1.0 + v_tax_rate)));
    v_grand_total_minor := v_subtotal_minor;

    UPDATE public.bills
    SET subtotal_minor = v_subtotal_minor,
        tax_amount_minor = v_tax_minor,
        grand_total_minor = v_grand_total_minor,
        tax_details = jsonb_build_array(
            jsonb_build_object('label', 'CGST', 'rate', v_tax_rate / 2.0, 'amount_minor', ROUND(v_tax_minor / 2.0)),
            jsonb_build_object('label', 'SGST', 'rate', v_tax_rate / 2.0, 'amount_minor', v_tax_minor - ROUND(v_tax_minor / 2.0))
        ),
        updated_at = now()
    WHERE id = v_bill_id;

    RETURN jsonb_build_object(
        'success', true,
        'bill_id', v_bill_id,
        'bill_number', v_existing_bill.bill_number,
        'kot_batch_id', v_kot_batch_id,
        'kot_number', v_kot_number,
        'batch_index', v_batch_index,
        'subtotal_minor', v_subtotal_minor,
        'grand_total_minor', v_grand_total_minor
    );
END;
$$;

-- 3. POS VOID ITEM (Server-authoritative RBAC & Multi-tenant check)
CREATE OR REPLACE FUNCTION public.pos_void_item(
    p_bill_item_id UUID,
    p_void_reason TEXT,
    p_manager_pin TEXT DEFAULT NULL,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL,
    p_actor_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id TEXT;
    v_item RECORD;
    v_bill RECORD;
    v_is_authorized BOOLEAN := false;
    v_subtotal_minor INTEGER := 0;
    v_tax_minor INTEGER := 0;
    v_grand_total_minor INTEGER := 0;
    v_tax_rate NUMERIC := 0.0500;
BEGIN
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    IF p_void_reason IS NULL OR length(trim(p_void_reason)) < 3 THEN
        RETURN jsonb_build_object('success', false, 'error', 'A valid void reason (min 3 chars) is required');
    END IF;

    IF COALESCE(auth.role(), '') = 'service_role' THEN
        v_is_authorized := true;
    ELSIF public.is_manager_or_above(auth.uid()) THEN
        v_is_authorized := true;
    ELSIF p_manager_pin IS NOT NULL AND public.pos_verify_manager_pin(p_manager_pin) THEN
        v_is_authorized := true;
    END IF;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid manager PIN or insufficient role permissions for void');
    END IF;

    SELECT * INTO v_item 
    FROM public.bill_items 
    WHERE id = p_bill_item_id 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill item not found or unauthorized tenant access');
    END IF;

    IF v_item.is_voided THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item is already voided');
    END IF;

    SELECT * INTO v_bill 
    FROM public.bills 
    WHERE id = v_item.bill_id 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Parent bill not found');
    END IF;

    IF v_bill.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot void items on a settled bill');
    END IF;

    UPDATE public.bill_items
    SET is_voided = true,
        void_reason = trim(p_void_reason),
        void_approved_by = COALESCE(p_actor_name, 'Manager'),
        voided_at = now(),
        updated_at = now()
    WHERE id = p_bill_item_id;

    SELECT COALESCE(SUM(line_total_minor), 0)
    INTO v_subtotal_minor
    FROM public.bill_items
    WHERE bill_id = v_bill.id AND is_voided = false;

    SELECT COALESCE(tax_rate, 0.0500) INTO v_tax_rate
    FROM public.restaurant_settings
    ORDER BY (id = 'current') DESC LIMIT 1;

    v_tax_minor := ROUND(v_subtotal_minor * (v_tax_rate / (1.0 + v_tax_rate)));
    v_grand_total_minor := GREATEST(0, v_subtotal_minor - v_bill.discount_amount_minor);

    UPDATE public.bills
    SET subtotal_minor = v_subtotal_minor,
        tax_amount_minor = v_tax_minor,
        grand_total_minor = v_grand_total_minor,
        updated_at = now()
    WHERE id = v_bill.id;

    INSERT INTO public.audit_log (
        restaurant_id,
        actor_id,
        actor_role,
        actor_name,
        action,
        target_type,
        target_id,
        details
    )
    VALUES (
        v_bill.restaurant_id,
        COALESCE(p_actor_id, auth.uid()::text, 'pos'),
        COALESCE(p_actor_role, 'manager'),
        COALESCE(p_actor_name, 'Manager'),
        'POS_ITEM_VOIDED',
        'bill_items',
        v_item.id::text,
        jsonb_build_object(
            'bill_number', v_bill.bill_number,
            'item_name', v_item.item_name,
            'quantity', v_item.quantity,
            'line_total_minor', v_item.line_total_minor,
            'reason', p_void_reason,
            'approved_by', COALESCE(p_actor_name, 'Manager')
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'item_id', v_item.id,
        'voided_line_minor', v_item.line_total_minor,
        'new_subtotal_minor', v_subtotal_minor,
        'new_grand_total_minor', v_grand_total_minor
    );
END;
$$;

-- 4. POS APPLY DISCOUNT (Server-authoritative RBAC & Multi-tenant check)
CREATE OR REPLACE FUNCTION public.pos_apply_discount(
    p_bill_id UUID,
    p_discount_type TEXT,
    p_discount_value_minor INTEGER,
    p_discount_code TEXT DEFAULT NULL,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL,
    p_actor_role TEXT DEFAULT NULL,
    p_manager_pin TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id TEXT;
    v_bill RECORD;
    v_computed_discount_minor INTEGER := 0;
    v_grand_total_minor INTEGER := 0;
    v_is_authorized BOOLEAN := false;
BEGIN
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    SELECT * INTO v_bill 
    FROM public.bills 
    WHERE id = p_bill_id 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill not found or unauthorized tenant access');
    END IF;

    IF v_bill.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot apply discount to an already paid bill');
    END IF;

    IF p_discount_type IN ('flat', 'manual') OR p_discount_value_minor > 2000 THEN
        IF COALESCE(auth.role(), '') = 'service_role' THEN
            v_is_authorized := true;
        ELSIF public.is_manager_or_above(auth.uid()) THEN
            v_is_authorized := true;
        ELSIF p_manager_pin IS NOT NULL AND public.pos_verify_manager_pin(p_manager_pin) THEN
            v_is_authorized := true;
        END IF;

        IF NOT v_is_authorized THEN
            RETURN jsonb_build_object('success', false, 'error', 'Manager authorization PIN required for this discount');
        END IF;
    END IF;

    IF p_discount_type = 'percentage' THEN
        v_computed_discount_minor := ROUND(v_bill.subtotal_minor * (p_discount_value_minor / 10000.0));
    ELSIF p_discount_type IN ('flat', 'manual') THEN
        v_computed_discount_minor := LEAST(v_bill.subtotal_minor, p_discount_value_minor);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid discount type');
    END IF;

    v_grand_total_minor := GREATEST(0, v_bill.subtotal_minor - v_computed_discount_minor);

    UPDATE public.bills
    SET discount_type = p_discount_type,
        discount_code = p_discount_code,
        discount_value_minor = p_discount_value_minor,
        discount_amount_minor = v_computed_discount_minor,
        discount_approved_by = COALESCE(p_actor_name, 'Staff'),
        grand_total_minor = v_grand_total_minor,
        updated_at = now()
    WHERE id = p_bill_id;

    INSERT INTO public.audit_log (
        restaurant_id,
        actor_id,
        actor_role,
        actor_name,
        action,
        target_type,
        target_id,
        details
    )
    VALUES (
        v_bill.restaurant_id,
        COALESCE(p_actor_id, auth.uid()::text, 'pos'),
        COALESCE(p_actor_role, 'staff'),
        COALESCE(p_actor_name, 'Staff'),
        'POS_DISCOUNT_APPLIED',
        'bills',
        v_bill.bill_number,
        jsonb_build_object(
            'bill_number', v_bill.bill_number,
            'discount_type', p_discount_type,
            'discount_code', p_discount_code,
            'discount_amount_minor', v_computed_discount_minor,
            'original_subtotal_minor', v_bill.subtotal_minor,
            'new_grand_total_minor', v_grand_total_minor,
            'approved_by', COALESCE(p_actor_name, 'Staff')
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'discount_amount_minor', v_computed_discount_minor,
        'grand_total_minor', v_grand_total_minor
    );
END;
$$;

-- 5. POS ATOMIC BILL SPLIT (Multi-tenant check, minor & major unit flexibility)
CREATE OR REPLACE FUNCTION public.split_bill_atomic(
    p_bill_number TEXT,
    p_split_type TEXT,
    p_splits JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id TEXT;
    v_bill RECORD;
    v_split JSONB;
    v_sum_amount_minor INTEGER := 0;
    v_part_amount_minor INTEGER;
    v_part_subtotal_minor INTEGER;
    v_part_tax_minor INTEGER;
    v_total_parts INTEGER;
    v_part_number INTEGER := 1;
BEGIN
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    SELECT * INTO v_bill 
    FROM public.bills 
    WHERE bill_number = trim(p_bill_number) 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill not found or unauthorized tenant access');
    END IF;

    IF v_bill.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot split an already settled bill');
    END IF;

    v_total_parts := jsonb_array_length(p_splits);
    IF v_total_parts < 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Splits array cannot be empty');
    END IF;

    FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
    LOOP
        v_part_amount_minor := COALESCE(
            (v_split->>'amount_minor')::INTEGER, 
            ROUND(((v_split->>'amount')::NUMERIC) * 100)::INTEGER
        );
        v_sum_amount_minor := v_sum_amount_minor + v_part_amount_minor;
    END LOOP;

    IF v_sum_amount_minor <> v_bill.grand_total_minor THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Split sum (%s minor units) does not match bill grand total (%s minor units)', v_sum_amount_minor, v_bill.grand_total_minor)
        );
    END IF;

    DELETE FROM public.bill_splits
    WHERE bill_id = v_bill.id AND status = 'pending';

    FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
    LOOP
        v_part_amount_minor := COALESCE(
            (v_split->>'amount_minor')::INTEGER, 
            ROUND(((v_split->>'amount')::NUMERIC) * 100)::INTEGER
        );
        v_part_subtotal_minor := COALESCE(
            (v_split->>'subtotal_minor')::INTEGER, 
            ROUND(((v_split->>'subtotal')::NUMERIC) * 100)::INTEGER, 
            0
        );
        v_part_tax_minor := COALESCE(
            (v_split->>'tax_amount_minor')::INTEGER, 
            ROUND(((v_split->>'tax_amount')::NUMERIC) * 100)::INTEGER, 
            0
        );

        INSERT INTO public.bill_splits (
            restaurant_id,
            bill_id,
            bill_number,
            split_type,
            part_number,
            total_parts,
            payer_label,
            items,
            subtotal_minor,
            tax_amount_minor,
            amount_minor,
            status
        )
        VALUES (
            v_bill.restaurant_id,
            v_bill.id,
            v_bill.bill_number,
            p_split_type,
            COALESCE((v_split->>'part_number')::INTEGER, v_part_number),
            v_total_parts,
            COALESCE(v_split->>'payer_label', 'Guest ' || v_part_number),
            COALESCE(v_split->'items', '[]'::jsonb),
            v_part_subtotal_minor,
            v_part_tax_minor,
            v_part_amount_minor,
            'pending'
        );
        v_part_number := v_part_number + 1;
    END LOOP;

    UPDATE public.bills
    SET is_split = true,
        split_type = p_split_type,
        split_count = v_total_parts,
        updated_at = now()
    WHERE id = v_bill.id;

    RETURN jsonb_build_object(
        'success', true,
        'bill_number', v_bill.bill_number,
        'total_parts', v_total_parts,
        'grand_total_minor', v_bill.grand_total_minor
    );
END;
$$;

-- 6. PROCESS BILL PAYMENT (Idempotency across shifts, splits, & bills; multi-tenant RLS)
CREATE OR REPLACE FUNCTION public.process_bill_payment(
    p_bill_number TEXT,
    p_split_id UUID DEFAULT NULL,
    p_tender_type TEXT DEFAULT 'cash',
    p_amount_minor INTEGER DEFAULT 0,
    p_tip_minor INTEGER DEFAULT 0,
    p_tendered_minor INTEGER DEFAULT 0,
    p_payment_reference TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_actor_id TEXT DEFAULT NULL,
    p_actor_name TEXT DEFAULT NULL,
    p_actor_role TEXT DEFAULT NULL,
    p_shift_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id TEXT;
    v_bill RECORD;
    v_split RECORD;
    v_change_due_minor INTEGER := 0;
    v_total_paid_so_far_minor INTEGER := 0;
    v_remaining_minor INTEGER := 0;
    v_is_bill_closed BOOLEAN := false;
BEGIN
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
        IF EXISTS (
            SELECT 1 FROM public.cash_drawer_transactions 
            WHERE idempotency_key = trim(p_idempotency_key) AND restaurant_id = v_tenant_id
        ) OR EXISTS (
            SELECT 1 FROM public.bill_splits 
            WHERE idempotency_key = trim(p_idempotency_key) AND restaurant_id = v_tenant_id
        ) OR EXISTS (
            SELECT 1 FROM public.bills 
            WHERE payment_idempotency_key = trim(p_idempotency_key) AND restaurant_id = v_tenant_id
        ) THEN
            RETURN jsonb_build_object(
                'success', true,
                'is_duplicate', true,
                'bill_number', p_bill_number,
                'message', 'Payment already processed (idempotent duplicate blocked)'
            );
        END IF;
    END IF;

    SELECT * INTO v_bill 
    FROM public.bills 
    WHERE bill_number = trim(p_bill_number) 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill not found or unauthorized tenant access');
    END IF;

    IF p_tender_type = 'cash' THEN
        v_change_due_minor := GREATEST(0, p_tendered_minor - (p_amount_minor + p_tip_minor));
    END IF;

    IF p_split_id IS NOT NULL THEN
        SELECT * INTO v_split 
        FROM public.bill_splits 
        WHERE id = p_split_id AND bill_id = v_bill.id 
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Bill split part not found');
        END IF;

        IF v_split.status = 'paid' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Split part is already paid');
        END IF;

        UPDATE public.bill_splits
        SET status = 'paid',
            tender_type = p_tender_type,
            payment_reference = p_payment_reference,
            tip_amount_minor = p_tip_minor,
            tendered_amount_minor = p_tendered_minor,
            change_due_minor = v_change_due_minor,
            total_paid_minor = p_amount_minor + p_tip_minor,
            paid_at = now(),
            idempotency_key = p_idempotency_key,
            updated_at = now()
        WHERE id = p_split_id;
    END IF;

    IF p_shift_id IS NOT NULL THEN
        INSERT INTO public.cash_drawer_transactions (
            restaurant_id,
            shift_id,
            type,
            amount_minor,
            reason,
            bill_number,
            actor_id,
            actor_name,
            actor_role,
            idempotency_key
        )
        VALUES (
            v_bill.restaurant_id,
            p_shift_id,
            'sale',
            p_amount_minor + p_tip_minor,
            format('Settlement for bill %s via %s', v_bill.bill_number, p_tender_type),
            v_bill.bill_number,
            COALESCE(p_actor_id, 'staff'),
            COALESCE(p_actor_name, 'Staff Cashier'),
            COALESCE(p_actor_role, 'cashier'),
            p_idempotency_key
        );
    END IF;

    IF v_bill.is_split THEN
        SELECT COALESCE(SUM(amount_minor), 0)
        INTO v_total_paid_so_far_minor
        FROM public.bill_splits
        WHERE bill_id = v_bill.id AND status = 'paid';

        IF NOT EXISTS (SELECT 1 FROM public.bill_splits WHERE bill_id = v_bill.id AND status <> 'paid') THEN
            v_is_bill_closed := true;
        END IF;
    ELSE
        v_total_paid_so_far_minor := p_amount_minor;
        v_is_bill_closed := (v_total_paid_so_far_minor >= v_bill.grand_total_minor);
    END IF;

    v_remaining_minor := GREATEST(0, v_bill.grand_total_minor - v_total_paid_so_far_minor);

    IF v_is_bill_closed THEN
        UPDATE public.bills
        SET payment_status = 'paid',
            status = 'paid',
            paid_at = now(),
            payment_method = CASE WHEN v_bill.is_split THEN 'split' ELSE p_tender_type END,
            payment_idempotency_key = COALESCE(payment_idempotency_key, p_idempotency_key),
            shift_id = COALESCE(p_shift_id, shift_id),
            tips_minor = tips_minor + p_tip_minor,
            updated_at = now()
        WHERE id = v_bill.id;
    ELSE
        UPDATE public.bills
        SET payment_status = 'processing',
            payment_idempotency_key = COALESCE(payment_idempotency_key, p_idempotency_key),
            shift_id = COALESCE(p_shift_id, shift_id),
            tips_minor = tips_minor + p_tip_minor,
            updated_at = now()
        WHERE id = v_bill.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'bill_number', v_bill.bill_number,
        'tender_type', p_tender_type,
        'amount_minor', p_amount_minor,
        'change_due_minor', v_change_due_minor,
        'remaining_minor', v_remaining_minor,
        'is_bill_closed', v_is_bill_closed
    );
END;
$$;

-- 7. FINANCIAL Z-REPORT (Zero-drift split tender breakdown & multi-tenant isolation)
CREATE OR REPLACE FUNCTION public.get_shift_z_report(p_shift_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id TEXT;
    v_shift RECORD;
    v_cash_sales_minor INTEGER := 0;
    v_card_sales_minor INTEGER := 0;
    v_upi_sales_minor INTEGER := 0;
    v_other_sales_minor INTEGER := 0;
    v_cash_in_minor INTEGER := 0;
    v_cash_out_minor INTEGER := 0;
    v_cash_refunds_minor INTEGER := 0;
    v_gross_sales_minor INTEGER := 0;
    v_expected_cash_minor INTEGER := 0;
    v_variance_minor INTEGER := 0;
    v_tx_count INTEGER := 0;
BEGIN
    v_tenant_id := COALESCE(public.get_auth_restaurant_id(), 'the-cafe-barrackpore');

    SELECT * INTO v_shift 
    FROM public.cash_shifts 
    WHERE id = p_shift_id 
      AND (restaurant_id = v_tenant_id OR COALESCE(auth.role(), '') = 'service_role');

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Shift not found or unauthorized tenant access');
    END IF;

    SELECT 
        COALESCE(SUM(CASE WHEN type = 'sale' THEN amount_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'cash_in' THEN amount_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'cash_out' THEN amount_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'refund' THEN amount_minor ELSE 0 END), 0),
        COUNT(id)
    INTO 
        v_cash_sales_minor, v_cash_in_minor, v_cash_out_minor, v_cash_refunds_minor, v_tx_count
    FROM public.cash_drawer_transactions
    WHERE shift_id = p_shift_id;

    SELECT 
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN grand_total_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method = 'upi' THEN grand_total_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method NOT IN ('cash', 'card', 'upi', 'split') THEN grand_total_minor ELSE 0 END), 0)
    INTO 
        v_card_sales_minor, v_upi_sales_minor, v_other_sales_minor
    FROM public.bills
    WHERE shift_id = p_shift_id AND status = 'paid' AND is_split = false;

    v_card_sales_minor := v_card_sales_minor + COALESCE((
        SELECT SUM(s.amount_minor) 
        FROM public.bill_splits s
        JOIN public.bills b ON b.id = s.bill_id
        WHERE b.shift_id = p_shift_id AND s.status = 'paid' AND s.tender_type = 'card'
    ), 0);

    v_upi_sales_minor := v_upi_sales_minor + COALESCE((
        SELECT SUM(s.amount_minor) 
        FROM public.bill_splits s
        JOIN public.bills b ON b.id = s.bill_id
        WHERE b.shift_id = p_shift_id AND s.status = 'paid' AND s.tender_type = 'upi'
    ), 0);

    v_other_sales_minor := v_other_sales_minor + COALESCE((
        SELECT SUM(s.amount_minor) 
        FROM public.bill_splits s
        JOIN public.bills b ON b.id = s.bill_id
        WHERE b.shift_id = p_shift_id AND s.status = 'paid' AND s.tender_type NOT IN ('cash', 'card', 'upi')
    ), 0);

    v_gross_sales_minor := v_cash_sales_minor + v_card_sales_minor + v_upi_sales_minor + v_other_sales_minor;
    
    v_expected_cash_minor := v_shift.opening_float_minor + v_cash_sales_minor + v_cash_in_minor - v_cash_out_minor - v_cash_refunds_minor;
    v_variance_minor := COALESCE(v_shift.counted_cash_minor, v_expected_cash_minor) - v_expected_cash_minor;

    RETURN jsonb_build_object(
        'success', true,
        'shift_id', v_shift.id,
        'shift_number', v_shift.shift_number,
        'opened_at', v_shift.opened_at,
        'closed_at', v_shift.closed_at,
        'opened_by_name', v_shift.opened_by_name,
        'closed_by_name', v_shift.closed_by_name,
        'opening_float_minor', v_shift.opening_float_minor,
        'opening_float', round(v_shift.opening_float_minor / 100.0, 2),
        'gross_sales_minor', v_gross_sales_minor,
        'gross_sales', round(v_gross_sales_minor / 100.0, 2),
        'cash_sales_minor', v_cash_sales_minor,
        'cash_sales', round(v_cash_sales_minor / 100.0, 2),
        'card_sales_minor', v_card_sales_minor,
        'card_sales', round(v_card_sales_minor / 100.0, 2),
        'upi_sales_minor', v_upi_sales_minor,
        'upi_sales', round(v_upi_sales_minor / 100.0, 2),
        'other_sales_minor', v_other_sales_minor,
        'other_sales', round(v_other_sales_minor / 100.0, 2),
        'cash_in_minor', v_cash_in_minor,
        'cash_in_total', round(v_cash_in_minor / 100.0, 2),
        'cash_out_minor', v_cash_out_minor,
        'cash_out_total', round(v_cash_out_minor / 100.0, 2),
        'cash_refunds_minor', v_cash_refunds_minor,
        'cash_refunds', round(v_cash_refunds_minor / 100.0, 2),
        'expected_cash_minor', v_expected_cash_minor,
        'expected_cash', round(v_expected_cash_minor / 100.0, 2),
        'counted_cash_minor', v_shift.counted_cash_minor,
        'counted_cash', CASE WHEN v_shift.counted_cash_minor IS NOT NULL THEN round(v_shift.counted_cash_minor / 100.0, 2) ELSE NULL END,
        'variance_minor', v_variance_minor,
        'variance', round(v_variance_minor / 100.0, 2),
        'tender_breakdown', jsonb_build_object(
            'cash', round(v_cash_sales_minor / 100.0, 2),
            'card', round(v_card_sales_minor / 100.0, 2),
            'upi', round(v_upi_sales_minor / 100.0, 2),
            'stripe', 0,
            'other', round(v_other_sales_minor / 100.0, 2)
        ),
        'tx_count', v_tx_count
    );
END;
$$;

-- 8. PERMISSIONS GRANTS
GRANT EXECUTE ON FUNCTION public.pos_create_or_append_kot(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_void_item(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_apply_discount(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.split_bill_atomic(TEXT, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_bill_payment(TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_shift_z_report(UUID) TO authenticated, service_role;
