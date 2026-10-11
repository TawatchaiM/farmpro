import React, { useState, useEffect, useCallback } from 'react';
import { Scale, Truck, DollarSign, TrendingUp, Settings, Beaker, FileText, BarChart3, Home } from 'lucide-react';
import StoreRegistration from './StoreRegistration';
import ManualBillForm from './ManualBillForm';
import ClerkPortal from './ClerkPortal';
import DrcPortal from './DrcPortal';
import DashboardPortal from './DashboardPortal';
import RubberSalesManagement from './RubberSalesManagement';
import ShopExpensesManagement from './ShopExpensesManagement';
import ProfitLossDashboard from './ProfitLossDashboard';
import OfflineStatusBar from './OfflineStatusBar';
import { db, isMock } from '../supabase';
import { playNotificationSound } from '../utils/audioAlert';
import useSubscription from '../hooks/useSubscription';
import './OperationalWorkflow.css';

function BuyerPortal({ currentUser, onUpdateProfile }) {
  const sub = useSubscription(currentUser);
  // Main 5 navigation tabs: 'buy', 'sales', 'expenses', 'pnl', 'settings'
  const [activeMainTab, setActiveMainTab] = useState('buy');

  // Sub-tab inside [⚖️ รับซื้อยาง]: 'clerk', 'drc', 'manual', 'history'
  const initialBuySubTab = currentUser?.role === 'DRC_LAB' ? 'drc' : 'clerk';
  const [buySubTab, setBuySubTab] = useState(initialBuySubTab);

  const [dailySettings, setDailySettings] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toastAlert, setToastAlert] = useState(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const triggerToast = useCallback((msg, soundType = 'new_queue') => {
    setToastAlert(msg);
    playNotificationSound(soundType);
    setTimeout(() => {
      setToastAlert(prev => prev === msg ? null : prev);
    }, 4500);
  }, []);

  // Helper to fetch pending offline sync queue count safely
  const updatePendingCount = useCallback(() => {
    try {
      const pendingSync = JSON.parse(localStorage.getItem('farmpro_pending_sync') || '[]');
      setPendingCount(Array.isArray(pendingSync) ? pendingSync.length : 0);
    } catch (err) {
      console.error('Error reading sync queue count:', err);
      setPendingCount(0);
    }
  }, []);

  // Sync active tab if role changes
  useEffect(() => {
    if (currentUser?.role === 'DRC_LAB') {
      setActiveMainTab('buy');
      setBuySubTab('drc');
    } else if (currentUser?.role === 'CLERK') {
      setActiveMainTab('buy');
      setBuySubTab('clerk');
    }
  }, [currentUser?.role]);

  // Initial load
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      updatePendingCount();

      // 1. Fetch settings for today
      const settings = await db.getDailySettings(todayStr);
      setDailySettings(settings);

      // 2. Fetch transactions for today
      const txList = await db.getTransactions(todayStr, currentUser?.id);
      setTransactions(Array.isArray(txList) ? txList : []);
    } catch (err) {
      console.error('Failed to load portal data:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [todayStr, currentUser?.id, updatePendingCount]);

  useEffect(() => {
    loadData();
    
    // Supabase Realtime & Multi-Device Subscription
    const unsubscribe = db.subscribeToTransactions(async (payload) => {
      const txList = await db.getTransactions(todayStr, currentUser?.id);
      setTransactions(txList);
      updatePendingCount();

      if (payload) {
        const newRecord = payload.new || payload.record;
        if (payload.eventType === 'INSERT' && newRecord) {
          triggerToast(`📥 [คิวใหม่] เสมียนบันทึกคิว ${newRecord.queue_number || ''} (${newRecord.seller_name || ''}) ส่งเข้าห้องตรวจ DRC`, 'new_queue');
        } else if (payload.eventType === 'UPDATE' && newRecord) {
          if (newRecord.status === 'ready_to_pay' || newRecord.status === 'READY_TO_PAY') {
            triggerToast(`🧪 [DRC อนุมัติแล้ว] คิว ${newRecord.queue_number || ''} ตรวจเสร็จสิ้น (${parseFloat(newRecord.drc_percentage || 0).toFixed(2)}%) ย้ายไปคิวรอจ่ายเงิน`, 'drc_done');
          } else if (newRecord.status === 'in_drc_testing' || newRecord.status === 'IN_DRC_TESTING') {
            triggerToast(`🔒 คิว ${newRecord.queue_number || ''} กำลังอยู่ระหว่างตรวจโดย ${newRecord.testing_by || 'ห้องแล็บ DRC'}`, 'lock');
          }
        }
      }
    });

    const interval = setInterval(updatePendingCount, 5000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [loadData, todayStr, currentUser?.id, updatePendingCount, triggerToast]);

  // Save Settings handler
  const handleSaveSettings = useCallback(async (settings) => {
    const saved = await db.saveDailySettings(settings);
    setDailySettings(saved);
    const txList = await db.getTransactions(todayStr, currentUser?.id);
    setTransactions(txList);
  }, [todayStr, currentUser?.id]);

  // Create transaction handler
  const handleCreateTransaction = useCallback(async (tx) => {
    // Quota check for Starter Free (150 bills / month)
    if (sub.isBuyer && sub.isFree) {
      try {
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const todayStrLocal = now.toISOString().split('T')[0];
        const monthlyTxs = await db.getTransactionsHistory(thisMonthStart, todayStrLocal, currentUser?.id);
        const monthlyCount = (monthlyTxs || []).length;
        const quotaCheck = sub.checkBillQuota(monthlyCount);
        if (!quotaCheck.allowed) {
          triggerToast(`⚠️ ${quotaCheck.message}`, 'error');
          alert(`⚠️ ไม่สามารถออกบิลใหม่ได้\n\n${quotaCheck.message}`);
          return null;
        }
      } catch (err) {
        console.warn('Quota check fallback:', err);
      }
    }

    const isOffline = !window.navigator.onLine;
    const created = await db.createTransaction({
      ...tx,
      buyer_id: currentUser?.id || tx.buyer_id
    }, isOffline);
    
    // Refresh list from cache
    const txList = await db.getTransactions(todayStr, currentUser?.id);
    setTransactions(txList);
    updatePendingCount();
    return created;
  }, [todayStr, currentUser?.id, updatePendingCount, sub]);

  // Update transaction handler
  const handleUpdateTransaction = useCallback(async (id, updates) => {
    const isOffline = !window.navigator.onLine;
    const updated = await db.updateTransaction(id, updates, isOffline);

    // Refresh list from cache
    const txList = await db.getTransactions(todayStr, currentUser?.id);
    setTransactions(txList);
    updatePendingCount();
    return updated;
  }, [todayStr, currentUser?.id, updatePendingCount]);

  // Sync Offline Queue handler
  const handleSync = useCallback(async () => {
    if (isMock) return;
    try {
      const result = await db.syncOfflineData();
      if (result.success) {
        console.log(`Sync completed successfully. Synced ${result.count} items.`);
      } else {
        console.warn(`Sync partially successful. Synced ${result.count} items. ${result.remaining} remaining.`);
      }
      
      // Reload fresh data from database
      const settings = await db.getDailySettings(todayStr);
      setDailySettings(settings);
      const txList = await db.getTransactions(todayStr, currentUser?.id);
      setTransactions(txList);
      
      updatePendingCount();
    } catch (err) {
      console.error('Offline sync failed:', err);
    }
  }, [todayStr, currentUser?.id, updatePendingCount]);

  if (loading) {
    return (
      <div className="loading-overlay" style={{ minHeight: '400px' }}>
        <div className="spinner"></div>
        <div className="loading-text">กำลังดึงข้อมูลสถานีรับซื้อยาง...</div>
      </div>
    );
  }

  const isSubAccount = currentUser && (currentUser.role === 'CLERK' || currentUser.role === 'DRC_LAB');

  return (
    <div>
      {/* Real-time Toast Alert Notification */}
      {toastAlert && (
        <div style={{
          position: 'fixed',
          top: '1.5rem',
          right: '1.5rem',
          zIndex: 99999,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#f8fafc',
          padding: '0.9rem 1.25rem',
          borderRadius: '14px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          maxWidth: '420px',
          fontSize: '0.9rem',
          fontWeight: '500'
        }}>
          <div style={{ flex: 1 }}>{toastAlert}</div>
          <button 
            onClick={() => setToastAlert(null)}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem', padding: '0 0.25rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Offline Status and Sync Bar */}
      <OfflineStatusBar pendingCount={pendingCount} onSync={handleSync} />

      {/* 5 Main Navigation Tabs - Hidden for Sub-Accounts */}
      {!isSubAccount && (
        <div className="nav-tabs" style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div 
            className={`nav-tab ${activeMainTab === 'buy' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('buy')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
          >
            <Scale size={18} />
            <span>รับซื้อยาง</span>
          </div>

          <div 
            className={`nav-tab ${activeMainTab === 'sales' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('sales')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
          >
            <Truck size={18} />
            <span>บันทึกการขาย (ส่งโรงงาน)</span>
          </div>

          <div 
            className={`nav-tab ${activeMainTab === 'expenses' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('expenses')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
          >
            <DollarSign size={18} />
            <span>บันทึกรายจ่ายลาน</span>
          </div>

          <div 
            className={`nav-tab ${activeMainTab === 'pnl' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('pnl')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
          >
            <TrendingUp size={18} />
            <span>แดชบอร์ด & กำไร-ขาดทุน (P&L)</span>
          </div>

          <div 
            className={`nav-tab ${activeMainTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('settings')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
          >
            <Settings size={18} />
            <span>ตั้งค่าร้านค้า</span>
          </div>
        </div>
      )}

      {/* Sub-Tabs specifically for [⚖️ รับซื้อยาง] */}
      {activeMainTab === 'buy' && !isSubAccount && (
        <div style={{
          display: 'flex',
          gap: '0.4rem',
          background: '#f1f5f9',
          padding: '0.35rem',
          borderRadius: '12px',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          border: '1px solid #e2e8f0'
        }}>
          <button
            onClick={() => setBuySubTab('clerk')}
            style={{
              flex: 1,
              minWidth: '150px',
              padding: '0.55rem 0.9rem',
              border: 'none',
              borderRadius: '8px',
              background: buySubTab === 'clerk' ? '#fff' : 'transparent',
              color: buySubTab === 'clerk' ? '#166534' : '#64748b',
              fontWeight: buySubTab === 'clerk' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: buySubTab === 'clerk' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s'
            }}
          >
            <span>⚖️ ชั่งน้ำหนัก & ออกบิล (Weight In)</span>
          </button>

          <button
            onClick={() => setBuySubTab('drc')}
            style={{
              flex: 1,
              minWidth: '150px',
              padding: '0.55rem 0.9rem',
              border: 'none',
              borderRadius: '8px',
              background: buySubTab === 'drc' ? '#fff' : 'transparent',
              color: buySubTab === 'drc' ? '#166534' : '#64748b',
              fontWeight: buySubTab === 'drc' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: buySubTab === 'drc' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s'
            }}
          >
            <span>🔬 ห้องตรวจ DRC (แล็บ)</span>
          </button>

          <button
            onClick={() => setBuySubTab('manual')}
            style={{
              flex: 1,
              minWidth: '150px',
              padding: '0.55rem 0.9rem',
              border: 'none',
              borderRadius: '8px',
              background: buySubTab === 'manual' ? '#fff' : 'transparent',
              color: buySubTab === 'manual' ? '#166534' : '#64748b',
              fontWeight: buySubTab === 'manual' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: buySubTab === 'manual' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s'
            }}
          >
            <span>🧾 ออกบิล (ดึงข้อมูล/กรอกเอง)</span>
          </button>

          <button
            onClick={() => setBuySubTab('history')}
            style={{
              flex: 1,
              minWidth: '130px',
              padding: '0.55rem 0.9rem',
              border: 'none',
              borderRadius: '8px',
              background: buySubTab === 'history' ? '#fff' : 'transparent',
              color: buySubTab === 'history' ? '#166534' : '#64748b',
              fontWeight: buySubTab === 'history' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: buySubTab === 'history' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s'
            }}
          >
            <span>📋 ประวัติรับซื้อ</span>
          </button>
        </div>
      )}

      {/* Main Tab Content */}
      <div className="portal-content">
        {/* TAB 1: [⚖️ รับซื้อยาง] */}
        {activeMainTab === 'buy' && (
          <div>
            {buySubTab === 'clerk' && (
              <ClerkPortal 
                currentUser={currentUser}
                dailySettings={dailySettings}
                transactions={transactions}
                onCreateTransaction={handleCreateTransaction}
                onUpdateTransaction={handleUpdateTransaction}
                onSaveSettings={handleSaveSettings}
              />
            )}
            {buySubTab === 'drc' && (
              <DrcPortal 
                currentUser={currentUser}
                dailySettings={dailySettings}
                transactions={transactions}
                onUpdateTransaction={handleUpdateTransaction}
              />
            )}
            {buySubTab === 'manual' && (
              <ManualBillForm 
                transactions={transactions} 
                currentUser={currentUser}
                onUpdateTransaction={handleUpdateTransaction}
              />
            )}
            {buySubTab === 'history' && (
              <DashboardPortal currentUser={currentUser} />
            )}
          </div>
        )}

        {/* TAB 2: [🚚 บันทึกการขาย (ส่งโรงงาน)] */}
        {activeMainTab === 'sales' && (
          <RubberSalesManagement currentUser={currentUser} />
        )}

        {/* TAB 3: [💸 บันทึกรายจ่ายลาน] */}
        {activeMainTab === 'expenses' && (
          <ShopExpensesManagement currentUser={currentUser} />
        )}

        {/* TAB 4: [📊 แดชบอร์ด & กำไร-ขาดทุน (P&L)] */}
        {activeMainTab === 'pnl' && (
          <div>
            {sub.isBuyer && sub.isFree && (
              <div style={{
                background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                border: '1px solid #fde68a',
                borderRadius: '16px',
                padding: '1rem 1.25rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.08)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🔒</span>
                  <div>
                    <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.95rem' }}>
                      แดชบอร์ด P&L โหมดเริ่มต้น (Starter Free — ย้อนหลัง 30 วัน)
                    </div>
                    <div style={{ fontSize: '0.825rem', color: '#b45309' }}>
                      อัปเกรดเป็นแพ็กเกจ Standard (฿199/เดือน) เพื่อปลดล็อก P&L ย้อนหลังเต็มรูปแบบ 1 ปี หรือ Pro สำหรับสถิติตลอดชีพ!
                    </div>
                  </div>
                </div>
              </div>
            )}
            <ProfitLossDashboard currentUser={currentUser} />
          </div>
        )}

        {/* TAB 5: [⚙️ ตั้งค่าร้านค้า] */}
        {activeMainTab === 'settings' && (
          <StoreRegistration 
            currentUser={currentUser} 
            onUpdateProfile={onUpdateProfile} 
            dailySettings={dailySettings} 
            onSaveSettings={handleSaveSettings} 
          />
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      {!isSubAccount && (
        <div className="mobile-bottom-nav">
          <div 
            className={`bottom-nav-item ${activeMainTab === 'buy' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('buy')}
          >
            <Scale />
            <span>รับซื้อยาง</span>
          </div>
          <div 
            className={`bottom-nav-item ${activeMainTab === 'sales' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('sales')}
          >
            <Truck />
            <span>ส่งโรงงาน</span>
          </div>
          <div 
            className={`bottom-nav-item ${activeMainTab === 'expenses' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('expenses')}
          >
            <DollarSign />
            <span>รายจ่าย</span>
          </div>
          <div 
            className={`bottom-nav-item ${activeMainTab === 'pnl' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('pnl')}
          >
            <TrendingUp />
            <span>กำไร-ขาดทุน</span>
          </div>
          <div 
            className={`bottom-nav-item ${activeMainTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('settings')}
          >
            <Settings />
            <span>ตั้งค่า</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default BuyerPortal;
