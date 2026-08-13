import React, { useState, useEffect } from 'react';
import { db } from '../supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { printThermalBill } from '../utils/printBill';
import { handleCopyLineBill } from '../utils/lineShare';

function DashboardPortal({ currentUser }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0], // 7 days ago
    end: new Date().toISOString().split('T')[0], // today
  });

  const [metrics, setMetrics] = useState({
    totalAmount: 0,
    totalRawWeight: 0,
    totalDryWeight: 0,
    avgDrc: 0,
    txCount: 0
  });

  const [chartData, setChartData] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  useEffect(() => {
    fetchHistory();
  }, [dateRange]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await db.getTransactionsHistory(dateRange.start, dateRange.end);
      setHistory(data);
      calculateMetrics(data);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (data) => {
    let tAmount = 0;
    let tRaw = 0;
    let tDry = 0;
    let sumDrc = 0;
    let drcCount = 0;
    
    // Group by date for chart
    const dailyData = {};

    data.forEach(tx => {
      const amt = parseFloat(tx.total_amount) || parseFloat(tx.total_amount_thb) || 0;
      const raw = parseFloat(tx.raw_weight_kg) || 0;
      const dry = parseFloat(tx.dry_weight_kg) || 0;
      const drc = parseFloat(tx.drc_percentage) || 0;

      tAmount += amt;
      tRaw += raw;
      tDry += dry;
      if (drc > 0) {
        sumDrc += drc;
        drcCount++;
      }

      // Prepare chart data
      const d = tx.date;
      if (!dailyData[d]) {
        dailyData[d] = { date: d, rawWeight: 0, dryWeight: 0, amount: 0 };
      }
      dailyData[d].rawWeight += raw;
      dailyData[d].dryWeight += dry;
      dailyData[d].amount += amt;
    });

    setMetrics({
      totalAmount: tAmount,
      totalRawWeight: tRaw,
      totalDryWeight: tDry,
      avgDrc: drcCount > 0 ? (sumDrc / drcCount) : 0,
      txCount: data.length
    });

    // Sort chart data by date
    const sortedChart = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
    setChartData(sortedChart);
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value }));
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedAndFilteredHistory = () => {
    let filtered = history;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tx => 
        (tx.seller_name && tx.seller_name.toLowerCase().includes(query)) ||
        (tx.queue_number && tx.queue_number.toLowerCase().includes(query))
      );
    }

    filtered.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle numeric sorting
      if (['raw_weight_kg', 'drc_percentage', 'price_per_kg', 'total_amount'].includes(sortConfig.key)) {
        if (sortConfig.key === 'total_amount') {
          aValue = parseFloat(a.total_amount || a.total_amount_thb || 0);
          bValue = parseFloat(b.total_amount || b.total_amount_thb || 0);
        } else {
          aValue = parseFloat(aValue || 0);
          bValue = parseFloat(bValue || 0);
        }
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return filtered;
  };

  const displayHistory = getSortedAndFilteredHistory();

  return (
    <div className="dashboard-portal">
      <div className="header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>📊 แดชบอร์ด & ประวัติย้อนหลัง</h2>
          <p style={{ color: '#64748b' }}>ตรวจสอบยอดซื้อและประวัติการออกบิล</p>
        </div>
        
        <div className="date-filter" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: '#fff', padding: '0.75rem 1rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>ตั้งแต่:</label>
          <input type="date" name="start" value={dateRange.start} onChange={handleDateChange} className="form-input" style={{ width: '130px', padding: '0.25rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', marginLeft: '0.5rem', color: '#475569' }}>ถึง:</label>
          <input type="date" name="end" value={dateRange.end} onChange={handleDateChange} className="form-input" style={{ width: '130px', padding: '0.25rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay" style={{ minHeight: '300px' }}>
          <div className="spinner"></div>
          <div>กำลังดึงข้อมูล...</div>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="kpi-card" style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: '500' }}>ยอดซื้อสุทธิ (บาท)</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0f172a', margin: '0.5rem 0' }}>
                ฿{metrics.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>รวม {metrics.txCount} บิล</div>
            </div>
            
            <div className="kpi-card" style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: '500' }}>น้ำหนักยางสด (กก.)</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0f172a', margin: '0.5rem 0' }}>
                {metrics.totalRawWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="kpi-card" style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: '500' }}>เนื้อยางแห้ง DRC (กก.)</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0f172a', margin: '0.5rem 0' }}>
                {metrics.totalDryWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>เฉลี่ย DRC {metrics.avgDrc.toFixed(2)}%</div>
            </div>
          </div>

          {/* Chart */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#1e293b' }}>📈 ปริมาณรับซื้อแยกตามวัน (กก.)</h3>
            {chartData.length > 0 ? (
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{fontSize: 12, fill: '#64748b'}} tickMargin={10} axisLine={{stroke: '#cbd5e1'}} tickLine={false} />
                    <YAxis yAxisId="left" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar yAxisId="left" dataKey="rawWeight" name="น้ำยางสด (กก.)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="dryWeight" name="ยางแห้ง (กก.)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>ไม่มีข้อมูลสำหรับช่วงเวลานี้</div>
            )}
          </div>

          {/* Data Table */}
          <div className="card" style={{ padding: '1.5rem', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0, color: '#1e293b' }}>📋 ประวัติบิลรับซื้อ</h3>
              <input 
                type="text" 
                placeholder="🔍 ค้นหาชื่อ หรือ คิว..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: '8px', minWidth: '250px' }}
              />
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '700px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th onClick={() => handleSort('date')} style={{ padding: '0.75rem 1rem', color: '#475569', textAlign: 'left', fontWeight: '600', cursor: 'pointer' }}>
                      วันที่ {sortConfig.key === 'date' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => handleSort('queue_number')} style={{ padding: '0.75rem 1rem', color: '#475569', textAlign: 'left', fontWeight: '600', cursor: 'pointer' }}>
                      คิว {sortConfig.key === 'queue_number' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => handleSort('seller_name')} style={{ padding: '0.75rem 1rem', color: '#475569', textAlign: 'left', fontWeight: '600', cursor: 'pointer' }}>
                      ลูกค้า {sortConfig.key === 'seller_name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => handleSort('raw_weight_kg')} style={{ padding: '0.75rem 1rem', color: '#475569', textAlign: 'right', fontWeight: '600', cursor: 'pointer' }}>
                      ยางสด (กก.) {sortConfig.key === 'raw_weight_kg' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => handleSort('drc_percentage')} style={{ padding: '0.75rem 1rem', color: '#475569', textAlign: 'right', fontWeight: '600', cursor: 'pointer' }}>
                      DRC (%) {sortConfig.key === 'drc_percentage' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => handleSort('price_per_kg')} style={{ padding: '0.75rem 1rem', color: '#475569', textAlign: 'right', fontWeight: '600', cursor: 'pointer' }}>
                      ราคา (บาท) {sortConfig.key === 'price_per_kg' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => handleSort('total_amount')} style={{ padding: '0.75rem 1rem', color: '#475569', textAlign: 'right', fontWeight: '600', cursor: 'pointer' }}>
                      ยอดรวมสุทธิ {sortConfig.key === 'total_amount' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th style={{ padding: '0.75rem 1rem', color: '#475569', textAlign: 'center', fontWeight: '600' }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {displayHistory.length > 0 ? displayHistory.map((tx) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{tx.date}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{tx.queue_number || '-'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: '500', color: '#0f172a' }}>{tx.seller_name}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{parseFloat(tx.raw_weight_kg || 0).toFixed(2)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#10b981' }}>{parseFloat(tx.drc_percentage || 0).toFixed(2)}%</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{parseFloat(tx.price_per_kg || 0).toFixed(2)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold', color: '#1e293b' }}>
                        ฿{parseFloat(tx.total_amount || tx.total_amount_thb || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button 
                            onClick={() => printThermalBill(tx, currentUser)}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '0.35rem 0.5rem',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              transition: 'all 0.2s ease',
                            }}
                            title="พิมพ์บิล"
                          >
                            🖨️
                          </button>
                          <button 
                            onClick={() => handleCopyLineBill(tx, currentUser)}
                            style={{
                              background: '#f0fdf4',
                              border: '1px solid #86efac',
                              borderRadius: '6px',
                              padding: '0.35rem 0.5rem',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              color: '#16a34a',
                              transition: 'all 0.2s ease',
                            }}
                            title="ส่ง LINE"
                          >
                            💬
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        ไม่พบประวัติการทำรายการ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DashboardPortal;
