import * as THREE from 'three';
import type { BossArchetypeId, WeaponSlotUI } from '../types';
import { WeaponBase, type WeaponMaterials, type WeaponResourceHudState } from './WeaponBase';
import { Rifle } from './Rifle';
import { Shotgun } from './Shotgun';
import { RailgunSniper } from './RailgunSniper';
import { FastPistol } from './FastPistol';
import { SemiAutoSniper } from './SemiAutoSniper';
import { RocketLauncher } from './RocketLauncher';
import { ThermalSniper } from './ThermalSniper';
import { Minigun } from './Minigun';
import { Flamethrower } from './Flamethrower';

/* ==========================================
   مدير الأسلحة — يدير التبديل، الإطلاق، التلقيم، الارتداد،
   حركة السلاح باليد، وفتح أسلحة الباس (4-9)
   ========================================== */

export class WeaponManager {
  public readonly pivot = new THREE.Group();
  public readonly muzzleLight: THREE.PointLight;
  public readonly weapons: WeaponBase[];
  private readonly sharedMaterials: WeaponMaterials;

  public currentIndex = 0;
  public fireCooldown = 0;
  public isReloading = false;
  public reloadTimer = 0;
  public weaponKickZ = 0;
  public swayX = 0;
  public swayY = 0;
  public customHint = '';

  // مضاعفات الترقيات
  public dmgMult = 1.0;
  public reloadMult = 1.0;
  public fireRateMult = 1.0;

  private readonly _muzzleLocal = new THREE.Vector3(0, 0.04, -0.78);

