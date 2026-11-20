import * as THREE from 'three';
import type { EnemyTypeId, HitZone } from '../types';

/* ==========================================
   الفئة الأساسية للأعداء والنماذج ثلاثية الأبعاد والظلال الأرضية
   ========================================== */

export interface EnemyConfig {
  type: EnemyTypeId;
  name: string;
  hp: number;
  fixedHp?: boolean;
  instantHeadshotKill?: boolean;
  flying?: boolean;
  isBoss?: boolean;
  speed: number;
  color: number;
  visor: number;
  radarColor: string;
  scale: number;
  shoots: boolean;
  fireRate: number;
  aimDuration?: number;
  dmg: number;
  blastRadius?: number;
  warningTime?: number;
  score: number;
  minDist?: number;
  maxDist?: number;
}

export interface EnemyHitUserData {
  enemy: EnemyBase;
  isHead: boolean;
  hitZone: HitZone;
}

export interface EnemySharedGeometries {
  legGeo: THREE.BoxGeometry;
  torsoGeo: THREE.BoxGeometry;
  armGeo: THREE.BoxGeometry;
  headGeo: THREE.BoxGeometry;
  visorGeo: THREE.BoxGeometry;
  hpBgGeo: THREE.PlaneGeometry;
  hpFgGeo: THREE.PlaneGeometry;
  shadowGeo: THREE.CircleGeometry;
  shadowMat: THREE.MeshBasicMaterial;
}

