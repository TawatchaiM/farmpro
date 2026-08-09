import React, { useState, useEffect, useMemo } from 'react';
import { Leaf, Eye, EyeOff } from 'lucide-react';
import { provinces as THAI_PROVINCES, districts as THAI_DISTRICTS, subDistricts as THAI_SUBDISTRICTS } from '@bilions/thailand-address';
import { db } from '../supabase';
import './OperationalWorkflow.css';
import PricingTable from './PricingTable';



const ALL_DAYS = [
  { short: 'จ.', full: 'จันทร์', id: 'mon' },
  { short: 'อ.', full: 'อังคาร', id: 'tue' },
  { short: 'พ.', full: 'พุธ', id: 'wed' },
  { short: 'พฤ.', full: 'พฤหัสบดี', id: 'thu' },
  { short: 'ศ.', full: 'ศุกร์', id: 'fri' },
  { short: 'ส.', full: 'เสาร์', id: 'sat' },
  { short: 'อา.', full: 'อาทิตย์', id: 'sun' }
];

const POPULAR_PRESETS = [
  { label: '⚡ จันทร์-เสาร์ 06:00 - 18:00 น.', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], open: '06:00', close: '18:00' },
  { label: '⚡ ทุกวัน 06:00 - 18:00 น.', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], open: '06:00', close: '18:00' },
  { label: '⚡ จันทร์-เสาร์ 07:00 - 17:00 น.', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], open: '07:00', close: '17:00' },
  { label: '⚡ ทุกวัน 07:00 - 17:00 น.', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], open: '07:00', close: '17:00' },
  { label: '⚡ เปิด 24 ชั่วโมง', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], is24: true }
];

