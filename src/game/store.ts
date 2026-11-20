import { create } from 'zustand';
import type {
  AdsStyle,
  BossHudState,
  EndRunSummary,
  GameScreenState,
  GameSettings,
  KillFeedItem,
  MapId,
  RadarSnapshot,
  UpgradeOption,
  WaveMutatorInfo,
  WeaponSlotUI,
} from './types';
import { loadRecords, loadSettings, saveSettings } from './rules';

/* ==========================================
   مخزن الحالة المشترك بين محرك اللعبة وواجهة React
   (لا يحتوي على منطق لعب — مجرد جسر بيانات وأوامر)
   ========================================== */

export interface EngineBridgeActions {
  startMission: (mapId?: MapId) => void;
  resumeMission: () => void;
  pauseMission: () => void;
  restartMission: () => void;
  returnToMainMenu: () => void;
  previewMap: (mapId: MapId) => void;
  selectUpgrade: (upgradeId: string) => void;
  applySettings: (settings: GameSettings) => void;
}

export interface GameStoreState {
  // حالة الشاشة
  screen: GameScreenState;
  settingsOpen: boolean;
  selectedMap: MapId;
  activeMap: MapId;
  activeMapName: string;
  hasActiveSession: boolean;

  // السجلات المحفوظة
  bestScore: number;
  bestWave: number;

  // الإعدادات
  settings: GameSettings;

  // مؤشرات اللعب الحية (HUD)
  score: number;
  wave: number;
  enemiesLeft: number;
  headshots: number;
  kills: number;

  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  stamina: number;
  maxStamina: number;
  staminaExhausted: boolean;
  isSliding: boolean;
  isSprinting: boolean;
  slideCooldown: number;
  dashCooldown: number;
  dashCooldownBase: number;

  // القنابل وسلسلة القتل
  grenades: number;
  maxGrenades: number;
  grenadeCooldown: number;
  killStreak: number;
  furyTimer: number;

  // السلاح والذخيرة
  weaponName: string;
  weaponRole: string;
  ammoMag: number;
  ammoReserve: number;
  isReloading: boolean;
  reloadHint: string;
  weaponSlots: WeaponSlotUI[];

  // التصويب والمؤثرات البصرية (أنماط ADS، تكبير المنظار، وحبس النفس)
  crosshairSpread: number;
  activeADS: boolean;
  adsStyle: AdsStyle;
  showScope: boolean;
  thermalScope: boolean;
  scopeZoomLabel: string;
  holdBreathRatio: number;
  holdBreathActive: boolean;
  holdBreathCooldown: number;
  hitmarkerVisible: boolean;
  hitmarkerCrit: boolean;
  damageFlash: boolean;
  slowMoActive: boolean;

  // الكومبو والباس والإعلانات والتشويش ومعدِّلات الموجة
  comboCount: number;
  comboRatio: number;
  boss: BossHudState;
  bannerText: string;
  bannerColor: string;
  bannerVisible: boolean;
  empDisabledTimer: number;
  activeMutator: WaveMutatorInfo | null;
  mutatorBannerVisible: boolean;
  snowstormActive: boolean;
  mapLowGravity: boolean;
  killFeed: KillFeedItem[];

  // شاشة الترقيات وشاشة النهاية
  upgradeWaveCleared: number;
  upgradeOptions: UpgradeOption[];
  endSummary: EndRunSummary | null;

  // مرجع بيانات الرادار (يُحدث بدون إعادة رسم React في كل إطار)
  radarData: RadarSnapshot;

  // جسر التحكم بالمحرك
  engineActions: EngineBridgeActions | null;

  // دوال تحديث الحالة
  setEngineActions: (actions: EngineBridgeActions | null) => void;
  setScreen: (screen: GameScreenState) => void;
  setSettingsOpen: (open: boolean) => void;
  setSelectedMap: (mapId: MapId) => void;
  updateSettings: (partial: Partial<GameSettings>) => void;
  pushKillFeed: (text: string, isHeadshot?: boolean, isHighlight?: boolean) => void;
  clearKillFeed: () => void;
  setHudPatch: (patch: Partial<GameStoreState>) => void;
}

const initialRecords = loadRecords();
const initialSettings = loadSettings();
let killFeedSeq = 1;

