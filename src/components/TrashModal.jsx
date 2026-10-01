import React, { useState, useEffect } from 'react';
import { db } from '../supabase';
import { Trash2, RefreshCw, X, AlertTriangle } from 'lucide-react';

function TrashModal({ isOpen, onClose, viewRole, onRestored }) {
  const [trashedTransactions, setTrashedTransactions] = useState([]);
  const [trashedExpenses, setTrashedExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const [txs, exps] = await Promise.all([
        db.getTrashedTransactions(),
        db.getTrashedPlotExpenses()
      ]);
      setTrashedTransactions(txs || []);
      setTrashedExpenses(exps || []);
    } catch (error) {
      console.error('Error fetching trash:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTrash();
    }
  }, [isOpen]);

  const handleRestoreTransaction = async (id) => {
    if (window.confirm('คุณต้องการกู้คืนรายการนี้ใช่หรือไม่?')) {
      await db.restoreTransaction(id);
      fetchTrash();
      if (onRestored) onRestored();
    }
  };

  const handleHardDeleteTransaction = async (id) => {
    if (window.confirm('คุณต้องการลบรายการนี้ถาวรใช่หรือไม่? (ลบแล้วไม่สามารถกู้คืนได้)')) {
      await db.hardDeleteTransaction(id);
      fetchTrash();
    }
  };

  const handleRestoreExpense = async (id) => {
    if (window.confirm('คุณต้องการกู้คืนรายจ่ายนี้ใช่หรือไม่?')) {
      await db.restorePlotExpense(id);
      fetchTrash();
      if (onRestored) onRestored();
    }
  };

  const handleHardDeleteExpense = async (id) => {
    if (window.confirm('คุณต้องการลบรายจ่ายนี้ถาวรใช่หรือไม่? (ลบแล้วไม่สามารถกู้คืนได้)')) {
      await db.hardDeletePlotExpense(id);
      fetchTrash();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '800px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
            <Trash2 size={24} color="#ef4444" />
            ถังขยะ (รายการที่ถูกลบ)
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ padding: '1rem', background: '#fffbeb', color: '#b45309', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={16} />
          <span>รายการในถังขยะสามารถกู้คืนได้ภายใน 30 วัน หลังจากนั้นจะถูกลบถาวรโดยอัตโนมัติ</span>
        </div>

        <div style={{ overflowY: 'auto', padding: '1.5rem', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>กำลังโหลดข้อมูล...</div>
          ) : (
            <>
              <h3 style={{ marginTop: 0, color: '#334155', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>รายรับ/การขายยาง</h3>
              {trashedTransactions.length > 0 ? (
                <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
                  {trashedTransactions.map(tx => (
                    <div key={tx.id} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{tx.date} - {tx.buyer_name || tx.seller_name}</div>
                        <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                          ลบเมื่อ: {new Date(tx.deleted_at).toLocaleString('th-TH')}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#ef4444', fontWeight: 600 }}>
                          ฿{parseFloat(tx.total_amount || 0).toLocaleString()} ({tx.dry_weight_kg || 0} กก.)
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleRestoreTransaction(tx.id)} style={{ padding: '0.5rem 1rem', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <RefreshCw size={16} /> กู้คืน
                        </button>
                        <button onClick={() => handleHardDeleteTransaction(tx.id)} style={{ padding: '0.5rem 1rem', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <Trash2 size={16} /> ลบถาวร
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '2rem' }}>ไม่มีรายการขายยางในถังขยะ</p>
              )}

              {viewRole === 'owner' && (
                <>
                  <h3 style={{ marginTop: 0, color: '#334155', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>รายจ่าย</h3>
                  {trashedExpenses.length > 0 ? (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {trashedExpenses.map(exp => (
                        <div key={exp.expense_id} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{exp.expense_date} - {exp.category}</div>
                            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                              ลบเมื่อ: {new Date(exp.deleted_at).toLocaleString('th-TH')}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: '#ef4444', fontWeight: 600 }}>
                              ฿{parseFloat(exp.amount || 0).toLocaleString()} - {exp.description}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => handleRestoreExpense(exp.expense_id)} style={{ padding: '0.5rem 1rem', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                              <RefreshCw size={16} /> กู้คืน
                            </button>
                            <button onClick={() => handleHardDeleteExpense(exp.expense_id)} style={{ padding: '0.5rem 1rem', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                              <Trash2 size={16} /> ลบถาวร
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>ไม่มีรายการจ่ายในถังขยะ</p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default TrashModal;
