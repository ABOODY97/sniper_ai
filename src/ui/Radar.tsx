import { useEffect, useRef } from 'react';
import { useGameStore } from '../game/store';

/* ==========================================
   الرادار التكتيكي الدائري (Canvas 2D مستقل بدون إعادة رسم React)
   يعرض الأعداء الأرضيين والطائرين، الأبراج، الزعماء (أرضي/طائر)،
   دوائر الهاون، السطوح، وصناديق الإمداد، مع تثبيت الزعماء البعيدين على الحافة
   ========================================== */

export function Radar() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const empDisabledTimer = useGameStore((s) => s.empDisabledTimer);
  const isTouchDevice = useGameStore((s) => s.isTouchDevice);
  const isJammed = empDisabledTimer > 0;

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
      const state = useGameStore.getState();
      ctx.clearRect(0, 0, w, h);

      // تعطيل الرادار مع خطوط تشويش كهرومغناطيسي أثناء تأثير المشوِّش (EMP)
      if (state.empDisabledTimer > 0) {
        ctx.fillStyle = 'rgba(30, 10, 45, 0.92)';
        ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 6) {
          ctx.fillStyle =
            Math.random() > 0.45 ? 'rgba(192, 132, 252, 0.22)' : 'rgba(56, 189, 248, 0.14)';
          ctx.fillRect(Math.random() * 24, y, w - Math.random() * 48, 2);
        }
        return;
      }

      const rd = state.radarData;
      const scale = rd.scale || 1.65;

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

      // السطوح المرتفعة ومنصات الرافعات
      for (const p of rd.platforms) {
        const pt = toRadar(p.x, p.z);
        if (Math.hypot(pt.x - cx, pt.y - cy) < 70) {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
          const rw = p.hx * 2 * scale;
          const rh = p.hz * 2 * scale;
          ctx.fillRect(pt.x - rw / 2, pt.y - rh / 2, rw, rh);
        }
      }

      // الأعداء الأرضيون والطائرون والزعماء والصناديق ودوائر الهاون
      for (const e of rd.entities) {
        let pt = toRadar(e.x, e.z);
        const distFromCenter = Math.hypot(pt.x - cx, pt.y - cy);
        const isPriorityEdge = e.kind === 'boss' || e.kind === 'boss_flying' || e.kind === 'flying';

        if (distFromCenter >= 72) {
          if (!isPriorityEdge) continue;
          const clampRatio = 69 / distFromCenter;
          pt = {
            x: cx + (pt.x - cx) * clampRatio,
            y: cy + (pt.y - cy) * clampRatio,
          };
        }

        if (e.kind === 'mortar') {
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, (e.radius || 4) * scale, 0, Math.PI * 2);
          ctx.stroke();
        } else if (e.kind === 'pickup_health' || e.kind === 'pickup_ammo') {
          ctx.fillStyle = e.color;
          ctx.fillRect(pt.x - 2.5, pt.y - 2.5, 5, 5);
        } else if (e.kind === 'boss_flying') {
          // زعيم طائر (ملكة السرب): معيّن كبير مجنّح محاط بإطار ذهبي
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y - 7.5);
          ctx.lineTo(pt.x + 8.5, pt.y);
          ctx.lineTo(pt.x, pt.y + 6.5);
          ctx.lineTo(pt.x - 8.5, pt.y);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        } else if (e.kind === 'boss') {
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (e.kind === 'flying') {
          // عدو طائر هجومي (مدفعية طائرة / انتحاري / قناص طائر): مثلث سماوي/ملوّن حاد
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y - 5.2);
          ctx.lineTo(pt.x + 4.8, pt.y + 4.0);
          ctx.lineTo(pt.x, pt.y + 1.8);
          ctx.lineTo(pt.x - 4.8, pt.y + 4.0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.75)';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        } else if (e.kind === 'drone') {
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y - 4.2);
          ctx.lineTo(pt.x + 4.2, pt.y);
          ctx.lineTo(pt.x, pt.y + 4.2);
          ctx.lineTo(pt.x - 4.2, pt.y);
          ctx.closePath();
          ctx.fill();
        } else if (e.kind === 'turret') {
          ctx.fillStyle = e.color;
          ctx.fillRect(pt.x - 3.2, pt.y - 3.2, 6.4, 6.4);
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 1;
          ctx.strokeRect(pt.x - 3.2, pt.y - 3.2, 6.4, 6.4);
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
      className={`relative shrink-0 rounded-full bg-slate-950/88 border-2 overflow-hidden ${
        isTouchDevice ? 'w-[84px] h-[84px]' : 'w-[152px] h-[152px]'
      } ${
        isJammed
          ? 'border-fuchsia-400 shadow-[0_0_22px_rgba(192,132,252,0.45)]'
          : 'border-sky-400/70 shadow-[0_0_20px_rgba(56,189,248,0.22)]'
      }`}
      aria-label={isJammed ? 'الرادار معطّل بسبب تشويش EMP' : 'الرادار التكتيكي'}
    >
      <canvas ref={canvasRef} width={156} height={156} className="block w-full h-full" />
      {isJammed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/65 text-center px-1.5">
          <span className={`${isTouchDevice ? 'text-[9px]' : 'text-xs'} font-black text-fuchsia-300`}>
            ⚡ EMP
          </span>
          {!isTouchDevice && (
            <span className="text-[11px] font-bold text-slate-200 mt-0.5">الرادار معطّل</span>
          )}
          <span className={`${isTouchDevice ? 'text-[10px]' : 'text-xs'} font-black text-fuchsia-200 hud-nums mt-0.5`}>
            {empDisabledTimer.toFixed(1)}ث
          </span>
        </div>
      )}
    </div>
  );
}
