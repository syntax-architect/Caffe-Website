-- ==============================================================================
-- Migration: 019_contact_inquiries_hardening.sql
-- Description:
-- 1. Security hardening: DROP FUNCTION public.create_verified_token_for_test(TEXT, TEXT).
-- 2. contact_inquiries lockdown: DROP POLICY "guest_insert_contact_inquiries",
--    REVOKE INSERT, UPDATE, DELETE on contact_inquiries from anon and authenticated.
--    Only the SECURITY DEFINER submit_contact_inquiry RPC may insert.
-- 3. submit_contact_inquiry hardening:
--    - Always require a valid single-use token with action 'contact' (raise exception otherwise).
--    - Ignore client restaurant_id and read strictly from restaurant_settings.
--    - Ignore any client-supplied inquiry_ref and generate server-side with 16+ random characters.
-- 4. Inquiry refs: generate with 16+ random characters.
-- 5. get_contact_inquiry_status hardening:
--    - Drop legacy 1-arg signature.
--    - Require matching customer phone number.
--    - Return only status, never the customer message.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DROP TEST TOKEN SEEDER FUNCTION (SECURITY HARDENING)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_verified_token_for_test(TEXT, TEXT);

-- ------------------------------------------------------------------------------
-- 2. LOCK DOWN contact_inquiries TABLE DIRECT MUTATIONS
-- ------------------------------------------------------------------------------
-- Drop guest insert policy so no client can directly INSERT
DROP POLICY IF EXISTS "guest_insert_contact_inquiries" ON public.contact_inquiries;

-- Revoke direct mutations from anon and authenticated (and public)
REVOKE INSERT, UPDATE, DELETE ON TABLE public.contact_inquiries FROM anon, authenticated, public;

-- Ensure service_role has full table access for internal RPCs and admin
GRANT ALL ON TABLE public.contact_inquiries TO service_role;

-- ------------------------------------------------------------------------------
-- 3. HARDENED submit_contact_inquiry RPC
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

    -- 1. Bot Defense: Strictly require valid single-use token with action 'contact'
    v_verified_token := trim(COALESCE(v_inquiry->>'verified_token', verified_token, ''));
    IF v_verified_token = '' THEN
        RAISE EXCEPTION 'Valid single-use verified token is required for contact inquiry';
    END IF;

    DELETE FROM public.verified_tokens
    WHERE token = v_verified_token
      AND action = 'contact'
      AND expires_at > now()
    RETURNING id INTO v_consumed_token_id;

    IF v_consumed_token_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired verified token for contact inquiry';
    END IF;

    -- 2. Tenant Scoping: Strictly read restaurant_id from restaurant_settings (ignore client restaurant_id)
    SELECT rs.restaurant_id
    INTO v_restaurant_id
    FROM public.restaurant_settings rs
    LIMIT 1;

    IF v_restaurant_id IS NULL OR trim(v_restaurant_id) = '' THEN
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

    -- 8. Inquiry Reference Number: Ignore any client-supplied inquiry_ref; generate 16+ random characters
    v_inquiry_ref := 'INQ-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 16));

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

REVOKE ALL ON FUNCTION public.submit_contact_inquiry(JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_contact_inquiry(JSONB, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. HARDENED get_contact_inquiry_status RPC
-- ------------------------------------------------------------------------------
-- Drop old single-argument signature
DROP FUNCTION IF EXISTS public.get_contact_inquiry_status(TEXT);

-- Require matching phone number and return ONLY status, never the message
CREATE OR REPLACE FUNCTION public.get_contact_inquiry_status(
    p_inquiry_ref TEXT,
    p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_status TEXT;
    v_clean_phone TEXT;
BEGIN
    IF p_inquiry_ref IS NULL OR trim(p_inquiry_ref) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing inquiry reference');
    END IF;

    IF p_phone IS NULL OR trim(p_phone) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing phone number');
    END IF;

    v_clean_phone := regexp_replace(trim(p_phone), '[^0-9]', '', 'g');

    SELECT status
    INTO v_status
    FROM public.contact_inquiries
    WHERE inquiry_ref = trim(p_inquiry_ref)
      AND (
          phone = trim(p_phone)
          OR regexp_replace(phone, '[^0-9]', '', 'g') = v_clean_phone
      )
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Inquiry not found');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'status', v_status
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_contact_inquiry_status(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contact_inquiry_status(TEXT, TEXT) TO anon, authenticated, service_role;
