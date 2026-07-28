import React, { useState, useEffect, useRef } from 'react';

function ReviewForm({ initialData, onSave, onCancel, isEdit = false, isManual = false }) {
  const [formData, setFormData] = useState(initialData);

  // Revenue share options states: '55' | '50' | '60' | '100' | 'custom'
  const initialSharePct = initialData?.owner_share_percentage 
    ? String(initialData.owner_share_percentage) 
    : '55';
    
  const isPreset = ['55', '50', '60', '100'].includes(initialSharePct);

  const [shareOption, setShareOption] = useState(isPreset ? initialSharePct : 'custom');
  const [customPct, setCustomPct] = useState(isPreset ? '55' : String(initialData?.owner_share_percentage || 55));

  // Use refs to prevent dependency loops when updating manually vs automatic calculation
  const isUserEdit = useRef(false);

  // Calculate current effective owner share percentage
  const getCurrentOwnerPct = () => {
    if (shareOption === '50') return 50;
    if (shareOption === '55') return 55;
    if (shareOption === '60') return 60;
    if (shareOption === '100') return 100;
    if (shareOption === 'custom') {
      const p = parseFloat(customPct);
      return isNaN(p) ? 0 : Math.min(100, Math.max(0, p));
    }
    return 55;
  };

  const effectiveOwnerPct = getCurrentOwnerPct();
  const effectiveTapperPct = 100 - effectiveOwnerPct;

  useEffect(() => {
    // Only auto-calculate if the user isn't actively typing
    if (!isUserEdit.current) {
      const raw = parseFloat(formData.raw_weight_kg) || 0;
      const drc = parseFloat(formData.drc_percentage) || 0;
      const price = parseFloat(formData.price_per_kg) || 0;
      
      const dry = (raw * drc) / 100;
      const total = dry * price;
      
      setFormData(prev => ({
        ...prev,
        dry_weight_kg: dry ? dry.toFixed(2) : '',
        total_amount_thb: total ? total.toFixed(2) : ''
      }));
    }
  }, [formData.raw_weight_kg, formData.drc_percentage, formData.price_per_kg]);

  // Separate effect for owner & tapper share calculation derived from total and selected ratio
  useEffect(() => {
    const total = parseFloat(formData.total_amount_thb) || 0;
    const ownerAmount = (total * (effectiveOwnerPct / 100)).toFixed(2);
    const tapperAmount = (total - parseFloat(ownerAmount)).toFixed(2);

    setFormData(prev => ({
      ...prev,
      owner_share_percentage: effectiveOwnerPct,
      owner_share_55_thb: ownerAmount,
      owner_share_amount: ownerAmount,
      tapper_share_amount: tapperAmount
    }));
  }, [formData.total_amount_thb, effectiveOwnerPct]);

  const handleChange = (e) => {
    isUserEdit.current = true;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      owner_share_percentage: effectiveOwnerPct,
      owner_share_55_thb: (parseFloat(formData.total_amount_thb || 0) * (effectiveOwnerPct / 100)).toFixed(2),
      owner_share_amount: (parseFloat(formData.total_amount_thb || 0) * (effectiveOwnerPct / 100)).toFixed(2),
      tapper_share_amount: (parseFloat(formData.total_amount_thb || 0) * (effectiveTapperPct / 100)).toFixed(2)
    });
  };

  return (
    <div className="card">
      <div className="header">
        <h2 style={{ color: '#0f172a', fontWeight: 'bold' }}>
          {isEdit ? '✏️ แก้ไขข้อมูลบิล' : (isManual ? '✍️ กรอกข้อมูลบิลด้วยตนเอง' : '🔍 ตรวจสอบและแก้ไขข้อมูล (จาก AI)')}
        </h2>
        <p style={{ color: '#64748b' }}>
          {isEdit ? 'แก้ไขรายละเอียดของบิลที่เลือก' : (isManual ? 'กรอกรายละเอียดการขายยางพาราเพื่อบันทึกลงระบบ' : 'กรุณาตรวจสอบความถูกต้องก่อนบันทึก')}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label style={{ color: '#334155', fontWeight: '600' }}>วันที่ขาย <span style={{ color: '#ef4444' }}>*</span></label>
            <input 
              type="date" 
              name="date" 
              value={formData.date} 
              onChange={handleChange} 
              className="form-input" 
              required
            />
          </div>

          <div className="form-group">
            <label style={{ color: '#334155', fontWeight: '600' }}>ชื่อร้านรับซื้อยาง <span style={{ color: '#ef4444' }}>*</span></label>
            <input 
              type="text" 
              name="buyer_name" 
              value={formData.buyer_name} 
              onChange={handleChange} 
              placeholder="เช่น ร้านลานยางเจ๊น้อย, บจก.ไทยรับเบอร์"
              className="form-input" 
              required
            />
          </div>

          <div className="form-group">
            <label style={{ color: '#334155', fontWeight: '600' }}>น้ำหนักน้ำยางสด (กก.) <span style={{ color: '#ef4444' }}>*</span></label>
            <div className="input-with-icon">
              <input 
                type="number" 
                step="0.01"
                name="raw_weight_kg" 
                value={formData.raw_weight_kg} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="0.00"
                required
              />
              <span className="input-unit">กก.</span>
            </div>
          </div>

          <div className="form-group">
            <label style={{ color: '#334155', fontWeight: '600' }}>เปอร์เซ็นต์น้ำยาง (% DRC) <span style={{ color: '#ef4444' }}>*</span></label>
            <div className="input-with-icon">
              <input 
                type="number" 
                step="0.01"
                name="drc_percentage" 
                value={formData.drc_percentage} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="เช่น 32.5"
                required
              />
              <span className="input-unit">%</span>
            </div>
          </div>

          <div className="form-group">
            <label style={{ color: '#334155', fontWeight: '600' }}>น้ำหนักยางแห้ง (กก.)</label>
            <div className="input-with-icon">
              <input 
                type="number" 
                step="0.01"
                name="dry_weight_kg" 
                value={formData.dry_weight_kg} 
                onChange={handleChange}
                className="form-input" 
                placeholder="คำนวณให้อัตโนมัติ"
              />
              <span className="input-unit">กก.</span>
            </div>
          </div>

          <div className="form-group">
            <label style={{ color: '#334155', fontWeight: '600' }}>ราคาซื้อ (บาท/กก.) <span style={{ color: '#ef4444' }}>*</span></label>
            <div className="input-with-icon">
              <input 
                type="number" 
                step="0.01"
                name="price_per_kg" 
                value={formData.price_per_kg} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="0.00"
                required
              />
              <span className="input-unit">บาท</span>
            </div>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label style={{ color: '#334155', fontWeight: '600' }}>ยอดเงินรวมสุทธิ (บาท)</label>
            <div className="input-with-icon">
              <input 
                type="number" 
                step="0.01"
                name="total_amount_thb" 
                value={formData.total_amount_thb} 
                onChange={handleChange} 
                className="form-input" 
                style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#15803d' }}
              />
              <span className="input-unit">บาท</span>
            </div>
          </div>

          {/* Revenue Sharing Ratio Selector Options - High Contrast Accessible Design */}
          <div className="form-group" style={{ 
            gridColumn: '1 / -1', 
            background: '#f8fafc', 
            padding: '1.25rem', 
            borderRadius: '14px', 
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0f172a', marginBottom: '0.75rem', fontSize: '0.925rem' }}>
              <span>🤝 เลือกสัดส่วนแบ่งรายได้ (เจ้าของสวน / คนกรีดยาง):</span>
            </label>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.6rem' }}>
              {[
                { key: '100', label: '100% กรีดเอง', desc: 'เจ้าของรับ 100%' },
                { key: '60', label: '60 / 40', desc: 'เจ้าของ 60%' },
                { key: '55', label: '55 / 45', desc: 'มาตรฐาน (55%)' },
                { key: '50', label: '50 / 50', desc: 'คนละครึ่ง (50%)' },
                { key: 'custom', label: '⚙️ กำหนดเอง', desc: 'ระบุ % เอง' }
              ].map(opt => {
                const isSelected = shareOption === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setShareOption(opt.key)}
                    style={{
                      padding: '0.75rem 0.5rem',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #166534' : '1.5px solid #cbd5e1',
                      background: isSelected ? '#15803d' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#0f172a',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontSize: '0.9rem',
                      boxShadow: isSelected ? '0 4px 12px rgba(21, 128, 61, 0.3)' : '0 2px 4px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ color: isSelected ? '#ffffff' : '#0f172a', fontWeight: 'bold', fontSize: '0.95rem' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: isSelected ? '#dcfce7' : '#475569', fontWeight: '500', marginTop: '2px' }}>
                      {opt.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            {shareOption === 'custom' && (
              <div style={{ 
                marginTop: '0.85rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.6rem', 
                background: '#ffffff', 
                padding: '0.75rem 1rem', 
                borderRadius: '10px',
                border: '1.5px solid #15803d',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
              }}>
                <label style={{ fontSize: '0.875rem', color: '#0f172a', fontWeight: '600' }}>
                  ระบุสัดส่วน % ของเจ้าของสวน:
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={customPct}
                  onChange={(e) => setCustomPct(e.target.value)}
                  style={{
                    width: '85px',
                    padding: '0.45rem 0.6rem',
                    borderRadius: '8px',
                    border: '2px solid #15803d',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    fontSize: '1rem'
                  }}
                />
                <span style={{ fontSize: '0.875rem', color: '#15803d', fontWeight: 'bold' }}>
                  % (คนกรีดได้ {100 - (parseFloat(customPct) || 0)}%)
                </span>
              </div>
            )}
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label style={{ color: '#334155', fontWeight: '600' }}>หมายเหตุเพิ่มเติม (ถ้ามี)</label>
            <input 
              type="text" 
              name="note" 
              value={formData.note || ''} 
              onChange={handleChange} 
              className="form-input" 
              placeholder="เช่น ขี้ยาง 50/50, ยางแผ่นดิบ, หักค่าน้ำยาง 500..."
            />
          </div>

          {/* Revenue Breakdown Highlight Card */}
          <div className="share-highlight" style={{ 
            gridColumn: '1 / -1', 
            background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)', 
            color: '#ffffff', 
            padding: '1.25rem', 
            borderRadius: '16px',
            boxShadow: '0 6px 16px rgba(21, 128, 61, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.2)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 'bold', color: '#ffffff' }}>
                  👨‍🌾 สัดส่วนเจ้าของสวน ({effectiveOwnerPct}%)
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#dcfce7' }}>
                  {effectiveOwnerPct === 100 ? 'เจ้าของสวนกรีดเอง รับยอดเต็ม 100%' : `คำนวณอัตโนมัติ ${effectiveOwnerPct}% จากยอดเงินรวม`}
                </p>
              </div>
              <div className="amount" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffffff' }}>
                ฿{parseFloat(formData.owner_share_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {effectiveOwnerPct < 100 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: '#ffffff' }}>
                    🧑‍🌾 ส่วนแบ่งคนกรีดยาง ({effectiveTapperPct}%)
                  </h4>
                  <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.78rem', color: '#dcfce7' }}>
                    คำนวณอัตโนมัติ {effectiveTapperPct}% จากยอดเงินรวม
                  </p>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ffffff' }}>
                  ฿{parseFloat(formData.tapper_share_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
            💾 บันทึกข้อมูลบิล
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {isEdit ? 'ยกเลิก' : (isManual ? 'ยกเลิก' : 'ยกเลิกและอัปโหลดใหม่')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ReviewForm;
