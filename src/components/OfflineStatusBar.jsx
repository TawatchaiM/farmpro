import React, { useState, useEffect, useCallback } from 'react';
import { isMock } from '../supabase';

function OfflineStatusBar({ pendingCount = 0, onSync }) {
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setIsOnline(window.navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncingRef = React.useRef(false);

  const handleSyncClick = useCallback(async () => {
    if (syncingRef.current || typeof onSync !== 'function') return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await onSync();
    } catch (err) {
      console.error('Manual sync failed:', err);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [onSync]);

  // Auto sync when coming online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isMock) {
      handleSyncClick();
    }
  }, [isOnline]); // Only trigger when isOnline state changes

  const [firstError, setFirstError] = useState(null);
  useEffect(() => {
    if (pendingCount > 0) {
      try {
        const queue = JSON.parse(localStorage.getItem('farmpro_pending_sync') || '[]') || [];
        const errItem = queue.find(q => q.error_msg);
        setFirstError(errItem ? errItem.error_msg : null);
      } catch(e){}
    } else {
      setFirstError(null);
    }
  }, [pendingCount, syncing]);

  return (
    <div className={`status-bar ${isOnline ? 'online' : 'offline'}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="status-indicator">
          <div className="status-dot"></div>
          <span>
            {isMock ? (
              <span style={{ color: '#6d28d9', fontWeight: 'bold' }}>🧪 โหมดทดสอบ (จำลอง LocalStorage)</span>
            ) : isOnline ? (
              <span style={{ color: '#15803d', fontWeight: '600' }}>🟢 ระบบเชื่อมต่อออนไลน์ (Supabase)</span>
            ) : (
              <span style={{ color: '#b91c1c', fontWeight: 'bold' }}>📡 ขณะนี้คุณกำลังใช้งานในโหมดออฟไลน์ (แสดงข้อมูลจากแคชในอุปกรณ์)</span>
            )}
          </span>
        </div>

        <div className="sync-actions">
          {pendingCount > 0 && (
            <div className="pending-badge">
              ⏳ คิวรออัปเดต: {pendingCount} รายการ
            </div>
          )}
          
          {pendingCount > 0 && !isMock && (
            <button 
              className="btn-sync" 
              onClick={handleSyncClick}
              disabled={syncing || !isOnline}
            >
              {syncing ? (
                <>
                  <span className="spinner-mini" style={{
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    border: '2px solid white',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginRight: '4px'
                  }}></span>
                  กำลังอัปโหลด...
                </>
              ) : (
                <>
                  <span>🔄</span> ซิงค์ด่วน
                </>
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* Show Error Message if sync failed */}
      {firstError && (
        <div style={{
          backgroundColor: '#fee2e2', 
          border: '1px solid #ef4444', 
          color: '#991b1b', 
          padding: '0.5rem 1rem', 
          borderRadius: '6px', 
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>⚠️ <strong>อัปเดตล้มเหลว:</strong> {firstError}</span>
        </div>
      )}
    </div>
  );
}

export default OfflineStatusBar;
