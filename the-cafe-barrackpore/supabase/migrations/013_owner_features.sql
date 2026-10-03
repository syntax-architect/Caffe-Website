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
