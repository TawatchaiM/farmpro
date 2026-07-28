import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { db } from '../supabase';

function Dashboard({ onEdit, onDelete }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterBuyer, setFilterBuyer] = useState('all');

  const processAndSetData = useCallback((rawList) => {
    const paidTxs = (rawList || []).filter(t => t.status === 'paid');
    const normalizedData = paidTxs.map(row => {
      let d = row.date ? String(row.date) : '';
      if (d.includes('/')) {
        const p = d.split('/');
        if (p.length === 3 && p[2].length === 4) {
           d = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        }
      }
      return { 
        ...row, 
        date: d,
        // Map DB column names to what dashboard expects
        buyer_name: row.buyer_name || 'ร้านรับซื้อยาง FarmPro',
        owner_share_55_thb: row.owner_share_amount !== null && row.owner_share_amount !== undefined
          ? row.owner_share_amount 
          : (parseFloat(row.total_amount || 0) * 0.55),
        total_amount_thb: row.total_amount || 0
      };
    });
    setData(normalizedData);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // 1. Instant Render from local cache via Stale-While-Revalidate
      const cachedResult = await db.getAllTransactionsSWR((freshData) => {
        // 2. Background Sync update on fresh data
        processAndSetData(freshData);
      });
      processAndSetData(cachedResult);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      try {
        const fallback = await db.getAllTransactions();
        processAndSetData(fallback);
      } catch (e) {
        setError('ไม่สามารถเชื่อมต่อดึงข้อมูลได้ โปรดตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง');
      }
    } finally {
      setLoading(false);
    }
  }, [processAndSetData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived state for filters
  const uniqueMonths = useMemo(() => {
    const months = new Set(data.map(d => d.date ? d.date.substring(0, 7) : ''));
    return Array.from(months).filter(Boolean).sort().reverse();
  }, [data]);

  const uniqueBuyers = useMemo(() => {
    const buyers = new Set(data.map(d => d.buyer_name));
    return Array.from(buyers).filter(Boolean).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    const getLocalThresholdStr = (daysAgo) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const sevenDaysAgo = getLocalThresholdStr(7);
    const thirtyDaysAgo = getLocalThresholdStr(30);
    const currentYear = new Date().getFullYear().toString();

    return data.filter(row => {
      if (filterBuyer !== 'all' && row.buyer_name !== filterBuyer) return false;
      
      if (filterMonth !== 'all') {
        if (!row.date) return false;
        const rowDateStr = row.date.substring(0, 10);
        
        if (filterMonth === '7days') {
          if (rowDateStr < sevenDaysAgo) return false;
        } else if (filterMonth === '30days') {
          if (rowDateStr < thirtyDaysAgo) return false;
        } else if (filterMonth === 'thisYear') {
          if (!rowDateStr.includes(currentYear)) return false;
        } else {
          if (rowDateStr.substring(0, 7) !== filterMonth) return false;
        }
      }
      return true;
    });
  }, [data, filterMonth, filterBuyer]);

  if (loading) {
    return (
      <div className="card loading-overlay">
        <div className="spinner"></div>
        <div className="loading-text">กำลังโหลดข้อมูลจาก Google Sheet...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
        <h3 style={{ color: '#d32f2f' }}>พบข้อผิดพลาด</h3>
        <p>{error}</p>
      </div>
    );
  }

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.substring(0, 10).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const totalOwnerShare = filteredData.reduce((sum, row) => sum + (parseFloat(row.owner_share_55_thb) || 0), 0);
  const totalDryWeight = filteredData.reduce((sum, row) => sum + (parseFloat(row.dry_weight_kg) || 0), 0);
  const totalRawWeight = filteredData.reduce((sum, row) => sum + (parseFloat(row.raw_weight_kg) || 0), 0);
  const totalSalesDays = new Set(filteredData.filter(row => row.date).map(row => row.date.substring(0, 10))).size;

  const drcValues = filteredData.map(row => parseFloat(row.drc_percentage)).filter(val => !isNaN(val) && val > 0);
  const avgDrc = drcValues.length > 0 ? drcValues.reduce((sum, val) => sum + val, 0) / drcValues.length : 0;

  const chartData = filteredData.map((row) => ({
    name: row.date ? formatDateDisplay(String(row.date)) : `รายการ ${row.id}`,
    'ส่วนแบ่ง (บาท)': parseFloat(row.owner_share_55_thb) || 0,
    'ยางแห้ง (กก.)': parseFloat(row.dry_weight_kg) || 0
  }));

  const allRecords = [...filteredData].reverse(); // Show newest first

  return (
    <div>
      {/* Filters */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>ตัวกรองข้อมูล (Filters)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>เดือน-ปี</label>
            <select 
              className="form-input" 
              style={{ width: '100%', cursor: 'pointer' }}
              value={filterMonth} 
              onChange={e => setFilterMonth(e.target.value)}
            >
              <option value="all">ทั้งหมด (All Time)</option>
              <option value="7days">7 วันล่าสุด (รายสัปดาห์)</option>
              <option value="30days">30 วันล่าสุด (รายเดือน)</option>
              <option value="thisYear">ปีนี้ (รายปี)</option>
              <optgroup label="เลือกตามเดือน">
                {uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}
              </optgroup>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>ร้านรับซื้อ</label>
            <select 
              className="form-input" 
              style={{ width: '100%', cursor: 'pointer' }}
              value={filterBuyer} 
              onChange={e => setFilterBuyer(e.target.value)}
            >
              <option value="all">ทุกร้าน</option>
              {uniqueBuyers.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="share-highlight" style={{ marginBottom: '1.5rem', marginTop: 0 }}>
        <div>
          <h3>รายรับรวม (ส่วนแบ่ง 55%)</h3>
          <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>รายได้ทั้งหมดในช่วงเวลาที่เลือก</p>
        </div>
        <div className="amount">
          ฿{totalOwnerShare.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-title">น้ำหนักยางแห้งรวม</div>
          <div className="stat-value">{totalDryWeight.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} กก.</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">น้ำหนักยางสดรวม</div>
          <div className="stat-value">{totalRawWeight.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} กก.</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">เปอร์เซ็นต์เฉลี่ย</div>
          <div className="stat-value">{avgDrc > 0 ? avgDrc.toFixed(2) : '-'} %</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">จำนวนวันขายยาง</div>
          <div className="stat-value">{totalSalesDays} วัน</div>
        </div>
      </div>

      <div className="chart-container">
        <div className="chart-title">แนวโน้มรายรับและน้ำหนักยางแห้ง</div>
        <div style={{ width: '100%', height: 350 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 25, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="name" tick={{fontSize: 10}} angle={-45} textAnchor="end" />
              <YAxis yAxisId="left" tick={{fontSize: 10}} stroke="var(--primary)" />
              <YAxis yAxisId="right" orientation="right" tick={{fontSize: 10}} stroke="#ff9800" />
              <Tooltip formatter={(value, name) => [`${value.toLocaleString()}`, name]} />
              <Legend verticalAlign="top" height={36} />
              <Line yAxisId="left" type="monotone" dataKey="ส่วนแบ่ง (บาท)" stroke="var(--primary)" strokeWidth={3} activeDot={{ r: 6 }} />
              <Line yAxisId="right" type="monotone" dataKey="ยางแห้ง (กก.)" stroke="#ff9800" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-container">
        <div className="chart-title">ประวัติการขายทั้งหมด</div>
        <div className="record-list">
          {allRecords.length > 0 ? allRecords.map((record, i) => (
            <div key={i} className="record-item" style={{ flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 600 }}>{record.date ? formatDateDisplay(record.date) : ''} (ID: {record.id})</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{record.buyer_name}</div>
                {record.note && <div style={{ fontSize: '0.75rem', color: '#ff9800', marginTop: '4px' }}>หมายเหตุ: {record.note}</div>}
              </div>
              <div style={{ flex: '1 1 150px', textAlign: 'right', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>
                  ฿{parseFloat(record.owner_share_55_thb || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  ยางแห้ง: {record.dry_weight_kg} กก.
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  ราคาซื้อ: ฿{parseFloat(record.price_per_kg || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}/กก.
                </div>
              </div>
              <div style={{ width: '100%', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button 
                  onClick={() => onEdit(record)} 
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '6px', background: '#e3f2fd', color: '#1976d2', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  ✏️ แก้ไข
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้? (การลบจะไม่สามารถกู้คืนได้)')) {
                      onDelete(record.id);
                    }
                  }} 
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '6px', background: '#ffebee', color: '#d32f2f', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  🗑️ ลบ
                </button>
              </div>
            </div>
          )) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>ไม่พบข้อมูลที่ตรงกับตัวกรอง</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
