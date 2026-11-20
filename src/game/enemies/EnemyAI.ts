import * as THREE from 'three';
import type { EnemyBase } from './EnemyBase';
import type { MapManager } from '../maps/MapManager';

/* ==========================================
   الذكاء الاصطناعي المشترك للأعداء
   يتحكم في سياسات الحركة المميزة لكل فئة (اندفاع، مناورة، مسافات قنص، تحليق، درع)
   ========================================== */

const _toPlayer = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _moveVec = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _losDir = new THREE.Vector3();
const _losRaycaster = new THREE.Raycaster();

/** فحص خط الرؤية المباشر بين نقطتين دون وجود سواتر */
export function hasLineOfSight(
  fromPos: THREE.Vector3,
  toPos: THREE.Vector3,
  obstacleMeshes: THREE.Object3D[],
): boolean {
  _losDir.subVectors(toPos, fromPos);
  const dist = _losDir.length();
  if (dist < 0.05) return true;
  _losDir.divideScalar(dist);
  _losRaycaster.set(fromPos, _losDir);
  _losRaycaster.near = 0.05;
  _losRaycaster.far = dist - 0.1;
  return _losRaycaster.intersectObjects(obstacleMeshes, false).length === 0;
}

/** تحديث حركة الأعداء العاديين (غير الباس وغير الدرون) حسب سياستهم القتالية */
export function updateGroundEnemyMovement(
  enemy: EnemyBase,
  playerPos: THREE.Vector3,
  mapManager: MapManager,
  dt: number,
): { dist: number; dirX: number; dirZ: number } {
  _toPlayer.set(playerPos.x - enemy.group.position.x, 0, playerPos.z - enemy.group.position.z);
  const dist = _toPlayer.length();
  if (dist > 0.001) {
    _dir.copy(_toPlayer).divideScalar(dist);
  } else {
    _dir.set(0, 0, 1);
  }

  _moveVec.set(0, 0, 0);
  const type = enemy.config.type;

  if (type === 'sniper') {
    if (enemy.aimState !== 'aiming') {
      const minD = enemy.config.minDist ?? 30;
      const maxD = enemy.config.maxDist ?? 40;
      if (dist < minD) _moveVec.sub(_dir);
      else if (dist > maxD) _moveVec.add(_dir);

      enemy.strafeTimer -= dt;
      if (enemy.strafeTimer <= 0) {
        enemy.strafeDir *= -1;
        enemy.strafeTimer = 2.2 + Math.random() * 2;
      }
      _perp.set(-_dir.z * enemy.strafeDir, 0, _dir.x * enemy.strafeDir);
      _moveVec.addScaledVector(_perp, 0.55);
    }
  } else if (type === 'mortar') {
    const minD = enemy.config.minDist ?? 24;
    const maxD = enemy.config.maxDist ?? 38;
    if (dist < minD) _moveVec.sub(_dir);
    else if (dist > maxD) _moveVec.add(_dir);

    enemy.strafeTimer -= dt;
    if (enemy.strafeTimer <= 0) {
      enemy.strafeDir *= -1;
      enemy.strafeTimer = 2.5 + Math.random() * 2;
    }
    _perp.set(-_dir.z * enemy.strafeDir, 0, _dir.x * enemy.strafeDir);
    _moveVec.addScaledVector(_perp, 0.5);
  } else if (type === 'shielded') {
    if (dist > 11) _moveVec.add(_dir);
    else if (dist < 6) _moveVec.sub(_dir);
    _perp.set(-_dir.z * enemy.strafeDir, 0, _dir.x * enemy.strafeDir);
    _moveVec.addScaledVector(_perp, 0.35);
  } else {
    // المقتحم يندفع مباشرة نحو اللاعب، بينما الجندي والمدرع الثقيل يحافظان على مسافة اشتباك متوسطة
    if (!enemy.config.shoots || dist > 15) {
      _moveVec.add(_dir);
    } else if (dist < 8) {
      _moveVec.sub(_dir);
    }
    if (enemy.config.shoots) {
      enemy.strafeTimer -= dt;
      if (enemy.strafeTimer <= 0) {
        enemy.strafeDir *= -1;
        enemy.strafeTimer = 1.6 + Math.random() * 2;
      }
      _perp.set(-_dir.z * enemy.strafeDir, 0, _dir.x * enemy.strafeDir);
      _moveVec.addScaledVector(_perp, 0.75);
    }
  }

  if (_moveVec.lengthSq() > 0.01) {
    _moveVec.normalize();
    enemy.group.position.addScaledVector(_moveVec, enemy.speed * dt);
    const blocked = mapManager.resolveCollisions(
      enemy.group.position,
      0.75 * enemy.config.scale,
      enemy.group.position.y,
    );
    if (blocked) enemy.strafeDir *= -1;

    if (enemy.leftLeg && enemy.rightLeg) {
      enemy.walkPhase += dt * enemy.speed * 1.8;
      enemy.leftLeg.rotation.x = Math.sin(enemy.walkPhase) * 0.55;
      enemy.rightLeg.rotation.x = -Math.sin(enemy.walkPhase) * 0.55;
    }
  }

  enemy.group.lookAt(playerPos.x, 0, playerPos.z);
  if (enemy.hpBarGroup.visible) {
    enemy.hpBarGroup.lookAt(playerPos);
  }

  return { dist, dirX: _dir.x, dirZ: _dir.z };
}

/** تحديث حركة الدرون الطائر وتدوير المراوح */
export function updateDroneMovement(
  enemy: EnemyBase,
  playerPos: THREE.Vector3,
  mapManager: MapManager,
  dt: number,
  nowMs: number,
): number {
  _toPlayer.set(playerPos.x - enemy.group.position.x, 0, playerPos.z - enemy.group.position.z);
  const dist = _toPlayer.length();
  if (dist > 0.001) {
    _dir.copy(_toPlayer).divideScalar(dist);
  } else {
    _dir.set(0, 0, 1);
  }

  enemy.group.position.y = enemy.hoverHeight + Math.sin(nowMs * 0.0035 + enemy.walkPhase) * 0.45;
  for (const r of enemy.rotors) {
    r.rotation.y += dt * 22;
  }

  _moveVec.set(0, 0, 0);
  if (dist > 22) _moveVec.add(_dir);
  else if (dist < 13) _moveVec.sub(_dir);
  _perp.set(-_dir.z * enemy.strafeDir, 0, _dir.x * enemy.strafeDir);
  _moveVec.addScaledVector(_perp, 1.15);

  if (_moveVec.lengthSq() > 0.01) {
    _moveVec.normalize();
    enemy.group.position.addScaledVector(_moveVec, enemy.speed * dt);
    const blocked = mapManager.resolveCollisions(enemy.group.position, 1.0, enemy.group.position.y);
    if (blocked) enemy.strafeDir *= -1;
  }

  enemy.group.lookAt(playerPos.x, enemy.group.position.y, playerPos.z);
  if (enemy.hpBarGroup.visible) {
    enemy.hpBarGroup.lookAt(playerPos);
  }

  return dist;
}
