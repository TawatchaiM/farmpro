import React, { useState, useEffect, useRef } from 'react';
import { db } from '../supabase';
import { DollarSign, Plus, Trash2, Edit2, Search, Download, Eye, Tag, Calendar, User, FileText, Camera, X, Check } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  { id: 'labor', name: 'ค่าแรงงาน', color: '#3b82f6', bg: '#eff6ff' },
  { id: 'fuel', name: 'ค่าน้ำมันขนส่ง', color: '#f59e0b', bg: '#fffbeb' },
  { id: 'chemicals', name: 'ค่าสารเคมี/แอมโมเนีย', color: '#10b981', bg: '#ecfdf5' },
  { id: 'utilities', name: 'ค่าสาธารณูปโภค', color: '#6366f1', bg: '#eef2ff' },
  { id: 'maintenance', name: 'ค่าซ่อมบำรุง', color: '#ec4899', bg: '#fdf2f8' },
  { id: 'misc', name: 'เบ็ดเตล็ด', color: '#64748b', bg: '#f8fafc' }
];

function ShopExpensesManagement({ currentUser }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all'); // 'all', 'today', '7days', 'this_month'

  // Form State
  const initialForm = {
    category: 'ค่าแรงงาน',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    note: '',
    receipt_url: '',
    created_by: currentUser?.full_name || currentUser?.store_name || 'ผู้จัดการลาน'
  };
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadExpenses();
    const unsub = db.subscribeToShopExpenses(() => {
      loadExpenses();
    });
    return () => unsub && unsub();
  }, [currentUser]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await db.getShopExpenses(null, null, currentUser?.id);
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load shop expenses:', err);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      alert('กรุณากรอกจำนวนเงินให้ถูกต้อง');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        shop_id: currentUser?.id,
        category: formData.category,
        amount: amount,
        expense_date: formData.expense_date ? new Date(formData.expense_date).toISOString() : new Date().toISOString(),
        note: formData.note || null,
        receipt_url: formData.receipt_url || null,
        created_by: formData.created_by || currentUser?.full_name || 'ผู้จัดการลาน'
      };

      if (editingExpense) {
        await db.updateShopExpense(editingExpense.id, payload);
        alert('อัปเดตค่าใช้จ่ายสำเร็จ ✅');
      } else {
        await db.addShopExpense(payload);
        alert('บันทึกค่าใช้จ่ายประจำลานเรียบร้อยแล้ว ✅');
      }

      setFormData(initialForm);
      setEditingExpense(null);
      setShowAddForm(false);
      await loadExpenses();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกค่าใช้จ่าย: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (expense) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      amount: expense.amount,
      expense_date: (expense.expense_date || '').split('T')[0] || new Date().toISOString().split('T')[0],
      note: expense.note || '',
      receipt_url: expense.receipt_url || '',
      created_by: expense.created_by || currentUser?.full_name || ''
    });
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id, category, amount) => {
    if (!window.confirm(`⚠️ ยืนยันการลบรายการ "${category}" จำนวน ฿${parseFloat(amount).toLocaleString('th-TH')} หรือไม่?`)) return;
    try {
      await db.deleteShopExpense(id);
      await loadExpenses();
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการลบรายการ');
    }
  };

  // Filter Expenses
  const filteredExpenses = expenses.filter(e => {
    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchNote = (e.note || '').toLowerCase().includes(q);
      const matchCategory = (e.category || '').toLowerCase().includes(q);
      const matchCreator = (e.created_by || '').toLowerCase().includes(q);
      if (!matchNote && !matchCategory && !matchCreator) return false;
    }
    // Filter Category
    if (filterCategory !== 'all' && e.category !== filterCategory) {
      return false;
    }
    // Filter Period
    if (filterPeriod !== 'all') {
      const d = (e.expense_date || '').split('T')[0];
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
    }
    return true;
  });

  // KPI Calculations
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  // Group by category for quick summary
  const categoryTotals = {};
  EXPENSE_CATEGORIES.forEach(c => { categoryTotals[c.name] = 0; });
  filteredExpenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + (parseFloat(e.amount) || 0);
  });

  const getCategoryMeta = (catName) => {
    return EXPENSE_CATEGORIES.find(c => c.name === catName) || { name: catName, color: '#64748b', bg: '#f1f5f9' };
  };

  // CSV Export
  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }
    const headers = ['วันที่', 'หมวดหมู่', 'จำนวนเงิน (บาท)', 'รายละเอียด/หมายเหตุ', 'ผู้บันทึก'];
    const rows = filteredExpenses.map(e => [
      e.expense_date ? new Date(e.expense_date).toLocaleDateString('th-TH') : '',
      `"${(e.category || '').replace(/"/g, '""')}"`,
      parseFloat(e.amount || 0).toFixed(2),
      `"${(e.note || '').replace(/"/g, '""')}"`,
      `"${(e.created_by || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `บันทึกค่าใช้จ่ายลาน_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
        color: '#fff',
        borderRadius: '16px',
        padding: '1.5rem 1.75rem',
        marginBottom: '1.5rem',
        boxShadow: '0 8px 24px rgba(2, 132, 199, 0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            width: '52px',
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}>
            <DollarSign size={28} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              💸 บันทึกรายจ่ายลานรับซื้อ
            </h2>
            <p style={{ margin: '0.25rem 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
              บันทึกค่าแรง ค่าน้ำมัน แอมโมเนีย ค่าไฟ และซ่อมบำรุง เพื่อคำนวณกำไรสุทธิ (Net Profit)
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (showAddForm) {
              setShowAddForm(false);
              setEditingExpense(null);
            } else {
              setFormData(initialForm);
              setEditingExpense(null);
              setShowAddForm(true);
            }
          }}
          style={{
            background: showAddForm ? '#fff' : '#38bdf8',
            color: showAddForm ? '#0369a1' : '#fff',
            border: 'none',
            padding: '0.7rem 1.25rem',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.2s'
          }}
        >
          {showAddForm ? <X size={18} /> : <Plus size={18} />}
          {showAddForm ? 'ปิดแบบฟอร์ม' : '+ เพิ่มรายการรายจ่าย'}
        </button>
      </div>

      {/* Category Breakdown Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '1rem',
          border: '2px solid #38bdf8',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>รวมรายจ่ายทั้งหมด</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0369a1', marginTop: '0.25rem' }}>
            ฿{totalExpenses.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{filteredExpenses.length} รายการ</div>
        </div>

        {EXPENSE_CATEGORIES.map(cat => {
          const amt = categoryTotals[cat.name] || 0;
          return (
            <div
              key={cat.id}
              onClick={() => setFilterCategory(filterCategory === cat.name ? 'all' : cat.name)}
              style={{
                background: filterCategory === cat.name ? cat.bg : '#fff',
                borderRadius: '12px',
                padding: '0.9rem',
                border: filterCategory === cat.name ? `2px solid ${cat.color}` : '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: cat.color, fontWeight: 700 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cat.color }} />
                {cat.name}
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>
                ฿{amt.toLocaleString('th-TH', { minimumFractionDigits: 0 })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Expense Form */}
      {showAddForm && (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '2px solid #7dd3fc',
          padding: '1.75rem',
          marginBottom: '1.75rem',
          boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={22} />
              {editingExpense ? '✏️ แก้ไขข้อมูลรายจ่าย' : '📝 บันทึกรายจ่ายประจำลาน'}
            </h3>
            <button
              onClick={() => { setShowAddForm(false); setEditingExpense(null); }}
              style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
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
                    background: '#fff'
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
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#0369a1', marginBottom: '0.4rem' }}>
                  💰 จำนวนเงิน (บาท) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="เช่น 1200.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '2px solid #7dd3fc',
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
                  📅 วันที่จ่ายเงิน
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

              {/* Created By */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  👤 ผู้บันทึก / ผู้จ่าย
                </label>
                <input
                  type="text"
                  placeholder="ชื่อผู้จ่ายเงิน..."
                  value={formData.created_by}
                  onChange={(e) => setFormData({ ...formData, created_by: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
            </div>

            {/* Note & Receipt Upload */}
            <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  📝 รายละเอียด / หมายเหตุ (เช่น ค่าซ่อมเครื่องชั่ง, เติมดีเซล ปตท.)
                </label>
                <textarea
                  rows="2"
                  placeholder="ระบุรายละเอียดเพิ่มเติม..."
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
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
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
                      padding: '0.6rem 1rem',
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
                        style={{ border: 'none', background: 'transparent', color: '#0284c7', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
                      >
                        ดูรูป
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, receipt_url: '' })}
                        style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit & Cancel Buttons */}
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
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
                }}
              >
                <Check size={18} />
                {isSubmitting ? 'กำลังบันทึก...' : (editingExpense ? 'บันทึกการแก้ไข' : 'บันทึกรายจ่าย')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expenses Table */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '1.5rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
      }}>
        {/* Controls Bar */}
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
            {/* Search */}
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
                  width: '180px'
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
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    กำลังโหลดข้อมูลค่าใช้จ่าย...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                    <DollarSign size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                    <div>ยังไม่มีรายการค่าใช้จ่าย</div>
                    <button
                      onClick={() => setShowAddForm(true)}
                      style={{
                        marginTop: '0.75rem',
                        background: '#f0f9ff',
                        color: '#0369a1',
                        border: '1px solid #7dd3fc',
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
                  return (
                    <tr key={exp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                        <div style={{ fontWeight: 600 }}>
                          {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </div>
                      </td>
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
                          {exp.category}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                        {exp.note || '-'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                        {exp.created_by || '-'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: '#dc2626', fontSize: '0.95rem' }}>
                        -฿{parseFloat(exp.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        {exp.receipt_url ? (
                          <button
                            onClick={() => setPreviewImage(exp.receipt_url)}
                            title="ดูรูปบิล/สลิป"
                            style={{
                              background: '#f0f9ff',
                              border: '1px solid #bae6fd',
                              color: '#0284c7',
                              padding: '0.3rem 0.6rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            <Eye size={13} /> ดูสลิป
                          </button>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            onClick={() => handleEditClick(exp)}
                            title="แก้ไข"
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              color: '#475569',
                              padding: '0.35rem',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(exp.id, exp.category, exp.amount)}
                            title="ลบ"
                            style={{
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              color: '#dc2626',
                              padding: '0.35rem',
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

      {/* Image Preview Modal */}
      {previewImage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          zIndex: 999999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '1.5rem'
        }} onClick={() => setPreviewImage(null)}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '1rem',
            maxWidth: '650px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>📷 รูปถ่ายสลิป/ใบเสร็จ</span>
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
              style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '8px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ShopExpensesManagement;
