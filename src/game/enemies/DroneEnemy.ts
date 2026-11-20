import * as THREE from 'three';
import { EnemyBase, type EnemySharedGeometries } from './EnemyBase';

/* ==========================================
   عدو 5: درون الاستطلاع (Drone) — طائر سريع يستدعي مقتحمين عند رصد اللاعب
   ========================================== */

export class DroneEnemy extends EnemyBase {
  constructor(wave: number, shared: EnemySharedGeometries) {
    super(
      {
        type: 'drone',
        name: 'درون استطلاع',
        hp: 40,
        fixedHp: true,
        flying: true,
        speed: 8.8,
        color: 0x0d9488,
        visor: 0x2dd4bf,
        radarColor: '#00f5d4',
        scale: 1.0,
        shoots: true,
        fireRate: 2.3,
        dmg: 7,
        score: 180,
      },
      wave,
      shared,
    );
    this.hoverHeight = 4.6 + Math.random() * 1.9;
  }

  protected buildBody(_shared: EnemySharedGeometries): void {
    const hull = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.75, 0.55, 0.35, 8)), this.bodyMat);
    hull.castShadow = true;

    const ring = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.9, 0.07, 8, 18)), this.darkMat);
    ring.rotation.x = Math.PI / 2;

    const core = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.24, 10, 10)), this.visorMat);
    core.position.set(0, 0, 0.52);

    const podGeo = this.track(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 8));
    const bladeGeo = this.track(new THREE.BoxGeometry(0.55, 0.04, 0.1));
    const offsets: Array<[number, number, number]> = [
      [-0.85, 0.18, -0.6],
      [0.85, 0.18, -0.6],
      [-0.85, 0.18, 0.6],
      [0.85, 0.18, 0.6],
    ];
    for (const [rx, ry, rz] of offsets) {
      const pod = new THREE.Mesh(podGeo, this.darkMat);
      pod.position.set(rx, ry - 0.08, rz);
      const blade = new THREE.Mesh(bladeGeo, this.visorMat);
      blade.position.set(rx, ry + 0.02, rz);
      this.group.add(pod, blade);
      this.tagPart(pod, 'body');
      this.rotors.push(blade);
    }

    this.group.add(hull, ring, core);
    this.tagPart(hull, 'body');
    this.tagPart(ring, 'body');
    this.tagPart(core, 'head');
    this.muzzleOffset.set(0, -0.25, 0.55);
  }
}
