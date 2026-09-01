import React, { useState } from 'react';
import { Leaf, Lock, Phone, Eye, EyeOff, LogIn, Mail, Key, PhoneCall, ChevronLeft } from 'lucide-react';
import { db, sanitizeProfile } from '../supabase';

function LoginForm({ onLoginSuccess, onSwitchToRegister, onGoHome }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // PDPA States
  const [showPdpaModal, setShowPdpaModal] = useState(false);
  const [pdpaAccepted, setPdpaAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  // Forgot Password States
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [emailForReset, setEmailForReset] = useState('');
  const [resetStatus, setResetStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [resetMsg, setResetMsg] = useState('');
  const [recoveryStep, setRecoveryStep] = useState('select_option'); // 'select_option', 'email', 'pin', 'admin'
  const [recoveryPin, setRecoveryPin] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMsg('กรุณากรอกเบอร์โทรศัพท์ และรหัสผ่าน');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await db.signIn({ identifier, password });
      if (res.success) {
        if (onLoginSuccess) {
          onLoginSuccess(res.session, res.profile);
        }
      } else {
        const isOffline = !window.navigator.onLine;
        if (isOffline) {
          setErrorMsg('ขณะนี้อุปกรณ์ออฟไลน์อยู่ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        } else if (res.error && (res.error.includes('fetch') || res.error.includes('network') || res.error.includes('connection'))) {
          setErrorMsg('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
        } else {
          setErrorMsg(res.error || 'ระบบเข้าสู่ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      const isOffline = !window.navigator.onLine;
      if (isOffline || err?.message?.toLowerCase().includes('fetch') || err?.message?.toLowerCase().includes('network')) {
        setErrorMsg('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
      } else {
        setErrorMsg('ระบบเข้าสู่ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!emailForReset.trim()) {
      setResetStatus('error');
      setResetMsg('กรุณากรอกอีเมลที่ใช้สมัครบัญชี');
      return;
    }

    setResetStatus('loading');
    setResetMsg('');

    try {
      const res = await db.resetPassword(emailForReset.trim());
      if (res.success) {
        setResetStatus('success');
        setResetMsg('ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว (กรุณาตรวจสอบกล่องจดหมาย หรือ Junk Mail)');
      } else {
        setResetStatus('error');
        setResetMsg(res.error || 'เกิดข้อผิดพลาดในการส่งอีเมลรีเซ็ตรหัสผ่าน');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setResetStatus('error');
      setResetMsg('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handlePinRecovery = async (e) => {
    e.preventDefault();
    if (recoveryPin.length !== 6) {
      setResetStatus('error');
      setResetMsg('กรุณากรอก PIN ให้ครบ 6 หลัก');
      return;
    }
    if (newPassword.length < 6) {
      setResetStatus('error');
      setResetMsg('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    setResetStatus('loading');
    setResetMsg('');
    
    // Mock PIN verification and password update
    setTimeout(() => {
      setResetStatus('success');
      setResetMsg('รีเซ็ตรหัสผ่านด้วย PIN สำเร็จแล้ว! กรุณากลับไปหน้าเข้าสู่ระบบเพื่อใช้งาน');
    }, 1200);
  };
  return (
    <div className="login-overlay">
      <div className="login-card">
        {/* Home Button */}
        {onGoHome && (
          <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem' }}>
            <button
              type="button"
              onClick={onGoHome}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#f8fafc',
                padding: '0.45rem 1rem',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500'
              }}
            >
              🏠 หน้าหลัก
            </button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
            <Leaf color="#4ade80" size={38} style={{ transform: 'rotate(-15deg)', flexShrink: 0 }} />
            <span className="login-title">FarmPro</span>
          </div>
          <h2 className="login-title" style={{ color: '#f8fafc' }}>
            {isForgotPassword ? '🔑 ลืมรหัสผ่าน' : '🔐 เข้าสู่ระบบ'}
          </h2>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>
            {isForgotPassword
              ? recoveryStep === 'select_option' ? 'เลือกวิธีการกู้คืนรหัสผ่านของคุณ' :
                recoveryStep === 'email' ? 'กรอกอีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน' :
                recoveryStep === 'pin' ? 'กรอก PIN กู้คืน 6 หลัก เพื่อตั้งรหัสผ่านใหม่' :
                'ติดต่อผู้ดูแลระบบเพื่อยืนยันตัวตน'
              : 'เข้าใช้งานระบบด้วยเบอร์โทรศัพท์และรหัสผ่าน'}
          </p>
        </div>

        {/* Error Message */}
        {errorMsg && !isForgotPassword && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            padding: '0.85rem 1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            textAlign: 'center'
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {isForgotPassword ? (
          /* ---- Forgot Password Form (Multi-Option) ---- */
          <div>
            {resetMsg && (
              <div style={{
                background: resetStatus === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: resetStatus === 'success' ? '1px solid #22c55e' : '1px solid #ef4444',
                color: resetStatus === 'success' ? '#4ade80' : '#fca5a5',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                fontSize: '0.9rem',
                textAlign: 'center'
              }}>
                {resetStatus === 'success' ? '✅' : '⚠️'} {resetMsg}
              </div>
            )}

            {recoveryStep === 'select_option' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <button
                  type="button"
                  onClick={() => { setRecoveryStep('email'); setResetMsg(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#f8fafc', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                >
                  <div style={{ background: '#3b82f6', padding: '0.6rem', borderRadius: '50%' }}><Mail size={24} color="#fff" /></div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '1.05rem', marginBottom: '0.2rem' }}>📧 กู้คืนผ่านอีเมล</div>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>ส่งลิงก์รีเซ็ตรหัสผ่านเข้าอีเมลที่ผูกไว้</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setRecoveryStep('pin'); setResetMsg(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#f8fafc', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                >
                  <div style={{ background: '#f59e0b', padding: '0.6rem', borderRadius: '50%' }}><Key size={24} color="#fff" /></div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '1.05rem', marginBottom: '0.2rem' }}>🔑 กู้คืนด้วย PIN / คำถามกันลืม</div>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>กรอก PIN 6 หลักเพื่อตั้งรหัสผ่านใหม่ได้ทันที</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setRecoveryStep('admin'); setResetMsg(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#f8fafc', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                >
                  <div style={{ background: '#ef4444', padding: '0.6rem', borderRadius: '50%' }}><PhoneCall size={24} color="#fff" /></div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '1.05rem', marginBottom: '0.2rem' }}>📞 ติดต่อผู้ดูแลระบบ</div>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>หากจำข้อมูลไม่ได้ โปรดติดต่อ Support Center</div>
                  </div>
                </button>
              </div>
            )}

            {recoveryStep === 'email' && (
              <form onSubmit={handleResetPassword}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ color: '#cbd5e1', marginBottom: '0.5rem', display: 'block', fontSize: '1rem', fontWeight: '600' }}>
                    อีเมล (Email) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={emailForReset}
                    onChange={(e) => setEmailForReset(e.target.value)}
                    placeholder="ตัวอย่าง: yourname@email.com"
                    required
                    className="login-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetStatus === 'loading'}
                  className="login-btn-primary"
                  style={{ marginBottom: '1rem' }}
                >
                  {resetStatus === 'loading' ? 'กำลังส่งข้อมูล...' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
                </button>
              </form>
            )}

            {recoveryStep === 'pin' && (
              <form onSubmit={handlePinRecovery}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ color: '#cbd5e1', marginBottom: '0.5rem', display: 'block', fontSize: '1rem', fontWeight: '600' }}>
                    PIN กู้คืน (6 หลัก) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={recoveryPin}
                    onChange={(e) => setRecoveryPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="XXXXXX"
                    required
                    className="login-input"
                    style={{ letterSpacing: '0.5rem', textAlign: 'center', fontSize: '1.25rem' }}
                  />
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ color: '#cbd5e1', marginBottom: '0.5rem', display: 'block', fontSize: '1rem', fontWeight: '600' }}>
                    ตั้งรหัสผ่านใหม่ <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="รหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร"
                    required
                    className="login-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetStatus === 'loading'}
                  className="login-btn-primary"
                  style={{ marginBottom: '1rem' }}
                >
                  {resetStatus === 'loading' ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
                </button>
              </form>
            )}

            {recoveryStep === 'admin' && (
              <div style={{ marginBottom: '1.5rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
                <p style={{ color: '#f8fafc', fontSize: '1rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                  หากคุณลืมทั้งรหัสผ่าน อีเมล และ PIN กู้คืน <br/>
                  กรุณาติดต่อผู้ดูแลระบบ FarmPro เพื่อยืนยันตัวตนและขอรีเซ็ตรหัสผ่านใหม่
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      const lineId = localStorage.getItem('farmpro_support_line_id') || '@farmpro';
                      window.open(`https://line.me/R/ti/p/${lineId}`, '_blank');
                    }} 
                    style={{ padding: '0.85rem', background: '#06c755', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}
                  >
                    💬 ติดต่อผ่าน LINE Official
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      const phone = localStorage.getItem('farmpro_support_phone') || '02-123-4567';
                      window.location.href = `tel:${phone.replace(/\D/g, '')}`;
                    }} 
                    style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.1)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}
                  >
                    📞 โทรศัพท์ติดต่อศูนย์ช่วยเหลือ
                  </button>
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              {recoveryStep !== 'select_option' && (
                <button
                  type="button"
                  onClick={() => { setRecoveryStep('select_option'); setResetMsg(''); setResetStatus('idle'); }}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <ChevronLeft size={16} /> กลับไปเลือกวิธี
                </button>
              )}
              <button
                type="button"
                onClick={() => { setIsForgotPassword(false); setRecoveryStep('select_option'); setResetMsg(''); setResetStatus('idle'); }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                กลับไปหน้าเข้าสู่ระบบ
              </button>
            </div>
          </div>
        ) : (
          /* ---- Login Form ---- */
          <form onSubmit={handleSubmit}>
            {/* Phone */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ color: '#cbd5e1', marginBottom: '0.5rem', display: 'block', fontSize: '1rem', fontWeight: '600' }}>
                เบอร์โทรศัพท์ (10 หลัก) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="ตัวอย่าง: 0812345678"
                  required
                  className="login-input"
                  style={{ paddingLeft: '3rem' }}
                />
                <Phone size={20} color="#94a3b8" style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{ color: '#cbd5e1', marginBottom: '0.5rem', display: 'block', fontSize: '1rem', fontWeight: '600' }}>
                รหัสผ่าน (Password) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านของคุณ"
                  required
                  className="login-input"
                  style={{ paddingRight: '3rem', paddingLeft: '3rem' }}
                />
                <Lock size={20} color="#94a3b8" style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center'
                  }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="login-btn-primary"
              style={{ marginBottom: '1.25rem' }}
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'} {!loading && <LogIn size={20} />}
            </button>

            <div style={{ textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setIsForgotPassword(true)}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', cursor: 'pointer', padding: 0 }}
              >
                ลืมรหัสผ่าน?
              </button>
            </div>
          </form>
        )}

        {/* Register Link */}
        {onSwitchToRegister && (
          <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.95rem', color: '#94a3b8' }}>
            ยังไม่มีบัญชีใช้งาน?{' '}
            <button
              type="button"
              onClick={() => setShowPdpaModal(true)}
              style={{ background: 'none', border: 'none', color: '#4ade80', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '0.95rem' }}
            >
              ลงทะเบียนใหม่ที่นี่ (ฟรี 100%)
            </button>
          </div>
        )}

        {/* Admin Link */}
        <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => window.location.href = '/admin'}
            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Lock size={14} /> สำหรับผู้ดูแลระบบ (Admin)
          </button>
        </div>
      </div>

      {/* PDPA & Terms Modal */}
      {showPdpaModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: '#fff', borderRadius: '24px', padding: '2rem',
            width: '100%', maxWidth: '600px', maxHeight: '90vh',
            boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
            position: 'relative', display: 'flex', flexDirection: 'column'
          }}>
            <button
              onClick={() => setShowPdpaModal(false)}
              style={{
                position: 'absolute', top: '1rem', right: '1rem',
                background: '#f1f5f9', border: 'none', borderRadius: '50%',
                width: '32px', height: '32px', cursor: 'pointer', fontSize: '1rem', color: '#64748b'
              }}
            >✕</button>

            <h2 style={{ color: '#14532d', fontSize: '1.4rem', margin: '0 0 1rem', textAlign: 'center' }}>
              📜 ข้อกำหนดและประกาศความเป็นส่วนตัว
            </h2>

            {/* Scrollable Terms Content */}
            <div style={{
              flex: 1, overflowY: 'auto', background: '#f8fafc',
              border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem',
              fontSize: '0.85rem', color: '#334155', lineHeight: '1.6', marginBottom: '1.5rem'
            }}>
              <p style={{ fontWeight: 'bold' }}>ข้อกำหนดการใช้บริการและประกาศความเป็นส่วนตัว FarmPro (Terms of Service & Privacy Notice)</p>
              <p>วันที่มีผลบังคับใช้: 26 สิงหาคม 2569</p>
              <p>ยินดีต้อนรับสู่แพลตฟอร์ม FarmPro แพลตฟอร์มบริหารจัดการลานรับซื้อน้ำยาง (ผู้ซื้อ) แปลงสวน (ผู้ขาย/ผู้กรีด) การคำนวณสัดส่วนผลผลิต และร้านค้า/บริการทางการเกษตร กรุณาอ่านและทำความเข้าใจข้อกำหนดนี้ก่อนลงทะเบียนใช้งาน</p>
              
              <ol style={{ paddingLeft: '1.2rem', marginBottom: '1rem' }}>
                <li style={{ marginBottom: '0.75rem' }}><strong>ขอบเขตและลักษณะของบริการ และข้อจำกัดความรับผิดชอบ (Service Scope & Disclaimer)</strong>
                  <ul style={{ paddingLeft: '1.2rem', marginTop: '0.5rem' }}>
                    <li><strong>ไม่ใช่สถาบันการเงินหรือตัวแทนซื้อขาย:</strong> FarmPro เป็นเพียงระบบดิจิทัลและเครื่องมืออำนวยความสะดวกในการบันทึกข้อมูลผลผลิต คำนวณสัดส่วนรายรับเบื้องต้น จัดการสถานะแปลงสวน และเชื่อมโยงร้านค้า/บริการทางการเกษตรเท่านั้น มิได้เป็นผู้ให้บริการทางการเงิน ธนาคาร หรือสถาบันรับฝาก/โอนเงินใดๆ ทั้งสิ้น</li>
                    <li><strong>หน้าที่ตรวจสอบข้อมูลของผู้ใช้บริการ:</strong> ผู้ใช้บริการ (ผู้ซื้อ, เจ้าของสวน, ผู้รับจ้างกรีด, ร้านค้าและบริการ) มีหน้าที่ต้องตรวจสอบ สอบทาน และยืนยันความถูกต้องของน้ำหนักยาง, เปอร์เซ็นต์ DRC, ราคารับซื้อ, สัดส่วนแบ่ง, รายการสินค้า/บริการ และยอดเงินทุกครั้งก่อนกดยืนยันบันทึกหรือรับ-จ่ายเงิน</li>
                    <li><strong>การจำกัดความรับผิดชอบสูงสุด:</strong> ผู้พัฒนาและเจ้าของแพลตฟอร์ม FarmPro ขอปฏิเสธความรับผิดชอบต่อความสูญเสีย ความเสียหาย การฉ้อโกง ความคลาดเคลื่อนของตัวเลข หรือข้อพิพาททางการเงินและธุรกรรมใดๆ ที่เกิดขึ้นระหว่างคู่ค้า คู่สัญญา เจ้าของสวน คนรับจ้างกรีด และร้านค้า/ผู้ให้บริการในทุกกรณี</li>
                  </ul>
                </li>
                <li style={{ marginBottom: '0.75rem' }}><strong>ข้อมูลส่วนบุคคล วัตถุประสงค์ และการใช้ข้อมูลเชิงสถิติ (Data Privacy & Analytics)</strong>
                  <ul style={{ paddingLeft: '1.2rem', marginTop: '0.5rem' }}>
                    <li><strong>ข้อมูลที่เก็บรวบรวม:</strong> ชื่อ-นามสกุล, หมายเลขโทรศัพท์, อีเมล, พิกัด/ข้อมูลแปลงสวน, ข้อมูลร้านค้า, บันทึกประวัติการชั่งน้ำหนักและผลตรวจ DRC, ประวัติธุรกรรม และข้อมูลทางเทคนิค (Log)</li>
                    <li><strong>วัตถุประสงค์หลัก:</strong> เพื่อใช้ในการยืนยันตัวตน, จัดการสิทธิ์การเข้าใช้งาน (เช่น Daily Station QR/PIN), เชื่อมโยงประวัติบิลการซื้อขาย, จัดการบริการทางการเกษตร และแสดงผลแดชบอร์ดสรุปรายรับส่วนบุคคล</li>
                    <li><strong>การประมวลผลข้อมูลนิรนามและสถิติภาพรวม (Aggregated & Market Intelligence):</strong> ผู้ใช้บริการรับทราบและยินยอมให้ FarmPro นำข้อมูลผลผลิต ค่าเฉลี่ย %DRC ปริมาณน้ำยาง และแนวโน้มตามช่วงเวลา/พื้นที่ ไปประมวลผลเป็นข้อมูลสถิติแบบรวมและข้อมูลนิรนาม (Anonymized Data) ที่ไม่สามารถระบุตัวตนของท่านหรือพิกัดแปลงเฉพาะเจาะจงได้ เพื่อใช้ในการวิเคราะห์เชิงสถิติ พัฒนาระบบ หรือร่วมมือกับพันธมิตรผู้ผลิต/จำหน่ายปัจจัยการผลิตทางการเกษตร (เช่น ปุ๋ย ยา เครื่องมือ บริการทางการเกษตร) ในการนำเสนอผลิตภัณฑ์และบริการที่ตรงกับความต้องการของพื้นที่</li>
                  </ul>
                </li>
                <li style={{ marginBottom: '0.75rem' }}><strong>คำรับรองของผู้ใช้บริการเกี่ยวกับข้อมูลบุคคลภายนอก (Third-Party Data)</strong>
                  <ul style={{ paddingLeft: '1.2rem', marginTop: '0.5rem' }}>
                    <li>กรณีที่ผู้ใช้บริการมีการป้อนหรืออัปโหลดข้อมูลส่วนบุคคลของบุคคลอื่นเข้าสู่ระบบ (เช่น เจ้าของสวนระบุชื่อ/เบอร์คนกรีด หรือลานยางบันทึกเบอร์โทรเจ้าของสวน) ผู้ใช้บริการรับรองว่าตนมีสิทธิ อำนาจ หรือได้รับความยินยอมโดยชอบด้วยกฎหมายในการนำข้อมูลดังกล่าวเข้าสู่บริการ</li>
                  </ul>
                </li>
                <li><strong>สิทธิของเจ้าของข้อมูลและระยะเวลาจัดเก็บ (Data Retention & Rights)</strong>
                  <ul style={{ paddingLeft: '1.2rem', marginTop: '0.5rem' }}>
                    <li>ข้อมูลจะถูกจัดเก็บตลอดระยะเวลาที่บัญชีของท่านยังเปิดใช้งานอยู่ตามเงื่อนไขการให้บริการ</li>
                    <li>ท่านมีสิทธิตามกฎหมาย PDPA ในการขอเข้าถึง แก้ไข โอนย้าย ระงับการใช้ หรือขอลบข้อมูลส่วนบุคคลของตนเองได้ตามช่องทางที่ระบบกำหนด</li>
                  </ul>
                </li>
              </ol>
            </div>

            {/* Checkboxes */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={pdpaAccepted}
                  onChange={(e) => setPdpaAccepted(e.target.checked)}
                  style={{ marginTop: '0.2rem', width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16a34a' }}
                />
                <span style={{ fontSize: '0.9rem', color: '#1e293b', lineHeight: '1.4' }}>
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>*</span> ข้าพเจ้าได้อ่าน เข้าใจ และยอมรับข้อตกลงการให้บริการและนโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA) ทุกประการ
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  style={{ marginTop: '0.2rem', width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16a34a' }}
                />
                <span style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.4' }}>
                  (ทางเลือก) ยินยอมรับข้อมูลข่าวสาร สิทธิประโยชน์ และโปรโมชันผลิตภัณฑ์/บริการทางการเกษตรที่เหมาะสมกับพื้นที่ของท่าน
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowPdpaModal(false)}
                style={{
                  flex: 1, padding: '0.85rem', background: '#f1f5f9', color: '#64748b',
                  border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer'
                }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={!pdpaAccepted}
                onClick={() => {
                  localStorage.setItem('farmpro_pdpa_accepted', 'true');
                  localStorage.setItem('farmpro_marketing_opt_in', marketingOptIn ? 'true' : 'false');
                  setShowPdpaModal(false);
                  if (onSwitchToRegister) onSwitchToRegister();
                }}
                style={{
                  flex: 2, padding: '0.85rem', background: pdpaAccepted ? '#16a34a' : '#94a3b8', color: '#fff',
                  border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: pdpaAccepted ? 'pointer' : 'not-allowed'
                }}
              >
                ยินยอมและสมัครสมาชิก &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginForm;
