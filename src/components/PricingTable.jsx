import React, { useState } from 'react';
import { PRICING_CONFIG } from '../config/pricingPlans';

function PricingTable({ selectedPlanId = 'standard', onSelectPlan, isEmbedded = false }) {
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const discountPercent = PRICING_CONFIG.billingCycles.yearly.discountPercent || 20;

  const handleToggleCycle = () => {
    setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly');
  };

  const handleSelect = (planId) => {
    if (onSelectPlan) {
      onSelectPlan(planId, billingCycle);
    }
  };

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* Header & Subtitle */}
      {!isEmbedded && (
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.85rem', fontWeight: 'bold', color: 'var(--text-main, #1e293b)', marginBottom: '0.5rem' }}>
            💎 แพ็กเกจราคาและบริการ FarmPro
          </h2>
          <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: '600px', margin: '0 auto' }}>
            เลือกแผนการใช้งานที่เหมาะกับสเกลธุรกิจของคุณ สามารถอัปเกรดหรือยกเลิกได้ตลอดเวลา
          </p>
        </div>
      )}

      {/* Monthly vs Yearly Billing Toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.85rem', marginBottom: '2.5rem' }}>
        <span style={{ fontSize: '0.925rem', fontWeight: billingCycle === 'monthly' ? 'bold' : 'normal', color: billingCycle === 'monthly' ? '#1e293b' : '#64748b' }}>
          รายเดือน (Monthly)
        </span>

        <button 
          type="button"
          onClick={handleToggleCycle}
          style={{
            position: 'relative',
            width: '56px',
            height: '30px',
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
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: '#ffffff',
            transform: billingCycle === 'yearly' ? 'translateX(26px)' : 'translateX(0)',
            transition: 'transform 0.25s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.925rem', fontWeight: billingCycle === 'yearly' ? 'bold' : 'normal', color: billingCycle === 'yearly' ? '#1e293b' : '#64748b' }}>
            รายปี (Yearly)
          </span>
          <span style={{
            background: '#dcfce7',
            color: '#15803d',
            border: '1px solid #86efac',
            fontSize: '0.78rem',
            fontWeight: 'bold',
            padding: '2px 8px',
            borderRadius: '12px',
            display: 'inline-block'
          }}>
            {PRICING_CONFIG.billingCycles.yearly.badgeText}
          </span>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        alignItems: 'stretch'
      }}>
        {PRICING_CONFIG.plans.map(plan => {
          const isSelected = selectedPlanId === plan.id;
          const isPopular = plan.isPopular;

          // Price calculations
          let displayMonthly = plan.priceMonthly;
          let yearlyTotal = 0;
          if (billingCycle === 'yearly' && plan.priceMonthly > 0) {
            displayMonthly = Math.round(plan.priceMonthly * (1 - discountPercent / 100));
            yearlyTotal = Math.round(plan.priceMonthly * 12 * (1 - discountPercent / 100));
          }

          return (
            <div
              key={plan.id}
              style={{
                position: 'relative',
                background: isPopular ? 'linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)' : '#ffffff',
                border: isPopular ? '2px solid #10b981' : isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                borderRadius: '20px',
                padding: '2rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: isPopular 
                  ? '0 12px 30px -5px rgba(16, 185, 129, 0.25), 0 4px 6px -2px rgba(16, 185, 129, 0.05)'
                  : '0 4px 12px rgba(0,0,0,0.03)',
                transform: isPopular ? 'scale(1.02)' : 'none',
                transition: 'all 0.25s ease',
                boxSizing: 'border-box'
              }}
            >
              {/* Popular / Recommended Badge */}
              {plan.badge && (
                <div style={{
                  position: 'absolute',
                  top: '-14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  padding: '4px 16px',
                  borderRadius: '20px',
                  boxShadow: '0 4px 10px rgba(16, 185, 129, 0.35)',
                  whiteSpace: 'nowrap'
                }}>
                  {plan.badge}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {/* Plan Header */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 'bold', color: '#0f172a', margin: '0 0 0.4rem 0' }}>
                    {plan.name}
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0, minHeight: '38px', lineHeight: '1.4' }}>
                    {plan.subtitle}
                  </p>
                </div>

                {/* Price Display */}
                <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                    <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#0f172a' }}>
                      {plan.priceMonthly === 0 ? 'ฟรี 0' : `${PRICING_CONFIG.currency}${displayMonthly.toLocaleString()}`}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '500' }}>
                      / เดือน
                    </span>
                  </div>

                  {billingCycle === 'yearly' && plan.priceMonthly > 0 ? (
                    <div style={{ fontSize: '0.8rem', color: '#166534', marginTop: '0.35rem', fontWeight: '600' }}>
                      ชำระรายปีเพียง ฿{yearlyTotal.toLocaleString()} / ปี (ประหยัด ฿{((plan.priceMonthly * 12) - yearlyTotal).toLocaleString()})
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                      {plan.priceMonthly === 0 ? 'ไม่มีค่าบริการตลอดชีพ' : 'ชำระแบบรายเดือน ไม่มีข้อผูกมัด'}
                    </div>
                  )}
                </div>

                {/* Features List */}
                <div style={{ marginBottom: '2rem' }}>
                  <div style={{ fontSize: '0.825rem', fontWeight: 'bold', color: '#475569', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ฟีเจอร์ที่ได้รับ:
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {plan.features.map((feat, idx) => (
                      <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.875rem' }}>
                        {feat.included ? (
                          <span style={{
                            background: '#dcfce7',
                            color: '#16a34a',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            flexShrink: 0,
                            marginTop: '2px'
                          }}>✓</span>
                        ) : (
                          <span style={{
                            background: '#f1f5f9',
                            color: '#94a3b8',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            flexShrink: 0,
                            marginTop: '2px'
                          }}>✕</span>
                        )}
                        <span style={{ color: feat.included ? '#334155' : '#94a3b8', textDecoration: feat.included ? 'none' : 'line-through' }}>
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
                  onClick={() => handleSelect(plan.id)}
                  style={{
                    width: '100%',
                    padding: '0.85rem 1rem',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: isSelected 
                      ? '2px solid #10b981' 
                      : isPopular 
                        ? 'none' 
                        : '1px solid #cbd5e1',
                    background: isSelected
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : isPopular
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : '#ffffff',
                    color: isSelected || isPopular ? '#ffffff' : '#334155',
                    boxShadow: (isSelected || isPopular) ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none'
                  }}
                >
                  {isSelected ? '✓ เลือกแพ็กเกจนี้แล้ว' : plan.buttonText}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PricingTable;
