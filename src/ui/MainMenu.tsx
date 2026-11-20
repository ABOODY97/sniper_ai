import { useGameStore } from '../game/store';
import { MapSelect } from './MapSelect';

/* ==========================================
   القائمة الرئيسية (شاشة البداية)
   تخطيط جانبي تكتيكي يترك معظم الساحة ثلاثية الأبعاد الحية مرئية بوضوح
   ========================================== */

export function MainMenu() {
  const screen = useGameStore((s) => s.screen);
  const selectedMap = useGameStore((s) => s.selectedMap);
  const bestScore = useGameStore((s) => s.bestScore);
  const bestWave = useGameStore((s) => s.bestWave);
  const engineActions = useGameStore((s) => s.engineActions);
  const setSettingsOpen = useGameStore((s) => s.setSettingsOpen);

  if (screen !== 'title') return null;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-5 sm:p-8">
      {/* تدرج خفيف على الجانب الأيمن لضمان تباين القراءة فوق العالم ثلاثي الأبعاد */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background:
            'linear-gradient(270deg, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.72) 38%, rgba(2,6,23,0.16) 72%, rgba(2,6,23,0.08) 100%)',
        }}
      />

      {/* اللوحة الرئيسية على اليمين (RTL) */}
      <div className="flex-1 flex items-center justify-start">
        <div
          data-ui-interactive="true"
          className="pointer-events-auto w-full max-w-[540px] flex flex-col gap-4 bg-slate-950/90 border border-sky-500/35 rounded-xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
        >
          {/* شعار SVG مخصص متكامل مع هوية اللعبة */}
          <div className="flex items-center gap-3.5 border-b border-slate-800 pb-4">
            <svg
              viewBox="0 0 64 64"
              className="w-14 h-14 shrink-0"
              aria-hidden="true"
            >
              <polygon
                points="32,3 58,17 58,47 32,61 6,47 6,17"
                fill="#0b172a"
                stroke="#38bdf8"
                strokeWidth="2.5"
              />
              <circle cx="32" cy="32" r="16" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeDasharray="6 4" />
              <circle cx="32" cy="32" r="7" fill="none" stroke="#f97316" strokeWidth="2" />
              <line x1="32" y1="9" x2="32" y2="21" stroke="#38bdf8" strokeWidth="2.2" />
              <line x1="32" y1="43" x2="32" y2="55" stroke="#38bdf8" strokeWidth="2.2" />
              <line x1="9" y1="32" x2="21" y2="32" stroke="#38bdf8" strokeWidth="2.2" />
              <line x1="43" y1="32" x2="55" y2="32" stroke="#38bdf8" strokeWidth="2.2" />
              <circle cx="32" cy="32" r="2.2" fill="#f8fafc" />
            </svg>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-50 leading-none">
                بروتوكول القنص
              </h1>
              <p className="mt-1.5 text-xs font-bold text-sky-400">
                بقاء الموجات · 9 أسلحة · معارك الزعماء
              </p>
            </div>
          </div>

          {/* السجلات المحفوظة في localStorage */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg bg-slate-900/95 border border-slate-800 px-3.5 py-2.5">
              <div className="text-[11px] font-bold text-slate-400">أعلى نتيجة</div>
              <div className="text-xl font-black text-amber-400 hud-nums">{bestScore}</div>
            </div>
            <div className="rounded-lg bg-slate-900/95 border border-slate-800 px-3.5 py-2.5">
              <div className="text-[11px] font-bold text-slate-400">أعلى موجة</div>
              <div className="text-xl font-black text-sky-400 hud-nums">{bestWave}</div>
            </div>
          </div>

          {/* اختيار الخريطة */}
          <MapSelect />

          {/* أزرار الإجراء الأساسية */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              data-start="true"
              onClick={() => engineActions?.startMission(selectedMap)}
              className="flex-1 py-3 px-5 rounded-lg bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-black text-lg transition-colors cursor-pointer shadow-[0_0_24px_rgba(56,189,248,0.35)]"
            >
              ابدأ المهمة
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-bold text-sm transition-colors cursor-pointer"
            >
              الإعدادات
            </button>
          </div>
        </div>
      </div>

      {/* سطر تلميحات التحكم المسطح أسفل الشاشة */}
      <div className="text-center text-xs font-bold text-slate-300/90 hud-text-stroke">
        WASD حركة · Shift ركض · C تزحلق · Q اندفاع · Space قفز · G قنبلة · R تلقيم · 1-9 أسلحة · Esc إيقاف مؤقت
      </div>
    </div>
  );
}
