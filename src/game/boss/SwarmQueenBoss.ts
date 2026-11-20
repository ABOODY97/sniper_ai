import * as THREE from 'three';
import type { EnemySharedGeometries } from '../enemies/EnemyBase';
import { BossEnemy } from './Boss';

/* ==========================================
   الزعيم 2: ملكة السرب الطائرة (Swarm Queen)
   حاملة درونات طائرة ضخمة تستدعي أسراب الدرونات والانتحاريين،
   نقطة ضعفها الأساسية هي النواة المتوهجة أسفل بطنها
   ========================================== */

export class SwarmQueenBoss extends BossEnemy {
  constructor(wave: number, shared: EnemySharedGeometries) {
    super('swarm_queen', wave, shared, {
      flying: true,
      speed: 7.4,
      color: 0x701a75,
      visor: 0xf472b6,
      radarColor: '#ec4899',
      scale: 2.35,
      fireRate: 2.35,
      dmg: 15,
      score: 1350,
      phase3ColorHex: 0xbe185d,
    });
    this.hoverHeight = 9.2;
  }

  protected buildBody(_shared: EnemySharedGeometries): void {
    const carapaceMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.35, metalness: 0.6 }),
    );
    const glowTrimMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xf472b6,
        emissive: 0xdb2777,
        emissiveIntensity: 0.9,
        roughness: 0.25,
      }),
    );

    // الهيكل الحامل الرئيسي المقوّس
    const upperHull = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(1.15, 1.55, 0.72, 10)),
      this.bodyMat,
    );
    upperHull.position.y = 0.28;
    upperHull.castShadow = true;

    const spine = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.9, 0.45, 2.55)), carapaceMat);
    spine.position.set(0, 0.52, -0.15);

    // الرأس الأمامي المتوهج
    const head = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.55, 0)), glowTrimMat);
    head.position.set(0, 0.2, 1.38);

    // جناحان عريضان مع 4 محركات دفع ومراوح دوّارة
    const wingL = new THREE.Mesh(this.track(new THREE.BoxGeometry(2.35, 0.16, 1.1)), carapaceMat);
    wingL.position.set(-1.95, 0.34, -0.1);
    wingL.rotation.z = 0.16;
    const wingR = new THREE.Mesh(this.track(new THREE.BoxGeometry(2.35, 0.16, 1.1)), carapaceMat);
    wingR.position.set(1.95, 0.34, -0.1);
    wingR.rotation.z = -0.16;

    const ringGeo = this.track(new THREE.TorusGeometry(0.55, 0.07, 8, 18));
    const rotorGeo = this.track(new THREE.BoxGeometry(1.0, 0.05, 0.16));
    const pods: Array<[number, number, number]> = [
      [-2.4, 0.45, 0.35],
      [2.4, 0.45, 0.35],
      [-2.1, 0.45, -0.75],
      [2.1, 0.45, -0.75],
    ];
    for (const [px, py, pz] of pods) {
      const ring = new THREE.Mesh(ringGeo, glowTrimMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(px, py, pz);
      const blade = new THREE.Mesh(rotorGeo, this.visorMat);
      blade.position.set(px, py + 0.05, pz);
      this.group.add(ring, blade);
      this.tagPart(ring, 'body');
      this.rotors.push(blade);
    }

    // نقطة الضعف السفلية المكشوفة أسفل بطن ملكة السرب (تلمع بالذهبي/السماوي وتمنح 2.2x ضرر)
    this.generatorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.65,
        roughness: 0.14,
      }),
    );
    this.weakPointMats.push(this.generatorMat);

    const ventralCore = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.76, 16, 14)),
      this.generatorMat,
    );
    ventralCore.position.set(0, -0.42, 0.05);

    const ventralRing = new THREE.Mesh(
      this.track(new THREE.TorusGeometry(0.92, 0.09, 10, 22)),
      glowTrimMat,
    );
    ventralRing.rotation.x = Math.PI / 2;
    ventralRing.position.set(0, -0.32, 0.05);

    this.group.add(upperHull, spine, head, wingL, wingR, ventralCore, ventralRing);
    [upperHull, spine, wingL, wingR].forEach((p) => this.tagPart(p, 'body'));
    this.tagPart(head, 'head');
    this.tagPart(ventralCore, 'generator');
    this.tagPart(ventralRing, 'generator');

    this.muzzleOffset.set(0, -0.55, 1.15);
  }
}
