import * as THREE from 'three';
import { EnemyBase, type EnemySharedGeometries } from './EnemyBase';

/* ==========================================
   عدو 1: المقتحم (Rusher) — سريع ويندفع للاشتباك القريب
   ========================================== */

export class RusherEnemy extends EnemyBase {
  constructor(wave: number, shared: EnemySharedGeometries) {
    super(
      {
        type: 'rusher',
        name: 'مقتحم',
        hp: 55,
        speed: 7.4,
        color: 0xf97316,
        visor: 0xfef08a,
        radarColor: '#fb923c',
        scale: 0.9,
        shoots: false,
        fireRate: 2.0,
        dmg: 14,
        score: 100,
      },
      wave,
      shared,
    );
  }

  protected buildBody(shared: EnemySharedGeometries): void {
    this.buildHumanoidBase(shared);
    // شفرة هجومية أمامية لتمييز المقتحم بصرياً
    const blade = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.12, 0.14, 0.55)), this.visorMat);
    blade.position.set(-0.55, 1.38, 0.48);
    this.group.add(blade);
    this.tagPart(blade, 'body');
  }
}
