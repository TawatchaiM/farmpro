import React, { useState, useEffect } from 'react';
import { db } from '../supabase';

function AdminPortal() {
  const [activeTab, setActiveTab] = useState('approvals');
  const [filterStatus, setFilterStatus] = useState('pending'); // 'pending', 'approved', 'rejected', 'all'
  const [searchTerm, setSearchTerm] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [profRes, txRes] = await Promise.all([
        db.getProfiles(),
        db.getTransactions()
      ]);

      if (profRes && profRes.data) {
        setProfiles(profRes.data);
      }
      if (txRes && txRes.data) {
        setTransactions(txRes.data);
      }
    } catch (err) {
      console.error('Error loading admin portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAction = async (id, newStatus, name) => {
    try {
      await db.updateProfileStatus(id, newStatus);
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
      
      const actionText = newStatus === 'approved' ? 'อนุมัติ (เขียว)' : newStatus === 'rejected' ? 'ปฏิเสธ (แดง)' : 'ปรับเป็นรออนุมัติ (เหลือง)';
      setNotification(`ดำเนินการ ${actionText} ผู้ใช้งาน "${name}" เรียบร้อยแล้ว`);
      setTimeout(() => setNotification(''), 4000);
    } catch (err) {
      console.error('Error updating status:', err);
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    }
  };

  // Calculations for dashboard
  const totalProfiles = profiles.length;
  const pendingCount = profiles.filter(p => p.status === 'pending').length;
  const approvedCount = profiles.filter(p => p.status === 'approved').length;
  const rejectedCount = profiles.filter(p => p.status === 'rejected').length;

  const buyersCount = profiles.filter(p => p.role === 'buyer').length;
  const sellersCount = profiles.filter(p => p.role === 'seller').length;
  const vendorsCount = profiles.filter(p => p.role === 'vendor').length;

  const totalTxCount = transactions.length;
  const totalVolumeAmount = transactions.reduce((sum, t) => sum + (parseFloat(t.total_amount) || 0), 0);

  // Filtered profiles for approvals tab
  const filteredProfiles = profiles.filter(p => {
    const pStatus = p.status || 'pending';
    if (filterStatus !== 'all' && pStatus !== filterStatus) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const nameMatch = (p.full_name || '').toLowerCase().includes(q) || (p.store_name || '').toLowerCase().includes(q);
      const phoneMatch = (p.phone_number || '').includes(q);
      const locMatch = (p.province || '').toLowerCase().includes(q) || (p.district || '').toLowerCase().includes(q) || (p.subdistrict || '').toLowerCase().includes(q);
      return nameMatch || phoneMatch || locMatch;
    }
    return true;
  });

  const getRoleBadge = (role) => {
    switch (role) {
      case 'buyer':
        return <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>🏢 ลานรับซื้อยาง</span>;
      case 'vendor':
        return <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>🚜 ร้านค้า / บริการ</span>;
      case 'seller':
        return <span style={{ background: '#e0f2fe', color: '#075985', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>🧑‍🌾 ชาวสวนยาง</span>;
      default:
        return <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem' }}>ผู้ลงทะเบียน</span>;
    }
  };

  // Traffic Light Status Badges (เหลือง 🟡 -> เขียว 🟢 -> แดง 🔴)
  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span style={{
            background: '#dcfce7',
            color: '#14532d',
            padding: '5px 12px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            border: '1px solid #86efac',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            boxShadow: '0 2px 6px rgba(34, 197, 94, 0.15)'
          }}>
            🟢 ✓ อนุมัติแล้ว
          </span>
        );
      case 'rejected':
        return (
          <span style={{
            background: '#fee2e2',
            color: '#991b1b',
            padding: '5px 12px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            border: '1px solid #fca5a5',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.15)'
          }}>
            🔴 ✕ ปฏิเสธแล้ว
          </span>
        );
      default:
        return (
          <span style={{
            background: '#fef3c7',
            color: '#92400e',
            padding: '5px 12px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            border: '1px solid #fde68a',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            boxShadow: '0 2px 6px rgba(245, 158, 11, 0.15)'
          }}>
            🟡 ⏳ รอการอนุมัติ
          </span>
        );
    }
  };

  return (
    <div className="card" style={{ borderTop: '4px solid #0f766e', boxShadow: '0 10px 25px rgba(0,0,0,0.04)' }}>
      {/* Header */}
      <div className="header" style={{ textAlign: 'left', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#1e293b', fontSize: '1.5rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
            <span style={{ background: 'linear-gradient(135deg, #0f766e, #0d9488)', padding: '0.4rem 0.6rem', borderRadius: '10px', color: '#fff', fontSize: '1.1rem' }}>🛡️</span>
            ระบบจัดการหลังบ้าน (Admin Portal)
          </h2>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.875rem' }}>ศูนย์ดูแลระบบฟาร์มโปร ตรวจสอบผู้ลงทะเบียน และอนุมัติสถานะสิทธิ์การใช้งาน</p>
        </div>
        <button 
          onClick={loadData}
          style={{
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            color: '#475569',
            padding: '0.45rem 0.95rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.825rem',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
          onMouseEnter={(e) => { e.target.style.background = '#e2e8f0'; e.target.style.color = '#1e293b'; }}
          onMouseLeave={(e) => { e.target.style.background = '#f1f5f9'; e.target.style.color = '#475569'; }}
        >
          🔄 รีเฟรชข้อมูล
        </button>
      </div>

      {notification && (
        <div style={{
          background: '#dcfce7',
          border: '1px solid #86efac',
          color: '#166534',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          marginBottom: '1.25rem',
          fontWeight: '500',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          ✅ {notification}
        </div>
      )}

      {/* Tabs Header - Eye Pleasing Soft Palette */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('approvals')}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            fontSize: '0.925rem',
            fontWeight: 'bold',
            border: activeTab === 'approvals' ? 'none' : '1px solid #e2e8f0',
            background: activeTab === 'approvals' ? 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)' : '#f8fafc',
            color: activeTab === 'approvals' ? '#ffffff' : '#64748b',
            boxShadow: activeTab === 'approvals' ? '0 4px 12px rgba(15, 118, 110, 0.25)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          📝 ตรวจสอบ & อนุมัติผู้ลงทะเบียน ({pendingCount > 0 ? `${pendingCount} รายรออนุมัติ` : 'เรียบร้อยทั้งหมด'})
        </button>
        <button 
          onClick={() => setActiveTab('dashboard')}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            fontSize: '0.925rem',
            fontWeight: 'bold',
            border: activeTab === 'dashboard' ? 'none' : '1px solid #e2e8f0',
            background: activeTab === 'dashboard' ? 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)' : '#f8fafc',
            color: activeTab === 'dashboard' ? '#ffffff' : '#64748b',
            boxShadow: activeTab === 'dashboard' ? '0 4px 12px rgba(15, 118, 110, 0.25)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          📊 ภาพรวมระบบ & สถิติ
        </button>
      </div>

      {/* TAB 1: APPROVALS & USER PROFILES */}
      {activeTab === 'approvals' && (
        <div>
          {/* Traffic Light Status Filter Pills (เหลือง 🟡 - เขียว 🟢 - แดง 🔴 - เทา ⚪) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {/* Yellow Traffic Light Filter Button */}
              <button
                onClick={() => setFilterStatus('pending')}
                style={{
                  padding: '0.45rem 0.95rem',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  border: filterStatus === 'pending' ? '1px solid #d97706' : '1px solid #fde68a',
                  background: filterStatus === 'pending' ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' : '#fff',
                  color: filterStatus === 'pending' ? '#ffffff' : '#b45309',
                  fontWeight: filterStatus === 'pending' ? 'bold' : '600',
                  boxShadow: filterStatus === 'pending' ? '0 3px 10px rgba(217, 119, 6, 0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                🟡 รออนุมัติ ({pendingCount})
              </button>

              {/* Green Traffic Light Filter Button */}
              <button
                onClick={() => setFilterStatus('approved')}
                style={{
                  padding: '0.45rem 0.95rem',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  border: filterStatus === 'approved' ? '1px solid #16a34a' : '1px solid #86efac',
                  background: filterStatus === 'approved' ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' : '#fff',
                  color: filterStatus === 'approved' ? '#ffffff' : '#15803d',
                  fontWeight: filterStatus === 'approved' ? 'bold' : '600',
                  boxShadow: filterStatus === 'approved' ? '0 3px 10px rgba(22, 163, 74, 0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                🟢 อนุมัติแล้ว ({approvedCount})
              </button>

              {/* Red Traffic Light Filter Button */}
              <button
                onClick={() => setFilterStatus('rejected')}
                style={{
                  padding: '0.45rem 0.95rem',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  border: filterStatus === 'rejected' ? '1px solid #dc2626' : '1px solid #fca5a5',
                  background: filterStatus === 'rejected' ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' : '#fff',
                  color: filterStatus === 'rejected' ? '#ffffff' : '#b91c1c',
                  fontWeight: filterStatus === 'rejected' ? 'bold' : '600',
                  boxShadow: filterStatus === 'rejected' ? '0 3px 10px rgba(220, 38, 38, 0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                🔴 ปฏิเสธ ({rejectedCount})
              </button>

              {/* Slate Gray Filter Button */}
              <button
                onClick={() => setFilterStatus('all')}
                style={{
                  padding: '0.45rem 0.95rem',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  border: filterStatus === 'all' ? '1px solid #475569' : '1px solid #cbd5e1',
                  background: filterStatus === 'all' ? 'linear-gradient(135deg, #475569 0%, #334155 100%)' : '#fff',
                  color: filterStatus === 'all' ? '#ffffff' : '#475569',
                  fontWeight: filterStatus === 'all' ? 'bold' : '600',
                  transition: 'all 0.15s ease'
                }}
              >
                ⚪ ทั้งหมด ({totalProfiles})
              </button>
            </div>

            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="🔍 พิมพ์ค้นหาชื่อ, เบอร์โทร, จังหวัด..."
              style={{
                padding: '0.5rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                minWidth: '240px',
                outline: 'none'
              }}
            />
          </div>

          {/* Profile Cards List */}
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              ⏳ กำลังโหลดรายการผู้ลงทะเบียน...
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', color: '#64748b', border: '1px dashed #cbd5e1' }}>
              📭 ไม่พบรายการผู้ลงทะเบียนตามเงื่อนไขที่เลือก
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredProfiles.map(store => {
                const displayName = store.store_name 
                  ? `${store.store_name} (${store.full_name})`
                  : store.full_name;

                const locationStr = [
                  store.address_details,
                  store.subdistrict ? `ต.${store.subdistrict}` : '',
                  store.district ? `อ.${store.district}` : '',
                  store.province ? `จ.${store.province}` : '',
                  store.postal_code ? `(${store.postal_code})` : ''
                ].filter(Boolean).join(' ');

                const currentStatus = store.status || 'pending';

                return (
                  <div key={store.id} className="record-item" style={{ flexDirection: 'column', alignItems: 'stretch', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                          {getRoleBadge(store.role)}
                          <h4 style={{ fontSize: '1.15rem', fontWeight: 'bold', margin: 0, color: '#1e293b' }}>
                            {displayName}
                          </h4>
                        </div>
                        <div style={{ color: '#475569', fontSize: '0.9rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                          <span>📞 <strong>{store.phone_number || 'ไม่ระบุเบอร์โทร'}</strong></span>
                          <span>📍 {locationStr || 'ไม่ระบุที่อยู่'}</span>
                        </div>
                      </div>
                      <div>
                        {getStatusBadge(currentStatus)}
                      </div>
                    </div>

                    {/* Extra details if available */}
                    <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#475569', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {store.business_hours && (
                        <div>⏰ <strong>เวลาทำการ:</strong> {store.business_hours}</div>
                      )}
                      {store.rubber_types && (
                        <div>🌱 <strong>ประเภทน้ำยาง/ยางที่รับซื้อ:</strong> {store.rubber_types}</div>
                      )}
                      {store.vendor_category && (
                        <div>📦 <strong>หมวดหมู่บริการ:</strong> {store.vendor_category} {store.vendor_description ? `- ${store.vendor_description}` : ''}</div>
                      )}
                      {store.created_at && (
                        <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                          📅 วันที่ลงทะเบียน: {new Date(store.created_at).toLocaleString('th-TH')}
                        </div>
                      )}
                    </div>

                    {/* Traffic Light Action Buttons */}
                    <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {/* Red Stop Light Button for Reject */}
                      {currentStatus !== 'rejected' && (
                        <button 
                          onClick={() => handleAction(store.id, 'rejected', displayName)} 
                          style={{
                            margin: 0,
                            padding: '0.45rem 1rem',
                            background: '#fff',
                            border: '1px solid #fca5a5',
                            color: '#dc2626',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => { e.target.style.background = '#fef2f2'; }}
                          onMouseLeave={(e) => { e.target.style.background = '#fff'; }}
                        >
                          🔴 ✕ ปฏิเสธ (Reject)
                        </button>
                      )}

                      {/* Green Go Light Button for Approve */}
                      {currentStatus !== 'approved' && (
                        <button 
                          onClick={() => handleAction(store.id, 'approved', displayName)} 
                          style={{
                            margin: 0,
                            padding: '0.45rem 1.15rem',
                            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            boxShadow: '0 3px 8px rgba(22, 163, 74, 0.3)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          🟢 ✓ อนุมัติ (Approve)
                        </button>
                      )}

                      {/* Yellow Caution Light Button for Revert to Pending */}
                      {currentStatus !== 'pending' && (
                        <button 
                          onClick={() => handleAction(store.id, 'pending', displayName)} 
                          style={{
                            margin: 0,
                            padding: '0.45rem 0.85rem',
                            background: '#fff',
                            border: '1px solid #fde68a',
                            color: '#b45309',
                            borderRadius: '8px',
                            fontSize: '0.825rem',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => { e.target.style.background = '#fef3c7'; }}
                          onMouseLeave={(e) => { e.target.style.background = '#fff'; }}
                        >
                          🟡 🔄 ปรับเป็นรออนุมัติ
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DASHBOARD STATS */}
      {activeTab === 'dashboard' && (
        <div>
          <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card" style={{ background: '#f0fdfa', border: '1px solid #99f6e4' }}>
              <div className="stat-title">จำนวนสมาชิกทั้งหมด (Registered)</div>
              <div className="stat-value" style={{ color: '#0f766e' }}>{totalProfiles} ราย</div>
              <div style={{ fontSize: '0.8rem', color: '#115e59', marginTop: '0.35rem' }}>
                🟡 รออนุมัติ {pendingCount} | 🟢 อนุมัติแล้ว {approvedCount}
              </div>
            </div>

            <div className="stat-card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div className="stat-title">จำนวนบิลทั้งหมด (Platform)</div>
              <div className="stat-value" style={{ color: '#16a34a' }}>{totalTxCount.toLocaleString()} ใบ</div>
              <div style={{ fontSize: '0.8rem', color: '#166534', marginTop: '0.35rem' }}>
                บันทึกจริงผ่านระบบ FarmPro
              </div>
            </div>

            <div className="stat-card" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div className="stat-title">มูลค่าการซื้อขายรวม (บาท)</div>
              <div className="stat-value" style={{ color: '#2563eb' }}>
                {totalVolumeAmount >= 1000000 
                  ? `${(totalVolumeAmount / 1000000).toFixed(2)}M ฿`
                  : `${totalVolumeAmount.toLocaleString()} ฿`
                }
              </div>
              <div style={{ fontSize: '0.8rem', color: '#1e40af', marginTop: '0.35rem' }}>
                คำนวณจากทุกบิลรายการ
              </div>
            </div>
          </div>

          {/* Role Breakdown */}
          <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1e293b' }}>
              👥 สัดส่วนผู้ลงทะเบียนตามประเภทบทบาท
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div style={{ background: '#fff', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>🏢 ลานรับซื้อยาง (Buyers)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#166534', marginTop: '0.2rem' }}>{buyersCount} ร้าน</div>
              </div>
              <div style={{ background: '#fff', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>🧑‍🌾 ชาวสวนยาง (Sellers)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#075985', marginTop: '0.2rem' }}>{sellersCount} ราย</div>
              </div>
              <div style={{ background: '#fff', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>🚜 ร้านค้า/บริการ (Vendors)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#92400e', marginTop: '0.2rem' }}>{vendorsCount} ร้าน</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPortal;
