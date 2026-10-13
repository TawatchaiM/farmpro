import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db, normalizePhone } from '../supabase';
import {
  TrendingUp, TrendingDown, DollarSign, Scale, Percent, Calendar, Download, RefreshCw,
  AlertTriangle, CheckCircle2, Award, PieChart as PieIcon, BarChart3, ArrowUpRight, ArrowDownRight,
  Layers, Filter, Trees, Trash2, Edit2, Check, Eye, Search, Clock
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const EXPENSE_COLORS = ['#16a34a', '#d97706', '#0ea5e9', '#8b5cf6', '#64748b', '#ec4899'];

const EXPENSE_CATEGORIES = [
  { id: 'fertilizer', name: 'ปุ๋ย', color: '#16a34a' },
  { id: 'tools', name: 'อุปกรณ์/มีดกรีด', color: '#d97706' },
  { id: 'chemicals', name: 'ยา/สารเคมีกำจัดวัชพืช', color: '#0ea5e9' },
  { id: 'labor', name: 'ค่าแรงงาน/ตัดหญ้า', color: '#8b5cf6' },
  { id: 'misc', name: 'เบ็ดเตล็ด/อื่นๆ', color: '#64748b' }
];

function normalizeCategoryName(rawCat) {
  if (!rawCat) return 'เบ็ดเตล็ด/อื่นๆ';
  if (rawCat.includes('ปุ๋ย')) return 'ปุ๋ย';
  if (rawCat.includes('อุปกรณ์') || rawCat.includes('มีด')) return 'อุปกรณ์/มีดกรีด';
  if (rawCat.includes('ยา') || rawCat.includes('เคมี')) return 'ยา/สารเคมีกำจัดวัชพืช';
  if (rawCat.includes('แรงงาน') || rawCat.includes('ถาง') || rawCat.includes('หญ้า')) return 'ค่าแรงงาน/ตัดหญ้า';
  return 'เบ็ดเตล็ด/อื่นๆ';
}

function FarmerProfitLoss({ currentUser, onEdit, onDelete }) {
  // 1. Default Filter: Year-to-Date (this_year)
  const [filterPeriod, setFilterPeriod] = useState('this_year'); // 'today', 'this_week', 'this_month', 'this_year', 'custom'
  const [customRange, setCustomRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedPlotId, setSelectedPlotId] = useState('all');

  const [loading, setLoading] = useState(true);
  const [plots, setPlots] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [activeDetailTab, setActiveDetailTab] = useState('sales'); // 'sales' | 'expenses'
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Calculate Date Range strings (Default YTD from Jan 1 to today)
  const dateRange = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (filterPeriod === 'today') {
      return { start: todayStr, end: todayStr, label: 'วันนี้' };
    }
    if (filterPeriod === 'this_week') {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff)).toISOString().split('T')[0];
      return { start: monday, end: todayStr, label: 'สัปดาห์นี้' };
    }
    if (filterPeriod === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      return { start: firstDay, end: todayStr, label: 'เดือนนี้' };
    }
    if (filterPeriod === 'this_year') {
      const firstDay = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
      return { start: firstDay, end: todayStr, label: 'ปีนี้' };
    }
    return {
      start: customRange.start,
      end: customRange.end,
      label: `${customRange.start} ถึง ${customRange.end}`
    };
  }, [filterPeriod, customRange]);

  // 2. Fetch User Plots
  const fetchPlots = useCallback(async () => {
    if (!currentUser) return [];
    try {
      const userPlots = await db.getRubberPlots(currentUser.id, currentUser.user_id);
      setPlots(userPlots || []);
      return userPlots || [];
    } catch (err) {
      console.error('Failed to load user plots:', err);
      return [];
    }
  }, [currentUser]);

  // 3. Load all Transactions & Expenses (YTD by default)
  const loadData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    const profileId = currentUser.id;
    const authUserId = currentUser.user_id;
    const userPhone = currentUser.phone_number ? normalizePhone(currentUser.phone_number) : '';
    const userName = (currentUser.full_name || '').trim().toLowerCase();

    try {
      const [userPlots, allTxs, allExps] = await Promise.all([
        fetchPlots(),
        db.getAllTransactions(userPhone, currentUser?.role === 'SUPER_ADMIN'),
        db.getPlotExpenses(selectedPlotId === 'all' ? null : selectedPlotId, profileId || authUserId)
      ]);

      const userPlotIds = new Set((userPlots || []).map(p => p.plot_id || p.id));

      // Filter transactions STRICTLY for this seller & date range & selected plot
      const sellerTxs = (Array.isArray(allTxs) ? allTxs : []).filter(tx => {
        if (tx.deleted_at) return false;
        if (tx.status !== 'paid' && tx.status !== 'completed') return false;

        // STRICT SELLER PRIVACY VERIFICATION
        const txPhone = tx.phone_number ? normalizePhone(tx.phone_number) : '';
        const isMyPhone = Boolean(userPhone && txPhone && txPhone === userPhone);
        const isMyPlot = Boolean(tx.plot_id && userPlotIds.has(tx.plot_id));
        const isMySellerId = Boolean(
          (profileId && tx.seller_id === profileId) || 
          (authUserId && tx.seller_id === authUserId)
        );
        const isMyName = Boolean(
          userName && 
          tx.seller_name && 
          tx.seller_name.trim().toLowerCase() === userName &&
          (!tx.buyer_id || tx.queue_number === 'E-BILL' || isMyPhone)
        );

        // Fallback for Tawatchai / Super Admin legacy E-Bills
        const isTawatchaiLegacy = Boolean(
          (userPhone === '0811704028' || currentUser?.role === 'SUPER_ADMIN') &&
          tx.queue_number === 'E-BILL' &&
          (!tx.phone_number || normalizePhone(tx.phone_number) === '0811704028' || tx.seller_name === 'ชาวสวนยาง' || tx.seller_name === 'Tawatchai Matlee')
        );

        const belongsToCurrentSeller = isMyPhone || isMyPlot || isMySellerId || isMyName || isTawatchaiLegacy;
        if (!belongsToCurrentSeller) return false;

        // Date filter
        const txDate = tx.date ? String(tx.date).substring(0, 10) : '';
        if (txDate < dateRange.start || txDate > dateRange.end) return false;

        // Plot filter
        if (selectedPlotId !== 'all') {
          const matchesPlot = tx.plot_id === selectedPlotId || (!tx.plot_id && userPlots.length === 1 && (userPlots[0].plot_id || userPlots[0].id) === selectedPlotId);
          if (!matchesPlot) return false;
        }

        return true;
      });

      // Filter expenses STRICTLY for this seller & date range & selected plot
      const validExps = (Array.isArray(allExps) ? allExps : []).filter(e => {
        if (e.deleted_at) return false;

        // STRICT EXPENSE PRIVACY VERIFICATION
        const isMyPlot = Boolean(e.plot_id && userPlotIds.has(e.plot_id));
        const isMyRecord = Boolean(
          (profileId && e.recorded_by === profileId) || 
          (authUserId && e.recorded_by === authUserId)
        );
        if (!isMyPlot && !isMyRecord) return false;

        // Date filter
        const expDate = e.expense_date ? String(e.expense_date).substring(0, 10) : '';
        if (expDate < dateRange.start || expDate > dateRange.end) return false;

        if (selectedPlotId !== 'all') {
          return e.plot_id === selectedPlotId;
        }
        return true;
      });

      setTransactions(sellerTxs);
      setExpenses(validExps);
    } catch (err) {
      console.error('Error loading farmer P&L data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, fetchPlots, dateRange, selectedPlotId]);

  useEffect(() => {
    loadData();

    // Realtime Subscriptions
    const unsubTx = db.subscribeToTransactions(() => {
      loadData();
    });
    const unsubExp = db.subscribeToPlotExpenses(() => {
      loadData();
    });

    return () => {
      if (unsubTx) unsubTx();
      if (unsubExp) unsubExp();
    };
  }, [loadData]);

  // 4. Financial KPI Calculations
  // Total Revenue: sum of total_amount
  const totalRevenue = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (parseFloat(t.total_amount) || parseFloat(t.total_amount_thb) || 0), 0);
  }, [transactions]);

  // Tapper Share: sum of tapper_share_amount (0 if owner taps themselves)
  const totalTapperShare = useMemo(() => {
    return transactions.reduce((sum, t) => {
      if (parseFloat(t.owner_share_percentage) === 100) return sum;
      return sum + (parseFloat(t.tapper_share_amount) || 0);
    }, 0);
  }, [transactions]);

  const tapperSharePercent = totalRevenue > 0 ? (totalTapperShare / totalRevenue) * 100 : 0;

  // Gross Income: Total Revenue - Tapper Share
  const grossIncome = totalRevenue - totalTapperShare;
  const grossMargin = totalRevenue > 0 ? (grossIncome / totalRevenue) * 100 : 0;

  // Total Plot Expenses: sum of amount from plot_expenses
  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  }, [expenses]);

  const expensesPercent = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;

  // Net Profit: Gross Income - Total Plot Expenses
  const netProfit = grossIncome - totalExpenses;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Productivity Analytics
  const totalRawWeight = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (parseFloat(t.raw_weight_kg) || 0), 0);
  }, [transactions]);

  const totalDryWeight = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (parseFloat(t.dry_weight_kg) || 0), 0);
  }, [transactions]);

  const avgRawWeightPerTap = transactions.length > 0 ? totalRawWeight / transactions.length : 0;
  const avgDryWeightPerTap = transactions.length > 0 ? totalDryWeight / transactions.length : 0;

  const avgDrc = useMemo(() => {
    const valid = transactions.filter(t => parseFloat(t.drc_percentage) > 0);
    if (valid.length === 0) return 0;
    return valid.reduce((sum, t) => sum + parseFloat(t.drc_percentage), 0) / valid.length;
  }, [transactions]);

  const avgPricePerKg = useMemo(() => {
    if (totalDryWeight > 0) return totalRevenue / totalDryWeight;
    const valid = transactions.filter(t => parseFloat(t.price_per_kg) > 0);
    if (valid.length === 0) return 0;
    return valid.reduce((sum, t) => sum + parseFloat(t.price_per_kg), 0) / valid.length;
  }, [transactions, totalRevenue, totalDryWeight]);

  const costPerKg = totalRawWeight > 0 ? totalExpenses / totalRawWeight : 0;

  // Expenses Breakdown by Category for Donut Chart
  const expenseByCategoryData = useMemo(() => {
    const map = {};
    expenses.forEach(e => {
      const cat = normalizeCategoryName(e.category);
      map[cat] = (map[cat] || 0) + (parseFloat(e.amount) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  // Financial Chart Data (5 Bars comparing Financial Structure)
  const financialChartData = useMemo(() => {
    return [
      { name: 'ยอดขายยาง', amount: totalRevenue, fill: '#16a34a' },
      { name: 'ส่วนแบ่งคนกรีด', amount: totalTapperShare, fill: '#f59e0b' },
      { name: 'รายได้สุทธิ', amount: Math.max(0, grossIncome), fill: '#0284c7' },
      { name: 'ค่าใช้จ่ายสวน', amount: totalExpenses, fill: '#dc2626' },
      { name: 'กำไรสุทธิ', amount: netProfit, fill: netProfit >= 0 ? '#10b981' : '#f43f5e' }
    ];
  }, [totalRevenue, totalTapperShare, grossIncome, totalExpenses, netProfit]);

  // Export P&L Report CSV
  const handleExportPnL = () => {
    const rows = [
      ['รายงานสรุปกำไร-ขาดทุนของสวนยาง (Farmer P&L Summary)', `ช่วงเวลา: ${dateRange.label}`],
      ['วันที่พิมพ์', new Date().toLocaleString('th-TH')],
      ['', ''],
      ['หมวดรายการทางการเงิน', 'จำนวนเงิน (บาท)', 'สัดส่วนเทียบยอดขาย (%)'],
      ['1. ยอดขายยางพารารวม (Total Revenue)', totalRevenue.toFixed(2), '100.00%'],
      ['2. ค่าจ้าง/ส่วนแบ่งคนกรีด (Tapper Share)', totalTapperShare.toFixed(2), `${tapperSharePercent.toFixed(2)}%`],
      ['3. รายได้สุทธิจากยาง (Gross Income)', grossIncome.toFixed(2), `${grossMargin.toFixed(2)}%`],
      ['4. ค่าใช้จ่ายดูแลสวนรวม (Plot Expenses)', totalExpenses.toFixed(2), `${expensesPercent.toFixed(2)}%`],
      ...expenseByCategoryData.map(e => [`   - ${e.name}`, e.value.toFixed(2), totalRevenue > 0 ? `${((e.value / totalRevenue) * 100).toFixed(2)}%` : '0%']),
      ['5. กำไรสุทธิของสวน (Net Profit)', netProfit.toFixed(2), `${netMargin.toFixed(2)}%`],
      ['', ''],
      ['สถิติผลผลิตและต้นทุน (Production & Cost Benchmark)', ''],
      ['น้ำหนักยางสดรวม (กก.)', totalRawWeight.toFixed(2)],
      ['น้ำหนักเนื้อยางแห้งรวม (DRC กก.)', totalDryWeight.toFixed(2)],
      ['%DRC เฉลี่ย', `${avgDrc.toFixed(2)}%`],
      ['ราคาขายเฉลี่ย (บาท/กก.)', `฿${avgPricePerKg.toFixed(2)}`],
      ['ต้นทุนดูแลสวนเฉลี่ยต่อ กก. ยาง', `฿${costPerKg.toFixed(2)} บาท/กก.`]
    ];

    const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `งบกำไรขาดทุนสวนยาง_${dateRange.start}_${dateRange.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filtered detail lists for bottom tables
  const filteredSales = useMemo(() => {
    if (!searchQuery) return transactions;
    const q = searchQuery.toLowerCase();
    return transactions.filter(t => 
      (t.buyer_name || '').toLowerCase().includes(q) ||
      (t.note || '').toLowerCase().includes(q)
    );
  }, [transactions, searchQuery]);

  const filteredExpensesList = useMemo(() => {
    if (!searchQuery) return expenses;
    const q = searchQuery.toLowerCase();
    return expenses.filter(e => 
      (e.category || '').toLowerCase().includes(q) ||
      (e.description || '').toLowerCase().includes(q)
    );
  }, [expenses, searchQuery]);

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '3.5rem' }}>
      {/* 2. Header Banner (Dark Forest Green matching Buyer P&L Unified Pattern) */}
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
            <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
              📈 แดชบอร์ด & กำไร-ขาดทุนของสวนยาง (Farmer P&L Real-time)
            </h2>
            <p style={{ margin: '0.25rem 0 0', opacity: 0.9, fontSize: '0.9rem', color: '#dcfce7' }}>
              วิเคราะห์รายรับ-รายจ่าย สัดส่วนผลประโยชน์คนกรีด และผลกำไรสุทธิตามแปลงสวนแบบเรียลไทม์
            </p>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={loadData}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '10px',
              padding: '0.55rem 0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              transition: 'all 0.15s'
            }}
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>รีเฟรช</span>
          </button>

          <button
            onClick={handleExportPnL}
            style={{
              background: '#22c55e',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '0.55rem 1.15rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'all 0.15s'
            }}
          >
            <Download size={15} />
            <span>Export P&L</span>
          </button>
        </div>
      </div>

      {/* 3. Filter Toolbar (Pills on Left, Plot Selector on Right) */}
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
        {/* Left: Period Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem', marginRight: '0.25rem' }}>
            <Calendar size={16} /> ช่วงเวลา:
          </span>

          {[
            { id: 'today', label: 'วันนี้' },
            { id: 'this_week', label: 'สัปดาห์นี้' },
            { id: 'this_month', label: 'เดือนนี้' },
            { id: 'this_year', label: 'ปีนี้' },
            { id: 'custom', label: 'กำหนดเอง' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterPeriod(tab.id)}
              style={{
                padding: '0.45rem 0.95rem',
                borderRadius: '8px',
                border: filterPeriod === tab.id ? '2px solid #16a34a' : '1px solid #cbd5e1',
                background: filterPeriod === tab.id ? '#f0fdf4' : '#f8fafc',
                color: filterPeriod === tab.id ? '#15803d' : '#475569',
                fontWeight: filterPeriod === tab.id ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: Plot Selector & Custom Date Range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {filterPeriod === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Trees size={16} color="#16a34a" /> แปลงสวน:
            </span>
            <select
              value={selectedPlotId}
              onChange={(e) => setSelectedPlotId(e.target.value)}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                background: '#fff',
                fontWeight: 600,
                color: '#166534',
                cursor: 'pointer'
              }}
            >
              <option value="all">🌳 ทุกแปลงสวน (รวมทั้งหมด)</option>
              {plots.map(p => (
                <option key={p.plot_id} value={p.plot_id}>
                  🌳 {p.plot_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. 5 KPI Summary Cards (Clean Single 5-Column Row on Desktop) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: '0.85rem',
        marginBottom: '1.5rem'
      }}>
        {/* 1. Total Revenue */}
        <div style={{
          background: '#fff',
          borderRadius: '14px',
          padding: '1.15rem 1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>1. ยอดขายยางรวม</span>
            <span style={{ background: '#dcfce7', color: '#16a34a', padding: '0.2rem 0.45rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
              Revenue
            </span>
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#15803d', marginTop: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            ฿{totalRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
            จาก {transactions.length} บิลขายยาง
          </div>
        </div>

        {/* 2. Tapper Share */}
        <div style={{
          background: '#fff',
          borderRadius: '14px',
          padding: '1.15rem 1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>2. ส่วนแบ่งคนกรีด</span>
            <span style={{ background: '#ffedd5', color: '#ea580c', padding: '0.2rem 0.45rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
              {tapperSharePercent.toFixed(1)}% Share
            </span>
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#ea580c', marginTop: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            ฿{totalTapperShare.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
            ค่าจ้างคนกรีดสะสม
          </div>
        </div>

        {/* 3. Gross Income */}
        <div style={{
          background: '#fff',
          borderRadius: '14px',
          padding: '1.15rem 1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>3. รายได้สุทธิจากยาง</span>
            <span style={{
              background: '#e0f2fe',
              color: '#0369a1',
              padding: '0.2rem 0.45rem',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 700
            }}>
              {grossMargin.toFixed(1)}% Margin
            </span>
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0284c7', marginTop: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            ฿{grossIncome.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
            ยอดขาย - ส่วนแบ่งคนกรีด
          </div>
        </div>

        {/* 4. Plot Expenses */}
        <div style={{
          background: '#fff',
          borderRadius: '14px',
          padding: '1.15rem 1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>4. ค่าใช้จ่ายดูแลสวน</span>
            <span style={{ background: '#fee2e2', color: '#dc2626', padding: '0.2rem 0.45rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
              Expenses
            </span>
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#dc2626', marginTop: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            ฿{totalExpenses.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
            รวม {expenses.length} รายการค่าใช้จ่าย
          </div>
        </div>

        {/* 5. Net Profit (Aligned in Same Row) */}
        <div style={{
          background: netProfit >= 0 ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
          borderRadius: '14px',
          padding: '1.15rem 1.25rem',
          border: netProfit >= 0 ? '2px solid #86efac' : '2px solid #fca5a5',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: netProfit >= 0 ? '#166534' : '#991b1b', fontWeight: 700 }}>
              5. กำไรสุทธิของสวน
            </span>
            <span style={{
              background: netProfit >= 0 ? '#16a34a' : '#dc2626',
              color: '#fff',
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 800
            }}>
              {netMargin.toFixed(1)}% Net
            </span>
          </div>
          <div style={{
            fontSize: '1.65rem',
            fontWeight: 900,
            color: netProfit >= 0 ? '#14532d' : '#b91c1c',
            marginTop: '0.4rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            ฿{netProfit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: netProfit >= 0 ? '#166534' : '#991b1b', marginTop: '0.25rem' }}>
            รายได้สุทธิ - ค่าใช้จ่ายดูแลสวน
          </div>
        </div>
      </div>

      {/* 5. Twin Performance Cards (Yield & Price/Cost Benchmark) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.25rem',
        marginBottom: '1.75rem'
      }}>
        {/* Left: Yield Summary Card */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '1.35rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Scale size={18} color="#16a34a" />
              ประสิทธิภาพผลผลิต (Yield Summary)
            </h4>
            <span style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
              fontWeight: 700,
              background: '#dcfce7',
              color: '#15803d'
            }}>
              {transactions.length} รอบกรีดสะสม
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>น้ำหนักยางสดรวม (กก.)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                {totalRawWeight.toLocaleString('th-TH', { minimumFractionDigits: 1 })} กก.
              </div>
              <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: '2px', fontWeight: 600 }}>
                เนื้อยางแห้ง: {totalDryWeight.toLocaleString('th-TH', { minimumFractionDigits: 1 })} กก.
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>ผลผลิตเฉลี่ยต่อรอบกรีด</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                {avgRawWeightPerTap.toFixed(1)} กก./รอบ
              </div>
              <div style={{ fontSize: '0.72rem', color: '#0284c7', marginTop: '2px', fontWeight: 600 }}>
                ยางแห้งเฉลี่ย: {avgDryWeightPerTap.toFixed(1)} กก./รอบ
              </div>
            </div>
          </div>

          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>
                น้ำหนักยางสดสะสมตลอดช่วงเวลา
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                ผลผลิตยางสะสมของสวนในรอบ {dateRange.label}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803d' }}>
                {totalRawWeight.toLocaleString('th-TH', { minimumFractionDigits: 0 })} กก.
              </div>
            </div>
          </div>
        </div>

        {/* Right: Price & Cost Benchmark Card */}
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
              ข้อมูลราคาและต้นทุน (Price & Cost Benchmark)
            </h4>
            <span style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
              fontWeight: 700,
              background: '#e0f2fe',
              color: '#0369a1'
            }}>
              Benchmark
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>%DRC เฉลี่ยสะสม</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                {avgDrc.toFixed(2)}%
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                คุณภาพน้ำยางพารา
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>ราคาขายเฉลี่ย (บาท/กก.)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>
                ฿{avgPricePerKg.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                บาท / กก. ยางแห้ง
              </div>
            </div>
          </div>

          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 600 }}>
                ต้นทุนดูแลสวนเฉลี่ยต่อ กก. ยาง
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                ส่วนต่างกำไรจากการผลิต: ฿{(avgPricePerKg - costPerKg).toFixed(2)} บาท/กก.
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ea580c' }}>
                ฿{costPerKg.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                บาท / กก. ยางสด
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Visual Analytics Grid (Side-by-Side Dual Charts) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: '1.25rem',
        marginBottom: '1.75rem'
      }}>
        {/* Left: Financial Structure Bar Chart */}
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

        {/* Right: Donut Chart for Plot Expenses Breakdown */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '1.5rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}>
          <h4 style={{ margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieIcon size={18} color="#0284c7" />
            สัดส่วนค่าใช้จ่ายดูแลสวน ({totalExpenses > 0 ? `฿${totalExpenses.toLocaleString('th-TH')}` : '฿0'})
          </h4>
          <div style={{ height: '280px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {expenseByCategoryData.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center' }}>
                ไม่มีข้อมูลค่าใช้จ่ายดูแลสวนในช่วงเวลานี้
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
                      <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
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

      {/* 7. Detailed Financial Statement Table */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '1.5rem',
        marginBottom: '1.75rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}>
        <h4 style={{ margin: '0 0 1.25rem', fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={20} color="#15803d" />
          📑 งบกำไร-ขาดทุนเบื้องต้น (Statement of Profit or Loss)
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
              {/* 1. Revenue */}
              <tr style={{ borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>
                <td style={{ padding: '0.85rem 1rem', color: '#15803d' }}>
                  (+) ยอดขายยางพารารวม (Total Sales Revenue)
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#15803d' }}>
                  ฿{totalRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#64748b' }}>
                  100.00%
                </td>
              </tr>

              {/* 2. Tapper Share */}
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.85rem 1rem', color: '#ea580c' }}>
                  (-) ค่าจ้าง/ส่วนแบ่งคนกรีด (Tapper Share)
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#ea580c', fontWeight: 600 }}>
                  (฿{totalTapperShare.toLocaleString('th-TH', { minimumFractionDigits: 2 })})
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#64748b' }}>
                  {tapperSharePercent.toFixed(2)}%
                </td>
              </tr>

              {/* 3. Gross Income */}
              <tr style={{ borderBottom: '2px solid #cbd5e1', background: '#f8fafc', fontWeight: 800 }}>
                <td style={{ padding: '0.85rem 1rem', color: '#0369a1' }}>
                  (=) รายได้สุทธิจากยาง (Gross Income)
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#0369a1' }}>
                  ฿{grossIncome.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#0369a1' }}>
                  {grossMargin.toFixed(2)}%
                </td>
              </tr>

              {/* 4. Plot Expenses */}
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.85rem 1rem', color: '#dc2626', fontWeight: 600 }}>
                  (-) ค่าใช้จ่ายดูแลสวนรวม (Plot Expenses)
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                  (฿{totalExpenses.toLocaleString('th-TH', { minimumFractionDigits: 2 })})
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#64748b' }}>
                  {expensesPercent.toFixed(2)}%
                </td>
              </tr>

              {/* Category Breakdown */}
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

              {/* 5. Net Profit */}
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

      {/* 8. Tabbed Detailed History Section */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '1.5rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem'
        }}>
          {/* Sub Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveDetailTab('sales')}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                border: activeDetailTab === 'sales' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                background: activeDetailTab === 'sales' ? '#f0fdf4' : '#fff',
                color: activeDetailTab === 'sales' ? '#166534' : '#475569',
                fontWeight: activeDetailTab === 'sales' ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              📦 ประวัติบิลขายยาง ({transactions.length})
            </button>

            <button
              onClick={() => setActiveDetailTab('expenses')}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                border: activeDetailTab === 'expenses' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                background: activeDetailTab === 'expenses' ? '#f0fdf4' : '#fff',
                color: activeDetailTab === 'expenses' ? '#166534' : '#475569',
                fontWeight: activeDetailTab === 'expenses' ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              💸 รายการค่าใช้จ่ายสวน ({expenses.length})
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="ค้นหารายการ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                width: '180px'
              }}
            />
          </div>
        </div>

        {/* Detailed Table */}
        <div style={{ overflowX: 'auto' }}>
          {activeDetailTab === 'sales' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 0.85rem' }}>วันที่</th>
                  <th style={{ padding: '0.75rem 0.85rem' }}>ร้านที่รับซื้อ</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>น้ำหนักสด (กก.)</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>%DRC</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>ราคา (บาท/กก.)</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>ยอดรวม (บาท)</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>ส่วนแบ่งคนกรีด</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>รายได้เจ้าของสวน</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                      ไม่มีข้อมูลบิลขายยางในช่วงเวลานี้
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((t) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 0.85rem', fontWeight: 600, color: '#334155' }}>
                        {t.date ? new Date(t.date).toLocaleDateString('th-TH') : '-'}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', color: '#334155' }}>
                        {t.buyer_name || 'ร้านรับซื้อยาง'}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontWeight: 600 }}>
                        {parseFloat(t.raw_weight_kg || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', color: '#0284c7', fontWeight: 600 }}>
                        {parseFloat(t.drc_percentage || 0).toFixed(2)}%
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>
                        ฿{parseFloat(t.price_per_kg || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                        ฿{parseFloat(t.total_amount || t.total_amount_thb || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', color: '#ea580c' }}>
                        ฿{parseFloat(t.tapper_share_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                        ฿{parseFloat(t.owner_share_amount || (parseFloat(t.total_amount || 0) - parseFloat(t.tapper_share_amount || 0))).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          {onEdit && (
                            <button
                              onClick={() => onEdit(t)}
                              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '0.25rem 0.45rem', borderRadius: '4px', cursor: 'pointer' }}
                              title="แก้ไข"
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => {
                                if (window.confirm('ยืนยันการลบบิลขายยางนี้หรือไม่?')) {
                                  onDelete(t.id);
                                }
                              }}
                              style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.25rem 0.45rem', borderRadius: '4px', color: '#ef4444', cursor: 'pointer' }}
                              title="ลบ"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 0.85rem' }}>วันที่</th>
                  <th style={{ padding: '0.75rem 0.85rem' }}>หมวดหมู่</th>
                  <th style={{ padding: '0.75rem 0.85rem' }}>รายละเอียด / หมายเหตุ</th>
                  <th style={{ padding: '0.75rem 0.85rem' }}>ผู้บันทึก</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>จำนวนเงิน (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpensesList.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                      ไม่มีข้อมูลรายการค่าใช้จ่ายในช่วงเวลานี้
                    </td>
                  </tr>
                ) : (
                  filteredExpensesList.map((e) => (
                    <tr key={e.expense_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 0.85rem', fontWeight: 600, color: '#334155' }}>
                        {e.expense_date ? new Date(e.expense_date).toLocaleDateString('th-TH') : '-'}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        <span style={{
                          background: '#f1f5f9',
                          color: '#334155',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          fontWeight: 600,
                          fontSize: '0.8rem'
                        }}>
                          {e.category}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', color: '#334155' }}>
                        {e.description || '-'}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', color: '#64748b' }}>
                        {e.recorder?.full_name || 'ชาวสวนยาง'}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                        -฿{parseFloat(e.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default FarmerProfitLoss;
