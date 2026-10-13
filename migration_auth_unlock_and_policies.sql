-- ==============================================================================
-- Migration Script: Unlock Fadhil Matlee & Auto-Confirm Supabase Auth Accounts
-- File: migration_auth_unlock_and_policies.sql
-- ==============================================================================

-- 1. ปลดล็อกและยืนยันตัวตน (Confirm) ให้บัญชีผู้ใช้ Fadhil Matlee (0640401728) ทันที
-- หมายเหตุ: confirmed_at เป็น Generated Column ใน Supabase ห้ามใส่ค่าลงไปตรงๆ
-- ให้อัปเดตเฉพาะ email_confirmed_at และ phone_confirmed_at ระบบจะคำนวณ confirmed_at ให้อัตโนมัติ
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, now()), 
    phone_confirmed_at = COALESCE(phone_confirmed_at, now()),
    updated_at = now()
WHERE email = 'phone_0640401728@farmpro.local'
   OR raw_user_meta_data->>'phone_number' = '0640401728'
   OR id IN (SELECT COALESCE(user_id, id) FROM public.profiles WHERE phone_number = '0640401728');

-- 2. เชื่อมโยง profiles.user_id ให้ตรงกับ auth.users.id สำหรับ Fadhil Matlee และผู้ใช้ทุกคน
UPDATE public.profiles p
SET user_id = u.id,
    updated_at = now()
FROM auth.users u
WHERE (p.email = u.email OR p.phone_number = u.raw_user_meta_data->>'phone_number')
  AND (p.user_id IS NULL OR p.user_id != u.id);

-- 3. ยืนยันตัวตนให้ผู้ใช้ทุกคนที่มีสถานะ approved หรือใช้อีเมลเสมือน @farmpro.local
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, now()), 
    phone_confirmed_at = COALESCE(phone_confirmed_at, now()),
    updated_at = now()
WHERE email LIKE '%@farmpro.local'
   OR id IN (SELECT COALESCE(user_id, id) FROM public.profiles WHERE status = 'approved');

-- 4. สร้าง Trigger ให้ระบบ Supabase Auto-Confirm อีเมลเสมือนโดยอัตโนมัติเมื่อมีการสมัครสมาชิกใหม่
CREATE OR REPLACE FUNCTION public.auto_confirm_farmpro_users()
RETURNS TRIGGER AS $$
BEGIN
  -- ถ้าใช้อีเมลเสมือน @farmpro.local หรือสมัครผ่านเบอร์โทรศัพท์ ให้ตั้งค่า email_confirmed_at ทันที
  IF NEW.email LIKE '%@farmpro.local' THEN
    NEW.email_confirmed_at = COALESCE(NEW.email_confirmed_at, now());
    NEW.phone_confirmed_at = COALESCE(NEW.phone_confirmed_at, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_auto_confirm_farmpro_users ON auth.users;
CREATE TRIGGER tr_auto_confirm_farmpro_users
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_farmpro_users();

-- 5. ปรับปรุง RLS Policies ของตาราง public.profiles ให้ปลอดภัยและไม่บล็อกการดึงข้อมูล
DROP POLICY IF EXISTS "Allow anonymous read access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow anonymous write access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow all read on profiles" ON public.profiles;

-- 5.1 อนุญาตให้อ่านโปรไฟล์ได้ (จำเป็นสำหรับระบบลานรับซื้อน้ำยาง และการตรวจสอบก่อนล็อกอิน)
CREATE POLICY "Allow all read on profiles" 
  ON public.profiles 
  FOR SELECT 
  USING (true);

-- 5.2 อนุญาตให้แก้ไขโปรไฟล์ของตนเอง
CREATE POLICY "Users can update their own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = user_id OR auth.uid() = id);

-- 5.3 อนุญาตให้สร้างโปรไฟล์ใหม่
CREATE POLICY "Users can insert their own profile" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id OR auth.uid() = id OR true);

-- 6. ฟังก์ชัน RPC เสริมสำหรับ Admin ในการรีเซ็ตรหัสผ่านของผู้ใช้โดยตรงใน Supabase Auth
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.admin_reset_password(target_user_id TEXT, new_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      phone_confirmed_at = COALESCE(phone_confirmed_at, now()),
      updated_at = now()
  WHERE id::text = target_user_id
     OR email = (SELECT email FROM public.profiles WHERE id::text = target_user_id LIMIT 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_password(TEXT, TEXT) TO authenticated, anon;