export const useGameStore = create<GameStoreState>((set, get) => ({
  screen: 'title',
  settingsOpen: false,
  selectedMap: 'lab',
  activeMap: 'lab',
  activeMapName: 'المختبر',
  hasActiveSession: false,

  bestScore: initialRecords.bestScore,
  bestWave: initialRecords.bestWave,
  settings: initialSettings,

  score: 0,
  wave: 1,
  enemiesLeft: 0,
  headshots: 0,
  kills: 0,

  health: 100,
  maxHealth: 100,
  shield: 50,
  maxShield: 50,
  stamina: 100,
  maxStamina: 100,
  staminaExhausted: false,
  isSliding: false,
  isSprinting: false,
  slideCooldown: 0,
  dashCooldown: 0,
  dashCooldownBase: 2.5,

  grenades: 2,
  maxGrenades: 4,
  grenadeCooldown: 0,
  killStreak: 0,
  furyTimer: 0,

  weaponName: 'M4 سايبر (رشاش)',
  weaponRole: 'آلي متوازن',
  ammoMag: 30,
  ammoReserve: 150,
  isReloading: false,
  reloadHint: '',
  weaponSlots: [
    { id: 0, shortName: '1 رشاش', unlocked: true, active: true },
    { id: 1, shortName: '2 شوتجن', unlocked: true, active: false },
    { id: 2, shortName: '3 قناصة', unlocked: true, active: false },
    { id: 3, shortName: '4 مسدس', unlocked: false, active: false },
    { id: 4, shortName: '5 نصف آلي', unlocked: false, active: false },
    { id: 5, shortName: '6 صواريخ', unlocked: false, active: false },
    { id: 6, shortName: '7 حرارية', unlocked: false, active: false },
  ],

  crosshairSpread: 7,
  activeADS: false,
  adsStyle: 'red_dot',
  showScope: false,
  thermalScope: false,
  scopeZoomLabel: 'x4',
  holdBreathRatio: 1,
  holdBreathActive: false,
  holdBreathCooldown: 0,
  hitmarkerVisible: false,
  hitmarkerCrit: false,
  damageFlash: false,
  slowMoActive: false,

  comboCount: 0,
  comboRatio: 0,
  boss: {
    active: false,
    name: 'تيتان أوميغا Mk-1',
    phase: 1,
    hp: 900,
    maxHp: 900,
  },
  bannerText: '',
  bannerColor: '#38bdf8',
  bannerVisible: false,
  empDisabledTimer: 0,
  activeMutator: null,
  mutatorBannerVisible: false,
  snowstormActive: false,
  mapLowGravity: false,
  killFeed: [],

  upgradeWaveCleared: 1,
  upgradeOptions: [],
  endSummary: null,

  radarData: {
    playerX: 0,
    playerZ: 0,
    yaw: 0,
    scale: 1.65,
    platforms: [],
    entities: [],
  },

  engineActions: null,

  setEngineActions: (actions) => set({ engineActions: actions }),

  setScreen: (screen) => {
    // مزامنة حالة الصفحة على عنصر body لتسهيل الاختبار والتنسيق
    const datasetState = screen === 'upgrade' ? 'paused' : screen;
    if (typeof document !== 'undefined') {
      document.body.dataset.state = datasetState;
    }
    set({ screen });
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),

  setSelectedMap: (mapId) => {
    set({ selectedMap: mapId });
    const actions = get().engineActions;
    if (actions && get().screen === 'title') {
      actions.previewMap(mapId);
    }
  },

  updateSettings: (partial) => {
    const next: GameSettings = { ...get().settings, ...partial };
    saveSettings(next);
    set({ settings: next });
    get().engineActions?.applySettings(next);
  },

  pushKillFeed: (text, isHeadshot = false, isHighlight = false) => {
    const id = killFeedSeq++;
    const item: KillFeedItem = { id, text, isHeadshot, isHighlight };
    set((state) => ({
      killFeed: [item, ...state.killFeed].slice(0, 5),
    }));
    window.setTimeout(() => {
      set((state) => ({
        killFeed: state.killFeed.filter((entry) => entry.id !== id),
      }));
    }, 3600);
  },

  clearKillFeed: () => set({ killFeed: [] }),

  setHudPatch: (patch) => set(patch),
}));
