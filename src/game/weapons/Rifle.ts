import * as THREE from 'three';
import { WeaponBase, type WeaponMaterials } from './WeaponBase';

/* ==========================================
   السلاح 1: M4 سايبر (رشاش آلي متوازن)
   ========================================== */

export class Rifle extends WeaponBase {
  constructor(materials: WeaponMaterials) {
    super(
      {
        id: 0,
        key: 'rifle',
        name: 'M4 سايبر (رشاش)',
        shortName: '1 رشاش',
        roleHint: 'آلي متوازن',
        auto: true,
        unlockedByDefault: true,
        fireRate: 0.11,
        dmg: 25,
        headDmg: 58,
        pellets: 1,
        baseMagSize: 30,
        baseMaxReserve: 180,
        reloadTime: 1.35,
        spread: 0.012,
        adsSpread: 0.002,
        recoilKick: 0.016,
        gunKick: 0.09,
        adsFov: 56,
        adsStyle: 'red_dot',
        adsSensitivityMult: 0.68,
        color: 0x38bdf8,
        sfx: 'rifle',
        restPos: new THREE.Vector3(0.28, -0.24, -0.48),
        adsPos: new THREE.Vector3(0.0, -0.115, -0.27),
      },
      materials,
    );
  }

  protected buildModel(m: WeaponMaterials): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.11, 0.15, 0.56)), m.darkMetal);
    const barrel = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.022, 0.022, 0.44, 10)), m.gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -0.45);

    const shroud = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.085, 0.09, 0.28)), m.matteGrip);
    shroud.position.set(0, 0.02, -0.34);

    const mag = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.06, 0.22, 0.1)), m.gunMetal);
    mag.position.set(0, -0.14, -0.08);
    mag.rotation.x = 0.2;

    const glowMat = this.track(new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    const glow = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.116, 0.024, 0.36)), glowMat);
    glow.position.set(0, 0.04, -0.06);

    // منظار النقطة الحمراء (Red-Dot Reflex Sight) بإطار مفتوح وعدسة شفافة ونقطة حمراء مضيئة
    const opticBase = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.072, 0.018, 0.14)), m.darkMetal);
    opticBase.position.set(0, 0.082, 0.02);

    const postGeo = this.track(new THREE.BoxGeometry(0.008, 0.062, 0.07));
    const postL = new THREE.Mesh(postGeo, m.darkMetal);
    postL.position.set(-0.032, 0.118, 0.02);
    const postR = new THREE.Mesh(postGeo, m.darkMetal);
    postR.position.set(0.032, 0.118, 0.02);
    const topHood = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.072, 0.008, 0.07)), m.darkMetal);
    topHood.position.set(0, 0.149, 0.02);

    const lensMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    );
    const lens = new THREE.Mesh(this.track(new THREE.PlaneGeometry(0.056, 0.054)), lensMat);
    lens.position.set(0, 0.116, 0.02);

    const redDotMat = this.track(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    const redDot = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.0032, 8, 8)), redDotMat);
    redDot.position.set(0, 0.115, 0.021);

    group.add(body, barrel, shroud, mag, glow, opticBase, postL, postR, topHood, lens, redDot);
    return group;
  }
}
