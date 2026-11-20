import * as THREE from 'three';
import { WeaponBase, type WeaponMaterials } from './WeaponBase';

/* ==========================================
   السلاح 2: سترايكر (شوتجن 7 شظايا قريب المدى)
   ========================================== */

export class Shotgun extends WeaponBase {
  constructor(materials: WeaponMaterials) {
    super(
      {
        id: 1,
        key: 'shotgun',
        name: 'سترايكر (شوتجن)',
        shortName: '2 شوتجن',
        roleHint: '7 شظايا · تضييق عند التصويب',
        auto: false,
        unlockedByDefault: true,
        fireRate: 0.72,
        dmg: 18,
        headDmg: 32,
        pellets: 7,
        baseMagSize: 8,
        baseMaxReserve: 48,
        reloadTime: 1.7,
        spread: 0.072,
        adsSpread: 0.024,
        recoilKick: 0.055,
        gunKick: 0.18,
        adsFov: 62,
        adsStyle: 'tight_choke',
        adsSensitivityMult: 0.74,
        color: 0xf97316,
        sfx: 'shotgun',
        restPos: new THREE.Vector3(0.3, -0.26, -0.46),
        adsPos: new THREE.Vector3(0.0, -0.155, -0.34),
      },
      materials,
    );
  }

  protected buildModel(m: WeaponMaterials): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.14, 0.16, 0.52)), m.darkMetal);
    const barrelGeo = this.track(new THREE.CylinderGeometry(0.03, 0.03, 0.54, 10));
    const barrel1 = new THREE.Mesh(barrelGeo, m.gunMetal);
    barrel1.rotation.x = Math.PI / 2;
    barrel1.position.set(-0.032, 0.04, -0.38);

    const barrel2 = new THREE.Mesh(barrelGeo, m.gunMetal);
    barrel2.rotation.x = Math.PI / 2;
    barrel2.position.set(0.032, 0.04, -0.38);

    const pumpMat = this.track(new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.78, metalness: 0.1 }));
    const pump = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.115, 0.085, 0.25)), pumpMat);
    pump.position.set(0, -0.05, -0.34);

    const glowMat = this.track(new THREE.MeshBasicMaterial({ color: 0xf97316 }));
    const glow = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.146, 0.028, 0.24)), glowMat);
    glow.position.set(0, 0.02, 0.0);

    group.add(body, barrel1, barrel2, pump, glow);
    return group;
  }
}
