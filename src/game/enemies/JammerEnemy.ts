import * as THREE from 'three';
import { EnemyBase, type EnemySharedGeometries } from './EnemyBase';
import { PLAYER_CONSTANTS } from '../rules';

/* ==========================================
   عدو 8: المشوِّش (Jammer) — عدو أرضي بصحة 90 يطلق نبضة EMP كل 8 ثوانٍ
   (مع صوت تحذير قبل ثانية وحلقة مرئية متوسعة) تعطل المنظار والرادار لـ 3ث ضمن 18 وحدة
   ========================================== */

export class JammerEnemy extends EnemyBase {
  constructor(wave: number, shared: EnemySharedGeometries) {
    super(
      {
        type: 'jammer',
        name: 'المشوِّش',
        hp: 90,
        fixedHp: true,
        speed: 3.4,
        color: 0x7e22ce,
        visor: 0xe879f9,
        radarColor: '#a855f7',
        scale: 1.04,
        shoots: true,
        fireRate: 2.2,
        dmg: 9,
        score: 240,
        minDist: 9,
        maxDist: 15,
      },
      wave,
      shared,
    );
    // بدء أول دورة تشويش بعد 5-7 ثوانٍ من التوليد ثم كل 8 ثوانٍ
    this.empCooldown = Math.max(4.5, PLAYER_CONSTANTS.JAMMER_EMP_INTERVAL - 2.0 + Math.random() * 1.5);
  }

  protected buildBody(shared: EnemySharedGeometries): void {
    this.buildHumanoidBase(shared);

    // حزمة مولّد التشويش الكهرومغناطيسي على الظهر وهوائي عالٍ متوهج
    const pack = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.74, 0.85, 0.36)), this.darkMat);
    pack.position.set(0, 1.42, -0.44);

    const mast = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.045, 0.06, 1.35, 10)), this.darkMat);
    mast.position.set(0, 2.38, -0.44);

    this.empCoilMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0x9333ea,
        emissiveIntensity: 0.9,
        roughness: 0.2,
        metalness: 0.4,
      }),
    );

    const emitterOrb = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.24, 0)), this.empCoilMat);
    emitterOrb.position.set(0, 3.08, -0.44);

    const coil1 = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.28, 0.045, 8, 20)), this.empCoilMat);
    coil1.rotation.x = Math.PI / 2;
    coil1.position.set(0, 2.65, -0.44);

    const coil2 = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.22, 0.04, 8, 20)), this.empCoilMat);
    coil2.rotation.x = Math.PI / 2;
    coil2.position.set(0, 2.9, -0.44);

    // حلقة شحن تحذيرية تظهر على الأرض قبل إطلاق نبضة الـ EMP بثانية واحدة
    const chargeMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0xd946ef,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const chargeRing = new THREE.Mesh(this.track(new THREE.RingGeometry(0.9, 1.35, 28)), chargeMat);
    chargeRing.rotation.x = -Math.PI / 2;
    chargeRing.position.set(0, 0.08, 0);
    chargeRing.visible = false;
    chargeRing.raycast = () => {};
    this.empChargeRing = chargeRing;

    this.group.add(pack, mast, emitterOrb, coil1, coil2, chargeRing);
    this.tagPart(pack, 'body');
    this.tagPart(mast, 'body');
    this.tagPart(emitterOrb, 'body');
    this.tagPart(coil1, 'body');
    this.tagPart(coil2, 'body');

    this.muzzleOffset.set(0.62, 1.45, 0.72);
  }
}
