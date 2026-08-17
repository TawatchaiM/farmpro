import React, { useState, useEffect, Component } from 'react';

// ============================================================
// Global Error Boundary — prevents blank screen from JS errors
// ============================================================
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 10% 20%, #1a4d2e 0%, #0c2415 90%)',
          color: '#fff',
          fontFamily: "'Inter', sans-serif",
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>เกิดข้อผิดพลาดในระบบ</h2>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem', maxWidth: '400px' }}>
            กรุณาลองโหลดหน้าใหม่อีกครั้ง หากยังมีปัญหา กรุณาติดต่อผู้ดูแลระบบ
          </p>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{
              background: '#22c55e',
              color: '#fff',
              border: 'none',
              padding: '0.75rem 2rem',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              marginRight: '1rem'
            }}
          >🔄 โหลดหน้าใหม่</button>
          <details style={{ marginTop: '1rem', color: '#64748b', fontSize: '0.75rem', maxWidth: '500px', wordBreak: 'break-all' }}>
            <summary style={{ cursor: 'pointer' }}>ดูรายละเอียด error</summary>
            <pre style={{ marginTop: '0.5rem', textAlign: 'left' }}>{String(this.state.error)}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
import { Leaf, Home, LogOut, User, Edit, Shield, LogIn } from 'lucide-react';
import BuyerPortal from './components/BuyerPortal';
import SellerPortal from './components/SellerPortal';
import MarketplacePortal from './components/MarketplacePortal';
import AIChat from './components/AIChat';
import AdminPortal from './components/AdminPortal';
import OnboardingRegistration from './components/OnboardingRegistration';
import LoginForm from './components/LoginForm';
import EditProfileModal from './components/EditProfileModal';
import PricingTable from './components/PricingTable';
import OfflineStatusBar from './components/OfflineStatusBar';
import AdminLogin from './components/AdminLogin';
import LabStation from './components/LabStation';
import UpdatePasswordForm from './components/UpdatePasswordForm';
import { db, supabase } from './supabase';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authSession, setAuthSession] = useState(null);
  const [authView, setAuthView] = useState('login'); // 'login' | 'register' | 'authenticated'
  const [activePortal, setActivePortal] = useState('buyer'); // buyer, seller, marketplace, ai_chat, admin, pricing
  const [isLoggedInAdmin, setIsLoggedInAdmin] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Restore authenticated session on app load (Stale-While-Revalidate pattern)
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Instant Render from Local Cache + Background Sync
        const res = await db.getProfileSWR((freshData) => {
          if (freshData && freshData.profile) {
            setCurrentUser(freshData.profile);
            setAuthSession(freshData.session);
            setAuthView('authenticated');
            
            // Sync active portal if role changes from cache to live
            const role = freshData.profile.role;
            if (role === 'vendor') setActivePortal('marketplace');
            else if (role === 'buyer' || role === 'CLERK' || role === 'DRC_LAB') setActivePortal('buyer');
            else if (role === 'seller') setActivePortal('seller');
            else if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'BASIC_ADMIN') setActivePortal('admin');
          }
        });

        if (res && res.profile) {
          setCurrentUser(res.profile);
          setAuthSession(res.session);
          setAuthView('authenticated');
          if (res.profile.role === 'vendor') {
            setActivePortal('marketplace');
          } else if (res.profile.role === 'buyer' || res.profile.role === 'CLERK' || res.profile.role === 'DRC_LAB') {
            setActivePortal('buyer');
          } else if (res.profile.role === 'seller') {
            setActivePortal('seller');
          } else if (res.profile.role === 'SUPER_ADMIN' || res.profile.role === 'ADMIN' || res.profile.role === 'BASIC_ADMIN') {
            setActivePortal('admin');
          }
        } else {
          setAuthView('login');
        }
      } catch (err) {
        console.error('Failed to init auth session:', err);
        setAuthView('login');
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for Auth State Changes (e.g. Password Recovery)
    let authSubscription;
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setAuthView('updatePassword');
        }
      });
      authSubscription = data.subscription;
    }

    return () => {
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  const handleLoginSuccess = (session, profile) => {
    setAuthSession(session);
    setCurrentUser(profile);
    setAuthView('authenticated');

    if (profile && profile.role) {
      if (profile.role === 'vendor') {
        setActivePortal('marketplace');
      } else if (profile.role === 'CLERK' || profile.role === 'DRC_LAB') {
        setActivePortal('buyer');
      } else {
        setActivePortal(profile.role);
      }
    }
  };

  const handleOnboardingComplete = (profileData, session) => {
    if (session) setAuthSession(session);
    setCurrentUser(profileData);
    setAuthView('authenticated');

    if (profileData && profileData.role) {
      if (profileData.role === 'vendor') {
        setActivePortal('marketplace');
      } else if (profileData.role === 'CLERK' || profileData.role === 'DRC_LAB') {
        setActivePortal('buyer');
      } else {
        setActivePortal(profileData.role);
      }
    }
  };

  const handlePortalSwitch = async (portal) => {
    setActivePortal(portal);
    setIsLoggedInAdmin(false);
    localStorage.setItem('farmpro_current_role', portal === 'seller' ? 'SELLER' : 'BUYER');
    const res = await db.getCurrentSession();
    if (res && res.profile) {
      setCurrentUser(res.profile);
    }
  };


  const handleLogout = async () => {
    await db.signOut();
    setCurrentUser(null);
    setAuthSession(null);
    setAuthView('login');
    setIsLoggedInAdmin(false);
    setShowEditProfile(false);
    localStorage.removeItem('farmpro_is_demo');
  };

  const toggleAdmin = () => {
    setIsLoggedInAdmin(!isLoggedInAdmin);
    if (!isLoggedInAdmin) {
      setActivePortal('admin');
    } else {
      setActivePortal(
        currentUser?.role === 'vendor' ? 'marketplace' : 
        (currentUser?.role === 'CLERK' || currentUser?.role === 'DRC_LAB' ? 'buyer' : (currentUser?.role || 'buyer'))
      );
    }
  };

  // --- Admin Route Interception ---
  const isRouteAdmin = window.location.pathname.startsWith('/admin');
  if (isRouteAdmin) {
    return <AdminLogin />;
  }
  // --- Lab Station Route Interception ---
  const isRouteLabStation = window.location.pathname.startsWith('/lab-station');
  if (isRouteLabStation) {
    return <LabStation />;
  }
  // --------------------------------

  // Render Loading Spinner while restoring session
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 10% 20%, rgba(26, 77, 46, 1) 0%, rgba(12, 36, 21, 1) 90%)',
        color: '#fff',
        fontFamily: "'Inter', sans-serif"
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          border: '4px solid rgba(255, 255, 255, 0.2)',
          borderTopColor: '#4ade80',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <div style={{ marginTop: '1.25rem', color: '#94a3b8', fontSize: '0.95rem', fontWeight: '500' }}>
          🌱 กำลังโหลดระบบ FarmPro...
        </div>
      </div>
    );
  }

  // Render Login View if not authenticated
  if (authView === 'login') {
    return (
      <LoginForm
        onLoginSuccess={handleLoginSuccess}
        onSwitchToRegister={() => setAuthView('register')}
        onGoHome={() => setAuthView('login')}
      />
    );
  }

  // Render Update Password View if requested (e.g. via reset link)
  if (authView === 'updatePassword') {
    return (
      <UpdatePasswordForm 
        onUpdateSuccess={() => setAuthView('login')} 
      />
    );
  }

  // Render Registration View if selected
  if (authView === 'register') {
    return (
      <OnboardingRegistration 
        onComplete={handleOnboardingComplete} 
        onSwitchToLogin={() => setAuthView('login')}
        onGoHome={() => setAuthView('login')}
      />
    );
  }

  const roleLabels = {
    buyer: '🏪 ร้านรับซื้อยาง',
    seller: '🧑‍🌾 ชาวสวนยาง',
    vendor: '🚜 ร้านค้า / ผู้ให้บริการ'
  };

  const storeProfileRaw = localStorage.getItem('farmpro_store_profile');
  const storeProfile = storeProfileRaw ? JSON.parse(storeProfileRaw) : null;
  const isStoreMode = activePortal === 'buyer' || activePortal === 'vendor';
  const displayStoreName = isStoreMode ? (storeProfile?.storeName || currentUser?.store_name || currentUser?.full_name) : currentUser?.full_name;
  const displayStorePhone = isStoreMode ? (storeProfile?.phone || currentUser?.store_phone || currentUser?.phone_number) : currentUser?.phone_number;

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'space-between', paddingBottom: '1rem' }}>
        <div>
          <div 
            className="sidebar-logo" 
            onClick={() => {
              if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN' || currentUser?.role === 'BASIC_ADMIN') {
                setActivePortal('admin');
              } else if (currentUser?.role === 'vendor') {
                setActivePortal('marketplace');
              } else if (currentUser?.role === 'seller') {
                setActivePortal('seller');
              } else {
                setActivePortal('buyer');
              }
            }}
            title="กลับสู่หน้าหลัก"
          >
            <Leaf color="#4ade80" size={32} style={{ transform: 'rotate(-15deg)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
              <span style={{ fontSize: '1.6rem' }}>FarmPro</span>
              <span style={{ 
                fontSize: '0.7rem', 
                color: '#16a34a', 
                fontWeight: '700', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.25rem', 
                marginTop: '0.25rem',
                background: 'rgba(22, 163, 74, 0.1)',
                padding: '2px 8px',
                borderRadius: '10px'
              }}>
                <Home size={12} /> หน้าหลัก
              </span>
            </div>
          </div>

          {/* Current User Profile Summary Card */}
          {currentUser && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(22, 163, 74, 0.05) 100%)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: '14px',
              padding: '1rem 0.85rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 'bold',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)'
                }}>
                  {displayStoreName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {displayStoreName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: '600' }}>
                    {currentUser.role === 'BUYER' ? '🏪 หมวดผู้ซื้อ' : (currentUser.role === 'SELLER' ? '🧑‍🌾 หมวดผู้ขาย' : (currentUser.role === 'VENDOR' ? '🛒 หมวดบริการ' : (currentUser.role === 'SUPER_ADMIN' ? '👑 ผู้ดูแลระบบสูงสุด' : (currentUser.role === 'ADMIN' ? '🛡️ ผู้ดูแลระบบ' : currentUser.role))))}
                  </div>
                </div>
              </div>

              {displayStorePhone && (
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  📞 {displayStorePhone}
                </div>
              )}

              {/* Package Badge Chip inside Profile Box */}
              {(currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'ADMIN' && currentUser.role !== 'BASIC_ADMIN') && (
                <div 
                  onClick={() => { setShowPricingModal(true); setIsLoggedInAdmin(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: (currentUser.plan_id === 'pro') 
                      ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(147, 51, 234, 0.08) 100%)'
                      : ((currentUser.plan_id === 'free')
                        ? 'linear-gradient(135deg, rgba(100, 116, 139, 0.15) 0%, rgba(71, 85, 105, 0.08) 100%)'
                        : 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.08) 100%)'),
                    border: (currentUser.plan_id === 'pro')
                      ? '1px solid rgba(168, 85, 247, 0.35)'
                      : ((currentUser.plan_id === 'free')
                        ? '1px solid rgba(148, 163, 184, 0.35)'
                        : '1px solid rgba(16, 185, 129, 0.35)'),
                    borderRadius: '10px',
                    padding: '0.45rem 0.65rem',
                    marginBottom: '0.6rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                  title="คลิกเพื่อดูรายละเอียดแพ็กเกจและอัปเกรด"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.85rem' }}>
                      {currentUser.plan_id === 'pro' ? '🚀' : (currentUser.plan_id === 'free' ? '🌱' : '⚡')}
                    </span>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '500', lineHeight: 1.1 }}>
                        แพ็กเกจปัจจุบัน
                      </div>
                      <div style={{ 
                        fontWeight: 'bold', 
                        fontSize: '0.825rem', 
                        color: currentUser.plan_id === 'pro' ? '#7e22ce' : (currentUser.plan_id === 'free' ? '#334155' : '#047857') 
                      }}>
                        {currentUser.plan_id === 'pro' ? 'Pro Plan' : (currentUser.plan_id === 'free' ? 'Free Plan' : 'Standard Plan')}
                      </div>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '0.7rem',
                    color: currentUser.plan_id === 'pro' ? '#7e22ce' : (currentUser.plan_id === 'free' ? '#475569' : '#047857'),
                    fontWeight: 'bold',
                    background: 'rgba(255, 255, 255, 0.8)',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    border: '1px solid rgba(0,0,0,0.05)'
                  }}>
                    ดูรายละเอียด &gt;
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setShowEditProfile(true)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    padding: '0.45rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    background: 'rgba(34, 197, 94, 0.1)',
                    color: '#16a34a',
                    fontSize: '0.78rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  title="แก้ไขข้อมูลโปรไฟล์"
                >
                  <Edit size={13} />
                  <span>แก้ไขโปรไฟล์</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    padding: '0.45rem 0.6rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: '#dc2626',
                    fontSize: '0.78rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  title="ออกจากระบบ"
                >
                  <LogOut size={13} />
                  <span>ออก</span>
                </button>
              </div>
            </div>
          )}

          {(!currentUser || (currentUser.role !== 'CLERK' && currentUser.role !== 'DRC_LAB')) && (
            <div className="sidebar-nav">

            {/* --- Role-Based Menu Visibility --- */}
            {/* SUPER_ADMIN/ADMIN/BASIC_ADMIN: เห็นทุกเมนู */}
            {/* buyer/CLERK/DRC_LAB: เห็นแค่หมวดผู้ซื้อ */}
            {/* seller: เห็นแค่หมวดผู้ขาย */}
            {/* vendor: เห็นแค่หมวดบริการ */}
            {(() => {
              const role = currentUser?.role;
              const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'BASIC_ADMIN';
              const isBuyer = role === 'buyer' || role === 'CLERK' || role === 'DRC_LAB';
              const isSeller = role === 'seller';
              const isVendor = role === 'vendor';

              return (
                <>
                  {/* แดชบอร์ดผู้ดูแล: เฉพาะ admin */}
                  {isAdmin && (
                    <>
                      <div
                        className={`sidebar-item ${activePortal === 'admin' ? 'active' : ''}`}
                        onClick={() => setActivePortal('admin')}
                      >
                        🛡️ แดชบอร์ดผู้ดูแล
                      </div>
                      <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.75rem 0' }}></div>
                    </>
                  )}

                  {/* หมวดผู้ซื้อ: แสดงเมื่อ buyer หรือ admin */}
                  {(isBuyer || isAdmin) && (
                    <div
                      className={`sidebar-item ${activePortal === 'buyer' ? 'active' : ''}`}
                      onClick={() => handlePortalSwitch('buyer')}
                    >
                      🏪 หมวดผู้ซื้อ
                    </div>
                  )}

                  {/* หมวดผู้ขาย: แสดงเมื่อ seller หรือ admin */}
                  {(isSeller || isAdmin) && (
                    <div
                      className={`sidebar-item ${activePortal === 'seller' ? 'active' : ''}`}
                      onClick={() => handlePortalSwitch('seller')}
                    >
                      🧑‍🌾 หมวดผู้ขาย (ชาวสวน)
                    </div>
                  )}

                  {/* หมวดบริการ: แสดงทุก role ยกเว้น CLERK/DRC_LAB */}
                  {(isBuyer || isSeller || isVendor || isAdmin) && (
                    <div
                      className={`sidebar-item ${activePortal === 'marketplace' ? 'active' : ''}`}
                      onClick={() => handlePortalSwitch('marketplace')}
                    >
                      🛒 หมวดร้านค้าและบริการ
                    </div>
                  )}
                </>
              );
            })()}



            <div style={{ height: '1px', background: 'var(--glass-border)', margin: '0.75rem 0' }}></div>

            <div 
              className={`sidebar-item ${activePortal === 'pricing' ? 'active' : ''}`}
              onClick={() => { setActivePortal('pricing'); setIsLoggedInAdmin(false); }}
            >
              💎 แพ็กเกจราคา
            </div>

            {/* Redesigned AI Chat Button */}
            <div style={{ marginTop: '0.5rem', paddingBottom: '0.5rem' }}>
              <div 
                className={`sidebar-item ${activePortal === 'ai_chat' ? 'active' : ''}`}
                onClick={() => setActivePortal('ai_chat')}
                style={{
                  background: activePortal === 'ai_chat' 
                    ? '#ea580c' 
                    : '#fff7ed',
                  color: activePortal === 'ai_chat' ? '#ffffff' : '#ea580c',
                  fontWeight: 'bold',
                  boxShadow: activePortal === 'ai_chat' 
                    ? '0 4px 12px rgba(234, 88, 12, 0.25)' 
                    : 'none',
                  border: activePortal === 'ai_chat' 
                    ? '1px solid #ea580c' 
                    : '1px solid #fed7aa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  if (activePortal !== 'ai_chat') {
                    e.currentTarget.style.background = '#ffedd5';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(234, 88, 12, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activePortal !== 'ai_chat') {
                    e.currentTarget.style.background = '#fff7ed';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                {activePortal !== 'ai_chat' && (
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0,
                    width: '100%', height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
                    animation: 'shimmer 3s infinite',
                    pointerEvents: 'none'
                  }} />
                )}
                <span style={{ fontSize: '1.25rem' }}>✨</span>
                <span style={{ letterSpacing: '0.3px', zIndex: 1 }}>FarmPro AI Chat</span>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Admin Login Link */}
        {(!currentUser || (currentUser.role !== 'CLERK' && currentUser.role !== 'DRC_LAB' && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'ADMIN' && currentUser.role !== 'BASIC_ADMIN')) && (
          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
           <button 
             onClick={() => window.location.href = '/admin'} 
             style={{ 
               width: '100%', 
               background: 'transparent', 
               border: '1px dashed #ef4444', 
               color: '#ef4444', 
               padding: '0.75rem', 
               borderRadius: '8px',
               cursor: 'pointer',
               fontSize: '0.875rem',
               fontWeight: 'bold',
               transition: 'all 0.2s'
             }}
           >
             🔒 เข้าสู่ระบบผู้ดูแล
           </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="content-wrapper" style={activePortal === 'pricing' ? { maxWidth: '1100px' } : {}}>
          <OfflineStatusBar />
          {activePortal !== 'admin' && activePortal !== 'ai_chat' && activePortal !== 'pricing' && (
            <div className="header" style={{ marginBottom: '1.5rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
                  {activePortal === 'buyer' && 'ระบบจัดการสำหรับร้านรับซื้อ'}
                  {activePortal === 'seller' && 'ระบบจัดการสำหรับชาวสวนยาง'}
                  {activePortal === 'marketplace' && 'ศูนย์รวมบริการทางการเกษตร'}
                </h1>
                <p>
                  {activePortal === 'buyer' && 'ออกบิลอิเล็กทรอนิกส์และจัดการข้อมูลร้านค้า'}
                  {activePortal === 'seller' && 'บันทึกบิลขายยางและดูสถิติรายรับ'}
                  {activePortal === 'marketplace' && 'ค้นหาร้านค้าอุปกรณ์และบริการรับจ้าง'}
                </p>
              </div>

              {/* User Profile Header Chip */}
              {currentUser ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid var(--glass-border)',
                    padding: '0.5rem 1rem',
                    borderRadius: '20px',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#1e293b'
                  }}>
                    <User size={16} color="#16a34a" />
                    <span>{currentUser.full_name}</span>
                    {displayStorePhone && (
                      <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 'normal' }}>
                        (📞 {displayStorePhone})
                      </span>
                    )}
                    <span style={{
                      background: '#dcfce7',
                      color: '#15803d',
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      {activePortal === 'buyer' ? '🏪 หมวดผู้ซื้อ' : (activePortal === 'seller' ? '🧑‍🌾 หมวดผู้ขาย' : (activePortal === 'marketplace' ? '🛒 หมวดบริการ' : (roleLabels[currentUser.role] || currentUser.role)))}
                    </span>
                  </div>

                  <button
                    onClick={() => setShowEditProfile(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.55rem 0.9rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      background: 'rgba(34, 197, 94, 0.1)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      color: '#16a34a',
                      transition: 'all 0.2s'
                    }}
                    title="แก้ไขโปรไฟล์"
                  >
                    <Edit size={15} />
                    <span>แก้ไขโปรไฟล์</span>
                  </button>

                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.55rem 0.9rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      background: 'rgba(239, 68, 68, 0.1)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      color: '#ef4444',
                      transition: 'all 0.2s'
                    }}
                    title="ออกจากระบบ"
                  >
                    <LogOut size={16} />
                    <span>ออกจากระบบ</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAuthView('login')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.6rem 1.1rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    background: 'rgba(34, 197, 94, 0.1)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#16a34a',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                    transition: 'all 0.2s'
                  }}
                >
                  <LogIn size={18} />
                  <span>เข้าสู่ระบบ</span>
                </button>
              )}
            </div>
          )}
          
          <ErrorBoundary key={activePortal}>
            {activePortal === 'buyer' && <BuyerPortal currentUser={currentUser} onUpdateProfile={(updated) => setCurrentUser(updated)} />}
            {activePortal === 'seller' && <SellerPortal currentUser={currentUser} />}
            {activePortal === 'marketplace' && <MarketplacePortal />}
            {activePortal === 'ai_chat' && <AIChat />}
            {activePortal === 'admin' && <AdminPortal />}
            {activePortal === 'pricing' && <PricingTable />}
            {/* Fallback: if no portal matched, show buyer portal as default */}
            {!['buyer','seller','marketplace','ai_chat','admin','pricing'].includes(activePortal) && (
              <BuyerPortal currentUser={currentUser} onUpdateProfile={(updated) => setCurrentUser(updated)} />
            )}
          </ErrorBoundary>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && currentUser && (
        <EditProfileModal
          profile={currentUser}
          activePortal={activePortal}
          onClose={() => setShowEditProfile(false)}
          onSaveSuccess={(updated) => setCurrentUser(updated)}
        />
      )}

      {/* Pricing Modal */}
      {showPricingModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#f8fafc',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '1100px',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <button
              onClick={() => setShowPricingModal(false)}
              style={{
                position: 'absolute',
                top: '1.5rem',
                right: '1.5rem',
                background: '#e2e8f0',
                border: 'none',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                color: '#475569',
                fontSize: '1.2rem',
                fontWeight: 'bold'
              }}
            >
              ✕
            </button>
            <PricingTable isEmbedded={true} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
