import React, { useState, useEffect, useRef } from 'react';
import { db, supabase } from '../supabase';
import QRCode from 'qrcode';
import { getOrCreateSeed, generateDailyToken, buildLabUrl, revokeSeed } from '../utils/labToken';
import CollapsibleSection from './CollapsibleSection';

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

  // ---- QR Code Lab State ----
  const [showQrModal, setShowQrModal] = useState(false);
  const [labQrDataUrl, setLabQrDataUrl] = useState('');
  const [labUrl, setLabUrl] = useState('');
  const [qrCopied, setQrCopied] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (currentUser) {
      const storeProfile = JSON.parse(localStorage.getItem('farmpro_store_profile') || '{}') || {};
      const addr = [
        currentUser?.address_details,
        currentUser?.subdistrict ? `ต.${currentUser.subdistrict}` : '',
        currentUser?.district ? `อ.${currentUser.district}` : '',
        currentUser?.province ? `จ.${currentUser.province}` : '',
        currentUser?.postal_code
      ].filter(Boolean).join(' ');
      setStoreData({
        storeName: storeProfile?.storeName || currentUser?.store_name || currentUser?.full_name || 'ร้านรับซื้อยาง FarmPro',
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

  const handleAddTier = () => {
    const newId = 't' + Date.now();
    setPriceTiers(prev => [
      { id: newId, label: 'เกรดใหม่', drc_min: 0, drc_max: 0, price_per_kg: '' },
      ...prev
    ]);
  };

  const handleRemoveTier = (id) => {
    if (priceTiers.length <= 1) {
      alert('ต้องมีอย่างน้อย 1 ช่วงราคา');
      return;
    }
    setPriceTiers(prev => prev.filter(t => t.id !== id));
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
        drc_min: parseFloat(t.drc_min) || 0,
        drc_max: t.drc_max != null && t.drc_max !== '' ? parseFloat(t.drc_max) : null,
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

  // ---- QR Code Handlers ----
  const shopId = currentUser?.id || currentUser?.user_id || 'unknown-shop';

  const handleShowQr = async () => {
    const seed = getOrCreateSeed();
    const token = generateDailyToken(shopId, seed);
    const shopName = storeData.storeName || 'ลานรับซื้อยาง';
    const url = buildLabUrl(shopId, token, seed, shopName);
    setLabUrl(url);
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 300, margin: 2,
        color: { dark: '#14532d', light: '#f0fdf4' }
      });
      setLabQrDataUrl(dataUrl);
      setShowQrModal(true);
    } catch (err) {
      console.error('QR generate error:', err);
      alert('เกิดข้อผิดพลาดในการสร้าง QR Code');
    }
  };

  const handlePrintQr = () => {
    const printWin = window.open('', '_blank');
    const today = new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    printWin.document.write(`
      <html><head><title>QR Code ห้องตรวจ DRC</title><style>
        body { font-family: 'Noto Sans Thai', Arial, sans-serif; text-align: center; padding: 40px; background: #fff; }
        h1 { font-size: 24px; color: #14532d; margin-bottom: 4px; }
        .shop { font-size: 18px; color: #166534; font-weight: bold; margin-bottom: 4px; }
        h2 { font-size: 15px; color: #64748b; margin-bottom: 20px; font-weight: normal; }
        img { border: 3px solid #16a34a; border-radius: 16px; padding: 12px; background: #f0fdf4; }
        .date { color: #64748b; font-size: 13px; margin-top: 16px; }
        .warning { background: #fef9c3; border: 1px solid #fde047; color: #713f12; padding: 10px 16px; border-radius: 8px; font-size: 12px; margin-top: 20px; }
        .url { font-size: 9px; color: #94a3b8; margin-top: 10px; word-break: break-all; }
      </style></head><body>
        <h1>🔬 ห้องตรวจ DRC (แล็บ)</h1>
        <div class="shop">🏢 ${storeData.storeName || 'ลานรับซื้อยาง'}</div>
        <h2>สแกน QR Code เพื่อเข้าใช้งานระบบ</h2>
        <img src="${labQrDataUrl}" width="280" />
        <div class="date">📅 ใช้ได้วันที่: ${today}</div>
        <div class="warning">⚠️ QR Code นี้หมดอายุภายใน 24 ชั่วโมง กรุณาสแกน QR ใหม่ในวันถัดไป</div>
        <div class="url">${labUrl}</div>
      </body></html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
  };

  const handleRevokeToken = () => {
    if (!window.confirm('⚠️ ยืนยันการรีเซ็ตการเข้าถึง?\n\nQR Code เก่าจะใช้ไม่ได้ทันที\nต้องสแกน QR Code ใหม่เท่านั้น')) return;
    revokeSeed();
    setShowQrModal(false);
    setLabQrDataUrl('');
    setLabUrl('');
    setSuccessMsg('รีเซ็ตสิทธิ์เรียบร้อยแล้ว สร้าง QR Code ใหม่ได้เลย ✅');
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(labUrl).then(() => {
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 2000);
    });
  };

  const handleLoadYesterdaySettings = async () => {
    setSavingSettings(true);
    try {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yesterdayStr = d.toISOString().split('T')[0];
      
      const yesterdaySettings = await db.getDailySettings(yesterdayStr);
      
      if (yesterdaySettings) {
        setBasePrice(yesterdaySettings.base_price || '');
        setFormulaType(yesterdaySettings.formula_type || 'standard');
        setWetWeightG(yesterdaySettings.wet_sample_weight_g || 10);
        setPricingMode(yesterdaySettings.pricing_mode || 'flat');
        if (yesterdaySettings.price_tiers?.length > 0) {
          setPriceTiers(yesterdaySettings.price_tiers);
        }
        setSuccessMsg(`คัดลอกตั้งค่าของเมื่อวาน (${yesterdayStr}) มาแล้ว (กรุณาตรวจสอบและกดบันทึก)`);
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        alert(`ไม่พบประวัติการตั้งค่าของเมื่อวาน (${yesterdayStr})`);
      }
    } catch (err) {
      console.error('Failed to load yesterday settings', err);
      alert('เกิดข้อผิดพลาดในการดึงข้อมูลของวันก่อนหน้า');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExportData = async (tableName) => {
    try {
      let dataList = [];
      const storeId = currentUser?.id;
      
      if (tableName === 'rubber_transactions') {
        if (supabase) {
          const { data, error } = await supabase.from('rubber_transactions').select('*').eq('buyer_id', storeId);
          if (!error && data) dataList = data;
        }
        if (dataList.length === 0) {
          const localData = JSON.parse(localStorage.getItem('farmpro_transactions') || '[]');
          dataList = localData.filter(tx => tx.buyer_id === storeId);
        }
      } else if (tableName === 'daily_settings') {
        if (supabase) {
          const { data, error } = await supabase.from('daily_settings').select('*').eq('store_owner_id', storeId);
          if (!error && data) dataList = data;
        }
        if (dataList.length === 0) {
          const localData = JSON.parse(localStorage.getItem('farmpro_daily_settings') || '[]');
          dataList = localData.filter(s => s.store_owner_id === storeId);
        }
      }

      if (!dataList || dataList.length === 0) {
        alert(`ไม่พบข้อมูลในตาราง ${tableName} เพื่อส่งออก`);
        return;
      }

      const keys = Object.keys(dataList[0]);
      const header = keys.join(',');
      const rows = dataList.map(obj => keys.map(k => `"${String(obj[k] !== null && obj[k] !== undefined ? obj[k] : '').replace(/"/g, '""')}"`).join(','));
      const csvContent = [header, ...rows].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `backup_${tableName}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
    } catch (err) {
      console.error('Export failed:', err);
      alert('เกิดข้อผิดพลาดในการดึงข้อมูล Backup');
    }
  };

  return (
    <div>
      <CollapsibleSection
        id="store_profile"
        title="ตั้งค่าโปรไฟล์ร้านค้า / ลานรับซื้อยาง"
        subtitle="ข้อมูลนี้จะนำไปแสดงในบิลรับซื้อและสลิปใบเสร็จอัตโนมัติ"
        icon="🏪"
        defaultExpanded={false}
      >
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
            <input type="tel" inputMode="numeric" pattern="[0-9]*" name="phone" value={storeData.phone} onChange={handleChange} className="form-input" required />
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
      </CollapsibleSection>

      {/* ===== DAILY SETTINGS ===== */}
      <CollapsibleSection
        id="daily_settings"
        title="ตั้งค่าราคาและสูตร (Daily Settings)"
        subtitle="ตั้งราคารับซื้อประจำวันและปริมาณน้ำหนักสุ่มตรวจมาตรฐาน"
        icon="⚙️"
        defaultExpanded={true}
      >
      <form onSubmit={handleSaveDailySettings}>
        <div className="form-grid">
          {/* Wet weight + Formula */}
          <div className="form-group">
            <label>น้ำหนักตัวอย่างเปียกตรวจ DRC (กรัม) <span style={{ color: '#ef4444' }}>*</span></label>
            <div className="input-with-icon">
              <input type="number" inputMode="decimal" step="0.1" className="form-input" placeholder="10" value={wetWeightG} onChange={e => setWetWeightG(e.target.value)} required />
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
                <input type="number" inputMode="decimal" step="0.01" className="form-input" placeholder="เช่น 75.50" value={basePrice} onChange={e => setBasePrice(e.target.value)} />
                <span className="input-unit">บาท</span>
              </div>
            </div>
          )}

          {/* TIERED MODE: tier table */}
          {pricingMode === 'tiered' && (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.95rem', margin: 0 }}>
                  📊 ตารางราคาตามช่วง %DRC
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '400', marginLeft: '0.5rem' }}>
                    (tier บนสุด = %DRC สูงสุด / ไม่มีเพดาน)
                  </span>
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    type="button" 
                    onClick={handleLoadYesterdaySettings}
                    disabled={savingSettings}
                    style={{
                      background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1',
                      borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.85rem',
                      display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontWeight: '600'
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>🔄</span> ดึงราคาของเมื่อวาน
                  </button>
                  <button
                    type="button"
                    onClick={handleAddTier}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem',
                      background: '#f0fdf4', color: '#166534', border: '1px dashed #86efac',
                      borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600'
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>+</span> เพิ่มช่วงราคา
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: '#f0fdf4', borderBottom: '2px solid #86efac' }}>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '700', color: '#166534' }}>ชื่อเกรด</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '700', color: '#166534' }}>%DRC ต่ำสุด</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '700', color: '#166534' }}>%DRC สูงสุด</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '700', color: '#166534' }}>ราคา (บาท/กก.)</th>
                      <th style={{ padding: '0.6rem 0.75rem', width: '40px' }}></th>
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
                            inputMode="decimal"
                            step="0.01"
                            className="form-input"
                            value={tier.drc_min}
                            onChange={e => handleTierChange(tier.id, 'drc_min', e.target.value)}
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.82rem', textAlign: 'center', width: '80px' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          {tier.drc_max == null ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                              <span style={{ fontWeight: '700', color: '#16a34a', fontSize: '1.2rem', lineHeight: 1 }}>∞</span>
                              <button type="button" onClick={() => handleTierChange(tier.id, 'drc_max', 100)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '4px', cursor: 'pointer', padding: '0.2rem 0.4rem', fontSize: '0.75rem', color: '#64748b' }} title="กำหนดค่าสูงสุด">✏️</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                className="form-input"
                                value={tier.drc_max}
                                onChange={e => handleTierChange(tier.id, 'drc_max', e.target.value)}
                                style={{ padding: '0.35rem 0.5rem', fontSize: '0.82rem', textAlign: 'center', width: '70px' }}
                              />
                              <button type="button" onClick={() => handleTierChange(tier.id, 'drc_max', null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '4px', cursor: 'pointer', padding: '0.2rem 0.4rem', fontSize: '0.8rem', fontWeight: 'bold', color: '#16a34a' }} title="ไม่มีเพดาน (Infinity)">∞</button>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}>
                            <input
                              type="number"
                              inputMode="decimal"
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
                        <td style={{ padding: '0.5rem 0.2rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveTier(tier.id)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem', opacity: 0.7 }}
                            title="ลบช่วงราคานี้"
                            onMouseOver={e => e.target.style.opacity = 1}
                            onMouseOut={e => e.target.style.opacity = 0.7}
                          >
                            🗑️
                          </button>
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
      </CollapsibleSection>

      {/* ===== QR CODE LAB MANAGEMENT ===== */}
      <CollapsibleSection
        id="qr_lab"
        title="จัดการห้องตรวจ DRC (แล็บ)"
        subtitle="สร้าง QR Code สำหรับให้พนักงานแล็บสแกนเข้าทำงานโดยไม่ต้องสมัครสมาชิก"
        icon="🔬"
        defaultExpanded={false}
      >
      <div style={{
        background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
        border: '1px solid #86efac', borderRadius: '16px', padding: '1.5rem'
      }}>
        {/* Info badges */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {[
            { icon: '⏰', text: 'Token หมดอายุอัตโนมัติ 24 ชม.' },
            { icon: '🔒', text: 'Revoke ได้ทันที' },
            { icon: '📱', text: 'สแกนผ่านมือถือ ไม่ต้องสมัคร' },
          ].map((b, i) => (
            <span key={i} style={{
              background: '#fff', border: '1px solid #bbf7d0', color: '#166534',
              padding: '0.3rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600'
            }}>
              {b.icon} {b.text}
            </span>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleShowQr}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.25rem' }}
          >
            <span style={{ fontSize: '1.2rem' }}>📱</span>
            <span>สร้าง / ดู QR Code ประจำวัน</span>
          </button>

          {labQrDataUrl && (
            <button
              type="button"
              onClick={handlePrintQr}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.25rem',
                background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '10px',
                cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem'
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>🖨️</span>
              <span>พิมพ์ QR Code ติดหน้าห้องตรวจ</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRevokeToken}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.25rem',
              background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1.5px solid #fca5a5',
              borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem'
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>🔄</span>
            <span>รีเซ็ตการเข้าถึง (Revoke)</span>
          </button>
        </div>
      </div>
      </CollapsibleSection>

      {/* ===== DATA BACKUP & EXPORT ===== */}
      <CollapsibleSection
        id="data_backup"
        title="สำรองและส่งออกข้อมูล (Backup)"
        subtitle="ดาวน์โหลดข้อมูลรายการรับซื้อและตั้งค่าต่างๆ ออกมาเป็นไฟล์ Excel (CSV)"
        icon="💾"
        defaultExpanded={false}
      >
        <div style={{
          background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
          border: '1px solid #bfdbfe', borderRadius: '16px', padding: '1.5rem'
        }}>
          <p style={{ color: '#1e40af', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            ฟีเจอร์นี้ช่วยให้คุณดึงข้อมูลทั้งหมดจากระบบออนไลน์ (หรือออฟไลน์) ออกมาเก็บไว้ในเครื่องเพื่อป้องกันข้อมูลสูญหาย หรือใช้เปิดดูในโปรแกรม Excel ได้ครับ
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleExportData('rubber_transactions')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem',
                background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px',
                cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem', flex: '1 1 auto', justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>📥</span>
              ส่งออกรายการรับซื้อ (Transactions)
            </button>
            <button
              type="button"
              onClick={() => handleExportData('daily_settings')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem',
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '10px',
                cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem', flex: '1 1 auto', justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>⚙️</span>
              ส่งออกการตั้งค่าร้าน (Daily Settings)
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* QR Code Modal */}
      {showQrModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: '#fff', borderRadius: '24px', padding: '2rem',
            width: '100%', maxWidth: '480px', boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowQrModal(false)}
              style={{
                position: 'absolute', top: '1rem', right: '1rem',
                background: '#f1f5f9', border: 'none', borderRadius: '50%',
                width: '32px', height: '32px', cursor: 'pointer', fontSize: '1rem', color: '#64748b'
              }}
            >✕</button>

            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ color: '#14532d', fontSize: '1.2rem', margin: '0 0 0.2rem' }}>🔬 QR Code ห้องตรวจ DRC</h2>
              <div style={{ color: '#166534', fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.3rem' }}>
                🏢 {storeData.storeName || 'ลานรับซื้อยาง'}
              </div>
              <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>
                📅 ใช้ได้วันนี้เท่านั้น — หมดอายุเที่ยงคืนโดยอัตโนมัติ
              </p>
            </div>

            {/* QR Image */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <img
                src={labQrDataUrl}
                alt="Lab Station QR Code"
                style={{
                  width: 260, height: 260, borderRadius: '16px',
                  border: '3px solid #16a34a', padding: '10px', background: '#f0fdf4'
                }}
              />
            </div>

            {/* URL copy */}
            <div style={{
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px',
              padding: '0.6rem 0.85rem', marginBottom: '1rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              <span style={{ flex: 1, fontSize: '0.7rem', color: '#64748b', wordBreak: 'break-all', lineHeight: '1.4' }}>
                {labUrl}
              </span>
              <button
                onClick={handleCopyUrl}
                style={{
                  flexShrink: 0, background: qrCopied ? '#16a34a' : '#e2e8f0',
                  color: qrCopied ? '#fff' : '#374151', border: 'none',
                  borderRadius: '7px', padding: '0.35rem 0.65rem', cursor: 'pointer',
                  fontSize: '0.75rem', fontWeight: '700', transition: 'all 0.2s'
                }}
              >
                {qrCopied ? '✅ คัดลอกแล้ว' : '📋 คัดลอก'}
              </button>
            </div>

            {/* Warning */}
            <div style={{
              background: '#fef9c3', border: '1px solid #fde047', borderRadius: '8px',
              padding: '0.6rem 0.85rem', fontSize: '0.78rem', color: '#713f12', marginBottom: '1.25rem'
            }}>
              ⚠️ <strong>ข้อควรระวัง:</strong> อย่าแชร์ QR Code นี้นอกร้าน ถ้าสงสัยการเข้าถึงโดยไม่ได้รับอนุญาต ให้กด "รีเซ็ตการเข้าถึง" ทันที
            </div>

            {/* Modal Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handlePrintQr}
                style={{
                  flex: 1, padding: '0.75rem', background: '#1d4ed8', color: '#fff',
                  border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem'
                }}
              >
                🖨️ พิมพ์ QR Code
              </button>
              <button
                onClick={handleRevokeToken}
                style={{
                  flex: 1, padding: '0.75rem', background: 'rgba(239,68,68,0.1)',
                  color: '#dc2626', border: '1.5px solid #fca5a5',
                  borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem'
                }}
              >
                🔄 Revoke & สร้างใหม่
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StoreRegistration;
