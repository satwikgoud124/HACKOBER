// LAWLINK — Gemini Live API & Real-Time Voice Game Engine
// Grounded implementation of Gemini Live WebSockets (gemini-3.1-flash-live-preview)
// Native bidirectional 16kHz PCM audio in / 24kHz PCM audio out,
// function calling game-state driver, barge-in / VAD, and bulletproof fallback.

import { GoogleGenAI } from '@google/genai';
import { sounds } from '../utils/soundEffects';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
export const hasGeminiKey = Boolean(
  GEMINI_API_KEY && 
  GEMINI_API_KEY.length > 10 && 
  !GEMINI_API_KEY.includes('YOUR_')
);

/**
 * Voice selection engine: matches best available system/browser voice
 * prioritizing Indian English, conversational English, or user language.
 */
export function getBestSpeechVoice(lang = 'en', voiceName = '') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (voices.length === 0) return null;

  const targetLang = (lang || 'en').toLowerCase();
  const targetPrefix = targetLang === 'hi' ? 'hi' : targetLang === 'te' ? 'te' : 'en';

  // 1. Check for specific Indian English accents (e.g. en-IN)
  let matched = voices.find(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(`${targetPrefix}-in`));
  if (matched) return matched;

  // 2. Check for requested language prefix (e.g. en, hi, te)
  matched = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(targetPrefix));
  if (matched) return matched;

  // 3. Fallback to any English voice
  matched = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en'));
  if (matched) return matched;

  // 4. Default voice
  return voices.find(v => v.default) || voices[0] || null;
}

/**
 * Stop any currently active caller voice synthesis
 */
export function stopCallerVoice() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
  window._lawlinkActiveUtterance = null;
}

/**
 * Ultra-robust dual voice synthesizer:
 * 1. Web SpeechSynthesis with Chrome/Windows GC and pause bug workarounds
 * 2. Automatic watchdog: seamlessly falls back to Web Audio procedural voice if TTS fails or times out
 */
export function speakCallerVoice(text, options = {}) {
  if (!text || typeof window === 'undefined') return;

  const lang = options.language || 'en';
  const voiceName = options.voice || 'Kore';
  const onStart = options.onStart || (() => {});
  const onEnd = options.onEnd || (() => {});

  // Pre-initialize Web Audio context
  sounds.init();

  if (!window.speechSynthesis) {
    // Zero TTS available on system, play procedural acoustic voice
    sounds.speakProceduralVoice(text, { voice: voiceName });
    onStart();
    setTimeout(onEnd, Math.min(4000, Math.max(1200, text.split(' ').length * 150)));
    return;
  }

  try {
    // Unpause speech synthesis (fixes Chrome Windows background pause)
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // Cancel existing utterance with tiny debounce to avoid Chrome race-condition cancellation
    window.speechSynthesis.cancel();

    setTimeout(() => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        const voice = getBestSpeechVoice(lang, voiceName);
        if (voice) {
          utterance.voice = voice;
        }
        utterance.lang = voice?.lang || (lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-IN');
        utterance.rate = 1.02;
        utterance.pitch = voiceName === 'Fenrir' ? 0.88 : voiceName === 'Puck' ? 1.15 : 1.0;

        let started = false;
        let ended = false;

        utterance.onstart = () => {
          started = true;
          onStart();
        };

        utterance.onend = () => {
          ended = true;
          onEnd();
          window._lawlinkActiveUtterance = null;
        };

        utterance.onerror = (err) => {
          console.warn('SpeechSynthesis error, switching to procedural voice fallback:', err);
          if (!ended) {
            ended = true;
            onEnd();
            sounds.speakProceduralVoice(text, { voice: voiceName });
          }
          window._lawlinkActiveUtterance = null;
        };

        // CRITICAL FIX FOR CHROME / WINDOWS:
        // Store utterance on window object to prevent V8 garbage collector from stopping audio mid-sentence
        window._lawlinkActiveUtterance = utterance;

        window.speechSynthesis.speak(utterance);

        // Fallback watchdog: If SpeechSynthesis hasn't started speaking within 750ms,
        // trigger the procedural acoustic formant voice so the user NEVER experiences silence!
        setTimeout(() => {
          if (!started && !ended) {
            console.log('Voice watchdog: triggering procedural acoustic voice fallback');
            sounds.speakProceduralVoice(text, { voice: voiceName });
            onStart();
            setTimeout(onEnd, Math.min(3500, Math.max(1200, text.split(' ').length * 150)));
          }
        }, 750);

      } catch (innerErr) {
        console.warn('Inner SpeechSynthesis error:', innerErr);
        sounds.speakProceduralVoice(text, { voice: voiceName });
        onStart();
        setTimeout(onEnd, 2000);
      }
    }, 45);

  } catch (err) {
    console.warn('Outer speakCallerVoice error:', err);
    sounds.speakProceduralVoice(text, { voice: voiceName });
    onStart();
    setTimeout(onEnd, 2000);
  }
}

