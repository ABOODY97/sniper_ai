import * as THREE from 'three';
import { WeaponBase, type WeaponMaterials } from './WeaponBase';

/* ==========================================
   السلاح 6: تيتان RPG (قاذف صواريخ متفجرة — يُفتح بعد الباس الثالث)
   ========================================== */

export class RocketLauncher extends WeaponBase {
  constructor(materials: WeaponMaterials) {
    super(
      {
        id: 5,
        key: 'rpg',
        name: 'تيتان RPG (قاذف صواريخ)',
        shortName: '6 صواريخ',
        roleHint: 'انفجار واسع 6.5م',
        auto: false,
        unlockedByDefault: false,
        fireRate: 1.25,
        dmg: 145,
        headDmg: 145,
        pellets: 1,
        isRocket: true,
        splashRadius: 6.5,
        baseMagSize: 4,
        baseMaxReserve: 24,
        reloadTime: 2.2,
        spread: 0.008,
        adsSpread: 0.002,
        recoilKick: 0.11,
        gunKick: 0.26,
        adsFov: 60,
        adsStyle: 'launcher',
        adsSensitivityMult: 0.7,
        color: 0xfb923c,
        sfx: 'rocketLaunch',
        restPos: new THREE.Vector3(0.34, -0.22, -0.44),
        adsPos: new THREE.Vector3(0.14, -0.16, -0.34),
      },
      materials,
    );
  }

  protected buildModel(m: WeaponMaterials): THREE.Group {
    const group = new THREE.Group();
    const tubeMat = this.track(new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.72, roughness: 0.32 }));
    const tube = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.095, 0.095, 1.05, 14)), tubeMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.04, -0.25);

    const rimMat = this.track(new THREE.MeshBasicMaterial({ color: 0xf97316 }));
    const rim = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.1, 0.02, 8, 16)), rimMat);
    rim.position.set(0, 0.04, -0.77);

    const coneMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0x7f1d1d, roughness: 0.4 }),
    );
    const cone = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.075, 0.22, 12)), coneMat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(0, 0.04, -0.82);

    const grip = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.07, 0.18, 0.12)), m.matteGrip);
    grip.position.set(0, -0.1, -0.12);

    group.add(tube, rim, cone, grip);
    return group;
  }
}
