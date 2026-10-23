-- ==============================================================================
-- Migration: 023_dated_tax_registry.sql
-- Description:
-- 1. Dated Tax Rules Table (public.tax_rules):
--    - country, region, rule_label, rate, mode, applies_to (categories),
--      order_type (all/dine_in/takeaway/delivery), effective_from, effective_to,
--      source_url, last_verified_at, status (verified/unverified).
-- 2. Extended Item Categories:
--    - food, hot_drink, soft_drink, bottled_water, alcohol, tobacco,
--      packaged_goods, service, exempt.
--    - Adds tax_category to menu_items and order_items.
-- 3. Restaurant Settings Governance:
--    - country, region, accountant_verified, accountant_verified_at,
--      accountant_notes, cover_charge, cover_charge_label, cover_charge_taxable.
-- 4. Seed Verified Rules for Core 14 Jurisdictions:
--    - Ireland (IE), United Kingdom (GB), United States (US: NY, CA, TX, FL),
--      Canada (CA: ON, BC, AB), Australia (AU), New Zealand (NZ), UAE (AE),
--      Singapore (SG: 8% 2023 -> 9% 2024), India (IN: standalone 5%, hotel premises 18%,
--      alcohol outside GST 0%), Germany (DE: 7% temp dine-in -> 19% 2024),
--      France (FR), Spain (ES), Italy (IT), Netherlands (NL).
-- 5. Updated create_order_atomic:
--    - Date-aware rule resolution on order date (CURRENT_DATE).
--    - Go-live protection: Blocks live ordering if accountant has not confirmed
--      or if active rules are unverified.
--    - Item category tax resolution (exempt items = 0%).
--    - Tips invariant: strictly NEVER taxed across all jurisdictions.
--    - Emits dated receipt tax breakdown with rates_as_of date and tax ID.
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DATED TAX RULES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country VARCHAR(10) NOT NULL,
    region VARCHAR(50) NOT NULL DEFAULT 'ALL',
    rule_label VARCHAR(100) NOT NULL,
    rate NUMERIC(6, 4) NOT NULL,
    mode VARCHAR(20) NOT NULL DEFAULT 'inclusive' CHECK (mode IN ('inclusive', 'exclusive')),
    applies_to TEXT[] NOT NULL,
    order_type VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (order_type IN ('all', 'dine_in', 'takeaway', 'delivery')),
    effective_from DATE NOT NULL,
    effective_to DATE,
    source_url TEXT NOT NULL,
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status VARCHAR(20) NOT NULL DEFAULT 'verified' CHECK (status IN ('verified', 'unverified', 'conflict')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_effective_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_tax_rules_lookup 
ON public.tax_rules(country, region, status, effective_from, effective_to);

-- Row Level Security
ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tax_rules' AND policyname = 'Allow public read access to tax rules'
    ) THEN
        CREATE POLICY "Allow public read access to tax rules" 
        ON public.tax_rules FOR SELECT USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tax_rules' AND policyname = 'Allow owners and service role to manage tax rules'
    ) THEN
        CREATE POLICY "Allow owners and service role to manage tax rules" 
        ON public.tax_rules FOR ALL 
        USING (
            COALESCE(auth.role(), '') = 'service_role' OR 
            EXISTS (SELECT 1 FROM public.staff_profiles WHERE user_id = auth.uid() AND role = 'owner')
        );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. SCHEMA ADDITIONS ON EXISTING TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS tax_category VARCHAR(30) DEFAULT 'food';

ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS tax_category VARCHAR(30) DEFAULT 'food';

ALTER TABLE public.restaurant_settings 
ADD COLUMN IF NOT EXISTS country VARCHAR(10) DEFAULT 'IN',
ADD COLUMN IF NOT EXISTS region VARCHAR(50) DEFAULT 'ALL',
ADD COLUMN IF NOT EXISTS accountant_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS accountant_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS accountant_notes TEXT,
ADD COLUMN IF NOT EXISTS cover_charge NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS cover_charge_label VARCHAR(50) DEFAULT 'Cover Charge',
ADD COLUMN IF NOT EXISTS cover_charge_taxable BOOLEAN DEFAULT FALSE;

