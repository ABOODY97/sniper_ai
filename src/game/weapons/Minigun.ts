import * as THREE from 'three';
import {
  WeaponBase,
  type WeaponMaterials,
  type WeaponResourceHudState,
} from './WeaponBase';
import { PLAYER_CONSTANTS, stepMinigunHeat } from '../rules';

/* ==========================================
   السلاح 8: M134 ميني غان (يُفتح عند قتل أول باس)
   6 سبطانات دوارة، تحمية 0.7ث قبل الإطلاق، معدل إطلاق 0.04ث،
   شريط حرارة (سخونة زائدة عند 100 وتبريد إجباري 2.5ث)،
   سرعة حركة ×0.5 ومنع الركض/التزحلق/الاندفاع أثناء الدوران،
   أثر طلقة كل 3 رصاصات، وتقليص الضرر ضد الباس بنسبة 30%
   ========================================== */

export class Minigun extends WeaponBase {
  private barrelCluster!: THREE.Group;
  private heatGlowMat!: THREE.MeshStandardMaterial;

  public heat = 0;
  public overheated = false;
  public overheatTimer = 0;
  public coolDelay = 0;
  public spinProgress = 0;
  public shotCounter = 0;
  private spinAudioCooldown = 0;

  constructor(materials: WeaponMaterials) {
    super(
      {
        id: 7,
        key: '8',
        name: 'M134 ميني غان',
        shortName: '8 ميني غان',
        roleHint: '6 سبطانات · دوران 0.7ث · شريط حرارة',
        auto: true,
        unlockedByDefault: false,
        fireRate: 0.04,
        dmg: 9,
        headDmg: 14,
        pellets: 1,
        baseMagSize: 100,
        baseMaxReserve: 360,
        pickupReserveAmount: 90,
        reloadTime: 2.5,
        spread: 0.055,
        adsSpread: 0.014,
        recoilKick: 0.017,
        gunKick: 0.058,
        adsFov: 60,
        adsStyle: 'minigun',
        adsSensitivityMult: 0.65,
        color: 0xf59e0b,
        sfx: 'minigunFire',
        resourceMode: 'heat',
        isMinigun: true,
        spinUpTime: PLAYER_CONSTANTS.MINIGUN_SPIN_UP_TIME,
        heatPerShot: 2.1,
        heatCoolRate: PLAYER_CONSTANTS.MINIGUN_HEAT_COOL_RATE,
        overheatCooldown: PLAYER_CONSTANTS.MINIGUN_OVERHEAT_COOLDOWN,
        bossDamageMult: PLAYER_CONSTANTS.MINIGUN_BOSS_DAMAGE_MULT,
        tracerEveryN: 3,
        moveSpeedMultWhileActive: PLAYER_CONSTANTS.MINIGUN_MOVE_SPEED_MULT,
        restrictMobilityWhileActive: true,
        restPos: new THREE.Vector3(0.3, -0.34, -0.56),
        adsPos: new THREE.Vector3(0.14, -0.25, -0.5),
      },
      materials,
    );
    this.reserve = this.maxReserve;
    this.mag = this.magSize;
  }

