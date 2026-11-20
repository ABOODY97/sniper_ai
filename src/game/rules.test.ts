import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOSS_ROTATION,
  BOSS_RUSH_ROTATION,
  DEFAULT_SETTINGS,
  ELITE_AFFIXES,
  PLAYER_CONSTANTS,
  STORAGE_KEYS,
  WAVE_MUTATORS,
  applyBurnStatus,
  computeBossMaxHp,
  computeBossPhase,
  computeBossRushCycle,
  computeBossRushMaxHp,
  computeBossRushScaling,
  computeComboMultiplier,
  computeEffectiveFogDensity,
  computeEffectiveGravity,
  computeEffectivePixelRatio,
  computeHitDamage,
  computeJoystickInput,
  computeKillPoints,
  computeSlideSpeed,
  computeWaveEnemyCount,
  computeZoomSensitivityMultiplier,
  evaluateBossRushRecord,
  formatRunTimer,
  getBossArchetypeMeta,
  getKillStreakReward,
  getMapDisplayName,
  isBulletHittingPlayerHeight,
  isPointInFlameCone,
  loadSettings,
  pickBossArchetypeForWave,
  pickBossRushArchetype,
  pickEnemyTypeForWave,
  pickWaveMutator,
  rollEliteAffix,
  stepBallisticProjectile,
  stepBurnStatus,
  stepFlamethrowerFuel,
  stepHoldBreathState,
  stepMinigunHeat,
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

