import React, { useState, useEffect } from 'react';
import { db } from '../supabase';

function ClerkPortal({ currentUser, dailySettings, transactions, onCreateTransaction, onUpdateTransaction }) {
  // Local states
  const [sellerName, setSellerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [rawWeightKg, setRawWeightKg] = useState('');
  
  // Farm management states
  const [sellerFarms, setSellerFarms] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState('new');
  const [ownerName, setOwnerName] = useState('');
  const [ownerSharePercentage, setOwnerSharePercentage] = useState(50);
  const [fetchingFarms, setFetchingFarms] = useState(false);

  const [creatingTx, setCreatingTx] = useState(false);

  // Filter queues (Supports normalized status strings PENDING_DRC, IN_DRC_TESTING, READY_TO_PAY)
  const safeTxList = Array.isArray(transactions) ? transactions : [];
  const readyToPayList = safeTxList.filter(t => t.status === 'ready_to_pay' || t.status === 'READY_TO_PAY');
  const waitingDrcList = safeTxList.filter(t => t.status === 'waiting_drc' || t.status === 'PENDING_DRC' || t.status === 'in_drc_testing' || t.status === 'IN_DRC_TESTING');

  // Fetch Farms when phone number reaches 10 digits
  useEffect(() => {
    const fetchFarms = async () => {
      if (phoneNumber.length >= 9) {
        setFetchingFarms(true);
        try {
          const profile = await db.getProfileByPhone(phoneNumber);
          if (profile) {
            setSellerName(profile.full_name);
            const farms = await db.getUserFarms(profile.id);
            setSellerFarms(farms);
            
            if (farms.length === 1) {
              const farm = farms[0];
              setSelectedFarmId(farm.id);
              setOwnerName(farm.owner_name);
              setOwnerSharePercentage(farm.owner_share_percent);
            } else if (farms.length > 1) {
              const defaultFarm = farms.find(f => f.is_default);
              if (defaultFarm) {
                setSelectedFarmId(defaultFarm.id);
                setOwnerName(defaultFarm.owner_name);
                setOwnerSharePercentage(defaultFarm.owner_share_percent);
              } else {
                setSelectedFarmId(''); // Prompt user to select
              }
            }
          } else {
            setSellerFarms([]);
            setSelectedFarmId('new');
          }
        } catch (err) {
          console.error(err);
        } finally {
          setFetchingFarms(false);
        }
      } else if (phoneNumber.length === 0) {
        setSellerFarms([]);
        setSelectedFarmId('new');
      }
    };
    
    const timer = setTimeout(() => { fetchFarms(); }, 500);
    return () => clearTimeout(timer);
  }, [phoneNumber]);

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

  // Handle Weight In Submit
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

    setCreatingTx(true);
    try {
      await onCreateTransaction({
        seller_name: sellerName,
        buyer_name: currentUser?.store_name || currentUser?.full_name || 'ร้านรับซื้อยาง FarmPro',
        phone_number: phoneNumber,
        farm_id: selectedFarmId === 'new' ? null : selectedFarmId,
        owner_name: ownerName || sellerName,
        raw_weight_kg: parseFloat(rawWeightKg),
        wet_weight_sample_g: parseFloat(dailySettings.wet_sample_weight_g),
        price_per_kg: parseFloat(dailySettings.base_price),
        owner_share_percentage: parseFloat(ownerSharePercentage),
        status: 'waiting_drc',
        created_by_user_id: currentUser?.id,
        created_by_name: currentUser?.full_name || 'พนักงาน'
      });
      
      // Clear form
      setSellerName('');
      setPhoneNumber('');
      setRawWeightKg('');
      alert('บันทึกน้ำหนักขาเข้าเรียบร้อย ส่งคิวเข้าระบบตรวจ DRC สำเร็จ');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกน้ำหนักขาเข้า');
    } finally {
      setCreatingTx(false);
    }
  };

  // Handle Mark as Paid
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

  // Copy E-Bill text for LINE
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

  // Handle thermal print in a clean popup window to isolate print style
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
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              color: #000;
              margin: 0;
              padding: 10px;
              width: 70mm;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .header-title { font-weight: bold; font-size: 14px; margin-bottom: 2px; }
            .divider { border-top: 1px dashed black; margin: 6px 0; }
            .double-divider { border-top: 2px double black; margin: 6px 0; }
            .row-data { display: flex; justify-content: space-between; margin-bottom: 3px; }
            .total-row { font-size: 13px; font-weight: bold; }
            .qr-placeholder {
              width: 80px;
              height: 80px;
              margin: 10px auto;
              border: 1px solid black;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 8px;
              font-family: sans-serif;
              text-align: center;
              background: white;
            }
            .barcode-placeholder {
              width: 160px;
              height: 25px;
              margin: 8px auto;
              background: repeating-linear-gradient(90deg, #000, #000 1.5px, #fff 1.5px, #fff 4px);
            }
            @media print {
              body { margin: 0; padding: 5px; }
            }
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
          <div class="row-data"><span>วันที่:</span> <span>${tx.date}</span></div>
          <div class="row-data"><span>ลูกค้า:</span> <span>${tx.seller_name}</span></div>
          ${tx.phone_number ? `<div class="row-data"><span>เบอร์โทร:</span> <span>${tx.phone_number}</span></div>` : ''}
          
          <div class="divider"></div>
          <div class="row-data"><span>น้ำยางสด (Weight In):</span> <span>${parseFloat(tx.raw_weight_kg).toFixed(2)} กก.</span></div>
          <div class="row-data"><span>สุ่มตรวจเปียก:</span> <span>${parseFloat(tx.wet_weight_sample_g).toFixed(2)} ก.</span></div>
          <div class="row-data"><span>อบแห้งได้:</span> <span>${parseFloat(tx.dry_weight_sample_g).toFixed(2)} ก.</span></div>
          <div class="row-data" style="font-weight: bold;"><span>% DRC:</span> <span>${parseFloat(tx.drc_percentage).toFixed(2)} %</span></div>
          <div class="row-data"><span>เนื้อยางแห้งสุทธิ:</span> <span>${parseFloat(tx.dry_weight_kg).toFixed(2)} กก.</span></div>
          <div class="row-data"><span>ราคา/กก.:</span> <span>${parseFloat(tx.price_per_kg).toFixed(2)} บาท</span></div>
          
          <div class="double-divider"></div>
          <div class="row-data total-row"><span>ยอดรวมสุทธิ:</span> <span>฿${parseFloat(tx.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          <div class="double-divider"></div>
          
          <div class="row-data"><span>สัดส่วนเจ้าของสวน:</span> <span>${tx.owner_share_percentage}%</span></div>
          <div class="row-data"><span>ส่วนแบ่งเจ้าของ:</span> <span>฿${parseFloat(tx.owner_share_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          <div class="row-data"><span>ส่วนแบ่งคนกรีด:</span> <span>฿${parseFloat(tx.tapper_share_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          
          <div class="divider"></div>
          <div class="qr-placeholder">
            E-BILL QR<br/>SCAN LINE
          </div>
          <div class="barcode-placeholder"></div>
          <div class="center" style="font-size: 8px; margin-top: 5px;">
            ${tx.id}
          </div>
          <div class="center" style="margin-top: 10px; font-weight: bold;">
            ขอบคุณที่ร่วมเป็นพันธมิตรกับเรา
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div>
      <div className="clerk-grid">
        {/* Row 1, Col 1: Weight In Form */}
        <div className="card">
          <h3 className="section-title-icon">⚖️ บันทึกน้ำหนักขาเข้า (Weight In)</h3>
          <form onSubmit={handleWeightInSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>ชื่อลูกค้า / ชาวสวน</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="ระบุชื่อจริง-นามสกุล" 
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>เบอร์โทรศัพท์ (LINE E-Bill)</label>
                <input 
                  type="tel" 
                  className="form-input" 
                  placeholder="เช่น 0812345678" 
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>

              {sellerFarms.length > 0 && (
                <div className="form-group" style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ color: '#0f172a' }}>🌳 เลือกสวน / เจ้าของสวน {fetchingFarms && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(กำลังค้นหา...)</span>}</label>
                  <select 
                    className="form-input"
                    value={selectedFarmId}
                    onChange={handleFarmSelect}
                    style={{ borderColor: '#cbd5e1', fontWeight: 'bold' }}
                  >
                    <option value="" disabled>-- กรุณาเลือกสวน --</option>
                    {sellerFarms.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.farm_name} (เจ้าของ: {f.owner_name} - หัก {f.owner_share_percent}%)
                      </option>
                    ))}
                    <option value="new">+ เป็นสวนใหม่ / กรอกข้อมูลเอง</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>น้ำหนักน้ำยางสดขาเข้า (Weight In)</label>
                <div className="input-with-icon">
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-input" 
                    placeholder="0.00" 
                    value={rawWeightKg}
                    onChange={(e) => setRawWeightKg(e.target.value)}
                    required
                  />
                  <span className="input-unit">กก.</span>
                </div>
              </div>

              {selectedFarmId === 'new' && (
                <div className="form-group">
                  <label>ชื่อเจ้าของสวน (สำหรับออกบิล)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="เช่น ลุงบุญ" 
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>
              )}

              <div className="form-group">
                <label>สัดส่วนเจ้าของสวน (%)</label>
                <select 
                  className="form-input"
                  value={ownerSharePercentage}
                  onChange={(e) => setOwnerSharePercentage(parseInt(e.target.value))}
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
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
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

      {/* Row 2: Ready to Pay Queue */}
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
                      <span>รวมสุทธิ:</span> 
                      <span className="val" style={{ color: 'var(--primary-dark)' }}>
                        ฿{parseFloat(tx.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      <span>สวน {tx.owner_share_percentage}%:</span> 
                      <span>฿{ownerShare.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</span>
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      <span>กรีด {100 - tx.owner_share_percentage}%:</span> 
                      <span>฿{tapperShare.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</span>
                    </p>
                  </div>
                  <div className="queue-actions">
                    <button 
                      className="btn-sm btn-print" 
                      onClick={() => handlePrint(tx)}
                      title="พิมพ์บิลขนาด 7x10 cm"
                    >
                      🖨️ พิมพ์บิล
                    </button>
                    <button 
                      className="btn-sm btn-line" 
                      onClick={() => handleCopyLineBill(tx)}
                      title="ส่ง LINE E-Bill"
                    >
                      💬 ส่ง LINE
                    </button>
                    <button 
                      className="btn-sm btn-pay" 
                      onClick={() => handleMarkPaid(tx.id)}
                    >
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
