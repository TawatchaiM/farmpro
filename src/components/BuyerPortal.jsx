import React, { useState, useEffect, useCallback } from 'react';
import StoreRegistration from './StoreRegistration';
import ManualBillForm from './ManualBillForm';
import ClerkPortal from './ClerkPortal';
import DrcPortal from './DrcPortal';
import DashboardPortal from './DashboardPortal';
import OfflineStatusBar from './OfflineStatusBar';
import { db, isMock } from '../supabase';
import { playNotificationSound } from '../utils/audioAlert';
import './OperationalWorkflow.css';

function BuyerPortal({ currentUser, onUpdateProfile }) {
  const initialTab = currentUser?.role === 'DRC_LAB' ? 'drc' : 'clerk';
  const [activeSubTab, setActiveSubTab] = useState(initialTab); // 'clerk', 'drc', 'registration', 'manual'
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
      setActiveSubTab('drc');
    } else if (currentUser?.role === 'CLERK') {
      setActiveSubTab('clerk');
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
      const txList = await db.getTransactions(todayStr);
      setTransactions(Array.isArray(txList) ? txList : []);
    } catch (err) {
      console.error('Failed to load portal data:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [todayStr, updatePendingCount]);

  useEffect(() => {
    loadData();
    
    // Supabase Realtime & Multi-Device Subscription
    const unsubscribe = db.subscribeToTransactions(async (payload) => {
      const txList = await db.getTransactions(todayStr);
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
  }, [loadData, todayStr, updatePendingCount, triggerToast]);

  // Save Settings handler
  const handleSaveSettings = useCallback(async (settings) => {
    const saved = await db.saveDailySettings(settings);
    setDailySettings(saved);
    // Reload transactions to apply any updated prices if needed (usually done at insert, but good to refresh)
    const txList = await db.getTransactions(todayStr);
    setTransactions(txList);
  }, [todayStr]);

  // Create transaction handler
  const handleCreateTransaction = useCallback(async (tx) => {
    const isOffline = !window.navigator.onLine;
    const created = await db.createTransaction(tx, isOffline);
    
    // Refresh list from cache
    const txList = await db.getTransactions(todayStr);
    setTransactions(txList);
    updatePendingCount();
    return created;
  }, [todayStr, updatePendingCount]);

  // Update transaction handler
  const handleUpdateTransaction = useCallback(async (id, updates) => {
    const isOffline = !window.navigator.onLine;
    const updated = await db.updateTransaction(id, updates, isOffline);

    // Refresh list from cache
    const txList = await db.getTransactions(todayStr);
    setTransactions(txList);
    updatePendingCount();
    return updated;
  }, [todayStr, updatePendingCount]);

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
      const txList = await db.getTransactions(todayStr);
      setTransactions(txList);
      
      updatePendingCount();
    } catch (err) {
      console.error('Offline sync failed:', err);
    }
  }, [todayStr, updatePendingCount]);

  if (loading) {
    return (
      <div className="loading-overlay" style={{ minHeight: '400px' }}>
        <div className="spinner"></div>
        <div className="loading-text">กำลังดึงข้อมูลสถานีรับซื้อยาง...</div>
      </div>
    );
  }

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

      {/* Navigation tabs - Hidden for Sub-Accounts */}
      {(!currentUser || (currentUser.role !== 'CLERK' && currentUser.role !== 'DRC_LAB')) && (
        <div className="nav-tabs" style={{ marginBottom: '1.5rem' }}>
          <div 
            className={`nav-tab ${activeSubTab === 'clerk' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('clerk')}
          >
            ⚙️ ระบบเสมียน (Weight In)
          </div>
          <div 
            className={`nav-tab ${activeSubTab === 'drc' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('drc')}
          >
            🔬 ห้องตรวจ DRC (แล็บ)
          </div>
          <div 
            className={`nav-tab ${activeSubTab === 'manual' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('manual')}
          >
            🧾 ออกบิล (ดึงข้อมูล / กรอกเอง)
          </div>
          <div 
            className={`nav-tab ${activeSubTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('dashboard')}
          >
            📊 แดชบอร์ด & ประวัติ
          </div>
          <div 
            className={`nav-tab ${activeSubTab === 'registration' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('registration')}
          >
            🏪 ตั้งค่าร้านค้า
          </div>
        </div>
      )}

      <div className="portal-content">
        {activeSubTab === 'clerk' && (
          <ClerkPortal 
            currentUser={currentUser}
            dailySettings={dailySettings}
            transactions={transactions}
            onCreateTransaction={handleCreateTransaction}
            onUpdateTransaction={handleUpdateTransaction}
          />
        )}
        {activeSubTab === 'drc' && (
          <DrcPortal 
            currentUser={currentUser}
            dailySettings={dailySettings}
            transactions={transactions}
            onUpdateTransaction={handleUpdateTransaction}
          />
        )}
        {activeSubTab === 'manual' && (
          <ManualBillForm 
            transactions={transactions} 
            currentUser={currentUser}
            onUpdateTransaction={handleUpdateTransaction}
          />
        )}
        {activeSubTab === 'dashboard' && (
          <DashboardPortal />
        )}
        {activeSubTab === 'registration' && (
          <StoreRegistration 
            currentUser={currentUser} 
            onUpdateProfile={onUpdateProfile} 
            dailySettings={dailySettings} 
            onSaveSettings={handleSaveSettings} 
          />
        )}
      </div>
    </div>
  );
}

export default BuyerPortal;

