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

      // Pitch clamping (-85 to +85 degrees)
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

    window.addEventListener('contextmenu', (e) => {
      if (this.isLocked) e.preventDefault();
    });

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

    // Direction calculation:
    // W and ArrowUp = Forward (+1)
    // S and ArrowDown = Backward (-1)
    // D and ArrowRight = Right (+1)
    // A and ArrowLeft = Left (-1)
    const forwardInput = (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0) - (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0);
    const strafeInput = (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) - (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0);
    const isSprinting = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !this.isCrouching && !this.isAiming;

    const isMovingNow = forwardInput !== 0 || strafeInput !== 0;
    const moveVector = new THREE.Vector3();

    if (isMovingNow) {
      let speed = PLAYER_WALK_SPEED;
      if (isSprinting) speed = PLAYER_SPRINT_SPEED;
      else if (this.isCrouching) speed = PLAYER_CROUCH_SPEED;

      // In Three.js, horizontal forward direction for given yaw:
      // forward = (-sin(yaw), 0, -cos(yaw))
      const fX = -Math.sin(this.yaw);
      const fZ = -Math.cos(this.yaw);

      // right vector (perpendicular to forward):
      // right = (cos(yaw), 0, -sin(yaw))
      const rX = Math.cos(this.yaw);
      const rZ = -Math.sin(this.yaw);

      // Combine forward and strafe inputs
      let dirX = fX * forwardInput + rX * strafeInput;
      let dirZ = fZ * forwardInput + rZ * strafeInput;

      // Normalize diagonal movement so diagonal isn't faster
      const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
      if (len > 0.001) {
        dirX /= len;
        dirZ /= len;
      }

      moveVector.x = dirX * speed;
      moveVector.z = dirZ * speed;

      this.walkCycleTimer += delta * (isSprinting ? 12 : 7.5);
    } else {
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
    this.currentCamDistance += (this.targetCamDistance - this.currentCamDistance) * 0.18;

    const eyeHeight = this.isCrouching ? 1.1 : 1.7;
    const playerCenter = new THREE.Vector3(this.pos.x, this.pos.y + eyeHeight, this.pos.z);

    // Camera rotation matches player aim
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.fov = this.isAiming ? 50 : 75;
    this.camera.updateProjectionMatrix();

    if (this.currentCamDistance < 0.1) {
      // First Person: Camera placed at player's eyes
      this.camera.position.copy(playerCenter);
    } else {
      // Third-Person PvP Over-the-Shoulder Camera:
      // Forward direction: f = (-sin(yaw)*cos(pitch), -sin(pitch), -cos(yaw)*cos(pitch))
      // Right direction: r = (cos(yaw), 0, -sin(yaw))
      const fX = -Math.sin(this.yaw) * Math.cos(this.pitch);
      const fY = -Math.sin(this.pitch);
      const fZ = -Math.cos(this.yaw) * Math.cos(this.pitch);

      const rX = Math.cos(this.yaw);
      const rZ = -Math.sin(this.yaw);

      const offsetShoulder = this.isAiming ? 0.35 : this.shoulderOffset;

      // Position camera behind player (opposite of forward) and slightly to the right shoulder
      let camX = playerCenter.x - fX * this.currentCamDistance + rX * offsetShoulder;
      let camY = playerCenter.y - fY * this.currentCamDistance + 0.25;
      let camZ = playerCenter.z - fZ * this.currentCamDistance + rZ * offsetShoulder;

      // Camera collision prevention against buildings
      if (this.town.checkCollision(new THREE.Vector3(camX, camY, camZ), 0.3)) {
        camX = playerCenter.x - fX * 1.0 + rX * (offsetShoulder * 0.5);
        camY = playerCenter.y - fY * 1.0 + 0.2;
        camZ = playerCenter.z - fZ * 1.0 + rZ * (offsetShoulder * 0.5);
      }

      this.camera.position.set(camX, camY, camZ);
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
