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
CREATE POLICY "Allow public payment creation"
    ON public.payments
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Active staff, managers and owners can read payment records for operations & reconciliation
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
