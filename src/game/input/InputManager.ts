import type { MoveInputState } from '../types';
import type { TouchInputActions } from '../store';

/* ==========================================
   مدير الإدخال الموحّد (InputManager)
   يوحّد لوحة المفاتيح والماوس مع أوامر اللمس (عصا الحركة، السحب للنظر، وأزرار اللمس)
   مع منع قفل المؤشر والتكبير وقائمة السياق على الأجهزة اللمسية
   ========================================== */

export interface InputManagerCallbacks {
  isPlaying: () => boolean;
  isTitleScreen: () => boolean;
  isSettingsOpen: () => boolean;
  isPausedScreen: () => boolean;
  isScopedSniper: () => boolean;
  onStartFromTitle: () => void;
  onCloseSettings: () => void;
  onPauseMission: () => void;
  onResumeMission: () => void;
  onToggleMute: () => void;
  onLook: (dx: number, dy: number, source: 'mouse' | 'touch') => void;
  onFirePress: () => void;
  onAdsActivated: () => void;
  onJump: () => void;
  onSlide: () => void;
  onDash: () => void;
  onGrenade: () => void;
  onReload: () => void;
  onSwitchWeapon: (index: number) => void;
  onCycleWeapon: (step: 1 | -1) => void;
  onScopeZoomStep: (delta: 1 | -1) => void;
  onRequestPointerLock: () => void;
  onPointerLockChange: (locked: boolean) => void;
}

export class InputManager {
  private readonly targetElement: HTMLElement;
  private readonly callbacks: InputManagerCallbacks;
  public readonly isTouchDevice: boolean;

  // حالة لوحة المفاتيح والماوس
  private readonly keys: Record<string, boolean> = {};
  private mouseFireDown = false;
  private mouseAdsDown = false;

  // حالة إدخال اللمس (تُغذّى من MobileControls بدون إعادة رسم)
  private touchMoveX = 0;
  private touchMoveZ = 0;
  private touchAutoSprint = false;
  private touchFireDown = false;
  private touchAdsToggled = false;
  private touchHoldBreathDown = false;

  // كائن متجه حركة معاد استخدامه لمنع إنشاء كائنات جديدة كل إطار
  private readonly _moveOut: MoveInputState = { moveX: 0, moveZ: 0, sprint: false };

  // مراجع مستمعي الأحداث لإزالتها نظيفاً عند التخلص
  private readonly onKeyDownBound: (e: KeyboardEvent) => void;
  private readonly onKeyUpBound: (e: KeyboardEvent) => void;
  private readonly onMouseMoveBound: (e: MouseEvent) => void;
  private readonly onMouseDownBound: (e: MouseEvent) => void;
  private readonly onMouseUpBound: (e: MouseEvent) => void;
  private readonly onWheelBound: (e: WheelEvent) => void;
  private readonly onContextMenuBound: (e: MouseEvent) => void;
  private readonly onPointerLockChangeBound: () => void;
  private readonly onWindowBlurBound: () => void;
  private readonly onVisibilityChangeBound: () => void;
  private readonly onGesturePreventBound: (e: Event) => void;

  public readonly touchActions: TouchInputActions;

