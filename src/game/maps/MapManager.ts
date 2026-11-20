import * as THREE from 'three';
import type { MapDefinition, MapId, ObstacleBox, PlatformBox, RampDef } from '../types';
import { LAB_MAP } from './LabMap';
import { CITY_MAP } from './CityMap';
import { DESERT_MAP } from './DesertMap';
import { createMapTextures, disposeMapTextures, type MapTextureBundle } from './MapTextures';

/* ==========================================
   مدير الخرائط — يبني الهندسة ثلاثية الأبعاد والإضاءة والتصادمات لكل خريطة
   ويحرر جميع الموارد الهندسية والمواد عند التبديل بين الخرائط
   ========================================== */

export const ALL_MAPS: Record<MapId, MapDefinition> = {
  lab: LAB_MAP,
  city: CITY_MAP,
  desert: DESERT_MAP,
};

export const MAP_LIST: MapDefinition[] = [LAB_MAP, CITY_MAP, DESERT_MAP];

export class MapManager {
  private readonly scene: THREE.Scene;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly dirLight: THREE.DirectionalLight;
  private readonly mapGroup = new THREE.Group();
  private readonly textures: MapTextureBundle;

  public activeMapId: MapId = 'lab';
  public activeMap: MapDefinition = LAB_MAP;
  public arenaSize = LAB_MAP.size;
  public halfArena = LAB_MAP.size / 2;

