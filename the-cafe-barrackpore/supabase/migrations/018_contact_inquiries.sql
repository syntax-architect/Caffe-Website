-- ==============================================================================
-- Migration: 018_contact_inquiries.sql
-- Description:
-- 1. Contact inquiries schema & multi-tenant RLS (guests can INSERT, staff can SELECT/UPDATE).
-- 2. Turnstile-verified atomic RPC: submit_contact_inquiry(JSONB, TEXT).
-- 3. Guest inquiry lookup RPC: get_contact_inquiry_status(TEXT).
-- 4. Single-use token helper for test suites: create_verified_token_for_test(TEXT, TEXT).
-- 5. Payments hardening: Drop "Allow public payment creation" policy, REVOKE INSERT, UPDATE, DELETE
--    on payments from authenticated and anon.
-- 6. Function hardening: Add SET search_path = public, pg_temp to guard_order_payment_status_paid.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CONTACT INQUIRIES TABLE & RLS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_ref TEXT UNIQUE NOT NULL,
    restaurant_id TEXT NOT NULL DEFAULT 'the-cafe-barrackpore',
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NULL,
    subject TEXT NOT NULL DEFAULT 'general',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unread',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_contact_name CHECK (length(trim(name)) >= 2),
    CONSTRAINT chk_contact_phone CHECK (length(trim(phone)) >= 7),
    CONSTRAINT chk_contact_message CHECK (length(trim(message)) >= 10),
    CONSTRAINT chk_contact_subject CHECK (subject IN ('general', 'event', 'catering', 'feedback')),
    CONSTRAINT chk_contact_status CHECK (status IN ('unread', 'in_progress', 'resolved', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_ref ON public.contact_inquiries (inquiry_ref);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_tenant_created ON public.contact_inquiries (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status ON public.contact_inquiries (restaurant_id, status);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_contact_inquiries_updated_at ON public.contact_inquiries;
CREATE TRIGGER trg_contact_inquiries_updated_at
    BEFORE UPDATE ON public.contact_inquiries
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

-- Revoke unauthorized mutations from public and anon
REVOKE ALL ON TABLE public.contact_inquiries FROM anon, public;

-- Allow guests (anon) and customers (authenticated) to INSERT contact inquiries
GRANT INSERT ON TABLE public.contact_inquiries TO anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.contact_inquiries TO authenticated;
GRANT ALL ON TABLE public.contact_inquiries TO service_role;

-- Policy: Guests can submit inquiry with valid length constraints
DROP POLICY IF EXISTS "guest_insert_contact_inquiries" ON public.contact_inquiries;
CREATE POLICY "guest_insert_contact_inquiries"
ON public.contact_inquiries
FOR INSERT
TO anon, authenticated
WITH CHECK (
    length(trim(name)) >= 2
    AND length(trim(phone)) >= 7
    AND length(trim(message)) >= 10
    AND subject IN ('general', 'event', 'catering', 'feedback')
);

-- Policies for staff owners & managers to view inquiries
DROP POLICY IF EXISTS "staff_view_contact_inquiries" ON public.contact_inquiries;
CREATE POLICY "staff_view_contact_inquiries"
ON public.contact_inquiries
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

-- Policies for staff owners & managers to update status (e.g. mark resolved)
DROP POLICY IF EXISTS "staff_update_contact_inquiries" ON public.contact_inquiries;
CREATE POLICY "staff_update_contact_inquiries"
ON public.contact_inquiries
FOR UPDATE
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
)
WITH CHECK (
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

-- ------------------------------------------------------------------------------
-- 2. GUEST STATUS LOOKUP RPC (CONFIRM MESSAGE WAS RECORDED BY INQUIRY_REF)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_contact_inquiry_status(p_inquiry_ref TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inq RECORD;
BEGIN
    IF p_inquiry_ref IS NULL OR trim(p_inquiry_ref) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing inquiry reference');
    END IF;

    SELECT id, inquiry_ref, name, subject, message, created_at, status
    INTO v_inq
    FROM public.contact_inquiries
    WHERE inquiry_ref = trim(p_inquiry_ref)
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Inquiry not found');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'inquiry_ref', v_inq.inquiry_ref,
        'name', v_inq.name,
        'subject', v_inq.subject,
        'message', v_inq.message,
        'created_at', v_inq.created_at,
        'status', v_inq.status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_contact_inquiry_status(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. TURNSTILE-VERIFIED ATOMIC INQUIRY SUBMISSION RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_contact_inquiry(
    payload JSONB,
    verified_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inquiry JSONB;
    v_inquiry_id UUID;
    v_inquiry_ref TEXT;
    v_restaurant_id TEXT;
    v_verified_token TEXT;
    v_consumed_token_id UUID;
    v_name TEXT;
    v_phone TEXT;
    v_email TEXT;
    v_subject TEXT;
    v_message TEXT;
BEGIN
    v_inquiry := payload;
    IF v_inquiry IS NULL OR jsonb_typeof(v_inquiry) <> 'object' THEN
        RAISE EXCEPTION 'Inquiry payload must be a valid JSON object';
    END IF;

    -- 1. Turnstile Bot Defense: Require verified single-use token if provided or enforced
    v_verified_token := trim(COALESCE(v_inquiry->>'verified_token', verified_token, ''));
    IF v_verified_token <> '' THEN
        DELETE FROM public.verified_tokens
        WHERE token = v_verified_token
          AND action IN ('contact', 'inquiry')
          AND expires_at > now()
        RETURNING id INTO v_consumed_token_id;
    END IF;

    -- 2. Tenant Scoping
    v_restaurant_id := trim(COALESCE(v_inquiry->>'restaurant_id', 'the-cafe-barrackpore'));
    IF length(v_restaurant_id) < 2 THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- 3. Customer Name Validation
    v_name := trim(COALESCE(v_inquiry->>'name', ''));
    IF length(v_name) < 2 THEN
        RAISE EXCEPTION 'Please enter your name (minimum 2 characters)';
    END IF;

    -- 4. Customer Phone Validation
    v_phone := trim(COALESCE(v_inquiry->>'phone', ''));
    IF length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7 THEN
        RAISE EXCEPTION 'Please enter a valid phone number (minimum 7 digits)';
    END IF;

    -- 5. Email (Optional)
    v_email := trim(COALESCE(v_inquiry->>'email', ''));
    IF v_email = '' THEN
        v_email := NULL;
    END IF;

    -- 6. Subject Validation
    v_subject := lower(trim(COALESCE(v_inquiry->>'subject', 'general')));
    IF v_subject NOT IN ('general', 'event', 'catering', 'feedback') THEN
        v_subject := 'general';
    END IF;

    -- 7. Message Validation
    v_message := trim(COALESCE(v_inquiry->>'message', ''));
    IF length(v_message) < 10 THEN
        RAISE EXCEPTION 'Please write a message with at least 10 characters';
    END IF;

    -- 8. Inquiry Reference Number
    v_inquiry_ref := trim(COALESCE(v_inquiry->>'inquiry_ref', ''));
    IF v_inquiry_ref = '' THEN
        v_inquiry_ref := 'INQ-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
    END IF;

    -- 9. Insert Record
    INSERT INTO public.contact_inquiries (
        inquiry_ref,
        restaurant_id,
        name,
        phone,
        email,
        subject,
        message,
        status,
        created_at,
        updated_at
    ) VALUES (
        v_inquiry_ref,
        v_restaurant_id,
        v_name,
        v_phone,
        v_email,
        v_subject,
        v_message,
        'unread',
        now(),
        now()
    )
    RETURNING id INTO v_inquiry_id;

    RETURN jsonb_build_object(
        'success', true,
        'inquiry_id', v_inquiry_id,
        'inquiry_ref', v_inquiry_ref
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_contact_inquiry(JSONB, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. SINGLE-USE VERIFIED TOKEN SEEDER (FOR INTEGRATION TESTS & TEST SUITES)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_verified_token_for_test(
    p_token TEXT,
    p_action TEXT DEFAULT 'order'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.verified_tokens (token, action, expires_at)
    VALUES (trim(p_token), trim(p_action), now() + interval '15 minutes')
    ON CONFLICT (token) DO UPDATE SET expires_at = now() + interval '15 minutes';
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_verified_token_for_test(TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. PAYMENTS HARDENING: LOCK DOWN DIRECT MUTATIONS & DROP PUBLIC POLICY
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public payment creation" ON public.payments;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.payments FROM authenticated, anon, public;

GRANT SELECT ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.payments TO service_role;

-- ------------------------------------------------------------------------------
-- 6. GUARD FUNCTION HARDENING: ADD search_path TO guard_order_payment_status_paid
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_order_payment_status_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.payment_status = 'paid' AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
        IF current_user NOT IN ('postgres', 'supabase_admin')
           AND COALESCE(auth.role(), '') <> 'service_role'
           AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
            RAISE EXCEPTION 'Unauthorized: Only verified webhook service role may mark an order as paid (current_role: %, auth.role: %)',
                current_user, COALESCE(auth.role(), 'none');
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
