import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../supabase';
import {
  TrendingUp, TrendingDown, DollarSign, Scale, Percent, Calendar, Download, RefreshCw,
  AlertTriangle, CheckCircle2, Award, PieChart as PieIcon, BarChart3, ArrowUpRight, ArrowDownRight,
  Layers, Filter, Trees, Trash2, Edit, Check, Eye
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const EXPENSE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

function FarmerProfitLoss({ currentUser, onEdit, onDelete, onShowTrash }) {
  const [filterPeriod, setFilterPeriod] = useState('this_month'); // 'today', 'this_week', 'this_month', 'this_year', 'custom'
  const [customRange, setCustomRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedPlotId, setSelectedPlotId] = useState('all');
  const [viewRole, setViewRole] = useState('owner'); // 'owner' or 'tapper'

  const [loading, setLoading] = useState(true);
  const [plots, setPlots] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [activeDetailTab, setActiveDetailTab] = useState('sales'); // 'sales' | 'expenses'
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Calculate Date Range strings
  const dateRange = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (filterPeriod === 'today') {
      return { start: todayStr, end: todayStr, label: 'วันนี้' };
    }
    if (filterPeriod === 'this_week') {
      // Monday of current week
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
      const userId = currentUser.user_id || currentUser.id;
      const userPlots = await db.getRubberPlots(userId);
      setPlots(userPlots || []);
      return userPlots || [];
    } catch (err) {
      console.error('Failed to load user plots:', err);
      return [];
    }
  }, [currentUser]);

  // 3. Load all Transactions & Expenses
  const loadData = useCallback(async () => {
    setLoading(true);
    const userId = currentUser?.user_id || currentUser?.id;
    const userPhone = currentUser?.phone_number;

    try {
      const [userPlots, allTxs, allExps] = await Promise.all([
        fetchPlots(),
        db.getAllTransactions(),
        db.getPlotExpenses(selectedPlotId === 'all' ? null : selectedPlotId)
      ]);

      const userPlotIds = new Set((userPlots || []).map(p => p.plot_id));

      // Filter transactions for this seller & date range & selected plot
      const sellerTxs = (Array.isArray(allTxs) ? allTxs : []).filter(tx => {
        if (tx.deleted_at) return false;
        if (tx.status !== 'paid' && tx.status !== 'completed') return false;

        // Date filter
        const txDate = tx.date ? String(tx.date).substring(0, 10) : '';
        if (txDate < dateRange.start || txDate > dateRange.end) return false;

        // Plot filter
        if (selectedPlotId !== 'all') {
          return tx.plot_id === selectedPlotId;
        }

        // 'all' plots filter: belongs to seller's plot or is manual E-BILL / seller phone
        const isUserPlot = tx.plot_id && userPlotIds.has(tx.plot_id);
        const isSellerBill = tx.queue_number === 'E-BILL' || !tx.buyer_id;
        const isUserPhone = userPhone && tx.phone_number && tx.phone_number === userPhone;
        const isUserSellerId = userId && tx.seller_id && tx.seller_id === userId;

        return isUserPlot || isSellerBill || isUserPhone || isUserSellerId;
      });

      // Filter expenses for selected plot & date range
      const validExps = (Array.isArray(allExps) ? allExps : []).filter(e => {
        if (e.deleted_at) return false;
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

    // Realtime Subscriptions for Transactions and Plot Expenses
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
      // If owner taps themselves or share ratio is 100% to owner
      if (parseFloat(t.owner_share_percentage) === 100) return sum;
      return sum + (parseFloat(t.tapper_share_amount) || 0);
    }, 0);
  }, [transactions]);

  // Gross Income: Total Revenue - Tapper Share
  const grossIncome = totalRevenue - totalTapperShare;

  // Total Plot Expenses: sum of amount from plot_expenses
  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  }, [expenses]);

  // Net Profit: Gross Income - Total Plot Expenses
  const netProfit = grossIncome - totalExpenses;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const isProfitable = netProfit >= 0;

  // Productivity Analytics
  const totalRawWeight = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (parseFloat(t.raw_weight_kg) || 0), 0);
  }, [transactions]);

  const totalDryWeight = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (parseFloat(t.dry_weight_kg) || 0), 0);
  }, [transactions]);

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

  const costPerKg = useMemo(() => {
    return totalDryWeight > 0 ? (totalExpenses / totalDryWeight) : 0;
  }, [totalExpenses, totalDryWeight]);

  // Donut Chart: Expenses by Category
  const expenseByCategoryData = useMemo(() => {
    const map = {};
    expenses.forEach(e => {
      const cat = e.category || 'อื่นๆ';
      map[cat] = (map[cat] || 0) + (parseFloat(e.amount) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  // Financial Breakdown Bar Chart Data
  const financialFlowData = useMemo(() => {
    return [
      { name: 'ยอดขายรวม', amount: totalRevenue, fill: '#15803d' },
      { name: 'ส่วนแบ่งคนกรีด', amount: totalTapperShare, fill: '#d97706' },
      { name: 'รายได้สุทธิสวน', amount: grossIncome, fill: '#0284c7' },
      { name: 'ค่าใช้จ่ายสวน', amount: totalExpenses, fill: '#e11d48' },
      { name: 'กำไรสุทธิ', amount: netProfit, fill: isProfitable ? '#16a34a' : '#dc2626' }
    ];
  }, [totalRevenue, totalTapperShare, grossIncome, totalExpenses, netProfit, isProfitable]);

  // Filtered Detail Transactions for Table
  const filteredTableTxs = useMemo(() => {
    if (!searchQuery) return transactions;
    const q = searchQuery.toLowerCase();
    return transactions.filter(t => 
      (t.buyer_name && t.buyer_name.toLowerCase().includes(q)) ||
      (t.queue_number && t.queue_number.toLowerCase().includes(q)) ||
      (t.date && t.date.includes(q)) ||
      (t.seller_name && t.seller_name.toLowerCase().includes(q))
    );
  }, [transactions, searchQuery]);

  // CSV Export (with UTF-8 BOM)
  const handleExportCSV = () => {
    if (transactions.length === 0 && expenses.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    let csvContent = '\ufeff'; // BOM
    csvContent += 'สรุปรายงานกำไร-ขาดทุนชาวสวนยาง FarmPro\n';
    csvContent += `ช่วงเวลา:,${dateRange.label}\n`;
    csvContent += `แปลงสวน:,${selectedPlotId === 'all' ? 'ทุกแปลงสวน' : (plots.find(p => p.plot_id === selectedPlotId)?.plot_name || selectedPlotId)}\n`;
    csvContent += `ยอดขายยางรวม (บาท):,${totalRevenue.toFixed(2)}\n`;
    csvContent += `ส่วนแบ่งคนกรีด (บาท):,${totalTapperShare.toFixed(2)}\n`;
    csvContent += `รายได้สุทธิจากยาง (บาท):,${grossIncome.toFixed(2)}\n`;
    csvContent += `ค่าใช้จ่ายดูแลสวน (บาท):,${totalExpenses.toFixed(2)}\n`;
    csvContent += `กำไรสุทธิ (บาท):,${netProfit.toFixed(2)}\n`;
    csvContent += `อัตรากำไรสุทธิ (%):,${netMargin.toFixed(2)}%\n\n`;

    csvContent += '--- รายการบิลขายยาง ---\n';
    csvContent += 'วันที่,คิว/เลขบิล,ร้านรับซื้อ,น้ำหนักสด (กก.),%DRC,น้ำหนักแห้ง (กก.),ราคา/กก.,ยอดรวม (บาท),ส่วนแบ่งคนกรีด (บาท),รายได้สุทธิ (บาท)\n';
    transactions.forEach(t => {
      csvContent += `"${t.date || ''}","${t.queue_number || ''}","${t.buyer_name || ''}",${t.raw_weight_kg || 0},${t.drc_percentage || 0},${t.dry_weight_kg || 0},${t.price_per_kg || 0},${t.total_amount || 0},${t.tapper_share_amount || 0},${(parseFloat(t.total_amount || 0) - parseFloat(t.tapper_share_amount || 0)).toFixed(2)}\n`;
    });

    csvContent += '\n--- รายการค่าใช้จ่ายดูแลสวน ---\n';
    csvContent += 'วันที่,แปลงสวน,หมวดหมู่,รายละเอียด,จำนวนเงิน (บาท)\n';
    expenses.forEach(e => {
      const pName = plots.find(p => p.plot_id === e.plot_id)?.plot_name || 'ไม่ระบุแปลง';
      csvContent += `"${e.expense_date || ''}","${pName}","${e.category || ''}","${e.description || ''}",${e.amount || 0}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Farmer_PnL_Report_${dateRange.start}_${dateRange.end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Header & Quick Action Bar */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📈</span>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
              แดชบอร์ด & กำไร-ขาดทุนของสวนยาง (Farmer P&L)
            </h2>
          </div>
          <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            วิเคราะห์รายรับ-รายจ่าย สัดส่วนผลประโยชน์คนกรีด และผลกำไรสุทธิตามแปลงสวนแบบเรียลไทม์
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={loadData}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>รีเฟรช</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', fontSize: '0.85rem', color: '#166534', borderColor: '#bbf7d0', background: '#f0fdf4' }}
          >
            <Download size={15} />
            <span>ส่งออก CSV</span>
          </button>

          {onShowTrash && (
            <button
              onClick={onShowTrash}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', fontSize: '0.85rem', color: '#64748b' }}
            >
              <Trash2 size={15} />
              <span>ถังขยะ</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Filters & Selector Control Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Time Period Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Calendar size={15} /> ช่วงเวลา:
            </span>
            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', gap: '2px' }}>
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
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '0.825rem',
                    fontWeight: filterPeriod === tab.id ? 700 : 500,
                    background: filterPeriod === tab.id ? '#15803d' : 'transparent',
                    color: filterPeriod === tab.id ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Plot Dropdown Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '220px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Trees size={16} /> แปลงสวน:
            </span>
            <select
              value={selectedPlotId}
              onChange={(e) => setSelectedPlotId(e.target.value)}
              className="form-input"
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.85rem',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                flex: 1,
                fontWeight: 600,
                color: '#1e293b'
              }}
            >
              <option value="all">🌳 ทุกแปลงสวน (รวมทั้งหมด)</option>
              {plots.map(p => (
                <option key={p.plot_id} value={p.plot_id}>
                  {p.plot_name} {p.total_area_rai ? `(${p.total_area_rai} ไร่)` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Inputs if Custom selected */}
        {filterPeriod === 'custom' && (
          <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>เลือกช่วงวันที่:</span>
            <input
              type="date"
              value={customRange.start}
              onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
              className="form-input"
              style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem', width: 'auto' }}
            />
            <span style={{ color: '#94a3b8' }}>ถึง</span>
            <input
              type="date"
              value={customRange.end}
              onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
              className="form-input"
              style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem', width: 'auto' }}
            />
          </div>
        )}
      </div>

      {/* 3. 5 KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        
        {/* KPI 1: ยอดขายยางรวม */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #15803d', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#64748b' }}>ยอดขายยางรวม (Total Revenue)</span>
            <div style={{ background: '#f0fdf4', padding: '6px', borderRadius: '8px', color: '#15803d' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: '0.4rem 0 0.2rem 0' }}>
            ฿{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.775rem', color: '#15803d', fontWeight: 500 }}>
            📦 รวม {transactions.length} บิลขาย
          </div>
        </div>

        {/* KPI 2: ส่วนแบ่งคนกรีด */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #d97706', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#64748b' }}>ส่วนแบ่งคนกรีด (Tapper Share)</span>
            <div style={{ background: '#fffbeb', padding: '6px', borderRadius: '8px', color: '#d97706' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#d97706', margin: '0.4rem 0 0.2rem 0' }}>
            ฿{totalTapperShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.775rem', color: '#78350f', fontWeight: 500 }}>
            🤝 {totalRevenue > 0 ? ((totalTapperShare / totalRevenue) * 100).toFixed(1) : 0}% ของยอดขาย
          </div>
        </div>

        {/* KPI 3: รายได้สุทธิจากยาง */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #0284c7', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#64748b' }}>รายได้สุทธิจากยาง (Gross Income)</span>
            <div style={{ background: '#f0f9ff', padding: '6px', borderRadius: '8px', color: '#0284c7' }}>
              <Award size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0369a1', margin: '0.4rem 0 0.2rem 0' }}>
            ฿{grossIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.775rem', color: '#0284c7', fontWeight: 500 }}>
            🌱 ยอดขายหักส่วนแบ่งคนกรีด
          </div>
        </div>

        {/* KPI 4: ค่าใช้จ่ายดูแลสวนรวม */}
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #e11d48', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#64748b' }}>ค่าใช้จ่ายดูแลสวน (Expenses)</span>
            <div style={{ background: '#fff1f2', padding: '6px', borderRadius: '8px', color: '#e11d48' }}>
              <TrendingDown size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#be123c', margin: '0.4rem 0 0.2rem 0' }}>
            ฿{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.775rem', color: '#9f1239', fontWeight: 500 }}>
            💸 รวม {expenses.length} รายการค่าใช้จ่าย
          </div>
        </div>

        {/* KPI 5: กำไรสุทธิของสวน (Highlight Card) */}
        <div 
          className="card" 
          style={{ 
            padding: '1.25rem', 
            background: isProfitable 
              ? 'linear-gradient(145deg, #f0fdf4 0%, #dcfce7 100%)' 
              : 'linear-gradient(145deg, #fef2f2 0%, #fee2e2 100%)',
            border: isProfitable ? '2px solid #86efac' : '2px solid #fca5a5',
            boxShadow: isProfitable ? '0 4px 14px rgba(22, 163, 74, 0.12)' : '0 4px 14px rgba(239, 68, 68, 0.12)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 700, color: isProfitable ? '#166534' : '#991b1b' }}>
              กำไรสุทธิของสวน (Net Profit)
            </span>
            <div style={{ 
              background: isProfitable ? '#22c55e' : '#ef4444', 
              color: '#fff', 
              padding: '4px 8px', 
              borderRadius: '6px', 
              fontSize: '0.725rem', 
              fontWeight: 800 
            }}>
              {isProfitable ? '🎉 กำไร' : '⚠️ ขาดทุน'}
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: isProfitable ? '#15803d' : '#b91c1c', margin: '0.4rem 0 0.2rem 0' }}>
            {netProfit < 0 ? '-' : '+'}฿{Math.abs(netProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isProfitable ? '#166534' : '#991b1b' }}>
            {isProfitable ? '📈' : '📉'} อัตรากำไร: {netMargin.toFixed(1)}%
          </div>
        </div>

      </div>

      {/* 4. Analytics & Productivity Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        
        {/* Analytics 1: สัดส่วนค่าใช้จ่ายดูแลสวน (Donut Chart) */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🍩</span>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              สัดส่วนค่าใช้จ่ายดูแลสวนแยกตามหมวดหมู่
            </h3>
          </div>

          {expenseByCategoryData.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px', color: '#94a3b8' }}>
              <Layers size={36} strokeWidth={1.5} style={{ marginBottom: '0.5rem' }} />
              <p style={{ margin: 0, fontSize: '0.875rem' }}>ยังไม่มีรายการบันทึกค่าใช้จ่ายในช่วงเวลานี้</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ height: '200px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseByCategoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {expenseByCategoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val) => `฿${parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Expense Legend List */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', maxHeight: '120px', overflowY: 'auto' }}>
                {expenseByCategoryData.map((item, idx) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: EXPENSE_COLORS[idx % EXPENSE_COLORS.length] }}></div>
                    <span style={{ color: '#475569', flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.name}</span>
                    <strong style={{ color: '#0f172a' }}>฿{item.value.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Analytics 2: ประสิทธิภาพผลผลิต & ต้นทุนต่อหน่วย */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.2rem' }}>⚖️</span>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              ประสิทธิภาพผลผลิต & ต้นทุนต่อกิโลกรัม
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', flex: 1 }}>
            
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>น้ำหนักยางรวม (กก.)</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                {totalRawWeight.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} กก.
              </div>
              <div style={{ fontSize: '0.725rem', color: '#166534', fontWeight: 600, marginTop: '0.2rem' }}>
                ยางแห้ง DRC: {totalDryWeight.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} กก.
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>%DRC เฉลี่ย</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                {avgDrc.toFixed(2)}%
              </div>
              <div style={{ fontSize: '0.725rem', color: '#0284c7', fontWeight: 600, marginTop: '0.2rem' }}>
                คุณภาพเนื้อยางสด
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>ราคาขายเฉลี่ย</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#15803d', marginTop: '0.2rem' }}>
                ฿{avgPricePerKg.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.2rem' }}>
                บาท / กก. ยางแห้ง
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>ต้นทุนค่าใช้จ่ายเฉลี่ย</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#e11d48', marginTop: '0.2rem' }}>
                ฿{costPerKg.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.2rem' }}>
                บาท / กก. ยางแห้ง
              </div>
            </div>

          </div>

          <div style={{ marginTop: '0.85rem', padding: '0.65rem 0.85rem', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0', fontSize: '0.775rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle2 size={15} color="#059669" />
            <span>
              ส่วนต่างกำไรสุทธิต่อ กก. ยาง: <strong>฿{(avgPricePerKg - costPerKg).toFixed(2)} บาท/กก.</strong>
            </span>
          </div>
        </div>

      </div>

      {/* 5. Financial Flow Bar Chart */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={18} color="#15803d" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              ภาพรวมกระแสการเงินของสวนยาง (Financial Breakdown)
            </h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            ยอดรวมตามช่วงเวลาที่เลือก
          </span>
        </div>

        <div style={{ height: '240px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={financialFlowData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} interval={0} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `฿${(val/1000).toFixed(0)}k`} />
              <Tooltip 
                formatter={(val) => [`฿${parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'จำนวนเงิน']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                {financialFlowData.map((entry, index) => (
                  <Cell key={`bar-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 6. Detailed Records Table Section */}
      <div className="card" style={{ padding: '1.25rem' }}>
        {/* Table Selector Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveDetailTab('sales')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                fontSize: '0.875rem',
                fontWeight: activeDetailTab === 'sales' ? 700 : 500,
                background: activeDetailTab === 'sales' ? '#f0fdf4' : 'transparent',
                color: activeDetailTab === 'sales' ? '#15803d' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                borderBottom: activeDetailTab === 'sales' ? '2px solid #15803d' : 'none'
              }}
            >
              <span>📋 รายการบิลขายยาง ({transactions.length})</span>
            </button>

            <button
              onClick={() => setActiveDetailTab('expenses')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                fontSize: '0.875rem',
                fontWeight: activeDetailTab === 'expenses' ? 700 : 500,
                background: activeDetailTab === 'expenses' ? '#fff1f2' : 'transparent',
                color: activeDetailTab === 'expenses' ? '#be123c' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                borderBottom: activeDetailTab === 'expenses' ? '2px solid #e11d48' : 'none'
              }}
            >
              <span>💸 รายการค่าใช้จ่ายสวน ({expenses.length})</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="ค้นหารายการ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.825rem', width: '180px' }}
            />
          </div>
        </div>

        {/* Tab 1: Sales Transactions Table */}
        {activeDetailTab === 'sales' && (
          <div style={{ overflowX: 'auto' }}>
            {filteredTableTxs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                <p style={{ margin: 0 }}>ไม่มีรายการขายยางในช่วงเวลานี้</p>
              </div>
            ) : (
              <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '0.65rem 0.75rem' }}>วันที่</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>คิว / เลขบิล</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>ร้านที่ขาย</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>น้ำหนักสด (กก.)</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>%DRC</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>ยางแห้ง (กก.)</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>ราคา (บาท)</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>ยอดรวม (บาท)</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>ส่วนแบ่งคนกรีด</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>รายได้สุทธิ</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTableTxs.map(tx => {
                    const amt = parseFloat(tx.total_amount) || parseFloat(tx.total_amount_thb) || 0;
                    const tapperShare = parseFloat(tx.tapper_share_amount) || 0;
                    const netIncome = amt - tapperShare;
                    const isManualBill = !tx.buyer_id || tx.queue_number === 'E-BILL';

                    return (
                      <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.75rem' }}>{tx.date || '-'}</td>
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                          <span style={{ 
                            background: isManualBill ? '#f1f5f9' : '#ecfdf5', 
                            color: isManualBill ? '#475569' : '#15803d',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.75rem'
                          }}>
                            {tx.queue_number || 'E-BILL'}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 500 }}>
                          {tx.buyer_name || 'ร้านรับซื้อทั่วไป'}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                          {parseFloat(tx.raw_weight_kg || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                          {parseFloat(tx.drc_percentage || 0).toFixed(2)}%
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                          {parseFloat(tx.dry_weight_kg || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                          ฿{parseFloat(tx.price_per_kg || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>
                          ฿{amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#d97706' }}>
                          ฿{tapperShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                          ฿{netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                          {isManualBill ? (
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              {onEdit && (
                                <button
                                  onClick={() => onEdit(tx)}
                                  className="btn-sm"
                                  style={{ padding: '2px 6px', fontSize: '0.75rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px' }}
                                  title="แก้ไข"
                                >
                                  ✏️
                                </button>
                              )}
                              {onDelete && (
                                <button
                                  onClick={() => {
                                    if (window.confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
                                      onDelete(tx.id);
                                    }
                                  }}
                                  className="btn-sm"
                                  style={{ padding: '2px 6px', fontSize: '0.75rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '4px' }}
                                  title="ลบ"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: '#059669', background: '#ecfdf5', padding: '2px 5px', borderRadius: '4px' }}>
                              ซิงค์แล้ว
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Expenses Table */}
        {activeDetailTab === 'expenses' && (
          <div style={{ overflowX: 'auto' }}>
            {expenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                <p style={{ margin: 0 }}>ไม่มีรายการค่าใช้จ่ายในช่วงเวลานี้</p>
              </div>
            ) : (
              <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '0.65rem 0.75rem' }}>วันที่</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>แปลงสวน</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>หมวดหมู่</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>รายละเอียด</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>จำนวนเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(e => {
                    const plotName = plots.find(p => p.plot_id === e.plot_id)?.plot_name || 'สวนทั่วไป';
                    return (
                      <tr key={e.expense_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.75rem' }}>{e.expense_date || '-'}</td>
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>{plotName}</td>
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          <span style={{ background: '#f1f5f9', padding: '3px 7px', borderRadius: '4px', fontSize: '0.75rem', color: '#475569' }}>
                            {e.category || 'อื่นๆ'}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', color: '#64748b' }}>{e.description || '-'}</td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#be123c' }}>
                          ฿{parseFloat(e.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default FarmerProfitLoss;
