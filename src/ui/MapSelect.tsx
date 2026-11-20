import type { MapId } from '../game/types';
import { MAP_LIST } from '../game/maps/MapManager';
import { useGameStore } from '../game/store';

/* ==========================================
   مكوّن اختيار الخريطة (المختبر، المدينة المدمرة، الصحراء المفتوحة)
   ========================================== */

const MAP_ACCENTS: Record<MapId, { border: string; bg: string; tagBg: string; tagText: string }> = {
  lab: {
    border: 'border-sky-400',
    bg: 'bg-sky-950/80',
    tagBg: 'bg-sky-500/20',
    tagText: 'text-sky-300',
  },
  city: {
    border: 'border-orange-400',
    bg: 'bg-orange-950/75',
    tagBg: 'bg-orange-500/20',
    tagText: 'text-orange-300',
  },
  desert: {
    border: 'border-amber-400',
    bg: 'bg-amber-950/75',
    tagBg: 'bg-amber-500/20',
    tagText: 'text-amber-300',
  },
};

function MapGlyph({ id }: { id: MapId }) {
  if (id === 'lab') {
    return (
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-sky-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 3h6M10 3v6.5L5.2 18.4A2 2 0 0 0 7 21h10a2 2 0 0 0 1.8-2.6L14 9.5V3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.5 15.5h9" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === 'city') {
    return (
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-orange-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 21h18M5 21V9l4-2v14M11 21V5l5-2v18M18 21v-8l2-1v9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.5 9h1M13.5 13h1M7 13h.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="17" cy="7" r="3" />
      <path d="M2 19c4-3 7-3 11 0s6 3 9 0M4 15l4.5-4.5L13 15l3-3 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MapSelect() {
  const selectedMap = useGameStore((s) => s.selectedMap);
  const setSelectedMap = useGameStore((s) => s.setSelectedMap);

  return (
    <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="اختيار ساحة المعركة">
      <div className="text-xs font-bold tracking-wide text-slate-400">اختر ساحة المعركة</div>
      <div className="grid grid-cols-1 gap-2">
        {MAP_LIST.map((map) => {
          const isSelected = selectedMap === map.id;
          const accent = MAP_ACCENTS[map.id];
          return (
            <button
              key={map.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelectedMap(map.id)}
              className={`w-full text-right rounded-lg border px-3.5 py-2.5 transition-colors cursor-pointer ${
                isSelected
                  ? `${accent.border} ${accent.bg} shadow-[0_0_20px_rgba(14,165,233,0.22)]`
                  : 'border-slate-700/80 bg-slate-900/85 hover:border-slate-500 hover:bg-slate-800/90'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <MapGlyph id={map.id} />
                  <span className="font-extrabold text-sm text-slate-100">{map.name}</span>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${accent.tagBg} ${accent.tagText}`}>
                  {map.tag}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-300/90 leading-relaxed">{map.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