  constructor(
    targetElement: HTMLElement,
    isTouchDevice: boolean,
    callbacks: InputManagerCallbacks,
  ) {
    this.targetElement = targetElement;
    this.isTouchDevice = isTouchDevice;
    this.callbacks = callbacks;

    // واجهة إدخال اللمس المرتبطة بمكوّن MobileControls
    this.touchActions = {
      setTouchMove: (moveX, moveZ, autoSprint) => {
        this.touchMoveX = Math.max(-1, Math.min(1, moveX));
        this.touchMoveZ = Math.max(-1, Math.min(1, moveZ));
        this.touchAutoSprint = autoSprint;
      },
      addTouchLook: (dx, dy) => {
        if (!this.callbacks.isPlaying()) return;
        if (dx === 0 && dy === 0) return;
        this.callbacks.onLook(dx, dy, 'touch');
      },
      setTouchFire: (firing) => {
        const wasFiring = this.touchFireDown;
        this.touchFireDown = firing;
        if (firing && !wasFiring && this.callbacks.isPlaying()) {
          this.callbacks.onFirePress();
        }
      },
      toggleTouchAds: () => {
        if (!this.callbacks.isPlaying()) return;
        this.touchAdsToggled = !this.touchAdsToggled;
        if (this.touchAdsToggled) {
          this.callbacks.onAdsActivated();
        }
      },
      setTouchAds: (ads) => {
        this.touchAdsToggled = ads;
        if (ads && this.callbacks.isPlaying()) {
          this.callbacks.onAdsActivated();
        }
      },
      triggerTouchJump: () => {
        if (!this.callbacks.isPlaying()) return;
        this.callbacks.onJump();
      },
      triggerTouchSlide: () => {
        if (!this.callbacks.isPlaying()) return;
        this.callbacks.onSlide();
      },
      triggerTouchDash: () => {
        if (!this.callbacks.isPlaying()) return;
        this.callbacks.onDash();
      },
      triggerTouchReload: () => {
        if (!this.callbacks.isPlaying()) return;
        this.callbacks.onReload();
      },
      triggerTouchGrenade: () => {
        if (!this.callbacks.isPlaying()) return;
        this.callbacks.onGrenade();
      },
      cycleTouchWeapon: (step) => {
        if (!this.callbacks.isPlaying()) return;
        this.callbacks.onCycleWeapon(step);
      },
      stepTouchZoom: () => {
        if (!this.callbacks.isPlaying()) return;
        this.callbacks.onScopeZoomStep(1);
      },
      setTouchHoldBreath: (holding) => {
        this.touchHoldBreathDown = holding;
      },
    };

    // ربط مستمعي الأحداث
    this.onKeyDownBound = (e) => this.handleKeyDown(e);
    this.onKeyUpBound = (e) => this.handleKeyUp(e);
    this.onMouseMoveBound = (e) => this.handleMouseMove(e);
    this.onMouseDownBound = (e) => this.handleMouseDown(e);
    this.onMouseUpBound = (e) => this.handleMouseUp(e);
    this.onWheelBound = (e) => this.handleWheel(e);
    this.onContextMenuBound = (e) => {
      if (this.isTouchDevice || this.callbacks.isPlaying()) {
        e.preventDefault();
      }
    };
    this.onPointerLockChangeBound = () => {
      if (this.isTouchDevice) return;
      const locked = document.pointerLockElement === this.targetElement;
      this.callbacks.onPointerLockChange(locked);
    };
    this.onWindowBlurBound = () => this.clearAll();
    this.onVisibilityChangeBound = () => {
      if (document.hidden) this.clearAll();
    };
    this.onGesturePreventBound = (e) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    document.addEventListener('mousemove', this.onMouseMoveBound);
    document.addEventListener('mousedown', this.onMouseDownBound);
    document.addEventListener('mouseup', this.onMouseUpBound);
    document.addEventListener('wheel', this.onWheelBound, { passive: true });
    document.addEventListener('contextmenu', this.onContextMenuBound);
    document.addEventListener('pointerlockchange', this.onPointerLockChangeBound);
    window.addEventListener('blur', this.onWindowBlurBound);
    document.addEventListener('visibilitychange', this.onVisibilityChangeBound);

    // منع التكبير بالقرص على متصفح Safari/iOS
    document.addEventListener('gesturestart', this.onGesturePreventBound, { passive: false });
    document.addEventListener('gesturechange', this.onGesturePreventBound, { passive: false });
    document.addEventListener('gestureend', this.onGesturePreventBound, { passive: false });
  }

  /** هل زر الإطلاق مضغوط حالياً (بالماوس أو باللمس) */
  public get isFiring(): boolean {
    return this.mouseFireDown || this.touchFireDown;
  }

  /** هل وضع التصويب (ADS) نشط حالياً (بالماوس أو بزر التبديل اللمسي) */
  public get isADS(): boolean {
    return this.mouseAdsDown || this.touchAdsToggled;
  }

