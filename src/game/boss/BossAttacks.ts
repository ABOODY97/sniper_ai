import * as THREE from 'three';
import type { EnemyTypeId } from '../types';
import type { BossEnemy } from './Boss';
import type { MapManager } from '../maps/MapManager';
import type { ObjectPools } from '../pools/ObjectPools';
import type { AudioManager } from '../audio/AudioManager';
import { PLAYER_CONSTANTS } from '../rules';

/* ==========================================
   هجمات وحركة الزعماء الثلاثة عبر 3 مراحل:
   - المهندس المدرّع: أبراج قتالية قابلة للتدمير، درع درونات، صواريخ، وبلازما
   - ملكة السرب الطائرة: تحليق عالٍ، استدعاء أسراب درونات وانتحاريين، قصف جوي، ووابل إبر طاقة
   - العملاق الجبار: ضربات أرضية بموجات صدمة (مزدوجة في المرحلة 3)، مدفعية ثقيلة، ووابل مزدوج
   ========================================== */

export interface BossAttackCallbacks {
  launchGroundMissile: (
    origin: THREE.Vector3,
    tx: number,
    tz: number,
    radius: number,
    duration: number,
    dmg: number,
  ) => void;
  spawnShockwave: (center: THREE.Vector3, dmg: number) => void;
  summonBossUnit: (
    boss: BossEnemy,
    type: Exclude<EnemyTypeId, 'boss'>,
    count: number,
    options?: { protectsBoss?: boolean; radius?: number },
  ) => number;
  countBossShieldDrones: () => number;
  countBossTurrets: () => number;
  damagePlayer: (amount: number) => void;
  notifyFeed: (text: string, isHeadshot?: boolean, isHighlight?: boolean) => void;
  syncBossHud: (boss: BossEnemy) => void;
  activeEnemyCount: () => number;
}

const _origin = new THREE.Vector3();
const _toPlayer = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _moveVec = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _baseShotDir = new THREE.Vector3();
const _shotDir = new THREE.Vector3();
const _yAxis = new THREE.Vector3(0, 1, 0);

/** إطلاق وابل رصاص منتشر نحو اللاعب */
function fireSpreadVolley(
  origin: THREE.Vector3,
  playerPos: THREE.Vector3,
  count: number,
  spreadTotal: number,
  speed: number,
  dmg: number,
  colorHex: number,
  pools: ObjectPools,
  audio: AudioManager,
): void {
  audio.play('enemyShoot');
  _baseShotDir.subVectors(playerPos, origin).normalize();
  for (let i = 0; i < count; i++) {
    const angle = count <= 1 ? 0 : (i / (count - 1) - 0.5) * spreadTotal;
    _shotDir.copy(_baseShotDir).applyAxisAngle(_yAxis, angle);
    _shotDir.y += (Math.random() - 0.5) * 0.05;
    _shotDir.normalize().multiplyScalar(speed);
    pools.spawnEnemyBullet(origin, _shotDir, dmg, colorHex, 1.35, 4.4);
  }
}

