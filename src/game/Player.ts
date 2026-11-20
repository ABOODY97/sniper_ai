import * as THREE from 'three';
import type { MoveInputState } from './types';
import type { MapManager } from './maps/MapManager';
import type { AudioManager } from './audio/AudioManager';
import type { ObjectPools } from './pools/ObjectPools';
import {
  PLAYER_CONSTANTS,
  computeSlideSpeed,
  isBulletHittingPlayerHeight,
  stepHoldBreathState,
  type HoldBreathState,
} from './rules';

/* ==========================================
   وحدة اللاعب — تتحكم في الحركة (WASD)، القفز مع Coyote Time و Buffer،
   الركض والطاقة، التزحلق (0.85ث / سرعة 17->6 / انخفاض الرؤية / ميلان الكاميرا / غبار / قفزة معززة)،
   الاندفاع السريع (Q)، الصحة والدرع المتجدد، والقنابل اليدوية (G)
   ========================================== */

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _slideMove = new THREE.Vector3();

export class Player {
  public readonly camera: THREE.PerspectiveCamera;
  public readonly radius = 0.85;

  // زوايا التوجيه والفيزياء الرأسية
  public yaw = 0;
  public pitch = 0;
  public velY = 0;
  public onGround = true;
  public coyoteTimer = 0;
  public jumpBufferTimer = 0;

  // ارتفاع العين المتغير بسلاسة بين الوقوف (1.75) والتزحلق (1.0)
  public currentEyeHeight: number = PLAYER_CONSTANTS.EYE_HEIGHT;

  // الصحة والدرع المتجدد
  public maxHealth = 100;
  public health = 100;
  public maxShield = 50;
  public shield = 50;
  public timeSinceLastHit = 10;

  // الطاقة والركض السريع
  public stamina: number = PLAYER_CONSTANTS.MAX_STAMINA;
  public staminaRegenDelay = 0;
  public staminaExhausted = false;
  public isSprinting = false;
  public sprintWallCooldown = 0;

  // التزحلق (Slide) وقفزة التزحلق المعززة
  public isSliding = false;
  public slideTimer = 0;
  public slideCooldown = 0;
  public slideDustTimer = 0;
  public slideTilt = 0;
  public readonly slideDir = new THREE.Vector3();
  public slideJumpBoostTimer = 0;
  public readonly slideJumpDir = new THREE.Vector3();

  // الاندفاع السريع (Dash على مفتاح Q)
  public dashCooldownBase = 2.5;
  public dashCooldown = 0;
  public dashTimer = 0;
  public readonly dashDir = new THREE.Vector3();

  // القنابل اليدوية (G)
  public grenades = 2;
  public maxGrenades: number = PLAYER_CONSTANTS.GRENADE_MAX;
  public grenadeCooldown = 0;

  // مضاعف السرعة من الترقيات ومضاعف الجاذبية من معدِّلات الموجات
  public speedMult = 1.0;
  public gravityMult = 1.0;

