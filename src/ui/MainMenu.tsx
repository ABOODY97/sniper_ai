import { useGameStore } from '../game/store';
import { formatRunTimer } from '../game/rules';
import { MapSelect } from './MapSelect';

/* ==========================================
   القائمة الرئيسية (شاشة البداية)
   تخطيط جانبي تكتيكي يترك معظم الساحة ثلاثية الأبعاد الحية مرئية بوضوح
   ========================================== */

function toggleFullscreenMenu(): void {
  try {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (typeof doc.exitFullscreen === 'function') {
        doc.exitFullscreen().catch(() => {});
      } else if (typeof doc.webkitExitFullscreen === 'function') {
        doc.webkitExitFullscreen();
      }
    } else if (typeof el.requestFullscreen === 'function') {
      el.requestFullscreen().catch(() => {});
    } else if (typeof el.webkitRequestFullscreen === 'function') {
      el.webkitRequestFullscreen();
    }
  } catch {
    // تجاهل
  }
}

export function MainMenu() {
  const screen = useGameStore((s) => s.screen);
  const isTouchDevice = useGameStore((s) => s.isTouchDevice);
  const selectedMode = useGameStore((s) => s.selectedMode);
  const setSelectedMode = useGameStore((s) => s.setSelectedMode);
  const selectedMap = useGameStore((s) => s.selectedMap);
  const bestScore = useGameStore((s) => s.bestScore);
  const bestWave = useGameStore((s) => s.bestWave);
  const bossRushBestBosses = useGameStore((s) => s.bossRushBestBosses);
  const bossRushBestTimeSec = useGameStore((s) => s.bossRushBestTimeSec);
  const engineActions = useGameStore((s) => s.engineActions);
  const setSettingsOpen = useGameStore((s) => s.setSettingsOpen);

  if (screen !== 'title') return null;

  const isBossRush = selectedMode === 'boss_rush';

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-8">
      {/* تدرج خفيف على الجانب الأيمن لضمان تباين القراءة فوق العالم ثلاثي الأبعاد */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background:
            'linear-gradient(270deg, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.72) 38%, rgba(2,6,23,0.16) 72%, rgba(2,6,23,0.08) 100%)',
        }}
      />

      {/* اللوحة الرئيسية على اليمين (RTL) مع دعم التمرير على شاشات الجوال الأفقية القصيرة */}
      <div className="flex-1 min-h-0 flex items-center justify-start">
        <div
          data-ui-interactive="true"
          className="pointer-events-auto w-full max-w-[540px] max-h-full overflow-y-auto touch-scroll flex flex-col gap-3 sm:gap-3.5 bg-slate-950/90 border border-sky-500/35 rounded-xl p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
        >
          {/* شعار SVG مخصص متكامل مع هوية اللعبة */}
          <div className="flex items-center gap-3.5 border-b border-slate-800 pb-3.5">
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

          {/* اختيار وضع اللعب: الوضع العادي مقابل تحدي الزعماء (Boss Rush) */}
          <div className="flex flex-col gap-1.5">
            <div className="text-xs font-bold text-slate-300">اختر وضع اللعب</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-mode="normal"
                onClick={() => setSelectedMode('normal')}
                className={`text-right rounded-lg p-2.5 border transition-colors cursor-pointer ${
                  !isBossRush
                    ? 'bg-sky-950/90 border-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.22)]'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-black text-slate-50">الوضع العادي</span>
                  <span className="text-[10px] font-extrabold text-sky-300">موجات</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
                  بقاء متصاعد وزعيم كل 5 موجات لفتح الأسلحة
                </p>
              </button>

              <button
                type="button"
                data-mode="boss_rush"
                onClick={() => setSelectedMode('boss_rush')}
                className={`text-right rounded-lg p-2.5 border transition-colors cursor-pointer ${
                  isBossRush
                    ? 'bg-red-950/85 border-red-400 shadow-[0_0_18px_rgba(239,68,68,0.28)]'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-black text-slate-50">تحدي الزعماء</span>
                  <span className="text-[10px] font-extrabold text-amber-300">Boss Rush</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
                  كل الأسلحة مفتوحة · زعماء متتالون · استراحة 12ث وترقية
                </p>
              </button>
            </div>
          </div>

          {/* السجلات المحفوظة في localStorage (منفصلة لكل وضع) */}
          {isBossRush ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg bg-slate-900/95 border border-red-500/30 px-3.5 py-2">
                <div className="text-[11px] font-bold text-slate-400">أكثر زعماء مهزومين</div>
                <div className="text-xl font-black text-red-400 hud-nums">{bossRushBestBosses}</div>
              </div>
              <div className="rounded-lg bg-slate-900/95 border border-amber-500/30 px-3.5 py-2">
                <div className="text-[11px] font-bold text-slate-400">أسرع زمن لأفضل إنجاز</div>
                <div className="text-xl font-black text-amber-400 hud-nums" dir="ltr">
                  {bossRushBestTimeSec !== null ? formatRunTimer(bossRushBestTimeSec) : '--:--'}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg bg-slate-900/95 border border-slate-800 px-3.5 py-2">
                <div className="text-[11px] font-bold text-slate-400">أعلى نتيجة</div>
                <div className="text-xl font-black text-amber-400 hud-nums">{bestScore}</div>
              </div>
              <div className="rounded-lg bg-slate-900/95 border border-slate-800 px-3.5 py-2">
                <div className="text-[11px] font-bold text-slate-400">أعلى موجة</div>
                <div className="text-xl font-black text-sky-400 hud-nums">{bestWave}</div>
              </div>
            </div>
          )}

          {/* اختيار الخريطة */}
          <MapSelect />

          {/* أزرار الإجراء الأساسية */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              data-start="true"
              onClick={() => engineActions?.startMission(selectedMap, selectedMode)}
              className={`flex-1 py-2.5 sm:py-3 px-4 sm:px-5 rounded-lg font-black text-base sm:text-lg transition-colors cursor-pointer ${
                isBossRush
                  ? 'bg-red-500 hover:bg-red-400 active:bg-red-600 text-slate-950 shadow-[0_0_24px_rgba(239,68,68,0.4)]'
                  : 'bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 shadow-[0_0_24px_rgba(56,189,248,0.35)]'
              }`}
            >
              {isBossRush ? 'ابدأ تحدي الزعماء' : 'ابدأ المهمة'}
            </button>
            <button
              type="button"
              data-testid="menu-settings-btn"
              onClick={() => setSettingsOpen(true)}
              className="py-2.5 sm:py-3 px-3.5 sm:px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              الإعدادات
            </button>
            <button
              type="button"
              data-testid="menu-fullscreen-btn"
              onClick={toggleFullscreenMenu}
              title="ملء الشاشة"
              className="py-2.5 sm:py-3 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sky-300 font-bold text-xs sm:text-sm transition-colors cursor-pointer shrink-0"
            >
              ملء الشاشة
            </button>
          </div>
        </div>
      </div>

      {/* سطر تلميحات التحكم المسطح أسفل الشاشة */}
      <div className="text-center text-[11px] sm:text-xs font-bold text-slate-300/90 hud-text-stroke pt-1">
        {isTouchDevice
          ? 'عصا يسار للحركة والركض التلقائي · سحب يمين للنظر · أزرار اللمس للإطلاق والتصويب والقفز والتزحلق والاندفاع'
          : 'WASD حركة · Shift ركض · C تزحلق · Q اندفاع · Space قفز · G قنبلة · R تلقيم · 1-9 أسلحة · Esc إيقاف مؤقت'}
      </div>
    </div>
  );
}
