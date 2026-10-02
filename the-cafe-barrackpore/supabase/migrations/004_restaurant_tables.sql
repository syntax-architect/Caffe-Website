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
