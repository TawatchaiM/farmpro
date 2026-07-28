import React, { useState, useRef, useEffect } from 'react';

function AIChat() {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: 'สวัสดีครับ! ผม FarmPro AI Assistant ยินดีช่วยเหลือครับ\nคุณสามารถถามผมได้ เช่น:\n- "สรุปยอดขายของฉันให้หน่อย"\n- "ร้านไหนให้ราคาดีที่สุด?"\n- "คำแนะนำการใส่ปุ๋ยยางพารา"' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage = { id: Date.now(), sender: 'user', text: inputValue };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      let aiText = 'ขออภัยครับ ผมยังไม่เข้าใจคำถามของคุณ ลองถามเกี่ยวกับยอดขาย ราคา หรือการดูแลสวนยางดูนะครับ';
      const inputLower = userMessage.text.toLowerCase();

      if (inputLower.includes('ยอดขาย')) {
        aiText = '📊 สรุปยอดขายของคุณเดือนนี้:\n- จำนวนบิล: 12 ใบ\n- น้ำหนักยางแห้งรวม: 1,250 กก.\n- รายรับรวมทั้งหมด: 68,750 บาท\nแนวโน้มรายรับเพิ่มขึ้น 15% จากเดือนที่แล้วครับ!';
      } else if (inputLower.includes('ราคา') || inputLower.includes('ดีที่สุด')) {
        aiText = '💡 ร้านที่ให้ราคารับซื้อดีที่สุดในพื้นที่ของคุณวันนี้คือ:\n1. ร้านเจ๊น้อย รับซื้อยาง (55.00 บาท/กก.)\n2. สหกรณ์กองทุนยายชา (54.50 บาท/กก.)\nแนะนำให้นำไปขายร้านเจ๊น้อยครับ!';
      } else if (inputLower.includes('ดูแล') || inputLower.includes('ปุ๋ย') || inputLower.includes('สวนยาง')) {
        aiText = '🌱 คำแนะนำการดูแลสวนยางช่วงหน้าฝน:\n- ควรใส่ปุ๋ยสูตร 20-10-12 หรือ 20-8-20 เพื่อบำรุงต้น\n- ระวังโรคใบร่วงและเชื้อราที่หน้ายาง\n- แนะนำให้ทายากันเชื้อราที่หน้ากรีดทุกๆ 7 วันครับ';
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: aiText }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="chat-container card" style={{ display: 'flex', flexDirection: 'column', height: '70vh', padding: 0, overflow: 'hidden' }}>
      <div className="header" style={{ padding: '1rem 1.5rem', margin: 0, borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.9)' }}>
        <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-dark)', margin: 0 }}>
          ✨ FarmPro AI Assistant
        </h2>
      </div>

      <div className="chat-messages" style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#f8fafc' }}>
        {messages.map(msg => (
          <div key={msg.id} className={`chat-bubble-wrapper ${msg.sender === 'user' ? 'user-message' : 'ai-message'}`} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
            <div className="chat-bubble" style={{ 
              maxWidth: '75%', 
              padding: '0.75rem 1rem', 
              borderRadius: '12px',
              whiteSpace: 'pre-line',
              lineHeight: '1.5',
              background: msg.sender === 'user' ? 'var(--primary)' : 'white',
              color: msg.sender === 'user' ? 'white' : 'var(--text-main)',
              boxShadow: 'var(--shadow-sm)',
              borderBottomRightRadius: msg.sender === 'user' ? '2px' : '12px',
              borderBottomLeftRadius: msg.sender === 'ai' ? '2px' : '12px',
              border: msg.sender === 'ai' ? '1px solid var(--border-color)' : 'none'
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: 'white', padding: '0.5rem 1rem', borderRadius: '12px', borderBottomLeftRadius: '2px', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              AI กำลังพิมพ์...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="chat-input-area" style={{ padding: '1rem', borderTop: '1px solid var(--glass-border)', background: 'white', display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="พิมพ์คำถามของคุณที่นี่..."
          className="form-input"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary" style={{ margin: 0, padding: '0.75rem 1.5rem', background: '#10b981' }} disabled={!inputValue.trim() || isTyping}>
          ส่ง
        </button>
      </form>
    </div>
  );
}

export default AIChat;
