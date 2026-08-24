import React, { useState, useEffect } from 'react';
import { db } from '../supabase';

function ManualBillForm({ transactions, currentUser, onUpdateTransaction }) {
  const [formData, setFormData] = useState({
    transaction_id: null,
    seller_name: '',
    date: new Date().toISOString().split('T')[0],
    buyer_name: currentUser?.store_name || currentUser?.full_name || '',
    raw_weight_kg: '',
    drc_percentage: '',
    price_per_kg: '',
    owner_share_percentage: '50', // Default
  });
  
  const safeTxList = Array.isArray(transactions) ? transactions : [];
  const readyToPayList = safeTxList.filter(t => t.status === 'ready_to_pay' || t.status === 'READY_TO_PAY');

  const [calculations, setCalculations] = useState({
    dry_weight_kg: '0.00',
    total_amount_thb: '0.00',
    owner_share_thb: '0.00',
    tapper_share_thb: '0.00'
  });

  useEffect(() => {
    const raw = parseFloat(formData.raw_weight_kg) || 0;
    const drc = parseFloat(formData.drc_percentage) || 0;
    const price = parseFloat(formData.price_per_kg) || 0;
    const share = parseFloat(formData.owner_share_percentage) || 0;
    
    const dry = (raw * drc) / 100;
    const total = dry * price;
    const ownerAmount = (total * share) / 100;
    const tapperAmount = total - ownerAmount;
    
    setCalculations({
      dry_weight_kg: dry.toFixed(2),
      total_amount_thb: total.toFixed(2),
      owner_share_thb: ownerAmount.toFixed(2),
      tapper_share_thb: tapperAmount.toFixed(2)
    });
  }, [formData.raw_weight_kg, formData.drc_percentage, formData.price_per_kg, formData.owner_share_percentage]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveData = async () => {
    if (formData.transaction_id && onUpdateTransaction) {
      try {
        await onUpdateTransaction(formData.transaction_id, {
          status: 'ready_to_pay', // Keep it in ready_to_pay queue until explicitly paid
          total_amount_thb: parseFloat(calculations.total_amount_thb),
          owner_share_thb: parseFloat(calculations.owner_share_thb),
          price_per_kg: parseFloat(formData.price_per_kg),
          drc_percentage: parseFloat(formData.drc_percentage),
          raw_weight_kg: parseFloat(formData.raw_weight_kg),
          owner_share_percentage: parseFloat(formData.owner_share_percentage),
          dry_weight_kg: parseFloat(calculations.dry_weight_kg)
        });
        
        // Reset form after saving
        setFormData(prev => ({
          ...prev,
          transaction_id: null,
          seller_name: '',
          raw_weight_kg: '',
          drc_percentage: '',
          price_per_kg: '',
        }));
        
        alert('บันทึกข้อมูลเรียบร้อยแล้ว!\nข้อมูลถูกส่งไปที่ "คิวรอชำระเงินและออกบิล" ในหน้าระบบเสมียนแล้วครับ');
      } catch (err) {
        console.error('Failed to update transaction:', err);
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
      }
    } else {
      alert('กรุณาเลือกลูกค้าจากคิวรอชำระเงิน / ออกบิล ก่อนครับ');
    }
  };

  const handleSelectTx = (tx) => {
    setFormData(prev => ({
      ...prev,
      transaction_id: tx.id,
      seller_name: tx.seller_name,
      buyer_name: currentUser?.store_name || currentUser?.full_name || 'ร้านรับซื้อยาง FarmPro',
      raw_weight_kg: tx.raw_weight_kg || '',
      drc_percentage: tx.drc_percentage || '',
      price_per_kg: tx.price_per_kg || '',
      owner_share_percentage: tx.owner_share_percentage || '50'
    }));
  };

  return (
    <div className="card">
      <div className="header">
        <h2>ออกบิลรับซื้อ (ดึงข้อมูล / กรอกเอง)</h2>
        <p>คำนวณยอดเงินและส่วนแบ่งทันที</p>
      </div>

      {readyToPayList.length > 0 && (
        <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', color: '#0f172a', fontSize: '1rem' }}>
            📥 คิวรอจ่ายเงิน / ออกบิล ({readyToPayList.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {readyToPayList.map(tx => (
              <button 
                type="button"
                key={tx.id}
                onClick={() => handleSelectTx(tx)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  background: formData.transaction_id === tx.id ? '#e0f2fe' : '#ffffff',
                  border: formData.transaction_id === tx.id ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', color: '#1e293b' }}>
                    {tx.seller_name} {tx.queue_number ? `(คิว ${tx.queue_number})` : ''}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                    น้ำหนักสด: {tx.raw_weight_kg} กก. | DRC: {parseFloat(tx.drc_percentage || 0).toFixed(2)}%
                  </div>
                </div>
                <div style={{ background: '#3b82f6', color: '#fff', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                  ดึงข้อมูล
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()}>
        {formData.seller_name && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#eff6ff', borderRadius: '6px', color: '#1e40af', fontWeight: 'bold' }}>
            ออกบิลสำหรับ: {formData.seller_name}
          </div>
        )}
        <div className="form-grid">
          <div className="form-group">
            <label>วันที่</label>
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
            <label>ชื่อร้านรับซื้อ / ผู้ซื้อ (ไม่บังคับ)</label>
            <input 
              type="text" 
              name="buyer_name" 
              value={formData.buyer_name} 
              onChange={handleChange} 
              className="form-input" 
              placeholder="เช่น ร้านเจ๊น้อย..."
            />
          </div>

          <div className="form-group">
            <label>น้ำหนักน้ำยางสด (กก.)</label>
            <div className="input-with-icon">
              <input 
                type="number" 
                inputMode="decimal"
                step="0.01"
                name="raw_weight_kg" 
                value={formData.raw_weight_kg} 
                onChange={handleChange} 
                className="form-input" 
                placeholder="0.00"
              />
              <span className="input-unit">กก.</span>
            </div>
          </div>

          <div className="form-group">
            <label>เปอร์เซ็นต์น้ำยาง (%)</label>
            <div className="input-with-icon">
              <input 
                type="number" 
                inputMode="decimal"
                step="0.01"
                name="drc_percentage" 
                value={formData.drc_percentage} 
                onChange={handleChange} 
                className="form-input"
                placeholder="0.00"
              />
              <span className="input-unit">%</span>
            </div>
          </div>

          <div className="form-group">
            <label>ราคาซื้อ (บาท/กก.)</label>
            <div className="input-with-icon">
              <input 
                type="number" 
                inputMode="decimal"
                step="0.01"
                name="price_per_kg" 
                value={formData.price_per_kg} 
                onChange={handleChange} 
                className="form-input"
                placeholder="0.00"
              />
              <span className="input-unit">บาท</span>
            </div>
          </div>

          <div className="form-group">
            <label>สัดส่วนเจ้าของสวน (%)</label>
            <select 
              name="owner_share_percentage" 
              value={formData.owner_share_percentage} 
              onChange={handleChange}
              className="form-input"
              style={{ cursor: 'pointer' }}
            >
              <option value="50">50% (แบ่งครึ่ง)</option>
              <option value="55">55%</option>
              <option value="60">60%</option>
              <option value="65">65%</option>
              <option value="70">70%</option>
            </select>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>น้ำหนักยางแห้งสุทธิ (กก.)</label>
            <div className="input-with-icon">
              <input 
                type="text" 
                value={calculations.dry_weight_kg} 
                className="form-input" 
                style={{ background: '#f3f4f6', color: '#374151' }}
                readOnly
              />
              <span className="input-unit">กก.</span>
            </div>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>เงินรวมทั้งสิ้น (บาท)</label>
            <div className="input-with-icon">
              <input 
                type="text" 
                value={calculations.total_amount_thb} 
                className="form-input" 
                style={{ fontWeight: 'bold', color: 'var(--primary-dark)', fontSize: '1.25rem', background: '#e8f5e9' }}
                readOnly
              />
              <span className="input-unit">บาท</span>
            </div>
          </div>

          <div className="share-highlight">
            <div>
              <h3>ส่วนแบ่งเจ้าของสวน ({formData.owner_share_percentage}%)</h3>
            </div>
            <div className="amount">
              ฿{calculations.owner_share_thb}
            </div>
          </div>

          <div className="share-highlight" style={{ background: 'linear-gradient(135deg, #78909c 0%, #455a64 100%)', marginTop: '0.5rem' }}>
            <div>
              <h3>ส่วนแบ่งคนกรีด ({100 - parseFloat(formData.owner_share_percentage || 0)}%)</h3>
            </div>
            <div className="amount">
              ฿{calculations.tapper_share_thb}
            </div>
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', background: '#059669', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
          onClick={handleSaveData}
        >
          💾 บันทึก/ส่งข้อมูล
        </button>
      </form>
    </div>
  );
}

export default ManualBillForm;
