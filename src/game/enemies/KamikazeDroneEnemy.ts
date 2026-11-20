import * as THREE from 'three';
import { EnemyBase, type EnemySharedGeometries } from './EnemyBase';
import { PLAYER_CONSTANTS } from '../rules';

/* ==========================================
   عدو طائر: الدرون الانتحاري (Kamikaze Drone)
   يحلق ثم ينقض بسرعة خاطفة نحو اللاعب وينفجر عند الاصطدام
   ========================================== */

export class KamikazeDroneEnemy extends EnemyBase {
  public warheadMat!: THREE.MeshStandardMaterial;

  constructor(wave: number, shared: EnemySharedGeometries) {
    super(
      {
        type: 'kamikaze',
        name: 'درون انتحاري',
        hp: 35,
        fixedHp: true,
        flying: true,
        speed: 9.8,
        color: 0x991b1b,
        visor: 0xff3b30,
        radarColor: '#ff4d6d',
        scale: 0.96,
        shoots: false,
        fireRate: 99,
        dmg: PLAYER_CONSTANTS.KAMIKAZE_BLAST_DAMAGE,
        blastRadius: PLAYER_CONSTANTS.KAMIKAZE_BLAST_RADIUS,
        score: 170,
      },
      wave,
      shared,
    );
    this.hoverHeight = 6.2 + Math.random() * 1.8;
  }

  protected buildBody(_shared: EnemySharedGeometries): void {
    // رأس متفجر أمامي متوهج ينبض عند بدء الانقضاض
    this.warheadMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xef4444,
        emissiveIntensity: 1.25,
        roughness: 0.25,
      }),
    );

    const nose = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.45, 0.95, 10)), this.warheadMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0, 0.65);

    const hull = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.42, 0.34, 1.05, 10)),
      this.bodyMat,
    );
    hull.rotation.x = Math.PI / 2;
    hull.castShadow = true;

    // زعانف انقضاض على شكل X
    const finGeo = this.track(new THREE.BoxGeometry(1.45, 0.08, 0.38));
    const finA = new THREE.Mesh(finGeo, this.darkMat);
    finA.position.set(0, 0, -0.3);
    finA.rotation.z = Math.PI / 4;
    const finB = new THREE.Mesh(finGeo, this.darkMat);
    finB.position.set(0, 0, -0.3);
    finB.rotation.z = -Math.PI / 4;

    const ring = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.54, 0.06, 8, 18)), this.visorMat);
    ring.position.set(0, 0, 0.15);

    const rearRotor = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.95, 0.06, 0.14)), this.visorMat);
    rearRotor.position.set(0, 0.35, -0.35);
    this.rotors.push(rearRotor);

    this.group.add(nose, hull, finA, finB, ring, rearRotor);
    this.tagPart(hull, 'body');
    this.tagPart(finA, 'body');
    this.tagPart(finB, 'body');
    this.tagPart(ring, 'body');
    this.tagPart(nose, 'head');

    this.hpBarGroup.position.y = 1.0;
    this.muzzleOffset.set(0, 0, 1.0);
  }
}
