import * as THREE from 'three';
import { NpcFaction, PlayerRole } from '../shared/types.ts';

export class EntityMeshFactory {
  /**
   * Builds a stylized 3D rooster model with body, comb, beak, and optional carried key.
   */
  public static createRoosterMesh(): THREE.Group {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7 }); // Brown feathers
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    body.scale.set(0.8, 1.0, 1.2);
    body.castShadow = true;
    group.add(body);

    // Red Comb
    const combGeo = new THREE.ConeGeometry(0.12, 0.25, 4);
    const combMat = new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.3 });
    const comb = new THREE.Mesh(combGeo, combMat);
    comb.position.set(0, 0.95, 0.25);
    group.add(comb);

    // Beak
    const beakGeo = new THREE.ConeGeometry(0.08, 0.2, 4);
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xffb703 });
    const beak = new THREE.Mesh(beakGeo, beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.75, 0.5);
    group.add(beak);

    // Beak Key Mesh (Golden shiny key in beak)
    const keyGroup = new THREE.Group();
    keyGroup.name = 'beakKey';
    const keyRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.08, 0.02, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.2 })
    );
    const keyShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6),
      new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.2 })
    );
    keyShaft.rotation.x = Math.PI / 2;
    keyShaft.position.z = 0.12;
    keyGroup.add(keyRing, keyShaft);
    keyGroup.position.set(0, 0.72, 0.6);
    group.add(keyGroup);

    // Tail Feathers
    const tailGeo = new THREE.ConeGeometry(0.2, 0.5, 4);
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.rotation.x = -Math.PI / 3;
    tail.position.set(0, 0.7, -0.4);
    group.add(tail);

    // Legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0xffb703 });
    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 4), legMat);
    leftLeg.position.set(-0.15, 0.2, 0);
    const rightLeg = leftLeg.clone();
    rightLeg.position.set(0.15, 0.2, 0);
    group.add(leftLeg, rightLeg);

    return group;
  }

  /**
   * Stylized humanoid character for players and NPCs.
   * Visual roles (Pedestrian, Waiter, Doctor, Lawyer, Guard, Merchant).
   */
  public static createCharacterMesh(role: PlayerRole | NpcFaction, isPlayer: boolean = false): THREE.Group {
    const group = new THREE.Group();

    let shirtColor = 0x3a86ff;
    let pantsColor = 0x2b2d42;

    switch (role) {
      case 'pedestrian':
        shirtColor = 0x457b9d;
        pantsColor = 0x1d3557;
        break;
      case 'waiter':
        shirtColor = 0xf8f9fa; // White shirt with black vest
        pantsColor = 0x111111;
        break;
      case 'doctor':
        shirtColor = 0x06d6a0; // Medical teal / white coat
        pantsColor = 0xf8f9fa;
        break;
      case 'lawyer':
        shirtColor = 0x212529; // Formal dark suit
        pantsColor = 0x212529;
        break;
      case 'guard':
        shirtColor = 0x1e3a8a; // Police/guard navy
        pantsColor = 0x0f172a;
        break;
      case 'merchant':
        shirtColor = 0xbc6c25; // Merchant earth brown
        pantsColor = 0x6c584c;
        break;
    }

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.9, 0.4);
    const torsoMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.6 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.8 }); // Skin tone
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.85;
    head.castShadow = true;
    group.add(head);

    // Face / Eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), eyeMat);
    leftEye.position.set(-0.12, 1.88, 0.23);
    const rightEye = leftEye.clone();
    rightEye.position.set(0.12, 1.88, 0.23);
    group.add(leftEye, rightEye);

    // Smile Mesh (Hidden initially, shown when carrier collapses / wakes up)
    const smileGroup = new THREE.Group();
    smileGroup.name = 'smileMesh';
    const smileGeo = new THREE.TorusGeometry(0.1, 0.02, 4, 8, Math.PI);
    const smileMat = new THREE.MeshStandardMaterial({ color: 0xc9184a });
    const smile = new THREE.Mesh(smileGeo, smileMat);
    smile.rotation.z = Math.PI; // Inverted torus arc makes a subtle smile
    smile.position.set(0, 1.76, 0.23);
    smileGroup.add(smile);
    smileGroup.visible = false;
    group.add(smileGroup);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.28, 0.8, 0.32);
    const legMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.7 });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.2, 0.4, 0);
    leftLeg.castShadow = true;
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.2, 0.4, 0);
    rightLeg.castShadow = true;
    group.add(leftLeg, rightLeg);

    return group;
  }

  /**
   * World Item Pickups (Dropped items, Weapons, Keys)
   */
  public static createPickupMesh(type: string, isKey: boolean = false, targetHouseId?: number): THREE.Group {
    const group = new THREE.Group();

    if (isKey) {
      // Golden Key Mesh
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.05, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1, emissive: 0x443300 })
      );
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8),
        new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1 })
      );
      shaft.position.y = -0.35;
      group.add(ring, shaft);
      group.scale.set(0.8, 0.8, 0.8);
      group.position.y = 0.5;
    } else if (type === 'crowbar' || type === 'bat') {
      // Melee Weapon
      const bat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.03, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: 0x7f5539, roughness: 0.5 })
      );
      bat.rotation.z = Math.PI / 4;
      bat.position.y = 0.3;
      group.add(bat);
    } else {
      // Medical Bandage Box
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.3, 0.4),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
      );
      box.position.y = 0.2;
      group.add(box);
    }

    return group;
  }
}