/** تنفيذ الهجوم التالي للمهندس المدرّع */
function executeEngineerAttack(
  boss: BossEnemy,
  playerPos: THREE.Vector3,
  pools: ObjectPools,
  audio: AudioManager,
  cb: BossAttackCallbacks,
): void {
  const phase = boss.bossPhase;
  const cycle = ['turret', 'drone_shield', 'missiles', 'barrage'] as const;
  let atk = cycle[boss.bossAttackIdx % cycle.length];
  boss.bossAttackIdx++;

  if (atk === 'turret' && (cb.countBossTurrets() >= 3 || cb.activeEnemyCount() >= PLAYER_CONSTANTS.MAX_ENEMIES)) {
    atk = 'missiles';
  }
  if (atk === 'drone_shield' && cb.countBossShieldDrones() >= 2) {
    atk = 'barrage';
  }

  if (atk === 'turret') {
    const count = phase >= 2 ? 2 : 1;
    const spawned = cb.summonBossUnit(boss, 'turret', count, { radius: 6.5 });
    if (spawned > 0) {
      audio.play('droneAlert');
      cb.notifyFeed(`🔧 المهندس نشر ${spawned} برج قتالي — دمّر الأبراج بسرعة!`, true, true);
    } else {
      fireSpreadVolley(_origin, playerPos, 5 + phase, 0.48, 26 + phase * 2, 13, 0x38bdf8, pools, audio);
    }
  } else if (atk === 'drone_shield') {
    const count = phase === 3 ? 3 : 2;
    const spawned = cb.summonBossUnit(boss, 'drone', count, { protectsBoss: true, radius: 4.5 });
    if (spawned > 0) {
      boss.setBossShieldActive(true);
      cb.syncBossHud(boss);
      audio.play('empWarn');
      cb.notifyFeed('🛡️ المهندس فعّل درع الدرونات — دمّر الدرونات الحامية لكسر الحماية!', true, true);
    } else {
      fireSpreadVolley(_origin, playerPos, 6, 0.52, 27, 13, 0x38bdf8, pools, audio);
    }
  } else if (atk === 'missiles') {
    audio.play('mortarLaunch');
    const missileCount = phase === 1 ? 2 : phase === 2 ? 3 : 4;
    cb.notifyFeed('🚀 صواريخ المهندس الموجهة — ابتعد عن دوائر التحذير!', false, true);
    for (let i = 0; i < missileCount; i++) {
      const spread = i === 0 ? 0 : 7.0;
      const tx = playerPos.x + (Math.random() - 0.5) * spread * 2;
      const tz = playerPos.z + (Math.random() - 0.5) * spread * 2;
      cb.launchGroundMissile(_origin, tx, tz, 4.0, 1.45, 26);
    }
  } else {
    fireSpreadVolley(_origin, playerPos, 4 + phase * 2, 0.5, 26 + phase * 3, 13, 0x38bdf8, pools, audio);
  }
}

/** تنفيذ الهجوم التالي لملكة السرب الطائرة */
function executeSwarmQueenAttack(
  boss: BossEnemy,
  playerPos: THREE.Vector3,
  pools: ObjectPools,
  audio: AudioManager,
  cb: BossAttackCallbacks,
): void {
  const phase = boss.bossPhase;
  const cycle = ['swarm', 'carpet_bomb', 'sting_barrage', 'kamikaze'] as const;
  let atk = cycle[boss.bossAttackIdx % cycle.length];
  boss.bossAttackIdx++;

  if ((atk === 'swarm' || atk === 'kamikaze') && cb.activeEnemyCount() >= PLAYER_CONSTANTS.MAX_ENEMIES + 2) {
    atk = 'sting_barrage';
  }

  if (atk === 'swarm') {
    const count = phase === 1 ? 3 : phase === 2 ? 4 : 6;
    const spawned = cb.summonBossUnit(boss, 'swarm_drone', count, { radius: 5.0 });
    if (spawned > 0) {
      audio.play('droneAlert');
      cb.notifyFeed(`🐝 ملكة السرب أطلقت ${spawned} من درونات السرب!`, true, true);
    } else {
      fireSpreadVolley(_origin, playerPos, 7, 0.56, 28, 12, 0xf472b6, pools, audio);
    }
  } else if (atk === 'kamikaze') {
    const count = phase >= 2 ? 2 : 1;
    const spawned = cb.summonBossUnit(boss, 'kamikaze', count, { radius: 5.5 });
    if (spawned > 0) {
      audio.play('sniperWarn');
      cb.notifyFeed(`💣 ملكة السرب أطلقت ${spawned} درون انتحاري — أسقطها قبل الانقضاض!`, true, true);
    } else {
      fireSpreadVolley(_origin, playerPos, 7, 0.56, 28, 12, 0xf472b6, pools, audio);
    }
  } else if (atk === 'carpet_bomb') {
    audio.play('mortarLaunch');
    const bombCount = phase === 1 ? 3 : phase === 2 ? 4 : 5;
    cb.notifyFeed('⚠️ قصف جوي من ملكة السرب — تحرّك خارج الدوائر الحمراء!', true, true);
    for (let i = 0; i < bombCount; i++) {
      const spread = i === 0 ? 0.5 : 8.5;
      const tx = playerPos.x + (Math.random() - 0.5) * spread * 2;
      const tz = playerPos.z + (Math.random() - 0.5) * spread * 2;
      cb.launchGroundMissile(_origin, tx, tz, 4.3, 1.35, 28);
    }
  } else {
    fireSpreadVolley(_origin, playerPos, 5 + phase * 2, 0.62, 27 + phase * 2, 12, 0xf472b6, pools, audio);
  }
}

