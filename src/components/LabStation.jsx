import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../supabase';
import {
  validateTokenWithSeed,
  loadTodayInspector,
  saveTodayInspector
} from '../utils/labToken';
import DrcPortal from './DrcPortal';

/**
 * LabStation — หน้าห้องตรวจ DRC สำหรับพนักงานแล็บที่สแกน QR Code เข้ามา
 * - ไม่ต้องสมัครสมาชิก
 * - แสดงเฉพาะฟังก์ชัน DRC เท่านั้น (ซ่อนข้อมูลการเงิน)
 * - Token หมดอายุเองเมื่อถึงวันถัดไป
 */
function LabStation() {
  const params = new URLSearchParams(window.location.search);
  const shopId = params.get('shop_id') || '';
  const token  = params.get('token')   || '';
  const seed   = params.get('s')       || ''; // seed ฝังมาใน URL ตอนสร้าง QR

  const [tokenValid, setTokenValid] = useState(null); // null=loading, true, false
  const [inspector, setInspector] = useState(null); // { name, phone }
  const [showModal, setShowModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [modalError, setModalError] = useState('');

  const [dailySettings, setDailySettings] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Validate token (sync, URL-based -- works on every device)
  useEffect(() => {
    // validateTokenWithSeed: hash(shopId + today + seed) === token
    // seed มาจาก URL param &s= ที่ถูกฝังตอนสร้าง QR Code
    const isValid = validateTokenWithSeed(shopId, token, seed);
    setTokenValid(isValid);

    if (isValid) {
      const saved = loadTodayInspector();
      if (saved && saved.name) {
        setInspector(saved);
      } else {
        setShowModal(true);
      }
    } else {
      setLoadingData(false);
    }
  }, [shopId, token, seed]);

  // 2. Load DRC data when token valid
  const loadData = useCallback(async () => {
    if (!tokenValid) return;
    setLoadingData(true);
    try {
      const [settings, txList] = await Promise.all([
        db.getDailySettings(todayStr),
        db.getTransactions(todayStr)
      ]);
      setDailySettings(settings);
      setTransactions(Array.isArray(txList) ? txList : []);
    } catch (err) {
      console.error('[LabStation] Failed to load data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [tokenValid, todayStr]);

  useEffect(() => {
    if (tokenValid === true) loadData();
  }, [tokenValid, loadData]);

  // 3. Realtime subscription
  useEffect(() => {
    if (!tokenValid) return;
    const unsubscribe = db.subscribeToTransactions(async () => {
      const txList = await db.getTransactions(todayStr);
      setTransactions(Array.isArray(txList) ? txList : []);
    });
    return () => unsubscribe();
  }, [tokenValid, todayStr]);

  // 4. Update transaction handler (restricted — lab only)
  const handleUpdateTransaction = useCallback(async (id, updates) => {
    const isOffline = !window.navigator.onLine;
    // Inject inspector info into every update from lab
    const enrichedUpdates = {
      ...updates,
      ...(inspector ? {
        tested_by_name: inspector.name,
        tested_by_phone: inspector.phone,
      } : {})
    };
    const updated = await db.updateTransaction(id, enrichedUpdates, isOffline);
    const txList = await db.getTransactions(todayStr);
    setTransactions(Array.isArray(txList) ? txList : []);
    return updated;
  }, [todayStr, inspector]);

  // 5. Inspector modal submit
  const handleInspectorSubmit = (e) => {
    e.preventDefault();
    setModalError('');
    if (!nameInput.trim()) { setModalError('กรุณากรอกชื่อผู้ตรวจ'); return; }
    if (!phoneInput.trim() || phoneInput.replace(/\D/g, '').length < 9) {
      setModalError('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (อย่างน้อย 9 หลัก)');
      return;
    }
    const saved = saveTodayInspector(nameInput, phoneInput);
    setInspector(saved);
    setShowModal(false);
  };

  // --- Render: Token Invalid ---
  if (tokenValid === false) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 10% 20%, #1a1a2e 0%, #16213e 90%)',
        color: '#fff',
        padding: '2rem',
        fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚫</div>
        <h1 style={{ color: '#f87171', fontSize: '1.5rem', marginBottom: '0.75rem' }}>
          QR Code ไม่ถูกต้องหรือหมดอายุ
        </h1>
        <p style={{ color: '#94a3b8', maxWidth: '360px', lineHeight: '1.6' }}>
          QR Code นี้อาจหมดอายุ (ใช้ได้แค่วันละ 1 ครั้ง) หรือถูกเพิกถอนสิทธิ์โดยเจ้าของร้านแล้ว
        </p>
        <p style={{ color: '#64748b', marginTop: '1.5rem', fontSize: '0.85rem' }}>
          กรุณาขอ QR Code ใหม่จากเจ้าของลานรับซื้อยาง
        </p>
      </div>
    );
  }

  // --- Render: Loading token check ---
  if (tokenValid === null) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at 10% 20%, #1a4d2e 0%, #0c2415 90%)', color: '#fff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '44px', height: '44px', border: '4px solid rgba(255,255,255,0.2)',
            borderTopColor: '#4ade80', borderRadius: '50%', animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <div style={{ color: '#94a3b8' }}>กำลังตรวจสอบสิทธิ์การเข้าถึง...</div>
        </div>
      </div>
    );
  }

  // --- Render: Inspector Registration Modal ---
  const InspectorModal = () => (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '2rem',
        width: '100%', maxWidth: '420px', boxShadow: '0 25px 60px rgba(0,0,0,0.4)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔬</div>
          <h2 style={{ color: '#0f172a', fontSize: '1.25rem', margin: 0 }}>
            ลงชื่อเข้าห้องตรวจ DRC
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            กรอกข้อมูลผู้ตรวจครั้งเดียว ระบบจะจดจำตลอดวัน
          </p>
        </div>
        <form onSubmit={handleInspectorSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.4rem', fontSize: '0.875rem' }}>
              ชื่อผู้ตรวจ DRC <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="เช่น นายสมชาย ตรวจยาง"
              autoFocus
              style={{
                width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
                border: '2px solid #e2e8f0', fontSize: '1rem', boxSizing: 'border-box',
                outline: 'none', transition: 'border-color 0.2s',
                fontFamily: "'Inter', 'Noto Sans Thai', sans-serif"
              }}
              onFocus={e => e.target.style.borderColor = '#16a34a'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.4rem', fontSize: '0.875rem' }}>
              เบอร์โทรศัพท์ <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="tel"
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value)}
              placeholder="เช่น 0812345678"
              style={{
                width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
                border: '2px solid #e2e8f0', fontSize: '1rem', boxSizing: 'border-box',
                outline: 'none', transition: 'border-color 0.2s',
                fontFamily: "'Inter', 'Noto Sans Thai', sans-serif"
              }}
              onFocus={e => e.target.style.borderColor = '#16a34a'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
          {modalError && (
            <div style={{
              background: '#fef2f2', color: '#dc2626', padding: '0.6rem 0.85rem',
              borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1rem', border: '1px solid #fecaca'
            }}>
              ⚠️ {modalError}
            </div>
          )}
          <button
            type="submit"
            style={{
              width: '100%', padding: '0.85rem', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff',
              fontSize: '1rem', fontWeight: '700', cursor: 'pointer',
              fontFamily: "'Inter', 'Noto Sans Thai', sans-serif"
            }}
          >
            🔬 เข้าสู่ห้องตรวจ DRC
          </button>
        </form>
      </div>
    </div>
  );

  // --- Render: Main Lab Station ---
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: "'Inter', 'Noto Sans Thai', sans-serif"
    }}>
      {/* Inspector Modal */}
      {showModal && <InspectorModal />}

      {/* Header Bar */}
      <div style={{
        background: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
        color: '#fff',
        padding: '0.85rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🔬</span>
          <div>
            <div style={{ fontWeight: '800', fontSize: '1rem', letterSpacing: '-0.01em' }}>
              ห้องตรวจ DRC (แล็บ)
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', marginTop: '1px' }}>
              FarmPro · ระบบจัดการลานรับซื้อยาง
            </div>
          </div>
        </div>
        {inspector && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(255,255,255,0.15)', borderRadius: '20px',
            padding: '0.35rem 0.75rem', fontSize: '0.8rem'
          }}>
            <span>👤</span>
            <div>
              <div style={{ fontWeight: '700', lineHeight: '1.2' }}>{inspector.name}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{inspector.phone}</div>
            </div>
            <button
              onClick={() => { setShowModal(true); setNameInput(inspector.name); setPhoneInput(inspector.phone); }}
              style={{
                background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer', fontSize: '0.75rem', padding: '0 0.25rem'
              }}
              title="แก้ไขข้อมูลผู้ตรวจ"
            >
              ✏️
            </button>
          </div>
        )}
      </div>

      {/* Date badge */}
      <div style={{
        background: '#f0fdf4', borderBottom: '1px solid #bbf7d0',
        padding: '0.4rem 1.25rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: '0.8rem', color: '#166534'
      }}>
        <span>📅 วันที่: {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          Real-time Sync
        </span>
        <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      </div>

      {/* DRC Portal Content */}
      <div style={{ padding: '1rem', maxWidth: '1100px', margin: '0 auto' }}>
        {loadingData ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', color: '#94a3b8' }}>
            <div style={{
              width: '32px', height: '32px', border: '3px solid #e2e8f0',
              borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '1rem'
            }} />
            กำลังโหลดคิวตรวจ DRC...
          </div>
        ) : (
          <DrcPortal
            currentUser={null}
            dailySettings={dailySettings}
            transactions={transactions}
            onUpdateTransaction={handleUpdateTransaction}
            labInspector={inspector}
          />
        )}
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.75rem',
        borderTop: '1px solid #e2e8f0', marginTop: '2rem'
      }}>
        🔒 โหมดจำกัดสิทธิ์ (Lab Only) · FarmPro v2.0
      </div>
    </div>
  );
}

export default LabStation;
