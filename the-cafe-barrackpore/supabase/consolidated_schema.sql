-- ==============================================================================
-- THE CAFE BARRACKPORE — FULL IDEMPOTENT CONSOLIDATED PRODUCTION DATABASE SCHEMA
-- Target: Supabase (PostgreSQL 15+)
-- Works seamlessly on BOTH brand-new projects AND existing databases!
-- Automatically adds any missing columns (like restaurant_id, discount_code, etc.)
-- to existing tables before indexes and policies are created.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. EXTENSIONS & PREREQUISITES
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. BASE TABLES & PROGRESSIVE COLUMN UPGRADES
-- ------------------------------------------------------------------------------

-- 1.1 ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_ref TEXT NOT NULL UNIQUE,
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    customer_name TEXT NOT NULL DEFAULT 'Guest',
    customer_phone TEXT NOT NULL DEFAULT '',
    order_type TEXT NOT NULL DEFAULT 'takeaway',
    table_number TEXT,
    special_requests TEXT,
    order_source TEXT NOT NULL DEFAULT 'website',
    source TEXT NOT NULL DEFAULT 'website',
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    tax_total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'pending',
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_required BOOLEAN NOT NULL DEFAULT false,
    payment_status TEXT NOT NULL DEFAULT 'not_required',
    payment_method TEXT,
    payment_provider TEXT,
    payment_reference TEXT,
    payment_amount NUMERIC(10,2) DEFAULT 0.00,
    discount_code TEXT,
    discount_amount NUMERIC(10,2) DEFAULT 0.00,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Upgrade existing orders table if it pre-dates recent migrations
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_source TEXT NOT NULL DEFAULT 'website';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'website';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_required BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'not_required';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_provider TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_order_ref ON public.orders(order_ref);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON public.orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);

-- 1.2 ORDER ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    menu_item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    line_total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    selected_options JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS selected_options JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_id ON public.order_items(restaurant_id);

-- 1.3 RESERVATIONS
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_ref TEXT NOT NULL UNIQUE,
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    reservation_date DATE NOT NULL,
    reservation_time TEXT NOT NULL,
    party_size INTEGER NOT NULL DEFAULT 2,
    special_requests TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    source TEXT NOT NULL DEFAULT 'website',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'website';

