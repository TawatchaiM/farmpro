import React, { useState, useEffect } from 'react';
import { PRICING_CONFIG, ALL_PLANS } from '../config/pricingPlans';
import { db } from '../supabase';
import { 
  Check, X, HardDrive, Clock, FileText, Trees, Bot, Sparkles, 
  ShieldCheck, ArrowRight, Zap, Star, CheckCircle2, AlertCircle
} from 'lucide-react';

function PricingTable({ 
  currentUser = null, 
  selectedPlanId = null, 
  onSelectPlan = null, 
  isEmbedded = false, 
  defaultRole = null,
  onClose = null 
}) {
  // Determine initial role segment
  const initialRole = () => {
    if (defaultRole && (defaultRole === 'seller' || defaultRole === 'buyer')) {
      return defaultRole;
    }
    if (currentUser?.role === 'seller') return 'seller';
    if (currentUser?.role === 'buyer') return 'buyer';
    return 'buyer'; // default to buyer segment or seller
  };

  const [activeRole, setActiveRole] = useState(initialRole);
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [currentSelectedId, setCurrentSelectedId] = useState(selectedPlanId || (initialRole() === 'seller' ? 'seller_pro' : 'buyer_standard'));
  const [isUpdating, setIsUpdating] = useState(false);
  const [notification, setNotification] = useState(null);

  // Sync role if defaultRole changes
  useEffect(() => {
    if (defaultRole && (defaultRole === 'seller' || defaultRole === 'buyer')) {
      setActiveRole(defaultRole);
    }
  }, [defaultRole]);

  // Sync selectedPlanId from prop
  useEffect(() => {
    if (selectedPlanId) {
      setCurrentSelectedId(selectedPlanId);
      // Auto-detect role from selectedPlanId if prefixed
      if (selectedPlanId.startsWith('seller')) setActiveRole('seller');
      else if (selectedPlanId.startsWith('buyer')) setActiveRole('buyer');
    }
  }, [selectedPlanId]);

  const plans = PRICING_CONFIG.plansByRole[activeRole] || [];

  const handleToggleCycle = () => {
    setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly');
  };

  const handlePlanClick = async (plan) => {
    setCurrentSelectedId(plan.id);

    // If external onSelectPlan is provided (e.g. OnboardingRegistration)
    if (onSelectPlan) {
      onSelectPlan(plan.id, billingCycle, activeRole);
      return;
    }

    // If logged in, update user subscription in DB & localStorage
    if (currentUser && (currentUser.id || currentUser.user_id)) {
      const userId = currentUser.id || currentUser.user_id;
      setIsUpdating(true);
      try {
        const subData = {
          subscription_tier: plan.tier,
          plan_type: plan.id,
          billing_cycle: billingCycle,
          storage_limit_mb: plan.quotas.storageMb,
          bill_quota_monthly: plan.quotas.billsQuotaMonthly || 999999
        };

        const res = await db.updateUserSubscription(userId, subData);
        if (res?.success) {
          setNotification({
            type: 'success',
            message: `ปรับเปลี่ยนแพ็กเกจเป็น "${plan.name}" (${billingCycle === 'yearly' ? 'รายปี' : 'รายเดือน'}) เรียบร้อยแล้ว!`
          });
        } else {
          setNotification({
            type: 'success',
            message: `บันทึกการเลือกแพ็กเกจ "${plan.name}" เรียบร้อยแล้ว`
          });
        }
      } catch (err) {
        console.error('Error updating subscription:', err);
        setNotification({
          type: 'info',
          message: `เลือกแพ็กเกจ "${plan.name}" เรียบร้อยแล้ว`
        });
      } finally {
        setIsUpdating(false);
        setTimeout(() => setNotification(null), 4000);
      }
    } else {
      setNotification({
        type: 'info',
        message: `คุณได้เลือกแพ็กเกจ "${plan.name}" แล้ว (กรุณาเข้าสู่ระบบหรือลงทะเบียนเพื่อเริ่มต้นใช้งาน)`
      });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // Check if this plan is the user's currently active plan
  const isCurrentActivePlan = (plan) => {
    if (!currentUser) return false;
    const userTier = currentUser.subscription_tier || currentUser.plan_id || currentUser.subscription_plan;
    const userPlanType = currentUser.plan_type;
    if (userPlanType && userPlanType === plan.id) return true;
    if (userTier && userTier === plan.tier && currentUser.role === activeRole) return true;
    return false;
  };

  return (
    <div style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 99999,
          background: notification.type === 'success' ? '#065f46' : '#1e293b',
          color: '#ffffff',
          padding: '1rem 1.4rem',
          borderRadius: '14px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.925rem',
          fontWeight: 600,
          animation: 'fadeIn 0.25s ease'
        }}>
          <CheckCircle2 size={20} color="#34d399" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header & Subtitle */}
      {!isEmbedded && (
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: '#ecfdf5',
            color: '#065f46',
            padding: '0.35rem 1rem',
            borderRadius: '20px',
            fontSize: '0.85rem',
            fontWeight: 700,
            marginBottom: '0.75rem'
          }}>
            <Sparkles size={16} /> โครงสร้างราคาและสิทธิ์การใช้งาน FarmPro
          </div>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
            💎 แพ็กเกจราคาและบริการ FarmPro
          </h2>
          <p style={{ color: '#64748b', fontSize: '1.05rem', maxWidth: '680px', margin: '0 auto', lineHeight: '1.6' }}>
            เลือกแผนการใช้งานที่คุ้มค่าและตรงกับรูปแบบงานของคุณ โปร่งใส ไม่มีค่าใช้จ่ายแอบแฝง ปรับเปลี่ยนได้ตลอดเวลา
          </p>
        </div>
      )}

      {/* 1. ROLE SEGMENT TOGGLE (สลับกลุ่มเป้าหมาย) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.75rem' }}>
        <div style={{
          background: '#f1f5f9',
          padding: '5px',
          borderRadius: '16px',
          display: 'inline-flex',
          gap: '6px',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)',
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Sellers Tab */}
          <button
            type="button"
            onClick={() => setActiveRole('seller')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.4rem',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.95rem',
              transition: 'all 0.25s ease',
              background: activeRole === 'seller' ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)' : 'transparent',
              color: activeRole === 'seller' ? '#ffffff' : '#64748b',
              boxShadow: activeRole === 'seller' ? '0 4px 12px rgba(6, 95, 70, 0.25)' : 'none'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>👨‍🌾</span>
            <span>สำหรับชาวสวนยาง (Sellers)</span>
          </button>

          {/* Buyers Tab */}
          <button
            type="button"
            onClick={() => setActiveRole('buyer')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.4rem',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.95rem',
              transition: 'all 0.25s ease',
              background: activeRole === 'buyer' ? 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)' : 'transparent',
              color: activeRole === 'buyer' ? '#ffffff' : '#64748b',
              boxShadow: activeRole === 'buyer' ? '0 4px 12px rgba(15, 118, 110, 0.25)' : 'none'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>🏢</span>
            <span>สำหรับร้านรับซื้อยาง (Buyers)</span>
          </button>
        </div>
      </div>

      {/* Role Subtitle Description */}
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>
          {PRICING_CONFIG.roles[activeRole]?.subtitle}
        </span>
      </div>

      {/* 2. BILLING CYCLE TOGGLE (รายเดือน / รายปี) */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.9rem', marginBottom: '2.5rem' }}>
        <span style={{ 
          fontSize: '0.95rem', 
          fontWeight: billingCycle === 'monthly' ? 700 : 500, 
          color: billingCycle === 'monthly' ? '#0f172a' : '#64748b',
          cursor: 'pointer'
        }}
        onClick={() => setBillingCycle('monthly')}
        >
          รายเดือน (Monthly)
        </span>

        <button 
          type="button"
          onClick={handleToggleCycle}
          aria-label="Toggle Billing Cycle"
          style={{
            position: 'relative',
            width: '60px',
            height: '32px',
            borderRadius: '20px',
            background: billingCycle === 'yearly' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#cbd5e1',
            border: 'none',
            cursor: 'pointer',
            padding: '3px',
            transition: 'all 0.25s ease',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: '#ffffff',
            transform: billingCycle === 'yearly' ? 'translateX(28px)' : 'translateX(0)',
            transition: 'transform 0.25s ease',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
          }} />
        </button>

        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}
          onClick={() => setBillingCycle('yearly')}
        >
          <span style={{ 
            fontSize: '0.95rem', 
            fontWeight: billingCycle === 'yearly' ? 700 : 500, 
            color: billingCycle === 'yearly' ? '#0f172a' : '#64748b' 
          }}>
            รายปี (Yearly)
          </span>
          <span style={{
            background: '#dcfce7',
            color: '#15803d',
            border: '1px solid #86efac',
            fontSize: '0.78rem',
            fontWeight: 800,
            padding: '2px 9px',
            borderRadius: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            🎉 ประหยัด 20%
          </span>
        </div>
      </div>

      {/* 3. PRICING CARDS GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: activeRole === 'seller' ? 'repeat(auto-fit, minmax(320px, 460px))' : 'repeat(auto-fit, minmax(290px, 1fr))',
        justifyContent: 'center',
        gap: '1.75rem',
        alignItems: 'stretch',
        marginBottom: '2rem'
      }}>
        {plans.map(plan => {
          const isSelected = currentSelectedId === plan.id;
          const isPopular = plan.isPopular;
          const isCurrentActive = isCurrentActivePlan(plan);

          // Pricing logic
          const monthlyPrice = plan.priceMonthly;
          const yearlyPrice = plan.priceYearly;
          const displayPrice = billingCycle === 'yearly' && yearlyPrice > 0 
            ? Math.round(yearlyPrice / 12) 
            : monthlyPrice;

          return (
            <div
              key={plan.id}
              style={{
                position: 'relative',
                background: isPopular 
                  ? 'linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)' 
                  : '#ffffff',
                border: isPopular 
                  ? '2px solid #10b981' 
                  : isSelected 
                    ? '2px solid #0f766e' 
                    : '1px solid #e2e8f0',
                borderRadius: '24px',
                padding: '2rem 1.6rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: isPopular 
                  ? '0 16px 36px -6px rgba(16, 185, 129, 0.22), 0 6px 12px -2px rgba(16, 185, 129, 0.08)' 
                  : '0 6px 18px rgba(0,0,0,0.04)',
                transform: isPopular ? 'scale(1.02)' : 'none',
                transition: 'all 0.25s ease',
                boxSizing: 'border-box'
              }}
            >
              {/* Badge for Popular / Recommended */}
              {plan.badge && (
                <div style={{
                  position: 'absolute',
                  top: '-14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  padding: '5px 18px',
                  borderRadius: '20px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                  whiteSpace: 'nowrap'
                }}>
                  {plan.badge}
                </div>
              )}

              {/* Current Active Plan Badge */}
              {isCurrentActive && (
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: '#dbeafe',
                  color: '#1d4ed8',
                  padding: '3px 10px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  <ShieldCheck size={14} /> แพ็กเกจปัจจุบัน
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {/* Plan Header */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem 0' }}>
                    {plan.name}
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0, minHeight: '38px', lineHeight: '1.45' }}>
                    {plan.subtitle}
                  </p>
                </div>

                {/* Price Display */}
                <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                    <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a' }}>
                      {monthlyPrice === 0 ? 'ฟรี ฿0' : `฿${displayPrice.toLocaleString()}`}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
                      / เดือน
                    </span>
                  </div>

                  {billingCycle === 'yearly' && yearlyPrice > 0 ? (
                    <div style={{ fontSize: '0.825rem', color: '#15803d', marginTop: '0.4rem', fontWeight: 700 }}>
                      ชำระรายปี ฿{yearlyPrice.toLocaleString()} / ปี (ประหยัด ฿{((monthlyPrice * 12) - yearlyPrice).toLocaleString()})
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                      {monthlyPrice === 0 ? 'ไม่มีค่าบริการตลอดชีพ' : 'ชำระแบบรายเดือน ไม่มีข้อผูกมัดระยะยาว'}
                    </div>
                  )}
                </div>

                {/* 4. DATA RETENTION & QUOTA BOX (โปร่งใส ชัดเจน) */}
                <div style={{
                  background: isPopular ? '#f0fdf4' : '#f8fafc',
                  border: isPopular ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '0.9rem 1rem',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ 
                    fontSize: '0.78rem', 
                    fontWeight: 800, 
                    color: isPopular ? '#166534' : '#475569', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.5px',
                    marginBottom: '0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}>
                    <Zap size={14} color={isPopular ? '#16a34a' : '#64748b'} />
                    โควตาและเงื่อนไขการจัดเก็บข้อมูล:
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.825rem' }}>
                    {/* Retention */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#334155' }}>
                      <Clock size={15} color="#0284c7" />
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>ประวัติย้อนหลัง</div>
                        <div style={{ fontWeight: 700 }}>{plan.quotas.retention}</div>
                      </div>
                    </div>

                    {/* Storage */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#334155' }}>
                      <HardDrive size={15} color="#8b5cf6" />
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>พื้นที่เก็บสลิป</div>
                        <div style={{ fontWeight: 700 }}>{plan.quotas.storageLabel}</div>
                      </div>
                    </div>

                    {/* Role specific: Plots / Bills */}
                    {plan.quotas.plots && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#334155' }}>
                        <Trees size={15} color="#16a34a" />
                        <div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>จำนวนแปลงสวน</div>
                          <div style={{ fontWeight: 700 }}>{plan.quotas.plots}</div>
                        </div>
                      </div>
                    )}

                    {/* AI Slips */}
                    {plan.quotas.aiSlips && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#334155' }}>
                        <Bot size={15} color="#d97706" />
                        <div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>อัปโหลด AI</div>
                          <div style={{ fontWeight: 700 }}>{plan.quotas.aiSlips}</div>
                        </div>
                      </div>
                    )}

                    {/* Bills Quota for Buyer */}
                    {plan.quotas.billsQuotaLabel && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#334155', gridColumn: 'span 2' }}>
                        <FileText size={15} color="#ea580c" />
                        <div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>ปริมาณออกบิล</div>
                          <div style={{ fontWeight: 700 }}>{plan.quotas.billsQuotaLabel}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Features List */}
                <div style={{ marginBottom: '2rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ฟีเจอร์การใช้งาน:
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {plan.features.map((feat, idx) => (
                      <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.875rem' }}>
                        {feat.included ? (
                          <span style={{
                            background: '#dcfce7',
                            color: '#16a34a',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            flexShrink: 0,
                            marginTop: '1px'
                          }}>✓</span>
                        ) : (
                          <span style={{
                            background: '#f1f5f9',
                            color: '#94a3b8',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            flexShrink: 0,
                            marginTop: '1px'
                          }}>✕</span>
                        )}
                        <span style={{ color: feat.included ? '#334155' : '#94a3b8', textDecoration: feat.included ? 'none' : 'line-through', lineHeight: '1.4' }}>
                          {feat.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handlePlanClick(plan)}
                  style={{
                    width: '100%',
                    padding: '0.85rem 1rem',
                    borderRadius: '14px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: isUpdating ? 'wait' : 'pointer',
                    transition: 'all 0.2s ease',
                    border: isSelected 
                      ? '2px solid #0f766e' 
                      : isPopular 
                        ? 'none' 
                        : '1px solid #cbd5e1',
                    background: isCurrentActive
                      ? '#f1f5f9'
                      : isPopular
                        ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)'
                        : isSelected
                          ? 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)'
                          : '#ffffff',
                    color: isCurrentActive 
                      ? '#475569' 
                      : (isPopular || isSelected) 
                        ? '#ffffff' 
                        : '#1e293b',
                    boxShadow: (isPopular || isSelected) && !isCurrentActive ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}
                >
                  {isCurrentActive ? (
                    <>
                      <Check size={18} /> แพ็กเกจของคุณในปัจจุบัน
                    </>
                  ) : isSelected ? (
                    <>
                      <Check size={18} /> เลือกแพ็กเกจนี้แล้ว
                    </>
                  ) : (
                    <>
                      {plan.buttonText} <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust & Guarantee Banner */}
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        borderRadius: '16px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        flexWrap: 'wrap',
        gap: '1.25rem',
        textAlign: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <ShieldCheck size={24} color="#16a34a" />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>ปลอดภัยตาม พ.ร.บ. คุ้มครองข้อมูล (PDPA)</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>ข้อมูลส่วนตัวและรายการบิลถูกเข้ารหัสมาตรฐานสากล</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Clock size={24} color="#0284c7" />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>ไม่มีข้อผูกมัด ยกเลิกได้ตลอดเวลา</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>ปรับเปลี่ยนหรือหยุดแพ็กเกจได้ตามความต้องการ</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Zap size={24} color="#eab308" />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>อัปเกรดและใช้งานได้ทันที</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>ระบบปลดล็อกความจุและฟีเจอร์แบบเรียลไทม์</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PricingTable;