export function createEnemySharedGeometries(): EnemySharedGeometries {
  const shadowGeo = new THREE.CircleGeometry(0.75, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x020617,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  return {
    legGeo: new THREE.BoxGeometry(0.32, 0.9, 0.32),
    torsoGeo: new THREE.BoxGeometry(0.95, 1.0, 0.55),
    armGeo: new THREE.BoxGeometry(0.24, 0.24, 0.75),
    headGeo: new THREE.BoxGeometry(0.56, 0.52, 0.56),
    visorGeo: new THREE.BoxGeometry(0.46, 0.16, 0.08),
    hpBgGeo: new THREE.PlaneGeometry(1.25, 0.14),
    hpFgGeo: new THREE.PlaneGeometry(1.2, 0.1),
    shadowGeo,
    shadowMat,
  };
}

export function disposeEnemySharedGeometries(shared: EnemySharedGeometries): void {
  shared.legGeo.dispose();
  shared.torsoGeo.dispose();
  shared.armGeo.dispose();
  shared.headGeo.dispose();
  shared.visorGeo.dispose();
  shared.hpBgGeo.dispose();
  shared.hpFgGeo.dispose();
  shared.shadowGeo.dispose();
  shared.shadowMat.dispose();
}

export abstract class EnemyBase {
  public readonly config: EnemyConfig;
  public readonly group = new THREE.Group();
  public readonly bodyMat: THREE.MeshStandardMaterial;
  public readonly darkMat: THREE.MeshStandardMaterial;
  public readonly visorMat: THREE.MeshBasicMaterial;
  public shieldMat: THREE.MeshStandardMaterial | null = null;
  public generatorMat: THREE.MeshStandardMaterial | null = null;

  public leftLeg: THREE.Mesh | null = null;
  public rightLeg: THREE.Mesh | null = null;
  public rotors: THREE.Mesh[] = [];
  public muzzleOffset = new THREE.Vector3(0.6, 1.45, 0.7);

  public readonly hpBarGroup = new THREE.Group();
  public readonly hpFg: THREE.Mesh;
  public readonly hpFgMat: THREE.MeshBasicMaterial;

  public hp: number;
  public maxHp: number;
  public speed: number;
  public shootTimer: number;
  public strafeDir: number;
  public strafeTimer: number;
  public walkPhase: number;
  public flashTimer = 0;
  public shieldFlashTimer = 0;

  // حقول خاصة بالقناص والدرون والباس
  public aimState: 'idle' | 'aiming' = 'idle';
  public aimTimer = 0;
  public aimTarget = new THREE.Vector3();
  public laserLine: THREE.Line | null = null;
  public hoverHeight = 0;
  public hasSummoned = false;

  // حقول خاصة بالباس
  public bossPhase: 1 | 2 | 3 = 1;
  public bossAttackIdx = 0;
  public slamCharge = 0;

  protected readonly ownDisposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  constructor(config: EnemyConfig, wave: number, shared: EnemySharedGeometries, overrideHp?: number) {
    this.config = config;
    this.bodyMat = this.track(
      new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.42, metalness: 0.44 }),
    );
    this.darkMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65, metalness: 0.35 }),
    );
    this.visorMat = this.track(new THREE.MeshBasicMaterial({ color: config.visor }));

    this.maxHp = overrideHp ?? (config.fixedHp ? config.hp : config.hp + (wave - 1) * 8);
    this.hp = this.maxHp;
    this.speed = config.isBoss ? config.speed : config.speed + Math.min(wave * 0.12, 1.8);
    this.shootTimer = config.isBoss ? 1.8 : 1.0 + Math.random() * 1.4;
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
    this.strafeTimer = 2 + Math.random() * 2;
    this.walkPhase = Math.random() * 6;

    // شريط الصحة العائم فوق الأعداء العاديين
    this.hpBarGroup.position.y = config.flying ? 0.95 : 2.85;
    const hpBgMat = this.track(new THREE.MeshBasicMaterial({ color: 0x0f172a, side: THREE.DoubleSide }));
    this.hpFgMat = this.track(new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide }));
    const hpBg = new THREE.Mesh(shared.hpBgGeo, hpBgMat);
    this.hpFg = new THREE.Mesh(shared.hpFgGeo, this.hpFgMat);
    this.hpFg.position.z = 0.01;
    this.hpBarGroup.add(hpBg, this.hpFg);
    this.hpBarGroup.visible = false;
    this.group.add(this.hpBarGroup);

    // ظل أرضي ناعم لتحسين الالتصاق بالأرض (للوحدات غير الطائرة)
    if (!config.flying) {
      const contactShadow = new THREE.Mesh(shared.shadowGeo, shared.shadowMat);
      contactShadow.position.y = 0.02;
      this.group.add(contactShadow);
    }

    this.buildBody(shared);
    this.group.scale.setScalar(config.scale);
  }

  protected track<T extends THREE.BufferGeometry | THREE.Material>(res: T): T {
    this.ownDisposables.push(res);
    return res;
  }

  protected tagPart(mesh: THREE.Object3D, hitZone: HitZone): void {
    const data: EnemyHitUserData = {
      enemy: this,
      isHead: hitZone === 'head',
      hitZone,
    };
    mesh.userData = data;
  }

  /** بناء جسم الروبوت الأساسي المكون من عدة قطع مميزة */
  protected buildHumanoidBase(shared: EnemySharedGeometries): void {
    this.leftLeg = new THREE.Mesh(shared.legGeo, this.darkMat);
    this.leftLeg.position.set(-0.26, 0.45, 0);
    this.rightLeg = new THREE.Mesh(shared.legGeo, this.darkMat);
    this.rightLeg.position.set(0.26, 0.45, 0);

    const torso = new THREE.Mesh(shared.torsoGeo, this.bodyMat);
    torso.position.y = 1.35;
    torso.castShadow = true;

    const arm = new THREE.Mesh(shared.armGeo, this.darkMat);
    arm.position.set(0.6, 1.45, 0.3);

    const head = new THREE.Mesh(shared.headGeo, this.bodyMat);
    head.position.y = 2.18;
    head.castShadow = true;

    const visor = new THREE.Mesh(shared.visorGeo, this.visorMat);
    visor.position.set(0, 2.2, 0.28);

    this.group.add(this.leftLeg, this.rightLeg, torso, arm, head, visor);
    this.tagPart(this.leftLeg, 'body');
    this.tagPart(this.rightLeg, 'body');
    this.tagPart(torso, 'body');
    this.tagPart(arm, 'body');
    this.tagPart(head, 'head');
    this.tagPart(visor, 'head');
  }

  protected abstract buildBody(shared: EnemySharedGeometries): void;

  /** الموقع العالمي لفوهة سلاح العدو */
  public getMuzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    out.copy(this.muzzleOffset);
    return this.group.localToWorld(out);
  }

  /** تحديث شريط الصحة العائم فوق العدو */
  public refreshHpBar(): void {
    if (this.config.isBoss) return;
    this.hpBarGroup.visible = true;
    const ratio = Math.max(0, this.hp / this.maxHp);
    this.hpFg.scale.x = Math.max(0.001, ratio);
    this.hpFg.position.x = -(1 - ratio) * 0.6;
    this.hpFgMat.color.setHex(ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xfbbf24 : 0xef4444);
  }

  /** إزالة شعاع الليزر التحذيري للقناص عند الموت أو فقدان الرؤية */
  public clearLaser(scene: THREE.Scene): void {
    if (this.laserLine) {
      scene.remove(this.laserLine);
      this.laserLine.geometry.dispose();
      (this.laserLine.material as THREE.Material).dispose();
      this.laserLine = null;
    }
    this.aimState = 'idle';
    this.aimTimer = 0;
  }

  /** تحرير الموارد الخاصة بهذا العدو */
  public dispose(scene: THREE.Scene): void {
    this.clearLaser(scene);
    scene.remove(this.group);
    for (const d of this.ownDisposables) {
      d.dispose();
    }
    this.ownDisposables.length = 0;
  }
}
