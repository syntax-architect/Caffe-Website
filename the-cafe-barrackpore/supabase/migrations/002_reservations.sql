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
