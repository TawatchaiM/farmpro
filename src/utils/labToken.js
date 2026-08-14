/**
 * Lab Station Token Utilities
 * ระบบ Token สำหรับห้องตรวจ DRC ที่ไม่ต้องสมัครสมาชิก
 *
 * กลไกความปลอดภัย:
 * - Token สร้างจาก shopId + dateStr + secretSeed (hash แบบ lightweight)
 * - Token หมดอายุเองเมื่อถึงวันถัดไป (เปรียบเทียบ dateStr)
 * - Revoke ทำได้ทันทีโดยสร้าง secretSeed ใหม่
 * - secretSeed เก็บใน localStorage ฝั่งเจ้าของร้านเท่านั้น
 */

const SEED_STORAGE_KEY = 'farmpro_lab_secret_seed';

/** สร้าง random secret seed ใหม่ (ใช้ตอน revoke) */
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

/** Revoke: สร้าง seed ใหม่ → token เก่าทั้งหมดใช้ไม่ได้ */
export const revokeSeed = () => {
  const newSeed = generateSeed();
  localStorage.setItem(SEED_STORAGE_KEY, newSeed);
  return newSeed;
};

/** Simple non-cryptographic hash (djb2 variant) - เพียงพอสำหรับ client-side token */
const simpleHash = (str) => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash |= 0; // force 32-bit int
  }
  return Math.abs(hash).toString(36).padStart(7, '0');
};

/** สร้าง daily token จาก shopId + วันที่วันนี้ + seed */
export const generateDailyToken = (shopId, seed) => {
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const payload = `${shopId}:${dateStr}:${seed}`;
  return simpleHash(payload);
};

/** Validate token: ตรวจสอบว่า token ตรงกับวันนี้และ seed ปัจจุบัน */
export const validateToken = (shopId, token) => {
  const seed = localStorage.getItem(SEED_STORAGE_KEY);
  if (!seed || !shopId || !token) return false;
  const expected = generateDailyToken(shopId, seed);
  return token === expected;
};

/** สร้าง URL เต็มสำหรับ QR Code */
export const buildLabUrl = (shopId, token) => {
  const base = window.location.origin;
  return `${base}/lab-station?shop_id=${encodeURIComponent(shopId)}&token=${encodeURIComponent(token)}`;
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