  public readonly obstacleMeshes: THREE.Object3D[] = [];
  public readonly obstacles: ObstacleBox[] = [];
  public readonly platforms: PlatformBox[] = [];
  public readonly ramps: RampDef[] = [];

  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

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
  }

  private track<T extends THREE.BufferGeometry | THREE.Material>(resource: T): T {
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

    // إعداد الإضاءة المتباينة (دافئ/بارد)
    this.hemiLight.color.setHex(cfg.hemiSky);
    this.hemiLight.groundColor.setHex(cfg.hemiGround);
    this.hemiLight.intensity = cfg.hemiIntensity;

    this.dirLight.color.setHex(cfg.dirColor);
    this.dirLight.intensity = cfg.dirIntensity;
    this.dirLight.position.set(...cfg.dirPos);
    const shadowExtent = this.halfArena + 10;
    this.dirLight.shadow.camera.left = -shadowExtent;
    this.dirLight.shadow.camera.right = shadowExtent;
    this.dirLight.shadow.camera.top = shadowExtent;
    this.dirLight.shadow.camera.bottom = -shadowExtent;
    this.dirLight.shadow.camera.updateProjectionMatrix();

    // أضواء نقطية موضعية للخريطة
    for (const l of cfg.lights) {
      const pl = new THREE.PointLight(l.color, l.intensity, l.dist);
      pl.position.set(...l.pos);
      this.mapGroup.add(pl);
    }

    // سماء النجوم لخريطة المختبر
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

    // شمس الغروب للصحراء المفتوحة بهالة ضوئية ناعمة التدرج
    if (cfg.sunsetSun) {
      const sunGeo = this.track(new THREE.SphereGeometry(14, 24, 24));
      const sunMat = this.track(new THREE.MeshBasicMaterial({ color: 0xfdba74, fog: false }));
      const sun = new THREE.Mesh(sunGeo, sunMat);
      sun.position.set(0, 30, -145);
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
      const haloTex = new THREE.CanvasTexture(haloCanvas);
      haloTex.colorSpace = THREE.SRGBColorSpace;
      this.disposables.push(haloTex as unknown as THREE.Material);

      const haloGeo = this.track(new THREE.PlaneGeometry(78, 78));
      const haloMat = this.track(
        new THREE.MeshBasicMaterial({
          map: haloTex,
          transparent: true,
          depthWrite: false,
          fog: false,
        }),
      );
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.set(0, 30, -146);
      this.mapGroup.add(halo);
    }

    // اختيار الخامات حسب الخريطة مع لون أساسي أبيض لتجنب تعتيم الخامة
    const floorTex =
      cfg.id === 'lab'
        ? this.textures.labFloor
        : cfg.id === 'city'
          ? this.textures.cityFloor
          : this.textures.desertFloor;

    const wallTex =
      cfg.id === 'lab'
        ? this.textures.labWall
        : cfg.id === 'city'
          ? this.textures.cityWall
          : this.textures.desertRock;

    const floorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: floorTex,
        bumpMap: this.textures.microBump,
        bumpScale: cfg.id === 'desert' ? 0.08 : 0.04,
        roughness: cfg.id === 'desert' ? 0.92 : 0.72,
        metalness: cfg.id === 'lab' ? 0.22 : 0.06,
      }),
    );

    // في الخرائط الخارجية تمتد الأرضية نحو الأفق لتجنب مظهر الصندوق العائم في الفراغ
    const floorSize = cfg.outdoor ? this.arenaSize * 2.6 : this.arenaSize;
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
        roughness: cfg.id === 'desert' ? 0.88 : 0.55,
        metalness: cfg.id === 'lab' ? 0.35 : 0.14,
      }),
    );

    const trimMat = this.track(
      new THREE.MeshBasicMaterial({
        color: cfg.id === 'lab' ? 0x38bdf8 : cfg.id === 'city' ? 0xf59e0b : 0xd97706,
      }),
    );

    const darkAccentMat = this.track(
      new THREE.MeshStandardMaterial({
        color: cfg.id === 'lab' ? 0x0f172a : cfg.id === 'city' ? 0x292524 : 0x5c3317,
        roughness: 0.82,
        metalness: cfg.id === 'lab' ? 0.45 : 0.1,
      }),
    );

    // بناء الحدود حسب نوع الخريطة (جدران داخلية للمختبر / حواجز طبيعية وأبنية بعيدة للخرائط الخارجية)
    if (cfg.id === 'desert') {
      this.buildDesertPerimeter(wallMat, darkAccentMat);
    } else if (cfg.id === 'city') {
      this.buildCityPerimeter(wallMat, darkAccentMat);
    } else {
      const wh = cfg.wallHeight;
      this.addBox(0, -this.halfArena, this.arenaSize, wh, 2, wallMat, trimMat, true, false);
      this.addBox(0, this.halfArena, this.arenaSize, wh, 2, wallMat, trimMat, true, false);
      this.addBox(-this.halfArena, 0, 2, wh, this.arenaSize, wallMat, trimMat, true, false);
      this.addBox(this.halfArena, 0, 2, wh, this.arenaSize, wallMat, trimMat, true, false);
      this.buildLabLandmarks(darkAccentMat, trimMat);
    }

    // بناء العوائق والسطوح والمنحدرات والصخور
    for (const [x, z, w, h, d] of cfg.layout) {
      this.addBox(x, z, w, h, d, wallMat, trimMat, false, false);
    }
    for (const [x, z, w, h, d] of cfg.rooftops) {
      this.addBox(x, z, w, h, d, wallMat, trimMat, false, true);
    }
    for (const r of cfg.ramps) {
      this.addRamp(r, darkAccentMat, trimMat);
    }
    for (const [x, z, rad] of cfg.boulders) {
      this.addBoulder(x, z, rad, wallMat, darkAccentMat);
    }

    return cfg;
  }

  /** تعديل كثافة الضباب مؤقتاً لمعدِّل الموجة (ضباب كثيف) وإعادتها للوضع الطبيعي */
  public setFogMultiplier(multiplier: number, minHeavyDensity = 0): void {
    if (this.scene.fog instanceof THREE.FogExp2) {
      const targetDensity =
        multiplier > 1
          ? Math.max(this.activeMap.fogDensity * multiplier, minHeavyDensity)
          : this.activeMap.fogDensity;
      this.scene.fog.density = targetDensity;
    }
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

  /** حدود طبيعية للصحراء بصخور جبلية محيطة بدلاً من جدار صندوقي مغلق */
  private buildDesertPerimeter(rockMat: THREE.Material, darkRockMat: THREE.Material): void {
    const cliffGeo = this.track(new THREE.DodecahedronGeometry(1, 0));
    const step = 13;
    const edge = this.halfArena + 2.5;
    for (let i = -this.halfArena; i <= this.halfArena; i += step) {
      const sides: Array<[number, number]> = [
        [i, -edge],
        [i, edge],
        [-edge, i],
        [edge, i],
      ];
      for (const [cx, cz] of sides) {
        const h = 7.5 + ((Math.abs(cx * 13 + cz * 7) % 10) * 0.95);
        const w = 8.5 + (Math.abs(cx + cz) % 4);
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
      this.obstacles.push({ x, z, hx: w / 2, hz: d / 2, h });
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
    // صخرة مركبة من 3 كتل متداخلة لتفادي شكل بدائي واحد
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
    this.obstacles.push({ x, z, hx: radius * 0.9, hz: radius * 0.85, h: radius * 1.55 });
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

  /** حل التصادم الأفقي مع العوائق وحدود الساحة */
  public resolveCollisions(pos: THREE.Vector3, radius: number, feetY: number): boolean {
    const limit = this.halfArena - 1.5;
    let hitWall = false;
    if (pos.x < -limit || pos.x > limit) hitWall = true;
    if (pos.z < -limit || pos.z > limit) hitWall = true;
    pos.x = Math.max(-limit, Math.min(limit, pos.x));
    pos.z = Math.max(-limit, Math.min(limit, pos.z));

    for (const o of this.obstacles) {
      if (feetY >= o.h - 0.65) continue;
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
    if (Math.abs(pos.x) > this.halfArena - 1 || Math.abs(pos.z) > this.halfArena - 1) return true;
    for (const o of this.obstacles) {
      if (Math.abs(pos.x - o.x) < o.hx && Math.abs(pos.z - o.z) < o.hz && pos.y < o.h) return true;
    }
    return false;
  }

  public dispose(): void {
    this.clearMap();
    disposeMapTextures(this.textures);
    this.scene.remove(this.mapGroup);
  }
}
