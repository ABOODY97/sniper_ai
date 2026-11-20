import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ELITE_AFFIXES,
  PLAYER_CONSTANTS,
  WAVE_MUTATORS,
  computeBossMaxHp,
  computeBossPhase,
  computeComboMultiplier,
  computeEffectiveFogDensity,
  computeEffectiveGravity,
  computeHitDamage,
  computeKillPoints,
  computeSlideSpeed,
  computeWaveEnemyCount,
  getKillStreakReward,
  getMapDisplayName,
  isBulletHittingPlayerHeight,
  pickEnemyTypeForWave,
  pickWaveMutator,
  rollEliteAffix,
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

test('حساب الضرر للدرع الأمامي والمولد الخلفي والرأس والباس وصفة النخبة المدرعة ومضاعف الرأس', () => {
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

  // عدو النخبة بصفة "مُدرَّع" يتلقى ضرراً أقل بنسبة 50% من طلقات الجسم فقط
  const armoredBody = computeHitDamage({
    enemyType: 'jammer',
    rawDmg: 80,
    dmgMult: 1,
    hitZone: 'body',
    currentHp: 90,
    eliteAffix: 'armored',
  });
  assert.equal(armoredBody.damage, 40);

  const armoredHead = computeHitDamage({
    enemyType: 'jammer',
    rawDmg: 80,
    dmgMult: 1,
    hitZone: 'head',
    currentHp: 90,
    eliteAffix: 'armored',
  });
  assert.equal(armoredHead.damage, 80);

  // معدِّل "إصابات الرأس بضرر مضاعف" يضاعف ضرر الرأس ×2
  const doubleHs = computeHitDamage({
    enemyType: 'ghost',
    rawDmg: 50,
    dmgMult: 1,
    hitZone: 'head',
    currentHp: 60,
    headshotMult: 2.0,
  });
  assert.equal(doubleHs.damage, 100);
  assert.equal(doubleHs.isCrit, true);
});

test('مراحل الباس وصحته وعدد أعداء الموجات وحد الأعداء المتوازن', () => {
  assert.equal(computeBossMaxHp(5), 900);
  assert.equal(computeBossMaxHp(10), 1450);
  assert.equal(computeBossPhase(900, 900), 1);
  assert.equal(computeBossPhase(550, 900), 2);
  assert.equal(computeBossPhase(250, 900), 3);

  assert.equal(computeWaveEnemyCount(1), 8);
  assert.equal(computeWaveEnemyCount(4), 17);
  assert.equal(computeWaveEnemyCount(5), 1);
  assert.equal(PLAYER_CONSTANTS.MAX_ENEMIES, 14);
});

test('توزيع الأعداء حسب رقم الموجة (بما فيها المشوِّش والشبح) ومكافآت سلسلة القتل', () => {
  assert.equal(pickEnemyTypeForWave(1, 0.2), 'rusher');
  assert.equal(pickEnemyTypeForWave(1, 0.8), 'trooper');
  assert.equal(pickEnemyTypeForWave(2, 0.9), 'drone');
  assert.equal(pickEnemyTypeForWave(3, 0.8), 'ghost');
  assert.equal(pickEnemyTypeForWave(4, 0.62), 'jammer');
  assert.equal(pickEnemyTypeForWave(4, 0.74), 'ghost');
  assert.equal(pickEnemyTypeForWave(4, 0.85), 'sniper');

  assert.equal(getKillStreakReward(4), null);
  assert.equal(getKillStreakReward(5)?.effect, 'shield_overcharge');
  assert.equal(getKillStreakReward(10)?.effect, 'tactical_resupply');
  assert.equal(getKillStreakReward(15)?.effect, 'fury_overdrive');
});

test('توليد أعداء النخبة بدءاً من الموجة 6 بنسبة 15% لغير الباس مع الصفات الأربع', () => {
  // قبل الموجة 6 لا تظهر النخبة
  assert.equal(rollEliteAffix(5, false, 0.01, 0.0), null);
  // الباس لا يتحول لنخبة
  assert.equal(rollEliteAffix(10, true, 0.01, 0.0), null);
  // عند نسبة >= 0.15 لا يتحول لنخبة
  assert.equal(rollEliteAffix(6, false, 0.15, 0.0), null);

  // عند نسبة < 0.15 في الموجة 6+ تُختار إحدى الصفات الأربع
  const a1 = rollEliteAffix(6, false, 0.14, 0.05);
  const a2 = rollEliteAffix(6, false, 0.05, 0.3);
  const a3 = rollEliteAffix(7, false, 0.02, 0.6);
  const a4 = rollEliteAffix(8, false, 0.0, 0.9);

  assert.equal(a1, 'explosive');
  assert.equal(a2, 'swift');
  assert.equal(a3, 'regenerating');
  assert.equal(a4, 'armored');
  assert.ok(ELITE_AFFIXES[a1!].name.length > 0);
  assert.ok(ELITE_AFFIXES[a4!].name.length > 0);
});

test('معدِّلات الموجات تبدأ من الموجة 3 وتتكرر كل 3 موجات', () => {
  assert.equal(pickWaveMutator(1, 0.1), null);
  assert.equal(pickWaveMutator(2, 0.1), null);
  assert.equal(pickWaveMutator(4, 0.1), null);
  assert.equal(pickWaveMutator(5, 0.1), null);

  const m1 = pickWaveMutator(3, 0.05);
  const m2 = pickWaveMutator(6, 0.3);
  const m3 = pickWaveMutator(9, 0.6);
  const m4 = pickWaveMutator(12, 0.9);

  assert.equal(m1?.id, 'heavy_fog');
  assert.equal(m2?.id, 'low_gravity');
  assert.equal(m3?.id, 'fast_fragile');
  assert.equal(m4?.id, 'double_headshot');
  assert.equal(m1?.name, WAVE_MUTATORS.heavy_fog.name);
});

test('أسماء الخرائط الست وحساب الجاذبية المنخفضة وكثافة الضباب أثناء العاصفة الثلجية', () => {
  assert.equal(getMapDisplayName('lab'), 'المختبر');
  assert.equal(getMapDisplayName('city'), 'مدينة مدمرة');
  assert.equal(getMapDisplayName('desert'), 'صحراء مفتوحة');
  assert.equal(getMapDisplayName('mountain'), 'الجبل المتجمد');
  assert.equal(getMapDisplayName('port'), 'الميناء الصناعي');
  assert.equal(getMapDisplayName('station'), 'المحطة الفضائية');

  // الجاذبية: عادية، المحطة الفضائية (0.48)، مع معدِّل الجاذبية المنخفضة
  assert.equal(computeEffectiveGravity(undefined, false), 1.0);
  assert.equal(computeEffectiveGravity(0.48, false), 0.48);
  assert.equal(computeEffectiveGravity(undefined, true), 0.45);
  assert.ok(computeEffectiveGravity(0.48, true) < 0.45 && computeEffectiveGravity(0.48, true) >= 0.32);

  // الضباب: أساسي، أثناء عاصفة الجبل المتجمد، وأثناء معدِّل الضباب الكثيف
  assert.equal(computeEffectiveFogDensity(0.005, null, false), 0.005);
  assert.equal(computeEffectiveFogDensity(0.005, 0.028, false), 0.028);
  assert.equal(computeEffectiveFogDensity(0.005, 0.028, true), 0.048);
});
