import React, { useState, useEffect, useRef } from 'react';
import { db } from '../supabase';
import { Truck, Plus, Trash2, Edit2, Search, Download, Eye, Calendar, DollarSign, Scale, Percent, FileText, Camera, Upload, X, Check } from 'lucide-react';

const POPULAR_FACTORIES = [
  'ศรีตรังแอโกรอินดัสทรี',
  'วงศ์บัณฑิต',
  'ถาวรยางพารา',
  'ยางไทยปักษ์ใต้',
  'เซาท์แลนด์รับเบอร์',
  'ไทยฮั้วยางพารา',
  'อีโนเว รับเบอร์'
];

function RubberSalesManagement({ currentUser }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFactory, setFilterFactory] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all'); // 'all', 'today', '7days', 'this_month'

  // Form State
  const initialForm = {
    factory_name: 'ศรีตรังแอโกรอินดัสทรี',
    custom_factory: '',
    net_weight: '',
    drc_percent: '',
    price_per_kg: '',
    total_amount: '',
    sale_date: new Date().toISOString().split('T')[0],
    receipt_url: '',
    note: ''
  };
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadSales();
    const unsub = db.subscribeToRubberSales(() => {
      loadSales();
    });
    return () => unsub && unsub();
  }, [currentUser]);

  const loadSales = async () => {
    setLoading(true);
    try {
      const data = await db.getRubberSales(null, null, currentUser?.id);
      setSales(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load rubber sales:', err);
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto calculate total_amount when net_weight or price_per_kg changes
  const handleWeightOrPriceChange = (field, val) => {
    const nextForm = { ...formData, [field]: val };
    const weight = parseFloat(field === 'net_weight' ? val : nextForm.net_weight) || 0;
    const price = parseFloat(field === 'price_per_kg' ? val : nextForm.price_per_kg) || 0;
    if (weight > 0 && price > 0) {
      nextForm.total_amount = (weight * price).toFixed(2);
    }
    setFormData(nextForm);
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
    const factoryName = formData.factory_name === 'other'
      ? formData.custom_factory.trim()
      : formData.factory_name;

    if (!factoryName) {
      alert('กรุณาระบุชื่อโรงงานปลายทาง');
      return;
    }
    const weight = parseFloat(formData.net_weight);
    if (!weight || weight <= 0) {
      alert('กรุณากรอกน้ำหนักสุทธิให้ถูกต้อง');
      return;
    }
    const price = parseFloat(formData.price_per_kg);
    if (!price || price <= 0) {
      alert('กรุณากรอกราคาต่อ กก. ให้ถูกต้อง');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        shop_id: currentUser?.id,
        factory_name: factoryName,
        net_weight: weight,
        drc_percent: parseFloat(formData.drc_percent) || 0,
        price_per_kg: price,
        total_amount: parseFloat(formData.total_amount) || (weight * price),
        sale_date: formData.sale_date ? new Date(formData.sale_date).toISOString() : new Date().toISOString(),
        receipt_url: formData.receipt_url || null,
        note: formData.note || null
      };

      if (editingSale) {
        await db.updateRubberSale(editingSale.id, payload);
        alert('อัปเดตข้อมูลส่งขายโรงงานสำเร็จ ✅');
      } else {
        await db.addRubberSale(payload);
        alert('บันทึกข้อมูลการส่งขายโรงงานเรียบร้อยแล้ว ✅');
      }

      setFormData(initialForm);
      setEditingSale(null);
      setShowAddForm(false);
      await loadSales();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (sale) => {
    setEditingSale(sale);
    const isStandard = POPULAR_FACTORIES.includes(sale.factory_name);
    setFormData({
      factory_name: isStandard ? sale.factory_name : 'other',
      custom_factory: isStandard ? '' : sale.factory_name,
      net_weight: sale.net_weight,
      drc_percent: sale.drc_percent,
      price_per_kg: sale.price_per_kg,
      total_amount: sale.total_amount,
      sale_date: (sale.sale_date || '').split('T')[0] || new Date().toISOString().split('T')[0],
      receipt_url: sale.receipt_url || '',
      note: sale.note || ''
    });
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`⚠️ ยืนยันการลบรายการส่งขาย "${name}" หรือไม่?`)) return;
    try {
      await db.deleteRubberSale(id);
      await loadSales();
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการลบรายการ');
    }
  };

  // Filter Sales
  const filteredSales = sales.filter(s => {
    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchFactory = (s.factory_name || '').toLowerCase().includes(q);
      const matchNote = (s.note || '').toLowerCase().includes(q);
      if (!matchFactory && !matchNote) return false;
    }
    // Filter Factory
    if (filterFactory !== 'all' && s.factory_name !== filterFactory) {
      return false;
    }
    // Filter Period
    if (filterPeriod !== 'all') {
      const d = (s.sale_date || '').split('T')[0];
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
  const totalRevenue = filteredSales.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
  const totalWeight = filteredSales.reduce((sum, s) => sum + (parseFloat(s.net_weight) || 0), 0);
  const avgPrice = totalWeight > 0 ? (totalRevenue / totalWeight) : 0;
  const avgDrc = filteredSales.length > 0
    ? (filteredSales.reduce((sum, s) => sum + (parseFloat(s.drc_percent) || 0), 0) / filteredSales.length)
    : 0;

  // CSV Export
  const handleExportCSV = () => {
    if (filteredSales.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }
    const headers = ['วันที่', 'โรงงานปลายทาง', 'น้ำหนักสุทธิ (กก.)', '%DRC โรงงาน', 'ราคาขาย/กก. (บาท)', 'ยอดเงินรวม (บาท)', 'หมายเหตุ'];
    const rows = filteredSales.map(s => [
      s.sale_date ? new Date(s.sale_date).toLocaleDateString('th-TH') : '',
      `"${(s.factory_name || '').replace(/"/g, '""')}"`,
      parseFloat(s.net_weight || 0).toFixed(2),
      parseFloat(s.drc_percent || 0).toFixed(2),
      parseFloat(s.price_per_kg || 0).toFixed(2),
      parseFloat(s.total_amount || 0).toFixed(2),
      `"${(s.note || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `บันทึกส่งขายโรงงาน_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
        color: '#fff',
        borderRadius: '16px',
        padding: '1.5rem 1.75rem',
        marginBottom: '1.5rem',
        boxShadow: '0 8px 24px rgba(21, 128, 61, 0.2)',
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
            <Truck size={28} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              🚚 บันทึกการขายยาง (ส่งโรงงาน)
            </h2>
            <p style={{ margin: '0.25rem 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
              บันทึกน้ำหนัก ค่า DRC และยอดขายที่ส่งโรงงานแปรรูป เพื่อคำนวณกำไร-ขาดทุนแบบเรียลไทม์
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (showAddForm) {
              setShowAddForm(false);
              setEditingSale(null);
            } else {
              setFormData(initialForm);
              setEditingSale(null);
              setShowAddForm(true);
            }
          }}
          style={{
            background: showAddForm ? '#fff' : '#22c55e',
            color: showAddForm ? '#166534' : '#fff',
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
          {showAddForm ? 'ปิดแบบฟอร์ม' : '+ บันทึกการส่งขายใหม่'}
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* Total Revenue */}
        <div style={{
          background: '#fff',
          borderRadius: '14px',
          padding: '1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>ยอดเงินขายรวม</span>
            <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700 }}>
              {filteredSales.length} เที่ยว
            </span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#15803d', marginTop: '0.5rem' }}>
            ฿{totalRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            ยอดขายที่รับเงินจากโรงงาน
          </div>
        </div>

        {/* Total Weight */}
        <div style={{
          background: '#fff',
          borderRadius: '14px',
          padding: '1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>น้ำหนักส่งโรงงานรวม</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginTop: '0.5rem' }}>
            {totalWeight.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '1rem', fontWeight: 500, color: '#64748b' }}>กก.</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            น้ำหนักสุทธิที่โรงงานตรวจรับ
          </div>
        </div>

        {/* Avg Price */}
        <div style={{
          background: '#fff',
          borderRadius: '14px',
          padding: '1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>ราคาขายเฉลี่ย</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb', marginTop: '0.5rem' }}>
            ฿{avgPrice.toFixed(2)} <span style={{ fontSize: '1rem', fontWeight: 500, color: '#64748b' }}>/ กก.</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            คำนวณจากยอดขาย ÷ น้ำหนักรวม
          </div>
        </div>

        {/* Avg DRC */}
        <div style={{
          background: '#fff',
          borderRadius: '14px',
          padding: '1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>%DRC เฉลี่ย (โรงงาน)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.5rem' }}>
            {avgDrc.toFixed(2)}%
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            คุณภาพยางที่โรงงานวัดได้
          </div>
        </div>
      </div>

      {/* Add / Edit Form Modal or Inline Card */}
      {showAddForm && (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '2px solid #86efac',
          padding: '1.75rem',
          marginBottom: '1.75rem',
          boxShadow: '0 10px 25px -5px rgba(22, 163, 74, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Truck size={22} />
              {editingSale ? '✏️ แก้ไขข้อมูลการส่งขายโรงงาน' : '📝 บันทึกข้อมูลการส่งขายโรงงาน'}
            </h3>
            <button
              onClick={() => { setShowAddForm(false); setEditingSale(null); }}
              style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              {/* Factory Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  🏢 โรงงานปลายทาง *
                </label>
                <select
                  value={formData.factory_name}
                  onChange={(e) => setFormData({ ...formData, factory_name: e.target.value })}
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
                  {POPULAR_FACTORIES.map(fac => (
                    <option key={fac} value={fac}>{fac}</option>
                  ))}
                  <option value="other">-- ระบุโรงงานอื่น ๆ --</option>
                </select>
                {formData.factory_name === 'other' && (
                  <input
                    type="text"
                    placeholder="พิมพ์ชื่อโรงงาน..."
                    value={formData.custom_factory}
                    onChange={(e) => setFormData({ ...formData, custom_factory: e.target.value })}
                    style={{
                      width: '100%',
                      marginTop: '0.5rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.95rem'
                    }}
                    required
                  />
                )}
              </div>

              {/* Net Weight */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  ⚖️ น้ำหนักรวมส่งขาย (กก.) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="เช่น 1500.00"
                  value={formData.net_weight}
                  onChange={(e) => handleWeightOrPriceChange('net_weight', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    fontWeight: 600
                  }}
                  required
                />
              </div>

              {/* Factory DRC% */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  🔬 %DRC ที่โรงงานตรวจได้ (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="เช่น 35.50"
                  value={formData.drc_percent}
                  onChange={(e) => setFormData({ ...formData, drc_percent: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem'
                  }}
                />
              </div>

              {/* Price per KG */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  🏷️ ราคาขายต่อ กก. (บาท) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="เช่น 82.50"
                  value={formData.price_per_kg}
                  onChange={(e) => handleWeightOrPriceChange('price_per_kg', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    fontWeight: 600
                  }}
                  required
                />
              </div>

              {/* Total Amount (Auto Calculated) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#15803d', marginBottom: '0.4rem' }}>
                  💰 ยอดเงินรวมที่ขายได้ (บาท) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="คำนวณอัตโนมัติ"
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '2px solid #86efac',
                    background: '#f0fdf4',
                    color: '#166534',
                    fontSize: '1.05rem',
                    fontWeight: 700
                  }}
                  required
                />
              </div>

              {/* Sale Date */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  📅 วันที่ส่งขาย
                </label>
                <input
                  type="date"
                  value={formData.sale_date}
                  onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
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

            {/* Note & Receipt Upload */}
            <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  📝 หมายเหตุ (เช่น ทะเบียนรถ, รอบส่ง, สาขา)
                </label>
                <textarea
                  rows="2"
                  placeholder="กรอกรายละเอียดเพิ่มเติม..."
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
                  📸 รูปถ่ายบิล / สลิปโรงงาน
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
                    <Camera size={16} /> เลือกรูป/ถ่ายภาพ
                  </button>
                  {formData.receipt_url && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600 }}>แนบรูปแล้ว ✅</span>
                      <button
                        type="button"
                        onClick={() => setPreviewImage(formData.receipt_url)}
                        style={{ border: 'none', background: 'transparent', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
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
                onClick={() => { setShowAddForm(false); setEditingSale(null); }}
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
                {isSubmitting ? 'กำลังบันทึก...' : (editingSale ? 'บันทึกการแก้ไข' : 'บันทึกการส่งขาย')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sales List Table & Filter Section */}
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
            📋 ประวัติการส่งขายโรงงาน ({filteredSales.length} รายการ)
          </h3>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="ค้นหาโรงงาน หรือ หมายเหตุ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem 0.5rem 2.2rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  width: '200px'
                }}
              />
            </div>

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
                <th style={{ padding: '0.75rem 1rem' }}>วันที่ส่งขาย</th>
                <th style={{ padding: '0.75rem 1rem' }}>โรงงานปลายทาง</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>น้ำหนัก (กก.)</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>%DRC โรงงาน</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>ราคาขาย/กก.</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>ยอดขายรวม (บาท)</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>สลิป/บิล</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    กำลังโหลดข้อมูลการส่งขาย...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                    <Truck size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                    <div>ยังไม่มีรายการส่งขายโรงงาน</div>
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
                filteredSales.map((sale) => (
                  <tr key={sale.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                    <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                      <div style={{ fontWeight: 600 }}>
                        {sale.sale_date ? new Date(sale.sale_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {sale.sale_date ? new Date(sale.sale_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{sale.factory_name}</span>
                      {sale.note && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                          💬 {sale.note}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                      {parseFloat(sale.net_weight || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <span style={{
                        background: '#f1f5f9',
                        color: '#334155',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '0.85rem'
                      }}>
                        {parseFloat(sale.drc_percent || 0).toFixed(2)}%
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#2563eb', fontWeight: 600 }}>
                      ฿{parseFloat(sale.price_per_kg || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: '#15803d', fontSize: '0.95rem' }}>
                      ฿{parseFloat(sale.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      {sale.receipt_url ? (
                        <button
                          onClick={() => setPreviewImage(sale.receipt_url)}
                          title="ดูรูปบิล/สลิป"
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#2563eb',
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
                          onClick={() => handleEditClick(sale)}
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
                          onClick={() => handleDelete(sale.id, sale.factory_name)}
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
                ))
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
              <span style={{ fontWeight: 700, color: '#0f172a' }}>📷 รูปถ่ายสลิป/บิลโรงงาน</span>
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

export default RubberSalesManagement;
