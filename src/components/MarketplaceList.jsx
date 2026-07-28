import React from 'react';

function MarketplaceList() {
  const mockStores = [
    { id: 1, type: 'shop', name: 'ร้านเกษตรรุ่งเรือง', desc: 'จำหน่ายปุ๋ยเคมี ยาปราบศัตรูพืช อุปกรณ์กรีดยางครบวงจร', location: 'อ.หาดใหญ่ จ.สงขลา' },
    { id: 2, type: 'service', name: 'รับจ้างตัดหญ้า/ไถพรวนดิน', desc: 'บริการรถไถเล็กและเครื่องตัดหญ้าสะพายบ่า ราคากันเอง', location: 'อ.คลองหอยโข่ง จ.สงขลา' },
    { id: 3, type: 'shop', name: 'แสงทองการเกษตร', desc: 'ขายส่งถ้วยรองน้ำยาง มีดกรีดยางคุณภาพดี', location: 'อ.สะเดา จ.สงขลา' }
  ];

  return (
    <div>
      <div className="header" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
        <h2>ศูนย์รวมบริการทางการเกษตร</h2>
        <p>ค้นหาร้านค้าและบริการใกล้คุณ (Mockup)</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {mockStores.map(store => (
          <div key={store.id} className="card" style={{ marginBottom: 0, padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ 
                  background: store.type === 'shop' ? '#e3f2fd' : '#f3e5f5', 
                  color: store.type === 'shop' ? '#1565c0' : '#7b1fa2', 
                  padding: '4px 8px', 
                  borderRadius: '4px', 
                  fontSize: '0.75rem', 
                  fontWeight: 'bold',
                  display: 'inline-block',
                  marginBottom: '0.5rem'
                }}>
                  {store.type === 'shop' ? 'ร้านค้าอุปกรณ์/ปุ๋ย' : 'บริการรับจ้าง'}
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{store.name}</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{store.desc}</p>
                <div style={{ color: '#666', fontSize: '0.875rem' }}>📍 {store.location}</div>
              </div>
              <button className="btn btn-secondary" style={{ marginTop: 0, padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                ติดต่อ
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MarketplaceList;