CREATE INDEX IF NOT EXISTS idx_reservations_ref ON public.reservations(reservation_ref);
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_id ON public.reservations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date ON public.reservations(reservation_date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations(status);

-- 1.4 STAFF PROFILES
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff')),
    active BOOLEAN NOT NULL DEFAULT true,
    full_name TEXT NOT NULL DEFAULT 'Staff Member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'staff';
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT 'Staff Member';

CREATE INDEX IF NOT EXISTS idx_staff_profiles_user_id ON public.staff_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_restaurant_id ON public.staff_profiles(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_role ON public.staff_profiles(role);

-- 1.5 RESTAURANT TABLES
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    table_number TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 4;
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_restaurant_id ON public.restaurant_tables(restaurant_id);

-- 1.6 RESTAURANT SETTINGS
CREATE TABLE IF NOT EXISTS public.restaurant_settings (
    id TEXT PRIMARY KEY DEFAULT 'current',
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    currency TEXT NOT NULL DEFAULT 'INR',
    tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0.0500,
    tax_mode TEXT NOT NULL DEFAULT 'inclusive',
    tax_enabled BOOLEAN NOT NULL DEFAULT true,
    payments_enabled BOOLEAN NOT NULL DEFAULT false,
    allow_pay_at_counter BOOLEAN NOT NULL DEFAULT true,
    payment_provider TEXT NOT NULL DEFAULT 'razorpay',
    google_review_link TEXT,
    owner_notification_phone TEXT,
    owner_notification_email TEXT,
    owner_notification_method TEXT DEFAULT 'none',
    low_stock_alert_threshold INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0.0500;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS tax_mode TEXT NOT NULL DEFAULT 'inclusive';
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS payments_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS allow_pay_at_counter BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'razorpay';
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS google_review_link TEXT;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS owner_notification_phone TEXT;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS owner_notification_email TEXT;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS owner_notification_method TEXT DEFAULT 'none';
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS low_stock_alert_threshold INTEGER DEFAULT 5;

INSERT INTO public.restaurant_settings (id, restaurant_id, currency, tax_rate, tax_mode, tax_enabled, payments_enabled, allow_pay_at_counter, payment_provider)
VALUES ('current', 'the-cafe-barrackpore', 'INR', 0.0500, 'inclusive', true, false, true, 'razorpay')
ON CONFLICT (id) DO UPDATE SET
    restaurant_id = EXCLUDED.restaurant_id,
    currency = COALESCE(public.restaurant_settings.currency, EXCLUDED.currency);

-- 1.7 MENU CATEGORIES
CREATE TABLE IF NOT EXISTS public.menu_categories (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant_id ON public.menu_categories(restaurant_id);

-- 1.8 MENU ITEMS
CREATE TABLE IF NOT EXISTS public.menu_items (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    category_id TEXT REFERENCES public.menu_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    description TEXT,
    image_url TEXT,
    available BOOLEAN NOT NULL DEFAULT true,
    stock_count INTEGER,
    allergens TEXT[] DEFAULT '{}',
    is_special BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS stock_count INTEGER;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS allergens TEXT[] DEFAULT '{}';
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_special BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON public.menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_allergens ON public.menu_items USING GIN (allergens);

-- 1.9 MENU ITEM AVAILABILITY (OPERATIONAL 86'd LAYER)
CREATE TABLE IF NOT EXISTS public.menu_item_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    menu_item_id TEXT NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT true,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.menu_item_availability ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
CREATE INDEX IF NOT EXISTS idx_menu_item_avail_restaurant ON public.menu_item_availability(restaurant_id);

-- 1.10 PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    order_ref TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'razorpay',
    provider_payment_id TEXT,
    provider_order_id TEXT,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'pending',
    error_code TEXT,
    error_description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_order_ref ON public.payments(order_ref);
CREATE INDEX IF NOT EXISTS idx_payments_restaurant_id ON public.payments(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key ON public.payments(idempotency_key);

-- 1.11 SITE CONTENT
CREATE TABLE IF NOT EXISTS public.site_content (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    section TEXT NOT NULL,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.site_content ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
CREATE INDEX IF NOT EXISTS idx_site_content_restaurant_id ON public.site_content(restaurant_id);

-- 1.12 CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
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

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS order_count INTEGER DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_spent NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_order_at TIMESTAMPTZ;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS first_order_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_last_order ON public.customers(last_order_at DESC);

-- 1.13 DISCOUNT CODES
CREATE TABLE IF NOT EXISTS public.discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
    discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
    min_order_amount NUMERIC(10,2) DEFAULT 0,
    max_discount_amount NUMERIC(10,2),
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    valid_from TIMESTAMPTZ DEFAULT now(),
    valid_until TIMESTAMPTZ,
    active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percentage';
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(10,2);
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS max_uses INTEGER;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS created_by UUID;

-- Backfill valid_until if expires_at was present in legacy definitions
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'discount_codes' AND column_name = 'expires_at'
    ) THEN
        UPDATE public.discount_codes SET valid_until = COALESCE(valid_until, expires_at);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes(UPPER(code));

-- 1.14 HAPPY HOUR SCHEDULES
CREATE TABLE IF NOT EXISTS public.happy_hour_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL DEFAULT 'Happy Hour',
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    discount_percentage NUMERIC(5,2) NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
    category_id TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.happy_hour_schedules ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore';
ALTER TABLE public.happy_hour_schedules ADD COLUMN IF NOT EXISTS label TEXT DEFAULT 'Happy Hour';
ALTER TABLE public.happy_hour_schedules ADD COLUMN IF NOT EXISTS day_of_week INTEGER DEFAULT 1;
ALTER TABLE public.happy_hour_schedules ADD COLUMN IF NOT EXISTS start_time TIME DEFAULT '15:00';
ALTER TABLE public.happy_hour_schedules ADD COLUMN IF NOT EXISTS end_time TIME DEFAULT '17:00';
ALTER TABLE public.happy_hour_schedules ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2) DEFAULT 15.00;
ALTER TABLE public.happy_hour_schedules ADD COLUMN IF NOT EXISTS category_id TEXT;
ALTER TABLE public.happy_hour_schedules ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- ------------------------------------------------------------------------------
-- 2. AUTOMATIC UPDATED_AT TRIGGERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_reservations_updated_at ON public.reservations;
CREATE TRIGGER trg_reservations_updated_at BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_staff_profiles_updated_at ON public.staff_profiles;
CREATE TRIGGER trg_staff_profiles_updated_at BEFORE UPDATE ON public.staff_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_menu_items_updated_at ON public.menu_items;
CREATE TRIGGER trg_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_restaurant_settings_updated_at ON public.restaurant_settings;
CREATE TRIGGER trg_restaurant_settings_updated_at BEFORE UPDATE ON public.restaurant_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 3. INVENTORY & CUSTOMER AUTOMATION TRIGGERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_customer_from_order()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.customer_phone IS NOT NULL AND length(trim(NEW.customer_phone)) >= 7 THEN
        INSERT INTO public.customers (name, phone, order_count, total_spent, last_order_at, first_order_at)
        VALUES (
            NEW.customer_name,
            NEW.customer_phone,
            1,
            COALESCE(NEW.total, 0),
            NEW.created_at,
            NEW.created_at
        )
        ON CONFLICT (phone) DO UPDATE SET
            name = CASE WHEN LENGTH(NEW.customer_name) > LENGTH(public.customers.name) THEN NEW.customer_name ELSE public.customers.name END,
            order_count = public.customers.order_count + 1,
            total_spent = public.customers.total_spent + COALESCE(NEW.total, 0),
            last_order_at = GREATEST(public.customers.last_order_at, NEW.created_at),
            updated_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_upsert_customer_on_order ON public.orders;
CREATE TRIGGER trg_upsert_customer_on_order
    AFTER INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.upsert_customer_from_order();

CREATE OR REPLACE FUNCTION public.decrement_menu_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.menu_items
    SET stock_count = GREATEST(stock_count - NEW.quantity, 0),
        updated_at = now()
    WHERE id = NEW.menu_item_id
      AND stock_count IS NOT NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_decrement_stock ON public.order_items;
CREATE TRIGGER trg_decrement_stock
    AFTER INSERT ON public.order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.decrement_menu_stock();

-- ------------------------------------------------------------------------------
-- 4. REALTIME PUBLICATION CONFIGURATION
-- ------------------------------------------------------------------------------
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

ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- ------------------------------------------------------------------------------
-- 5. AUTH & RBAC HELPER FUNCTIONS
-- ------------------------------------------------------------------------------
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

-- Drop any conflicting multi-parameter versions from previous runs
DROP FUNCTION IF EXISTS public.is_active_staff(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.is_active_staff(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_staff_role(UUID, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_staff_role(p_uid UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT role FROM public.staff_profiles
    WHERE user_id = p_uid AND active = true
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_active_staff(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE user_id = p_uid AND active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE user_id = auth.uid() AND active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.generate_order_reference()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    v_year TEXT := to_char(CURRENT_DATE, 'YYYY');
    v_code TEXT := '';
    v_i INTEGER;
BEGIN
    FOR v_i IN 1..4 LOOP
        v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    END LOOP;
    RETURN 'CB-' || v_year || '-' || v_code;
END;
$$;

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
  SELECT active, role INTO v_is_active, v_caller_role
  FROM public.staff_profiles
  WHERE user_id = auth.uid();

  IF v_is_active IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Only active staff can modify order status.'
    );
  END IF;

  SELECT status, order_ref INTO v_current_status, v_order_ref
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found.');
  END IF;

  IF p_expected_current_status IS NOT NULL AND v_current_status != p_expected_current_status THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Conflict: Order status was modified concurrently.',
      'current_status', v_current_status
    );
  END IF;

  UPDATE public.orders
  SET 
    status = p_new_status,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_order_id
  RETURNING * INTO v_updated_order;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'order_ref', v_order_ref,
    'previous_status', v_current_status,
    'new_status', p_new_status
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. ATOMIC TRANSACTION FUNCTIONS (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

-- 6.1 ATOMIC ORDER CREATION (WITH 1-50 QUANTITY CAP & MAX 40 ITEMS CAP)
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

    -- 6. Validate each item and calculate subtotal strictly from DB prices:
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

        SELECT mi.price, mi.name, mi.available
        INTO v_db_unit_price, v_db_item_name, v_is_available
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND (mi.restaurant_id = v_restaurant_id OR mi.restaurant_id IS NULL)
        LIMIT 1;

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

        IF v_db_unit_price IS NULL THEN
            RAISE EXCEPTION 'Menu item not found in database: %', v_item_id;
        END IF;

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

    -- Discount deduction
    v_discount_amount := COALESCE((p_order->>'discount_amount')::NUMERIC, 0.00);
    IF v_discount_amount < 0 THEN
        v_discount_amount := 0.00;
    END IF;
    v_computed_total := GREATEST(0.00, v_computed_total - v_discount_amount);

    -- 8. Insert order record
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

    -- 9. Insert line items
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

-- 6.2 ATOMIC RESERVATION CREATION (SECURITY DEFINER)
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

    v_restaurant_id := trim(COALESCE(p_reservation->>'restaurant_id', 'the-cafe-barrackpore'));
    IF length(v_restaurant_id) < 2 THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    v_customer_name := trim(COALESCE(p_reservation->>'customer_name', ''));
    IF length(v_customer_name) < 2 THEN
        RAISE EXCEPTION 'Please enter a valid full name (minimum 2 characters)';
    END IF;

    v_customer_phone := trim(COALESCE(p_reservation->>'customer_phone', ''));
    IF length(v_customer_phone) < 7 THEN
        RAISE EXCEPTION 'Please enter a valid phone number';
    END IF;

    v_res_ref := trim(COALESCE(p_reservation->>'reservation_ref', ''));
    IF v_res_ref = '' THEN
        v_res_ref := 'RES-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
    END IF;

    IF p_reservation->>'reservation_date' IS NULL OR trim(p_reservation->>'reservation_date') = '' THEN
        RAISE EXCEPTION 'Please select a reservation date';
    END IF;

    BEGIN
        v_date := (p_reservation->>'reservation_date')::DATE;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid reservation date format';
    END;

    v_time := trim(COALESCE(p_reservation->>'reservation_time', ''));
    IF length(v_time) = 0 THEN
        RAISE EXCEPTION 'Please select a reservation time';
    END IF;

    BEGIN
        v_party_size := (p_reservation->>'party_size')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid party size';
    END;

    IF v_party_size IS NULL OR v_party_size < 1 OR v_party_size > 20 THEN
        RAISE EXCEPTION 'Party size must be between 1 and 20 guests';
    END IF;

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
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.happy_hour_schedules ENABLE ROW LEVEL SECURITY;

-- 7.1 ORDERS: STAFF ONLY SELECT & UPDATE (ZERO PUBLIC INSERT/SELECT)
DROP POLICY IF EXISTS "staff_view_orders" ON public.orders;
DROP POLICY IF EXISTS "staff_update_orders" ON public.orders;
DROP POLICY IF EXISTS "staff_select_orders_tenant" ON public.orders;
CREATE POLICY "staff_select_orders_tenant" ON public.orders
FOR SELECT TO authenticated
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR restaurant_id = public.get_auth_restaurant_id()
);

DROP POLICY IF EXISTS "staff_update_orders_tenant" ON public.orders;
CREATE POLICY "staff_update_orders_tenant" ON public.orders
FOR UPDATE TO authenticated
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR restaurant_id = public.get_auth_restaurant_id()
);

-- 7.2 ORDER ITEMS: STAFF ONLY SELECT
DROP POLICY IF EXISTS "staff_view_order_items" ON public.order_items;
DROP POLICY IF EXISTS "staff_select_order_items_tenant" ON public.order_items;
CREATE POLICY "staff_select_order_items_tenant" ON public.order_items
FOR SELECT TO authenticated
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR restaurant_id = public.get_auth_restaurant_id()
);

-- 7.3 RESERVATIONS: STAFF ONLY SELECT & UPDATE (ZERO PUBLIC INSERT/SELECT)
DROP POLICY IF EXISTS "staff_view_reservations" ON public.reservations;
DROP POLICY IF EXISTS "staff_update_reservations" ON public.reservations;
DROP POLICY IF EXISTS "staff_select_reservations_tenant" ON public.reservations;
CREATE POLICY "staff_select_reservations_tenant" ON public.reservations
FOR SELECT TO authenticated
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR restaurant_id = public.get_auth_restaurant_id()
);

DROP POLICY IF EXISTS "staff_update_reservations_tenant" ON public.reservations;
CREATE POLICY "staff_update_reservations_tenant" ON public.reservations
FOR UPDATE TO authenticated
USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR restaurant_id = public.get_auth_restaurant_id()
);

-- 7.4 STAFF PROFILES: LEAST PRIVILEGE RBAC
DROP POLICY IF EXISTS "staff_read_own_profile" ON public.staff_profiles;
DROP POLICY IF EXISTS "manager_read_all_profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "owner_manage_all_profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "staff_view_own_profile" ON public.staff_profiles;
CREATE POLICY "staff_view_own_profile" ON public.staff_profiles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.get_staff_role(auth.uid()) IN ('owner', 'manager'));

DROP POLICY IF EXISTS "owners_manage_staff_profiles" ON public.staff_profiles;
CREATE POLICY "owners_manage_staff_profiles" ON public.staff_profiles
FOR ALL TO authenticated
USING (public.get_staff_role(auth.uid()) = 'owner')
WITH CHECK (public.get_staff_role(auth.uid()) = 'owner');

-- 7.5 PUBLIC CATALOG (MENU, CATEGORIES, CONTENT, SETTINGS, TABLES)
DROP POLICY IF EXISTS "public_select_menu_categories" ON public.menu_categories;
CREATE POLICY "public_select_menu_categories" ON public.menu_categories FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "staff_manage_menu_categories" ON public.menu_categories;
CREATE POLICY "staff_manage_menu_categories" ON public.menu_categories FOR ALL TO authenticated
USING (public.get_staff_role(auth.uid()) IN ('owner', 'manager'))
WITH CHECK (public.get_staff_role(auth.uid()) IN ('owner', 'manager'));

DROP POLICY IF EXISTS "public_select_menu_items" ON public.menu_items;
CREATE POLICY "public_select_menu_items" ON public.menu_items FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "staff_manage_menu_items" ON public.menu_items;
CREATE POLICY "staff_manage_menu_items" ON public.menu_items FOR ALL TO authenticated
USING (public.get_staff_role(auth.uid()) IN ('owner', 'manager'))
WITH CHECK (public.get_staff_role(auth.uid()) IN ('owner', 'manager'));

DROP POLICY IF EXISTS "public_select_site_content" ON public.site_content;
CREATE POLICY "public_select_site_content" ON public.site_content FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "staff_manage_site_content" ON public.site_content;
CREATE POLICY "staff_manage_site_content" ON public.site_content FOR ALL TO authenticated
USING (public.get_staff_role(auth.uid()) IN ('owner', 'manager'))
WITH CHECK (public.get_staff_role(auth.uid()) IN ('owner', 'manager'));

DROP POLICY IF EXISTS "public_select_restaurant_settings" ON public.restaurant_settings;
CREATE POLICY "public_select_restaurant_settings" ON public.restaurant_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "owners_manage_restaurant_settings" ON public.restaurant_settings;
CREATE POLICY "owners_manage_restaurant_settings" ON public.restaurant_settings FOR ALL TO authenticated
USING (public.get_staff_role(auth.uid()) = 'owner')
WITH CHECK (public.get_staff_role(auth.uid()) = 'owner');

DROP POLICY IF EXISTS "public_select_restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "public_select_restaurant_tables" ON public.restaurant_tables FOR SELECT TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS "staff_manage_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "staff_manage_restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "staff_manage_restaurant_tables" ON public.restaurant_tables FOR ALL TO authenticated
USING (public.get_staff_role(auth.uid()) IN ('owner', 'manager'))
WITH CHECK (public.get_staff_role(auth.uid()) IN ('owner', 'manager'));

DROP POLICY IF EXISTS "public_read_availability" ON public.menu_item_availability;
DROP POLICY IF EXISTS "public_select_menu_item_availability" ON public.menu_item_availability;
CREATE POLICY "public_select_menu_item_availability" ON public.menu_item_availability FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "staff_manage_availability" ON public.menu_item_availability;
DROP POLICY IF EXISTS "staff_manage_menu_item_availability" ON public.menu_item_availability;
CREATE POLICY "staff_manage_menu_item_availability" ON public.menu_item_availability FOR ALL TO authenticated
USING (public.is_active_staff(auth.uid()))
WITH CHECK (public.is_active_staff(auth.uid()));

-- 7.6 PAYMENTS: STAFF ONLY
DROP POLICY IF EXISTS "staff_view_payments" ON public.payments;
DROP POLICY IF EXISTS "staff_select_payments" ON public.payments;
CREATE POLICY "staff_select_payments" ON public.payments FOR SELECT TO authenticated
USING (public.is_active_staff(auth.uid()));

-- 7.7 CUSTOMERS, DISCOUNTS, HAPPY HOUR
DROP POLICY IF EXISTS "staff_select_customers" ON public.customers;
CREATE POLICY "staff_select_customers" ON public.customers FOR SELECT TO authenticated
USING (public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "owners_update_customers" ON public.customers;
CREATE POLICY "owners_update_customers" ON public.customers FOR UPDATE TO authenticated
USING (public.get_staff_role(auth.uid()) = 'owner');

DROP POLICY IF EXISTS "public_select_discounts" ON public.discount_codes;
CREATE POLICY "public_select_discounts" ON public.discount_codes FOR SELECT TO anon, authenticated
USING (active = true AND (valid_until IS NULL OR valid_until > now()) AND (max_uses IS NULL OR used_count < max_uses));

DROP POLICY IF EXISTS "staff_manage_discounts" ON public.discount_codes;
CREATE POLICY "staff_manage_discounts" ON public.discount_codes FOR ALL TO authenticated
USING (public.get_staff_role(auth.uid()) IN ('owner', 'manager'))
WITH CHECK (public.get_staff_role(auth.uid()) IN ('owner', 'manager'));

DROP POLICY IF EXISTS "public_select_happy_hour" ON public.happy_hour_schedules;
CREATE POLICY "public_select_happy_hour" ON public.happy_hour_schedules FOR SELECT TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS "owners_manage_happy_hour" ON public.happy_hour_schedules;
CREATE POLICY "owners_manage_happy_hour" ON public.happy_hour_schedules FOR ALL TO authenticated
USING (public.get_staff_role(auth.uid()) = 'owner')
WITH CHECK (public.get_staff_role(auth.uid()) = 'owner');

-- ------------------------------------------------------------------------------
-- 8. STRICT LEAST PRIVILEGE PERMISSIONS (DIRECT INSERT LOCKDOWN)
-- ------------------------------------------------------------------------------
-- Revoke direct INSERT on transaction tables from anon and authenticated
REVOKE INSERT ON TABLE public.orders FROM anon, authenticated;
REVOKE INSERT ON TABLE public.order_items FROM anon, authenticated;
REVOKE INSERT ON TABLE public.reservations FROM anon, authenticated;

-- Service Role maintains administrative access for background webhooks and server tasks
GRANT ALL ON TABLE public.orders TO service_role;
GRANT ALL ON TABLE public.order_items TO service_role;
GRANT ALL ON TABLE public.reservations TO service_role;

-- Grant RPC execution rights
REVOKE ALL ON FUNCTION public.create_order_atomic(JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_reservation_atomic(JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_reservation_atomic(JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_order_reference() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_restaurant_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_staff(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_staff() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_staff_role(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_order_status_kitchen(UUID, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 9. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status ON public.orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_order_ref ON public.orders(order_ref);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date ON public.reservations(reservation_date, reservation_time);
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_status ON public.reservations(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_user_id ON public.staff_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_availability ON public.menu_items(restaurant_id, available);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON public.payments(idempotency_key);

-- ------------------------------------------------------------------------------
-- 10. AUTHORITATIVE SITE CONTENT SEED (HERO, STORY, VIBE, SPECIALS, GALLERY, BRANDING)
-- ------------------------------------------------------------------------------
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


