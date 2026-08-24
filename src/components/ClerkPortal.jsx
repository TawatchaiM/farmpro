import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../supabase';
import { handleCopyLineBill } from '../utils/lineShare';

function ClerkPortal({ currentUser, dailySettings, transactions, onCreateTransaction, onUpdateTransaction, onSaveSettings }) {
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

  // ---- Plot States ----
  const [sellerPlots, setSellerPlots] = useState([]);
  const [selectedPlotId, setSelectedPlotId] = useState('');
  const [fetchingPlots, setFetchingPlots] = useState(false);

  // ---- Manual Price Override States ----
  const [manualPriceOverride, setManualPriceOverride] = useState(false);
  const [manualPrice, setManualPrice] = useState('');
  const [overrideReason, setOverrideReason] = useState('ตกลงพิเศษ');

  // ---- Payment Success Modal States ----
  const [paymentSuccessTx, setPaymentSuccessTx] = useState(null);

  // ---- Edit Modal States ----
  const [editModalTx, setEditModalTx] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Pricing mode from daily settings
  const isTieredMode = dailySettings?.pricing_mode === 'tiered' && dailySettings?.price_tiers?.length > 0;

  // Filter queues
  const safeTxList = Array.isArray(transactions) ? transactions : [];
  const readyToPayList = safeTxList.filter(t => t.status === 'ready_to_pay' || t.status === 'READY_TO_PAY');
  const waitingDrcList = safeTxList.filter(t => t.status === 'waiting_drc' || t.status === 'PENDING_DRC' || t.status === 'in_drc_testing' || t.status === 'IN_DRC_TESTING');
  const paidList = safeTxList.filter(t => t.status === 'paid' || t.status === 'completed');

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

  // ---- Fetch Plots when seller is selected ----
  const fetchPlotsForSeller = useCallback(async (sellerId, phone) => {
    setFetchingPlots(true);
    setSellerPlots([]);
    setSelectedPlotId('');
    try {
      let plots = [];
      if (sellerId && !sellerId.startsWith('ab-')) {
        plots = await db.getRubberPlots(sellerId);
      }
      if (plots.length === 0 && phone) {
        const profile = await db.getProfileByPhone(phone);
        if (profile) plots = await db.getRubberPlots(profile.id);
      }
      setSellerPlots(plots);
      
      if (plots.length === 1) {
        setSelectedPlotId(plots[0].plot_id);
        setOwnerName(plots[0].owner?.full_name || 'เจ้าของสวน');
        setOwnerSharePercentage(plots[0].default_share_ratio);
      } else if (plots.length > 1) {
        setSelectedPlotId(''); // Require explicit UI selection
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingPlots(false);
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
    await fetchPlotsForSeller(seller.id, seller.phone_number);
  }, [fetchPlotsForSeller]);

  // ---- Clear selection ----
  const handleClearSelection = () => {
    setSelectedSeller(null);
    setSellerName('');
    setPhoneNumber('');
    setSearchQuery('');
    setSelectedPlotId('');
    setOwnerName('');
    setOwnerSharePercentage(50);
  };

  const handlePlotSelect = (e) => {
    const val = e.target.value;
    setSelectedPlotId(val);
    if (val !== 'new' && val !== '') {
      const plot = sellerPlots.find(p => p.plot_id === val);
      if (plot) {
        setOwnerName(plot.owner?.full_name || sellerName);
        setOwnerSharePercentage(plot.default_share_ratio);
      }
    } else {
      setOwnerName('');
      setOwnerSharePercentage(50);
    }
  };

  // ---- Handle Weight In Submit ----
  const handleWeightInSubmit = async (e) => {
    e.preventDefault();
    
    let currentSettings = dailySettings;
    if (!currentSettings) {
      const wantPrevious = window.confirm(
        '⚠️ ยังไม่ได้ตั้งค่าราคาประจำวัน\n\n' +
        'คุณต้องการใช้ราคาวันก่อนหน้าหรือไม่?\n\n' +
        '- กด OK เพื่อดึงราคาวันก่อนหน้ามาบันทึกและดำเนินการต่อ\n' +
        '- กด Cancel เพื่อไปตั้งค่าราคาด้วยตนเอง'
      );
      if (wantPrevious) {
        setCreatingTx(true);
        try {
          let prevSettings = null;
          for (let i = 1; i <= 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const pastDateStr = d.toISOString().split('T')[0];
            prevSettings = await db.getDailySettings(pastDateStr);
            if (prevSettings) break;
          }

          if (prevSettings) {
            const todayStr = new Date().toISOString().split('T')[0];
            const newSettings = {
              ...prevSettings,
              id: undefined,
              date: todayStr,
              created_at: new Date().toISOString()
            };
            if (onSaveSettings) {
              await onSaveSettings(newSettings);
            } else {
              await db.saveDailySettings(newSettings);
            }
            currentSettings = newSettings;
            // continue below to save weight in...
          } else {
            alert('ไม่พบข้อมูลราคาย้อนหลังภายใน 7 วัน กรุณาไปตั้งค่าราคาด้วยตนเอง');
            setCreatingTx(false);
            return;
          }
        } catch (err) {
          console.error(err);
          alert('เกิดข้อผิดพลาดในการดึงราคา');
          setCreatingTx(false);
          return;
        }
      } else {
        return;
      }
    }

    if (!sellerName.trim()) {
      alert('กรุณากรอกชื่อผู้ขาย');
      return;
    }
    if (selectedPlotId === '' && sellerPlots.length > 0) {
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
        plot_id: selectedPlotId === 'new' ? null : selectedPlotId,
        tapper_id: (selectedPlotId && selectedPlotId !== 'new') ? sellerPlots.find(p => p.plot_id === selectedPlotId)?.tapper_id : null,
        owner_name: ownerName || sellerName,
        raw_weight_kg: parseFloat(rawWeightKg),
        wet_weight_sample_g: parseFloat(currentSettings?.wet_sample_weight_g || 10),
        // ถ้า manual override → ส่งราคาเลย, ถ้าไม่ → ส่ง 0 (DRC portal จะ resolve tier)
        price_per_kg: manualPriceOverride ? parseFloat(manualPrice) : ((currentSettings?.pricing_mode === 'tiered' && currentSettings?.price_tiers?.length > 0) ? 0 : parseFloat(currentSettings.base_price || 0)),
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
  const handleMarkPaid = async (tx) => {
    try {
      await onUpdateTransaction(tx.id, {
        status: 'paid',
        paid_by_user_id: currentUser?.id,
        paid_by_name: currentUser?.full_name || 'พนักงาน'
      });
      // Show custom success modal with options
      setPaymentSuccessTx(tx);
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถอัปเดตสถานะได้');
    }
  };

  // ---- Edit Modal Handlers ----
  const handleOpenEdit = (tx) => {
    setEditModalTx(tx);
    setEditFormData({
      raw_weight_kg: tx.raw_weight_kg || '',
      drc_percentage: tx.drc_percentage || '',
      price_per_kg: tx.price_per_kg || '',
      owner_share_percentage: tx.owner_share_percentage || 50,
      edit_reason: '' // New field for log
    });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editFormData.edit_reason.trim()) {
      alert('กรุณาระบุเหตุผลในการแก้ไข');
      return;
    }
    setSavingEdit(true);
    try {
      const raw = parseFloat(editFormData.raw_weight_kg) || 0;
      const drc = parseFloat(editFormData.drc_percentage) || 0;
      const price = parseFloat(editFormData.price_per_kg) || 0;
      const share = parseFloat(editFormData.owner_share_percentage) || 0;

      const dry = parseFloat(((raw * drc) / 100).toFixed(2));
      const total = parseFloat((dry * price).toFixed(2));
      const ownerAmt = parseFloat(((total * share) / 100).toFixed(2));
      const tapperAmt = parseFloat((total - ownerAmt).toFixed(2));

      // Append log
      const newLog = {
        date: new Date().toISOString(),
        user: currentUser?.full_name || 'เสมียน',
        reason: editFormData.edit_reason,
        changes: {
          raw_weight_kg: { old: editModalTx.raw_weight_kg, new: raw },
          drc_percentage: { old: editModalTx.drc_percentage, new: drc },
          price_per_kg: { old: editModalTx.price_per_kg, new: price }
        }
      };
      
      const updatedLogs = [...(editModalTx.edit_logs || []), newLog];

      await onUpdateTransaction(editModalTx.id, {
        raw_weight_kg: raw,
        drc_percentage: drc,
        price_per_kg: price,
        dry_weight_kg: dry,
        total_amount: total,
        total_amount_thb: total,
        owner_share_percentage: share,
        owner_share_amount: ownerAmt,
        owner_share_thb: ownerAmt,
        tapper_share_amount: tapperAmt,
        tapper_share_thb: tapperAmt,
        edit_logs: updatedLogs
      });
      
      setEditModalTx(null);
      alert('บันทึกการแก้ไขเรียบร้อยแล้ว');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกการแก้ไข');
    } finally {
      setSavingEdit(false);
    }
  };

  // ---- Copy E-Bill text for LINE ----

  // ---- Handle thermal print ----
  const handlePrint = (tx) => {
    const storeProfile = JSON.parse(localStorage.getItem('farmpro_store_profile') || '{}') || {};
    const storeName = currentUser?.store_name || storeProfile.storeName || currentUser?.full_name || 'ร้านรับซื้อยาง FarmPro';
    const storePhone = currentUser?.phone_number || storeProfile.phone || '08X-XXX-XXXX';
    const storeAddress = [currentUser?.address_details, currentUser?.subdistrict, currentUser?.district, currentUser?.province].filter(Boolean).join(' ') || storeProfile.address || 'ที่อยู่ร้าน';
    const taxId = currentUser?.tax_id || storeProfile.taxId ? `เลขผู้เสียภาษี: ${currentUser?.tax_id || storeProfile.taxId}` : '';
    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <html>
        <head>
          <title>พิมพ์บิลคิว ${tx.queue_number}</title>
          <style>
            @page { size: 58mm auto; margin: 0; }
            body { 
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
              font-size: 11px; 
              color: #000; 
              margin: 0; 
              padding: 2mm; 
              width: 58mm; 
              box-sizing: border-box; 
            }
            .center { text-align: center; }
            .header-title { font-weight: bold; font-size: 14px; margin-bottom: 2px; }
            .divider { border-top: 1px dashed black; margin: 6px 0; }
            .double-divider { border-top: 2px double black; margin: 6px 0; }
            .row-data { display: flex; justify-content: space-between; margin-bottom: 3px; align-items: flex-end; }
            .total-row { font-size: 13px; font-weight: bold; }
            .qr-placeholder { width: 40px; height: 40px; margin: 10px auto; border: 1px solid black; display: flex; align-items: center; justify-content: center; font-size: 7px; text-align: center; line-height: 1.1; }
            .barcode-placeholder { width: 80%; height: 25px; margin: 8px auto; background: repeating-linear-gradient(90deg, #000, #000 1.5px, #fff 1.5px, #fff 4px); }
            @media print { body { width: 58mm; padding: 2mm; } }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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

              {/* ===== PLOT SELECTOR (button style) ===== */}
              {fetchingPlots && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', padding: '0.5rem' }}>
                  🌱 กำลังดึงข้อมูลสวน...
                </div>
              )}

              {sellerPlots.length > 0 && (
                <div className="form-group" style={{
                  gridColumn: '1 / -1', padding: '0.85rem 1rem',
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                  borderRadius: '10px', border: '1px solid #86efac'
                }}>
                  <label style={{ color: '#14532d', fontWeight: '700' }}>
                    🌳 เลือกสวน / เจ้าของสวน
                    <span style={{ fontSize: '0.72rem', color: '#16a34a', marginLeft: '0.4rem' }}>({sellerPlots.length} สวน)</span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {sellerPlots.map(f => (
                      <button
                        key={f.plot_id} type="button"
                        onClick={() => handlePlotSelect({ target: { value: f.plot_id } })}
                        style={{
                          padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem',
                          fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s',
                          border: selectedPlotId === f.plot_id ? '2px solid #16a34a' : '1px solid #a7f3d0',
                          background: selectedPlotId === f.plot_id ? '#16a34a' : '#fff',
                          color: selectedPlotId === f.plot_id ? '#fff' : '#166534',
                        }}
                      >
                        {f.plot_name}
                        <span style={{ opacity: 0.75, fontWeight: '400', fontSize: '0.75rem', marginLeft: '0.3rem' }}>({f.default_share_ratio}%)</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handlePlotSelect({ target: { value: 'new' } })}
                      style={{
                        padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem',
                        fontWeight: '600', cursor: 'pointer',
                        border: selectedPlotId === 'new' ? '2px solid #64748b' : '1px dashed #cbd5e1',
                        background: selectedPlotId === 'new' ? '#f1f5f9' : '#fff',
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
                    type="number" inputMode="decimal" step="0.01" className="form-input"
                    placeholder="0.00" value={rawWeightKg}
                    onChange={e => setRawWeightKg(e.target.value)}
                    required
                  />
                  <span className="input-unit">กก.</span>
                </div>
              </div>

              {/* Owner Name (new farm only) */}
              {selectedPlotId === 'new' && (
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
                  disabled={selectedPlotId !== 'new' && selectedPlotId !== ''}
                  style={selectedPlotId !== 'new' && selectedPlotId !== '' ? { background: '#f1f5f9' } : {}}
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
                          inputMode="decimal"
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
      <div className="queue-grid">
        {/* Ready to Pay Queue */}
        <div className="card" style={{ marginBottom: 0 }}>
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
                  <div className="queue-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="queue-number">{tx.queue_number}</span>
                      <button 
                        onClick={() => handleOpenEdit(tx)} 
                        style={{ 
                          background: 'none', border: 'none', cursor: 'pointer', 
                          fontSize: '1.2rem', padding: '0', color: '#f59e0b',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }} 
                        title="แก้ไขข้อมูล"
                      >
                        ✏️
                      </button>
                    </div>
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
                    <button className="btn-sm btn-line" onClick={() => handleCopyLineBill(tx, currentUser)} title="ส่ง LINE E-Bill">
                      💬 ส่ง LINE
                    </button>
                    <button className="btn-sm btn-pay" onClick={() => handleMarkPaid(tx)}>
                      💰 ชำระเงินสำเร็จ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Paid Transactions Queue (รายการที่ชำระเงินแล้ววันนี้) */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3 className="section-title-icon">✅ รายการที่ชำระเงินแล้ววันนี้ (Paid)</h3>
        {paidList.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.95rem' }}>
            📭 ยังไม่มีรายการที่ชำระเงินในวันนี้
          </div>
        ) : (
          <div className="queue-card-grid">
            {paidList.map(tx => {
              const ownerShare = parseFloat(tx.owner_share_amount || tx.owner_share_thb || 0);
              const tapperShare = parseFloat(tx.tapper_share_amount || tx.tapper_share_thb || 0);
              return (
                <div key={tx.id} className="queue-card" style={{ borderTop: '4px solid #15803d', opacity: 0.9 }}>
                  <div className="queue-header">
                    <span className="queue-number">{tx.queue_number}</span>
                    <span className="queue-status-tag" style={{ background: '#dcfce7', color: '#166534' }}>ชำระเงินแล้ว</span>
                  </div>
                  <div className="queue-body">
                    <p><span>ลูกค้า:</span> <span className="val">{tx.seller_name}</span></p>
                    <p><span>น้ำยางสด (Weight In):</span> <span className="val">{parseFloat(tx.raw_weight_kg).toFixed(2)} กก.</span></p>
                    <p><span>% DRC:</span> <span className="val" style={{ color: '#16a34a', fontWeight: 'bold' }}>{parseFloat(tx.drc_percentage || 0).toFixed(2)}%</span></p>
                    <div style={{ height: '1px', background: '#e2e8f0', margin: '0.5rem 0' }}></div>
                    <p style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>
                      <span>ยอดสุทธิ:</span>{' '}
                      <span className="val" style={{ color: '#15803d' }}>
                        ฿{parseFloat(tx.total_amount || tx.total_amount_thb || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  <div className="queue-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-sm btn-print" onClick={() => handlePrint(tx)} title="พิมพ์บิลขนาด 7x10 cm" style={{ flex: 1 }}>
                      🖨️ พิมพ์ซ้ำ
                    </button>
                    <button className="btn-sm btn-line" onClick={() => handleCopyLineBill(tx, currentUser)} title="ส่ง LINE E-Bill" style={{ flex: 1 }}>
                      💬 ส่ง LINE
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {/* Payment Success Modal */}
      {paymentSuccessTx && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '2rem', width: '90%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ color: '#166534', margin: '0 0 0.5rem 0' }}>จ่ายเงินเรียบร้อยแล้ว</h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              คิว <strong>{paymentSuccessTx.queue_number}</strong> ({paymentSuccessTx.seller_name}) จะย้ายไปอยู่รายการที่ทำเสร็จสิ้น
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                onClick={() => handlePrint(paymentSuccessTx)}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.8rem', borderRadius: '8px', fontWeight: 'bold', color: '#334155', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
              >
                <span>🖨️</span> พิมพ์บิล
              </button>
              <button 
                onClick={() => handleCopyLineBill(paymentSuccessTx, currentUser)}
                style={{ background: '#00B900', border: 'none', padding: '0.8rem', borderRadius: '8px', fontWeight: 'bold', color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
              >
                <span>💬</span> ส่ง LINE E-Bill
              </button>
              <button 
                onClick={() => setPaymentSuccessTx(null)}
                style={{ background: 'transparent', border: '1px solid #e2e8f0', padding: '0.8rem', borderRadius: '8px', fontWeight: 'bold', color: '#64748b', cursor: 'pointer', marginTop: '0.5rem' }}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editModalTx && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>✏️ แก้ไขคิว {editModalTx.queue_number}</h3>
            <form onSubmit={handleSaveEdit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 'bold' }}>น้ำยางสด (กก.)</label>
                  <input type="number" step="0.01" name="raw_weight_kg" value={editFormData.raw_weight_kg} onChange={handleEditChange} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 'bold' }}>% DRC</label>
                  <input type="number" step="0.01" name="drc_percentage" value={editFormData.drc_percentage} onChange={handleEditChange} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 'bold' }}>ราคารับซื้อ (บาท/กก.)</label>
                  <input type="number" step="0.01" name="price_per_kg" value={editFormData.price_per_kg} onChange={handleEditChange} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 'bold' }}>สัดส่วนเจ้าของสวน (%)</label>
                  <input type="number" step="0.1" name="owner_share_percentage" value={editFormData.owner_share_percentage} onChange={handleEditChange} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 'bold' }}>เหตุผลในการแก้ไข <span style={{color: 'red'}}>*</span></label>
                  <input type="text" name="edit_reason" value={editFormData.edit_reason} onChange={handleEditChange} required placeholder="เช่น พิมพ์ตัวเลขผิด, ลูกค้าขอแก้ไข" style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setEditModalTx(null)} style={{ flex: 1, background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.6rem', borderRadius: '6px', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}>
                    ยกเลิก
                  </button>
                  <button type="submit" disabled={savingEdit} style={{ flex: 1, background: '#f59e0b', border: 'none', padding: '0.6rem', borderRadius: '6px', fontWeight: 'bold', color: '#fff', cursor: 'pointer' }}>
                    {savingEdit ? 'กำลังบันทึก...' : '💾 บันทึก'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClerkPortal;
