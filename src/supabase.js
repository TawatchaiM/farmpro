import { createClient } from '@supabase/supabase-js';

// Retrieve environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are valid/provided
export const isMock = !supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('YOUR_SUPABASE_URL') || supabaseUrl.includes('<your-project-id>');

if (isMock) {
  console.warn('⚠️ FarmPro: Supabase environment variables are missing or default. Running in fully functional Mock mode using LocalStorage.');
}

// Create real Supabase client if available
let supabaseClient = null;
if (!isMock) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('Failed to initialize Supabase client (Invalid URL?):', err);
  }
}
export const supabase = supabaseClient;

// Safe LocalStorage JSON parser to prevent crashes
const safeJsonParse = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    return JSON.parse(value);
  } catch (err) {
    console.error(`Error parsing localStorage key "${key}":`, err);
    return fallback;
  }
};

// Security Rule Helper: Sanitize Profile before saving to LocalStorage (NO plain text passwords or secrets)
export const sanitizeProfile = (profile) => {
  if (!profile) return null;
  const { password, confirmPassword, secret, password_hash, ...safeProfile } = profile;
  return {
    ...safeProfile,
    id: safeProfile.id || safeProfile.user_id,
    user_id: safeProfile.user_id || safeProfile.id,
    full_name: safeProfile.full_name || safeProfile.display_name || safeProfile.username || 'ผู้ใช้งาน',
    display_name: safeProfile.display_name || safeProfile.full_name || safeProfile.username || 'ผู้ใช้งาน',
    phone_number: safeProfile.phone_number || '',
    email: safeProfile.email || '',
    role: safeProfile.role || 'buyer',
    store_name: safeProfile.store_name || null,
    business_hours: safeProfile.business_hours || null,
    rubber_types: safeProfile.rubber_types || null,
    province: safeProfile.province || null,
    district: safeProfile.district || null,
    subdistrict: safeProfile.subdistrict || null,
    status: safeProfile.status || 'approved',
    plan_id: safeProfile.plan_id || 'free',
    updated_at: safeProfile.updated_at || new Date().toISOString()
  };
};

// Security Rule Helper: Sanitize Session before saving to LocalStorage
export const sanitizeSession = (session) => {
  if (!session) return null;
  const safeSession = { ...session };
  if (safeSession.user) {
    const { password, confirmPassword, secret, password_hash, ...safeUser } = safeSession.user;
    safeSession.user = safeUser;
  }
  return safeSession;
};

// Non-reversible hash for local mock account validation to avoid plain text passwords in localStorage
const hashPassword = (str) => {
  if (!str) return '';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36);
};

// Safe UUID generator supporting non-secure contexts and older browsers
const uuidv4 = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Helper to simulate network latency for Mock mode
const delay = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms));

// Security Rule Helper: Sanitize Transaction to strictly match Supabase schema
const sanitizeTransaction = (tx) => {
  if (!tx) return null;
  const allowedKeys = [
    'id', 'queue_number', 'seller_name', 'buyer_name', 'phone_number', 
    'date', 'raw_weight_kg', 'wet_weight_sample_g', 'dry_weight_sample_g', 
    'drc_percentage', 'dry_weight_kg', 'price_per_kg', 'total_amount', 
    'owner_share_percentage', 'owner_share_amount', 'tapper_share_amount', 
    'status', 'created_at'
  ];
  const safeTx = {};
  for (const key of allowedKeys) {
    if (tx[key] !== undefined) {
      safeTx[key] = tx[key];
    }
  }
  return safeTx;
};

// Helper for generating next queue number (e.g. Q001, Q002) for a given date
const generateQueueNumber = (txs, dateStr) => {
  const dailyTxs = txs.filter(t => t.date === dateStr);
  const nextNum = dailyTxs.length + 1;
  return `Q${String(nextNum).padStart(3, '0')}`;
};


// Helper to get correct mock profile key based on role
export const getMockProfileKey = () => {
  const role = localStorage.getItem('farmpro_current_role') || 'BUYER';
  return role === 'SELLER' ? 'farmpro_mock_seller' : 'farmpro_mock_buyer';
};

