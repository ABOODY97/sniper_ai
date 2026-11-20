import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../game/store';
import { computeJoystickInput } from '../game/rules';
import type { TouchButtonSize } from '../game/types';

/* ==========================================
   طبقة أدوات التحكم باللمس للجوال (MobileControls)
   تظهر فقط على الأجهزة اللمسية:
   - في الوضع العمودي: تنبيه «أدِر هاتفك للوضع الأفقي»
   - في الوضع الأفقي أثناء اللعب: عصا حركة يسرى (مع ركض تلقائي عند الحافة)،
     منطقة سحب يمنى للنظر، وأزرار الإطلاق والتصويب والقفز والتزحلق والاندفاع
     والتلقيم والقنابل وحبس النفس والتكبير وتبديل السلاح (التالي/السابق)
   جميع الأزرار تدعم اللمس المتعدد عبر Pointer Events و pointerId
   ========================================== */

const BUTTON_SIZE_SCALE: Record<TouchButtonSize, number> = {
  small: 0.85,
  medium: 1.0,
  large: 1.15,
};

function requestFullscreenSafe(): void {
  try {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else if (typeof el.requestFullscreen === 'function') {
      el.requestFullscreen().catch(() => {});
    } else if (typeof el.webkitRequestFullscreen === 'function') {
      el.webkitRequestFullscreen();
    }
  } catch {
    // تجاهل قيود ملء الشاشة في بعض المتصفحات
  }
}