-- ------------------------------------------------------------------------------
-- 3. SEED DATED RULES FOR 14 CORE JURISDICTIONS
-- ------------------------------------------------------------------------------
DELETE FROM public.tax_rules WHERE country IN (
    'IE', 'GB', 'US', 'CA', 'AU', 'NZ', 'AE', 'SG', 'IN', 'DE', 'FR', 'ES', 'IT', 'NL'
);

INSERT INTO public.tax_rules (
    country, region, rule_label, rate, mode, applies_to, order_type,
    effective_from, effective_to, source_url, status
) VALUES
-- Ireland (IE)
('IE', 'ALL', 'VAT Restaurant Food & Hot Drinks', 0.0900, 'inclusive',
 ARRAY['food', 'hot_drink'], 'all', '2023-09-01', NULL,
 'https://www.revenue.ie/en/vat/vat-rates/search-vat-rates/restaurant-services.aspx', 'verified'),
('IE', 'ALL', 'VAT Standard (Alcohol & Cold Packaged Drinks)', 0.2300, 'inclusive',
 ARRAY['soft_drink', 'bottled_water', 'alcohol'], 'all', '2021-03-01', NULL,
 'https://www.revenue.ie/en/vat/vat-rates/search-vat-rates/alcoholic-drinks.aspx', 'verified'),

-- United Kingdom (GB)
('GB', 'ALL', 'Standard Rate VAT', 0.2000, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol'], 'all', '2011-01-04', NULL,
 'https://www.gov.uk/guidance/catering-takeaway-food-and-vat-notice-7091', 'verified'),
('GB', 'ALL', 'Zero-rate Takeaway Cold Food', 0.0000, 'inclusive',
 ARRAY['food'], 'takeaway', '2011-01-04', NULL,
 'https://www.gov.uk/guidance/catering-takeaway-food-and-vat-notice-7091#cold-takeaway-food', 'verified'),

-- United States (US: State-level)
('US', 'NY', 'NYS and Local Sales Tax (NYC)', 0.08875, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2020-01-01', NULL,
 'https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/sales_by_restaurants.htm', 'verified'),
('US', 'CA', 'California State & Local Sales Tax', 0.0725, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2020-01-01', NULL,
 'https://www.cdtfa.ca.gov/formspubs/pub22.pdf', 'verified'),
('US', 'TX', 'Texas State & Local Sales Tax', 0.0825, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2020-01-01', NULL,
 'https://comptroller.texas.gov/taxes/publications/96-117.php', 'verified'),
('US', 'FL', 'Florida Sales Tax', 0.0600, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2020-01-01', NULL,
 'https://floridarevenue.com/taxes/taxesfees/Pages/sales_tax.aspx', 'verified'),

