import type { EnemyTypeId, GameSettings, HitZone, MapId } from './types';

/* ==========================================
   القواعد والحسابات المنطقية النقية للعبة
   (منفصلة عن Three.js و React لسهولة الاختبار)
   ========================================== */

export const PLAYER_CONSTANTS = {
  EYE_HEIGHT: 1.75,
  SLIDE_EYE_HEIGHT: 1.0,
  SLIDE_DURATION: 0.85,
  SLIDE_SPEED_START: 17.0,
  SLIDE_SPEED_END: 6.0,
  SLIDE_COOLDOWN: 1.2,
  SLIDE_TILT_DEG: 3.0,
  WALK_SPEED: 9.0,
  SPRINT_SPEED: 13.5,
  ADS_SPEED: 6.4,
  DASH_SPEED: 34.0,
  DASH_DURATION: 0.17,
  MAX_STAMINA: 100,
  STAMINA_DRAIN_RATE: 22,
  STAMINA_REGEN_RATE: 15,
  STAMINA_REGEN_DELAY: 0.8,
  STAMINA_EXHAUST_RECOVERY: 20,
  JUMP_VELOCITY: 9.0,
  SLIDE_JUMP_VELOCITY: 9.4,
  SLIDE_JUMP_BOOST_DURATION: 0.36,
  GRAVITY: 24.0,
  COYOTE_TIME: 0.1,
  JUMP_BUFFER_TIME: 0.12,
  MAX_ENEMIES: 14,
  COMBO_DURATION: 4.0,
  LONG_RANGE_HS_DIST: 30,
  SLOWMO_DURATION: 0.72,
  SLOWMO_TIMESCALE: 0.25,
  GRENADE_DAMAGE: 160,
  GRENADE_RADIUS: 7.5,
  GRENADE_COOLDOWN: 1.1,
  GRENADE_MAX: 4,
} as const;

export const STORAGE_KEYS = {
  BEST_SCORE: 'sniper_protocol_best_score_v1',
  BEST_WAVE: 'sniper_protocol_best_wave_v1',
  SETTINGS: 'sniper_protocol_settings_v1',
} as const;

export const DEFAULT_SETTINGS: GameSettings = {
  sensitivity: 1.0,
  volume: 0.8,
  muted: false,
  quality: 'high',
};

/** حساب سرعة التزحلق المتناقصة بسلاسة من 17 إلى 6 خلال 0.85 ثانية */
export function computeSlideSpeed(remainingTime: number, speedMult = 1.0): number {
  const clamped = Math.max(0, Math.min(PLAYER_CONSTANTS.SLIDE_DURATION, remainingTime));
  const progress = 1 - clamped / PLAYER_CONSTANTS.SLIDE_DURATION;
  const base =
    PLAYER_CONSTANTS.SLIDE_SPEED_START +
    (PLAYER_CONSTANTS.SLIDE_SPEED_END - PLAYER_CONSTANTS.SLIDE_SPEED_START) * progress;
  return base * speedMult;
}

/** حساب مضاعف الكومبو (من x1 حتى x5 كحد أقصى) */
export function computeComboMultiplier(comboCount: number): number {
  if (comboCount <= 1) return 1;
  return Math.min(5, Math.floor(comboCount));
}

/** حساب نقاط القتل الإجمالية مع مكافآت الرأس والمولد ومضاعف الكومبو */
export function computeKillPoints(
  baseScore: number,
  isHeadshot: boolean,
  isGeneratorKill: boolean,
  comboCount: number,
): number {
  const bonus = isHeadshot ? 100 : isGeneratorKill ? 75 : 0;
  return (baseScore + bonus) * computeComboMultiplier(comboCount);
}

/** حساب الضرر النهائي حسب نوع العدو ومنطقة الإصابة */
export function computeHitDamage(params: {
  enemyType: EnemyTypeId;
  rawDmg: number;
  dmgMult: number;
  hitZone: HitZone;
  currentHp: number;
  instantHeadshotKill?: boolean;
}): { damage: number; isCrit: boolean; isShieldBlock: boolean } {
  const { enemyType, rawDmg, dmgMult, hitZone, currentHp, instantHeadshotKill } = params;

  if (enemyType === 'boss') {
    if (hitZone === 'head' || hitZone === 'generator') {
      return { damage: rawDmg * 2.0 * dmgMult, isCrit: true, isShieldBlock: false };
    }
    return { damage: rawDmg * dmgMult, isCrit: false, isShieldBlock: false };
  }

  if (hitZone === 'shield') {
    return { damage: rawDmg * 0.2 * dmgMult, isCrit: false, isShieldBlock: true };
  }

  if (hitZone === 'generator') {
    return { damage: rawDmg * 2.5 * dmgMult, isCrit: true, isShieldBlock: false };
  }

  if (hitZone === 'head') {
    if (instantHeadshotKill) {
      return { damage: Math.max(currentHp, rawDmg * dmgMult), isCrit: true, isShieldBlock: false };
    }
    return { damage: rawDmg * dmgMult, isCrit: true, isShieldBlock: false };
  }

  return { damage: rawDmg * dmgMult, isCrit: false, isShieldBlock: false };
}

/** تحديد مرحلة الباس (1 أو 2 أو 3) بناءً على نسبة الصحة المتبقية */
export function computeBossPhase(hp: number, maxHp: number): 1 | 2 | 3 {
  if (maxHp <= 0) return 3;
  const ratio = hp / maxHp;
  if (ratio <= 0.33) return 3;
  if (ratio <= 0.66) return 2;
  return 1;
}

