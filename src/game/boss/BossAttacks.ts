import * as THREE from 'three';
import type { BossEnemy } from './Boss';
import type { MapManager } from '../maps/MapManager';
import type { ObjectPools } from '../pools/ObjectPools';
import type { AudioManager } from '../audio/AudioManager';
import { PLAYER_CONSTANTS } from '../rules';

/* ==========================================
   هجمات الزعيم وحركته عبر المراحل الثلاث:
   1) وابل رصاص منتشر
   2) صواريخ بدوائر تحذير أرضية
   3) ضربة أرضية بموجة صدمة (تُتجنب بالقفز)
   4) استدعاء أتباع
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
  summonMinions: (boss: BossEnemy, count: number) => void;
  damagePlayer: (amount: number) => void;
  notifyFeed: (text: string, isHeadshot?: boolean) => void;
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

/** تنفيذ أحد هجمات الباس الأربعة بالتناوب حسب المرحلة */
export function executeBossAttack(
  boss: BossEnemy,
  playerPos: THREE.Vector3,
  pools: ObjectPools,
  audio: AudioManager,
  cb: BossAttackCallbacks,
): void {
  boss.getMuzzleWorld(_origin);
  const phase = boss.bossPhase;
  const cycle = ['barrage', 'missiles', 'shockwave', 'summon'] as const;
  let atk = cycle[boss.bossAttackIdx % cycle.length];
  boss.bossAttackIdx++;

  if (atk === 'summon' && cb.activeEnemyCount() >= PLAYER_CONSTANTS.MAX_ENEMIES - 1) {
    atk = 'barrage';
  }

  if (atk === 'barrage') {
    audio.play('enemyShoot');
    const count = phase === 1 ? 5 : phase === 2 ? 7 : 9;
    _baseShotDir.subVectors(playerPos, _origin).normalize();
    const spreadTotal = 0.52;
    for (let i = 0; i < count; i++) {
      const angle = (i / (count - 1) - 0.5) * spreadTotal;
      _shotDir.copy(_baseShotDir).applyAxisAngle(_yAxis, angle);
      _shotDir.y += (Math.random() - 0.5) * 0.06;
      _shotDir.normalize().multiplyScalar(25 + phase * 3);
      pools.spawnEnemyBullet(_origin, _shotDir, 14, 0xfde047, 1.35, 4.2);
    }
  } else if (atk === 'missiles') {
    audio.play('mortarLaunch');
    const missileCount = phase === 1 ? 2 : phase === 2 ? 3 : 4;
    for (let i = 0; i < missileCount; i++) {
      const spread = i === 0 ? 0 : 7.5;
      const tx = playerPos.x + (Math.random() - 0.5) * spread * 2;
      const tz = playerPos.z + (Math.random() - 0.5) * spread * 2;
      cb.launchGroundMissile(_origin, tx, tz, 4.2, 1.45, 30);
    }
  } else if (atk === 'shockwave') {
    boss.slamCharge = 0.65;
    audio.play('sniperWarn');
    cb.notifyFeed('⬆️ الباس يحضّر موجة صدمة — اقفز لتفاديها!', true);
  } else if (atk === 'summon') {
    cb.summonMinions(boss, phase === 3 ? 3 : 2);
  }
}

/** تحديث حركة وهجمات الباس كل إطار */
export function updateBossBehavior(
  boss: BossEnemy,
  playerPos: THREE.Vector3,
  playerFeetY: number,
  mapManager: MapManager,
  pools: ObjectPools,
  audio: AudioManager,
  dt: number,
  cb: BossAttackCallbacks,
): void {
  _toPlayer.set(playerPos.x - boss.group.position.x, 0, playerPos.z - boss.group.position.z);
  const dist = _toPlayer.length();
  if (dist > 0.001) _dir.copy(_toPlayer).divideScalar(dist);
  else _dir.set(0, 0, 1);

  if (boss.slamCharge > 0) {
    boss.slamCharge -= dt;
    boss.group.position.y = Math.sin((1 - Math.max(0, boss.slamCharge) / 0.65) * Math.PI) * 2.8;
    if (boss.slamCharge <= 0) {
      boss.group.position.y = 0;
      cb.spawnShockwave(boss.group.position, 28);
    }
  } else {
    _moveVec.set(0, 0, 0);
    if (dist > 18) _moveVec.add(_dir);
    else if (dist < 10) _moveVec.sub(_dir);

    boss.strafeTimer -= dt;
    if (boss.strafeTimer <= 0) {
      boss.strafeDir *= -1;
      boss.strafeTimer = 2.0 + Math.random() * 1.5;
    }
    _perp.set(-_dir.z * boss.strafeDir, 0, _dir.x * boss.strafeDir);
    _moveVec.addScaledVector(_perp, 0.7);

    if (_moveVec.lengthSq() > 0.01) {
      _moveVec.normalize();
      boss.group.position.addScaledVector(_moveVec, boss.speed * dt);
      const blocked = mapManager.resolveCollisions(boss.group.position, 1.65, 0);
      if (blocked) boss.strafeDir *= -1;

      if (boss.leftLeg && boss.rightLeg) {
        boss.walkPhase += dt * boss.speed * 1.3;
        boss.leftLeg.rotation.x = Math.sin(boss.walkPhase) * 0.45;
        boss.rightLeg.rotation.x = -Math.sin(boss.walkPhase) * 0.45;
      }
    }

    boss.shootTimer -= dt;
    if (boss.shootTimer <= 0) {
      executeBossAttack(boss, playerPos, pools, audio, cb);
      const phaseCooldown = boss.bossPhase === 1 ? 2.6 : boss.bossPhase === 2 ? 1.95 : 1.38;
      boss.shootTimer = phaseCooldown + Math.random() * 0.4;
    }
  }

  boss.group.lookAt(playerPos.x, boss.group.position.y, playerPos.z);

  // ضرر التصادم القريب مع العملاق
  if (dist < 3.4 && playerFeetY < 4.0) {
    cb.damagePlayer(22);
    boss.group.position.addScaledVector(_dir, -1.8);
  }
}
