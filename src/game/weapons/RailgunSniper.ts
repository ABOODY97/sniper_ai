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
        adsSpread: 0,
        recoilKick: 0.08,
        gunKick: 0.22,
        adsFov: 22,
        adsStyle: 'scope',
        zoomLevels: [
          { label: 'x4', magnification: 4, fov: 22 },
          { label: 'x8', magnification: 8, fov: 12 },
          { label: 'x12', magnification: 12, fov: 7.5 },
        ],
        scopeSwayAmp: 0.0085,
        ballistics: { speed: 240, gravity: 7.5, maxLife: 2.2 },
        color: 0xd946ef,
        sfx: 'sniper',
        isSniper: true,
        restPos: new THREE.Vector3(0.28, -0.24, -0.52),
        // محور المنظار عند y=0.13 محاذي تماماً لمحور الكاميرا، ومؤخرة الهيكل عند z=-0.26
        adsPos: new THREE.Vector3(0.0, -0.13, -0.49),
      },
      materials,
    );
  }

  protected buildModel(m: WeaponMaterials): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.11, 0.14, 0.58)), m.darkMetal);
    body.position.set(0, 0, -0.06);

    const railGeo = this.track(new THREE.BoxGeometry(0.048, 0.032, 0.72));
    const railTop = new THREE.Mesh(railGeo, m.gunMetal);
    railTop.position.set(0, 0.058, -0.58);
    const railBot = new THREE.Mesh(railGeo, m.gunMetal);
    railBot.position.set(0, -0.01, -0.58);

    const coreMat = this.track(new THREE.MeshBasicMaterial({ color: 0xd946ef, transparent: true, opacity: 1 }));
    const core = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.024, 0.032, 0.7)), coreMat);
    core.position.set(0, 0.024, -0.56);
    this.registerAdsDimPart(core, coreMat, 1, 0.25, undefined);

    const scope = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.036, 0.03, 0.34, 12)), m.darkMetal);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.13, -0.08);

    group.add(body, railTop, railBot, core, scope);
    return group;
  }
}
