import type { MapDefinition } from '../types';

/* ==========================================
   خريطة المدينة المدمرة — مبانٍ عالية وسطوح قنص قابلة للصعود
   ========================================== */

export const CITY_MAP: MapDefinition = {
  id: 'city',
  name: 'مدينة مدمرة',
  tag: '104 × 104 — سطوح قنص',
  description: 'مبانٍ عالية، ممرات ضيقة، وسطوح يمكن الصعود إليها بإضاءة برتقالية وضباب كثيف.',
  size: 104,
  bg: 0x1e120c,
  fogColor: 0x29170e,
  fogDensity: 0.0145,
  hemiSky: 0xfb923c,
  hemiGround: 0x1c1917,
  hemiIntensity: 0.65,
  dirColor: 0xfdba74,
  dirIntensity: 0.95,
  dirPos: [-35, 50, -30],
  radarScale: 1.52,
  dustColor: 0xa8a29e,
  wallHeight: 14,
  outdoor: true,
  stars: false,
  lights: [
    { pos: [-18, 7, -18], color: 0xf97316, intensity: 2.2, dist: 48 },
    { pos: [18, 7, 18], color: 0xf97316, intensity: 2.2, dist: 48 },
    { pos: [-18, 7, 18], color: 0xea580c, intensity: 2.0, dist: 48 },
    { pos: [18, 7, -18], color: 0xea580c, intensity: 2.0, dist: 48 },
    { pos: [0, 10, 0], color: 0xf59e0b, intensity: 1.4, dist: 40 },
  ],
  layout: [
    [-36, -36, 10, 22, 10],
    [36, -36, 10, 19, 10],
    [-36, 36, 10, 20, 10],
    [36, 36, 10, 24, 10],
    [-11, -24, 3, 12, 12],
    [11, -24, 3, 11, 12],
    [-11, 24, 3, 11, 12],
    [11, 24, 3, 13, 12],
    [-34, 0, 8, 15, 6],
    [34, 0, 8, 16, 6],
    [0, -10, 6, 2.2, 2],
    [0, 10, 6, 2.2, 2],
  ],
  rooftops: [
    [-20, -14, 9, 4.0, 9],
    [20, -14, 9, 4.0, 9],
    [-20, 14, 9, 4.0, 9],
    [20, 14, 9, 4.0, 9],
  ],
  ramps: [
    { x: -20, z: -5.5, w: 3.4, l: 8.0, dir: 'z-', y0: 0, y1: 4.0 },
    { x: 20, z: -5.5, w: 3.4, l: 8.0, dir: 'z-', y0: 0, y1: 4.0 },
    { x: -20, z: 5.5, w: 3.4, l: 8.0, dir: 'z+', y0: 0, y1: 4.0 },
    { x: 20, z: 5.5, w: 3.4, l: 8.0, dir: 'z+', y0: 0, y1: 4.0 },
  ],
  boulders: [],
};
