import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { db } from '../supabase';
import {
  DollarSign, Plus, Trash2, Edit2, Search, Download, Eye, Tag, Calendar,
  User, FileText, Camera, X, Check, Filter, Trees, Trash
} from 'lucide-react';

const EXPENSE_CATEGORIES = [
  { id: 'fertilizer', name: 'ปุ๋ย', color: '#16a34a', bg: '#f0fdf4', aliases: ['ปุ๋ย'] },
  { id: 'tools', name: 'อุปกรณ์/มีดกรีด', color: '#d97706', bg: '#fffbeb', aliases: ['อุปกรณ์/มีดกรีด', 'อุปกรณ์', 'มีดกรีด'] },
  { id: 'chemicals', name: 'ยา/สารเคมีกำจัดวัชพืช', color: '#0ea5e9', bg: '#f0f9ff', aliases: ['ยาฆ่าหญ้า', 'ยาหน้ายาง', 'สารเคมี', 'ยากำจัดวัชพืช', 'ยา/สารเคมีกำจัดวัชพืช'] },
  { id: 'labor', name: 'ค่าแรงงาน/ตัดหญ้า', color: '#8b5cf6', bg: '#f5f3ff', aliases: ['ค่าจ้างแผ้วถาง', 'ค่าแรงงาน', 'ค่าตัดหญ้า', 'ค่าแรงงาน/ตัดหญ้า'] },
  { id: 'misc', name: 'เบ็ดเตล็ด/อื่นๆ', color: '#64748b', bg: '#f8fafc', aliases: ['อื่นๆ', 'เบ็ดเตล็ด', 'เบ็ดเตล็ด/อื่นๆ'] }
];

function normalizeCategoryName(rawCat) {
  if (!rawCat) return 'เบ็ดเตล็ด/อื่นๆ';
  for (const cat of EXPENSE_CATEGORIES) {
    if (cat.name === rawCat) return cat.name;
    if (cat.aliases && cat.aliases.includes(rawCat)) return cat.name;
  }
  return 'เบ็ดเตล็ด/อื่นๆ';
}

function getCategoryMeta(catName) {
  const norm = normalizeCategoryName(catName);
  return EXPENSE_CATEGORIES.find(c => c.name === norm) || { name: catName, color: '#64748b', bg: '#f1f5f9' };
}

