import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type {
  GameSettings,
  HitZone,
  MapId,
  RadarEntity,
  UpgradeOption,
} from './types';
import { useGameStore } from './store';
import {
  PLAYER_CONSTANTS,
  computeComboMultiplier,
  computeHitDamage,
  computeKillPoints,
  computeWaveEnemyCount,
  getKillStreakReward,
  pickEnemyTypeForWave,
  saveRecords,
} from './rules';
import { AudioManager } from './audio/AudioManager';
import { ObjectPools } from './pools/ObjectPools';
import { MapManager } from './maps/MapManager';
import { WeaponManager } from './weapons/WeaponManager';
import { EnemyManager } from './enemies/EnemyManager';
import type { EnemyBase, EnemyHitUserData } from './enemies/EnemyBase';
import { BossEnemy } from './boss/Boss';
import { Player } from './Player';

/* ==========================================
   محرك اللعبة الرئيسي (Engine)
   يدير المُصيّر ثلاثي الأبعاد، المشهد، حلقة اللعب، الإيقاف/الاستئناف،
   المقذوفات (الصواريخ والقنابل)، الموجات، الترقيات، وتحرير الموارد
   ========================================== */

interface PlayerRocket {
  mesh: THREE.Group;
  vel: THREE.Vector3;
  dmg: number;
  splashRadius: number;
  life: number;
  trailTimer: number;
}

interface ThrownGrenade {
  mesh: THREE.Group;
  vel: THREE.Vector3;
  fuse: number;
  bounces: number;
}

interface PickupItem {
  group: THREE.Group;
  baseY: number;
  type: 'health' | 'ammo';
  life: number;
}

interface UpgradeDefinition extends UpgradeOption {
  apply: () => void;
}

