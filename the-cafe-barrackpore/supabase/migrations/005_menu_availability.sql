-- ==============================================================================
-- Migration: 005_menu_availability.sql
-- Description: Operational Menu Availability & 86'd State Layer
-- Author: The Café Barrackpore Engineering Team
-- ==============================================================================

-- 1. Create menu_item_availability table
CREATE TABLE IF NOT EXISTS public.menu_item_availability (
    item_id VARCHAR(100) PRIMARY KEY,
    is_available BOOLEAN NOT NULL DEFAULT true,
    reason VARCHAR(255) DEFAULT '86''d out of stock',
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_menu_availability_available ON public.menu_item_availability (is_available);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.menu_item_availability ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Anyone (public customers, QR ordering, staff) can read availability
DROP POLICY IF EXISTS "public_read_menu_availability" ON public.menu_item_availability;
CREATE POLICY "public_read_menu_availability"
ON public.menu_item_availability
FOR SELECT
USING (true);

-- Active staff members can update or insert availability states
DROP POLICY IF EXISTS "staff_manage_menu_availability" ON public.menu_item_availability;
CREATE POLICY "staff_manage_menu_availability"
ON public.menu_item_availability
FOR ALL
USING (public.is_active_staff())
WITH CHECK (public.is_active_staff());

-- 4. Stored Procedure for atomic operational toggles
CREATE OR REPLACE FUNCTION public.toggle_menu_item_availability(
    p_item_id TEXT,
    p_is_available BOOLEAN,
    p_reason TEXT DEFAULT '86''d out of stock'
)
RETURNS public.menu_item_availability
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_updated_row public.menu_item_availability;
BEGIN
    -- Verify active staff permission
    IF NOT public.is_active_staff() THEN
        RAISE EXCEPTION 'Access denied: Only active staff can toggle menu availability.'
            USING ERRCODE = '42501';
    END IF;

    -- Upsert the availability state
    INSERT INTO public.menu_item_availability (
        item_id,
        is_available,
        reason,
        updated_by,
        updated_at
    )
    VALUES (
        p_item_id,
        p_is_available,
        p_reason,
        auth.uid(),
        timezone('utc'::text, now())
    )
    ON CONFLICT (item_id)
    DO UPDATE SET
        is_available = EXCLUDED.is_available,
        reason = EXCLUDED.reason,
        updated_by = auth.uid(),
        updated_at = timezone('utc'::text, now())
    RETURNING * INTO v_updated_row;

    RETURN v_updated_row;
END;
$$;

-- Grant permissions on stored procedure
REVOKE ALL ON FUNCTION public.toggle_menu_item_availability(TEXT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_menu_item_availability(TEXT, BOOLEAN, TEXT) TO authenticated;
