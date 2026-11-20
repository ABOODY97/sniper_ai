import * as THREE from 'three';
import { EnemyBase, type EnemySharedGeometries } from './EnemyBase';

/* ==========================================
   برج قتالي آلي قابل للتدمير (Turret)
   ينشره زعيم "المهندس المدرّع" أثناء المعركة ويطلق رشقات ليزر نحو اللاعب
   ========================================== */

export class TurretEnemy extends EnemyBase {
  constructor(wave: number, shared: EnemySharedGeometries) {
    super(
      {
        type: 'turret',
        name: 'برج آلي',
        hp: 55,
        fixedHp: true,
        speed: 0,
        color: 0xd97706,
        visor: 0xfef08a,
        radarColor: '#fb923c',
        scale: 1.0,
        shoots: true,
        fireRate: 1.35,
        dmg: 9,
        score: 120,
      },
      wave,
      shared,
    );
    this.isBossSummon = true;
    this.shootTimer = 1.0;
  }

  protected buildBody(_shared: EnemySharedGeometries): void {
    // قاعدة ثلاثية ثابتة على الأرض
    const base = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.45, 0.72, 0.65, 8)),
      this.darkMat,
    );
    base.position.y = 0.32;
    base.castShadow = true;

    const pillar = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.24, 0.32, 0.65, 8)),
      this.bodyMat,
    );
    pillar.position.y = 0.85;

    // رأس البرج الدوّار المزوّد بمدفعين ومستشعر بصري
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.32;

    const headBox = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.75, 0.48, 0.75)), this.bodyMat);
    headBox.castShadow = true;

    const sensor = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.18, 10, 10)), this.visorMat);
    sensor.position.set(0, 0.08, 0.38);

    const barrelGeo = this.track(new THREE.CylinderGeometry(0.055, 0.065, 0.95, 8));
    const barrelL = new THREE.Mesh(barrelGeo, this.darkMat);
    barrelL.rotation.x = Math.PI / 2;
    barrelL.position.set(-0.22, -0.05, 0.68);
    const barrelR = new THREE.Mesh(barrelGeo, this.darkMat);
    barrelR.rotation.x = Math.PI / 2;
    barrelR.position.set(0.22, -0.05, 0.68);

    headGroup.add(headBox, sensor, barrelL, barrelR);
    this.turretHead = headGroup;

    this.group.add(base, pillar, headGroup);
    this.tagPart(base, 'body');
    this.tagPart(pillar, 'body');
    this.tagPart(headBox, 'head');
    this.tagPart(sensor, 'head');
    this.tagPart(barrelL, 'body');
    this.tagPart(barrelR, 'body');

    this.hpBarGroup.position.y = 2.05;
    this.muzzleOffset.set(0, 1.3, 1.15);
  }
}
