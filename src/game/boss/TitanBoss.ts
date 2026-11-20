import * as THREE from 'three';
import type { EnemySharedGeometries } from '../enemies/EnemyBase';
import { BossEnemy, type BossSpawnScaleOptions } from './Boss';

/* ==========================================
   الزعيم الأساسي: تيتان أوميغا (Titan Omega)
   الزعيم المدرّع القيادي — مزوّد بقاذفات صواريخ كتف ومفاعل خلفي متوهج،
   يجمع بين وابل البلازما، قصف الصواريخ، وموجة الصدمة الأرضية عبر 3 مراحل
   ========================================== */

export class TitanBoss extends BossEnemy {
  constructor(
    wave: number,
    shared: EnemySharedGeometries,
    scaleOpts?: BossSpawnScaleOptions,
  ) {
    super(
      'titan',
      wave,
      shared,
      {
        speed: 3.8,
        color: 0x7f1d1d,
        visor: 0xfde047,
        radarColor: '#ff0040',
        scale: 2.35,
        fireRate: 2.45,
        dmg: 18,
        score: 1200,
        phase3ColorHex: 0xb91c1c,
      },
      scaleOpts,
    );
  }

  protected buildBody(_shared: EnemySharedGeometries): void {
    const darkPlateMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.78 }),
    );
    const crimsonTrimMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        emissive: 0x991b1b,
        emissiveIntensity: 0.55,
        roughness: 0.32,
      }),
    );

    // أرجل مدرّعة ثقيلة
    const legGeo = this.track(new THREE.BoxGeometry(0.44, 1.04, 0.46));
    this.leftLeg = new THREE.Mesh(legGeo, darkPlateMat);
    this.leftLeg.position.set(-0.4, 0.52, 0);
    this.rightLeg = new THREE.Mesh(legGeo, darkPlateMat);
    this.rightLeg.position.set(0.4, 0.52, 0);

    // جذع تيتان المدرّع مع صفيحة صدر مضيئة
    const torso = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.36, 1.28, 0.84)), this.bodyMat);
    torso.position.y = 1.62;
    torso.castShadow = true;

    const chestArmor = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.04, 0.72, 0.16)),
      darkPlateMat,
    );
    chestArmor.position.set(0, 1.68, 0.46);

    const chestCore = new THREE.Mesh(
      this.track(new THREE.OctahedronGeometry(0.22, 0)),
      crimsonTrimMat,
    );
    chestCore.position.set(0, 1.68, 0.58);

    // قاذفات صواريخ الكتف المزدوجة
    const podGeo = this.track(new THREE.BoxGeometry(0.54, 0.54, 0.78));
    const podL = new THREE.Mesh(podGeo, darkPlateMat);
    podL.position.set(-0.92, 2.24, -0.05);
    const podR = new THREE.Mesh(podGeo, darkPlateMat);
    podR.position.set(0.92, 2.24, -0.05);

    const podTrimGeo = this.track(new THREE.BoxGeometry(0.42, 0.16, 0.12));
    const podTrimL = new THREE.Mesh(podTrimGeo, crimsonTrimMat);
    podTrimL.position.set(-0.92, 2.28, 0.36);
    const podTrimR = new THREE.Mesh(podTrimGeo, crimsonTrimMat);
    podTrimR.position.set(0.92, 2.28, 0.36);

    // ذراعا مدفع بلازما مزدوجتان
    const armGeo = this.track(new THREE.CylinderGeometry(0.13, 0.16, 1.24, 10));
    const armL = new THREE.Mesh(armGeo, this.darkMat);
    armL.rotation.x = Math.PI / 2;
    armL.position.set(-0.94, 1.56, 0.62);
    const armR = new THREE.Mesh(armGeo, this.darkMat);
    armR.rotation.x = Math.PI / 2;
    armR.position.set(0.94, 1.56, 0.62);

    // خوذة القائد ومنظار ذهبي متوهج (نقطة الرأس)
    const head = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.62, 0.54, 0.6)), darkPlateMat);
    head.position.set(0, 2.54, 0.06);
    const visor = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.54, 0.18, 0.1)), this.visorMat);
    visor.position.set(0, 2.56, 0.38);

    // مفاعل الطاقة الخلفي المتوهج (نقطة الضعف الرئيسية 2.2x)
    this.generatorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf97316,
        emissiveIntensity: 1.55,
        roughness: 0.16,
      }),
    );
    this.weakPointMats.push(this.generatorMat);

    const reactor = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.38, 0.38, 0.94, 14)),
      this.generatorMat,
    );
    reactor.position.set(0, 1.66, -0.62);

    const reactorRing = new THREE.Mesh(
      this.track(new THREE.TorusGeometry(0.46, 0.07, 8, 18)),
      crimsonTrimMat,
    );
    reactorRing.position.set(0, 1.66, -0.62);

    this.group.add(
      this.leftLeg,
      this.rightLeg,
      torso,
      chestArmor,
      chestCore,
      podL,
      podR,
      podTrimL,
      podTrimR,
      armL,
      armR,
      head,
      visor,
      reactor,
      reactorRing,
    );

    [
      this.leftLeg,
      this.rightLeg,
      torso,
      chestArmor,
      chestCore,
      podL,
      podR,
      podTrimL,
      podTrimR,
      armL,
      armR,
    ].forEach((p) => this.tagPart(p, 'body'));

    this.tagPart(head, 'head');
    this.tagPart(visor, 'head');
    this.tagPart(reactor, 'generator');
    this.tagPart(reactorRing, 'generator');

    this.muzzleOffset.set(0, 1.66, 1.24);
  }
}
