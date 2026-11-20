import { useGameStore } from '../game/store';

/* ==========================================
   شاشة اختيار الترقية (1 من 3) بين الموجات
   ========================================== */

export function UpgradePicker() {
  const screen = useGameStore((s) => s.screen);
  const activeMode = useGameStore((s) => s.activeMode);
  const waveCleared = useGameStore((s) => s.upgradeWaveCleared);
  const bossRushBreakTimer = useGameStore((s) => s.bossRushBreakTimer);
  const options = useGameStore((s) => s.upgradeOptions);
  const engineActions = useGameStore((s) => s.engineActions);

  if (screen !== 'upgrade') return null;

  const isBossRush = activeMode === 'boss_rush';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/90 p-5"
      role="dialog"
      aria-modal="true"
      aria-label="اختيار الترقية"
    >
      <div data-ui-interactive="true" className="w-full max-w-3xl text-center">
        <h2
          className={`text-3xl sm:text-4xl font-black ${
            isBossRush ? 'text-amber-400' : 'text-sky-400'
          }`}
        >
          {isBossRush ? 'استراحة تحدي الزعماء — اختر ترقية' : 'اختر ترقيتك التكتيكية'}
        </h2>
        <p className="mt-2 text-sm sm:text-base text-slate-300 font-bold">
          {isBossRush
            ? `تم إسقاط الزعيم #${waveCleared}! استعادة 50% صحة + إعادة تعبئة كاملة للذخيرة والوقود والحرارة.`
            : `تم تطهير الموجة ${waveCleared}! اختر ترقية واحدة قبل انطلاق الموجة ${waveCleared + 1}`}
        </p>

        {isBossRush && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 border border-emerald-400/60 px-4 py-1.5 text-sm font-black text-emerald-300 hud-nums">
            <span>⏱️ الزعيم #{waveCleared + 1} يبدأ خلال</span>
            <span className="text-amber-300 text-base">{Math.ceil(bossRushBreakTimer)}ث</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          {options.map((upg) => (
            <button
              key={upg.id}
              type="button"
              onClick={() => engineActions?.selectUpgrade(upg.id)}
              className="group rounded-xl bg-slate-900 hover:bg-slate-800 border-2 border-sky-500/35 hover:border-amber-400 p-6 flex flex-col items-center gap-3 transition-transform duration-150 hover:-translate-y-1 cursor-pointer shadow-xl"
            >
              <span className="text-4xl" aria-hidden="true">
                {upg.icon}
              </span>
              <span className="text-lg font-black text-sky-300 group-hover:text-amber-300">
                {upg.title}
              </span>
              <span className="text-xs sm:text-sm text-slate-300 leading-relaxed">{upg.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
