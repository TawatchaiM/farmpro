import React, { useState } from 'react';
import MarketplaceList from './MarketplaceList';

function MarketplacePortal() {
  const [activeSubTab, setActiveSubTab] = useState('list');

  return (
    <div>
      <div className="nav-tabs">
        <div 
          className={`nav-tab ${activeSubTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('list')}
        >
          รายการบริการและร้านค้า
        </div>
      </div>

      <div className="portal-content">
        {activeSubTab === 'list' && <MarketplaceList />}
      </div>
    </div>
  );
}

export default MarketplacePortal;
