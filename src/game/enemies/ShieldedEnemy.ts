import * as THREE from 'three';
import { EnemyBase, type EnemySharedGeometries } from './EnemyBase';

/* ==========================================
   عدو 6: المدرع بدرع أمامي (Shielded) — درع طاقة أمامي ونقطة ضعف خلفية (مولّد متوهج)
   ========================================== */

export class ShieldedEnemy extends EnemyBase {
  constructor(wave: number, shared: EnemySharedGeometries) {
    super(
      {
        type: 'shielded',
        name: 'مدرع بدرع أمامي',
        hp: 160,
        fixedHp: true,
        speed: 2.7,
        color: 0x1d4ed8,
        visor: 0x60a5fa,
        radarColor: '#3b82f6',
        scale: 1.15,
        shoots: true,
        fireRate: 1.55,
        dmg: 14,
        score: 260,
      },
      wave,
      shared,
    );
  }

  protected buildBody(shared: EnemySharedGeometries): void {
    this.buildHumanoidBase(shared);

    this.shieldMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.48,
        roughness: 0.15,
        metalness: 0.2,
      }),
    );

    const frontShield = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.52, 1.88, 0.12)), this.shieldMat);
    frontShield.position.set(0, 1.24, 0.66);
    const shieldFrame = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.6, 0.12, 0.16)), this.darkMat);
    shieldFrame.position.set(0, 2.18, 0.66);

    this.generatorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xff6600,
        emissiveIntensity: 1.2,
        roughness: 0.2,
      }),
    );
    const genCore = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.28, 0.28, 0.68, 12)), this.generatorMat);
    genCore.position.set(0, 1.42, -0.48);
    const genCap = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.46, 0.22, 0.36)), this.darkMat);
    genCap.position.set(0, 1.82, -0.45);

    this.group.add(frontShield, shieldFrame, genCore, genCap);
    this.tagPart(frontShield, 'shield');
    this.tagPart(shieldFrame, 'shield');
    this.tagPart(genCore, 'generator');
    this.tagPart(genCap, 'generator');
    this.muzzleOffset.set(0.68, 1.45, 0.8);
  }
}
