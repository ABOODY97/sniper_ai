import { useGameStore } from '../game/store';
import type { TouchButtonSize } from '../game/types';

/* ==========================================
   نافذة الإعدادات — حساسية الماوس، إعدادات اللمس، مستوى الصوت، الكتم،
   جودة الرسوميات (عالية/منخفضة)، وفيزياء الرصاص الواقعية
   ========================================== */

const TOUCH_SIZE_OPTIONS: { id: TouchButtonSize; label: string }[] = [
  { id: 'small', label: 'صغير' },
  { id: 'medium', label: 'متوسط' },
  { id: 'large', label: 'كبير' },
];

export function Settings() {
  const settingsOpen = useGameStore((s) => s.settingsOpen);
  const settings = useGameStore((s) => s.settings);
  const setSettingsOpen = useGameStore((s) => s.setSettingsOpen);
  const updateSettings = useGameStore((s) => s.updateSettings);

  if (!settingsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="إعدادات اللعبة"
    >
      <div
        data-ui-interactive="true"
        className="w-full max-w-md max-h-[92vh] overflow-y-auto touch-scroll rounded-xl bg-slate-900 border border-sky-500/40 p-5 sm:p-6 shadow-2xl flex flex-col gap-4"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-xl sm:text-2xl font-black text-slate-50">الإعدادات</h2>
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            aria-label="إغلاق الإعدادات"
            className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* حساسية الماوس */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm font-bold">
            <label htmlFor="sensitivity-slider" className="text-slate-200">
              حساسية الماوس
            </label>
            <span className="text-sky-400 hud-nums">{settings.sensitivity.toFixed(1)}</span>
          </div>
          <input
            id="sensitivity-slider"
            type="range"
            min={0.5}
            max={2.5}
            step={0.1}
            value={settings.sensitivity}
            onChange={(e) => updateSettings({ sensitivity: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>

        {/* إعدادات الجوال واللمس: حساسية اللمس وحجم الأزرار */}
        <div className="flex flex-col gap-3 pt-2 border-t border-slate-800/80">
          <div className="text-xs font-extrabold text-sky-400">إعدادات الجوال واللمس</div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm font-bold">
              <label htmlFor="touch-sensitivity-slider" className="text-slate-200">
                حساسية اللمس
              </label>
              <span className="text-sky-400 hud-nums">{settings.touchSensitivity.toFixed(1)}</span>
            </div>
            <input
              id="touch-sensitivity-slider"
              type="range"
              min={0.4}
              max={3.0}
              step={0.1}
              value={settings.touchSensitivity}
              onChange={(e) => updateSettings({ touchSensitivity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-slate-200">حجم أزرار اللمس</span>
            <div className="grid grid-cols-3 gap-2">
              {TOUCH_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  data-touch-size={opt.id}
                  onClick={() => updateSettings({ touchButtonSize: opt.id })}
                  className={`py-2 rounded-lg border text-xs sm:text-sm font-extrabold cursor-pointer transition-colors ${
                    settings.touchButtonSize === opt.id
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* مستوى الصوت والكتم */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-sm font-bold">
            <label htmlFor="volume-slider" className="text-slate-200">
              مستوى الصوت
            </label>
            <span className="text-sky-400 hud-nums">
              {settings.muted ? 'مكتوم' : `${Math.round(settings.volume * 100)}%`}
            </span>
          </div>
          <input
            id="volume-slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            disabled={settings.muted}
            onChange={(e) => updateSettings({ volume: parseFloat(e.target.value) })}
            className="w-full"
          />
          <div className="flex items-center justify-between pt-1">
            <span className="text-sm font-bold text-slate-300">كتم جميع الأصوات</span>
            <button
              type="button"
              onClick={() => updateSettings({ muted: !settings.muted })}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold border cursor-pointer transition-colors ${
                settings.muted
                  ? 'bg-red-950 border-red-500 text-red-300'
                  : 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {settings.muted ? 'الصوت مكتوم (تفعيل)' : 'الصوت مفعل (كتم)'}
            </button>
          </div>
        </div>

        {/* جودة الرسوميات */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
          <span className="text-sm font-bold text-slate-200">جودة الرسوميات</span>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => updateSettings({ quality: 'high' })}
              className={`py-2.5 rounded-lg border text-sm font-extrabold cursor-pointer transition-colors ${
                settings.quality === 'high'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              عالية (ظلال وتفاصيل)
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ quality: 'low' })}
              className={`py-2.5 rounded-lg border text-sm font-extrabold cursor-pointer transition-colors ${
                settings.quality === 'low'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              منخفضة (أداء أسرع)
            </button>
          </div>
        </div>

        {/* فيزياء الرصاص الواقعية للقناصات (معطّلة افتراضياً) */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="block text-sm font-bold text-slate-200">
                فيزياء الرصاص الواقعية (القناصات)
              </span>
              <span className="block text-[11px] font-medium text-slate-400">
                زمن وصول للطلقة وانحناء خفيف بالجاذبية لأسلحة القنص
              </span>
            </div>
            <button
              type="button"
              aria-pressed={settings.realisticBallistics}
              onClick={() =>
                updateSettings({ realisticBallistics: !settings.realisticBallistics })
              }
              className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-extrabold border cursor-pointer transition-colors ${
                settings.realisticBallistics
                  ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                  : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {settings.realisticBallistics ? 'مفعّل (بالستية واقعية)' : 'معطّل (إصابة فورية)'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSettingsOpen(false)}
          className="mt-1 w-full py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-base cursor-pointer transition-colors"
        >
          حفظ وإغلاق
        </button>
      </div>
    </div>
  );
}
