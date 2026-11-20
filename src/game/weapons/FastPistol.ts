import * as THREE from 'three';
import { WeaponBase, type WeaponMaterials } from './WeaponBase';

/* ==========================================
   السلاح 4: فولت 9 (مسدس سريع — يُفتح بعد الباس الأول)
   ========================================== */

export class FastPistol extends WeaponBase {
  constructor(materials: WeaponMaterials) {
    super(
      {
        id: 3,
        key: 'pistol',
        name: 'فولت 9 (مسدس سريع)',
        shortName: '4 مسدس',
        roleHint: 'تلقيم فائق · إطلاق سريع',
        auto: true,
        unlockedByDefault: false,
        fireRate: 0.13,
        dmg: 22,
        headDmg: 52,
        pellets: 1,
        baseMagSize: 18,
        baseMaxReserve: 144,
        reloadTime: 0.85,
        spread: 0.011,
        adsSpread: 0.0025,
        recoilKick: 0.012,
        gunKick: 0.065,
        adsFov: 62,
        adsStyle: 'iron_sights',
        adsSensitivityMult: 0.72,
        color: 0x2dd4bf,
        sfx: 'pistol',
        restPos: new THREE.Vector3(0.24, -0.22, -0.42),
        // خط الناشنكاه الحديدي عند y=0.091 محاذي لمحور الكاميرا، والمؤخرة عند z≈-0.336
        adsPos: new THREE.Vector3(0.0, -0.091, -0.44),
      },
      materials,
    );
  }

  protected buildModel(m: WeaponMaterials): THREE.Group {
    const group = new THREE.Group();
    const slide = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.075, 0.095, 0.36)), m.darkMetal);
    slide.position.set(0, 0.03, -0.08);

    const grip = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.065, 0.18, 0.09)), m.matteGrip);
    grip.position.set(0, -0.08, 0.04);
    grip.rotation.x = -0.22;

    const muzzle = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 10)), m.gunMetal);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.035, -0.28);

    const glowMat = this.track(new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 1 }));
    const glow = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.08, 0.02, 0.24)), glowMat);
    glow.position.set(0, 0.045, -0.1);
    this.registerAdsDimPart(glow, glowMat, 1, 0, 0.55);

    // ناشنكاه حديدي ثلاثي النقاط (Iron Sights): ثلمة خلفية بعمودين + سن أمامي مضيء على خط نظر واحد y=0.091
    const rearPostGeo = this.track(new THREE.BoxGeometry(0.014, 0.022, 0.016));
    const rearL = new THREE.Mesh(rearPostGeo, m.darkMetal);
    rearL.position.set(-0.022, 0.086, 0.075);
    const rearR = new THREE.Mesh(rearPostGeo, m.darkMetal);
    rearR.position.set(0.022, 0.086, 0.075);

    const tritiumGeo = this.track(new THREE.BoxGeometry(0.0055, 0.0055, 0.004));
    const rearDotMat = this.track(new THREE.MeshBasicMaterial({ color: 0x5eead4 }));
    const rearDotL = new THREE.Mesh(tritiumGeo, rearDotMat);
    rearDotL.position.set(-0.022, 0.091, 0.084);
    const rearDotR = new THREE.Mesh(tritiumGeo, rearDotMat);
    rearDotR.position.set(0.022, 0.091, 0.084);

    const frontBlade = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.009, 0.024, 0.016)), m.darkMetal);
    frontBlade.position.set(0, 0.087, -0.242);
    const frontDotMat = this.track(new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    const frontDot = new THREE.Mesh(tritiumGeo, frontDotMat);
    frontDot.position.set(0, 0.091, -0.233);

    group.add(slide, grip, muzzle, glow, rearL, rearR, rearDotL, rearDotR, frontBlade, frontDot);
    return group;
  }
}
