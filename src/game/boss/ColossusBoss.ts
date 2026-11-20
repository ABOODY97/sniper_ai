import * as THREE from 'three';
import type { EnemySharedGeometries } from '../enemies/EnemyBase';
import { BossEnemy, type BossSpawnScaleOptions } from './Boss';

/* ==========================================
   الزعيم 3: العملاق الجبار (The Colossus)
   آلي حصار ضخم يسير بخطوات ثقيلة ويطلق ضربات أرضية بموجات صدمة،
   نقاط ضعفه المتوهجة موجودة في الساقين (المفاصل) وفي الظهر (المفاعل الخلفي)
   ========================================== */

export class ColossusBoss extends BossEnemy {
  constructor(wave: number, shared: EnemySharedGeometries, scaleOpts?: BossSpawnScaleOptions) {
    super(
      'colossus',
      wave,
      shared,
      {
        speed: 2.9,
        color: 0x3f3f46,
        visor: 0xef4444,
        radarColor: '#ef4444',
        scale: 2.75,
        fireRate: 2.7,
        dmg: 22,
        score: 1500,
        phase3ColorHex: 0x7f1d1d,
      },
      scaleOpts,
    );
  }

  protected buildBody(_shared: EnemySharedGeometries): void {
    const heavyArmorMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5, metalness: 0.78 }),
    );
    const legCoreMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xfb923c,
        emissive: 0xf97316,
        emissiveIntensity: 1.5,
        roughness: 0.18,
      }),
    );
    this.weakPointMats.push(legCoreMat);

    // ساقان عملاقتان مع نقاط ضعف هيدروليكية متوهجة في الركبتين (hitZone: 'weakpoint')
    const legGeo = this.track(new THREE.BoxGeometry(0.48, 1.18, 0.54));
    const footGeo = this.track(new THREE.BoxGeometry(0.64, 0.24, 0.82));
    const kneeCoreGeo = this.track(new THREE.CylinderGeometry(0.24, 0.24, 0.58, 12));

    this.leftLeg = new THREE.Mesh(legGeo, heavyArmorMat);
    this.leftLeg.position.set(-0.56, 0.59, 0);
    const leftFoot = new THREE.Mesh(footGeo, this.bodyMat);
    leftFoot.position.set(0, -0.48, 0.1);
    const leftKneeCore = new THREE.Mesh(kneeCoreGeo, legCoreMat);
    leftKneeCore.rotation.z = Math.PI / 2;
    leftKneeCore.position.set(0, 0.08, 0.22);
    this.leftLeg.add(leftFoot, leftKneeCore);

    this.rightLeg = new THREE.Mesh(legGeo, heavyArmorMat);
    this.rightLeg.position.set(0.56, 0.59, 0);
    const rightFoot = new THREE.Mesh(footGeo, this.bodyMat);
    rightFoot.position.set(0, -0.48, 0.1);
    const rightKneeCore = new THREE.Mesh(kneeCoreGeo, legCoreMat);
    rightKneeCore.rotation.z = Math.PI / 2;
    rightKneeCore.position.set(0, 0.08, 0.22);
    this.rightLeg.add(rightFoot, rightKneeCore);

    // جذع مدرّع فائق السماكة مع كتفين ضخمين ومدفعين ثقيلين
    const pelvis = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.38, 0.36, 0.86)), heavyArmorMat);
    pelvis.position.y = 1.24;

    const torso = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.68, 1.32, 1.05)), this.bodyMat);
    torso.position.y = 2.02;
    torso.castShadow = true;

    const frontShieldPlate = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.28, 0.85, 0.2)),
      heavyArmorMat,
    );
    frontShieldPlate.position.set(0, 2.05, 0.58);

    const shoulderGeo = this.track(new THREE.BoxGeometry(0.68, 0.66, 0.96));
    const shoulderL = new THREE.Mesh(shoulderGeo, heavyArmorMat);
    shoulderL.position.set(-1.14, 2.42, 0);
    const shoulderR = new THREE.Mesh(shoulderGeo, heavyArmorMat);
    shoulderR.position.set(1.14, 2.42, 0);

    const cannonGeo = this.track(new THREE.CylinderGeometry(0.14, 0.18, 1.45, 10));
    const cannonL = new THREE.Mesh(cannonGeo, this.darkMat);
    cannonL.rotation.x = Math.PI / 2;
    cannonL.position.set(-1.16, 1.98, 0.72);
    const cannonR = new THREE.Mesh(cannonGeo, this.darkMat);
    cannonR.rotation.x = Math.PI / 2;
    cannonR.position.set(1.16, 1.98, 0.72);

    // الرأس المدرّع والمنظار الأحمر
    const head = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.66, 0.44, 0.62)), heavyArmorMat);
    head.position.set(0, 2.86, 0.14);
    const visor = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.56, 0.16, 0.1)), this.visorMat);
    visor.position.set(0, 2.88, 0.46);

    // مفاعل الظهر المتوهج (نقطة الضعف الخلفية الكبرى)
    this.generatorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 1.65,
        roughness: 0.14,
      }),
    );
    this.weakPointMats.push(this.generatorMat);

    const backReactor = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.46, 0.46, 1.05, 14)),
      this.generatorMat,
    );
    backReactor.position.set(0, 2.08, -0.74);

    const backRing = new THREE.Mesh(
      this.track(new THREE.TorusGeometry(0.54, 0.08, 10, 20)),
      legCoreMat,
    );
    backRing.position.set(0, 2.08, -0.74);

    this.group.add(
      this.leftLeg,
      this.rightLeg,
      pelvis,
      torso,
      frontShieldPlate,
      shoulderL,
      shoulderR,
      cannonL,
      cannonR,
      head,
      visor,
      backReactor,
      backRing,
    );

    [
      this.leftLeg,
      this.rightLeg,
      leftFoot,
      rightFoot,
      pelvis,
      torso,
      frontShieldPlate,
      shoulderL,
      shoulderR,
      cannonL,
      cannonR,
    ].forEach((p) => this.tagPart(p, 'body'));

    // نقاط الضعف: الركبتان (الساقان) + المفاعل الخلفي + الرأس
    this.tagPart(leftKneeCore, 'weakpoint');
    this.tagPart(rightKneeCore, 'weakpoint');
    this.tagPart(backReactor, 'generator');
    this.tagPart(backRing, 'generator');
    this.tagPart(head, 'head');
    this.tagPart(visor, 'head');

    this.muzzleOffset.set(0, 2.02, 1.38);
  }
}
