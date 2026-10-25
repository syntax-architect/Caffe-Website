-- ==============================================================================
-- Migration 028: Tax Strict Gating & PGCrypto Blowfish Manager PIN Hashing
-- ==============================================================================
-- 1. Tax Invariant: If tax is enabled and no verified tax rule matches, RAISE an exception
--    (NO 0% silent fallback or tax leakage).
-- 2. Security Invariant: Replace SHA-256 PIN hash with pgcrypto crypt(pin, gen_salt('bf', 8)).
--    Preserves 5-attempt lockout, 15-minute cooldown, and audit logging.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. STRICT TAX RESOLUTION FUNCTION: RAISE ERROR ON NO MATCH
CREATE OR REPLACE FUNCTION public.resolve_dated_tax_rate(
    p_country TEXT,
    p_region TEXT DEFAULT 'ALL',
    p_category TEXT DEFAULT 'food',
    p_order_type TEXT DEFAULT 'dine_in',
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    rule_label VARCHAR,
    rate NUMERIC,
    mode VARCHAR,
    status VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT tr.rule_label, tr.rate, tr.mode, tr.status
    FROM public.tax_rules tr
    WHERE tr.country = p_country
      AND (tr.region = p_region OR tr.region = 'ALL')
      AND (tr.order_type = 'all' OR tr.order_type = p_order_type)
      AND p_category = ANY(tr.applies_to)
      AND tr.effective_from <= p_date
      AND (tr.effective_to IS NULL OR tr.effective_to >= p_date)
      AND tr.status = 'verified'
    ORDER BY 
      CASE WHEN tr.region = p_region THEN 0 ELSE 1 END,
      CASE WHEN tr.order_type = p_order_type THEN 0 ELSE 1 END,
      tr.effective_from DESC
    LIMIT 1;

    -- If tax is enabled and no rule matches, SQL must RAISE an error (not charge 0%)
    IF NOT FOUND THEN
        RAISE EXCEPTION 'NO_MATCHING_TAX_RULE: No active verified tax rule matches country=%, region=%, category=%, order_type=%, date=%. Tax is enabled but jurisdiction has no matching rule.',
            p_country, p_region, p_category, p_order_type, p_date;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_dated_tax_rate(TEXT, TEXT, TEXT, TEXT, DATE) TO authenticated, anon, service_role;

-- 2. CRYPTOGRAPHIC MANAGER PIN HASH: BLOWFISH BCRYPT VIA PGCRYPTO
CREATE OR REPLACE FUNCTION public.hash_manager_pin(p_pin TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_pin IS NULL OR length(trim(p_pin)) < 4 OR length(trim(p_pin)) > 8 OR trim(p_pin) !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'Manager PIN must be between 4 and 8 numeric digits';
    END IF;

    -- PGCrypto Blowfish crypt with 8 rounds of cost factor
    RETURN crypt(trim(p_pin), gen_salt('bf', 8));
END;
$$;

-- 3. CRYPTOGRAPHIC PIN VERIFY HELPER (Supports bcrypt $2... while maintaining migration path)
CREATE OR REPLACE FUNCTION public.internal_verify_pin_hash(p_pin TEXT, p_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_salt TEXT;
    v_expected TEXT;
BEGIN
    IF p_pin IS NULL OR p_hash IS NULL OR trim(p_pin) = '' OR trim(p_hash) = '' THEN
        RETURN FALSE;
    END IF;

    -- 1. Blowfish bcrypt ($2a$ or $2b$) check via pgcrypto crypt()
    IF p_hash LIKE '$2%' THEN
        RETURN (crypt(trim(p_pin), p_hash) = p_hash);
    END IF;

    -- 2. Legacy Salted SHA-256 format: "salt$hexhash"
    IF position('$' IN p_hash) > 0 THEN
        v_salt := split_part(p_hash, '$', 1);
        v_expected := v_salt || '$' || encode(sha256((v_salt || ':' || trim(p_pin))::bytea), 'hex');
        RETURN (p_hash = v_expected);
    END IF;

    -- 3. Raw sha256 fallback
    RETURN (p_hash = encode(sha256(trim(p_pin)::bytea), 'hex'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.hash_manager_pin(TEXT) TO authenticated, service_role;