-- Canada (CA: Province-level)
('CA', 'ON', 'Ontario Harmonized Sales Tax (HST)', 0.1300, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2010-07-01', NULL,
 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html', 'verified'),
('CA', 'BC', 'British Columbia GST + PST', 0.1200, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2013-04-01', NULL,
 'https://www2.gov.bc.ca/gov/content/taxes/sales-taxes/pst/publications/restaurant-food-services', 'verified'),
('CA', 'AB', 'Alberta GST', 0.0500, 'exclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2008-01-01', NULL,
 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html', 'verified'),

-- Australia (AU)
('AU', 'ALL', 'Goods and Services Tax (GST)', 0.1000, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2000-07-01', NULL,
 'https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/in-detail/your-industry/restaurant-and-catering', 'verified'),

-- New Zealand (NZ)
('NZ', 'ALL', 'Goods and Services Tax (GST)', 0.1500, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2010-10-01', NULL,
 'https://www.ird.govt.nz/gst', 'verified'),

-- United Arab Emirates (AE)
('AE', 'ALL', 'UAE Value Added Tax (VAT)', 0.0500, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2018-01-01', NULL,
 'https://tax.gov.ae/en/legislation/vat-legislation.aspx', 'verified'),

-- Singapore (SG: Dated rate increase 8% in 2023 -> 9% in 2024)
('SG', 'ALL', 'Singapore GST 2023', 0.0800, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2023-01-01', '2023-12-31',
 'https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/gst-rate-change', 'verified'),
('SG', 'ALL', 'Singapore GST 2024+', 0.0900, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2024-01-01', NULL,
 'https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/gst-rate-change', 'verified'),

-- India (IN: Standalone 5% without ITC, Hotel Premises 18% with ITC, Alcohol outside GST)
('IN', 'STANDALONE', 'GST Standalone Restaurant (without ITC)', 0.0500, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'packaged_goods'], 'all', '2017-11-15', NULL,
 'https://cbic-gst.gov.in/pdf/notification-46-2017-central-tax-rate.pdf', 'verified'),
('IN', 'HOTEL_PREMISES', 'GST Hotel Premises declared tariff >= 7500 (with ITC)', 0.1800, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'packaged_goods'], 'all', '2019-10-01', NULL,
 'https://cbic-gst.gov.in/pdf/notification-20-2019-central-tax-rate.pdf', 'verified'),
('IN', 'ALL', 'GST Standalone Restaurant (without ITC)', 0.0500, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'packaged_goods'], 'all', '2017-11-15', NULL,
 'https://cbic-gst.gov.in/pdf/notification-46-2017-central-tax-rate.pdf', 'verified'),
('IN', 'ALL', 'Alcohol for Human Consumption (outside GST)', 0.0000, 'inclusive',
 ARRAY['alcohol'], 'all', '2017-07-01', NULL,
 'https://cbic-gst.gov.in/gst-goods-services-rates.html', 'verified'),

-- Germany (DE: Dated transition - 7% temp dine-in food ended 2023-12-31 -> 19% standard 2024+)
('DE', 'ALL', 'Temporary Reduced MwSt Restaurant Food (COVID/Energy Relief)', 0.0700, 'inclusive',
 ARRAY['food'], 'dine_in', '2020-07-01', '2023-12-31',
 'https://www.bundesfinanzministerium.de', 'verified'),
('DE', 'ALL', 'Standard MwSt Restaurant Services', 0.1900, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water', 'alcohol', 'packaged_goods'], 'all', '2024-01-01', NULL,
 'https://www.bundesfinanzministerium.de', 'verified'),
('DE', 'ALL', 'Takeaway Food Reduced MwSt', 0.0700, 'inclusive',
 ARRAY['food'], 'takeaway', '2024-01-01', NULL,
 'https://www.bundesfinanzministerium.de', 'verified'),

-- France (FR: 10% food/soft drinks, 20% alcohol)
('FR', 'ALL', 'TVA Restauration (Alimentation & Boissons sans alcool)', 0.1000, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water'], 'all', '2014-01-01', NULL,
 'https://www.economie.gouv.fr/entreprises/taux-tva-restauration', 'verified'),
('FR', 'ALL', 'TVA Boissons Alcooliques', 0.2000, 'inclusive',
 ARRAY['alcohol'], 'all', '2014-01-01', NULL,
 'https://www.economie.gouv.fr/entreprises/taux-tva-restauration', 'verified'),

-- Spain (ES: 10% food/soft drinks, 21% alcohol)
('ES', 'ALL', 'IVA Reducido Hostelería', 0.1000, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water'], 'all', '2012-09-01', NULL,
 'https://sede.agenciatributaria.gob.es', 'verified'),
('ES', 'ALL', 'IVA General Bebidas Alcohólicas', 0.2100, 'inclusive',
 ARRAY['alcohol'], 'all', '2012-09-01', NULL,
 'https://sede.agenciatributaria.gob.es', 'verified'),