  /** هل زر حبس النفس نشط حالياً (Shift على الحاسوب أو زر حبس النفس على الجوال) */
  public get isHoldingBreath(): boolean {
    return Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.touchHoldBreathDown);
  }

  /** تعيين حالة الإطلاق برمجياً (للاختبار عبر معاملات الرابط) */
  public setProgrammaticFire(firing: boolean): void {
    this.mouseFireDown = firing;
  }

  /** تعيين حالة التصويب برمجياً (للاختبار أو إعادة الضبط عند التبديل/التلقيم) */
  public setProgrammaticAds(ads: boolean): void {
    this.mouseAdsDown = ads;
    this.touchAdsToggled = ads;
  }

  /** إيقاف تبديل التصويب اللمسي (مثلاً عند تبديل السلاح أو إعادة التلقيم) */
  public clearTouchAds(): void {
    this.touchAdsToggled = false;
  }

  /** حساب متجه الحركة الموحّد من لوحة المفاتيح + عصا التحكم اللمسية */
  public getMoveInput(): MoveInputState {
    let kbX = 0;
    let kbZ = 0;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) kbX += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) kbX -= 1;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) kbZ += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) kbZ -= 1;

    const kbShift = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);

    let moveX = kbX + this.touchMoveX;
    let moveZ = kbZ + this.touchMoveZ;
    const len = Math.hypot(moveX, moveZ);
    if (len > 1) {
      moveX /= len;
      moveZ /= len;
    }

    // الركض التلقائي باللمس يتوقف عند تفعيل التصويب (ADS) حتى لا يُلغي التصويب بالخطأ
    const effectiveTouchSprint = this.touchAutoSprint && !this.touchAdsToggled;

    this._moveOut.moveX = moveX;
    this._moveOut.moveZ = moveZ;
    this._moveOut.sprint = kbShift || effectiveTouchSprint;
    return this._moveOut;
  }

  /** مسح جميع المدخلات المعلقة (عند الإيقاف المؤقت أو فقدان التركيز أو نهاية الجولة) */
  public clearAll(): void {
    for (const k of Object.keys(this.keys)) {
      this.keys[k] = false;
    }
    this.mouseFireDown = false;
    this.mouseAdsDown = false;
    this.touchMoveX = 0;
    this.touchMoveZ = 0;
    this.touchAutoSprint = false;
    this.touchFireDown = false;
    this.touchAdsToggled = false;
    this.touchHoldBreathDown = false;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // اختصارات شاشة البداية: Enter أو Space تبدأ اللعب فوراً
    if (this.callbacks.isTitleScreen() && !this.callbacks.isSettingsOpen()) {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.callbacks.onStartFromTitle();
        return;
      }
    }

    // اختصار الإيقاف المؤقت / الاستئناف (Escape أو P)
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.callbacks.isSettingsOpen()) {
        this.callbacks.onCloseSettings();
        return;
      }
      if (this.callbacks.isPlaying()) {
        e.preventDefault();
        this.callbacks.onPauseMission();
        return;
      }
      if (this.callbacks.isPausedScreen()) {
        e.preventDefault();
        this.callbacks.onResumeMission();
        return;
      }
    }

    // اختصار كتم الصوت السريع (M)
    if (e.code === 'KeyM' && !e.repeat) {
      this.callbacks.onToggleMute();
      return;
    }

    const firstPress = !this.keys[e.code];
    this.keys[e.code] = true;
    if (!this.callbacks.isPlaying()) return;

    // التزحلق (C أو Ctrl)
    if (e.code === 'KeyC' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
      e.preventDefault();
      if (firstPress) {
        this.callbacks.onSlide();
      }
    }

    // القفز (Space)
    if (e.code === 'Space' && firstPress) {
      e.preventDefault();
      this.callbacks.onJump();
    }

    // الاندفاع السريع (Q)
    if (e.code === 'KeyQ' && firstPress) {
      this.callbacks.onDash();
    }

    // رمي قنبلة يدوية (G)
    if (e.code === 'KeyG' && firstPress) {
      this.callbacks.onGrenade();
    }

    // إعادة التلقيم (R)
    if (e.code === 'KeyR' && firstPress) {
      this.callbacks.onReload();
    }

    // تبديل الأسلحة بالأرقام 1-9
    if (firstPress && e.code.startsWith('Digit')) {
      const num = parseInt(e.code.replace('Digit', ''), 10);
      if (num >= 1 && num <= 9) {
        this.callbacks.onSwitchWeapon(num - 1);
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keys[e.code] = false;
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.isTouchDevice) return;
    if (!this.callbacks.isPlaying()) return;
    if (document.pointerLockElement !== this.targetElement) return;
    this.callbacks.onLook(e.movementX, e.movementY, 'mouse');
  }

  private handleMouseDown(e: MouseEvent): void {
    if (this.isTouchDevice) return;
    if (!this.callbacks.isPlaying()) return;
    const target = e.target;
    if (
      target instanceof Element &&
      target.closest('button, input, select, [data-ui-interactive="true"]')
    ) {
      return;
    }

    if (!document.pointerLockElement) {
      this.callbacks.onRequestPointerLock();
    }

    if (e.button === 0) {
      this.mouseFireDown = true;
      this.callbacks.onFirePress();
    } else if (e.button === 2) {
      this.mouseAdsDown = true;
      this.callbacks.onAdsActivated();
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (this.isTouchDevice) return;
    if (e.button === 0) this.mouseFireDown = false;
    if (e.button === 2) this.mouseAdsDown = false;
  }

  private handleWheel(e: WheelEvent): void {
    if (!this.callbacks.isPlaying()) return;
    if (this.callbacks.isScopedSniper()) {
      const zoomDelta: 1 | -1 = e.deltaY < 0 ? 1 : -1;
      this.callbacks.onScopeZoomStep(zoomDelta);
      return;
    }
    const step: 1 | -1 = e.deltaY > 0 ? 1 : -1;
    this.callbacks.onCycleWeapon(step);
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    document.removeEventListener('mousemove', this.onMouseMoveBound);
    document.removeEventListener('mousedown', this.onMouseDownBound);
    document.removeEventListener('mouseup', this.onMouseUpBound);
    document.removeEventListener('wheel', this.onWheelBound);
    document.removeEventListener('contextmenu', this.onContextMenuBound);
    document.removeEventListener('pointerlockchange', this.onPointerLockChangeBound);
    window.removeEventListener('blur', this.onWindowBlurBound);
    document.removeEventListener('visibilitychange', this.onVisibilityChangeBound);
    document.removeEventListener('gesturestart', this.onGesturePreventBound);
    document.removeEventListener('gesturechange', this.onGesturePreventBound);
    document.removeEventListener('gestureend', this.onGesturePreventBound);
  }
}
