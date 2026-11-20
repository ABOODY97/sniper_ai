import * as THREE from 'three';
import type { EnemyBase } from './EnemyBase';
import type { MapManager } from '../maps/MapManager';

/* ==========================================
   الذكاء الاصطناعي المشترك للأعداء (الأرضيين والطائرين والأبراج الآلية)
   يتحكم في سياسات الحركة المميزة لكل فئة: اندفاع، مناورة، قنص،
   جولات التفاف المدفعية الطائرة، سرب الدرونات، انقضاض الانتحاري، والقناص الطائر
   ========================================== */

const _toPlayer = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _moveVec = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _losDir = new THREE.Vector3();
const _losRaycaster = new THREE.Raycaster();
const _diveVec = new THREE.Vector3();

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

/** تقييد موقع العدو الطائر داخل حدود الساحة الجوية */
function clampAerialBounds(pos: THREE.Vector3, mapManager: MapManager, margin = 5.5): void {
  const limit = mapManager.halfArena - margin;
  pos.x = Math.max(-limit, Math.min(limit, pos.x));
  pos.z = Math.max(-limit, Math.min(limit, pos.z));
  pos.y = Math.max(1.2, Math.min(22, pos.y));
}

/** تحديث حركة الأعداء الأرضيين حسب سياستهم القتالية */
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
  } else if (type === 'jammer') {
    const minD = enemy.config.minDist ?? 9;
    const maxD = enemy.config.maxDist ?? 15;
    if (dist > maxD) _moveVec.add(_dir);
    else if (dist < minD) _moveVec.sub(_dir);

    enemy.strafeTimer -= dt;
    if (enemy.strafeTimer <= 0) {
      enemy.strafeDir *= -1;
      enemy.strafeTimer = 1.8 + Math.random() * 1.8;
    }
    _perp.set(-_dir.z * enemy.strafeDir, 0, _dir.x * enemy.strafeDir);
    _moveVec.addScaledVector(_perp, 0.7);
  } else if (type === 'ghost') {
    const minD = enemy.config.minDist ?? 8;
    const maxD = enemy.config.maxDist ?? 16;
    if (dist > maxD) _moveVec.add(_dir);
    else if (dist < minD) _moveVec.sub(_dir);

    enemy.strafeTimer -= dt;
    if (enemy.strafeTimer <= 0) {
      enemy.strafeDir *= -1;
      enemy.strafeTimer = 1.2 + Math.random() * 1.4;
    }
    _perp.set(-_dir.z * enemy.strafeDir, 0, _dir.x * enemy.strafeDir);
    _moveVec.addScaledVector(_perp, 1.15);
  } else {
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

/** تحديث حركة الدرون الطائر (مع دعم مدار الحماية حول زعيم المهندس) */
export function updateDroneMovement(
  enemy: EnemyBase,
  playerPos: THREE.Vector3,
  mapManager: MapManager,
  dt: number,
  nowMs: number,
  orbitAnchor?: THREE.Vector3,
): number {
  for (const r of enemy.rotors) {
    r.rotation.y += dt * 24;
  }

  // درونات درع المهندس تدور في مدار دفاعي محيط بالزعيم
  if (enemy.protectsBoss && orbitAnchor) {
    enemy.walkPhase += dt * 1.9;
    const orbitR = 4.6;
    const tx = orbitAnchor.x + Math.cos(enemy.walkPhase) * orbitR;
    const tz = orbitAnchor.z + Math.sin(enemy.walkPhase) * orbitR;
    const ty = 3.8 + Math.sin(nowMs * 0.004 + enemy.walkPhase) * 0.55;
    enemy.group.position.x += (tx - enemy.group.position.x) * Math.min(1, dt * 6);
    enemy.group.position.z += (tz - enemy.group.position.z) * Math.min(1, dt * 6);
    enemy.group.position.y += (ty - enemy.group.position.y) * Math.min(1, dt * 6);
    clampAerialBounds(enemy.group.position, mapManager, 3.0);
    enemy.group.lookAt(playerPos.x, enemy.group.position.y, playerPos.z);
    if (enemy.hpBarGroup.visible) enemy.hpBarGroup.lookAt(playerPos);
    return Math.hypot(playerPos.x - enemy.group.position.x, playerPos.z - enemy.group.position.z);
  }

  _toPlayer.set(playerPos.x - enemy.group.position.x, 0, playerPos.z - enemy.group.position.z);
  const dist = _toPlayer.length();
  if (dist > 0.001) _dir.copy(_toPlayer).divideScalar(dist);
  else _dir.set(0, 0, 1);

  enemy.group.position.y = enemy.hoverHeight + Math.sin(nowMs * 0.0035 + enemy.walkPhase) * 0.45;

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

/** حركة المدفعية الطائرة (Gunship): جولات التفاف سريعة مع ميلان جانبي */
export function updateGunshipMovement(
  enemy: EnemyBase,
  playerPos: THREE.Vector3,
  mapManager: MapManager,
  dt: number,
  nowMs: number,
): number {
  for (const r of enemy.rotors) {
    r.rotation.y += dt * 28;
  }

  _toPlayer.set(playerPos.x - enemy.group.position.x, 0, playerPos.z - enemy.group.position.z);
  const dist = _toPlayer.length();
  if (dist > 0.001) _dir.copy(_toPlayer).divideScalar(dist);
  else _dir.set(0, 0, 1);

  enemy.strafeTimer -= dt;
  if (enemy.strafeTimer <= 0) {
    enemy.strafeDir *= -1;
    enemy.strafeTimer = 3.2 + Math.random() * 2.0;
  }

  const minD = enemy.config.minDist ?? 18;
  const maxD = enemy.config.maxDist ?? 34;
  _moveVec.set(0, 0, 0);
  if (dist > maxD) _moveVec.addScaledVector(_dir, 1.0);
  else if (dist < minD) _moveVec.addScaledVector(_dir, -0.85);

  _perp.set(-_dir.z * enemy.strafeDir, 0, _dir.x * enemy.strafeDir);
  _moveVec.addScaledVector(_perp, 1.35);

  if (_moveVec.lengthSq() > 0.01) {
    _moveVec.normalize();
    enemy.group.position.addScaledVector(_moveVec, enemy.speed * dt);
  }
  enemy.group.position.y = enemy.hoverHeight + Math.sin(nowMs * 0.0026 + enemy.walkPhase) * 0.85;
  clampAerialBounds(enemy.group.position, mapManager, 6.0);

  enemy.group.lookAt(playerPos.x, enemy.group.position.y - 1.4, playerPos.z);
  // ميلان طفيف أثناء جولة الالتفاف الجانبي
  enemy.group.rotateZ(enemy.strafeDir * -0.18);
  if (enemy.hpBarGroup.visible) enemy.hpBarGroup.lookAt(playerPos);

  return dist;
}

/** حركة درون السرب الصغير (Swarm Drone): تموّج سريع وخفيف في السماء */
export function updateSwarmDroneMovement(
  enemy: EnemyBase,
  playerPos: THREE.Vector3,
  mapManager: MapManager,
  dt: number,
  nowMs: number,
): number {
  for (const r of enemy.rotors) {
    r.rotation.y += dt * 32;
  }

  _toPlayer.set(playerPos.x - enemy.group.position.x, 0, playerPos.z - enemy.group.position.z);
  const dist = _toPlayer.length();
  if (dist > 0.001) _dir.copy(_toPlayer).divideScalar(dist);
  else _dir.set(0, 0, 1);

  enemy.strafeTimer -= dt;
  if (enemy.strafeTimer <= 0) {
    enemy.strafeDir *= -1;
    enemy.strafeTimer = 1.1 + Math.random() * 1.2;
  }

  const minD = enemy.config.minDist ?? 9;
  const maxD = enemy.config.maxDist ?? 17;
  _moveVec.set(0, 0, 0);
  if (dist > maxD) _moveVec.add(_dir);
  else if (dist < minD) _moveVec.sub(_dir);
  _perp.set(-_dir.z * enemy.strafeDir, 0, _dir.x * enemy.strafeDir);
  _moveVec.addScaledVector(_perp, 1.4);

  if (_moveVec.lengthSq() > 0.01) {
    _moveVec.normalize();
    enemy.group.position.addScaledVector(_moveVec, enemy.speed * dt);
  }
  enemy.group.position.y = enemy.hoverHeight + Math.sin(nowMs * 0.006 + enemy.walkPhase) * 0.7;
  clampAerialBounds(enemy.group.position, mapManager, 3.5);

  enemy.group.lookAt(playerPos.x, playerPos.y, playerPos.z);
  if (enemy.hpBarGroup.visible) enemy.hpBarGroup.lookAt(playerPos);

  return dist;
}

/** حركة الدرون الانتحاري (Kamikaze): يحلق ثم ينقض بسرعة نحو اللاعب لينفجر */
export function updateKamikazeMovement(
  enemy: EnemyBase,
  playerPos: THREE.Vector3,
  mapManager: MapManager,
  dt: number,
  nowMs: number,
): { dist3D: number; startedDive: boolean; shouldDetonate: boolean } {
  for (const r of enemy.rotors) {
    r.rotation.y += dt * (enemy.isDiving ? 42 : 24);
  }

  const dist3D = enemy.group.position.distanceTo(playerPos);
  let startedDive = false;

  if (!enemy.isDiving) {
    _toPlayer.set(playerPos.x - enemy.group.position.x, 0, playerPos.z - enemy.group.position.z);
    const horizDist = _toPlayer.length();
    if (horizDist > 0.001) _dir.copy(_toPlayer).divideScalar(horizDist);
    else _dir.set(0, 0, 1);

    _perp.set(-_dir.z * enemy.strafeDir, 0, _dir.x * enemy.strafeDir);
    _moveVec.copy(_dir).addScaledVector(_perp, 0.45).normalize();
    enemy.group.position.addScaledVector(_moveVec, enemy.speed * dt);
    enemy.group.position.y = enemy.hoverHeight + Math.sin(nowMs * 0.005 + enemy.walkPhase) * 0.45;
    clampAerialBounds(enemy.group.position, mapManager, 4.0);
    enemy.group.lookAt(playerPos.x, playerPos.y, playerPos.z);

    if (horizDist < 28 && hasLineOfSight(enemy.group.position, playerPos, mapManager.obstacleMeshes)) {
      enemy.isDiving = true;
      enemy.diveTarget.copy(playerPos);
      startedDive = true;
    }
  } else {
    // تتبّع مستمر أثناء الانقضاض السريع نحو اللاعب
    enemy.diveTarget.lerp(playerPos, Math.min(1, dt * 6));
    _diveVec.subVectors(enemy.diveTarget, enemy.group.position);
    const dLen = _diveVec.length();
    if (dLen > 0.01) {
      _diveVec.divideScalar(dLen);
      enemy.group.position.addScaledVector(_diveVec, 22.5 * dt);
      enemy.group.lookAt(enemy.diveTarget);
    }
  }

  if (enemy.hpBarGroup.visible) enemy.hpBarGroup.lookAt(playerPos);

  const hitObstacle = enemy.isDiving && mapManager.isPointInsideObstacle(enemy.group.position);
  const hitGround = enemy.isDiving && enemy.group.position.y <= 0.45;
  const shouldDetonate = dist3D < 2.35 || hitObstacle || hitGround;

  return { dist3D, startedDive, shouldDetonate };
}

/** حركة القناص الطائر (Flying Sniper): يحلق على ارتفاع عالٍ وبعيد ويثبت أثناء التصويب بالليزر */
export function updateFlyingSniperMovement(
  enemy: EnemyBase,
  playerPos: THREE.Vector3,
  mapManager: MapManager,
  dt: number,
  nowMs: number,
): number {
  for (const r of enemy.rotors) {
    r.rotation.y += dt * 18;
  }

  _toPlayer.set(playerPos.x - enemy.group.position.x, 0, playerPos.z - enemy.group.position.z);
  const dist = _toPlayer.length();
  if (dist > 0.001) _dir.copy(_toPlayer).divideScalar(dist);
  else _dir.set(0, 0, 1);

  if (enemy.aimState !== 'aiming') {
    const minD = enemy.config.minDist ?? 36;
    const maxD = enemy.config.maxDist ?? 56;
    _moveVec.set(0, 0, 0);
    if (dist < minD) _moveVec.sub(_dir);
    else if (dist > maxD) _moveVec.add(_dir);

    enemy.strafeTimer -= dt;
    if (enemy.strafeTimer <= 0) {
      enemy.strafeDir *= -1;
      enemy.strafeTimer = 2.5 + Math.random() * 2.0;
    }
    _perp.set(-_dir.z * enemy.strafeDir, 0, _dir.x * enemy.strafeDir);
    _moveVec.addScaledVector(_perp, 0.7);

    if (_moveVec.lengthSq() > 0.01) {
      _moveVec.normalize();
      enemy.group.position.addScaledVector(_moveVec, enemy.speed * dt);
    }
  }

  enemy.group.position.y = enemy.hoverHeight + Math.sin(nowMs * 0.0022 + enemy.walkPhase) * 0.35;
  clampAerialBounds(enemy.group.position, mapManager, 6.0);

  enemy.group.lookAt(playerPos.x, playerPos.y, playerPos.z);
  if (enemy.hpBarGroup.visible) enemy.hpBarGroup.lookAt(playerPos);

  return dist;
}

/** توجيه البرج القتالي الآلي الثابت نحو اللاعب */
export function updateTurretAim(enemy: EnemyBase, playerPos: THREE.Vector3): number {
  const dist = Math.hypot(playerPos.x - enemy.group.position.x, playerPos.z - enemy.group.position.z);
  enemy.group.lookAt(playerPos.x, enemy.group.position.y, playerPos.z);
  if (enemy.hpBarGroup.visible) enemy.hpBarGroup.lookAt(playerPos);
  return dist;
}
