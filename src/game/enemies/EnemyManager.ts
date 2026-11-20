import * as THREE from 'three';
import type { BossArchetypeId, EnemyTypeId, RadarEntity } from '../types';
import {
  createEnemySharedGeometries,
  disposeEnemySharedGeometries,
  type EnemyBase,
  type EnemySharedGeometries,
} from './EnemyBase';
import {
  hasLineOfSight,
  updateDroneMovement,
  updateFlyingSniperMovement,
  updateGroundEnemyMovement,
  updateGunshipMovement,
  updateKamikazeMovement,
  updateSwarmDroneMovement,
  updateTurretAim,
} from './EnemyAI';
import { RusherEnemy } from './RusherEnemy';
import { TrooperEnemy } from './TrooperEnemy';
import { HeavyEnemy } from './HeavyEnemy';
import { SniperEnemy } from './SniperEnemy';
import { DroneEnemy } from './DroneEnemy';
import { ShieldedEnemy } from './ShieldedEnemy';
import { MortarEnemy } from './MortarEnemy';
import { JammerEnemy } from './JammerEnemy';
import { GhostEnemy } from './GhostEnemy';
import { GunshipEnemy } from './GunshipEnemy';
import { SwarmDroneEnemy } from './SwarmDroneEnemy';
import { KamikazeDroneEnemy } from './KamikazeDroneEnemy';
import { FlyingSniperEnemy } from './FlyingSniperEnemy';
import { TurretEnemy } from './TurretEnemy';
import type { BossEnemy } from '../boss/Boss';
import { EngineerBoss } from '../boss/EngineerBoss';
import { SwarmQueenBoss } from '../boss/SwarmQueenBoss';
import { ColossusBoss } from '../boss/ColossusBoss';
import { updateBossBehavior } from '../boss/BossAttacks';
import type { MapManager } from '../maps/MapManager';
import type { ObjectPools } from '../pools/ObjectPools';
import type { AudioManager } from '../audio/AudioManager';
import {
  PLAYER_CONSTANTS,
  isBulletHittingPlayerHeight,
  pickBossArchetypeForWave,
  rollEliteAffix,
  stepBurnStatus,
} from '../rules';

/* ==========================================
   مدير الأعداء — يدير توليد جميع الأعداء الأرضيين والطائرين والزعماء الثلاثة
   (المهندس المدرّع، ملكة السرب الطائرة، العملاق الجبار) بحد متوازن،
   بالإضافة للأبراج القتالية، أسراب الدرونات، انقضاض الانتحاري، ليزر القناص، ونبضات EMP
   ========================================== */

export interface MortarShell {
  shellMesh: THREE.Mesh;
  markerGroup: THREE.Group;
  innerFill: THREE.Mesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  elapsed: number;
  duration: number;
  radius: number;
  dmg: number;
}

export interface ShockwaveRing {
  mesh: THREE.Mesh;
  center: THREE.Vector3;
  radius: number;
  maxRadius: number;
  speed: number;
  dmg: number;
  hitPlayer: boolean;
}

export interface EmpPulseRing {
  mesh: THREE.Mesh;
  radius: number;
  maxRadius: number;
  speed: number;
}

export interface EnemySpawnModifiers {
  hpMult?: number;
  speedMult?: number;
}

export interface EnemySpawnOptions {
  bossArchetype?: BossArchetypeId;
  protectsBoss?: boolean;
  isBossSummon?: boolean;
  allowSwarmOverflow?: boolean;
}

export interface EnemyUpdateCallbacks {
  damagePlayer: (amount: number, knockUp?: number) => void;
  addCameraShake: (amount: number) => void;
  notifyFeed: (text: string, isHeadshot?: boolean, isHighlight?: boolean) => void;
  onMinionsSummoned: (count: number) => void;
  onEnemySelfDestruct: (enemy: EnemyBase) => void;
  onEmpHitPlayer: (durationSec: number) => void;
  onBurnDamage: (enemy: EnemyBase, damage: number) => void;
  syncBossHud: (boss: BossEnemy) => void;
}

const _muzzle = new THREE.Vector3();
const _shotDir = new THREE.Vector3();
const _targetVec = new THREE.Vector3();
const _farEnd = new THREE.Vector3();
const _toPlayerVec = new THREE.Vector3();
const _closestPt = new THREE.Vector3();
const _sniperRay = new THREE.Raycaster();
const _tmpPos = new THREE.Vector3();

export class EnemyManager {
  private readonly scene: THREE.Scene;
  private readonly mapManager: MapManager;
  private readonly pools: ObjectPools;
  private readonly audio: AudioManager;
  private readonly sharedGeos: EnemySharedGeometries;
  private readonly mortarShellGeo: THREE.SphereGeometry;

  public readonly enemies: EnemyBase[] = [];
  public readonly mortarShells: MortarShell[] = [];
  public readonly shockwaves: ShockwaveRing[] = [];
  public readonly empRings: EmpPulseRing[] = [];
  public activeBoss: BossEnemy | null = null;

  constructor(
    scene: THREE.Scene,
    mapManager: MapManager,
    pools: ObjectPools,
    audio: AudioManager,
  ) {
    this.scene = scene;
    this.mapManager = mapManager;
    this.pools = pools;
    this.audio = audio;
    this.sharedGeos = createEnemySharedGeometries();
    this.mortarShellGeo = new THREE.SphereGeometry(0.28, 10, 10);
  }

