-- ==============================================================================
-- Migration: Buyer Rubber Sales, Shop Expenses & Realtime P&L Ecosystem
-- Safe and idempotent (can be executed multiple times without errors)
-- ==============================================================================

-- 1. Create rubber_sales Table (บันทึกการส่งขายโรงงาน)
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

-- Index for fast queries by shop and date
CREATE INDEX IF NOT EXISTS idx_rubber_sales_shop_date ON public.rubber_sales(shop_id, sale_date DESC);

-- 2. Create shop_expenses Table (บันทึกค่าใช้จ่ายประจำลานรับซื้อ)
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

-- Index for fast queries by shop and date
CREATE INDEX IF NOT EXISTS idx_shop_expenses_shop_date ON public.shop_expenses(shop_id, expense_date DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.rubber_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_expenses ENABLE ROW LEVEL SECURITY;

-- 4. Grant table-level permissions to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rubber_sales TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_expenses TO anon, authenticated;

-- 5. Policies for rubber_sales
DROP POLICY IF EXISTS "Allow read access on rubber_sales" ON public.rubber_sales;
CREATE POLICY "Allow read access on rubber_sales" ON public.rubber_sales FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert on rubber_sales" ON public.rubber_sales;
CREATE POLICY "Allow insert on rubber_sales" ON public.rubber_sales FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update on rubber_sales" ON public.rubber_sales;
CREATE POLICY "Allow update on rubber_sales" ON public.rubber_sales FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete on rubber_sales" ON public.rubber_sales;
CREATE POLICY "Allow delete on rubber_sales" ON public.rubber_sales FOR DELETE USING (true);

-- 6. Policies for shop_expenses
DROP POLICY IF EXISTS "Allow read access on shop_expenses" ON public.shop_expenses;
CREATE POLICY "Allow read access on shop_expenses" ON public.shop_expenses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert on shop_expenses" ON public.shop_expenses;
CREATE POLICY "Allow insert on shop_expenses" ON public.shop_expenses FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update on shop_expenses" ON public.shop_expenses;
CREATE POLICY "Allow update on shop_expenses" ON public.shop_expenses FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete on shop_expenses" ON public.shop_expenses;
CREATE POLICY "Allow delete on shop_expenses" ON public.shop_expenses FOR DELETE USING (true);

-- 7. Add tables to Supabase Realtime Publication safely
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.rubber_sales;
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'rubber_sales already in supabase_realtime publication';
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not add rubber_sales to publication: %', SQLERRM;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_expenses;
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'shop_expenses already in supabase_realtime publication';
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not add shop_expenses to publication: %', SQLERRM;
    END;
END $$;
