import React, { useState, useEffect } from 'react';
import { db } from '../supabase';
import { Trash2, Edit2, Plus, Check } from 'lucide-react';

function FarmManagement({ currentUser }) {
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    plot_name: '',
    my_role: 'owner', // 'owner' or 'tapper'
    partner_phone: '', // Can be tapper_phone or owner_phone
    default_share_ratio: 50
  });

  useEffect(() => {
    loadPlots();
  }, [currentUser]);

  const loadPlots = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const data = await db.getRubberPlots(currentUser.user_id || currentUser.id);
      setPlots(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEdit = (plot) => {
    setEditingId(plot.plot_id);
    const userId = currentUser.user_id || currentUser.id;
    const isOwner = plot.owner_id === userId;
    
    setFormData({
      plot_name: plot.plot_name,
      my_role: isOwner ? 'owner' : 'tapper',
      partner_phone: isOwner ? (plot.tapper_phone || '') : (plot.owner_phone || ''),
      default_share_ratio: plot.default_share_ratio
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ plot_name: '', my_role: 'owner', partner_phone: '', default_share_ratio: 50 });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert('เซสชั่นหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      return;
    }
    try {
      const userId = currentUser.user_id || currentUser.id;
      const isOwner = formData.my_role === 'owner';
      
      const payload = {
        plot_name: formData.plot_name,
        default_share_ratio: parseFloat(formData.default_share_ratio) || 50,
        owner_id: isOwner ? userId : null,
        tapper_id: !isOwner ? userId : null,
        tapper_phone: isOwner ? formData.partner_phone : null,
        owner_phone: !isOwner ? formData.partner_phone : null
      };

      if (editingId) {
        // If editing, merge carefully so we don't accidentally drop the linked ID
        const existingPlot = plots.find(p => p.plot_id === editingId);
        if (existingPlot) {
           if (isOwner) {
             payload.owner_id = userId;
             // Keep existing tapper_id if we didn't change phone, or if they are already linked
             payload.tapper_id = existingPlot.tapper_id; 
           } else {
             payload.tapper_id = userId;
             payload.owner_id = existingPlot.owner_id;
           }
        }
        await db.updateRubberPlot(editingId, payload);
        alert('อัปเดตข้อมูลสวนเรียบร้อยแล้ว');
      } else {
        await db.addRubberPlot(payload);
        alert('เพิ่มแปลงสวนใหม่เรียบร้อยแล้ว');
      }
      handleCancel();
      loadPlots();
    } catch (err) {
      console.error('[FarmManagement] handleSave error:', err);
      const msg = err?.message || err?.details || JSON.stringify(err);
      alert(`ไม่สามารถบันทึกข้อมูลได้\n\nข้อผิดพลาด: ${msg}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('คุณต้องการลบแปลงสวนนี้ใช่หรือไม่? ข้อมูลการขายและรายจ่ายของสวนนี้อาจได้รับผลกระทบ')) return;
    try {
      await db.deleteRubberPlot(id);
      alert('ลบแปลงสวนเรียบร้อย');
      loadPlots();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
  };

  if (loading) return <div>กำลังโหลดข้อมูลแปลงสวน...</div>;

  return (
    <div className="card">
      <h3 className="section-title-icon">🌱 จัดการแปลงสวนยาง</h3>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        เพิ่มแปลงสวนที่คุณเป็น "เจ้าของ" หรือเป็น "คนรับจ้างกรีด" เพื่อรับบิลแบ่งสัดส่วนอัตโนมัติ
      </p>

      <form onSubmit={handleSave} style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h4 style={{ margin: '0 0 1rem 0', color: '#334155' }}>
          {editingId ? '✏️ แก้ไขข้อมูลสวน' : '➕ เพิ่มสวนใหม่'}
        </h4>
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontWeight: 'bold' }}>บทบาทของคุณในสวนนี้</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: formData.my_role === 'owner' ? '#dcfce7' : '#fff', padding: '0.5rem 1rem', borderRadius: '8px', border: formData.my_role === 'owner' ? '2px solid #16a34a' : '1px solid #cbd5e1' }}>
                <input 
                  type="radio" 
                  name="my_role" 
                  value="owner"
                  checked={formData.my_role === 'owner'}
                  onChange={handleInputChange}
                  style={{ width: '1.2rem', height: '1.2rem' }}
                />
                👨‍🌾 ฉันเป็นเจ้าของสวน
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: formData.my_role === 'tapper' ? '#ffedd5' : '#fff', padding: '0.5rem 1rem', borderRadius: '8px', border: formData.my_role === 'tapper' ? '2px solid #ea580c' : '1px solid #cbd5e1' }}>
                <input 
                  type="radio" 
                  name="my_role" 
                  value="tapper"
                  checked={formData.my_role === 'tapper'}
                  onChange={handleInputChange}
                  style={{ width: '1.2rem', height: '1.2rem' }}
                />
                🔪 ฉันเป็นคนรับจ้างกรีด
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>ชื่อสวน</label>
            <input 
              type="text" 
              name="plot_name"
              className="form-input"
              value={formData.plot_name}
              onChange={handleInputChange}
              required
              placeholder="เช่น สวนลุงบุญ, สวนหน้าบ้าน"
            />
          </div>
          
          <div className="form-group">
            <label>{formData.my_role === 'owner' ? 'เบอร์โทรคนกรีด (ถ้ามี)' : 'เบอร์โทรเจ้าของสวน'}</label>
            <input 
              type="tel" 
              name="partner_phone"
              className="form-input"
              value={formData.partner_phone}
              onChange={handleInputChange}
              placeholder="08X-XXX-XXXX"
            />
          </div>
          
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>สัดส่วนแบ่งรายได้ (ส่วนของเจ้าของสวน %)</label>
            <select 
              name="default_share_ratio"
              className="form-input"
              value={formData.default_share_ratio}
              onChange={handleInputChange}
            >
              <option value="50">50% (แบ่งคนละครึ่ง)</option>
              <option value="55">55% (เจ้าของ 55 / คนกรีด 45)</option>
              <option value="60">60% (เจ้าของ 60 / คนกรีด 40)</option>
              <option value="70">70% (เจ้าของ 70 / คนกรีด 30)</option>
              <option value="100">100% (รับเต็มจำนวน ไม่มีคนรับจ้าง)</option>
            </select>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: '#166534', border: 'none' }}>
            {editingId ? <><Check size={16} /> บันทึกการแก้ไข</> : <><Plus size={16} /> เพิ่มแปลงสวน</>}
          </button>
          {editingId && (
            <button type="button" className="btn" onClick={handleCancel} style={{ background: '#e2e8f0', color: '#475569', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              ยกเลิก
            </button>
          )}
        </div>
      </form>

      <div className="farm-list">
        {plots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🧑‍🌾</div>
            <h4 style={{ color: '#0f172a', margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>
              ✅ สถานะปัจจุบัน: ไม่ระบุสวน (รับจ้างอิสระ)
            </h4>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0' }}>
              คุณยังไม่มีแปลงสวนในระบบ หากคุณเป็นคนรับจ้างกรีดทั่วไป สามารถใช้สถานะนี้ในการรับบิลได้เลย<br/>
              (หรือหากต้องการเพิ่มสวนประจำ สามารถทำได้ที่ฟอร์มด้านบน)
            </p>
          </div>
        ) : (
          plots.map(plot => {
            const isMyPlotAsOwner = plot.owner_id === (currentUser?.user_id || currentUser?.id);
            return (
              <div key={plot.plot_id} style={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', 
                border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '0.75rem',
                borderLeft: `5px solid ${isMyPlotAsOwner ? '#16a34a' : '#ea580c'}`
              }}>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {plot.plot_name}
                    <span style={{ 
                      fontSize: '0.7rem', 
                      background: isMyPlotAsOwner ? '#dcfce7' : '#ffedd5', 
                      color: isMyPlotAsOwner ? '#166534' : '#9a3412', 
                      padding: '2px 8px', borderRadius: '12px' 
                    }}>
                      {isMyPlotAsOwner ? '👨‍🌾 เจ้าของสวน' : '🔪 คนรับจ้างกรีด'}
                    </span>
                  </h4>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>
                    <strong>สัดส่วนรายได้:</strong> เจ้าของ {plot.default_share_ratio}% | คนกรีด {100 - plot.default_share_ratio}%
                  </div>
                  {isMyPlotAsOwner && (plot.tapper_phone || plot.tapper?.full_name) && (
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      <strong>คนกรีด:</strong> {plot.tapper?.full_name ? plot.tapper.full_name : ''} {plot.tapper_phone ? `(${plot.tapper_phone})` : ''}
                    </div>
                  )}
                  {!isMyPlotAsOwner && (plot.owner_phone || plot.owner?.full_name) && (
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      <strong>เจ้าของสวน:</strong> {plot.owner?.full_name ? plot.owner.full_name : ''} {plot.owner_phone ? `(${plot.owner_phone})` : ''}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleEdit(plot)} style={{ background: '#f1f5f9', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '0.5rem', borderRadius: '6px' }}>
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(plot.plot_id)} style={{ background: '#fef2f2', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem', borderRadius: '6px' }}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  );
}

export default FarmManagement;
