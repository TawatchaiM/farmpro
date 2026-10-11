import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../supabase';
import {
  TrendingUp, TrendingDown, DollarSign, Scale, Percent, Calendar, Download, RefreshCw,
  AlertTriangle, CheckCircle2, Award, PieChart as PieIcon, BarChart3, ArrowUpRight, ArrowDownRight, Layers
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#64748b'];

function ProfitLossDashboard({ currentUser }) {
  const [filterType, setFilterType] = useState('today'); // 'today', 'yesterday', '7days', 'this_month', 'custom'
  const [customRange, setCustomRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Compute actual date strings based on filterType
  const dateRange = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (filterType === 'today') {
      return { start: todayStr, end: todayStr, label: 'วันนี้' };
    }
    if (filterType === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      return { start: yStr, end: yStr, label: 'เมื่อวาน' };
    }
    if (filterType === '7days') {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 6);
      return { start: d7.toISOString().split('T')[0], end: todayStr, label: '7 วันล่าสุด' };
    }
    if (filterType === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      return { start: firstDay, end: todayStr, label: 'เดือนนี้' };
    }
    return {
      start: customRange.start,
      end: customRange.end,
      label: `${customRange.start} ถึง ${customRange.end}`
    };
  }, [filterType, customRange]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const storeId = currentUser?.id;
      const [salesData, txData, expData] = await Promise.all([
        db.getRubberSales(dateRange.start, dateRange.end, storeId),
        db.getTransactionsHistory(dateRange.start, dateRange.end, storeId),
        db.getShopExpenses(dateRange.start, dateRange.end, storeId)
      ]);

      setSales(Array.isArray(salesData) ? salesData : []);
      // Filter transactions to paid/completed strictly for this store (exclude manual seller E-BILLs)
      const validTxs = (Array.isArray(txData) ? txData : []).filter(t => 
        (t.status === 'paid' || t.status === 'completed' || t.status === 'ready_to_pay') &&
        t.queue_number !== 'E-BILL' &&
        (!storeId || t.buyer_id === storeId)
      );
      setTransactions(validTxs);
      setExpenses(Array.isArray(expData) ? expData : []);
    } catch (err) {
      console.error('Error loading P&L data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [dateRange]);

  // Calculations
  // 1. Revenue from rubber sales
  const totalRevenue = useMemo(() => {
    return sales.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
  }, [sales]);

  // 2. COGS from bought rubber transactions
  const totalCogs = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (parseFloat(t.total_amount) || parseFloat(t.total_amount_thb) || 0), 0);
  }, [transactions]);

  // 3. Gross Profit
  const grossProfit = totalRevenue - totalCogs;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // 4. Operating Expenses
  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  }, [expenses]);

  // 5. Net Profit
  const netProfit = grossProfit - totalExpenses;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Variance Analysis
  // Buying Weight vs Sold Weight
  const totalBuyingWeight = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (parseFloat(t.raw_weight_kg) || 0), 0);
  }, [transactions]);

  const totalSoldWeight = useMemo(() => {
    return sales.reduce((sum, s) => sum + (parseFloat(s.net_weight) || 0), 0);
  }, [sales]);

  const weightVarianceKg = totalSoldWeight - totalBuyingWeight;
  const weightVariancePercent = totalBuyingWeight > 0 ? (weightVarianceKg / totalBuyingWeight) * 100 : 0;

  // Buying DRC vs Factory DRC
  const avgBuyingDrc = useMemo(() => {
    const valid = transactions.filter(t => parseFloat(t.drc_percentage) > 0);
    if (valid.length === 0) return 0;
    return valid.reduce((sum, t) => sum + parseFloat(t.drc_percentage), 0) / valid.length;
  }, [transactions]);

  const avgFactoryDrc = useMemo(() => {
    const valid = sales.filter(s => parseFloat(s.drc_percent) > 0);
    if (valid.length === 0) return 0;
    return valid.reduce((sum, s) => sum + parseFloat(s.drc_percent), 0) / valid.length;
  }, [sales]);

  const drcVariance = avgFactoryDrc - avgBuyingDrc;

  // Expenses by Category
  const expenseByCategoryData = useMemo(() => {
    const map = {};
    expenses.forEach(e => {
      const cat = e.category || 'เบ็ดเตล็ด';
      map[cat] = (map[cat] || 0) + (parseFloat(e.amount) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  // Financial Breakdown Comparison for Chart
  const financialChartData = useMemo(() => {
    return [
      { name: 'ยอดขายโรงงาน', amount: totalRevenue, fill: '#16a34a' },
      { name: 'ต้นทุนรับซื้อ (COGS)', amount: totalCogs, fill: '#ea580c' },
      { name: 'กำไรขั้นต้น', amount: Math.max(0, grossProfit), fill: '#0284c7' },
      { name: 'ค่าใช้จ่ายลาน', amount: totalExpenses, fill: '#dc2626' },
      { name: 'กำไรสุทธิ (Net)', amount: netProfit, fill: netProfit >= 0 ? '#10b981' : '#f43f5e' }
    ];
  }, [totalRevenue, totalCogs, grossProfit, totalExpenses, netProfit]);

  // Export CSV P&L
  const handleExportPnL = () => {
    const rows = [
      ['รายงานสรุปกำไร-ขาดทุน (P&L Summary)', `ช่วงเวลา: ${dateRange.label}`],
      ['วันที่พิมพ์', new Date().toLocaleString('th-TH')],
      ['', ''],
      ['หมวดรายการ', 'จำนวนเงิน (บาท)', 'สัดส่วน %'],
      ['1. ยอดขายส่งโรงงาน (Total Revenue)', totalRevenue.toFixed(2), '100.00%'],
      ['2. ต้นทุนยางพารารับซื้อ (COGS)', totalCogs.toFixed(2), totalRevenue > 0 ? `${((totalCogs / totalRevenue) * 100).toFixed(2)}%` : '0%'],
      ['3. กำไรขั้นต้น (Gross Profit)', grossProfit.toFixed(2), `${grossMargin.toFixed(2)}%`],
      ['4. ค่าใช้จ่ายดำเนินงานลาน (Operating Expenses)', totalExpenses.toFixed(2), totalRevenue > 0 ? `${((totalExpenses / totalRevenue) * 100).toFixed(2)}%` : '0%'],
      ...expenseByCategoryData.map(e => [`   - ${e.name}`, e.value.toFixed(2), totalRevenue > 0 ? `${((e.value / totalRevenue) * 100).toFixed(2)}%` : '0%']),
      ['5. กำไรสุทธิ (Net Profit)', netProfit.toFixed(2), `${netMargin.toFixed(2)}%`],
      ['', ''],
      ['สถิติตรวจสอบส่วนต่าง (Variance Analysis)', ''],
      ['น้ำหนักรับซื้อรวม (กก.)', totalBuyingWeight.toFixed(2)],
      ['น้ำหนักส่งโรงงาน (กก.)', totalSoldWeight.toFixed(2)],
      ['ส่วนต่างน้ำหนัก (กก.)', weightVarianceKg.toFixed(2), `${weightVariancePercent.toFixed(2)}%`],
      ['%DRC เฉลี่ยลานตรวจ', `${avgBuyingDrc.toFixed(2)}%`],
      ['%DRC เฉลี่ยโรงงานตรวจ', `${avgFactoryDrc.toFixed(2)}%`],
      ['ส่วนต่าง %DRC', `${drcVariance.toFixed(2)}%`]
    ];

    const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `รายงานกำไรขาดทุน_FarmPro_${dateRange.start}_${dateRange.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '3.5rem' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)',
        color: '#fff',
        borderRadius: '16px',
        padding: '1.5rem 1.75rem',
        marginBottom: '1.5rem',
        boxShadow: '0 8px 24px rgba(6, 78, 59, 0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            width: '52px',
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(6px)'
          }}>
            <BarChart3 size={28} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              📊 แดชบอร์ด & กำไร-ขาดทุน (P&L Real-time)
            </h2>
            <p style={{ margin: '0.25rem 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
              วิเคราะห์รายได้ ต้นทุน ค่าใช้จ่าย และส่วนต่างน้ำหนัก/%DRC ครบวงจรสำหรับลานรับซื้อ
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={loadAllData}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '10px',
              padding: '0.55rem 0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            รีเฟรช
          </button>
          <button
            onClick={handleExportPnL}
            style={{
              background: '#22c55e',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '0.55rem 1.1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
          >
            <Download size={15} /> Export P&L
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div style={{
        background: '#fff',
        borderRadius: '14px',
        padding: '0.85rem 1.25rem',
        marginBottom: '1.5rem',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem', marginRight: '0.25rem' }}>
            <Calendar size={16} /> ช่วงเวลา:
          </span>

          {[
            { id: 'today', label: 'วันนี้' },
            { id: 'yesterday', label: 'เมื่อวาน' },
            { id: '7days', label: '7 วันล่าสุด' },
            { id: 'this_month', label: 'เดือนนี้' },
            { id: 'custom', label: 'กำหนดเอง' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: filterType === tab.id ? '2px solid #16a34a' : '1px solid #cbd5e1',
                background: filterType === tab.id ? '#f0fdf4' : '#f8fafc',
                color: filterType === tab.id ? '#15803d' : '#475569',
                fontWeight: filterType === tab.id ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filterType === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="date"
              value={customRange.start}
              onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            />
            <span style={{ color: '#94a3b8' }}>ถึง</span>
            <input
              type="date"
              value={customRange.end}
              onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
              style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            />
          </div>
        )}
      </div>

      {/* 5 KPI Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* 1. Total Revenue */}
        <div style={{
          background: '#fff',
          borderRadius: '14px',
          padding: '1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>1. ยอดขายส่งโรงงาน</span>
            <span style={{ background: '#dcfce7', color: '#16a34a', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
              Revenue
            </span>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#15803d', marginTop: '0.4rem' }}>
            ฿{totalRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
            จาก {sales.length} เที่ยวส่งโรงงาน
          </div>
        </div>

        {/* 2. COGS */}
        <div style={{
          background: '#fff',
          borderRadius: '14px',
          padding: '1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>2. ต้นทุนรับซื้อยาง (COGS)</span>
            <span style={{ background: '#ffedd5', color: '#ea580c', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
              Cost
            </span>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#ea580c', marginTop: '0.4rem' }}>
            ฿{totalCogs.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
            จาก {transactions.length} บิลที่รับซื้อ
          </div>
        </div>

        {/* 3. Gross Profit */}
        <div style={{
          background: '#fff',
          borderRadius: '14px',
          padding: '1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>3. กำไรขั้นต้น (Gross Profit)</span>
            <span style={{
              background: grossProfit >= 0 ? '#e0f2fe' : '#fee2e2',
              color: grossProfit >= 0 ? '#0369a1' : '#b91c1c',
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 700
            }}>
              {grossMargin.toFixed(1)}% Margin
            </span>
          </div>
          <div style={{
            fontSize: '1.7rem',
            fontWeight: 800,
            color: grossProfit >= 0 ? '#0284c7' : '#dc2626',
            marginTop: '0.4rem'
          }}>
            ฿{grossProfit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
            ยอดขาย - ต้นทุนรับซื้อ
          </div>
        </div>

        {/* 4. Operating Expenses */}
        <div style={{
          background: '#fff',
          borderRadius: '14px',
          padding: '1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>4. ค่าใช้จ่ายดำเนินงานลาน</span>
            <span style={{ background: '#fee2e2', color: '#dc2626', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
              OPEX
            </span>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#dc2626', marginTop: '0.4rem' }}>
            ฿{totalExpenses.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
            ค่าแรง, น้ำมัน, สารเคมี ฯลฯ
          </div>
        </div>

        {/* 5. Net Profit */}
        <div style={{
          background: netProfit >= 0 ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
          borderRadius: '14px',
          padding: '1.25rem',
          border: netProfit >= 0 ? '2px solid #86efac' : '2px solid #fca5a5',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: netProfit >= 0 ? '#166534' : '#991b1b', fontWeight: 700 }}>
              🏆 5. กำไรสุทธิ (Net Profit)
            </span>
            <span style={{
              background: netProfit >= 0 ? '#16a34a' : '#dc2626',
              color: '#fff',
              padding: '0.2rem 0.55rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 800
            }}>
              {netMargin.toFixed(1)}% Net
            </span>
          </div>
          <div style={{
            fontSize: '1.85rem',
            fontWeight: 900,
            color: netProfit >= 0 ? '#14532d' : '#b91c1c',
            marginTop: '0.4rem'
          }}>
            ฿{netProfit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.8rem', color: netProfit >= 0 ? '#166534' : '#991b1b', marginTop: '0.25rem' }}>
            กำไรขั้นต้น - ค่าใช้จ่ายลาน
          </div>
        </div>
      </div>

      {/* Variance Analysis Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.25rem',
        marginBottom: '1.75rem'
      }}>
        {/* Weight Variance Card */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '1.35rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Scale size={18} color="#2563eb" />
              ส่วนต่างน้ำหนักยาง (Weight Shrinkage)
            </h4>
            <span style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
              fontWeight: 700,
              background: Math.abs(weightVariancePercent) <= 2 ? '#dcfce7' : '#fee2e2',
              color: Math.abs(weightVariancePercent) <= 2 ? '#15803d' : '#b91c1c'
            }}>
              {Math.abs(weightVariancePercent) <= 2 ? '✅ น้ำหนักในเกณฑ์ปกติ (< 2%)' : '⚠️ ส่วนต่างคลาดเคลื่อน'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>น้ำหนักรับซื้อรวม (ลาน)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                {totalBuyingWeight.toLocaleString('th-TH', { minimumFractionDigits: 2 })} กก.
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>น้ำหนักส่งโรงงานรวม</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                {totalSoldWeight.toLocaleString('th-TH', { minimumFractionDigits: 2 })} กก.
              </div>
            </div>
          </div>

          <div style={{
            background: weightVarianceKg >= 0 ? '#f0fdf4' : '#fff1f2',
            border: weightVarianceKg >= 0 ? '1px solid #bbf7d0' : '1px solid #fecdd3',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: weightVarianceKg >= 0 ? '#166534' : '#9f1239', fontWeight: 600 }}>
                ส่วนต่างน้ำหนัก (ส่งขาย - รับซื้อ)
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {weightVarianceKg < 0 ? 'น้ำหนักตกหล่น/หดตัวระหว่างขนส่ง' : 'น้ำหนักเพิ่มขึ้นหรือไม่มีการสูญหาย'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: weightVarianceKg >= 0 ? '#15803d' : '#e11d48' }}>
                {weightVarianceKg >= 0 ? '+' : ''}{weightVarianceKg.toFixed(2)} กก.
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: weightVarianceKg >= 0 ? '#15803d' : '#e11d48' }}>
                ({weightVariancePercent >= 0 ? '+' : ''}{weightVariancePercent.toFixed(2)}%)
              </div>
            </div>
          </div>
        </div>

        {/* DRC Quality Variance Card */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '1.35rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Percent size={18} color="#7c3aed" />
              เปรียบเทียบ %DRC เฉลี่ย (ลาน vs โรงงาน)
            </h4>
            <span style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
              fontWeight: 700,
              background: Math.abs(drcVariance) <= 1 ? '#dcfce7' : '#fef3c7',
              color: Math.abs(drcVariance) <= 1 ? '#15803d' : '#b45309'
            }}>
              {Math.abs(drcVariance) <= 1 ? '✅ ค่า DRC ใกล้เคียงกัน' : '⚠️ ค่า DRC ต่างกันเกิน 1%'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>%DRC เฉลี่ยลานชั่งตรวจ</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                {avgBuyingDrc.toFixed(2)}%
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>%DRC เฉลี่ยโรงงานตรวจ</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                {avgFactoryDrc.toFixed(2)}%
              </div>
            </div>
          </div>

          <div style={{
            background: drcVariance >= 0 ? '#f0fdf4' : '#fffbeb',
            border: drcVariance >= 0 ? '1px solid #bbf7d0' : '1px solid #fde68a',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: drcVariance >= 0 ? '#166534' : '#92400e', fontWeight: 600 }}>
                ส่วนต่าง %DRC (โรงงาน - ลาน)
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {drcVariance < 0 ? 'โรงงานประเมิน DRC ต่ำกว่าลาน' : 'โรงงานประเมิน DRC สูงกว่าหรือเท่ากับลาน'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: drcVariance >= 0 ? '#15803d' : '#d97706' }}>
                {drcVariance >= 0 ? '+' : ''}{drcVariance.toFixed(2)}%
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                DRC Gap
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: '1.25rem',
        marginBottom: '1.75rem'
      }}>
        {/* Financial Breakdown Bar Chart */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '1.5rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}>
          <h4 style={{ margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={18} color="#16a34a" />
            โครงสร้างการเงิน (Financial Overview)
          </h4>
          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialChartData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `฿${(val / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(val) => [`฿${Number(val).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, 'จำนวนเงิน']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expenses by Category Pie Chart */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '1.5rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}>
          <h4 style={{ margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieIcon size={18} color="#0284c7" />
            สัดส่วนค่าใช้จ่ายดำเนินงานลาน ({totalExpenses > 0 ? `฿${totalExpenses.toLocaleString('th-TH')}` : '฿0'})
          </h4>
          <div style={{ height: '280px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {expenseByCategoryData.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center' }}>
                ไม่มีข้อมูลค่าใช้จ่ายในช่วงเวลานี้
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseByCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {expenseByCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [`฿${Number(val).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, 'จำนวนเงิน']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Detailed P&L Statement Table */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '1.5rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}>
        <h4 style={{ margin: '0 0 1.25rem', fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={20} color="#15803d" />
          งบกำไร-ขาดทุนเบื้องต้น (Statement of Profit or Loss)
        </h4>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.925rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '0.85rem 1rem' }}>รายการทางการเงิน</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>จำนวนเงิน (บาท)</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>สัดส่วนเทียบยอดขาย (%)</th>
              </tr>
            </thead>
            <tbody>
              {/* Revenue */}
              <tr style={{ borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>
                <td style={{ padding: '0.85rem 1rem', color: '#15803d' }}>
                  (+) ยอดขายยางส่งโรงงาน (Total Sales Revenue)
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#15803d' }}>
                  ฿{totalRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#64748b' }}>
                  100.00%
                </td>
              </tr>

              {/* COGS */}
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.85rem 1rem', color: '#ea580c' }}>
                  (-) ต้นทุนยางพารารับซื้อ (Cost of Goods Sold - COGS)
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#ea580c', fontWeight: 600 }}>
                  (฿{totalCogs.toLocaleString('th-TH', { minimumFractionDigits: 2 })})
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#64748b' }}>
                  {totalRevenue > 0 ? `${((totalCogs / totalRevenue) * 100).toFixed(2)}%` : '0.00%'}
                </td>
              </tr>

              {/* Gross Profit Row */}
              <tr style={{ borderBottom: '2px solid #cbd5e1', background: '#f8fafc', fontWeight: 800 }}>
                <td style={{ padding: '0.85rem 1rem', color: '#0369a1' }}>
                  (=) กำไรขั้นต้น (Gross Profit)
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#0369a1' }}>
                  ฿{grossProfit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#0369a1' }}>
                  {grossMargin.toFixed(2)}%
                </td>
              </tr>

              {/* Expenses Breakdown */}
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.85rem 1rem', color: '#dc2626', fontWeight: 600 }}>
                  (-) ค่าใช้จ่ายดำเนินงานลานรับซื้อ (Operating Expenses)
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                  (฿{totalExpenses.toLocaleString('th-TH', { minimumFractionDigits: 2 })})
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#64748b' }}>
                  {totalRevenue > 0 ? `${((totalExpenses / totalRevenue) * 100).toFixed(2)}%` : '0.00%'}
                </td>
              </tr>

              {expenseByCategoryData.map((cat, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f8fafc', color: '#64748b', fontSize: '0.85rem' }}>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 2.5rem' }}>
                    • {cat.name}
                  </td>
                  <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>
                    ฿{cat.value.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>
                    {totalRevenue > 0 ? `${((cat.value / totalRevenue) * 100).toFixed(2)}%` : '0.00%'}
                  </td>
                </tr>
              ))}

              {/* Net Profit Row */}
              <tr style={{
                background: netProfit >= 0 ? '#f0fdf4' : '#fef2f2',
                borderTop: '2px solid #0f172a',
                borderBottom: '3px double #0f172a',
                fontWeight: 900,
                fontSize: '1.05rem'
              }}>
                <td style={{ padding: '1rem', color: netProfit >= 0 ? '#14532d' : '#991b1b' }}>
                  (=) กำไรสุทธิประจำงวด (Net Profit)
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', color: netProfit >= 0 ? '#14532d' : '#991b1b' }}>
                  ฿{netProfit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', color: netProfit >= 0 ? '#14532d' : '#991b1b' }}>
                  {netMargin.toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ProfitLossDashboard;
