import type {
  BossArchetypeId,
  EliteAffixId,
  EnemyTypeId,
  GameSettings,
  HitZone,
  MapId,
  WaveMutatorId,
  WaveMutatorInfo,
} from './types';

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
  JAMMER_EMP_INTERVAL: 8.0,
  JAMMER_EMP_WARNING: 1.0,
  JAMMER_EMP_RADIUS: 18.0,
  JAMMER_EMP_DISABLE_DURATION: 3.0,
  GHOST_REVEAL_DURATION: 2.0,
  ELITE_MIN_WAVE: 6,
  ELITE_CHANCE: 0.15,
  ELITE_SPEED_MULT: 1.4,
  ELITE_REGEN_PER_SEC: 3.0,
  ELITE_ARMORED_BODY_MULT: 0.5,
  ELITE_EXPLOSION_RADIUS: 6.5,
  ELITE_EXPLOSION_DAMAGE: 32,
  MUTATOR_BANNER_DURATION_MS: 4000,
  SWARM_PACK_SIZE: 6,
  SWARM_DRONE_HP: 15,
  KAMIKAZE_BLAST_RADIUS: 4.8,
  KAMIKAZE_BLAST_DAMAGE: 28,
  ENGINEER_SHIELD_DR_MULT: 0.45,
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

export interface EliteAffixMeta {
  id: EliteAffixId;
  name: string;
  color: string;
  colorHex: number;
}

/** بيانات صفات أعداء النخبة (تظهر من الموجة 6 بنسبة 15%) */
export const ELITE_AFFIXES: Record<EliteAffixId, EliteAffixMeta> = {
  explosive: {
    id: 'explosive',
    name: 'متفجر عند الموت',
    color: '#f97316',
    colorHex: 0xf97316,
  },
  swift: {
    id: 'swift',
    name: 'سريع (+40%)',
    color: '#38bdf8',
    colorHex: 0x38bdf8,
  },
  regenerating: {
    id: 'regenerating',
    name: 'متجدد (+3/ث)',
    color: '#4ade80',
    colorHex: 0x4ade80,
  },
  armored: {
    id: 'armored',
    name: 'مُدرَّع (-50% جسم)',
    color: '#eab308',
    colorHex: 0xeab308,
  },
};

export const ELITE_AFFIX_LIST: EliteAffixId[] = ['explosive', 'swift', 'regenerating', 'armored'];

/** تحديد ما إذا كان العدو نخبة واختيار صفة عشوائية له (بدءاً من الموجة 6 بنسبة 15% لغير الباس) */
export function rollEliteAffix(
  wave: number,
  isBoss: boolean,
  chanceRng: number,
  affixRng: number,
): EliteAffixId | null {
  if (isBoss || wave < PLAYER_CONSTANTS.ELITE_MIN_WAVE) return null;
  if (chanceRng >= PLAYER_CONSTANTS.ELITE_CHANCE) return null;
  const clamped = Math.max(0, Math.min(0.9999, affixRng));
  const idx = Math.floor(clamped * ELITE_AFFIX_LIST.length);
  return ELITE_AFFIX_LIST[idx];
}

/** بيانات معدِّلات الموجات (تظهر بدءاً من الموجة 3 كل 3 موجات لمدة 4 ثوانٍ على الشاشة) */
export const WAVE_MUTATORS: Record<WaveMutatorId, WaveMutatorInfo> = {
  heavy_fog: {
    id: 'heavy_fog',
    name: 'ضباب كثيف',
    description: 'مدى الرؤية محدود بسبب الضباب الكثيف!',
    color: '#94a3b8',
  },
  low_gravity: {
    id: 'low_gravity',
    name: 'جاذبية منخفضة',
    description: 'قفزات عالية وجاذبية مخفّضة في ساحة المعركة!',
    color: '#38bdf8',
  },
  fast_fragile: {
    id: 'fast_fragile',
    name: 'أعداء سريعون وهشّون',
    description: 'الأعداء أسرع بنسبة 45% لكن صحتهم أقل بنسبة 40%!',
    color: '#f97316',
  },
  double_headshot: {
    id: 'double_headshot',
    name: 'إصابات الرأس بضرر مضاعف',
    description: 'جميع إصابات الرأس تُلحق ضعف الضرر (×2)!',
    color: '#facc15',
  },
};

export const WAVE_MUTATOR_LIST: WaveMutatorId[] = [
  'heavy_fog',
  'low_gravity',
  'fast_fragile',
  'double_headshot',
];

