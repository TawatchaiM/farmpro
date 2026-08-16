import React, { useState } from 'react';
import { Leaf, Lock, Phone, Eye, EyeOff, LogIn } from 'lucide-react';
import { db, sanitizeProfile } from '../supabase';

function LoginForm({ onLoginSuccess, onSwitchToRegister, onGoHome }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Forgot Password States
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [emailForReset, setEmailForReset] = useState('');
  const [resetStatus, setResetStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [resetMsg, setResetMsg] = useState('');

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


  return (
    <div className="onboarding-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'radial-gradient(circle at 10% 20%, rgba(26, 77, 46, 1) 0%, rgba(12, 36, 21, 1) 90%)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 9999,
      overflowY: 'auto',
      padding: '2rem 1rem',
      boxSizing: 'border-box',
      WebkitOverflowScrolling: 'touch'
    }}>
      <div className="onboarding-card" style={{
        background: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '480px',
        margin: '2rem auto',
        padding: '2.5rem 2rem',
        color: '#f8fafc',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        boxSizing: 'border-box',
        position: 'relative'
      }}>
        {onGoHome && (
          <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem' }}>
            <button 
              type="button"
              onClick={onGoHome}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#f8fafc',
                padding: '0.4rem 0.85rem',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500'
              }}
            >
              🏠 หน้าหลัก
            </button>
          </div>
        )}

        {/* Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
            <Leaf color="#4ade80" size={40} style={{ transform: 'rotate(-15deg)', flexShrink: 0 }} />
            <span style={{ fontWeight: 'bold' }}>FarmPro</span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0.5rem 0 0.25rem 0' }}>
            {isForgotPassword ? '🔑 ลืมรหัสผ่าน' : '🔐 เข้าสู่ระบบ'}
          </h2>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>
            {isForgotPassword ? 'กรอกอีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน' : 'เข้าใช้งานระบบด้วยเบอร์โทรศัพท์และรหัสผ่าน'}
          </p>
        </div>

        {errorMsg && !isForgotPassword && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            textAlign: 'center'
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {isForgotPassword ? (
          <form onSubmit={handleResetPassword}>
            {resetMsg && (
              <div style={{
                background: resetStatus === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: resetStatus === 'success' ? '1px solid #22c55e' : '1px solid #ef4444',
                color: resetStatus === 'success' ? '#4ade80' : '#fca5a5',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                fontSize: '0.875rem',
                textAlign: 'center'
              }}>
                {resetStatus === 'success' ? '✅' : '⚠️'} {resetMsg}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.875rem', fontWeight: '500' }}>
                อีเมล (Email) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  value={emailForReset}
                  onChange={(e) => setEmailForReset(e.target.value)}
                  placeholder="ตัวอย่าง: yourname@email.com"
                  required
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    color: '#fff',
                    padding: '0.85rem 1rem',
                    borderRadius: '12px',
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={resetStatus === 'loading'}
              className="onboarding-btn-primary"
              style={{ width: '100%', padding: '0.9rem', fontSize: '1.05rem', marginBottom: '1rem' }}
            >
              {resetStatus === 'loading' ? 'กำลังส่งข้อมูล...' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setIsForgotPassword(false); setResetMsg(''); setResetStatus('idle'); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                กลับไปหน้าเข้าสู่ระบบ
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Phone Number Input */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.875rem', fontWeight: '500' }}>
              เบอร์โทรศัพท์ (10 หลัก) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="ตัวอย่าง: 0812345678"
                required
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  color: '#fff',
                  padding: '0.85rem 1rem 0.85rem 2.6rem',
                  borderRadius: '12px',
                  width: '100%',
                  boxSizing: 'border-box',
                  fontSize: '0.95rem'
                }}
              />
              <Phone size={18} color="#94a3b8" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          {/* Password Input */}
          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.875rem', fontWeight: '500' }}>
              รหัสผ่าน (Password) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านของคุณ"
                required
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  color: '#fff',
                  padding: '0.85rem 2.6rem 0.85rem 2.6rem',
                  borderRadius: '12px',
                  width: '100%',
                  boxSizing: 'border-box',
                  fontSize: '0.95rem'
                }}
              />
              <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.85rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="onboarding-btn-primary"
            style={{ width: '100%', padding: '0.9rem', fontSize: '1.05rem' }}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'} <LogIn size={20} />
          </button>

          <div style={{ marginTop: '1rem', textAlign: 'right' }}>
            <button
              type="button"
              onClick={() => setIsForgotPassword(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '0.85rem',
                cursor: 'pointer',
                padding: 0
              }}
            >
              ลืมรหัสผ่าน?
            </button>
          </div>
        </form>
        )}



        {/* Switch to Register link */}
        {onSwitchToRegister && (
          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#94a3b8' }}>
            ยังไม่มีบัญชีใช้งาน?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              style={{
                background: 'none',
                border: 'none',
                color: '#4ade80',
                fontWeight: 'bold',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0
              }}
            >
              ลงทะเบียนใหม่ที่นี่ (ฟรี 100%)
            </button>
          </div>
        )}
        
        {/* Admin Login Link */}
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => window.location.href = '/admin'}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Lock size={14} /> สำหรับผู้ดูแลระบบ (Admin)
          </button>
        </div>

      </div>
    </div>
  );
}

export default LoginForm;
