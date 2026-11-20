import * as THREE from 'three';
import type { WeaponConfig } from '../types';

/* ==========================================
   الفئة الأساسية للأسلحة مع حالة الذخيرة وبناء النموذج ثلاثي الأبعاد
   ========================================== */

export interface WeaponMaterials {
  darkMetal: THREE.MeshStandardMaterial;
  gunMetal: THREE.MeshStandardMaterial;
  matteGrip: THREE.MeshStandardMaterial;
}

export abstract class WeaponBase {
  public readonly config: WeaponConfig;
  public unlocked: boolean;
  public magSize: number;
  public mag: number;
  public maxReserve: number;
  public reserve: number;
  public readonly model: THREE.Group;

  protected readonly ownDisposables: Array<THREE.BufferGeometry | THREE.Material> = [];

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

  protected abstract buildModel(materials: WeaponMaterials): THREE.Group;

  /** إعادة ضبط السلاح عند بدء مهمة جديدة */
  public reset(): void {
    this.unlocked = this.config.unlockedByDefault;
    this.magSize = this.config.baseMagSize;
    this.maxReserve = this.config.baseMaxReserve;
    this.mag = this.magSize;
    this.reserve = this.maxReserve - this.magSize;
  }

  /** توسيع سعة المخزن والذخيرة (عند اختيار ترقية الذخيرة) */
  public upgradeAmmoCapacity(): void {
    this.magSize = Math.ceil(this.magSize * 1.25);
    this.maxReserve = Math.ceil(this.maxReserve * 1.25);
    this.mag = this.magSize;
    this.reserve = this.maxReserve;
  }

  /** إضافة ذخيرة من صناديق الإمداد */
  public addAmmo(magsCount = 2): void {
    if (!this.unlocked) return;
    this.reserve = Math.min(this.maxReserve, this.reserve + this.magSize * magsCount);
  }

  /** التحقق مما إذا كان السلاح من فئة القناصات */
  public isSniperWeapon(): boolean {
    return Boolean(this.config.isSniper || this.config.isThermal);
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
