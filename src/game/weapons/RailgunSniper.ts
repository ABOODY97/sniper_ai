import * as THREE from 'three';
import { WeaponBase, type WeaponMaterials } from './WeaponBase';

/* ==========================================
   السلاح 3: رايلجن X (قناصة كهرومغناطيسية بمنظار)
   ========================================== */

export class RailgunSniper extends WeaponBase {
  constructor(materials: WeaponMaterials) {
    super(
      {
        id: 2,
        key: 'railgun',
        name: 'رايلجن X (قناصة)',
        shortName: '3 قناصة',
        roleHint: 'منظار قنص · ضرر خارق',
        auto: false,
        unlockedByDefault: true,
        fireRate: 1.05,
        dmg: 95,
        headDmg: 240,
        pellets: 1,
        baseMagSize: 5,
        baseMaxReserve: 30,
        reloadTime: 2.0,
        spread: 0.025,
        adsSpread: 0.0002,
        recoilKick: 0.08,
        gunKick: 0.22,
        adsFov: 22,
        color: 0xd946ef,
        sfx: 'sniper',
        isSniper: true,
        restPos: new THREE.Vector3(0.29, -0.25, -0.52),
        adsPos: new THREE.Vector3(0.0, -0.16, -0.3),
      },
      materials,
    );
  }

  protected buildModel(m: WeaponMaterials): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.12, 0.15, 0.65)), m.darkMetal);
    const railGeo = this.track(new THREE.BoxGeometry(0.05, 0.035, 0.72));
    const railTop = new THREE.Mesh(railGeo, m.gunMetal);
    railTop.position.set(0, 0.06, -0.58);
    const railBot = new THREE.Mesh(railGeo, m.gunMetal);
    railBot.position.set(0, -0.01, -0.58);

    const coreMat = this.track(new THREE.MeshBasicMaterial({ color: 0xd946ef }));
    const core = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.026, 0.035, 0.7)), coreMat);
    core.position.set(0, 0.025, -0.56);

    const scope = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.038, 0.032, 0.34, 12)), m.darkMetal);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.13, -0.05);

    group.add(body, railTop, railBot, core, scope);
    return group;
  }
}