// Convert Float32Array from Web Audio to 16-bit PCM ArrayBuffer
function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
}

// Convert Base64 string to Int16Array
function base64ToInt16Array(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

// Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Resample audio buffer to target sample rate
function resampleBuffer(audioBuffer, targetSampleRate, audioCtx) {
  if (audioBuffer.sampleRate === targetSampleRate) return audioBuffer;
  const numChannels = audioBuffer.numberOfChannels;
  const numFrames = Math.round(audioBuffer.length * targetSampleRate / audioBuffer.sampleRate);
  const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
    numChannels,
    numFrames,
    targetSampleRate
  );
  const bufferSource = offlineCtx.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.connect(offlineCtx.destination);
  bufferSource.start(0);
  return offlineCtx.startRendering();
}

/**
 * Gemini Live Session Manager
 */
export class GeminiLiveSession {
  constructor(options = {}) {
    this.caseFile = options.caseFile;
    this.language = options.language || 'en';
    this.isDemoMode = options.isDemoMode || false;
    this.onMeterUpdate = options.onMeterUpdate || (() => {});
    this.onEvidenceTick = options.onEvidenceTick || (() => {});
    this.onPhaseAdvance = options.onPhaseAdvance || (() => {});
    this.onHintShow = options.onHintShow || (() => {});
    this.onTrapTrigger = options.onTrapTrigger || (() => {});
    this.onCaseEnd = options.onCaseEnd || (() => {});
    this.onHelplineShow = options.onHelplineShow || (() => {});
    this.onTranscript = options.onTranscript || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onError = options.onError || (() => {});
    this.onNpcSpeakingChange = options.onNpcSpeakingChange || (() => {});
    this.onUserSpeakingChange = options.onUserSpeakingChange || (() => {});

    this.ws = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.scriptProcessor = null;
    this.micAnalyser = null;
    this.speakerAnalyser = null;
    this.audioQueue = [];
    this.isPlayingAudio = false;
    this.activeSourceNode = null;
    this.isConnected = false;
    this.isFallbackActive = false;
    this.isDestroyed = false;

    // Fallback Speech Recognition & Synthesis
    this.speechRecognition = null;
    this.speechSynth = window.speechSynthesis || null;

    // Next audio play time for seamless streaming
    this.nextAudioStartTime = 0;
  }

  // Pre-Flight Diagnostic Checker
  static async runPreFlightCheck() {
    const results = {
      micPermission: false,
      audioOutput: false,
      geminiKeyConfigured: hasGeminiKey,
      liveWsAccessible: false,
      latencyMs: 0,
      details: {}
    };

    // 1. Check Mic Permission
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        results.micPermission = true;
        // stop test tracks
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (err) {
      results.details.micError = err.message;
    }

    // 2. Check Audio Output & Voice Synthesizers
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const testCtx = new AudioCtx();
        if (testCtx.state === 'suspended') {
          await testCtx.resume();
        }
        results.audioOutput = true;
        await testCtx.close();
      }

