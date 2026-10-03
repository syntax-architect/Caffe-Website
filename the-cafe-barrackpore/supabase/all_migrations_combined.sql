-- ==============================================================================
-- COMPLETE DATABASE INITIALIZATION SCRIPT: The Café Barrackpore
-- Runs all migrations (001 - 012) in proper dependency order.
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

-- Compatibility view for menu_items
CREATE OR REPLACE VIEW public.menu_items AS SELECT * FROM public.menu;

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
DROP VIEW IF EXISTS public.menu_items CASCADE;

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

-- ==============================================================================
-- Migration: 013_owner_features.sql
-- Description: Owner-Focused Features
-- Customers, Discount Codes, Happy Hour Schedules, Stock Management, Notification Settings
-- ==============================================================================

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
    END IF;

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
    END IF;

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
