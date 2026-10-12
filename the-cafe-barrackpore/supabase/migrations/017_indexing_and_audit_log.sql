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
