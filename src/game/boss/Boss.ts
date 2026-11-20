import * as THREE from 'three';
import { EnemyBase, type EnemySharedGeometries } from '../enemies/EnemyBase';
import { computeBossMaxHp, computeBossPhase } from '../rules';

/* ==========================================
   الزعيم (الباس) — العملاق المدرع تيتان أوميغا
   يظهر كل 5 موجات مع 3 مراحل ونقطتي ضعف (الرأس والمولّد الخلفي)
   ========================================== */

export class BossEnemy extends EnemyBase {
  public readonly tier: number;

  constructor(wave: number, shared: EnemySharedGeometries) {
    const maxHp = computeBossMaxHp(wave);
    super(
      {
        type: 'boss',
        name: 'تيتان أوميغا (الباس)',
        hp: maxHp,
        isBoss: true,
        speed: 3.5,
        color: 0x7f1d1d,
        visor: 0xfde047,
        radarColor: '#ff0040',
        scale: 2.35,
        shoots: true,
        fireRate: 2.6,
        dmg: 18,
        score: 1000,
      },
      wave,
      shared,
      maxHp,
    );
    this.tier = Math.max(1, Math.floor(wave / 5));
  }

  protected buildBody(_shared: EnemySharedGeometries): void {
    const armorTrim = this.track(
      new THREE.MeshStandardMaterial({ color: 0x991b1b, metalness: 0.72, roughness: 0.25 }),
    );
    const legGeo = this.track(new THREE.BoxGeometry(0.42, 1.0, 0.44));

    this.leftLeg = new THREE.Mesh(legGeo, this.darkMat);
    this.leftLeg.position.set(-0.38, 0.5, 0);
    this.rightLeg = new THREE.Mesh(legGeo, this.darkMat);
    this.rightLeg.position.set(0.38, 0.5, 0);

    const torso = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.3, 1.25, 0.78)), this.bodyMat);
    torso.position.y = 1.5;
    torso.castShadow = true;

    const chestCore = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.26, 0)), this.visorMat);
    chestCore.position.set(0, 1.55, 0.42);

    const shoulderGeo = this.track(new THREE.BoxGeometry(0.5, 0.45, 0.7));
    const shoulderL = new THREE.Mesh(shoulderGeo, armorTrim);
    shoulderL.position.set(-0.85, 1.98, 0);
    const shoulderR = new THREE.Mesh(shoulderGeo, armorTrim);
    shoulderR.position.set(0.85, 1.98, 0);

    const cannonGeo = this.track(new THREE.CylinderGeometry(0.11, 0.13, 1.05, 10));
    const cannonL = new THREE.Mesh(cannonGeo, this.darkMat);
    cannonL.rotation.x = Math.PI / 2;
    cannonL.position.set(-0.88, 1.6, 0.55);
    const cannonR = new THREE.Mesh(cannonGeo, this.darkMat);
    cannonR.rotation.x = Math.PI / 2;
    cannonR.position.set(0.88, 1.6, 0.55);

    const headMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.9,
        roughness: 0.22,
      }),
    );
    const head = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.62, 0.54, 0.62)), headMat);
    head.position.y = 2.42;
    const visor = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.54, 0.16, 0.1)),
      this.track(new THREE.MeshBasicMaterial({ color: 0xff0033 })),
    );
    visor.position.set(0, 2.44, 0.31);
    const crown = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.7, 0.14, 0.7)), armorTrim);
    crown.position.y = 2.74;

    this.generatorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 1.5,
        roughness: 0.15,
      }),
    );
    const genCore = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.36, 0.36, 0.85, 14)),
      this.generatorMat,
    );
    genCore.position.set(0, 1.62, -0.58);
    const genRing = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.42, 0.06, 8, 18)), this.visorMat);
    genRing.position.set(0, 1.62, -0.58);

    this.group.add(
      this.leftLeg,
      this.rightLeg,
      torso,
      chestCore,
      shoulderL,
      shoulderR,
      cannonL,
      cannonR,
      head,
      visor,
      crown,
      genCore,
      genRing,
    );

    const bodyParts = [
      this.leftLeg,
      this.rightLeg,
      torso,
      chestCore,
      shoulderL,
      shoulderR,
      cannonL,
      cannonR,
      crown,
    ];
    bodyParts.forEach((p) => this.tagPart(p, 'body'));
    this.tagPart(head, 'head');
    this.tagPart(visor, 'head');
    this.tagPart(genCore, 'generator');
    this.tagPart(genRing, 'generator');

    this.muzzleOffset.set(0, 1.65, 1.05);
  }

  /** فحص الانتقال إلى المرحلة 2 أو 3 بناءً على الصحة المتبقية */
  public evaluatePhaseTransition(): { changed: boolean; newPhase: 1 | 2 | 3 } {
    const nextPhase = computeBossPhase(this.hp, this.maxHp);
    if (nextPhase > this.bossPhase) {
      this.bossPhase = nextPhase;
      if (nextPhase === 2) {
        this.speed *= 1.25;
      } else if (nextPhase === 3) {
        this.speed *= 1.28;
        this.bodyMat.color.setHex(0xb91c1c);
      }
      return { changed: true, newPhase: nextPhase };
    }
    return { changed: false, newPhase: this.bossPhase };
  }
}
