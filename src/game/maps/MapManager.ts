import * as THREE from 'three';
import type { ContainerDef, MapDefinition, MapId, ObstacleBox, PlatformBox, RampDef } from '../types';
import { LAB_MAP } from './LabMap';
import { CITY_MAP } from './CityMap';
import { DESERT_MAP } from './DesertMap';
import { FROZEN_MOUNTAIN_MAP } from './FrozenMountainMap';
import { INDUSTRIAL_PORT_MAP } from './IndustrialPortMap';
import { SPACE_STATION_MAP } from './SpaceStationMap';
import { createMapTextures, disposeMapTextures, type MapTextureBundle } from './MapTextures';
import { computeEffectiveFogDensity } from '../rules';

/* ==========================================
   مدير الخرائط — يبني الهندسة ثلاثية الأبعاد والإضاءة والتصادمات لكل الخرائط الست
   مع دعم الحاويات المكدّسة والرافعات والعواصف الثلجية وتحسين الظلال في الخرائط الكبيرة
   ========================================== */

export const ALL_MAPS: Record<MapId, MapDefinition> = {
  lab: LAB_MAP,
  city: CITY_MAP,
  desert: DESERT_MAP,
  mountain: FROZEN_MOUNTAIN_MAP,
  port: INDUSTRIAL_PORT_MAP,
  station: SPACE_STATION_MAP,
};

export const MAP_LIST: MapDefinition[] = [
  LAB_MAP,
  CITY_MAP,
  DESERT_MAP,
  FROZEN_MOUNTAIN_MAP,
  INDUSTRIAL_PORT_MAP,
  SPACE_STATION_MAP,
];

export interface WeatherTickResult {
  snowstormActive: boolean;
  stormStarted: boolean;
  stormEnded: boolean;
}

export class MapManager {
  private readonly scene: THREE.Scene;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly dirLight: THREE.DirectionalLight;
  private readonly mapGroup = new THREE.Group();
  private readonly textures: MapTextureBundle;
  private readonly dirBaseOffset = new THREE.Vector3(30, 55, 25);

  public activeMapId: MapId = 'lab';
  public activeMap: MapDefinition = LAB_MAP;
  public arenaSize = LAB_MAP.size;
  public halfArena = LAB_MAP.size / 2;

  public readonly obstacleMeshes: THREE.Object3D[] = [];
  public readonly obstacles: ObstacleBox[] = [];
  public readonly platforms: PlatformBox[] = [];
  public readonly ramps: RampDef[] = [];

  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material | THREE.Texture> = [];

  // حالة العاصفة الثلجية في خريطة الجبل المتجمد
  private snowstormActive = false;
  private snowstormTimer = 0;
  private currentWeatherFogDensity: number | null = null;
  private snowPoints: THREE.Points | null = null;
  private snowPositions: Float32Array | null = null;
  private snowMat: THREE.PointsMaterial | null = null;
  private lastShadowSnapX = Number.NaN;
  private lastShadowSnapZ = Number.NaN;

  constructor(
    scene: THREE.Scene,
    hemiLight: THREE.HemisphereLight,
    dirLight: THREE.DirectionalLight,
    maxAnisotropy: number,
  ) {
    this.scene = scene;
    this.hemiLight = hemiLight;
    this.dirLight = dirLight;
    this.textures = createMapTextures(maxAnisotropy);
    this.scene.add(this.mapGroup);
    this.scene.add(this.dirLight.target);
  }

  /** تنظيف وتحرير كل الهندسيات والمواد للخريطة السابقة */
  private clearMap(): void {
    while (this.mapGroup.children.length > 0) {
      this.mapGroup.remove(this.mapGroup.children[0]);
    }
    for (const item of this.disposables) {
      item.dispose();
    }
    this.disposables.length = 0;
    this.obstacleMeshes.length = 0;
    this.obstacles.length = 0;
    this.platforms.length = 0;
    this.ramps.length = 0;

    this.snowstormActive = false;
    this.snowstormTimer = 0;
    this.currentWeatherFogDensity = null;
    this.snowPoints = null;
    this.snowPositions = null;
    this.snowMat = null;
    this.lastShadowSnapX = Number.NaN;
    this.lastShadowSnapZ = Number.NaN;
  }

  private track<T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(resource: T): T {
    this.disposables.push(resource);
    return resource;
  }

