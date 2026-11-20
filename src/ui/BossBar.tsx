import { useGameStore } from '../game/store';

/* ==========================================
   شريط صحة الزعيم (الباس) أعلى منتصف الشاشة مع شارة المرحلة ونقاط الضعف
   ========================================== */

export function BossBar() {
  const boss = useGameStore((s) => s.boss);

  if (!boss.active) return null;

  const pct = Math.max(0, Math.min(100, (boss.hp / Math.max(1, boss.maxHp)) * 100));

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-10 w-[min(500px,45vw)] rounded-xl bg-slate-950/92 border-2 px-4 py-2 ${
        boss.shielded
          ? 'border-sky-400/90 shadow-[0_0_28px_rgba(56,189,248,0.4)]'
          : 'border-red-500/80 shadow-[0_0_28px_rgba(239,68,68,0.35)]'
      }`}
      role="status"
      aria-label="شريط صحة الزعيم"
    >
      <div className="flex items-center justify-between gap-2 mb-1 font-black text-sm sm:text-base">
        <span className="text-red-300">☠️ {boss.name}</span>
        <div className="flex items-center gap-1.5">
          {boss.shielded && (
            <span className="px-2 py-0.5 rounded bg-sky-950 border border-sky-400 text-sky-300 text-[11px]">
              🛡️ درع الدرونات
            </span>
          )}
          <span className="px-2.5 py-0.5 rounded bg-red-950 border border-red-500/80 text-yellow-300 text-xs">
            المرحلة {boss.phase} / 3
          </span>
        </div>
        <span className="text-red-400 hud-nums">
          {boss.hp} / {boss.maxHp}
        </span>
      </div>

      <div className="w-full h-3.5 rounded-md bg-slate-900 border border-slate-700 overflow-hidden">
        <div
          className="h-full transition-[width] duration-100 ease-out"
          style={{
            width: `${pct}%`,
            background: boss.shielded
              ? 'linear-gradient(90deg, #0369a1, #38bdf8, #7dd3fc)'
              : 'linear-gradient(90deg, #991b1b, #ef4444, #f97316)',
          }}
        />
      </div>

      {boss.subtitle && (
        <div className="mt-1 text-[11px] font-bold text-slate-300/95 text-center truncate">
          {boss.subtitle}
        </div>
      )}
    </div>
  );
}
