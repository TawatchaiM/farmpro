export const handleCopyLineBill = (tx, currentUser) => {
  const storeProfile = JSON.parse(localStorage.getItem('farmpro_store_profile') || '{}');
  const storeName = currentUser?.store_name || storeProfile.storeName || currentUser?.full_name || 'ร้านรับซื้อยาง FarmPro';
  const ownerAmount = parseFloat(tx.owner_share_amount || tx.owner_share_thb || 0);
  const tapperAmount = parseFloat(tx.tapper_share_amount || tx.tapper_share_thb || 0);
  const billText = `🟢 LINE E-BILL: ${storeName}
===========================
คิวรับซื้อ: ${tx.queue_number || '-'}
วันที่: ${tx.date}
ผู้ขาย: ${tx.seller_name}
---------------------------
น้ำหนักน้ำยางสด: ${parseFloat(tx.raw_weight_kg || 0).toFixed(2)} กก.
ค่า DRC %: ${parseFloat(tx.drc_percentage || 0).toFixed(2)} %
เนื้อยางแห้ง: ${parseFloat(tx.dry_weight_kg || 0).toFixed(2)} กก.
ราคารับซื้อ: ฿${parseFloat(tx.price_per_kg || 0).toFixed(2)} /กก.
===========================
💰 ยอดเงินรวมสุทธิ: ฿${parseFloat(tx.total_amount || tx.total_amount_thb || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
---------------------------
👨‍🌾 เจ้าของสวน (${tx.owner_share_percentage || 50}%): ฿${ownerAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
👨‍🌾 คนกรีด (${100 - (tx.owner_share_percentage || 50)}%): ฿${tapperAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
===========================
ขอบคุณที่ใช้บริการครับ/ค่ะ! 🙏`;

  navigator.clipboard.writeText(billText).then(() => {
    alert('คัดลอกข้อความสรุปบิลเรียบร้อยแล้ว!\\nนำไปวางส่งต่อในแชท LINE ได้ทันที');
  }).catch(err => {
    console.error(err);
    alert('ไม่สามารถคัดลอกได้อัตโนมัติ');
  });
};
