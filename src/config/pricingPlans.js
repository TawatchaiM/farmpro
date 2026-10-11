// Configuration file for FarmPro Pricing Plans & Quota Limits
// Supports Role-Segmented Plans: Seller (ชาวสวน) and Buyer (ร้านรับซื้อ)

export const PRICING_CONFIG = {
  currency: '฿',
  billingCycles: {
    monthly: { id: 'monthly', label: 'รายเดือน', discountPercent: 0 },
    yearly: { id: 'yearly', label: 'รายปี', discountPercent: 20, badgeText: '🎉 ประหยัด 20%' }
  },
  roles: {
    seller: {
      id: 'seller',
      name: 'สำหรับชาวสวนยาง (Sellers)',
      icon: '👨‍🌾',
      subtitle: 'จัดการสวน บันทึกบิลขาย และวิเคราะห์ผลกำไร-ขาดทุนแบบมืออาชีพ'
    },
    buyer: {
      id: 'buyer',
      name: 'สำหรับร้านรับซื้อยาง (Buyers)',
      icon: '🏢',
      subtitle: 'ระบบลานรับซื้อ ชั่งน้ำหนัก DRC ออกบิล และควบคุมต้นทุนครบวงจร'
    }
  },
  plansByRole: {
    seller: [
      {
        id: 'seller_free',
        planId: 'free',
        tier: 'free',
        role: 'seller',
        name: 'ฟรี (Free)',
        subtitle: 'บันทึกบิลขายและรายจ่ายสวนยางด้วยตนเองอย่างเป็นระเบียบ',
        priceMonthly: 0,
        priceYearly: 0,
        badge: null,
        isPopular: false,
        buttonText: 'ใช้งานฟรีทันที',
        quotas: {
          retention: '60 วัน',
          storageMb: 100,
          storageLabel: '100 MB',
          plots: 'สูงสุด 2 แปลง',
          aiSlips: '15 ครั้ง/เดือน',
          bills: 'ไม่จำกัด'
        },
        features: [
          { text: 'บันทึกบิลขายยางและรายจ่ายสวนยาง', included: true },
          { text: 'จัดการสวนยางได้สูงสุด 2 แปลง', included: true },
          { text: 'ดูประวัติข้อมูลย้อนหลัง 60 วัน', included: true },
          { text: 'อัปโหลดสลิปบิลยางด้วย AI 15 ครั้ง/เดือน', included: true },
          { text: 'คำนวณส่วนแบ่งเจ้าของสวน / คนกรีด', included: true },
          { text: 'เช็กราคากลางยางพาราแบบเรียลไทม์', included: true },
          { text: 'แดชบอร์ด P&L ไม่จำกัดระยะเวลา', included: false },
          { text: 'ส่งออกรายงาน Excel / CSV', included: false }
        ]
      },
      {
        id: 'seller_pro',
        planId: 'pro',
        tier: 'pro',
        role: 'seller',
        name: 'ชาวสวนมืออาชีพ (Pro Farmer)',
        subtitle: 'วิเคราะห์กำไร-ขาดทุนเชิงลึก ไม่จำกัดแปลงสวนและระยะเวลาจัดเก็บ',
        priceMonthly: 99,
        priceYearly: 990, // Save ฿198 (~17%)
        badge: '✨ แนะนำ / Recommended',
        isPopular: true,
        buttonText: 'สมัครแพ็กเกจนี้',
        quotas: {
          retention: 'ตลอดชีพ (ไม่จำกัด)',
          storageMb: 2000,
          storageLabel: '2,000 MB (2 GB)',
          plots: 'ไม่จำกัดแปลง',
          aiSlips: 'ไม่จำกัด',
          bills: 'ไม่จำกัด'
        },
        features: [
          { text: 'ฟีเจอร์ทั้งหมดในแพ็กเกจฟรี', included: true },
          { text: 'จัดการแปลงสวนยางได้ไม่จำกัดจำนวน', included: true },
          { text: 'อัปโหลดสลิปและบิลยางด้วย AI ไม่จำกัด', included: true },
          { text: 'แดชบอร์ดกำไร-ขาดทุน (P&L) ย้อนหลังไม่จำกัด', included: true },
          { text: 'ส่งออกไฟล์รายงานสรุปบัญชี Excel / CSV', included: true },
          { text: 'วิเคราะห์แนวโน้มผลผลิตยางและ DRC เฉลี่ย', included: true },
          { text: 'การสำรองข้อมูลปลอดภัยบน Cloud ตลอดชีพ', included: true },
          { text: 'สิทธิ์เข้าถึงฟีเจอร์และเครื่องมือใหม่ก่อนใคร', included: true }
        ]
      }
    ],
    buyer: [
      {
        id: 'buyer_free',
        planId: 'free',
        tier: 'free',
        role: 'buyer',
        name: 'เริ่มต้น (Starter Free)',
        subtitle: 'สำหรับลานรับซื้อเปิดใหม่หรือทดลองใช้งานระบบดิจิทัล',
        priceMonthly: 0,
        priceYearly: 0,
        badge: null,
        isPopular: false,
        buttonText: 'ทดลองใช้ฟรี',
        quotas: {
          retention: '30 วัน',
          storageMb: 200,
          storageLabel: '200 MB',
          billsQuotaMonthly: 150,
          billsQuotaLabel: '150 บิล/เดือน'
        },
        features: [
          { text: 'ชั่งน้ำหนัก ตรวจ DRC และออกบิลรับซื้อยาง', included: true },
          { text: 'จำกัดปริมาณออกบิล 150 บิล/เดือน', included: true },
          { text: 'ดูประวัติข้อมูลย้อนหลัง 30 วัน', included: true },
          { text: 'พื้นที่จัดเก็บรูปสลิปและเอกสาร 200 MB', included: true },
          { text: 'พิมพ์บิล PDF และแชร์สลิปดิจิทัล', included: true },
          { text: 'บันทึกการส่งขายโรงงาน & รายจ่ายลาน', included: false },
          { text: 'แดชบอร์ด P&L และวิเคราะห์ส่วนต่างน้ำหนัก', included: false },
          { text: 'ส่งออกรายงานสรุปบัญชี Excel / CSV', included: false }
        ]
      },
      {
        id: 'buyer_standard',
        planId: 'standard',
        tier: 'standard',
        role: 'buyer',
        name: 'ลานมาตรฐาน (Standard)',
        subtitle: 'สำหรับลานรับซื้อทั่วไป บันทึกบิลไม่จำกัด เชื่อมโยงส่งขายโรงงาน',
        priceMonthly: 199,
        priceYearly: 1990, // Save ฿398 (~17%)
        badge: '🔥 ยอดนิยม / Popular',
        isPopular: true,
        buttonText: 'เลือกแพ็กเกจ Standard',
        quotas: {
          retention: '1 ปี (365 วัน)',
          storageMb: 2048,
          storageLabel: '2,048 MB (2 GB)',
          billsQuotaMonthly: 999999,
          billsQuotaLabel: 'ไม่จำกัดบิล'
        },
        features: [
          { text: 'บันทึกบิลรับซื้อยางไม่จำกัดจำนวนบิล', included: true },
          { text: 'บันทึกการส่งขายโรงงาน และบันทึกรายจ่ายลาน', included: true },
          { text: 'แดชบอร์ดกำไร-ขาดทุน (P&L) ย้อนหลัง 1 ปี', included: true },
          { text: 'พื้นที่จัดเก็บรูปสลิปและไฟล์ 2 GB (2,048 MB)', included: true },
          { text: 'ส่งออกรายงานข้อมูลครบถ้วน Excel / CSV', included: true },
          { text: 'ส่งบิลแจ้งเตือนเข้า LINE ชาวสวนยางอัตโนมัติ', included: true },
          { text: 'ระบบตรวจวัดส่วนต่างน้ำหนักยาง (Shrinkage)', included: true },
          { text: 'ระบบหลายเสมียน (Multi-PIN / Staff)', included: false }
        ]
      },
      {
        id: 'buyer_pro',
        planId: 'pro',
        tier: 'pro',
        role: 'buyer',
        name: 'ลานมืออาชีพ (Pro Business)',
        subtitle: 'สำหรับลานขนาดใหญ่และเครือข่ายธุรกิจที่ต้องการประสิทธิภาพสูงสุด',
        priceMonthly: 399,
        priceYearly: 3990, // Save ฿798 (~17%)
        badge: '🚀 ระบบครบวงจร',
        isPopular: false,
        buttonText: 'เลือกแพ็กเกจ Pro',
        quotas: {
          retention: 'ตลอดชีพ (ไม่จำกัด)',
          storageMb: 10240,
          storageLabel: '10,240 MB (10 GB)',
          billsQuotaMonthly: 999999,
          billsQuotaLabel: 'ไม่จำกัดบิล'
        },
        features: [
          { text: 'ฟีเจอร์ครบทุกอย่างในแพ็กเกจ Standard', included: true },
          { text: 'ประวัติข้อมูล สถิติ และงบ P&L ไม่จำกัดระยะเวลา', included: true },
          { text: 'พื้นที่จัดเก็บข้อมูลและสลิปขนาดใหญ่ 10 GB', included: true },
          { text: 'ระบบวิเคราะห์ส่วนต่างน้ำหนักและ DRC เชิงลึก', included: true },
          { text: 'รองรับหลายเสมียน/สิทธิ์การทำงาน (Multi-PIN)', included: true },
          { text: 'เชื่อมต่อเครื่องชั่งดิจิทัลและฮาร์ดแวร์อัตโนมัติ', included: true },
          { text: 'ระบบสำรองข้อมูลอัตโนมัติบน Cloud ตลอดชีพ', included: true },
          { text: 'ทีมงานบริการและดูแลระดับพิเศษ (VIP Support 24/7)', included: true }
        ]
      }
    ]
  }
};

// Flat array for backward compatibility
export const ALL_PLANS = [
  ...PRICING_CONFIG.plansByRole.seller,
  ...PRICING_CONFIG.plansByRole.buyer
];

// Helper to look up plan by ID
export function getPlanConfig(planId) {
  if (!planId) return null;
  return ALL_PLANS.find(p => p.id === planId || p.planId === planId);
}
