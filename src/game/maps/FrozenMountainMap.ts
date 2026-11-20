import type { MapDefinition } from '../types';

/* ==========================================
   خريطة الجبل المتجمد (200 × 200)
   ثلوج، خطوط رؤية بعيدة جداً، سواتر صخرية جليدية،
   وضباب خفيف مع عواصف ثلجية دورية تخفض مدى الرؤية
   ========================================== */

export const FROZEN_MOUNTAIN_MAP: MapDefinition = {
  id: 'mountain',
  name: 'الجبل المتجمد',
  tag: '200 × 200 — عواصف ثلجية',
  description: 'مرتفعات ثلجية شاسعة بخطوط قنص طويلة وسواتر صخرية، مع ضباب خفيف وعواصف ثلجية تقلّل الرؤية.',
  size: 200,
  bg: 0x1c3147,
  fogColor: 0x8fb2cf,
  fogDensity: 0.005,
  hemiSky: 0xe0f2fe,
  hemiGround: 0x334155,
  hemiIntensity: 0.96,
  dirColor: 0xf8fafc,
  dirIntensity: 1.22,
  dirPos: [55, 72, -65],
  radarScale: 0.82,
  dustColor: 0xe2e8f0,
  wallHeight: 11,
  outdoor: true,
  stars: false,
  particleScale: 0.55,
  snowstorm: {
    intervalMin: 18,
    intervalMax: 28,
    duration: 9,
    stormFogDensity: 0.028,
  },
  lights: [
    { pos: [0, 36, 0], color: 0xbae6fd, intensity: 1.2, dist: 155 },
    { pos: [-55, 22, -55], color: 0x38bdf8, intensity: 1.1, dist: 110 },
    { pos: [55, 22, 55], color: 0x7dd3fc, intensity: 1.1, dist: 110 },
  ],
  layout: [
    // سواتر صخرية ومصدات رياح جليدية تحافظ على خطوط رؤية طويلة
    [0, -34, 14, 3.2, 3.6],
    [0, 42, 14, 3.2, 3.6],
    [-38, -4, 4.2, 3.5, 13],
    [38, 4, 4.2, 3.5, 13],
    [-64, -56, 12, 4.2, 4.5],
    [64, -56, 12, 4.2, 4.5],
    [-64, 56, 12, 4.2, 4.5],
    [64, 56, 12, 4.2, 4.5],
  ],
  rooftops: [],
  ramps: [],
  boulders: [
    [-24, -22, 3.4],
    [26, -24, 3.6],
    [-26, 26, 3.5],
    [24, 28, 3.3],
    [-52, -32, 5.2],
    [54, -30, 5.5],
    [-54, 34, 5.0],
    [52, 36, 5.3],
    [-16, -68, 4.8],
    [18, -72, 4.6],
    [-18, 70, 4.9],
    [20, 72, 4.5],
    [-78, 0, 5.8],
    [78, 0, 5.6],
    [-76, -74, 6.2],
    [76, -74, 6.0],
    [-76, 74, 6.0],
    [76, 74, 6.2],
  ],
};
