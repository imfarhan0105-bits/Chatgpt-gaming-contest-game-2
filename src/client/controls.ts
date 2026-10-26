import * as THREE from 'three';
import { checkObstacleCollision, getTerrainHeight, PLAYER_CROUCH_SPEED, PLAYER_SPRINT_SPEED, PLAYER_WALK_SPEED } from '../shared/constants.ts';
import type { ItemType } from '../shared/types.ts';
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

  // Perspective settings (Default: First-Person 3D tactical view as requested)
  public isThirdPerson: boolean = false;
  public isAiming: boolean = false;
  public isCrouching: boolean = false;
  public currentWeapon: ItemType = 'fists';

  // Smooth spring-arm third-person settings
  private targetCamDistance: number = 0;
  private currentCamDistance: number = 0;
  private shoulderOffset: number = 0.28;

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

      // Smooth controllable sensitivity (Lowered during high-power sniper optic zoom)
      const sensitivity = this.isAiming
        ? (this.currentWeapon === 'rifle' ? 0.0005 : 0.0014)
        : 0.0020;
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

      this.walkCycleTimer += delta * (isSprinting ? 10.5 : 6.2);
    } else {
      this.walkCycleTimer = 0;
    }

    // Ground Elevation & Slope Physics
    const groundElevation = getTerrainHeight(this.pos.x, this.pos.z);

    // Jump & gravity
    if (!this.isGrounded) {
      this.jumpVelocity -= this.gravity * delta;
      this.pos.y += this.jumpVelocity * delta;

      if (this.pos.y <= groundElevation) {
        this.pos.y = groundElevation;
        this.jumpVelocity = 0;
        this.isGrounded = true;
      }
    } else {
      // Smoothly ascend and descend terrain slopes, knolls, and bridge ramps
      this.pos.y = THREE.MathUtils.lerp(this.pos.y, groundElevation, Math.min(1.0, delta * 24.0));
    }

    // PUBG-Style Wall Sliding: Independent X and Z collision checks
    const testPosX = this.pos.clone();
    testPosX.x += moveVector.x * delta;
    if (!checkObstacleCollision(testPosX.x, testPosX.z, 0.42) && !this.town.checkCollision(new THREE.Vector3(testPosX.x, testPosX.y + 0.8, testPosX.z), 0.42)) {
      this.pos.x = testPosX.x;
    }

    const testPosZ = this.pos.clone();
    testPosZ.z += moveVector.z * delta;
    if (!checkObstacleCollision(testPosZ.x, testPosZ.z, 0.42) && !this.town.checkCollision(new THREE.Vector3(testPosZ.x, testPosZ.y + 0.8, testPosZ.z), 0.42)) {
      this.pos.z = testPosZ.z;
    }

    this.updateCameraPosition(delta);
  }

  private updateCameraPosition(delta: number = 0.016) {
    const eyeHeight = this.isCrouching ? 1.05 : 1.65;
    const playerCenter = new THREE.Vector3(this.pos.x, this.pos.y + eyeHeight, this.pos.z);

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    const targetFov = this.isAiming
      ? (this.currentWeapon === 'rifle' ? 16 : 48)
      : 72;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1.0, delta * 18.0));
    this.camera.updateProjectionMatrix();

    if (!this.isThirdPerson) {
      // Rock-Solid First-Person Perspective: Zero jitter, zero vibration!
      this.currentCamDistance = 0;
      this.camera.position.copy(playerCenter);
    } else {
      // Third-Person Perspective: Smooth Damped Spring Arm
      let targetDist = this.isAiming ? 1.15 : 1.75;

      const fX = -Math.sin(this.yaw) * Math.cos(this.pitch);
      const fY = -Math.sin(this.pitch);
      const fZ = -Math.cos(this.yaw) * Math.cos(this.pitch);
      const rX = Math.cos(this.yaw);
      const rZ = -Math.sin(this.yaw);

      const offsetShoulder = this.isAiming ? 0.20 : this.shoulderOffset;

      // Check obstacle obstruction along line of sight to smoothly pull camera forward
      const checkX = playerCenter.x - fX * targetDist;
      const checkZ = playerCenter.z - fZ * targetDist;
      if (checkObstacleCollision(checkX, checkZ, 0.35)) {
        targetDist = 0.95;
      }

      this.currentCamDistance = THREE.MathUtils.lerp(this.currentCamDistance, targetDist, Math.min(1.0, delta * 14.0));

      const camX = playerCenter.x - fX * this.currentCamDistance + rX * offsetShoulder;
      const camY = playerCenter.y - fY * this.currentCamDistance + 0.16;
      const camZ = playerCenter.z - fZ * this.currentCamDistance + rZ * offsetShoulder;

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