  constructor(camera: THREE.PerspectiveCamera) {
    this.sharedMaterials = {
      darkMetal: new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.82, roughness: 0.24 }),
      gunMetal: new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.62, roughness: 0.36 }),
      matteGrip: new THREE.MeshStandardMaterial({ color: 0x171c26, metalness: 0.15, roughness: 0.78 }),
    };

    this.weapons = [
      new Rifle(this.sharedMaterials),
      new Shotgun(this.sharedMaterials),
      new RailgunSniper(this.sharedMaterials),
      new FastPistol(this.sharedMaterials),
      new SemiAutoSniper(this.sharedMaterials),
      new RocketLauncher(this.sharedMaterials),
      new ThermalSniper(this.sharedMaterials),
      new Minigun(this.sharedMaterials),
      new Flamethrower(this.sharedMaterials),
    ];

    this.muzzleLight = new THREE.PointLight(0x38bdf8, 0, 10);
    this.muzzleLight.position.set(0, 0.05, -0.9);
    this.pivot.add(this.muzzleLight);

    this.weapons.forEach((w, i) => {
      w.model.visible = i === 0;
      this.pivot.add(w.model);
    });

    camera.add(this.pivot);
  }

  public get current(): WeaponBase {
    return this.weapons[this.currentIndex];
  }

  /** إعادة ضبط الأسلحة عند بدء مهمة جديدة */
  public reset(): void {
    this.dmgMult = 1.0;
    this.reloadMult = 1.0;
    this.fireRateMult = 1.0;
    this.fireCooldown = 0;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.weaponKickZ = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.customHint = '';

    this.weapons.forEach((w, idx) => {
      w.reset();
      w.model.visible = idx === 0;
    });
    this.currentIndex = 0;
    this.pivot.position.copy(this.current.config.restPos);
    this.pivot.rotation.set(0, 0, 0);
  }

  /** تبديل السلاح بالرقم (0-8 للمفاتيح 1-9) */
  public switchWeapon(idx: number): { switched: boolean; lockedMessage?: string } {
    if (idx === this.currentIndex || idx < 0 || idx >= this.weapons.length) {
      return { switched: false };
    }
    if (!this.weapons[idx].unlocked) {
      if (idx === 7) {
        this.customHint = '🔒 يُفتح M134 ميني غان بعد القضاء على أول باس!';
      } else if (idx === 8) {
        this.customHint = '🔒 يُفتح قاذف اللهب بعد هزيمة باس ملكة السرب!';
      } else {
        this.customHint = '🔒 يُفتح هذا السلاح بعد القضاء على الباس!';
      }
      return { switched: false, lockedMessage: this.customHint };
    }
    this.weapons[this.currentIndex].onHolster();
    this.isReloading = false;
    this.reloadTimer = 0;
    this.customHint = '';
    this.weapons[this.currentIndex].model.visible = false;
    this.currentIndex = idx;
    this.weapons[this.currentIndex].model.visible = true;
    this.pivot.position.y -= 0.18;
    this.fireCooldown = 0.2;
    return { switched: true };
  }

  /** تبديل السلاح بعجلة الماوس بين الأسلحة المفتوحة فقط */
  public cycleWeapon(step: number): boolean {
    let next = this.currentIndex;
    for (let i = 0; i < this.weapons.length; i++) {
      next = (next + step + this.weapons.length) % this.weapons.length;
      if (this.weapons[next].unlocked) {
        return this.switchWeapon(next).switched;
      }
    }
    return false;
  }

  /** بدء إعادة التلقيم (مُعطّل للأسلحة ذات الحرارة أو الوقود) */
  public startReload(): boolean {
    const w = this.current;
    if (w.config.resourceMode === 'heat' || w.config.resourceMode === 'fuel') {
      return false;
    }
    if (this.isReloading || w.mag === w.magSize || w.reserve <= 0) return false;
    this.isReloading = true;
    this.customHint = '';
    this.reloadTimer = w.config.reloadTime * this.reloadMult;
    return true;
  }

  /** فتح السلاح التالي المقفل من أسلحة الباس القياسية (4-7) */
  public unlockNextBossWeapon(): WeaponBase | null {
    const locked = this.weapons.find((w) => !w.unlocked && w.config.id <= 6);
    if (!locked) return null;
    locked.unlocked = true;
    locked.mag = locked.magSize;
    locked.reserve = locked.maxReserve;
    return locked;
  }

  /** فتح مكافآت الأسلحة عند قتل الزعيم (أول باس يفتح الميني غان، وملكة السرب تفتح قاذف اللهب) */
  public unlockBossKillRewards(bossArchetype: BossArchetypeId, bossKills: number): WeaponBase[] {
    const unlockedNow: WeaponBase[] = [];

    // 1. قتل أول باس يفتح سلاح M134 ميني غان
    const minigun = this.weapons[7];
    if (bossKills >= 1 && minigun && !minigun.unlocked) {
      minigun.unlocked = true;
      minigun.mag = minigun.magSize;
      minigun.reserve = minigun.maxReserve;
      unlockedNow.push(minigun);
    }

    // 2. هزيمة باس ملكة السرب تفتح قاذف اللهب الحراري
    const flamethrower = this.weapons[8];
    if (bossArchetype === 'swarm_queen' && flamethrower && !flamethrower.unlocked) {
      flamethrower.unlocked = true;
      flamethrower.mag = flamethrower.magSize;
      flamethrower.reserve = flamethrower.maxReserve;
      if (flamethrower instanceof Flamethrower) {
        flamethrower.fuel = flamethrower.magSize;
      }
      unlockedNow.push(flamethrower);
    }

    // 3. فتح السلاح التالي من أسلحة الباس القياسية (4-7) للحفاظ على التدرج
    const standardUnlock = this.unlockNextBossWeapon();
    if (standardUnlock) {
      unlockedNow.push(standardUnlock);
    }

    return unlockedNow;
  }

  /** هل السلاح النشط يقيّد الركض والتزحلق والاندفاع */
  public isMovementRestricted(): boolean {
    return this.current.isMovementRestricted();
  }

  /** مضاعف سرعة الحركة الحالي من السلاح النشط */
  public getMoveSpeedMultiplier(): number {
    return this.current.getMoveSpeedMultiplier();
  }

  /** بيانات مورد السلاح الحالي (ذخيرة/حرارة/وقود) للـ HUD */
  public getResourceHudState(): WeaponResourceHudState {
    return this.current.getResourceHudState();
  }

  /** فتح جميع الأسلحة التسعة من البداية وتعبئتها بالكامل (مخصص لوضع تحدي الزعماء) */
  public unlockAllWeapons(): void {
    for (const w of this.weapons) {
      w.unlocked = true;
    }
    this.refillAllResourcesFull();
  }

  /** إعادة تعبئة كاملة للذخيرة والمخازن ووقود قاذف اللهب وتصفير حرارة الميني غان (بين الزعماء في تحدي الزعماء) */
  public refillAllResourcesFull(): void {
    this.isReloading = false;
    this.reloadTimer = 0;
    this.customHint = '';
    for (const w of this.weapons) {
      if (!w.unlocked) continue;
      w.mag = w.magSize;
      w.reserve = w.maxReserve;
      if (w instanceof Minigun) {
        w.heat = 0;
        w.overheated = false;
        w.overheatTimer = 0;
        w.coolDelay = 0;
        w.spinProgress = 0;
      } else if (w instanceof Flamethrower) {
        w.fuel = w.magSize;
        w.regenDelay = 0;
      }
    }
  }

  /** إضافة ذخيرة لكل الأسلحة المفتوحة */
  public refillAmmoAll(magsCount = 2): void {
    for (const w of this.weapons) {
      w.addAmmo(magsCount);
    }
  }

  /** ترقية سعة المخازن والذخيرة لكل الأسلحة */
  public upgradeAllAmmo(): void {
    for (const w of this.weapons) {
      w.upgradeAmmoCapacity();
    }
  }

  /** حساب الموقع العالمي لفوهة السلاح الحالي */
  public getMuzzleWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    out.copy(this._muzzleLocal);
    return this.pivot.localToWorld(out);
  }

  /** تحديث مؤقتات الإطلاق والتلقيم وحركة السلاح الناعمة */
  public update(
    rawDt: number,
    activeADS: boolean,
    isMoving: boolean,
    onGround: boolean,
    isSprinting: boolean,
    isSliding: boolean,
    bobTimer: number,
  ): { finishedReload: boolean } {
    let finishedReload = false;

    if (this.fireCooldown > 0) {
      this.fireCooldown = Math.max(0, this.fireCooldown - rawDt);
    }

    if (this.isReloading) {
      this.reloadTimer -= rawDt;
      if (this.reloadTimer <= 0) {
        const w = this.current;
        const needed = w.magSize - w.mag;
        const taken = Math.min(needed, w.reserve);
        w.mag += taken;
        w.reserve -= taken;
        this.isReloading = false;
        finishedReload = true;
      }
    }

    const w = this.current.config;
    this.weaponKickZ = Math.max(0, this.weaponKickZ - rawDt * 1.1);
    const swayDamp = 1 - Math.exp(-10 * rawDt);
    this.swayX += (0 - this.swayX) * swayDamp;
    this.swayY += (0 - this.swayY) * swayDamp;

    const targetPos = activeADS ? w.adsPos : w.restPos;
    const bobAmpX = isSprinting ? 0.026 : 0.012;
    const bobAmpY = isSprinting ? 0.03 : 0.014;
    const bobX = isMoving && onGround && !activeADS && !isSliding ? Math.cos(bobTimer) * bobAmpX : 0;
    const bobY = isMoving && onGround && !activeADS && !isSliding ? Math.abs(Math.sin(bobTimer)) * bobAmpY : 0;
    const reloadDip = this.isReloading ? -0.16 : 0;
    const sprintDip = isSprinting ? -0.065 : 0;
    const targetRotX = this.isReloading ? -0.45 : isSprinting ? -0.26 : this.weaponKickZ * 1.4;
    const targetRotZ = isSprinting ? 0.14 : isSliding && !activeADS ? -0.1 : 0;

    const posDamp = 1 - Math.exp(-14 * rawDt);
    const zDamp = 1 - Math.exp(-18 * rawDt);
    this.pivot.position.x += (targetPos.x + bobX + this.swayX - this.pivot.position.x) * posDamp;
    this.pivot.position.y += (targetPos.y - bobY + this.swayY + reloadDip + sprintDip - this.pivot.position.y) * posDamp;
    this.pivot.position.z += (targetPos.z + this.weaponKickZ - this.pivot.position.z) * zDamp;
    this.pivot.rotation.x += (targetRotX - this.pivot.rotation.x) * posDamp;
    this.pivot.rotation.z += (targetRotZ - this.pivot.rotation.z) * (1 - Math.exp(-12 * rawDt));

    if (this.muzzleLight.intensity > 0) {
      this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - rawDt * 60);
    }

    return { finishedReload };
  }

  /** تطبيق ميلان السلاح استجابةً لحركة الماوس */
  public addMouseSway(dx: number, dy: number): void {
    this.swayX = Math.max(-0.04, Math.min(0.04, this.swayX - dx * 0.00015));
    this.swayY = Math.max(-0.04, Math.min(0.04, this.swayY + dy * 0.00015));
  }

  /** تجهيز بيانات شريط الأسلحة للواجهة */
  public getSlotsUI(): WeaponSlotUI[] {
    return this.weapons.map((w, idx) => ({
      id: idx,
      shortName: w.config.shortName,
      unlocked: w.unlocked,
      active: idx === this.currentIndex,
    }));
  }

  public getReloadHint(): string {
    if (this.customHint) return this.customHint;
    if (this.current instanceof Minigun) {
      if (this.current.overheated) {
        return `🔥 سخونة زائدة! تبريد ${this.current.overheatTimer.toFixed(1)}ث`;
      }
      if (this.current.reserve <= 0) {
        return 'نفدت ذخيرة الميني غان! التقط صناديق الإمداد';
      }
      if (this.current.spinProgress > 0.05 && this.current.spinProgress < 0.99) {
        return 'جارِ تدوير السبطانات...';
      }
      return '';
    }
    if (this.current instanceof Flamethrower) {
      if (this.current.fuel <= 0.5 && this.current.reserve <= 0.5) {
        return 'نفد الوقود! التقط صناديق الإمداد';
      }
      if (this.current.fuel < 15 && this.current.reserve > 0) {
        return 'وقود منخفض — توقف لإعادة الشحن';
      }
      return '';
    }
    if (this.isReloading) return 'جارِ إعادة التلقيم...';
    if (this.current.mag === 0) return 'اضغط R لإعادة التلقيم!';
    return '';
  }

  public dispose(): void {
    for (const w of this.weapons) {
      w.dispose();
    }
    this.sharedMaterials.darkMetal.dispose();
    this.sharedMaterials.gunMetal.dispose();
    this.sharedMaterials.matteGrip.dispose();
  }
}