test('حساب الضرر للدرع الأمامي ونقاط ضعف الزعماء ودرع المهندس والنخبة المدرعة ومضاعف الرأس', () => {
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

  // إصابة رأس القناص المعادي أو الطائر تقضي عليه فوراً
  const sniperHs = computeHitDamage({
    enemyType: 'flying_sniper',
    rawDmg: 25,
    dmgMult: 1,
    hitZone: 'head',
    currentHp: 65,
    instantHeadshotKill: true,
  });
  assert.equal(sniperHs.damage, 65);
  assert.equal(sniperHs.isCrit, true);

  // نقاط ضعف الباس: النواة السفلية أو المفاعل الخلفي (2.2x) ومفاصل الساقين للعملاق (2.0x)
  const bossGen = computeHitDamage({
    enemyType: 'boss',
    rawDmg: 100,
    dmgMult: 1.0,
    hitZone: 'generator',
    currentHp: 900,
  });
  assert.ok(Math.abs(bossGen.damage - 220) < 0.001);
  assert.equal(bossGen.isCrit, true);

  const colossusLeg = computeHitDamage({
    enemyType: 'boss',
    rawDmg: 100,
    dmgMult: 1.0,
    hitZone: 'weakpoint',
    currentHp: 1125,
  });
  assert.equal(colossusLeg.damage, 200);
  assert.equal(colossusLeg.isCrit, true);

  // درع الدرونات للمهندس يقلّص الضرر إلى 45% حتى تدمير الدرونات
  const shieldedBoss = computeHitDamage({
    enemyType: 'boss',
    rawDmg: 100,
    dmgMult: 1.0,
    hitZone: 'body',
    currentHp: 900,
    bossShieldActive: true,
  });
  assert.equal(shieldedBoss.damage, 45);
  assert.equal(shieldedBoss.isShieldBlock, true);

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

test('دوران الزعماء الثلاثة كل 5 موجات ومراحلهم وصحتهم المتوازنة', () => {
  assert.deepEqual(BOSS_ROTATION, ['engineer', 'swarm_queen', 'colossus']);
  assert.equal(pickBossArchetypeForWave(5), 'engineer');
  assert.equal(pickBossArchetypeForWave(10), 'swarm_queen');
  assert.equal(pickBossArchetypeForWave(15), 'colossus');
  assert.equal(pickBossArchetypeForWave(20), 'engineer');

  assert.equal(getBossArchetypeMeta('engineer').name, 'المهندس المدرّع');
  assert.equal(getBossArchetypeMeta('swarm_queen').name, 'ملكة السرب الطائرة');
  assert.equal(getBossArchetypeMeta('colossus').name, 'العملاق الجبار');

  assert.equal(computeBossMaxHp(5, 'engineer'), 900);
  assert.ok(computeBossMaxHp(15, 'colossus') > computeBossMaxHp(15, 'engineer'));
  assert.equal(computeBossPhase(900, 900), 1);
  assert.equal(computeBossPhase(550, 900), 2);
  assert.equal(computeBossPhase(250, 900), 3);

  assert.equal(computeWaveEnemyCount(1), 8);
  assert.equal(computeWaveEnemyCount(4), 17);
  assert.equal(computeWaveEnemyCount(5), 1);
  assert.equal(PLAYER_CONSTANTS.MAX_ENEMIES, 14);
  assert.equal(PLAYER_CONSTANTS.SWARM_PACK_SIZE, 6);
  assert.equal(PLAYER_CONSTANTS.SWARM_DRONE_HP, 15);
});

test('توزيع الأعداء حسب رقم الموجة (بما فيها الأعداء الطائرون الأربعة) ومكافآت سلسلة القتل', () => {
  assert.equal(pickEnemyTypeForWave(1, 0.2), 'rusher');
  assert.equal(pickEnemyTypeForWave(1, 0.7), 'trooper');
  assert.equal(pickEnemyTypeForWave(1, 0.95), 'swarm_drone');
  assert.equal(pickEnemyTypeForWave(2, 0.92), 'kamikaze');
  assert.equal(pickEnemyTypeForWave(3, 0.9), 'gunship');
  assert.equal(pickEnemyTypeForWave(4, 0.3), 'swarm_drone');
  assert.equal(pickEnemyTypeForWave(4, 0.37), 'kamikaze');
  assert.equal(pickEnemyTypeForWave(4, 0.45), 'gunship');
  assert.equal(pickEnemyTypeForWave(4, 0.53), 'flying_sniper');
  assert.equal(pickEnemyTypeForWave(4, 0.77), 'jammer');
  assert.equal(pickEnemyTypeForWave(4, 0.85), 'ghost');

  assert.equal(getKillStreakReward(4), null);
  assert.equal(getKillStreakReward(5)?.effect, 'shield_overcharge');
  assert.equal(getKillStreakReward(10)?.effect, 'tactical_resupply');
  assert.equal(getKillStreakReward(15)?.effect, 'fury_overdrive');
});

test('توليد أعداء النخبة بدءاً من الموجة 6 بنسبة 15% لغير الباس مع الصفات الأربع', () => {
  assert.equal(rollEliteAffix(5, false, 0.01, 0.0), null);
  assert.equal(rollEliteAffix(10, true, 0.01, 0.0), null);
  assert.equal(rollEliteAffix(6, false, 0.15, 0.0), null);

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

  assert.equal(computeEffectiveGravity(undefined, false), 1.0);
  assert.equal(computeEffectiveGravity(0.48, false), 0.48);
  assert.equal(computeEffectiveGravity(undefined, true), 0.45);
  assert.ok(computeEffectiveGravity(0.48, true) < 0.45 && computeEffectiveGravity(0.48, true) >= 0.32);

  assert.equal(computeEffectiveFogDensity(0.005, null, false), 0.005);
  assert.equal(computeEffectiveFogDensity(0.005, 0.028, false), 0.028);
  assert.equal(computeEffectiveFogDensity(0.005, 0.028, true), 0.048);
});

test('تدرّج حساسية الماوس مع مستويات التكبير (x4/x8/x12) وحبس النفس 3ث مع تهدئة والبالستية الواقعية', () => {
  // إعداد البالستية الواقعية معطّل افتراضياً
  assert.equal(DEFAULT_SETTINGS.realisticBallistics, false);

  // حساسية الماوس تنخفض تناسبياً كلما ارتفع التكبير (انخفضت زاوية الرؤية FOV)
  const sensHip = computeZoomSensitivityMultiplier(75, 75);
  const sens4x = computeZoomSensitivityMultiplier(22, 75);
  const sens8x = computeZoomSensitivityMultiplier(12, 75);
  const sens12x = computeZoomSensitivityMultiplier(7.5, 75);
  assert.equal(sensHip, 1);
  assert.ok(sens4x < sensHip && sens8x < sens4x && sens12x < sens8x);
  assert.ok(sens12x >= 0.06);

  // حبس النفس يقلّص الاهتزاز، ينفد عند 3 ثوانٍ بالضبط ويدخل تهدئة تمنع إعادة التفعيل
  let breath = {
    remaining: PLAYER_CONSTANTS.HOLD_BREATH_MAX_DURATION,
    cooldown: 0,
    recoverDelay: 0,
    isHolding: false,
  };
  let step = stepHoldBreathState(breath, 1.5, true, true);
  assert.equal(step.next.isHolding, true);
  assert.equal(step.swayMult, PLAYER_CONSTANTS.HOLD_BREATH_SWAY_MULT);
  assert.ok(Math.abs(step.next.remaining - 1.5) < 0.001);

  // استهلاك بقية الـ 3 ثوانٍ يدخل فترة التهدئة
  step = stepHoldBreathState(step.next, 1.5, true, true);
  assert.equal(step.next.isHolding, false);
  assert.equal(step.next.cooldown, PLAYER_CONSTANTS.HOLD_BREATH_COOLDOWN);
  assert.equal(step.swayMult, 1.0);

  // أثناء التهدئة لا يعمل حبس النفس حتى تنتهي التهدئة
  step = stepHoldBreathState(step.next, 2.0, true, true);
  assert.equal(step.next.isHolding, false);
  assert.ok(step.next.cooldown > 0);

  // بعد انتهاء التهدئة يعود النفس كاملاً وقابلاً للاستخدام
  step = stepHoldBreathState(step.next, 2.1, true, false);
  assert.equal(step.next.cooldown, 0);
  assert.equal(step.next.remaining, PLAYER_CONSTANTS.HOLD_BREATH_MAX_DURATION);

  // فيزياء المقذوف الواقعي للقناصة: انتقال مع زمن الوصول وسقوط خفيف بالجاذبية
  const p0 = { x: 0, y: 2, z: 0 };
  const v0 = { x: 0, y: 0, z: -200 };
  const moved = stepBallisticProjectile(p0, v0, 8.0, 0.5);
  assert.equal(moved.nextPos.z, -100);
  assert.equal(moved.nextVel.y, -4.0);
  assert.equal(moved.nextPos.y, 1.0); // 2 - 0.5 * 8 * 0.5^2 = 1.0
});

test('قواعد حرارة M134 ميني غان (سخونة زائدة عند 100 وتبريد إجباري 2.5ث) وتقليص ضرر الباس 30%', () => {
  // تسخين تدريجي مع الطلقات ثم تبريد طبيعي عند التوقف
  let heatState = { heat: 0, overheated: false, overheatTimer: 0, coolDelay: 0 };
  heatState = stepMinigunHeat(heatState, 0, 20, 2.5);
  assert.equal(heatState.heat, 50);
  assert.equal(heatState.overheated, false);

  // انتظار مهلة التبريد ثم التبريد التدريجي
  heatState = stepMinigunHeat(heatState, PLAYER_CONSTANTS.MINIGUN_HEAT_COOL_DELAY, 0);
  assert.equal(heatState.heat, 50);
  heatState = stepMinigunHeat(heatState, 1.0, 0);
  assert.ok(heatState.heat < 50 && heatState.heat > 0);

  // الوصول إلى 100 يفعّل السخونة الزائدة مع تبريد إجباري 2.5 ثانية
  heatState = stepMinigunHeat({ heat: 96, overheated: false, overheatTimer: 0, coolDelay: 0 }, 0, 2, 2.5);
  assert.equal(heatState.overheated, true);
  assert.equal(heatState.heat, 100);
  assert.equal(heatState.overheatTimer, PLAYER_CONSTANTS.MINIGUN_OVERHEAT_COOLDOWN);

  // أثناء التبريد الإجباري لا يمكن الإطلاق وتتراجع الحرارة تدريجياً حتى 2.5ث
  heatState = stepMinigunHeat(heatState, 1.25, 5, 2.5);
  assert.equal(heatState.overheated, true);
  assert.ok(Math.abs(heatState.overheatTimer - 1.25) < 0.001);
  assert.ok(Math.abs(heatState.heat - 50) < 0.01);

  heatState = stepMinigunHeat(heatState, 1.25, 0, 2.5);
  assert.equal(heatState.overheated, false);
  assert.equal(heatState.overheatTimer, 0);
  assert.equal(heatState.heat, 0);

  // تقليص ضرر الميني غان ضد الباس بنسبة 30% (0.7x) دون التأثير على الأعداء العاديين
  const normalHit = computeHitDamage({
    enemyType: 'trooper',
    rawDmg: 10,
    dmgMult: 1,
    hitZone: 'body',
    currentHp: 100,
    weaponBossDamageMult: PLAYER_CONSTANTS.MINIGUN_BOSS_DAMAGE_MULT,
  });
  assert.equal(normalHit.damage, 10);

  const bossHit = computeHitDamage({
    enemyType: 'boss',
    rawDmg: 10,
    dmgMult: 1,
    hitZone: 'body',
    currentHp: 900,
    weaponBossDamageMult: PLAYER_CONSTANTS.MINIGUN_BOSS_DAMAGE_MULT,
  });
  assert.ok(Math.abs(bossHit.damage - 7) < 0.001);
});

test('حالة الاحتراق (8 ضرر/ث لمدة 3ث تُجدّد دون تكديس) ووقود ومخروط قاذف اللهب (مدى 9م وزاوية 60°)', () => {
  // تطبيق الاحتراق يضبط المؤقت على 3 ثوانٍ؛ وتكرار تطبيقه يجدّده دون تكديس فوق 3 ثوانٍ
  let burnTimer = applyBurnStatus(0);
  assert.equal(burnTimer, 3.0);
  const tick1 = stepBurnStatus(burnTimer, 1.0);
  assert.equal(tick1.damage, 8);
  assert.equal(tick1.nextTimer, 2.0);
  assert.equal(tick1.burning, true);

  // إعادة التطبيق تجدّد المدة إلى 3.0ث ولا تكدّسها إلى 5.0ث
  burnTimer = applyBurnStatus(tick1.nextTimer);
  assert.equal(burnTimer, 3.0);

  // استهلاك كامل المدة (3ث) يلحق 24 ضرراً بالضبط (8 × 3) حتى لو كانت dt أكبر من المتبقي
  const tickFinish = stepBurnStatus(burnTimer, 4.5);
  assert.equal(tickFinish.damage, 24);
  assert.equal(tickFinish.nextTimer, 0);
  assert.equal(tickFinish.burning, false);

  // استهلاك وقود قاذف اللهب بمعدل 20/ث والتجدد من الاحتياطي عند التوقف
  let fuelState = { fuel: 100, reserve: 100, regenDelay: 0 };
  const fireStep = stepFlamethrowerFuel(fuelState, 2.0, true);
  assert.equal(fireStep.activeFireDt, 2.0);
  assert.equal(fireStep.next.fuel, 60);

  // التوقف عن الإطلاق ينتظر مهلة قصيرة ثم يشحن من الاحتياطي
  const waitStep = stepFlamethrowerFuel(fireStep.next, PLAYER_CONSTANTS.FLAME_FUEL_REGEN_DELAY, false);
  assert.equal(waitStep.next.fuel, 60);
  const regenStep = stepFlamethrowerFuel(waitStep.next, 1.0, false);
  assert.equal(regenStep.next.fuel, 60 + PLAYER_CONSTANTS.FLAME_FUEL_REGEN_PER_SEC);
  assert.equal(regenStep.next.reserve, 100 - PLAYER_CONSTANTS.FLAME_FUEL_REGEN_PER_SEC);

  // مخروط اللهب: مدى 9 وحدات، زاوية 60 درجة (نصف زاوية 30 درجة)
  const origin = { x: 0, y: 1.75, z: 0 };
  const forward = { x: 0, y: 0, z: -1 };
  assert.equal(isPointInFlameCone(origin, forward, { x: 0, y: 1.75, z: -8.5 }), true);
  assert.equal(isPointInFlameCone(origin, forward, { x: 0, y: 1.75, z: -9.5 }), false); // خارج مدى 9م
  // عند زاوية 25° داخل المخروط (<= 30°)، وعند 40° خارج المخروط (> 30°)
  assert.equal(isPointInFlameCone(origin, forward, { x: 2.3, y: 1.75, z: -5.0 }), true);
  assert.equal(isPointInFlameCone(origin, forward, { x: 4.5, y: 1.75, z: -5.0 }), false);
  assert.equal(isPointInFlameCone(origin, forward, { x: 0, y: 1.75, z: 3.0 }), false); // خلف اللاعب

  // الدرع الأمامي للعدو المدرَّع يظل يحجب 80% من ضرر اللهب
  const flameVsShield = computeHitDamage({
    enemyType: 'shielded',
    rawDmg: 25,
    dmgMult: 1,
    hitZone: 'shield',
    currentHp: 160,
  });
  assert.equal(flameVsShield.damage, 5);
  assert.equal(flameVsShield.isShieldBlock, true);
});

test('قواعد وضع تحدي الزعماء: دوران الزعماء الأربعة وتدرج الصحة ×1.35 والضرر ×1.15 لكل دورة', () => {
  assert.deepEqual(BOSS_RUSH_ROTATION, ['titan', 'engineer', 'swarm_queen', 'colossus']);
  assert.equal(getBossArchetypeMeta('titan').name, 'تيتان أوميغا');

  // الدورة الأولى (الزعماء 1-4)
  assert.equal(pickBossRushArchetype(1), 'titan');
  assert.equal(pickBossRushArchetype(2), 'engineer');
  assert.equal(pickBossRushArchetype(3), 'swarm_queen');
  assert.equal(pickBossRushArchetype(4), 'colossus');

  // الدورة الثانية (الزعماء 5-8) تعيد نفس الترتيب مع مضاعفات ×1.35 صحة و×1.15 ضرر
  assert.equal(pickBossRushArchetype(5), 'titan');
  assert.equal(pickBossRushArchetype(6), 'engineer');
  assert.equal(pickBossRushArchetype(7), 'swarm_queen');
  assert.equal(pickBossRushArchetype(8), 'colossus');

  assert.equal(computeBossRushCycle(1), 0);
  assert.equal(computeBossRushCycle(4), 0);
  assert.equal(computeBossRushCycle(5), 1);
  assert.equal(computeBossRushCycle(8), 1);
  assert.equal(computeBossRushCycle(9), 2);

  const cycle0 = computeBossRushScaling(1);
  assert.equal(cycle0.cycle, 0);
  assert.equal(cycle0.hpMult, 1);
  assert.equal(cycle0.dmgMult, 1);

  const cycle1 = computeBossRushScaling(5);
  assert.equal(cycle1.cycle, 1);
  assert.ok(Math.abs(cycle1.hpMult - 1.35) < 1e-6);
  assert.ok(Math.abs(cycle1.dmgMult - 1.15) < 1e-6);

  const cycle2 = computeBossRushScaling(9);
  assert.equal(cycle2.cycle, 2);
  assert.ok(Math.abs(cycle2.hpMult - 1.35 * 1.35) < 1e-6);
  assert.ok(Math.abs(cycle2.dmgMult - 1.15 * 1.15) < 1e-6);

  // التحقق من الصحة المحسوبة لكل زعيم عبر الدورات
  assert.equal(computeBossRushMaxHp(1, 'titan'), 900);
  assert.equal(computeBossRushMaxHp(5, 'titan'), Math.round(900 * 1.35));
  assert.equal(computeBossRushMaxHp(4, 'colossus'), 1125);
  assert.equal(computeBossRushMaxHp(8, 'colossus'), Math.round(1125 * 1.35));
  assert.equal(computeBossRushMaxHp(9, 'titan'), Math.round(900 * 1.35 * 1.35));

  assert.equal(PLAYER_CONSTANTS.BOSS_RUSH_BREAK_DURATION, 12.0);
  assert.equal(PLAYER_CONSTANTS.BOSS_RUSH_HEALTH_RESTORE_RATIO, 0.5);
});

test('تنسيق زمن الجولة وتقييم أفضل سجل منفصل لتحدي الزعماء (أكثر زعماء مهزومين وأسرع زمن)', () => {
  assert.equal(formatRunTimer(0), '00:00');
  assert.equal(formatRunTimer(65), '01:05');
  assert.equal(formatRunTimer(609.8), '10:09');

  // مفاتيح التخزين منفصلة تماماً عن مفاتيح الوضع العادي
  assert.notEqual(STORAGE_KEYS.BOSS_RUSH_BEST_BOSSES, STORAGE_KEYS.BEST_SCORE);
  assert.notEqual(STORAGE_KEYS.BOSS_RUSH_BEST_TIME, STORAGE_KEYS.BEST_WAVE);

  const empty = { bestBosses: 0, bestTimeSec: null };

  // هزيمة 0 زعماء لا تُسجّل رقماً قياسياً
  const r0 = evaluateBossRushRecord(empty, 0, 45);
  assert.equal(r0.isNewRecord, false);
  assert.equal(r0.bestBosses, 0);
  assert.equal(r0.bestTimeSec, null);

  // أول جولة ناجحة (3 زعماء خلال 180ث) تسجّل رقماً قياسياً
  const r1 = evaluateBossRushRecord(empty, 3, 180);
  assert.equal(r1.isNewRecord, true);
  assert.equal(r1.bestBosses, 3);
  assert.equal(r1.bestTimeSec, 180);

  // نفس عدد الزعماء بزمن أبطأ لا يكسر الرقم القياسي
  const r2 = evaluateBossRushRecord({ bestBosses: 3, bestTimeSec: 180 }, 3, 210);
  assert.equal(r2.isNewRecord, false);
  assert.equal(r2.bestTimeSec, 180);

  // نفس عدد الزعماء بزمن أسرع يكسر الرقم القياسي
  const r3 = evaluateBossRushRecord({ bestBosses: 3, bestTimeSec: 180 }, 3, 142.4);
  assert.equal(r3.isNewRecord, true);
  assert.equal(r3.bestBosses, 3);
  assert.equal(r3.bestTimeSec, 142.4);

  // عدد زعماء أكبر يتفوق دائماً حتى لو كان الزمن أطول
  const r4 = evaluateBossRushRecord({ bestBosses: 3, bestTimeSec: 142.4 }, 5, 310);
  assert.equal(r4.isNewRecord, true);
  assert.equal(r4.bestBosses, 5);
  assert.equal(r4.bestTimeSec, 310);
});

test('دعم الجوال: عصا التحكم الافتراضية والركض التلقائي وسقف دقة البكسل (1.5) وجودة منخفضة افتراضياً', () => {
  // منطقة ميتة في مركز عصا التحكم
  const dead = computeJoystickInput(3, -3, 50);
  assert.equal(dead.moveX, 0);
  assert.equal(dead.moveZ, 0);
  assert.equal(dead.autoSprint, false);

  // الدفع للأمام بقوة حتى الحافة يفعّل الركض التلقائي ويقيّد المقبض داخل نصف القطر
  const sprintFwd = computeJoystickInput(0, -80, 50);
  assert.ok(Math.abs(sprintFwd.moveX) < 1e-6);
  assert.ok(Math.abs(sprintFwd.moveZ - 1) < 1e-6);
  assert.ok(Math.abs(sprintFwd.knobY + 50) < 1e-6);
  assert.equal(sprintFwd.autoSprint, true);

  // الدفع للخلف بقوة لا يفعّل الركض التلقائي
  const back = computeJoystickInput(0, 80, 50);
  assert.equal(back.moveZ, -1);
  assert.equal(back.autoSprint, false);

  // الدفع الجانبي المتوسط يعطي حركة تناظرية بدون ركض
  const midRight = computeJoystickInput(25, 0, 50);
  assert.ok(midRight.moveX > 0.3 && midRight.moveX < 0.7);
  assert.equal(midRight.autoSprint, false);

  // سقف devicePixelRatio: على الجوال لا يتجاوز 1.5 أبداً
  assert.equal(computeEffectivePixelRatio(3, 'high', true, false), 1.5);
  assert.equal(computeEffectivePixelRatio(3, 'low', true, false), 1.25);
  assert.equal(computeEffectivePixelRatio(1, 'high', true, false), 1);
  // على الحاسوب: حتى 2 للجودة العالية و1 للمنخفضة أو Software WebGL
  assert.equal(computeEffectivePixelRatio(3, 'high', false, false), 2);
  assert.equal(computeEffectivePixelRatio(2, 'low', false, false), 1);
  assert.equal(computeEffectivePixelRatio(3, 'high', false, true), 1);

  // الإعدادات الافتراضية على الأجهزة اللمسية تختار الجودة المنخفضة تلقائياً
  const mobileDefaults = loadSettings(true);
  assert.equal(mobileDefaults.quality, 'low');
  assert.equal(mobileDefaults.touchSensitivity, DEFAULT_SETTINGS.touchSensitivity);
  assert.equal(mobileDefaults.touchButtonSize, 'medium');

  const desktopDefaults = loadSettings(false);
  assert.equal(desktopDefaults.quality, 'high');
});
