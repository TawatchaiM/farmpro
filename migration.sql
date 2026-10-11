-- ==============================================================================
-- Migration Script for Rubber Plots & Expenses Ecosystem
-- Safe and idempotent (can be executed multiple times without errors)
-- ==============================================================================

-- 1. Create rubber_plots table
CREATE TABLE IF NOT EXISTS public.rubber_plots (
    plot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plot_name TEXT NOT NULL,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    owner_phone TEXT,
    tapper_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    tapper_phone TEXT,
    default_share_ratio NUMERIC NOT NULL DEFAULT 50.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- If columns are missing in an existing rubber_plots table, add them safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rubber_plots' AND column_name = 'owner_phone') THEN
        ALTER TABLE public.rubber_plots ADD COLUMN owner_phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rubber_plots' AND column_name = 'tapper_phone') THEN
        ALTER TABLE public.rubber_plots ADD COLUMN tapper_phone TEXT;
    END IF;
END $$;

-- 2. Create plot_expenses table for tracking shared expenses
CREATE TABLE IF NOT EXISTS public.plot_expenses (
    expense_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plot_id UUID REFERENCES public.rubber_plots(plot_id) ON DELETE CASCADE NOT NULL,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Alter rubber_transactions to link to plots and tappers
ALTER TABLE public.rubber_transactions 
ADD COLUMN IF NOT EXISTS plot_id UUID REFERENCES public.rubber_plots(plot_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tapper_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.rubber_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plot_expenses ENABLE ROW LEVEL SECURITY;

-- 4b. Grant table-level permissions to anon and authenticated roles
-- (Required: RLS alone does not grant INSERT/UPDATE/DELETE access to anon key)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rubber_plots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rubber_plots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plot_expenses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plot_expenses TO authenticated;


-- 5. Policies for rubber_plots
DROP POLICY IF EXISTS "Enable read access for all users" ON public.rubber_plots;
CREATE POLICY "Enable read access for all users" ON public.rubber_plots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.rubber_plots;
CREATE POLICY "Enable insert for authenticated users" ON public.rubber_plots FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for users" ON public.rubber_plots;
CREATE POLICY "Enable update for users" ON public.rubber_plots FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete for users" ON public.rubber_plots;
CREATE POLICY "Enable delete for users" ON public.rubber_plots FOR DELETE USING (true);

-- 6. Policies for plot_expenses
DROP POLICY IF EXISTS "Enable read for related plot users" ON public.plot_expenses;
CREATE POLICY "Enable read for related plot users" ON public.plot_expenses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for plot expenses" ON public.plot_expenses;
CREATE POLICY "Enable insert for plot expenses" ON public.plot_expenses FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for recorder" ON public.plot_expenses;
CREATE POLICY "Enable update for recorder" ON public.plot_expenses FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete for recorder" ON public.plot_expenses;
CREATE POLICY "Enable delete for recorder" ON public.plot_expenses FOR DELETE USING (true);

-- 7. Migrate existing data from user_farms to rubber_plots safely (handles type casting)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_farms') THEN
        INSERT INTO public.rubber_plots (plot_id, plot_name, owner_id, default_share_ratio, created_at)
        SELECT 
            CASE 
                WHEN id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::uuid 
                ELSE gen_random_uuid() 
            END,
            COALESCE(farm_name, 'แปลงสวนเดิม'),
            CASE 
                WHEN user_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN user_id::uuid 
                ELSE NULL 
            END,
            COALESCE(owner_share_percent::numeric, 50.00),
            COALESCE(created_at, NOW())
        FROM public.user_farms
        ON CONFLICT (plot_id) DO NOTHING;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Migration of user_farms data skipped or partially applied: %', SQLERRM;
END $$;

-- 8. Add PDPA & Marketing Consent columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pdpa_accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pdpa_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT false;

-- ==============================================================================
-- 9. Rubber Sales & Shop Expenses (Buyer P&L Realtime Ecosystem)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.rubber_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    factory_name TEXT NOT NULL,
    net_weight NUMERIC(10, 2) NOT NULL,
    drc_percent NUMERIC(5, 2) NOT NULL,
    price_per_kg NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    sale_date TIMESTAMPTZ DEFAULT now(),
    receipt_url TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rubber_sales_shop_date ON public.rubber_sales(shop_id, sale_date DESC);

CREATE TABLE IF NOT EXISTS public.shop_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    expense_date TIMESTAMPTZ DEFAULT now(),
    note TEXT,
    receipt_url TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_expenses_shop_date ON public.shop_expenses(shop_id, expense_date DESC);

ALTER TABLE public.rubber_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_expenses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rubber_sales TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_expenses TO anon, authenticated;

DROP POLICY IF EXISTS "Allow read access on rubber_sales" ON public.rubber_sales;
CREATE POLICY "Allow read access on rubber_sales" ON public.rubber_sales FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert on rubber_sales" ON public.rubber_sales;
CREATE POLICY "Allow insert on rubber_sales" ON public.rubber_sales FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update on rubber_sales" ON public.rubber_sales;
CREATE POLICY "Allow update on rubber_sales" ON public.rubber_sales FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete on rubber_sales" ON public.rubber_sales;
CREATE POLICY "Allow delete on rubber_sales" ON public.rubber_sales FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow read access on shop_expenses" ON public.shop_expenses;
CREATE POLICY "Allow read access on shop_expenses" ON public.shop_expenses FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert on shop_expenses" ON public.shop_expenses;
CREATE POLICY "Allow insert on shop_expenses" ON public.shop_expenses FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update on shop_expenses" ON public.shop_expenses;
CREATE POLICY "Allow update on shop_expenses" ON public.shop_expenses FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete on shop_expenses" ON public.shop_expenses;
CREATE POLICY "Allow delete on shop_expenses" ON public.shop_expenses FOR DELETE USING (true);

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.rubber_sales;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_expenses;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN OTHERS THEN NULL;
    END;
END $$;

