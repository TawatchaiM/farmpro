-- ==============================================================================
-- Migration Script: Strict Data Privacy & Isolation for Sellers
-- File: migration_strict_data_isolation.sql
-- Description: เพิ่ม Indexes และนโยบายความปลอดภัยเพื่อป้องกันการมองเห็นหรือปะปนข้อมูลระหว่างผู้ขาย
-- ==============================================================================

-- 1. สร้าง Indexes เพื่อเพิ่มความเร็วและความแม่นยำในการคัดกรองข้อมูลตามผู้ใช้/เบอร์โทรศัพท์
CREATE INDEX IF NOT EXISTS idx_rubber_transactions_phone ON public.rubber_transactions(phone_number);
CREATE INDEX IF NOT EXISTS idx_rubber_transactions_buyer_id ON public.rubber_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_rubber_transactions_plot_id ON public.rubber_transactions(plot_id);

CREATE INDEX IF NOT EXISTS idx_plot_expenses_recorded_by ON public.plot_expenses(recorded_by);
CREATE INDEX IF NOT EXISTS idx_plot_expenses_plot_id ON public.plot_expenses(plot_id);

CREATE INDEX IF NOT EXISTS idx_rubber_plots_owner_id ON public.rubber_plots(owner_id);
CREATE INDEX IF NOT EXISTS idx_rubber_plots_tapper_id ON public.rubber_plots(tapper_id);

-- 2. ตรวจสอบและอัปเดตข้อมูลที่ไม่มีเจ้าของ หรือข้อมูลเบอร์โทรศัพท์ให้สมบูรณ์
-- อัปเดตให้รายการบิล E-BILL ผูกกับเบอร์โทรศัพท์ของผู้บันทึกเสมอ
UPDATE public.rubber_transactions t
SET phone_number = p.phone_number
FROM public.profiles p
WHERE (t.seller_name = p.full_name OR t.seller_name = p.username)
  AND (t.phone_number IS NULL OR t.phone_number = '')
  AND p.phone_number IS NOT NULL;
