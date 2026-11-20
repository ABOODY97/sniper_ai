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
        color: 0x2dd4bf,
        sfx: 'pistol',
        restPos: new THREE.Vector3(0.24, -0.22, -0.42),
        adsPos: new THREE.Vector3(0.0, -0.13, -0.32),
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

    const glowMat = this.track(new THREE.MeshBasicMaterial({ color: 0x2dd4bf }));
    const glow = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.08, 0.02, 0.24)), glowMat);
    glow.position.set(0, 0.045, -0.1);

    group.add(slide, grip, muzzle, glow);
    return group;
  }
}