  // مؤقتات حركة المشي والخطوات واهتزاز الكاميرا واهتزاز المنظار وحبس النفس
  public bobTimer = 0;
  public stepSoundTimer = 0;
  public camShake = 0;
  public isMoving = false;
  public scopeSwayTime = 0;
  public scopeSwayYaw = 0;
  public scopeSwayPitch = 0;
  private scopeSwaySmoothMult = 1.0;
  public holdBreath: HoldBreathState = {
    remaining: PLAYER_CONSTANTS.HOLD_BREATH_MAX_DURATION,
    cooldown: 0,
    recoverDelay: 0,
    isHolding: false,
  };

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.camera.rotation.order = 'YXZ';
    this.reset();
  }

  public reset(): void {
    this.maxHealth = 100;
    this.health = 100;
    this.maxShield = 50;
    this.shield = 50;
    this.timeSinceLastHit = 10;

    this.speedMult = 1.0;
    this.gravityMult = 1.0;
    this.dashCooldownBase = 2.5;
    this.dashCooldown = 0;
    this.dashTimer = 0;

    this.currentEyeHeight = PLAYER_CONSTANTS.EYE_HEIGHT;
    this.stamina = PLAYER_CONSTANTS.MAX_STAMINA;
    this.staminaRegenDelay = 0;
    this.staminaExhausted = false;
    this.isSprinting = false;
    this.sprintWallCooldown = 0;

    this.isSliding = false;
    this.slideTimer = 0;
    this.slideCooldown = 0;
    this.slideDustTimer = 0;
    this.slideTilt = 0;
    this.slideJumpBoostTimer = 0;
    this.slideJumpDir.set(0, 0, 0);

    this.grenades = 2;
    this.maxGrenades = PLAYER_CONSTANTS.GRENADE_MAX;
    this.grenadeCooldown = 0;

    this.yaw = 0;
    this.pitch = 0;
    this.velY = 0;
    this.onGround = true;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.bobTimer = 0;
    this.stepSoundTimer = 0;
    this.camShake = 0;
    this.isMoving = false;
    this.scopeSwayTime = 0;
    this.scopeSwayYaw = 0;
    this.scopeSwayPitch = 0;
    this.scopeSwaySmoothMult = 1.0;
    this.holdBreath = {
      remaining: PLAYER_CONSTANTS.HOLD_BREATH_MAX_DURATION,
      cooldown: 0,
      recoverDelay: 0,
      isHolding: false,
    };

    // نقطة البداية في ساحة مفتوحة تطل على المعالم الرئيسية مباشرةً
    this.camera.position.set(0, this.currentEyeHeight, 6);
    this.camera.rotation.set(0, 0, 0);
  }

  /** تطبيق زوايا الكاميرا الفعلية (مع إزاحة اهتزاز المنظار بحيث يظل مركز الشاشة مطابقاً لشعاع الكاميرا) */
  public applyCameraRotation(): void {
    this.camera.rotation.y = this.yaw + this.scopeSwayYaw;
    this.camera.rotation.x = Math.max(
      -Math.PI / 2 + 0.05,
      Math.min(Math.PI / 2 - 0.05, this.pitch + this.scopeSwayPitch),
    );
  }

  /** تطبيق دوران الكاميرا بالماوس */
  public look(movementX: number, movementY: number, sensitivity: number, adsMult: number): void {
    const sens = 0.002 * sensitivity * adsMult;
    this.yaw -= movementX * sens;
    this.pitch -= movementY * sens;
    this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
    this.applyCameraRotation();
  }

  /** تحديث اهتزاز المنظار وحبس النفس (Shift أثناء التصويب بالقناصة لمدة 3ث مع تهدئة) */
  public updateScopeSway(
    rawDt: number,
    isScoped: boolean,
    holdingShift: boolean,
    baseAmp: number,
  ): void {
    const res = stepHoldBreathState(this.holdBreath, rawDt, isScoped, holdingShift);
    this.holdBreath = res.next;

    const multDamp = 1 - Math.exp(-9 * rawDt);
    this.scopeSwaySmoothMult += (res.swayMult - this.scopeSwaySmoothMult) * multDamp;

    if (isScoped && baseAmp > 0) {
      this.scopeSwayTime += rawDt;
      const moveFactor = this.isMoving ? 1.35 : 1.0;
      const amp = baseAmp * moveFactor * this.scopeSwaySmoothMult;
      const t = this.scopeSwayTime;
      const targetYaw = Math.sin(t * 1.15) * amp + Math.sin(t * 2.35) * amp * 0.25;
      const targetPitch = Math.cos(t * 0.85) * amp * 0.82 + Math.sin(t * 1.9) * amp * 0.2;
      const damp = 1 - Math.exp(-7 * rawDt);
      this.scopeSwayYaw += (targetYaw - this.scopeSwayYaw) * damp;
      this.scopeSwayPitch += (targetPitch - this.scopeSwayPitch) * damp;
    } else {
      const resetDamp = 1 - Math.exp(-12 * rawDt);
      this.scopeSwayYaw += (0 - this.scopeSwayYaw) * resetDamp;
      this.scopeSwayPitch += (0 - this.scopeSwayPitch) * resetDamp;
      if (Math.abs(this.scopeSwayYaw) < 0.00002) this.scopeSwayYaw = 0;
      if (Math.abs(this.scopeSwayPitch) < 0.00002) this.scopeSwayPitch = 0;
    }

    this.applyCameraRotation();
  }

  /** تفعيل الاندفاع السريع على مفتاح Q أو زر الاندفاع اللمسي (ممنوع أثناء دوران الميني غان) */
  public triggerDash(
    moveInput: MoveInputState,
    audio: AudioManager,
    mobilityRestricted = false,
  ): boolean {
    if (mobilityRestricted || this.dashCooldown > 0 || this.dashTimer > 0) return false;
    if (this.isSliding) {
      this.isSliding = false;
      this.slideTimer = 0;
      this.slideCooldown = PLAYER_CONSTANTS.SLIDE_COOLDOWN;
    }

    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.dashDir.set(0, 0, 0);
    if (Math.abs(moveInput.moveZ) > 0.05) {
      this.dashDir.addScaledVector(_forward, moveInput.moveZ);
    }
    if (Math.abs(moveInput.moveX) > 0.05) {
      this.dashDir.addScaledVector(_right, moveInput.moveX);
    }
    if (this.dashDir.lengthSq() < 0.01) this.dashDir.copy(_forward);
    this.dashDir.normalize();

    this.dashTimer = PLAYER_CONSTANTS.DASH_DURATION;
    this.dashCooldown = this.dashCooldownBase;
    this.isSprinting = false;
    audio.play('dash');
    return true;
  }

  /** بدء التزحلق (0.85ث) أثناء الركض على الأرض (ممنوع أثناء دوران الميني غان) */
  public triggerSlide(
    moveInput: MoveInputState,
    audio: AudioManager,
    mobilityRestricted = false,
  ): boolean {
    if (
      mobilityRestricted ||
      !this.isSprinting ||
      !this.onGround ||
      this.isSliding ||
      this.slideCooldown > 0 ||
      this.dashTimer > 0
    ) {
      return false;
    }

    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.slideDir.copy(_forward);
    if (Math.abs(moveInput.moveX) > 0.05) {
      this.slideDir.addScaledVector(_right, moveInput.moveX * 0.35);
    }
    this.slideDir.normalize();

    this.isSliding = true;
    this.isSprinting = false;
    this.slideTimer = PLAYER_CONSTANTS.SLIDE_DURATION;
    this.slideDustTimer = 0;
    audio.play('slide');
    return true;
  }

  /** طلب قفزة (يدعم القفزة المعززة أثناء التزحلق + Jump Buffering + Coyote Time) */
  public requestJump(audio: AudioManager): void {
    if (this.isSliding) {
      // قفزة أثناء التزحلق تعطي دفعة أمامية إضافية وتنهي التزحلق
      this.isSliding = false;
      this.slideTimer = 0;
      this.slideCooldown = PLAYER_CONSTANTS.SLIDE_COOLDOWN;
      this.velY = PLAYER_CONSTANTS.SLIDE_JUMP_VELOCITY;
      this.onGround = false;
      this.coyoteTimer = 0;
      this.slideJumpBoostTimer = PLAYER_CONSTANTS.SLIDE_JUMP_BOOST_DURATION;
      this.slideJumpDir.copy(this.slideDir);
      audio.play('dash');
      return;
    }
    this.jumpBufferTimer = PLAYER_CONSTANTS.JUMP_BUFFER_TIME;
  }

  /** فحص إصابة نقطة (طلقة عدو) لجسم اللاعب مع مراعاة انخفاض ارتفاع الرأس أثناء التزحلق */
  public isHitByPoint(pt: THREE.Vector3, horizRadius = 0.95): boolean {
    const horizDist = Math.hypot(pt.x - this.camera.position.x, pt.z - this.camera.position.z);
    if (horizDist >= horizRadius) return false;
    return isBulletHittingPlayerHeight(pt.y, this.camera.position.y, this.currentEyeHeight);
  }

  /** تطبيق ضرر على الدرع أولاً ثم الصحة */
  public takeDamage(amount: number, knockUp?: number): { died: boolean } {
    this.timeSinceLastHit = 0;
    this.camShake = Math.max(this.camShake, 0.042);

    let remaining = amount;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, remaining);
      this.shield -= absorbed;
      remaining -= absorbed;
    }
    if (remaining > 0) {
      this.health = Math.max(0, this.health - remaining);
    }
    if (knockUp && knockUp > 0) {
      this.velY = Math.max(this.velY, knockUp);
      this.onGround = false;
    }
    return { died: this.health <= 0 };
  }

  /** تحديث فيزياء الحركة، الركض، التزحلق، القفز، الجاذبية، وتجدد الدرع */
  public update(
    dt: number,
    rawDt: number,
    moveInput: MoveInputState,
    isADS: boolean,
    isReloading: boolean,
    mapManager: MapManager,
    pools: ObjectPools,
    audio: AudioManager,
    weaponMoveMult = 1.0,
    mobilityRestricted = false,
  ): { activeADS: boolean } {
    if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - rawDt);
    if (this.slideCooldown > 0) this.slideCooldown = Math.max(0, this.slideCooldown - rawDt);
    if (this.sprintWallCooldown > 0) this.sprintWallCooldown = Math.max(0, this.sprintWallCooldown - rawDt);
    if (this.grenadeCooldown > 0) this.grenadeCooldown = Math.max(0, this.grenadeCooldown - rawDt);
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - rawDt);

    // إلغاء التزحلق والاندفاع فوراً إذا كان السلاح يقيّد الحركة (الميني غان أثناء الدوران)
    if (mobilityRestricted) {
      if (this.isSliding) {
        this.isSliding = false;
        this.slideTimer = 0;
      }
      if (this.dashTimer > 0) {
        this.dashTimer = 0;
      }
    }

    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    _move.set(0, 0, 0);

    const inputMag = Math.min(1, Math.hypot(moveInput.moveX, moveInput.moveZ));
    const holdingForward = moveInput.moveZ > 0.25;
    const holdingShift = moveInput.sprint;

    if (inputMag > 0.01) {
      _move.addScaledVector(_forward, moveInput.moveZ);
      _move.addScaledVector(_right, moveInput.moveX);
    }

    this.isMoving = inputMag > 0.01;

    // منطق الركض والطاقة (Stamina)
    const canSprint =
      !mobilityRestricted &&
      holdingShift &&
      holdingForward &&
      !isADS &&
      !isReloading &&
      !this.isSliding &&
      this.dashTimer <= 0 &&
      !this.staminaExhausted &&
      this.stamina > 0 &&
      this.sprintWallCooldown <= 0;

    if (canSprint) {
      this.isSprinting = true;
      this.stamina = Math.max(0, this.stamina - PLAYER_CONSTANTS.STAMINA_DRAIN_RATE * dt);
      this.staminaRegenDelay = PLAYER_CONSTANTS.STAMINA_REGEN_DELAY;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.staminaExhausted = true;
        this.isSprinting = false;
      }
    } else {
      this.isSprinting = false;
      if (this.staminaRegenDelay > 0) {
        this.staminaRegenDelay = Math.max(0, this.staminaRegenDelay - dt);
      } else if (this.stamina < PLAYER_CONSTANTS.MAX_STAMINA) {
        this.stamina = Math.min(
          PLAYER_CONSTANTS.MAX_STAMINA,
          this.stamina + PLAYER_CONSTANTS.STAMINA_REGEN_RATE * dt,
        );
        if (this.staminaExhausted && this.stamina >= PLAYER_CONSTANTS.STAMINA_EXHAUST_RECOVERY) {
          this.staminaExhausted = false;
        }
      }
    }

    // يمكن التصويب والمنظار أثناء التزحلق، ولا يمكن أثناء الركض
    const activeADS = isADS && !this.isSprinting;
    let playerFeetY = this.camera.position.y - this.currentEyeHeight;

    // تنفيذ الحركة: اندفاع / تزحلق / مشي وركض
    if (this.dashTimer > 0) {
      this.dashTimer -= rawDt;
      this.camera.position.addScaledVector(this.dashDir, PLAYER_CONSTANTS.DASH_SPEED * this.speedMult * dt);
    } else if (this.isSliding) {
      this.slideTimer -= dt;
      const slideSpeed = computeSlideSpeed(this.slideTimer, this.speedMult);

      const steer = Math.max(-1, Math.min(1, moveInput.moveX));
      _slideMove.copy(this.slideDir).addScaledVector(_right, steer * 0.2).normalize();
      this.camera.position.addScaledVector(_slideMove, slideSpeed * dt);

      this.slideDustTimer -= dt;
      if (this.slideDustTimer <= 0) {
        pools.spawnSlideDust(
          this.camera.position.x,
          playerFeetY,
          this.camera.position.z,
          this.slideDir,
          mapManager.activeMap.dustColor,
        );
        this.slideDustTimer = 0.045;
      }

      if (this.slideTimer <= 0) {
        this.isSliding = false;
        this.slideTimer = 0;
        this.slideCooldown = PLAYER_CONSTANTS.SLIDE_COOLDOWN;
      }
    } else if (this.isMoving) {
      const baseSpeed = this.isSprinting
        ? PLAYER_CONSTANTS.SPRINT_SPEED
        : activeADS
          ? PLAYER_CONSTANTS.ADS_SPEED
          : PLAYER_CONSTANTS.WALK_SPEED;
      _move.normalize();
      const analogFactor = this.isSprinting ? 1.0 : inputMag;
      this.camera.position.addScaledVector(
        _move,
        baseSpeed * analogFactor * this.speedMult * weaponMoveMult * dt,
      );

      if (this.onGround) {
        this.bobTimer += dt * (this.isSprinting ? 14.8 : 9.8) * Math.max(0.45, analogFactor);
        this.stepSoundTimer -= dt;
        if (this.stepSoundTimer <= 0) {
          audio.play('step');
          this.stepSoundTimer = this.isSprinting ? 0.29 : 0.44;
        }
      }
    }

    // دفعة أمامية لقفزة التزحلق
    if (this.slideJumpBoostTimer > 0) {
      const boostRatio = this.slideJumpBoostTimer / PLAYER_CONSTANTS.SLIDE_JUMP_BOOST_DURATION;
      this.camera.position.addScaledVector(this.slideJumpDir, 9.5 * this.speedMult * boostRatio * dt);
      this.slideJumpBoostTimer = Math.max(0, this.slideJumpBoostTimer - dt);
    }

    // تنفيذ القفز المخزن مؤقتاً مع Coyote Time
    if (this.onGround) {
      this.coyoteTimer = PLAYER_CONSTANTS.COYOTE_TIME;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - rawDt);
    }

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.velY = PLAYER_CONSTANTS.JUMP_VELOCITY;
      this.onGround = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
    }

    // انتقال سلس لارتفاع العين بين الوقوف (1.75) والتزحلق (1.0)
    const targetEye = this.isSliding ? PLAYER_CONSTANTS.SLIDE_EYE_HEIGHT : PLAYER_CONSTANTS.EYE_HEIGHT;
    this.currentEyeHeight += (targetEye - this.currentEyeHeight) * (1 - Math.exp(-14 * rawDt));

    const groundY = mapManager.getGroundHeight(
      this.camera.position.x,
      this.camera.position.z,
      playerFeetY,
    );
    this.velY -= PLAYER_CONSTANTS.GRAVITY * this.gravityMult * dt;
    playerFeetY += this.velY * dt;
    if (playerFeetY <= groundY) {
      playerFeetY = groundY;
      this.velY = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    this.camera.position.y = playerFeetY + this.currentEyeHeight;

    // التصادم مع السواتر وحدود الساحة
    const hitWall = mapManager.resolveCollisions(this.camera.position, this.radius, playerFeetY);
    if (this.isSprinting && hitWall) {
      this.isSprinting = false;
      this.sprintWallCooldown = 0.25;
    }

    // تجدد الدرع بعد 4.5 ثوانٍ دون ضرر
    this.timeSinceLastHit += dt;
    if (this.timeSinceLastHit > 4.5 && this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + 10 * dt);
    }

    // ميلان الكاميرا بمقدار 3 درجات أثناء التزحلق + اهتزاز الكاميرا المتلاشي
    const targetTilt = this.isSliding ? (PLAYER_CONSTANTS.SLIDE_TILT_DEG * Math.PI) / 180 : 0;
    this.slideTilt += (targetTilt - this.slideTilt) * (1 - Math.exp(-12 * rawDt));
    let rollZ = this.slideTilt;
    if (this.camShake > 0) {
      rollZ += (Math.random() - 0.5) * this.camShake;
      this.camShake = Math.max(0, this.camShake - rawDt * 0.35);
    }
    this.camera.rotation.z = rollZ;

    return { activeADS };
  }
}
