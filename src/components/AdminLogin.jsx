import React, { useState, useEffect } from 'react';
import { supabase, db, sanitizeProfile } from '../supabase';
import { Eye, EyeOff, Lock } from 'lucide-react';

export const AdminLogin = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  
  // Check if we are in "Update Password" mode (from email link)
  const isUpdatePasswordMode = window.location.pathname === '/admin/reset-password';
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    // If we land on /admin/reset-password, check if session exists (Supabase auto-logs in via URL hash)
    if (isUpdatePasswordMode) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          setMessage({ type: 'error', text: 'ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว กรุณารีเซ็ตรหัสผ่านใหม่อีกครั้ง' });
        }
      });
    }
  }, [isUpdatePasswordMode]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // ดึงข้อมูล Role จาก Profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Failed to fetch profile:', profileError);
      }

      if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'BASIC_ADMIN' || profile?.role === 'ADMIN') {
        setMessage({ type: 'success', text: 'เข้าสู่ระบบสำเร็จ กำลังนำคุณไปยังคอนโซลผู้ดูแล...' });
        
        // redirect to admin dashboard
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      } else {
        await supabase.auth.signOut();
        setMessage({ type: 'error', text: 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบผู้ดูแล' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setMessage({ type: 'error', text: 'กรุณากรอกอีเมลที่ต้องการรีเซ็ตรหัสผ่าน' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'ระบบได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบกล่องข้อความ (Inbox/Spam)',
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการส่งอีเมล' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setMessage({ type: 'error', text: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาล็อกอินด้วยรหัสผ่านใหม่',
      });
      
      setTimeout(() => {
        window.location.href = '/admin';
      }, 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'ไม่สามารถตั้งรหัสผ่านใหม่ได้' });
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
    if (isUpdatePasswordMode) {
      return (
        <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '1rem', marginBottom: '0.5rem', fontWeight: '600' }}>รหัสผ่านใหม่</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="login-input admin-login-input"
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="login-btn-primary"
            style={{ marginTop: '0.5rem' }}
          >
            {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
          </button>
        </form>
      );
    }

    if (isResetMode) {
      return (
        <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '1rem', marginBottom: '0.5rem', fontWeight: '600' }}>อีเมลแอดมิน</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@farmpro.com"
              required
              className="login-input admin-login-input"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="login-btn-primary"
            style={{ marginTop: '0.5rem' }}
          >
            {loading ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
          </button>
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => { setIsResetMode(false); setMessage(null); }}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}
            >
              กลับไปหน้าเข้าสู่ระบบ
            </button>
          </div>
        </form>
      );
    }

    return (
      <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: '1rem', marginBottom: '0.5rem', fontWeight: '600' }}>อีเมลผู้ดูแลระบบ</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@farmpro.com"
            required
            className="login-input admin-login-input"
          />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <label style={{ color: '#94a3b8', fontSize: '1rem', fontWeight: '600' }}>รหัสผ่าน</label>
            <button
              type="button"
              onClick={() => { setIsResetMode(true); setMessage(null); }}
              style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '0.9rem', cursor: 'pointer' }}
            >
              ลืมรหัสผ่าน?
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="login-input admin-login-input"
              style={{ paddingRight: '3rem' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="login-btn-primary"
          style={{ marginTop: '0.5rem' }}
        >
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={() => window.location.href = '/'}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.95rem' }}
          >
            &larr; กลับไปหน้าระบบหลัก
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="login-overlay" style={{ backgroundColor: '#0f172a', background: 'none' }}>
      <div className="login-card admin-login-card">
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '9999px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34d399', marginBottom: '0.75rem' }}>
            <Lock size={32} />
          </div>
          <h2 className="login-title" style={{ color: 'white' }}>FarmPro Admin Console</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            {isUpdatePasswordMode ? 'ตั้งรหัสผ่านใหม่' : (isResetMode ? 'รีเซ็ตรหัสผ่านผ่านอีเมล' : 'เข้าสู่ระบบผู้ดูแลระบบ')}
          </p>
        </div>

        {/* Message Box */}
        {message && (
          <div style={{ 
            padding: '1rem', 
            borderRadius: '0.75rem', 
            marginBottom: '1.5rem', 
            backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: message.type === 'success' ? '#34d399' : '#f87171',
            fontSize: '0.95rem',
            textAlign: 'center'
          }}>
            {message.text}
          </div>
        )}

        {/* Dynamic Form */}
        {renderForm()}
        
      </div>
    </div>
  );
};

export default AdminLogin;
