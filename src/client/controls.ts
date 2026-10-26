import * as THREE from 'three';
import { PLAYER_SPRINT_SPEED, PLAYER_WALK_SPEED } from '../shared/constants.ts';
import { TownWorld } from './town.ts';

export class PlayerControls {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private town: TownWorld;

  public isLocked: boolean = false;
  public pos: THREE.Vector3 = new THREE.Vector3(0, 1.7, 0);
  public yaw: number = 0;
  public pitch: number = 0;

  private keys: Record<string, boolean> = {};
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private isGrounded: boolean = true;
  private jumpVelocity: number = 0;
  private gravity: number = 24.0;

  // Head bobbing
  private bobTimer: number = 0;

  // Callbacks
  public onAttack?: () => void;
  public onInteract?: () => void;
  public onUnlockChange?: (locked: boolean) => void;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, town: TownWorld) {
    this.camera = camera;
    this.domElement = domElement;
    this.town = town;

    this.setupPointerLock();
    this.setupKeyboard();
    this.setupMouseClick();
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

      const sensitivity = 0.0022;
      this.yaw -= movementX * sensitivity;
      this.pitch -= movementY * sensitivity;

      // Clamp pitch to prevent flipping
      const maxPitch = Math.PI / 2 - 0.05;
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

      if (this.isLocked && (e.code === 'KeyE' || e.code === 'KeyF')) {
        if (this.onInteract) this.onInteract();
      }

      if (this.isLocked && e.code === 'Space' && this.isGrounded) {
        this.jumpVelocity = 7.5;
        this.isGrounded = false;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  private setupMouseClick() {
    window.addEventListener('mousedown', (e) => {
      if (!this.isLocked) return;
      if (e.button === 0) {
        // Left click attack
        if (this.onAttack) this.onAttack();
      }
    });
  }

  public update(delta: number, canMove: boolean = true) {
    if (!this.isLocked || !canMove) {
      // Still update camera rotation
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      this.camera.position.copy(this.pos);
      return;
    }

    // Determine movement direction relative to camera yaw
    const forward = (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0) - (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0);
    const strafe = (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) - (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0);
    const isSprinting = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);

    const moveVector = new THREE.Vector3();
    if (forward !== 0 || strafe !== 0) {
      const moveAngle = this.yaw + Math.atan2(strafe, forward);
      const speed = isSprinting ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED;
      moveVector.x = Math.sin(moveAngle) * speed;
      moveVector.z = Math.cos(moveAngle) * speed;

      // Head bobbing
      this.bobTimer += delta * (isSprinting ? 14 : 10);
    } else {
      this.bobTimer = 0;
    }

    // Jumping & Gravity
    if (!this.isGrounded) {
      this.jumpVelocity -= this.gravity * delta;
      this.pos.y += this.jumpVelocity * delta;

      if (this.pos.y <= 1.7) {
        this.pos.y = 1.7;
        this.jumpVelocity = 0;
        this.isGrounded = true;
      }
    }

    // Try moving in X
    const newPosX = this.pos.clone();
    newPosX.x += moveVector.x * delta;
    if (!this.town.checkCollision(newPosX, 0.45)) {
      this.pos.x = newPosX.x;
    }

    // Try moving in Z
    const newPosZ = this.pos.clone();
    newPosZ.z += moveVector.z * delta;
    if (!this.town.checkCollision(newPosZ, 0.45)) {
      this.pos.z = newPosZ.z;
    }

    // Apply head bobbing
    const bobOffset = Math.sin(this.bobTimer) * 0.04;

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.position.set(this.pos.x, this.pos.y + bobOffset, this.pos.z);
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
    return !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
  }
}
