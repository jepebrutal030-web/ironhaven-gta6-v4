// All sound is synthesized with WebAudio: a ~100 BPM A-minor loop plus
// effects. Zero audio files. M mutes. Everything is created lazily on the
// first user gesture so autoplay policies never block it.
import { MUSIC_BPM } from './config.js';

const A_MIN = [57, 60, 62, 64, 67, 69, 72]; // A minor pentatonic-ish (MIDI)
const BASS = [33, 33, 36, 31];               // A1 A1 C2 G1 roots

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.step = 0;
    this.engineOsc = null;
    this.engineGain = null;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.master);
      this.startMusic();
    } catch (_) { this.ctx = null; }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  note(freq, t, dur, type, gain, dest) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // 16th-note step sequencer: bass on the beat, a sparse lead, hats on 8ths.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const stepDur = 60 / MUSIC_BPM / 4;
    const tick = () => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.05;
      const s = this.step;
      const bar = Math.floor(s / 16) % 4;
      // bass: root on beats 0 and 8, fifth on 12
      if (s % 16 === 0 || s % 16 === 8) this.note(this.midi(BASS[bar]), t, stepDur * 3.5, 'triangle', 0.5);
      if (s % 16 === 12) this.note(this.midi(BASS[bar] + 7), t, stepDur * 2, 'triangle', 0.3);
      // lead: pentatonic wander, mostly off-beats
      if (s % 4 === 2 && ((s * 7 + bar * 3) % 5) < 3) {
        const n = A_MIN[(s * 5 + bar * 2) % A_MIN.length] + 12;
        this.note(this.midi(n), t, stepDur * 2.5, 'square', 0.08);
      }
      // hat: short noise on every 8th
      if (s % 2 === 0) {
        const nb = this.ctx.createBufferSource();
        const len = Math.floor(this.ctx.sampleRate * 0.03);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        nb.buffer = buf;
        const g = this.ctx.createGain(); g.gain.value = 0.05;
        nb.connect(g); g.connect(this.musicGain);
        nb.start(t);
      }
      this.step = (this.step + 1) % 64;
    };
    this.musicTimer = setInterval(tick, (60 / MUSIC_BPM / 4) * 1000);
  }

  // ---- SFX ----
  blip(freq, dur, type = 'square', gain = 0.2) {
    if (!this.ctx) return;
    this.note(freq, this.ctx.currentTime, dur, type, gain, this.sfxGain);
  }
  shoot() { this.blip(880, 0.08, 'square', 0.18); this.blip(220, 0.12, 'sawtooth', 0.12); }
  hit() { this.blip(1400, 0.05, 'square', 0.15); }
  reload() { this.blip(500, 0.06, 'square', 0.12); setTimeout(() => this.blip(700, 0.06, 'square', 0.12), 120); }
  pickup() { this.blip(660, 0.1, 'sine', 0.2); setTimeout(() => this.blip(990, 0.14, 'sine', 0.2), 90); }
  crash() { this.blip(90, 0.25, 'sawtooth', 0.25); }
  siren() { if (!this.ctx) return; this.blip(950, 0.18, 'sine', 0.05); setTimeout(() => this.blip(1250, 0.18, 'sine', 0.05), 180); }
  door() { this.blip(300, 0.07, 'triangle', 0.12); }
  busted() { this.blip(440, 0.3, 'sawtooth', 0.2); setTimeout(() => this.blip(330, 0.4, 'sawtooth', 0.2), 200); }
  engine(on) {
    if (!this.ctx) return;
    if (on && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.03;
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    } else if (!on && this.engineOsc) {
      try { this.engineOsc.stop(); } catch (_) {}
      this.engineOsc = null; this.engineGain = null;
    }
  }
  setEngine(rpm) {
    if (this.engineOsc) this.engineOsc.frequency.value = 50 + rpm * 60;
  }
}
