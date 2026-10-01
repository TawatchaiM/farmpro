import React, { useState, useEffect } from 'react';
import { db } from '../supabase';
import { Trash2, Plus, Calendar, DollarSign, Tag, Check, Filter, Download } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

function ExpenseManagement({ currentUser }) {
  const [plots, setPlots] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlotId, setSelectedPlotId] = useState('');
  
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category: 'ปุ๋ย',
    amount: '',
    description: ''
  });

  const expenseCategories = ['ปุ๋ย', 'ยาฆ่าหญ้า', 'ยาหน้ายาง', 'อุปกรณ์/มีดกรีด', 'ค่าจ้างแผ้วถาง', 'อื่นๆ'];

  useEffect(() => {
    loadPlots();
  }, [currentUser]);

  useEffect(() => {
    if (selectedPlotId) {
      loadExpenses(selectedPlotId);
    } else {
      setExpenses([]);
    }
  }, [selectedPlotId]);

  const loadPlots = async () => {
    if (!currentUser) return;
    try {
      const userPlots = await db.getRubberPlots(currentUser.user_id || currentUser.id);
      setPlots(userPlots);
      if (userPlots.length > 0 && !selectedPlotId) {
        setSelectedPlotId(userPlots[0].plot_id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadExpenses = async (plotId) => {
    try {
      const data = await db.getPlotExpenses(plotId);
      setExpenses(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedPlotId) {
      alert('กรุณาเลือกสวนก่อนบันทึกรายจ่าย');
      return;
    }
    try {
      const payload = {
        plot_id: selectedPlotId,
        recorded_by: currentUser.user_id || currentUser.id,
        expense_date: formData.expense_date,
        category: formData.category,
        amount: parseFloat(formData.amount),
        description: formData.description
      };
      
      await db.addPlotExpense(payload);
      alert('บันทึกรายจ่ายเรียบร้อย');
      setIsAdding(false);
      setFormData({
        expense_date: new Date().toISOString().split('T')[0],
        category: 'ปุ๋ย',
        amount: '',
        description: ''
      });
      loadExpenses(selectedPlotId);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกรายจ่าย');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('คุณต้องการลบรายจ่ายนี้ใช่หรือไม่?')) return;
    try {
      await db.deletePlotExpense(id);
      alert('ลบรายจ่ายเรียบร้อย');
      loadExpenses(selectedPlotId);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการลบรายจ่าย');
    }
  };

  const totalExpenses = expenses.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  // --- CHART DATA PREPARATION ---
  const expensesByCategory = expenses.reduce((acc, item) => {
    const cat = item.category || 'อื่นๆ';
    acc[cat] = (acc[cat] || 0) + (parseFloat(item.amount) || 0);
    return acc;
  }, {});

  const pieChartData = Object.keys(expensesByCategory).map(key => ({
    name: key,
    value: expensesByCategory[key]
  })).sort((a, b) => b.value - a.value);

  const expensesByMonth = expenses.reduce((acc, item) => {
    if (!item.expense_date) return acc;
    const month = item.expense_date.substring(0, 7); // YYYY-MM
    acc[month] = (acc[month] || 0) + (parseFloat(item.amount) || 0);
    return acc;
  }, {});

  const barChartData = Object.keys(expensesByMonth).map(key => {
    const parts = key.split('-');
    return {
      sortKey: key,
      name: `${parts[1]}/${parts[0]}`,
      'รายจ่าย (บาท)': expensesByMonth[key]
    };
  }).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

  const downloadExpensesCSV = () => {
    if (!expenses || expenses.length === 0) {
      alert('ไม่มีข้อมูลรายจ่ายสำหรับดาวน์โหลด');
      return;
    }

    const headers = [
      'วันที่',
      'หมวดหมู่',
      'รายละเอียด',
      'จำนวนเงิน (บาท)'
    ];

    const csvRows = expenses.map(row => [
      row.expense_date ? row.expense_date.substring(0, 10) : '-',
      row.category || '-',
      row.description || '-',
      row.amount || '0'
    ]);

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `รายจ่ายสวนยาง_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div>กำลังโหลดข้อมูล...</div>;

  return (
    <div className="card">
      <h3 className="section-title-icon">💸 บันทึกรายจ่ายสวนยาง</h3>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        บันทึกและติดตามรายจ่ายต่างๆ เช่น ค่าปุ๋ย ค่าถางหญ้า ค่าอุปกรณ์ เจ้าของสวนและคนกรีดสามารถดูร่วมกันได้
      </p>

      {plots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '8px', color: '#94a3b8' }}>
          คุณยังไม่มีแปลงสวน กรุณาเพิ่มแปลงสวนในเมนู "จัดการแปลงสวน" ก่อน
        </div>
      ) : (
        <>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
              <Filter size={16} /> เลือกแปลงสวน
            </label>
            <select 
              className="form-input" 
              value={selectedPlotId}
              onChange={(e) => setSelectedPlotId(e.target.value)}
              style={{ fontWeight: 'bold', color: '#1e293b' }}
            >
              {plots.map(plot => (
                <option key={plot.plot_id} value={plot.plot_id}>
                  {plot.plot_name} {(plot.owner_id !== (currentUser?.user_id || currentUser?.id)) ? '(คุณเป็นคนกรีด)' : '(คุณเป็นเจ้าของ)'}
                </option>
              ))}
            </select>
          </div>

          <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #e48600, #c55d00)', borderRadius: '20px', padding: '1.5rem', marginBottom: '2rem', color: '#fff', boxShadow: '0 10px 20px -5px rgba(217, 119, 6, 0.4)' }}>
            
            {/* Background Watermark */}
            <div style={{ position: 'absolute', right: '5%', top: '-10%', fontSize: '10rem', color: 'rgba(255, 255, 255, 0.08)', fontWeight: 'bold', lineHeight: 1, userSelect: 'none', pointerEvents: 'none', transform: 'rotate(10deg)' }}>
              ฿
            </div>

            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', position: 'relative', zIndex: 1 }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.15)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fde68a' }}></div>
                ยอดรายจ่ายรวมแปลงนี้
              </div>
              <div style={{ fontWeight: 700, opacity: 0.9, fontSize: '1rem', background: 'rgba(255, 255, 255, 0.15)', padding: '4px 12px', borderRadius: '20px' }}>
                {new Date().toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })}
              </div>
            </div>

            {/* Amount */}
            <div style={{ position: 'relative', zIndex: 1, marginBottom: '2rem' }}>
              <div style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-1px' }}>
                <span style={{ fontSize: '2.2rem', marginRight: '4px' }}>฿</span>
                {totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontWeight: 500 }}>
                <span style={{ border: '1px solid rgba(255,255,255,0.6)', borderRadius: '50%', width: '14px', height: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>i</span> 
                รวมค่าใช้จ่ายทั้งหมดในรอบเดือนปัจจุบัน
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '1rem', position: 'relative', zIndex: 1, flexWrap: 'wrap' }}>
              <button 
                onClick={() => !isAdding && setIsAdding(true)} 
                style={{ flex: '1 1 180px', padding: '0.8rem', borderRadius: '12px', background: '#fff', color: '#047857', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 700, fontSize: '1rem', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
              >
                <div style={{ background: '#d1fae5', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                  <Plus size={16} strokeWidth={3} />
                </div>
                เพิ่มรายจ่าย
              </button>
              
              <button 
                onClick={downloadExpensesCSV}
                style={{ flex: '1 1 180px', padding: '0.8rem', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600, fontSize: '1rem', transition: 'all 0.2s', backdropFilter: 'blur(8px)' }}
              >
                <Download size={18} strokeWidth={2.5} style={{ color: '#fff' }} />
                ดาวน์โหลด CSV
              </button>
            </div>
          </div>

          {isAdding && (
            <form onSubmit={handleSave} style={{ marginBottom: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#334155' }}>เพิ่มรายการใหม่</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label><Calendar size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> วันที่</label>
                  <input 
                    type="date" 
                    name="expense_date"
                    className="form-input"
                    value={formData.expense_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label><Tag size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> หมวดหมู่</label>
                  <select 
                    name="category"
                    className="form-input"
                    value={formData.category}
                    onChange={handleInputChange}
                  >
                    {expenseCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label><DollarSign size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> จำนวนเงิน (บาท)</label>
                  <input 
                    type="number" 
                    inputMode="decimal"
                    step="0.01"
                    name="amount"
                    className="form-input"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>รายละเอียดเพิ่มเติม (ถ้ามี)</label>
                  <input 
                    type="text" 
                    name="description"
                    className="form-input"
                    placeholder="เช่น ปุ๋ยสูตร 15-15-15 จำนวน 2 กระสอบ"
                    value={formData.description}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: '#d97706', borderColor: '#d97706' }}>
                  <Check size={16} /> บันทึก
                </button>
                <button type="button" className="btn" onClick={() => setIsAdding(false)} style={{ background: '#e2e8f0', color: '#475569', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  ยกเลิก
                </button>
              </div>
            </form>
          )}

          {/* Charts Section */}
          {expenses.length > 0 && (
            <div style={{ marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
              {/* Category Pie Chart */}
              <div style={{ flex: '1 1 300px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#334155', fontSize: '1rem' }}>สัดส่วนรายจ่ายตามหมวดหมู่</h4>
                <div style={{ width: '100%', height: 250 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `฿${value.toLocaleString()}`} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Trend Bar Chart */}
              <div style={{ flex: '2 1 400px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#334155', fontSize: '1rem' }}>เทรนด์รายจ่ายรายเดือน</h4>
                <div style={{ width: '100%', height: 250 }}>
                  <ResponsiveContainer>
                    <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value) => `฿${value.toLocaleString()}`} cursor={{ fill: '#f1f5f9' }} />
                      <Bar dataKey="รายจ่าย (บาท)" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          <div className="record-list">
            {expenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                ยังไม่มีการบันทึกรายจ่ายสำหรับแปลงนี้
              </div>
            ) : (
              expenses.map((expense, i) => {
                const isMyRecord = expense.recorded_by === (currentUser?.user_id || currentUser?.id);
                return (
                  <div key={expense.expense_id || i} className="record-item" style={{ flexWrap: 'wrap', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ flex: '1 1 200px', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 600 }}>{expense.expense_date ? new Date(expense.expense_date).toLocaleDateString('th-TH') : ''} - {expense.category}</div>
                      {expense.description && <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{expense.description}</div>}
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                        บันทึกโดย: {expense.recorder?.full_name || 'ไม่ทราบชื่อ'} {isMyRecord ? '(คุณ)' : ''}
                      </div>
                    </div>
                    <div style={{ flex: '1 1 100px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#b45309', fontSize: '1.1rem' }}>
                        ฿{parseFloat(expense.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </div>
                      
                      {isMyRecord && (
                        <button 
                          onClick={() => handleDelete(expense.expense_id)} 
                          style={{ marginTop: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', background: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', cursor: 'pointer' }}
                        >
                          <Trash2 size={12} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '2px' }}/> ลบ
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ExpenseManagement;