  /** إنشاء مثيل الزعيم المناسب حسب نوعه (المهندس / ملكة السرب / العملاق الجبار) */
  private createBossInstance(wave: number, archetypeOverride?: BossArchetypeId): BossEnemy {
    const archetype = archetypeOverride ?? pickBossArchetypeForWave(wave);
    switch (archetype) {
      case 'engineer':
        return new EngineerBoss(wave, this.sharedGeos);
      case 'swarm_queen':
        return new SwarmQueenBoss(wave, this.sharedGeos);
      case 'colossus':
        return new ColossusBoss(wave, this.sharedGeos);
    }
  }

  /** توليد سرب درونات كامل (6 درونات صغيرة بصحة 15 لكل منها) */
  public spawnSwarmPack(
    wave: number,
    playerPos: THREE.Vector3,
    count: number = PLAYER_CONSTANTS.SWARM_PACK_SIZE,
    customCenter?: { x: number; z: number },
    modifiers?: EnemySpawnModifiers,
    isBossSummon = false,
  ): number {
    const safeLimit = this.mapManager.halfArena - 7;
    let cx = customCenter?.x ?? 0;
    let cz = customCenter?.z ?? 0;

    if (!customCenter) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 28 + Math.random() * Math.min(24, this.mapManager.halfArena * 0.45);
      cx = Math.max(-safeLimit, Math.min(safeLimit, playerPos.x + Math.cos(ang) * dist));
      cz = Math.max(-safeLimit, Math.min(safeLimit, playerPos.z + Math.sin(ang) * dist));
    }

