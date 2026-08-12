import React, { useState, useEffect } from 'react';
import { db } from '../supabase';

// Default 5-tier DRC pricing template (user can customize)
const DEFAULT_TIERS = [
  { id: 't1', label: 'เกรด A (สมบูรณ์มาก)', drc_min: 35, drc_max: null, price_per_kg: '' },
  { id: 't2', label: 'เกรดดีเยี่ยม', drc_min: 32, drc_max: 34.99, price_per_kg: '' },
  { id: 't3', label: 'เกรดปานกลาง', drc_min: 28, drc_max: 31.99, price_per_kg: '' },
  { id: 't4', label: 'เกรดต่ำ', drc_min: 25, drc_max: 27.99, price_per_kg: '' },
  { id: 't5', label: 'เกรดต่ำมาก', drc_min: 0, drc_max: 24.99, price_per_kg: '' },
];

function StoreRegistration({ currentUser, onUpdateProfile, dailySettings, onSaveSettings }) {
  const defaultAddress = [
    currentUser?.address_details,
    currentUser?.subdistrict ? `ต.${currentUser.subdistrict}` : '',
    currentUser?.district ? `อ.${currentUser.district}` : '',
    currentUser?.province ? `จ.${currentUser.province}` : '',
    currentUser?.postal_code
  ].filter(Boolean).join(' ');

  const [storeData, setStoreData] = useState({
    storeName: currentUser?.store_name || currentUser?.full_name || 'ร้านรับซื้อยาง FarmPro',
    phone: currentUser?.phone_number || '',
    address: defaultAddress || '',
    taxId: currentUser?.tax_id || ''
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Daily Settings states
  const [basePrice, setBasePrice] = useState(dailySettings?.base_price || '');
  const [formulaType, setFormulaType] = useState(dailySettings?.formula_type || 'standard');
  const [wetWeightG, setWetWeightG] = useState(dailySettings?.wet_sample_weight_g || 10);
  const [pricingMode, setPricingMode] = useState(dailySettings?.pricing_mode || 'flat');
  const [priceTiers, setPriceTiers] = useState(() => {
    if (dailySettings?.price_tiers?.length > 0) return dailySettings.price_tiers;
    return DEFAULT_TIERS;
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (currentUser) {
      const storeProfile = JSON.parse(localStorage.getItem('farmpro_store_profile') || '{}');
      const addr = [
        currentUser?.address_details,
        currentUser?.subdistrict ? `ต.${currentUser.subdistrict}` : '',
        currentUser?.district ? `อ.${currentUser.district}` : '',
        currentUser?.province ? `จ.${currentUser.province}` : '',
        currentUser?.postal_code
      ].filter(Boolean).join(' ');
      setStoreData({
        storeName: storeProfile?.storeName || currentUser?.full_name || 'ร้านรับซื้อยาง FarmPro',
        phone: storeProfile?.phone || currentUser?.phone_number || '',
        address: storeProfile?.address || addr || '',
        taxId: storeProfile?.taxId || currentUser?.tax_id || ''
      });
    }
  }, [currentUser]);

  // Sync tiers from dailySettings when it loads
  useEffect(() => {
    if (dailySettings) {
      setBasePrice(dailySettings.base_price || '');
      setFormulaType(dailySettings.formula_type || 'standard');
      setWetWeightG(dailySettings.wet_sample_weight_g || 10);
      setPricingMode(dailySettings.pricing_mode || 'flat');
      if (dailySettings.price_tiers?.length > 0) setPriceTiers(dailySettings.price_tiers);
    }
  }, [dailySettings]);

  const handleChange = (e) => {
    setStoreData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    try {
      localStorage.setItem('farmpro_store_profile', JSON.stringify({
        storeName: storeData.storeName,
        phone: storeData.phone,
        address: storeData.address,
        taxId: storeData.taxId
      }));
      if (onUpdateProfile) onUpdateProfile({ ...currentUser });
      setSuccessMsg('บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to save store registration:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลร้านค้า');
    } finally {
      setSaving(false);
    }
  };

  const handleTierChange = (id, field, value) => {
    setPriceTiers(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleSaveDailySettings = async (e) => {
    e.preventDefault();
    // Validate
    if (pricingMode === 'flat') {
      if (!basePrice || parseFloat(basePrice) <= 0) {
        alert('กรุณากรอกราคาประเมินประจำวันให้ถูกต้อง');
        return;
      }
    } else {
      // Tiered mode: check all tiers have price
      const invalid = priceTiers.filter(t => !t.price_per_kg || parseFloat(t.price_per_kg) <= 0);
      if (invalid.length > 0) {
        alert(`กรุณากรอกราคาสำหรับทุก tier (ยังขาดอยู่ ${invalid.length} ช่วง)`);
        return;
      }
    }

    setSavingSettings(true);
    try {
      const tiersToSave = priceTiers.map(t => ({
        ...t,
        drc_min: parseFloat(t.drc_min),
        drc_max: t.drc_max != null ? parseFloat(t.drc_max) : null,
        price_per_kg: parseFloat(t.price_per_kg) || 0
      }));

      let savedResult = null;
      if (onSaveSettings) {
        savedResult = await onSaveSettings({
          base_price: parseFloat(basePrice) || 0,
          formula_type: formulaType,
          wet_sample_weight_g: parseFloat(wetWeightG),
          pricing_mode: pricingMode,
          price_tiers: pricingMode === 'tiered' ? tiersToSave : [],
          date: new Date().toISOString().split('T')[0]
        });
      }

      // Check if saved to Supabase or only localStorage (column migration pending)
      const savedToSupabase = savedResult && !savedResult._localOnly;
      if (pricingMode === 'tiered' && savedResult?.pricing_mode === undefined) {
        // Supabase doesn't have new columns yet — saved locally
        setSuccessMsg('บันทึกสำเร็จ (เก็บใน localStorage) ⚠️ กรุณารัน SQL migration ใน Supabase เพื่อ sync ข้ามอุปกรณ์');
      } else {
        setSuccessMsg('บันทึกการตั้งค่าราคาและสูตรเรียบร้อยแล้ว ✅');
      }
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error(err);
      // saveDailySettings no longer throws — if we still get here it's a validation/network issue
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + (err?.message || 'ไม่ทราบสาเหตุ'));

    } finally {
      setSavingSettings(false);
    }
  };

  // Summary of current tiered pricing for display
  const activeTiersSummary = pricingMode === 'tiered' && priceTiers.filter(t => t.price_per_kg);

  return (
    <div className="card">
      <div className="header">
        <h2>🏪 ตั้งค่าโปรไฟล์ร้านค้า / ลานรับซื้อยาง</h2>
        <p>ข้อมูลนี้จะนำไปแสดงในบิลรับซื้อและสลิปใบเสร็จอัตโนมัติ</p>
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', color: '#15803d', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', fontWeight: '600' }}>
          ✅ {successMsg}
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>ชื่อร้านรับซื้อ / ลานรับซื้อ <span style={{ color: '#ef4444' }}>*</span></label>
            <input type="text" name="storeName" value={storeData.storeName} onChange={handleChange} className="form-input" required />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>เบอร์โทรศัพท์ติดต่อร้านค้า <span style={{ color: '#ef4444' }}>*</span></label>
            <input type="tel" name="phone" value={storeData.phone} onChange={handleChange} className="form-input" required />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>ที่อยู่ / พิกัดที่ตั้งลานรับซื้อ</label>
            <textarea name="address" value={storeData.address} onChange={handleChange} className="form-input" rows="3" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>เลขประจำตัวผู้เสียภาษี (ไม่บังคับ)</label>
            <input type="text" name="taxId" value={storeData.taxId} onChange={handleChange} className="form-input" placeholder="เช่น 0105551234567" />
          </div>
        </div>
        <button type="submit" disabled={saving} className="btn btn-primary" style={{ width: '100%', marginTop: '2rem' }}>
          {saving ? 'กำลังบันทึกข้อมูล...' : '💾 บันทึกข้อมูลร้านค้า'}
        </button>
      </form>

      {/* ===== DAILY SETTINGS ===== */}
      <div className="header" style={{ marginTop: '3rem' }}>
        <h2>⚙️ ตั้งค่าราคาและสูตร (Daily Settings)</h2>
        <p>ตั้งราคารับซื้อประจำวันและปริมาณน้ำหนักสุ่มตรวจมาตรฐาน</p>
      </div>

      <form onSubmit={handleSaveDailySettings}>
        <div className="form-grid">
          {/* Wet weight + Formula */}
          <div className="form-group">
            <label>น้ำหนักตัวอย่างเปียกตรวจ DRC (กรัม) <span style={{ color: '#ef4444' }}>*</span></label>
            <div className="input-with-icon">
              <input type="number" step="0.1" className="form-input" placeholder="10" value={wetWeightG} onChange={e => setWetWeightG(e.target.value)} required />
              <span className="input-unit">กรัม</span>
            </div>
          </div>
          <div className="form-group">
            <label>สูตรคำนวณ DRC</label>
            <select className="form-input" value={formulaType} onChange={e => setFormulaType(e.target.value)}>
              <option value="standard">มาตรฐาน (น้ำหนักแห้ง / เปียก × 100)</option>
            </select>
          </div>

          {/* Pricing Mode Toggle */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>รูปแบบราคารับซื้อ</label>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              {[
                { value: 'flat', icon: '💰', label: 'ราคาเดียว (Flat Price)', desc: 'ราคาเดิม ไม่แยกตาม %DRC' },
                { value: 'tiered', icon: '📊', label: 'ราคาตามช่วง %DRC (Tiered)', desc: 'แยกราคาตามคุณภาพยาง' }
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPricingMode(opt.value)}
                  style={{
                    flex: 1, padding: '0.85rem', borderRadius: '10px', cursor: 'pointer',
                    border: pricingMode === opt.value ? '2px solid #16a34a' : '1px solid #cbd5e1',
                    background: pricingMode === opt.value ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : '#fff',
                    textAlign: 'left', transition: 'all 0.15s'
                  }}
                >
                  <div style={{ fontWeight: '700', fontSize: '0.9rem', color: pricingMode === opt.value ? '#14532d' : '#374151' }}>
                    {opt.icon} {opt.label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* FLAT MODE: single base price */}
          {pricingMode === 'flat' && (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>ราคายางพาราวันนี้ (บาท/กก.) <span style={{ color: '#ef4444' }}>*</span></label>
              <div className="input-with-icon">
                <input type="number" step="0.01" className="form-input" placeholder="เช่น 75.50" value={basePrice} onChange={e => setBasePrice(e.target.value)} />
                <span className="input-unit">บาท</span>
              </div>
            </div>
          )}

          {/* TIERED MODE: tier table */}
          {pricingMode === 'tiered' && (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.95rem' }}>
                📊 ตารางราคาตามช่วง %DRC
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '400', marginLeft: '0.5rem' }}>
                  (tier บนสุด = %DRC สูงสุด / ไม่มีเพดาน)
                </span>
              </label>

              <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: '#f0fdf4', borderBottom: '2px solid #86efac' }}>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '700', color: '#166534' }}>ชื่อเกรด</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '700', color: '#166534' }}>%DRC ต่ำสุด</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '700', color: '#166534' }}>%DRC สูงสุด</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '700', color: '#166534' }}>ราคา (บาท/กก.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceTiers.map((tier, idx) => (
                      <tr key={tier.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <input
                            type="text"
                            className="form-input"
                            value={tier.label}
                            onChange={e => handleTierChange(tier.id, 'label', e.target.value)}
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.82rem' }}
                            placeholder="ชื่อเกรด"
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            value={tier.drc_min}
                            onChange={e => handleTierChange(tier.id, 'drc_min', e.target.value)}
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.82rem', textAlign: 'center', width: '80px' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          {tier.drc_max == null ? (
                            <span style={{ fontWeight: '700', color: '#16a34a', fontSize: '1rem' }}>∞</span>
                          ) : (
                            <input
                              type="number"
                              step="0.01"
                              className="form-input"
                              value={tier.drc_max}
                              onChange={e => handleTierChange(tier.id, 'drc_max', e.target.value)}
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.82rem', textAlign: 'center', width: '80px' }}
                            />
                          )}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}>
                            <input
                              type="number"
                              step="0.01"
                              className="form-input"
                              placeholder="0.00"
                              value={tier.price_per_kg}
                              onChange={e => handleTierChange(tier.id, 'price_per_kg', e.target.value)}
                              style={{
                                padding: '0.35rem 0.5rem', fontSize: '0.9rem', textAlign: 'right', width: '90px',
                                borderColor: (!tier.price_per_kg || parseFloat(tier.price_per_kg) <= 0) ? '#fca5a5' : '#86efac',
                                fontWeight: '700'
                              }}
                            />
                            <span style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>฿/กก.</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Preview hint for tiered */}
              <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.85rem', background: '#fef9c3', borderRadius: '8px', border: '1px solid #fde047', fontSize: '0.8rem', color: '#713f12' }}>
                💡 <strong>หมายเหตุ:</strong> ถ้า %DRC จริงไม่อยู่ในช่วงใดเลย ระบบจะแจ้งเตือนเสมียนให้กรอกราคาเอง (แจ้งเตือน + บันทึก log ผู้รับผิดชอบ)
              </div>

              {/* base_price for flat fallback (hidden but still saved) */}
              <input type="hidden" value={basePrice} />
            </div>
          )}
        </div>

        <button type="submit" disabled={savingSettings} className="btn btn-primary" style={{ width: '100%', marginTop: '2rem' }}>
          {savingSettings ? 'กำลังบันทึกตั้งค่า...' : '💾 บันทึกตั้งค่าประจำวัน'}
        </button>
      </form>

      {dailySettings && (
        <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.88rem', color: '#166534' }}>
          {dailySettings.pricing_mode === 'tiered' && dailySettings.price_tiers?.length > 0 ? (
            <>
              <div style={{ fontWeight: '700', marginBottom: '0.5rem' }}>📊 ราคา Tier ที่ใช้อยู่วันนี้:</div>
              {dailySettings.price_tiers.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.2rem 0' }}>
                  <span>🌿 {t.label} ({t.drc_min}–{t.drc_max ?? '∞'}%)</span>
                  <span style={{ fontWeight: '700' }}>฿{parseFloat(t.price_per_kg).toFixed(2)}/กก.</span>
                </div>
              ))}
            </>
          ) : (
            <span>🟢 <strong>ตั้งค่าปัจจุบัน (วันนี้):</strong> ราคา ฿{dailySettings.base_price}/กก. | น้ำหนักสุ่มเปียก {dailySettings.wet_sample_weight_g}ก.</span>
          )}
        </div>
      )}
    </div>
  );
}

export default StoreRegistration;
