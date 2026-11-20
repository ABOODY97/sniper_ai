import * as THREE from 'three';
import { WeaponBase, type WeaponMaterials } from './WeaponBase';

/* ==========================================
   السلاح 1: M4 سايبر (رشاش آلي متوازن)
   ========================================== */

export class Rifle extends WeaponBase {
  constructor(materials: WeaponMaterials) {
    super(
      {
        id: 0,
        key: 'rifle',
        name: 'M4 سايبر (رشاش)',
        shortName: '1 رشاش',
        roleHint: 'آلي متوازن',
        auto: true,
        unlockedByDefault: true,
        fireRate: 0.11,
        dmg: 25,
        headDmg: 58,
        pellets: 1,
        baseMagSize: 30,
        baseMaxReserve: 180,
        reloadTime: 1.35,
        spread: 0.012,
        adsSpread: 0.002,
        recoilKick: 0.016,
        gunKick: 0.09,
        adsFov: 56,
        adsStyle: 'red_dot',
        adsSensitivityMult: 0.68,
        color: 0x38bdf8,
        sfx: 'rifle',
        restPos: new THREE.Vector3(0.26, -0.22, -0.48),
        // النقطة الحمراء عند (0, 0.096, 0.03) محاذية تماماً لمحور الكاميرا (0, 0)، ومؤخرة الهيكل عند z=-0.32
        adsPos: new THREE.Vector3(0.0, -0.096, -0.44),
      },
      materials,
    );
  }

  protected buildModel(m: WeaponMaterials): THREE.Group {
    const group = new THREE.Group();
    // جسم مدمج ومزاح للأمام بحيث ينتهي قريباً خلف المنظار دون سد أسفل الشاشة
    const body = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.084, 0.11, 0.46)), m.darkMetal);
    body.position.set(0, -0.006, -0.11);

    const barrel = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 10)), m.gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.48);

    const shroud = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.07, 0.072, 0.28)), m.matteGrip);
    shroud.position.set(0, 0.012, -0.36);

    const mag = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.05, 0.2, 0.086)), m.gunMetal);
    mag.position.set(0, -0.14, -0.12);
    mag.rotation.x = 0.18;

    // الشريط السياني المضيء — يخفت ويختفي بسلاسة عند التصويب لعدم تشويش مجال الرؤية
    const glowMat = this.track(new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 1 }));
    const glow = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.088, 0.018, 0.3)), glowMat);
    glow.position.set(0, 0.03, -0.12);
    this.registerAdsDimPart(glow, glowMat, 1, 0, 0.55);

    // منظار النقطة الحمراء (Red-Dot Reflex Sight) بإطار نحيف مفتوح قرب مؤخرة السكة لزاوية رؤية واسعة ونظيفة
    const opticBase = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.056, 0.014, 0.1)), m.darkMetal);
    opticBase.position.set(0, 0.058, 0.03);

    const postGeo = this.track(new THREE.BoxGeometry(0.0052, 0.058, 0.034));
    const postL = new THREE.Mesh(postGeo, m.darkMetal);
    postL.position.set(-0.03, 0.096, 0.03);
    const postR = new THREE.Mesh(postGeo, m.darkMetal);
    postR.position.set(0.03, 0.096, 0.03);
    const topHood = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.066, 0.0052, 0.034)), m.darkMetal);
    topHood.position.set(0, 0.126, 0.03);

    const lensMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
      }),
    );
    const lens = new THREE.Mesh(this.track(new THREE.PlaneGeometry(0.054, 0.056)), lensMat);
    lens.position.set(0, 0.096, 0.03);
    this.registerAdsDimPart(lens, lensMat, 0.09, 0.04, undefined);

    const redDotMat = this.track(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    const redDot = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.0021, 8, 8)), redDotMat);
    redDot.position.set(0, 0.096, 0.031);

    group.add(body, barrel, shroud, mag, glow, opticBase, postL, postR, topHood, lens, redDot);
    return group;
  }
}
