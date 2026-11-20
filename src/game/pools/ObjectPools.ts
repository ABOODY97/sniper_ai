import * as THREE from 'three';
import { PLAYER_CONSTANTS } from '../rules';

/* ==========================================
   تجميع الكائنات (Object Pooling) للطلقات والجزيئات وآثار الرصاص
   يمنع تخصيص الذاكرة المتكرر داخل حلقة الرسم ويحافظ على 60 إطار/ثانية
   ========================================== */

export interface PooledBullet {
  active: boolean;
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  vel: THREE.Vector3;
  dmg: number;
  life: number;
}

interface PooledParticle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  life: number;
  maxLife: number;
  baseScale: number;
}

interface PooledTracer {
  active: boolean;
  line: THREE.Line;
  positions: Float32Array;
  material: THREE.LineBasicMaterial;
  life: number;
  maxLife: number;
}

interface PooledFlameParticle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
}

export class ObjectPools {
  private readonly scene: THREE.Scene;

  // مجموعة الجزيئات باستخدام InstancedMesh لنداء رسم واحد فقط
  private readonly maxParticles = 340;
  private readonly particleMesh: THREE.InstancedMesh;
  private readonly particleGeo: THREE.BoxGeometry;
  private readonly particleMat: THREE.MeshBasicMaterial;
  private readonly particles: PooledParticle[] = [];
  private particleCursor = 0;

  // مجمع جزيئات اللهب المخصص (حد أقصى صارم 120 على الجودة العالية و48 على المنخفضة)
  private readonly maxFlameParticles = PLAYER_CONSTANTS.FLAME_PARTICLE_CAP_HIGH;
  private effectiveFlameCap: number = PLAYER_CONSTANTS.FLAME_PARTICLE_CAP_HIGH;
  private readonly flameMesh: THREE.InstancedMesh;
  private readonly flameGeo: THREE.IcosahedronGeometry;
  private readonly flameMat: THREE.MeshBasicMaterial;
  private readonly flameParticles: PooledFlameParticle[] = [];
  private flameCursor = 0;

  // مجموعة طلقات الأعداء
  private readonly bulletGeo: THREE.SphereGeometry;
  public readonly bullets: PooledBullet[] = [];

  // مجموعة آثار طلقات الأسلحة والليزر
  private readonly tracers: PooledTracer[] = [];

  // متغيرات حسابية مؤقتة لتجنب تخصيص الذاكرة في كل إطار
  private readonly _dummy = new THREE.Object3D();
  private readonly _zeroScale = new THREE.Vector3(0, 0, 0);
  private readonly _color = new THREE.Color();
  private readonly _flameYellow = new THREE.Color(0xfef08a);
  private readonly _flameOrange = new THREE.Color(0xf97316);
  private readonly _flameRed = new THREE.Color(0xb91c1c);
  private readonly _right = new THREE.Vector3();
  private readonly _up = new THREE.Vector3();
  private readonly _worldUp = new THREE.Vector3(0, 1, 0);
  private qualityScale = 1.0;
  private mapParticleScale = 1.0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. تهيئة مجموعة الجزيئات
    this.particleGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    this.particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(this.particleGeo, this.particleMat, this.maxParticles);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;

