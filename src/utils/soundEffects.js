// High-Tech Web Audio API Sound Synthesizer for LAWLINK
// Zero external audio files required — synthesizes crisp, pleasant harmonic frequencies directly

class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = typeof window !== 'undefined' ? localStorage.getItem('lawlink_sound') !== 'false' : true;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound() {
    this.enabled = !this.enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('lawlink_sound', this.enabled ? 'true' : 'false');
    }
    if (this.enabled) {
      this.playClick();
    }
    return this.enabled;
  }

  playClick() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {}
  }

  playSuccess() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Dual harmonic chime (C5 -> E5 -> G5)
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);

        gain.gain.setValueAtTime(0.06, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.35);
      });
    } catch (e) {}
  }

  playError() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.18);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(now + 0.18);
    } catch (e) {}
  }

  playFanfare() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.08);

        gain.gain.setValueAtTime(0.08, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.4);
      });
    } catch (e) {}
  }

  playOptionSelect() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {}
  }

  playBadge() {
    this.playFanfare();
  }

  playPhoneRing() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [0, 0.4].forEach(offset => {
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(400, now + offset);
        osc2.frequency.setValueAtTime(450, now + offset);
        gain.gain.setValueAtTime(0.05, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.35);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);
        osc1.start(now + offset);
        osc2.start(now + offset);
        osc1.stop(now + offset + 0.35);
        osc2.stop(now + offset + 0.35);
      });
    } catch (e) {}
  }

  playEvidenceTick() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const freqs = [880, 1320, 1760]; // Sparkling arpeggio A5, E6, A6
      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);
        gain.gain.setValueAtTime(0.05, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.2);
      });
    } catch (e) {}
  }

  playTrapBuzzer() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.setValueAtTime(120, now + 0.1);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  }

  playTensionDrone() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx || this.droneGain) return;
      const osc = this.ctx.createOscillator();
      this.droneGain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A1 sub-bass rumble
      this.droneGain.gain.setValueAtTime(0.015, this.ctx.currentTime);
      osc.connect(this.droneGain);
      this.droneGain.connect(this.ctx.destination);
      osc.start();
      this.droneOsc = osc;
    } catch (e) {}
  }

  playPhonePickup() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [0, 0.04].forEach((offset) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now + offset);
        osc.frequency.exponentialRampToValueAtTime(150, now + offset + 0.03);
        gain.gain.setValueAtTime(0.08, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.03);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.03);
      });
    } catch (e) {}
  }

  // Realistic Web Audio Acoustic Voice Synthesizer
  // Formant vocal resonance with telephone bandpass filtering (300-3400Hz)
  speakProceduralVoice(text, options = {}) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const words = (text || '').trim().split(/\s+/).slice(0, 18);
      if (words.length === 0) return;

      const baseFreq = options.voice === 'Fenrir' ? 125 : options.voice === 'Puck' ? 185 : 155;
      const startTime = this.ctx.currentTime + 0.05;

      // Telephone bandpass filter (telecom standard 300Hz - 3400Hz)
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, startTime);
      filter.Q.setValueAtTime(0.8, startTime);

      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0.07, startTime);

      filter.connect(masterGain);
      masterGain.connect(this.ctx.destination);

      let wordTime = startTime;
      words.forEach((word, idx) => {
        const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
        const duration = Math.min(0.24, Math.max(0.12, cleanWord.length * 0.035));
        const pause = 0.04;

        const osc = this.ctx.createOscillator();
        const wordGain = this.ctx.createGain();

        osc.type = 'sawtooth';
        const pitchBend = (idx % 3 === 0 ? 1.05 : idx % 2 === 0 ? 0.95 : 1.0) * (idx === words.length - 1 ? 0.88 : 1.0);
        osc.frequency.setValueAtTime(baseFreq * pitchBend, wordTime);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * pitchBend * 0.96, wordTime + duration);

        wordGain.gain.setValueAtTime(0.001, wordTime);
        wordGain.gain.linearRampToValueAtTime(0.08, wordTime + 0.02);
        wordGain.gain.exponentialRampToValueAtTime(0.001, wordTime + duration);

        osc.connect(wordGain);
        wordGain.connect(filter);

        osc.start(wordTime);
        osc.stop(wordTime + duration);

        wordTime += duration + pause;
      });

      setTimeout(() => {
        try {
          filter.disconnect();
          masterGain.disconnect();
        } catch(e) {}
      }, (wordTime - startTime + 0.5) * 1000);

    } catch (e) {
      console.warn('speakProceduralVoice error:', e);
    }
  }

  stopTensionDrone() {
    try {
      if (this.droneGain && this.ctx) {
        this.droneGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.5);
        setTimeout(() => {
          if (this.droneOsc) {
            try { this.droneOsc.stop(); } catch(err) {}
            this.droneOsc = null;
          }
          this.droneGain = null;
        }, 550);
      }
    } catch (e) {}
  }
}

export const sounds = new SoundManager();
