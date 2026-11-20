import * as THREE from 'three';
import { WeaponBase, type WeaponMaterials } from './WeaponBase';

/* ==========================================
   السلاح 7: ثرمال-X (قناصة حرارية خارقة لـ 3 أهداف — تُفتح بعد الباس الرابع)
   ========================================== */

export class ThermalSniper extends WeaponBase {
  constructor(materials: WeaponMaterials) {
    super(
      {
        id: 6,
        key: 'thermal',
        name: 'ثرمال-X (قناصة حرارية)',
        shortName: '7 حرارية',
        roleHint: 'منظار حراري · تخترق 3 أهداف',
        auto: false,
        unlockedByDefault: false,
        fireRate: 0.95,
        dmg: 115,
        headDmg: 260,
        pellets: 1,
        pierceCount: 3,
        isSniper: true,
        isThermal: true,
        baseMagSize: 5,
        baseMaxReserve: 35,
        reloadTime: 1.9,
        spread: 0.02,
        adsSpread: 0,
        recoilKick: 0.075,
        gunKick: 0.21,
        adsFov: 20,
        adsStyle: 'scope',
        zoomLevels: [
          { label: 'x4', magnification: 4, fov: 20 },
          { label: 'x8', magnification: 8, fov: 11 },
          { label: 'x12', magnification: 12, fov: 7.0 },
        ],
        scopeSwayAmp: 0.009,
        ballistics: { speed: 220, gravity: 8.0, maxLife: 2.2 },
        color: 0xf59e0b,
        sfx: 'thermalSniper',
        restPos: new THREE.Vector3(0.29, -0.25, -0.54),
        adsPos: new THREE.Vector3(0.0, -0.16, -0.3),
      },
      materials,
    );
  }

  protected buildModel(m: WeaponMaterials): THREE.Group {
    const group = new THREE.Group();
    const chassisMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x292524, metalness: 0.85, roughness: 0.22 }),
    );
    const body = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.13, 0.16, 0.7)), chassisMat);
    const barrel = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.07, 0.08, 0.78)), m.gunMetal);
    barrel.position.set(0, 0.03, -0.62);

    const coreMat = this.track(new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
    const coreGeo = this.track(new THREE.BoxGeometry(0.018, 0.045, 0.74));
    const coreL = new THREE.Mesh(coreGeo, coreMat);
    coreL.position.set(-0.042, 0.03, -0.6);
    const coreR = new THREE.Mesh(coreGeo, coreMat);
    coreR.position.set(0.042, 0.03, -0.6);

    const scope = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.08, 0.08, 0.34)), m.darkMetal);
    scope.position.set(0, 0.14, -0.06);

    const lensMat = this.track(new THREE.MeshBasicMaterial({ color: 0xfb923c }));
    const lens = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.065, 0.065, 0.02)), lensMat);
    lens.position.set(0, 0.14, -0.235);

    group.add(body, barrel, coreL, coreR, scope, lens);
    return group;
  }
}
