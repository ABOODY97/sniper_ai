import { useGameStore } from '../game/store';

/* ==========================================
   شاشة الإيقاف المؤقت (Esc / P)
   ========================================== */

export function Pause() {
  const screen = useGameStore((s) => s.screen);
  const wave = useGameStore((s) => s.wave);
  const score = useGameStore((s) => s.score);
  const activeMapName = useGameStore((s) => s.activeMapName);
  const engineActions = useGameStore((s) => s.engineActions);
  const setSettingsOpen = useGameStore((s) => s.setSettingsOpen);

  if (screen !== 'paused') return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/82 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="إيقاف مؤقت"
    >
      <div
        data-ui-interactive="true"
        className="w-full max-w-md rounded-xl bg-slate-900 border border-sky-500/40 p-6 shadow-2xl flex flex-col gap-5 text-center"
      >
        <div>
          <h2 className="text-3xl font-black text-slate-50">إيقاف مؤقت</h2>
          <p className="mt-1 text-sm font-bold text-slate-400">
            {activeMapName} · الموجة {wave} · النقاط <span className="text-amber-400 hud-nums">{score}</span>
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => engineActions?.resumeMission()}
            className="w-full py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-lg cursor-pointer transition-colors"
          >
            متابعة المهمة
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-bold text-base cursor-pointer transition-colors"
          >
            الإعدادات
          </button>
          <button
            type="button"
            onClick={() => engineActions?.restartMission()}
            className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-base cursor-pointer transition-colors"
          >
            إعادة المحاولة
          </button>
          <button
            type="button"
            onClick={() => engineActions?.returnToMainMenu()}
            className="w-full py-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-sm cursor-pointer transition-colors"
          >
            العودة للقائمة الرئيسية
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-right text-xs text-slate-300 bg-slate-950/75 rounded-lg p-3 border border-slate-800">
          <div><b className="text-sky-400">WASD</b> : الحركة</div>
          <div><b className="text-sky-400">Shift + W</b> : ركض سريع</div>
          <div><b className="text-sky-400">C / Ctrl</b> : تزحلق</div>
          <div><b className="text-sky-400">Q</b> : اندفاع سريع</div>
          <div><b className="text-sky-400">G</b> : رمي قنبلة يدوية</div>
          <div><b className="text-sky-400">Space</b> : قفز / قفزة تزحلق</div>
          <div><b className="text-sky-400">R</b> : إعادة التلقيم</div>
          <div><b className="text-sky-400">1 - 7</b> : تبديل السلاح</div>
        </div>
      </div>
    </div>
  );
}
