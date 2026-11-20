import * as THREE from 'three';
import { EnemyBase, type EnemySharedGeometries } from './EnemyBase';
import { PLAYER_CONSTANTS } from '../rules';

/* ==========================================
   عدو طائر: درون السرب (Drone Swarm — 6 درونات صغيرة، صحة كل واحد 15)
   سرب سريع ومتناور يهاجم اللاعب جماعياً من ارتفاع متوسط
   ========================================== */

export class SwarmDroneEnemy extends EnemyBase {
  constructor(wave: number, shared: EnemySharedGeometries) {
    super(
      {
        type: 'swarm_drone',
        name: 'درون السرب',
        hp: PLAYER_CONSTANTS.SWARM_DRONE_HP,
        fixedHp: true,
        flying: true,
        speed: 11.4,
        color: 0x4d7c0f,
        visor: 0xa3e635,
        radarColor: '#a3e635',
        scale: 0.68,
        shoots: true,
        fireRate: 2.5,
        dmg: 5,
        score: 75,
        minDist: 9,
        maxDist: 17,
      },
      wave,
      shared,
    );
    this.hoverHeight = 3.2 + Math.random() * 2.8;
    this.shootTimer = 0.8 + Math.random() * 1.8;
  }

  protected buildBody(_shared: EnemySharedGeometries): void {
    // جسم صغير ثماني الأضلاع خفيف الوزن
    const coreHull = new THREE.Mesh(
      this.track(new THREE.OctahedronGeometry(0.62, 0)),
      this.bodyMat,
    );
    coreHull.scale.set(1.15, 0.72, 1.25);

    const eye = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.24, 8, 8)),
      this.visorMat,
    );
    eye.position.set(0, 0, 0.52);

    const wingL = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.9, 0.07, 0.24)), this.darkMat);
    wingL.position.set(-0.62, 0.14, 0);
    wingL.rotation.z = 0.25;
    const wingR = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.9, 0.07, 0.24)), this.darkMat);
    wingR.position.set(0.62, 0.14, 0);
    wingR.rotation.z = -0.25;

    const rotorGeo = this.track(new THREE.BoxGeometry(0.62, 0.04, 0.1));
    const rotorL = new THREE.Mesh(rotorGeo, this.visorMat);
    rotorL.position.set(-0.82, 0.28, 0);
    const rotorR = new THREE.Mesh(rotorGeo, this.visorMat);
    rotorR.position.set(0.82, 0.28, 0);
    this.rotors.push(rotorL, rotorR);

    this.group.add(coreHull, eye, wingL, wingR, rotorL, rotorR);
    this.tagPart(coreHull, 'body');
    this.tagPart(wingL, 'body');
    this.tagPart(wingR, 'body');
    this.tagPart(eye, 'head');

    this.hpBarGroup.position.y = 0.95;
    this.muzzleOffset.set(0, -0.15, 0.65);
  }
}
