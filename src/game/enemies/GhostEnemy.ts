import * as THREE from 'three';
import { EnemyBase, type EnemySharedGeometries } from './EnemyBase';

/* ==========================================
   عدو 9: الشبح (Ghost) — صحة 60، مادة شبه شفافة ومخفي عن الرادار
   يصبح مرئياً بالكامل لمدة ثانيتين بعد إطلاق النار أو إصابته
   ========================================== */

const CLOAKED_BODY_OPACITY = 0.16;
const CLOAKED_VISOR_OPACITY = 0.32;

export class GhostEnemy extends EnemyBase {
  private cloakMaterialAlpha = CLOAKED_BODY_OPACITY;
  private readonly spectralMat: THREE.MeshStandardMaterial;

  constructor(wave: number, shared: EnemySharedGeometries) {
    super(
      {
        type: 'ghost',
        name: 'الشبح',
        hp: 60,
        fixedHp: true,
        hiddenFromRadar: true,
        speed: 5.3,
        color: 0x67e8f9,
        visor: 0xe0f2fe,
        radarColor: '#67e8f9',
        scale: 0.96,
        shoots: true,
        fireRate: 1.75,
        dmg: 12,
        score: 230,
        minDist: 8,
        maxDist: 16,
      },
      wave,
      shared,
    );

    // تفعيل الشفافية الطيفية للمواد الأساسية
    this.bodyMat.transparent = true;
    this.bodyMat.opacity = CLOAKED_BODY_OPACITY;
    this.bodyMat.depthWrite = false;
    this.bodyMat.roughness = 0.2;
    this.bodyMat.metalness = 0.15;
    this.bodyMat.emissive.setHex(0x0e7490);
    this.bodyMat.emissiveIntensity = 0.45;

    this.darkMat.transparent = true;
    this.darkMat.opacity = CLOAKED_BODY_OPACITY;
    this.darkMat.depthWrite = false;

    this.visorMat.transparent = true;
    this.visorMat.opacity = CLOAKED_VISOR_OPACITY;
    this.visorMat.depthWrite = false;

    this.spectralMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: CLOAKED_BODY_OPACITY,
        depthWrite: false,
        roughness: 0.18,
      }),
    );

    // إضافة عباءة وكتفين طيفيين يمنحان الشبح هيئة مميزة
    const cloak = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.68, 1.55, 7, 1, true)), this.spectralMat);
    cloak.position.set(0, 1.05, -0.05);
    const hood = new THREE.Mesh(this.track(new THREE.OctahedronGeometry(0.42, 0)), this.spectralMat);
    hood.position.set(0, 2.24, -0.06);
    hood.scale.set(1.05, 0.85, 1.1);

    this.group.add(cloak, hood);
    this.tagPart(cloak, 'body');
    this.tagPart(hood, 'head');

    // إخفاء الظل الأرضي أثناء التخفي لتعزيز طابع التسلل
    if (this.contactShadow) {
      this.contactShadow.visible = false;
    }
  }

  protected buildBody(shared: EnemySharedGeometries): void {
    this.buildHumanoidBase(shared);
    this.muzzleOffset.set(0.55, 1.48, 0.72);
  }

  /** تحديث حالة التخفي والكشف لمدة ثانيتين بعد الإطلاق أو تلقي الضرر */
  public override updateStealthVisual(dt: number, nowMs: number): void {
    const revealed = this.revealTimer > 0;
    if (revealed) {
      this.revealTimer = Math.max(0, this.revealTimer - dt);
    }

    const shimmer = revealed ? 0 : Math.sin(nowMs * 0.007 + this.walkPhase) * 0.04;
    const targetAlpha = revealed ? 1.0 : CLOAKED_BODY_OPACITY + shimmer;
    this.cloakMaterialAlpha += (targetAlpha - this.cloakMaterialAlpha) * Math.min(1, dt * 14);

    const alpha = Math.max(0.1, Math.min(1.0, this.cloakMaterialAlpha));
    const isSolid = alpha > 0.85;

    this.bodyMat.opacity = alpha;
    this.bodyMat.depthWrite = isSolid;
    this.darkMat.opacity = alpha;
    this.darkMat.depthWrite = isSolid;
    this.spectralMat.opacity = revealed ? 0.85 : alpha * 0.9;
    this.spectralMat.depthWrite = isSolid;
    this.visorMat.opacity = revealed ? 1.0 : Math.max(CLOAKED_VISOR_OPACITY, alpha);
    this.visorMat.depthWrite = isSolid;

    if (this.contactShadow) {
      this.contactShadow.visible = revealed;
    }
  }
}
