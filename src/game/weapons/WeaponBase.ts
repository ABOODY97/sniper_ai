import * as THREE from 'three';
import type { ScopeZoomLevel, SniperBallisticsConfig, WeaponConfig, WeaponResourceMode } from '../types';
import { PLAYER_CONSTANTS, computeZoomSensitivityMultiplier } from '../rules';

/* ==========================================
   الفئة الأساسية للأسلحة مع حالة الذخيرة، مستويات التكبير،
   الاهتزاز أثناء التصويب، البالستية القابلة للضبط، وبناء النموذج ثلاثي الأبعاد
   ========================================== */

export interface WeaponMaterials {
  darkMetal: THREE.MeshStandardMaterial;
  gunMetal: THREE.MeshStandardMaterial;
  matteGrip: THREE.MeshStandardMaterial;
}

export interface WeaponResourceHudState {
  mode: WeaponResourceMode;
  value: number;
  max: number;
  overheated: boolean;
  overheatTimer: number;
  spinProgress: number;
}

export abstract class WeaponBase {
  public readonly config: WeaponConfig;
  public unlocked: boolean;
  public magSize: number;
  public mag: number;
  public maxReserve: number;
  public reserve: number;
  public zoomIndex = 0;
  public readonly model: THREE.Group;

  protected readonly ownDisposables: Array<THREE.BufferGeometry | THREE.Material> = [];
  protected readonly adsDimParts: Array<{
    mesh: THREE.Object3D;
    mat?: THREE.Material;
    baseOpacity: number;
    adsOpacity: number;
    hideThreshold?: number;
  }> = [];

  constructor(config: WeaponConfig, materials: WeaponMaterials) {
    this.config = config;
    this.unlocked = config.unlockedByDefault;
    this.magSize = config.baseMagSize;
    this.mag = config.baseMagSize;
    this.maxReserve = config.baseMaxReserve;
    this.reserve = config.baseMaxReserve - config.baseMagSize;
    this.model = this.buildModel(materials);
  }

  protected track<T extends THREE.BufferGeometry | THREE.Material>(res: T): T {
    this.ownDisposables.push(res);
    return res;
  }

  /** تسجيل جزء مضيء أو جانبي ليُخفّت أو يختفي بسلاسة أثناء التصويب (ADS) دون تشويش خط النظر */
  protected registerAdsDimPart(
    mesh: THREE.Object3D,
    mat?: THREE.Material,
    baseOpacity = 1,
    adsOpacity = 0,
    hideThreshold = 0.72,
  ): void {
    if (mat) {
      mat.transparent = true;
      mat.opacity = baseOpacity;
    }
    this.adsDimParts.push({ mesh, mat, baseOpacity, adsOpacity, hideThreshold });
  }

  /** تطبيق التأثيرات البصرية للتصويب تدريجياً وفق معامل adsBlend الموحّد (0 → 1) */
  public applyAdsVisuals(adsBlend: number): void {
    const t = Math.max(0, Math.min(1, adsBlend));
    for (let i = 0; i < this.adsDimParts.length; i++) {
      const entry = this.adsDimParts[i];
      if (entry.mat) {
        entry.mat.opacity = THREE.MathUtils.lerp(entry.baseOpacity, entry.adsOpacity, t);
      }
      if (entry.hideThreshold !== undefined) {
        entry.mesh.visible = t < entry.hideThreshold;
      }
    }
  }

  protected abstract buildModel(materials: WeaponMaterials): THREE.Group;

  /** إعادة ضبط السلاح ومستوى التكبير عند بدء مهمة جديدة */
  public reset(): void {
    this.unlocked = this.config.unlockedByDefault;
    this.magSize = this.config.baseMagSize;
    this.maxReserve = this.config.baseMaxReserve;
    this.mag = this.magSize;
    this.reserve = this.maxReserve - this.magSize;
    this.zoomIndex = 0;
    this.applyAdsVisuals(0);
  }

  /** توسيع سعة المخزن والذخيرة (عند اختيار ترقية الذخيرة) */
  public upgradeAmmoCapacity(): void {
    this.magSize = Math.ceil(this.magSize * 1.25);
    this.maxReserve = Math.ceil(this.maxReserve * 1.25);
    this.mag = this.magSize;
    this.reserve = this.maxReserve;
  }

  /** إضافة ذخيرة أو وقود من صناديق الإمداد (مع احترام الكميات المحدودة للأسلحة الثقيلة) */
  public addAmmo(magsCount = 2): void {
    if (!this.unlocked) return;
    if (this.config.pickupReserveAmount !== undefined) {
      const scaled = Math.max(1, Math.round(this.config.pickupReserveAmount * (magsCount / 2)));
      this.reserve = Math.min(this.maxReserve, this.reserve + scaled);
      return;
    }
    this.reserve = Math.min(this.maxReserve, this.reserve + this.magSize * magsCount);
  }

  /** هل يقيّد السلاح حالياً الركض والتزحلق والاندفاع (مثل الميني غان أثناء الدوران) */
  public isMovementRestricted(): boolean {
    return false;
  }

