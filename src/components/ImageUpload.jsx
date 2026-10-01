import React, { useState, useRef } from 'react';

function ImageUpload({ onUpload, onShowTrash }) {
  const [showOptions, setShowOptions] = useState(false);
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    setShowOptions(false);
    if (e.target.files && e.target.files[0]) {
      // Simulate file processing
      onUpload(e.target.files[0]);
    }
  };

  return (
    <div className="card" style={{ position: 'relative' }}>
      {onShowTrash && (
        <button 
          onClick={onShowTrash} 
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(22, 163, 74, 0.05)', color: '#64748b', border: '1px solid rgba(22, 163, 74, 0.1)', borderRadius: '8px', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600, zIndex: 10 }}
        >
          🗑️ ถังขยะ
        </button>
      )}
      <div className="header">
        <h1>FarmPro</h1>
        <p>ระบบบริหารและจัดการสวนอัจฉริยะ</p>
      </div>
      
      {!showOptions ? (
        <div 
          className="upload-container" 
          onClick={() => setShowOptions(true)}
          style={{ marginTop: '2rem' }}
        >
          <div className="upload-icon">📸</div>
          <div className="upload-text">ถ่ายรูปหรืออัปโหลดบิล</div>
          <div className="upload-subtext">รองรับไฟล์ JPG, PNG</div>
        </div>
      ) : (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
            เลือกวิธีเพิ่มรูปบิล
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {/* ปุ่มถ่ายรูป */}
            <div 
              className="upload-container" 
              style={{ flex: 1, padding: '1.5rem 0.5rem' }}
              onClick={() => cameraInputRef.current.click()}
            >
              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
                ref={cameraInputRef}
              />
              <div className="upload-icon" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📸</div>
              <div className="upload-text" style={{ fontSize: '1rem' }}>ถ่ายรูปบิล</div>
            </div>

            {/* ปุ่มอัปโหลดจากเครื่อง */}
            <div 
              className="upload-container" 
              style={{ flex: 1, padding: '1.5rem 0.5rem' }}
              onClick={() => fileInputRef.current.click()}
            >
              <input 
                type="file" 
                accept="image/*"
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
                ref={fileInputRef}
              />
              <div className="upload-icon" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📁</div>
              <div className="upload-text" style={{ fontSize: '1rem' }}>อัปโหลดรูปบิล</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button 
              className="btn btn-secondary" 
              onClick={(e) => { e.stopPropagation(); setShowOptions(false); }} 
              style={{ padding: '0.5rem 1.5rem', width: 'auto', marginTop: 0 }}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageUpload;
