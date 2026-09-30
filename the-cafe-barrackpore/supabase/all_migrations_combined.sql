-- ==============================================================================
-- COMPLETE DATABASE INITIALIZATION SCRIPT: The Café Barrackpore
-- Runs all migrations (001 - 006) in proper dependency order.
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
CREATE POLICY "Allow public order insertion"
    ON public.orders
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

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
CREATE POLICY "Staff can view own profile"
    ON public.staff_profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Staff members can update basic info on their own profile (name only, not role or active)
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
CREATE POLICY "Owners and managers can view all staff profiles"
    ON public.staff_profiles
    FOR SELECT
    TO authenticated
    USING (
        public.get_staff_role(auth.uid()) IN ('owner', 'manager')
    );

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
CREATE POLICY "Public can view active tables"
    ON public.restaurant_tables
    FOR SELECT
    TO anon, authenticated
    USING (active = true);

-- Active staff: View all tables (including deactivated ones)
CREATE POLICY "Active staff can view all tables"
    ON public.restaurant_tables
    FOR SELECT
    TO authenticated
    USING (public.is_active_staff(auth.uid()));

-- Owners and Managers: Manage tables (insert, update, delete)
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
CREATE POLICY "Public can read restaurant settings"
    ON public.restaurant_settings
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Owners can update restaurant settings
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
CREATE POLICY "public_read_menu_availability"
ON public.menu_item_availability
FOR SELECT
USING (true);

-- Active staff members can update or insert availability states
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

