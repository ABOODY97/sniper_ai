import { useEffect, useRef } from 'react';
import { useGameStore } from '../game/store';

/* ==========================================
   الرادار التكتيكي الدائري (Canvas 2D مستقل بدون إعادة رسم React)
   يعرض الأعداء بألوانهم وأشكالهم، الزعيم، دوائر الهاون، السطوح، وصناديق الإمداد
   ========================================== */

export function Radar() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 156;
    const h = 156;
    const cx = w / 2;
    const cy = h / 2;

    const draw = () => {
      const rd = useGameStore.getState().radarData;
      const scale = rd.scale || 1.65;
      ctx.clearRect(0, 0, w, h);

      // دوائر المسافة
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.lineWidth = 1;
      [24, 48, 72].forEach((r) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      });

      // مخروط رؤية اللاعب
      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 74, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55);
      ctx.closePath();
      ctx.fill();

      const fx = -Math.sin(rd.yaw);
      const fz = -Math.cos(rd.yaw);
      const rx = Math.cos(rd.yaw);
      const rz = -Math.sin(rd.yaw);

      const toRadar = (tx: number, tz: number) => {
        const dx = tx - rd.playerX;
        const dz = tz - rd.playerZ;
        const forward = dx * fx + dz * fz;
        const right = dx * rx + dz * rz;
        return { x: cx + right * scale, y: cy - forward * scale };
      };

      // السطوح المرتفعة (خريطة المدينة)
      for (const p of rd.platforms) {
        const pt = toRadar(p.x, p.z);
        if (Math.hypot(pt.x - cx, pt.y - cy) < 70) {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
          const rw = p.hx * 2 * scale;
          const rh = p.hz * 2 * scale;
          ctx.fillRect(pt.x - rw / 2, pt.y - rh / 2, rw, rh);
        }
      }

      // الأعداء والصناديق ودوائر الهاون
      for (const e of rd.entities) {
        const pt = toRadar(e.x, e.z);
        if (Math.hypot(pt.x - cx, pt.y - cy) >= 74) continue;

        if (e.kind === 'mortar') {
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, (e.radius || 4) * scale, 0, Math.PI * 2);
          ctx.stroke();
        } else if (e.kind === 'pickup_health' || e.kind === 'pickup_ammo') {
          ctx.fillStyle = e.color;
          ctx.fillRect(pt.x - 2.5, pt.y - 2.5, 5, 5);
        } else if (e.kind === 'boss') {
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (e.kind === 'drone') {
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y - 4.5);
          ctx.lineTo(pt.x + 4.5, pt.y);
          ctx.lineTo(pt.x, pt.y + 4.5);
          ctx.lineTo(pt.x - 4.5, pt.y);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = e.color;
          const r = e.kind === 'heavy' ? 4.4 : 3.3;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // نقطة اللاعب في المركز
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    };

    draw();
    const timer = window.setInterval(draw, 65);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      className="w-[152px] h-[152px] rounded-full bg-slate-950/88 border-2 border-sky-400/70 shadow-[0_0_20px_rgba(56,189,248,0.22)] overflow-hidden"
      aria-label="الرادار التكتيكي"
    >
      <canvas ref={canvasRef} width={156} height={156} className="block w-full h-full" />
    </div>
  );
}