/** تنفيذ الهجوم التالي للعملاق الجبار */
function executeColossusAttack(
  boss: BossEnemy,
  playerPos: THREE.Vector3,
  pools: ObjectPools,
  audio: AudioManager,
  cb: BossAttackCallbacks,
): void {
  const phase = boss.bossPhase;
  const cycle = ['shockwave', 'artillery', 'cannons', 'reinforce'] as const;
  let atk = cycle[boss.bossAttackIdx % cycle.length];
  boss.bossAttackIdx++;

  if (atk === 'reinforce' && cb.activeEnemyCount() >= PLAYER_CONSTANTS.MAX_ENEMIES - 1) {
    atk = 'shockwave';
  }

  if (atk === 'shockwave') {
    boss.slamCharge = 0.72;
    boss.slamQueued = phase === 3 ? 1 : 0;
    audio.play('sniperWarn');
    cb.notifyFeed(
      phase === 3
        ? '⬆️ العملاق الجبار يحضّر ضربة أرضية مزدوجة — استعد للقفز مرتين!'
        : '⬆️ العملاق الجبار يحضّر ضربة أرضية — اقفز لتفادي موجة الصدمة!',
      true,
      true,
    );
  } else if (atk === 'artillery') {
    audio.play('mortarLaunch');
    const shellCount = phase === 1 ? 3 : phase === 2 ? 4 : 5;
    cb.notifyFeed('☄️ قصف مدفعي ثقيل من العملاق الجبار — تفادَ دوائر التحذير!', false, true);
    for (let i = 0; i < shellCount; i++) {
      const spread = i === 0 ? 0 : 8.0;
      const tx = playerPos.x + (Math.random() - 0.5) * spread * 2;
      const tz = playerPos.z + (Math.random() - 0.5) * spread * 2;
      cb.launchGroundMissile(_origin, tx, tz, 4.6, 1.5, 32);
    }
  } else if (atk === 'reinforce') {
    const count = phase >= 2 ? 3 : 2;
    const spawned = cb.summonBossUnit(boss, 'rusher', count, { radius: 6.0 });
    if (spawned > 0) {
      audio.play('bossRoar');
      cb.notifyFeed(`⚠️ العملاق الجبار استدعى ${spawned} مقتحمين لمحاصرتك!`, false, true);
    } else {
      fireSpreadVolley(_origin, playerPos, 7, 0.58, 27, 15, 0xfde047, pools, audio);
    }
  } else {
    fireSpreadVolley(_origin, playerPos, 5 + phase * 2, 0.58, 26 + phase * 3, 15, 0xfde047, pools, audio);
  }
}