function ExpenseManagement({ currentUser, onShowTrash }) {
  const [plots, setPlots] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedPlotId, setSelectedPlotId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all'); // 'all', 'today', '7days', 'this_month', 'this_year'

  // Modal / Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const initialForm = useMemo(() => ({
    plot_id: '',
    category: 'ปุ๋ย',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    receipt_url: '',
    recorder_name: currentUser?.full_name || 'ชาวสวนยาง'
  }), [currentUser]);

  const [formData, setFormData] = useState(initialForm);

  // 1. Load user rubber plots
  const loadPlots = useCallback(async () => {
    if (!currentUser) return [];
    try {
      const userPlots = await db.getRubberPlots(currentUser.id, currentUser.user_id);
      setPlots(userPlots || []);
      return userPlots || [];
    } catch (err) {
      console.error('Failed to load plots:', err);
      return [];
    }
  }, [currentUser]);

  // 2. Load plot expenses
  const loadExpenses = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const profileId = currentUser.id;
      const authUserId = currentUser.user_id;
      const data = await db.getPlotExpenses(selectedPlotId === 'all' ? null : selectedPlotId, profileId || authUserId);
      
      // Strict user scoping: only allow expenses on user's own plots or recorded by user
      const userPlotIds = new Set((plots || []).map(p => p.plot_id || p.id));
      const safeData = (Array.isArray(data) ? data : []).filter(e => {
        if (e.deleted_at) return false;
        const isMyPlot = Boolean(e.plot_id && userPlotIds.has(e.plot_id));
        const isMyRecord = Boolean(
          (profileId && e.recorded_by === profileId) || 
          (authUserId && e.recorded_by === authUserId)
        );
        return isMyPlot || isMyRecord;
      });
      setExpenses(safeData);
    } catch (err) {
      console.error('Failed to load plot expenses:', err);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [selectedPlotId, currentUser, plots]);

  useEffect(() => {
    loadPlots();
  }, [loadPlots]);

  useEffect(() => {
    loadExpenses();
    const unsub = db.subscribeToPlotExpenses(() => {
      loadExpenses();
    });
    return () => unsub && unsub();
  }, [loadExpenses]);

  // Map plot id to plot name
  const plotMap = useMemo(() => {
    const map = {};
    plots.forEach(p => {
      map[p.plot_id] = p.plot_name;
    });
    return map;
  }, [plots]);

  // Image Upload Handling
  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({ ...prev, receipt_url: event.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Add / Edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      alert('กรุณากรอกจำนวนเงินให้ถูกต้อง');
      return;
    }

    const targetPlotId = formData.plot_id || (plots.length > 0 ? (plots[0].plot_id || plots[0].id) : null);
    if (!targetPlotId) {
      alert('กรุณาเลือกแปลงสวนก่อนบันทึก');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        plot_id: targetPlotId,
        recorded_by: currentUser?.id || currentUser?.user_id,
        category: formData.category,
        amount: amount,
        expense_date: formData.expense_date,
        description: formData.description || null,
        receipt_url: formData.receipt_url || null
      };

      if (editingExpense) {
        await db.updatePlotExpense(editingExpense.expense_id, payload);
        alert('อัปเดตข้อมูลรายจ่ายเรียบร้อย ✅');
      } else {
        await db.addPlotExpense(payload);
        alert('บันทึกรายจ่ายสวนยางเรียบร้อยแล้ว ✅');
      }

      setFormData(initialForm);
      setEditingExpense(null);
      setShowAddForm(false);
      await loadExpenses();
    } catch (err) {
      console.error('Error saving plot expense:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกรายจ่าย: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit
  const handleEditClick = (expense) => {
    setEditingExpense(expense);
    setFormData({
      plot_id: expense.plot_id || (plots.length > 0 ? plots[0].plot_id : ''),
      category: normalizeCategoryName(expense.category),
      amount: expense.amount || '',
      expense_date: expense.expense_date ? String(expense.expense_date).substring(0, 10) : new Date().toISOString().split('T')[0],
      description: expense.description || '',
      receipt_url: expense.receipt_url || '',
      recorder_name: expense.recorder?.full_name || currentUser?.full_name || ''
    });
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete Expense
  const handleDelete = async (id, category, amount) => {
    if (!window.confirm(`⚠️ ยืนยันการลบรายการ "${category}" จำนวน ฿${parseFloat(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} หรือไม่?`)) return;
    try {
      await db.deletePlotExpense(id);
      await loadExpenses();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการลบรายการ');
    }
  };

  // Filter Expenses
  const filteredExpenses = useMemo(() => {
    const userPlotIds = new Set((plots || []).map(p => p.plot_id || p.id));
    const profileId = currentUser?.id;
    const authUserId = currentUser?.user_id;

    return expenses.filter(e => {
      if (e.deleted_at) return false;

      // STRICT PRIVACY CHECK: Must belong to user's plot or recorded by user
      const isMyPlot = Boolean(e.plot_id && userPlotIds.has(e.plot_id));
      const isMyRecord = Boolean(
        (profileId && e.recorded_by === profileId) || 
        (authUserId && e.recorded_by === authUserId)
      );
      if (!isMyPlot && !isMyRecord) return false;

      // Plot filter
      if (selectedPlotId !== 'all' && e.plot_id !== selectedPlotId) {
        return false;
      }

      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const pName = (plotMap[e.plot_id] || '').toLowerCase();
        const cat = (e.category || '').toLowerCase();
        const desc = (e.description || '').toLowerCase();
        const recorder = (e.recorder?.full_name || '').toLowerCase();
        if (!pName.includes(q) && !cat.includes(q) && !desc.includes(q) && !recorder.includes(q)) {
          return false;
        }
      }

      // Category filter
      if (filterCategory !== 'all') {
        const norm = normalizeCategoryName(e.category);
        if (norm !== filterCategory) return false;
      }

      // Period filter
      if (filterPeriod !== 'all') {
        const d = (e.expense_date || '').substring(0, 10);
        const today = new Date().toISOString().split('T')[0];
        if (filterPeriod === 'today' && d !== today) return false;
        if (filterPeriod === '7days') {
          const d7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
          if (d < d7) return false;
        }
        if (filterPeriod === 'this_month') {
          const ym = today.slice(0, 7);
          if (!d.startsWith(ym)) return false;
        }
        if (filterPeriod === 'this_year') {
          const y = today.slice(0, 4);
          if (!d.startsWith(y)) return false;
        }
      }

      return true;
    });
  }, [expenses, selectedPlotId, searchQuery, filterCategory, filterPeriod, plotMap]);

  // Total Expenses
  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  }, [filteredExpenses]);

  // Category Totals for KPI Cards Grid
  const categoryTotals = useMemo(() => {
    const totals = {};
    EXPENSE_CATEGORIES.forEach(c => { totals[c.name] = 0; });
    filteredExpenses.forEach(e => {
      const norm = normalizeCategoryName(e.category);
      totals[norm] = (totals[norm] || 0) + (parseFloat(e.amount) || 0);
    });
    return totals;
  }, [filteredExpenses]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }
    const headers = ['วันที่', 'แปลงสวน', 'หมวดหมู่', 'รายละเอียด/หมายเหตุ', 'ผู้บันทึก', 'จำนวนเงิน (บาท)'];
    const rows = filteredExpenses.map(e => [
      e.expense_date ? new Date(e.expense_date).toLocaleDateString('th-TH') : '',
      `"${(plotMap[e.plot_id] || 'แปลงสวน').replace(/"/g, '""')}"`,
      `"${normalizeCategoryName(e.category).replace(/"/g, '""')}"`,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      `"${(e.recorder?.full_name || 'ชาวสวนยาง').replace(/"/g, '""')}"`,
      parseFloat(e.amount || 0).toFixed(2)
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `บันทึกรายจ่ายสวนยาง_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* 1. Header Banner (Dark Forest Green gradient matching Buyer Portal unified pattern) */}
      <div style={{
        background: 'linear-gradient(135deg, #14532d 0%, #166534 60%, #15803d 100%)',
        color: '#fff',
        borderRadius: '16px',
        padding: '1.5rem 1.75rem',
        marginBottom: '1.5rem',
        boxShadow: '0 8px 24px rgba(20, 83, 45, 0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.18)',
            borderRadius: '12px',
            width: '52px',
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
            fontSize: '1.6rem'
          }}>
            💸
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
              บันทึกรายจ่ายสวนยาง
            </h2>
            <p style={{ margin: '0.25rem 0 0', opacity: 0.9, fontSize: '0.9rem', color: '#dcfce7' }}>
              บันทึกและติดตามรายจ่ายต่างๆ เช่น ค่าปุ๋ย ค่าถางหญ้า ค่าอุปกรณ์ เจ้าของสวนและคนกรีดสามารถดูร่วมกันได้
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {onShowTrash && (
            <button
              onClick={onShowTrash}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '0.7rem 1rem',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s',
                backdropFilter: 'blur(4px)'
              }}
              title="เปิดถังขยะรายจ่ายที่ถูกลบ"
            >
              <Trash2 size={16} />
              <span>ถังขยะ</span>
            </button>
          )}

          <button
            onClick={() => {
              if (showAddForm) {
                setShowAddForm(false);
                setEditingExpense(null);
              } else {
                setFormData({
                  ...initialForm,
                  plot_id: selectedPlotId !== 'all' ? selectedPlotId : (plots[0]?.plot_id || '')
                });
                setEditingExpense(null);
                setShowAddForm(true);
              }
            }}
            style={{
              background: showAddForm ? '#ffffff' : '#22c55e',
              color: showAddForm ? '#166534' : '#ffffff',
              border: 'none',
              padding: '0.7rem 1.25rem',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.2s'
            }}
          >
            {showAddForm ? <X size={18} /> : <Plus size={18} />}
            <span>{showAddForm ? 'ปิดแบบฟอร์ม' : '+ เพิ่มรายการรายจ่าย'}</span>
          </button>
        </div>
      </div>

      {/* 2. Category Breakdown Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1.5rem'
      }}>
        {/* Main Card: รวมรายจ่ายทั้งหมด */}
        <div 
          onClick={() => setFilterCategory('all')}
          style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '1rem',
            border: filterCategory === 'all' ? '2px solid #22c55e' : '1px solid #e2e8f0',
            boxShadow: filterCategory === 'all' ? '0 4px 12px rgba(34, 197, 94, 0.15)' : '0 2px 6px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 700 }}>รวมรายจ่ายทั้งหมด</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#15803d', marginTop: '0.25rem' }}>
            ฿{totalExpenses.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{filteredExpenses.length} รายการ</div>
        </div>

        {/* Category Cards */}
        {EXPENSE_CATEGORIES.map(cat => {
          const amt = categoryTotals[cat.name] || 0;
          const isSelected = filterCategory === cat.name;
          return (
            <div
              key={cat.id}
              onClick={() => setFilterCategory(isSelected ? 'all' : cat.name)}
              style={{
                background: isSelected ? cat.bg : '#fff',
                borderRadius: '12px',
                padding: '0.9rem',
                border: isSelected ? `2px solid ${cat.color}` : '1px solid #e2e8f0',
                boxShadow: isSelected ? `0 4px 12px ${cat.color}25` : '0 2px 4px rgba(0,0,0,0.02)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: cat.color, fontWeight: 700 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                <span>{cat.name}</span>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>
                ฿{amt.toLocaleString('th-TH', { minimumFractionDigits: 0 })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Expense Form Modal Card */}
      {showAddForm && (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '2px solid #86efac',
          padding: '1.75rem',
          marginBottom: '1.75rem',
          boxShadow: '0 10px 25px -5px rgba(22, 101, 52, 0.12)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={22} color="#16a34a" />
              <span>{editingExpense ? '✏️ แก้ไขข้อมูลรายจ่ายสวน' : '📝 บันทึกรายจ่ายสวนยาง'}</span>
            </h3>
            <button
              onClick={() => { setShowAddForm(false); setEditingExpense(null); }}
              style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1.25rem' }}>
              {/* Plot Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  🌳 แปลงสวนยาง *
                </label>
                <select
                  value={formData.plot_id || (plots[0]?.plot_id || '')}
                  onChange={(e) => setFormData({ ...formData, plot_id: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    background: '#fff',
                    fontWeight: 600,
                    color: '#0f172a'
                  }}
                  required
                >
                  {plots.length === 0 ? (
                    <option value="">(ยังไม่มีแปลงสวน)</option>
                  ) : (
                    plots.map(p => (
                      <option key={p.plot_id} value={p.plot_id}>
                        {p.plot_name} ({p.owner_id === (currentUser?.user_id || currentUser?.id) ? 'คุณเป็นเจ้าของ' : 'คุณเป็นคนกรีด'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Category */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  🏷️ หมวดหมู่รายจ่าย *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    background: '#fff',
                    fontWeight: 600
                  }}
                  required
                >
                  {EXPENSE_CATEGORIES.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#166534', marginBottom: '0.4rem' }}>
                  💰 จำนวนเงิน (บาท) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="เช่น 1500.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '2px solid #86efac',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#0f172a'
                  }}
                  required
                />
              </div>

              {/* Expense Date */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  📅 วันที่จ่ายเงิน *
                </label>
                <input
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem'
                  }}
                  required
                />
              </div>
            </div>

            {/* Description & Receipt Upload */}
            <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  📝 รายละเอียด / หมายเหตุ (เช่น ปุ๋ยสูตร 15-15-15 จำนวน 2 กระสอบ, มีดกรีดยางตรานกหวีด)
                </label>
                <textarea
                  rows="2"
                  placeholder="ระบุรายละเอียดเพิ่มเติม..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  📸 รูปถ่ายบิล / ใบเสร็จ
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageFileChange}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '0.65rem 1rem',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#334155'
                    }}
                  >
                    <Camera size={16} /> แนบรูปบิล/สลิป
                  </button>

                  {formData.receipt_url && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600 }}>แนบรูปแล้ว ✅</span>
                      <button
                        type="button"
                        onClick={() => setPreviewImage(formData.receipt_url)}
                        style={{ border: 'none', background: 'transparent', color: '#16a34a', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', fontWeight: 600 }}
                      >
                        ดูรูป
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, receipt_url: '' })}
                        style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                        title="ลบรูปภาพ"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setEditingExpense(null); }}
                style={{
                  padding: '0.65rem 1.25rem',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: 600,
                  color: '#64748b',
                  cursor: 'pointer'
                }}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: '0.65rem 1.75rem',
                  background: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
                }}
              >
                <Check size={18} />
                {isSubmitting ? 'กำลังบันทึก...' : (editingExpense ? 'บันทึกการแก้ไข' : 'บันทึกรายจ่าย')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Expenses Data Table Section */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '1.5rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
      }}>
        {/* Toolbar Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
            📋 รายการค่าใช้จ่าย ({filteredExpenses.length} รายการ)
          </h3>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Plot Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <select
                value={selectedPlotId}
                onChange={(e) => setSelectedPlotId(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  background: '#fff',
                  fontWeight: 600,
                  color: '#166534'
                }}
              >
                <option value="all">🌳 ทุกแปลงสวน</option>
                {plots.map(p => (
                  <option key={p.plot_id} value={p.plot_id}>
                    🌳 {p.plot_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="ค้นหารายการ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem 0.5rem 2.2rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  width: '160px'
                }}
              />
            </div>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                background: '#fff'
              }}
            >
              <option value="all">ทุกหมวดหมู่</option>
              {EXPENSE_CATEGORIES.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            {/* Period Filter */}
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                background: '#fff'
              }}
            >
              <option value="all">ทุกช่วงเวลา</option>
              <option value="today">วันนี้</option>
              <option value="7days">7 วันล่าสุด</option>
              <option value="this_month">เดือนนี้</option>
              <option value="this_year">ปีนี้</option>
            </select>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.85rem',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer'
              }}
            >
              <Download size={15} /> Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem' }}>วันที่</th>
                <th style={{ padding: '0.75rem 1rem' }}>แปลงสวน</th>
                <th style={{ padding: '0.75rem 1rem' }}>หมวดหมู่</th>
                <th style={{ padding: '0.75rem 1rem' }}>รายละเอียด / หมายเหตุ</th>
                <th style={{ padding: '0.75rem 1rem' }}>ผู้บันทึก</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>จำนวนเงิน (บาท)</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>สลิป/บิล</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    กำลังโหลดข้อมูลค่าใช้จ่าย...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                    <DollarSign size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                    <div>ยังไม่มีรายการค่าใช้จ่าย</div>
                    <button
                      onClick={() => setShowAddForm(true)}
                      style={{
                        marginTop: '0.75rem',
                        background: '#f0fdf4',
                        color: '#166534',
                        border: '1px solid #86efac',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600
                      }}
                    >
                      + เพิ่มรายการแรก
                    </button>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const meta = getCategoryMeta(exp.category);
                  const plotName = plotMap[exp.plot_id] || (exp.plot?.plot_name || 'แปลงสวน');
                  const isMyRecord = exp.recorded_by === (currentUser?.user_id || currentUser?.id);

                  return (
                    <tr key={exp.expense_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {/* 1) วันที่ */}
                      <td style={{ padding: '0.85rem 1rem', color: '#334155', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>
                          {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </div>
                      </td>

                      {/* 2) แปลงสวน */}
                      <td style={{ padding: '0.85rem 1rem', color: '#166534', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Trees size={15} color="#16a34a" />
                          <span>{plotName}</span>
                        </div>
                      </td>

                      {/* 3) หมวดหมู่ */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          background: meta.bg,
                          color: meta.color,
                          border: `1px solid ${meta.color}40`,
                          padding: '0.3rem 0.7rem',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          display: 'inline-block'
                        }}>
                          {meta.name}
                        </span>
                      </td>

                      {/* 4) รายละเอียด */}
                      <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                        {exp.description || '-'}
                      </td>

                      {/* 5) ผู้บันทึก */}
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                        {exp.recorder?.full_name || 'ชาวสวนยาง'} {isMyRecord ? '(คุณ)' : ''}
                      </td>

                      {/* 6) จำนวนเงิน (แสดงติดลบสีแดง เช่น -฿418.00) */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: '#dc2626', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
                        -฿{parseFloat(exp.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>

                      {/* 7) สลิป/บิล */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        {exp.receipt_url ? (
                          <button
                            onClick={() => setPreviewImage(exp.receipt_url)}
                            title="ดูรูปบิล/สลิป"
                            style={{
                              background: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              color: '#16a34a',
                              padding: '0.3rem 0.6rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontWeight: 600
                            }}
                          >
                            <Eye size={13} /> ดูสลิป
                          </button>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>-</span>
                        )}
                      </td>

                      {/* 8) จัดการ */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            onClick={() => handleEditClick(exp)}
                            title="แก้ไข"
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              padding: '0.35rem 0.55rem',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(exp.expense_id, exp.category, exp.amount)}
                            title="ลบ"
                            style={{
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              color: '#ef4444',
                              padding: '0.35rem 0.55rem',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lightbox Modal for Receipt Preview */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '1rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '1rem',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>📄 รูปบิล / สลิปค่าใช้จ่าย</span>
              <button
                onClick={() => setPreviewImage(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>
            <img
              src={previewImage}
              alt="Receipt Preview"
              style={{
                maxWidth: '100%',
                maxHeight: 'calc(80vh - 60px)',
                objectFit: 'contain',
                borderRadius: '8px'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpenseManagement;
