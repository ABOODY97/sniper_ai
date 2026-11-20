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
        restPos: new THREE.Vector3(0.28, -0.24, -0.46),
        // ناشنكاه علوي عند (0, 0.096) محاذي لمحور الكاميرا ومؤخرة الهيكل عند z=-0.30
        adsPos: new THREE.Vector3(0.0, -0.096, -0.44),
      },
      materials,
    );
  }

  protected buildModel(m: WeaponMaterials): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.115, 0.13, 0.46)), m.darkMetal);
    body.position.set(0, -0.005, -0.09);

    const barrelGeo = this.track(new THREE.CylinderGeometry(0.025, 0.025, 0.52, 10));
    const barrel1 = new THREE.Mesh(barrelGeo, m.gunMetal);
    barrel1.rotation.x = Math.PI / 2;
    barrel1.position.set(-0.026, 0.032, -0.42);

    const barrel2 = new THREE.Mesh(barrelGeo, m.gunMetal);
    barrel2.rotation.x = Math.PI / 2;
    barrel2.position.set(0.026, 0.032, -0.42);

    const pumpMat = this.track(new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.78, metalness: 0.1 }));
    const pump = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.098, 0.075, 0.24)), pumpMat);
    pump.position.set(0, -0.048, -0.36);

    const glowMat = this.track(new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 1 }));
    const glow = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.12, 0.022, 0.22)), glowMat);
    glow.position.set(0, 0.018, -0.08);
    this.registerAdsDimPart(glow, glowMat, 1, 0, 0.55);

    // سكة علوية وناشنكاه مفتوح مع حبة ألياف ضوئية أمامية على محور التصويب الدقيق (0, 0.096)
    const ribBase = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.042, 0.014, 0.22)), m.darkMetal);
    ribBase.position.set(0, 0.068, -0.12);

    const rearPostGeo = this.track(new THREE.BoxGeometry(0.007, 0.022, 0.016));
    const rearL = new THREE.Mesh(rearPostGeo, m.darkMetal);
    rearL.position.set(-0.018, 0.086, -0.05);
    const rearR = new THREE.Mesh(rearPostGeo, m.darkMetal);
    rearR.position.set(0.018, 0.086, -0.05);

    const frontStalk = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.008, 0.034, 0.014)), m.darkMetal);
    frontStalk.position.set(0, 0.074, -0.64);
    const beadMat = this.track(new THREE.MeshBasicMaterial({ color: 0xfb923c }));
    const frontBead = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.0032, 8, 8)), beadMat);
    frontBead.position.set(0, 0.096, -0.64);

    group.add(body, barrel1, barrel2, pump, glow, ribBase, rearL, rearR, frontStalk, frontBead);
    return group;
  }
}
