import * as THREE from 'three';
import type { BossArchetypeId } from '../types';
import { EnemyBase, type EnemyConfig, type EnemySharedGeometries } from '../enemies/EnemyBase';
import { computeBossMaxHp, computeBossPhase, getBossArchetypeMeta } from '../rules';

/* ==========================================
   الفئة الأساسية للزعماء (BossEnemy)
   ترث منها الزعماء الثلاثة (المهندس، ملكة السرب، العملاق الجبار)
   وتدير المراحل الثلاث (1-3)، وتدرّج الصحة، وبيانات شريط الباس
   ========================================== */

export interface BossSpawnScaleOptions {
  overrideMaxHp?: number;
  overrideTier?: number;
  damageScale?: number;
}

export abstract class BossEnemy extends EnemyBase {
  public readonly tier: number;
  public readonly archetype: BossArchetypeId;
  public readonly subtitle: string;
  public readonly bannerColor: string;
  public readonly damageScale: number;
  protected readonly phase3ColorHex: number;

  constructor(
    archetype: BossArchetypeId,
    wave: number,
    shared: EnemySharedGeometries,
    overrides: Partial<EnemyConfig> & { phase3ColorHex?: number } = {},
    scaleOpts?: BossSpawnScaleOptions,
  ) {
    const meta = getBossArchetypeMeta(archetype);
    const maxHp = scaleOpts?.overrideMaxHp ?? computeBossMaxHp(wave, archetype);
    const { phase3ColorHex, ...cfgOverrides } = overrides;

    super(
      {
        type: 'boss',
        name: meta.name,
        hp: maxHp,
        isBoss: true,
        speed: 3.6,
        color: 0x7f1d1d,
        visor: 0xfde047,
        radarColor: '#ff0040',
        scale: 2.3,
        shoots: true,
        fireRate: 2.5,
        dmg: 18,
        score: 1200,
        ...cfgOverrides,
      },
      wave,
      shared,
      maxHp,
    );

    this.tier = scaleOpts?.overrideTier ?? Math.max(1, Math.floor(wave / 5));
    this.archetype = archetype;
    this.subtitle = meta.subtitle;
    this.bannerColor = meta.bannerColor;
    this.damageScale = scaleOpts?.damageScale ?? 1.0;
    this.phase3ColorHex = phase3ColorHex ?? 0xb91c1c;
  }

  public getHudName(): string {
    return `${this.config.name} Mk-${this.tier}`;
  }

  public getHudSubtitle(): string {
    if (this.bossShieldActive) {
      return '🛡️ درع الدرونات نشط — دمّر الدرونات الحامية لكسر الدرع!';
    }
    return this.subtitle;
  }

  public getPhaseTransitionMessage(newPhase: 2 | 3): { banner: string; feed: string } {
    if (newPhase === 2) {
      return {
        banner: `⚠️ المرحلة 2/3: ${this.config.name} يصعّد هجماته!`,
        feed: `🔥 ${this.config.name} دخل المرحلة 2/3 — وتيرة هجوم أسرع!`,
      };
    }
    return {
      banner: `☠️ المرحلة الأخيرة 3/3: ${this.config.name} في أقصى غضب!`,
      feed: `☠️ ${this.config.name} دخل المرحلة 3/3 — احذر الهجمات المكثفة!`,
    };
  }

  /** تحديث حالة الدرع المرئي للباس (مثل درع الدرونات لدى المهندس) */
  public setBossShieldActive(active: boolean): void {
    this.bossShieldActive = active;
    if (this.bossShieldMesh) {
      this.bossShieldMesh.visible = active;
    }
  }

  /** فحص الانتقال إلى المرحلة 2 أو 3 بناءً على الصحة المتبقية */
  public evaluatePhaseTransition(): { changed: boolean; newPhase: 1 | 2 | 3 } {
    const nextPhase = computeBossPhase(this.hp, this.maxHp);
    if (nextPhase > this.bossPhase) {
      this.bossPhase = nextPhase;
      if (nextPhase === 2) {
        this.speed *= 1.22;
      } else if (nextPhase === 3) {
        this.speed *= 1.25;
        this.bodyMat.color.setHex(this.phase3ColorHex);
      }
      return { changed: true, newPhase: nextPhase };
    }
    return { changed: false, newPhase: this.bossPhase };
  }
}
