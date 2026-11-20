/* ==========================================
   محرك الصوت الإجرائي (Procedural Web Audio)
   يدعم التحكم بالصوت، الكتم، وتنوع الترددات لكل حدث
   ========================================== */

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume = 0.8;
  private muted = false;

  /** تهيئة سياق الصوت عند أول تفاعل من المستخدم */
  public init(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);

      const bufferSize = this.ctx.sampleRate * 1.0;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  /** تحديث مستوى الصوت والكتم */
  public setVolume(volume: number, muted: boolean): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
  }

  /** إيقاف الصوت مؤقتاً عند الإيقاف المؤقت للعبة */
  public suspend(): void {
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend();
    }
  }

  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private pitchJitter(val: number, variance = 0.06): number {
    return val * (1 + (Math.random() * 2 - 1) * variance);
  }

  private playNoiseBurst(duration: number, filterFreq: number, gainVal: number, q = 1): void {
    if (!this.ctx || !this.noiseBuffer || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(this.pitchJitter(filterFreq), now);
    filter.Q.value = q;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + duration);
  }

  private playTone(
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    duration: number,
    gainVal: number,
    delay = 0,
  ): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(this.pitchJitter(startFreq, 0.05), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  /** تشغيل المؤثر الصوتي بالاسم */
  public play(name: string): void {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'rifle':
        this.playNoiseBurst(0.11, 1400, 0.25, 0.9);
        this.playTone('triangle', 190, 45, 0.09, 0.25);
        break;
      case 'shotgun':
        this.playNoiseBurst(0.28, 650, 0.45, 0.7);
        this.playTone('sawtooth', 130, 28, 0.22, 0.35);
        break;
      case 'sniper':
        this.playNoiseBurst(0.32, 2200, 0.35, 1.5);
        this.playTone('sawtooth', 880, 75, 0.28, 0.22);
        this.playTone('sine', 160, 30, 0.35, 0.4);
        break;
      case 'pistol':
        this.playNoiseBurst(0.07, 1950, 0.2, 1.1);
        this.playTone('triangle', 340, 95, 0.06, 0.2);
        break;
      case 'dmr':
        this.playNoiseBurst(0.16, 1750, 0.28, 1.2);
        this.playTone('sawtooth', 520, 70, 0.14, 0.22);
        break;
      case 'rocketLaunch':
        this.playNoiseBurst(0.35, 520, 0.36, 0.8);
        this.playTone('sawtooth', 240, 58, 0.34, 0.3);
        break;
      case 'rocketBoom':
        this.playNoiseBurst(0.55, 240, 0.5, 0.6);
        this.playTone('sawtooth', 110, 20, 0.5, 0.42);
        break;
      case 'thermalSniper':
        this.playNoiseBurst(0.34, 2600, 0.38, 1.8);
        this.playTone('sine', 1400, 140, 0.32, 0.28);
        this.playTone('sawtooth', 240, 35, 0.36, 0.35);
        break;
      case 'grenadeThrow':
        this.playNoiseBurst(0.12, 800, 0.16, 0.8);
        this.playTone('sine', 300, 540, 0.11, 0.14);
        break;
      case 'grenadeBounce':
        this.playTone('triangle', 420, 180, 0.05, 0.1);
        break;
      case 'grenadeBoom':
        this.playNoiseBurst(0.6, 210, 0.55, 0.55);
        this.playTone('sawtooth', 120, 22, 0.55, 0.46);
        this.playTone('sine', 85, 18, 0.5, 0.4);
        break;
      case 'dash':
        this.playNoiseBurst(0.18, 950, 0.24, 0.7);
        this.playTone('sine', 360, 780, 0.14, 0.16);
        break;
      case 'slide':
        this.playNoiseBurst(0.45, 620, 0.26, 0.65);
        this.playTone('triangle', 165, 58, 0.35, 0.14);
        break;
      case 'slowmo':
        this.playTone('sine', 280, 55, 0.55, 0.28);
        this.playTone('triangle', 640, 180, 0.45, 0.15);
        break;
      case 'bossRoar':
        this.playTone('sawtooth', 110, 36, 0.65, 0.36);
        this.playNoiseBurst(0.5, 300, 0.28, 0.7);
        break;
      case 'bossSlam':
        this.playNoiseBurst(0.5, 190, 0.48, 0.6);
        this.playTone('sine', 130, 24, 0.5, 0.45);
        break;
      case 'bossDeath':
        this.playNoiseBurst(0.8, 220, 0.5, 0.5);
        this.playTone('sawtooth', 160, 22, 0.8, 0.45);
        this.playTone('sawtooth', 260, 40, 0.55, 0.35, 0.22);
        break;
      case 'unlock':
      case 'killstreak':
        this.playTone('sine', 520, 780, 0.16, 0.2, 0);
        this.playTone('sine', 780, 1170, 0.22, 0.22, 0.14);
        this.playTone('sine', 1040, 1560, 0.3, 0.22, 0.28);
        break;
      case 'hit':
        this.playTone('triangle', 950, 600, 0.045, 0.14);
        break;
      case 'headshot':
        this.playTone('sine', 1600, 2200, 0.07, 0.22);
        this.playTone('triangle', 2400, 1800, 0.12, 0.18);
        break;
      case 'enemyDeath':
        this.playNoiseBurst(0.25, 400, 0.22, 0.8);
        this.playTone('sawtooth', 150, 35, 0.24, 0.2);
        break;
      case 'enemyShoot':
        this.playTone('square', 420, 140, 0.12, 0.08);
        break;
      case 'sniperWarn':
        this.playTone('sine', 1100, 1750, 0.18, 0.14, 0);
        this.playTone('sine', 1400, 2100, 0.14, 0.12, 0.18);
        break;
      case 'sniperEnemyShot':
        this.playNoiseBurst(0.22, 2500, 0.3, 1.4);
        this.playTone('sawtooth', 980, 110, 0.22, 0.22);
        break;
      case 'droneAlert':
        this.playTone('sine', 950, 1550, 0.1, 0.14, 0);
        this.playTone('sine', 1300, 1950, 0.14, 0.14, 0.11);
        break;
      case 'shieldBlock':
        this.playTone('sine', 480, 240, 0.09, 0.18);
        this.playTone('triangle', 900, 620, 0.06, 0.1);
        break;
      case 'mortarLaunch':
        this.playTone('sine', 190, 52, 0.25, 0.22);
        this.playNoiseBurst(0.16, 320, 0.18, 0.9);
        break;
      case 'mortarBoom':
        this.playNoiseBurst(0.45, 260, 0.42, 0.6);
        this.playTone('sawtooth', 115, 22, 0.42, 0.35);
        break;
      case 'reload':
        this.playTone('square', 320, 480, 0.06, 0.08, 0);
        this.playTone('square', 520, 740, 0.07, 0.08, 0.18);
        break;
      case 'empty':
        this.playTone('square', 220, 180, 0.04, 0.08);
        break;
      case 'playerHit':
        this.playNoiseBurst(0.14, 300, 0.25, 1);
        this.playTone('sawtooth', 140, 50, 0.16, 0.25);
        break;
      case 'pickup':
        this.playTone('sine', 520, 880, 0.12, 0.15, 0);
        this.playTone('sine', 780, 1180, 0.15, 0.15, 0.09);
        break;
      case 'step':
        this.playNoiseBurst(0.04, 240, 0.04, 1.2);
        break;
      case 'empWarn':
        this.playTone('sine', 620, 1480, 0.32, 0.16, 0);
        this.playTone('triangle', 920, 1840, 0.28, 0.14, 0.36);
        break;
      case 'empBlast':
        this.playNoiseBurst(0.42, 1100, 0.34, 1.4);
        this.playTone('sawtooth', 760, 48, 0.45, 0.28);
        this.playTone('sine', 160, 32, 0.5, 0.32);
        break;
      case 'wave':
        this.playTone('sawtooth', 220, 330, 0.4, 0.14, 0);
        this.playTone('sawtooth', 330, 440, 0.5, 0.14, 0.22);
        break;
      default:
        break;
    }
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
      this.noiseBuffer = null;
    }
  }
}
