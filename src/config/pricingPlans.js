// Configuration file for FarmPro Pricing Plans & Features
// Easy to modify prices, discounts, features, and text without editing UI code

export const PRICING_CONFIG = {
  currency: '฿',
  billingCycles: {
    monthly: { id: 'monthly', label: 'ชำระรายเดือน' },
    yearly: { id: 'yearly', label: 'ชำระรายปี', discountPercent: 20, badgeText: '🎉 ประหยัด 20%' }
  },
  plans: [
    {
      id: 'free',
      name: 'Free (สำหรับชาวสวน)',
      subtitle: 'สำหรับผู้ขายและชาวสวนยางพาราที่ต้องการจัดการบิลและเช็กราคา',
      priceMonthly: 0,
      badge: null,
      isPopular: false,
      buttonText: 'เริ่มต้นใช้งานฟรี',
      buttonVariant: 'secondary',
      targetRoles: ['seller'],
      features: [
        { text: 'รับและบันทึกบิลซื้อขายยางพาราอิเล็กทรอนิกส์', included: true },
        { text: 'ดูประวัติการขายยางย้อนหลัง 30 วัน', included: true },
        { text: 'เช็กราคายางกลางวันนี้ (ตลาดกลาง/ราคาสมาคม)', included: true },
        { text: 'บันทึกพิกัดและที่ตั้งสวนยางบนแผนที่', included: true },
        { text: 'ระบบคำนวณส่วนแบ่งเจ้าของสวน / คนกรีด', included: true },
        { text: 'ระบบจัดการคิวลานรับซื้อ', included: false },
        { text: 'การคำนวณ DRC และออกบิลอัตโนมัติ', included: false },
        { text: 'เชื่อมต่อเครื่องชั่งดิจิทัลและอุปกรณ์ฮาร์ดแวร์', included: false }
      ]
    },
    {
      id: 'standard',
      name: 'Standard (ลานขนาดเล็ก-กลาง)',
      subtitle: 'สำหรับลานรับซื้อยางทั่วไป จัดการคิว คำนวณ DRC และออกบิลอัตโนมัติ',
      priceMonthly: 490,
      badge: '🔥 แนะนำ / Popular',
      isPopular: true,
      buttonText: 'ทดลองใช้งานฟรี 14 วัน',
      buttonVariant: 'primary',
      targetRoles: ['buyer', 'vendor'],
      features: [
        { text: 'รับและบันทึกบิลซื้อขายยางพาราอิเล็กทรอนิกส์', included: true },
        { text: 'ดูประวัติการขายยางไม่จำกัดระยะเวลา', included: true },
        { text: 'เช็กราคายางกลางวันนี้และสถิติกราฟแนวโน้ม', included: true },
        { text: 'บันทึกพิกัดลานและระบุเวลาทำการเปิด-ปิด', included: true },
        { text: 'ระบบจัดการคิวลานรับซื้อและแจ้งเตือนสถานะ', included: true },
        { text: 'คำนวณ DRC %, น้ำหนักยางแห้ง และยอดเงินอัตโนมัติ', included: true },
        { text: 'พิมพ์บิล PDF และส่งบิลเข้า LINE ชาวสวน', included: true },
        { text: 'สรุปยอดซื้อขายประจำวันและรายงานสรุปรายเดือน', included: true },
        { text: 'เชื่อมต่อเครื่องชั่งดิจิทัลและเครื่องวิเคราะห์ DRC', included: false },
        { text: 'รองรับการบริหารหลายสาขา / หลายจุดรับซื้อ', included: false }
      ]
    },
    {
      id: 'pro',
      name: 'Pro (ลานใหญ่ / โรงงาน)',
      subtitle: 'สำหรับลานรับซื้อขนาดใหญ่และโรงงาน ที่ต้องการระบบวิเคราะห์ DRC เชิงลึก',
      priceMonthly: 1290,
      badge: '🚀 ระบบครบวงจร',
      isPopular: false,
      buttonText: 'ทดลองใช้งานฟรี 14 วัน',
      buttonVariant: 'accent',
      targetRoles: ['buyer', 'vendor'],
      features: [
        { text: 'ฟีเจอร์ทั้งหมดในแพ็กเกจ Standard', included: true },
        { text: 'ระบบวิเคราะห์ DRC เชิงลึกและสอบเทียบสูตร Lab', included: true },
        { text: 'เชื่อมต่อเครื่องชั่งน้ำหนักดิจิทัล (RS232/Bluetooth)', included: true },
        { text: 'รองรับการบริหารจัดการหลายสาขา (Multi-Branch)', included: true },
        { text: 'ระบบสิทธิ์ผู้ใช้งานหลายระดับ (เสมียน/เจ้าของ/Lab)', included: true },
        { text: 'ส่งออกข้อมูลบัญชี Excel, PDF, CSV ครบถ้วน', included: true },
        { text: 'การสำรองข้อมูลอัตโนมัติบน Cloud ไม่จำกัดความจุ', included: true },
        { text: 'ทีมงานดูแลพิเศษตลอด 24 ชั่วโมง (VIP Support)', included: true }
      ]
    }
  ]
};