const seedMockData = () => {
  // Clear old cache keys to prevent data contamination
  localStorage.removeItem('farmpro_user_profile');
  localStorage.removeItem('farmpro_mock_buyer');
    localStorage.removeItem('farmpro_mock_seller');
    localStorage.removeItem('farmpro_current_role');
  
  // Seed Mock Profiles for separate roles
  if (!localStorage.getItem('farmpro_mock_buyer')) {
    localStorage.setItem('farmpro_mock_buyer', JSON.stringify({
      id: 'mock-buyer-id',
      user_id: 'mock-buyer-id',
      full_name: 'สมหวัง รับซื้อยาง',
      phone_number: '0811111111',
      role: 'buyer',
      store_name: 'ร้านสมหวังการยาง'
    }));
  }
  if (!localStorage.getItem('farmpro_mock_seller')) {
    localStorage.setItem('farmpro_mock_seller', JSON.stringify({
      id: 'mock-seller-id',
      user_id: 'mock-seller-id',
      full_name: 'สมใจ ชาวสวน',
      phone_number: '0822222222',
      role: 'seller'
    }));
  }

  const settingsKey = 'farmpro_daily_settings';
  const txsKey = 'farmpro_transactions';
  const seedVersionKey = 'farmpro_seed_version_v3';
  
  // Force re-seed for version v3 to load the exact 22 rows from the spreadsheet
  if (localStorage.getItem(seedVersionKey) !== 'v3') {
    localStorage.removeItem(settingsKey);
    localStorage.removeItem(txsKey);
    localStorage.setItem(seedVersionKey, 'v3');
  }
  
  const existingSettings = safeJsonParse(settingsKey, []);
  if (existingSettings.length === 0) {
    const defaultSettings = [
      { id: 'f01d3020-4c6c-43d9-a00e-5832e99b8c83', date: new Date().toISOString().split('T')[0], base_price: 78.5, formula_type: 'standard', wet_sample_weight_g: 50.00 },
      { id: 'fb703d74-0f4d-4e9c-94b4-7e160f5ba53e', date: '2026-07-08', base_price: 73.0, formula_type: 'standard', wet_sample_weight_g: 50.00 },
      { id: '9ca65bbd-cf94-4a95-ac87-8c3de7209006', date: '2026-07-07', base_price: 72.0, formula_type: 'standard', wet_sample_weight_g: 50.00 }
    ];
    localStorage.setItem(settingsKey, JSON.stringify(defaultSettings));
  }
  
  const existingTxs = safeJsonParse(txsKey, []);
  if (existingTxs.length === 0) {
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultTxs = [
      // --- Active Test Transactions (For Clerk & DRC Room testing on current date) ---
      {
        id: '343c6929-24c3-43c4-8709-a83974bcbe66',
        queue_number: 'Q001',
        seller_name: 'สมชาย รักสวน',
        buyer_name: 'ร้านเจ๊น้อย รับซื้อยาง',
        date: todayStr,
        raw_weight_kg: 250.00,
        wet_weight_sample_g: 50.00,
        dry_weight_sample_g: 17.50,
        drc_percentage: 35.00,
        dry_weight_kg: 87.50,
        price_per_kg: 78.50,
        total_amount: 6868.75,
        owner_share_percentage: 55.00,
        owner_share_amount: 3777.81,
        tapper_share_amount: 3090.94,
        status: 'ready_to_pay',
        created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
      },
      {
        id: 'af39386c-3cd5-403a-a8b5-507d2154e06f',
        queue_number: 'Q002',
        seller_name: 'ประเสริฐ พารา',
        buyer_name: 'ร้านเจ๊น้อย รับซื้อยาง',
        date: todayStr,
        raw_weight_kg: 85.00,
        wet_weight_sample_g: 50.00,
        status: 'waiting_drc',
        price_per_kg: 78.50,
        owner_share_percentage: 50.00,
        created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      },

      // --- Exact 22 Transactions from Spreadsheet ---
      {
        id: '8d4e5845-3299-4a2f-b471-078b88ee589c',
        queue_number: 'Q022',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-07-08',
        raw_weight_kg: 85.4,
        wet_weight_sample_g: 50.0,
        drc_percentage: 32.0,
        dry_weight_kg: 27.33,
        price_per_kg: 73.0,
        total_amount: 1994.94,
        owner_share_percentage: 55.0,
        owner_share_amount: 1097.22,
        tapper_share_amount: 897.72,
        status: 'paid',
        created_at: '2026-07-08T10:00:22.000Z'
      },
      {
        id: 'f25b4be1-9193-4fb0-8adf-27efab2b1671',
        queue_number: 'Q021',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-07-07',
        raw_weight_kg: 89.0,
        wet_weight_sample_g: 50.0,
        drc_percentage: 32.0,
        dry_weight_kg: 28.4,
        price_per_kg: 72.0,
        total_amount: 2044.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 1124.0,
        tapper_share_amount: 920.0,
        status: 'paid',
        created_at: '2026-07-07T10:00:21.000Z'
      },
      {
        id: '6969fe34-e686-465f-9bd2-d4614d75232a',
        queue_number: 'Q020',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-07-05',
        raw_weight_kg: 74.0,
        wet_weight_sample_g: 50.0,
        drc_percentage: 31.0,
        dry_weight_kg: 22.9,
        price_per_kg: 75.0,
        total_amount: 1717.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 944.0,
        tapper_share_amount: 773.0,
        status: 'paid',
        created_at: '2026-07-05T10:00:20.000Z'
      },
      {
        id: '48b0c4cc-7311-4cb9-af3d-09f834f685c1',
        queue_number: 'Q019',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-07-04',
        raw_weight_kg: 61.2,
        wet_weight_sample_g: 50.0,
        drc_percentage: 33.0,
        dry_weight_kg: 20.1,
        price_per_kg: 72.0,
        total_amount: 1447.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 755.0,
        tapper_share_amount: 692.0,
        status: 'paid',
        created_at: '2026-07-04T10:00:19.000Z'
      },
      {
        id: '7dba40ef-1447-46a1-8275-9e5c8b22fa8e',
        queue_number: 'Q018',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-07-03',
        raw_weight_kg: 86.0,
        wet_weight_sample_g: 50.0,
        drc_percentage: 32.0,
        dry_weight_kg: 27.5,
        price_per_kg: 70.0,
        total_amount: 1925.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 1058.0,
        tapper_share_amount: 867.0,
        status: 'paid',
        created_at: '2026-07-03T10:00:18.000Z'
      },
      {
        id: 'a0856462-0f1c-4feb-8458-3e56dd5fab55',
        queue_number: 'Q017',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-07-01',
        raw_weight_kg: 86.8,
        wet_weight_sample_g: 50.0,
        drc_percentage: 31.0,
        dry_weight_kg: 26.9,
        price_per_kg: 77.0,
        total_amount: 2071.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 1139.0,
        tapper_share_amount: 932.0,
        status: 'paid',
        created_at: '2026-07-01T10:00:17.000Z'
      },
      {
        id: '7ba12ce5-b77a-4bec-841a-a36bdc2ae320',
        queue_number: 'Q016',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-06-30',
        raw_weight_kg: 53.4,
        wet_weight_sample_g: 50.0,
        drc_percentage: 34.0,
        dry_weight_kg: 18.1,
        price_per_kg: 70.0,
        total_amount: 1267.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 696.0,
        tapper_share_amount: 571.0,
        status: 'paid',
        created_at: '2026-06-30T10:00:16.000Z'
      },
      {
        id: 'f9894f88-e8d4-4cb6-913b-831db0c4ef41',
        queue_number: 'Q015',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-06-28',
        raw_weight_kg: 76.6,
        wet_weight_sample_g: 50.0,
        drc_percentage: 34.0,
        dry_weight_kg: 26.0,
        price_per_kg: 69.0,
        total_amount: 1794.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 986.0,
        tapper_share_amount: 808.0,
        status: 'paid',
        created_at: '2026-06-28T10:00:15.000Z'
      },
      {
        id: '01d236f7-ec9a-44b0-91d1-e6be1625e3ef',
        queue_number: 'Q014',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-06-24',
        raw_weight_kg: 65.2,
        wet_weight_sample_g: 50.0,
        drc_percentage: 37.0,
        dry_weight_kg: 24.1,
        price_per_kg: 78.0,
        total_amount: 1879.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 1033.0,
        tapper_share_amount: 846.0,
        status: 'paid',
        created_at: '2026-06-24T10:00:14.000Z'
      },
      {
        id: '55c4c87d-0422-4288-aa6d-da601cd6e947',
        queue_number: 'Q013',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-06-22',
        raw_weight_kg: 49.4,
        wet_weight_sample_g: 50.0,
        drc_percentage: 38.0,
        dry_weight_kg: 18.7,
        price_per_kg: 81.0,
        total_amount: 1514.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 832.0,
        tapper_share_amount: 682.0,
        status: 'paid',
        created_at: '2026-06-22T10:00:13.000Z'
      },
      {
        id: 'f5e6cde1-dc6e-4274-a189-da8c8229c621',
        queue_number: 'Q012',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-06-27',
        raw_weight_kg: 55.8,
        wet_weight_sample_g: 50.0,
        drc_percentage: 37.0,
        dry_weight_kg: 20.6,
        price_per_kg: 70.0,
        total_amount: 1442.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 793.0,
        tapper_share_amount: 649.0,
        status: 'paid',
        created_at: '2026-06-27T10:00:12.000Z'
      },
      {
        id: '6ad74319-1f94-4c84-8b75-f337e42b0dbc',
        queue_number: 'Q011',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-06-26',
        raw_weight_kg: 68.6,
        wet_weight_sample_g: 50.0,
        drc_percentage: 36.0,
        dry_weight_kg: 24.6,
        price_per_kg: 70.0,
        total_amount: 1722.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 947.0,
        tapper_share_amount: 775.0,
        status: 'paid',
        created_at: '2026-06-26T10:00:11.000Z'
      },
      {
        id: '7cdcbecf-c5e2-427e-bcab-ecf0e9565955',
        queue_number: 'Q010',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-06-21',
        raw_weight_kg: 55.4,
        wet_weight_sample_g: 50.0,
        drc_percentage: 38.5,
        dry_weight_kg: 21.3,
        price_per_kg: 81.0,
        total_amount: 1725.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 948.0,
        tapper_share_amount: 777.0,
        status: 'paid',
        created_at: '2026-06-21T10:00:10.000Z'
      },
      {
        id: '1eed57a5-75f3-45cb-b112-4e156f763dca',
        queue_number: 'Q009',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-06-18',
        raw_weight_kg: 50.2,
        wet_weight_sample_g: 50.0,
        drc_percentage: 38.0,
        dry_weight_kg: 19.4,
        price_per_kg: 81.0,
        total_amount: 1540.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 847.0,
        tapper_share_amount: 693.0,
        status: 'paid',
        created_at: '2026-06-18T10:00:09.000Z'
      },
      {
        id: '74b9dcc3-4b5d-4e80-990e-0c453d728752',
        queue_number: 'Q008',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-06-16',
        raw_weight_kg: 36.4,
        wet_weight_sample_g: 50.0,
        drc_percentage: 39.0,
        dry_weight_kg: 14.1,
        price_per_kg: 83.0,
        total_amount: 1170.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 643.0,
        tapper_share_amount: 527.0,
        status: 'paid',
        created_at: '2026-06-16T10:00:08.000Z'
      },
      {
        id: 'f7b1b7b4-331a-48c5-a38b-1d1240be623f',
        queue_number: 'Q007',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-06-15',
        raw_weight_kg: 33.2,
        wet_weight_sample_g: 50.0,
        drc_percentage: 39.0,
        dry_weight_kg: 12.5,
        price_per_kg: 83.0,
        total_amount: 1070.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 588.0,
        tapper_share_amount: 482.0,
        status: 'paid',
        created_at: '2026-06-15T10:00:07.000Z'
      },
      {
        id: '74e8b4ef-0366-415c-a8ec-0ea799e68aea',
        queue_number: 'Q006',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'สุชุก',
        date: '2026-06-13',
        raw_weight_kg: 0.0,
        wet_weight_sample_g: 50.0,
        drc_percentage: 0.0,
        dry_weight_kg: 31.9,
        price_per_kg: 36.0,
        total_amount: 1148.0,
        owner_share_percentage: 50.0,
        owner_share_amount: 574.0,
        tapper_share_amount: 574.0,
        status: 'paid',
        created_at: '2026-06-13T09:30:00.000Z'
      },
      {
        id: 'b9376df8-7784-491e-8b01-a37d3224d4fd',
        queue_number: 'Q005',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-06-05',
        raw_weight_kg: 27.8,
        wet_weight_sample_g: 50.0,
        drc_percentage: 40.0,
        dry_weight_kg: 11.1,
        price_per_kg: 82.0,
        total_amount: 910.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 501.95,
        tapper_share_amount: 408.05,
        status: 'paid',
        created_at: '2026-06-05T10:00:05.000Z'
      },
      {
        id: '572818ac-b156-4b17-9c56-cd0161bf25b7',
        queue_number: 'Q004',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-06-01',
        raw_weight_kg: 23.4,
        wet_weight_sample_g: 50.0,
        drc_percentage: 40.0,
        dry_weight_kg: 9.3,
        price_per_kg: 83.0,
        total_amount: 771.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 424.05,
        tapper_share_amount: 346.95,
        status: 'paid',
        created_at: '2026-06-01T10:00:04.000Z'
      },
      {
        id: '6bfdc716-7597-4587-8bb4-3ec4bb451629',
        queue_number: 'Q003',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-06-09',
        raw_weight_kg: 22.2,
        wet_weight_sample_g: 50.0,
        drc_percentage: 40.0,
        dry_weight_kg: 8.8,
        price_per_kg: 87.0,
        total_amount: 765.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 420.0,
        tapper_share_amount: 345.0,
        status: 'paid',
        created_at: '2026-06-09T10:00:03.000Z'
      },
      {
        id: '9ab76702-eb9d-4dc7-9891-6a9f9119b3c7',
        queue_number: 'Q002',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-06-08',
        raw_weight_kg: 27.8,
        wet_weight_sample_g: 50.0,
        drc_percentage: 39.2,
        dry_weight_kg: 10.8,
        price_per_kg: 85.0,
        total_amount: 918.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 504.0,
        tapper_share_amount: 414.0,
        status: 'paid',
        created_at: '2026-06-08T10:00:02.000Z'
      },
      {
        id: 'bdf131b4-0a38-4475-90ac-506e12ce73b0',
        queue_number: 'Q001',
        seller_name: 'ชาวสวน (สแกนบิล)',
        buyer_name: 'น้องซิน น้ำยางสด',
        date: '2026-06-13',
        raw_weight_kg: 31.8,
        wet_weight_sample_g: 50.0,
        drc_percentage: 35.0,
        dry_weight_kg: 12.4,
        price_per_kg: 87.0,
        total_amount: 1078.0,
        owner_share_percentage: 55.0,
        owner_share_amount: 592.0,
        tapper_share_amount: 486.0,
        status: 'paid',
        created_at: '2026-06-13T10:00:01.000Z'
      }
    ];
    localStorage.setItem(txsKey, JSON.stringify(defaultTxs));
  }

  // --- Sub-Account System Seed Data ---
  const accountsKey = 'farmpro_accounts';
  const profilesKey = 'farmpro_all_profiles';
  const existingAccounts = safeJsonParse(accountsKey, []);
  
  if (!existingAccounts.find(a => a.phone_number === '0800000001')) {
    const clerkId = 'mock-clerk-1';
    const drcId = 'mock-drc-1';

    const newAccounts = [
      {
        user_id: clerkId,
        email: 'phone_0800000001@farmpro.local',
        username: '0800000001',
        phone_number: '0800000001',
        password_hash: hashPassword('password'),
        created_at: new Date().toISOString()
      },
      {
        user_id: drcId,
        email: 'phone_0800000002@farmpro.local',
        username: '0800000002',
        phone_number: '0800000002',
        password_hash: hashPassword('password'),
        created_at: new Date().toISOString()
      }
    ];
    localStorage.setItem(accountsKey, JSON.stringify([...existingAccounts, ...newAccounts]));

    const existingProfiles = safeJsonParse(profilesKey, []);
    const newProfiles = [
      {
        id: clerkId,
        user_id: clerkId,
        full_name: 'สมหญิง เสมียนรับซื้อ',
        phone_number: '0800000001',
        role: 'CLERK',
        status: 'approved',
        store_id: 'mock-owner-id' // Map to store
      },
      {
        id: drcId,
        user_id: drcId,
        full_name: 'สมชาย ห้องแล็บ',
        phone_number: '0800000002',
        role: 'DRC_LAB',
        status: 'approved',
        store_id: 'mock-owner-id'
      }
    ];
    localStorage.setItem(profilesKey, JSON.stringify([...existingProfiles, ...newProfiles]));
  }
};

