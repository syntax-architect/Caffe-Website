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
