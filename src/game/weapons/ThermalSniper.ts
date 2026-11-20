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
        restPos: new THREE.Vector3(0.28, -0.24, -0.54),
        // محور المنظار الحراري عند y=0.14 محاذي لمحور الكاميرا، ومؤخرة الهيكل عند z=-0.26
        adsPos: new THREE.Vector3(0.0, -0.14, -0.49),
      },
      materials,
    );
  }

  protected buildModel(m: WeaponMaterials): THREE.Group {
    const group = new THREE.Group();
    const chassisMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x292524, metalness: 0.85, roughness: 0.22 }),
    );
    const body = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.12, 0.15, 0.6)), chassisMat);
    body.position.set(0, 0, -0.07);

    const barrel = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.068, 0.075, 0.78)), m.gunMetal);
    barrel.position.set(0, 0.03, -0.62);

    const coreMat = this.track(new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 1 }));
    const coreGeo = this.track(new THREE.BoxGeometry(0.016, 0.04, 0.72));
    const coreL = new THREE.Mesh(coreGeo, coreMat);
    coreL.position.set(-0.04, 0.03, -0.6);
    const coreR = new THREE.Mesh(coreGeo, coreMat);
    coreR.position.set(0.04, 0.03, -0.6);
    this.registerAdsDimPart(coreL, coreMat, 1, 0.25, undefined);
    this.registerAdsDimPart(coreR, undefined, 1, 0.25, undefined);

    const scope = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.076, 0.076, 0.34)), m.darkMetal);
    scope.position.set(0, 0.14, -0.08);

    const lensMat = this.track(new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 1 }));
    const lens = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.062, 0.062, 0.018)), lensMat);
    lens.position.set(0, 0.14, -0.255);
    this.registerAdsDimPart(lens, lensMat, 1, 0.3, undefined);

    group.add(body, barrel, coreL, coreR, scope, lens);
    return group;
  }
}