  /** مضاعف سرعة الحركة الفعلي للسلاح الحالي */
  public getMoveSpeedMultiplier(): number {
    return 1.0;
  }

  /** بيانات شريط المورد (ذخيرة / حرارة / وقود) لواجهة HUD */
  public getResourceHudState(): WeaponResourceHudState {
    return {
      mode: this.config.resourceMode ?? 'ammo',
      value: this.mag,
      max: this.magSize,
      overheated: false,
      overheatTimer: 0,
      spinProgress: 0,
    };
  }

  /** استدعاء عند إغماد السلاح للتبديل إلى سلاح آخر */
  public onHolster(): void {
    this.applyAdsVisuals(0);
  }

  /** التحقق مما إذا كان السلاح من فئة القناصات */
  public isSniperWeapon(): boolean {
    return Boolean(this.config.isSniper || this.config.isThermal);
  }

  /** مستوى التكبير الحالي لمنظار القناصة (x4 / x8 / x12) */
  public getCurrentZoomLevel(): ScopeZoomLevel | null {
    const levels = this.config.zoomLevels;
    if (!levels || levels.length === 0) return null;
    const clamped = Math.max(0, Math.min(levels.length - 1, this.zoomIndex));
    return levels[clamped];
  }

  /** تغيير مستوى التكبير عبر عجلة الماوس (+1 زيادة التكبير، -1 تقليل التكبير) */
  public stepZoom(delta: number): boolean {
    const levels = this.config.zoomLevels;
    if (!levels || levels.length <= 1) return false;
    const next = Math.max(0, Math.min(levels.length - 1, this.zoomIndex + delta));
    if (next === this.zoomIndex) return false;
    this.zoomIndex = next;
    return true;
  }

  /** تعيين مستوى التكبير مباشرةً بفهرس آمن */
  public setZoomIndex(index: number): void {
    const levels = this.config.zoomLevels;
    if (!levels || levels.length === 0) {
      this.zoomIndex = 0;
      return;
    }
    this.zoomIndex = Math.max(0, Math.min(levels.length - 1, index));
  }

  /** نص مستوى التكبير المعروض داخل المنظار */
  public getZoomLabel(): string {
    return this.getCurrentZoomLevel()?.label ?? 'x4';
  }

  /** زاوية الرؤية الفعلية أثناء التصويب مع مراعاة مستوى التكبير وتعطيل EMP */
  public getEffectiveAdsFov(empDisabled = false): number {
    if (empDisabled && this.isSniperWeapon()) {
      return 62;
    }
    const zoom = this.getCurrentZoomLevel();
    return zoom ? zoom.fov : this.config.adsFov;
  }

  /** مضاعف حساسية الماوس أثناء التصويب (يتدرج تلقائياً مع التكبير في القناصات) */
  public getAdsSensitivityMultiplier(currentFovDeg?: number): number {
    if (this.isSniperWeapon()) {
      const fov = currentFovDeg ?? this.getEffectiveAdsFov(false);
      return computeZoomSensitivityMultiplier(fov, PLAYER_CONSTANTS.BASE_HIP_FOV);
    }
    return this.config.adsSensitivityMult ?? 0.65;
  }

  /** سعة اهتزاز المنظار الأساسية لهذا السلاح (تزداد تدريجياً مع التكبير الأعلى) */
  public getScopeSwayAmplitude(): number {
    if (!this.isSniperWeapon()) return 0;
    const base = this.config.scopeSwayAmp ?? 0.008;
    const mag = this.getCurrentZoomLevel()?.magnification ?? 4;
    // تقليص السعة الزاوية قليلاً عند التكبير العالي مع إبقائها واضحة على الشاشة
    return base * Math.sqrt(4 / Math.max(1, mag));
  }

  /** إعدادات فيزياء المقذوفات الواقعية للقناصة */
  public getBallisticsConfig(): SniperBallisticsConfig | null {
    if (!this.isSniperWeapon()) return null;
    return this.config.ballistics ?? { speed: 210, gravity: 8.5, maxLife: 2.4 };
  }

  /** حساب الانتشار الفعلي للطلقة (صفر تماماً عند التصويب بالمنظار في القناصات) */
  public getEffectiveSpread(activeADS: boolean, isSprinting: boolean): number {
    if (activeADS && this.isSniperWeapon()) {
      return 0;
    }
    const baseSpread = activeADS ? this.config.adsSpread : this.config.spread;
    return baseSpread * (isSprinting ? 1.6 : 1.0);
  }

  /** حساب الارتداد الفعلي للطلقة (صفر تماماً عند التصويب بالمنظار في القناصات) */
  public getEffectiveRecoilKick(activeADS: boolean): number {
    if (activeADS && this.isSniperWeapon()) {
      return 0;
    }
    return this.config.recoilKick;
  }

  /** تحرير الهندسيات والمواد الخاصة بهذا السلاح */
  public dispose(): void {
    for (const d of this.ownDisposables) {
      d.dispose();
    }
    this.ownDisposables.length = 0;
  }
}