/** اختيار معدِّل عشوائي للموجة (من الموجة 3 وكل 3 موجات: 3، 6، 9، 12...) */
export function pickWaveMutator(wave: number, rngValue: number): WaveMutatorInfo | null {
  if (wave < 3 || wave % 3 !== 0) return null;
  const clamped = Math.max(0, Math.min(0.9999, rngValue));
  const id = WAVE_MUTATOR_LIST[Math.floor(clamped * WAVE_MUTATOR_LIST.length)];
  return WAVE_MUTATORS[id];
}

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

/** حساب الضرر النهائي حسب نوع العدو ومنطقة الإصابة وصفة النخبة ومعدِّل الموجة ودرع الباس */
export function computeHitDamage(params: {
  enemyType: EnemyTypeId;
  rawDmg: number;
  dmgMult: number;
  hitZone: HitZone;
  currentHp: number;
  instantHeadshotKill?: boolean;
  eliteAffix?: EliteAffixId | null;
  headshotMult?: number;
  bossShieldActive?: boolean;
}): { damage: number; isCrit: boolean; isShieldBlock: boolean } {
  const {
    enemyType,
    rawDmg,
    dmgMult,
    hitZone,
    currentHp,
    instantHeadshotKill,
    eliteAffix,
    headshotMult = 1.0,
    bossShieldActive = false,
  } = params;

  if (enemyType === 'boss') {
    if (hitZone === 'shield') {
      return { damage: rawDmg * 0.2 * dmgMult, isCrit: false, isShieldBlock: true };
    }
    const shieldScale = bossShieldActive ? PLAYER_CONSTANTS.ENGINEER_SHIELD_DR_MULT : 1.0;
    if (hitZone === 'head') {
      return {
        damage: rawDmg * 2.0 * dmgMult * headshotMult * shieldScale,
        isCrit: !bossShieldActive,
        isShieldBlock: bossShieldActive,
      };
    }
    if (hitZone === 'generator') {
      return {
        damage: rawDmg * 2.2 * dmgMult * shieldScale,
        isCrit: true,
        isShieldBlock: false,
      };
    }
    if (hitZone === 'weakpoint') {
      return {
        damage: rawDmg * 2.0 * dmgMult * shieldScale,
        isCrit: true,
        isShieldBlock: false,
      };
    }
    return {
      damage: rawDmg * dmgMult * shieldScale,
      isCrit: false,
      isShieldBlock: bossShieldActive,
    };
  }

  if (hitZone === 'shield') {
    return { damage: rawDmg * 0.2 * dmgMult, isCrit: false, isShieldBlock: true };
  }

  if (hitZone === 'generator' || hitZone === 'weakpoint') {
    return { damage: rawDmg * 2.5 * dmgMult, isCrit: true, isShieldBlock: false };
  }

  if (hitZone === 'head') {
    const hsDmg = rawDmg * dmgMult * headshotMult;
    if (instantHeadshotKill) {
      return { damage: Math.max(currentHp, hsDmg), isCrit: true, isShieldBlock: false };
    }
    return { damage: hsDmg, isCrit: true, isShieldBlock: false };
  }

  const bodyMult = eliteAffix === 'armored' ? PLAYER_CONSTANTS.ELITE_ARMORED_BODY_MULT : 1.0;
  return { damage: rawDmg * dmgMult * bodyMult, isCrit: false, isShieldBlock: false };
}

/** ترتيب دوران الزعماء الثلاثة كل 5 موجات (الموجة 5 المهندس، 10 ملكة السرب، 15 العملاق الجبار...) */
export const BOSS_ROTATION: BossArchetypeId[] = ['engineer', 'swarm_queen', 'colossus'];

export function pickBossArchetypeForWave(wave: number): BossArchetypeId {
  const tierIndex = Math.max(0, Math.floor(wave / 5) - 1);
  return BOSS_ROTATION[tierIndex % BOSS_ROTATION.length];
}

export function getBossArchetypeMeta(archetype: BossArchetypeId): {
  name: string;
  subtitle: string;
  bannerColor: string;
} {
  switch (archetype) {
    case 'engineer':
      return {
        name: 'المهندس المدرّع',
        subtitle: 'ينشر أبراجاً قتالية ودرع درونات — دمّر الدرونات واستهدف المولّد الخلفي',
        bannerColor: '#f59e0b',
      };
    case 'swarm_queen':
      return {
        name: 'ملكة السرب الطائرة',
        subtitle: 'باس طائر يستدعي أسراب الدرونات — نقطة الضعف في النواة السفلية',
        bannerColor: '#ec4899',
      };
    case 'colossus':
      return {
        name: 'العملاق الجبار',
        subtitle: 'آلي حصار ضخم بضربات أرضية — نقاط الضعف في الساقين والظهر',
        bannerColor: '#ef4444',
      };
  }
}

