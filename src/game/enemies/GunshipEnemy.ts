import * as THREE from 'three';
import { EnemyBase, type EnemySharedGeometries } from './EnemyBase';

/* ==========================================
   عدو طائر: المدفعية الطائرة (Gunship)
   مروحية هجومية مدرّعة تقوم بجولات التفاف جانبية مع رشقات رصاص متتالية
   ========================================== */

export class GunshipEnemy extends EnemyBase {
  constructor(wave: number, shared: EnemySharedGeometries) {
    super(
      {
        type: 'gunship',
        name: 'المدفعية الطائرة',
        hp: 115,
        flying: true,
        speed: 10.5,
        color: 0xb45309,
        visor: 0xfbbf24,
        radarColor: '#f59e0b',
        scale: 1.25,
        shoots: true,
        fireRate: 2.8,
        dmg: 9,
        score: 260,
        minDist: 18,
        maxDist: 34,
      },
      wave,
      shared,
    );
    this.hoverHeight = 7.0 + Math.random() * 1.8;
    this.strafeRunAngle = Math.random() * Math.PI * 2;
  }

  protected buildBody(_shared: EnemySharedGeometries): void {
    const armorMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.6 }),
    );
    const cockpitMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      }),
    );

    // الهيكل الرئيسي المدرّع
    const fuselage = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.4, 0.72, 2.2)), this.bodyMat);
    fuselage.castShadow = true;

    // قمرة القيادة الأمامية (نقطة ضعف الرأس)
    const cockpit = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.95, 0.48, 0.75)), cockpitMat);
    cockpit.position.set(0, 0.08, 1.02);

    // ذيل وموازن خلفي
    const tailBoom = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.36, 0.3, 1.45)), armorMat);
    tailBoom.position.set(0, 0.14, -1.55);
    const tailFin = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.12, 0.65, 0.55)), this.bodyMat);
    tailFin.position.set(0, 0.42, -2.05);

    // جناحان جانبيان مع مدفعين دوّارين
    const wing = new THREE.Mesh(this.track(new THREE.BoxGeometry(3.2, 0.14, 0.72)), armorMat);
    wing.position.set(0, 0.05, 0.05);

    const gunGeo = this.track(new THREE.CylinderGeometry(0.08, 0.09, 1.15, 8));
    const gunL = new THREE.Mesh(gunGeo, this.darkMat);
    gunL.rotation.x = Math.PI / 2;
    gunL.position.set(-1.25, -0.22, 0.62);
    const gunR = new THREE.Mesh(gunGeo, this.darkMat);
    gunR.rotation.x = Math.PI / 2;
    gunR.position.set(1.25, -0.22, 0.62);

    // محركا دفع ومروحتان جانبيتان
    const podGeo = this.track(new THREE.CylinderGeometry(0.28, 0.24, 0.34, 10));
    const rotorGeo = this.track(new THREE.BoxGeometry(1.55, 0.05, 0.16));
    const rotorPositions: Array<[number, number, number]> = [
      [-1.55, 0.28, 0.05],
      [1.55, 0.28, 0.05],
    ];
    for (const [rx, ry, rz] of rotorPositions) {
      const pod = new THREE.Mesh(podGeo, this.darkMat);
      pod.position.set(rx, ry - 0.1, rz);
      const bladeA = new THREE.Mesh(rotorGeo, this.visorMat);
      bladeA.position.set(rx, ry + 0.12, rz);
      const bladeB = new THREE.Mesh(rotorGeo, this.visorMat);
      bladeB.position.set(rx, ry + 0.12, rz);
      bladeB.rotation.y = Math.PI / 2;
      this.group.add(pod, bladeA, bladeB);
      this.tagPart(pod, 'body');
      this.rotors.push(bladeA, bladeB);
    }

    this.group.add(fuselage, cockpit, tailBoom, tailFin, wing, gunL, gunR);
    this.tagPart(fuselage, 'body');
    this.tagPart(tailBoom, 'body');
    this.tagPart(tailFin, 'body');
    this.tagPart(wing, 'body');
    this.tagPart(gunL, 'body');
    this.tagPart(gunR, 'body');
    this.tagPart(cockpit, 'head');

    this.hpBarGroup.position.y = 1.25;
    this.muzzleOffset.set(0, -0.22, 1.35);
  }
}
