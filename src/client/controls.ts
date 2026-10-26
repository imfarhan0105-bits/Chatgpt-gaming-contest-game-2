import * as THREE from 'three';
import { checkObstacleCollision, PLAYER_CROUCH_SPEED, PLAYER_SPRINT_SPEED, PLAYER_WALK_SPEED } from '../shared/constants.ts';
import { TownWorld } from './town.ts';

export class PlayerControls {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private town: TownWorld;

  public isLocked: boolean = false;
  public pos: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // Mouse Look with Exponential Damping for Butter-Smooth Aiming
  public yaw: number = 0;
  public pitch: number = 0;
  private targetYaw: number = 0;
  private targetPitch: number = 0;

  // Perspective settings (Default: Close, High-Control Third-Person PvP)
  public isThirdPerson: boolean = true;
  public isAiming: boolean = false;
  public isCrouching: boolean = false;

  // Tight, controllable camera settings
  private targetCamDistance: number = 1.75; // Close over-the-shoulder view
  private currentCamDistance: number = 1.75;
  private shoulderOffset: number = 0.32; // Tight right shoulder offset

  private keys: Record<string, boolean> = {};
  private isGrounded: boolean = true;
  private jumpVelocity: number = 0;
  private gravity: number = 24.0;

  // Animation timer
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

      // Smooth controllable sensitivity
      const sensitivity = this.isAiming ? 0.0014 : 0.0020;
      this.targetYaw -= movementX * sensitivity;
      this.targetPitch -= movementY * sensitivity;

      // Pitch clamping (-80 to +80 degrees)
      const maxPitch = 1.4;
      this.targetPitch = Math.max(-maxPitch, Math.min(maxPitch, this.targetPitch));
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

      if (this.isLocked && e.code === 'KeyE') {
        if (this.onInteract) this.onInteract();
      }

      if (this.isLocked && e.code === 'KeyR') {
        if (this.onReload) this.onReload();
      }

      if (this.isLocked && e.code === 'KeyG') {
        if (this.onDropItem) this.onDropItem();
      }

      if (this.isLocked && e.code === 'KeyV') {
        this.isThirdPerson = !this.isThirdPerson;
      }

      if (this.isLocked && (e.code === 'KeyC' || e.code === 'ControlLeft')) {
        this.isCrouching = !this.isCrouching;
      }

      if (this.isLocked && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
        const slot = parseInt(e.code.replace('Digit', ''), 10) - 1;
        if (this.onSelectSlot) this.onSelectSlot(slot);
      }

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
        if (this.onAttack) this.onAttack();
      } else if (e.button === 2) {
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
    // Smooth exponential damping on mouse rotation for butter-smooth camera control
    const dampFactor = Math.min(1.0, delta * 28.0);
    this.yaw += (this.targetYaw - this.yaw) * dampFactor;
    this.pitch += (this.targetPitch - this.pitch) * dampFactor;

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
      const fX = -Math.sin(this.yaw);
      const fZ = -Math.cos(this.yaw);

      // right vector (perpendicular to forward):
      const rX = Math.cos(this.yaw);
      const rZ = -Math.sin(this.yaw);

      // Combine forward and strafe inputs
      let dirX = fX * forwardInput + rX * strafeInput;
      let dirZ = fZ * forwardInput + rZ * strafeInput;

      // Normalize diagonal movement
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
    if (!checkObstacleCollision(testPosX.x, testPosX.z, 0.45) && !this.town.checkCollision(new THREE.Vector3(testPosX.x, testPosX.y + 1, testPosX.z), 0.45)) {
      this.pos.x = testPosX.x;
    }

    // Collision check Z
    const testPosZ = this.pos.clone();
    testPosZ.z += moveVector.z * delta;
    if (!checkObstacleCollision(testPosZ.x, testPosZ.z, 0.45) && !this.town.checkCollision(new THREE.Vector3(testPosZ.x, testPosZ.y + 1, testPosZ.z), 0.45)) {
      this.pos.z = testPosZ.z;
    }

    this.updateCameraPosition();
  }

  private updateCameraPosition() {
    this.targetCamDistance = this.isAiming ? 1.15 : (this.isThirdPerson ? 1.75 : 0);
    this.currentCamDistance += (this.targetCamDistance - this.currentCamDistance) * 0.22;

    const eyeHeight = this.isCrouching ? 1.05 : 1.65;
    const playerCenter = new THREE.Vector3(this.pos.x, this.pos.y + eyeHeight, this.pos.z);

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.fov = this.isAiming ? 52 : 72;
    this.camera.updateProjectionMatrix();

    if (this.currentCamDistance < 0.1) {
      // First Person
      this.camera.position.copy(playerCenter);
    } else {
      // Third-Person PvP: Tightly framed right shoulder camera
      const fX = -Math.sin(this.yaw) * Math.cos(this.pitch);
      const fY = -Math.sin(this.pitch);
      const fZ = -Math.cos(this.yaw) * Math.cos(this.pitch);

      const rX = Math.cos(this.yaw);
      const rZ = -Math.sin(this.yaw);

      const offsetShoulder = this.isAiming ? 0.22 : this.shoulderOffset;

      let camX = playerCenter.x - fX * this.currentCamDistance + rX * offsetShoulder;
      let camY = playerCenter.y - fY * this.currentCamDistance + 0.18;
      let camZ = playerCenter.z - fZ * this.currentCamDistance + rZ * offsetShoulder;

      // Obstacle collision detection for camera
      if (checkObstacleCollision(camX, camZ, 0.25) || this.town.checkCollision(new THREE.Vector3(camX, camY, camZ), 0.25)) {
        camX = playerCenter.x - fX * 0.8 + rX * (offsetShoulder * 0.4);
        camY = playerCenter.y - fY * 0.8 + 0.15;
        camZ = playerCenter.z - fZ * 0.8 + rZ * (offsetShoulder * 0.4);
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