  protected buildModel(m: WeaponMaterials): THREE.Group {
    const g = new THREE.Group();

    const brassMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.78, roughness: 0.3 }),
    );
    const hazardMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.4, roughness: 0.45 }),
    );
    this.heatGlowMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x451a03,
        emissive: 0xf97316,
        emissiveIntensity: 0.15,
        roughness: 0.35,
        metalness: 0.5,
      }),
    );

    // المحرك الخلفي وهيكل السلاح الثقيل
    const motorHousing = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.088, 0.095, 0.32, 12)),
      m.darkMetal,
    );
    motorHousing.rotation.x = Math.PI / 2;
    motorHousing.position.set(0, -0.01, -0.02);

    const chassisTop = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.13, 0.08, 0.28)),
      m.gunMetal,
    );
    chassisTop.position.set(0, 0.05, -0.04);

    // مقبض الحمل العلوي (Chainsaw Grip)
    const handleBar = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.12, 0.022, 0.024)),
      m.matteGrip,
    );
    handleBar.position.set(0, 0.15, -0.08);
    const handleLeft = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.02, 0.09, 0.024)),
      m.darkMetal,
    );
    handleLeft.position.set(-0.055, 0.11, -0.08);
    const handleRight = handleLeft.clone();
    handleRight.position.x = 0.055;

    // أسطوانة الذخيرة الجانبية ومجرى الشريط النحاسي
    const ammoDrum = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.085, 0.085, 0.17, 12)),
      m.gunMetal,
    );
    ammoDrum.rotation.z = Math.PI / 2;
    ammoDrum.position.set(-0.12, -0.075, -0.05);

    const feedChute = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.07, 0.045, 0.1)),
      brassMat,
    );
    feedChute.position.set(-0.07, -0.03, -0.06);

    const hazardStripe = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.134, 0.018, 0.09)),
      hazardMat,
    );
    hazardStripe.position.set(0, 0.06, -0.14);

    // مجموعة السبطانات الست الدوّارة
    this.barrelCluster = new THREE.Group();
    this.barrelCluster.position.set(0, -0.01, -0.48);

    const singleBarrelGeo = this.track(new THREE.CylinderGeometry(0.011, 0.011, 0.68, 8));
    singleBarrelGeo.rotateX(Math.PI / 2);

    const ringRadius = 0.046;
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const b = new THREE.Mesh(singleBarrelGeo, m.darkMetal);
      b.position.set(Math.cos(ang) * ringRadius, Math.sin(ang) * ringRadius, 0);
      this.barrelCluster.add(b);
    }

    // أطواق التثبيت المتوهجة بالحرارة على السبطانات
    const clampGeo = this.track(new THREE.CylinderGeometry(0.064, 0.064, 0.028, 12));
    clampGeo.rotateX(Math.PI / 2);
    const rearClamp = new THREE.Mesh(clampGeo, this.heatGlowMat);
    rearClamp.position.z = 0.14;
    const midClamp = new THREE.Mesh(clampGeo, m.gunMetal);
    midClamp.position.z = -0.06;
    const muzzleClamp = new THREE.Mesh(clampGeo, this.heatGlowMat);
    muzzleClamp.position.z = -0.28;

    this.barrelCluster.add(rearClamp, midClamp, muzzleClamp);

    g.add(
      motorHousing,
      chassisTop,
      handleBar,
      handleLeft,
      handleRight,
      ammoDrum,
      feedChute,
      hazardStripe,
      this.barrelCluster,
    );
    return g;
  }

  public override reset(): void {
    super.reset();
    this.reserve = this.maxReserve;
    this.mag = this.magSize;
    this.heat = 0;
    this.overheated = false;
    this.overheatTimer = 0;
    this.coolDelay = 0;
    this.spinProgress = 0;
    this.shotCounter = 0;
    this.spinAudioCooldown = 0;
  }

  public override upgradeAmmoCapacity(): void {
    this.maxReserve = Math.ceil(this.maxReserve * 1.25);
    this.reserve = this.maxReserve;
    this.mag = this.magSize;
  }

  public override onHolster(): void {
    this.spinProgress = 0;
  }

  /** هل اكتملت تحمية السبطانات ويمكن الإطلاق الآن */
  public isSpunUp(): boolean {
    return this.spinProgress >= 0.999 && !this.overheated && this.reserve > 0;
  }

  /** هل السبطانات تدور حالياً (مما يبطئ الحركة ويمنع الركض والتزحلق والاندفاع) */
  public isSpinning(): boolean {
    return this.spinProgress > 0.12;
  }

  public override isMovementRestricted(): boolean {
    return this.isSpinning();
  }

  public override getMoveSpeedMultiplier(): number {
    return this.isSpinning()
      ? (this.config.moveSpeedMultWhileActive ?? PLAYER_CONSTANTS.MINIGUN_MOVE_SPEED_MULT)
      : 1.0;
  }

  /** تحديث الدوران والتبريد وتوهج الحرارة كل إطار */
  public updateMinigun(
    rawDt: number,
    wantsSpin: boolean,
  ): { playSpinSound: boolean } {
    const spinTime = this.config.spinUpTime ?? PLAYER_CONSTANTS.MINIGUN_SPIN_UP_TIME;
    const canSpin = wantsSpin && !this.overheated && this.reserve > 0;

    if (canSpin) {
      this.spinProgress = Math.min(1, this.spinProgress + rawDt / Math.max(0.05, spinTime));
    } else {
      this.spinProgress = Math.max(0, this.spinProgress - rawDt / 0.55);
    }

    // تدوير السبطانات الست بسرعة متناسبة مع نسبة التحمية
    if (this.spinProgress > 0.01) {
      this.barrelCluster.rotation.z += rawDt * (4 + this.spinProgress * 30);
    }

    // تبريد الحرارة أو متابعة مؤقت السخونة الزائدة (2.5ث)
    const nextHeat = stepMinigunHeat(
      {
        heat: this.heat,
        overheated: this.overheated,
        overheatTimer: this.overheatTimer,
        coolDelay: this.coolDelay,
      },
      rawDt,
      0,
      this.config.heatPerShot ?? 2.1,
      this.config.heatCoolRate ?? PLAYER_CONSTANTS.MINIGUN_HEAT_COOL_RATE,
      this.config.overheatCooldown ?? PLAYER_CONSTANTS.MINIGUN_OVERHEAT_COOLDOWN,
    );
    this.heat = nextHeat.heat;
    this.overheated = nextHeat.overheated;
    this.overheatTimer = nextHeat.overheatTimer;
    this.coolDelay = nextHeat.coolDelay;

    // توهج أطواق السبطانات حسب نسبة الحرارة
    const heatRatio = Math.max(0, Math.min(1, this.heat / PLAYER_CONSTANTS.MINIGUN_HEAT_MAX));
    this.heatGlowMat.emissive.setHex(this.overheated ? 0xef4444 : 0xf97316);
    this.heatGlowMat.emissiveIntensity = this.overheated
      ? 2.2
      : 0.15 + heatRatio * heatRatio * 1.9;

    // صوت تحمية السبطانات أثناء التسارع
    let playSpinSound = false;
    if (this.spinAudioCooldown > 0) {
      this.spinAudioCooldown = Math.max(0, this.spinAudioCooldown - rawDt);
    }
    if (canSpin && this.spinProgress < 0.98 && this.spinAudioCooldown <= 0) {
      playSpinSound = true;
      this.spinAudioCooldown = 0.16;
    }

    return { playSpinSound };
  }

  /** تسجيل إطلاق رصاصة واحدة: استهلاك الاحتياطي، رفع الحرارة، وتحديد ظهور خط الأثر (كل 3 رصاصات) */
  public registerShotFired(): { overheatedNow: boolean; shouldSpawnTracer: boolean } {
    const wasOverheated = this.overheated;
    this.reserve = Math.max(0, this.reserve - 1);
    this.shotCounter++;

    const nextHeat = stepMinigunHeat(
      {
        heat: this.heat,
        overheated: this.overheated,
        overheatTimer: this.overheatTimer,
        coolDelay: this.coolDelay,
      },
      0,
      1,
      this.config.heatPerShot ?? 2.1,
      this.config.heatCoolRate ?? PLAYER_CONSTANTS.MINIGUN_HEAT_COOL_RATE,
      this.config.overheatCooldown ?? PLAYER_CONSTANTS.MINIGUN_OVERHEAT_COOLDOWN,
    );
    this.heat = nextHeat.heat;
    this.overheated = nextHeat.overheated;
    this.overheatTimer = nextHeat.overheatTimer;
    this.coolDelay = nextHeat.coolDelay;

    const tracerEvery = this.config.tracerEveryN ?? 3;
    return {
      overheatedNow: !wasOverheated && this.overheated,
      shouldSpawnTracer: this.shotCounter % tracerEvery === 0,
    };
  }

  public override getResourceHudState(): WeaponResourceHudState {
    return {
      mode: 'heat',
      value: Math.round(this.heat),
      max: PLAYER_CONSTANTS.MINIGUN_HEAT_MAX,
      overheated: this.overheated,
      overheatTimer: this.overheatTimer,
      spinProgress: this.spinProgress,
    };
  }
}
