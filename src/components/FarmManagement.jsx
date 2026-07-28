import React, { useState, useEffect } from 'react';
import { db } from '../supabase';
import { Trash2, Edit2, Plus, Check } from 'lucide-react';

function FarmManagement({ currentUser }) {
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    farm_name: '',
    owner_name: '',
    owner_share_percent: 50,
    is_default: false
  });

  useEffect(() => {
    loadFarms();
  }, [currentUser]);

  const loadFarms = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const data = await db.getUserFarms(currentUser.id);
      setFarms(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleEdit = (farm) => {
    setEditingId(farm.id);
    setFormData({
      farm_name: farm.farm_name,
      owner_name: farm.owner_name,
      owner_share_percent: farm.owner_share_percent,
      is_default: farm.is_default
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ farm_name: '', owner_name: '', owner_share_percent: 50, is_default: false });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await db.updateUserFarm(editingId, { ...formData, user_id: currentUser.id });
        alert('แก้ไขข้อมูลสวนเรียบร้อย');
      } else {
        await db.addUserFarm({ ...formData, user_id: currentUser.id });
        alert('เพิ่มข้อมูลสวนใหม่เรียบร้อย');
      }
      handleCancel();
      loadFarms();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('คุณต้องการลบข้อมูลสวนนี้ใช่หรือไม่?')) return;
    try {
      await db.deleteUserFarm(id);
      alert('ลบข้อมูลสวนเรียบร้อย');
      loadFarms();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
  };

  if (loading) return <div>กำลังโหลดข้อมูลสวน...</div>;

  return (
    <div className="card">
      <h3 className="section-title-icon">🌳 จัดการข้อมูลสวนยาง</h3>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        เพิ่มข้อมูลสวนยางที่คุณรับจ้างกรีด เพื่อความสะดวกในการแบ่งเปอร์เซ็นต์และรับบิลจากจุดรับซื้อ
      </p>

      <form onSubmit={handleSave} style={{ marginBottom: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h4 style={{ margin: '0 0 1rem 0', color: '#334155' }}>
          {editingId ? 'แก้ไขข้อมูลสวน' : 'เพิ่มสวนใหม่'}
        </h4>
        <div className="form-grid">
          <div className="form-group">
            <label>ชื่อสวน (เช่น สวนลุงบุญ)</label>
            <input 
              type="text" 
              name="farm_name"
              className="form-input"
              value={formData.farm_name}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="form-group">
            <label>ชื่อเจ้าของสวน (ชื่อที่ต้องการให้ระบุในบิล)</label>
            <input 
              type="text" 
              name="owner_name"
              className="form-input"
              value={formData.owner_name}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="form-group">
            <label>สัดส่วนเจ้าของสวน (%)</label>
            <select 
              name="owner_share_percent"
              className="form-input"
              value={formData.owner_share_percent}
              onChange={handleInputChange}
            >
              <option value="50">50% (แบ่งคนละครึ่ง)</option>
              <option value="55">55% (เจ้าของ 55 / คนกรีด 45)</option>
              <option value="60">60% (เจ้าของ 60 / คนกรีด 40)</option>
              <option value="70">70% (เจ้าของ 70 / คนกรีด 30)</option>
              <option value="100">100% (เจ้าของกรีดเอง)</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <input 
            type="checkbox" 
            id="is_default"
            name="is_default"
            checked={formData.is_default}
            onChange={handleInputChange}
          />
          <label htmlFor="is_default" style={{ margin: 0, fontWeight: 'normal' }}>ตั้งเป็นสวนหลัก (ถ้ามี)</label>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            {editingId ? <><Check size={16} /> บันทึกการแก้ไข</> : <><Plus size={16} /> เพิ่มสวนใหม่</>}
          </button>
          {editingId && (
            <button type="button" className="btn" onClick={handleCancel} style={{ background: '#e2e8f0', color: '#475569', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              ยกเลิก
            </button>
          )}
        </div>
      </form>

      <div className="farm-list">
        {farms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
            ยังไม่มีข้อมูลสวนยาง
          </div>
        ) : (
          farms.map(farm => (
            <div key={farm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '0.75rem' }}>
              <div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#1e293b' }}>
                  {farm.farm_name} {farm.is_default && <span style={{ fontSize: '0.7rem', background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', marginLeft: '0.5rem' }}>ค่าเริ่มต้น</span>}
                </h4>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  เจ้าของ: {farm.owner_name} | หักให้เจ้าของ: {farm.owner_share_percent}%
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => handleEdit(farm)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '0.25rem' }}>
                  <Edit2 size={18} />
                </button>
                <button onClick={() => handleDelete(farm.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default FarmManagement;
