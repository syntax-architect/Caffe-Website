-- ==============================================================================
-- Migration: 007_internationalization.sql
-- Description: Restaurant Localization, Multi-Country Settings, and Order Currency Safety
-- ==============================================================================

-- 1. EXTEND RESTAURANT SETTINGS TABLE WITH LOCALIZATION FIELDS
ALTER TABLE public.restaurant_settings
    ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'IN',
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS currency_symbol TEXT NOT NULL DEFAULT '₹',
    ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en-IN',
    ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    ADD COLUMN IF NOT EXISTS phone_country_code TEXT NOT NULL DEFAULT '+91',
    ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS tax_mode TEXT NOT NULL DEFAULT 'inclusive',
    ADD COLUMN IF NOT EXISTS tax_label TEXT NOT NULL DEFAULT 'GST',
    ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.0500,
    ADD COLUMN IF NOT EXISTS dietary_system TEXT NOT NULL DEFAULT 'india',
    ADD COLUMN IF NOT EXISTS primary_contact_method TEXT NOT NULL DEFAULT 'whatsapp',
    ADD COLUMN IF NOT EXISTS email TEXT NULL DEFAULT 'contact@thecafe.com',
    ADD COLUMN IF NOT EXISTS city TEXT NULL DEFAULT 'Barrackpore',
    ADD COLUMN IF NOT EXISTS state_region TEXT NULL DEFAULT 'West Bengal',
    ADD COLUMN IF NOT EXISTS postal_code TEXT NULL DEFAULT '700120';

-- 2. HISTORICAL ORDER CURRENCY SAFETY
-- Add currency column to orders so past orders permanently remember their currency
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';

-- Index for currency queries if filtered
CREATE INDEX IF NOT EXISTS idx_orders_currency ON public.orders(currency);
