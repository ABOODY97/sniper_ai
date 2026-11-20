import * as THREE from 'three';

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

export class ObjectPools {
  private readonly scene: THREE.Scene;

  // مجموعة الجزيئات باستخدام InstancedMesh لنداء رسم واحد فقط
  private readonly maxParticles = 340;
  private readonly particleMesh: THREE.InstancedMesh;
  private readonly particleGeo: THREE.BoxGeometry;
  private readonly particleMat: THREE.MeshBasicMaterial;
  private readonly particles: PooledParticle[] = [];
  private particleCursor = 0;

  // مجموعة طلقات الأعداء
  private readonly bulletGeo: THREE.SphereGeometry;
  public readonly bullets: PooledBullet[] = [];

  // مجموعة آثار طلقات الأسلحة والليزر
  private readonly tracers: PooledTracer[] = [];

  // متغيرات حسابية مؤقتة لتجنب تخصيص الذاكرة في كل إطار
  private readonly _dummy = new THREE.Object3D();
  private readonly _zeroScale = new THREE.Vector3(0, 0, 0);
  private readonly _color = new THREE.Color();
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

    // 2. تهيئة مجموعة طلقات الأعداء (96 طلقة جاهزة لإعادة الاستخدام)
    this.bulletGeo = new THREE.SphereGeometry(0.18, 8, 8);
    for (let i = 0; i < 96; i++) {
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

    // 3. تهيئة مجموعة آثار الرصاص (48 خط ليزر)
    for (let i = 0; i < 48; i++) {
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
