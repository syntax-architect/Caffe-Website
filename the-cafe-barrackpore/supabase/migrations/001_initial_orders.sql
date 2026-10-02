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