/** حساب صحة الباس القصوى حسب رقم الموجة */
export function computeBossMaxHp(wave: number): number {
  const bossTier = Math.max(1, Math.floor(wave / 5));
  return 900 + (bossTier - 1) * 550;
}

/** حساب عدد أعداء الموجة العادية */
export function computeWaveEnemyCount(wave: number): number {
  if (wave % 5 === 0) return 1; // موجة الباس
  return 5 + wave * 3;
}

/** اختيار نوع عدو مناسب لرقم الموجة وفق توزيع متوازن */
export function pickEnemyTypeForWave(wave: number, rngValue: number): Exclude<EnemyTypeId, 'boss'> {
  const r = Math.max(0, Math.min(0.9999, rngValue));
  if (wave === 1) {
    return r < 0.55 ? 'rusher' : 'trooper';
  }
  if (wave === 2) {
    if (r < 0.38) return 'rusher';
    if (r < 0.78) return 'trooper';
    return 'drone';
  }
  if (wave === 3) {
    if (r < 0.22) return 'rusher';
    if (r < 0.46) return 'trooper';
    if (r < 0.62) return 'drone';
    if (r < 0.76) return 'shielded';
    if (r < 0.90) return 'mortar';
    return 'heavy';
  }
  if (r < 0.15) return 'rusher';
  if (r < 0.31) return 'trooper';
  if (r < 0.45) return 'drone';
  if (r < 0.59) return 'shielded';
  if (r < 0.73) return 'mortar';
  if (r < 0.88) return 'sniper';
  return 'heavy';
}

export interface KillStreakReward {
  tier: 5 | 10 | 15;
  title: string;
  description: string;
  effect: 'shield_overcharge' | 'tactical_resupply' | 'fury_overdrive';
}

/** فحص ما إذا كان عدد القتلات المتتالية (دون موت) يمنح مكافأة سلسلة قتل */
export function getKillStreakReward(killStreak: number): KillStreakReward | null {
  if (killStreak === 5) {
    return {
      tier: 5,
      title: 'شحن الدرع التكتيكي',
      description: '5 قتلات! استعادة +40 درع وصحة +20',
      effect: 'shield_overcharge',
    };
  }
  if (killStreak === 10) {
    return {
      tier: 10,
      title: 'إمداد جوي فوري',
      description: '10 قتلات! تعبئة الذخيرة +2 قنبلة يدوية',
      effect: 'tactical_resupply',
    };
  }
  if (killStreak === 15 || (killStreak > 15 && killStreak % 10 === 5)) {
    return {
      tier: 15,
      title: 'نمط الغضب القتالي',
      description: `${killStreak} قتلة! +35% ضرر لمدة 12 ثانية`,
      effect: 'fury_overdrive',
    };
  }
  return null;
}

/** التحقق من مرور رصاصة العدو فوق رأس اللاعب أثناء التزحلق */
export function isBulletHittingPlayerHeight(
  bulletY: number,
  playerCameraY: number,
  currentEyeHeight: number,
): boolean {
  const playerFeetY = playerCameraY - currentEyeHeight;
  const playerHeadY = playerCameraY + 0.14;
  return bulletY >= playerFeetY - 0.1 && bulletY <= playerHeadY;
}

/** قراءة وحفظ أعلى نتيجة وأعلى موجة في localStorage بأمان */
export function loadRecords(): { bestScore: number; bestWave: number } {
  try {
    if (typeof localStorage === 'undefined') return { bestScore: 0, bestWave: 0 };
    const bestScore = Math.max(0, parseInt(localStorage.getItem(STORAGE_KEYS.BEST_SCORE) || '0', 10) || 0);
    const bestWave = Math.max(0, parseInt(localStorage.getItem(STORAGE_KEYS.BEST_WAVE) || '0', 10) || 0);
    return { bestScore, bestWave };
  } catch {
    return { bestScore: 0, bestWave: 0 };
  }
}

export function saveRecords(score: number, wave: number): { bestScore: number; bestWave: number; isNewRecord: boolean } {
  const prev = loadRecords();
  const isNewRecord = score > prev.bestScore && score > 0;
  const bestScore = Math.max(prev.bestScore, Math.floor(score));
  const bestWave = Math.max(prev.bestWave, Math.floor(wave));
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.BEST_SCORE, String(bestScore));
      localStorage.setItem(STORAGE_KEYS.BEST_WAVE, String(bestWave));
    }
  } catch {
    // تجاهل أخطاء التخزين في وضع التصفح الخاص
  }
  return { bestScore, bestWave, isNewRecord };
}

export function loadSettings(): GameSettings {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS };
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      sensitivity: typeof parsed.sensitivity === 'number' ? Math.max(0.4, Math.min(2.5, parsed.sensitivity)) : DEFAULT_SETTINGS.sensitivity,
      volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : DEFAULT_SETTINGS.volume,
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SETTINGS.muted,
      quality: parsed.quality === 'low' ? 'low' : 'high',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }
  } catch {
    // تجاهل أخطاء التخزين
  }
}

export function getMapDisplayName(mapId: MapId): string {
  switch (mapId) {
    case 'lab':
      return 'المختبر';
    case 'city':
      return 'مدينة مدمرة';
    case 'desert':
      return 'صحراء مفتوحة';
  }
}
