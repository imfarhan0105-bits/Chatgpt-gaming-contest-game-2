import * as THREE from 'three';
import { NpcFaction, PlayerRole } from '../shared/types.ts';
import { ProceduralTextures } from './textures.ts';

export class EntityMeshFactory {
  /**
   * Anatomically proportioned realistic human character model.
   * Features head with hair, facial features, neck, curved torso, articulated limbs, shoes, and realistic outfits.
   */
  public static createCharacterMesh(role: PlayerRole | NpcFaction, isPlayer: boolean = false): THREE.Group {
    const characterGroup = new THREE.Group();
    characterGroup.name = 'humanCharacter';

    // Role-specific wardrobe colors and styling
    let suitColor = 0x1e293b;
    let pantsColor = 0x0f172a;
    let shirtColor = 0xf8fafc;
    let hairColor = 0x292524;
    let shoeColor = 0x18181b;

    switch (role) {
      case 'lawyer':
        suitColor = 0x1e293b; // Sleek charcoal business suit
        shirtColor = 0xffffff;
        pantsColor = 0x1e293b;
        hairColor = 0x3f3f46;
        break;
      case 'doctor':
        suitColor = 0x0284c7; // Hospital scrubs / white lab coat
        shirtColor = 0xf0fdf4;
        pantsColor = 0x0369a1;
        hairColor = 0x78350f;
        break;
      case 'waiter':
        suitColor = 0x18181b; // Black formal vest with bow tie
        shirtColor = 0xffffff;
        pantsColor = 0x18181b;
        hairColor = 0x1c1917;
        break;
      case 'guard':
        suitColor = 0x1e3a8a; // Tactical security / police uniform with badge
        shirtColor = 0x3b82f6;
        pantsColor = 0x172554;
        hairColor = 0x44403c;
        break;
      case 'merchant':
        suitColor = 0x9a3412; // Earthy merchant coat
        shirtColor = 0xfef3c7;
        pantsColor = 0x451a03;
        hairColor = 0x713f12;
        break;
      case 'pedestrian':
      default:
        suitColor = 0x334155; // Modern casual jacket
        shirtColor = 0xe2e8f0;
        pantsColor = 0x1e3a8a; // Denim blue jeans
        hairColor = 0x292524;
        break;
    }

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xefd1b8, // Natural skin tone
      roughness: 0.65,
      metalness: 0.05
    });

    const suitMat = new THREE.MeshStandardMaterial({
      color: suitColor,
      roughness: 0.7,
      metalness: 0.1
    });

    const pantsMat = new THREE.MeshStandardMaterial({
      color: pantsColor,
      roughness: 0.75
    });

    const shirtMat = new THREE.MeshStandardMaterial({
      color: shirtColor,
      roughness: 0.6
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: hairColor,
      roughness: 0.9
    });

    const shoeMat = new THREE.MeshStandardMaterial({
      color: shoeColor,
      roughness: 0.4,
      metalness: 0.2
    });

    // ================= 1. HIPS & PELVIS =================
    const pelvisGeo = new THREE.CylinderGeometry(0.24, 0.22, 0.22, 12);
    const pelvis = new THREE.Mesh(pelvisGeo, pantsMat);
    pelvis.position.y = 0.95;
    characterGroup.add(pelvis);

    // Belt & Buckle
    const belt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.05, 12),
      new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.4 })
    );
    belt.position.y = 1.05;
    characterGroup.add(belt);

    const buckle = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.06, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.2 })
    );
    buckle.position.set(0, 1.05, 0.25);
    characterGroup.add(buckle);

    // ================= 2. CHEST / TORSO =================
    const chestGroup = new THREE.Group();
    chestGroup.position.set(0, 1.08, 0);

    // Tapered anatomical torso (wider at shoulders, tapered at waist)
    const torsoGeo = new THREE.CylinderGeometry(0.28, 0.23, 0.52, 12);
    torsoGeo.scale(1.25, 1.0, 0.8);
    const torso = new THREE.Mesh(torsoGeo, suitMat);
    torso.position.y = 0.26;
    torso.castShadow = true;
    chestGroup.add(torso);

    // Inner shirt collar / tie
    const innerShirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.35, 0.05),
      shirtMat
    );
    innerShirt.position.set(0, 0.36, 0.19);
    chestGroup.add(innerShirt);

    if (role === 'lawyer' || role === 'waiter') {
      const tie = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.28, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5 })
      );
      tie.position.set(0, 0.33, 0.22);
      chestGroup.add(tie);
    }

    characterGroup.add(chestGroup);

    // ================= 3. NECK & HEAD =================
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.1, 0.14, 10),
      skinMat
    );
    neck.position.y = 1.62;
    characterGroup.add(neck);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.76, 0);

    // Anatomical curved head
    const cranium = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 16),
      skinMat
    );
    cranium.scale.set(0.9, 1.1, 1.0);
    cranium.castShadow = true;
    headGroup.add(cranium);

    // Jaw / Chin
    const chin = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.1, 0.14),
      skinMat
    );
    chin.position.set(0, -0.09, 0.06);
    headGroup.add(chin);

    // Styled Hair
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.195, 14, 14),
      hairMat
    );
    hair.scale.set(0.93, 0.85, 1.05);
    hair.position.set(0, 0.06, -0.02);
    headGroup.add(hair);

    // Eyes with pupils
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.1 });

    [-0.065, 0.065].forEach((xPos) => {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), eyeWhiteMat);
      eyeWhite.position.set(xPos, 0.01, 0.165);
      headGroup.add(eyeWhite);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), pupilMat);
      pupil.position.set(xPos, 0.01, 0.188);
      headGroup.add(pupil);

      // Eyebrow
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.015, 0.02), hairMat);
      brow.position.set(xPos, 0.05, 0.17);
      headGroup.add(brow);
    });

    // Ears on sides of head
    [-0.175, 0.175].forEach((xPos) => {
      const ear = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 6, 6),
        skinMat
      );
      ear.scale.set(0.4, 0.8, 0.6);
      ear.position.set(xPos, 0.01, 0.0);
      headGroup.add(ear);
    });

    // Nose
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.025, 0.06, 6),
      skinMat
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -0.02, 0.19);
    headGroup.add(nose);

    // Subtle Smiling Face (Revealed on Genuine Key Amnesia)
    const smileGroup = new THREE.Group();
    smileGroup.name = 'smileMesh';
    const smileArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xbe123c, roughness: 0.4 })
    );
    smileArc.rotation.z = Math.PI; // Curved upward into a smile
    smileArc.position.set(0, -0.075, 0.175);
    smileGroup.add(smileArc);
    smileGroup.visible = false;
    headGroup.add(smileGroup);

    characterGroup.add(headGroup);

    // ================= 4. ARTICULATED ARMS (Shoulder -> Forearm -> Hand) =================
    // Left Arm
    const leftArmGroup = new THREE.Group();
    leftArmGroup.name = 'leftArm';
    leftArmGroup.position.set(-0.35, 1.55, 0);

    const leftUpperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.06, 0.32, 8),
      suitMat
    );
    leftUpperArm.position.y = -0.16;
    leftUpperArm.castShadow = true;
    leftArmGroup.add(leftUpperArm);

    const leftForearmGroup = new THREE.Group();
    leftForearmGroup.name = 'leftForearm';
    leftForearmGroup.position.set(0, -0.32, 0);

    const leftForearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.05, 0.30, 8),
      suitMat
    );
    leftForearm.position.y = -0.15;
    leftForearm.castShadow = true;
    leftForearmGroup.add(leftForearm);

    const leftHand = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 8),
      skinMat
    );
    leftHand.position.y = -0.32;
    leftForearmGroup.add(leftHand);

    leftArmGroup.add(leftForearmGroup);
    characterGroup.add(leftArmGroup);

    // Right Arm (Weapon & Phone Arm)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.name = 'rightArm';
    rightArmGroup.position.set(0.35, 1.55, 0);

    const rightUpperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.06, 0.32, 8),
      suitMat
    );
    rightUpperArm.position.y = -0.16;
    rightUpperArm.castShadow = true;
    rightArmGroup.add(rightUpperArm);

    const rightForearmGroup = new THREE.Group();
    rightForearmGroup.name = 'rightForearm';
    rightForearmGroup.position.set(0, -0.32, 0);

    const rightForearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.05, 0.30, 8),
      suitMat
    );
    rightForearm.position.y = -0.15;
    rightForearm.castShadow = true;
    rightForearmGroup.add(rightForearm);

    const rightHand = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 8),
      skinMat
    );
    rightHand.position.y = -0.32;
    rightForearmGroup.add(rightHand);

    // Weapon Attach Socket
    const weaponSocket = new THREE.Group();
    weaponSocket.name = 'weaponSocket';
    weaponSocket.position.set(0, -0.34, 0.08);
    rightForearmGroup.add(weaponSocket);

    // Smartphone Prop Socket (for sitting / talking NPCs)
    const phoneProp = new THREE.Group();
    phoneProp.name = 'smartphoneProp';
    const phoneBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.14, 0.012),
      new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.2 })
    );
    const phoneScreen = new THREE.Mesh(
      new THREE.BoxGeometry(0.062, 0.125, 0.005),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    phoneScreen.position.z = 0.007;
    phoneProp.add(phoneBody, phoneScreen);
    phoneProp.position.set(0, -0.32, 0.04);
    phoneProp.visible = false;
    rightForearmGroup.add(phoneProp);

    rightArmGroup.add(rightForearmGroup);
    characterGroup.add(rightArmGroup);

    // ================= 5. ARTICULATED LEGS (Hip -> Thigh -> Knee -> Shin/Calf -> Shoe) =================
    // Left Leg
    const leftLegGroup = new THREE.Group();
    leftLegGroup.name = 'leftLeg';
    leftLegGroup.position.set(-0.14, 0.92, 0);

    const leftThigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.075, 0.42, 8),
      pantsMat
    );
    leftThigh.position.y = -0.21;
    leftThigh.castShadow = true;
    leftLegGroup.add(leftThigh);

    const leftKnee = new THREE.Group();
    leftKnee.name = 'leftKnee';
    leftKnee.position.set(0, -0.42, 0);

    const leftShin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.062, 0.44, 8),
      pantsMat
    );
    leftShin.position.y = -0.22;
    leftShin.castShadow = true;
    leftKnee.add(leftShin);

    const leftShoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.1, 0.26),
      shoeMat
    );
    leftShoe.position.set(0, -0.44, 0.06);
    leftShoe.castShadow = true;
    leftKnee.add(leftShoe);

    leftLegGroup.add(leftKnee);
    characterGroup.add(leftLegGroup);

    // Right Leg
    const rightLegGroup = new THREE.Group();
    rightLegGroup.name = 'rightLeg';
    rightLegGroup.position.set(0.14, 0.92, 0);

    const rightThigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.075, 0.42, 8),
      pantsMat
    );
    rightThigh.position.y = -0.21;
    rightThigh.castShadow = true;
    rightLegGroup.add(rightThigh);

    const rightKnee = new THREE.Group();
    rightKnee.name = 'rightKnee';
    rightKnee.position.set(0, -0.42, 0);

    const rightShin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.062, 0.44, 8),
      pantsMat
    );
    rightShin.position.y = -0.22;
    rightShin.castShadow = true;
    rightKnee.add(rightShin);

    const rightShoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.1, 0.26),
      shoeMat
    );
    rightShoe.position.set(0, -0.44, 0.06);
    rightShoe.castShadow = true;
    rightKnee.add(rightShoe);

    rightLegGroup.add(rightKnee);
    characterGroup.add(rightLegGroup);

    return characterGroup;
  }

  /**
   * Detailed 3D Weapons: Tactical Knife & Semi-Auto Handgun
   */
  public static createWeaponMesh(type: 'knife' | 'pistol'): THREE.Group {
    const group = new THREE.Group();

    if (type === 'knife') {
      // Tactical Combat Knife
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.24, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.15 })
      );
      blade.position.y = 0.14;

      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.02, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 })
      );
      guard.position.y = 0.02;

      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.14, 6),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 })
      );
      handle.position.y = -0.06;

      group.add(blade, guard, handle);
      group.rotation.x = Math.PI / 2;
    } else if (type === 'pistol') {
      // Semi-Automatic Pistol (Slide, barrel, frame, grip)
      const slide = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.06, 0.26),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 })
      );
      slide.position.set(0, 0.06, 0.04);

      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.06, 8),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95 })
      );
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.06, 0.18);

      const grip = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.14, 0.07),
        new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7 })
      );
      grip.rotation.x = -0.25;
      grip.position.set(0, -0.04, -0.04);

      const triggerGuard = new THREE.Mesh(
        new THREE.TorusGeometry(0.025, 0.006, 6, 8, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x334155 })
      );
      triggerGuard.position.set(0, 0.01, 0.02);

      group.add(slide, barrel, grip, triggerGuard);
      group.rotation.x = Math.PI / 2;
    }

    return group;
  }

  /**
   * Stylized Organic Rooster with plumage, comb, wings, and golden beak key
   */
  public static createRoosterMesh(): THREE.Group {
    const group = new THREE.Group();

    const featherMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b, // Deep copper / mahogany feathers
      roughness: 0.6
    });

    // Rounded organic body
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 12, 12),
      featherMat
    );
    body.position.y = 0.52;
    body.scale.set(0.85, 1.0, 1.3);
    body.castShadow = true;
    group.add(body);

    // Arching neck & head
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 0.35, 8),
      featherMat
    );
    neck.position.set(0, 0.78, 0.28);
    neck.rotation.x = 0.3;
    group.add(neck);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 10),
      featherMat
    );
    head.position.set(0, 0.96, 0.36);
    group.add(head);

    // Realistic Crimson Crown Comb
    const comb = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.24, 6),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 })
    );
    comb.position.set(0, 1.12, 0.38);
    comb.scale.set(0.4, 1.0, 1.4);
    group.add(comb);

    // Golden Sharp Beak
    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.18, 6),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 })
    );
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.94, 0.52);
    group.add(beak);

    // Shiny Key held in beak
    const keyGroup = new THREE.Group();
    keyGroup.name = 'beakKey';
    const keyRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.022, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.95, roughness: 0.15, emissive: 0x78350f })
    );
    const keyShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.26, 8),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.95, roughness: 0.15 })
    );
    keyShaft.rotation.x = Math.PI / 2;
    keyShaft.position.z = 0.13;
    keyGroup.add(keyRing, keyShaft);
    keyGroup.position.set(0, 0.92, 0.62);
    group.add(keyGroup);

    // Plumed Tail Feathers
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.4 }); // Iridescent dark green tail
    for (let i = -1; i <= 1; i++) {
      const feather = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.6, 6),
        tailMat
      );
      feather.rotation.x = -1.2;
      feather.rotation.z = i * 0.25;
      feather.position.set(i * 0.08, 0.75, -0.42);
      group.add(feather);
    }

    // Wings
    const wingGeo = new THREE.SphereGeometry(0.26, 8, 8);
    wingGeo.scale(0.3, 0.9, 1.2);
    const leftWing = new THREE.Mesh(wingGeo, featherMat);
    leftWing.position.set(-0.32, 0.55, 0);
    const rightWing = leftWing.clone();
    rightWing.position.set(0.32, 0.55, 0);
    group.add(leftWing, rightWing);

    // Legs with talons
    const legMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
    [-0.14, 0.14].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.38, 6), legMat);
      leg.position.set(lx, 0.2, 0.04);
      group.add(leg);
    });

    return group;
  }

  /**
   * World Item Pickups with glowing vertical light beacon for keys
   */
  public static createPickupMesh(type: string, isKey: boolean = false, targetHouseId?: number): THREE.Group {
    const group = new THREE.Group();

    if (isKey) {
      // Golden Key
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.05, 8, 20),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.95, roughness: 0.1, emissive: 0x92400e })
      );
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.55, 8),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.95, roughness: 0.1 })
      );
      shaft.position.y = -0.32;
      group.add(ring, shaft);
      group.position.y = 0.65;

      // Vertical Golden Light Pillar / Beacon so keys are clearly visible from afar
      const beaconGeo = new THREE.CylinderGeometry(0.15, 0.15, 14, 8);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.y = 7;
      group.add(beacon);

      // Glowing point light
      const pLight = new THREE.PointLight(0xfbbf24, 1.2, 8);
      pLight.position.y = 0.5;
      group.add(pLight);
    } else if (type === 'knife') {
      const knife = this.createWeaponMesh('knife');
      knife.scale.set(1.4, 1.4, 1.4);
      group.add(knife);
      group.position.y = 0.3;
    } else if (type === 'pistol') {
      const gun = this.createWeaponMesh('pistol');
      gun.scale.set(1.4, 1.4, 1.4);
      group.add(gun);
      group.position.y = 0.3;
    } else {
      // Medical First Aid Case
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.32, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
      );
      const crossH = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.07, 0.02),
        new THREE.MeshBasicMaterial({ color: 0xdc2626 })
      );
      crossH.position.z = 0.16;
      const crossV = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.22, 0.02),
        new THREE.MeshBasicMaterial({ color: 0xdc2626 })
      );
      crossV.position.z = 0.16;
      box.add(crossH, crossV);
      box.position.y = 0.2;
      group.add(box);
    }

    return group;
  }

  /**
   * Poses an NPC sitting properly on a park bench with natural 90-degree bent knees,
   * flat thighs, vertical shins, feet on ground, and interacting realistically with a smartphone!
   */
  public static animateSittingNpcWithPhone(character: THREE.Group, time: number) {
    // 1. Natural Sitting Posture: Thighs forward 90 degrees, knees bent down 90 degrees
    const leftLeg = character.getObjectByName('leftLeg');
    const rightLeg = character.getObjectByName('rightLeg');
    const leftKnee = character.getObjectByName('leftKnee');
    const rightKnee = character.getObjectByName('rightKnee');

    if (leftLeg) leftLeg.rotation.x = -Math.PI / 2;
    if (rightLeg) rightLeg.rotation.x = -Math.PI / 2;
    if (leftKnee) leftKnee.rotation.x = Math.PI / 2;
    if (rightKnee) rightKnee.rotation.x = Math.PI / 2;

    // 2. Head & Arm Actions (Talking on Phone vs. Looking at Screen)
    const head = character.getObjectByName('headGroup') || character.children.find(c => c.type === 'Group' && c.position.y > 1.6);
    const rightArm = character.getObjectByName('rightArm');
    const rightForearm = character.getObjectByName('rightForearm');
    const leftArm = character.getObjectByName('leftArm');
    const leftForearm = character.getObjectByName('leftForearm');
    const phoneProp = character.getObjectByName('smartphoneProp');

    if (phoneProp) phoneProp.visible = true;

    // Cycle: 8-second repeating cycle
    // 0s-5.5s: Holding phone to ear, talking, slight head nods
    // 5.5s-8.0s: Lowers phone to chest level, looks down, taps screen with left hand
    const cycleTime = (time * 0.8) % 8.0;

    if (cycleTime < 5.5) {
      // Talking on phone
      if (rightArm) {
        rightArm.rotation.x = -1.15 + Math.sin(time * 3) * 0.03;
        rightArm.rotation.z = -0.35;
        rightArm.rotation.y = 0.25;
      }
      if (rightForearm) {
        rightForearm.rotation.x = -1.1;
        rightForearm.rotation.y = 0.4;
      }
      // Head tilts toward phone
      if (head) {
        head.rotation.z = 0.12 + Math.sin(time * 4) * 0.04; // nodding gesture
        head.rotation.y = 0.1 + Math.sin(time * 1.5) * 0.05;
      }
      // Left arm rests casually on bench/lap
      if (leftArm) {
        leftArm.rotation.x = -0.4;
        leftArm.rotation.z = 0.15;
      }
      if (leftForearm) {
        leftForearm.rotation.x = -0.5;
      }
    } else {
      // Looking down at screen & texting
      if (rightArm) {
        rightArm.rotation.x = -0.65;
        rightArm.rotation.z = -0.15;
        rightArm.rotation.y = 0.35;
      }
      if (rightForearm) {
        rightForearm.rotation.x = -0.7;
        rightForearm.rotation.y = 0.2;
      }
      // Left arm brought up to type/tap on phone screen
      if (leftArm) {
        leftArm.rotation.x = -0.65;
        leftArm.rotation.z = 0.2;
        leftArm.rotation.y = -0.3;
      }
      if (leftForearm) {
        leftForearm.rotation.x = -0.8 + Math.sin(time * 8) * 0.08; // Tapping finger gesture
      }
      // Head looks down at screen
      if (head) {
        head.rotation.x = 0.35;
        head.rotation.z = 0;
        head.rotation.y = 0;
      }
    }
  }

  /**
   * Poses natural articulated walking/running gait with synchronized hips, knees, and swinging arms
   */
  public static animateWalkingHuman(character: THREE.Group, time: number, isRunning: boolean = false) {
    const leftLeg = character.getObjectByName('leftLeg');
    const rightLeg = character.getObjectByName('rightLeg');
    const leftKnee = character.getObjectByName('leftKnee');
    const rightKnee = character.getObjectByName('rightKnee');
    const leftArm = character.getObjectByName('leftArm');
    const rightArm = character.getObjectByName('rightArm');
    const leftForearm = character.getObjectByName('leftForearm');
    const rightForearm = character.getObjectByName('rightForearm');

    const freq = isRunning ? 11.0 : 7.0;
    const stride = isRunning ? 0.85 : 0.55;
    const legPhase = Math.sin(time * freq);

    // Thigh rotation
    if (leftLeg) leftLeg.rotation.x = legPhase * stride;
    if (rightLeg) rightLeg.rotation.x = -legPhase * stride;

    // Knee flex on backstroke
    if (leftKnee) {
      leftKnee.rotation.x = legPhase > 0 ? legPhase * stride * 0.9 : 0.08;
    }
    if (rightKnee) {
      rightKnee.rotation.x = legPhase < 0 ? -legPhase * stride * 0.9 : 0.08;
    }

    // Arm counter-swing
    const armStride = isRunning ? 0.95 : 0.45;
    if (leftArm) leftArm.rotation.x = -legPhase * armStride;
    if (rightArm) rightArm.rotation.x = legPhase * armStride;

    if (leftForearm) leftForearm.rotation.x = isRunning ? -0.7 : -0.25;
    if (rightForearm) rightForearm.rotation.x = isRunning ? -0.7 : -0.25;
  }
}
