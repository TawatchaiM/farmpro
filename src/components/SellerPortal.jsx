import React, { useState, useCallback } from 'react';
import ImageUpload from './ImageUpload';
import ReviewForm from './ReviewForm';
import Dashboard from './Dashboard';
import FarmManagement from './FarmManagement';
import { db } from '../supabase';

const scriptURL = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

const mockExtractData = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        date: new Date().toISOString().split('T')[0],
        buyer_name: "ร้านเจ๊น้อย รับซื้อยาง",
        raw_weight_kg: "1250.00",
        drc_percentage: "32.50",
        dry_weight_kg: "406.25",
        price_per_kg: "55.00",
        total_amount_thb: "22343.75",
        owner_share_55_thb: "12289.06",
        note: ""
      });
    }, 2500); 
  });
};

function SellerPortal({ currentUser }) {
  const [activeTab, setActiveTab] = useState('upload'); 
  const [entryMode, setEntryMode] = useState('ai'); // 'ai' or 'manual'
  const [appState, setAppState] = useState('upload'); 
  const [extractedData, setExtractedData] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0); 

  const defaultManualData = {
    date: new Date().toISOString().split('T')[0],
    buyer_name: '',
    raw_weight_kg: '',
    drc_percentage: '',
    dry_weight_kg: '',
    price_per_kg: '',
    total_amount_thb: '',
    owner_share_55_thb: '',
    note: ''
  };

  const handleUpload = async (_file) => {
    setLoadingMessage('AI กำลังอ่านข้อมูลจากบิล...');
    setAppState('loading');
    setEditMode(false);
    setEditId(null);
    
    try {
      const data = await mockExtractData();
      setExtractedData(data);
      setAppState('review');
    } catch (error) {
      console.error("Extraction failed", error);
      setAppState('upload');
    }
  };

  const handleSave = useCallback(async (finalData) => {
    setLoadingMessage('กำลังบันทึกข้อมูลลงระบบ...');
    setAppState('loading');
    
    const isOffline = !window.navigator.onLine;
    
    try {
      const ownerSharePct = parseFloat(finalData.owner_share_percentage) || 55;
      const ownerShareAmt = parseFloat(finalData.owner_share_amount || finalData.owner_share_55_thb) || 0;
      const tapperShareAmt = parseFloat(finalData.tapper_share_amount) || (parseFloat(finalData.total_amount_thb || 0) - ownerShareAmt);

      if (editMode) {
        await db.updateTransaction(editId, {
          buyer_name: finalData.buyer_name || 'ร้านรับซื้อยาง FarmPro',
          date: finalData.date,
          raw_weight_kg: parseFloat(finalData.raw_weight_kg) || 0,
          drc_percentage: parseFloat(finalData.drc_percentage) || 0,
          dry_weight_kg: parseFloat(finalData.dry_weight_kg) || 0,
          price_per_kg: parseFloat(finalData.price_per_kg) || 0,
          total_amount: parseFloat(finalData.total_amount_thb) || 0,
          owner_share_percentage: ownerSharePct,
          owner_share_amount: ownerShareAmt,
          tapper_share_amount: tapperShareAmt,
          note: finalData.note || ''
        }, isOffline);
      } else {
        await db.createTransaction({
          queue_number: 'E-BILL',
          seller_name: 'ชาวสวนยาง',
          buyer_name: finalData.buyer_name || 'ร้านรับซื้อยาง FarmPro',
          date: finalData.date,
          raw_weight_kg: parseFloat(finalData.raw_weight_kg) || 0,
          drc_percentage: parseFloat(finalData.drc_percentage) || 0,
          dry_weight_kg: parseFloat(finalData.dry_weight_kg) || 0,
          price_per_kg: parseFloat(finalData.price_per_kg) || 0,
          total_amount: parseFloat(finalData.total_amount_thb) || 0,
          owner_share_percentage: ownerSharePct,
          owner_share_amount: ownerShareAmt,
          tapper_share_amount: tapperShareAmt,
          note: finalData.note || '',
          status: 'paid' // directly set as paid/completed
        }, isOffline);
      }
      
      setAppState('success');
      setEditMode(false);
      setEditId(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error saving data:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
      setAppState('review');
      return;
    }
    
    setTimeout(() => {
      setAppState('upload');
      setExtractedData(null);
    }, 2500);
  }, [editMode, editId]);

  const handleEdit = (record) => {
    const dataForForm = {
      ...record,
      date: record.date ? record.date.substring(0, 10) : ''
    };
    setExtractedData(dataForForm);
    setEditMode(true);
    setEditId(record.id);
    setActiveTab('upload');
    setAppState('review');
  };

  const handleDelete = useCallback(async (id) => {
    setLoadingMessage('กำลังลบข้อมูลออกจากระบบ...');
    setActiveTab('upload');
    setAppState('loading');
    
    const isOffline = !window.navigator.onLine;
    
    try {
      await db.deleteTransaction(id, isOffline);
      
      setTimeout(() => {
        setAppState('upload');
        setActiveTab('dashboard');
        setRefreshTrigger(prev => prev + 1); 
      }, 1500);
      
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
      setAppState('upload');
      setActiveTab('dashboard');
    }
  }, []);

  return (
    <div>
      <div className="nav-tabs" style={{ marginBottom: '1.25rem' }}>
        <div 
          className={`nav-tab ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => {
            if (editMode) {
              if (window.confirm('คุณกำลังแก้ไขข้อมูลอยู่ ต้องการยกเลิกและบันทึกบิลใหม่ใช่หรือไม่?')) {
                setEditMode(false);
                setEditId(null);
                setAppState('upload');
              } else {
                return;
              }
            }
            setActiveTab('upload');
          }}
        >
          {editMode ? '✏️ แก้ไขข้อมูลบิล' : '📝 บันทึกบิลขายยาง'}
        </div>
        <div 
          className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 แดชบอร์ดสรุปยอด
        </div>
        <div 
          className={`nav-tab ${activeTab === 'farm_management' ? 'active' : ''}`}
          onClick={() => setActiveTab('farm_management')}
        >
          🌳 จัดการสวนของฉัน
        </div>
      </div>

      {activeTab === 'farm_management' ? (
        <FarmManagement currentUser={currentUser} />
      ) : activeTab === 'dashboard' ? (
        <Dashboard 
          key={refreshTrigger}
          scriptURL={scriptURL} 
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ) : (
        <>
          {appState === 'upload' && !editMode && (
            <div>
              {/* Option Selector Pill Tabs - High Contrast Accessible Design */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setEntryMode('ai')}
                  style={{
                    flex: 1,
                    padding: '0.85rem 1rem',
                    borderRadius: '12px',
                    border: entryMode === 'ai' ? '2px solid #166534' : '1.5px solid #cbd5e1',
                    background: entryMode === 'ai' ? '#15803d' : '#ffffff',
                    color: entryMode === 'ai' ? '#ffffff' : '#0f172a',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '0.925rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: entryMode === 'ai' ? '0 4px 12px rgba(21, 128, 61, 0.3)' : '0 2px 4px rgba(0,0,0,0.03)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>📸 ถ่ายรูป / อัปโหลดบิล (สแกนด้วย AI)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEntryMode('manual')}
                  style={{
                    flex: 1,
                    padding: '0.85rem 1rem',
                    borderRadius: '12px',
                    border: entryMode === 'manual' ? '2px solid #166534' : '1.5px solid #cbd5e1',
                    background: entryMode === 'manual' ? '#15803d' : '#ffffff',
                    color: entryMode === 'manual' ? '#ffffff' : '#0f172a',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '0.925rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: entryMode === 'manual' ? '0 4px 12px rgba(21, 128, 61, 0.3)' : '0 2px 4px rgba(0,0,0,0.03)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>✍️ พิมพ์กรอกข้อมูลบิลด้วยตนเอง (Manual)</span>
                </button>
              </div>

              {entryMode === 'ai' ? (
                <ImageUpload onUpload={handleUpload} />
              ) : (
                <ReviewForm 
                  initialData={defaultManualData} 
                  onSave={handleSave} 
                  isManual={true}
                  onCancel={() => setEntryMode('ai')}
                />
              )}
            </div>
          )}

          {appState === 'loading' && (
            <div className="card loading-overlay">
              <div className="spinner"></div>
              <div className="loading-text">{loadingMessage}</div>
              <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>โปรดรอสักครู่</p>
            </div>
          )}

          {appState === 'review' && extractedData && (
            <ReviewForm 
              initialData={extractedData} 
              onSave={handleSave} 
              isEdit={editMode}
              onCancel={() => {
                setAppState('upload');
                if (editMode) setActiveTab('dashboard');
                setEditMode(false);
                setEditId(null);
              }}
            />
          )}

          {appState === 'success' && (
            <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
              <h2 style={{ color: 'var(--primary-dark)', marginBottom: '1rem' }}>{editMode ? 'อัปเดตข้อมูลสำเร็จ!' : 'บันทึกสำเร็จ!'}</h2>
              <p style={{ color: 'var(--text-muted)' }}>ข้อมูลถูกส่งเข้าระบบเรียบร้อยแล้ว</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SellerPortal;
