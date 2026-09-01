import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { db } from '../supabase';

function Dashboard({ currentUser, onEdit, onDelete }) {
  const [data, setData] = useState([]);
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [filterMonth, setFilterMonth] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [filterBuyer, setFilterBuyer] = useState('all');
  const [viewRole, setViewRole] = useState('owner'); // 'owner' or 'tapper'

  // Fetch plots to know which ones the user owns vs taps
  const fetchUserPlots = useCallback(async () => {
    if (!currentUser) return [];
    try {
      const userPlots = await db.getRubberPlots(currentUser.user_id || currentUser.id);
      setPlots(userPlots);
      return userPlots;
    } catch (err) {
      console.error('Failed to load user plots:', err);
      return [];
    }
  }, [currentUser]);

  const processAndSetData = useCallback((rawList, userPlots) => {
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
        buyer_name: row.buyer_name || 'ร้านรับซื้อยาง FarmPro',
        owner_share_thb: row.owner_share_amount !== null && row.owner_share_amount !== undefined
          ? row.owner_share_amount 
          : (parseFloat(row.total_amount || 0) * (parseFloat(row.owner_share_percentage || 50) / 100)),
        tapper_share_thb: row.tapper_share_amount !== null && row.tapper_share_amount !== undefined
          ? row.tapper_share_amount
          : (parseFloat(row.total_amount || 0) * ((100 - parseFloat(row.owner_share_percentage || 50)) / 100)),
        total_amount_thb: row.total_amount || 0
      };
    });
    setData(normalizedData);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const userPlots = await fetchUserPlots();
    
    // Auto-set default role if user is only a tapper
    if (currentUser) {
      const isOwner = userPlots.some(p => p.owner_id === (currentUser.user_id || currentUser.id));
      const isTapper = userPlots.some(p => p.tapper_id === (currentUser.user_id || currentUser.id));
      if (isTapper && !isOwner) {
        setViewRole('tapper');
      }
    }

    try {
      const cachedResult = await db.getAllTransactionsSWR((freshData) => {
        processAndSetData(freshData, userPlots);
      });
      processAndSetData(cachedResult, userPlots);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      try {
        const fallback = await db.getAllTransactions();
        processAndSetData(fallback, userPlots);
      } catch (e) {
        setError('ไม่สามารถเชื่อมต่อดึงข้อมูลได้ โปรดตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง');
      }
    } finally {
      setLoading(false);
    }
  }, [processAndSetData, fetchUserPlots, currentUser]);

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
      // Role filtering (if currentUser is available)
      if (currentUser) {
        const userId = currentUser.user_id || currentUser.id;
        const plot = plots.find(p => p.plot_id === row.plot_id);
        
        if (viewRole === 'owner') {
          // Show if the transaction plot belongs to user as owner, or if missing plot_id, assume they are the owner for legacy data
          if (plot) {
            if (plot.owner_id !== userId) return false;
          } else {
            // Legacy data fallback (assume owner if no plot_id is set)
            // Or could check if owner_name matches, but let's just let it pass
          }
        } else if (viewRole === 'tapper') {
          // Show if the transaction plot has user as tapper
          if (!plot || plot.tapper_id !== userId) return false;
        }
      }

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
        } else if (filterMonth === 'custom') {
          if (customStartDate && rowDateStr < customStartDate) return false;
          if (customEndDate && rowDateStr > customEndDate) return false;
        } else {
          if (rowDateStr.substring(0, 7) !== filterMonth) return false;
        }
      }
      return true;
    });
  }, [data, filterMonth, filterBuyer, viewRole, currentUser, plots, customStartDate, customEndDate]);

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.substring(0, 10).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const totalShare = filteredData.reduce((sum, row) => sum + (viewRole === 'owner' ? (parseFloat(row.owner_share_thb) || 0) : (parseFloat(row.tapper_share_thb) || 0)), 0);
  const totalDryWeight = filteredData.reduce((sum, row) => sum + (parseFloat(row.dry_weight_kg) || 0), 0);
  const totalRawWeight = filteredData.reduce((sum, row) => sum + (parseFloat(row.raw_weight_kg) || 0), 0);
  const totalSalesDays = new Set(filteredData.filter(row => row.date).map(row => row.date.substring(0, 10))).size;

  const drcValues = filteredData.map(row => parseFloat(row.drc_percentage)).filter(val => !isNaN(val) && val > 0);
  const avgDrc = drcValues.length > 0 ? drcValues.reduce((sum, val) => sum + val, 0) / drcValues.length : 0;

  const chartData = filteredData.map((row) => ({
    name: row.date ? formatDateDisplay(String(row.date)) : `รายการ ${row.id}`,
    'รายรับ (บาท)': viewRole === 'owner' ? (parseFloat(row.owner_share_thb) || 0) : (parseFloat(row.tapper_share_thb) || 0),
    'ยางแห้ง (กก.)': parseFloat(row.dry_weight_kg) || 0
  }));

  const allRecords = [...filteredData].reverse(); // Show newest first

  return (
    <div>
      {/* Role Toggle */}
      {currentUser && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            onClick={() => setViewRole('owner')}
            style={{
              flex: 1, padding: '0.75rem', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer',
              background: viewRole === 'owner' ? '#166534' : '#f1f5f9',
              color: viewRole === 'owner' ? '#fff' : '#475569'
            }}
          >
            👨‍🌾 มุมมองเจ้าของสวน
          </button>
          <button
            onClick={() => setViewRole('tapper')}
            style={{
              flex: 1, padding: '0.75rem', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer',
              background: viewRole === 'tapper' ? '#b45309' : '#f1f5f9',
              color: viewRole === 'tapper' ? '#fff' : '#475569'
            }}
          >
            🔪 มุมมองคนรับจ้างกรีด
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>ตัวกรองข้อมูล (Filters)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>ช่วงเวลา</label>
            <select 
              className="form-input" 
              style={{ width: '100%', cursor: 'pointer' }}
              value={filterMonth} 
              onChange={e => setFilterMonth(e.target.value)}
            >
              <option value="all">ทุกช่วงเวลา (All Time)</option>
              <option value="7days">7 วันย้อนหลัง (สัปดาห์นี้)</option>
              <option value="30days">30 วันย้อนหลัง (เดือนนี้)</option>
              <option value="thisYear">ปีนี้ (ทั้งปี)</option>
              <option value="custom">กำหนดเอง (Custom)</option>
              <optgroup label="เลือกตามเดือนปี">
                {uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}
              </optgroup>
            </select>
            {filterMonth === 'custom' && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input 
                  type="date" 
                  className="form-input" 
                  value={customStartDate} 
                  onChange={e => setCustomStartDate(e.target.value)} 
                  style={{ width: '50%', fontSize: '0.8rem', padding: '0.4rem' }}
                />
                <input 
                  type="date" 
                  className="form-input" 
                  value={customEndDate} 
                  onChange={e => setCustomEndDate(e.target.value)} 
                  style={{ width: '50%', fontSize: '0.8rem', padding: '0.4rem' }}
                />
              </div>
            )}
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>ผู้รับซื้อ</label>
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

      <div className="share-highlight" style={{ marginBottom: '1.5rem', marginTop: 0, background: viewRole === 'owner' ? 'var(--primary-dark)' : '#92400e' }}>
        <div>
          <h3>{viewRole === 'owner' ? 'รายรับส่วนเจ้าของสวน' : 'รายรับส่วนคนรับจ้างกรีด'}</h3>
          <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>ยอดรวมตามตัวกรองที่คุณเลือก</p>
        </div>
        <div className="amount">
          ฿{totalShare.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-title">ปริมาณยางแห้งรวม</div>
          <div className="stat-value">{totalDryWeight.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} กก.</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">น้ำยางสดรวม</div>
          <div className="stat-value">{totalRawWeight.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} กก.</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">ค่าเฉลี่ยเปอร์เซ็นต์น้ำยาง</div>
          <div className="stat-value">{avgDrc > 0 ? avgDrc.toFixed(2) : '-'} %</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">จำนวนวันที่ขาย</div>
          <div className="stat-value">{totalSalesDays} วัน</div>
        </div>
      </div>

      <div className="chart-container">
        <div className="chart-title">กราฟแสดงรายรับและปริมาณยางแห้ง</div>
        <div style={{ width: '100%', height: 350 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 25, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="name" tick={{fontSize: 10}} angle={-45} textAnchor="end" />
              <YAxis yAxisId="left" tick={{fontSize: 10}} stroke={viewRole === 'owner' ? 'var(--primary)' : '#b45309'} />
              <YAxis yAxisId="right" orientation="right" tick={{fontSize: 10}} stroke="#ff9800" />
              <Tooltip formatter={(value, name) => [`${value.toLocaleString()}`, name]} />
              <Legend verticalAlign="top" height={36} />
              <Line yAxisId="left" type="monotone" dataKey="รายรับ (บาท)" stroke={viewRole === 'owner' ? 'var(--primary)' : '#b45309'} strokeWidth={3} activeDot={{ r: 6 }} />
              <Line yAxisId="right" type="monotone" dataKey="ยางแห้ง (กก.)" stroke="#ff9800" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-container">
        <div className="chart-title">ประวัติการขายยาง (เรียงตามล่าสุด)</div>
        <div className="record-list">
          {allRecords.length > 0 ? allRecords.map((record, i) => (
            <div key={i} className="record-item" style={{ flexWrap: 'wrap', borderLeft: `4px solid ${viewRole === 'owner' ? '#166534' : '#b45309'}` }}>
              <div style={{ flex: '1 1 200px', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 600 }}>{record.date ? formatDateDisplay(record.date) : ''} (คิว: {record.queue_number || '-'})</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{record.buyer_name}</div>
                {record.note && <div style={{ fontSize: '0.75rem', color: '#ff9800', marginTop: '4px' }}>หมายเหตุ: {record.note}</div>}
              </div>
              <div style={{ flex: '1 1 150px', textAlign: 'right', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: viewRole === 'owner' ? 'var(--primary-dark)' : '#92400e' }}>
                  ฿{parseFloat(viewRole === 'owner' ? record.owner_share_thb : record.tapper_share_thb || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  ยางแห้ง: {record.dry_weight_kg} กก.
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  ราคาตลาด: ฿{parseFloat(record.price_per_kg || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}/กก.
                </div>
              </div>
              <div style={{ width: '100%', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button 
                  onClick={() => onEdit(record)} 
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '6px', background: '#e3f2fd', color: '#1976d2', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  📝 แก้ไข
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm('คุณต้องการลบรายการนี้ใช่หรือไม่? (การลบจะไม่สามารถกู้คืนได้)')) {
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
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>ไม่พบข้อมูลการขายสำหรับมุมมองนี้</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
