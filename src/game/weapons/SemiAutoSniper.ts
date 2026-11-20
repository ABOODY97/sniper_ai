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
        adsSpread: 0.0008,
        recoilKick: 0.036,
        gunKick: 0.13,
        adsFov: 36,
        color: 0x22c55e,
        sfx: 'dmr',
        isSniper: true,
        restPos: new THREE.Vector3(0.28, -0.24, -0.5),
        adsPos: new THREE.Vector3(0.0, -0.15, -0.32),
      },
      materials,
    );
  }

  protected buildModel(m: WeaponMaterials): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.1, 0.14, 0.62)), m.darkMetal);
    const barrel = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.02, 0.02, 0.54, 10)), m.gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.035, -0.52);

    const scope = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.03, 0.028, 0.26, 10)), m.gunMetal);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.115, -0.04);

    const glowMat = this.track(new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    const glow = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.106, 0.022, 0.42)), glowMat);
    glow.position.set(0, 0.04, -0.1);

    group.add(body, barrel, scope, glow);
    return group;
  }
}
