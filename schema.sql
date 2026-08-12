-- ====================================================================
-- Database Schema for FarmPro Rubber Station Operational Workflow
-- ====================================================================
-- Copy and paste this SQL script into your Supabase SQL Editor to set up the tables.

-- 1. Create daily_settings Table
CREATE TABLE IF NOT EXISTS daily_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE DEFAULT CURRENT_DATE,
  base_price NUMERIC(10, 2) NOT NULL,
  formula_type VARCHAR(50) DEFAULT 'standard', -- 'standard' (DRC% = (dry_g / wet_g) * 100)
  wet_sample_weight_g NUMERIC(10, 2) DEFAULT 50.00,
  pricing_mode VARCHAR(50) DEFAULT 'tiered',
  price_tiers JSONB,
  override_reason TEXT,
  override_by_name VARCHAR(255),
  price_source VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create rubber_transactions Table
CREATE TABLE IF NOT EXISTS rubber_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_number VARCHAR(20) NOT NULL,
  seller_name VARCHAR(255) NOT NULL,
  buyer_name VARCHAR(255),
  phone_number VARCHAR(20),
  date DATE DEFAULT CURRENT_DATE,
  raw_weight_kg NUMERIC(10, 2) NOT NULL,
  wet_weight_sample_g NUMERIC(10, 2) DEFAULT 50.00,
  dry_weight_sample_g NUMERIC(10, 2),
  drc_percentage NUMERIC(5, 2),
  dry_weight_kg NUMERIC(10, 2),
  price_per_kg NUMERIC(10, 2),
  total_amount NUMERIC(10, 2),
  owner_share_percentage NUMERIC(5, 2) DEFAULT 50.00,
  owner_share_amount NUMERIC(10, 2),
  tapper_share_amount NUMERIC(10, 2),
  status VARCHAR(50) DEFAULT 'waiting_drc', -- 'waiting_drc', 'ready_to_pay', 'paid'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id), -- Bind to Supabase Auth User ID
  username VARCHAR(100),
  email VARCHAR(255),
  role VARCHAR(50) NOT NULL, -- 'buyer', 'seller', 'vendor'
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  subdistrict VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  province VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  latitude NUMERIC(10, 6),
  longitude NUMERIC(10, 6),
  google_maps_url TEXT,
  
  -- Store Details (Buyer/Vendor Only)
  store_name VARCHAR(255),
  vendor_category VARCHAR(100), -- 'equipment', 'fertilizer', 'services', 'other'
  vendor_description TEXT,
  business_hours VARCHAR(100),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE daily_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubber_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. Create Policies (Simple access for demo/station client - please restrict for production)
CREATE POLICY "Allow anonymous read access on daily_settings" 
  ON daily_settings FOR SELECT USING (true);

CREATE POLICY "Allow anonymous write access on daily_settings" 
  ON daily_settings FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous read access on rubber_transactions" 
  ON rubber_transactions FOR SELECT USING (true);

CREATE POLICY "Allow anonymous write access on rubber_transactions" 
  ON rubber_transactions FOR ALL USING (true) WITH CHECK (true);

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow anonymous read access on profiles" ON profiles;
DROP POLICY IF EXISTS "Allow anonymous write access on profiles" ON profiles;

-- Drop Existing Policies (ถ้ามี เพื่อป้องกัน Policy ซ้ำซ้อน):
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- 5. Create Policies for profiles
-- อนุญาตให้ User ดึงข้อมูลเฉพาะโปรไฟล์ของตัวเอง
CREATE POLICY "Users can view their own profile" 
  ON profiles 
  FOR SELECT 
  USING (auth.uid() = user_id); -- Use user_id which references auth.users(id)

-- อนุญาตให้ User แก้ไขได้เฉพาะโปรไฟล์ของตัวเองเท่านั้น
CREATE POLICY "Users can update their own profile" 
  ON profiles 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- อนุญาตให้ User สร้างโปรไฟล์ของตัวเองได้
CREATE POLICY "Users can insert their own profile" 
  ON profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 6. Create user_farms Table
-- NOTE: user_id is TEXT (not UUID FK) to support both Supabase Auth UUIDs
-- and local/offline mock UUIDs without FK constraint failures.
-- Run this block fresh: DROP IF EXISTS first, then CREATE.
DROP TABLE IF EXISTS user_farms;

CREATE TABLE user_farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  farm_name VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  owner_share_percent INTEGER DEFAULT 50,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_farms ENABLE ROW LEVEL SECURITY;

-- Drop Existing Policies
DROP POLICY IF EXISTS "Users can view their own farms" ON user_farms;
DROP POLICY IF EXISTS "Users can insert their own farms" ON user_farms;
DROP POLICY IF EXISTS "Users can update their own farms" ON user_farms;
DROP POLICY IF EXISTS "Users can delete their own farms" ON user_farms;
DROP POLICY IF EXISTS "Allow all on user_farms" ON user_farms;

-- Open RLS policy: Row-level security is enforced by application logic
-- using user_id filter, not by Supabase session (supports anon key + phone auth)
CREATE POLICY "Allow all on user_farms"
  ON user_farms FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant table-level privileges to anon and authenticated roles
-- (Required when table is created via raw SQL, not Supabase dashboard)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_farms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_farms TO authenticated;
