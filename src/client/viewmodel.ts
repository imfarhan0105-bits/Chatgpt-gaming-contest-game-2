import * as THREE from 'three';
import { ItemType } from '../shared/types.ts';

export class FPVViewModel {
  public group: THREE.Group;
  private camera: THREE.PerspectiveCamera;

  // Weapon groups
  private weaponSlotGroup: THREE.Group;
  private fistsGroup: THREE.Group;
  private knifeGroup: THREE.Group;
  private pistolGroup: THREE.Group;
  private muzzleFlashGroup: THREE.Group;

  // State
  private currentWeapon: ItemType = 'fists';
  private recoilZ: number = 0;
  private recoilRotX: number = 0;
  private attackProgress: number = 0;
  private isAttacking: boolean = false;
  private attackType: ItemType = 'fists';
  private muzzleFlashTimer: number = 0;

  // Weapon sway
  private currentSwayX: number = 0;
  private currentSwayY: number = 0;
  private prevYaw: number = 0;
  private prevPitch: number = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.name = 'fpvViewModelRoot';

    // Base position in camera-space (lower right)
    this.group.position.set(0.18, -0.19, -0.38);

    this.weaponSlotGroup = new THREE.Group();
    this.group.add(this.weaponSlotGroup);

    this.fistsGroup = this.createFistsModel();
    this.knifeGroup = this.createKnifeModel();
    this.pistolGroup = this.createPistolModel();
    this.muzzleFlashGroup = this.createMuzzleFlash();

    this.weaponSlotGroup.add(this.fistsGroup);
    this.weaponSlotGroup.add(this.knifeGroup);
    this.weaponSlotGroup.add(this.pistolGroup);
    this.group.add(this.muzzleFlashGroup);

