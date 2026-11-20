import * as THREE from 'three';

/* ==========================================
   مولّد الخامات الإجرائية عالية الدقة للخرائط الثلاث
   مع ضبط SRGBColorSpace وتصفية Anisotropy وخرائط التضاريس BumpMap
   ========================================== */

export interface MapTextureBundle {
  labFloor: THREE.CanvasTexture;
  labWall: THREE.CanvasTexture;
  cityFloor: THREE.CanvasTexture;
  cityWall: THREE.CanvasTexture;
  desertFloor: THREE.CanvasTexture;
  desertRock: THREE.CanvasTexture;
  microBump: THREE.CanvasTexture;
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  return tex;
}

function createMicroBumpTexture(anisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    const v = 90 + Math.floor(Math.random() * 75);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.anisotropy = anisotropy;
  return tex;
}

function createSciFiFloorCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 252);
  ctx.strokeStyle = '#0ea5e9';
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, 232, 232);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#334155';
  ctx.fillRect(20, 20, 34, 10);
  ctx.fillRect(202, 226, 34, 10);
  return c;
}

function createLabWallCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 248);
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.stroke();
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(0, 118, 256, 8);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(0, 120, 256, 3);
  ctx.fillStyle = '#eab308';
  ctx.globalAlpha = 0.6;
  for (let i = -256; i < 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 256);
    ctx.lineTo(i + 14, 256);
    ctx.lineTo(i + 34, 228);
    ctx.lineTo(i + 20, 228);
    ctx.fill();
  }
  return c;
}

function createCityFloorCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1f1c19';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#2e2a26' : '#0f0d0c';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  ctx.strokeStyle = '#44403c';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 252, 252);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.38)';
  ctx.fillRect(122, 18, 12, 70);
  ctx.fillRect(122, 148, 12, 70);
  return c;
}

function createCityWallCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#35302c';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 252);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const lit = (row + col * 3) % 7 === 0;
      ctx.fillStyle = lit ? 'rgba(249, 115, 22, 0.62)' : '#141210';
      ctx.fillRect(18 + col * 58, 16 + row * 60, 36, 40);
    }
  }
  return c;
}

function createDesertFloorCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#c88b50';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(154, 92, 42, 0.4)';
  ctx.lineWidth = 6;
  for (let y = 16; y < 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(85, y - 12, 170, y + 12, 256, y);
    ctx.stroke();
  }
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(253, 224, 171, 0.28)' : 'rgba(120, 53, 15, 0.22)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 2);
  }
  return c;
}

function createDesertRockCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#92512e';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 22) {
    ctx.fillStyle = (y / 22) % 2 === 0 ? 'rgba(124, 45, 18, 0.36)' : 'rgba(217, 119, 6, 0.24)';
    ctx.fillRect(0, y, 256, 12);
  }
  return c;
}

export function createMapTextures(anisotropy: number): MapTextureBundle {
  return {
    labFloor: finalizeColorTexture(createSciFiFloorCanvas(), anisotropy, 28, 28),
    labWall: finalizeColorTexture(createLabWallCanvas(), anisotropy, 1, 1),
    cityFloor: finalizeColorTexture(createCityFloorCanvas(), anisotropy, 22, 22),
    cityWall: finalizeColorTexture(createCityWallCanvas(), anisotropy, 1, 1),
    desertFloor: finalizeColorTexture(createDesertFloorCanvas(), anisotropy, 48, 48),
    desertRock: finalizeColorTexture(createDesertRockCanvas(), anisotropy, 1, 1),
    microBump: createMicroBumpTexture(anisotropy),
  };
}

export function disposeMapTextures(bundle: MapTextureBundle): void {
  Object.values(bundle).forEach((tex) => tex.dispose());
}