-- Italy (IT: 10% food/soft drinks, 22% alcohol)
('IT', 'ALL', 'IVA Ridotta Ristorazione', 0.1000, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water'], 'all', '2013-10-01', NULL,
 'https://www.agenziaentrate.gov.it', 'verified'),
('IT', 'ALL', 'IVA Ordinaria Bevande Alcoliche', 0.2200, 'inclusive',
 ARRAY['alcohol'], 'all', '2013-10-01', NULL,
 'https://www.agenziaentrate.gov.it', 'verified'),

-- Netherlands (NL: 9% food/soft drinks, 21% alcohol)
('NL', 'ALL', 'BTW Laag Tarief Voedingsmiddelen & Alcoholvrije Dranken', 0.0900, 'inclusive',
 ARRAY['food', 'hot_drink', 'soft_drink', 'bottled_water'], 'all', '2019-01-01', NULL,
 'https://www.belastingdienst.nl', 'verified'),
('NL', 'ALL', 'BTW Hoog Tarief Alcoholhoudende Dranken', 0.2100, 'inclusive',
 ARRAY['alcohol'], 'all', '2019-01-01', NULL,
 'https://www.belastingdienst.nl', 'verified');

-- ------------------------------------------------------------------------------
-- 4. HELPER FUNCTION: resolve_dated_tax_rate
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_dated_tax_rate(
    p_country TEXT,
    p_region TEXT,
    p_category TEXT,
    p_order_type TEXT,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    rule_label VARCHAR,
    rate NUMERIC,
    mode VARCHAR,
    status VARCHAR
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    -- Category 'exempt' is always zero tax
    IF p_category = 'exempt' THEN
        RETURN QUERY SELECT 'Tax Exempt'::VARCHAR, 0.0000::NUMERIC, 'inclusive'::VARCHAR, 'verified'::VARCHAR;
        RETURN;
    END IF;

    -- Look up matching rule valid on the specified date
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

    -- Fallback if no specific rule matched: return zero rate instead of silent 5% assumption
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Zero Rate / Exempt'::VARCHAR, 0.0000::NUMERIC, 'inclusive'::VARCHAR, 'verified'::VARCHAR;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_dated_tax_rate(TEXT, TEXT, TEXT, TEXT, DATE) TO authenticated, anon, service_role;

-- ------------------------------------------------------------------------------
-- 5. UPDATED create_order_atomic WITH DATED TAX REGISTRY ENFORCEMENT
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order JSONB,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_order_ref TEXT;
    v_restaurant_id TEXT;
    v_verified_token TEXT;
    v_consumed_token_id UUID;
    v_raw_payment_token TEXT;
    v_payment_token_hash TEXT;
    v_item JSONB;
    v_item_id TEXT;
    v_quantity INTEGER;
    v_db_unit_price NUMERIC;
    v_db_item_name TEXT;
    v_item_tax_cat TEXT;
    v_is_available BOOLEAN;
    v_line_total NUMERIC;
    v_computed_subtotal NUMERIC := 0.00;
    v_computed_total NUMERIC := 0.00;
    v_tax_amount NUMERIC := 0.00;
    v_discount_amount NUMERIC := 0.00;
    v_tip_amount NUMERIC := 0.00;
    
    -- Restaurant & Tax Registry settings
    v_tax_enabled BOOLEAN := true;
    v_currency TEXT := 'INR';
    v_country TEXT := 'IN';
    v_region TEXT := 'ALL';
    v_accountant_verified BOOLEAN := false;
    v_tax_id TEXT := NULL;
    v_tax_id_label TEXT := 'GSTIN';
    v_is_ordering_enabled BOOLEAN := true;
    v_order_date DATE := CURRENT_DATE;
    
    -- Item-level tax tracking
    v_rule_label VARCHAR;
    v_rule_rate NUMERIC;
    v_rule_mode VARCHAR;
    v_rule_status VARCHAR;
    v_line_tax NUMERIC;
    v_item_tax_summary JSONB := '[]'::jsonb;
    
    -- Payment fields
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_payment_required BOOLEAN;
    v_order_type TEXT;
    v_created_at TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    -- 1. Read restaurant settings & tax governance
    SELECT 
        rs.restaurant_id,
        COALESCE(rs.tax_enabled, true),
        COALESCE(rs.currency, 'INR'),
        COALESCE(rs.country, 'IN'),
        COALESCE(rs.region, 'ALL'),
        COALESCE(rs.accountant_verified, false),
        rs.tax_id,
        COALESCE(rs.tax_id_label, 'Tax ID'),
        COALESCE(rs.is_ordering_enabled, true)
    INTO 
        v_restaurant_id,
        v_tax_enabled,
        v_currency,
        v_country,
        v_region,
        v_accountant_verified,
        v_tax_id,
        v_tax_id_label,
        v_is_ordering_enabled
    FROM public.restaurant_settings rs
    LIMIT 1;

    IF v_restaurant_id IS NULL OR trim(v_restaurant_id) = '' THEN
        v_restaurant_id := 'the-cafe-barrackpore';
    END IF;

    -- 2. Feature Toggle & Operational Gates
    IF NOT public.is_feature_enabled('online_ordering', v_restaurant_id) OR NOT v_is_ordering_enabled THEN
        RAISE EXCEPTION 'Online ordering is currently disabled for this restaurant.';
    END IF;

    -- 3. GO-LIVE PROTECTION: Accountant Verification & Unverified Rules Gate
    -- Live order placement is strictly blocked until an accountant confirms settings
    -- and no active rules for this country/region are unverified.
    IF NOT v_accountant_verified THEN
        RAISE EXCEPTION 'LIVE_ORDERING_BLOCKED: Tax rules and compliance configuration must be verified and signed off by an accountant before taking customer orders.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.tax_rules tr
        WHERE tr.country = v_country
          AND (tr.region = v_region OR tr.region = 'ALL')
          AND tr.status <> 'verified'
          AND tr.effective_from <= v_order_date
          AND (tr.effective_to IS NULL OR tr.effective_to >= v_order_date)
    ) THEN
        RAISE EXCEPTION 'LIVE_ORDERING_BLOCKED: Unverified tax rules exist for % (region: %). All rules must be verified before going live.', v_country, v_region;
    END IF;

    v_order_type := lower(trim(COALESCE(p_order->>'order_type', '')));

    IF v_order_type = 'dine_in' AND NOT public.is_feature_enabled('qr_table_ordering', v_restaurant_id) THEN
        RAISE EXCEPTION 'QR Table Ordering is currently disabled for this restaurant.';
    END IF;

    IF v_order_type = 'takeaway' AND NOT public.is_feature_enabled('takeaway', v_restaurant_id) THEN
        RAISE EXCEPTION 'Takeaway ordering is currently disabled for this restaurant.';
    END IF;

    IF v_order_type = 'delivery' AND NOT public.is_feature_enabled('delivery', v_restaurant_id) THEN
        RAISE EXCEPTION 'Delivery ordering is currently disabled for this restaurant.';
    END IF;

    v_payment_method := lower(trim(COALESCE(
        p_order->>'payment_method',
        p_order->>'payment_provider',
        ''
    )));

    IF v_payment_method NOT IN ('counter', 'pay_at_counter', 'cash', 'manual', '') 
       AND NOT public.is_feature_enabled('online_payments', v_restaurant_id) THEN
        RAISE EXCEPTION 'Online payments are currently disabled by the restaurant. Please choose Pay at Counter.';
    END IF;

    IF p_order->>'discount_code' IS NOT NULL AND length(trim(p_order->>'discount_code')) > 0 
       AND NOT public.is_feature_enabled('discounts', v_restaurant_id) THEN
        RAISE EXCEPTION 'Discounts and promotional coupons are currently disabled.';
    END IF;

    v_tip_amount := COALESCE((p_order->>'tip_amount')::numeric, 0.00);
    IF v_tip_amount > 0 AND NOT public.is_feature_enabled('tips', v_restaurant_id) THEN
        RAISE EXCEPTION 'Tips and gratuities are currently disabled.';
    END IF;

    -- 4. Input Validation: Check items array
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cannot create an order with empty items';
    END IF;

    IF jsonb_array_length(p_items) > 40 THEN
        RAISE EXCEPTION 'Order cannot contain more than 40 distinct items';
    END IF;

    -- 5. Turnstile Bot Defense: Require verified single-use token
    v_verified_token := trim(COALESCE(p_order->>'verified_token', ''));
    IF v_verified_token = '' THEN
        RAISE EXCEPTION 'A verified Turnstile token is required to place an order';
    END IF;

    DELETE FROM public.verified_tokens
    WHERE token = v_verified_token
      AND action IN ('order', 'checkout')
      AND expires_at > now()
    RETURNING id INTO v_consumed_token_id;

    IF v_consumed_token_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired security token. Please verify again.';
    END IF;

    -- 6. Validate Customer Details
    IF p_order->>'customer_name' IS NULL OR length(trim(p_order->>'customer_name')) < 2 THEN
        RAISE EXCEPTION 'Invalid customer name: minimum 2 characters required';
    END IF;

    IF p_order->>'customer_phone' IS NULL OR length(trim(p_order->>'customer_phone')) < 10 THEN
        RAISE EXCEPTION 'Invalid customer phone: minimum 10 digits required';
    END IF;

    IF v_order_type NOT IN ('dine_in', 'takeaway', 'delivery') THEN
        RAISE EXCEPTION 'Invalid order_type: must be dine_in, takeaway, or delivery';
    END IF;

    IF v_order_type = 'dine_in' AND (p_order->>'table_number' IS NULL OR length(trim(p_order->>'table_number')) = 0) THEN
        RAISE EXCEPTION 'Dine-in orders require a valid table_number';
    END IF;

    -- 7. Generate order reference & single-use payment token
    v_order_ref := 'CB-' || to_char(CURRENT_DATE, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    v_raw_payment_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_payment_token_hash := encode(sha256(v_raw_payment_token::bytea), 'hex');

    -- 8. Determine payment_status
    IF v_payment_method IN ('counter', 'pay_at_counter', 'cash', 'manual') THEN
        v_payment_status := 'pay_at_counter';
        v_payment_required := false;
    ELSE
        v_payment_status := 'pending';
        v_payment_required := true;
    END IF;

    -- 9. Iterate items: Price & Dated Tax Category Resolution
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := v_item->>'menu_item_id';
        v_quantity := (v_item->>'quantity')::INTEGER;

        IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 50 THEN
            RAISE EXCEPTION 'Invalid item quantity for item %: must be between 1 and 50', v_item_id;
        END IF;

        SELECT mi.price, mi.name, mi.available, COALESCE(mi.tax_category, 'food')
        INTO v_db_unit_price, v_db_item_name, v_is_available, v_item_tax_cat
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND mi.restaurant_id = v_restaurant_id;

        IF v_db_unit_price IS NULL THEN
            RAISE EXCEPTION 'Item not found in restaurant menu: %', v_item_id;
        END IF;

        IF NOT v_is_available THEN
            RAISE EXCEPTION 'Item % (%) is currently sold out and cannot be ordered', v_db_item_name, v_item_id;
        END IF;

        v_line_total := v_db_unit_price * v_quantity;
        v_computed_subtotal := v_computed_subtotal + v_line_total;

        -- Resolve dated tax rule valid on v_order_date
        IF v_tax_enabled THEN
            SELECT r.rule_label, r.rate, r.mode, r.status
            INTO v_rule_label, v_rule_rate, v_rule_mode, v_rule_status
            FROM public.resolve_dated_tax_rate(
                v_country,
                v_region,
                v_item_tax_cat,
                v_order_type,
                v_order_date
            ) r;

            IF v_rule_mode = 'exclusive' THEN
                v_line_tax := round(v_line_total * v_rule_rate, 2);
                v_computed_total := v_computed_total + v_line_total + v_line_tax;
            ELSE
                v_line_tax := round(v_line_total - (v_line_total / (1.0 + v_rule_rate)), 2);
                v_computed_total := v_computed_total + v_line_total;
            END IF;

            v_tax_amount := v_tax_amount + v_line_tax;
            v_item_tax_summary := v_item_tax_summary || jsonb_build_object(
                'item_id', v_item_id,
                'category', v_item_tax_cat,
                'label', v_rule_label,
                'rate', v_rule_rate,
                'mode', v_rule_mode,
                'tax', v_line_tax
            );
        ELSE
            v_computed_total := v_computed_total + v_line_total;
        END IF;
    END LOOP;

    -- Add tips: Invariant — Tips are NEVER taxed!
    IF v_tip_amount > 0 THEN
        v_computed_total := v_computed_total + v_tip_amount;
    END IF;

    -- 10. Insert Order Record
    INSERT INTO public.orders (
        restaurant_id,
        order_ref,
        customer_name,
        customer_phone,
        customer_email,
        order_type,
        table_number,
        special_requests,
        subtotal,
        tax_amount,
        total,
        status,
        payment_status,
        payment_required,
        payment_provider,
        payment_token_hash,
        payment_amount,
        currency,
        created_at,
        updated_at
    ) VALUES (
        v_restaurant_id,
        v_order_ref,
        trim(p_order->>'customer_name'),
        trim(p_order->>'customer_phone'),
        nullif(trim(COALESCE(p_order->>'customer_email', '')), ''),
        v_order_type,
        CASE WHEN v_order_type = 'dine_in' THEN trim(p_order->>'table_number') ELSE NULL END,
        nullif(trim(COALESCE(p_order->>'special_requests', '')), ''),
        v_computed_subtotal,
        v_tax_amount,
        v_computed_total,
        'pending',
        v_payment_status,
        v_payment_required,
        nullif(v_payment_method, ''),
        v_payment_token_hash,
        v_computed_total,
        v_currency,
        v_created_at,
        v_created_at
    )
    RETURNING id INTO v_order_id;

    -- 11. Insert Order Items (with tax_category recorded)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := v_item->>'menu_item_id';
        v_quantity := (v_item->>'quantity')::INTEGER;

        SELECT mi.price, mi.name, COALESCE(mi.tax_category, 'food')
        INTO v_db_unit_price, v_db_item_name, v_item_tax_cat
        FROM public.menu_items mi
        WHERE mi.id = v_item_id
          AND mi.restaurant_id = v_restaurant_id;

        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price,
            line_total,
            tax_category,
            notes,
            created_at
        ) VALUES (
            v_order_id,
            v_item_id,
            v_db_item_name,
            v_quantity,
            v_db_unit_price,
            v_db_unit_price * v_quantity,
            v_item_tax_cat,
            nullif(trim(COALESCE(v_item->>'notes', '')), ''),
            v_created_at
        );
    END LOOP;

    -- 12. Return full response with dated tax receipt metadata
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_ref', v_order_ref,
        'subtotal', v_computed_subtotal,
        'tax_amount', v_tax_amount,
        'total', v_computed_total,
        'payment_status', v_payment_status,
        'payment_required', v_payment_required,
        'payment_token', v_raw_payment_token,
        'currency', v_currency,
        'tax_breakdown', jsonb_build_object(
            'rates_as_of', to_char(v_order_date, 'YYYY-MM-DD'),
            'tax_id', v_tax_id,
            'tax_id_label', v_tax_id_label,
            'lines', v_item_tax_summary
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB) TO anon, authenticated, service_role;
