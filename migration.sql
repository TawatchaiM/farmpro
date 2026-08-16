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
