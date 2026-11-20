import { useGameStore } from '../game/store';
import { computeComboMultiplier } from '../game/rules';
import { Radar } from './Radar';
import { BossBar } from './BossBar';

/* ==========================================
   واجهة اللعب الحية (HUD)
   تستخدم pointer-events-none للحفاظ على مركز الشاشة حراً بنسبة > 85%
   وبدون أي backdrop-filter فوق مشهد WebGL
   ========================================== */

export function HUD() {
  const screen = useGameStore((s) => s.screen);
  const activeMapName = useGameStore((s) => s.activeMapName);
  const wave = useGameStore((s) => s.wave);
  const enemiesLeft = useGameStore((s) => s.enemiesLeft);
  const score = useGameStore((s) => s.score);

  const health = useGameStore((s) => s.health);
  const maxHealth = useGameStore((s) => s.maxHealth);
  const shield = useGameStore((s) => s.shield);
  const maxShield = useGameStore((s) => s.maxShield);
  const stamina = useGameStore((s) => s.stamina);
  const maxStamina = useGameStore((s) => s.maxStamina);
  const staminaExhausted = useGameStore((s) => s.staminaExhausted);
  const isSliding = useGameStore((s) => s.isSliding);
  const slideCooldown = useGameStore((s) => s.slideCooldown);
  const dashCooldown = useGameStore((s) => s.dashCooldown);
  const dashCooldownBase = useGameStore((s) => s.dashCooldownBase);

  const grenades = useGameStore((s) => s.grenades);
  const maxGrenades = useGameStore((s) => s.maxGrenades);
  const killStreak = useGameStore((s) => s.killStreak);
  const furyTimer = useGameStore((s) => s.furyTimer);

  const weaponName = useGameStore((s) => s.weaponName);
  const weaponRole = useGameStore((s) => s.weaponRole);
  const ammoMag = useGameStore((s) => s.ammoMag);
  const ammoReserve = useGameStore((s) => s.ammoReserve);
  const reloadHint = useGameStore((s) => s.reloadHint);
  const weaponSlots = useGameStore((s) => s.weaponSlots);

  const crosshairSpread = useGameStore((s) => s.crosshairSpread);
  const showScope = useGameStore((s) => s.showScope);
  const thermalScope = useGameStore((s) => s.thermalScope);
  const hitmarkerVisible = useGameStore((s) => s.hitmarkerVisible);
  const hitmarkerCrit = useGameStore((s) => s.hitmarkerCrit);
  const damageFlash = useGameStore((s) => s.damageFlash);
  const slowMoActive = useGameStore((s) => s.slowMoActive);

  const comboCount = useGameStore((s) => s.comboCount);
  const comboRatio = useGameStore((s) => s.comboRatio);
  const bannerText = useGameStore((s) => s.bannerText);
  const bannerColor = useGameStore((s) => s.bannerColor);
  const bannerVisible = useGameStore((s) => s.bannerVisible);
  const empDisabledTimer = useGameStore((s) => s.empDisabledTimer);
  const activeMutator = useGameStore((s) => s.activeMutator);
  const mutatorBannerVisible = useGameStore((s) => s.mutatorBannerVisible);
  const snowstormActive = useGameStore((s) => s.snowstormActive);
  const mapLowGravity = useGameStore((s) => s.mapLowGravity);
  const killFeed = useGameStore((s) => s.killFeed);

  const muted = useGameStore((s) => s.settings.muted);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const engineActions = useGameStore((s) => s.engineActions);

  if (screen !== 'playing') return null;

  const shieldPct = Math.max(0, Math.min(100, (shield / Math.max(1, maxShield)) * 100));
  const healthPct = Math.max(0, Math.min(100, (health / Math.max(1, maxHealth)) * 100));
  const staminaPct = Math.max(0, Math.min(100, (stamina / Math.max(1, maxStamina)) * 100));
  const dashPct =
    dashCooldown <= 0 ? 100 : Math.max(0, (1 - dashCooldown / Math.max(0.1, dashCooldownBase)) * 100);
  const lowHp = health <= maxHealth * 0.25;

  const staminaLabel = isSliding
    ? 'تزحلق!'
    : slideCooldown > 0
      ? `${stamina} | تزحلق ${slideCooldown.toFixed(1)}ث`
      : staminaExhausted
        ? `${stamina} (مرهق)`
        : `${stamina}`;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* وميض الضرر وانخفاض الصحة */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-150"
        style={{
          boxShadow: 'inset 0 0 115px rgba(239, 68, 68, 0.85)',
          opacity: damageFlash ? 1 : lowHp ? 0.38 : 0,
        }}
      />

      {/* تأثير اللقطة البطيئة للقنص بعيد المدى */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-150"
        style={{
          boxShadow: 'inset 0 0 130px rgba(56, 189, 248, 0.65)',
          backgroundColor: 'rgba(56, 189, 248, 0.06)',
          opacity: slowMoActive ? 1 : 0,
        }}
      />

      {/* تأثير تشويش EMP على حواف الشاشة عند إصابة اللاعب بنبضة المشوِّش */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-150"
        style={{
          boxShadow: 'inset 0 0 110px rgba(192, 132, 252, 0.7)',
          backgroundColor: 'rgba(88, 28, 135, 0.08)',
          opacity: empDisabledTimer > 0 ? 1 : 0,
        }}
      />

      {/* تأثير صقيع خفيف على حواف الشاشة أثناء العاصفة الثلجية في الجبل المتجمد */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          boxShadow: 'inset 0 0 120px rgba(186, 230, 253, 0.45)',
          backgroundColor: 'rgba(186, 230, 253, 0.05)',
          opacity: snowstormActive ? 1 : 0,
        }}
      />

      {/* منظار القناصة العادي والحراري */}
      {showScope && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: thermalScope
              ? 'radial-gradient(circle at center, rgba(249, 115, 22, 0.14) 0%, rgba(234, 88, 12, 0.24) 31%, rgba(12, 5, 2, 0.97) 33%)'
              : 'radial-gradient(circle at center, transparent 32%, rgba(0, 0, 0, 0.96) 33%)',
          }}
        >
          <div className="absolute top-1/2 left-0 right-0 h-px bg-red-500/70" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-red-500/70" />
          <div
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[64vmin] h-[64vmin] rounded-full border-2 ${
              thermalScope
                ? 'border-orange-400/90 shadow-[0_0_25px_rgba(251,146,60,0.35)]'
                : 'border-sky-400/50'
            }`}
          />
          {thermalScope && (
            <div className="absolute top-[22%] left-1/2 -translate-x-1/2 text-xs font-black text-orange-400 tracking-widest">
              منظار حراري خارق · اختراق 3 أهداف
            </div>
          )}
        </div>
      )}

      {/* أعلى اليسار: الرادار + عداد الكومبو */}
      <div className="fixed top-4 left-4 flex flex-col items-start gap-2.5">
        <Radar />
        {comboCount >= 2 && comboRatio > 0 && (
          <div className="w-[168px] rounded-lg bg-slate-950/90 border border-amber-500 px-3 py-2 shadow-[0_0_18px_rgba(245,158,11,0.3)]">
            <div className="flex items-baseline justify-between font-black text-amber-300 text-sm mb-1">
              <span>سلسلة {comboCount}</span>
              <span className="text-orange-400 text-xl hud-nums">
                x{computeComboMultiplier(comboCount)}
              </span>
            </div>
            <div className="w-full h-1.5 rounded bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${Math.max(0, Math.min(100, comboRatio * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* أعلى المنتصف: شريط صحة الزعيم */}
      <BossBar />

      {/* أعلى اليمين: إحصائيات الموجة والنقاط + أزرار الصوت والإيقاف المؤقت */}
      <div className="fixed top-4 right-4 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-slate-950/88 border border-sky-500/35 px-4 py-2 shadow-lg">
            <div className="flex items-center gap-4 sm:gap-5">
              <div>
                <span className="block text-[11px] text-slate-400 font-bold">الخريطة</span>
                <span className="text-sm sm:text-base font-extrabold text-sky-300">{activeMapName}</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-bold">الموجة</span>
                <span className="text-lg font-black text-sky-400 hud-nums">{wave}</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-bold">الأعداء</span>
                <span className="text-lg font-black text-red-400 hud-nums">{enemiesLeft}</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-bold">النقاط</span>
                <span className="text-lg font-black text-amber-400 hud-nums">{score}</span>
              </div>
              {killStreak > 0 && (
                <div>
                  <span className="block text-[11px] text-slate-400 font-bold">سلسلة القتل</span>
                  <span className="text-lg font-black text-emerald-400 hud-nums">{killStreak}</span>
                </div>
              )}
            </div>
          </div>

          {/* أزرار الخدمات السريعة (كتم الصوت + إيقاف مؤقت) */}
          <div data-ui-interactive="true" className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'تفعيل الصوت' : 'كتم الصوت'}
              title="كتم / تفعيل الصوت (M)"
              onClick={(e) => {
                e.currentTarget.blur();
                updateSettings({ muted: !muted });
              }}
              className="w-10 h-10 rounded-lg bg-slate-950/88 border border-slate-700 hover:border-sky-400 flex items-center justify-center text-slate-200 cursor-pointer"
            >
              {muted ? (
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-sky-300" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="إيقاف مؤقت"
              title="إيقاف مؤقت (Esc / P)"
              onClick={(e) => {
                e.currentTarget.blur();
                engineActions?.pauseMission();
              }}
              className="w-10 h-10 rounded-lg bg-slate-950/88 border border-slate-700 hover:border-sky-400 flex items-center justify-center text-slate-200 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-100" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            </button>
          </div>
        </div>

        {/* مؤشرات معدِّل الموجة والطقس والجاذبية في صف مستقل أسفل الشريط العلوي لمنع تداخله مع شريط الزعيم */}
        {(activeMutator || snowstormActive || mapLowGravity) && (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {activeMutator && (
              <div className="rounded-md bg-slate-950/88 border border-slate-700/80 px-2.5 py-1 text-xs font-black">
                <span className="text-slate-400 ml-1">معدِّل الموجة:</span>
                <span style={{ color: activeMutator.color }}>🌀 {activeMutator.name}</span>
              </div>
            )}
            {snowstormActive && (
              <div className="rounded-md bg-slate-950/88 border border-cyan-500/40 px-2.5 py-1 text-xs font-black text-cyan-200">
                ❄️ عاصفة ثلجية
              </div>
            )}
            {mapLowGravity && !activeMutator && (
              <div className="rounded-md bg-slate-950/88 border border-indigo-400/40 px-2.5 py-1 text-xs font-black text-indigo-300">
                🪐 جاذبية منخفضة
              </div>
            )}
          </div>
        )}

        {/* سجل الإصابات والقتل */}
        <div className="flex flex-col items-end gap-1.5 mt-1">
          {killFeed.map((item) => (
            <div
              key={item.id}
              className={`kill-feed-item px-3 py-1 rounded bg-slate-950/85 border-r-[3px] text-xs font-bold ${
                item.isHeadshot
                  ? 'border-red-500 text-red-200'
                  : item.isHighlight
                    ? 'border-amber-400 text-amber-200'
                    : 'border-sky-400 text-slate-100'
              }`}
            >
              {item.text}
            </div>
          ))}
        </div>
      </div>

      {/* إعلان الموجة / مكافآت سلسلة القتل */}
      <div
        className="fixed top-[18%] left-1/2 -translate-x-1/2 text-2xl sm:text-4xl font-black text-center whitespace-nowrap transition-opacity duration-300 hud-text-stroke"
        style={{
          color: bannerColor,
          opacity: bannerVisible ? 1 : 0,
        }}
      >
        {bannerText}
      </div>

      {/* إعلان معدِّل الموجة بالعربية لمدة 4 ثوانٍ (من الموجة 3 وكل 3 موجات) */}
      {activeMutator && mutatorBannerVisible && (
        <div
          className="fixed top-[27%] left-1/2 -translate-x-1/2 rounded-xl bg-slate-950/92 border-2 px-6 py-3 text-center shadow-2xl max-w-[90vw]"
          style={{ borderColor: activeMutator.color }}
        >
          <div className="text-xs font-extrabold text-slate-300 mb-0.5">🌀 معدِّل الموجة النشط</div>
          <div className="text-xl sm:text-2xl font-black" style={{ color: activeMutator.color }}>
            {activeMutator.name}
          </div>
          <div className="text-xs sm:text-sm font-bold text-slate-200 mt-1">
            {activeMutator.description}
          </div>
        </div>
      )}

      {/* تنبيه تعطيل المنظار والرادار أثناء نبضة الـ EMP */}
      {empDisabledTimer > 0 && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 rounded-lg bg-slate-950/92 border border-fuchsia-400 px-4 py-1.5 text-center shadow-lg">
          <span className="text-xs sm:text-sm font-black text-fuchsia-300">
            ⚡ تشويش EMP — المنظار والرادار معطّلان ({empDisabledTimer.toFixed(1)}ث)
          </span>
        </div>
      )}

      {/* مؤشر التصويب المركزي الديناميكي */}
      {!showScope && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div
            className="absolute w-[2px] h-[10px] -left-[1px] bottom-[6px] bg-sky-300 shadow-[0_0_4px_#000]"
            style={{ transform: `translateY(${-crosshairSpread}px)` }}
          />
          <div
            className="absolute w-[2px] h-[10px] -left-[1px] top-[6px] bg-sky-300 shadow-[0_0_4px_#000]"
            style={{ transform: `translateY(${crosshairSpread}px)` }}
          />
          <div
            className="absolute w-[10px] h-[2px] -top-[1px] right-[6px] bg-sky-300 shadow-[0_0_4px_#000]"
            style={{ transform: `translateX(${-crosshairSpread}px)` }}
          />
          <div
            className="absolute w-[10px] h-[2px] -top-[1px] left-[6px] bg-sky-300 shadow-[0_0_4px_#000]"
            style={{ transform: `translateX(${crosshairSpread}px)` }}
          />
          <div className="absolute w-[3px] h-[3px] rounded-full bg-white -left-[1.5px] -top-[1.5px]" />
        </div>
      )}

      {/* مؤشر إصابة الهدف (Hitmarker) */}
      <div
        className="fixed top-1/2 left-1/2 w-[26px] h-[26px] -translate-x-1/2 -translate-y-1/2 rotate-45 pointer-events-none transition-opacity duration-100"
        style={{ opacity: hitmarkerVisible ? 1 : 0 }}
      >
        <div
          className={`absolute top-[12px] left-0 w-[26px] h-[2px] ${
            hitmarkerCrit ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-white'
          }`}
        />
        <div
          className={`absolute left-[12px] top-0 w-[2px] h-[26px] ${
            hitmarkerCrit ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-white'
          }`}
        />
      </div>

      {/* أسفل اليمين: الدرع، الصحة، الطاقة/التزحلق، الاندفاع (Q)، القنابل (G)، ونمط الغضب */}
      <div className="fixed bottom-5 right-5 w-[290px] rounded-xl bg-slate-950/88 border border-sky-500/30 p-3.5 shadow-xl flex flex-col gap-2">
        {furyTimer > 0 && (
          <div className="flex items-center justify-between px-2.5 py-1 rounded bg-orange-950/90 border border-orange-400 text-xs font-black text-orange-300">
            <span>🔥 نمط الغضب (+35% ضرر)</span>
            <span className="hud-nums">{furyTimer.toFixed(1)}ث</span>
          </div>
        )}

        <div>
          <div className="flex justify-between text-xs font-bold mb-1">
            <span className="text-slate-300">الدرع المتجدد</span>
            <span className="text-sky-400 hud-nums">
              {shield} / {maxShield}
            </span>
          </div>
          <div className="w-full h-2.5 rounded bg-slate-800 overflow-hidden">
            <div className="h-full bg-sky-400 transition-[width] duration-75" style={{ width: `${shieldPct}%` }} />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs font-bold mb-1">
            <span className="text-slate-300">الصحة</span>
            <span className="text-red-400 hud-nums">
              {health} / {maxHealth}
            </span>
          </div>
          <div className="w-full h-2.5 rounded bg-slate-800 overflow-hidden">
            <div className="h-full bg-red-500 transition-[width] duration-75" style={{ width: `${healthPct}%` }} />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[11px] font-bold mb-1">
            <span className="text-slate-400">الطاقة (Shift ركض | C تزحلق)</span>
            <span className={staminaExhausted ? 'text-orange-400 hud-nums' : 'text-emerald-400 hud-nums'}>
              {staminaLabel}
            </span>
          </div>
          <div className="w-full h-1.5 rounded bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-[width] duration-75 ${
                staminaExhausted ? 'bg-orange-500' : 'bg-emerald-400'
              }`}
              style={{ width: `${staminaPct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <div>
            <div className="flex justify-between text-[11px] font-bold mb-1">
              <span className="text-slate-400">اندفاع [Q]</span>
              <span className="text-amber-400 hud-nums">
                {dashCooldown <= 0 ? 'جاهز' : `${dashCooldown.toFixed(1)}ث`}
              </span>
            </div>
            <div className="w-full h-1.5 rounded bg-slate-800 overflow-hidden">
              <div className="h-full bg-amber-400 transition-[width] duration-75" style={{ width: `${dashPct}%` }} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded bg-slate-900 border border-slate-700/80 px-2.5 py-1">
            <span className="text-[11px] font-bold text-slate-300">قنابل [G]</span>
            <span className="text-sm font-black text-emerald-400 hud-nums">
              {grenades} / {maxGrenades}
            </span>
          </div>
        </div>
      </div>

      {/* أسفل اليسار: السلاح الحالي، الذخيرة، ومفاتيح الأسلحة 1-7 */}
      <div className="fixed bottom-5 left-5 w-[356px] rounded-xl bg-slate-950/88 border border-sky-500/30 p-3.5 shadow-xl">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <div className="text-sm font-black text-sky-300 truncate">{weaponName}</div>
          <div className="text-[11px] font-bold text-slate-400 shrink-0">{weaponRole}</div>
        </div>

        <div className="flex items-baseline justify-between leading-none mb-1" dir="ltr">
          <span className="text-4xl font-black text-slate-50 hud-nums">{ammoMag}</span>
          <span className="text-lg font-bold text-slate-400 hud-nums">/ {ammoReserve}</span>
        </div>

        <div className="h-4 text-xs font-bold text-amber-400 text-right">{reloadHint}</div>

        <div className="grid grid-cols-4 gap-1 mt-2">
          {weaponSlots.map((slot) => (
            <div
              key={slot.id}
              className={`text-center py-1 px-1 rounded text-[10px] font-bold whitespace-nowrap border ${
                slot.active
                  ? 'bg-sky-500/25 border-sky-400 text-white'
                  : slot.unlocked
                    ? 'bg-slate-800/80 border-transparent text-slate-300'
                    : 'bg-slate-900/80 border-dashed border-slate-700 text-slate-500'
              }`}
            >
              {slot.unlocked ? slot.shortName : `🔒${slot.shortName}`}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
