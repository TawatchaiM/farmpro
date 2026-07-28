import React, { useState, useEffect } from 'react';
import { db } from '../supabase';

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
  const [wetWeightG, setWetWeightG] = useState(dailySettings?.wet_sample_weight_g || 50);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (currentUser) {
      const storeProfileRaw = localStorage.getItem('farmpro_store_profile');
      const storeProfile = storeProfileRaw ? JSON.parse(storeProfileRaw) : null;

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

  const handleChange = (e) => {
    setStoreData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');

    try {
      const updatePayload = {
        store_name: storeData.storeName,
        store_phone: storeData.phone,
        tax_id: storeData.taxId
      };

      // DO NOT update currentUser profile to avoid data contamination with Seller profile!
      // Only cache in farmpro_store_profile for local print receipt reference
      localStorage.setItem('farmpro_store_profile', JSON.stringify({
        storeName: storeData.storeName,
        phone: storeData.phone,
        address: storeData.address,
        taxId: storeData.taxId
      }));

      if (onUpdateProfile) {
        onUpdateProfile({ ...currentUser });
      }

      setSuccessMsg('บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to save store registration:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลร้านค้า');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDailySettings = async (e) => {
    e.preventDefault();
    if (!basePrice || basePrice <= 0) {
      alert('กรุณากรอกราคาประเมินประจำวันให้ถูกต้อง');
      return;
    }
    setSavingSettings(true);
    try {
      if (onSaveSettings) {
        await onSaveSettings({
          base_price: parseFloat(basePrice),
          formula_type: formulaType,
          wet_sample_weight_g: parseFloat(wetWeightG),
          date: new Date().toISOString().split('T')[0]
        });
      }
      setSuccessMsg('บันทึกการตั้งค่าราคาและสูตรเรียบร้อยแล้ว');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="card">
      <div className="header">
        <h2>🏪 ตั้งค่าโปรไฟล์ร้านค้า / ลานรับซื้อยาง</h2>
        <p>ข้อมูลนี้จะนำไปแสดงในบิลรับซื้อและสลิปใบเสร็จอัตโนมัติ</p>
      </div>

      {successMsg && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.15)',
          border: '1px solid #22c55e',
          color: '#15803d',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          marginBottom: '1.25rem',
          fontWeight: '600'
        }}>
          ✅ {successMsg}
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>ชื่อร้านรับซื้อ / ลานรับซื้อ <span style={{ color: '#ef4444' }}>*</span></label>
            <input 
              type="text" 
              name="storeName" 
              value={storeData.storeName} 
              onChange={handleChange} 
              className="form-input" 
              required
            />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>เบอร์โทรศัพท์ติดต่อร้านค้า <span style={{ color: '#ef4444' }}>*</span></label>
            <input 
              type="tel" 
              name="phone" 
              value={storeData.phone} 
              onChange={handleChange} 
              className="form-input" 
              required
            />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>ที่อยู่ / พิกัดที่ตั้งลานรับซื้อ</label>
            <textarea 
              name="address" 
              value={storeData.address} 
              onChange={handleChange} 
              className="form-input" 
              rows="3"
            />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>เลขประจำตัวผู้เสียภาษี (ไม่บังคับ)</label>
            <input 
              type="text" 
              name="taxId" 
              value={storeData.taxId} 
              onChange={handleChange} 
              className="form-input" 
              placeholder="เช่น 0105551234567"
            />
          </div>
        </div>
        
        <button 
          type="submit" 
          disabled={saving}
          className="btn btn-primary" 
          style={{ width: '100%', marginTop: '2rem' }}
        >
          {saving ? 'กำลังบันทึกข้อมูล...' : '💾 บันทึกข้อมูลร้านค้า'}
        </button>
      </form>

      <div className="header" style={{ marginTop: '3rem' }}>
        <h2>⚙️ ตั้งค่าราคาและสูตร (Daily Settings)</h2>
        <p>ตั้งราคารับซื้อประจำวันและปริมาณน้ำหนักสุ่มตรวจมาตรฐาน</p>
      </div>

      <form onSubmit={handleSaveDailySettings}>
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>ราคายางพาราวันนี้ (บาท/กก.) <span style={{ color: '#ef4444' }}>*</span></label>
            <div className="input-with-icon">
              <input 
                type="number" 
                step="0.01" 
                className="form-input" 
                placeholder="เช่น 75.50" 
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                required
              />
              <span className="input-unit">บาท</span>
            </div>
          </div>
          
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>น้ำหนักตัวอย่างเปียกตรวจ DRC (กรัม) <span style={{ color: '#ef4444' }}>*</span></label>
            <div className="input-with-icon">
              <input 
                type="number" 
                step="0.1" 
                className="form-input" 
                placeholder="50" 
                value={wetWeightG}
                onChange={(e) => setWetWeightG(e.target.value)}
                required
              />
              <span className="input-unit">กรัม</span>
            </div>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>สูตรคำนวณ DRC</label>
            <select 
              className="form-input" 
              value={formulaType} 
              onChange={(e) => setFormulaType(e.target.value)}
            >
              <option value="standard">มาตรฐาน (น้ำหนักแห้ง / เปียก * 100)</option>
            </select>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={savingSettings}
          className="btn btn-primary" 
          style={{ width: '100%', marginTop: '2rem' }}
        >
          {savingSettings ? 'กำลังบันทึกตั้งค่า...' : '💾 บันทึกตั้งค่าประจำวัน'}
        </button>
      </form>

      {dailySettings && (
        <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.95rem', color: '#166534' }}>
          🟢 <strong>ตั้งค่าปัจจุบัน (วันนี้):</strong> ราคา ฿{dailySettings.base_price}/กก. | น้ำหนักสุ่มเปียก {dailySettings.wet_sample_weight_g}ก.
        </div>
      )}
    </div>
  );
}

export default StoreRegistration;
