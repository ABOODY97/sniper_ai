import * as THREE from 'three';
import type { EnemySharedGeometries } from '../enemies/EnemyBase';
import { BossEnemy } from './Boss';

/* ==========================================
   الزعيم 1: المهندس المدرّع (The Engineer)
   ينشر أبراجاً قتالية قابلة للتدمير، ويُفعّل درع الدرونات الحامية،
   ويطلق صواريخ موجهة ورشقات بلازما عبر 3 مراحل
   ========================================== */

export class EngineerBoss extends BossEnemy {
  constructor(wave: number, shared: EnemySharedGeometries) {
    super('engineer', wave, shared, {
      speed: 4.1,
      color: 0xb45309,
      visor: 0x38bdf8,
      radarColor: '#f59e0b',
      scale: 2.15,
      fireRate: 2.5,
      dmg: 16,
      score: 1200,
      phase3ColorHex: 0xd97706,
    });
  }

  protected buildBody(_shared: EnemySharedGeometries): void {
    const steelMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.72 }),
    );
    const hazardMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xca8a04,
        emissiveIntensity: 0.5,
        roughness: 0.35,
      }),
    );

    // أرجل مدرّعة بهيكل خارجي
    const legGeo = this.track(new THREE.BoxGeometry(0.4, 0.98, 0.42));
    this.leftLeg = new THREE.Mesh(legGeo, steelMat);
    this.leftLeg.position.set(-0.36, 0.49, 0);
    this.rightLeg = new THREE.Mesh(legGeo, steelMat);
    this.rightLeg.position.set(0.36, 0.49, 0);

    // جذع تكتيكي ودرع كتفين مع هوائيات نشر الأبراج
    const torso = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.24, 1.2, 0.76)), this.bodyMat);
    torso.position.y = 1.48;
    torso.castShadow = true;

    const chestPlate = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.92, 0.65, 0.14)), steelMat);
    chestPlate.position.set(0, 1.54, 0.42);

    const shoulderL = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.48, 0.42, 0.68)), hazardMat);
    shoulderL.position.set(-0.84, 1.92, 0);
    const shoulderR = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.48, 0.42, 0.68)), hazardMat);
    shoulderR.position.set(0.84, 1.92, 0);

    // ذراعا مهندس: مدفع بلازما يميناً وقاذف أبراج/صواريخ يساراً
    const launcher = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.34, 0.36, 1.05)),
      steelMat,
    );
    launcher.position.set(-0.92, 1.48, 0.48);

    const plasmaGun = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.11, 0.14, 1.15, 10)),
      this.darkMat,
    );
    plasmaGun.rotation.x = Math.PI / 2;
    plasmaGun.position.set(0.9, 1.48, 0.56);

    // خوذة المهندس مع منظار رقمي مضيء (نقطة الرأس)
    const headMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
        roughness: 0.25,
      }),
    );
    const head = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.58, 0.52, 0.58)), headMat);
    head.position.y = 2.38;
    const visor = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.5, 0.18, 0.1)), this.visorMat);
    visor.position.set(0, 2.4, 0.29);

    const antenna = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 6)),
      steelMat,
    );
    antenna.position.set(0.46, 2.55, -0.2);

    // مولّد الطاقة الخلفي (نقطة الضعف الرئيسية)
    this.generatorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 1.5,
        roughness: 0.15,
      }),
    );
    this.weakPointMats.push(this.generatorMat);

    const genCore = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.36, 0.36, 0.88, 12)),
      this.generatorMat,
    );
    genCore.position.set(0, 1.6, -0.58);
    const genRing = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.42, 0.06, 8, 18)), hazardMat);
    genRing.position.set(0, 1.6, -0.58);

    // قبة درع الدرونات شبه الشفافة (تظهر فقط عندما تكون الدرونات الحامية نشطة)
    const shieldDomeMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.28,
        roughness: 0.15,
        depthWrite: false,
      }),
    );
    this.shieldMat = shieldDomeMat;
    const dome = new THREE.Mesh(this.track(new THREE.SphereGeometry(1.65, 18, 14)), shieldDomeMat);
    dome.position.set(0, 1.5, 0);
    dome.visible = false;
    // لا تعترض القبة الشعاع بالكامل حتى تظل الرأس والمولّد قابلين للتصويب أثناء تقليل الضرر
    dome.raycast = () => {};
    this.bossShieldMesh = dome;

    this.group.add(
      this.leftLeg,
      this.rightLeg,
      torso,
      chestPlate,
      shoulderL,
      shoulderR,
      launcher,
      plasmaGun,
      head,
      visor,
      antenna,
      genCore,
      genRing,
      dome,
    );

    [this.leftLeg, this.rightLeg, torso, chestPlate, shoulderL, shoulderR, launcher, plasmaGun, antenna].forEach(
      (p) => this.tagPart(p, 'body'),
    );
    this.tagPart(head, 'head');
    this.tagPart(visor, 'head');
    this.tagPart(genCore, 'generator');
    this.tagPart(genRing, 'generator');

    this.muzzleOffset.set(0.88, 1.5, 1.15);
  }
}
