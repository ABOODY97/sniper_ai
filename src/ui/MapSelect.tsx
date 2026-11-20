import type { MapId } from '../game/types';
import { MAP_LIST } from '../game/maps/MapManager';
import { useGameStore } from '../game/store';

/* ==========================================
   مكوّن اختيار الخريطة (6 ساحات معركة متنوعة)
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
  mountain: {
    border: 'border-cyan-300',
    bg: 'bg-cyan-950/75',
    tagBg: 'bg-cyan-400/20',
    tagText: 'text-cyan-200',
  },
  port: {
    border: 'border-yellow-400',
    bg: 'bg-yellow-950/70',
    tagBg: 'bg-yellow-500/20',
    tagText: 'text-yellow-300',
  },
  station: {
    border: 'border-indigo-400',
    bg: 'bg-indigo-950/80',
    tagBg: 'bg-indigo-500/20',
    tagText: 'text-indigo-300',
  },
};

function MapGlyph({ id }: { id: MapId }) {
  if (id === 'lab') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-sky-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 3h6M10 3v6.5L5.2 18.4A2 2 0 0 0 7 21h10a2 2 0 0 0 1.8-2.6L14 9.5V3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.5 15.5h9" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === 'city') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-orange-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 21h18M5 21V9l4-2v14M11 21V5l5-2v18M18 21v-8l2-1v9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.5 9h1M13.5 13h1M7 13h.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === 'desert') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="17" cy="7" r="3" />
        <path d="M2 19c4-3 7-3 11 0s6 3 9 0M4 15l4.5-4.5L13 15l3-3 4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === 'mountain') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-cyan-300 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 20L10 6l4.5 8 2.5-3.5L21 20H3z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.6 10.8L10 12.2l2.1-1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === 'port') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-yellow-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 20h18M5 20V5h12M17 5v5M5 9l4-4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="11" y="13" width="9" height="7" rx="1" />
        <path d="M14 13v7M17 13v7" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-24 12 12)" />
      <circle cx="19" cy="6" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function MapSelect() {
  const selectedMap = useGameStore((s) => s.selectedMap);
  const setSelectedMap = useGameStore((s) => s.setSelectedMap);

  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label="اختيار ساحة المعركة">
      <div className="flex items-center justify-between text-xs font-bold tracking-wide text-slate-400">
        <span>اختر ساحة المعركة</span>
        <span className="text-sky-400/90">6 خرائط</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
              className={`w-full text-right rounded-lg border px-3 py-2 transition-colors cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? `${accent.border} ${accent.bg} shadow-[0_0_18px_rgba(14,165,233,0.22)]`
                  : 'border-slate-700/80 bg-slate-900/85 hover:border-slate-500 hover:bg-slate-800/90'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapGlyph id={map.id} />
                    <span className="font-extrabold text-[13px] text-slate-100 truncate">{map.name}</span>
                  </div>
                </div>
                <div className="mt-1">
                  <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${accent.tagBg} ${accent.tagText}`}>
                    {map.tag}
                  </span>
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-300/90 leading-snug">{map.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
