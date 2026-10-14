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
