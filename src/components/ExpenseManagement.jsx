import React, { useState, useEffect } from 'react';
import { db } from '../supabase';
import { Trash2, Plus, Calendar, DollarSign, Tag, Check, Filter } from 'lucide-react';

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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: '#fffbeb', padding: '1rem', borderRadius: '8px', border: '1px solid #fde68a' }}>
            <div>
              <span style={{ fontSize: '0.875rem', color: '#b45309' }}>ยอดรายจ่ายรวมแปลงนี้</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#92400e' }}>฿{totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            </div>
            {!isAdding && (
              <button onClick={() => setIsAdding(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#d97706', borderColor: '#d97706' }}>
                <Plus size={16} /> เพิ่มรายจ่าย
              </button>
            )}
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
