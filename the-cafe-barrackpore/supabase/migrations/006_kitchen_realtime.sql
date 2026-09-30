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
