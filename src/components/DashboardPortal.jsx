import React, { useState, useEffect } from 'react';
import { db } from '../supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { printThermalBill } from '../utils/printBill';

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
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#1e293b' }}>📋 ประวัติบิลรับซื้อ</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '700px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '0.75rem 1rem', color: '#475569', textAlign: 'left', fontWeight: '600' }}>วันที่</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#475569', textAlign: 'left', fontWeight: '600' }}>คิว</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#475569', textAlign: 'left', fontWeight: '600' }}>ลูกค้า</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#475569', textAlign: 'right', fontWeight: '600' }}>ยางสด (กก.)</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#475569', textAlign: 'right', fontWeight: '600' }}>DRC (%)</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#475569', textAlign: 'right', fontWeight: '600' }}>ราคา (บาท)</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#475569', textAlign: 'right', fontWeight: '600' }}>ยอดรวมสุทธิ</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#475569', textAlign: 'center', fontWeight: '600' }}>พิมพ์บิล</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length > 0 ? history.map((tx) => (
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
                        <button 
                          onClick={() => printThermalBill(tx, currentUser)}
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            padding: '0.25rem 0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                          title="พิมพ์บิล"
                        >
                          🖨️
                        </button>
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
