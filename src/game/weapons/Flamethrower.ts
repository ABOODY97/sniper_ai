import * as THREE from 'three';
import {
  WeaponBase,
  type WeaponMaterials,
  type WeaponResourceHudState,
} from './WeaponBase';
import { PLAYER_CONSTANTS, stepFlamethrowerFuel } from '../rules';

/* ==========================================
   السلاح 9: قاذف اللهب الحراري (يُفتح عند هزيمة باس ملكة السرب)
   لهب مخروطي مستمر بمدى 9 وحدات وزاوية 60 درجة،
   شريط وقود (يستهلك 20/ث ويتجدد من احتياطي محدود عند التوقف)،
   ضرر مباشر 25/ث + حالة احتراق 8/ث لمدة 3ث دون تكديس ودون مضاعفة للرأس،
   يُحجب بالجدران، وتبقى الدروع الأمامية تحجب 80% من ضرره
   ========================================== */

export class Flamethrower extends WeaponBase {
  private pilotFlameMesh!: THREE.Mesh;
  private pilotFlameMat!: THREE.MeshBasicMaterial;
  private gaugeMat!: THREE.MeshBasicMaterial;

  public fuel: number = PLAYER_CONSTANTS.FLAME_FUEL_MAX;
  public regenDelay = 0;
  private pilotPhase = 0;

  constructor(materials: WeaponMaterials) {
    super(
      {
        id: 8,
        key: '9',
        name: 'قاذف اللهب الحراري',
        shortName: '9 لهب',
        roleHint: 'مخروط 60° · مدى 9م · احتراق 8/ث',
        auto: true,
        unlockedByDefault: false,
        fireRate: 0.05,
        dmg: PLAYER_CONSTANTS.FLAME_DIRECT_DPS,
        headDmg: PLAYER_CONSTANTS.FLAME_DIRECT_DPS,
        pellets: 1,
        baseMagSize: PLAYER_CONSTANTS.FLAME_FUEL_MAX,
        baseMaxReserve: 220,
        pickupReserveAmount: 60,
        reloadTime: 1.5,
        spread: 0,
        adsSpread: 0,
        recoilKick: 0.002,
        gunKick: 0.014,
        adsFov: 66,
        adsStyle: 'flamethrower',
        adsSensitivityMult: 0.75,
        color: 0xf97316,
        sfx: 'flamethrower',
        resourceMode: 'fuel',
        isFlamethrower: true,
        coneRange: PLAYER_CONSTANTS.FLAME_RANGE,
        coneAngleDeg: PLAYER_CONSTANTS.FLAME_CONE_DEG,
        fuelDrainPerSec: PLAYER_CONSTANTS.FLAME_FUEL_DRAIN_PER_SEC,
        fuelRegenPerSec: PLAYER_CONSTANTS.FLAME_FUEL_REGEN_PER_SEC,
        flameDirectDps: PLAYER_CONSTANTS.FLAME_DIRECT_DPS,
        restPos: new THREE.Vector3(0.28, -0.3, -0.52),
        adsPos: new THREE.Vector3(0.12, -0.22, -0.46),
      },
      materials,
    );
    this.fuel = PLAYER_CONSTANTS.FLAME_FUEL_MAX;
    this.mag = this.magSize;
    this.reserve = this.maxReserve;
  }