  /** تحميل وبناء خريطة كاملة بالإضاءة والضباب والهندسة المعمارية */
  public loadMap(mapId: MapId): MapDefinition {
    const cfg = ALL_MAPS[mapId] || LAB_MAP;
    this.clearMap();

    this.activeMapId = cfg.id;
    this.activeMap = cfg;
    this.arenaSize = cfg.size;
    this.halfArena = cfg.size / 2;

    // إعداد الخلفية والضباب المتوافق مع الأفق
    this.scene.background = new THREE.Color(cfg.bg);
    this.scene.fog = new THREE.FogExp2(cfg.fogColor, cfg.fogDensity);
    this.currentWeatherFogDensity = cfg.fogDensity;

    // إعداد الإضاءة المتباينة (دافئ/بارد) مع تقييد نطاق كاميرا الظلال لأفضل أداء على الخرائط الكبيرة
    this.hemiLight.color.setHex(cfg.hemiSky);
    this.hemiLight.groundColor.setHex(cfg.hemiGround);
    this.hemiLight.intensity = cfg.hemiIntensity;

    this.dirLight.color.setHex(cfg.dirColor);
    this.dirLight.intensity = cfg.dirIntensity;
    this.dirBaseOffset.set(...cfg.dirPos);
    this.dirLight.position.copy(this.dirBaseOffset);
    this.dirLight.target.position.set(0, 0, 0);
    this.dirLight.target.updateMatrixWorld();

    const shadowExtent = Math.min(this.halfArena + 8, 72);
    this.dirLight.shadow.camera.left = -shadowExtent;
    this.dirLight.shadow.camera.right = shadowExtent;
    this.dirLight.shadow.camera.top = shadowExtent;
    this.dirLight.shadow.camera.bottom = -shadowExtent;
    this.dirLight.shadow.camera.near = 2;
    this.dirLight.shadow.camera.far = Math.max(180, this.arenaSize * 1.4);
    this.dirLight.shadow.camera.updateProjectionMatrix();

    // أضواء نقطية موضعية للخريطة
    for (const l of cfg.lights) {
      const pl = new THREE.PointLight(l.color, l.intensity, l.dist);
      pl.position.set(...l.pos);
      this.mapGroup.add(pl);
    }

    // سماء النجوم لخريطتي المختبر والمحطة الفضائية
    if (cfg.stars) {
      const starGeo = this.track(new THREE.BufferGeometry());
      const starVerts: number[] = [];
      for (let i = 0; i < 420; i++) {
        starVerts.push(
          (Math.random() - 0.5) * 260,
          24 + Math.random() * 80,
          (Math.random() - 0.5) * 260,
        );
      }
      starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
      const starMat = this.track(new THREE.PointsMaterial({ color: 0xbae6fd, size: 0.72 }));
      this.mapGroup.add(new THREE.Points(starGeo, starMat));
    }

    // شمس الغروب للصحراء المفتوحة (180×180) بهالة ضوئية ناعمة التدرج
    if (cfg.sunsetSun) {
      const sunZ = -(this.halfArena + 105);
      const sunGeo = this.track(new THREE.SphereGeometry(16, 24, 24));
      const sunMat = this.track(new THREE.MeshBasicMaterial({ color: 0xfdba74, fog: false }));
      const sun = new THREE.Mesh(sunGeo, sunMat);
      sun.position.set(0, 36, sunZ);
      this.mapGroup.add(sun);

      const haloCanvas = document.createElement('canvas');
      haloCanvas.width = 256;
      haloCanvas.height = 256;
      const hCtx = haloCanvas.getContext('2d')!;
      const grad = hCtx.createRadialGradient(128, 128, 22, 128, 128, 128);
      grad.addColorStop(0, 'rgba(253, 186, 116, 0.72)');
      grad.addColorStop(0.42, 'rgba(249, 115, 22, 0.32)');
      grad.addColorStop(1, 'rgba(249, 115, 22, 0.0)');
      hCtx.fillStyle = grad;
      hCtx.fillRect(0, 0, 256, 256);
      const haloTex = this.track(new THREE.CanvasTexture(haloCanvas));
      haloTex.colorSpace = THREE.SRGBColorSpace;

      const haloGeo = this.track(new THREE.PlaneGeometry(88, 88));
      const haloMat = this.track(
        new THREE.MeshBasicMaterial({
          map: haloTex,
          transparent: true,
          depthWrite: false,
          fog: false,
        }),
      );
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.set(0, 36, sunZ - 1);
      this.mapGroup.add(halo);
    }

    // اختيار الخامات حسب الخريطة مع لون أساسي أبيض لتجنب تعتيم الخامة
    const floorTex = this.pickFloorTexture(cfg.id);
    const wallTex = this.pickWallTexture(cfg.id);

    const floorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: floorTex,
        bumpMap: this.textures.microBump,
        bumpScale: cfg.id === 'desert' || cfg.id === 'mountain' ? 0.07 : 0.04,
        roughness: cfg.id === 'desert' ? 0.92 : cfg.id === 'mountain' ? 0.84 : 0.72,
        metalness: cfg.id === 'lab' || cfg.id === 'station' ? 0.24 : 0.06,
      }),
    );

    // في الخرائط الخارجية تمتد الأرضية نحو الأفق لتجنب مظهر الصندوق العائم في الفراغ
    const floorSize = cfg.outdoor ? this.arenaSize * 2.4 : this.arenaSize;
    const floorGeo = this.track(new THREE.PlaneGeometry(floorSize, floorSize));
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.mapGroup.add(floor);

    const wallMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: wallTex,
        bumpMap: this.textures.microBump,
        bumpScale: 0.06,
        roughness: cfg.id === 'desert' || cfg.id === 'mountain' ? 0.86 : 0.55,
        metalness: cfg.id === 'lab' || cfg.id === 'station' ? 0.36 : cfg.id === 'port' ? 0.26 : 0.12,
      }),
    );

    const trimColorMap: Record<MapId, number> = {
      lab: 0x38bdf8,
      city: 0xf59e0b,
      desert: 0xd97706,
      mountain: 0xbae6fd,
      port: 0xfacc15,
      station: 0x22d3ee,
    };

    const accentColorMap: Record<MapId, number> = {
      lab: 0x0f172a,
      city: 0x292524,
      desert: 0x5c3317,
      mountain: 0x334155,
      port: 0x1e293b,
      station: 0x111827,
    };

    const trimMat = this.track(new THREE.MeshBasicMaterial({ color: trimColorMap[cfg.id] }));

    const darkAccentMat = this.track(
      new THREE.MeshStandardMaterial({
        color: accentColorMap[cfg.id],
        roughness: 0.8,
        metalness: cfg.id === 'lab' || cfg.id === 'station' || cfg.id === 'port' ? 0.42 : 0.1,
      }),
    );

    // بناء الحدود والمعالم حسب نوع الخريطة
    if (cfg.id === 'desert') {
      this.buildDesertPerimeter(wallMat, darkAccentMat);
    } else if (cfg.id === 'city') {
      this.buildCityPerimeter(wallMat, darkAccentMat);
    } else if (cfg.id === 'mountain') {
      this.buildMountainPerimeter(wallMat, darkAccentMat);
      this.initSnowParticles();
    } else if (cfg.id === 'port') {
      this.buildPortPerimeter(wallMat, darkAccentMat, trimMat);
      this.buildPortLandmarks(darkAccentMat, trimMat, cfg.rooftops);
    } else {
      const wh = cfg.wallHeight;
      this.addBox(0, -this.halfArena, this.arenaSize, wh, 2, wallMat, trimMat, true, false);
      this.addBox(0, this.halfArena, this.arenaSize, wh, 2, wallMat, trimMat, true, false);
      this.addBox(-this.halfArena, 0, 2, wh, this.arenaSize, wallMat, trimMat, true, false);
      this.addBox(this.halfArena, 0, 2, wh, this.arenaSize, wallMat, trimMat, true, false);
      if (cfg.id === 'station') {
        this.buildStationLandmarks(darkAccentMat, trimMat);
      } else {
        this.buildLabLandmarks(darkAccentMat, trimMat);
      }
    }

    // بناء العوائق والسطوح والمنحدرات والحاويات المكدّسة والصخور
    for (const [x, z, w, h, d] of cfg.layout) {
      this.addBox(x, z, w, h, d, wallMat, trimMat, false, false);
    }
    for (const [x, z, w, h, d] of cfg.rooftops) {
      this.addBox(x, z, w, h, d, wallMat, trimMat, false, true);
    }
    if (cfg.containers) {
      for (const c of cfg.containers) {
        this.addContainer(c);
      }
    }
    for (const r of cfg.ramps) {
      this.addRamp(r, darkAccentMat, trimMat);
    }
    for (const [x, z, rad] of cfg.boulders) {
      this.addBoulder(x, z, rad, wallMat, darkAccentMat);
    }

    // تهيئة مؤقت العاصفة الثلجية عند تفعيلها في الخريطة
    if (cfg.snowstorm) {
      this.snowstormActive = false;
      this.snowstormTimer =
        cfg.snowstorm.intervalMin +
        Math.random() * (cfg.snowstorm.intervalMax - cfg.snowstorm.intervalMin) * 0.7;
    }

    return cfg;
  }

  private pickFloorTexture(id: MapId): THREE.CanvasTexture {
    switch (id) {
      case 'lab':
        return this.textures.labFloor;
      case 'city':
        return this.textures.cityFloor;
      case 'desert':
        return this.textures.desertFloor;
      case 'mountain':
        return this.textures.snowFloor;
      case 'port':
        return this.textures.portFloor;
      case 'station':
        return this.textures.stationFloor;
    }
  }

  private pickWallTexture(id: MapId): THREE.CanvasTexture {
    switch (id) {
      case 'lab':
        return this.textures.labWall;
      case 'city':
        return this.textures.cityWall;
      case 'desert':
        return this.textures.desertRock;
      case 'mountain':
        return this.textures.iceRock;
      case 'port':
        return this.textures.portWall;
      case 'station':
        return this.textures.stationWall;
    }
  }

  /** تعديل كثافة الضباب مؤقتاً لمعدِّل الموجة (ضباب كثيف) وإعادتها مع مراعاة الطقس */
  public setFogMultiplier(multiplier: number, minHeavyDensity = 0): void {
    if (this.scene.fog instanceof THREE.FogExp2) {
      const hasHeavy = multiplier > 1 || minHeavyDensity > 0;
      const effective = computeEffectiveFogDensity(
        this.activeMap.fogDensity,
        this.currentWeatherFogDensity,
        hasHeavy,
      );
      this.scene.fog.density = hasHeavy ? Math.max(effective, minHeavyDensity) : effective;
    }
  }

  /** تحديث دورة العاصفة الثلجية وحركة جزيئات الثلج في خريطة الجبل المتجمد */
  public updateWeather(
    dt: number,
    playerPos: THREE.Vector3,
    hasHeavyFogMutator: boolean,
  ): WeatherTickResult {
    const stormCfg = this.activeMap.snowstorm;
    if (!stormCfg) {
      return { snowstormActive: false, stormStarted: false, stormEnded: false };
    }

    let stormStarted = false;
    let stormEnded = false;
    this.snowstormTimer -= dt;
    if (this.snowstormTimer <= 0) {
      this.snowstormActive = !this.snowstormActive;
      if (this.snowstormActive) {
        this.snowstormTimer = stormCfg.duration;
        stormStarted = true;
      } else {
        this.snowstormTimer =
          stormCfg.intervalMin + Math.random() * (stormCfg.intervalMax - stormCfg.intervalMin);
        stormEnded = true;
      }
    }

    const targetWeatherFog = this.snowstormActive
      ? stormCfg.stormFogDensity
      : this.activeMap.fogDensity;
    const prevFog = this.currentWeatherFogDensity ?? this.activeMap.fogDensity;
    this.currentWeatherFogDensity = prevFog + (targetWeatherFog - prevFog) * (1 - Math.exp(-1.9 * dt));

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = computeEffectiveFogDensity(
        this.activeMap.fogDensity,
        this.currentWeatherFogDensity,
        hasHeavyFogMutator,
      );
    }

    // تحريك ندف الثلج حول موقع اللاعب دون استهلاك موارد كبيرة
    if (this.snowPoints && this.snowPositions && this.snowMat) {
      const targetOpacity = this.snowstormActive ? 0.88 : 0.28;
      this.snowMat.opacity += (targetOpacity - this.snowMat.opacity) * (1 - Math.exp(-3 * dt));
      this.snowMat.size = this.snowstormActive ? 0.42 : 0.26;

      const fallSpeed = this.snowstormActive ? 16 : 4.5;
      const windX = this.snowstormActive ? 14 : 2.2;
      const windZ = this.snowstormActive ? 6 : 1.0;
      const boxHalf = 36;
      const boxHeight = 24;

      for (let i = 0; i < this.snowPositions.length; i += 3) {
        let sx = this.snowPositions[i] + windX * dt;
        let sy = this.snowPositions[i + 1] - fallSpeed * dt;
        let sz = this.snowPositions[i + 2] + windZ * dt;

        if (sy < 0) sy += boxHeight;
        if (sx - playerPos.x > boxHalf) sx -= boxHalf * 2;
        else if (sx - playerPos.x < -boxHalf) sx += boxHalf * 2;
        if (sz - playerPos.z > boxHalf) sz -= boxHalf * 2;
        else if (sz - playerPos.z < -boxHalf) sz += boxHalf * 2;

        this.snowPositions[i] = sx;
        this.snowPositions[i + 1] = sy;
        this.snowPositions[i + 2] = sz;
      }

      const posAttr = this.snowPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      posAttr.needsUpdate = true;
    }

    return {
      snowstormActive: this.snowstormActive,
      stormStarted,
      stormEnded,
    };
  }

  /** تحريك مركز كاميرا الظلال ليتبع اللاعب بخطوات ثابتة على الخرائط الكبيرة (150-200) */
  public updateShadowFocus(playerPos: THREE.Vector3, shadowsEnabled: boolean): void {
    if (!shadowsEnabled || this.arenaSize <= 120) return;
    const snapX = Math.round(playerPos.x / 6) * 6;
    const snapZ = Math.round(playerPos.z / 6) * 6;
    if (snapX === this.lastShadowSnapX && snapZ === this.lastShadowSnapZ) return;
    this.lastShadowSnapX = snapX;
    this.lastShadowSnapZ = snapZ;

    this.dirLight.target.position.set(snapX, 0, snapZ);
    this.dirLight.target.updateMatrixWorld();
    this.dirLight.position.set(
      snapX + this.dirBaseOffset.x,
      this.dirBaseOffset.y,
      snapZ + this.dirBaseOffset.z,
    );
  }

  /** تهيئة جزيئات الثلج خفيفة الوزن لخريطة الجبل المتجمد */
  private initSnowParticles(): void {
    const count = 380;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 72;
      positions[i * 3 + 1] = Math.random() * 24;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 72;
    }
    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = this.track(
      new THREE.PointsMaterial({
        color: 0xf1f5f9,
        size: 0.28,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.mapGroup.add(pts);
    this.snowPoints = pts;
    this.snowPositions = positions;
    this.snowMat = mat;
  }

  /** معالم معمارية مركبة للمختبر (أقواس وأبراج طاقة مرئية من نقطة البداية) */
  private buildLabLandmarks(darkMat: THREE.Material, glowMat: THREE.Material): void {
    const beamGeo = this.track(new THREE.BoxGeometry(28, 0.9, 1.2));
    const stripGeo = this.track(new THREE.BoxGeometry(26, 0.18, 1.28));
    for (const z of [-24, 24]) {
      const arch = new THREE.Mesh(beamGeo, darkMat);
      arch.position.set(0, 9.2, z);
      const strip = new THREE.Mesh(stripGeo, glowMat);
      strip.position.set(0, 8.72, z);
      this.mapGroup.add(arch, strip);
    }
  }

  /** معالم المحطة الفضائية (عوارض هيكلية مدارية مضاءة فوق الممرات الضيقة) */
  private buildStationLandmarks(darkMat: THREE.Material, glowMat: THREE.Material): void {
    const ribGeo = this.track(new THREE.BoxGeometry(this.arenaSize - 4, 0.75, 1.1));
    const stripGeo = this.track(new THREE.BoxGeometry(this.arenaSize - 8, 0.16, 1.18));
    const ribPositions = [-30, -10, 10, 30];
    for (const z of ribPositions) {
      const rib = new THREE.Mesh(ribGeo, darkMat);
      rib.position.set(0, 8.5, z);
      const strip = new THREE.Mesh(stripGeo, glowMat);
      strip.position.set(0, 8.08, z);
      this.mapGroup.add(rib, strip);
    }
  }

  /** حدود طبيعية للصحراء بصخور جبلية محيطة بدلاً من جدار صندوقي مغلق */
  private buildDesertPerimeter(rockMat: THREE.Material, darkRockMat: THREE.Material): void {
    const cliffGeo = this.track(new THREE.DodecahedronGeometry(1, 0));
    const step = 16;
    const edge = this.halfArena + 3.0;
    for (let i = -this.halfArena; i <= this.halfArena; i += step) {
      const sides: Array<[number, number]> = [
        [i, -edge],
        [i, edge],
        [-edge, i],
        [edge, i],
      ];
      for (const [cx, cz] of sides) {
        const h = 8.0 + (Math.abs(cx * 13 + cz * 7) % 10) * 1.05;
        const w = 9.5 + (Math.abs(cx + cz) % 4);
        const cliff = new THREE.Mesh(cliffGeo, (cx + cz) % 2 === 0 ? rockMat : darkRockMat);
        cliff.scale.set(w, h, w);
        cliff.position.set(cx, h * 0.42, cz);
        cliff.rotation.set(0.2, (cx * 0.17) % Math.PI, 0.15);
        cliff.receiveShadow = true;
        this.mapGroup.add(cliff);
        this.obstacleMeshes.push(cliff);
      }
    }
  }

  /** حدود جبلية ثلجية شاهقة تحيط بخريطة الجبل المتجمد (200×200) */
  private buildMountainPerimeter(iceRockMat: THREE.Material, darkRockMat: THREE.Material): void {
    const peakGeo = this.track(new THREE.DodecahedronGeometry(1, 0));
    const snowCapMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.78,
        metalness: 0.05,
      }),
    );
    const step = 20;
    const edge = this.halfArena + 4.5;
    for (let i = -this.halfArena; i <= this.halfArena; i += step) {
      const sides: Array<[number, number]> = [
        [i, -edge],
        [i, edge],
        [-edge, i],
        [edge, i],
      ];
      for (const [cx, cz] of sides) {
        const seed = Math.abs(cx * 11 + cz * 17) % 12;
        const h = 11 + seed * 1.45;
        const w = 11.5 + (seed % 5);
        const mat = seed % 3 === 0 ? snowCapMat : seed % 2 === 0 ? iceRockMat : darkRockMat;
        const peak = new THREE.Mesh(peakGeo, mat);
        peak.scale.set(w, h, w);
        peak.position.set(cx, h * 0.44, cz);
        peak.rotation.set(0.18, (cx * 0.11 + cz * 0.07) % Math.PI, 0.12);
        peak.receiveShadow = true;
        this.mapGroup.add(peak);
        this.obstacleMeshes.push(peak);
      }
    }
  }

  /** حدود الميناء الصناعي بحواجز رصيف وبوابات رافعات عملاقة على الأفق */
  private buildPortPerimeter(
    wallMat: THREE.Material,
    steelMat: THREE.Material,
    trimMat: THREE.Material,
  ): void {
    const barrierGeoH = this.track(new THREE.BoxGeometry(this.arenaSize, 3.0, 2.4));
    const barrierGeoV = this.track(new THREE.BoxGeometry(2.4, 3.0, this.arenaSize));

    const positions: Array<[number, number, THREE.BufferGeometry]> = [
      [0, -this.halfArena, barrierGeoH],
      [0, this.halfArena, barrierGeoH],
      [-this.halfArena, 0, barrierGeoV],
      [this.halfArena, 0, barrierGeoV],
    ];
    for (const [bx, bz, geo] of positions) {
      const mesh = new THREE.Mesh(geo, steelMat);
      mesh.position.set(bx, 1.5, bz);
      mesh.receiveShadow = true;
      this.mapGroup.add(mesh);
      this.obstacleMeshes.push(mesh);
    }

    // رافعات ميناء ضخمة بعيدة خلف الرصيف لمنح الخريطة هوية بحرية وصناعية واضحة
    const legGeo = this.track(new THREE.BoxGeometry(2.2, 26, 2.2));
    const boomGeo = this.track(new THREE.BoxGeometry(34, 2.2, 2.6));
    const cranePositions: Array<[number, number, number]> = [
      [-42, -this.halfArena - 10, 0],
      [42, -this.halfArena - 10, 0],
      [-this.halfArena - 10, 0, Math.PI / 2],
      [this.halfArena + 10, 0, Math.PI / 2],
    ];
    for (const [cx, cz, rotY] of cranePositions) {
      const g = new THREE.Group();
      const legL = new THREE.Mesh(legGeo, wallMat);
      legL.position.set(-7, 13, 0);
      const legR = new THREE.Mesh(legGeo, wallMat);
      legR.position.set(7, 13, 0);
      const boom = new THREE.Mesh(boomGeo, trimMat);
      boom.position.set(0, 24.5, 0);
      g.add(legL, legR, boom);
      g.position.set(cx, 0, cz);
      g.rotation.y = rotY;
      this.mapGroup.add(g);
    }
  }

  /** هياكل رافعات علوية فوق منصات القنص القابلة للصعود في الميناء الصناعي */
  private buildPortLandmarks(
    steelMat: THREE.Material,
    trimMat: THREE.Material,
    rooftops: [number, number, number, number, number][],
  ): void {
    const postGeo = this.track(new THREE.BoxGeometry(0.65, 6.2, 0.65));
    const railMat = trimMat;
    for (const [x, z, w, h, d] of rooftops) {
      const hx = w / 2 - 0.45;
      const hz = d / 2 - 0.45;
      const corners: Array<[number, number]> = [
        [-hx, -hz],
        [hx, -hz],
        [-hx, hz],
        [hx, hz],
      ];
      for (const [ox, oz] of corners) {
        const post = new THREE.Mesh(postGeo, steelMat);
        post.position.set(x + ox, h + 3.1, z + oz);
        this.mapGroup.add(post);
      }
      const topBeamGeo = this.track(new THREE.BoxGeometry(w, 0.55, 0.65));
      const beamBack = new THREE.Mesh(topBeamGeo, railMat);
      beamBack.position.set(x, h + 6.1, z - hz);
      const beamFront = new THREE.Mesh(topBeamGeo, railMat);
      beamFront.position.set(x, h + 6.1, z + hz);
      this.mapGroup.add(beamBack, beamFront);
    }
  }

  /** حدود مدينة مدمرة بحواجز خرسانية وأبراج مهدمة بعيدة في الأفق */
  private buildCityPerimeter(wallMat: THREE.Material, rubbleMat: THREE.Material): void {
    const barrierGeoH = this.track(new THREE.BoxGeometry(this.arenaSize, 3.2, 2.2));
    const barrierGeoV = this.track(new THREE.BoxGeometry(2.2, 3.2, this.arenaSize));

    const positions: Array<[number, number, THREE.BufferGeometry]> = [
      [0, -this.halfArena, barrierGeoH],
      [0, this.halfArena, barrierGeoH],
      [-this.halfArena, 0, barrierGeoV],
      [this.halfArena, 0, barrierGeoV],
    ];
    for (const [bx, bz, geo] of positions) {
      const mesh = new THREE.Mesh(geo, rubbleMat);
      mesh.position.set(bx, 1.6, bz);
      mesh.receiveShadow = true;
      this.mapGroup.add(mesh);
      this.obstacleMeshes.push(mesh);
    }

    // أبراج مدمرة محيطة خارج حدود الساحة لإعطاء عمق حضري واقعي
    const towerGeo = this.track(new THREE.BoxGeometry(1, 1, 1));
    const outerDist = this.halfArena + 16;
    for (let i = -outerDist; i <= outerDist; i += 24) {
      const coords: Array<[number, number]> = [
        [i, -outerDist],
        [i, outerDist],
        [-outerDist, i],
        [outerDist, i],
      ];
      for (const [tx, tz] of coords) {
        const h = 18 + (Math.abs(tx * 3 + tz * 5) % 22);
        const tower = new THREE.Mesh(towerGeo, wallMat);
        tower.scale.set(13, h, 13);
        tower.position.set(tx, h / 2, tz);
        this.mapGroup.add(tower);
      }
    }
  }

  /** إضافة حاوية شحن صناعية (تدعم التكديس الرأسي عبر baseY) */
  private addContainer(c: ContainerDef): void {
    const baseY = c.baseY ?? 0;
    const geo = this.track(new THREE.BoxGeometry(c.w, c.h, c.d));
    const mat = this.track(
      new THREE.MeshStandardMaterial({
        color: c.color,
        map: this.textures.containerWall,
        bumpMap: this.textures.microBump,
        bumpScale: 0.05,
        roughness: 0.62,
        metalness: 0.32,
      }),
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(c.x, baseY + c.h / 2, c.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.mapGroup.add(mesh);
    this.obstacleMeshes.push(mesh);

    this.obstacles.push({
      x: c.x,
      z: c.z,
      hx: c.w / 2,
      hz: c.d / 2,
      h: c.h,
      baseY,
    });

    if (c.climbable) {
      this.platforms.push({
        x: c.x,
        z: c.z,
        hx: c.w / 2,
        hz: c.d / 2,
        topY: baseY + c.h,
      });
    }
  }

  private addBox(
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    trimMat: THREE.Material,
    isBorder: boolean,
    isRooftop: boolean,
  ): void {
    const geo = this.track(new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = !isBorder;
    mesh.receiveShadow = true;
    this.mapGroup.add(mesh);
    this.obstacleMeshes.push(mesh);

    if (!isBorder) {
      this.obstacles.push({ x, z, hx: w / 2, hz: d / 2, h, baseY: 0 });
      // حافة علوية معمارية بارزة لتعزيز القراءة البصرية للسواتر
      const capGeo = this.track(new THREE.BoxGeometry(w + 0.16, 0.14, d + 0.16));
      const cap = new THREE.Mesh(capGeo, trimMat);
      cap.position.set(x, h - 0.04, z);
      this.mapGroup.add(cap);
    }

    if (isRooftop) {
      this.platforms.push({ x, z, hx: w / 2, hz: d / 2, topY: h });
    }
  }

  private addRamp(
    r: MapDefinition['ramps'][number],
    rampMat: THREE.Material,
    stripeMat: THREE.Material,
  ): void {
    const length = r.dir === 'z+' || r.dir === 'z-' ? r.l : r.w;
    const height = r.y1 - r.y0;
    const angle = Math.atan2(height, length);
    const hyp = Math.hypot(length, height);

    const geo = this.track(
      r.dir === 'z+' || r.dir === 'z-'
        ? new THREE.BoxGeometry(r.w, 0.35, hyp)
        : new THREE.BoxGeometry(hyp, 0.35, r.l),
    );
    const mesh = new THREE.Mesh(geo, rampMat);
    mesh.position.set(r.x, (r.y0 + r.y1) / 2 - 0.12, r.z);

    if (r.dir === 'z+') mesh.rotation.x = -angle;
    else if (r.dir === 'z-') mesh.rotation.x = angle;
    else if (r.dir === 'x+') mesh.rotation.z = angle;
    else if (r.dir === 'x-') mesh.rotation.z = -angle;

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.mapGroup.add(mesh);
    this.obstacleMeshes.push(mesh);

    const stripeGeo = this.track(
      r.dir === 'z+' || r.dir === 'z-'
        ? new THREE.BoxGeometry(0.35, 0.06, hyp * 0.94)
        : new THREE.BoxGeometry(hyp * 0.94, 0.06, 0.35),
    );
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.copy(mesh.position);
    stripe.position.y += 0.18;
    stripe.rotation.copy(mesh.rotation);
    this.mapGroup.add(stripe);

    this.ramps.push({
      x: r.x,
      z: r.z,
      hx: r.w / 2,
      hz: r.l / 2,
      dir: r.dir,
      y0: r.y0,
      y1: r.y1,
    });
  }

  private addBoulder(
    x: number,
    z: number,
    radius: number,
    rockMat: THREE.Material,
    accentMat: THREE.Material,
  ): void {
    // صخرة مركبة من كتلتين متداخلتين لتفادي شكل بدائي واحد
    const group = new THREE.Group();
    const mainGeo = this.track(new THREE.DodecahedronGeometry(radius, 0));
    const mainMesh = new THREE.Mesh(mainGeo, rockMat);
    mainMesh.scale.set(1.15, 0.9, 1.05);
    mainMesh.position.y = radius * 0.72;
    mainMesh.rotation.set(0.3, x * 0.7, 0.2);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;

    const sideGeo = this.track(new THREE.DodecahedronGeometry(radius * 0.52, 0));
    const sideMesh = new THREE.Mesh(sideGeo, accentMat);
    sideMesh.position.set(radius * 0.62, radius * 0.34, radius * 0.35);
    sideMesh.rotation.set(0.5, z * 0.4, 0.1);
    sideMesh.castShadow = true;
    sideMesh.receiveShadow = true;

    group.add(mainMesh, sideMesh);
    group.position.set(x, 0, z);
    this.mapGroup.add(group);
    this.obstacleMeshes.push(mainMesh, sideMesh);
    this.obstacles.push({ x, z, hx: radius * 0.9, hz: radius * 0.85, h: radius * 1.55, baseY: 0 });
  }

  /** حساب ارتفاع الأرضية تحت نقطة (مع دعم السطوح والمنحدرات) */
  public getGroundHeight(px: number, pz: number, currentFeetY: number): number {
    let groundY = 0;
    for (const r of this.ramps) {
      if (Math.abs(px - r.x) <= r.hx + 0.35 && Math.abs(pz - r.z) <= r.hz + 0.35) {
        let t = 0;
        if (r.dir === 'z+') t = (pz - (r.z - r.hz)) / (r.hz * 2);
        else if (r.dir === 'z-') t = (r.z + r.hz - pz) / (r.hz * 2);
        else if (r.dir === 'x+') t = (px - (r.x - r.hx)) / (r.hx * 2);
        else if (r.dir === 'x-') t = (r.x + r.hx - px) / (r.hx * 2);
        t = Math.max(0, Math.min(1, t));
        const ry = r.y0 + t * (r.y1 - r.y0);
        if (currentFeetY >= ry - 1.2) {
          groundY = Math.max(groundY, ry);
        }
      }
    }
    for (const p of this.platforms) {
      if (Math.abs(px - p.x) <= p.hx + 0.35 && Math.abs(pz - p.z) <= p.hz + 0.35) {
        if (currentFeetY >= p.topY - 0.9) {
          groundY = Math.max(groundY, p.topY);
        }
      }
    }
    return groundY;
  }

  /** حل التصادم الأفقي مع العوائق والحاويات المكدّسة وحدود الساحة */
  public resolveCollisions(pos: THREE.Vector3, radius: number, feetY: number): boolean {
    const limit = this.halfArena - 1.8;
    let hitWall = false;
    if (pos.x < -limit || pos.x > limit) hitWall = true;
    if (pos.z < -limit || pos.z > limit) hitWall = true;
    pos.x = Math.max(-limit, Math.min(limit, pos.x));
    pos.z = Math.max(-limit, Math.min(limit, pos.z));

    for (const o of this.obstacles) {
      const baseY = o.baseY ?? 0;
      const topY = baseY + o.h;
      if (feetY >= topY - 0.65 || feetY + 1.85 <= baseY) continue;
      const minX = o.hx + radius;
      const minZ = o.hz + radius;
      const dx = pos.x - o.x;
      const dz = pos.z - o.z;
      if (Math.abs(dx) < minX && Math.abs(dz) < minZ) {
        hitWall = true;
        const penX = minX - Math.abs(dx);
        const penZ = minZ - Math.abs(dz);
        if (penX < penZ) {
          pos.x = o.x + (dx >= 0 ? minX : -minX);
        } else {
          pos.z = o.z + (dz >= 0 ? minZ : -minZ);
        }
      }
    }
    return hitWall;
  }

  /** التحقق مما إذا كانت نقطة ثلاثية الأبعاد داخل عائق أو خارج الحدود */
  public isPointInsideObstacle(pos: THREE.Vector3): boolean {
    const limit = this.halfArena - 1.2;
    if (Math.abs(pos.x) > limit || Math.abs(pos.z) > limit) return true;
    for (const o of this.obstacles) {
      const baseY = o.baseY ?? 0;
      const topY = baseY + o.h;
      if (
        Math.abs(pos.x - o.x) < o.hx &&
        Math.abs(pos.z - o.z) < o.hz &&
        pos.y >= baseY &&
        pos.y < topY
      ) {
        return true;
      }
    }
    return false;
  }

  public dispose(): void {
    this.clearMap();
    disposeMapTextures(this.textures);
    this.scene.remove(this.mapGroup);
    this.scene.remove(this.dirLight.target);
  }
}
