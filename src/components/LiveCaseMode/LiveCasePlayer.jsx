// LAWLINK — Flagship Live Case Mode Player
// Real-time voice interaction with NPC driven by Gemini Live API & Function Calling Game Engine

import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneCall, 
  PhoneOff, 
  ShieldCheck, 
  ShieldAlert, 
  Heart, 
  Scale, 
  Clock, 
  Lightbulb, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Volume2, 
  RotateCcw, 
  Award, 
  MapPin, 
  ChevronRight, 
  X,
  ExternalLink,
  Sliders,
  Flame,
  Zap,
  Info
} from 'lucide-react';
import { AudioVisualizerOrb } from './AudioVisualizerOrb';
import { GeminiLiveSession, speakCallerVoice, stopCallerVoice } from '../../services/geminiLiveService';
import { useGamification } from '../../context/GamificationContext';
import { useLanguage } from '../../context/LanguageContext';
import { sounds } from '../../utils/soundEffects';

export const LiveCasePlayer = ({ caseFile, onBack, onOpenMapWithCategory }) => {
  const { addXp, triggerCelebration } = useGamification();
  const { language, t } = useLanguage();

  // Call States: 'incoming' | 'active' | 'case_closed' | 'case_lost'
  const [callState, setCallState] = useState('incoming');
  const [composure, setComposure] = useState(85);
  const [legalStrength, setLegalStrength] = useState(20);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [tickedEvidenceIds, setTickedEvidenceIds] = useState([]);
  const [triggeredTrapIds, setTriggeredTrapIds] = useState([]);
  const [transcript, setTranscript] = useState([]);
  const [activeHint, setActiveHint] = useState(null);
  const [activeHelplineCard, setActiveHelplineCard] = useState(null);
  const [selectedLegalCard, setSelectedLegalCard] = useState(null);
  const [isNpcSpeaking, setIsNpcSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [engineMode, setEngineMode] = useState('live'); // 'live' | 'fallback'
  const [screenEffect, setScreenEffect] = useState(null); // 'screen-shake' | 'green-glow' | null
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [showPresenterControls, setShowPresenterControls] = useState(false);
  const [coachWhisper, setCoachWhisper] = useState(null);

  // Live session ref
  const liveSessionRef = useRef(null);
  const lastUserActivityTime = useRef(Date.now());
  const transcriptEndRef = useRef(null);
  const ringIntervalRef = useRef(null);

  // Manually replay caller dialogue out loud
  const handleReplayCallerVoice = (customText) => {
    let textToSpeak = customText;
    if (!textToSpeak) {
      // Find latest NPC speech in transcript, or fallback to openingLine
      const lastNpc = [...transcript].reverse().find(t => t.role === 'npc');
      textToSpeak = lastNpc ? lastNpc.text : caseFile.npcPersona.openingLine;
    }

    if (!textToSpeak) return;

    sounds.init();
    setIsNpcSpeaking(true);
    speakCallerVoice(textToSpeak, {
      language,
      voice: caseFile.voice,
      onStart: () => setIsNpcSpeaking(true),
      onEnd: () => setIsNpcSpeaking(false)
    });
  };

  // Quick legal argument click responder
  const handleQuickResponse = (userText) => {
    sounds.playOptionSelect();
    lastUserActivityTime.current = Date.now();
    setCoachWhisper(null);
    if (liveSessionRef.current) {
      liveSessionRef.current.sendUserText(userText);
    }
  };

  // Dynamic quick response options for each phase
  const getQuickResponsesForCurrentPhase = () => {
    if (caseFile.id === 'case_fake_bank_call') {
      if (currentPhaseIndex === 0) {
        return [
          { icon: '🛡️', text: 'I did NOT authorize this transaction. Cancel it immediately.' },
          { icon: '🔒', text: 'I will never share my OTP. Banks never ask for OTP.' },
          { icon: '🏛️', text: 'I will visit my local bank branch to resolve this in person.' }
        ];
      } else if (currentPhaseIndex === 1) {
        return [
          { icon: '🚫', text: 'Sharing OTP is prohibited by RBI. I will not read the code.' },
          { icon: '🚨', text: 'I am reporting this fraudulent call to 1930 Cyber Crime Helpline.' },
          { icon: '⚖️', text: 'Under RBI Zero Liability, customer has no loss if reported quickly.' }
        ];
      } else {
        return [
          { icon: '📞', text: 'I am lodging an official complaint at cybercrime.gov.in and helpline 1930.' },
          { icon: '🏦', text: 'I am locking my card through official net banking portal right now.' },
          { icon: '🛑', text: 'Impersonating a bank official is a criminal offense under BNS.' }
        ];
      }
    } else if (caseFile.id === 'case_consumer_refund') {
      return [
        { icon: '⚖️', text: 'Under Consumer Protection Act 2019, a defective item must be refunded.' },
        { icon: '📦', text: 'Store return policy cannot override statutory consumer rights.' },
        { icon: '🏛️', text: 'I will file a grievance on the National Consumer Helpline 1915.' }
      ];
    } else {
      const unticked = caseFile.evidenceItems.filter(e => !tickedEvidenceIds.includes(e.id));
      if (unticked.length > 0) {
        return unticked.slice(0, 3).map((item, idx) => ({
          icon: idx === 0 ? '⚖️' : idx === 1 ? '🛡️' : '📜',
          text: `I invoke my rights regarding ${item.label.toLowerCase()}.`
        }));
      }
      return [
        { icon: '⚖️', text: 'I know my statutory rights under Indian law.' },
        { icon: '🛡️', text: 'Please follow official legal procedure.' }
      ];
    }
  };

  // Incoming Call Ringing Sound Effect
  useEffect(() => {
    if (callState === 'incoming') {
      sounds.playPhoneRing();
      ringIntervalRef.current = setInterval(() => {
        sounds.playPhoneRing();
      }, 3500);
    } else {
      if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
    }
    return () => {
      if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
    };
  }, [callState]);

  // Elapsed Timer
  useEffect(() => {
    let timer;
    if (callState === 'active') {
      timer = setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callState]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript]);

  // Coach Whisper Silent Timer (if user doesn't speak for 6 seconds)
  useEffect(() => {
    if (callState !== 'active') return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastUserActivityTime.current > 6500 && !isNpcSpeaking && !coachWhisper) {
        // Provide subtle nudge based on current phase
        const currentPhase = caseFile.phases[currentPhaseIndex];
        const nextUnticked = caseFile.evidenceItems.find(e => !tickedEvidenceIds.includes(e.id));
        if (nextUnticked) {
          setCoachWhisper(`Coach Whisper: Try asserting your rights. ${nextUnticked.hint}`);
          setTimeout(() => setCoachWhisper(null), 8000);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [callState, isNpcSpeaking, coachWhisper, currentPhaseIndex, tickedEvidenceIds]);

  // Presenter Controls Keyboard Shortcut (Ctrl+Shift+D or ~)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') || e.key === '`' || e.key === '~') {
        e.preventDefault();
        setShowPresenterControls(prev => !prev);
        sounds.playClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Answer Incoming Call
  const handleAnswerCall = async () => {
    if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
    
    // Unlock and prime browser speech synthesis & Web Audio in synchronous user click
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.resume();
      } catch (e) {}
    }
    sounds.init();
    sounds.playPhonePickup();
    sounds.playClick();
    setCallState('active');
    sounds.playTensionDrone();
    lastUserActivityTime.current = Date.now();

    // Start Live Session
    const session = new GeminiLiveSession({
      caseFile,
      language,
      isDemoMode: caseFile.isDemoFlagship,
      onMeterUpdate: (compDelta, legalDelta, reason) => {
        setComposure(prev => Math.min(100, Math.max(0, prev + compDelta)));
        setLegalStrength(prev => Math.min(100, Math.max(0, prev + legalDelta)));
        if (compDelta < 0 || legalDelta < 0) {
          triggerScreenEffect('screen-shake');
          sounds.playTrapBuzzer();
        } else if (compDelta > 0 || legalDelta > 0) {
          triggerScreenEffect('green-glow');
          sounds.playOptionSelect();
        }
      },
      onEvidenceTick: (itemId) => {
        setTickedEvidenceIds(prev => {
          if (prev.includes(itemId)) return prev;
          sounds.playEvidenceTick();
          triggerScreenEffect('green-glow');
          return [...prev, itemId];
        });
      },
      onPhaseAdvance: (phaseId) => {
        const nextIdx = caseFile.phases.findIndex(p => p.id === phaseId);
        if (nextIdx !== -1) {
          setCurrentPhaseIndex(nextIdx);
        } else {
          setCurrentPhaseIndex(prev => Math.min(caseFile.phases.length - 1, prev + 1));
        }
        sounds.playSuccess();
      },
      onHintShow: (text) => {
        setActiveHint(text);
        setTimeout(() => setActiveHint(null), 6000);
      },
      onTrapTrigger: (trapId) => {
        setTriggeredTrapIds(prev => [...prev, trapId]);
        triggerScreenEffect('screen-shake');
        sounds.playTrapBuzzer();
      },
      onCaseEnd: (outcome, summary) => {
        handleEndCase(outcome, summary);
      },
      onHelplineShow: (key) => {
        const hp = caseFile.knowledgePack.helplines.find(h => h.number === key || h.name.includes(key));
        if (hp) {
          setActiveHelplineCard(hp);
        }
      },
      onTranscript: ({ role, text }) => {
        if (role === 'user') {
          lastUserActivityTime.current = Date.now();
          setCoachWhisper(null);
        }
        setTranscript(prev => [...prev, { role, text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      },
      onStatusChange: ({ status, mode }) => {
        if (mode) setEngineMode(mode);
      },
      onNpcSpeakingChange: (speaking) => {
        setIsNpcSpeaking(speaking);
      },
      onUserSpeakingChange: (speaking) => {
        setIsUserSpeaking(speaking);
        if (speaking) lastUserActivityTime.current = Date.now();
      }
    });

    liveSessionRef.current = session;
    await session.start();
  };

  // Screen Visual Feedback (Shake or Green Glow)
  const triggerScreenEffect = (effectName) => {
    setScreenEffect(effectName);
    setTimeout(() => setScreenEffect(null), 600);
  };

  // Decline / Hangup Call
  const handleHangUp = () => {
    sounds.playClick();
    sounds.stopTensionDrone();
    stopCallerVoice();
    if (liveSessionRef.current) {
      liveSessionRef.current.destroy();
    }
    // Check if player won or lost
    if (tickedEvidenceIds.length >= Math.ceil(caseFile.evidenceItems.length * 0.75) && composure > 30) {
      handleEndCase('won', 'Successfully held your ground against the scammer!');
    } else {
      handleEndCase('lost', 'Call disconnected before statutory resolution was established.');
    }
  };

  // End Case Resolution
  const handleEndCase = async (outcome, summary) => {
    sounds.stopTensionDrone();
    stopCallerVoice();
    if (liveSessionRef.current) {
      liveSessionRef.current.destroy();
    }

    if (outcome === 'won') {
      sounds.playFanfare();
      triggerCelebration();
      setCallState('case_closed');

      // Award XP & Badges
      await addXp(caseFile.rewards.baseXp, `Completed Live Case: ${caseFile.title}`, {
        type: 'LIVE_CASE_WON',
        liveCaseId: caseFile.id,
        composure,
        legalStrength,
        evidenceCount: tickedEvidenceIds.length
      });
    } else {
      sounds.playError();
      setCallState('case_lost');
    }
  };

  // Player manual hint click
  const handleRequestHint = () => {
    sounds.playClick();
    const unticked = caseFile.evidenceItems.find(e => !tickedEvidenceIds.includes(e.id));
    if (unticked) {
      setActiveHint(`Hint: ${unticked.hint}`);
      setComposure(prev => Math.max(10, prev - 5)); // Small composure penalty for hint
      setTimeout(() => setActiveHint(null), 7000);
    }
  };

  // Presenter Controls: Force Actions
  const handleForceAdvance = () => {
    if (currentPhaseIndex < caseFile.phases.length - 1) {
      setCurrentPhaseIndex(prev => prev + 1);
      sounds.playSuccess();
    }
  };

  const handleForceTickEvidence = () => {
    const nextUnticked = caseFile.evidenceItems.find(e => !tickedEvidenceIds.includes(e.id));
    if (nextUnticked) {
      setTickedEvidenceIds(prev => [...prev, nextUnticked.id]);
      setLegalStrength(prev => Math.min(100, prev + 25));
      sounds.playEvidenceTick();
      triggerScreenEffect('green-glow');
    }
  };

  const handleForceWin = () => {
    setTickedEvidenceIds(caseFile.evidenceItems.map(e => e.id));
    setComposure(90);
    setLegalStrength(95);
    handleEndCase('won', 'Presenter Force Win: Perfect legal literacy demonstration!');
  };

  // Calculate Star Rating
  const calculateStars = () => {
    const evidenceRatio = tickedEvidenceIds.length / caseFile.evidenceItems.length;
    if (evidenceRatio >= 0.75 && composure >= 60) return 3;
    if (evidenceRatio >= 0.5 && composure >= 40) return 2;
    return 1;
  };

  // Highlight statutory keywords in live subtitles
  const renderHighlightedTranscriptText = (text) => {
    const keywords = [
      { word: '1930', title: 'National Cyber Crime Helpline', desc: 'Dial 1930 within the 1-2 hour Golden Hour to freeze fraudulent transactions.' },
      { word: 'cybercrime.gov.in', title: 'National Reporting Portal', desc: 'Central statutory portal to lodge official digital cybercrime FIRs.' },
      { word: 'Zero Liability', title: 'RBI Circular 2017', desc: 'Zero customer liability if unauthorized transaction is reported within 3 working days.' },
      { word: 'Section 66D', title: 'IT Act, 2000', desc: 'Punishment for cheating by personation using computer resource — up to 3 years imprisonment.' },
      { word: 'BNS', title: 'Bharatiya Nyaya Sanhita, 2024', desc: 'New criminal code replacing IPC effective July 1, 2024.' },
      { word: 'CPA 2019', title: 'Consumer Protection Act, 2019', desc: 'Statutory shield against defective goods and unfair trade practices.' },
      { word: '1915', title: 'National Consumer Helpline', desc: 'Toll-free consumer grievance helpline managed by Department of Consumer Affairs.' },
      { word: 'e-Daakhil', title: 'e-Daakhil Online Portal', desc: 'Digital filing of consumer disputes before District, State, and National commissions.' },
      { word: 'DigiLocker', title: 'Rule 139 CMVR', desc: 'Electronic driving license and RC on DigiLocker are legally identical to physical originals.' },
      { word: 'Section 134A', title: 'MV Act Good Samaritan Protection', desc: 'Full civil and criminal immunity for assisting road accident victims.' },
      { word: 'POSH', title: 'POSH Act 2013', desc: 'Mandatory Internal Complaints Committee (ICC) in workplaces with 10+ employees.' },
      { word: 'OTP', title: 'One-Time Password', desc: 'Never share OTP with anyone. No legitimate bank official or police will ever ask for OTP.' }
    ];

    let parts = [text];
    keywords.forEach(kw => {
      const newParts = [];
      parts.forEach(part => {
        if (typeof part !== 'string') {
          newParts.push(part);
          return;
        }
        const regex = new RegExp(`(${kw.word})`, 'gi');
        const split = part.split(regex);
        split.forEach(s => {
          if (s.toLowerCase() === kw.word.toLowerCase()) {
            newParts.push(
              <span
                key={Math.random()}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLegalCard(kw);
                  sounds.playOptionSelect();
                }}
                style={{
                  background: 'rgba(99, 102, 241, 0.2)',
                  color: '#4f46e5',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '4px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  borderBottom: '1.5px dotted #4f46e5',
                  margin: '0 2px'
                }}
                title="Tap for Legal Card"
              >
                {s} ℹ️
              </span>
            );
          } else if (s) {
            newParts.push(s);
          }
        });
      });
      parts = newParts;
    });

    return parts;
  };

  return (
    <div className={`live-case-player-container ${screenEffect || ''}`} style={{
      maxWidth: '1100px',
      margin: '0 auto',
      minHeight: '85vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', sans-serif"
    }}>
      <style>{`
        .screen-shake {
          animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }
        .green-glow {
          box-shadow: 0 0 35px rgba(16, 185, 129, 0.35) !important;
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 0.4; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
        @media (max-width: 860px) {
          .live-case-hud-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Top Bar: Case Header & Exit */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem',
        borderBottom: '1px solid #e2e8f0',
        background: '#ffffff',
        borderRadius: '16px 16px 0 0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => {
              if (liveSessionRef.current) liveSessionRef.current.destroy();
              sounds.stopTensionDrone();
              onBack();
            }}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              padding: '0.4rem 0.75rem',
              color: '#475569',
              fontWeight: 600,
              fontSize: '0.825rem',
              cursor: 'pointer'
            }}
          >
            ← Exit Case
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
                {caseFile.title}
              </span>
              {caseFile.isDemoFlagship && (
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                  color: '#ffffff',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px'
                }}>
                  FLAGSHIP DEMO
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {caseFile.topic} • AI Voice NPC: {caseFile.npcPersona.name}
            </div>
          </div>
        </div>

        {/* Engine Status & Presenter Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            background: engineMode === 'live' ? '#ecfdf5' : '#fef3c7',
            color: engineMode === 'live' ? '#059669' : '#d97706',
            border: `1px solid ${engineMode === 'live' ? '#a7f3d0' : '#fde68a'}`
          }}>
            {engineMode === 'live' ? '● Gemini Live WS' : '● Fallback Engine'}
          </span>

          <button
            onClick={() => setShowPresenterControls(prev => !prev)}
            title="Presenter Shortcuts (Ctrl+Shift+D or ~)"
            style={{
              background: showPresenterControls ? '#4f46e5' : '#f1f5f9',
              color: showPresenterControls ? '#ffffff' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              padding: '0.4rem 0.6rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              fontWeight: 700
            }}
          >
            <Sliders size={14} /> Presenter
          </button>
        </div>
      </div>

      {/* Presenter Controls Bar (Hidden by default, toggled via ~ or button) */}
      {showPresenterControls && (
        <div style={{
          background: '#1e293b',
          color: '#ffffff',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          fontSize: '0.8rem',
          borderBottom: '2px solid #3b82f6'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={16} color="#38bdf8" />
            <strong style={{ color: '#38bdf8' }}>Presenter Controls:</strong>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleForceAdvance}
              style={{ background: '#334155', border: '1px solid #475569', color: '#ffffff', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}
            >
              ⏩ Advance Phase
            </button>
            <button
              onClick={handleForceTickEvidence}
              style={{ background: '#334155', border: '1px solid #475569', color: '#ffffff', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}
            >
              ✓ Tick Next Evidence
            </button>
            <button
              onClick={() => {
                setEngineMode(prev => prev === 'live' ? 'fallback' : 'live');
                sounds.playClick();
              }}
              style={{ background: '#334155', border: '1px solid #475569', color: '#ffffff', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}
            >
              🔄 Toggle Fallback
            </button>
            <button
              onClick={handleForceWin}
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', color: '#ffffff', padding: '0.3rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}
            >
              🏆 Instant Win
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. INCOMING CALL SCREEN */}
      {/* ──────────────────────────────────────────────────────────── */}
      {callState === 'incoming' && (
        <div style={{
          flex: 1,
          background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 1.5rem',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle pulsating call aura */}
          <div style={{
            position: 'absolute',
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            animation: 'pulse-ring 2s infinite ease-in-out'
          }} />

          {/* Caller Badge & Avatar */}
          <div style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 40px rgba(239, 68, 68, 0.5)',
            marginBottom: '1.5rem',
            position: 'relative',
            zIndex: 2
          }}>
            <PhoneCall size={44} color="#ffffff" />
          </div>

          <div style={{ textAlign: 'center', zIndex: 2, marginBottom: '2.5rem' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              marginBottom: '0.75rem'
            }}>
              <AlertTriangle size={14} /> {caseFile.callerDisplay.verifiedLabel}
            </div>

            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: '0 0 0.5rem 0', fontFamily: 'var(--font-heading)' }}>
              {caseFile.callerDisplay.name}
            </h1>
            <p style={{ fontSize: '1rem', color: '#94a3b8', margin: '0 0 0.25rem 0' }}>
              {caseFile.callerDisplay.number}
            </p>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
              {caseFile.callerDisplay.location}
            </p>
          </div>

          {/* Scenario Brief Card */}
          <div style={{
            maxWidth: '460px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.06)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '1.25rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            marginBottom: '3rem',
            zIndex: 2
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
              🎯 Mission Objective:
            </div>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              {caseFile.tagline} Use your microphone to respond out loud. Defend against traps and cite statutory Indian laws!
            </div>
          </div>

          {/* Call Action Buttons */}
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', zIndex: 2 }}>
            <button
              onClick={() => onBack()}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#dc2626',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 8px 25px rgba(220, 38, 38, 0.4)'
              }}
              title="Decline"
            >
              <PhoneOff size={28} />
            </button>

            <button
              onClick={handleAnswerCall}
              style={{
                padding: '1rem 2.5rem',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '1.1rem',
                cursor: 'pointer',
                boxShadow: '0 8px 30px rgba(16, 185, 129, 0.4)'
              }}
            >
              <PhoneCall size={24} /> Answer Call
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. ACTIVE IN-CALL HUD */}
      {/* ──────────────────────────────────────────────────────────── */}
      {callState === 'active' && (
        <div className="live-case-hud-grid" style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0'
        }}>
          {/* Main Stage: Caller Visualizer & Live Transcript */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid #e2e8f0',
            background: '#ffffff'
          }}>
            {/* Caller Info Header */}
            <div style={{
              padding: '1rem 1.5rem',
              background: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse-ring 1.5s infinite' }} />
                  <span style={{ fontWeight: 800, fontSize: '1rem' }}>
                    {caseFile.npcPersona.name}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    ({caseFile.npcPersona.role})
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                  {caseFile.callerDisplay.number} • {caseFile.callerDisplay.location}
                </div>
              </div>

              {/* Call Timer */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontFamily: 'monospace',
                fontSize: '1rem',
                background: 'rgba(255,255,255,0.1)',
                padding: '0.3rem 0.6rem',
                borderRadius: '8px'
              }}>
                <Clock size={16} color="#38bdf8" />
                {Math.floor(secondsElapsed / 60)}:{(secondsElapsed % 60).toString().padStart(2, '0')}
              </div>
            </div>

            {/* Orb Visualizer Stage */}
            <div style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
              minHeight: '220px',
              position: 'relative'
            }}>
              <AudioVisualizerOrb
                isNpcSpeaking={isNpcSpeaking}
                isUserSpeaking={isUserSpeaking}
                status="connected"
                mode={engineMode}
                size={140}
              />

              {/* Replay Caller Voice Out Loud */}
              <button
                onClick={() => handleReplayCallerVoice()}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: isNpcSpeaking ? 'rgba(79, 70, 229, 0.45)' : 'rgba(255, 255, 255, 0.12)',
                  backdropFilter: 'blur(8px)',
                  border: isNpcSpeaking ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#ffffff',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '999px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.2s ease',
                  boxShadow: isNpcSpeaking ? '0 0 15px rgba(99, 102, 241, 0.5)' : 'none'
                }}
                title="Hear Caller Voice Aloud"
              >
                <Volume2 size={15} color={isNpcSpeaking ? '#4ade80' : '#38bdf8'} />
                {isNpcSpeaking ? 'Speaking...' : '🔊 Hear Caller Voice'}
              </button>

              {/* Coach Whisper Nudge */}
              {coachWhisper && (
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  background: 'rgba(79, 70, 229, 0.9)',
                  color: '#ffffff',
                  padding: '0.4rem 1rem',
                  borderRadius: '999px',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                  animation: 'modal-slide-in 0.3s ease'
                }}>
                  💡 {coachWhisper}
                </div>
              )}
            </div>

            {/* Live Subtitle Transcript Area */}
            <div style={{
              flex: 1,
              padding: '1.25rem',
              overflowY: 'auto',
              maxHeight: '340px',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Live Subtitles (Tap underlined terms for Legal Card):
              </div>

              {transcript.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                  Call connected. Speak into your microphone to respond...
                </div>
              )}

              {transcript.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: item.role === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    maxWidth: '85%',
                    padding: '0.75rem 1rem',
                    borderRadius: item.role === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    background: item.role === 'user' ? '#4f46e5' : '#ffffff',
                    color: item.role === 'user' ? '#ffffff' : '#0f172a',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: item.role === 'user' ? 'none' : '1px solid #e2e8f0',
                    fontSize: '0.9rem',
                    lineHeight: 1.45
                  }}>
                    {item.role === 'user' ? (
                      item.text
                    ) : (
                      renderHighlightedTranscriptText(item.text)
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '2px' }}>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                      {item.role === 'user' ? 'You' : caseFile.npcPersona.name} • {item.timestamp}
                    </span>
                    {item.role === 'npc' && (
                      <button
                        onClick={() => handleReplayCallerVoice(item.text)}
                        style={{
                          background: 'rgba(99, 102, 241, 0.08)',
                          border: '1px solid rgba(99, 102, 241, 0.2)',
                          borderRadius: '6px',
                          color: '#4f46e5',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          padding: '0.1rem 0.4rem'
                        }}
                        title="Listen to this line again"
                      >
                        <Volume2 size={11} /> Listen
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>

            {/* Quick Legal Counter-Arguments Panel */}
            <div style={{
              padding: '0.75rem 1.25rem',
              background: '#f1f5f9',
              borderTop: '1px solid #e2e8f0',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Zap size={13} color="#6366f1" /> Quick Response (Tap to answer):
                </span>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  Or speak naturally into your mic 🎙️
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                {getQuickResponsesForCurrentPhase().map((phrase, pIdx) => (
                  <button
                    key={pIdx}
                    onClick={() => handleQuickResponse(phrase.text)}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.775rem',
                      fontWeight: 600,
                      color: '#1e293b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                    }}
                  >
                    <span>{phrase.icon}</span>
                    <span>{phrase.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Hint & Helpline Floating Cards */}
            {activeHint && (
              <div style={{
                margin: '0.5rem 1rem',
                padding: '0.6rem 1rem',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
                color: '#1e40af',
                fontSize: '0.825rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Lightbulb size={18} color="#2563eb" />
                <span>{activeHint}</span>
              </div>
            )}

            {activeHelplineCard && (
              <div style={{
                margin: '0.5rem 1rem',
                padding: '0.75rem 1rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldAlert size={20} color="#dc2626" />
                  <div>
                    <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '0.85rem' }}>
                      Verified Emergency Helpline
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#b91c1c' }}>
                      {activeHelplineCard.name}: <strong>{activeHelplineCard.number}</strong>
                    </div>
                  </div>
                </div>
                <a
                  href={`tel:${activeHelplineCard.number}`}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  Dial Now
                </a>
              </div>
            )}

            {/* In-Call Controls Bar */}
            <div style={{
              padding: '1rem',
              background: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={handleRequestHint}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '0.5rem 0.85rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer'
                  }}
                >
                  <Lightbulb size={16} color="#eab308" /> Hint (-5 Composure)
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Microphone Active (Speak clearly)
                </span>
                <button
                  onClick={handleHangUp}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '999px',
                    padding: '0.55rem 1.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)'
                  }}
                >
                  <PhoneOff size={18} /> Hang Up
                </button>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Game HUD Meters & Evidence Checklist */}
          <div style={{
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            background: '#ffffff'
          }}>
            {/* Meters Container */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Live Mission Meters
              </div>

              {/* 1. Composure / Confidence Meter */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0f172a' }}>
                    <Heart size={15} color="#ef4444" /> Composure
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: composure > 50 ? '#10b981' : composure > 25 ? '#f59e0b' : '#ef4444' }}>
                    {composure}%
                  </span>
                </div>
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${composure}%`,
                    background: composure > 50 ? 'linear-gradient(90deg, #10b981, #059669)' : composure > 25 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : '#ef4444',
                    transition: 'width 0.4s ease'
                  }} />
                </div>
              </div>

              {/* 2. Legal Strength Meter */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0f172a' }}>
                    <Scale size={15} color="#4f46e5" /> Legal Strength
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4f46e5' }}>
                    {legalStrength}%
                  </span>
                </div>
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${legalStrength}%`,
                    background: 'linear-gradient(90deg, #4f46e5, #06b6d4)',
                    transition: 'width 0.4s ease'
                  }} />
                </div>
              </div>
            </div>

            {/* Current Phase Tracker */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Phase Progress ({currentPhaseIndex + 1}/{caseFile.phases.length})
              </div>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                {caseFile.phases[currentPhaseIndex]?.title}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.35 }}>
                {caseFile.phases[currentPhaseIndex]?.description}
              </div>
            </div>

            {/* Evidence Checklist */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '1rem',
              flex: 1
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Evidence Checklist
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4f46e5' }}>
                  {tickedEvidenceIds.length}/{caseFile.evidenceItems.length} Hit
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {caseFile.evidenceItems.map(item => {
                  const isHit = tickedEvidenceIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        borderRadius: '8px',
                        background: isHit ? '#ecfdf5' : '#ffffff',
                        border: `1px solid ${isHit ? '#a7f3d0' : '#e2e8f0'}`,
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <CheckCircle2
                        size={18}
                        color={isHit ? '#10b981' : '#cbd5e1'}
                        style={{ flexShrink: 0, marginTop: '2px' }}
                      />
                      <div>
                        <div style={{
                          fontSize: '0.8rem',
                          fontWeight: isHit ? 700 : 500,
                          color: isHit ? '#065f46' : '#334155',
                          textDecoration: isHit ? 'none' : 'none'
                        }}>
                          {item.label}
                        </div>
                        {isHit && (
                          <div style={{ fontSize: '0.65rem', color: '#059669', fontWeight: 700 }}>
                            +{item.points} pts
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legal Safety Banner */}
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1.3 }}>
              LawLink provides educational awareness only. Not formal legal advice.
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 3. CASE CLOSED (WIN SCREEN) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {callState === 'case_closed' && (
        <div style={{
          padding: '2.5rem 1.5rem',
          background: '#ffffff',
          borderRadius: '0 0 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'modal-slide-in 0.4s ease'
        }}>
          {/* Victory Badge & Stars */}
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 12px 35px rgba(16, 185, 129, 0.4)',
            marginBottom: '1rem'
          }}>
            <Award size={44} />
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem' }}>
            {[1, 2, 3].map(starIndex => (
              <span key={starIndex} style={{ fontSize: '2rem', color: starIndex <= calculateStars() ? '#f59e0b' : '#cbd5e1' }}>
                ★
              </span>
            ))}
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
            Case Closed: Victory!
          </h2>
          <p style={{ fontSize: '0.95rem', color: '#64748b', maxWidth: '520px', textAlign: 'center', margin: '0 0 1.5rem 0' }}>
            You stood your ground, identified the pressure tactics, and successfully countered with statutory Indian legal protections!
          </p>

          {/* Rewards Card */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            width: '100%',
            maxWidth: '560px',
            marginBottom: '2rem'
          }}>
            <div style={{
              flex: 1,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                XP Earned
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#4f46e5' }}>
                +{caseFile.rewards.baseXp} XP
              </div>
            </div>

            <div style={{
              flex: 1,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Badge Unlocked
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginTop: '6px' }}>
                <ShieldCheck size={20} /> {caseFile.rewards.badgeId.replace('_', ' ').toUpperCase()}
              </div>
            </div>
          </div>

          {/* Real-World Playbook Card */}
          <div style={{
            width: '100%',
            maxWidth: '680px',
            background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
            border: '1px solid #cbd5e1',
            borderRadius: '20px',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Scale size={22} color="#4f46e5" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Real-World Statutory Playbook
              </h3>
            </div>

            {/* Applicable Acts */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                Key Indian Statutes That Applied:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {caseFile.knowledgePack.acts.map((act, i) => (
                  <div key={i} style={{ fontSize: '0.825rem', color: '#1e293b', background: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <strong>{act.section}</strong> of {act.act} — {act.note}
                  </div>
                ))}
              </div>
            </div>

            {/* Practical Steps */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                What To Do If This Happens To You in Real Life:
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.825rem', color: '#334155', lineHeight: 1.5 }}>
                {caseFile.knowledgePack.steps.map((step, i) => (
                  <li key={i} style={{ marginBottom: '0.25rem' }}>{step}</li>
                ))}
              </ul>
            </div>

            {/* Verified Helplines & Map Action */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
              {caseFile.knowledgePack.helplines.map((hp, i) => (
                <a
                  key={i}
                  href={hp.number ? `tel:${hp.number}` : hp.url}
                  target={hp.url ? '_blank' : '_self'}
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    textDecoration: 'none'
                  }}
                >
                  <PhoneCall size={14} color="#10b981" />
                  {hp.name} {hp.number ? `(${hp.number})` : ''}
                </a>
              ))}

              {onOpenMapWithCategory && (
                <button
                  onClick={() => onOpenMapWithCategory(caseFile.topicId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: '#4f46e5',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <MapPin size={14} /> Find Nearest Legal Aid / Cyber Police on Map
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => {
                setCallState('incoming');
                setComposure(85);
                setLegalStrength(20);
                setCurrentPhaseIndex(0);
                setTickedEvidenceIds([]);
                setTriggeredTrapIds([]);
                setTranscript([]);
                setSecondsElapsed(0);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '0.75rem 1.25rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#334155',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={16} /> Replay Case
            </button>

            <button
              onClick={onBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                border: 'none',
                borderRadius: '12px',
                padding: '0.75rem 1.75rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)'
              }}
            >
              Back to Cases <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 4. CASE LOST (FAIL SCREEN) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {callState === 'case_lost' && (
        <div style={{
          padding: '3rem 1.5rem',
          background: '#ffffff',
          borderRadius: '0 0 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'modal-slide-in 0.4s ease'
        }}>
          <div style={{
            width: '74px',
            height: '74px',
            borderRadius: '50%',
            background: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#dc2626',
            marginBottom: '1rem'
          }}>
            <ShieldAlert size={38} />
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
            Case Lost: Coaching Review
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', maxWidth: '480px', textAlign: 'center', margin: '0 0 1.5rem 0' }}>
            The situation escalated before you established legal resistance. Here is what caught you off guard:
          </p>

          {/* Coaching Recap Box */}
          <div style={{
            maxWidth: '560px',
            width: '100%',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '1.25rem',
            marginBottom: '2rem'
          }}>
            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              💡 What to remember for next time:
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#334155', lineHeight: 1.6 }}>
              {caseFile.evidenceItems.map(item => (
                <li key={item.id} style={{ color: tickedEvidenceIds.includes(item.id) ? '#059669' : '#dc2626' }}>
                  {tickedEvidenceIds.includes(item.id) ? '✓ ' : '✗ '}
                  {item.label}: {item.hint}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => {
                setCallState('incoming');
                setComposure(85);
                setLegalStrength(20);
                setCurrentPhaseIndex(0);
                setTickedEvidenceIds([]);
                setTriggeredTrapIds([]);
                setTranscript([]);
                setSecondsElapsed(0);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                border: 'none',
                borderRadius: '12px',
                padding: '0.75rem 1.75rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#ffffff',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={16} /> Try Again Immediately
            </button>
            <button
              onClick={onBack}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '0.75rem 1.25rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#334155',
                cursor: 'pointer'
              }}
            >
              Back to Catalog
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 5. TAPPABLE LEGAL CARD MODAL */}
      {/* ──────────────────────────────────────────────────────────── */}
      {selectedLegalCard && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '1.5rem',
            maxWidth: '420px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            border: '1px solid #e2e8f0',
            animation: 'modal-slide-in 0.25s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Scale size={20} color="#4f46e5" />
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  {selectedLegalCard.title}
                </h4>
              </div>
              <button
                onClick={() => setSelectedLegalCard(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5, marginBottom: '1rem' }}>
              {selectedLegalCard.desc}
            </div>
            <button
              onClick={() => setSelectedLegalCard(null)}
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '10px',
                background: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.825rem',
                cursor: 'pointer'
              }}
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