    let spawned = 0;
    for (let i = 0; i < count; i++) {
      const a = (i / Math.max(1, count)) * Math.PI * 2;
      const r = 2.4 + (i % 2) * 1.1;
      const sx = Math.max(-safeLimit, Math.min(safeLimit, cx + Math.cos(a) * r));
      const sz = Math.max(-safeLimit, Math.min(safeLimit, cz + Math.sin(a) * r));
      const unit = this.spawn('swarm_drone', wave, playerPos, { x: sx, z: sz }, modifiers, {
        isBossSummon,
        allowSwarmOverflow: true,
      });
      if (unit) spawned++;
    }
    return spawned;
  }

  /** توليد عدو من النوع المحدد في موقع آمن بعيداً عن اللاعب مع دعم الطائرين والزعماء والنخبة */
  public spawn(
    type: EnemyTypeId,
    wave: number,
    playerPos: THREE.Vector3,
    customPos?: { x: number; z: number },
    modifiers?: EnemySpawnModifiers,
    options?: EnemySpawnOptions,
  ): EnemyBase | null {
    const maxCap = options?.allowSwarmOverflow
      ? PLAYER_CONSTANTS.MAX_ENEMIES + PLAYER_CONSTANTS.SWARM_PACK_SIZE
      : PLAYER_CONSTANTS.MAX_ENEMIES;
    if (type !== 'boss' && this.enemies.length >= maxCap) {
      return null;
    }

    let enemy: EnemyBase;
    switch (type) {
      case 'rusher':
        enemy = new RusherEnemy(wave, this.sharedGeos);
        break;
      case 'trooper':
        enemy = new TrooperEnemy(wave, this.sharedGeos);
        break;
      case 'heavy':
        enemy = new HeavyEnemy(wave, this.sharedGeos);
        break;
      case 'sniper':
        enemy = new SniperEnemy(wave, this.sharedGeos);
        break;
      case 'drone':
        enemy = new DroneEnemy(wave, this.sharedGeos);
        break;
      case 'shielded':
        enemy = new ShieldedEnemy(wave, this.sharedGeos);
        break;
      case 'mortar':
        enemy = new MortarEnemy(wave, this.sharedGeos);
        break;
      case 'jammer':
        enemy = new JammerEnemy(wave, this.sharedGeos);
        break;
      case 'ghost':
        enemy = new GhostEnemy(wave, this.sharedGeos);
        break;
      case 'gunship':
        enemy = new GunshipEnemy(wave, this.sharedGeos);
        break;
      case 'swarm_drone':
        enemy = new SwarmDroneEnemy(wave, this.sharedGeos);
        break;
      case 'kamikaze':
        enemy = new KamikazeDroneEnemy(wave, this.sharedGeos);
        break;
      case 'flying_sniper':
        enemy = new FlyingSniperEnemy(wave, this.sharedGeos);
        break;
      case 'turret':
        enemy = new TurretEnemy(wave, this.sharedGeos);
        break;
      case 'boss': {
        const boss = this.createBossInstance(wave, options?.bossArchetype);
        this.activeBoss = boss;
        enemy = boss;
        break;
      }
    }

    if (options?.isBossSummon) enemy.isBossSummon = true;
    if (options?.protectsBoss) {
      enemy.protectsBoss = true;
      enemy.isBossSummon = true;
      enemy.bodyMat.color.setHex(0x0284c7);
      enemy.visorMat.color.setHex(0x38bdf8);
    }

    // تطبيق معدِّلات الموجة (مثل: أعداء سريعون وهشّون)
    if (modifiers?.hpMult && modifiers.hpMult !== 1) {
      enemy.maxHp = Math.max(10, Math.round(enemy.maxHp * modifiers.hpMult));
      enemy.hp = enemy.maxHp;
    }
    if (modifiers?.speedMult && modifiers.speedMult !== 1) {
      enemy.speed *= modifiers.speedMult;
    }

    // من الموجة 6، لكل عدو غير الباس وغير سرب الدرونات/الأبراج فرصة 15% للتحول إلى نخبة
    const skipElite = !!enemy.config.isBoss || type === 'swarm_drone' || type === 'turret';
    const rolledAffix = rollEliteAffix(wave, skipElite, Math.random(), Math.random());
    if (rolledAffix) {
      enemy.applyEliteVariant(rolledAffix);
    }

    let ex = 0;
    let ez = 0;
    if (customPos) {
      const safeLimit = this.mapManager.halfArena - 5;
      ex = Math.max(-safeLimit, Math.min(safeLimit, customPos.x));
      ez = Math.max(-safeLimit, Math.min(safeLimit, customPos.z));
    } else {
      const safeLimit = this.mapManager.halfArena - 7;
      const isLongRange = type === 'sniper' || type === 'flying_sniper' || type === 'boss';
      const minSpawnDist = isLongRange
        ? Math.min(38, this.mapManager.arenaSize * 0.34)
        : Math.min(26, this.mapManager.arenaSize * 0.24);
      const maxSpawnDist = isLongRange
        ? Math.min(86, this.mapManager.halfArena * 0.94)
        : Math.min(64, this.mapManager.halfArena * 0.92);
      let tries = 0;
      do {
        const ang = Math.random() * Math.PI * 2;
        const dist = minSpawnDist + Math.random() * Math.max(8, maxSpawnDist - minSpawnDist);
        ex = Math.max(-safeLimit, Math.min(safeLimit, playerPos.x + Math.cos(ang) * dist));
        ez = Math.max(-safeLimit, Math.min(safeLimit, playerPos.z + Math.sin(ang) * dist));
        tries++;
        _tmpPos.set(ex, 1, ez);
      } while (
        (Math.hypot(ex - playerPos.x, ez - playerPos.z) < minSpawnDist * 0.85 ||
          (!enemy.config.flying && this.mapManager.isPointInsideObstacle(_tmpPos))) &&
        tries < 45
      );
    }

    const startY = enemy.config.flying
      ? enemy.hoverHeight
      : this.mapManager.getGroundHeight(ex, ez, 0);
    enemy.group.position.set(ex, startY, ez);

    if (!enemy.config.flying) {
      this.mapManager.resolveCollisions(
        enemy.group.position,
        type === 'boss' ? 1.85 : 0.85 * enemy.config.scale,
        enemy.group.position.y,
      );
    }

    this.scene.add(enemy.group);
    this.enemies.push(enemy);
    return enemy;
  }

  /** إزالة عدو محدد وتحرير موارده */
  public removeEnemy(enemy: EnemyBase): void {
    enemy.dispose(this.scene);
    const idx = this.enemies.indexOf(enemy);
    if (idx !== -1) this.enemies.splice(idx, 1);
    if (this.activeBoss === enemy) {
      this.activeBoss = null;
    }
  }

  /** عدّ الدرونات الحامية للباس (المهندس) */
  public countBossShieldDrones(): number {
    let c = 0;
    for (const e of this.enemies) {
      if (e.protectsBoss && e.hp > 0) c++;
    }
    return c;
  }

  /** عدّ الأبراج الآلية النشطة */
  public countBossTurrets(): number {
    let c = 0;
    for (const e of this.enemies) {
      if (e.config.type === 'turret' && e.hp > 0) c++;
    }
    return c;
  }

  /** إطلاق قذيفة هاون أو صاروخ باس مع دائرة تحذير أرضية حمراء */
  public launchGroundMissile(
    origin: THREE.Vector3,
    tx: number,
    tz: number,
    radius: number,
    duration: number,
    dmg: number,
    playerFeetY: number,
  ): void {
    const limit = this.mapManager.halfArena - 3;
    const clampedX = Math.max(-limit, Math.min(limit, tx));
    const clampedZ = Math.max(-limit, Math.min(limit, tz));
    const surfaceY = this.mapManager.getGroundHeight(clampedX, clampedZ, playerFeetY + 1.0);

    const markerGroup = new THREE.Group();
    markerGroup.position.set(clampedX, surfaceY + 0.05, clampedZ);

    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.22, radius, 32),
      new THREE.MeshBasicMaterial({
        color: 0xff1e1e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      }),
    );
    outerRing.rotation.x = -Math.PI / 2;

    const innerFill = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 32),
      new THREE.MeshBasicMaterial({
        color: 0xef4444,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.32,
      }),
    );
    innerFill.rotation.x = -Math.PI / 2;
    innerFill.position.y = 0.01;
    innerFill.scale.setScalar(0.05);

    markerGroup.add(outerRing, innerFill);
    this.scene.add(markerGroup);

    const shellMesh = new THREE.Mesh(
      this.mortarShellGeo,
      new THREE.MeshBasicMaterial({ color: 0xff6b00 }),
    );
    shellMesh.position.copy(origin);
    this.scene.add(shellMesh);

    this.mortarShells.push({
      shellMesh,
      markerGroup,
      innerFill,
      startPos: origin.clone(),
      targetPos: new THREE.Vector3(clampedX, surfaceY + 0.2, clampedZ),
      elapsed: 0,
      duration,
      radius,
      dmg,
    });
  }

  /** توليد موجة صدمة أرضية للباس تُتجنب بالقفز */
  public spawnShockwave(centerPos: THREE.Vector3, dmg: number, addShake: (v: number) => void): void {
    this.audio.play('bossSlam');
    addShake(0.09);
    _tmpPos.set(centerPos.x, 0.4, centerPos.z);
    this.pools.spawnExplosion(_tmpPos, 0xf97316, 28, 14);

    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.16, 10, 44),
      new THREE.MeshBasicMaterial({ color: 0xff3b00, transparent: true, opacity: 0.95 }),
    );
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.set(centerPos.x, 0.35, centerPos.z);
    this.scene.add(ringMesh);

    this.shockwaves.push({
      mesh: ringMesh,
      center: new THREE.Vector3(centerPos.x, 0, centerPos.z),
      radius: 2.0,
      maxRadius: Math.min(54, Math.max(38, this.mapManager.arenaSize * 0.36)),
      speed: 22,
      dmg,
      hitPlayer: false,
    });
  }

  /** توليد حلقة نبضة EMP مرئية ومتوسعة من المشوِّش حتى مدى 18 وحدة */
  private spawnEmpPulse(origin: THREE.Vector3): void {
    this.audio.play('empBlast');
    _tmpPos.set(origin.x, 1.8, origin.z);
    this.pools.spawnExplosion(_tmpPos, 0xc084fc, 18, 11);

    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.12, 10, 40),
      new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.set(origin.x, 1.15, origin.z);
    this.scene.add(ringMesh);

    this.empRings.push({
      mesh: ringMesh,
      radius: 1.0,
      maxRadius: PLAYER_CONSTANTS.JAMMER_EMP_RADIUS,
      speed: 36,
    });
  }

  /** معالجة دورة التصويب بالليزر والإطلاق لكل من القناص الأرضي والقناص الطائر */
  private updateSniperLaserCycle(
    e: EnemyBase,
    dist: number,
    playerPos: THREE.Vector3,
    playerEyeHeight: number,
    dt: number,
    nowMs: number,
    cb: EnemyUpdateCallbacks,
  ): void {
    const isFlying = e.config.type === 'flying_sniper';
    const laserColor = isFlying ? 0xe879f9 : 0xff0033;

    e.getMuzzleWorld(_muzzle);
    if (e.aimState === 'aiming') {
      e.aimTimer -= dt;
      if (!hasLineOfSight(_muzzle, playerPos, this.mapManager.obstacleMeshes)) {
        e.clearLaser(this.scene);
        e.shootTimer = 1.3;
      } else {
        if (e.aimTimer > 0.35) {
          e.aimTarget.lerp(playerPos, Math.min(1, dt * 8));
        }
        if (e.laserLine) {
          const posAttr = e.laserLine.geometry.getAttribute('position') as THREE.BufferAttribute;
          posAttr.setXYZ(0, _muzzle.x, _muzzle.y, _muzzle.z);
          posAttr.setXYZ(1, e.aimTarget.x, e.aimTarget.y, e.aimTarget.z);
          posAttr.needsUpdate = true;
          (e.laserLine.material as THREE.LineBasicMaterial).opacity =
            e.aimTimer <= 0.35 ? 0.65 + Math.sin(nowMs * 0.05) * 0.35 : 0.8;
        }
        if (e.aimTimer <= 0) {
          this.fireEnemyWeapon(e, playerPos, playerEyeHeight, cb);
          e.clearLaser(this.scene);
          e.shootTimer = e.config.fireRate + Math.random() * 0.8;
        }
      }
    } else {
      e.shootTimer -= dt;
      const sniperEngageRange = Math.min(130, Math.max(85, this.mapManager.arenaSize * 0.68));
      if (
        e.shootTimer <= 0 &&
        dist < sniperEngageRange &&
        hasLineOfSight(_muzzle, playerPos, this.mapManager.obstacleMeshes)
      ) {
        e.aimState = 'aiming';
        e.aimTimer = e.config.aimDuration ?? 1.2;
        e.aimTarget.copy(playerPos);
        this.audio.play('sniperWarn');

        const lGeo = new THREE.BufferGeometry().setFromPoints([_muzzle.clone(), e.aimTarget.clone()]);
        const lMat = new THREE.LineBasicMaterial({ color: laserColor, transparent: true, opacity: 0.85 });
        e.laserLine = new THREE.Line(lGeo, lMat);
        this.scene.add(e.laserLine);
      }
    }
  }

  private fireEnemyWeapon(
    enemy: EnemyBase,
    playerPos: THREE.Vector3,
    playerEyeHeight: number,
    cb: EnemyUpdateCallbacks,
  ): void {
    // كشف الشبح بالكامل لمدة ثانيتين بمجرد إطلاق النار
    if (enemy.config.type === 'ghost') {
      enemy.reveal(PLAYER_CONSTANTS.GHOST_REVEAL_DURATION);
    }

    enemy.getMuzzleWorld(_muzzle);

    if (enemy.config.type === 'sniper' || enemy.config.type === 'flying_sniper') {
      this.audio.play('sniperEnemyShot');
      const isFlying = enemy.config.type === 'flying_sniper';
      _shotDir.subVectors(enemy.aimTarget, _muzzle).normalize();
      const sniperMaxDist = Math.max(160, this.mapManager.arenaSize * 1.2);
      _farEnd.copy(_muzzle).addScaledVector(_shotDir, sniperMaxDist);

      _sniperRay.set(_muzzle, _shotDir);
      _sniperRay.near = 0.1;
      _sniperRay.far = sniperMaxDist;
      const wallHits = _sniperRay.intersectObjects(this.mapManager.obstacleMeshes, false);

      let maxHitDist = sniperMaxDist;
      if (wallHits.length > 0) {
        _farEnd.copy(wallHits[0].point);
        maxHitDist = wallHits[0].distance;
        this.pools.spawnExplosion(_farEnd, isFlying ? 0xe879f9 : 0xff0033, 6, 6);
      }

      _toPlayerVec.subVectors(playerPos, _muzzle);
      const proj = _toPlayerVec.dot(_shotDir);
      if (proj > 0 && proj < maxHitDist) {
        _closestPt.copy(_muzzle).addScaledVector(_shotDir, proj);
        const horizDist = Math.hypot(_closestPt.x - playerPos.x, _closestPt.z - playerPos.z);
        if (horizDist < 0.88 && isBulletHittingPlayerHeight(_closestPt.y, playerPos.y, playerEyeHeight)) {
          cb.damagePlayer(enemy.config.dmg);
          _farEnd.copy(_closestPt);
        }
      }

      this.pools.spawnTracer(_muzzle, _farEnd, isFlying ? 0xe879f9 : 0xff1e42, 0.28, 1.0);
      return;
    }

    if (enemy.config.type === 'mortar') {
      this.audio.play('mortarLaunch');
      this.launchGroundMissile(
        _muzzle,
        playerPos.x,
        playerPos.z,
        enemy.config.blastRadius ?? 4.0,
        enemy.config.warningTime ?? 1.5,
        enemy.config.dmg,
        playerPos.y - playerEyeHeight,
      );
      return;
    }

    // الأعداء الطائرون والأرضيون والأبراج يطلقون طلقات مجمعة عبر ObjectPools
    this.audio.play('enemyShoot');
    const spreadXZ = enemy.config.type === 'gunship' ? 1.35 : enemy.config.type === 'swarm_drone' ? 1.2 : 1.0;
    const bulletSpeed = enemy.config.type === 'gunship' ? 32 : enemy.config.type === 'turret' ? 30 : 26;
    const bulletScale = enemy.config.type === 'gunship' ? 1.25 : enemy.config.type === 'swarm_drone' ? 0.82 : 1.0;

    _targetVec.set(
      playerPos.x + (Math.random() - 0.5) * spreadXZ,
      playerPos.y + (Math.random() - 0.5) * 0.35 - (enemy.config.flying ? 0.22 : 0.1),
      playerPos.z + (Math.random() - 0.5) * spreadXZ,
    );
    _shotDir.subVectors(_targetVec, _muzzle).normalize().multiplyScalar(bulletSpeed);
    this.pools.spawnEnemyBullet(
      _muzzle,
      _shotDir,
      enemy.config.dmg,
      enemy.config.visor,
      bulletScale,
      4.8,
    );
  }

  /** تحديث جميع الأعداء (الأرضيين والطائرين) والزعيم والقذائف وموجات الصدمة كل إطار */
  public update(
    dt: number,
    nowMs: number,
    wave: number,
    playerPos: THREE.Vector3,
    playerEyeHeight: number,
    cb: EnemyUpdateCallbacks,
    spawnModifiers?: EnemySpawnModifiers,
  ): void {
    const playerFeetY = playerPos.y - playerEyeHeight;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e) continue;

      // تحديث وميض الإصابة والدرع والمولد
      if (e.flashTimer > 0) {
        e.flashTimer -= dt;
        if (e.flashTimer <= 0) {
          const baseEmissive =
            e.config.isBoss && e.bossPhase === 3
              ? 0x450a0a
              : e.config.type === 'ghost'
                ? 0x0e7490
                : 0x000000;
          e.bodyMat.emissive.setHex(baseEmissive);
        }
      }
      if (e.shieldFlashTimer > 0) {
        e.shieldFlashTimer -= dt;
        if (e.shieldFlashTimer <= 0 && e.shieldMat) {
          e.shieldMat.opacity = e.config.isBoss ? 0.28 : 0.48;
        }
      }
      if (e.generatorMat && !e.config.isBoss) {
        e.generatorMat.emissiveIntensity = 1.0 + Math.sin(nowMs * 0.008) * 0.45;
      }

      // تجدد الصحة لأعداء النخبة ذوي صفة "متجدد" (3 نقطة صحة / ثانية)
      if (e.eliteAffix === 'regenerating' && e.hp > 0 && e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + PLAYER_CONSTANTS.ELITE_REGEN_PER_SEC * dt);
        if (e.hpBarGroup.visible) {
          e.refreshHpBar();
        }
      }

      // تحديث حالة الاحتراق المستمر (8 ضرر/ث لمدة 3 ثوانٍ + كشف الشبح المحترق + جمر مجمع)
      if (e.burnTimer > 0) {
        const burnStep = stepBurnStatus(e.burnTimer, dt, PLAYER_CONSTANTS.BURN_DPS);
        e.burnTimer = burnStep.nextTimer;

        if (e.config.type === 'ghost') {
          e.reveal(0.28);
        }

        if (e.flashTimer <= 0) {
          if (burnStep.burning) {
            const flicker = 0.55 + Math.sin(nowMs * 0.03) * 0.25;
            e.bodyMat.emissive.setRGB(flicker, flicker * 0.28, 0.02);
          } else {
            const baseEmissive =
              e.config.isBoss && e.bossPhase === 3
                ? 0x450a0a
                : e.config.type === 'ghost'
                  ? 0x0e7490
                  : 0x000000;
            e.bodyMat.emissive.setHex(baseEmissive);
          }
        }

        e.burnEmberTimer -= dt;
        if (e.burnEmberTimer <= 0) {
          e.burnEmberTimer = 0.16;
          _tmpPos.copy(e.group.position);
          if (!e.config.flying) _tmpPos.y += 1.0 * e.config.scale;
          this.pools.spawnBurnEmber(_tmpPos);
        }

        if (burnStep.damage > 0) {
          cb.onBurnDamage(e, burnStep.damage);
          if (e.hp <= 0) {
            continue;
          }
        }
      }

      // تحديث الشفافية والكشف للشبح
      if (e.config.type === 'ghost') {
        e.updateStealthVisual(dt, nowMs);
      }

      // 1. سلوك الزعيم (المهندس / ملكة السرب / العملاق الجبار)
      if (e.config.isBoss) {
        const boss = e as BossEnemy;
        updateBossBehavior(
          boss,
          playerPos,
          playerFeetY,
          this.mapManager,
          this.pools,
          this.audio,
          dt,
          nowMs,
          {
            launchGroundMissile: (origin, tx, tz, rad, dur, dmg) =>
              this.launchGroundMissile(origin, tx, tz, rad, dur, dmg, playerFeetY),
            spawnShockwave: (center, dmg) => this.spawnShockwave(center, dmg, cb.addCameraShake),
            summonBossUnit: (b, unitType, count, opts) => {
              let spawned = 0;
              const radius = opts?.radius ?? 5.5;
              if (unitType === 'swarm_drone') {
                spawned = this.spawnSwarmPack(
                  wave,
                  playerPos,
                  count,
                  { x: b.group.position.x, z: b.group.position.z },
                  spawnModifiers,
                  true,
                );
              } else {
                for (let m = 0; m < count; m++) {
                  const ang = (m / Math.max(1, count)) * Math.PI * 2 + Math.random() * 0.4;
                  const sx = b.group.position.x + Math.cos(ang) * radius;
                  const sz = b.group.position.z + Math.sin(ang) * radius;
                  if (
                    this.spawn(unitType, wave, playerPos, { x: sx, z: sz }, spawnModifiers, {
                      protectsBoss: opts?.protectsBoss,
                      isBossSummon: true,
                    })
                  ) {
                    spawned++;
                  }
                }
              }
              if (spawned > 0) {
                cb.onMinionsSummoned(spawned);
              }
              return spawned;
            },
            countBossShieldDrones: () => this.countBossShieldDrones(),
            countBossTurrets: () => this.countBossTurrets(),
            damagePlayer: cb.damagePlayer,
            notifyFeed: cb.notifyFeed,
            syncBossHud: cb.syncBossHud,
            activeEnemyCount: () => this.enemies.length,
          },
        );
        continue;
      }

      // 2. سلوك البرج القتالي الآلي (المهندس)
      if (e.config.type === 'turret') {
        const dist = updateTurretAim(e, playerPos);
        e.getMuzzleWorld(_muzzle);
        if (dist < 58 && hasLineOfSight(_muzzle, playerPos, this.mapManager.obstacleMeshes)) {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            this.fireEnemyWeapon(e, playerPos, playerEyeHeight, cb);
            e.shootTimer = e.config.fireRate + Math.random() * 0.35;
          }
        }
        continue;
      }

      // 3. سلوك المدفعية الطائرة (Gunship — جولات التفاف ورشقات متتالية)
      if (e.config.type === 'gunship') {
        const dist = updateGunshipMovement(e, playerPos, this.mapManager, dt, nowMs);
        if (e.burstRemaining > 0) {
          e.burstDelay -= dt;
          if (e.burstDelay <= 0) {
            this.fireEnemyWeapon(e, playerPos, playerEyeHeight, cb);
            e.burstRemaining--;
            e.burstDelay = 0.13;
          }
        } else if (dist < Math.min(72, Math.max(54, this.mapManager.arenaSize * 0.42))) {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            e.burstRemaining = 4;
            e.burstDelay = 0;
            e.shootTimer = e.config.fireRate + Math.random() * 0.7;
          }
        }
        continue;
      }

      // 4. سلوك درون السرب الصغير (Swarm Drone)
      if (e.config.type === 'swarm_drone') {
        const dist = updateSwarmDroneMovement(e, playerPos, this.mapManager, dt, nowMs);
        if (dist < 42) {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            this.fireEnemyWeapon(e, playerPos, playerEyeHeight, cb);
            e.shootTimer = e.config.fireRate + Math.random() * 0.9;
          }
        }
        continue;
      }

      // 5. سلوك الدرون الانتحاري (Kamikaze — ينقض وينفجر)
      if (e.config.type === 'kamikaze') {
        const { dist3D, startedDive, shouldDetonate } = updateKamikazeMovement(
          e,
          playerPos,
          this.mapManager,
          dt,
          nowMs,
        );
        if (e instanceof KamikazeDroneEnemy) {
          e.warheadMat.emissiveIntensity = e.isDiving
            ? 2.2 + Math.sin(nowMs * 0.04) * 1.1
            : 1.0 + Math.sin(nowMs * 0.01) * 0.35;
        }
        if (startedDive) {
          this.audio.play('sniperWarn');
          cb.notifyFeed('💣 تحذير: درون انتحاري ينقض نحوك!', true, true);
        }
        if (shouldDetonate) {
          const blastPos = e.group.position.clone();
          const blastRad = e.config.blastRadius ?? PLAYER_CONSTANTS.KAMIKAZE_BLAST_RADIUS;
          this.audio.play('grenadeBoom');
          this.pools.spawnExplosion(blastPos, 0xff3b30, 26, 15);
          this.pools.spawnExplosion(blastPos, 0xfef08a, 14, 11);
          cb.addCameraShake(0.075);
          if (dist3D <= blastRad) {
            const falloff = 1 - 0.45 * (dist3D / blastRad);
            cb.damagePlayer(Math.round(e.config.dmg * falloff), 3.2);
          }
          this.removeEnemy(e);
          cb.onEnemySelfDestruct(e);
        }
        continue;
      }

      // 6. سلوك القناص الطائر (Flying Sniper — تحليق بعيد وليزر تحذيري)
      if (e.config.type === 'flying_sniper') {
        const dist = updateFlyingSniperMovement(e, playerPos, this.mapManager, dt, nowMs);
        this.updateSniperLaserCycle(e, dist, playerPos, playerEyeHeight, dt, nowMs, cb);
        continue;
      }

      // 7. سلوك درون الاستطلاع (و درونات درع المهندس)
      if (e.config.type === 'drone') {
        const orbitAnchor = e.protectsBoss && this.activeBoss ? this.activeBoss.group.position : undefined;
        const dist = updateDroneMovement(e, playerPos, this.mapManager, dt, nowMs, orbitAnchor);
        if (!e.protectsBoss && !e.hasSummoned && dist < 52 && this.enemies.length < PLAYER_CONSTANTS.MAX_ENEMIES) {
          if (hasLineOfSight(e.group.position, playerPos, this.mapManager.obstacleMeshes)) {
            e.hasSummoned = true;
            this.audio.play('droneAlert');
            let summoned = 0;
            for (let s = 0; s < 2 && this.enemies.length < PLAYER_CONSTANTS.MAX_ENEMIES; s++) {
              const ang = Math.random() * Math.PI * 2;
              const sx = e.group.position.x + Math.cos(ang) * 3.5;
              const sz = e.group.position.z + Math.sin(ang) * 3.5;
              if (this.spawn('rusher', wave, playerPos, { x: sx, z: sz }, spawnModifiers)) {
                summoned++;
              }
            }
            if (summoned > 0) {
              cb.onMinionsSummoned(summoned);
              cb.notifyFeed(`📡 درون استطلاع رصدك واستدعى ${summoned} مقتحم!`, true);
            }
          }
        }
        const droneMaxRange = Math.min(62, Math.max(48, this.mapManager.arenaSize * 0.36));
        if (dist < droneMaxRange) {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            this.fireEnemyWeapon(e, playerPos, playerEyeHeight, cb);
            e.shootTimer = e.config.fireRate + Math.random() * 0.7;
          }
        }
        continue;
      }

      // 8. سلوك الأعداء الأرضيين
      const { dist, dirX, dirZ } = updateGroundEnemyMovement(e, playerPos, this.mapManager, dt);

      // دورة نبضة الـ EMP لعدو المشوِّش (كل 8 ثوانٍ مع صوت تحذير وحلقة شحن قبل ثانية)
      if (e.config.type === 'jammer') {
        if (e.empWarningTimer > 0) {
          e.empWarningTimer -= dt;
          const prog = 1 - Math.max(0, e.empWarningTimer) / PLAYER_CONSTANTS.JAMMER_EMP_WARNING;
          if (e.empCoilMat) {
            e.empCoilMat.emissiveIntensity = 1.6 + Math.sin(nowMs * 0.04) * 1.1;
          }
          if (e.empChargeRing) {
            e.empChargeRing.visible = true;
            e.empChargeRing.scale.setScalar(1 + prog * 2.4);
          }
          if (e.empWarningTimer <= 0) {
            if (e.empChargeRing) {
              e.empChargeRing.visible = false;
              e.empChargeRing.scale.setScalar(1);
            }
            if (e.empCoilMat) {
              e.empCoilMat.emissiveIntensity = 0.9;
            }
            this.spawnEmpPulse(e.group.position);
            const horizDist = Math.hypot(
              playerPos.x - e.group.position.x,
              playerPos.z - e.group.position.z,
            );
            if (horizDist <= PLAYER_CONSTANTS.JAMMER_EMP_RADIUS) {
              cb.onEmpHitPlayer(PLAYER_CONSTANTS.JAMMER_EMP_DISABLE_DURATION);
              cb.addCameraShake(0.055);
            }
            e.empCooldown = PLAYER_CONSTANTS.JAMMER_EMP_INTERVAL;
          }
        } else {
          if (e.empCoilMat) {
            e.empCoilMat.emissiveIntensity = 0.8 + Math.sin(nowMs * 0.006) * 0.3;
          }
          e.empCooldown -= dt;
          if (e.empCooldown <= 0) {
            e.empWarningTimer = PLAYER_CONSTANTS.JAMMER_EMP_WARNING;
            this.audio.play('empWarn');
          }
        }
      }

      if (e.config.type === 'sniper') {
        this.updateSniperLaserCycle(e, dist, playerPos, playerEyeHeight, dt, nowMs, cb);
        continue;
      }

      // اشتباك قريب أو إطلاق نار
      if (dist < 1.9 * e.config.scale && Math.abs(playerFeetY - e.group.position.y) < 1.6) {
        cb.damagePlayer(e.config.dmg);
        e.group.position.x -= dirX * 1.6;
        e.group.position.z -= dirZ * 1.6;
      } else if (e.config.shoots) {
        const maxRange =
          e.config.type === 'mortar'
            ? Math.min(102, Math.max(85, this.mapManager.arenaSize * 0.56))
            : Math.min(66, Math.max(54, this.mapManager.arenaSize * 0.38));
        if (dist < maxRange) {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            this.fireEnemyWeapon(e, playerPos, playerEyeHeight, cb);
            e.shootTimer = e.config.fireRate + Math.random() * 0.6;
          }
        }
      }
    }

    // تحديث حلقات نبضة الـ EMP المتوسعة للمشوِّش
    for (let i = this.empRings.length - 1; i >= 0; i--) {
      const ring = this.empRings[i];
      ring.radius += ring.speed * dt;
      ring.mesh.scale.set(ring.radius, ring.radius, 1);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        (1 - ring.radius / ring.maxRadius) * 0.95,
      );

      if (ring.radius >= ring.maxRadius) {
        this.scene.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        (ring.mesh.material as THREE.Material).dispose();
        this.empRings.splice(i, 1);
      }
    }

    // تحديث موجات الصدمة الأرضية للباس
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.speed * dt;
      sw.mesh.scale.set(sw.radius, sw.radius, 1);
      (sw.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - sw.radius / sw.maxRadius);

      if (!sw.hitPlayer) {
        const pDist = Math.hypot(playerPos.x - sw.center.x, playerPos.z - sw.center.z);
        if (Math.abs(pDist - sw.radius) < 1.35 && playerFeetY < 0.85) {
          sw.hitPlayer = true;
          cb.damagePlayer(sw.dmg, 5.5);
        }
      }

      if (sw.radius >= sw.maxRadius) {
        this.scene.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        (sw.mesh.material as THREE.Material).dispose();
        this.shockwaves.splice(i, 1);
      }
    }

    // تحديث قذائف الهاون وصواريخ الباس المقوسة
    for (let i = this.mortarShells.length - 1; i >= 0; i--) {
      const m = this.mortarShells[i];
      m.elapsed += dt;
      const t = Math.min(1, m.elapsed / m.duration);

      m.shellMesh.position.lerpVectors(m.startPos, m.targetPos, t);
      m.shellMesh.position.y += Math.sin(t * Math.PI) * 14.5;

      m.innerFill.scale.setScalar(0.05 + t * 0.95);
      (m.innerFill.material as THREE.MeshBasicMaterial).opacity = 0.22 + t * 0.35;

      if (t >= 1) {
        this.audio.play('mortarBoom');
        this.pools.spawnExplosion(m.targetPos, 0xff5500, 26, 14);
        this.pools.spawnExplosion(m.targetPos, 0xfef08a, 12, 9);

        const blastDist = Math.hypot(playerPos.x - m.targetPos.x, playerPos.z - m.targetPos.z);
        const verticalDiff = Math.abs(playerFeetY - m.targetPos.y);
        if (blastDist <= m.radius && verticalDiff < 3.6) {
          cb.damagePlayer(m.dmg);
        } else if (blastDist < 14) {
          cb.addCameraShake(0.03 * (1 - blastDist / 14));
        }

        this.disposeMortar(m);
        this.mortarShells.splice(i, 1);
      }
    }
  }

  private disposeMortar(m: MortarShell): void {
    this.scene.remove(m.shellMesh);
    (m.shellMesh.material as THREE.Material).dispose();
    this.scene.remove(m.markerGroup);
    m.markerGroup.traverse((ch) => {
      if ((ch as THREE.Mesh).isMesh) {
        const mesh = ch as THREE.Mesh;
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
  }

  /** جمع نقاط الأعداء (الأرضيين والطائرين والأبراج والزعماء) وقذائف الهاون للرادار */
  public collectRadarEntities(out: RadarEntity[]): void {
    for (const m of this.mortarShells) {
      out.push({
        x: m.targetPos.x,
        z: m.targetPos.z,
        color: 'rgba(239, 68, 68, 0.85)',
        kind: 'mortar',
        radius: m.radius,
      });
    }
    for (const e of this.enemies) {
      if (e.config.hiddenFromRadar) continue;
      let kind: RadarEntity['kind'] = 'enemy';
      if (e.config.type === 'boss') {
        kind = e.config.flying ? 'boss_flying' : 'boss';
      } else if (e.config.type === 'gunship' || e.config.type === 'kamikaze' || e.config.type === 'flying_sniper') {
        kind = 'flying';
      } else if (e.config.type === 'drone' || e.config.type === 'swarm_drone') {
        kind = 'drone';
      } else if (e.config.type === 'turret') {
        kind = 'turret';
      } else if (e.config.type === 'heavy' || e.config.type === 'shielded') {
        kind = 'heavy';
      }

      out.push({
        x: e.group.position.x,
        z: e.group.position.z,
        color: e.config.radarColor,
        kind,
      });
    }
  }

  /** تنظيف كل الأعداء والقذائف وموجات الصدمة وحلقات الـ EMP عند إعادة البدء */
  public clearAll(): void {
    for (const e of [...this.enemies]) {
      e.dispose(this.scene);
    }
    this.enemies.length = 0;
    this.activeBoss = null;

    for (const m of this.mortarShells) {
      this.disposeMortar(m);
    }
    this.mortarShells.length = 0;

    for (const sw of this.shockwaves) {
      this.scene.remove(sw.mesh);
      sw.mesh.geometry.dispose();
      (sw.mesh.material as THREE.Material).dispose();
    }
    this.shockwaves.length = 0;

    for (const ring of this.empRings) {
      this.scene.remove(ring.mesh);
      ring.mesh.geometry.dispose();
      (ring.mesh.material as THREE.Material).dispose();
    }
    this.empRings.length = 0;
  }

  public dispose(): void {
    this.clearAll();
    disposeEnemySharedGeometries(this.sharedGeos);
    this.mortarShellGeo.dispose();
  }
}
