export const printThermalBill = (tx, currentUser) => {
  const storeProfile = JSON.parse(localStorage.getItem('farmpro_store_profile') || '{}');
  const storeName = currentUser?.store_name || storeProfile.storeName || currentUser?.full_name || 'ร้านรับซื้อยาง FarmPro';
  const storePhone = currentUser?.phone_number || storeProfile.phone || '08X-XXX-XXXX';
  const storeAddress = [currentUser?.address_details, currentUser?.subdistrict, currentUser?.district, currentUser?.province].filter(Boolean).join(' ') || storeProfile.address || 'ที่อยู่ร้าน';
  const taxId = currentUser?.tax_id || storeProfile.taxId ? `เลขผู้เสียภาษี: ${currentUser?.tax_id || storeProfile.taxId}` : '';
  
  const printWindow = window.open('', '_blank', 'width=350,height=550');
  
  const htmlContent = `
    <html>
      <head>
        <title>พิมพ์บิลคิว ${tx.queue_number || 'ไม่ระบุ'}</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #000; margin: 0; padding: 10px; width: 70mm; }
          .center { text-align: center; }
          .header-title { font-weight: bold; font-size: 14px; margin-bottom: 2px; }
          .divider { border-top: 1px dashed black; margin: 6px 0; }
          .double-divider { border-top: 2px double black; margin: 6px 0; }
          .row-data { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .total-row { font-size: 13px; font-weight: bold; }
          .qr-placeholder { width: 80px; height: 80px; margin: 10px auto; border: 1px solid black; display: flex; align-items: center; justify-content: center; font-size: 8px; text-align: center; }
          .barcode-placeholder { width: 160px; height: 25px; margin: 8px auto; background: repeating-linear-gradient(90deg, #000, #000 1.5px, #fff 1.5px, #fff 4px); }
          @media print { body { margin: 0; padding: 5px; } }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="header-title">${storeName}</div>
          <div>${storeAddress}</div>
          <div>โทร: ${storePhone}</div>
          <div>${taxId}</div>
          <div class="divider"></div>
          <div style="font-size: 13px; font-weight: bold;">ใบเสร็จรับซื้อน้ำยางพารา</div>
          <div style="font-size: 16px; font-weight: bold; margin-top: 3px;">คิว: ${tx.queue_number || '-'}</div>
        </div>
        <div class="divider"></div>
        <div class="row-data"><span>วันที่:</span><span>${tx.date}</span></div>
        <div class="row-data"><span>ลูกค้า:</span><span>${tx.seller_name}</span></div>
        ${tx.phone_number ? `<div class="row-data"><span>เบอร์โทร:</span><span>${tx.phone_number}</span></div>` : ''}
        <div class="divider"></div>
        <div class="row-data"><span>น้ำยางสด (Weight In):</span><span>${parseFloat(tx.raw_weight_kg || 0).toFixed(2)} กก.</span></div>
        <div class="row-data"><span>สุ่มตรวจเปียก:</span><span>${parseFloat(tx.wet_weight_sample_g || 0).toFixed(2)} ก.</span></div>
        <div class="row-data"><span>อบแห้งได้:</span><span>${parseFloat(tx.dry_weight_sample_g || 0).toFixed(2)} ก.</span></div>
        <div class="row-data" style="font-weight:bold"><span>% DRC:</span><span>${parseFloat(tx.drc_percentage || 0).toFixed(2)} %</span></div>
        <div class="row-data"><span>เนื้อยางแห้งสุทธิ:</span><span>${parseFloat(tx.dry_weight_kg || 0).toFixed(2)} กก.</span></div>
        <div class="row-data"><span>ราคา/กก.:</span><span>${parseFloat(tx.price_per_kg || 0).toFixed(2)} บาท</span></div>
        <div class="double-divider"></div>
        <div class="row-data total-row"><span>ยอดรวมสุทธิ:</span><span>฿${parseFloat(tx.total_amount || tx.total_amount_thb || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
        <div class="double-divider"></div>
        <div class="row-data"><span>สัดส่วนเจ้าของสวน:</span><span>${tx.owner_share_percentage || 50}%</span></div>
        <div class="row-data"><span>ส่วนแบ่งเจ้าของ:</span><span>฿${parseFloat(tx.owner_share_amount || tx.owner_share_thb || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
        <div class="row-data"><span>ส่วนแบ่งคนกรีด:</span><span>฿${parseFloat(tx.tapper_share_amount || tx.tapper_share_thb || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
        <div class="divider"></div>
        <div class="qr-placeholder">E-BILL QR<br/>SCAN LINE</div>
        <div class="barcode-placeholder"></div>
        <div class="center" style="font-size:8px;margin-top:5px">${tx.id}</div>
        <div class="center" style="margin-top:10px;font-weight:bold">ขอบคุณที่ร่วมเป็นพันธมิตรกับเรา</div>
        <script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}</script>
      </body>
    </html>
  `;
  
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    alert("Please allow popups to print the bill.");
  }
};
