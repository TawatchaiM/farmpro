import React, { useState } from 'react';
import { Leaf, Lock, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { db } from '../supabase';

function UpdatePasswordForm({ onUpdateSuccess }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setErrorMsg('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await db.updateUserPassword(password);
      if (res.success) {
        setSuccessMsg('เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
        setTimeout(() => {
          if (onUpdateSuccess) onUpdateSuccess();
        }, 2000);
      } else {
        setErrorMsg(res.error || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
      }
    } catch (err) {
      setErrorMsg('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
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
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      overflowY: 'auto',
      padding: '2rem 1rem',
      boxSizing: 'border-box'
    }}>
      <div className="onboarding-card" style={{
        background: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '480px',
        padding: '2.5rem 2rem',
        color: '#f8fafc',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        boxSizing: 'border-box'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
            <Leaf color="#4ade80" size={40} style={{ transform: 'rotate(-15deg)', flexShrink: 0 }} />
            <span style={{ fontWeight: 'bold' }}>FarmPro</span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0.5rem 0 0.25rem 0' }}>🔒 ตั้งรหัสผ่านใหม่</h2>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>กรุณากำหนดรหัสผ่านใหม่เพื่อเข้าใช้งานบัญชีของคุณ</p>
        </div>

        {errorMsg && (
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

        {successMsg && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid #22c55e',
            color: '#4ade80',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            textAlign: 'center'
          }}>
            ✅ {successMsg}
          </div>
        )}

        {!successMsg && (
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.875rem', fontWeight: '500' }}>
                รหัสผ่านใหม่ <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
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
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.75rem' }}>
              <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.875rem', fontWeight: '500' }}>
                ยืนยันรหัสผ่านใหม่ <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
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
                <CheckCircle size={18} color="#94a3b8" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="onboarding-btn-primary"
              style={{ width: '100%', padding: '0.9rem', fontSize: '1.05rem' }}
            >
              {loading ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'บันทึกรหัสผ่านใหม่'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default UpdatePasswordForm;
