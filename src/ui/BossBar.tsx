import { useGameStore } from '../game/store';

/* ==========================================
   شريط صحة الزعيم (الباس) أعلى منتصف الشاشة مع شارة المرحلة
   ========================================== */

export function BossBar() {
  const boss = useGameStore((s) => s.boss);

  if (!boss.active) return null;

  const pct = Math.max(0, Math.min(100, (boss.hp / Math.max(1, boss.maxHp)) * 100));

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-10 w-[min(560px,54vw)] rounded-xl bg-slate-950/92 border-2 border-red-500/80 px-4 py-2.5 shadow-[0_0_28px_rgba(239,68,68,0.35)]"
      role="status"
      aria-label="شريط صحة الزعيم"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5 font-black text-sm sm:text-base">
        <span className="text-red-300">☠️ {boss.name}</span>
        <span className="px-2.5 py-0.5 rounded bg-red-950 border border-red-500/80 text-yellow-300 text-xs">
          المرحلة {boss.phase} / 3
        </span>
        <span className="text-red-400 hud-nums">
          {boss.hp} / {boss.maxHp}
        </span>
      </div>
      <div className="w-full h-4 rounded-md bg-slate-900 border border-slate-700 overflow-hidden">
        <div
          className="h-full bg-red-500 transition-[width] duration-100 ease-out"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #991b1b, #ef4444, #f97316)',
          }}
        />
      </div>
    </div>
  );
}
