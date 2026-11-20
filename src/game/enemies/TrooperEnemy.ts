import * as THREE from 'three';
import { EnemyBase, type EnemySharedGeometries } from './EnemyBase';

/* ==========================================
   عدو 2: جندي الليزر (Laser Trooper) — يطلق طلقات ليزر متوسطة المدى
   ========================================== */

export class TrooperEnemy extends EnemyBase {
  constructor(wave: number, shared: EnemySharedGeometries) {
    super(
      {
        type: 'trooper',
        name: 'جندي ليزر',
        hp: 90,
        speed: 4.5,
        color: 0xef4444,
        visor: 0x38bdf8,
        radarColor: '#ef4444',
        scale: 1.0,
        shoots: true,
        fireRate: 1.8,
        dmg: 12,
        score: 150,
      },
      wave,
      shared,
    );
  }

  protected buildBody(shared: EnemySharedGeometries): void {
    this.buildHumanoidBase(shared);
    const rifle = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 8)), this.darkMat);
    rifle.rotation.x = Math.PI / 2;
    rifle.position.set(0.6, 1.45, 0.65);
    this.group.add(rifle);
    this.tagPart(rifle, 'body');
  }
}
