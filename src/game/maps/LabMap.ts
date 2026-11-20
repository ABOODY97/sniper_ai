import type { MapDefinition } from '../types';

/* ==========================================
   خريطة المختبر — ساحة خيال علمي متوازنة بإضاءة نيون
   ========================================== */

export const LAB_MAP: MapDefinition = {
  id: 'lab',
  name: 'المختبر',
  tag: '96 × 96 — متوازنة',
  description: 'ساحة خيال علمي بإضاءة نيون وسواتر تكتيكية متوازنة وممرات واضحة.',
  size: 96,
  bg: 0x060b16,
  fogColor: 0x060b16,
  fogDensity: 0.0155,
  hemiSky: 0x38bdf8,
  hemiGround: 0x0f172a,
  hemiIntensity: 0.72,
  dirColor: 0xe0f2fe,
  dirIntensity: 1.0,
  dirPos: [30, 55, 25],
  radarScale: 1.65,
  dustColor: 0x94a3b8,
  wallHeight: 10,
  outdoor: false,
  stars: true,
  lights: [
    { pos: [-25, 8, -25], color: 0x0ea5e9, intensity: 1.8, dist: 46 },
    { pos: [25, 8, 25], color: 0x0ea5e9, intensity: 1.8, dist: 46 },
    { pos: [-25, 8, 25], color: 0x8b5cf6, intensity: 1.6, dist: 46 },
    { pos: [25, 8, -25], color: 0x8b5cf6, intensity: 1.6, dist: 46 },
  ],
  layout: [
    [-16, -16, 4.5, 7, 4.5],
    [16, -16, 4.5, 7, 4.5],
    [-16, 16, 4.5, 7, 4.5],
    [16, 16, 4.5, 7, 4.5],
    [0, -24, 12, 3.6, 2.5],
    [0, 24, 12, 3.6, 2.5],
    [-24, 0, 2.5, 3.6, 12],
    [24, 0, 2.5, 3.6, 12],
    [-8, 0, 2.5, 2.4, 5],
    [8, 0, 2.5, 2.4, 5],
    [-32, -32, 5, 8, 5],
    [32, -32, 5, 8, 5],
    [-32, 32, 5, 8, 5],
    [32, 32, 5, 8, 5],
  ],
  rooftops: [],
  ramps: [],
  boulders: [],
};
