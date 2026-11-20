import * as THREE from 'three';
import { EnemyBase, type EnemySharedGeometries } from './EnemyBase';

/* ==========================================
   عدو 3: المدرع الثقيل (Heavy) — صحة عالية ونيران كثيفة
   ========================================== */

export class HeavyEnemy extends EnemyBase {
  constructor(wave: number, shared: EnemySharedGeometries) {
    super(
      {
        type: 'heavy',
        name: 'مدرع ثقيل',
        hp: 240,
        speed: 3.1,
        color: 0x9333ea,
        visor: 0xf43f5e,
        radarColor: '#c084fc',
        scale: 1.32,
        shoots: true,
        fireRate: 1.25,
        dmg: 16,
        score: 300,
      },
      wave,
      shared,
    );
  }

  protected buildBody(shared: EnemySharedGeometries): void {
    this.buildHumanoidBase(shared);
    const padGeo = this.track(new THREE.BoxGeometry(0.42, 0.35, 0.62));
    const padL = new THREE.Mesh(padGeo, this.bodyMat);
    padL.position.set(-0.66, 1.82, 0);
    const padR = new THREE.Mesh(padGeo, this.bodyMat);
    padR.position.set(0.66, 1.82, 0);
    this.group.add(padL, padR);
    this.tagPart(padL, 'body');
    this.tagPart(padR, 'body');
  }
}
