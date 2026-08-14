/**
 * Lab Station Token Utilities
 * กลไกความปลอดภัย (URL-embedded seed approach):
 * - Seed ถูกฝังอยู่ใน URL ของ QR Code โดยตรง (&s=xxx)
 * - ทุก device validate ได้จาก URL params เท่านั้น (ไม่ต้องพึ่ง localStorage หรือ DB)
 * - Token หมดอายุเองเที่ยงคืน (dateStr ใน hash เปลี่ยน)
 * - Revoke: สร้าง seed ใหม่ -> QR URL ใหม่ -> URL เก่า hash ไม่ตรง -> invalid
 */

const SEED_STORAGE_KEY = 'farmpro_lab_secret_seed';

/** สร้าง random secret seed (16 bytes hex) */
export const generateSeed = () => {
  const arr = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
};

/** ดึง seed จาก localStorage (สร้างใหม่ถ้ายังไม่มี) */
export const getOrCreateSeed = () => {
  let seed = localStorage.getItem(SEED_STORAGE_KEY);
  if (!seed) {
    seed = generateSeed();
    localStorage.setItem(SEED_STORAGE_KEY, seed);
  }
  return seed;
};

/** Revoke: สร้าง seed ใหม่ -> URL ใหม่ -> URL เก่า invalid ทันที */
export const revokeSeed = () => {
  const newSeed = generateSeed();
  localStorage.setItem(SEED_STORAGE_KEY, newSeed);
  return newSeed;
};

/** Simple non-cryptographic hash (djb2 variant) */
const simpleHash = (str) => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).padStart(7, '0');
};

/** สร้าง daily token จาก shopId + วันที่วันนี้ + seed */
export const generateDailyToken = (shopId, seed) => {
  const dateStr = new Date().toISOString().split('T')[0];
  return simpleHash(`${shopId}:${dateStr}:${seed}`);
};

/**
 * Validate token โดยใช้ seed จาก URL params (cross-device safe)
 * ไม่อ่าน localStorage เลย -- ทำงานได้บน device ใดก็ได้
 */
export const validateTokenWithSeed = (shopId, token, seed) => {
  if (!shopId || !token || !seed) return false;
  const dateStr = new Date().toISOString().split('T')[0];
  const expected = simpleHash(`${shopId}:${dateStr}:${seed}`);
  return token === expected;
};

/**
 * สร้าง URL เต็มสำหรับ QR Code -- ฝัง seed ใน &s= เพื่อให้ validate ได้ทุก device
 * รูปแบบ: /lab-station?shop_id=xxx&token=yyy&s=seed&n=ชื่อร้าน
 */
export const buildLabUrl = (shopId, token, seed, shopName = '') => {
  const base = window.location.origin;
  let url = `${base}/lab-station?shop_id=${encodeURIComponent(shopId)}&token=${encodeURIComponent(token)}&s=${encodeURIComponent(seed)}`;
  if (shopName) url += `&n=${encodeURIComponent(shopName)}`;
  return url;
};

/** คีย์สำหรับเก็บข้อมูลผู้ตรวจประจำวันใน localStorage */
export const getInspectorStorageKey = () => {
  const dateStr = new Date().toISOString().split('T')[0];
  return `farmpro_lab_inspector_${dateStr}`;
};

/** โหลดข้อมูลผู้ตรวจวันนี้ (null ถ้ายังไม่ได้กรอก) */
export const loadTodayInspector = () => {
  try {
    const raw = localStorage.getItem(getInspectorStorageKey());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** บันทึกข้อมูลผู้ตรวจวันนี้ */
export const saveTodayInspector = (name, phone) => {
  const data = { name: name.trim(), phone: phone.trim() };
  localStorage.setItem(getInspectorStorageKey(), JSON.stringify(data));
  return data;
};