      // Check SpeechSynthesis browser voices
      const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
      results.voiceCount = voices.length;
      results.hasSpeechSynthesis = Boolean(window.speechSynthesis);
      results.voiceEngine = voices.length > 0 ? 'SpeechSynthesis + Procedural WebAudio' : 'Procedural WebAudio Synthesizer';
    } catch (err) {
      results.details.audioError = err.message;
    }

    // 3. Test Live WebSocket or Gemini API Handshake
    if (hasGeminiKey) {
      const startTime = performance.now();
      try {
        const testWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
        const ws = new WebSocket(testWsUrl);
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            ws.close();
            resolve(); // timeout is acceptable during precheck
          }, 3000);

          ws.onopen = () => {
            clearTimeout(timer);
            results.liveWsAccessible = true;
            results.latencyMs = Math.round(performance.now() - startTime);
            ws.close();
            resolve();
          };
          ws.onerror = (e) => {
            clearTimeout(timer);
            results.details.wsError = 'Direct WS handshake requires live token or session.';
            resolve();
          };
        });
      } catch (e) {
        results.details.apiError = e.message;
      }
    }

    return results;
  }

  // Build grounded system prompt for Gemini Live model
  buildSystemPrompt() {
    const { caseFile, language, isDemoMode } = this;
    const { npcPersona, knowledgePack, evidenceItems, traps, phases } = caseFile;

    const langInstruction = language === 'hi' 
      ? 'Speak predominantly in Hindi (or natural conversational Hinglish). Understand Hindi, English, and mixed Hinglish from user.'
      : language === 'te'
      ? 'Speak predominantly in Telugu (or English with Telugu terms). Understand Telugu and English from user.'
      : 'Speak predominantly in Indian English / natural conversational Hinglish. Understand English, Hindi, and Hinglish.';

    return `
You are roleplaying as the non-player character (NPC) "${npcPersona.name}" in an interactive, voice-first legal awareness game called "LawLink Live Case Mode".
Your Role: ${npcPersona.role}
Character Tone: ${npcPersona.tone}
Dialogue Style: ${npcPersona.dialogueStyle}
Language: ${langInstruction}

GAMEPLAY ENGINE RULES:
1. STRICTLY STAY IN CHARACTER as ${npcPersona.name}. Speak in short, punchy turns (maximum 1 to 2 sentences per turn). Do not lecture or write paragraphs. Keep the tension high.
2. YOU DRIVE THE GAME VIA FUNCTION CALLING. Call appropriate game functions whenever relevant:
   - 'update_meters(composure_delta, legal_strength_delta, reason)': Adjust meters when the player stays composed or makes a legal mistake.
   - 'tick_evidence(item_id)': Call this immediately whenever the player mentions a matching legal concept or right from the Evidence Checklist below!
   - 'advance_phase(phase_id)': Advance to the next phase when the player successfully counters current pressure or when traps trigger transition.
   - 'show_hint(text)': Call if the player seems stuck or silent to give a subtle opening.
   - 'trigger_trap(trap_id)': Call if the player agrees to an unlawful demand (e.g. sharing OTP, agreeing to pay bribe).
   - 'end_case(outcome, summary)': Call with outcome "won" when all key evidence items are hit, or "lost" if meters are depleted.
   - 'show_helpline(key)': Call to display a verified helpline card (e.g. '1930', '1915', '112').
3. ${isDemoMode ? 'DEMO MODE ACTIVE: Be tough and realistic, but be generous with evidence recognition. If the player says "no otp", "cyber crime", "1930", or refuses firmly, acknowledge the resistance and tick the evidence immediately!' : 'Be fair, tough, and realistic.'}
4. SAFETY RULE: This is a simulation. You never claim to be a real official or demand real personal passwords. If the user expresses a REAL emergency or extreme distress, break character calmly and call 'show_helpline' with '112'.

CURRENT CASE: "${caseFile.title}"
Current Phase: Phase 1 (${phases[0]?.title})

EVIDENCE CHECKLIST (Call 'tick_evidence' with exact 'id' when player hits the concept):
${JSON.stringify(evidenceItems.map(e => ({ id: e.id, label: e.label, acceptedConcepts: e.acceptedConcepts })), null, 2)}

TRAPS TO ENFORCE (Call 'trigger_trap' with 'id' if player falls into it):
${JSON.stringify(traps.map(t => ({ id: t.id, name: t.name, triggerPhrases: t.triggerPhrases })), null, 2)}

STATUTORY KNOWLEDGE PACK (Grounded Indian Law):
Acts: ${knowledgePack.acts.map(a => `${a.section} of ${a.act} (${a.note})`).join('; ')}
Rights: ${knowledgePack.rights.join('; ')}
Verified Helplines: ${knowledgePack.helplines.map(h => `${h.name}: ${h.number || h.url}`).join('; ')}

OPENING LINE:
Start immediately by saying your exact opening line:
"${npcPersona.openingLine}"
`;
  }

  // Connect to Gemini Live API WebSocket
  async start() {
    this.isDestroyed = false;
    this.onStatusChange({ status: 'connecting', mode: 'live' });

    // Initialize Web Audio Context
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioCtx({ sampleRate: 24000 });
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Create Analyser nodes for visualizer
    this.micAnalyser = this.audioContext.createAnalyser();
    this.micAnalyser.fftSize = 64;
    this.speakerAnalyser = this.audioContext.createAnalyser();
    this.speakerAnalyser.fftSize = 64;

    // Attempt Live WebSocket connection if API key is present
    if (hasGeminiKey) {
      try {
        await this.connectLiveWebSocket();
        return;
      } catch (err) {
        console.warn('Gemini Live WebSocket connection failed, switching to Fallback Mode:', err);
      }
    }

    // If no key or Live WS failed, start Fallback Engine seamlessly
    await this.startFallbackMode();
  }

  // Live WebSocket Connection
  async connectLiveWebSocket() {
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
    this.ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timed out'));
      }, 8000);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        this.isConnected = true;
        this.isFallbackActive = false;
        this.onStatusChange({ status: 'connected', mode: 'live' });

        // Send initial setup message
        this.sendSetupMessage();

        // Prompt Gemini Live model to immediately speak the opening line of the case
        setTimeout(() => {
          if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            const initialTurn = {
              clientContent: {
                turns: [
                  {
                    role: 'user',
                    parts: [{ text: `The phone call has connected. Speak your character opening line out loud right now with urgency: "${this.caseFile.npcPersona.openingLine}"` }]
                  }
                ],
                turnComplete: true
              }
            };
            this.ws.send(JSON.stringify(initialTurn));
          }
        }, 500);

        resolve();
      };

      this.ws.onerror = (e) => {
        clearTimeout(timeout);
        reject(new Error('WebSocket handshake error'));
      };
    });

    this.ws.onmessage = async (event) => {
      if (this.isDestroyed) return;
      try {
        let data = event.data;
        if (data instanceof Blob) {
          data = await data.text();
        }
        const msg = JSON.parse(data);
        this.handleServerMessage(msg);
      } catch (e) {
        console.error('Error parsing live WS message:', e);
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      if (!this.isDestroyed && !this.isFallbackActive) {
        console.warn('Live WebSocket closed unexpectedly, switching to Fallback Mode');
        this.startFallbackMode();
      }
    };

    // Start streaming mic audio to WebSocket
    await this.startMicrophoneCapture();
  }

  // Send initial Live setup configuration
  sendSetupMessage() {
    const setupMsg = {
      setup: {
        model: 'models/gemini-3.1-flash-live-preview',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.caseFile.voice || 'Kore'
              }
            }
          }
        },
        systemInstruction: {
          parts: [{ text: this.buildSystemPrompt() }]
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'update_meters',
                description: 'Adjust the player composure and legal strength meters based on their response.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    composure_delta: { type: 'NUMBER', description: 'Change in composure (-30 to +20)' },
                    legal_strength_delta: { type: 'NUMBER', description: 'Change in legal strength (-30 to +30)' },
                    reason: { type: 'STRING', description: 'Brief reason for meter update' }
                  },
                  required: ['composure_delta', 'legal_strength_delta', 'reason']
                }
              },
              {
                name: 'tick_evidence',
                description: 'Mark an evidence checklist item as discovered when the player mentions the correct legal right or act.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    item_id: { type: 'STRING', description: 'ID of the evidence item from case file' }
                  },
                  required: ['item_id']
                }
              },
              {
                name: 'advance_phase',
                description: 'Advance the case to the next phase when criteria are met.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    phase_id: { type: 'STRING', description: 'ID of the phase to advance to' }
                  },
                  required: ['phase_id']
                }
              },
              {
                name: 'show_hint',
                description: 'Provide a subtle in-character hint or opening when the player is stuck.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    text: { type: 'STRING', description: 'Subtle hint text' }
                  },
                  required: ['text']
                }
              },
              {
                name: 'trigger_trap',
                description: 'Trigger a trap penalty when the player falls for scammer bluff or panics.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    trap_id: { type: 'STRING', description: 'ID of the trap triggered' }
                  },
                  required: ['trap_id']
                }
              },
              {
                name: 'end_case',
                description: 'End the case with outcome won or lost.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    outcome: { type: 'STRING', enum: ['won', 'lost'], description: 'Final outcome' },
                    summary: { type: 'STRING', description: 'Brief final verdict summary' }
                  },
                  required: ['outcome', 'summary']
                }
              },
              {
                name: 'show_helpline',
                description: 'Display a verified emergency helpline card from the statutory directory.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    key: { type: 'STRING', description: 'Helpline identifier e.g. 1930, 1915, 112' }
                  },
                  required: ['key']
                }
              }
            ]
          }
        ],
        inputAudioTranscription: {},
        outputAudioTranscription: {}
      }
    };

    this.ws.send(JSON.stringify(setupMsg));
  }

  // Handle incoming messages from Gemini Live server
  handleServerMessage(msg) {
    if (!msg) return;

    // Handle audio chunks and transcriptions
    if (msg.serverContent) {
      const { modelTurn, inputTranscription, outputTranscription, interrupted } = msg.serverContent;

      // Handle barge-in interruption signal
      if (interrupted) {
        this.clearAudioQueue();
        this.onNpcSpeakingChange(false);
      }

      // Handle NPC audio streaming
      if (modelTurn?.parts) {
        for (const part of modelTurn.parts) {
          if (part.inlineData?.data) {
            this.enqueuePcmAudio(part.inlineData.data);
          }
        }
      }

      // Handle User speech transcription
      if (inputTranscription?.text) {
        this.onTranscript({ role: 'user', text: inputTranscription.text });
        // Perform client-side heuristic verification as safety reinforcement
        this.checkClientEvidenceHeuristics(inputTranscription.text);
      }

      // Handle NPC speech transcription
      if (outputTranscription?.text) {
        this.onTranscript({ role: 'npc', text: outputTranscription.text });
      }
    }

    // Handle tool call (Game Engine functions)
    if (msg.toolCall?.functionCalls) {
      const responses = [];
      for (const call of msg.toolCall.functionCalls) {
        const result = this.executeGameFunction(call.name, call.args);
        responses.push({
          response: { output: { status: 'success', result } },
          id: call.id
        });
      }

      // Send tool response back to Gemini Live
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          toolResponse: {
            functionResponses: responses
          }
        }));
      }
    }
  }

  // Execute game engine function calls from Gemini
  executeGameFunction(name, args) {
    switch (name) {
      case 'update_meters':
        this.onMeterUpdate(args.composure_delta, args.legal_strength_delta, args.reason);
        return { updated: true };

      case 'tick_evidence':
        this.onEvidenceTick(args.item_id);
        return { ticked: true, item: args.item_id };

      case 'advance_phase':
        this.onPhaseAdvance(args.phase_id);
        return { advancedTo: args.phase_id };

      case 'show_hint':
        this.onHintShow(args.text);
        return { shown: true };

      case 'trigger_trap':
        this.onTrapTrigger(args.trap_id);
        return { trapTriggered: args.trap_id };

      case 'end_case':
        this.onCaseEnd(args.outcome, args.summary);
        return { finished: true };

      case 'show_helpline':
        this.onHelplineShow(args.key);
        return { helplineShown: args.key };

      default:
        console.warn('Unknown function call from Gemini:', name);
        return { error: 'Unknown function' };
    }
  }

  // Client-side heuristic evidence & trap detection
  checkClientEvidenceHeuristics(userText) {
    const textLower = userText.toLowerCase();

    // Check evidence items
    for (const item of this.caseFile.evidenceItems) {
      for (const concept of item.acceptedConcepts) {
        if (textLower.includes(concept.toLowerCase())) {
          this.onEvidenceTick(item.id);
          this.onMeterUpdate(5, 10, `Invoked ${item.label}`);
          break;
        }
      }
    }

    // Check traps
    for (const trap of this.caseFile.traps) {
      for (const phrase of trap.triggerPhrases) {
        if (textLower.includes(phrase.toLowerCase())) {
          this.onTrapTrigger(trap.id);
          this.onMeterUpdate(trap.penalty.composure, trap.penalty.legalStrength, `Trap: ${trap.name}`);
          break;
        }
      }
    }
  }

  // Start microphone capture and stream 16kHz PCM chunks
  async startMicrophoneCapture() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(this.mediaStream);
      
      // Connect to mic analyser
      source.connect(this.micAnalyser);

      // 4096 buffer size at 16kHz = ~256ms chunk
      this.scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(audioCtx.destination);

      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Detect speaking activity
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += Math.abs(inputData[i]);
        }
        const avg = sum / inputData.length;
        const isSpeaking = avg > 0.015;
        this.onUserSpeakingChange(isSpeaking);

        // If user interrupts NPC while speaking, stop playback
        if (isSpeaking && this.isPlayingAudio) {
          this.clearAudioQueue();
        }

        // Convert to 16-bit PCM and send to Gemini Live
        const pcmBuffer = floatTo16BitPCM(inputData);
        const base64Audio = arrayBufferToBase64(pcmBuffer);

        const inputMsg = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: 'audio/pcm;rate=16000',
                data: base64Audio
              }
            ]
          }
        };
        this.ws.send(JSON.stringify(inputMsg));
      };
    } catch (err) {
      console.warn('Microphone capture error:', err);
      this.onError('Microphone access denied or unavailable: ' + err.message);
    }
  }

  // Enqueue 24kHz PCM audio chunks from Gemini Live for smooth playback
  enqueuePcmAudio(base64Data) {
    try {
      const int16 = base64ToInt16Array(base64Data);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      this.audioQueue.push(audioBuffer);
      if (!this.isPlayingAudio) {
        this.playNextAudioChunk();
      }
    } catch (e) {
      console.error('Error decoding audio chunk:', e);
    }
  }

  // Play next audio buffer in queue
  playNextAudioChunk() {
    if (this.audioQueue.length === 0) {
      this.isPlayingAudio = false;
      this.onNpcSpeakingChange(false);
      return;
    }

    this.isPlayingAudio = true;
    this.onNpcSpeakingChange(true);

    const buffer = this.audioQueue.shift();
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    // Connect to speaker analyser and audio destination
    source.connect(this.speakerAnalyser);
    this.speakerAnalyser.connect(this.audioContext.destination);

    this.activeSourceNode = source;

    const currentTime = this.audioContext.currentTime;
    if (this.nextAudioStartTime < currentTime) {
      this.nextAudioStartTime = currentTime;
    }

    source.start(this.nextAudioStartTime);
    this.nextAudioStartTime += buffer.duration;

    source.onended = () => {
      this.playNextAudioChunk();
    };
  }

  // Clear queued audio and stop active playback (used during barge-in)
  clearAudioQueue() {
    this.audioQueue = [];
    if (this.activeSourceNode) {
      try {
        this.activeSourceNode.stop();
        this.activeSourceNode.disconnect();
      } catch (e) {}
      this.activeSourceNode = null;
    }
    this.isPlayingAudio = false;
    this.nextAudioStartTime = this.audioContext ? this.audioContext.currentTime : 0;
    this.onNpcSpeakingChange(false);
  }

  // Send user text response (works seamlessly for both Live WebSocket and Fallback mode)
  async sendUserText(userText) {
    if (!userText || !userText.trim() || this.isDestroyed) return;
    const text = userText.trim();
    this.onTranscript({ role: 'user', text });

    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN && !this.isFallbackActive) {
      try {
        const clientMsg = {
          clientContent: {
            turns: [
              {
                role: 'user',
                parts: [{ text }]
              }
            ],
            turnComplete: true
          }
        };
        this.ws.send(JSON.stringify(clientMsg));
        this.checkClientEvidenceHeuristics(text);
        return;
      } catch (err) {
        console.warn('Error sending user text over live WS:', err);
      }
    }

    // Process via Fallback engine
    await this.processUserSpeechInFallback(text);
  }

  // ────────────────────────────────────────────────────────────────
  // BULLETPROOF FALLBACK ENGINE (Guarantees zero dead screen)
  // Uses Web Speech Recognition + Gemini Text API / Heuristics + SpeechSynthesis
  // ────────────────────────────────────────────────────────────────
  async startFallbackMode() {
    this.isFallbackActive = true;
    this.onStatusChange({ status: 'connected', mode: 'fallback' });

    // Speak initial opening line after phone pickup sound completes
    const opening = this.caseFile.npcPersona.openingLine;
    this.onTranscript({ role: 'npc', text: opening });
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.speakWithSynthesis(opening);
      }
    }, 320);

    // Setup Web Speech Recognition if available
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = false;
      this.speechRecognition.lang = this.language === 'hi' ? 'hi-IN' : this.language === 'te' ? 'te-IN' : 'en-IN';

      this.speechRecognition.onresult = async (event) => {
        const lastIdx = event.results.length - 1;
        const transcript = event.results[lastIdx][0].transcript;
        if (transcript && transcript.trim()) {
          this.onTranscript({ role: 'user', text: transcript });
          await this.processUserSpeechInFallback(transcript);
        }
      };

      this.speechRecognition.onerror = (e) => {
        console.warn('SpeechRecognition error:', e.error);
      };

      try {
        this.speechRecognition.start();
      } catch (e) {}
    }
  }

  // Process user speech in fallback mode
  async processUserSpeechInFallback(userText) {
    this.checkClientEvidenceHeuristics(userText);

    // Call Gemini Standard API if key is available to generate dynamic response
    if (hasGeminiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        const prompt = `
${this.buildSystemPrompt()}

User said: "${userText}"

Reply in short (1-2 sentences) in character as ${this.caseFile.npcPersona.name}.
Include any meter updates or evidence ticks if applicable.
Return JSON: { "reply": "...", "composureDelta": 0, "legalDelta": 0, "tickEvidenceId": null, "advancePhaseId": null }
`;
        const res = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { responseMimeType: 'application/json' }
        });

        const parsed = JSON.parse(res.text || '{}');
        if (parsed.reply) {
          this.onTranscript({ role: 'npc', text: parsed.reply });
          this.speakWithSynthesis(parsed.reply);
        }
        if (parsed.tickEvidenceId) {
          this.onEvidenceTick(parsed.tickEvidenceId);
        }
        if (parsed.composureDelta || parsed.legalDelta) {
          this.onMeterUpdate(parsed.composureDelta || 0, parsed.legalDelta || 0, 'Response evaluation');
        }
        if (parsed.advancePhaseId) {
          this.onPhaseAdvance(parsed.advancePhaseId);
        }
        return;
      } catch (err) {
        console.warn('Gemini text fallback error:', err);
      }
    }

    // Pure deterministic scripted dialogue fallback
    this.processScriptedFallback(userText);
  }

  // Pure scripted response fallback when completely offline
  processScriptedFallback(userText) {
    const textLower = userText.toLowerCase();
    const caseId = this.caseFile.id;
    let npcReply = '';

    if (caseId === 'case_fake_bank_call') {
      if (textLower.includes('no') || textLower.includes('otp') || textLower.includes('refuse') || textLower.includes('nahi')) {
        npcReply = 'Listen to me carefully! If you don\'t give the verification code right now, your account will be permanently blacklisted!';
        this.onMeterUpdate(10, 15, 'Firm refusal of OTP');
      } else if (textLower.includes('1930') || textLower.includes('police') || textLower.includes('cyber')) {
        npcReply = 'What 1930?! You think you know the law?! Fine, you will see your balance go to zero!';
        this.onMeterUpdate(15, 20, 'Invoked Cyber Crime Helpline 1930');
        this.onPhaseAdvance('phase_resolution');
      } else if (textLower.includes('branch') || textLower.includes('rbi') || textLower.includes('portal')) {
        npcReply = 'Fine, go to your branch! The fraud has already been detected. *Click*';
        this.onCaseEnd('won', 'Scammer hung up after being challenged with statutory procedures!');
      } else {
        npcReply = 'Sir, your time is running out! Just confirm the 6 digits you received on SMS right now!';
      }
    } else if (caseId === 'case_consumer_refund') {
      if (textLower.includes('cpa') || textLower.includes('consumer') || textLower.includes('law') || textLower.includes('rights')) {
        npcReply = 'Sir, you cannot threaten us with Consumer Act. But... fine, let me see if my supervisor can approve a one-time refund exception.';
        this.onMeterUpdate(10, 20, 'Cited Consumer Protection Act');
      } else if (textLower.includes('1915') || textLower.includes('edaakhil') || textLower.includes('court')) {
        npcReply = 'Please do not file on e-Daakhil. I am approving the full 100% refund back to your original payment method today.';
        this.onCaseEnd('won', 'E-commerce manager backed down and processed full statutory refund!');
      } else {
        npcReply = 'As I said, store policy does not permit refunds on opened boxes.';
      }
    } else {
      npcReply = 'I hear what you are saying, but let us follow official legal protocol.';
    }

    this.onTranscript({ role: 'npc', text: npcReply });
    this.speakWithSynthesis(npcReply);
  }

  // Voice output using resilient dual voice engine (SpeechSynthesis + Procedural WebAudio)
  speakWithSynthesis(text) {
    speakCallerVoice(text, {
      language: this.language,
      voice: this.caseFile.voice,
      onStart: () => this.onNpcSpeakingChange(true),
      onEnd: () => this.onNpcSpeakingChange(false)
    });
  }

  // Clean up all resources, sockets, and audio streams
  destroy() {
    this.isDestroyed = true;
    this.isConnected = false;

    stopCallerVoice();

    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }

    if (this.speechRecognition) {
      try { this.speechRecognition.stop(); } catch (e) {}
      this.speechRecognition = null;
    }

    if (this.speechSynth) {
      try { this.speechSynth.cancel(); } catch (e) {}
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.scriptProcessor) {
      try { this.scriptProcessor.disconnect(); } catch (e) {}
      this.scriptProcessor = null;
    }

    this.clearAudioQueue();

    if (this.audioContext) {
      try { this.audioContext.close(); } catch (e) {}
      this.audioContext = null;
    }

    this.onStatusChange({ status: 'disconnected', mode: 'idle' });
  }
}
