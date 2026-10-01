import React, { useState, useRef, useEffect } from 'react';
import {
  MessageCircle, X, Send, Bot, User, Sparkles,
  ChevronDown, RefreshCw, Phone, Mic, MicOff
} from 'lucide-react';
import { askLawLinkGuide } from '../services/geminiService';
import { LegalHelpPanel } from './LegalHelpPanel';

const QUICK_CHIPS = [
  { label: '💰 UPI Fraud', query: 'I received a fake UPI payment request and lost money' },
  { label: '🛡️ Zero FIR', query: 'How do I file a Zero FIR? Police are refusing' },
  { label: '🛒 Refund Denied', query: 'Amazon is refusing my product return refund' },
  { label: '👩 Women Safety', query: 'I am being stalked online, what can I do?' },
  { label: '🏛️ Free Legal Aid', query: 'How do I get free legal aid in India?' },
  { label: '🚗 Traffic Challan', query: 'I got a wrong e-challan, how to contest it?' },
];

const ResponseCard = ({ data }) => {
  const sections = [
    { icon: '🔍', label: 'Situation', text: data.situation },
    { icon: '⚡', label: 'Immediate Action', text: data.immediateAction },
    { icon: '⚖️', label: 'Legal Awareness', text: data.legalAwareness },
    { icon: '📂', label: 'Preserve Evidence', text: data.evidence },
    { icon: '📞', label: 'Where to Get Help', text: data.whereToSeekHelp },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      {sections.map((s, i) => (
        <div key={i} style={{
          background: i === 1 ? 'rgba(79,70,229,0.06)' : 'rgba(0,0,0,0.03)',
          border: i === 1 ? '1px solid rgba(79,70,229,0.15)' : '1px solid rgba(0,0,0,0.06)',
          borderRadius: 8, padding: '0.55rem 0.7rem',
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.7rem', color: i === 1 ? '#4f46e5' : '#374151', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {s.icon} {s.label}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#374151', lineHeight: 1.55 }}>{s.text}</div>
        </div>
      ))}
      <div style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center', padding: '0.2rem 0' }}>
        🔒 Educational info only. Not professional legal advice.
      </div>
    </div>
  );
};

export const FloatingChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{
    id: 'welcome', role: 'bot', type: 'text',
    text: "Hi! 👋 I'm **LawBot**, your AI legal guide. Ask me about your rights, how to file complaints, or what to do in a legal situation.",
    time: new Date()
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showChips, setShowChips] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [showLegalHelp, setShowLegalHelp] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
      setUnreadCount(0);
    }
  }, [isOpen]);

  // Set up Web Speech API
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setVoiceSupported(true);
      const recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => { setIsListening(true); setVoiceError(''); };
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (e) => {
        setIsListening(false);
        if (e.error === 'not-allowed') setVoiceError('Mic permission denied. Please allow microphone access.');
        else if (e.error === 'no-speech') setVoiceError('No speech detected. Try again.');
        else setVoiceError('Voice error. Please try typing.');
        setTimeout(() => setVoiceError(''), 3500);
      };
      recognition.onresult = (e) => {
        // Collect interim + final transcript
        let transcript = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          transcript += e.results[i][0].transcript;
        }
        setInput(transcript);
        // If final result — auto-send
        if (e.results[e.results.length - 1].isFinal) {
          setTimeout(() => {
            if (transcript.trim()) sendMessage(transcript.trim());
          }, 400);
        }
      };
      recognitionRef.current = recognition;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setInput('');
      try { recognitionRef.current.start(); }
      catch (e) { /* already started */ }
    }
  };

  const sendMessage = async (text) => {
    const query = (text || input).trim();
    if (!query || isLoading) return;
    setInput('');
    setShowChips(false);
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', type: 'text', text: query, time: new Date() }]);
    setIsLoading(true);
    try {
      const result = await askLawLinkGuide(query);
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'bot', type: 'response', data: result, time: new Date() }]);
      if (!isOpen) setUnreadCount(c => c + 1);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'bot', type: 'text',
        text: '⚠️ Connection issue. Please try again or call **National Legal Helpline: 15100**.',
        time: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => {
    setMessages([{
      id: 'welcome', role: 'bot', type: 'text',
      text: "Hi! 👋 I'm **LawBot**, your AI legal guide. Ask me about your rights, how to file complaints, or what to do in a legal situation.",
      time: new Date()
    }]);
    setShowChips(true);
    setInput('');
  };

  const renderText = (text) => ({ __html: text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') });

  return (
    <>
      <style>{`
        @keyframes chatBounce { 0%,100%{transform:scale(1)}50%{transform:scale(1.08)} }
        @keyframes chatSlideUp { from{opacity:0;transform:translateY(20px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes typingDot { 0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1} }
        @keyframes msgPop { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        @keyframes micPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 60%{box-shadow:0 0 0 8px rgba(239,68,68,0)} }
        @keyframes micWave { 0%,100%{transform:scaleY(0.4)} 50%{transform:scaleY(1)} }
        .ll-chat-input{flex:1;border:1.5px solid #e2e8f0;border-radius:22px;padding:0.55rem 0.95rem;font-size:0.875rem;font-family:inherit;color:#1e293b;background:#f8fafc;outline:none;resize:none;max-height:90px;transition:border-color 0.2s;line-height:1.4}
        .ll-chat-input:focus{border-color:#6366f1;background:#fff}
        .ll-chat-input.listening{border-color:#ef4444;background:#fff5f5}
        .ll-chat-input::placeholder{color:#94a3b8}
        .ll-chip{padding:0.32rem 0.75rem;border-radius:999px;border:1.5px solid #e2e8f0;background:#fff;font-size:0.73rem;color:#4f46e5;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.18s;font-family:inherit}
        .ll-chip:hover{background:#4f46e5;color:#fff;border-color:#4f46e5}
        .ll-send{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#6366f1);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.18s;box-shadow:0 2px 8px rgba(99,102,241,0.35)}
        .ll-send:hover:not(:disabled){transform:scale(1.1);box-shadow:0 4px 14px rgba(99,102,241,0.45)}
        .ll-send:disabled{opacity:0.45;cursor:not-allowed}
        .ll-mic{width:38px;height:38px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.18s;}
        .ll-mic.idle{background:#f1f5f9;color:#64748b;}
        .ll-mic.idle:hover{background:#e2e8f0;color:#ef4444;}
        .ll-mic.active{background:#ef4444;color:#fff;animation:micPulse 1.2s ease-in-out infinite;}
      `}</style>

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 88, right: 24, width: 56, height: 56,
          borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#6366f1)',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', boxShadow: '0 6px 24px rgba(99,102,241,0.45)',
          zIndex: 1001, animation: isOpen ? 'none' : 'chatBounce 3s ease-in-out infinite',
          transition: 'all 0.2s ease',
        }}
        title="Chat with LawBot"
      >
        {isOpen ? <ChevronDown size={24} color="white" /> : <MessageCircle size={26} color="white" />}
        {!isOpen && unreadCount > 0 && (
          <div style={{ position:'absolute',top:-4,right:-4,width:20,height:20,borderRadius:'50%',background:'#ef4444',color:'#fff',fontSize:'0.65rem',fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid white' }}>
            {unreadCount}
          </div>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: 158, right: 24,
          width: 'min(415px, calc(100vw - 28px))',
          height: 'min(580px, calc(100vh - 170px))',
          background: '#fff', borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.16),0 8px 24px rgba(99,102,241,0.12)',
          border: '1.5px solid rgba(99,102,241,0.15)',
          display: 'flex', flexDirection: 'column',
          zIndex: 1000, overflow: 'hidden',
          animation: 'chatSlideUp 0.28s cubic-bezier(0.16,1,0.3,1)',
        }}>

          {/* Header */}
          <div style={{ background:'linear-gradient(135deg,#4f46e5,#6366f1)', padding:'0.75rem 0.85rem', display:'flex', alignItems:'center', gap:'0.45rem' }}>
            <div style={{ width:34,height:34,borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <Bot size={20} color="white" />
            </div>
            <div style={{ flex:1, minWidth: 0 }}>
              <div style={{ fontWeight:800,fontSize:'0.92rem',color:'#fff',lineHeight:1.1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>LawBot</div>
              <div style={{ fontSize:'0.64rem',color:'rgba(255,255,255,0.8)',marginTop:2,display:'flex',alignItems:'center',gap:4 }}>
                <span style={{ width:6,height:6,borderRadius:'50%',background:'#4ade80',display:'inline-block' }} />
                Gemini AI · Available
              </div>
            </div>

            {/* TOP-RIGHT CORNER: 🆘 Need Legal Help? Button */}
            <button
              id="need-legal-help-btn"
              onClick={() => setShowLegalHelp(prev => !prev)}
              title={showLegalHelp ? "Return to chat" : "Find verified legal support by location"}
              style={{
                background: showLegalHelp ? '#ffffff' : 'rgba(255,255,255,0.18)',
                color: showLegalHelp ? '#4338ca' : '#ffffff',
                border: showLegalHelp ? '1px solid #ffffff' : '1px solid rgba(255,255,255,0.35)',
                borderRadius: 20,
                padding: '0.28rem 0.6rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                flexShrink: 0,
                transition: 'all 0.18s ease',
                boxShadow: showLegalHelp ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!showLegalHelp) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.28)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!showLegalHelp) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.18)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <span>🆘</span>
              <span>Need Legal Help?</span>
            </button>

            <button onClick={clearChat} title="Clear conversation" style={{ color:'rgba(255,255,255,0.8)',background:'none',border:'none',cursor:'pointer',padding:4,display:'flex' }}><RefreshCw size={15} /></button>
            <button onClick={() => { setIsOpen(false); setShowLegalHelp(false); }} title="Close" style={{ color:'rgba(255,255,255,0.8)',background:'none',border:'none',cursor:'pointer',padding:4,display:'flex' }}><X size={18} /></button>
          </div>

          {/* Main Body: Dedicated Legal Help Panel OR Regular LawBot Chat */}
          {showLegalHelp ? (
            <LegalHelpPanel onBackToChat={() => setShowLegalHelp(false)} />
          ) : (
            <>
              {/* Emergency Strip */}
              <div style={{ background:'rgba(239,68,68,0.05)',borderBottom:'1px solid rgba(239,68,68,0.1)',padding:'0.3rem 0.9rem',display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.68rem',color:'#dc2626' }}>
                <Phone size={11} />
                <span><strong>Emergency:</strong> 112 &nbsp;|&nbsp; Cyber: 1930 &nbsp;|&nbsp; Legal Aid: 15100 &nbsp;|&nbsp; Women: 181</span>
              </div>

          {/* Messages */}
          <div style={{ flex:1,overflowY:'auto',padding:'0.85rem',display:'flex',flexDirection:'column',gap:'0.7rem' }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ display:'flex', flexDirection: msg.role==='user'?'row-reverse':'row', alignItems:'flex-start', gap:'0.45rem', animation:'msgPop 0.2s ease' }}>
                <div style={{ width:28,height:28,borderRadius:'50%',flexShrink:0, background: msg.role==='bot'?'linear-gradient(135deg,#4f46e5,#6366f1)':'linear-gradient(135deg,#06b6d4,#0891b2)', display:'flex',alignItems:'center',justifyContent:'center' }}>
                  {msg.role==='bot'?<Bot size={15} color="white"/>:<User size={15} color="white"/>}
                </div>
                <div style={{ maxWidth:'83%' }}>
                  {msg.type==='text' && (
                    <div style={{
                      background: msg.role==='user'?'linear-gradient(135deg,#4f46e5,#6366f1)':'#f1f5f9',
                      color: msg.role==='user'?'#fff':'#1e293b',
                      borderRadius: msg.role==='user'?'16px 4px 16px 16px':'4px 16px 16px 16px',
                      padding:'0.5rem 0.75rem', fontSize:'0.82rem', lineHeight:1.55,
                    }} dangerouslySetInnerHTML={renderText(msg.text)} />
                  )}
                  {msg.type==='response' && (
                    <div style={{ background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'4px 16px 16px 16px',padding:'0.7rem' }}>
                      <div style={{ display:'flex',alignItems:'center',gap:5,marginBottom:'0.45rem' }}>
                        <Sparkles size={12} color="#4f46e5"/>
                        <span style={{ fontSize:'0.68rem',fontWeight:700,color:'#4f46e5',textTransform:'uppercase',letterSpacing:'0.05em' }}>Legal Guide Response</span>
                      </div>
                      <ResponseCard data={msg.data}/>
                    </div>
                  )}
                  <div style={{ fontSize:'0.6rem',color:'#94a3b8',marginTop:2,textAlign:msg.role==='user'?'right':'left',paddingLeft:4 }}>
                    {msg.time.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div style={{ display:'flex',alignItems:'center',gap:'0.45rem',animation:'msgPop 0.2s ease' }}>
                <div style={{ width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#4f46e5,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                  <Bot size={15} color="white"/>
                </div>
                <div style={{ background:'#f1f5f9',borderRadius:'4px 16px 16px 16px',padding:'0.6rem 0.85rem',display:'flex',gap:4,alignItems:'center' }}>
                  {[0,1,2].map(i=>(
                    <div key={i} style={{ width:7,height:7,borderRadius:'50%',background:'#6366f1',animation:`typingDot 1.4s ease-in-out ${i*0.2}s infinite` }}/>
                  ))}
                </div>
              </div>
            )}

            {/* Quick chips */}
            {showChips && !isLoading && (
              <div style={{ marginTop:'0.2rem' }}>
                <div style={{ fontSize:'0.68rem',color:'#94a3b8',fontWeight:600,marginBottom:'0.35rem',paddingLeft:4 }}>Quick questions:</div>
                <div style={{ display:'flex',flexWrap:'wrap',gap:'0.35rem' }}>
                  {QUICK_CHIPS.map((chip,i)=>(
                    <button key={i} className="ll-chip" onClick={()=>sendMessage(chip.query)}>{chip.label}</button>
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div style={{ borderTop:'1px solid #f1f5f9',padding:'0.6rem 0.7rem',background:'#fff' }}>

            {/* Listening indicator bar */}
            {isListening && (
              <div style={{ display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.45rem',padding:'0.35rem 0.75rem',background:'rgba(239,68,68,0.06)',borderRadius:10,border:'1px solid rgba(239,68,68,0.15)' }}>
                <div style={{ display:'flex',gap:3,alignItems:'center' }}>
                  {[0,1,2,3,4].map(i=>(
                    <div key={i} style={{ width:3,height:14,borderRadius:3,background:'#ef4444',animation:`micWave 0.9s ease-in-out ${i*0.12}s infinite` }}/>
                  ))}
                </div>
                <span style={{ fontSize:'0.72rem',color:'#dc2626',fontWeight:600 }}>Listening… speak now</span>
                <button onClick={toggleVoice} style={{ marginLeft:'auto',fontSize:'0.68rem',color:'#dc2626',background:'none',border:'none',cursor:'pointer',fontWeight:700,padding:0 }}>Stop</button>
              </div>
            )}

            {/* Voice error */}
            {voiceError && (
              <div style={{ marginBottom:'0.4rem',fontSize:'0.7rem',color:'#dc2626',padding:'0.3rem 0.5rem',background:'rgba(239,68,68,0.06)',borderRadius:8,border:'1px solid rgba(239,68,68,0.15)' }}>
                ⚠️ {voiceError}
              </div>
            )}

            <div style={{ display:'flex',gap:'0.4rem',alignItems:'flex-end' }}>
              <textarea
                ref={inputRef}
                className={`ll-chat-input${isListening?' listening':''}`}
                placeholder={isListening ? '🎤 Listening…' : 'Ask about your legal rights…'}
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isLoading}
              />

              {/* Mic Button */}
              {voiceSupported && (
                <button
                  className={`ll-mic ${isListening ? 'active' : 'idle'}`}
                  onClick={toggleVoice}
                  disabled={isLoading}
                  title={isListening ? 'Stop recording' : 'Speak your question'}
                >
                  {isListening ? <MicOff size={17}/> : <Mic size={17}/>}
                </button>
              )}

              <button className="ll-send" onClick={()=>sendMessage()} disabled={(!input.trim()&&!isListening)||isLoading}>
                <Send size={17} color="white"/>
              </button>
            </div>

            <div style={{ fontSize:'0.62rem',color:'#94a3b8',textAlign:'center',marginTop:'0.3rem' }}>
              {voiceSupported ? '🎤 Tap mic to speak · Enter to send · Not legal advice' : 'Enter to send · Educational only · Not legal advice'}
            </div>
          </div>
            </>
          )}
        </div>
      )}
    </>
  );
};
