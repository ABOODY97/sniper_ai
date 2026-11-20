import * as THREE from 'three';
import type { EliteAffixId, EnemyTypeId, HitZone } from '../types';
import { ELITE_AFFIXES, PLAYER_CONSTANTS } from '../rules';

/* ==========================================
   الفئة الأساسية للأعداء والنماذج ثلاثية الأبعاد والظلال الأرضية
   ودعم أعداء النخبة (توهج محيطي + اسم الصفة فوق العدو) والتخفي والتشويش
   ========================================== */

export interface EnemyConfig {
  type: EnemyTypeId;
  name: string;
  hp: number;
  fixedHp?: boolean;
  instantHeadshotKill?: boolean;
  flying?: boolean;
  isBoss?: boolean;
  hiddenFromRadar?: boolean;
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

/** دالة فارغة لمنع التقاط أشعة التصويب من الطبقات التجميلية (شريط الصحة، الهالة، اسم النخبة) */
const noopRaycast = (): void => {
  /* تجاهل أشعة التصويب */
};

export abstract class EnemyBase {
  public readonly config: EnemyConfig;
  public readonly group = new THREE.Group();
  public readonly bodyMat: THREE.MeshStandardMaterial;
  public readonly darkMat: THREE.MeshStandardMaterial;
  public readonly visorMat: THREE.MeshBasicMaterial;
  public shieldMat: THREE.MeshStandardMaterial | null = null;
  public generatorMat: THREE.MeshStandardMaterial | null = null;
  public contactShadow: THREE.Mesh | null = null;

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

  // حقول خاصة بالمشوِّش (Jammer)
  public empCooldown = 0;
  public empWarningTimer = 0;
  public empCoilMat: THREE.MeshStandardMaterial | null = null;
  public empChargeRing: THREE.Mesh | null = null;

  // حقول خاصة بالشبح (Ghost)
  public revealTimer = 0;

  // حقول خاصة بأعداء النخبة (Elite Variants)
  public eliteAffix: EliteAffixId | null = null;
  public affixLabelSprite: THREE.Sprite | null = null;

  // حقول خاصة بالباس
  public bossPhase: 1 | 2 | 3 = 1;
  public bossAttackIdx = 0;
  public slamCharge = 0;

  protected readonly ownDisposables: Array<THREE.BufferGeometry | THREE.Material | THREE.Texture> = [];

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
    hpBg.raycast = noopRaycast;
    this.hpFg = new THREE.Mesh(shared.hpFgGeo, this.hpFgMat);
    this.hpFg.position.z = 0.01;
    this.hpFg.raycast = noopRaycast;
    this.hpBarGroup.add(hpBg, this.hpFg);
    this.hpBarGroup.visible = false;
    this.group.add(this.hpBarGroup);

    // ظل أرضي ناعم لتحسين الالتصاق بالأرض (للوحدات غير الطائرة)
    if (!config.flying) {
      const contactShadow = new THREE.Mesh(shared.shadowGeo, shared.shadowMat);
      contactShadow.position.y = 0.02;
      contactShadow.raycast = noopRaycast;
      this.contactShadow = contactShadow;
      this.group.add(contactShadow);
    }

    this.buildBody(shared);
    this.group.scale.setScalar(config.scale);
  }

  protected track<T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(res: T): T {
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

  /** تطبيق ترقية النخبة (توهج محيطي + اسم الصفة فوق العدو + تعديل السرعة) */
  public applyEliteVariant(affix: EliteAffixId): void {
    this.eliteAffix = affix;
    const meta = ELITE_AFFIXES[affix];

    if (affix === 'swift') {
      this.speed *= PLAYER_CONSTANTS.ELITE_SPEED_MULT;
    }

    // إضافة غلاف متوهج محيط بجميع أجزاء العدو (BackSide Outline) دون اعتراض أشعة التصويب
    const outlineMat = this.track(
      new THREE.MeshBasicMaterial({
        color: meta.colorHex,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      }),
    );

    const bodyMeshes: THREE.Mesh[] = [];
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && (obj.userData as EnemyHitUserData | undefined)?.enemy === this) {
        bodyMeshes.push(obj as THREE.Mesh);
      }
    });

    for (const mesh of bodyMeshes) {
      const outline = new THREE.Mesh(mesh.geometry, outlineMat);
      outline.scale.setScalar(1.1);
      outline.raycast = noopRaycast;
      mesh.add(outline);
    }

    // اسم الصفة بالعربية كبطاقة عائمة فوق العدو
    const labelSprite = this.createAffixSprite(`★ نخبة · ${meta.name}`, meta.color);
    if (labelSprite) {
      labelSprite.position.set(0, this.config.flying ? 1.55 : 3.35, 0);
      this.affixLabelSprite = labelSprite;
      this.group.add(labelSprite);
    }
  }

  /** إنشاء بطاقة نصية عربية فوق العدو لعرض صفة النخبة */
  private createAffixSprite(text: string, borderColor: string): THREE.Sprite | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.86)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 6;

    const pad = 10;
    const w = canvas.width - pad * 2;
    const h = canvas.height - pad * 2;
    const r = 18;
    ctx.beginPath();
    ctx.moveTo(pad + r, pad);
    ctx.lineTo(pad + w - r, pad);
    ctx.quadraticCurveTo(pad + w, pad, pad + w, pad + r);
    ctx.lineTo(pad + w, pad + h - r);
    ctx.quadraticCurveTo(pad + w, pad + h, pad + w - r, pad + h);
    ctx.lineTo(pad + r, pad + h);
    ctx.quadraticCurveTo(pad, pad + h, pad, pad + h - r);
    ctx.lineTo(pad, pad + r);
    ctx.quadraticCurveTo(pad, pad, pad + r, pad);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 34px Cairo, Tajawal, sans-serif';
    ctx.fillStyle = borderColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);

    const tex = this.track(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = this.track(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      }),
    );
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.55, 0.48, 1);
    sprite.raycast = noopRaycast;
    return sprite;
  }

  /** كشف الشبح بالكامل لمدة محددة عند إطلاق النار أو تلقي إصابة */
  public reveal(duration: number = PLAYER_CONSTANTS.GHOST_REVEAL_DURATION): void {
    this.revealTimer = Math.max(this.revealTimer, duration);
  }

  /** تحديث شفافية الشبح (يُعاد تعريفها في GhostEnemy) */
  public updateStealthVisual(_dt: number, _nowMs: number): void {
    // لا تأثير للأعداء العاديين
  }

  /** حساب النقاط المستحقة عند قتل العدو (مع مكافأة النخبة +50%) */
  public getScoreValue(): number {
    return this.eliteAffix ? Math.round(this.config.score * 1.5) : this.config.score;
  }

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