// Helper to convert phone number to virtual auth email
export const phoneToVirtualEmail = (phone) => {
  if (!phone) return '';
  const digitsOnly = phone.toString().replace(/\D/g, '');
  return `phone_${digitsOnly}@farmpro.local`;
};

// Database Service Interface (Agnostic layer for both Mock and Live mode)
export const db = {
  // --- Daily Settings ---
  getDailySettings: async (dateStr) => {
    if (isMock) {
      await delay(200);
      const settingsList = safeJsonParse('farmpro_daily_settings', []);
      const found = settingsList.find(s => s.date === dateStr);
      return found || null;
    }

    try {
      const { data, error } = await supabase
        .from('daily_settings')
        .select('*')
        .eq('date', dateStr)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error fetching daily settings:', err);
      // Fallback to local storage settings if Supabase fails (offline fallback)
      const settingsList = safeJsonParse('farmpro_daily_settings', []);
      return settingsList.find(s => s.date === dateStr) || null;
    }
  },

  saveDailySettings: async (settings) => {
    // ---- Always persist to localStorage first (offline + fast) ----
    const settingsList = safeJsonParse('farmpro_daily_settings', []);
    const localIndex = settingsList.findIndex(s => s.date === settings.date);
    const localSetting = {
      id: settings.id || (localIndex >= 0 ? settingsList[localIndex].id : null) || uuidv4(),
      ...settings,
      created_at: (localIndex >= 0 ? settingsList[localIndex].created_at : null) || new Date().toISOString()
    };
    if (localIndex >= 0) settingsList[localIndex] = localSetting;
    else settingsList.push(localSetting);
    localStorage.setItem('farmpro_daily_settings', JSON.stringify(settingsList));

    if (isMock) {
      await delay(300);
      return localSetting;
    }

    // ---- Try Supabase upsert (full payload including new columns) ----
    try {
      const { data, error } = await supabase
        .from('daily_settings')
        .upsert(settings, { onConflict: 'date' })
        .select()
        .single();

      if (error) throw error;

      // Sync Supabase response back to localStorage
      const refreshed = safeJsonParse('farmpro_daily_settings', []);
      const ri = refreshed.findIndex(s => s.date === data.date);
      if (ri >= 0) refreshed[ri] = data; else refreshed.push(data);
      localStorage.setItem('farmpro_daily_settings', JSON.stringify(refreshed));

      return data;
    } catch (err) {
      // ---- Column-missing fallback: strip new columns and retry ----
      // This handles the case where ALTER TABLE hasn't been run yet.
      const isColumnError = err?.code === '42703' || // PostgreSQL: undefined_column
        (typeof err?.message === 'string' && (
          err.message.includes('price_tiers') ||
          err.message.includes('pricing_mode') ||
          err.message.includes('column') ||
          err.message.includes('does not exist')
        ));

      if (isColumnError) {
        console.warn('[FarmPro] price_tiers/pricing_mode columns missing in Supabase. Retrying with base columns only. Please run the ALTER TABLE migration.');
        try {
          const { price_tiers, pricing_mode, override_reason, override_by_name, price_source, ...baseSettings } = settings;
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('daily_settings')
            .upsert(baseSettings, { onConflict: 'date' })
            .select()
            .single();

          if (fallbackError) throw fallbackError;

          // Merge tier data into local cache (Supabase won't store it yet)
          const merged = { ...fallbackData, price_tiers: settings.price_tiers, pricing_mode: settings.pricing_mode };
          const refreshed = safeJsonParse('farmpro_daily_settings', []);
          const ri = refreshed.findIndex(s => s.date === merged.date);
          if (ri >= 0) refreshed[ri] = merged; else refreshed.push(merged);
          localStorage.setItem('farmpro_daily_settings', JSON.stringify(refreshed));

          console.info('[FarmPro] ✅ Settings saved (base columns to Supabase + full data to localStorage). Run ALTER TABLE to enable full Supabase sync.');
          return merged;
        } catch (retryErr) {
          console.error('Retry also failed:', retryErr);
          // Data is already in localStorage, return it
          console.info('[FarmPro] Supabase unavailable. Settings saved to localStorage only.');
          return localSetting;
        }
      }

      console.error('Error saving daily settings:', err);
      // Data is already in localStorage — don't lose it, just warn
      console.info('[FarmPro] Supabase save failed but data is preserved in localStorage.');
      return localSetting;
    }
  },


  // --- Profile Helpers ---
  getProfileByPhone: async (phone) => {
    if (isMock) {
      await delay(200);
      const profilesList = safeJsonParse('farmpro_profiles', []);
      return profilesList.find(p => p.phone_number === phone) || null;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone_number', phone)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error fetching profile by phone:', err);
      return null;
    }
  },

  /**
   * ค้นหาโปรไฟล์ seller แบบ partial match ด้วยชื่อหรือเบอร์โทร
   * Best Practice: ใช้ ILIKE + limit=10 เพื่อประหยัด DB resource
   * รองรับ optional location filter (province/district/subdistrict)
   * @param {string} query - คำค้นหา (ชื่อหรือเบอร์โทร)
   * @param {object} filters - { province, district, subdistrict } (optional)
   * @param {number} limit - จำนวนผลลัพธ์สูงสุด (default 8)
   */
  searchSellerProfiles: async (query, filters = {}, limit = 8) => {
    if (!query || query.trim().length < 2) return [];

    const q = query.trim();

    // ---- MOCK MODE: ค้นหาจาก localStorage ----
    if (isMock) {
      await delay(150);
      // รวม profiles จาก farmpro_profiles + seller address book
      const registeredProfiles = safeJsonParse('farmpro_profiles', []);
      const addressBook = safeJsonParse('farmpro_seller_address_book', []);

      // Mock: สร้าง seed sellers ถ้าว่าง
      const seedProfiles = [
        { id: 'mock-seller-001', full_name: 'สมชาย รักสวน', phone_number: '0812345678', role: 'seller', province: 'สุราษฎร์ธานี', district: 'ไชยา', is_app_user: true },
        { id: 'mock-seller-002', full_name: 'มานี ใจดี', phone_number: '0898765432', role: 'seller', province: 'สุราษฎร์ธานี', district: 'พุนพิน', is_app_user: true },
        { id: 'mock-seller-003', full_name: 'สุภาพ ขยันกรีด', phone_number: '0934567890', role: 'seller', province: 'ชุมพร', district: 'เมือง', is_app_user: true },
      ];

      const allSellers = [
        ...seedProfiles,
        ...registeredProfiles.filter(p => p.role === 'seller' || p.role === 'SELLER'),
        ...addressBook
      ];

      // ค้นหา partial match
      const lower = q.toLowerCase();
      let results = allSellers.filter(p => {
        const nameMatch = (p.full_name || '').toLowerCase().includes(lower);
        const phoneMatch = (p.phone_number || '').includes(q);
        return nameMatch || phoneMatch;
      });

      // Apply location filters
      if (filters.province) results = results.filter(p => p.province === filters.province);
      if (filters.district) results = results.filter(p => p.district === filters.district);
      if (filters.subdistrict) results = results.filter(p => p.subdistrict === filters.subdistrict);

      // Deduplicate by phone_number
      const seen = new Set();
      results = results.filter(p => {
        const key = p.phone_number || p.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return results.slice(0, limit).map(p => ({
        id: p.id,
        full_name: p.full_name,
        phone_number: p.phone_number,
        province: p.province || null,
        district: p.district || null,
        subdistrict: p.subdistrict || null,
        is_app_user: p.is_app_user ?? true,
        source: p.source || 'registered',
      }));
    }

    // ---- REAL SUPABASE MODE ----
    // Strategy: ค้นหาทั้งชื่อและเบอร์โทรพร้อมกัน, จำกัด limit เพื่อ performance
    try {
      let queryBuilder = supabase
        .from('profiles')
        .select('id, full_name, phone_number, province, district, subdistrict')
        .or(`full_name.ilike.%${q}%,phone_number.ilike.%${q}%`)
        .in('role', ['seller', 'SELLER'])
        .limit(limit);

      // Apply optional location filters (ประหยัด resource เมื่อ user มาก)
      if (filters.province) queryBuilder = queryBuilder.eq('province', filters.province);
      if (filters.district) queryBuilder = queryBuilder.eq('district', filters.district);
      if (filters.subdistrict) queryBuilder = queryBuilder.eq('subdistrict', filters.subdistrict);

      const { data, error } = await queryBuilder;
      if (error) throw error;

      const registeredResults = (data || []).map(p => ({ ...p, is_app_user: true, source: 'registered' }));

      // Merge with local address book (ผู้ขายที่ไม่ได้ใช้แอป)
      const addressBook = safeJsonParse('farmpro_seller_address_book', []);
      const lower = q.toLowerCase();
      const localResults = addressBook.filter(p => {
        const nameMatch = (p.full_name || '').toLowerCase().includes(lower);
        const phoneMatch = (p.phone_number || '').includes(q);
        let locMatch = true;
        if (filters.province && p.province !== filters.province) locMatch = false;
        if (filters.district && p.district !== filters.district) locMatch = false;
        return (nameMatch || phoneMatch) && locMatch;
      }).map(p => ({ ...p, is_app_user: false, source: 'address_book' }));

      // Merge, deduplicate (registered wins over address_book)
      const merged = [...registeredResults];
      const registeredPhones = new Set(registeredResults.map(p => p.phone_number));
      for (const p of localResults) {
        if (!registeredPhones.has(p.phone_number)) merged.push(p);
      }

      return merged.slice(0, limit);
    } catch (err) {
      console.error('Error searching seller profiles:', err);
      // Fallback: ค้นหาจาก address book เท่านั้น
      const addressBook = safeJsonParse('farmpro_seller_address_book', []);
      const lower = q.toLowerCase();
      return addressBook
        .filter(p => (p.full_name || '').toLowerCase().includes(lower) || (p.phone_number || '').includes(q))
        .slice(0, limit)
        .map(p => ({ ...p, is_app_user: false, source: 'address_book' }));
    }
  },

  // --- Seller Address Book (Local Cache สำหรับผู้ขายที่ไม่ได้ใช้แอป) ---
  // TTL: 30 วัน นับจากวันที่ทำ transaction ล่าสุด
  // ไม่กินทรัพยากร server เพราะเก็บใน localStorage เท่านั้น

  /**
   * บันทึกหรืออัปเดตผู้ขายใน address book (localStorage)
   * เรียกหลังจาก Weight In สำเร็จ เพื่อเก็บข้อมูลผู้ขายไว้ใช้ครั้งหน้า
   */
  saveSellerToAddressBook: (sellerData) => {
    if (!sellerData?.full_name && !sellerData?.phone_number) return;
    const book = safeJsonParse('farmpro_seller_address_book', []);
    const now = new Date().toISOString();

    const existing = book.findIndex(p =>
      p.phone_number && p.phone_number === sellerData.phone_number
    );

    const entry = {
      id: sellerData.id || ('ab-' + Date.now()),
      full_name: sellerData.full_name || '',
      phone_number: sellerData.phone_number || '',
      province: sellerData.province || null,
      district: sellerData.district || null,
      subdistrict: sellerData.subdistrict || null,
      is_app_user: sellerData.is_app_user || false,
      source: 'address_book',
      last_transaction_at: now,
      created_at: existing >= 0 ? (book[existing].created_at || now) : now,
    };

    if (existing >= 0) {
      book[existing] = entry;
    } else {
      book.push(entry);
    }

    localStorage.setItem('farmpro_seller_address_book', JSON.stringify(book));
  },

  /**
   * ลบ seller จาก address book ที่ไม่มี transaction เกิน 30 วัน
   * เรียกอัตโนมัติตอน app โหลด (ไม่กระทบ performance)
   */
  cleanupStaleSellerCache: () => {
    const book = safeJsonParse('farmpro_seller_address_book', []);
    if (book.length === 0) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const cleaned = book.filter(p => {
      if (!p.last_transaction_at) return false; // ไม่มีวันที่ → ลบทิ้ง
      return new Date(p.last_transaction_at) > cutoff;
    });

    if (cleaned.length !== book.length) {
      const removed = book.length - cleaned.length;
      console.info(`[FarmPro] ลบ seller cache ที่หมดอายุ ${removed} รายการ (>30 วัน)`);
      localStorage.setItem('farmpro_seller_address_book', JSON.stringify(cleaned));
    }
  },

  /**
   * คำนวณราคารับซื้อจาก tier ที่ตรงกับ %DRC
   * Best Practice: tier เรียงจากสูงไปต่ำ (drc_min DESC) เพื่อให้ match tier สูงสุดก่อนเสมอ
   * @param {number} drcPct - %DRC จริงที่ได้จากห้องแล็บ
   * @param {Array} tiers - [{ drc_min, drc_max, price_per_kg, label }] จาก dailySettings.price_tiers
   * @param {number} basePrice - ราคา fallback ถ้าไม่ตรง tier ใดเลย
   * @returns {{ price: number, tier_label: string, from_tier: boolean, needs_manual: boolean }}
   */
  resolvePriceFromTiers: (drcPct, tiers, basePrice) => {
    const pct = parseFloat(drcPct) || 0;

    // ถ้าไม่มี tiers หรือไม่ได้ใช้ tiered mode → ใช้ base_price
    if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
      return {
        price: parseFloat(basePrice) || 0,
        tier_label: 'ราคาปกติ',
        from_tier: false,
        needs_manual: false,
      };
    }

    // เรียง tiers จาก drc_min สูงไปต่ำ
    const sorted = [...tiers].sort((a, b) => parseFloat(b.drc_min) - parseFloat(a.drc_min));

    for (const tier of sorted) {
      const min = parseFloat(tier.drc_min);
      const max = tier.drc_max != null ? parseFloat(tier.drc_max) : Infinity;
      if (pct >= min && pct <= max) {
        return {
          price: parseFloat(tier.price_per_kg) || 0,
          tier_label: tier.label || `${tier.drc_min}–${tier.drc_max != null ? tier.drc_max : '↑'}%`,
          from_tier: true,
          needs_manual: false,
        };
      }
    }

    // ไม่ตรง tier ใด → ต้องให้กรอกราคาเอง
    return {
      price: 0,
      tier_label: 'ไม่ตรงช่วง DRC ที่กำหนด',
      from_tier: false,
      needs_manual: true,
    };
  },

  // --- User Farms Management ---

  getUserFarms: async (userId) => {
    if (isMock) {
      await delay(200);
      const farms = safeJsonParse('farmpro_user_farms', []);
      return farms.filter(f => f.user_id === userId);
    }
    try {
      const { data, error } = await supabase
        .from('user_farms')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching user farms:', err);
      return [];
    }
  },
  addUserFarm: async (farmData) => {
    if (isMock) {
      await delay(300);
      const farms = safeJsonParse('farmpro_user_farms', []);
      const newFarm = { ...farmData, id: 'mock-farm-' + Date.now(), created_at: new Date().toISOString() };
      farms.push(newFarm);
      localStorage.setItem('farmpro_user_farms', JSON.stringify(farms));
      return newFarm;
    }

    try {
      const { data, error } = await supabase
        .from('user_farms')
        .insert([farmData])
        .select()
        .single();
      if (error) {
        console.error('[addUserFarm] Supabase insert error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          payload: farmData
        });
        throw error;
      }
      // Sync to local cache for offline access
      const farms = safeJsonParse('farmpro_user_farms', []);
      farms.push(data);
      localStorage.setItem('farmpro_user_farms', JSON.stringify(farms));
      return data;
    } catch (err) {
      // Re-throw so FarmManagement can display the real Supabase error
      throw err;
    }
  },
  updateUserFarm: async (farmId, farmData) => {
    // Exclude user_id from update payload (immutable owner field)
    const { user_id, id, created_at, ...updatePayload } = farmData;

    // Always update localStorage
    const farms = safeJsonParse('farmpro_user_farms', []);
    const index = farms.findIndex(f => f.id === farmId);
    if (index >= 0) {
      farms[index] = { ...farms[index], ...updatePayload };
      localStorage.setItem('farmpro_user_farms', JSON.stringify(farms));
    }

    if (isMock) {
      await delay(300);
      if (index >= 0) return farms[index];
      throw new Error('Farm not found');
    }

    try {
      const { data, error } = await supabase
        .from('user_farms')
        .update(updatePayload)
        .eq('id', farmId)
        .select()
        .single();
      if (error) throw error;
      // Sync updated record to local cache
      if (index >= 0) farms[index] = data;
      localStorage.setItem('farmpro_user_farms', JSON.stringify(farms));
      return data;
    } catch (err) {
      console.error('Error updating user farm in Supabase, using local data:', err);
      // Fallback: return locally updated record
      if (index >= 0) return farms[index];
      throw err;
    }
  },
  deleteUserFarm: async (farmId) => {
    if (isMock) {
      await delay(300);
      let farms = safeJsonParse('farmpro_user_farms', []);
      farms = farms.filter(f => f.id !== farmId);
      localStorage.setItem('farmpro_user_farms', JSON.stringify(farms));
      return { success: true };
    }
    try {
      const { error } = await supabase
        .from('user_farms')
        .delete()
        .eq('id', farmId);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('Error deleting user farm:', err);
      throw err;
    }
  },
  // --- Transactions ---
  getTransactions: async (dateStr) => {
    if (isMock) {
      await delay(300);
      const txs = safeJsonParse('farmpro_transactions', []);
      return (Array.isArray(txs) ? txs : [])
        .filter(t => t.date === dateStr)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    try {
      const { data, error } = await supabase
        .from('rubber_transactions')
        .select('*')
        .eq('date', dateStr)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      let safeData = Array.isArray(data) ? data : [];

      // Merge pending offline creates to prevent them from disappearing
      const pendingSync = safeJsonParse('farmpro_pending_sync', []);
      const pendingCreates = pendingSync.filter(p => p.action === 'create' && p.data && p.data.date === dateStr).map(p => p.data);
      
      const serverIds = new Set(safeData.map(t => t.id));
      for (const pTx of pendingCreates) {
        if (!serverIds.has(pTx.id)) {
          safeData.push(pTx);
        }
      }

      // Re-apply any pending offline updates
      const pendingUpdates = pendingSync.filter(p => p.action === 'update' && p.data);
      for (const update of pendingUpdates) {
         const idx = safeData.findIndex(t => t.id === update.id);
         if (idx >= 0) {
             safeData[idx] = { ...safeData[idx], ...update.data };
         }
      }

      // Update local cache
      const cachedTxs = safeJsonParse('farmpro_transactions', []);
      const filtered = (Array.isArray(cachedTxs) ? cachedTxs : []).filter(t => t.date !== dateStr);
      const updatedCache = [...filtered, ...safeData];
      localStorage.setItem('farmpro_transactions', JSON.stringify(updatedCache));

      return safeData;
    } catch (err) {
      console.error('Error fetching transactions:', err);
      // Return from local storage cache if database is unreachable
      const txs = safeJsonParse('farmpro_transactions', []);
      return (Array.isArray(txs) ? txs : []).filter(t => t.date === dateStr);
    }
  },

  createTransaction: async (tx, isOffline = false) => {
    const dateStr = tx.date || new Date().toISOString().split('T')[0];

    // Always fetch cache for queue numbering to prevent duplicate/incorrect queue
    const cachedTxs = safeJsonParse('farmpro_transactions', []);
    const queueNo = tx.queue_number || generateQueueNumber(cachedTxs, dateStr);

    const newTx = {
      id: tx.id || uuidv4(),
      ...tx,
      queue_number: queueNo,
      date: dateStr,
      status: tx.status || 'waiting_drc',
      created_at: tx.created_at || new Date().toISOString(),
    };

    // Update local storage cache immediately
    cachedTxs.push(newTx);
    localStorage.setItem('farmpro_transactions', JSON.stringify(cachedTxs));
    
    // Dispatch local realtime event for multi-tab sync
    try {
      localStorage.setItem('farmpro_realtime_event', JSON.stringify({
        eventType: 'INSERT',
        new: newTx,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Realtime event trigger failed:', e);
    }

    if (isMock || isOffline) {
      if (isOffline) {
        // Queue it for sync
        const pendingSync = safeJsonParse('farmpro_pending_sync', []);
        pendingSync.push({ action: 'create', data: newTx });
        localStorage.setItem('farmpro_pending_sync', JSON.stringify(pendingSync));
      }
      return newTx;
    }

    try {
      const dbPayload = sanitizeTransaction(newTx);
      
      const { data, error } = await supabase
        .from('rubber_transactions')
        .insert(dbPayload)
        .select()
        .single();

      if (error) {
        console.error('Supabase Insert Error in createTransaction:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      return data;
    } catch (err) {
      console.warn('Network request failed, transaction saved offline. Error details:', err);
      // Queue it for sync automatically since network failed
      const errorMsg = err.message || err.details || (typeof err === 'string' ? err : JSON.stringify(err));
      const pendingSync = safeJsonParse('farmpro_pending_sync', []);
      pendingSync.push({ action: 'create', data: newTx, error_msg: errorMsg });
      localStorage.setItem('farmpro_pending_sync', JSON.stringify(pendingSync));
      return newTx;
    }
  },

  updateTransaction: async (id, updates, isOffline = false) => {
    // 1. Update local cache
    const cachedTxs = safeJsonParse('farmpro_transactions', []);
    const index = cachedTxs.findIndex(t => t.id === id);
    let updatedTx = null;

    if (index >= 0) {
      updatedTx = { ...cachedTxs[index], ...updates };
      cachedTxs[index] = updatedTx;
      localStorage.setItem('farmpro_transactions', JSON.stringify(cachedTxs));
    }

    // Dispatch local realtime event for multi-tab sync
    try {
      localStorage.setItem('farmpro_realtime_event', JSON.stringify({
        eventType: 'UPDATE',
        new: updatedTx || { id, ...updates },
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Realtime event trigger failed:', e);
    }

    if (isMock || isOffline) {
      if (isOffline) {
        // Queue it for sync
        const pendingSync = safeJsonParse('farmpro_pending_sync', []);
        pendingSync.push({ action: 'update', id, data: updates });
        localStorage.setItem('farmpro_pending_sync', JSON.stringify(pendingSync));
      }
      return updatedTx || { id, ...updates };
    }

    try {
      const dbUpdates = sanitizeTransaction(updates);
      
      const { data, error } = await supabase
        .from('rubber_transactions')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase Update Error in updateTransaction:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      return data;
    } catch (err) {
      console.warn('Network request failed, transaction update saved offline. Error:', err);
      const errorMsg = err.message || err.details || (typeof err === 'string' ? err : JSON.stringify(err));
      const pendingSync = safeJsonParse('farmpro_pending_sync', []);
      pendingSync.push({ action: 'update', id, data: updates, error_msg: errorMsg });
      localStorage.setItem('farmpro_pending_sync', JSON.stringify(pendingSync));
      return updatedTx || { id, ...updates };
    }
  },

  getAllTransactions: async () => {
    if (isMock) {
      await delay(200);
      return safeJsonParse('farmpro_transactions', []);
    }

    try {
      const { data, error } = await supabase
        .from('rubber_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error fetching all transactions:', err);
      return safeJsonParse('farmpro_transactions', []);
    }
  },

  deleteTransaction: async (id, isOffline = false) => {
    // Update local cache
    const cachedTxs = safeJsonParse('farmpro_transactions', []);
    const filtered = cachedTxs.filter(t => t.id !== id);
    localStorage.setItem('farmpro_transactions', JSON.stringify(filtered));

    if (isMock || isOffline) {
      if (isOffline) {
        const pendingSync = safeJsonParse('farmpro_pending_sync', []);
        pendingSync.push({ action: 'delete', id });
        localStorage.setItem('farmpro_pending_sync', JSON.stringify(pendingSync));
      }
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('rubber_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.warn('Network request failed, delete cached offline:', err);
      const pendingSync = safeJsonParse('farmpro_pending_sync', []);
      pendingSync.push({ action: 'delete', id });
      localStorage.setItem('farmpro_pending_sync', JSON.stringify(pendingSync));
      return { success: true };
    }
  },

  getProfile: async () => {
    const cachedProfile = safeJsonParse(getMockProfileKey(), null);
    const profileId = localStorage.getItem('farmpro_profile_id');
    
    if (isMock) {
      await delay(200);
      return cachedProfile;
    }

    if (!profileId) return cachedProfile;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        localStorage.setItem(getMockProfileKey(), JSON.stringify(data));
        return data;
      }
      return cachedProfile;
    } catch (err) {
      console.error('Error fetching profile from Supabase:', err);
      return cachedProfile;
    }
  },

  // --- Auth & Account Management ---
  phoneToVirtualEmail,
  checkPhoneExists: async (phone) => {
    const digits = (phone || '').toString().replace(/\D/g, '');
    if (!digits) return false;
    const virtualEmail = `phone_${digits}@farmpro.local`;

    if (!isMock && supabase) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .or(`phone_number.eq.${digits},email.eq.${virtualEmail},username.eq.${digits}`)
          .maybeSingle();
        if (data) return true;
      } catch (err) {
        console.warn('Error checking phone in Supabase:', err);
      }
    }

    const accounts = safeJsonParse('farmpro_accounts', []);
    const existsAccount = accounts.some(a => 
      (a.phone_number && a.phone_number.replace(/\D/g, '') === digits) ||
      (a.email && a.email === virtualEmail) ||
      (a.username && a.username === digits)
    );
    if (existsAccount) return true;

    const allProfiles = safeJsonParse('farmpro_all_profiles', []);
    return allProfiles.some(p => 
      (p.phone_number && p.phone_number.replace(/\D/g, '') === digits) ||
      (p.email && p.email === virtualEmail) ||
      (p.username && p.username === digits)
    );
  },

  signUp: async ({ email, username, phone, password, profileData }) => {
    const cleanPhone = (phone || profileData?.phone_number || '').toString().replace(/\D/g, '');
    const userEmail = email || (cleanPhone ? phoneToVirtualEmail(cleanPhone) : `${username || 'user'}@farmpro.local`);
    const userUsername = username || cleanPhone || (email ? email.split('@')[0] : 'user');
    let userId = uuidv4();

    if (!isMock && supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: userEmail,
          password: password,
          options: {
            data: { username: userUsername, phone_number: cleanPhone }
          }
        });
        if (error) throw error;
        if (data?.user) {
          userId = data.user.id;
        }
      } catch (err) {
        console.warn('Supabase auth signUp error (falling back to local profile):', err);
      }
    }

    // Save local account credentials for mock/offline fallback (Hashed password - NO plaintext passwords)
    const accounts = safeJsonParse('farmpro_accounts', []);
    accounts.push({
      user_id: userId,
      email: userEmail,
      username: userUsername,
      phone_number: cleanPhone,
      password_hash: hashPassword(password),
      created_at: new Date().toISOString()
    });
    localStorage.setItem('farmpro_accounts', JSON.stringify(accounts));

    // Save profile record bound to user_id with status = 'approved'
    const finalProfileData = sanitizeProfile({
      ...profileData,
      id: userId,
      user_id: userId,
      username: userUsername,
      email: userEmail,
      phone_number: cleanPhone || profileData?.phone_number || '',
      status: profileData?.status || 'approved'
    });

    localStorage.setItem('farmpro_profile_id', userId);
    const saveResult = await db.saveProfile(finalProfileData);
    
    // Set active session (Sanitized)
    const rawSession = {
      user: { id: userId, email: userEmail, username: userUsername, phone: cleanPhone },
      created_at: new Date().toISOString()
    };
    const session = sanitizeSession(rawSession);
    localStorage.setItem('farmpro_session', JSON.stringify(session));

    return { success: true, user: session.user, profile: saveResult.data };
  },

  signIn: async ({ identifier, password }) => {
    const rawInput = (identifier || '').trim();
    const digitsOnly = rawInput.replace(/\D/g, '');
    
    // Detect if input is phone number (9-10 numeric digits)
    const isPhone = digitsOnly.length >= 9 && digitsOnly.length <= 10 && (rawInput.startsWith('0') || /^\d+$/.test(rawInput));
    const cleanId = isPhone ? digitsOnly : rawInput.toLowerCase();
    const virtualEmail = isPhone ? phoneToVirtualEmail(digitsOnly) : (rawInput.includes('@') ? rawInput : '');

    if (!isMock && supabase) {
      try {
        let authEmail = virtualEmail;
        if (!authEmail) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('email')
            .or(`username.eq.${cleanId},phone_number.eq.${cleanId}`)
            .maybeSingle();
          if (prof?.email) {
            authEmail = prof.email;
          } else {
            authEmail = cleanId;
          }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password
        });

        if (error) throw error;

        if (data?.user) {
          let { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

          if (!profile) {
            const { data: prof2 } = await supabase
              .from('profiles')
              .select('*')
              .or(`id.eq.${data.user.id},email.eq.${authEmail},phone_number.eq.${cleanId}`)
              .maybeSingle();
            profile = prof2;
          }

          if (profile) {
            const sanitizedProfile = sanitizeProfile(profile);
            const sanitizedSession = sanitizeSession(data.session);
            localStorage.setItem(getMockProfileKey(), JSON.stringify(sanitizedProfile));
            localStorage.setItem('farmpro_profile_id', sanitizedProfile.id);
            localStorage.setItem('farmpro_registered', 'true');
            localStorage.setItem('farmpro_session', JSON.stringify(sanitizedSession));
            return { success: true, session: sanitizedSession, profile: sanitizedProfile };
          }
        }
      } catch (err) {
        console.warn('Supabase auth signIn error, checking local storage:', err);
      }
    }

    // Local / Mock validation fallback (Hash comparison, avoiding plain text password storage)
    const accounts = safeJsonParse('farmpro_accounts', []);
    const inputHash = hashPassword(password);
    const matchedAccount = accounts.find(a => 
      (a.password_hash === inputHash || a.password === password) && (
        (isPhone && a.phone_number && a.phone_number.replace(/\D/g, '') === digitsOnly) ||
        (a.email && a.email.toLowerCase() === virtualEmail.toLowerCase()) ||
        (a.email && a.email.toLowerCase() === cleanId) ||
        (a.username && a.username.toLowerCase() === cleanId) ||
        (a.phone_number && a.phone_number.replace(/\D/g, '') === digitsOnly)
      )
    );

    const allProfiles = safeJsonParse('farmpro_all_profiles', []);
    let targetProfile = null;

    if (matchedAccount) {
      targetProfile = allProfiles.find(p => p.user_id === matchedAccount.user_id || p.email === matchedAccount.email || p.username === matchedAccount.username);
    }

    if (!targetProfile) {
      targetProfile = allProfiles.find(p => 
        (p.phone_number && p.phone_number.replace(/\D/g, '') === digitsOnly) ||
        (p.email && p.email.toLowerCase() === virtualEmail.toLowerCase()) ||
        (p.email && p.email.toLowerCase() === cleanId) ||
        (p.username && p.username.toLowerCase() === cleanId)
      );
    }

    if (targetProfile || matchedAccount) {
      const rawProfileToUse = targetProfile || {
        id: matchedAccount.user_id,
        role: 'buyer',
        full_name: matchedAccount.username || 'ผู้ใช้งาน',
        email: matchedAccount.email,
        username: matchedAccount.username,
        phone_number: matchedAccount.phone_number || digitsOnly,
        status: 'approved'
      };
      const profileToUse = sanitizeProfile(rawProfileToUse);

      const rawSession = {
        user: { id: profileToUse.id, email: profileToUse.email, username: profileToUse.username, phone: profileToUse.phone_number },
        created_at: new Date().toISOString()
      };
      const session = sanitizeSession(rawSession);

      localStorage.setItem('farmpro_current_role', profileToUse.role === 'seller' ? 'SELLER' : 'BUYER');
      localStorage.setItem(getMockProfileKey(), JSON.stringify(profileToUse));
      localStorage.setItem('farmpro_profile_id', profileToUse.id);
      localStorage.setItem('farmpro_registered', 'true');
      localStorage.setItem('farmpro_session', JSON.stringify(session));

      return { success: true, session, profile: profileToUse };
    }

    return { success: false, error: 'ไม่พบเบอร์โทรศัพท์นี้ หรือรหัสผ่านไม่ถูกต้อง' };
  },

  signOut: async () => {
    if (!isMock && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Error signing out of Supabase:', err);
      }
    }
    localStorage.removeItem('farmpro_mock_buyer');
    localStorage.removeItem('farmpro_mock_seller');
    localStorage.removeItem('farmpro_current_role');
    localStorage.removeItem('farmpro_session');
    localStorage.removeItem('farmpro_registered');
    return { success: true };
  },

  getCurrentSession: async () => {
    if (!isMock && supabase && window.navigator.onLine) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile) {
            const sanitizedProfile = sanitizeProfile(profile);
            const sanitizedSession = sanitizeSession(session);
            localStorage.setItem(getMockProfileKey(), JSON.stringify(sanitizedProfile));
            localStorage.setItem('farmpro_session', JSON.stringify(sanitizedSession));
            return { session: sanitizedSession, profile: sanitizedProfile };
          }
        }
      } catch (err) {
        console.warn('Error fetching Supabase auth session:', err);
      }
    }

    const session = sanitizeSession(safeJsonParse('farmpro_session', null));
    const profile = sanitizeProfile(safeJsonParse(getMockProfileKey(), null));
    return { session, profile };
  },

  // --- Stale-While-Revalidate (SWR) Profile & Session Pattern ---
  getProfileSWR: async (onBackgroundUpdate) => {
    // 1. Instant Render: Return cached profile & session from localStorage
    const rawCachedProfile = safeJsonParse(getMockProfileKey(), null);
    const rawCachedSession = safeJsonParse('farmpro_session', null);
    const cachedProfile = sanitizeProfile(rawCachedProfile);
    const cachedSession = sanitizeSession(rawCachedSession);

    // 2. Background Sync with Supabase
    if (!isMock && supabase && window.navigator.onLine) {
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: remoteProfile, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            if (remoteProfile && !error) {
              const sanitizedProfile = sanitizeProfile(remoteProfile);
              const sanitizedSession = sanitizeSession(session);
              localStorage.setItem(getMockProfileKey(), JSON.stringify(sanitizedProfile));
              localStorage.setItem('farmpro_session', JSON.stringify(sanitizedSession));
              if (typeof onBackgroundUpdate === 'function') {
                onBackgroundUpdate({ session: sanitizedSession, profile: sanitizedProfile });
              }
            }
          }
        } catch (err) {
          console.warn('SWR background profile sync error (retaining local cache):', err);
        }
      })();
    }

    return { session: cachedSession, profile: cachedProfile };
  },

  // --- Stale-While-Revalidate (SWR) Transactions Pattern ---
  getAllTransactionsSWR: async (onBackgroundUpdate) => {
    // 1. Instant Render from local cache
    const cachedTxs = safeJsonParse('farmpro_transactions', []);

    // 2. Background Sync from Supabase
    if (!isMock && supabase && window.navigator.onLine) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from('rubber_transactions')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data)) {
            localStorage.setItem('farmpro_transactions', JSON.stringify(data));
            if (typeof onBackgroundUpdate === 'function') {
              onBackgroundUpdate(data);
            }
          }
        } catch (err) {
          console.warn('SWR background transactions sync error:', err);
        }
      })();
    }

    return cachedTxs;
  },

  // --- Profile Management ---
  saveProfile: async (profileData, isOffline = false) => {
    let id = profileData.id || profileData.user_id || localStorage.getItem('farmpro_profile_id');
    if (!id) {
      id = uuidv4();
      localStorage.setItem('farmpro_profile_id', id);
    }

    const fullProfile = sanitizeProfile({ 
      id,
      user_id: profileData.user_id || id,
      status: profileData.status || 'approved',
      plan_id: profileData.plan_id || 'standard',
      billing_cycle: profileData.billing_cycle || 'monthly',
      created_at: new Date().toISOString(),
      ...profileData 
    });
    
    // Set current active user profile (Sanitized)
    localStorage.setItem(getMockProfileKey(), JSON.stringify(fullProfile));
    localStorage.setItem('farmpro_registered', 'true');

    // Save into farmpro_all_profiles list for AdminPortal & local persistence
    let allProfiles = safeJsonParse('farmpro_all_profiles', []);
    const idx = allProfiles.findIndex(p => p.id === id);
    if (idx >= 0) {
      allProfiles[idx] = fullProfile;
    } else {
      allProfiles.unshift(fullProfile);
    }
    localStorage.setItem('farmpro_all_profiles', JSON.stringify(allProfiles));

    if (isMock || isOffline) {
      if (isOffline) {
        const pendingSync = safeJsonParse('farmpro_pending_sync', []);
        pendingSync.push({ action: 'save_profile', id, data: fullProfile });
        localStorage.setItem('farmpro_pending_sync', JSON.stringify(pendingSync));
      }
      return { success: true, data: fullProfile };
    }

    try {
      // Strict sanitization for DB schema to prevent 400 Bad Request
      // Keep this list in sync with public.profiles columns in Supabase
      const profileSchemaKeys = [
        'id', 'user_id', 'username', 'email', 'role', 'full_name',
        'phone_number', 'subdistrict', 'district', 'province', 'postal_code',
        'latitude', 'longitude', 'google_maps_url', 'store_name',
        'vendor_category', 'vendor_description', 'business_hours',
        'status', 'plan_id', 'address_details', 'created_at', 'updated_at'
      ];
      const dbPayload = {};
      for (const key of profileSchemaKeys) {
        if (fullProfile[key] !== undefined) {
          dbPayload[key] = fullProfile[key];
        }
      }
      // user_id is a FK to auth.users -- only send it when user registered via Supabase Auth
      // (i.e. when the id was obtained from supabase.auth.signUp, not a local uuidv4)
      // We detect this by checking if user_id === id (locally-generated profiles have this pattern)
      // and the id doesn't exist in auth.users yet. Safest: just set user_id = null for local UUIDs.
      const isLocalUUID = !profileData.user_id || profileData.user_id === id;
      if (isLocalUUID) {
        dbPayload.user_id = null;
      }
      dbPayload.updated_at = new Date().toISOString();

      // Step 1: Try upsert by primary key (id) — works when UUID came from Supabase Auth
      const { data: upserted, error } = await supabase
        .from('profiles')
        .upsert(dbPayload, { onConflict: 'id' })
        .select('id');

      if (error) throw error;

      // Step 2: If upsert matched nothing (id not in DB), fall back to update by phone_number
      if (!upserted || upserted.length === 0) {
        const phone = fullProfile.phone_number;
        if (phone) {
          const { data: byPhone } = await supabase
            .from('profiles')
            .select('id')
            .eq('phone_number', phone)
            .maybeSingle();

          if (byPhone) {
            // Update existing row by phone
            const { error: phoneErr } = await supabase
              .from('profiles')
              .update(dbPayload)
              .eq('phone_number', phone);
            if (phoneErr) throw phoneErr;
          } else {
            // No row at all — insert fresh (FK on id removed, so safe with local UUID)
            const { error: insErr } = await supabase
              .from('profiles')
              .insert(dbPayload);
            if (insErr) throw insErr;
          }
        }
      }

      return { success: true, data: fullProfile };
    } catch (err) {
      console.warn('Failed to save profile to Supabase, cached offline:', err);
      const pendingSync = safeJsonParse('farmpro_pending_sync', []);
      pendingSync.push({ action: 'save_profile', id, data: fullProfile });
      localStorage.setItem('farmpro_pending_sync', JSON.stringify(pendingSync));
      return { success: true, data: fullProfile };
    }
  },

  updateProfile: async (id, updateData) => {
    const currentProfile = safeJsonParse(getMockProfileKey(), {}) || {};
    const mergedProfile = { ...currentProfile, ...updateData, id };

    localStorage.setItem(getMockProfileKey(), JSON.stringify(mergedProfile));

    let allProfiles = safeJsonParse('farmpro_all_profiles', []);
    const idx = allProfiles.findIndex(p => p.id === id);
    if (idx >= 0) {
      allProfiles[idx] = { ...allProfiles[idx], ...updateData };
    } else {
      allProfiles.unshift(mergedProfile);
    }
    localStorage.setItem('farmpro_all_profiles', JSON.stringify(allProfiles));

    if (isMock) {
      return { success: true, data: mergedProfile };
    }

    try {
      // Filter updateData to only known DB columns to prevent 400 Bad Request
      const profileSchemaKeys = [
        'id', 'user_id', 'username', 'email', 'role', 'full_name',
        'phone_number', 'subdistrict', 'district', 'province', 'postal_code',
        'latitude', 'longitude', 'google_maps_url', 'store_name',
        'vendor_category', 'vendor_description', 'business_hours',
        'status', 'plan_id', 'address_details', 'created_at', 'updated_at'
      ];
      const dbUpdatePayload = {};
      for (const key of profileSchemaKeys) {
        if (updateData[key] !== undefined) {
          dbUpdatePayload[key] = updateData[key];
        }
      }
      // Always set updated_at so the DB row reflects the latest change time
      dbUpdatePayload.updated_at = new Date().toISOString();

      // Step 1: Try updating by primary key (id)
      const { data: updatedRows, error } = await supabase
        .from('profiles')
        .update(dbUpdatePayload)
        .eq('id', id)
        .select('id');

      if (error) throw error;

      // Step 2: If no row matched the id (profile was created locally with a different UUID),
      // fall back to matching by phone_number so the correct Supabase record gets updated
      if (!updatedRows || updatedRows.length === 0) {
        const phone = mergedProfile.phone_number || updateData.phone_number;
        if (phone) {
          const { error: phoneErr } = await supabase
            .from('profiles')
            .update(dbUpdatePayload)
            .eq('phone_number', phone);
          if (phoneErr) throw phoneErr;
        }
      }

      return { success: true, data: mergedProfile };
    } catch (err) {
      console.warn('Error updating profile in Supabase, updated locally:', err);
      return { success: true, data: mergedProfile };
    }
  },

  getProfiles: async () => {
    let localProfiles = safeJsonParse('farmpro_all_profiles', []);
    const currentProfile = safeJsonParse(getMockProfileKey(), null);
    if (currentProfile && !localProfiles.some(p => p.id === currentProfile.id)) {
      localProfiles.unshift(currentProfile);
      localStorage.setItem('farmpro_all_profiles', JSON.stringify(localProfiles));
    }

    // Default mock profiles if local is empty
    if (localProfiles.length === 0) {
      localProfiles = [
        {
          id: 'a4db4072-d799-4d1d-9860-27aaef936614',
          role: 'buyer',
          full_name: 'สมชาย รับซื้อยาง',
          store_name: 'สมชายการยาง พาราไทย',
          phone_number: '089-111-2222',
          subdistrict: 'พุนพิน',
          district: 'พุนพิน',
          province: 'สุราษฎร์ธานี',
          postal_code: '84130',
          business_hours: 'จันทร์-เสาร์ 06:00 - 18:00 น.',
          rubber_types: 'น้ำยางสด,ยางก้อนถ้วย',
          status: 'approved', // Auto-approved on registration
          created_at: new Date(Date.now() - 3600000 * 2).toISOString()
        },
        {
          id: 'adedd602-9a68-4998-b11d-b1a76fac3685',
          role: 'buyer',
          full_name: 'เจริญทรัพย์ พาราวู้ด',
          store_name: 'เจริญทรัพย์การยาง',
          phone_number: '081-333-4444',
          subdistrict: 'หาดใหญ่',
          district: 'หาดใหญ่',
          province: 'สงขลา',
          postal_code: '90110',
          business_hours: 'ทุกวัน 07:00 - 17:00 น.',
          rubber_types: 'น้ำยางสด,ยางแผ่นดิบ',
          status: 'approved', // Auto-approved on registration
          created_at: new Date(Date.now() - 3600000 * 5).toISOString()
        }
      ];
      localStorage.setItem('farmpro_all_profiles', JSON.stringify(localProfiles));
    }

    if (isMock) {
      return { success: true, data: localProfiles };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Merge Supabase remote profiles with local profiles
      const mergedMap = new Map();
      (data || []).forEach(p => mergedMap.set(p.id, p));
      localProfiles.forEach(p => {
        if (!mergedMap.has(p.id)) {
          mergedMap.set(p.id, p);
        }
      });

      const allMerged = Array.from(mergedMap.values());
      localStorage.setItem('farmpro_all_profiles', JSON.stringify(allMerged));
      return { success: true, data: allMerged };
    } catch (err) {
      console.warn('Error fetching profiles from Supabase, using local:', err);
      return { success: true, data: localProfiles };
    }
  },

  subscribeToTransactions: (callback) => {
    if (isMock) {
      const handleStorage = (e) => {
        if (e.key === 'farmpro_realtime_event' && e.newValue) {
          try {
            const payload = JSON.parse(e.newValue);
            callback(payload);
          } catch (err) {}
        }
      };
      window.addEventListener('storage', handleStorage);
      return () => {
        window.removeEventListener('storage', handleStorage);
      };
    }

    if (!supabase) return () => {};

    const channel = supabase.channel('public:rubber_transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rubber_transactions' }, payload => {
        callback(payload);
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  },

  updateProfileStatus: async (id, status) => {
    let localProfiles = safeJsonParse('farmpro_all_profiles', []);
    localProfiles = localProfiles.map(p => p.id === id ? { ...p, status } : p);
    localStorage.setItem('farmpro_all_profiles', JSON.stringify(localProfiles));

    const currentProfile = safeJsonParse(getMockProfileKey(), null);
    if (currentProfile && currentProfile.id === id) {
      currentProfile.status = status;
      localStorage.setItem(getMockProfileKey(), JSON.stringify(currentProfile));
    }

    if (isMock) {
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.warn('Error updating profile status in Supabase:', err);
      return { success: true };
    }
  },

  // Sync offline queued requests
  syncOfflineData: async () => {
    if (isMock) return { success: true, count: 0 };
    
    const pendingSync = safeJsonParse('farmpro_pending_sync', []);
    if (pendingSync.length === 0) return { success: true, count: 0 };

    console.log(`Syncing ${pendingSync.length} offline transactions...`);
    let successCount = 0;
    const remainingSync = [];

    for (const item of pendingSync) {
      try {
        if (item.action === 'create') {
          const dbPayload = sanitizeTransaction(item.data);
          const { data: existing } = await supabase
            .from('rubber_transactions')
            .select('id')
            .eq('id', dbPayload.id)
            .maybeSingle();

          if (!existing) {
            const { error } = await supabase
              .from('rubber_transactions')
              .insert(dbPayload);
            if (error) throw error;
          }
        } else if (item.action === 'update') {
          const dbPayload = sanitizeTransaction(item.data);
          const { error } = await supabase
            .from('rubber_transactions')
            .update(dbPayload)
            .eq('id', item.id);
          if (error) throw error;
        } else if (item.action === 'delete') {
          const { error } = await supabase
            .from('rubber_transactions')
            .delete()
            .eq('id', item.id);
          if (error) throw error;
        } else if (item.action === 'save_profile') {
          const profileSchemaKeys = [
            'id', 'user_id', 'username', 'email', 'role', 'full_name',
            'phone_number', 'subdistrict', 'district', 'province', 'postal_code',
            'latitude', 'longitude', 'google_maps_url', 'store_name',
            'vendor_category', 'vendor_description', 'business_hours',
            'created_at', 'status', 'plan_id', 'updated_at', 'address_details'
          ];
          const dbPayload = {};
          for (const key of profileSchemaKeys) {
            if (item.data[key] !== undefined) {
              dbPayload[key] = item.data[key];
            }
          }
          dbPayload.user_id = null;
          dbPayload.updated_at = new Date().toISOString();

          const phone = item.data.phone_number;
          const { data: upserted, error: upsertErr } = await supabase
            .from('profiles')
            .upsert(dbPayload, { onConflict: 'id' })
            .select('id');

          if (upsertErr) throw upsertErr;

          if ((!upserted || upserted.length === 0) && phone) {
            const { data: byPhone } = await supabase
              .from('profiles')
              .select('id')
              .eq('phone_number', phone)
              .maybeSingle();

            if (byPhone) {
              const { error: phoneErr } = await supabase
                .from('profiles')
                .update(dbPayload)
                .eq('phone_number', phone);
              if (phoneErr) throw phoneErr;
            } else {
              const { error: insErr } = await supabase
                .from('profiles')
                .insert(dbPayload);
              if (insErr) throw insErr;
            }
          }
        }
        successCount++;
      } catch (err) {
        console.error(`Sync failed for item ${item.id || 'unknown'}:`, err);
        const errorMsg = err.message || err.details || (typeof err === 'string' ? err : JSON.stringify(err));
        remainingSync.push({ ...item, error_msg: errorMsg });
      }
    }

    localStorage.setItem('farmpro_pending_sync', JSON.stringify(remainingSync));
    return { success: remainingSync.length === 0, count: successCount, remaining: remainingSync.length };
  }
};
