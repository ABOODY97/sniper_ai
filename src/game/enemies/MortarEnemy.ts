import * as THREE from 'three';
import { EnemyBase, type EnemySharedGeometries } from './EnemyBase';

/* ==========================================
   عدو 7: قاذف الهاون (Mortar) — يطلق قذائف مقوسة مع دائرة تحذير أرضية حمراء
   ========================================== */

export class MortarEnemy extends EnemyBase {
  constructor(wave: number, shared: EnemySharedGeometries) {
    super(
      {
        type: 'mortar',
        name: 'قاذف هاون',
        hp: 80,
        fixedHp: true,
        speed: 2.6,
        color: 0x65a30d,
        visor: 0xfacc15,
        radarColor: '#a3e635',
        scale: 1.06,
        shoots: true,
        fireRate: 3.6,
        dmg: 30,
        blastRadius: 4.0,
        warningTime: 1.5,
        score: 220,
        minDist: 24,
        maxDist: 38,
      },
      wave,
      shared,
    );
  }

  protected buildBody(shared: EnemySharedGeometries): void {
    this.buildHumanoidBase(shared);

    const tube = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.18, 0.22, 1.15, 10)), this.darkMat);
    tube.position.set(-0.55, 1.95, -0.1);
    tube.rotation.x = -0.42;

    const tubeRim = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.19, 0.04, 8, 14)), this.visorMat);
    tubeRim.position.set(-0.55, 2.46, 0.14);
    tubeRim.rotation.x = Math.PI / 2 - 0.42;

    const pack = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.65, 0.72, 0.35)), this.darkMat);
    pack.position.set(0, 1.38, -0.44);

    this.group.add(tube, tubeRim, pack);
    this.tagPart(tube, 'body');
    this.tagPart(tubeRim, 'body');
    this.tagPart(pack, 'body');
    this.muzzleOffset.set(-0.55, 2.55, 0.2);
  }
}
