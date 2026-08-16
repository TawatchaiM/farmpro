-- Migration Script for Rubber Plots Ecosystem

-- 1. Create rubber_plots table
CREATE TABLE IF NOT EXISTS public.rubber_plots (
    plot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plot_name TEXT NOT NULL,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    owner_phone TEXT, -- optional fallback if owner is not in system
    tapper_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    tapper_phone TEXT, -- optional fallback if tapper is not in system
    default_share_ratio NUMERIC NOT NULL DEFAULT 50.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create plot_expenses table for tracking shared expenses
CREATE TABLE IF NOT EXISTS public.plot_expenses (
    expense_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plot_id UUID REFERENCES public.rubber_plots(plot_id) ON DELETE CASCADE NOT NULL,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    expense_date DATE NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Alter rubber_transactions to link to plots and tappers
ALTER TABLE public.rubber_transactions 
ADD COLUMN IF NOT EXISTS plot_id UUID REFERENCES public.rubber_plots(plot_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tapper_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Enable RLS for new tables
ALTER TABLE public.rubber_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plot_expenses ENABLE ROW LEVEL SECURITY;

-- Add basic RLS policies for rubber_plots
CREATE POLICY "Enable read access for all users" ON public.rubber_plots FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.rubber_plots FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Enable update for owner" ON public.rubber_plots FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Enable delete for owner" ON public.rubber_plots FOR DELETE USING (auth.uid() = owner_id);

-- Add basic RLS policies for plot_expenses
CREATE POLICY "Enable read for related plot users" ON public.plot_expenses 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.rubber_plots rp 
        WHERE rp.plot_id = plot_expenses.plot_id 
        AND (rp.owner_id = auth.uid() OR rp.tapper_id = auth.uid())
    )
);
CREATE POLICY "Enable insert for related plot users" ON public.plot_expenses 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.rubber_plots rp 
        WHERE rp.plot_id = plot_expenses.plot_id 
        AND (rp.owner_id = auth.uid() OR rp.tapper_id = auth.uid())
    )
);
CREATE POLICY "Enable update for recorder" ON public.plot_expenses FOR UPDATE USING (auth.uid() = recorded_by);
CREATE POLICY "Enable delete for recorder" ON public.plot_expenses FOR DELETE USING (auth.uid() = recorded_by);

-- Create a view to migrate data from user_farms to rubber_plots if user_farms exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_farms') THEN
        INSERT INTO public.rubber_plots (plot_id, plot_name, owner_id, default_share_ratio, created_at)
        SELECT id, farm_name, user_id, owner_share_percent, created_at
        FROM public.user_farms
        ON CONFLICT (plot_id) DO NOTHING;
    END IF;
END $$;