    for (let i = 0; i < this.maxParticles; i++) {
      this._dummy.position.set(0, -9999, 0);
      this._dummy.scale.copy(this._zeroScale);
      this._dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, this._dummy.matrix);
      this.particleMesh.setColorAt(i, this._color.setHex(0xffffff));
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(0, -9999, 0),
        vel: new THREE.Vector3(),
        color: new THREE.Color(0xffffff),
        life: 0,
        maxLife: 0.4,
        baseScale: 1,
      });
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.particleMesh);

    // 1.5 تهيئة مجمع جزيئات اللهب المخصص (نداء رسم واحد، حد أقصى 120)
    this.flameGeo = new THREE.IcosahedronGeometry(0.24, 0);
    this.flameMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flameMesh = new THREE.InstancedMesh(this.flameGeo, this.flameMat, this.maxFlameParticles);
    this.flameMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.flameMesh.frustumCulled = false;

    for (let i = 0; i < this.maxFlameParticles; i++) {
      this._dummy.position.set(0, -9999, 0);
      this._dummy.scale.copy(this._zeroScale);
      this._dummy.updateMatrix();
      this.flameMesh.setMatrixAt(i, this._dummy.matrix);
      this.flameMesh.setColorAt(i, this._flameOrange);
      this.flameParticles.push({
        active: false,
        pos: new THREE.Vector3(0, -9999, 0),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.4,
        startScale: 0.5,
        endScale: 1.8,
      });
    }
    this.flameMesh.instanceMatrix.needsUpdate = true;
    if (this.flameMesh.instanceColor) this.flameMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.flameMesh);

    // 2. تهيئة مجموعة طلقات الأعداء (144 طلقة جاهزة لإعادة الاستخدام لدعم المدفعية الطائرة والزعماء)
    this.bulletGeo = new THREE.SphereGeometry(0.18, 8, 8);
    for (let i = 0; i < 144; i++) {
      const material = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const mesh = new THREE.Mesh(this.bulletGeo, material);
      mesh.visible = false;
      this.scene.add(mesh);
      this.bullets.push({
        active: false,
        mesh,
        material,
        vel: new THREE.Vector3(),
        dmg: 10,
        life: 0,
      });
    }

    // 3. تهيئة مجموعة آثار الرصاص (64 خط ليزر)
    for (let i = 0; i < 64; i++) {
      const positions = new Float32Array(6);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.8,
      });
      const line = new THREE.Line(geo, material);
      line.visible = false;
      line.frustumCulled = false;
      this.scene.add(line);
      this.tracers.push({
        active: false,
        line,
        positions,
        material,
        life: 0,
        maxLife: 0.1,
      });
    }
  }

  /** ضبط كثافة الجزيئات حسب إعداد الجودة (عالية/منخفضة) */
  public setQuality(high: boolean): void {
    this.qualityScale = high ? 1.0 : 0.45;
    this.effectiveFlameCap = high
      ? PLAYER_CONSTANTS.FLAME_PARTICLE_CAP_HIGH
      : PLAYER_CONSTANTS.FLAME_PARTICLE_CAP_LOW;
    // إخفاء أي جزيئات لهب تتجاوز الحد المنخفض فوراً
    for (let i = this.effectiveFlameCap; i < this.maxFlameParticles; i++) {
      if (this.flameParticles[i].active) {
        this.flameParticles[i].active = false;
        this._dummy.position.set(0, -9999, 0);
        this._dummy.scale.copy(this._zeroScale);
        this._dummy.updateMatrix();
        this.flameMesh.setMatrixAt(i, this._dummy.matrix);
      }
    }
    this.flameCursor %= this.effectiveFlameCap;
    this.flameMesh.instanceMatrix.needsUpdate = true;
  }

  /** ضبط معامل الجزيئات حسب مساحة الخريطة (أقل في الخرائط الكبيرة 150-200 لتحسين الأداء) */
  public setMapParticleScale(scale: number): void {
    this.mapParticleScale = Math.max(0.35, Math.min(1.0, scale));
  }

  /** توليد انفجار جزيئات من المجمع الدائري */
  public spawnExplosion(pos: THREE.Vector3, colorHex: number, count: number, speed = 9): void {
    const actualCount = Math.max(1, Math.round(count * this.qualityScale * this.mapParticleScale));
    for (let i = 0; i < actualCount; i++) {
      const idx = this.particleCursor;
      const p = this.particles[idx];
      this.particleCursor = (this.particleCursor + 1) % this.maxParticles;

      p.active = true;
      p.pos.copy(pos);
      p.vel.set(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.8 + 0.5,
        (Math.random() - 0.5) * speed,
      );
      p.color.setHex(colorHex);
      p.maxLife = 0.32 + Math.random() * 0.25;
      p.life = p.maxLife;
      p.baseScale = 0.85 + Math.random() * 0.55;
      this.particleMesh.setColorAt(idx, p.color);
    }
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  /** توليد غبار التزحلق أسفل اللاعب */
  public spawnSlideDust(
    x: number,
    feetY: number,
    z: number,
    slideDir: THREE.Vector3,
    colorHex: number,
  ): void {
    const effScale = this.qualityScale * this.mapParticleScale;
    const count = effScale < 0.48 ? 1 : effScale < 0.78 ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const idx = this.particleCursor;
      const p = this.particles[idx];
      this.particleCursor = (this.particleCursor + 1) % this.maxParticles;

      p.active = true;
      p.pos.set(x + (Math.random() - 0.5) * 0.7, feetY + 0.12, z + (Math.random() - 0.5) * 0.7);
      p.vel.set(
        -slideDir.x * (2.5 + Math.random() * 2.5) + (Math.random() - 0.5) * 2.2,
        1.2 + Math.random() * 2.0,
        -slideDir.z * (2.5 + Math.random() * 2.5) + (Math.random() - 0.5) * 2.2,
      );
      p.color.setHex(colorHex);
      p.maxLife = 0.28 + Math.random() * 0.18;
      p.life = p.maxLife;
      p.baseScale = 0.9;
      this.particleMesh.setColorAt(idx, p.color);
    }
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  /** توليد جزيئات مخروط قاذف اللهب من المجمع المخصص (مع احترام السقف الصارم للجودة) */
  public spawnFlameConeParticles(
    origin: THREE.Vector3,
    forwardDir: THREE.Vector3,
    count: number,
    range: number = PLAYER_CONSTANTS.FLAME_RANGE,
    coneAngleDeg: number = PLAYER_CONSTANTS.FLAME_CONE_DEG,
  ): void {
    const cap = this.effectiveFlameCap;
    const actualCount = Math.max(1, Math.round(count * (cap / this.maxFlameParticles)));
    const halfAngleRad = ((coneAngleDeg * 0.5) * Math.PI) / 180;
    const maxTan = Math.tan(halfAngleRad) * 0.72;

    this._right.crossVectors(forwardDir, this._worldUp);
    if (this._right.lengthSq() < 1e-5) {
      this._right.set(1, 0, 0);
    } else {
      this._right.normalize();
    }
    this._up.crossVectors(this._right, forwardDir).normalize();

    for (let i = 0; i < actualCount; i++) {
      const idx = this.flameCursor % cap;
      this.flameCursor = (idx + 1) % cap;
      const fp = this.flameParticles[idx];

      const angle = Math.random() * Math.PI * 2;
      const radial = Math.sqrt(Math.random()) * maxTan;
      const speed = (range / 0.46) * (0.82 + Math.random() * 0.34);

      fp.active = true;
      fp.pos.copy(origin).addScaledVector(forwardDir, 0.15 + Math.random() * 0.25);
      fp.vel
        .copy(forwardDir)
        .addScaledVector(this._right, Math.cos(angle) * radial)
        .addScaledVector(this._up, Math.sin(angle) * radial)
        .normalize()
        .multiplyScalar(speed);
      fp.maxLife = 0.32 + Math.random() * 0.2;
      fp.life = fp.maxLife;
      fp.startScale = 0.45 + Math.random() * 0.25;
      fp.endScale = 2.0 + Math.random() * 0.9;
      this.flameMesh.setColorAt(idx, this._flameYellow);
    }
    if (this.flameMesh.instanceColor) {
      this.flameMesh.instanceColor.needsUpdate = true;
    }
  }

  /** توليد جمر احتراق خفيف فوق الأعداء المشتعلين */
  public spawnBurnEmber(pos: THREE.Vector3): void {
    const cap = this.effectiveFlameCap;
    const idx = this.flameCursor % cap;
    this.flameCursor = (idx + 1) % cap;
    const fp = this.flameParticles[idx];

    fp.active = true;
    fp.pos.set(
      pos.x + (Math.random() - 0.5) * 0.65,
      pos.y + Math.random() * 0.8,
      pos.z + (Math.random() - 0.5) * 0.65,
    );
    fp.vel.set((Math.random() - 0.5) * 1.1, 2.2 + Math.random() * 1.6, (Math.random() - 0.5) * 1.1);
    fp.maxLife = 0.38 + Math.random() * 0.22;
    fp.life = fp.maxLife;
    fp.startScale = 0.55;
    fp.endScale = 0.18;
    this.flameMesh.setColorAt(idx, this._flameOrange);
    if (this.flameMesh.instanceColor) {
      this.flameMesh.instanceColor.needsUpdate = true;
    }
  }

  /** استعارة طلقة عدو من المجمع */
  public spawnEnemyBullet(
    origin: THREE.Vector3,
    velocity: THREE.Vector3,
    dmg: number,
    colorHex: number,
    scale = 1.0,
    life = 4.5,
  ): void {
    let slot = this.bullets.find((b) => !b.active);
    if (!slot) {
      slot = this.bullets[0];
    }
    slot.active = true;
    slot.mesh.visible = true;
    slot.mesh.position.copy(origin);
    slot.mesh.scale.setScalar(scale);
    slot.material.color.setHex(colorHex);
    slot.vel.copy(velocity);
    slot.dmg = dmg;
    slot.life = life;
  }

  /** استعارة خط أثر طلقة من المجمع */
  public spawnTracer(
    start: THREE.Vector3,
    end: THREE.Vector3,
    colorHex: number,
    duration = 0.08,
    opacity = 0.85,
  ): void {
    let slot = this.tracers.find((t) => !t.active);
    if (!slot) {
      slot = this.tracers[0];
    }
    slot.active = true;
    slot.positions[0] = start.x;
    slot.positions[1] = start.y;
    slot.positions[2] = start.z;
    slot.positions[3] = end.x;
    slot.positions[4] = end.y;
    slot.positions[5] = end.z;

    const attr = slot.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;
    slot.material.color.setHex(colorHex);
    slot.material.opacity = opacity;
    slot.life = duration;
    slot.maxLife = duration;
    slot.line.visible = true;
  }

  /** تحديث الجزيئات وآثار الرصاص كل إطار */
  public updateEffects(dt: number): void {
    let particlesDirty = false;
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      particlesDirty = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this._dummy.position.set(0, -9999, 0);
        this._dummy.scale.copy(this._zeroScale);
        this._dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }
      p.vel.y -= 18 * dt;
      p.pos.addScaledVector(p.vel, dt);
      const s = Math.max(0.01, (p.life / p.maxLife) * p.baseScale);
      this._dummy.position.copy(p.pos);
      this._dummy.scale.setScalar(s);
      this._dummy.rotation.set(p.life * 6, p.life * 4, 0);
      this._dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, this._dummy.matrix);
    }
    if (particlesDirty) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
    }

    let flamesDirty = false;
    let flameColorDirty = false;
    for (let i = 0; i < this.maxFlameParticles; i++) {
      const fp = this.flameParticles[i];
      if (!fp.active) continue;
      flamesDirty = true;
      fp.life -= dt;
      if (fp.life <= 0) {
        fp.active = false;
        this._dummy.position.set(0, -9999, 0);
        this._dummy.scale.copy(this._zeroScale);
        this._dummy.updateMatrix();
        this.flameMesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }
      // طفو طفيف للهب للأعلى وتباطؤ هوائي تدريجي
      fp.vel.multiplyScalar(Math.max(0, 1 - 1.9 * dt));
      fp.vel.y += 2.8 * dt;
      fp.pos.addScaledVector(fp.vel, dt);

      const t = 1 - fp.life / fp.maxLife;
      const scale = fp.startScale + (fp.endScale - fp.startScale) * t;
      this._dummy.position.copy(fp.pos);
      this._dummy.scale.setScalar(Math.max(0.05, scale));
      this._dummy.rotation.set(t * 4.5, t * 3.2, t * 2.1);
      this._dummy.updateMatrix();
      this.flameMesh.setMatrixAt(i, this._dummy.matrix);

      if (t < 0.45) {
        this._color.lerpColors(this._flameYellow, this._flameOrange, t / 0.45);
      } else {
        this._color.lerpColors(this._flameOrange, this._flameRed, (t - 0.45) / 0.55);
      }
      this.flameMesh.setColorAt(i, this._color);
      flameColorDirty = true;
    }
    if (flamesDirty) {
      this.flameMesh.instanceMatrix.needsUpdate = true;
    }
    if (flameColorDirty && this.flameMesh.instanceColor) {
      this.flameMesh.instanceColor.needsUpdate = true;
    }

    for (let i = 0; i < this.tracers.length; i++) {
      const t = this.tracers[i];
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        t.line.visible = false;
      } else {
        t.material.opacity = Math.max(0, t.life / t.maxLife);
      }
    }
  }

  /** تفريغ جميع الكائنات النشطة عند إعادة بدء اللعبة */
  public clearAll(): void {
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      p.active = false;
      this._dummy.position.set(0, -9999, 0);
      this._dummy.scale.copy(this._zeroScale);
      this._dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.maxFlameParticles; i++) {
      const fp = this.flameParticles[i];
      fp.active = false;
      this._dummy.position.set(0, -9999, 0);
      this._dummy.scale.copy(this._zeroScale);
      this._dummy.updateMatrix();
      this.flameMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.flameMesh.instanceMatrix.needsUpdate = true;

    for (const b of this.bullets) {
      b.active = false;
      b.mesh.visible = false;
    }
    for (const t of this.tracers) {
      t.active = false;
      t.line.visible = false;
    }
  }

  /** تحرير الموارد الهندسية والمواد عند التخلص من المحرك */
  public dispose(): void {
    this.scene.remove(this.particleMesh);
    this.particleGeo.dispose();
    this.particleMat.dispose();

    this.scene.remove(this.flameMesh);
    this.flameGeo.dispose();
    this.flameMat.dispose();

    for (const b of this.bullets) {
      this.scene.remove(b.mesh);
      b.material.dispose();
    }
    this.bulletGeo.dispose();

    for (const t of this.tracers) {
      this.scene.remove(t.line);
      t.line.geometry.dispose();
      t.material.dispose();
    }
  }
}
