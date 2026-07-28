import React, { useState, useMemo } from 'react';
import { X, Save, User, Phone, Store, MapPin, Clock, FileText, CheckCircle, Search } from 'lucide-react';
import { provinces as THAI_PROVINCES, districts as THAI_DISTRICTS, subDistricts as THAI_SUBDISTRICTS } from '@bilions/thailand-address';
import { db } from '../supabase';

function EditProfileModal({ profile, activePortal, onClose, onSaveSuccess }) {
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [storeName, setStoreName] = useState(profile?.store_name || '');
  const [businessHours, setBusinessHours] = useState(profile?.business_hours || '');
  const [vendorCategory, setVendorCategory] = useState(profile?.vendor_category || '');
  const [vendorDescription, setVendorDescription] = useState(profile?.vendor_description || '');
  const [rubberTypes, setRubberTypes] = useState(profile?.rubber_types ? profile.rubber_types.split(',') : []);
  
  // Address States
  const [addressDetails, setAddressDetails] = useState(profile?.address_details || '');
  const [province, setProvince] = useState(profile?.province || '');
  const [district, setDistrict] = useState(profile?.district || '');
  const [subdistrict, setSubdistrict] = useState(profile?.subdistrict || '');
  const [postalCode, setPostalCode] = useState(profile?.postal_code || '');

  // Quick Address Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Thailand Geographic Data Cascading Helpers
  const sortedProvinces = useMemo(() => {
    return [...THAI_PROVINCES].sort((a, b) => a.name_in_thai.localeCompare(b.name_in_thai, 'th'));
  }, []);

  const availableDistricts = useMemo(() => {
    if (!province) return [];
    const provObj = THAI_PROVINCES.find(p => p.name_in_thai === province);
    if (!provObj) return [];
    return THAI_DISTRICTS.filter(d => d.province_id === provObj.id)
      .sort((a, b) => a.name_in_thai.localeCompare(b.name_in_thai, 'th'));
  }, [province]);

  const availableSubdistricts = useMemo(() => {
    if (!province || !district) return [];
    const provObj = THAI_PROVINCES.find(p => p.name_in_thai === province);
    if (!provObj) return [];
    const distObj = THAI_DISTRICTS.find(d => d.province_id === provObj.id && d.name_in_thai === district);
    if (!distObj) return [];
    return THAI_SUBDISTRICTS.filter(s => s.district_id === distObj.id)
      .sort((a, b) => a.name_in_thai.localeCompare(b.name_in_thai, 'th'));
  }, [province, district]);

  const handleProvinceSelect = (newProvince) => {
    setProvince(newProvince);
    setDistrict('');
    setSubdistrict('');
    setPostalCode('');
  };

  const handleDistrictSelect = (newDistrict) => {
    setDistrict(newDistrict);
    setSubdistrict('');
    setPostalCode('');
  };

  const handleSubdistrictSelect = (newSubdistrict) => {
    setSubdistrict(newSubdistrict);
    const subObj = availableSubdistricts.find(s => s.name_in_thai === newSubdistrict);
    if (subObj && subObj.zip_code) {
      setPostalCode(subObj.zip_code.toString());
    }
  };

  const handleQuickAddressSearch = (query) => {
    setSearchQuery(query);
    if (query.trim().length > 1) {
      const q = query.trim().toLowerCase();
      const matches = THAI_SUBDISTRICTS.filter(s => 
        s.name_in_thai.toLowerCase().includes(q)
      ).slice(0, 10).map(s => {
        const dist = THAI_DISTRICTS.find(d => d.id === s.district_id);
        const prov = dist ? THAI_PROVINCES.find(p => p.id === dist.province_id) : null;
        return {
          subdistrict: s.name_in_thai,
          district: dist ? dist.name_in_thai : '',
          province: prov ? prov.name_in_thai : '',
          postalCode: s.zip_code ? s.zip_code.toString() : ''
        };
      });
      setAddressSuggestions(matches);
      setShowSuggestions(true);
    } else {
      setAddressSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (item) => {
    setProvince(item.province);
    setDistrict(item.district);
    setSubdistrict(item.subdistrict);
    setPostalCode(item.postalCode);
    setSearchQuery(`ตำบล${item.subdistrict} > อำเภอ${item.district} > จังหวัด${item.province}`);
    setShowSuggestions(false);
  };

  const handleRubberTypeToggle = (type) => {
    if (rubberTypes.includes(type)) {
      setRubberTypes(rubberTypes.filter(t => t !== type));
    } else {
      setRubberTypes([...rubberTypes, type]);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !phoneNumber.trim()) {
      setErrorMsg('กรุณากรอกชื่อ-นามสกุล และเบอร์โทรศัพท์');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    const updateData = {
      full_name: fullName,
      phone_number: phoneNumber,
      email: email,
      address_details: addressDetails,
      province,
      district,
      subdistrict,
      postal_code: postalCode
    };

    if ((activePortal || profile?.role) === 'vendor') {
      updateData.store_name = storeName;
      updateData.business_hours = businessHours;
      updateData.vendor_category = vendorCategory;
      updateData.vendor_description = vendorDescription;
    }

    try {
      const res = await db.updateProfile(profile.id, updateData);
      if (res.success) {
        setSuccessMsg('บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว');
        if (onSaveSuccess) {
          onSaveSuccess(res.data);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMsg('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setErrorMsg('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  const roleBadgeLabels = {
    buyer: '🏪 ลานรับซื้อยาง',
    seller: '🧑‍🌾 ชาวสวนยาง',
    vendor: '🚜 ร้านค้า / ผู้ให้บริการ'
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 10000,
      overflowY: 'auto',
      padding: '2rem 1rem',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: '#1e293b',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '720px',
        margin: '1.5rem auto',
        padding: '2rem',
        color: '#f8fafc',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        boxSizing: 'border-box',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 'bold', margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ✏️ แก้ไขข้อมูลโปรไฟล์
            </h2>
            <span style={{ fontSize: '0.8rem', background: '#dcfce7', color: '#15803d', padding: '2px 10px', borderRadius: '12px', fontWeight: '600' }}>
              {roleBadgeLabels[activePortal || profile?.role] || (activePortal || profile?.role)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#cbd5e1',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {successMsg && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.2)',
            border: '1px solid #22c55e',
            color: '#86efac',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <CheckCircle size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem'
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* General Information */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.875rem' }}>
                ชื่อ-นามสกุล / ผู้ติดต่อ <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div className="form-group">
              <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.875rem' }}>
                เบอร์โทรศัพท์ <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.875rem' }}>อีเมล</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@farmpro.com"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                padding: '0.75rem',
                borderRadius: '10px',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Conditional Vendor details */}
          {(activePortal || profile?.role) === 'vendor' && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '1.25rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ fontSize: '0.875rem', color: '#4ade80', marginBottom: '1rem', fontWeight: '600' }}>
                🏪 ข้อมูลร้านค้า / บริการ:
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.85rem' }}>
                  ชื่อร้านค้า / บริการ
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  style={{
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.85rem' }}>เวลาทำการเปิด-ปิด</label>
                <input
                  type="text"
                  value={businessHours}
                  onChange={(e) => setBusinessHours(e.target.value)}
                  placeholder="เช่น จันทร์-เสาร์ 06:00 - 18:00 น."
                  style={{
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {(activePortal || profile?.role) === 'vendor' && (
                <>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.85rem' }}>หมวดหมู่บริการ</label>
                    <select
                      value={vendorCategory}
                      onChange={(e) => setVendorCategory(e.target.value)}
                      style={{
                        background: '#0f172a',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        padding: '0.75rem',
                        borderRadius: '10px',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="equipment">ขายเครื่องมือ / อุปกรณ์การเกษตร</option>
                      <option value="fertilizer">ขายปุ๋ย / ยาเคมีเกษตร</option>
                      <option value="services">บริการรับจ้างทางการเกษตร</option>
                      <option value="other">บริการ / ร้านค้าอื่นๆ</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.85rem' }}>รายละเอียดสินค้า / บริการ</label>
                    <textarea
                      value={vendorDescription}
                      onChange={(e) => setVendorDescription(e.target.value)}
                      rows={2}
                      style={{
                        background: '#0f172a',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        padding: '0.75rem',
                        borderRadius: '10px',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Full Thailand Geographic Location Panel */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '14px',
            padding: '1.25rem',
            marginBottom: '1.75rem'
          }}>
            <div style={{ fontSize: '0.875rem', color: '#4ade80', marginBottom: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <MapPin size={18} />
              <span>ข้อมูลที่ตั้งและที่อยู่ (ครอบคลุมทั้ง 77 จังหวัดทั่วไทย):</span>
            </div>

            {/* 1. House / Location Details */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.825rem' }}>
                บ้านเลขที่ / หมู่ / ถนน / คำอธิบายจุดสังเกต
              </label>
              <input
                type="text"
                value={addressDetails}
                onChange={(e) => setAddressDetails(e.target.value)}
                placeholder="เช่น 123/45 หมู่ 5 ถ.เพชรเกษม"
                style={{
                  background: '#1e293b',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  color: '#fff',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  width: '100%',
                  boxSizing: 'border-box',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {/* 2. Quick Search Auto-complete Input */}
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.825rem' }}>
                ⚡ หรือพิมพ์ค้นหาชื่อตำบลด่วน (เติมจังหวัด/อำเภอ/รหัสไปรษณีย์ให้อัตโนมัติ):
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleQuickAddressSearch(e.target.value)}
                  onFocus={() => { if (searchQuery.trim().length > 1) setShowSuggestions(true); }}
                  placeholder="พิมพ์ชื่อตำบล (เช่น พุนพิน, สะเดา, ละงู, แกลง, หาดใหญ่)..."
                  style={{
                    background: '#1e293b',
                    border: '1px solid #4ade80',
                    color: '#fff',
                    padding: '0.75rem 0.85rem 0.75rem 2.4rem',
                    borderRadius: '10px',
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: '0.875rem'
                  }}
                />
                <Search size={16} color="#4ade80" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
              </div>

              {showSuggestions && addressSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#0f172a',
                  border: '1px solid #4ade80',
                  borderRadius: '10px',
                  marginTop: '0.25rem',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  zIndex: 100,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.7)'
                }}>
                  {addressSuggestions.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => selectSuggestion(item)}
                      style={{
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        borderBottom: idx < addressSuggestions.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        fontSize: '0.85rem',
                        color: '#f1f5f9'
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'rgba(74, 222, 128, 0.15)'}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                      📍 ตำบล{item.subdistrict} &gt; อำเภอ{item.district} &gt; จังหวัด{item.province} ({item.postalCode})
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Province Cascading Dropdown */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.825rem' }}>
                จังหวัด <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={province}
                onChange={(e) => handleProvinceSelect(e.target.value)}
                required
                style={{
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  width: '100%',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                <option value="">-- กรุณาเลือกจังหวัด (77 จังหวัด) --</option>
                {sortedProvinces.map((p) => (
                  <option key={p.id} value={p.name_in_thai}>
                    {p.name_in_thai}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. District & 5. Subdistrict Dropdowns Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.825rem' }}>
                  อำเภอ / เขต <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={district}
                  onChange={(e) => handleDistrictSelect(e.target.value)}
                  disabled={!province}
                  required
                  style={{
                    background: province ? '#0f172a' : 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: province ? '#fff' : '#64748b',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    width: '100%',
                    boxSizing: 'border-box',
                    cursor: province ? 'pointer' : 'not-allowed',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="">
                    {province ? `-- เลือกอำเภอ (${availableDistricts.length}) --` : '-- กรุณาเลือกจังหวัดก่อน --'}
                  </option>
                  {availableDistricts.map((d) => (
                    <option key={d.id} value={d.name_in_thai}>
                      {d.name_in_thai}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.825rem' }}>
                  ตำบล / แขวง <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={subdistrict}
                  onChange={(e) => handleSubdistrictSelect(e.target.value)}
                  disabled={!district}
                  required
                  style={{
                    background: district ? '#0f172a' : 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: district ? '#fff' : '#64748b',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    width: '100%',
                    boxSizing: 'border-box',
                    cursor: district ? 'pointer' : 'not-allowed',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="">
                    {district ? `-- เลือกตำบล (${availableSubdistricts.length}) --` : '-- กรุณาเลือกอำเภอก่อน --'}
                  </option>
                  {availableSubdistricts.map((s) => (
                    <option key={s.id} value={s.name_in_thai}>
                      {s.name_in_thai}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 6. Postal Code Input */}
            <div className="form-group">
              <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.825rem' }}>
                รหัสไปรษณีย์
              </label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="รหัสไปรษณีย์ (เติมให้อัตโนมัติเมื่อเลือกตำบล)"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  width: '100%',
                  boxSizing: 'border-box',
                  fontSize: '0.875rem'
                }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="onboarding-btn-secondary"
              style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="onboarding-btn-primary"
              style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}
            >
              <Save size={18} />
              <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditProfileModal;
