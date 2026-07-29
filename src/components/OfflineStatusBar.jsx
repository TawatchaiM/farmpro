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

  return (
    <div className={`status-bar ${isOnline ? 'online' : 'offline'}`}>
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
  );
}

export default OfflineStatusBar;
