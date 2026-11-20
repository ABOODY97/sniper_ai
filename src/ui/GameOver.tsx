import { useGameStore } from '../game/store';
import { formatRunTimer } from '../game/rules';

/* ==========================================
   شاشة نهاية المعركة مع ملخص الأداء والرقم القياسي المحفوظ
   ========================================== */

export function GameOver() {
  const screen = useGameStore((s) => s.screen);
  const summary = useGameStore((s) => s.endSummary);
  const engineActions = useGameStore((s) => s.engineActions);

  if (screen !== 'gameover' || !summary) return null;

  const isBossRush = summary.mode === 'boss_rush';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="نهاية المعركة"
    >
      <div
        data-ui-interactive="true"
        className="w-full max-w-lg rounded-xl bg-slate-900 border border-red-500/45 p-6 sm:p-7 shadow-2xl text-center flex flex-col gap-5"
      >
        <div>
          {isBossRush && (
            <div className="mb-1.5 text-xs font-black text-amber-400">
              ⚔️ تحدي الزعماء (Boss Rush)
            </div>
          )}
          <h2 className="text-4xl font-black text-red-400">سقطت في المعركة</h2>
          <p className="mt-1.5 text-sm font-bold text-slate-300">
            {summary.isNewRecord
              ? '🏆 رقم قياسي جديد! أداء بطولي استثنائي!'
              : 'أداء شجاع في ساحة القتال — هل أنت مستعد لمحاولة جديدة؟'}
          </p>
        </div>

        {isBossRush ? (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-3">
                <div className="text-xs font-bold text-slate-400">الزعماء المهزومون</div>
                <div className="text-2xl font-black text-emerald-400 hud-nums">
                  {summary.bossKills}
                </div>
              </div>
              <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-3">
                <div className="text-xs font-bold text-slate-400">الزمن الكلي</div>
                <div className="text-2xl font-black text-amber-400 hud-nums" dir="ltr">
                  {formatRunTimer(summary.runTimeSec ?? 0)}
                </div>
              </div>
              <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-3">
                <div className="text-xs font-bold text-slate-400">إصابات الرأس</div>
                <div className="text-2xl font-black text-red-400 hud-nums">{summary.headshots}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs font-bold">
              <div className="rounded-lg bg-slate-800/70 px-3 py-2 flex justify-between">
                <span className="text-slate-400">أكثر زعماء مهزومين</span>
                <span className="text-emerald-300 hud-nums">
                  {summary.bossRushBestBosses ?? 0}
                </span>
              </div>
              <div className="rounded-lg bg-slate-800/70 px-3 py-2 flex justify-between">
                <span className="text-slate-400">أسرع زمن محفوظ</span>
                <span className="text-amber-300 hud-nums" dir="ltr">
                  {summary.bossRushBestTimeSec != null
                    ? formatRunTimer(summary.bossRushBestTimeSec)
                    : '--:--'}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-3">
                <div className="text-xs font-bold text-slate-400">النقاط</div>
                <div className="text-2xl font-black text-amber-400 hud-nums">{summary.score}</div>
              </div>
              <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-3">
                <div className="text-xs font-bold text-slate-400">الموجة</div>
                <div className="text-2xl font-black text-sky-400 hud-nums">{summary.wave}</div>
              </div>
              <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-3">
                <div className="text-xs font-bold text-slate-400">إصابات الرأس</div>
                <div className="text-2xl font-black text-red-400 hud-nums">{summary.headshots}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs font-bold">
              <div className="rounded-lg bg-slate-800/70 px-3 py-2 flex justify-between">
                <span className="text-slate-400">أعلى نتيجة محفوظة</span>
                <span className="text-amber-300 hud-nums">{summary.bestScore}</span>
              </div>
              <div className="rounded-lg bg-slate-800/70 px-3 py-2 flex justify-between">
                <span className="text-slate-400">أعلى موجة محفوظة</span>
                <span className="text-sky-300 hud-nums">{summary.bestWave}</span>
              </div>
            </div>
          </>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            data-start="true"
            onClick={() => engineActions?.restartMission()}
            className="flex-1 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-lg cursor-pointer transition-colors"
          >
            إعادة المحاولة
          </button>
          <button
            type="button"
            onClick={() => engineActions?.returnToMainMenu()}
            className="py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-sm cursor-pointer transition-colors"
          >
            القائمة الرئيسية
          </button>
        </div>
      </div>
    </div>
  );
}
