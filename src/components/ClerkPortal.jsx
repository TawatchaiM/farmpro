import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../supabase';

function ClerkPortal({ currentUser, dailySettings, transactions, onCreateTransaction, onUpdateTransaction }) {
  // ---- Form States ----
  const [sellerName, setSellerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [rawWeightKg, setRawWeightKg] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerSharePercentage, setOwnerSharePercentage] = useState(50);
  const [creatingTx, setCreatingTx] = useState(false);

  // ---- Smart Search States ----
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const searchRef = useRef(null);

  // ---- Location Filter States ----
  const [filterProvince, setFilterProvince] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [showLocationFilter, setShowLocationFilter] = useState(false);

  // ---- Farm States ----
  const [sellerFarms, setSellerFarms] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState('new');
  const [fetchingFarms, setFetchingFarms] = useState(false);

  // ---- Manual Price Override States ----
  const [manualPriceOverride, setManualPriceOverride] = useState(false);
  const [manualPrice, setManualPrice] = useState('');
  const [overrideReason, setOverrideReason] = useState('ตกลงพิเศษ');

  // Pricing mode from daily settings
  const isTieredMode = dailySettings?.pricing_mode === 'tiered' && dailySettings?.price_tiers?.length > 0;

  // Filter queues
  const safeTxList = Array.isArray(transactions) ? transactions : [];
  const readyToPayList = safeTxList.filter(t => t.status === 'ready_to_pay' || t.status === 'READY_TO_PAY');
  const waitingDrcList = safeTxList.filter(t => t.status === 'waiting_drc' || t.status === 'PENDING_DRC' || t.status === 'in_drc_testing' || t.status === 'IN_DRC_TESTING');

  // Cleanup stale seller cache on mount (30-day TTL)
  useEffect(() => {
    db.cleanupStaleSellerCache();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---- Debounced Smart Search (300ms) ----
  useEffect(() => {
    if (selectedSeller) return;
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const filters = {};
        if (filterProvince) filters.province = filterProvince;
        if (filterDistrict) filters.district = filterDistrict;
        const results = await db.searchSellerProfiles(searchQuery, filters, 8);
        setSearchResults(results);
        setShowDropdown(results.length > 0);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, filterProvince, filterDistrict, selectedSeller]);

  // ---- Fetch Farms when seller is selected ----
  const fetchFarmsForSeller = useCallback(async (sellerId, phone) => {
    setFetchingFarms(true);
    setSellerFarms([]);
    setSelectedFarmId('new');
    try {
      let farms = [];
      if (sellerId && !sellerId.startsWith('ab-')) {
        farms = await db.getUserFarms(sellerId);
      }
      if (farms.length === 0 && phone) {
        const profile = await db.getProfileByPhone(phone);
        if (profile) farms = await db.getUserFarms(profile.id);
      }
      setSellerFarms(farms);
      if (farms.length === 1) {
        setSelectedFarmId(farms[0].id);
        setOwnerName(farms[0].owner_name);
        setOwnerSharePercentage(farms[0].owner_share_percent);
      } else if (farms.length > 1) {
        const def = farms.find(f => f.is_default);
        if (def) {
          setSelectedFarmId(def.id);
          setOwnerName(def.owner_name);
          setOwnerSharePercentage(def.owner_share_percent);
        } else {
          setSelectedFarmId('');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingFarms(false);
    }
  }, []);

  // ---- Select seller from dropdown ----
  const handleSelectSeller = useCallback(async (seller) => {
    setSelectedSeller(seller);
    setSellerName(seller.full_name);
    setPhoneNumber(seller.phone_number || '');
    setSearchQuery(seller.full_name);
    setShowDropdown(false);
    setSearchResults([]);
    await fetchFarmsForSeller(seller.id, seller.phone_number);
  }, [fetchFarmsForSeller]);

  // ---- Clear selection ----
  const handleClearSelection = () => {
    setSelectedSeller(null);
    setSellerName('');
    setPhoneNumber('');
    setSearchQuery('');
    setSellerFarms([]);
    setSelectedFarmId('new');
    setOwnerName('');
    setOwnerSharePercentage(50);
  };

  const handleFarmSelect = (e) => {
    const val = e.target.value;
    setSelectedFarmId(val);
    if (val !== 'new' && val !== '') {
      const farm = sellerFarms.find(f => f.id === val);
      if (farm) {
        setOwnerName(farm.owner_name);
        setOwnerSharePercentage(farm.owner_share_percent);
      }
    } else {
      setOwnerName('');
      setOwnerSharePercentage(50);
    }
  };

  // ---- Handle Weight In Submit ----
  const handleWeightInSubmit = async (e) => {
    e.preventDefault();
    if (!dailySettings) {
      alert('กรุณาบันทึกการตั้งค่าราคาประจำวันก่อนทำการรับซื้อ');
      return;
    }
    if (!sellerName.trim()) {
      alert('กรุณากรอกชื่อผู้ขาย');
      return;
    }
    if (selectedFarmId === '' && sellerFarms.length > 0) {
      alert('กรุณาเลือกข้อมูลสวนที่รับน้ำยางมา');
      return;
    }
    if (!rawWeightKg || rawWeightKg <= 0) {
      alert('กรุณากรอกน้ำหนักน้ำยางสดให้ถูกต้อง');
      return;
    }

    // ---- Manual Price Override Validation ----
    if (manualPriceOverride) {
      if (!manualPrice || parseFloat(manualPrice) <= 0) {
        alert('กรุณากรอกราคาที่ต้องการใช้แทนราคา Tier ให้ถูกต้อง');
        return;
      }
      // Confirmation popup สำหรับ manual override
      const priceLabel = isTieredMode ? 'ราคาตาม Tier' : 'ราคาปกติ';
      const confirmed = window.confirm(
        `⚠️ ยืนยันการใช้ราคาพิเศษ?\n\n` +
        `ผู้ขาย: ${sellerName}\n` +
        `ราคาที่ตั้งเอง: ฿${parseFloat(manualPrice).toFixed(2)}/กก.\n` +
        `เหตุผล: ${overrideReason}\n\n` +
        `⚠️ ราคานี้จะใช้แทน${priceLabel}สำหรับคิวนี้เท่านั้น\n` +
        `ระบบจะบันทึก log ว่า ${currentUser?.full_name || 'เสมียน'} เป็นผู้ตั้งราคา\n\nกดตกลงเพื่อยืนยัน`
      );
      if (!confirmed) return;
    }

    setCreatingTx(true);
    try {
      await onCreateTransaction({
        seller_name: sellerName,
        buyer_name: currentUser?.store_name || currentUser?.full_name || 'ร้านรับซื้อยาง FarmPro',
        phone_number: phoneNumber,
        farm_id: selectedFarmId === 'new' ? null : selectedFarmId,
        owner_name: ownerName || sellerName,
        raw_weight_kg: parseFloat(rawWeightKg),
        wet_weight_sample_g: parseFloat(dailySettings?.wet_sample_weight_g || 10),
        // ถ้า manual override → ส่งราคาเลย, ถ้าไม่ → ส่ง 0 (DRC portal จะ resolve tier)
        price_per_kg: manualPriceOverride ? parseFloat(manualPrice) : (isTieredMode ? 0 : parseFloat(dailySettings.base_price || 0)),
        manual_price_override: manualPriceOverride,
        override_reason: manualPriceOverride ? overrideReason : null,
        override_by_name: manualPriceOverride ? (currentUser?.full_name || 'เสมียน') : null,
        owner_share_percentage: parseFloat(ownerSharePercentage),
        status: 'waiting_drc',
        created_by_user_id: currentUser?.id,
        created_by_name: currentUser?.full_name || 'พนักงาน'
      });

      // บันทึก seller ลง address book (เพื่อ autofill ครั้งหน้า)
      db.saveSellerToAddressBook({
        id: selectedSeller?.id,
        full_name: sellerName,
        phone_number: phoneNumber,
        is_app_user: selectedSeller?.is_app_user || false,
      });

      handleClearSelection();
      setRawWeightKg('');
      setManualPriceOverride(false);
      setManualPrice('');
      setOverrideReason('ตกลงพิเศษ');
      alert('บันทึกน้ำหนักขาเข้าเรียบร้อย ส่งคิวเข้าระบบตรวจ DRC สำเร็จ');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกน้ำหนักขาเข้า');
    } finally {
      setCreatingTx(false);
    }
  };

  // ---- Handle Mark as Paid ----
  const handleMarkPaid = async (txId) => {
    if (!window.confirm('ยืนยันการจ่ายเงินสำหรับคิวนี้?')) return;
    try {
      await onUpdateTransaction(txId, {
        status: 'paid',
        paid_by_user_id: currentUser?.id,
        paid_by_name: currentUser?.full_name || 'พนักงาน'
      });
      alert('จ่ายเงินเรียบร้อยแล้ว คิวนี้จะย้ายไปอยู่รายการที่ทำเสร็จสิ้น');
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถอัปเดตสถานะได้');
    }
  };

  // ---- Copy E-Bill text for LINE ----
  const handleCopyLineBill = (tx) => {
    const storeProfile = JSON.parse(localStorage.getItem('farmpro_store_profile') || '{}');
    const storeName = currentUser?.store_name || storeProfile.storeName || currentUser?.full_name || 'ร้านรับซื้อยาง FarmPro';
    const ownerAmount = parseFloat(tx.owner_share_amount || 0);
    const tapperAmount = parseFloat(tx.tapper_share_amount || 0);
    const billText = `🟢 LINE E-BILL: ${storeName}
===========================
คิวรับซื้อ: ${tx.queue_number}
วันที่: ${tx.date}
ผู้ขาย: ${tx.seller_name}
---------------------------
น้ำหนักน้ำยางสด: ${parseFloat(tx.raw_weight_kg).toFixed(2)} กก.
ค่า DRC %: ${parseFloat(tx.drc_percentage || 0).toFixed(2)} %
เนื้อยางแห้ง: ${parseFloat(tx.dry_weight_kg || 0).toFixed(2)} กก.
ราคารับซื้อ: ฿${parseFloat(tx.price_per_kg || 0).toFixed(2)} /กก.
===========================
💰 ยอดเงินรวมสุทธิ: ฿${parseFloat(tx.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
---------------------------
👨‍🌾 เจ้าของสวน (${tx.owner_share_percentage}%): ฿${ownerAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
👨‍🌾 คนกรีด (${100 - tx.owner_share_percentage}%): ฿${tapperAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
===========================
ขอบคุณที่ใช้บริการครับ/ค่ะ! 🙏`;
    navigator.clipboard.writeText(billText).then(() => {
      alert('คัดลอกข้อความสรุปบิลเรียบร้อยแล้ว!\nนำไปวางส่งต่อในแชท LINE ได้ทันที');
    }).catch(err => {
      console.error(err);
      alert('ไม่สามารถคัดลอกได้อัตโนมัติ');
    });
  };

  // ---- Handle thermal print ----
  const handlePrint = (tx) => {
    const storeProfile = JSON.parse(localStorage.getItem('farmpro_store_profile') || '{}');
    const storeName = currentUser?.store_name || storeProfile.storeName || currentUser?.full_name || 'ร้านรับซื้อยาง FarmPro';
    const storePhone = currentUser?.phone_number || storeProfile.phone || '08X-XXX-XXXX';
    const storeAddress = [currentUser?.address_details, currentUser?.subdistrict, currentUser?.district, currentUser?.province].filter(Boolean).join(' ') || storeProfile.address || 'ที่อยู่ร้าน';
    const taxId = currentUser?.tax_id || storeProfile.taxId ? `เลขผู้เสียภาษี: ${currentUser?.tax_id || storeProfile.taxId}` : '';
    const printWindow = window.open('', '_blank', 'width=350,height=550');
    const htmlContent = `
      <html>
        <head>
          <title>พิมพ์บิลคิว ${tx.queue_number}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #000; margin: 0; padding: 10px; width: 70mm; }
            .center { text-align: center; }
            .header-title { font-weight: bold; font-size: 14px; margin-bottom: 2px; }
            .divider { border-top: 1px dashed black; margin: 6px 0; }
            .double-divider { border-top: 2px double black; margin: 6px 0; }
            .row-data { display: flex; justify-content: space-between; margin-bottom: 3px; }
            .total-row { font-size: 13px; font-weight: bold; }
            .qr-placeholder { width: 80px; height: 80px; margin: 10px auto; border: 1px solid black; display: flex; align-items: center; justify-content: center; font-size: 8px; text-align: center; }
            .barcode-placeholder { width: 160px; height: 25px; margin: 8px auto; background: repeating-linear-gradient(90deg, #000, #000 1.5px, #fff 1.5px, #fff 4px); }
            @media print { body { margin: 0; padding: 5px; } }
          </style>
        </head>
        <body>
          <div class="center">
            <div class="header-title">${storeName}</div>
            <div>${storeAddress}</div>
            <div>โทร: ${storePhone}</div>
            <div>${taxId}</div>
            <div class="divider"></div>
            <div style="font-size: 13px; font-weight: bold;">ใบเสร็จรับซื้อน้ำยางพารา</div>
            <div style="font-size: 16px; font-weight: bold; margin-top: 3px;">คิว: ${tx.queue_number}</div>
          </div>
          <div class="divider"></div>
          <div class="row-data"><span>วันที่:</span><span>${tx.date}</span></div>
          <div class="row-data"><span>ลูกค้า:</span><span>${tx.seller_name}</span></div>
          ${tx.phone_number ? `<div class="row-data"><span>เบอร์โทร:</span><span>${tx.phone_number}</span></div>` : ''}
          <div class="divider"></div>
          <div class="row-data"><span>น้ำยางสด (Weight In):</span><span>${parseFloat(tx.raw_weight_kg).toFixed(2)} กก.</span></div>
          <div class="row-data"><span>สุ่มตรวจเปียก:</span><span>${parseFloat(tx.wet_weight_sample_g).toFixed(2)} ก.</span></div>
          <div class="row-data"><span>อบแห้งได้:</span><span>${parseFloat(tx.dry_weight_sample_g).toFixed(2)} ก.</span></div>
          <div class="row-data" style="font-weight:bold"><span>% DRC:</span><span>${parseFloat(tx.drc_percentage).toFixed(2)} %</span></div>
          <div class="row-data"><span>เนื้อยางแห้งสุทธิ:</span><span>${parseFloat(tx.dry_weight_kg).toFixed(2)} กก.</span></div>
          <div class="row-data"><span>ราคา/กก.:</span><span>${parseFloat(tx.price_per_kg).toFixed(2)} บาท</span></div>
          <div class="double-divider"></div>
          <div class="row-data total-row"><span>ยอดรวมสุทธิ:</span><span>฿${parseFloat(tx.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          <div class="double-divider"></div>
          <div class="row-data"><span>สัดส่วนเจ้าของสวน:</span><span>${tx.owner_share_percentage}%</span></div>
          <div class="row-data"><span>ส่วนแบ่งเจ้าของ:</span><span>฿${parseFloat(tx.owner_share_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          <div class="row-data"><span>ส่วนแบ่งคนกรีด:</span><span>฿${parseFloat(tx.tapper_share_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          <div class="divider"></div>
          <div class="qr-placeholder">E-BILL QR<br/>SCAN LINE</div>
          <div class="barcode-placeholder"></div>
          <div class="center" style="font-size:8px;margin-top:5px">${tx.id}</div>
          <div class="center" style="margin-top:10px;font-weight:bold">ขอบคุณที่ร่วมเป็นพันธมิตรกับเรา</div>
          <script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}</script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // ===== RENDER =====
  return (
    <div>
      <div className="clerk-grid">
        <div className="card">
          <h3 className="section-title-icon">⚖️ บันทึกน้ำหนักขาเข้า (Weight In)</h3>
          <form onSubmit={handleWeightInSubmit}>
            <div className="form-grid">

              {/* ===== SMART SELLER SEARCH ===== */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }} ref={searchRef}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span>🔍 ค้นหาผู้ขาย (พิมพ์ชื่อหรือเบอร์โทร)</span>
                  <button
                    type="button"
                    onClick={() => setShowLocationFilter(v => !v)}
                    style={{
                      fontSize: '0.72rem', padding: '0.2rem 0.6rem',
                      background: (filterProvince || filterDistrict) ? '#d1fae5' : '#f1f5f9',
                      border: '1px solid ' + ((filterProvince || filterDistrict) ? '#6ee7b7' : '#cbd5e1'),
                      borderRadius: '6px', cursor: 'pointer', color: '#374151', fontWeight: '600'
                    }}
                  >
                    📍 กรองตำแหน่ง {(filterProvince || filterDistrict) ? '✓' : ''}
                  </button>
                </label>

                {/* Location Filter Panel */}
                {showLocationFilter && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem',
                    padding: '0.75rem', background: '#f8fafc', borderRadius: '8px',
                    border: '1px solid #e2e8f0', marginBottom: '0.5rem'
                  }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>จังหวัด</label>
                      <input type="text" className="form-input" placeholder="เช่น สุราษฎร์ธานี"
                        value={filterProvince} onChange={e => setFilterProvince(e.target.value)}
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>อำเภอ</label>
                      <input type="text" className="form-input" placeholder="เช่น ไชยา"
                        value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }} />
                    </div>
                    <div style={{ gridColumn: '1/-1', textAlign: 'right' }}>
                      <button type="button" onClick={() => { setFilterProvince(''); setFilterDistrict(''); }}
                        style={{ fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                        ✕ ล้างตัวกรอง
                      </button>
                    </div>
                  </div>
                )}

                {/* Search Input */}
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="พิมพ์ชื่อหรือเบอร์โทร เช่น สมชาย หรือ 081..."
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      if (selectedSeller) setSelectedSeller(null);
                    }}
                    onFocus={() => {
                      if (searchResults.length > 0 && !selectedSeller) setShowDropdown(true);
                    }}
                    style={{
                      paddingRight: selectedSeller ? '7rem' : '2.5rem',
                      borderColor: selectedSeller ? '#16a34a' : undefined,
                      background: selectedSeller ? '#f0fdf4' : undefined,
                    }}
                    autoComplete="off"
                    id="seller-search-input"
                  />

                  {isSearching && (
                    <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', color: '#64748b' }}>
                      ⏳
                    </span>
                  )}

                  {selectedSeller && (
                    <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {selectedSeller.is_app_user && (
                        <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#166534', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                          ✓ แอปนี้
                        </span>
                      )}
                      <button type="button" onClick={handleClearSelection}
                        style={{ background: '#fee2e2', border: 'none', borderRadius: '4px', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.4rem', fontWeight: '700' }}>
                        ✕ เปลี่ยน
                      </button>
                    </div>
                  )}

                  {/* Dropdown Results */}
                  {showDropdown && searchResults.length > 0 && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
                      background: '#fff', borderRadius: '10px',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                      border: '1px solid #e2e8f0', overflow: 'hidden', maxHeight: '300px', overflowY: 'auto'
                    }}>
                      {searchResults.map((seller, idx) => (
                        <div
                          key={seller.id || idx}
                          onClick={() => handleSelectSeller(seller)}
                          style={{
                            padding: '0.65rem 1rem', cursor: 'pointer',
                            borderBottom: idx < searchResults.length - 1 ? '1px solid #f1f5f9' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              👤 {seller.full_name}
                              {seller.is_app_user && (
                                <span style={{ fontSize: '0.6rem', background: '#dcfce7', color: '#166534', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: '700' }}>✓ แอปนี้</span>
                              )}
                              {seller.source === 'address_book' && !seller.is_app_user && (
                                <span style={{ fontSize: '0.6rem', background: '#fef9c3', color: '#854d0e', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: '700' }}>📒 สมุดโทรศัพท์</span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                              📱 {seller.phone_number || '-'}
                              {(seller.district || seller.province) && (
                                <span style={{ marginLeft: '0.5rem' }}>📍 {[seller.district, seller.province].filter(Boolean).join(', ')}</span>
                              )}
                            </div>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0 }}>เลือก ›</span>
                        </div>
                      ))}
                      <div style={{ padding: '0.45rem 1rem', background: '#f8fafc', fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center' }}>
                        ไม่พบในรายการ? กรอกข้อมูลด้านล่างได้เลย
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ===== AUTO-FILLED / MANUAL FIELDS ===== */}
              <div className="form-group">
                <label>
                  ชื่อผู้ขาย / ชาวสวน
                  {selectedSeller && <span style={{ fontSize: '0.72rem', color: '#16a34a', marginLeft: '0.4rem', fontWeight: '600' }}>✓ เติมอัตโนมัติ</span>}
                </label>
                <input
                  type="text" className="form-input"
                  placeholder="ระบุชื่อจริง-นามสกุล"
                  value={sellerName}
                  onChange={e => setSellerName(e.target.value)}
                  required
                  style={selectedSeller ? { borderColor: '#86efac', background: '#f0fdf4' } : {}}
                />
              </div>

              <div className="form-group">
                <label>
                  เบอร์โทรศัพท์ (LINE E-Bill)
                  {selectedSeller && phoneNumber && <span style={{ fontSize: '0.72rem', color: '#16a34a', marginLeft: '0.4rem', fontWeight: '600' }}>✓ เติมอัตโนมัติ</span>}
                </label>
                <input
                  type="tel" className="form-input"
                  placeholder="เช่น 0812345678"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  style={selectedSeller && phoneNumber ? { borderColor: '#86efac', background: '#f0fdf4' } : {}}
                />
              </div>

              {/* ===== FARM SELECTOR (button style) ===== */}
              {fetchingFarms && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', padding: '0.5rem' }}>
                  🌱 กำลังดึงข้อมูลสวน...
                </div>
              )}

              {sellerFarms.length > 0 && (
                <div className="form-group" style={{
                  gridColumn: '1 / -1', padding: '0.85rem 1rem',
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                  borderRadius: '10px', border: '1px solid #86efac'
                }}>
                  <label style={{ color: '#14532d', fontWeight: '700' }}>
                    🌳 เลือกสวน / เจ้าของสวน
                    <span style={{ fontSize: '0.72rem', color: '#16a34a', marginLeft: '0.4rem' }}>({sellerFarms.length} สวน)</span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {sellerFarms.map(f => (
                      <button
                        key={f.id} type="button"
                        onClick={() => handleFarmSelect({ target: { value: f.id } })}
                        style={{
                          padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem',
                          fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s',
                          border: selectedFarmId === f.id ? '2px solid #16a34a' : '1px solid #a7f3d0',
                          background: selectedFarmId === f.id ? '#16a34a' : '#fff',
                          color: selectedFarmId === f.id ? '#fff' : '#166534',
                        }}
                      >
                        {f.farm_name}{f.is_default ? ' ⭐' : ''}
                        <span style={{ opacity: 0.75, fontWeight: '400', fontSize: '0.75rem', marginLeft: '0.3rem' }}>({f.owner_share_percent}%)</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleFarmSelect({ target: { value: 'new' } })}
                      style={{
                        padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem',
                        fontWeight: '600', cursor: 'pointer',
                        border: selectedFarmId === 'new' ? '2px solid #64748b' : '1px dashed #cbd5e1',
                        background: selectedFarmId === 'new' ? '#f1f5f9' : '#fff',
                        color: '#374151',
                      }}
                    >
                      + สวนใหม่
                    </button>
                  </div>
                </div>
              )}

              {/* Weight Input */}
              <div className="form-group">
                <label>น้ำหนักน้ำยางสดขาเข้า (Weight In)</label>
                <div className="input-with-icon">
                  <input
                    type="number" step="0.01" className="form-input"
                    placeholder="0.00" value={rawWeightKg}
                    onChange={e => setRawWeightKg(e.target.value)}
                    required
                  />
                  <span className="input-unit">กก.</span>
                </div>
              </div>

              {/* Owner Name (new farm only) */}
              {selectedFarmId === 'new' && (
                <div className="form-group">
                  <label>ชื่อเจ้าของสวน (สำหรับออกบิล)</label>
                  <input
                    type="text" className="form-input"
                    placeholder="เช่น ลุงบุญ"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                  />
                </div>
              )}

              {/* Owner share % */}
              <div className="form-group">
                <label>สัดส่วนเจ้าของสวน (%)</label>
                <select
                  className="form-input"
                  value={ownerSharePercentage}
                  onChange={e => setOwnerSharePercentage(parseInt(e.target.value))}
                  disabled={selectedFarmId !== 'new' && selectedFarmId !== ''}
                  style={selectedFarmId !== 'new' && selectedFarmId !== '' ? { background: '#f1f5f9' } : {}}
                >
                  <option value="50">50% (แบ่งคนละครึ่ง)</option>
                  <option value="55">55% (เจ้าของ 55 / คนกรีด 45)</option>
                  <option value="60">60% (เจ้าของ 60 / คนกรีด 40)</option>
                  <option value="70">70% (เจ้าของ 70 / คนกรีด 30)</option>
                  <option value="100">100% (เจ้าของกรีดเอง)</option>
                  <option value="0">0% (ไม่หัก)</option>
                </select>
              </div>

              {/* ===== PRICE INFO / MANUAL OVERRIDE ===== */}
              <div style={{
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                border: manualPriceOverride ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
                background: manualPriceOverride ? '#fffbeb' : '#f8fafc',
                marginBottom: '0.5rem'
              }}>
                {/* Price info badge */}
                {!manualPriceOverride && (
                  <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '0.5rem' }}>
                    {isTieredMode ? (
                      <span>📊 <strong>Tiered Pricing:</strong> ราคาจะคำนวณจาก %DRC หลังตรวจแล็บ</span>
                    ) : (
                      <span>💰 <strong>ราคาวันนี้:</strong> ฿{parseFloat(dailySettings?.base_price || 0).toFixed(2)}/กก. (Flat Price)</span>
                    )}
                  </div>
                )}

                {/* Toggle manual override */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={manualPriceOverride}
                    onChange={e => {
                      setManualPriceOverride(e.target.checked);
                      if (!e.target.checked) setManualPrice('');
                    }}
                    style={{ width: '16px', height: '16px', accentColor: '#f59e0b' }}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#92400e' }}>
                    ✏️ ตั้งราคาเองสำหรับผู้ขายรายนี้ (Manual Override)
                  </span>
                </label>

                {manualPriceOverride && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <div className="input-with-icon" style={{ flex: 1 }}>
                        <input
                          type="number"
                          step="0.01"
                          className="form-input"
                          placeholder="ระบุราคา เช่น 78.50"
                          value={manualPrice}
                          onChange={e => setManualPrice(e.target.value)}
                          style={{ borderColor: '#f59e0b', background: '#fffbeb', fontWeight: '700' }}
                        />
                        <span className="input-unit">฿/กก.</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: '#78350f', fontWeight: '600' }}>เหตุผล</label>
                      <select
                        className="form-input"
                        value={overrideReason}
                        onChange={e => setOverrideReason(e.target.value)}
                        style={{ borderColor: '#f59e0b', marginTop: '0.25rem', fontSize: '0.85rem' }}
                      >
                        <option value="ตกลงพิเศษ">ตกลงพิเศษ</option>
                        <option value="ลูกค้า VIP">ลูกค้า VIP</option>
                        <option value="ยางคุณภาพสูงพิเศษ">ยางคุณภาพสูงพิเศษ</option>
                        <option value="ปรับราคาตามตลาด">ปรับราคาตามตลาด</option>
                        <option value="อื่น ๆ">อื่น ๆ</option>
                      </select>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#b45309', background: '#fef3c7', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                      ⚠️ ระบบจะบันทึก log ว่า <strong>{currentUser?.full_name || 'เสมียน'}</strong> เป็นผู้ตั้งราคาพิเศษ
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit" className="btn btn-primary"
              style={{ width: '100%', padding: '1rem', marginTop: '1.5rem', background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)' }}
              disabled={creatingTx}
            >
              {creatingTx ? 'กำลังบันทึกน้ำหนัก...' : '🚗 บันทึก Weight In & ส่งห้อง DRC'}
            </button>
          </form>


          {/* Quick status counters */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
            <div style={{ flex: 1, padding: '0.75rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#1e40af', fontWeight: 'bold' }}>🧪 กำลังตรวจ DRC ในแล็บ</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1d4ed8' }}>{waitingDrcList.length} คิว</div>
            </div>
            <div style={{ flex: 1, padding: '0.75rem', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#065f46', fontWeight: 'bold' }}>💵 รอจ่ายเงิน / พิมพ์บิล</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#047857' }}>{readyToPayList.length} คิว</div>
            </div>
          </div>
        </div>
      </div>

      {/* Ready to Pay Queue */}
      <div className="card">
        <h3 className="section-title-icon">💵 คิวรอชำระเงินและออกบิล (Ready to Pay Queue)</h3>
        {readyToPayList.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '1rem' }}>
            📭 ยังไม่มีคิวที่ส่งผลแล็บ DRC กลับมา กรุณารอห้องตรวจ DRC อนุมัติผล
          </div>
        ) : (
          <div className="queue-card-grid">
            {readyToPayList.map(tx => {
              const ownerShare = parseFloat(tx.owner_share_amount || 0);
              const tapperShare = parseFloat(tx.tapper_share_amount || 0);
              return (
                <div key={tx.id} className="queue-card ready">
                  <div className="queue-header">
                    <span className="queue-number">{tx.queue_number}</span>
                    <span className="queue-status-tag ready">ผลแล็บออกแล้ว</span>
                  </div>
                  <div className="queue-body">
                    <p><span>ลูกค้า:</span> <span className="val">{tx.seller_name}</span></p>
                    <p><span>น้ำยางสด (Weight In):</span> <span className="val">{parseFloat(tx.raw_weight_kg).toFixed(2)} กก.</span></p>
                    <p><span>% DRC:</span> <span className="val" style={{ color: '#16a34a', fontWeight: 'bold' }}>{parseFloat(tx.drc_percentage || 0).toFixed(2)}%</span></p>
                    <p><span>ยางแห้ง:</span> <span className="val">{parseFloat(tx.dry_weight_kg || 0).toFixed(2)} กก.</span></p>
                    <p><span>ราคารับซื้อ:</span> <span className="val">฿{parseFloat(tx.price_per_kg || 0).toFixed(2)}/กก.</span></p>
                    <div style={{ height: '1px', background: '#e2e8f0', margin: '0.5rem 0' }}></div>
                    <p style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>
                      <span>รวมสุทธิ:</span>{' '}
                      <span className="val" style={{ color: 'var(--primary-dark)' }}>
                        ฿{parseFloat(tx.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      <span>สวน {tx.owner_share_percentage}%:</span>{' '}
                      <span>฿{ownerShare.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</span>
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      <span>กรีด {100 - tx.owner_share_percentage}%:</span>{' '}
                      <span>฿{tapperShare.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</span>
                    </p>
                  </div>
                  <div className="queue-actions">
                    <button className="btn-sm btn-print" onClick={() => handlePrint(tx)} title="พิมพ์บิลขนาด 7x10 cm">
                      🖨️ พิมพ์บิล
                    </button>
                    <button className="btn-sm btn-line" onClick={() => handleCopyLineBill(tx)} title="ส่ง LINE E-Bill">
                      💬 ส่ง LINE
                    </button>
                    <button className="btn-sm btn-pay" onClick={() => handleMarkPaid(tx.id)}>
                      💰 ชำระเงินสำเร็จ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ClerkPortal;
