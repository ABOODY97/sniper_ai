import * as THREE from 'three';
import { EnemyBase, type EnemySharedGeometries } from './EnemyBase';

/* ==========================================
   عدو 4: القناص المعادي (Enemy Sniper) — شعاع ليزر أحمر تحذيري ثم طلقة قاتلة
   ========================================== */

export class SniperEnemy extends EnemyBase {
  constructor(wave: number, shared: EnemySharedGeometries) {
    super(
      {
        type: 'sniper',
        name: 'قناص معادي',
        hp: 70,
        fixedHp: true,
        instantHeadshotKill: true,
        speed: 3.4,
        color: 0x475569,
        visor: 0xff0033,
        radarColor: '#ff1493',
        scale: 0.98,
        shoots: true,
        fireRate: 2.6,
        aimDuration: 1.2,
        dmg: 35,
        score: 250,
        minDist: 30,
        maxDist: 40,
      },
      wave,
      shared,
    );
  }

  protected buildBody(shared: EnemySharedGeometries): void {
    this.buildHumanoidBase(shared);
    const barrel = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.04, 0.04, 1.55, 8)), this.darkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.6, 1.5, 1.05);

    const scope = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.06, 0.06, 0.38, 8)), this.visorMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0.6, 1.62, 0.65);

    this.group.add(barrel, scope);
    this.tagPart(barrel, 'body');
    this.tagPart(scope, 'body');
    this.muzzleOffset.set(0.6, 1.5, 1.85);
  }
}
