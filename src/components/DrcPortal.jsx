import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../supabase';

function DrcPortal({ currentUser, dailySettings, transactions, onUpdateTransaction, labInspector }) {
  const [selectedTx, setSelectedTx] = useState(null);
  const [grossWeightInput, setGrossWeightInput] = useState('');
  const [cupWeightInput, setCupWeightInput] = useState(() => localStorage.getItem('farmpro_drc_cup_weight') || '');
  const [focusedInput, setFocusedInput] = useState('gross'); // 'gross' | 'cup'
  const [submitting, setSubmitting] = useState(false);
  const [mobileTab, setMobileTab] = useState('queue'); // 'queue' | 'testing'

  // labInspector = { name, phone } เมื่อเข้าผ่าน QR Code (restricted mode)
  const isRestrictedMode = !!labInspector;
  const inspectorName = labInspector?.name || currentUser?.full_name || currentUser?.store_name || 'คนตรวจ DRC (Lab)';

  // Filter queues (Supports normalized status strings PENDING_DRC, IN_DRC_TESTING, READY_TO_PAY)
  const safeTxList = Array.isArray(transactions) ? transactions : [];
  const waitingDrcList = useMemo(() => 
    safeTxList.filter(t => 
      t.status === 'waiting_drc' || 
      t.status === 'PENDING_DRC' || 
      t.status === 'in_drc_testing' || 
      t.status === 'IN_DRC_TESTING'
    ),
    [safeTxList]
  );

  // Auto-select first item in queue if nothing is selected
  useEffect(() => {
    if (waitingDrcList.length > 0) {
      const exists = selectedTx && waitingDrcList.some(t => t.id === selectedTx.id);
      if (!exists) {
        setSelectedTx(waitingDrcList[0]);
        setGrossWeightInput('');
      }
    } else {
      setSelectedTx(null);
      setGrossWeightInput('');
    }
  }, [waitingDrcList]);

  // Handle Queue Item Selection (Race condition lock: acquires lock in_drc_testing)
  const handleSelectTx = useCallback(async (tx) => {
    if (!tx) return;

    // If switching from another item previously locked by us, release lock
    if (selectedTx && selectedTx.id !== tx.id && (selectedTx.status === 'in_drc_testing' || selectedTx.status === 'IN_DRC_TESTING')) {
      try {
        await onUpdateTransaction(selectedTx.id, { status: 'waiting_drc', testing_by: null });
      } catch (err) {
        console.warn('Failed to release previous transaction lock:', err);
      }
    }

    setSelectedTx(tx);
    setGrossWeightInput('');
    setMobileTab('testing');

    // Acquire lock if transaction is currently in waiting state
    if (tx.status === 'waiting_drc' || tx.status === 'PENDING_DRC') {
      try {
        await onUpdateTransaction(tx.id, {
          status: 'in_drc_testing',
          testing_by: inspectorName
        });
      } catch (err) {
        console.warn('Failed to acquire lock for DRC testing:', err);
      }
    }
  }, [selectedTx, onUpdateTransaction, inspectorName]);

  // Release Lock / Cancel current testing
  const handleReleaseLock = async () => {
    if (!selectedTx) return;
    try {
      await onUpdateTransaction(selectedTx.id, {
        status: 'waiting_drc',
        testing_by: null
      });
      setSelectedTx(null);
      setGrossWeightInput('');
      setMobileTab('queue');
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถยกเลิกการล็อกคิวได้');
    }
  };

  // Numpad key handlers
  const handleNumClick = (val) => {
    const currentInput = focusedInput === 'gross' ? grossWeightInput : cupWeightInput;
    if (currentInput.includes('.') && val === '.') return;
    if (currentInput === '0' && val !== '.') {
      if (focusedInput === 'gross') setGrossWeightInput(val);
      else {
        setCupWeightInput(val);
        localStorage.setItem('farmpro_drc_cup_weight', val);
      }
      return;
    }
    if (currentInput.replace('.', '').length >= 4 && val !== '.') return;
    
    if (focusedInput === 'gross') {
      setGrossWeightInput(prev => prev + val);
    } else {
      const newVal = cupWeightInput + val;
      setCupWeightInput(newVal);
      localStorage.setItem('farmpro_drc_cup_weight', newVal);
    }
  };

  const handleBackspace = () => {
    if (focusedInput === 'gross') {
      setGrossWeightInput(prev => prev.slice(0, -1));
    } else {
      const newVal = cupWeightInput.slice(0, -1);
      setCupWeightInput(newVal);
      localStorage.setItem('farmpro_drc_cup_weight', newVal);
    }
  };

  const handleClear = () => {
    if (focusedInput === 'gross') {
      setGrossWeightInput('');
    } else {
      setCupWeightInput('');
      localStorage.removeItem('farmpro_drc_cup_weight');
    }
  };

  // Calculations
  const defaultWetWeightG = parseFloat(dailySettings?.wet_sample_weight_g || 10);
  const wetWeightG = selectedTx ? parseFloat(selectedTx.wet_weight_sample_g || defaultWetWeightG) : defaultWetWeightG;
  const cupWeightG = parseFloat(cupWeightInput) || 0;
  const grossWeightG = parseFloat(grossWeightInput) || 0;
  const dryWeightG = Math.max(0, grossWeightG - cupWeightG);
  const drcPercentage = wetWeightG > 0 ? (dryWeightG / wetWeightG) * 100 : 0;
  const isImpossibleDrc = drcPercentage > 60 || drcPercentage < 10;

  // Handle DRC Submit
  const handleSubmitDrc = async () => {
    if (!selectedTx) return;
    if (grossWeightG > 0 && cupWeightG >= grossWeightG) {
      alert('น้ำหนักถ้วยเปล่าต้องน้อยกว่าน้ำหนักรวม (ถ้วย + ยางแห้ง)');
      return;
    }
    if (dryWeightG <= 0) {
      alert('กรุณากรอกน้ำหนักให้ถูกต้อง (ยางแห้งสุทธิต้องมากกว่า 0)');
      return;
    }
    if (grossWeightG > (cupWeightG + wetWeightG)) {
      alert(`ข้อมูลผิดพลาด: น้ำหนัก "2. ถ้วย+ยางแห้ง" (${grossWeightG}g) มีค่ามากกว่า "1. ถ้วยเปล่า" (${cupWeightG}g) + "น้ำหนักเปียก" (${wetWeightG}g)\n(รวมกันได้ ${cupWeightG + wetWeightG}g) ซึ่งเป็นไปไม่ได้ครับ`);
      return;
    }

    setSubmitting(true);
    try {
      const calculatedDrc = parseFloat(drcPercentage.toFixed(2));
      const rawWeight = parseFloat(selectedTx.raw_weight_kg);
      const ownerSharePercent = parseFloat(selectedTx.owner_share_percentage || 50);

      // ---- Price Resolution Logic ----
      let finalPricePerKg;
      let priceSource; // 'manual_override' | 'tier' | 'flat'

      if (selectedTx.manual_price_override) {
        // เสมียนตั้งราคาเองไว้แล้ว → ใช้ราคานั้น
        finalPricePerKg = parseFloat(selectedTx.price_per_kg || 0);
        priceSource = 'manual_override';
      } else {
        // ลอง resolve จาก tier
        const tiers = dailySettings?.price_tiers;
        const basePrice = dailySettings?.base_price || 0;
        const resolved = db.resolvePriceFromTiers(calculatedDrc, tiers, basePrice);

        if (resolved.needs_manual) {
          // %DRC ไม่ตรง tier ใด → แจ้งเตือน ให้กรอกเอง
          const enteredPrice = window.prompt(
            `⚠️ %DRC ${calculatedDrc}% ไม่ตรงกับช่วง Tier ที่ตั้งไว้\n\n` +
            `กรุณากรอกราคารับซื้อ (บาท/กก.) สำหรับคิวนี้:\n` +
            `ผู้ขาย: ${selectedTx.seller_name}`,
            '0'
          );
          if (!enteredPrice || parseFloat(enteredPrice) <= 0) {
            alert('ยกเลิก: กรุณากรอกราคาที่ถูกต้องเพื่อดำเนินการต่อ');
            setSubmitting(false);
            return;
          }
          finalPricePerKg = parseFloat(enteredPrice);
          priceSource = 'manual_fallback';
        } else {
          finalPricePerKg = resolved.price;
          priceSource = resolved.from_tier ? 'tier' : 'flat';
        }
      }

      const dryWeightKg = parseFloat(((rawWeight * calculatedDrc) / 100).toFixed(2));
      const totalAmount = parseFloat((dryWeightKg * finalPricePerKg).toFixed(2));
      const ownerShareAmount = parseFloat(((totalAmount * ownerSharePercent) / 100).toFixed(2));
      const tapperShareAmount = parseFloat((totalAmount - ownerShareAmount).toFixed(2));

      await onUpdateTransaction(selectedTx.id, {
        dry_weight_sample_g: dryWeightG,
        drc_percentage: calculatedDrc,
        dry_weight_kg: dryWeightKg,
        price_per_kg: finalPricePerKg,
        price_source: priceSource,
        total_amount: totalAmount,
        owner_share_amount: ownerShareAmount,
        tapper_share_amount: tapperShareAmount,
        status: 'ready_to_pay',
        testing_by: null,
        tested_by_user_id: currentUser?.id || null,
        tested_by_name: labInspector?.name || currentUser?.full_name || inspectorName,
        tested_by_phone: labInspector?.phone || currentUser?.phone_number || null
      });

      // Auto select next waiting queue item
      const remainingQueues = waitingDrcList.filter(t => t.id !== selectedTx.id);
      if (remainingQueues.length > 0) {
        handleSelectTx(remainingQueues[0]);
      } else {
        setSelectedTx(null);
        setMobileTab('queue');
      }
      setGrossWeightInput('');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกผล DRC');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Mobile Sub-Navigation Tabs (< 768px screens) */}
      <div className="mobile-drc-tabs" style={{ display: 'none', gap: '0.5rem', marginBottom: '1rem' }}>
        <button 
          type="button" 
          onClick={() => setMobileTab('queue')}
          style={{
            flex: 1,
            padding: '0.75rem',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 'bold',
            background: mobileTab === 'queue' ? '#166534' : '#e2e8f0',
            color: mobileTab === 'queue' ? '#fff' : '#1e293b',
            cursor: 'pointer'
          }}
        >
          📋 คิวรอตรวจ ({waitingDrcList.length})
        </button>
        <button 
          type="button" 
          onClick={() => setMobileTab('testing')}
          style={{
            flex: 1,
            padding: '0.75rem',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 'bold',
            background: mobileTab === 'testing' ? '#166534' : '#e2e8f0',
            color: mobileTab === 'testing' ? '#fff' : '#1e293b',
            cursor: 'pointer'
          }}
        >
          🧪 คีย์ผล DRC {selectedTx ? `(${selectedTx.queue_number})` : ''}
        </button>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-drc-tabs { display: flex !important; }
          .drc-grid { display: flex !important; flexDirection: column !important; }
          .drc-grid > div:first-child { display: ${mobileTab === 'queue' ? 'block' : 'none'} !important; }
          .drc-grid > div:last-child { display: ${mobileTab === 'testing' ? 'block' : 'none'} !important; }
        }
      `}</style>

      <div className="drc-grid">
        {/* Left Column: Waiting Queue List */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="section-title-icon" style={{ margin: 0 }}>
              🧪 คิวรอตรวจ DRC ({waitingDrcList.length})
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
              📡 Real-time Sync
            </span>
          </div>
          
          {waitingDrcList.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
              📭 ไม่มีคิวรอตรวจ DRC ในระบบ เสมียนยังไม่ได้บันทึกคิวใหม่เข้ามา
            </div>
          ) : (
            <div className="drc-queue-list">
              {waitingDrcList.map((tx) => {
                const isLocked = tx.status === 'in_drc_testing' || tx.status === 'IN_DRC_TESTING';
                const isSelected = selectedTx?.id === tx.id;

                return (
                  <div 
                    key={tx.id} 
                    className={`drc-queue-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectTx(tx)}
                    style={{
                      borderLeft: isLocked ? '4px solid #f59e0b' : '4px solid transparent',
                      background: isSelected ? 'rgba(34, 197, 94, 0.12)' : (isLocked ? 'rgba(245, 158, 11, 0.08)' : 'transparent')
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '1.15rem', color: 'var(--primary-dark)' }}>{tx.queue_number}</strong>
                        {isLocked && (
                          <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#d97706', padding: '1px 6px', borderRadius: '6px', fontWeight: 'bold' }}>
                            🔒 {tx.testing_by ? `กำลังตรวจโดย ${tx.testing_by}` : 'กำลังตรวจ'}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>{tx.seller_name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{parseFloat(tx.raw_weight_kg).toFixed(1)} กก.</span>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>เปียก: {tx.wet_weight_sample_g || defaultWetWeightG}g</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Digital Numpad and DRC Calculation */}
        <div className="drc-panel">
          {selectedTx ? (
            <>
              <div className="drc-header-info">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ color: 'var(--primary-dark)', margin: 0 }}>คิว {selectedTx.queue_number}</h2>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      น้ำยางสด {parseFloat(selectedTx.raw_weight_kg).toFixed(2)} กก.
                    </span>
                    <button
                      type="button"
                      onClick={handleReleaseLock}
                      style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#dc2626', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                      title="ยกเลิกการล็อกคิว และคืนคิวกลับสู่รายการรอตรวจ"
                    >
                      🔓 ปลดล็อก
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  <strong>ผู้ขาย:</strong> {selectedTx.seller_name}
                </div>
              </div>

              {/* Digital Numpad Display - Split into Cup and Gross */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {/* Cup Weight */}
                <div 
                  className={`numpad-display-box ${focusedInput === 'cup' ? 'focused' : ''}`}
                  onClick={() => setFocusedInput('cup')}
                  style={{ 
                    cursor: 'pointer', margin: 0, padding: '0.75rem',
                    border: focusedInput === 'cup' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                    background: focusedInput === 'cup' ? '#f0fdf4' : '#f8fafc',
                    boxShadow: focusedInput === 'cup' ? '0 4px 12px rgba(22, 163, 74, 0.15)' : 'none',
                    textAlign: 'center'
                  }}
                >
                  <div className="numpad-display-label" style={{ fontSize: '0.85rem', color: focusedInput === 'cup' ? '#166534' : '#64748b', marginBottom: '0.4rem' }}>
                    1. น้ำหนักถ้วยเปล่า
                  </div>
                  <div className={`numpad-display-val ${cupWeightInput ? '' : 'placeholder'}`} style={{ fontSize: '2rem', textAlign: 'center' }}>
                    {cupWeightInput || '0'} <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>g</span>
                  </div>
                </div>

                {/* Gross Weight */}
                <div 
                  className={`numpad-display-box ${focusedInput === 'gross' ? 'focused' : ''}`}
                  onClick={() => setFocusedInput('gross')}
                  style={{ 
                    cursor: 'pointer', margin: 0, padding: '0.75rem',
                    border: focusedInput === 'gross' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                    background: focusedInput === 'gross' ? '#f0fdf4' : '#fff',
                    boxShadow: focusedInput === 'gross' ? '0 4px 12px rgba(22, 163, 74, 0.15)' : 'none',
                    textAlign: 'center'
                  }}
                >
                  <div className="numpad-display-label" style={{ fontSize: '0.85rem', color: focusedInput === 'gross' ? '#166534' : '#64748b', marginBottom: '0.4rem' }}>
                    2. ถ้วย + ยางแห้ง
                  </div>
                  <div className={`numpad-display-val ${grossWeightInput ? '' : 'placeholder'}`} style={{ fontSize: '2rem', textAlign: 'center' }}>
                    {grossWeightInput || '0.00'} <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>g</span>
                  </div>
                </div>
              </div>

              {/* Automatic Calculation Preview */}
              <div className="drc-calculator-preview" style={isImpossibleDrc && dryWeightG > 0 ? { background: '#fffbeb', borderColor: '#fef08a' } : {}}>
                <div className="drc-calc-formula">
                  <div style={{ fontSize: '0.9rem', marginBottom: '0.2rem' }}>ยางแห้งสุทธิ: {grossWeightG || 0} - {cupWeightG || 0} = <strong style={{color: '#16a34a', fontSize: '1.1rem'}}>{dryWeightG.toFixed(2)}g</strong></div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>สูตร DRC: (แห้ง {dryWeightG.toFixed(2)} / เปียก {wetWeightG.toFixed(1)}) × 100</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="drc-calc-result" style={isImpossibleDrc && dryWeightG > 0 ? { color: '#b45309' } : {}}>
                    {drcPercentage.toFixed(2)}%
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>DRC %</div>
                </div>
              </div>

              {/* Warnings for unusual DRC % */}
              {grossWeightG > (cupWeightG + wetWeightG) && (
                <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #f87171', color: '#b91c1c', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <span>🚨</span> 
                  <span>
                    <strong>ข้อมูลผิดพลาด:</strong> "2. ถ้วย+ยางแห้ง" ต้องไม่เกิน "1. ถ้วยเปล่า" + "น้ำหนักเปียก" (รวม {cupWeightG + wetWeightG}g)
                  </span>
                </div>
              )}
              {isImpossibleDrc && dryWeightG > 0 && !(grossWeightG > (cupWeightG + wetWeightG)) && (
                <div style={{ padding: '0.5rem 0.75rem', background: '#fffbeb', border: '1px solid #fef08a', color: '#b45309', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <span>⚠️</span> 
                  <span>
                    {drcPercentage > 60 
                      ? 'คำเตือน: % DRC สูงเกิน 60% (ปกติไม่เกิน 45%) กรุณาตรวจสอบการกรอกข้อมูล' 
                      : 'คำเตือน: % DRC ต่ำกว่า 10% (ปกติไม่ต่ำกว่า 15%) กรุณาตรวจสอบการกรอกข้อมูล'}
                  </span>
                </div>
              )}

              {/* Digital Numpad Buttons */}
              <div className="numpad-grid">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button 
                    key={num} 
                    type="button" 
                    className="numpad-btn" 
                    onClick={() => handleNumClick(String(num))}
                  >
                    {num}
                  </button>
                ))}
                <button type="button" className="numpad-btn clear" onClick={handleClear}>C</button>
                <button type="button" className="numpad-btn" onClick={() => handleNumClick('0')}>0</button>
                <button type="button" className="numpad-btn" onClick={() => handleNumClick('.')}>.</button>
                <button type="button" className="numpad-btn backspace" style={{ gridColumn: 'span 3' }} onClick={handleBackspace}>
                  ⌫ ลบทีละตัว
                </button>

                {/* Price Preview (live calculation based on current DRC%) — ซ่อนในโหมด Lab Restricted */}
                {dryWeightG > 0 && !isImpossibleDrc && !isRestrictedMode && (() => {
                  const isTiered = dailySettings?.pricing_mode === 'tiered' && dailySettings?.price_tiers?.length > 0;
                  let previewPrice = 0;
                  let previewLabel = '';
                  let needsManual = false;

                  if (selectedTx?.manual_price_override) {
                    previewPrice = parseFloat(selectedTx.price_per_kg || 0);
                    previewLabel = `✏️ ราคาพิเศษ (${selectedTx.override_reason || 'Manual'})`;
                  } else {
                    const resolved = db.resolvePriceFromTiers(drcPercentage, dailySettings?.price_tiers, dailySettings?.base_price);
                    previewPrice = resolved.price;
                    previewLabel = resolved.from_tier ? `📊 ${resolved.tier_label}` : resolved.needs_manual ? '⚠️ นอกช่วง Tier' : '💰 ราคาปกติ';
                    needsManual = resolved.needs_manual;
                  }

                  const rawKg = parseFloat(selectedTx?.raw_weight_kg || 0);
                  const estDryKg = parseFloat(((rawKg * drcPercentage) / 100).toFixed(2));
                  const estTotal = parseFloat((estDryKg * previewPrice).toFixed(2));

                  return (
                    <div style={{
                      gridColumn: 'span 3',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '8px',
                      background: needsManual ? '#fffbeb' : '#f0fdf4',
                      border: needsManual ? '1px solid #fde047' : '1px solid #86efac',
                      fontSize: '0.8rem',
                      color: needsManual ? '#713f12' : '#166534',
                    }}>
                      <div style={{ fontWeight: '700', marginBottom: '0.25rem' }}>{previewLabel}</div>
                      {needsManual ? (
                        <div>ไม่พบช่วง Tier ที่ตรง → ระบบจะขอให้กรอกราคาเมื่อ submit</div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>ยางแห้ง ~{estDryKg} กก. × ฿{previewPrice.toFixed(2)}</span>
                          <span style={{ fontWeight: '800', fontSize: '0.9rem' }}>≈ ฿{estTotal.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* DRC % Preview ในโหมด Restricted (ไม่แสดงราคา) */}
                {dryWeightG > 0 && !isImpossibleDrc && isRestrictedMode && (
                  <div style={{
                    gridColumn: 'span 3',
                    padding: '0.65rem 0.75rem', borderRadius: '8px',
                    background: '#f0fdf4', border: '1px solid #86efac',
                    fontSize: '0.8rem', color: '#166534'
                  }}>
                    <div style={{ fontWeight: '700' }}>📊 ผล %DRC ที่คำนวณได้: {drcPercentage.toFixed(2)}%</div>
                    <div style={{ marginTop: '0.2rem', color: '#4ade80' }}>✅ พร้อมส่งผลให้เสมียน</div>
                  </div>
                )}

                <button 
                  type="button" 
                  className="numpad-btn submit" 
                  disabled={submitting || dryWeightG <= 0}
                  onClick={handleSubmitDrc}
                >
                  {submitting ? 'กำลังบันทึก...' : '🧪 ยืนยันผล DRC และส่งข้อมูลให้เสมียน'}
                </button>
              </div>
            </>

          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔬</div>
              <h3>เลือกคิวที่ต้องการตรวจวิเคราะห์ DRC</h3>
              <p style={{ fontSize: '0.9rem', maxWidth: '300px', marginTop: '0.5rem' }}>
                เมื่อเสมียนบันทึก Weight In เข้ามา รายการจะมาปรากฏที่คิวด้านซ้ายมือโดยอัตโนมัติ
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DrcPortal;