export function MobileControls() {
  const isTouchDevice = useGameStore((s) => s.isTouchDevice);
  const isPortrait = useGameStore((s) => s.isPortrait);
  const screen = useGameStore((s) => s.screen);
  const activeADS = useGameStore((s) => s.activeADS);
  const showScope = useGameStore((s) => s.showScope);
  const scopeZoomLabel = useGameStore((s) => s.scopeZoomLabel);
  const holdBreathActive = useGameStore((s) => s.holdBreathActive);
  const holdBreathCooldown = useGameStore((s) => s.holdBreathCooldown);
  const holdBreathRatio = useGameStore((s) => s.holdBreathRatio);
  const dashCooldown = useGameStore((s) => s.dashCooldown);
  const slideCooldown = useGameStore((s) => s.slideCooldown);
  const grenades = useGameStore((s) => s.grenades);
  const isReloading = useGameStore((s) => s.isReloading);
  const touchButtonSize = useGameStore((s) => s.settings.touchButtonSize);
  const touch = useGameStore((s) => s.engineActions?.touch);

  // حالة بصرية لعصا الحركة اليسرى والضغط النشط
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0, active: false, autoSprint: false });
  const [firePressed, setFirePressed] = useState(false);
  const [breathPressed, setBreathPressed] = useState(false);

  // مراجع معرّفات اللمس المتعدد (pointerId) لضمان عدم تداخل الأصابع أبداً
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyPointerIdRef = useRef<number | null>(null);
  const joyCenterRef = useRef<{ x: number; y: number; maxRadius: number }>({
    x: 0,
    y: 0,
    maxRadius: 46,
  });

  const lookPointerIdRef = useRef<number | null>(null);
  const lookLastRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const firePointerIdRef = useRef<number | null>(null);
  const fireLastRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const breathPointerIdRef = useRef<number | null>(null);

  // تنظيف جميع حالات اللمس المعلقة عند تغيير الشاشة أو قلب الهاتف أو إلغاء التركيب
  useEffect(() => {
    if (!isTouchDevice || isPortrait || screen !== 'playing') {
      joyPointerIdRef.current = null;
      lookPointerIdRef.current = null;
      firePointerIdRef.current = null;
      breathPointerIdRef.current = null;
      touch?.setTouchMove(0, 0, false);
      touch?.setTouchFire(false);
      touch?.setTouchHoldBreath(false);
      setJoyKnob({ x: 0, y: 0, active: false, autoSprint: false });
      setFirePressed(false);
      setBreathPressed(false);
    }
    return () => {
      touch?.setTouchMove(0, 0, false);
      touch?.setTouchFire(false);
      touch?.setTouchHoldBreath(false);
    };
  }, [isTouchDevice, isPortrait, screen, touch]);

  // عدم عرض أي عنصر على أجهزة الحاسوب
  if (!isTouchDevice) return null;

  // شاشة تنبيه تدوير الهاتف في الوضع العمودي
  if (isPortrait) {
    return (
      <div
        data-testid="rotate-overlay"
        data-ui-interactive="true"
        className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-950/96 p-6 text-center select-none touch-none"
        role="alert"
        aria-live="assertive"
      >
        <div className="w-20 h-20 rounded-2xl bg-sky-500/15 border border-sky-400/50 flex items-center justify-center mb-5 shadow-[0_0_32px_rgba(56,189,248,0.25)]">
          <svg
            viewBox="0 0 64 64"
            className="w-12 h-12 text-sky-300"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="20" y="10" width="24" height="42" rx="4" />
            <line x1="29" y1="46" x2="35" y2="46" />
            <path d="M50 22a16 16 0 0 1 2 22" className="text-amber-400" stroke="currentColor" />
            <polyline points="55 38 52 44 46 42" className="text-amber-400" stroke="currentColor" />
          </svg>
        </div>

        <h2 className="text-2xl font-black text-slate-50 mb-2">أدِر هاتفك للوضع الأفقي</h2>
        <p className="text-sm font-bold text-slate-300 max-w-xs leading-relaxed mb-6">
          بروتوكول القنص مصمّمة للعب بالوضع الأفقي لتوفير مساحة مريحة لعصا الحركة وأزرار القتال والتصويب.
        </p>

        <button
          type="button"
          onClick={requestFullscreenSafe}
          className="px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-black text-sm cursor-pointer"
        >
          تفعيل ملء الشاشة
        </button>
      </div>
    );
  }

  if (screen !== 'playing') return null;

  const btnScale = BUTTON_SIZE_SCALE[touchButtonSize] ?? 1.0;

  // --- معالجات عصا الحركة اليسرى ---
  const handleJoystickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (joyPointerIdRef.current !== null) return;
    const base = joyBaseRef.current;
    if (!base) return;

    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxRadius = rect.width * 0.39;

    joyPointerIdRef.current = e.pointerId;
    joyCenterRef.current = { x: cx, y: cy, maxRadius };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // تجاهل
    }

    const res = computeJoystickInput(e.clientX - cx, e.clientY - cy, maxRadius);
    setJoyKnob({
      x: res.knobX / btnScale,
      y: res.knobY / btnScale,
      active: true,
      autoSprint: res.autoSprint,
    });
    touch?.setTouchMove(res.moveX, res.moveZ, res.autoSprint);
  };

  const handleJoystickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== joyPointerIdRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const { x: cx, y: cy, maxRadius } = joyCenterRef.current;
    const res = computeJoystickInput(e.clientX - cx, e.clientY - cy, maxRadius);
    setJoyKnob({
      x: res.knobX / btnScale,
      y: res.knobY / btnScale,
      active: true,
      autoSprint: res.autoSprint,
    });
    touch?.setTouchMove(res.moveX, res.moveZ, res.autoSprint);
  };

  const handleJoystickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== joyPointerIdRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    joyPointerIdRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // تجاهل
    }
    setJoyKnob({ x: 0, y: 0, active: false, autoSprint: false });
    touch?.setTouchMove(0, 0, false);
  };

  // --- معالجات منطقة السحب اليمنى لتوجيه النظر ---
  const handleLookDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (lookPointerIdRef.current !== null) return;
    lookPointerIdRef.current = e.pointerId;
    lookLastRef.current = { x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // تجاهل
    }
  };

  const handleLookMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== lookPointerIdRef.current) return;
    e.preventDefault();
    const dx = e.clientX - lookLastRef.current.x;
    const dy = e.clientY - lookLastRef.current.y;
    lookLastRef.current = { x: e.clientX, y: e.clientY };
    touch?.addTouchLook(dx, dy);
  };

  const handleLookUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== lookPointerIdRef.current) return;
    e.preventDefault();
    lookPointerIdRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // تجاهل
    }
  };

  // --- معالجات زر الإطلاق (يدعم السحب للتصويب أثناء الإطلاق) ---
  const handleFireDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (firePointerIdRef.current !== null) return;
    firePointerIdRef.current = e.pointerId;
    fireLastRef.current = { x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // تجاهل
    }
    setFirePressed(true);
    touch?.setTouchFire(true);
  };

  const handleFireMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerId !== firePointerIdRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const dx = e.clientX - fireLastRef.current.x;
    const dy = e.clientY - fireLastRef.current.y;
    fireLastRef.current = { x: e.clientX, y: e.clientY };
    if (dx !== 0 || dy !== 0) {
      touch?.addTouchLook(dx, dy);
    }
  };

  const handleFireUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerId !== firePointerIdRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    firePointerIdRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // تجاهل
    }
    setFirePressed(false);
    touch?.setTouchFire(false);
  };

  // --- معالجات زر حبس النفس (ضغط مستمر) ---
  const handleBreathDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (breathPointerIdRef.current !== null) return;
    breathPointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // تجاهل
    }
    setBreathPressed(true);
    touch?.setTouchHoldBreath(true);
  };

  const handleBreathUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerId !== breathPointerIdRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    breathPointerIdRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // تجاهل
    }
    setBreathPressed(false);
    touch?.setTouchHoldBreath(false);
  };

  // مساعد مختصر لأزرار النقر الفوري (متعددة اللمس بدون تداخل مع منطقة النظر)
  const makeTapHandler = (fn: () => void) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  return (
    <div
      data-testid="mobile-controls"
      className="fixed inset-0 z-20 pointer-events-none select-none touch-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* منطقة السحب اليمنى لتوجيه الكاميرا والنظر بحرية */}
      <div
        data-testid="touch-look-pad"
        data-ui-interactive="true"
        onPointerDown={handleLookDown}
        onPointerMove={handleLookMove}
        onPointerUp={handleLookUp}
        onPointerCancel={handleLookUp}
        className="fixed top-14 bottom-0 right-0 left-[38%] z-10 pointer-events-auto touch-none"
        aria-label="منطقة السحب لتوجيه النظر"
      />

      {/* اليسار: عصا الحركة الافتراضية + زر حبس النفس أعلى العصا لسهولة الاستخدام بإبهام اليد اليسرى */}
      <div
        data-ui-interactive="true"
        className="fixed bottom-3 left-3 z-20 pointer-events-auto flex flex-col items-start gap-2.5 touch-none"
        style={{
          transform: `scale(${btnScale})`,
          transformOrigin: 'bottom left',
        }}
      >
        {/* زر حبس النفس (مفيد خاصة مع منظار القناصة بيد واحدة بينما اليد اليمنى تصوّب وتطلق) */}
        <button
          type="button"
          data-testid="touch-hold-breath"
          onPointerDown={handleBreathDown}
          onPointerUp={handleBreathUp}
          onPointerCancel={handleBreathUp}
          aria-label="حبس النفس لتثبيت المنظار"
          className={`h-9 px-3 rounded-lg border text-[11px] font-black flex items-center gap-1.5 touch-none cursor-pointer transition-colors ${
            holdBreathActive || breathPressed
              ? 'bg-emerald-500/35 border-emerald-300 text-emerald-100 shadow-[0_0_16px_rgba(16,185,129,0.45)]'
              : showScope
                ? 'bg-slate-950/90 border-sky-400/80 text-sky-200'
                : 'bg-slate-950/75 border-slate-600/75 text-slate-300'
          }`}
        >
          <span>حبس النفس</span>
          <span className="text-[10px] hud-nums text-sky-300">
            {holdBreathCooldown > 0
              ? `${holdBreathCooldown.toFixed(1)}ث`
              : `${Math.round(Math.max(0, Math.min(1, holdBreathRatio)) * 100)}%`}
          </span>
        </button>

        {/* عصا التحكم الافتراضية للحركة والركض التلقائي عند الحافة */}
        <div
          ref={joyBaseRef}
          data-testid="touch-joystick"
          onPointerDown={handleJoystickDown}
          onPointerMove={handleJoystickMove}
          onPointerUp={handleJoystickUp}
          onPointerCancel={handleJoystickUp}
          className={`relative w-[122px] h-[122px] rounded-full border-2 touch-none flex items-center justify-center ${
            joyKnob.autoSprint
              ? 'bg-emerald-950/55 border-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.4)]'
              : joyKnob.active
                ? 'bg-slate-950/65 border-sky-400/85'
                : 'bg-slate-950/50 border-slate-500/65'
          }`}
          aria-label="عصا الحركة الافتراضية"
        >
          {/* حلقة إرشادية للركض التلقائي في الأعلى */}
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-black tracking-tight text-emerald-300/90 pointer-events-none">
            {joyKnob.autoSprint ? 'ركض تلقائي' : 'ركض ▲'}
          </div>
          <div className="w-[74px] h-[74px] rounded-full border border-dashed border-slate-400/25 pointer-events-none" />
          {/* مقبض العصا المتحرك */}
          <div
            className={`absolute w-[48px] h-[48px] rounded-full border-2 pointer-events-none ${
              joyKnob.autoSprint
                ? 'bg-emerald-400/80 border-emerald-100 shadow-[0_0_16px_rgba(52,211,153,0.65)]'
                : 'bg-sky-400/70 border-sky-100 shadow-[0_0_12px_rgba(56,189,248,0.45)]'
            }`}
            style={{
              transform: `translate3d(${joyKnob.x}px, ${joyKnob.y}px, 0)`,
            }}
          />
        </div>
      </div>

      {/* أسفل المنتصف: زرا السلاح السابق والتالي بجانبي شريط السلاح المصغّر */}
      <div
        data-ui-interactive="true"
        className="fixed bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center justify-between w-[274px]"
      >
        <button
          type="button"
          data-testid="touch-prev-weapon"
          onPointerDown={makeTapHandler(() => touch?.cycleTouchWeapon(-1))}
          aria-label="السلاح السابق"
          className="pointer-events-auto h-10 px-2.5 rounded-lg bg-slate-950/88 border border-slate-600/80 active:border-sky-400 active:bg-sky-950/80 text-[11px] font-black text-slate-100 touch-none cursor-pointer"
        >
          السابق
        </button>
        <button
          type="button"
          data-testid="touch-next-weapon"
          onPointerDown={makeTapHandler(() => touch?.cycleTouchWeapon(1))}
          aria-label="السلاح التالي"
          className="pointer-events-auto h-10 px-2.5 rounded-lg bg-slate-950/88 border border-slate-600/80 active:border-sky-400 active:bg-sky-950/80 text-[11px] font-black text-slate-100 touch-none cursor-pointer"
        >
          التالي
        </button>
      </div>

      {/* اليمين: مجموعة أزرار القتال والحركة المرتّبة هندسياً حول إبهام اليد اليمنى */}
      <div
        data-ui-interactive="true"
        className="fixed bottom-2 right-2 z-20 w-[190px] h-[206px] pointer-events-none touch-none"
        style={{
          transform: `scale(${btnScale})`,
          transformOrigin: 'bottom right',
        }}
      >
        {/* زر تغيير التكبير (x4/x8/x12) يظهر فوق زر التصويب عند استخدام منظار القناصة */}
        {showScope && (
          <button
            type="button"
            data-testid="touch-zoom"
            onPointerDown={makeTapHandler(() => touch?.stepTouchZoom())}
            aria-label="تغيير مستوى التكبير"
            className="pointer-events-auto absolute right-[6px] bottom-[174px] h-8 px-2.5 rounded-lg bg-sky-950/92 border border-sky-400 text-[11px] font-black text-sky-200 touch-none cursor-pointer shadow-md"
          >
            تكبير <span dir="ltr">{scopeZoomLabel}</span>
          </button>
        )}

        {/* زر التصويب (تبديل ADS تشغيل/إيقاف) */}
        <button
          type="button"
          data-testid="touch-aim"
          onPointerDown={makeTapHandler(() => touch?.toggleTouchAds())}
          aria-pressed={activeADS}
          aria-label="تبديل التصويب"
          className={`pointer-events-auto absolute right-[4px] bottom-[114px] w-[54px] h-[54px] rounded-full border-2 text-[11px] font-black flex items-center justify-center touch-none cursor-pointer transition-colors ${
            activeADS
              ? 'bg-sky-500/85 border-sky-100 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.6)]'
              : 'bg-slate-950/82 border-sky-400/75 text-sky-200'
          }`}
        >
          تصويب
        </button>

        {/* زر القفز */}
        <button
          type="button"
          data-testid="touch-jump"
          onPointerDown={makeTapHandler(() => touch?.triggerTouchJump())}
          aria-label="قفز"
          className="pointer-events-auto absolute right-[4px] bottom-[56px] w-[52px] h-[52px] rounded-full bg-slate-950/82 border-2 border-slate-500/85 active:border-sky-300 active:bg-sky-900/70 text-[11px] font-black text-slate-100 flex items-center justify-center touch-none cursor-pointer"
        >
          قفز
        </button>

        {/* زر الإطلاق الرئيسي (دائرة كبيرة واضحة — يدعم السحب للتصويب أثناء الإطلاق) */}
        <button
          type="button"
          data-testid="touch-fire"
          onPointerDown={handleFireDown}
          onPointerMove={handleFireMove}
          onPointerUp={handleFireUp}
          onPointerCancel={handleFireUp}
          aria-label="إطلاق النار"
          className={`pointer-events-auto absolute right-[64px] bottom-[58px] w-[68px] h-[68px] rounded-full border-2 text-sm font-black flex items-center justify-center touch-none cursor-pointer transition-transform ${
            firePressed
              ? 'bg-red-500/90 border-red-100 text-white scale-95 shadow-[0_0_26px_rgba(239,68,68,0.75)]'
              : 'bg-red-600/75 border-red-300/90 text-white shadow-[0_0_18px_rgba(239,68,68,0.45)]'
          }`}
        >
          إطلاق
        </button>

        {/* زر إعادة التلقيم */}
        <button
          type="button"
          data-testid="touch-reload"
          onPointerDown={makeTapHandler(() => touch?.triggerTouchReload())}
          aria-label="إعادة التلقيم"
          className={`pointer-events-auto absolute right-[74px] bottom-[134px] w-[46px] h-[46px] rounded-full border-2 text-[10px] font-black flex items-center justify-center touch-none cursor-pointer ${
            isReloading
              ? 'bg-amber-500/40 border-amber-300 text-amber-100'
              : 'bg-slate-950/82 border-amber-400/75 active:bg-amber-900/70 text-amber-200'
          }`}
        >
          تلقيم
        </button>

        {/* زر القنبلة اليدوية مع عداد المتبقي */}
        <button
          type="button"
          data-testid="touch-grenade"
          onPointerDown={makeTapHandler(() => touch?.triggerTouchGrenade())}
          aria-label="رمي قنبلة يدوية"
          className={`pointer-events-auto absolute right-[132px] bottom-[122px] w-[48px] h-[48px] rounded-full border-2 text-[10px] font-black flex flex-col items-center justify-center leading-tight touch-none cursor-pointer ${
            grenades > 0
              ? 'bg-slate-950/82 border-emerald-400/80 active:bg-emerald-900/70 text-emerald-200'
              : 'bg-slate-950/60 border-slate-700 text-slate-500'
          }`}
        >
          <span>قنبلة</span>
          <span className="text-[10px] hud-nums">{grenades}</span>
        </button>

        {/* زر التزحلق */}
        <button
          type="button"
          data-testid="touch-slide"
          onPointerDown={makeTapHandler(() => touch?.triggerTouchSlide())}
          aria-label="تزحلق"
          className={`pointer-events-auto absolute right-[66px] bottom-[6px] w-[46px] h-[46px] rounded-full border-2 text-[10px] font-black flex flex-col items-center justify-center leading-tight touch-none cursor-pointer ${
            slideCooldown > 0
              ? 'bg-slate-950/65 border-slate-600 text-slate-400'
              : 'bg-slate-950/82 border-cyan-400/80 active:bg-cyan-900/70 text-cyan-200'
          }`}
        >
          <span>تزحلق</span>
          {slideCooldown > 0 && <span className="text-[9px] hud-nums">{slideCooldown.toFixed(0)}</span>}
        </button>

        {/* زر الاندفاع السريع */}
        <button
          type="button"
          data-testid="touch-dash"
          onPointerDown={makeTapHandler(() => touch?.triggerTouchDash())}
          aria-label="اندفاع سريع"
          className={`pointer-events-auto absolute right-[122px] bottom-[6px] w-[46px] h-[46px] rounded-full border-2 text-[10px] font-black flex flex-col items-center justify-center leading-tight touch-none cursor-pointer ${
            dashCooldown > 0
              ? 'bg-slate-950/65 border-slate-600 text-slate-400'
              : 'bg-slate-950/82 border-amber-400/80 active:bg-amber-900/70 text-amber-200'
          }`}
        >
          <span>اندفاع</span>
          {dashCooldown > 0 && <span className="text-[9px] hud-nums">{dashCooldown.toFixed(1)}</span>}
        </button>
      </div>
    </div>
  );
}
