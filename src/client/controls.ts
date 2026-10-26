import * as THREE from 'three';
import { PLAYER_CROUCH_SPEED, PLAYER_SPRINT_SPEED, PLAYER_WALK_SPEED } from '../shared/constants.ts';
import { TownWorld } from './town.ts';

export class PlayerControls {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private town: TownWorld;

  public isLocked: boolean = false;
  public pos: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public yaw: number = 0;
  public pitch: number = 0;

  // Perspective settings (Default: Third-Person PvP)
  public isThirdPerson: boolean = true;
  public isAiming: boolean = false;
  public isCrouching: boolean = false;

  private targetCamDistance: number = 2.8;
  private currentCamDistance: number = 2.8;
  private shoulderOffset: number = 0.55; // Over-the-right-shoulder PvP camera

  private keys: Record<string, boolean> = {};
  private isGrounded: boolean = true;
  private jumpVelocity: number = 0;
  private gravity: number = 24.0;

  // Animation timers
  public walkCycleTimer: number = 0;

  // Callbacks
  public onAttack?: () => void;
  public onInteract?: () => void;
  public onReload?: () => void;
  public onDropItem?: () => void;
  public onSelectSlot?: (slot: number) => void;
  public onUnlockChange?: (locked: boolean) => void;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, town: TownWorld) {
    this.camera = camera;
    this.domElement = domElement;
    this.town = town;

    this.setupPointerLock();
    this.setupKeyboard();
    this.setupMouse();
  }

  private setupPointerLock() {
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
      if (this.onUnlockChange) {
        this.onUnlockChange(this.isLocked);
      }
    });

    document.addEventListener('mousemove', (event) => {
      if (!this.isLocked) return;

      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      const sensitivity = this.isAiming ? 0.0012 : 0.0022;
      this.yaw -= movementX * sensitivity;
      this.pitch -= movementY * sensitivity;

      // Pitch clamping
      const maxPitch = Math.PI / 2 - 0.08;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    });
  }

  public requestLock() {
    this.domElement.requestPointerLock();
  }

  public unlock() {
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  private setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // E key: Interact / Pick Up / Unlock
      if (this.isLocked && (e.code === 'KeyE')) {
        if (this.onInteract) this.onInteract();
      }

      // R key: Reload
      if (this.isLocked && e.code === 'KeyR') {
        if (this.onReload) this.onReload();
      }

      // G key: Drop weapon
      if (this.isLocked && e.code === 'KeyG') {
        if (this.onDropItem) this.onDropItem();
      }

      // V key: Toggle 3rd-person PvP / 1st-person
      if (this.isLocked && e.code === 'KeyV') {
        this.isThirdPerson = !this.isThirdPerson;
      }

      // C key: Toggle Crouch (Ambush / Stealth)
      if (this.isLocked && (e.code === 'KeyC' || e.code === 'ControlLeft')) {
        this.isCrouching = !this.isCrouching;
      }

      // Number keys 1-4: Weapon select
      if (this.isLocked && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
        const slot = parseInt(e.code.replace('Digit', ''), 10) - 1;
        if (this.onSelectSlot) this.onSelectSlot(slot);
      }

      // Space: Jump
      if (this.isLocked && e.code === 'Space' && this.isGrounded) {
        this.jumpVelocity = 7.5;
        this.isGrounded = false;
        this.isCrouching = false;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  private setupMouse() {
    window.addEventListener('mousedown', (e) => {
      if (!this.isLocked) return;

      if (e.button === 0) {
        // Left Click: Attack / Shoot
        if (this.onAttack) this.onAttack();
      } else if (e.button === 2) {
        // Right Click: Aim Down Sights (ADS)
        this.isAiming = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        this.isAiming = false;
      }
    });

    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e) => {
      if (this.isLocked) e.preventDefault();
    });

    // Mouse scroll wheel weapon switch
    window.addEventListener('wheel', (e) => {
      if (!this.isLocked) return;
      const direction = e.deltaY > 0 ? 1 : -1;
      if (this.onSelectSlot) {
        this.onSelectSlot(direction);
      }
    });
  }

  public update(delta: number, canMove: boolean = true) {
    if (!this.isLocked || !canMove) {
      this.updateCameraPosition();
      return;
    }

    // Direction calculation
    const forward = (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0) - (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0);
    const strafe = (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) - (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0);
    const isSprinting = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !this.isCrouching && !this.isAiming;

    const moveVector = new THREE.Vector3();
    const isMovingNow = forward !== 0 || strafe !== 0;

    if (isMovingNow) {
      const moveAngle = this.yaw + Math.atan2(strafe, forward);
      let speed = PLAYER_WALK_SPEED;
      if (isSprinting) speed = PLAYER_SPRINT_SPEED;
      else if (this.isCrouching) speed = PLAYER_CROUCH_SPEED;

      moveVector.x = Math.sin(moveAngle) * speed;
      moveVector.z = Math.cos(moveAngle) * speed;

      this.walkCycleTimer += delta * (isSprinting ? 12 : 7.5);
    } else {
      // Return walk cycle gradually to idle
      this.walkCycleTimer = 0;
    }

    // Jump & gravity
    if (!this.isGrounded) {
      this.jumpVelocity -= this.gravity * delta;
      this.pos.y += this.jumpVelocity * delta;

      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.jumpVelocity = 0;
        this.isGrounded = true;
      }
    }

    // Collision check X
    const testPosX = this.pos.clone();
    testPosX.x += moveVector.x * delta;
    if (!this.town.checkCollision(new THREE.Vector3(testPosX.x, testPosX.y + 1, testPosX.z), 0.45)) {
      this.pos.x = testPosX.x;
    }

    // Collision check Z
    const testPosZ = this.pos.clone();
    testPosZ.z += moveVector.z * delta;
    if (!this.town.checkCollision(new THREE.Vector3(testPosZ.x, testPosZ.y + 1, testPosZ.z), 0.45)) {
      this.pos.z = testPosZ.z;
    }

    this.updateCameraPosition();
  }

  private updateCameraPosition() {
    this.targetCamDistance = this.isAiming ? 1.6 : (this.isThirdPerson ? 2.8 : 0);
    // Smooth camera zoom
    this.currentCamDistance += (this.targetCamDistance - this.currentCamDistance) * 0.15;

    const eyeHeight = this.isCrouching ? 1.1 : 1.7;
    const playerCenter = new THREE.Vector3(this.pos.x, this.pos.y + eyeHeight, this.pos.z);

    if (this.currentCamDistance < 0.1) {
      // First Person
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      this.camera.position.copy(playerCenter);
      this.camera.fov = this.isAiming ? 55 : 75;
      this.camera.updateProjectionMatrix();
    } else {
      // Third-Person PvP Over-the-Shoulder Camera
      const shoulderX = Math.cos(this.yaw) * (this.isAiming ? 0.35 : this.shoulderOffset);
      const shoulderZ = -Math.sin(this.yaw) * (this.isAiming ? 0.35 : this.shoulderOffset);

      const camDirX = Math.sin(this.yaw) * Math.cos(this.pitch);
      const camDirY = -Math.sin(this.pitch);
      const camDirZ = Math.cos(this.yaw) * Math.cos(this.pitch);

      let camX = playerCenter.x + shoulderX - camDirX * this.currentCamDistance;
      let camY = playerCenter.y + 0.3 - camDirY * this.currentCamDistance;
      let camZ = playerCenter.z + shoulderZ - camDirZ * this.currentCamDistance;

      // Camera collision prevention against buildings
      if (this.town.checkCollision(new THREE.Vector3(camX, camY, camZ), 0.3)) {
        camX = playerCenter.x + shoulderX * 0.5 - camDirX * 1.0;
        camY = playerCenter.y + 0.2 - camDirY * 1.0;
        camZ = playerCenter.z + shoulderZ * 0.5 - camDirZ * 1.0;
      }

      this.camera.position.set(camX, camY, camZ);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      this.camera.fov = this.isAiming ? 50 : 75;
      this.camera.updateProjectionMatrix();
    }
  }

  public isMoving(): boolean {
    return !!(
      this.keys['KeyW'] ||
      this.keys['KeyS'] ||
      this.keys['KeyA'] ||
      this.keys['KeyD'] ||
      this.keys['ArrowUp'] ||
      this.keys['ArrowDown'] ||
      this.keys['ArrowLeft'] ||
      this.keys['ArrowRight']
    );
  }

  public isSprinting(): boolean {
    return !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !this.isCrouching && !this.isAiming;
  }
}
