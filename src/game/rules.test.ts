import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYER_CONSTANTS,
  computeBossMaxHp,
  computeBossPhase,
  computeComboMultiplier,
  computeHitDamage,
  computeKillPoints,
  computeSlideSpeed,
  computeWaveEnemyCount,
  getKillStreakReward,
  isBulletHittingPlayerHeight,
  pickEnemyTypeForWave,
} from './rules';

/* ==========================================
   اختبارات الوحدة للمنطق والقواعد النقية
   ========================================== */

test('تباطؤ سرعة التزحلق بسلاسة من 17 إلى 6 خلال 0.85 ثانية', () => {
  assert.equal(computeSlideSpeed(PLAYER_CONSTANTS.SLIDE_DURATION, 1.0), 17.0);
  assert.equal(computeSlideSpeed(0, 1.0), 6.0);
  const mid = computeSlideSpeed(PLAYER_CONSTANTS.SLIDE_DURATION / 2, 1.0);
  assert.ok(Math.abs(mid - 11.5) < 0.001, `السرعة الوسطى المتوقعة 11.5 ولكن كانت ${mid}`);
});

test('تفادي رصاصات مستوى الرأس أثناء التزحلق', () => {
  // اللاعب واقف: ارتفاع العين 1.75 => الرأس عند ~1.89، طلقة على ارتفاع 1.65 تصيبه
  assert.equal(isBulletHittingPlayerHeight(1.65, 1.75, 1.75), true);
  // اللاعب متزحلق: ارتفاع العين 1.0 => الرأس عند ~1.14، طلقة على ارتفاع 1.65 تمر فوقه
  assert.equal(isBulletHittingPlayerHeight(1.65, 1.0, 1.0), false);
  // طلقة منخفضة على ارتفاع 0.7 تصيبه حتى أثناء التزحلق
  assert.equal(isBulletHittingPlayerHeight(0.7, 1.0, 1.0), true);
});

test('مضاعف الكومبو وحساب نقاط القتل', () => {
  assert.equal(computeComboMultiplier(0), 1);
  assert.equal(computeComboMultiplier(1), 1);
  assert.equal(computeComboMultiplier(3), 3);
  assert.equal(computeComboMultiplier(9), 5); // الحد الأقصى x5

  assert.equal(computeKillPoints(150, false, false, 1), 150);
  assert.equal(computeKillPoints(150, true, false, 3), (150 + 100) * 3);
  assert.equal(computeKillPoints(260, false, true, 2), (260 + 75) * 2);
});

test('حساب الضرر للدرع الأمامي والمولد الخلفي والرأس والباس', () => {
  // الدرع الأمامي يمتص 80% من الضرر
  const shieldHit = computeHitDamage({
    enemyType: 'shielded',
    rawDmg: 100,
    dmgMult: 1,
    hitZone: 'shield',
    currentHp: 160,
  });
  assert.equal(shieldHit.damage, 20);
  assert.equal(shieldHit.isShieldBlock, true);
  assert.equal(shieldHit.isCrit, false);

  // المولد الخلفي يتضاعف 2.5x
  const genHit = computeHitDamage({
    enemyType: 'shielded',
    rawDmg: 100,
    dmgMult: 1,
    hitZone: 'generator',
    currentHp: 160,
  });
  assert.equal(genHit.damage, 250);
  assert.equal(genHit.isCrit, true);

  // إصابة رأس القناص المعادي تقضي عليه فوراً
  const sniperHs = computeHitDamage({
    enemyType: 'sniper',
    rawDmg: 25,
    dmgMult: 1,
    hitZone: 'head',
    currentHp: 70,
    instantHeadshotKill: true,
  });
  assert.equal(sniperHs.damage, 70);
  assert.equal(sniperHs.isCrit, true);

  // نقاط ضعف الباس (الرأس أو المولد الخلفي) تمنح 2x ضرر
  const bossWeak = computeHitDamage({
    enemyType: 'boss',
    rawDmg: 95,
    dmgMult: 1.2,
    hitZone: 'generator',
    currentHp: 900,
  });
  assert.ok(Math.abs(bossWeak.damage - 228) < 0.001);
  assert.equal(bossWeak.isCrit, true);
});

test('مراحل الباس وصحته وعدد أعداء الموجات', () => {
  assert.equal(computeBossMaxHp(5), 900);
  assert.equal(computeBossMaxHp(10), 1450);
  assert.equal(computeBossPhase(900, 900), 1);
  assert.equal(computeBossPhase(550, 900), 2);
  assert.equal(computeBossPhase(250, 900), 3);

  assert.equal(computeWaveEnemyCount(1), 8);
  assert.equal(computeWaveEnemyCount(4), 17);
  assert.equal(computeWaveEnemyCount(5), 1);
});

test('توزيع الأعداء حسب رقم الموجة ومكافآت سلسلة القتل', () => {
  assert.equal(pickEnemyTypeForWave(1, 0.2), 'rusher');
  assert.equal(pickEnemyTypeForWave(1, 0.8), 'trooper');
  assert.equal(pickEnemyTypeForWave(2, 0.9), 'drone');
  assert.equal(pickEnemyTypeForWave(4, 0.8), 'sniper');

  assert.equal(getKillStreakReward(4), null);
  assert.equal(getKillStreakReward(5)?.effect, 'shield_overcharge');
  assert.equal(getKillStreakReward(10)?.effect, 'tactical_resupply');
  assert.equal(getKillStreakReward(15)?.effect, 'fury_overdrive');
});
