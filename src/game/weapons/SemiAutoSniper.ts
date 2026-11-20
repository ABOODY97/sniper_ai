import * as THREE from 'three';
import { WeaponBase, type WeaponMaterials } from './WeaponBase';

/* ==========================================
   السلاح 5: الشبح DMR (قناصة نصف آلية — تُفتح بعد الباس الثاني)
   ========================================== */

export class SemiAutoSniper extends WeaponBase {
  constructor(materials: WeaponMaterials) {
    super(
      {
        id: 4,
        key: 'dmr',
        name: 'الشبح DMR (قناصة نصف آلية)',
        shortName: '5 نصف آلي',
        roleHint: 'نصف آلية دقيقة بمنظار',
        auto: false,
        unlockedByDefault: false,
        fireRate: 0.32,
        dmg: 52,
        headDmg: 118,
        pellets: 1,
        baseMagSize: 10,
        baseMaxReserve: 70,
        reloadTime: 1.5,
        spread: 0.016,
        adsSpread: 0,
        recoilKick: 0.036,
        gunKick: 0.13,
        adsFov: 24,
        adsStyle: 'scope',
        zoomLevels: [
          { label: 'x4', magnification: 4, fov: 24 },
          { label: 'x8', magnification: 8, fov: 13 },
          { label: 'x12', magnification: 12, fov: 8.5 },
        ],
        scopeSwayAmp: 0.0065,
        ballistics: { speed: 175, gravity: 9.8, maxLife: 2.5 },
        color: 0x22c55e,
        sfx: 'dmr',
        isSniper: true,
        restPos: new THREE.Vector3(0.28, -0.24, -0.5),
        // محور المنظار عند y=0.115 محاذي لمحور الكاميرا، ومؤخرة الهيكل عند z=-0.26
        adsPos: new THREE.Vector3(0.0, -0.115, -0.49),
      },
      materials,
    );
  }

  protected buildModel(m: WeaponMaterials): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.095, 0.13, 0.56)), m.darkMetal);
    body.position.set(0, 0, -0.05);

    const barrel = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.02, 0.02, 0.54, 10)), m.gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.035, -0.52);

    const scope = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.03, 0.028, 0.26, 10)), m.gunMetal);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.115, -0.06);

    const glowMat = this.track(new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 1 }));
    const glow = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.102, 0.02, 0.38)), glowMat);
    glow.position.set(0, 0.038, -0.1);
    this.registerAdsDimPart(glow, glowMat, 1, 0, 0.55);

    group.add(body, barrel, scope, glow);
    return group;
  }
}