/** تحديد مرحلة الباس (1 أو 2 أو 3) بناءً على نسبة الصحة المتبقية */
export function computeBossPhase(hp: number, maxHp: number): 1 | 2 | 3 {
  if (maxHp <= 0) return 3;
  const ratio = hp / maxHp;
  if (ratio <= 0.33) return 3;
  if (ratio <= 0.66) return 2;
  return 1;
}

/** حساب صحة الباس القصوى حسب رقم الموجة ونوع الزعيم */
export function computeBossMaxHp(wave: number, archetype?: BossArchetypeId): number {
  const bossTier = Math.max(1, Math.floor(wave / 5));
  const base = 900 + (bossTier - 1) * 520;
  if (archetype === 'colossus') return Math.round(base * 1.25);
  if (archetype === 'swarm_queen') return Math.round(base * 0.95);
  return base;
}

/** حساب عدد أعداء الموجة العادية */
export function computeWaveEnemyCount(wave: number): number {
  if (wave % 5 === 0) return 1; // موجة الباس
  return 5 + wave * 3;
}

/** اختيار نوع عدو مناسب لرقم الموجة وفق توزيع متوازن يشمل الأعداء الطائرين الجدد */
export function pickEnemyTypeForWave(
  wave: number,
  rngValue: number,
): Exclude<EnemyTypeId, 'boss' | 'turret'> {
  const r = Math.max(0, Math.min(0.9999, rngValue));
  if (wave === 1) {
    if (r < 0.48) return 'rusher';
    if (r < 0.88) return 'trooper';
    return 'swarm_drone';
  }
  if (wave === 2) {
    if (r < 0.28) return 'rusher';
    if (r < 0.56) return 'trooper';
    if (r < 0.72) return 'drone';
    if (r < 0.86) return 'swarm_drone';
    return 'kamikaze';
  }
  if (wave === 3) {
    if (r < 0.14) return 'rusher';
    if (r < 0.28) return 'trooper';
    if (r < 0.38) return 'drone';
    if (r < 0.48) return 'swarm_drone';
    if (r < 0.58) return 'kamikaze';
    if (r < 0.68) return 'shielded';
    if (r < 0.78) return 'mortar';
    if (r < 0.86) return 'ghost';
    if (r < 0.94) return 'gunship';
    return 'heavy';
  }
  if (r < 0.09) return 'rusher';
  if (r < 0.18) return 'trooper';
  if (r < 0.25) return 'drone';
  if (r < 0.33) return 'swarm_drone';
  if (r < 0.41) return 'kamikaze';
  if (r < 0.49) return 'gunship';
  if (r < 0.57) return 'flying_sniper';
  if (r < 0.65) return 'shielded';
  if (r < 0.73) return 'mortar';
  if (r < 0.81) return 'jammer';
  if (r < 0.88) return 'ghost';
  if (r < 0.94) return 'sniper';
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
    case 'mountain':
      return 'الجبل المتجمد';
    case 'port':
      return 'الميناء الصناعي';
    case 'station':
      return 'المحطة الفضائية';
  }
}

/** حساب معامل الجاذبية الفعلي بدمج جاذبية الخريطة (مثل المحطة الفضائية) مع معدِّل الجاذبية المنخفضة */
export function computeEffectiveGravity(
  mapGravityMult: number | undefined,
  hasLowGravityMutator: boolean,
): number {
  const base = mapGravityMult ?? 1.0;
  if (!hasLowGravityMutator) return base;
  return base < 1.0 ? Math.max(0.32, Number((base * 0.72).toFixed(3))) : 0.45;
}

/** حساب كثافة الضباب الفعلية بدمج الضباب الأساسي وعاصفة الثلج ومعدِّل الضباب الكثيف */
export function computeEffectiveFogDensity(
  baseDensity: number,
  weatherDensity: number | null,
  hasHeavyFogMutator: boolean,
): number {
  const activeBase = weatherDensity !== null ? Math.max(baseDensity, weatherDensity) : baseDensity;
  if (!hasHeavyFogMutator) return activeBase;
  return Math.max(activeBase, baseDensity * 2.8, 0.048);
}
