-- ==============================================================================
-- Migration Script: FarmPro Subscription Tiers, Data Quotas & Retention Policy
-- ==============================================================================

-- 1. Add subscription and data retention columns to profiles table safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_tier') THEN
        ALTER TABLE public.profiles ADD COLUMN subscription_tier VARCHAR(50) DEFAULT 'free';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'plan_type') THEN
        ALTER TABLE public.profiles ADD COLUMN plan_type VARCHAR(50) DEFAULT 'free';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'storage_limit_mb') THEN
        ALTER TABLE public.profiles ADD COLUMN storage_limit_mb INTEGER DEFAULT 200;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'bill_quota_monthly') THEN
        ALTER TABLE public.profiles ADD COLUMN bill_quota_monthly INTEGER DEFAULT 150;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'billing_cycle') THEN
        ALTER TABLE public.profiles ADD COLUMN billing_cycle VARCHAR(20) DEFAULT 'monthly';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_expiry_date') THEN
        ALTER TABLE public.profiles ADD COLUMN subscription_expiry_date TIMESTAMPTZ;
    END IF;
END $$;

COMMENT ON COLUMN public.profiles.subscription_tier IS 'Subscription tier: free, standard, or pro';
COMMENT ON COLUMN public.profiles.plan_type IS 'Plan identifier: seller_free, seller_pro, buyer_free, buyer_standard, buyer_pro';
COMMENT ON COLUMN public.profiles.storage_limit_mb IS 'Storage quota for slip attachments and images in MB';
COMMENT ON COLUMN public.profiles.bill_quota_monthly IS 'Monthly bill creation limit for buyers (150 for free, 999999 for standard/pro)';
COMMENT ON COLUMN public.profiles.billing_cycle IS 'Billing cycle: monthly or yearly';
COMMENT ON COLUMN public.profiles.subscription_expiry_date IS 'Expiration timestamp for current subscription cycle';