  protected buildModel(m: WeaponMaterials): THREE.Group {
    const g = new THREE.Group();

    const tankMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.45, roughness: 0.34 }),
    );
    const copperMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.8, roughness: 0.28 }),
    );
    this.gaugeMat = this.track(new THREE.MeshBasicMaterial({ color: 0xf97316 }));
    this.pilotFlameMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.9,
      }),
    );

    // الجسم الرئيسي للقاذف
    const body = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.11, 0.11, 0.48)),
      m.gunMetal,
    );
    body.position.set(0, 0.01, -0.14);

    // أنبوب الدفع الحراري والدرع المثقب
    const pipe = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.032, 0.036, 0.56, 10)),
      m.darkMetal,
    );
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(0, 0.03, -0.52);

    const heatShield = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.048, 0.048, 0.26, 10)),
      copperMat,
    );
    heatShield.rotation.x = Math.PI / 2;
    heatShield.position.set(0, 0.03, -0.46);

    // فوهة اللهب المتسعة في الأمام
    const nozzle = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.056, 0.036, 0.11, 10)),
      m.darkMetal,
    );
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 0.03, -0.82);

    // خزانان مضغوطان للوقود أسفل السلاح
    const tankGeo = this.track(new THREE.CylinderGeometry(0.046, 0.046, 0.34, 10));
    tankGeo.rotateX(Math.PI / 2);
    const leftTank = new THREE.Mesh(tankGeo, tankMat);
    leftTank.position.set(-0.048, -0.08, -0.22);
    const rightTank = new THREE.Mesh(tankGeo, tankMat);
    rightTank.position.set(0.048, -0.08, -0.22);

    // أنبوب ضغط علوي ومؤشر الوقود المضيء
    const topPipe = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 8)),
      copperMat,
    );
    topPipe.rotation.x = Math.PI / 2;
    topPipe.position.set(0.042, 0.078, -0.24);

    const fuelBar = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.05, 0.016, 0.14)),
      this.gaugeMat,
    );
    fuelBar.position.set(0, 0.072, -0.08);

    // ذراع الشعلة الاسترشادية (Pilot Light) عند الفوهة
    const igniterArm = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.014, 0.055, 0.02)),
      copperMat,
    );
    igniterArm.position.set(0, -0.02, -0.85);

    this.pilotFlameMesh = new THREE.Mesh(
      this.track(new THREE.ConeGeometry(0.018, 0.055, 8)),
      this.pilotFlameMat,
    );
    this.pilotFlameMesh.position.set(0, 0.024, -0.89);

    const grip = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.044, 0.12, 0.052)),
      m.matteGrip,
    );
    grip.position.set(0, -0.085, 0.05);
    grip.rotation.x = 0.2;

    g.add(
      body,
      pipe,
      heatShield,
      nozzle,
      leftTank,
      rightTank,
      topPipe,
      fuelBar,
      igniterArm,
      this.pilotFlameMesh,
      grip,
    );
    return g;
  }

  public override reset(): void {
    super.reset();
    this.fuel = PLAYER_CONSTANTS.FLAME_FUEL_MAX;
    this.mag = this.magSize;
    this.reserve = this.maxReserve;
    this.regenDelay = 0;
  }

  public override upgradeAmmoCapacity(): void {
    this.maxReserve = Math.ceil(this.maxReserve * 1.25);
    this.fuel = PLAYER_CONSTANTS.FLAME_FUEL_MAX;
    this.mag = this.magSize;
    this.reserve = this.maxReserve;
  }

  /** تحديث الوقود (استهلاك 20/ث أثناء الإطلاق أو تجدد من الاحتياطي عند التوقف) وتحريك الشعلة الاسترشادية */
  public updateFlamethrower(rawDt: number, isFiring: boolean): { activeFireDt: number } {
    const res = stepFlamethrowerFuel(
      {
        fuel: this.fuel,
        reserve: this.reserve,
        regenDelay: this.regenDelay,
      },
      rawDt,
      isFiring,
      this.config.fuelDrainPerSec ?? PLAYER_CONSTANTS.FLAME_FUEL_DRAIN_PER_SEC,
      this.config.fuelRegenPerSec ?? PLAYER_CONSTANTS.FLAME_FUEL_REGEN_PER_SEC,
      PLAYER_CONSTANTS.FLAME_FUEL_MAX,
    );

    this.fuel = res.next.fuel;
    this.reserve = res.next.reserve;
    this.regenDelay = res.next.regenDelay;
    this.mag = Math.round(this.fuel);

    // وميض الشعلة الأمامية وتحديث لون مؤشر الوقود
    this.pilotPhase += rawDt * (res.activeFireDt > 0 ? 34 : 12);
    const hasFuel = this.fuel > 0.5;
    this.pilotFlameMesh.visible = hasFuel;
    if (hasFuel) {
      const flicker = 0.8 + Math.sin(this.pilotPhase) * 0.25;
      this.pilotFlameMesh.scale.set(
        res.activeFireDt > 0 ? 1.55 : 1.0,
        flicker * (res.activeFireDt > 0 ? 1.7 : 1.0),
        res.activeFireDt > 0 ? 1.55 : 1.0,
      );
      this.pilotFlameMat.color.setHex(res.activeFireDt > 0 ? 0xfef08a : 0x38bdf8);
    }
    this.gaugeMat.color.setHex(this.fuel > 30 ? 0xf97316 : this.fuel > 10 ? 0xfacc15 : 0xef4444);

    return { activeFireDt: res.activeFireDt };
  }

  public override getResourceHudState(): WeaponResourceHudState {
    return {
      mode: 'fuel',
      value: Math.round(this.fuel),
      max: PLAYER_CONSTANTS.FLAME_FUEL_MAX,
      overheated: false,
      overheatTimer: 0,
      spinProgress: 0,
    };
  }
}
