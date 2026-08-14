import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function CollapsibleSection({ 
  id, 
  title, 
  subtitle, 
  icon, 
  defaultExpanded = true, 
  children,
  headerRight
}) {
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem(`farmpro_collapse_${id}`);
    if (saved !== null) return saved === 'true';
    return defaultExpanded;
  });

  useEffect(() => {
    localStorage.setItem(`farmpro_collapse_${id}`, isExpanded.toString());
  }, [id, isExpanded]);

  return (
    <div className="card collapsible-section" style={{ marginBottom: '1.5rem' }}>
      <div 
        className="header" 
        onClick={() => setIsExpanded(!isExpanded)} 
        style={{ 
          cursor: 'pointer', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          userSelect: 'none',
          paddingBottom: isExpanded ? '1rem' : '0'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {icon && <span style={{ fontSize: '1.5rem' }}>{icon}</span>}
          <div>
            <h2 style={{ marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#14532d' }}>
              {title}
            </h2>
            {subtitle && <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{subtitle}</p>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {headerRight && (
            <div onClick={(e) => e.stopPropagation()}>
              {headerRight}
            </div>
          )}
          <div style={{ 
            color: '#64748b', 
            transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            <ChevronDown size={24} />
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="collapsible-content" style={{ animation: 'fadeIn 0.3s' }}>
          {children}
        </div>
      )}
    </div>
  );
}