const _raycaster = new THREE.Raycaster();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _muzzleWorld = new THREE.Vector3();
const _endPoint = new THREE.Vector3();
const _tmpVec = new THREE.Vector3();
const _tmpVec2 = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class GameEngine {
  private readonly container: HTMLElement;
  private readonly isSoftwareGl: boolean;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly envTexture: THREE.Texture;

  private readonly audio: AudioManager;
  private readonly pools: ObjectPools;
  private readonly mapManager: MapManager;
  private readonly weaponManager: WeaponManager;
  private readonly enemyManager: EnemyManager;
  private readonly player: Player;

  // كائنات ديناميكية
  private readonly playerRockets: PlayerRocket[] = [];
  private readonly grenades: ThrownGrenade[] = [];
  private readonly pickups: PickupItem[] = [];
  private readonly pickupGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  private readonly pickupRingGeo = new THREE.TorusGeometry(0.65, 0.05, 8, 20);
  private readonly rocketBodyGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.72, 10);
  private readonly rocketNoseGeo = new THREE.ConeGeometry(0.11, 0.26, 10);
  private readonly grenadeGeo = new THREE.OctahedronGeometry(0.18, 1);

  // حالة الحلقة والوقت
  private frameId = 0;
  private isDisposed = false;
  private prevTime = performance.now();
  private tourAngle = 0;
  private hudSyncTimer = 0;

  // حالة الإدخال
  private readonly keys: Record<string, boolean> = {};
  private isMouseDown = false;
  private isADS = false;
  private pointerWasLocked = false;

  // حالة الجلسة والموجات
  private isPlaying = false;
  private isGameOver = false;
  private hasActiveSession = false;
  private score = 0;
  private wave = 1;
  private kills = 0;
  private headshots = 0;
  private bossKills = 0;
  private waveEnemiesRemaining = 0;
  private waveToSpawn = 0;
  private spawnCooldown = 0;
  private waveDelay = 0;
  private pendingUpgrade = false;

  // الكومبو، سلسلة القتل، اللقطة البطيئة، وتجميد الصدمات (Hitstop)
  private comboCount = 0;
  private comboTimer = 0;
  private killStreak = 0;
  private furyTimer = 0;
  private slowMoTimer = 0;
  private hitstopTimer = 0;

  // مؤقتات الإشعارات البصرية
  private hitmarkerTimeout: number | null = null;
  private damageFlashTimeout: number | null = null;
  private bannerTimeout: number | null = null;

  // خيارات الترقيات المتاحة
  private readonly upgradePool: UpgradeDefinition[];
  private activeUpgradeChoices: UpgradeDefinition[] = [];

  // بيانات الرادار المعاد استخدامها
  private readonly radarEntities: RadarEntity[] = [];

  // مراجع دوال الأحداث لإزالتها نظيفاً عند التخلص
  private readonly onResizeBound: () => void;
  private readonly onKeyDownBound: (e: KeyboardEvent) => void;
  private readonly onKeyUpBound: (e: KeyboardEvent) => void;
  private readonly onMouseMoveBound: (e: MouseEvent) => void;
  private readonly onMouseDownBound: (e: MouseEvent) => void;
  private readonly onMouseUpBound: (e: MouseEvent) => void;
  private readonly onWheelBound: (e: WheelEvent) => void;
  private readonly onContextMenuBound: (e: MouseEvent) => void;
  private readonly onPointerLockChangeBound: () => void;
  private readonly onWindowBlurBound: () => void;
  private readonly onVisibilityChangeBound: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.isSoftwareGl = detectSoftwareWebGL();

    // تهيئة المشهد والكاميرا
    this.scene = new THREE.Scene();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 320);
    this.scene.add(this.camera);

    // تهيئة المُصيّر مع الحماية ضد software WebGL ومعايرة الألوان السينمائية
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // خريطة بيئة استوديو إجرائية لانعكاسات المعادن PBR (دائماً مفعلة لتوحيد المظهر)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmrem.dispose();

    // إضاءة أساسية متباينة (سماء/أرض + ضوء رئيسي موجه)
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.7);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xe0f2fe, 1.0);
    dirLight.position.set(30, 55, 25);
    dirLight.castShadow = !this.isSoftwareGl;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    this.scene.add(dirLight);

    // تهيئة الأنظمة الفرعية
    this.audio = new AudioManager();
    this.pools = new ObjectPools(this.scene);
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.mapManager = new MapManager(this.scene, hemiLight, dirLight, maxAniso);
    this.weaponManager = new WeaponManager(this.camera);
    this.enemyManager = new EnemyManager(this.scene, this.mapManager, this.pools, this.audio);
    this.player = new Player(this.camera);

    // تطبيق الإعدادات المحفوظة
    const initialSettings = useGameStore.getState().settings;
    this.applySettings(initialSettings);

    // تحميل الخريطة الافتراضية لعرضها في الخلفية الحية لشاشة البداية
    const initialMap = useGameStore.getState().selectedMap;
    this.mapManager.loadMap(initialMap);
    this.weaponManager.pivot.visible = false;

    // قائمة الترقيات (1 من 3 بين الموجات)
    this.upgradePool = [
      {
        id: 'dmg_up',
        icon: '🔥',
        title: 'ضرر أعلى (+18%)',
        desc: 'زيادة ضرر جميع الأسلحة والصواريخ والقنابل بنسبة 18%.',
        apply: () => {
          this.weaponManager.dmgMult += 0.18;
        },
      },
      {
        id: 'reload_up',
        icon: '⚡',
        title: 'تلقيم أسرع (+20%)',
        desc: 'تقليل وقت إعادة التلقيم لجميع الأسلحة بنسبة 20%.',
        apply: () => {
          this.weaponManager.reloadMult *= 0.82;
        },
      },
      {
        id: 'vitals_up',
        icon: '❤️',
        title: 'صحة ودرع أكبر',
        desc: 'زيادة الصحة القصوى +25 والدرع +15 مع شفاء كامل فوري.',
        apply: () => {
          this.player.maxHealth += 25;
          this.player.maxShield += 15;
          this.player.health = this.player.maxHealth;
          this.player.shield = this.player.maxShield;
        },
      },
      {
        id: 'ammo_up',
        icon: '🎒',
        title: 'ذخيرة وقنابل (+25%)',
        desc: 'توسيع سعة المخازن +25% وتعبئة كل الأسلحة +2 قنبلة يدوية.',
        apply: () => {
          this.weaponManager.upgradeAllAmmo();
          this.player.grenades = Math.min(this.player.maxGrenades, this.player.grenades + 2);
        },
      },
      {
        id: 'mobility_up',
        icon: '💨',
        title: 'حركة واندفاع أسرع',
        desc: 'زيادة سرعة الحركة والركض والتزحلق +12% وتقليل زمن الاندفاع (Q) بنسبة 20%.',
        apply: () => {
          this.player.speedMult += 0.12;
          this.player.dashCooldownBase = Math.max(0.8, this.player.dashCooldownBase * 0.8);
        },
      },
      {
        id: 'firerate_up',
        icon: '🎯',
        title: 'إطلاق نار أسرع (+12%)',
        desc: 'رفع معدل إطلاق النار لجميع الأسلحة بنسبة 12%.',
        apply: () => {
          this.weaponManager.fireRateMult *= 0.89;
        },
      },
    ];

    // ربط الجسر بمخزن Zustand
    useGameStore.getState().setEngineActions({
      startMission: (mapId) => this.startMission(mapId),
      resumeMission: () => this.resumeMission(),
      pauseMission: () => this.pauseMission(),
      restartMission: () => this.restartMission(),
      returnToMainMenu: () => this.returnToMainMenu(),
      previewMap: (mapId) => this.previewMap(mapId),
      selectUpgrade: (id) => this.selectUpgrade(id),
      applySettings: (settings) => this.applySettings(settings),
    });

    // ربط مستمعي الأحداث
    this.onResizeBound = () => this.handleResize();
    this.onKeyDownBound = (e) => this.handleKeyDown(e);
    this.onKeyUpBound = (e) => this.handleKeyUp(e);
    this.onMouseMoveBound = (e) => this.handleMouseMove(e);
    this.onMouseDownBound = (e) => this.handleMouseDown(e);
    this.onMouseUpBound = (e) => this.handleMouseUp(e);
    this.onWheelBound = (e) => this.handleWheel(e);
    this.onContextMenuBound = (e) => {
      if (this.isPlaying) e.preventDefault();
    };
    this.onPointerLockChangeBound = () => this.handlePointerLockChange();
    this.onWindowBlurBound = () => this.clearHeldInputs();
    this.onVisibilityChangeBound = () => {
      if (document.hidden) this.clearHeldInputs();
    };

    window.addEventListener('resize', this.onResizeBound);
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    document.addEventListener('mousemove', this.onMouseMoveBound);
    document.addEventListener('mousedown', this.onMouseDownBound);
    document.addEventListener('mouseup', this.onMouseUpBound);
    document.addEventListener('wheel', this.onWheelBound, { passive: true });
    document.addEventListener('contextmenu', this.onContextMenuBound);
    document.addEventListener('pointerlockchange', this.onPointerLockChangeBound);
    window.addEventListener('blur', this.onWindowBlurBound);
    document.addEventListener('visibilitychange', this.onVisibilityChangeBound);

    // تجهيز الشادرز مرة واحدة على بطاقات الرسوميات الحقيقية
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // دعم معامل البدء الفوري ?autostart=1 للاختبار والتجربة المباشرة
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const mapParam = params.get('map');
      const targetMap: MapId =
        mapParam === 'city' || mapParam === 'desert' || mapParam === 'lab' ? mapParam : initialMap;
      useGameStore.getState().setSelectedMap(targetMap);
      this.startMission(targetMap, false);
    } else {
      useGameStore.getState().setScreen('title');
      // وضع الكاميرا على زاوية البداية الاستعراضية قبل أول رسم فوري
      const orbitR = this.mapManager.halfArena * 0.62;
      this.camera.position.set(orbitR, 14.5, 0);
      this.camera.lookAt(0, 2.2, 0);
    }

    // رسم الإطار الأول فوراً لضمان ظهور المشهد دون شاشة سوداء
    this.renderer.render(this.scene, this.camera);

    // تشغيل حلقة الرسم
    this.prevTime = performance.now();
    this.scheduleNextFrame();
  }

  /** تطبيق إعدادات الجودة والحساسية والصوت */
  public applySettings(settings: GameSettings): void {
    this.audio.setVolume(settings.volume, settings.muted);
    const high = settings.quality === 'high';
    this.pools.setQuality(high);

    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
    } else {
      this.renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 2) : 1);
      this.renderer.shadowMap.enabled = high;
    }
  }

  /** معاينة الخريطة المختارة في الخلفية الحية لشاشة البداية */
  public previewMap(mapId: MapId): void {
    if (this.mapManager.activeMapId === mapId) return;
    this.mapManager.loadMap(mapId);
    useGameStore.getState().setHudPatch({
      activeMap: mapId,
      activeMapName: this.mapManager.activeMap.name,
    });
  }

  /** بدء مهمة جديدة (أو متابعة جلسة حالية) */
  public startMission(mapId?: MapId, tryPointerLock = true): void {
    if (tryPointerLock) {
      this.audio.init();
      this.audio.resume();
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const chosenMap = mapId ?? useGameStore.getState().selectedMap;
    this.resetRun(chosenMap);

    this.hasActiveSession = true;
    this.isPlaying = true;
    this.weaponManager.pivot.visible = true;
    this.clearHeldInputs();

    useGameStore.getState().setHudPatch({
      hasActiveSession: true,
      settingsOpen: false,
      activeMap: chosenMap,
      activeMapName: this.mapManager.activeMap.name,
    });
    useGameStore.getState().setScreen('playing');

    if (tryPointerLock) {
      this.requestPointerLockSafe();
    }
  }

  /** استئناف اللعب من شاشة الإيقاف المؤقت */
  public resumeMission(): void {
    if (!this.hasActiveSession || this.isGameOver) return;
    this.audio.init();
    this.audio.resume();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.clearHeldInputs();
    this.isPlaying = true;
    this.weaponManager.pivot.visible = true;
    useGameStore.getState().setHudPatch({ settingsOpen: false });
    useGameStore.getState().setScreen('playing');
    this.requestPointerLockSafe();
  }

  /** إيقاف اللعبة مؤقتاً */
  public pauseMission(): void {
    if (!this.isPlaying || this.isGameOver) return;
    this.isPlaying = false;
    this.clearHeldInputs();
    this.audio.suspend();
    this.exitPointerLockSafe();
    useGameStore.getState().setHudPatch({ showScope: false });
    useGameStore.getState().setScreen('paused');
  }

  /** إعادة المحاولة في نفس الخريطة */
  public restartMission(): void {
    this.startMission(this.mapManager.activeMapId, true);
  }

  /** العودة للقائمة الرئيسية مع تشغيل الكاميرا الاستعراضية */
  public returnToMainMenu(): void {
    this.isPlaying = false;
    this.hasActiveSession = false;
    this.clearHeldInputs();
    this.exitPointerLockSafe();
    this.clearDynamicWorldEntities();
    this.weaponManager.pivot.visible = false;
    useGameStore.getState().setHudPatch({
      hasActiveSession: false,
      settingsOpen: false,
      showScope: false,
      boss: { active: false, name: '', phase: 1, hp: 0, maxHp: 1 },
    });
    useGameStore.getState().setScreen('title');
  }

  private requestPointerLockSafe(): void {
    try {
      const target = this.renderer.domElement;
      if (target && typeof target.requestPointerLock === 'function') {
        const result = target.requestPointerLock() as unknown as Promise<void> | undefined;
        if (result && typeof result.catch === 'function') {
          result.catch(() => {
            // تجاهل رفض قفل المؤشر في المتصفحات المقيدة
          });
        }
      }
    } catch {
      // تجاهل الأخطاء
    }
  }

  private exitPointerLockSafe(): void {
    try {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    } catch {
      // تجاهل الأخطاء
    }
  }

  private clearHeldInputs(): void {
    for (const k of Object.keys(this.keys)) {
      this.keys[k] = false;
    }
    this.isMouseDown = false;
    this.isADS = false;
    this.player.isSprinting = false;
  }

  /** إعادة تهيئة كاملة لجولة لعب جديدة */
  private resetRun(mapId: MapId): void {
    this.clearDynamicWorldEntities();
    this.mapManager.loadMap(mapId);
    this.player.reset();
    this.weaponManager.reset();

    this.score = 0;
    this.wave = 1;
    this.kills = 0;
    this.headshots = 0;
    this.bossKills = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.killStreak = 0;
    this.furyTimer = 0;
    this.slowMoTimer = 0;
    this.hitstopTimer = 0;
    this.waveDelay = 0;
    this.pendingUpgrade = false;
    this.isGameOver = false;
    this.pointerWasLocked = false;

    useGameStore.getState().clearKillFeed();
    useGameStore.getState().setHudPatch({
      score: 0,
      wave: 1,
      kills: 0,
      headshots: 0,
      comboCount: 0,
      comboRatio: 0,
      killStreak: 0,
      furyTimer: 0,
      slowMoActive: false,
      damageFlash: false,
      showScope: false,
      endSummary: null,
      boss: { active: false, name: '', phase: 1, hp: 0, maxHp: 1 },
    });

    this.startWave(1);
    this.syncHudImmediate();
  }

  private clearDynamicWorldEntities(): void {
    this.enemyManager.clearAll();
    this.pools.clearAll();

    for (const r of this.playerRockets) {
      this.disposeGroupMaterials(r.mesh);
      this.scene.remove(r.mesh);
    }
    this.playerRockets.length = 0;

    for (const g of this.grenades) {
      this.disposeGroupMaterials(g.mesh);
      this.scene.remove(g.mesh);
    }
    this.grenades.length = 0;

    for (const p of this.pickups) {
      this.disposeGroupMaterials(p.group);
      this.scene.remove(p.group);
    }
    this.pickups.length = 0;
  }

  private disposeGroupMaterials(group: THREE.Group): void {
    group.traverse((ch) => {
      if ((ch as THREE.Mesh).isMesh) {
        const mat = (ch as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
  }

  /* ==========================================
     نظام الموجات، الترقيات، الإعلانات، والرادار
     ========================================== */

  private showBanner(text: string, color = '#38bdf8'): void {
    useGameStore.getState().setHudPatch({
      bannerText: text,
      bannerColor: color,
      bannerVisible: true,
    });
    if (this.bannerTimeout !== null) window.clearTimeout(this.bannerTimeout);
    this.bannerTimeout = window.setTimeout(() => {
      useGameStore.getState().setHudPatch({ bannerVisible: false });
    }, 2400);
  }

  private showHitmarker(isCrit: boolean): void {
    useGameStore.getState().setHudPatch({
      hitmarkerVisible: true,
      hitmarkerCrit: isCrit,
    });
    if (this.hitmarkerTimeout !== null) window.clearTimeout(this.hitmarkerTimeout);
    this.hitmarkerTimeout = window.setTimeout(() => {
      useGameStore.getState().setHudPatch({ hitmarkerVisible: false });
    }, 110);
  }

  private startWave(w: number): void {
    this.wave = w;
    // منح قنبلة يدوية إضافية مع بداية كل موجة بعد الأولى
    if (w > 1) {
      this.player.grenades = Math.min(this.player.maxGrenades, this.player.grenades + 1);
    }

    if (w % 5 === 0) {
      this.waveToSpawn = 0;
      this.waveEnemiesRemaining = 1;
      const boss = this.enemyManager.spawn('boss', w, this.camera.position);
      if (boss) this.syncBossHud(boss as BossEnemy);
      this.showBanner(`☠️ تحذير: الباس قادم! (الموجة ${w})`, '#ef4444');
      this.audio.play('bossRoar');
    } else {
      this.waveToSpawn = computeWaveEnemyCount(w);
      this.waveEnemiesRemaining = this.waveToSpawn;
      this.spawnCooldown = 0.6;
      useGameStore.getState().setHudPatch({
        boss: { active: false, name: '', phase: 1, hp: 0, maxHp: 1 },
      });
      this.showBanner(`الموجة ${w} — ${this.mapManager.activeMap.name}`, '#38bdf8');
      this.audio.play('wave');
    }

    useGameStore.getState().setHudPatch({
      wave: this.wave,
      enemiesLeft: this.waveEnemiesRemaining,
      grenades: this.player.grenades,
    });
  }

  private openUpgradeScreen(): void {
    this.isPlaying = false;
    this.clearHeldInputs();
    this.exitPointerLockSafe();

    const shuffled = [...this.upgradePool].sort(() => Math.random() - 0.5).slice(0, 3);
    this.activeUpgradeChoices = shuffled;
    useGameStore.getState().setHudPatch({
      showScope: false,
      upgradeWaveCleared: this.wave,
      upgradeOptions: shuffled.map(({ id, icon, title, desc }) => ({ id, icon, title, desc })),
    });
    useGameStore.getState().setScreen('upgrade');
  }

  public selectUpgrade(upgradeId: string): void {
    const chosen = this.activeUpgradeChoices.find((u) => u.id === upgradeId);
    if (!chosen) return;

    this.audio.init();
    this.audio.resume();
    chosen.apply();
    this.audio.play('pickup');
    useGameStore.getState().pushKillFeed(`⬆️ ترقية: ${chosen.title}`, false, true);

    this.isPlaying = true;
    this.startWave(this.wave + 1);
    this.syncHudImmediate();
    useGameStore.getState().setScreen('playing');
    this.requestPointerLockSafe();
  }

  private syncBossHud(boss: BossEnemy | null): void {
    if (!boss || boss.hp <= 0) {
      useGameStore.getState().setHudPatch({
        boss: { active: false, name: '', phase: 1, hp: 0, maxHp: 1 },
      });
      return;
    }
    useGameStore.getState().setHudPatch({
      boss: {
        active: true,
        name: `تيتان أوميغا Mk-${boss.tier}`,
        phase: boss.bossPhase,
        hp: Math.ceil(boss.hp),
        maxHp: boss.maxHp,
      },
    });
  }

  /* ==========================================
     نظام القتال: إطلاق النار، الصواريخ، القنابل، والضرر
     ========================================== */

  private getEffectiveDamageMultiplier(): number {
    return this.weaponManager.dmgMult * (this.furyTimer > 0 ? 1.35 : 1.0);
  }

  private fireWeapon(): void {
    const weapon = this.weaponManager.current;
    const cfg = weapon.config;
    if (this.weaponManager.fireCooldown > 0 || this.weaponManager.isReloading) return;

    if (weapon.mag <= 0) {
      this.audio.play('empty');
      this.weaponManager.fireCooldown = 0.25;
      if (this.weaponManager.startReload()) {
        this.player.isSprinting = false;
        this.audio.play('reload');
      }
      this.syncWeaponHud();
      return;
    }

    weapon.mag--;
    this.weaponManager.fireCooldown = cfg.fireRate * this.weaponManager.fireRateMult;
    this.weaponManager.customHint = '';

    const activeADS = this.isADS && !this.player.isSprinting;
    const isSniper = weapon.isSniperWeapon();

    this.weaponManager.muzzleLight.color.setHex(cfg.color);
    this.weaponManager.muzzleLight.intensity = 5;
    this.audio.play(cfg.sfx);

    // تحديث مصفوفة الكاميرا قبل أي ارتداد لضمان خروج شعاع الإصابة من مركز الكاميرا
    // وباتجاه نظرها الفعلي دون أي تأثير من الارتداد أو إزاحة مجسم السلاح أثناء التصويب (ADS offset)
    this.camera.updateMatrixWorld(true);

    // نقطة الفوهة تُستخدم فقط لبداية الأثر البصري (أو إطلاق الصاروخ)، لا لحساب شعاع الإصابة
    this.weaponManager.getMuzzleWorldPosition(_muzzleWorld);

    if (cfg.isRocket) {
      this.firePlayerRocket(cfg.dmg, cfg.splashRadius ?? 6.5, _muzzleWorld);
      const rocketRecoil = weapon.getEffectiveRecoilKick(activeADS);
      if (rocketRecoil > 0) {
        this.weaponManager.weaponKickZ = cfg.gunKick;
        this.player.camShake = Math.max(this.player.camShake, rocketRecoil * 0.65);
        this.player.pitch = Math.min(Math.PI / 2 - 0.05, this.player.pitch + rocketRecoil);
        this.camera.rotation.x = this.player.pitch;
      }
      this.syncWeaponHud();
      return;
    }

    const spread = weapon.getEffectiveSpread(activeADS, this.player.isSprinting);
    const targets: THREE.Object3D[] = [
      ...this.mapManager.obstacleMeshes,
      ...this.enemyManager.enemies.map((e) => e.group),
    ];
    const maxPierce = cfg.pierceCount ?? 1;

    let anyHit = false;
    let anyCrit = false;
    let anyShieldBlock = false;

    for (let p = 0; p < cfg.pellets; p++) {
      if (spread === 0) {
        // شعاع دقيق يخرج مباشرة من مركز الكاميرا باتجاه نظر الكاميرا بدون أي انحراف
        this.camera.getWorldPosition(_rayOrigin);
        this.camera.getWorldDirection(_rayDir);
        _raycaster.set(_rayOrigin, _rayDir);
      } else {
        const sx = (Math.random() - 0.5) * spread * 2;
        const sy = (Math.random() - 0.5) * spread * 2;
        _ndc.set(sx, sy);
        _raycaster.setFromCamera(_ndc, this.camera);
      }

      const hits = _raycaster.intersectObjects(targets, true);
      // نقطة بعيدة على نفس شعاع الكاميرا في حال لم يُصب الشعاع أي هدف
      _raycaster.ray.at(180, _endPoint);

      const pierced = new Set<EnemyBase>();

      for (let h = 0; h < hits.length; h++) {
        const hit = hits[h];
        const data = hit.object.userData as EnemyHitUserData | undefined;
        if (data && data.enemy) {
          const enemy = data.enemy;
          if (pierced.has(enemy) || enemy.hp <= 0) continue;
          pierced.add(enemy);
          _endPoint.copy(hit.point);

          const rawDmg = data.isHead ? cfg.headDmg : cfg.dmg;
          const res = this.applyDamageToEnemy(enemy, rawDmg, hit.point, data.hitZone, cfg.color);
          if (res.hit) anyHit = true;
          if (res.crit) anyCrit = true;
          if (res.shieldBlock) anyShieldBlock = true;

          if (pierced.size >= maxPierce) break;
        } else {
          _endPoint.copy(hit.point);
          this.pools.spawnExplosion(hit.point, 0xfbbf24, 4, 5);
          break;
        }
      }

      // خط الأثر البصري يبدأ من الفوهة ويتجه إلى نقطة الإصابة الفعلية التي وجدها شعاع الكاميرا
      const life = isSniper ? 0.28 : 0.07;
      this.pools.spawnTracer(_muzzleWorld, _endPoint, cfg.color, life, isSniper ? 1.0 : 0.75);
    }

    // تطبيق الارتداد بعد اكتمال حساب الإصابة فقط (وصفر تماماً أثناء التصويب بالقناصة)
    const recoilKick = weapon.getEffectiveRecoilKick(activeADS);
    if (recoilKick > 0) {
      this.weaponManager.weaponKickZ = cfg.gunKick;
      this.player.camShake = Math.max(this.player.camShake, recoilKick * 0.65);
      this.player.pitch = Math.min(Math.PI / 2 - 0.05, this.player.pitch + recoilKick);
      this.camera.rotation.x = this.player.pitch;
    }

    if (anyCrit) {
      this.audio.play('headshot');
      this.showHitmarker(true);
    } else if (anyShieldBlock) {
      this.audio.play('shieldBlock');
      this.showHitmarker(false);
    } else if (anyHit) {
      this.audio.play('hit');
      this.showHitmarker(false);
    }

    this.syncWeaponHud();
  }

  private applyDamageToEnemy(
    enemy: EnemyBase,
    rawDmg: number,
    hitPoint: THREE.Vector3,
    hitZone: HitZone,
    weaponColor: number,
  ): { hit: boolean; crit: boolean; shieldBlock: boolean } {
    if (enemy.hp <= 0) return { hit: false, crit: false, shieldBlock: false };

    const result = computeHitDamage({
      enemyType: enemy.config.type,
      rawDmg,
      dmgMult: this.getEffectiveDamageMultiplier(),
      hitZone,
      currentHp: enemy.hp,
      instantHeadshotKill: enemy.config.instantHeadshotKill,
    });

    if (result.isShieldBlock) {
      enemy.shieldFlashTimer = 0.14;
      if (enemy.shieldMat) enemy.shieldMat.opacity = 0.85;
      this.pools.spawnExplosion(hitPoint, 0x38bdf8, 6, 6);
    } else if (hitZone === 'generator') {
      enemy.flashTimer = 0.08;
      enemy.bodyMat.emissive.setHex(0xffaa00);
      this.pools.spawnExplosion(hitPoint, 0xfbbf24, 10, 8);
    } else {
      enemy.flashTimer = 0.08;
      enemy.bodyMat.emissive.setHex(0xffffff);
      this.pools.spawnExplosion(
        hitPoint,
        result.isCrit ? 0xfef08a : weaponColor,
        result.isCrit ? 10 : 5,
        7,
      );
    }

    enemy.hp -= result.damage;

    if (enemy.config.isBoss) {
      const boss = enemy as BossEnemy;
      const transition = boss.evaluatePhaseTransition();
      if (transition.changed) {
        this.audio.play('bossRoar');
        this.hitstopTimer = 0.055;
        if (transition.newPhase === 2) {
          this.showBanner('⚠️ المرحلة الثانية: الباس يضاعف هجماته!', '#f97316');
          useGameStore.getState().pushKillFeed('🔥 الباس دخل المرحلة 2/3 — سرعة وهجمات أعلى!', true);
          this.summonBossPhaseMinions(boss, 2);
        } else if (transition.newPhase === 3) {
          this.showBanner('☠️ المرحلة الأخيرة: الباس في أقصى غضب!', '#ef4444');
          useGameStore.getState().pushKillFeed('☠️ الباس دخل المرحلة 3/3 — احذر موجات الصدمة!', true);
          this.summonBossPhaseMinions(boss, 3);
        }
      }
      this.syncBossHud(boss);
    } else {
      enemy.refreshHpBar();
    }

    if (enemy.hp <= 0) {
      const dist = this.camera.position.distanceTo(enemy.group.position);
      this.killEnemy(enemy, hitZone === 'head', hitZone === 'generator', dist);
    }

    return { hit: true, crit: result.isCrit, shieldBlock: result.isShieldBlock };
  }

  private summonBossPhaseMinions(boss: BossEnemy, count: number): void {
    let spawned = 0;
    for (let i = 0; i < count && this.enemyManager.enemies.length < PLAYER_CONSTANTS.MAX_ENEMIES; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sx = boss.group.position.x + Math.cos(ang) * 5.0;
      const sz = boss.group.position.z + Math.sin(ang) * 5.0;
      const pick = Math.random() > 0.5 ? 'rusher' : 'trooper';
      if (this.enemyManager.spawn(pick, this.wave, this.camera.position, { x: sx, z: sz })) {
        spawned++;
      }
    }
    if (spawned > 0) {
      this.waveEnemiesRemaining += spawned;
      useGameStore.getState().setHudPatch({ enemiesLeft: this.waveEnemiesRemaining });
    }
  }

  private firePlayerRocket(dmg: number, splashRadius: number, muzzleWorld: THREE.Vector3): void {
    _ndc.set(0, 0);
    _raycaster.setFromCamera(_ndc, this.camera);
    const dir = _raycaster.ray.direction.clone().normalize();

    const rocketGroup = new THREE.Group();
    const body = new THREE.Mesh(this.rocketBodyGeo, new THREE.MeshBasicMaterial({ color: 0xf97316 }));
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(this.rocketNoseGeo, new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 0.48;
    rocketGroup.add(body, nose);

    rocketGroup.position.copy(muzzleWorld);
    _tmpVec.copy(muzzleWorld).add(dir);
    rocketGroup.lookAt(_tmpVec);
    this.scene.add(rocketGroup);

    this.playerRockets.push({
      mesh: rocketGroup,
      vel: dir.multiplyScalar(42),
      dmg,
      splashRadius,
      life: 3.5,
      trailTimer: 0,
    });
  }

  private detonatePlayerRocket(rocket: PlayerRocket): void {
    const pos = rocket.mesh.position;
    this.audio.play('rocketBoom');
    this.pools.spawnExplosion(pos, 0xff5500, 32, 16);
    this.pools.spawnExplosion(pos, 0xfef08a, 16, 11);
    this.player.camShake = Math.max(this.player.camShake, 0.065);
    this.hitstopTimer = 0.04;

    let anyHit = false;
    const snapshot = [...this.enemyManager.enemies];
    for (const e of snapshot) {
      if (e.hp <= 0) continue;
      _tmpVec.copy(e.group.position);
      _tmpVec.y += e.config.flying ? 0 : 1.3 * e.config.scale;
      const enemyRadius = e.config.isBoss ? 2.4 : 1.1;
      const dist = Math.max(0, _tmpVec.distanceTo(pos) - enemyRadius);
      if (dist <= rocket.splashRadius) {
        const falloff = 1 - 0.55 * (dist / rocket.splashRadius);
        this.applyDamageToEnemy(e, rocket.dmg * falloff, _tmpVec, 'body', 0xfb923c);
        anyHit = true;
      }
    }
    if (anyHit) this.showHitmarker(true);

    this.disposeGroupMaterials(rocket.mesh);
    this.scene.remove(rocket.mesh);
  }

  /** رمي قنبلة يدوية (مفتاح G) بمسار مقوس وارتداد وانفجار واسع */
  private throwGrenade(): void {
    if (this.player.grenades <= 0 || this.player.grenadeCooldown > 0) {
      this.audio.play('empty');
      return;
    }

    this.player.grenades--;
    this.player.grenadeCooldown = PLAYER_CONSTANTS.GRENADE_COOLDOWN;
    this.audio.play('grenadeThrow');

    _ndc.set(0, 0);
    _raycaster.setFromCamera(_ndc, this.camera);
    const dir = _raycaster.ray.direction.clone().normalize();

    const gGroup = new THREE.Group();
    const core = new THREE.Mesh(
      this.grenadeGeo,
      new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x16a34a,
        emissiveIntensity: 0.9,
        roughness: 0.3,
        metalness: 0.6,
      }),
    );
    gGroup.add(core);

    gGroup.position.copy(this.camera.position).addScaledVector(dir, 0.9);
    this.scene.add(gGroup);

    const vel = dir.multiplyScalar(22);
    vel.y += 5.5;

    this.grenades.push({
      mesh: gGroup,
      vel,
      fuse: 1.4,
      bounces: 0,
    });

    useGameStore.getState().setHudPatch({
      grenades: this.player.grenades,
      grenadeCooldown: this.player.grenadeCooldown,
    });
  }

  private detonateGrenade(g: ThrownGrenade): void {
    const pos = g.mesh.position;
    this.audio.play('grenadeBoom');
    this.pools.spawnExplosion(pos, 0x4ade80, 28, 16);
    this.pools.spawnExplosion(pos, 0xfef08a, 18, 12);
    this.player.camShake = Math.max(this.player.camShake, 0.08);
    this.hitstopTimer = 0.045;

    let anyHit = false;
    const snapshot = [...this.enemyManager.enemies];
    for (const e of snapshot) {
      if (e.hp <= 0) continue;
      _tmpVec.copy(e.group.position);
      _tmpVec.y += e.config.flying ? 0 : 1.2 * e.config.scale;
      const dist = Math.max(0, _tmpVec.distanceTo(pos) - (e.config.isBoss ? 2.2 : 1.0));
      if (dist <= PLAYER_CONSTANTS.GRENADE_RADIUS) {
        const falloff = 1 - 0.5 * (dist / PLAYER_CONSTANTS.GRENADE_RADIUS);
        this.applyDamageToEnemy(e, PLAYER_CONSTANTS.GRENADE_DAMAGE * falloff, _tmpVec, 'body', 0x4ade80);
        anyHit = true;
      }
    }
    if (anyHit) this.showHitmarker(true);

    this.disposeGroupMaterials(g.mesh);
    this.scene.remove(g.mesh);
  }

  /** معالجة مقتل عدو أو زعيم، الكومبو، سلسلة القتل، اللقطة البطيئة، والغنائم */
  private killEnemy(enemy: EnemyBase, isHead: boolean, isGenerator: boolean, killDist: number): void {
    const isBoss = !!enemy.config.isBoss;
    const pos = enemy.group.position.clone();
    pos.y += enemy.config.flying ? 0 : 1.3 * enemy.config.scale;

    if (isBoss) {
      this.audio.play('bossDeath');
      this.player.camShake = Math.max(this.player.camShake, 0.14);
      this.hitstopTimer = 0.075;
      this.syncBossHud(null);
    } else {
      this.audio.play('enemyDeath');
      if (isHead || enemy.config.type === 'heavy') {
        this.hitstopTimer = 0.035;
      }
    }

    this.pools.spawnExplosion(pos, enemy.config.color, isBoss ? 52 : 20, isBoss ? 18 : 12);
    if (isBoss) {
      this.pools.spawnExplosion(pos, 0xfef08a, 34, 14);
    }

    const dropOrigin = enemy.group.position.clone();
    const enemyName = enemy.config.name;
    const enemyBaseScore = enemy.config.score;
    const enemyType = enemy.config.type;

    this.enemyManager.removeEnemy(enemy);

    // تحديث الكومبو وسلسلة القتل
    this.kills++;
    this.killStreak++;
    this.comboCount++;
    this.comboTimer = PLAYER_CONSTANTS.COMBO_DURATION;
    const comboMult = computeComboMultiplier(this.comboCount);

    // اللقطة البطيئة عند القنص بالرأس من مسافة تزيد عن 30 متراً
    if (isHead && killDist > PLAYER_CONSTANTS.LONG_RANGE_HS_DIST) {
      this.slowMoTimer = PLAYER_CONSTANTS.SLOWMO_DURATION;
      this.audio.play('slowmo');
      useGameStore
        .getState()
        .pushKillFeed(`⚡ قنص بعيد بالرأس (${Math.round(killDist)}م) — لقطة بطيئة!`, true, true);
    }

    const totalPts = computeKillPoints(enemyBaseScore, isHead, isGenerator, this.comboCount);
    this.score += totalPts;
    if (isHead) this.headshots++;
    this.waveEnemiesRemaining = Math.max(0, this.waveEnemiesRemaining - 1);

    const multTag = comboMult > 1 ? ` [x${comboMult}]` : '';
    if (isBoss) {
      useGameStore.getState().pushKillFeed(`🏆 تم القضاء على الباس! +${totalPts}${multTag}`, true, true);
    } else if (isHead) {
      useGameStore.getState().pushKillFeed(`🎯 إصابة بالرأس (${enemyName}) +${totalPts}${multTag}`, true);
    } else if (isGenerator) {
      useGameStore.getState().pushKillFeed(`⚡ تدمير مولّد (${enemyName}) +${totalPts}${multTag}`, true);
    } else {
      useGameStore.getState().pushKillFeed(`قضاء على ${enemyName} +${totalPts}${multTag}`, false);
    }

    // مكافآت سلسلة القتل (5 / 10 / 15)
    const streakReward = getKillStreakReward(this.killStreak);
    if (streakReward) {
      this.audio.play('killstreak');
      this.showBanner(`🔥 سلسلة قتل: ${streakReward.title}!`, '#fbbf24');
      useGameStore.getState().pushKillFeed(`⭐ ${streakReward.description}`, false, true);
      if (streakReward.effect === 'shield_overcharge') {
        this.player.shield = Math.min(this.player.maxShield, this.player.shield + 40);
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 20);
      } else if (streakReward.effect === 'tactical_resupply') {
        this.weaponManager.refillAmmoAll(2);
        this.player.grenades = Math.min(this.player.maxGrenades, this.player.grenades + 2);
      } else if (streakReward.effect === 'fury_overdrive') {
        this.furyTimer = 12.0;
      }
    }

    // حفظ الأرقام القياسية أولاً بأول
    const rec = saveRecords(this.score, this.wave);
    useGameStore.getState().setHudPatch({
      score: this.score,
      kills: this.kills,
      headshots: this.headshots,
      killStreak: this.killStreak,
      enemiesLeft: this.waveEnemiesRemaining,
      bestScore: rec.bestScore,
      bestWave: rec.bestWave,
    });

    if (isBoss) {
      this.bossKills++;
      this.spawnPickup(new THREE.Vector3(dropOrigin.x - 1.8, 0, dropOrigin.z), 'health');
      this.spawnPickup(new THREE.Vector3(dropOrigin.x + 1.8, 0, dropOrigin.z), 'ammo');

      // القضاء على بقية أتباع الباس فور سقوطه
      for (const minion of [...this.enemyManager.enemies]) {
        _tmpVec.copy(minion.group.position);
        _tmpVec.y += 1.2;
        this.pools.spawnExplosion(_tmpVec, minion.config.color, 12, 10);
        this.enemyManager.removeEnemy(minion);
      }
      this.waveEnemiesRemaining = 0;

      // فتح السلاح التالي من أسلحة الباس (4-7)
      const unlocked = this.weaponManager.unlockNextBossWeapon();
      if (unlocked) {
        this.audio.play('unlock');
        this.showBanner(`🔓 سلاح جديد: ${unlocked.config.name}!`, '#fde047');
        useGameStore
          .getState()
          .pushKillFeed(
            `🔓 تم فتح سلاح جديد: ${unlocked.config.name} (مفتاح ${unlocked.config.id + 1})!`,
            true,
            true,
          );
      } else {
        this.score += 1500;
        this.showBanner('🏆 انتصار أسطوري! +1500 نقطة إضافية!', '#fde047');
      }

      this.syncWeaponHud();
      this.waveDelay = 3.0;
      this.pendingUpgrade = true;
    } else {
      if (enemyType === 'heavy' || enemyType === 'shielded' || Math.random() < 0.32) {
        this.spawnPickup(dropOrigin);
      }
      if (this.waveEnemiesRemaining === 0 && this.enemyManager.enemies.length === 0) {
        this.waveDelay = 1.9;
        this.pendingUpgrade = true;
        this.showBanner(`تم تطهير الموجة ${this.wave}!`, '#4ade80');
      }
    }
  }

  private spawnPickup(pos: THREE.Vector3, forceType?: 'health' | 'ammo'): void {
    const type = forceType ?? (Math.random() > 0.45 ? 'ammo' : 'health');
    const color = type === 'health' ? 0x22c55e : 0xfbbf24;
    const group = new THREE.Group();
    const box = new THREE.Mesh(
      this.pickupGeo,
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.45,
        roughness: 0.3,
      }),
    );
    const ring = new THREE.Mesh(this.pickupRingGeo, new THREE.MeshBasicMaterial({ color }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.3;
    group.add(box, ring);

    const baseY = this.mapManager.getGroundHeight(pos.x, pos.z, 10) + 0.7;
    group.position.set(pos.x, baseY, pos.z);
    this.scene.add(group);
    this.pickups.push({ group, baseY, type, life: 26 });
  }

  private handlePlayerDamage(amount: number, knockUp?: number): void {
    if (this.isGameOver || !this.isPlaying) return;
    this.audio.play('playerHit');
    const { died } = this.player.takeDamage(amount, knockUp);

    useGameStore.getState().setHudPatch({
      damageFlash: true,
      health: Math.ceil(this.player.health),
      shield: Math.ceil(this.player.shield),
    });
    if (this.damageFlashTimeout !== null) window.clearTimeout(this.damageFlashTimeout);
    this.damageFlashTimeout = window.setTimeout(() => {
      useGameStore.getState().setHudPatch({ damageFlash: false });
    }, 180);

    if (died) {
      this.triggerGameOver();
    }
  }

  private triggerGameOver(): void {
    this.isGameOver = true;
    this.isPlaying = false;
    this.hasActiveSession = false;
    this.clearHeldInputs();
    this.exitPointerLockSafe();

    const rec = saveRecords(this.score, this.wave);
    useGameStore.getState().setHudPatch({
      hasActiveSession: false,
      showScope: false,
      bestScore: rec.bestScore,
      bestWave: rec.bestWave,
      endSummary: {
        score: this.score,
        bestScore: rec.bestScore,
        wave: this.wave,
        bestWave: rec.bestWave,
        headshots: this.headshots,
        kills: this.kills,
        bossKills: this.bossKills,
        isNewRecord: rec.isNewRecord,
      },
    });
    useGameStore.getState().setScreen('gameover');
  }

  /* ==========================================
     معالجة الإدخال (لوحة المفاتيح والماوس)
     ========================================== */

  private handleKeyDown(e: KeyboardEvent): void {
    const store = useGameStore.getState();

    // اختصارات شاشة البداية: Enter أو Space تبدأ اللعب فوراً
    if (store.screen === 'title' && !store.settingsOpen) {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.startMission(store.selectedMap, true);
        return;
      }
    }

    // اختصار الإيقاف المؤقت / الاستئناف (Escape أو P)
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (store.settingsOpen) {
        store.setSettingsOpen(false);
        return;
      }
      if (store.screen === 'playing') {
        e.preventDefault();
        this.pauseMission();
        return;
      }
      if (store.screen === 'paused') {
        e.preventDefault();
        this.resumeMission();
        return;
      }
    }

    // اختصار كتم الصوت السريع (M)
    if (e.code === 'KeyM' && !e.repeat) {
      store.updateSettings({ muted: !store.settings.muted });
      return;
    }

    const firstPress = !this.keys[e.code];
    this.keys[e.code] = true;
    if (!this.isPlaying) return;
    this.audio.init();

    // التزحلق (C أو Ctrl)
    if (e.code === 'KeyC' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
      e.preventDefault();
      if (firstPress) {
        this.player.triggerSlide(this.keys, this.audio);
      }
    }

    // القفز (Space) أو قفزة التزحلق المعززة
    if (e.code === 'Space' && firstPress) {
      e.preventDefault();
      this.player.requestJump(this.audio);
    }

    // الاندفاع السريع (Q)
    if (e.code === 'KeyQ' && firstPress) {
      this.player.triggerDash(this.keys, this.audio);
    }

    // رمي قنبلة يدوية (G)
    if (e.code === 'KeyG' && firstPress) {
      this.throwGrenade();
    }

    // إعادة التلقيم (R)
    if (e.code === 'KeyR' && firstPress) {
      if (this.weaponManager.startReload()) {
        this.player.isSprinting = false;
        this.audio.play('reload');
        this.syncWeaponHud();
      }
    }

    // تبديل الأسلحة بالأرقام 1-7
    if (firstPress && e.code.startsWith('Digit')) {
      const num = parseInt(e.code.replace('Digit', ''), 10);
      if (num >= 1 && num <= 7) {
        const res = this.weaponManager.switchWeapon(num - 1);
        if (!res.switched && res.lockedMessage) {
          this.audio.play('empty');
        }
        this.syncWeaponHud();
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keys[e.code] = false;
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isPlaying) return;
    if (document.pointerLockElement !== this.renderer.domElement) return;
    const settings = useGameStore.getState().settings;
    const activeADS = this.isADS && !this.player.isSprinting;
    const adsMult = activeADS ? (this.weaponManager.current.config.isSniper ? 0.35 : 0.65) : 1.0;
    this.player.look(e.movementX, e.movementY, settings.sensitivity, adsMult);
    this.weaponManager.addMouseSway(e.movementX, e.movementY);
  }

  private handleMouseDown(e: MouseEvent): void {
    if (!this.isPlaying) return;
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, input, select, [data-ui-interactive="true"]')) return;

    this.audio.init();
    if (!document.pointerLockElement) {
      this.requestPointerLockSafe();
    }

    if (e.button === 0) {
      this.isMouseDown = true;
      this.fireWeapon();
    } else if (e.button === 2) {
      this.isADS = true;
      this.player.isSprinting = false;
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (e.button === 0) this.isMouseDown = false;
    if (e.button === 2) this.isADS = false;
  }

  private handleWheel(e: WheelEvent): void {
    if (!this.isPlaying) return;
    const step = e.deltaY > 0 ? 1 : -1;
    if (this.weaponManager.cycleWeapon(step)) {
      this.syncWeaponHud();
    }
  }

  private handlePointerLockChange(): void {
    const locked = document.pointerLockElement === this.renderer.domElement;
    if (locked) {
      this.pointerWasLocked = true;
    } else if (this.pointerWasLocked && this.isPlaying) {
      this.pointerWasLocked = false;
      this.pauseMission();
    }
  }

  private handleResize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /* ==========================================
     مزامنة واجهة اللعب (بتردد مخفض لحماية الأداء)
     ========================================== */

  private syncWeaponHud(): void {
    const w = this.weaponManager.current;
    useGameStore.getState().setHudPatch({
      weaponName: w.config.name,
      weaponRole: w.config.roleHint,
      ammoMag: w.mag,
      ammoReserve: w.reserve,
      isReloading: this.weaponManager.isReloading,
      reloadHint: this.weaponManager.getReloadHint(),
      weaponSlots: this.weaponManager.getSlotsUI(),
    });
  }

  private syncHudImmediate(): void {
    const w = this.weaponManager.current;
    const activeADS = this.isADS && !this.player.isSprinting;
    const showScope = activeADS && !!w.config.isSniper && !this.weaponManager.isReloading;
    const chSpread =
      (activeADS ? 2 : this.player.isSprinting ? 20 : this.player.isMoving ? 13 : 7) +
      this.weaponManager.weaponKickZ * 90;

    useGameStore.getState().setHudPatch({
      health: Math.ceil(this.player.health),
      maxHealth: this.player.maxHealth,
      shield: Math.ceil(this.player.shield),
      maxShield: this.player.maxShield,
      stamina: Math.ceil(this.player.stamina),
      maxStamina: PLAYER_CONSTANTS.MAX_STAMINA,
      staminaExhausted: this.player.staminaExhausted,
      isSliding: this.player.isSliding,
      isSprinting: this.player.isSprinting,
      slideCooldown: Number(this.player.slideCooldown.toFixed(1)),
      dashCooldown: Number(this.player.dashCooldown.toFixed(1)),
      dashCooldownBase: this.player.dashCooldownBase,
      grenades: this.player.grenades,
      maxGrenades: this.player.maxGrenades,
      grenadeCooldown: Number(this.player.grenadeCooldown.toFixed(1)),
      furyTimer: Number(this.furyTimer.toFixed(1)),
      weaponName: w.config.name,
      weaponRole: w.config.roleHint,
      ammoMag: w.mag,
      ammoReserve: w.reserve,
      isReloading: this.weaponManager.isReloading,
      reloadHint: this.weaponManager.getReloadHint(),
      weaponSlots: this.weaponManager.getSlotsUI(),
      crosshairSpread: Math.round(chSpread),
      showScope,
      thermalScope: !!w.config.isThermal,
      comboCount: this.comboCount,
      comboRatio: this.comboTimer > 0 ? this.comboTimer / PLAYER_CONSTANTS.COMBO_DURATION : 0,
      slowMoActive: this.slowMoTimer > 0,
    });
  }

  private updateRadarSnapshot(): void {
    this.radarEntities.length = 0;
    this.enemyManager.collectRadarEntities(this.radarEntities);
    for (const p of this.pickups) {
      this.radarEntities.push({
        x: p.group.position.x,
        z: p.group.position.z,
        color: p.type === 'health' ? '#22c55e' : '#fbbf24',
        kind: p.type === 'health' ? 'pickup_health' : 'pickup_ammo',
      });
    }
    const rd = useGameStore.getState().radarData;
    rd.playerX = this.camera.position.x;
    rd.playerZ = this.camera.position.z;
    rd.yaw = this.player.yaw;
    rd.scale = this.mapManager.activeMap.radarScale;
    rd.platforms = this.mapManager.platforms;
    rd.entities = this.radarEntities;
  }

  /* ==========================================
     حلقة المحاكاة والرسم الرئيسية (مع دعم afterDraw لـ Software WebGL)
     ========================================== */

  private scheduleNextFrame(): void {
    if (this.isDisposed) return;
    if (this.isSoftwareGl) {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(() => this.tick(), 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private tick(): void {
    if (this.isDisposed) return;

    const now = performance.now();
    // تقليم الفارق الزمني لتفادي اختراق الجدران عند تبديل النوافذ
    const rawDt = Math.min((now - this.prevTime) / 1000, 0.05);
    this.prevTime = now;

    const screen = useGameStore.getState().screen;

    // جولة الكاميرا السينمائية فوق الخريطة الحية في شاشة البداية
    if (screen === 'title') {
      this.tourAngle += rawDt * 0.14;
      const orbitR = this.mapManager.halfArena * 0.62;
      this.camera.position.set(
        Math.cos(this.tourAngle) * orbitR,
        14.5 + Math.sin(this.tourAngle * 1.4) * 2.2,
        Math.sin(this.tourAngle) * orbitR,
      );
      this.camera.lookAt(0, 2.2, 0);
      this.camera.fov = 65;
      this.camera.updateProjectionMatrix();
      this.renderer.render(this.scene, this.camera);
      this.scheduleNextFrame();
      return;
    }

    // حساب معامل الوقت (اللقطة البطيئة + تجميد الصدمات Hitstop)
    let timeScale = 1.0;
    if (this.isPlaying && this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - rawDt);
      timeScale = 0.04;
    } else if (this.isPlaying && this.slowMoTimer > 0) {
      this.slowMoTimer = Math.max(0, this.slowMoTimer - rawDt);
      timeScale = PLAYER_CONSTANTS.SLOWMO_TIMESCALE;
    }
    const dt = rawDt * timeScale;

    if (this.isPlaying) {
      if (this.comboTimer > 0) {
        this.comboTimer = Math.max(0, this.comboTimer - rawDt);
        if (this.comboTimer <= 0) this.comboCount = 0;
      }
      if (this.furyTimer > 0) {
        this.furyTimer = Math.max(0, this.furyTimer - rawDt);
      }

      // 1. تحديث اللاعب (الحركة، الركض، التزحلق، الاندفاع، الدرع)
      const { activeADS } = this.player.update(
        dt,
        rawDt,
        this.keys,
        this.isADS,
        this.weaponManager.isReloading,
        this.mapManager,
        this.pools,
        this.audio,
      );

      // 2. تحديث السلاح والإطلاق الآلي والتلقيم
      const wCfg = this.weaponManager.current.config;
      const { finishedReload } = this.weaponManager.update(
        rawDt,
        activeADS,
        this.player.isMoving,
        this.player.onGround,
        this.player.isSprinting,
        this.player.isSliding,
        this.player.bobTimer,
      );
      if (finishedReload) {
        this.syncWeaponHud();
      }
      if (this.isMouseDown && wCfg.auto && !this.weaponManager.isReloading) {
        this.fireWeapon();
      }

      // 3. تحديث زاوية رؤية الكاميرا (FOV للركض 84 / المنظار / الاندفاع)
      const targetFov = activeADS
        ? wCfg.adsFov
        : this.player.dashTimer > 0
          ? 87
          : this.player.isSprinting || this.player.isSliding
            ? 84
            : 75;
      this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-12 * rawDt));
      this.camera.updateProjectionMatrix();

      const showScope = activeADS && !!wCfg.isSniper && !this.weaponManager.isReloading;
      this.weaponManager.pivot.visible = !showScope;

      // 4. إدارة الموجات وتوليد الأعداء
      if (this.waveDelay > 0) {
        this.waveDelay -= rawDt;
        if (this.waveDelay <= 0) {
          if (this.pendingUpgrade) {
            this.pendingUpgrade = false;
            this.openUpgradeScreen();
          } else {
            this.startWave(this.wave + 1);
          }
        }
      } else if (this.waveToSpawn > 0) {
        this.spawnCooldown -= dt;
        if (this.spawnCooldown <= 0 && this.enemyManager.enemies.length < PLAYER_CONSTANTS.MAX_ENEMIES) {
          const enemyType = pickEnemyTypeForWave(this.wave, Math.random());
          if (this.enemyManager.spawn(enemyType, this.wave, this.camera.position)) {
            this.waveToSpawn--;
            this.spawnCooldown = Math.max(0.55, 1.5 - this.wave * 0.08);
          }
        }
      }

      // 5. تحديث الأعداء والزعيم
      this.enemyManager.update(
        dt,
        now,
        this.wave,
        this.camera.position,
        this.player.currentEyeHeight,
        {
          damagePlayer: (amt, knockUp) => this.handlePlayerDamage(amt, knockUp),
          addCameraShake: (amt) => {
            this.player.camShake = Math.max(this.player.camShake, amt);
          },
          notifyFeed: (text, isHs) => useGameStore.getState().pushKillFeed(text, !!isHs),
          onMinionsSummoned: (count) => {
            this.waveEnemiesRemaining += count;
            useGameStore.getState().setHudPatch({ enemiesLeft: this.waveEnemiesRemaining });
          },
        },
      );

      // 6. تحديث صواريخ اللاعب (RPG)
      for (let i = this.playerRockets.length - 1; i >= 0; i--) {
        const r = this.playerRockets[i];
        r.life -= dt;
        r.mesh.position.addScaledVector(r.vel, dt);
        r.trailTimer -= dt;
        if (r.trailTimer <= 0) {
          this.pools.spawnExplosion(r.mesh.position, 0xf97316, 1, 2.5);
          r.trailTimer = 0.03;
        }

        let hit =
          r.life <= 0 ||
          r.mesh.position.y <= 0.15 ||
          this.mapManager.isPointInsideObstacle(r.mesh.position);
        if (!hit) {
          for (const e of this.enemyManager.enemies) {
            _tmpVec.copy(e.group.position);
            _tmpVec.y += e.config.flying ? 0 : 1.3 * e.config.scale;
            if (r.mesh.position.distanceTo(_tmpVec) < (e.config.isBoss ? 2.5 : 1.25)) {
              hit = true;
              break;
            }
          }
        }
        if (hit) {
          this.detonatePlayerRocket(r);
          this.playerRockets.splice(i, 1);
        }
      }

      // 7. تحديث القنابل اليدوية (G)
      for (let i = this.grenades.length - 1; i >= 0; i--) {
        const g = this.grenades[i];
        g.fuse -= dt;
        g.vel.y -= 20 * dt;
        g.mesh.position.addScaledVector(g.vel, dt);
        g.mesh.rotation.x += dt * 7;
        g.mesh.rotation.z += dt * 5;

        const floorH = this.mapManager.getGroundHeight(g.mesh.position.x, g.mesh.position.z, g.mesh.position.y);
        if (g.mesh.position.y <= floorH + 0.18) {
          g.mesh.position.y = floorH + 0.18;
          if (Math.abs(g.vel.y) > 2.0) {
            g.vel.y = -g.vel.y * 0.45;
            g.vel.x *= 0.72;
            g.vel.z *= 0.72;
            g.bounces++;
            this.audio.play('grenadeBounce');
          } else {
            g.vel.set(g.vel.x * 0.85, 0, g.vel.z * 0.85);
          }
        }
        if (this.mapManager.isPointInsideObstacle(g.mesh.position)) {
          g.vel.x *= -0.5;
          g.vel.z *= -0.5;
        }

        let directEnemyHit = false;
        for (const e of this.enemyManager.enemies) {
          _tmpVec.copy(e.group.position);
          _tmpVec.y += e.config.flying ? 0 : 1.2 * e.config.scale;
          if (g.mesh.position.distanceTo(_tmpVec) < 1.2) {
            directEnemyHit = true;
            break;
          }
        }

        if (g.fuse <= 0 || directEnemyHit) {
          this.detonateGrenade(g);
          this.grenades.splice(i, 1);
        }
      }

      // 8. تحديث طلقات الأعداء المجمعة (Object Pool)
      for (let i = 0; i < this.pools.bullets.length; i++) {
        const b = this.pools.bullets[i];
        if (!b.active) continue;
        b.life -= dt;
        b.mesh.position.addScaledVector(b.vel, dt);

        const hitPlayer = this.player.isHitByPoint(b.mesh.position, 0.95);
        if (hitPlayer) {
          this.handlePlayerDamage(b.dmg);
        }

        if (hitPlayer || b.life <= 0 || this.mapManager.isPointInsideObstacle(b.mesh.position)) {
          if (!hitPlayer && b.life > 0) {
            this.pools.spawnExplosion(b.mesh.position, 0x38bdf8, 4, 4);
          }
          b.active = false;
          b.mesh.visible = false;
        }
      }

      // 9. تحديث صناديق العلاج والذخيرة
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const p = this.pickups[i];
        p.life -= dt;
        p.group.rotation.y += dt * 2.2;
        p.group.position.y = p.baseY + Math.sin(now * 0.004 + i) * 0.14;

        _tmpVec2.copy(p.group.position);
        const d = this.camera.position.distanceTo(_tmpVec2);
        let collected = false;
        if (d < 2.35) {
          if (p.type === 'health' && (this.player.health < this.player.maxHealth || this.player.shield < this.player.maxShield)) {
            this.player.health = Math.min(this.player.maxHealth, this.player.health + 40);
            this.player.shield = Math.min(this.player.maxShield, this.player.shield + 25);
            this.audio.play('pickup');
            useGameStore.getState().pushKillFeed('💚 صندوق علاج (+40 صحة و +25 درع)');
            collected = true;
          } else if (p.type === 'ammo') {
            this.weaponManager.refillAmmoAll(2);
            this.player.grenades = Math.min(this.player.maxGrenades, this.player.grenades + 1);
            this.audio.play('pickup');
            useGameStore.getState().pushKillFeed('🔶 ذخيرة إضافية +1 قنبلة يدوية');
            this.syncWeaponHud();
            collected = true;
          }
        }

        if (collected || p.life <= 0) {
          this.disposeGroupMaterials(p.group);
          this.scene.remove(p.group);
          this.pickups.splice(i, 1);
        }
      }

      // 10. تحديث بيانات الرادار ومزامنة واجهة اللعب بتردد ~12Hz
      this.updateRadarSnapshot();
      this.hudSyncTimer += rawDt;
      if (this.hudSyncTimer >= 0.08) {
        this.hudSyncTimer = 0;
        this.syncHudImmediate();
      }
    }

    // تحديث الجزيئات وآثار الرصاص
    this.pools.updateEffects(dt);

    // رسم الإطار ثلاثي الأبعاد
    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  }

  /** التخلص الكامل من المحرك وتحرير كل الذاكرة ومستمعي الأحداث */
  public dispose(): void {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    if (this.hitmarkerTimeout !== null) window.clearTimeout(this.hitmarkerTimeout);
    if (this.damageFlashTimeout !== null) window.clearTimeout(this.damageFlashTimeout);
    if (this.bannerTimeout !== null) window.clearTimeout(this.bannerTimeout);

    window.removeEventListener('resize', this.onResizeBound);
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    document.removeEventListener('mousemove', this.onMouseMoveBound);
    document.removeEventListener('mousedown', this.onMouseDownBound);
    document.removeEventListener('mouseup', this.onMouseUpBound);
    document.removeEventListener('wheel', this.onWheelBound);
    document.removeEventListener('contextmenu', this.onContextMenuBound);
    document.removeEventListener('pointerlockchange', this.onPointerLockChangeBound);
    window.removeEventListener('blur', this.onWindowBlurBound);
    document.removeEventListener('visibilitychange', this.onVisibilityChangeBound);

    this.exitPointerLockSafe();
    this.clearDynamicWorldEntities();

    this.pickupGeo.dispose();
    this.pickupRingGeo.dispose();
    this.rocketBodyGeo.dispose();
    this.rocketNoseGeo.dispose();
    this.grenadeGeo.dispose();

    this.enemyManager.dispose();
    this.weaponManager.dispose();
    this.mapManager.dispose();
    this.pools.dispose();
    this.audio.dispose();
    this.envTexture.dispose();

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    useGameStore.getState().setEngineActions(null);
  }
}