    this.setWeapon('fists');
    this.camera.add(this.group);
  }

  private createFistsModel(): THREE.Group {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xdfa081,
      roughness: 0.6,
      metalness: 0.05
    });
    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.75
    });

    // Right Arm & Fist
    const rArmGroup = new THREE.Group();
    rArmGroup.name = 'rightFistArm';
    const rSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.22, 10), sleeveMat);
    rSleeve.rotation.x = Math.PI / 2.3;
    rSleeve.position.set(0.08, -0.05, 0.08);

    const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.038, 0.14, 10), skinMat);
    rForearm.rotation.x = Math.PI / 2.3;
    rForearm.position.set(0.08, -0.02, 0.01);

    const rFist = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.055, 0.06), skinMat);
    rFist.position.set(0.08, 0.01, -0.07);
    rArmGroup.add(rSleeve, rForearm, rFist);

    // Left Arm & Fist (Raised Guard)
    const lArmGroup = new THREE.Group();
    lArmGroup.name = 'leftFistArm';
    const lSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.22, 10), sleeveMat);
    lSleeve.rotation.x = Math.PI / 2.3;
    lSleeve.rotation.y = -0.3;
    lSleeve.position.set(-0.24, -0.05, 0.06);

    const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.038, 0.14, 10), skinMat);
    lForearm.rotation.x = Math.PI / 2.3;
    lForearm.position.set(-0.21, -0.01, 0.0);

    const lFist = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.055, 0.06), skinMat);
    lFist.position.set(-0.19, 0.03, -0.06);
    lArmGroup.add(lSleeve, lForearm, lFist);

    group.add(rArmGroup, lArmGroup);
    return group;
  }

  private createKnifeModel(): THREE.Group {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xdfa081,
      roughness: 0.6,
      metalness: 0.05
    });
    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.75
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xcfd8dc,
      metalness: 0.95,
      roughness: 0.15
    });
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.8
    });

    // Arm holding knife
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.24, 10), sleeveMat);
    sleeve.rotation.x = Math.PI / 2.4;
    sleeve.position.set(0.04, -0.06, 0.1);

    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.037, 0.12, 10), skinMat);
    wrist.rotation.x = Math.PI / 2.4;
    wrist.position.set(0.04, -0.02, 0.02);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.052, 0.055), skinMat);
    hand.position.set(0.04, 0.01, -0.05);

    // Knife weapon
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.038, 0.24), steelMat);
    blade.position.set(0.04, 0.04, -0.19);
    blade.rotation.x = 0.2;

    const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.05, 0.015), steelMat);
    crossguard.position.set(0.04, 0.02, -0.09);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.11, 8), handleMat);
    handle.position.set(0.04, 0.01, -0.05);
    handle.rotation.x = Math.PI / 2;

    group.add(sleeve, wrist, hand, blade, crossguard, handle);
    return group;
  }

  private createPistolModel(): THREE.Group {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xdfa081,
      roughness: 0.6,
      metalness: 0.05
    });
    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.75
    });
    const gunmetalMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.9,
      roughness: 0.22
    });
    const slideSteelMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25
    });
    const polymerMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.85
    });

    // Right Arm
    const rSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.24, 10), sleeveMat);
    rSleeve.rotation.x = Math.PI / 2.3;
    rSleeve.position.set(0.04, -0.06, 0.1);

    const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.05, 0.06), skinMat);
    rHand.position.set(0.02, -0.01, -0.04);

    // Left Supporting Hand (Tactical Two-Hand Grip)
    const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.046, 0.055), skinMat);
    lHand.position.set(-0.025, -0.03, -0.03);
    lHand.rotation.y = 0.4;

    // Pistol Frame & Slide
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.046, 0.24), slideSteelMat);
    slide.position.set(0.0, 0.045, -0.12);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.05, 8), gunmetalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.0, 0.045, -0.24);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 0.055), polymerMat);
    grip.rotation.x = -0.25;
    grip.position.set(0.0, -0.02, -0.06);

    const sights = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.012), gunmetalMat);
    sights.position.set(0.0, 0.072, -0.22); // Front sight

    group.add(rSleeve, rHand, lHand, slide, barrel, grip, sights);
    return group;
  }

  private createMuzzleFlash(): THREE.Group {
    const group = new THREE.Group();
    const flashGeo = new THREE.ConeGeometry(0.035, 0.1, 6);
    flashGeo.rotateX(-Math.PI / 2);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.95
    });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.position.set(0.0, 0.045, -0.28);

    const light = new THREE.PointLight(0xfef08a, 2.5, 6);
    light.position.set(0.0, 0.045, -0.26);

    group.add(flashMesh, light);
    group.visible = false;
    return group;
  }

  public setWeapon(type: ItemType) {
    this.currentWeapon = type;
    this.fistsGroup.visible = type === 'fists';
    this.knifeGroup.visible = type === 'knife';
    this.pistolGroup.visible = type === 'pistol';
  }

  public triggerAttack(type: ItemType) {
    this.isAttacking = true;
    this.attackType = type;
    this.attackProgress = 1.0;

    if (type === 'pistol') {
      this.recoilZ = 0.05;
      this.recoilRotX = 0.22;
      this.muzzleFlashTimer = 0.06;
      this.muzzleFlashGroup.visible = true;
    }
  }

  public update(
    delta: number,
    isThirdPerson: boolean,
    isMoving: boolean,
    isSprinting: boolean,
    isAiming: boolean,
    walkCycleTimer: number,
    currentYaw: number,
    currentPitch: number
  ) {
    if (isThirdPerson) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    // 1. Mouse Sway Simulation
    const yawDelta = currentYaw - this.prevYaw;
    const pitchDelta = currentPitch - this.prevPitch;
    this.prevYaw = currentYaw;
    this.prevPitch = currentPitch;

    const targetSwayX = -yawDelta * 0.035;
    const targetSwayY = pitchDelta * 0.035;
    this.currentSwayX = THREE.MathUtils.lerp(this.currentSwayX, targetSwayX, Math.min(1.0, delta * 12.0));
    this.currentSwayY = THREE.MathUtils.lerp(this.currentSwayY, targetSwayY, Math.min(1.0, delta * 12.0));

    // 2. Weapon Bobbing
    let bobX = 0;
    let bobY = 0;
    if (isMoving) {
      const bobIntensity = isSprinting ? 0.022 : 0.012;
      bobX = Math.sin(walkCycleTimer) * bobIntensity;
      bobY = Math.abs(Math.cos(walkCycleTimer * 2)) * (bobIntensity * 0.7);
    }

    // 3. Aim Down Sights (ADS) Translation
    const adsTargetPos = isAiming
      ? new THREE.Vector3(0.0, -0.14, -0.32)
      : new THREE.Vector3(0.18, -0.19, -0.38);

    this.group.position.lerp(adsTargetPos, Math.min(1.0, delta * (isAiming ? 18.0 : 12.0)));
    this.group.position.x += bobX + this.currentSwayX;
    this.group.position.y += bobY + this.currentSwayY;

    // 4. Attack Animation / Recoil Recovery
    if (this.attackType === 'pistol') {
      this.recoilZ = THREE.MathUtils.lerp(this.recoilZ, 0, Math.min(1.0, delta * 16.0));
      this.recoilRotX = THREE.MathUtils.lerp(this.recoilRotX, 0, Math.min(1.0, delta * 18.0));
      this.weaponSlotGroup.position.z = this.recoilZ;
      this.weaponSlotGroup.rotation.x = this.recoilRotX;

      if (this.muzzleFlashTimer > 0) {
        this.muzzleFlashTimer -= delta;
        if (this.muzzleFlashTimer <= 0) {
          this.muzzleFlashGroup.visible = false;
        }
      }
    } else if (this.attackType === 'knife' && this.isAttacking) {
      this.attackProgress = Math.max(0, this.attackProgress - delta * 5.0);
      const slashArc = Math.sin(this.attackProgress * Math.PI);
      this.knifeGroup.position.z = -slashArc * 0.12;
      this.knifeGroup.position.x = -slashArc * 0.06;
      this.knifeGroup.rotation.z = slashArc * 0.8;
      if (this.attackProgress <= 0) {
        this.isAttacking = false;
        this.knifeGroup.position.set(0, 0, 0);
        this.knifeGroup.rotation.set(0, 0, 0);
      }
    } else if (this.attackType === 'fists' && this.isAttacking) {
      this.attackProgress = Math.max(0, this.attackProgress - delta * 6.0);
      const punchArc = Math.sin(this.attackProgress * Math.PI);
      const rightFistArm = this.fistsGroup.getObjectByName('rightFistArm');
      if (rightFistArm) {
        rightFistArm.position.z = -punchArc * 0.16;
        rightFistArm.position.x = -punchArc * 0.03;
      }
      if (this.attackProgress <= 0) {
        this.isAttacking = false;
        if (rightFistArm) rightFistArm.position.set(0, 0, 0);
      }
    }
  }
}