/** تحديث حركة وهجمات الباس كل إطار حسب نوعه (المهندس / ملكة السرب / العملاق الجبار) */
export function updateBossBehavior(
  boss: BossEnemy,
  playerPos: THREE.Vector3,
  playerFeetY: number,
  mapManager: MapManager,
  pools: ObjectPools,
  audio: AudioManager,
  dt: number,
  nowMs: number,
  cb: BossAttackCallbacks,
): void {
  // نبض توهج نقاط الضعف لجعلها واضحة بصرياً للاعب
  for (const wm of boss.weakPointMats) {
    wm.emissiveIntensity = 1.2 + Math.sin(nowMs * 0.008) * 0.55;
  }

  // التحقق المستمر من حالة درع الدرونات للمهندس
  if (boss.archetype === 'engineer') {
    const shieldDronesAlive = cb.countBossShieldDrones();
    if (boss.bossShieldActive && shieldDronesAlive <= 0) {
      boss.setBossShieldActive(false);
      cb.syncBossHud(boss);
      cb.notifyFeed('💥 تحطّم درع الدرونات — المهندس مكشوف الآن!', true, true);
    } else if (boss.bossShieldMesh && boss.bossShieldActive) {
      boss.bossShieldMesh.rotation.y += dt * 1.4;
    }
  }

  _toPlayer.set(playerPos.x - boss.group.position.x, 0, playerPos.z - boss.group.position.z);
  const dist = _toPlayer.length();
  if (dist > 0.001) _dir.copy(_toPlayer).divideScalar(dist);
  else _dir.set(0, 0, 1);

  // حركة خاصة لملكة السرب الطائرة
  if (boss.config.flying) {
    for (const r of boss.rotors) {
      r.rotation.y += dt * 24;
    }
    const targetAlt = boss.hoverHeight + Math.sin(nowMs * 0.0028) * 1.1;
    boss.group.position.y += (targetAlt - boss.group.position.y) * Math.min(1, dt * 4);

    _moveVec.set(0, 0, 0);
    if (dist > 28) _moveVec.add(_dir);
    else if (dist < 14) _moveVec.sub(_dir);

    boss.strafeTimer -= dt;
    if (boss.strafeTimer <= 0) {
      boss.strafeDir *= -1;
      boss.strafeTimer = 2.6 + Math.random() * 1.8;
    }
    _perp.set(-_dir.z * boss.strafeDir, 0, _dir.x * boss.strafeDir);
    _moveVec.addScaledVector(_perp, 1.15);

    if (_moveVec.lengthSq() > 0.01) {
      _moveVec.normalize();
      boss.group.position.addScaledVector(_moveVec, boss.speed * dt);
      const limit = mapManager.halfArena - 6;
      boss.group.position.x = Math.max(-limit, Math.min(limit, boss.group.position.x));
      boss.group.position.z = Math.max(-limit, Math.min(limit, boss.group.position.z));
    }

    boss.group.lookAt(playerPos.x, boss.group.position.y - 1.2, playerPos.z);

    boss.shootTimer -= dt;
    if (boss.shootTimer <= 0) {
      boss.getMuzzleWorld(_origin);
      executeSwarmQueenAttack(boss, playerPos, pools, audio, cb);
      const phaseCooldown = boss.bossPhase === 1 ? 2.8 : boss.bossPhase === 2 ? 2.15 : 1.55;
      boss.shootTimer = phaseCooldown + Math.random() * 0.4;
    }
    return;
  }

  // حركة وهجمات الزعماء الأرضيين (المهندس + العملاق الجبار)
  if (boss.slamCharge > 0) {
    boss.slamCharge -= dt;
    boss.group.position.y = Math.sin((1 - Math.max(0, boss.slamCharge) / 0.72) * Math.PI) * 3.1;
    if (boss.slamCharge <= 0) {
      boss.group.position.y = 0;
      cb.spawnShockwave(boss.group.position, boss.archetype === 'colossus' ? 32 : 26);
      if (boss.slamQueued > 0) {
        boss.slamQueued--;
        boss.slamCharge = 0.62;
        audio.play('sniperWarn');
      }
    }
  } else {
    _moveVec.set(0, 0, 0);
    const preferredMax = boss.archetype === 'engineer' ? 24 : 18;
    const preferredMin = boss.archetype === 'engineer' ? 14 : 9;
    if (dist > preferredMax) _moveVec.add(_dir);
    else if (dist < preferredMin) _moveVec.sub(_dir);

    boss.strafeTimer -= dt;
    if (boss.strafeTimer <= 0) {
      boss.strafeDir *= -1;
      boss.strafeTimer = 2.0 + Math.random() * 1.5;
    }
    _perp.set(-_dir.z * boss.strafeDir, 0, _dir.x * boss.strafeDir);
    _moveVec.addScaledVector(_perp, boss.archetype === 'engineer' ? 0.85 : 0.55);

    if (_moveVec.lengthSq() > 0.01) {
      _moveVec.normalize();
      boss.group.position.addScaledVector(_moveVec, boss.speed * dt);
      const blocked = mapManager.resolveCollisions(boss.group.position, 1.85, 0);
      if (blocked) boss.strafeDir *= -1;

      if (boss.leftLeg && boss.rightLeg) {
        boss.walkPhase += dt * boss.speed * 1.3;
        boss.leftLeg.rotation.x = Math.sin(boss.walkPhase) * 0.45;
        boss.rightLeg.rotation.x = -Math.sin(boss.walkPhase) * 0.45;
      }
    }

    boss.shootTimer -= dt;
    if (boss.shootTimer <= 0) {
      boss.getMuzzleWorld(_origin);
      if (boss.archetype === 'engineer') {
        executeEngineerAttack(boss, playerPos, pools, audio, cb);
      } else {
        executeColossusAttack(boss, playerPos, pools, audio, cb);
      }
      const phaseCooldown = boss.bossPhase === 1 ? 2.6 : boss.bossPhase === 2 ? 1.95 : 1.4;
      boss.shootTimer = phaseCooldown + Math.random() * 0.4;
    }
  }

  boss.group.lookAt(playerPos.x, boss.group.position.y, playerPos.z);

  // ضرر التصادم القريب مع الزعيم الأرضي
  if (dist < 3.6 && playerFeetY < 4.5) {
    cb.damagePlayer(boss.archetype === 'colossus' ? 26 : 20);
    boss.group.position.addScaledVector(_dir, -1.8);
  }
}
