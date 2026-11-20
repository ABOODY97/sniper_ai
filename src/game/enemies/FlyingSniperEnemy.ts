import * as THREE from 'three';
import { EnemyBase, type EnemySharedGeometries } from './EnemyBase';

/* ==========================================
   عدو طائر: القناص الطائر (Flying Sniper)
   يحلق على ارتفاع عالٍ ومسافة بعيدة ويُظهر شعاع ليزر تحذيري قبل إطلاق طلقة قنص دقيقة
   ========================================== */

export class FlyingSniperEnemy extends EnemyBase {
  constructor(wave: number, shared: EnemySharedGeometries) {
    super(
      {
        type: 'flying_sniper',
        name: 'القناص الطائر',
        hp: 65,
        fixedHp: true,
        instantHeadshotKill: true,
        flying: true,
        speed: 5.6,
        color: 0x3b0764,
        visor: 0xe879f9,
        radarColor: '#e879f9',
        scale: 1.05,
        shoots: true,
        fireRate: 2.9,
        aimDuration: 1.35,
        dmg: 32,
        score: 280,
        minDist: 36,
        maxDist: 56,
      },
      wave,
      shared,
    );
    this.hoverHeight = 9.2 + Math.random() * 2.4;
  }

  protected buildBody(_shared: EnemySharedGeometries): void {
    const trimMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x7e22ce,
        emissiveIntensity: 0.7,
        roughness: 0.3,
        metalness: 0.55,
      }),
    );

    // منصة قنص جوية انسيابية
    const chassis = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.15, 0.45, 1.45)), this.bodyMat);
    chassis.castShadow = true;

    // عدسة استهداف متوهجة (نقطة إصابة الرأس للقضاء الفوري)
    const opticHead = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.32, 12, 12)), this.visorMat);
    opticHead.position.set(0, 0.12, 0.76);

    // ماسورة قنص كهرومغناطيسية طويلة
    const barrel = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.055, 0.075, 2.2, 8)),
      this.darkMat,
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, -0.18, 1.35);

    const railStrip = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.08, 0.08, 1.85)), trimMat);
    railStrip.position.set(0, -0.1, 1.25);

    // جناحان مائلان ومراوح تحليق هادئة
    const wingL = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.3, 0.08, 0.48)), this.darkMat);
    wingL.position.set(-1.05, 0.15, -0.1);
    wingL.rotation.z = -0.2;
    const wingR = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.3, 0.08, 0.48)), this.darkMat);
    wingR.position.set(1.05, 0.15, -0.1);
    wingR.rotation.z = 0.2;

    const rotorGeo = this.track(new THREE.BoxGeometry(0.85, 0.04, 0.12));
    const rotorL = new THREE.Mesh(rotorGeo, this.visorMat);
    rotorL.position.set(-1.55, 0.32, -0.1);
    const rotorR = new THREE.Mesh(rotorGeo, this.visorMat);
    rotorR.position.set(1.55, 0.32, -0.1);
    this.rotors.push(rotorL, rotorR);

    this.group.add(chassis, opticHead, barrel, railStrip, wingL, wingR, rotorL, rotorR);
    this.tagPart(chassis, 'body');
    this.tagPart(barrel, 'body');
    this.tagPart(railStrip, 'body');
    this.tagPart(wingL, 'body');
    this.tagPart(wingR, 'body');
    this.tagPart(opticHead, 'head');

    this.hpBarGroup.position.y = 1.1;
    this.muzzleOffset.set(0, -0.18, 2.45);
  }
}