function OnboardingRegistration({ onComplete, onGoHome, onSwitchToLogin }) {
  // Restore draft state from sessionStorage if user previously filled data
  const savedDraft = useMemo(() => {
    try {
      const raw = sessionStorage.getItem('farmpro_onboarding_draft');
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }, []);

  const [step, setStep] = useState(savedDraft?.step || 1);
  const [role, setRole] = useState(savedDraft?.role || ''); // 'buyer', 'seller', 'vendor'
  const [fullName, setFullName] = useState(savedDraft?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(savedDraft?.phoneNumber || '');
  const [phoneError, setPhoneError] = useState('');
  
  // Account Security Credentials States (Phone + Password Auth)
  const [password, setPassword] = useState(savedDraft?.password || '');
  const [confirmPassword, setConfirmPassword] = useState(savedDraft?.confirmPassword || '');
  const [showPassword, setShowPassword] = useState(false);

  const handlePhoneChange = async (val) => {
    setPhoneNumber(val);
    const digits = val.replace(/\D/g, '');
    if (digits.length === 10) {
      try {
        const exists = await db.checkPhoneExists(digits);
        if (exists) {
          setPhoneError('เบอร์โทรศัพท์นี้ถูกใช้งานในระบบแล้ว');
        } else {
          setPhoneError('');
        }
      } catch (err) {
        console.error('Phone check error:', err);
        setPhoneError('');
      }
    } else if (val.length > 0 && digits.length !== 10) {
      setPhoneError('กรุณากรอกเบอร์โทรศัพท์ 10 หลัก (เช่น 0812345678)');
    } else {
      setPhoneError('');
    }
  };
  
  // Store / Vendor Details States
  const [storeName, setStoreName] = useState(savedDraft?.storeName || '');
  const [selectedDays, setSelectedDays] = useState(savedDraft?.selectedDays || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
  const [openTime, setOpenTime] = useState(savedDraft?.openTime || '06:00');
  const [closeTime, setCloseTime] = useState(savedDraft?.closeTime || '18:00');
  const [is24Hours, setIs24Hours] = useState(savedDraft?.is24Hours || false);
  const [businessHours, setBusinessHours] = useState(savedDraft?.businessHours || 'จันทร์-เสาร์ 06:00 - 18:00 น.');
  const [rubberTypes, setRubberTypes] = useState(savedDraft?.rubberTypes || []); // for buyer checkboxes
  const [vendorCategory, setVendorCategory] = useState(savedDraft?.vendorCategory || '');
  const [vendorDescription, setVendorDescription] = useState(savedDraft?.vendorDescription || '');

  const updateBusinessHours = (days, open, close, is24) => {
    if (is24) {
      setBusinessHours('เปิด 24 ชั่วโมง (ทุกวัน)');
      return;
    }
    if (!days || days.length === 0) {
      setBusinessHours('');
      return;
    }
    
    let daysText = '';
    if (days.length === 7) {
      daysText = 'ทุกวัน';
    } else if (days.length === 6 && !days.includes('sun')) {
      daysText = 'จันทร์-เสาร์';
    } else if (days.length === 5 && !days.includes('sat') && !days.includes('sun')) {
      daysText = 'จันทร์-ศุกร์';
    } else {
      const sortedDays = ALL_DAYS.filter(d => days.includes(d.id));
      daysText = sortedDays.map(d => d.full).join(', ');
    }

    if (!open || !close) {
      setBusinessHours(daysText);
    } else {
      setBusinessHours(`${daysText} ${open} - ${close} น.`);
    }
  };

  const handleApplyPreset = (preset) => {
    if (preset.is24) {
      setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
      setIs24Hours(true);
      setBusinessHours('เปิด 24 ชั่วโมง (ทุกวัน)');
    } else {
      setSelectedDays(preset.days);
      setOpenTime(preset.open);
      setCloseTime(preset.close);
      setIs24Hours(false);
      updateBusinessHours(preset.days, preset.open, preset.close, false);
    }
  };

  const handleToggleDay = (dayId) => {
    setIs24Hours(false);
    let newDays;
    if (selectedDays.includes(dayId)) {
      newDays = selectedDays.filter(d => d !== dayId);
    } else {
      newDays = ALL_DAYS.map(d => d.id).filter(id => selectedDays.includes(id) || id === dayId);
    }
    setSelectedDays(newDays);
    updateBusinessHours(newDays, openTime, closeTime, false);
  };

  const handleOpenTimeChange = (time) => {
    setIs24Hours(false);
    setOpenTime(time);
    updateBusinessHours(selectedDays, time, closeTime, false);
  };

  const handleCloseTimeChange = (time) => {
    setIs24Hours(false);
    setCloseTime(time);
    updateBusinessHours(selectedDays, openTime, time, false);
  };

  // Address States
  const [addressDetails, setAddressDetails] = useState(savedDraft?.addressDetails || ''); // Optional house number / location details
  const [subdistrict, setSubdistrict] = useState(savedDraft?.subdistrict || '');
  const [district, setDistrict] = useState(savedDraft?.district || '');
  const [province, setProvince] = useState(savedDraft?.province || '');
  const [postalCode, setPostalCode] = useState(savedDraft?.postalCode || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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
    if (subObj) {
      if (subObj.zip_code) {
        setPostalCode(subObj.zip_code.toString());
      }
      if (subObj.latitude && subObj.longitude && (!latitude || !longitude)) {
        setLatitude(subObj.latitude.toString());
        setLongitude(subObj.longitude.toString());
      }
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
          postalCode: s.zip_code ? s.zip_code.toString() : '',
          lat: s.latitude,
          lng: s.longitude
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
    if (item.postalCode) setPostalCode(item.postalCode);
    if (item.lat && item.lng && (!latitude || !longitude)) {
      setLatitude(item.lat.toString());
      setLongitude(item.lng.toString());
    }
    setSearchQuery('');
    setShowSuggestions(false);
  };

  // Map & Pin States
  const [latitude, setLatitude] = useState(savedDraft?.latitude || '');
  const [longitude, setLongitude] = useState(savedDraft?.longitude || '');
  const [googleMapsUrl, setGoogleMapsUrl] = useState(savedDraft?.googleMapsUrl || '');
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Pricing Package States
  const [selectedPlanId, setSelectedPlanId] = useState(savedDraft?.selectedPlanId || 'standard');
  const [billingCycle, setBillingCycle] = useState(savedDraft?.billingCycle || 'monthly');

  // Farm Management States (for seller onboarding step)
  const [onboardingFarms, setOnboardingFarms] = useState([]);
  const [farmForm, setFarmForm] = useState({ farm_name: '', owner_name: '', owner_share_percent: 55, is_default: true });
  const [farmFormError, setFarmFormError] = useState('');

  // Auto-save form draft to sessionStorage whenever any field changes
  useEffect(() => {
    try {
      const draft = {
        step, role, fullName, phoneNumber, password, confirmPassword,
        storeName, selectedDays, openTime, closeTime, is24Hours, businessHours,
        rubberTypes, vendorCategory, vendorDescription, addressDetails,
        subdistrict, district, province, postalCode, latitude, longitude,
        googleMapsUrl, selectedPlanId, billingCycle
      };
      sessionStorage.setItem('farmpro_onboarding_draft', JSON.stringify(draft));
    } catch (err) {
      console.warn('Failed to save onboarding draft:', err);
    }
  }, [
    step, role, fullName, phoneNumber, password, confirmPassword,
    storeName, selectedDays, openTime, closeTime, is24Hours, businessHours,
    rubberTypes, vendorCategory, vendorDescription, addressDetails,
    subdistrict, district, province, postalCode, latitude, longitude,
    googleMapsUrl, selectedPlanId, billingCycle
  ]);



  // Toggle rubber types checkboxes
  const handleRubberTypeToggle = (type) => {
    if (rubberTypes.includes(type)) {
      setRubberTypes(prev => prev.filter(t => t !== type));
    } else {
      setRubberTypes(prev => [...prev, type]);
    }
  };

  // Get device current position using Geolocation API
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('เบราว์เซอร์ของคุณไม่รองรับระบบระบุพิกัด Geolocation');
      return;
    }

    setFetchingLocation(true);
    setErrorMsg('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        setLatitude(lat);
        setLongitude(lng);
        setGoogleMapsUrl(`https://www.google.com/maps?q=${lat},${lng}`);
        setFetchingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณาป้อนพิกัดหรือลิงก์แผนที่ด้วยตนเอง');
        setFetchingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Open external maps window helper
  const handleOpenMap = () => {
    if (googleMapsUrl) {
      window.open(googleMapsUrl, '_blank');
    } else if (latitude && longitude) {
      const queryUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      window.open(queryUrl, '_blank');
    } else {
      alert('กรุณาดึงพิกัดปัจจุบันหรือใส่ลิงก์แผนที่ก่อนกดเปิดดู');
    }
  };

  // Submit profile to database
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!role || !fullName || !phoneNumber || !subdistrict || !district || !province || !postalCode) {
      setErrorMsg('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    if (phoneError) {
      setErrorMsg(phoneError);
      return;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorMsg('กรุณากรอกเบอร์โทรศัพท์ 10 หลักให้ถูกต้อง');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const profileData = {
      role,
      full_name: fullName,
      phone_number: cleanPhone,
      address_details: addressDetails || null,
      subdistrict,
      district,
      province,
      postal_code: postalCode,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      google_maps_url: googleMapsUrl || null,
      status: 'approved', // Auto-approved on registration!
      plan_id: selectedPlanId,
      billing_cycle: billingCycle,
      
      // Conditionally save store/vendor settings
      store_name: (role === 'buyer' || role === 'vendor') ? storeName : null,
      business_hours: (role === 'buyer' || role === 'vendor') ? businessHours : null,
      rubber_types: role === 'buyer' ? rubberTypes.join(',') : null,
      vendor_category: role === 'vendor' ? vendorCategory : null,
      vendor_description: role === 'vendor' ? vendorDescription : null
    };

    try {
      const authRes = await db.signUp({
        phone: cleanPhone,
        password: password,
        profileData
      });

      if (authRes && authRes.success && authRes.profile) {
        const userId = authRes.profile.user_id || authRes.profile.id;
        // Save onboarding farms if seller added any
        if (role === 'seller' && onboardingFarms.length > 0 && userId) {
          for (const farm of onboardingFarms) {
            try {
              await db.addUserFarm({
                user_id: userId,
                farm_name: farm.farm_name,
                owner_name: farm.owner_name,
                owner_share_percent: parseInt(farm.owner_share_percent, 10),
                is_default: Boolean(farm.is_default)
              });
            } catch (farmErr) {
              console.warn('Could not save farm during onboarding:', farmErr);
            }
          }
        }
        sessionStorage.removeItem('farmpro_onboarding_draft');
        onComplete(authRes.profile, authRes.user);
      } else {
        const isOffline = !window.navigator.onLine;
        const response = await db.saveProfile(profileData, isOffline);
        if (response && response.success) {
          const userId = response.data?.user_id || response.data?.id;
          // Save onboarding farms if seller added any
          if (role === 'seller' && onboardingFarms.length > 0 && userId) {
            for (const farm of onboardingFarms) {
              try {
                await db.addUserFarm({
                  user_id: userId,
                  farm_name: farm.farm_name,
                  owner_name: farm.owner_name,
                  owner_share_percent: parseInt(farm.owner_share_percent, 10),
                  is_default: Boolean(farm.is_default)
                });
              } catch (farmErr) {
                console.warn('Could not save farm during onboarding:', farmErr);
              }
            }
          }
          sessionStorage.removeItem('farmpro_onboarding_draft');
          onComplete(response.data, null);
        } else {
          throw new Error(response?.error || 'ไม่สามารถบันทึกข้อมูลสมัครสมาชิกได้');
        }
      }
    } catch (err) {
      console.error('Registration error:', err);
      const isOffline = !window.navigator.onLine;
      if (isOffline || err?.message?.toLowerCase().includes('fetch') || err?.message?.toLowerCase().includes('network')) {
        setErrorMsg('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ข้อมูลที่คุณกรอกไว้ถูกบันทึกสำรองไว้แล้ว สามารถกด "ลงทะเบียน" ลองใหม่อีกครั้งได้ทันที');
      } else {
        setErrorMsg(`ระบบสมัครสมาชิกขัดข้องชั่วคราว (${err?.message || 'โปรดลองใหม่อีกครั้ง'}) - ข้อมูลที่คุณกรอกไว้ทั้งหมดถูกบันทึกสำรองไว้เรียบร้อยแล้ว กด "ลงทะเบียน" เพื่อลองใหม่อีกครั้งได้เลยครับ`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Dynamic step navigation mapping
  // Seller steps: 1=Role, 2=Personal, 4=Address, 7=Farm Setup, 5=Pricing, 6=Submit
  const stepsList = role === 'seller'
    ? [1, 2, 4, 7, 5, 6]
    : [1, 2, 3, 4, 5, 6];

  const getStepProgressPercentage = () => {
    const activeIndex = stepsList.indexOf(step);
    return (activeIndex / (stepsList.length - 1)) * 100;
  };

  const nextStep = () => {
    if (step === 1 && !role) {
      setErrorMsg('กรุณาเลือกบทบาทการทำงานของคุณ');
      return;
    }
    if (step === 1) {
      if (role === 'seller') {
        setSelectedPlanId('free');
      } else {
        setSelectedPlanId('standard');
      }
    }
    if (step === 2) {
      if (!fullName || !phoneNumber) {
        setErrorMsg('กรุณากรอกชื่อและเบอร์โทรศัพท์ให้ครบถ้วน');
        return;
      }
      if (password && password.length < 6) {
        setErrorMsg('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
        return;
      }
      if (password && confirmPassword && password !== confirmPassword) {
        setErrorMsg('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
        return;
      }
      if (role === 'seller') {
        setErrorMsg('');
        setStep(4); // seller skips store details (step 3)
        return;
      }
    }
    if (step === 3) {
      if (!storeName) {
        setErrorMsg(role === 'buyer' ? 'กรุณากรอกชื่อลานรับซื้อ' : 'กรุณากรอกชื่อร้านค้า / บริการ');
        return;
      }
      if (role === 'vendor' && !vendorCategory) {
        setErrorMsg('กรุณาเลือกประเภทหมวดหมู่ร้านค้า/บริการ');
        return;
      }
    }
    if (step === 4) {
      if (!province || !district || !subdistrict) {
        setErrorMsg('กรุณาเลือกจังหวัด อำเภอ และตำบลให้ครบถ้วน');
        return;
      }
      // Seller: go to farm setup step (7) next
      if (role === 'seller') {
        setErrorMsg('');
        setStep(7);
        return;
      }
    }
    setErrorMsg('');
    setStep(prev => prev + 1);
  };

  const prevStep = () => {
    setErrorMsg('');
    if (step === 4 && role === 'seller') {
      setStep(2);
      return;
    }
    if (step === 7) {
      setStep(4); // farm setup -> back to address
      return;
    }
    if (step === 5 && role === 'seller') {
      setStep(7); // pricing -> back to farm setup
      return;
    }
    setStep(prev => prev - 1);
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
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 9999,
      overflowY: 'auto',
      padding: '2rem 1rem',
      boxSizing: 'border-box',
      WebkitOverflowScrolling: 'touch'
    }}>
      <div className="onboarding-card" style={{
        background: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: step === 5 ? '1100px' : '640px',
        margin: '1.5rem auto',
        padding: '2.5rem 2rem',
        color: '#f8fafc',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        boxSizing: 'border-box',
        position: 'relative',
        transition: 'max-width 0.3s ease'
      }}>
        {onGoHome && (
          <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem' }}>
            <button 
              type="button"
              onClick={onGoHome}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#f8fafc',
                padding: '0.4rem 0.85rem',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
              title="กลับสู่หน้าหลักระบบ"
            >
              🏠 กลับสู่หน้าหลัก
            </button>
          </div>
        )}

        {/* Logo and Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
            <Leaf color="#4ade80" size={40} style={{ transform: 'rotate(-15deg)', flexShrink: 0 }} />
            <span>FarmPro</span>
          </div>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '1rem' }}>แอปพลิเคชันจัดการซื้อขายยางพาราอัจฉริยะ</p>
        </div>

        {/* Steps Progress Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem', position: 'relative' }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: '2px',
            background: 'rgba(255, 255, 255, 0.1)',
            zIndex: 1,
            transform: 'translateY(-50%)'
          }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            width: `${getStepProgressPercentage()}%`,
            height: '2px',
            background: 'var(--primary)',
            zIndex: 2,
            transform: 'translateY(-50%)',
            transition: 'width 0.3s ease'
          }} />

          {stepsList.map((sIdx, idx) => (
            <div key={sIdx} style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: step >= sIdx ? 'var(--primary)' : 'rgba(255, 255, 255, 0.15)',
              border: step === sIdx ? '3px solid rgba(255, 255, 255, 0.3)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '0.875rem',
              color: step >= sIdx ? '#fff' : '#cbd5e1',
              zIndex: 3,
              transition: 'all 0.3s ease'
            }}>
              {idx + 1}
            </div>
          ))}
        </div>

        {errorMsg && (
          <div className="alert error" style={{ marginBottom: '1.5rem', borderRadius: '12px' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* STEP 1: Role Selection */}
        {step === 1 && (
          <div>
            <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.5rem' }}>เลือกบทบาทการใช้งานครั้งแรก</h2>
            <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '2rem' }}>ระบุหน้าที่ของคุณเพื่อเริ่มต้นการเข้าใช้ฟังก์ชันหลัก</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '2rem' }}>
              {/* Role: Buyer */}
              <div 
                onClick={() => { setRole('buyer'); setErrorMsg(''); }}
                style={{
                  background: role === 'buyer' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: role === 'buyer' ? '2px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '16px',
                  padding: '1.5rem 0.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: role === 'buyer' ? '0 8px 24px rgba(34, 197, 94, 0.2)' : 'none'
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏪</div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', color: role === 'buyer' ? 'var(--primary)' : '#fff' }}>ผู้ซื้อ (ลานรับซื้อ)</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.3' }}>รับชั่งยาง คำนวณแล็บ และออกบิลค่าสินค้า</p>
              </div>

              {/* Role: Seller */}
              <div 
                onClick={() => { setRole('seller'); setErrorMsg(''); }}
                style={{
                  background: role === 'seller' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: role === 'seller' ? '2px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '16px',
                  padding: '1.5rem 0.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: role === 'seller' ? '0 8px 24px rgba(34, 197, 94, 0.2)' : 'none'
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧑‍🌾</div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', color: role === 'seller' ? 'var(--primary)' : '#fff' }}>ผู้ขาย (ชาวสวนยาง)</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.3' }}>บันทึกประวัติการขาย และวิเคราะห์รายรับสะสม</p>
              </div>

              {/* Role: Vendor (Marketplace) */}
              <div 
                onClick={() => { setRole('vendor'); setErrorMsg(''); }}
                style={{
                  background: role === 'vendor' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: role === 'vendor' ? '2px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '16px',
                  padding: '1.5rem 0.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: role === 'vendor' ? '0 8px 24px rgba(34, 197, 94, 0.2)' : 'none'
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🚜</div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', color: role === 'vendor' ? 'var(--primary)' : '#fff' }}>ร้านค้า / บริการ</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.3' }}>ขายอุปกรณ์เกษตร ปุ๋ย หรือรับจ้างพ่นปุ๋ย/ตัดหญ้า</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              {onSwitchToLogin && (
                <button 
                  type="button" 
                  onClick={onSwitchToLogin} 
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#4ade80',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    textDecoration: 'underline'
                  }}
                >
                  มีบัญชีอยู่แล้ว? เข้าสู่ระบบ (Login)
                </button>
              )}
              <button onClick={nextStep} className="onboarding-btn-primary" style={{ marginLeft: 'auto' }}>
                ถัดไป &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Personal Contact & Account Information */}
        {step === 2 && (
          <div>
            <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.5rem' }}>ข้อมูลติดต่อและบัญชีผู้ใช้</h2>
            <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '1.5rem' }}>กรอกข้อมูลโปรไฟล์และตั้งค่ารหัสผ่านเข้าสู่ระบบ</p>
            
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.875rem' }}>
                ชื่อ-นามสกุล / ชื่อผู้ติดต่อ <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="text" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="ตัวอย่าง: นายสมชาย รักสวน / นางสาวน้องซิน พารารุ่งเรือง"
                required
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  padding: '0.85rem',
                  borderRadius: '10px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Account Auth Security Fields (Phone + Password) */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '1.25rem',
              marginBottom: '1.75rem'
            }}>
              <div style={{ fontSize: '0.875rem', color: '#4ade80', marginBottom: '1rem', fontWeight: '600' }}>
                🔐 ข้อมูลบัญชีและรหัสผ่านเข้าสู่ระบบ (Phone + Password Auth):
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.85rem' }}>
                  เบอร์โทรศัพท์ (10 หลัก) สำหรับเข้าสู่ระบบ <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="tel" 
                  value={phoneNumber}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="ตัวอย่าง: 0812345678"
                  required
                  style={{
                    background: '#1e293b',
                    border: phoneError ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    padding: '0.75rem 0.85rem',
                    borderRadius: '10px',
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: '0.9rem'
                  }}
                />
                {phoneError && (
                  <div style={{ color: '#fca5a5', fontSize: '0.8rem', marginTop: '0.35rem', fontWeight: 'bold' }}>
                    ⚠️ {phoneError}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.85rem' }}>
                    รหัสผ่าน (Password) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                      required
                      style={{
                        background: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        padding: '0.75rem 2.4rem 0.75rem 0.85rem',
                        borderRadius: '10px',
                        width: '100%',
                        boxSizing: 'border-box',
                        fontSize: '0.9rem'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '0.65rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.25rem',
                        borderRadius: '6px'
                      }}
                      title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showPassword ? <EyeOff size={18} color="#4ade80" /> : <Eye size={18} color="#94a3b8" />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.85rem' }}>
                    ยืนยันรหัสผ่าน <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่านซ้ำอีกครั้ง"
                      required
                      style={{
                        background: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        padding: '0.75rem 2.4rem 0.75rem 0.85rem',
                        borderRadius: '10px',
                        width: '100%',
                        boxSizing: 'border-box',
                        fontSize: '0.9rem'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '0.65rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.25rem',
                        borderRadius: '6px'
                      }}
                      title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showPassword ? <EyeOff size={18} color="#4ade80" /> : <Eye size={18} color="#94a3b8" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={prevStep} className="onboarding-btn-secondary">
                ย้อนกลับ
              </button>
              <button onClick={nextStep} className="onboarding-btn-primary">
                ถัดไป &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Conditional (Buyer or Vendor Store Registration Details) */}
        {step === 3 && (role === 'buyer' || role === 'vendor') && (
          <div>
            <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
              {role === 'buyer' ? 'ข้อมูลลานรับซื้อยาง' : 'ข้อมูลร้านค้า / บริการเกษตร'}
            </h2>
            <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '2rem' }}>
              {role === 'buyer' ? 'ระบุชื่อลานรับซื้อและประเภทที่รับซื้อ' : 'ระบุรายละเอียดธุรกิจและประเภทบริการทางการเกษตรของคุณ'}
            </p>
            
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ color: '#cbd5e1', marginBottom: '0.5rem', display: 'block' }}>
                {role === 'buyer' ? 'ชื่อลานรับซื้อยาง' : 'ชื่อร้านค้า / บริการ'}
              </label>
              <input 
                type="text" 
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder={role === 'buyer' ? 'ตัวอย่าง: ลานรับซื้อยางโกชิน พาราไทย' : 'ตัวอย่าง: สมชายการเกษตร จำหน่ายปุ๋ยและเครื่องกรีด'}
                required
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  padding: '0.85rem',
                  borderRadius: '10px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* If Role is BUYER: Types of rubber accepted */}
            {role === 'buyer' && (
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ color: '#cbd5e1', marginBottom: '0.5rem', display: 'block' }}>ประเภทน้ำยาง/ยางที่ลานรับซื้อ</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                  {['น้ำยางสด', 'ยางก้อนถ้วย', 'เศษยาง/ขี้ยาง', 'ยางแผ่นดิบ'].map(t => (
                    <label key={t} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: 'rgba(255,255,255,0.03)',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      cursor: 'pointer'
                    }}>
                      <input 
                        type="checkbox" 
                        checked={rubberTypes.includes(t)}
                        onChange={() => handleRubberTypeToggle(t)}
                        style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontSize: '0.9rem' }}>{t}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* If Role is VENDOR: Marketplace Category & Description */}
            {role === 'vendor' && (
              <>
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ color: '#cbd5e1', marginBottom: '0.5rem', display: 'block' }}>หมวดหมู่ของร้านค้า / บริการ</label>
                  <select 
                    value={vendorCategory}
                    onChange={(e) => setVendorCategory(e.target.value)}
                    required
                    style={{
                      background: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      padding: '0.85rem',
                      borderRadius: '10px',
                      width: '100%',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">-- กรุณาเลือกหมวดหมู่บริการ --</option>
                    <option value="equipment">ขายเครื่องมือ / อุปกรณ์การเกษตร</option>
                    <option value="fertilizer">ขายปุ๋ย / ยาเคมีเกษตร</option>
                    <option value="services">บริการรับจ้างทางการเกษตร (ตัดหญ้า/ใส่ปุ๋ย/พ่นยา)</option>
                    <option value="other">บริการ / ร้านค้าอื่นๆ</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ color: '#cbd5e1', marginBottom: '0.5rem', display: 'block' }}>รายละเอียดสินค้า / บริการที่แนะนำ</label>
                  <textarea 
                    value={vendorDescription}
                    onChange={(e) => setVendorDescription(e.target.value)}
                    placeholder="ระบุรายละเอียด เช่น มีถังแกลลอนพลาสติกจำหน่าย ปุ๋ยอินทรีย์สูตรยางพารา รับจ้างตัดหญ้าสวนยางด้วยรถเข็น..."
                    rows={3}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      padding: '0.85rem',
                      borderRadius: '10px',
                      width: '100%',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </>
            )}

            {/* Quick-Select Business Hours Component */}
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label style={{ color: '#cbd5e1', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>เวลาทำการเปิด-ปิด (Business Hours)</span>
                <span style={{ fontSize: '0.8rem', color: '#4ade80', fontWeight: '500' }}>⚡ กดเลือกง่ายไม่ต้องพิมพ์</span>
              </label>

              {/* 1. Quick Preset Pills */}
              <div style={{ marginBottom: '0.85rem' }}>
                <div style={{ fontSize: '0.825rem', color: '#94a3b8', marginBottom: '0.4rem' }}>ปุ่มลัดช่วงเวลายอดนิยม:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {POPULAR_PRESETS.map((preset, idx) => {
                    const isCurrent = businessHours === (preset.is24 ? 'เปิด 24 ชั่วโมง (ทุกวัน)' : `${preset.days.length === 7 ? 'ทุกวัน' : 'จันทร์-เสาร์'} ${preset.open} - ${preset.close} น.`);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        style={{
                          background: isCurrent ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' : 'rgba(255, 255, 255, 0.06)',
                          border: isCurrent ? '1px solid #4ade80' : '1px solid rgba(255, 255, 255, 0.12)',
                          color: isCurrent ? '#ffffff' : '#cbd5e1',
                          padding: '0.4rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.825rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isCurrent ? '0 2px 8px rgba(34, 197, 94, 0.3)' : 'none',
                          fontWeight: isCurrent ? '600' : 'normal'
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Custom Days & Time Selection Panel */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '0.85rem'
              }}>
                {/* Days Selector */}
                <div style={{ marginBottom: '0.85rem' }}>
                  <div style={{ fontSize: '0.825rem', color: '#cbd5e1', marginBottom: '0.45rem', fontWeight: '500' }}>เลือกวันเปิดทำการ (กดเปิด/ปิดวัน):</div>
                  <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'space-between' }}>
                    {ALL_DAYS.map((day) => {
                      const isSelected = selectedDays.includes(day.id) && !is24Hours;
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => handleToggleDay(day.id)}
                          style={{
                            flex: '1 1 0',
                            minWidth: '34px',
                            padding: '0.5rem 0',
                            textAlign: 'center',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: isSelected ? 'bold' : 'normal',
                            background: isSelected ? '#16a34a' : 'rgba(255, 255, 255, 0.05)',
                            color: isSelected ? '#ffffff' : '#94a3b8',
                            border: isSelected ? '1px solid #4ade80' : '1px solid rgba(255, 255, 255, 0.1)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {day.short}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time Range Selector */}
                {!is24Hours && (
                  <div>
                    <div style={{ fontSize: '0.825rem', color: '#cbd5e1', marginBottom: '0.45rem', fontWeight: '500' }}>เลือกช่วงเวลาเปิด-ปิด:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>เวลาเปิด</label>
                        <select
                          value={openTime}
                          onChange={(e) => handleOpenTimeChange(e.target.value)}
                          style={{
                            background: '#1e293b',
                            border: '1px solid rgba(255, 255, 255, 0.18)',
                            color: '#fff',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '8px',
                            width: '100%',
                            cursor: 'pointer',
                            fontSize: '0.875rem'
                          }}
                        >
                          {['05:00', '05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '10:00'].map(t => (
                            <option key={t} value={t}>{t} น.</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>เวลาปิด</label>
                        <select
                          value={closeTime}
                          onChange={(e) => handleCloseTimeChange(e.target.value)}
                          style={{
                            background: '#1e293b',
                            border: '1px solid rgba(255, 255, 255, 0.18)',
                            color: '#fff',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '8px',
                            width: '100%',
                            cursor: 'pointer',
                            fontSize: '0.875rem'
                          }}
                        >
                          {['12:00', '15:00', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '20:00', '21:00', '22:00'].map(t => (
                            <option key={t} value={t}>{t} น.</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Generated Result Output Input */}
              <div>
                <label style={{ fontSize: '0.775rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>
                  ข้อความเวลาทำการที่จะบันทึก (ปรับแก้เพิ่มเติมได้):
                </label>
                <input 
                  type="text" 
                  value={businessHours}
                  onChange={(e) => setBusinessHours(e.target.value)}
                  placeholder="เช่น จันทร์-เสาร์ 06:00 - 18:00 น."
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid #4ade80',
                    color: '#4ade80',
                    fontWeight: '600',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={prevStep} className="onboarding-btn-secondary">
                ย้อนกลับ
              </button>
              <button onClick={nextStep} className="onboarding-btn-primary">
                ถัดไป &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Address & Full Thailand Dropdowns */}
        {step === 4 && (
          <div>
            <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.5rem' }}>ระบุที่อยู่อย่างรวดเร็ว</h2>
            <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '1.75rem' }}>
              เลือกจังหวัด อำเภอ ตำบลจากรายการครอบคลุมทั้ง 77 จังหวัดทั่วประเทศไทย
            </p>
            
            {/* Optional House Number / Location Description */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>บ้านเลขที่ / หมู่ / ถนน / คำอธิบายที่ตั้งร้านค้า</span>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'normal' }}>(ไม่บังคับ - ปล่อยว่างได้)</span>
              </label>
              <input 
                type="text" 
                value={addressDetails}
                onChange={(e) => setAddressDetails(e.target.value)}
                placeholder="เช่น 123/45 หมู่ 5 ถ.เพชรเกษม (ตรงข้ามวัดพุนพิน)"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  padding: '0.85rem',
                  borderRadius: '10px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Quick Search Auto-complete input (Optional alternative) */}
            <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
              <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.85rem' }}>
                ⚡ หรือพิมพ์ค้นหาตำบลด่วน:
              </label>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => handleQuickAddressSearch(e.target.value)}
                onFocus={() => { if (searchQuery.trim().length > 1) setShowSuggestions(true); }}
                placeholder="พิมพ์ชื่อตำบล (เช่น พุนพิน, สะเดา, ละงู, แกลง)..."
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  padding: '0.75rem 0.85rem',
                  borderRadius: '10px',
                  width: '100%',
                  boxSizing: 'border-box',
                  fontSize: '0.875rem'
                }}
              />
              
              {showSuggestions && addressSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#1e293b',
                  border: '1px solid #4ade80',
                  borderRadius: '10px',
                  marginTop: '0.25rem',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 20,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.6)'
                }}>
                  {addressSuggestions.map((item, idx) => (
                    <div 
                      key={idx}
                      onClick={() => selectSuggestion(item)}
                      style={{
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        borderBottom: idx < addressSuggestions.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        fontSize: '0.875rem',
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

            {/* Cascading Dropdowns Panel */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '1.25rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontSize: '0.875rem', color: '#4ade80', marginBottom: '1rem', fontWeight: '600' }}>
                📌 เลือกที่ตั้งจากรายการ (ดึงข้อมูลทั้ง 77 จังหวัดประเทศไทย):
              </div>

              {/* 1. Province Dropdown */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.875rem' }}>
                  จังหวัด <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select 
                  value={province}
                  onChange={(e) => handleProvinceSelect(e.target.value)}
                  required
                  style={{
                    background: '#1e293b',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    padding: '0.8rem',
                    borderRadius: '10px',
                    width: '100%',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    fontSize: '0.925rem'
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

              {/* 2. District & 3. Subdistrict Dropdowns Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.875rem' }}>
                    อำเภอ / เขต <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select 
                    value={district}
                    onChange={(e) => handleDistrictSelect(e.target.value)}
                    disabled={!province}
                    required
                    style={{
                      background: province ? '#1e293b' : 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: province ? '#fff' : '#64748b',
                      padding: '0.8rem',
                      borderRadius: '10px',
                      width: '100%',
                      boxSizing: 'border-box',
                      cursor: province ? 'pointer' : 'not-allowed',
                      fontSize: '0.925rem'
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
                  <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.875rem' }}>
                    ตำบล / แขวง <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select 
                    value={subdistrict}
                    onChange={(e) => handleSubdistrictSelect(e.target.value)}
                    disabled={!district}
                    required
                    style={{
                      background: district ? '#1e293b' : 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: district ? '#fff' : '#64748b',
                      padding: '0.8rem',
                      borderRadius: '10px',
                      width: '100%',
                      boxSizing: 'border-box',
                      cursor: district ? 'pointer' : 'not-allowed',
                      fontSize: '0.925rem'
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

              {/* 4. Postal Code Input */}
              <div className="form-group">
                <label style={{ color: '#cbd5e1', marginBottom: '0.4rem', display: 'block', fontSize: '0.875rem' }}>
                  รหัสไปรษณีย์ <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="text" 
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="รหัสไปรษณีย์ (เติมให้อัตโนมัติเมื่อเลือกตำบล)"
                  required
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#4ade80',
                    fontWeight: '600',
                    padding: '0.85rem',
                    borderRadius: '10px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={prevStep} className="onboarding-btn-secondary">
                ย้อนกลับ
              </button>
              <button type="button" onClick={nextStep} className="onboarding-btn-primary">
                ถัดไป (เลือกแพ็กเกจ) &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 7: Farm Setup (Seller only — ตั้งค่าสวนยาง) */}
        {step === 7 && (
          <div>
            <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.5rem' }}>🌳 ตั้งค่าสวนยางของคุณ</h2>
            <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '1.5rem' }}>
              เพิ่มข้อมูลสวนที่คุณรับจ้างกรีด (สามารถข้ามและเพิ่มภายหลังได้)
            </p>

            {/* Add farm form */}
            <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#4ade80', marginBottom: '1rem', fontWeight: '600' }}>
                ➕ เพิ่มสวนใหม่
              </div>
              {farmFormError && (
                <div style={{ color: '#fca5a5', fontSize: '0.8rem', marginBottom: '0.75rem' }}>⚠️ {farmFormError}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ color: '#cbd5e1', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>ชื่อสวน (เช่น สวนลุงบุญ)</label>
                  <input
                    type="text"
                    value={farmForm.farm_name}
                    onChange={e => setFarmForm(prev => ({ ...prev, farm_name: e.target.value }))}
                    placeholder="สวนอีไลน์ / สวนลุงสมชาย"
                    style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '0.7rem', borderRadius: '8px', width: '100%', boxSizing: 'border-box', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#cbd5e1', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>ชื่อเจ้าของสวน (ระบุในบิล)</label>
                  <input
                    type="text"
                    value={farmForm.owner_name}
                    onChange={e => setFarmForm(prev => ({ ...prev, owner_name: e.target.value }))}
                    placeholder="นายสมชาย ใจดี"
                    style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '0.7rem', borderRadius: '8px', width: '100%', boxSizing: 'border-box', fontSize: '0.875rem' }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ color: '#cbd5e1', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>สัดส่วนเจ้าของสวน (%)</label>
                <select
                  value={farmForm.owner_share_percent}
                  onChange={e => setFarmForm(prev => ({ ...prev, owner_share_percent: parseInt(e.target.value, 10) }))}
                  style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '0.7rem', borderRadius: '8px', width: '100%', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  <option value={50}>50% (แบ่งคนละครึ่ง)</option>
                  <option value={55}>55% (เจ้าของ 55 / คนกรีด 45)</option>
                  <option value={60}>60% (เจ้าของ 60 / คนกรีด 40)</option>
                  <option value={70}>70% (เจ้าของ 70 / คนกรีด 30)</option>
                  <option value={100}>100% (เจ้าของกรีดเอง)</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <input type="checkbox" id="ob_is_default" checked={farmForm.is_default} onChange={e => setFarmForm(prev => ({ ...prev, is_default: e.target.checked }))} style={{ accentColor: '#4ade80' }} />
                <label htmlFor="ob_is_default" style={{ color: '#cbd5e1', fontSize: '0.875rem', margin: 0, fontWeight: 'normal' }}>ตั้งเป็นสวนหลัก</label>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!farmForm.farm_name.trim() || !farmForm.owner_name.trim()) {
                    setFarmFormError('กรุณากรอกชื่อสวนและชื่อเจ้าของสวน');
                    return;
                  }
                  setFarmFormError('');
                  const newFarm = { ...farmForm, id: 'pending-' + Date.now() };
                  // If this farm is_default, unset others
                  setOnboardingFarms(prev => {
                    const updated = newFarm.is_default ? prev.map(f => ({ ...f, is_default: false })) : [...prev];
                    return [...updated, newFarm];
                  });
                  setFarmForm({ farm_name: '', owner_name: '', owner_share_percent: 55, is_default: false });
                }}
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none', color: '#fff', padding: '0.7rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', width: '100%' }}
              >
                + เพิ่มสวนนี้
              </button>
            </div>

            {/* Farm list */}
            {onboardingFarms.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>สวนที่เพิ่มแล้ว ({onboardingFarms.length} สวน):</div>
                {onboardingFarms.map((farm, idx) => (
                  <div key={farm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '0.5rem' }}>
                    <div>
                      <span style={{ color: '#4ade80', fontWeight: '600', fontSize: '0.9rem' }}>{farm.farm_name}</span>
                      {farm.is_default && <span style={{ fontSize: '0.7rem', background: '#1d4ed8', color: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '0.5rem' }}>หลัก</span>}
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.1rem' }}>เจ้าของ: {farm.owner_name} | เจ้าของ {farm.owner_share_percent}%</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOnboardingFarms(prev => prev.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem', padding: '0.25rem' }}
                    >🗑️</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
              <button type="button" onClick={prevStep} className="onboarding-btn-secondary">
                ย้อนกลับ
              </button>
              <button type="button" onClick={() => { setErrorMsg(''); setStep(5); }} className="onboarding-btn-primary">
                {onboardingFarms.length > 0 ? `ถัดไป (${onboardingFarms.length} สวน) →` : 'ข้ามขั้นตอนนี้ →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Pricing Package Selection */}
        {step === 5 && (
          <div>
            <h2 style={{ textAlign: 'center', marginBottom: '0.4rem', fontSize: '1.5rem' }}>เลือกแพ็กเกจการใช้งาน</h2>
            <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '1.75rem' }}>
              เลือกแพ็กเกจราคาที่เหมาะสมกับประเภทธุรกิจของคุณ (สามารถเปลี่ยนได้ในภายหลัง)
            </p>

            <PricingTable 
              selectedPlanId={selectedPlanId}
              onSelectPlan={(planId, cycle) => {
                setSelectedPlanId(planId);
                if (cycle) setBillingCycle(cycle);
              }}
              isEmbedded={true}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
              <button type="button" onClick={prevStep} className="onboarding-btn-secondary">
                ย้อนกลับ
              </button>
              <button type="button" onClick={nextStep} className="onboarding-btn-primary">
                ถัดไป (ปักหมุดพิกัด) &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: Map Location Pinning & Final Submit */}
        {step === 6 && (
          <form onSubmit={handleSubmit}>
            <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.5rem' }}>ปักหมุดตำแหน่งที่ตั้ง</h2>
            <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '2rem' }}>ระบุพิกัดละติจูด/ลองจิจูดเพื่อให้อยู่บนแผนที่สำหรับลูกค้าและสมาชิก</p>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <button 
                type="button" 
                onClick={handleGetLocation} 
                className="onboarding-btn-primary" 
                disabled={fetchingLocation}
                style={{ flex: 1, padding: '1rem' }}
              >
                {fetchingLocation ? (
                  <>
                    <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', borderTopColor: 'transparent', margin: 0 }}></div>
                    กำลังค้นหาพิกัด...
                  </>
                ) : (
                  <>📍 ดึงพิกัดปัจจุบัน</>
                )}
              </button>
              
              <button 
                type="button" 
                onClick={handleOpenMap}
                className="onboarding-btn-secondary"
                style={{ padding: '1rem 1.5rem' }}
              >
                🗺️ เปิดดูแผนที่
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label style={{ color: '#cbd5e1', marginBottom: '0.5rem', display: 'block' }}>ละติจูด (Latitude)</label>
                <input 
                  type="number" 
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="เช่น 9.1396"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    padding: '0.85rem',
                    borderRadius: '10px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div className="form-group">
                <label style={{ color: '#cbd5e1', marginBottom: '0.5rem', display: 'block' }}>ลองจิจูด (Longitude)</label>
                <input 
                  type="number" 
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="เช่น 99.1300"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    padding: '0.85rem',
                    borderRadius: '10px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '2.5rem' }}>
              <label style={{ color: '#cbd5e1', marginBottom: '0.5rem', display: 'block' }}>ลิงก์ Google Maps (ถ้ามี)</label>
              <input 
                type="url" 
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="วางลิงก์ Google Maps เช่น https://goo.gl/maps/..."
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  padding: '0.85rem',
                  borderRadius: '10px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={prevStep} className="onboarding-btn-secondary" disabled={submitting}>
                ย้อนกลับ
              </button>
              <button type="submit" className="onboarding-btn-primary" disabled={submitting}>
                {submitting ? 'กำลังบันทึกข้อมูล...' : 'ลงทะเบียน 🌿'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default OnboardingRegistration;
