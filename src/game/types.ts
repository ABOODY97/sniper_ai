import * as THREE from 'three';

/* ==========================================
   الأنواع والواجهات المشتركة لمحرك اللعبة
   ========================================== */

export type GameScreenState = 'title' | 'playing' | 'paused' | 'upgrade' | 'gameover';

export type MapId = 'lab' | 'city' | 'desert' | 'mountain' | 'port' | 'station';

export type QualityLevel = 'high' | 'low';

export type EnemyTypeId =
  | 'rusher'
  | 'trooper'
  | 'heavy'
  | 'sniper'
  | 'drone'
  | 'shielded'
  | 'mortar'
  | 'jammer'
  | 'ghost'
  | 'boss';

export type EliteAffixId = 'explosive' | 'swift' | 'regenerating' | 'armored';

export type WaveMutatorId = 'heavy_fog' | 'low_gravity' | 'fast_fragile' | 'double_headshot';

export interface WaveMutatorInfo {
  id: WaveMutatorId;
  name: string;
  description: string;
  color: string;
}

export type HitZone = 'body' | 'head' | 'shield' | 'generator';

export interface ObstacleBox {
  x: number;
  z: number;
  hx: number;
  hz: number;
  h: number;
  baseY?: number;
}

export interface PlatformBox {
  x: number;
  z: number;
  hx: number;
  hz: number;
  topY: number;
}

export interface RampDef {
  x: number;
  z: number;
  hx: number;
  hz: number;
  dir: 'z+' | 'z-' | 'x+' | 'x-';
  y0: number;
  y1: number;
}

export interface MapLightDef {
  pos: [number, number, number];
  color: number;
  intensity: number;
  dist: number;
}

export interface SnowstormConfig {
  intervalMin: number;
  intervalMax: number;
  duration: number;
  stormFogDensity: number;
}

export interface ContainerDef {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  baseY?: number;
  color: number;
  climbable?: boolean;
}

export interface MapDefinition {
  id: MapId;
  name: string;
  tag: string;
  description: string;
  size: number;
  bg: number;
  fogColor: number;
  fogDensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  dirColor: number;
  dirIntensity: number;
  dirPos: [number, number, number];
  radarScale: number;
  dustColor: number;
  wallHeight: number;
  outdoor?: boolean;
  stars?: boolean;
  sunsetSun?: boolean;
  gravityMult?: number;
  particleScale?: number;
  snowstorm?: SnowstormConfig;
  lights: MapLightDef[];
  layout: [number, number, number, number, number][];
  rooftops: [number, number, number, number, number][];
  containers?: ContainerDef[];
  ramps: Array<{
    x: number;
    z: number;
    w: number;
    l: number;
    dir: 'z+' | 'z-' | 'x+' | 'x-';
    y0: number;
    y1: number;
  }>;
  boulders: [number, number, number][];
}

export interface WeaponConfig {
  id: number;
  key: string;
  name: string;
  shortName: string;
  roleHint: string;
  auto: boolean;
  unlockedByDefault: boolean;
  fireRate: number;
  dmg: number;
  headDmg: number;
  pellets: number;
  baseMagSize: number;
  baseMaxReserve: number;
  reloadTime: number;
  spread: number;
  adsSpread: number;
  recoilKick: number;
  gunKick: number;
  adsFov: number;
  color: number;
  sfx: string;
  isSniper?: boolean;
  isThermal?: boolean;
  isRocket?: boolean;
  splashRadius?: number;
  pierceCount?: number;
  restPos: THREE.Vector3;
  adsPos: THREE.Vector3;
}

export interface WeaponSlotUI {
  id: number;
  shortName: string;
  unlocked: boolean;
  active: boolean;
}

export interface UpgradeOption {
  id: string;
  icon: string;
  title: string;
  desc: string;
}

export interface KillFeedItem {
  id: number;
  text: string;
  isHeadshot: boolean;
  isHighlight?: boolean;
}

export interface BossHudState {
  active: boolean;
  name: string;
  phase: 1 | 2 | 3;
  hp: number;
  maxHp: number;
}

export interface RadarEntity {
  x: number;
  z: number;
  color: string;
  kind: 'enemy' | 'heavy' | 'drone' | 'boss' | 'pickup_health' | 'pickup_ammo' | 'mortar';
  radius?: number;
}

export interface RadarSnapshot {
  playerX: number;
  playerZ: number;
  yaw: number;
  scale: number;
  platforms: PlatformBox[];
  entities: RadarEntity[];
}

export interface GameSettings {
  sensitivity: number;
  volume: number;
  muted: boolean;
  quality: QualityLevel;
}

export interface EndRunSummary {
  score: number;
  bestScore: number;
  wave: number;
  bestWave: number;
  headshots: number;
  kills: number;
  bossKills: number;
  isNewRecord: boolean;
}
