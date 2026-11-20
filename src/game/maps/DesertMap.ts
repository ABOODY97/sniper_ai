import type { MapDefinition } from '../types';

/* ==========================================
   خريطة الصحراء المفتوحة — مدى قنص شاسع وسماء غروب وصخور ضخمة
   ========================================== */

export const DESERT_MAP: MapDefinition = {
  id: 'desert',
  name: 'صحراء مفتوحة',
  tag: '140 × 140 — قنص بعيد',
  description: 'مساحة شاسعة بصخور كبيرة وتكوينات طبيعية وسماء غروب مثالية للقنص بعيد المدى.',
  size: 140,
  bg: 0x452232,
  fogColor: 0x7c3a2d,
  fogDensity: 0.0072,
  hemiSky: 0xfdba74,
  hemiGround: 0x78350f,
  hemiIntensity: 0.9,
  dirColor: 0xffedd5,
  dirIntensity: 1.25,
  dirPos: [0, 42, -85],
  radarScale: 1.15,
  dustColor: 0xd9a066,
  wallHeight: 9,
  outdoor: true,
  stars: false,
  sunsetSun: true,
  lights: [{ pos: [0, 28, -55], color: 0xf97316, intensity: 1.7, dist: 120 }],
  layout: [
    [-26, 0, 5, 3.2, 10],
    [26, 0, 5, 3.2, 10],
    [0, -34, 12, 3.5, 4],
    [0, 34, 12, 3.5, 4],
  ],
  rooftops: [],
  ramps: [],
  boulders: [
    [-42, -38, 4.8],
    [44, -40, 5.2],
    [-45, 36, 5.0],
    [42, 42, 4.6],
    [-16, -50, 3.6],
    [18, 52, 3.8],
    [-54, -4, 4.5],
    [54, 8, 4.4],
    [-18, 22, 3.0],
    [20, -22, 3.1],
  ],
};
