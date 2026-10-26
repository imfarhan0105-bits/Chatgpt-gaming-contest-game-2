import * as THREE from 'three';
import { HOUSES, LANDMARKS, TOWN_SIZE, TOWN_WALL_HEIGHT } from '../shared/constants.ts';

export interface BoxCollider {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export class TownWorld {
  public group: THREE.Group;
  public colliders: BoxCollider[] = [];
  public houseDoorColliders: { houseId: number; pos: THREE.Vector3 }[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.buildGround();
    this.buildPerimeterWalls();
    this.buildStreets();
    this.buildPlayerHouses();
    this.buildTownBuildings();
    this.buildLandmarks();
    this.buildPropsAndLighting();
  }

  private addCollider(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
    this.colliders.push({
      min: new THREE.Vector3(minX, minY, minZ),
      max: new THREE.Vector3(maxX, maxY, maxZ)
    });
  }

  private buildGround() {
    // Main grass/paving base
    const groundGeo = new THREE.PlaneGeometry(TOWN_SIZE, TOWN_SIZE);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2b3a28, // Deep stylized lawn green
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  private buildPerimeterWalls() {
    const wallThickness = 2;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x3d405b, // Dark stone blue
      roughness: 0.8
    });

    const half = TOWN_SIZE / 2;

    // North wall
    const nWallGeo = new THREE.BoxGeometry(TOWN_SIZE, TOWN_WALL_HEIGHT, wallThickness);
    const nWall = new THREE.Mesh(nWallGeo, wallMat);
    nWall.position.set(0, TOWN_WALL_HEIGHT / 2, -half);
    nWall.castShadow = true;
    nWall.receiveShadow = true;
    this.group.add(nWall);
    this.addCollider(-half, 0, -half - 1, half, TOWN_WALL_HEIGHT, -half + 1);

    // South wall
    const sWall = nWall.clone();
    sWall.position.set(0, TOWN_WALL_HEIGHT / 2, half);
    this.group.add(sWall);
    this.addCollider(-half, 0, half - 1, half, TOWN_WALL_HEIGHT, half + 1);

    // West wall
    const wWallGeo = new THREE.BoxGeometry(wallThickness, TOWN_WALL_HEIGHT, TOWN_SIZE);
    const wWall = new THREE.Mesh(wWallGeo, wallMat);
    wWall.position.set(-half, TOWN_WALL_HEIGHT / 2, 0);
    wWall.castShadow = true;
    wWall.receiveShadow = true;
    this.group.add(wWall);
    this.addCollider(-half - 1, 0, -half, -half + 1, TOWN_WALL_HEIGHT, half);

    // East wall
    const eWall = wWall.clone();
    eWall.position.set(half, TOWN_WALL_HEIGHT / 2, 0);
    this.group.add(eWall);
    this.addCollider(half - 1, 0, -half, half + 1, TOWN_WALL_HEIGHT, half);
  }

  private buildStreets() {
    const streetMat = new THREE.MeshStandardMaterial({
      color: 0x4a4e69, // Cobblestone asphalt
      roughness: 0.7
    });

    // Main Avenue (North-South)
    const nsStreetGeo = new THREE.PlaneGeometry(12, TOWN_SIZE);
    const nsStreet = new THREE.Mesh(nsStreetGeo, streetMat);
    nsStreet.rotation.x = -Math.PI / 2;
    nsStreet.position.y = 0.02;
    nsStreet.receiveShadow = true;
    this.group.add(nsStreet);

    // Main Boulevard (East-West)
    const ewStreetGeo = new THREE.PlaneGeometry(TOWN_SIZE, 12);
    const ewStreet = new THREE.Mesh(ewStreetGeo, streetMat);
    ewStreet.rotation.x = -Math.PI / 2;
    ewStreet.position.y = 0.02;
    ewStreet.receiveShadow = true;
    this.group.add(ewStreet);

    // Central Plaza circle
    const plazaGeo = new THREE.CircleGeometry(22, 24);
    const plazaMat = new THREE.MeshStandardMaterial({
      color: 0x6c757d,
      roughness: 0.6
    });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.03;
    plaza.receiveShadow = true;
    this.group.add(plaza);
  }

  private buildPlayerHouses() {
    HOUSES.forEach((h) => {
      const houseGroup = new THREE.Group();
      const w = 10;
      const h_dim = 6;
      const d = 10;

      // Base wall structure
      const wallGeo = new THREE.BoxGeometry(w, h_dim, d);
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0xdedbd2,
        roughness: 0.6
      });
      const walls = new THREE.Mesh(wallGeo, wallMat);
      walls.position.y = h_dim / 2;
      walls.castShadow = true;
      walls.receiveShadow = true;
      houseGroup.add(walls);

      // Pitched Roof (colorized per house)
      const roofGeo = new THREE.ConeGeometry(8, 4, 4);
      const roofMat = new THREE.MeshStandardMaterial({
        color: h.colorHex,
        roughness: 0.5
      });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = h_dim + 2;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      houseGroup.add(roof);

      // Front Door (Interactive trigger)
      const doorGeo = new THREE.BoxGeometry(2, 3.2, 0.4);
      const doorMat = new THREE.MeshStandardMaterial({
        color: h.colorHex,
        metalness: 0.3,
        roughness: 0.4
      });
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(0, 1.6, d / 2 + 0.1);
      houseGroup.add(door);

      // House number sign
      const signGeo = new THREE.BoxGeometry(1.6, 0.8, 0.2);
      const signMat = new THREE.MeshStandardMaterial({ color: 0x111 });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(0, 3.8, d / 2 + 0.15);
      houseGroup.add(sign);

      // Position house
      const posX = h.doorPos.x;
      const posZ = h.doorPos.z;
      houseGroup.position.set(posX, 0, posZ);
      this.group.add(houseGroup);

      // Add building collider (leaving door accessible)
      this.addCollider(posX - w / 2, 0, posZ - d / 2, posX + w / 2, h_dim + 4, posZ + d / 2);

      // Store door position for unlock interactions
      this.houseDoorColliders.push({
        houseId: h.id,
        pos: new THREE.Vector3(posX, 1.5, posZ + d / 2)
      });
    });
  }

  private buildTownBuildings() {
    // 1. Restaurant (North sector)
    const restGroup = new THREE.Group();
    const rw = 16, rh = 7, rd = 12;
    const restWalls = new THREE.Mesh(
      new THREE.BoxGeometry(rw, rh, rd),
      new THREE.MeshStandardMaterial({ color: 0xbc6c25, roughness: 0.7 })
    );
    restWalls.position.y = rh / 2;
    restWalls.castShadow = true;
    restGroup.add(restWalls);

    // Canopy
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(rw, 0.4, 3),
      new THREE.MeshStandardMaterial({ color: 0xd90429 })
    );
    canopy.position.set(0, 3.5, rd / 2 + 1.5);
    restGroup.add(canopy);

    restGroup.position.set(0, 0, -42);
    this.group.add(restGroup);
    this.addCollider(-rw / 2, 0, -42 - rd / 2, rw / 2, rh, -42 + rd / 2);

    // 2. Hospital (West sector)
    const hospGroup = new THREE.Group();
    const hw = 18, hh = 9, hd = 14;
    const hospWalls = new THREE.Mesh(
      new THREE.BoxGeometry(hw, hh, hd),
      new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.4 })
    );
    hospWalls.position.y = hh / 2;
    hospWalls.castShadow = true;
    hospGroup.add(hospWalls);

    // Red Cross emblem
    const cross1 = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xd90429 })
    );
    cross1.position.set(0, 6, hd / 2 + 0.1);
    const cross2 = new THREE.Mesh(
      new THREE.BoxGeometry(1, 3, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xd90429 })
    );
    cross2.position.set(0, 6, hd / 2 + 0.1);
    hospGroup.add(cross1, cross2);

    hospGroup.position.set(-38, 0, 0);
    this.group.add(hospGroup);
    this.addCollider(-38 - hw / 2, 0, -hd / 2, -38 + hw / 2, hh, hd / 2);

    // 3. Courthouse (East sector)
    const courtGroup = new THREE.Group();
    const cw = 18, ch = 9, cd = 14;
    const courtWalls = new THREE.Mesh(
      new THREE.BoxGeometry(cw, ch, cd),
      new THREE.MeshStandardMaterial({ color: 0xd9dcd6, roughness: 0.5 })
    );
    courtWalls.position.y = ch / 2;
    courtWalls.castShadow = true;
    courtGroup.add(courtWalls);

    // Classical Columns in front of courthouse
    for (let c = -6; c <= 6; c += 4) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 6, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      col.position.set(c, 3, cd / 2 + 1);
      col.castShadow = true;
      courtGroup.add(col);
    }

    courtGroup.position.set(38, 0, 0);
    this.group.add(courtGroup);
    this.addCollider(38 - cw / 2, 0, -cd / 2, 38 + cw / 2, ch, cd / 2);
  }

  private buildLandmarks() {
    // 1. Clocktower
    const ctGroup = new THREE.Group();
    const ctBase = new THREE.Mesh(
      new THREE.BoxGeometry(6, 22, 6),
      new THREE.MeshStandardMaterial({ color: 0x8d99ae, roughness: 0.6 })
    );
    ctBase.position.y = 11;
    ctBase.castShadow = true;
    ctGroup.add(ctBase);

    // Clock faces
    const clockMat = new THREE.MeshStandardMaterial({ color: 0xfffae0, emissive: 0x333311 });
    const clockGeo = new THREE.CircleGeometry(1.6, 16);
    const clockNorth = new THREE.Mesh(clockGeo, clockMat);
    clockNorth.position.set(0, 17, 3.05);
    ctGroup.add(clockNorth);

    ctGroup.position.set(0, 0, -10);
    this.group.add(ctGroup);
    this.addCollider(-3, 0, -13, 3, 24, -7);

    // 2. Central Fountain
    const fountainGroup = new THREE.Group();
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 4.5, 1.2, 16),
      new THREE.MeshStandardMaterial({ color: 0xb0c4de, roughness: 0.4 })
    );
    basin.position.y = 0.6;
    basin.castShadow = true;
    fountainGroup.add(basin);

    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.2, 0.2, 16),
      new THREE.MeshStandardMaterial({ color: 0x0077b6, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.85 })
    );
    water.position.y = 1.1;
    fountainGroup.add(water);

    const centerPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.2, 3, 8),
      new THREE.MeshStandardMaterial({ color: 0xb0c4de })
    );
    centerPillar.position.y = 1.5;
    fountainGroup.add(centerPillar);

    fountainGroup.position.set(0, 0, 10);
    this.group.add(fountainGroup);
    this.addCollider(-4.5, 0, 5.5, 4.5, 3.5, 14.5);

    // 3. Ancient Oak Tree
    const treeGroup = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.6, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x582f0e, roughness: 0.9 })
    );
    trunk.position.y = 4;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    const foliage = new THREE.Mesh(
      new THREE.DodecahedronGeometry(5.5, 1),
      new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.8 })
    );
    foliage.position.y = 9;
    foliage.castShadow = true;
    treeGroup.add(foliage);

    treeGroup.position.set(-25, 0, -25);
    this.group.add(treeGroup);
    this.addCollider(-27, 0, -27, -23, 12, -23);

    // 4. Bronze Rooster Monument
    const roosterGroup = new THREE.Group();
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(3, 2.5, 3),
      new THREE.MeshStandardMaterial({ color: 0x4a4e69, roughness: 0.6 })
    );
    plinth.position.y = 1.25;
    plinth.castShadow = true;
    roosterGroup.add(plinth);

    const statue = new THREE.Mesh(
      new THREE.ConeGeometry(1.2, 2.2, 6),
      new THREE.MeshStandardMaterial({ color: 0xd4a373, metalness: 0.8, roughness: 0.3 })
    );
    statue.position.y = 3.6;
    statue.castShadow = true;
    roosterGroup.add(statue);

    roosterGroup.position.set(25, 0, 25);
    this.group.add(roosterGroup);
    this.addCollider(23.5, 0, 23.5, 26.5, 5, 26.5);
  }

  private buildPropsAndLighting() {
    // Add decorative streetlamps at cross points
    const lampPositions = [
      { x: -12, z: -12 }, { x: 12, z: -12 },
      { x: -12, z: 12 }, { x: 12, z: 12 },
      { x: 0, z: -25 }, { x: 0, z: 25 },
      { x: -25, z: 0 }, { x: 25, z: 0 }
    ];

    lampPositions.forEach((pos) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.15, 4.5, 6),
        new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7 })
      );
      pole.position.set(pos.x, 2.25, pos.z);
      this.group.add(pole);

      const lampHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0xffe899,
          emissive: 0xffd166,
          emissiveIntensity: 0.8
        })
      );
      lampHead.position.set(pos.x, 4.5, pos.z);
      this.group.add(lampHead);
    });
  }

  /**
   * Fast AABB collision test against town colliders.
   * Player bounding sphere/cylinder approximated as (x, z) radius r.
   */
  public checkCollision(pos: THREE.Vector3, radius: number = 0.5): boolean {
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (
        pos.x + radius > c.min.x &&
        pos.x - radius < c.max.x &&
        pos.z + radius > c.min.z &&
        pos.z - radius < c.max.z &&
        pos.y >= c.min.y &&
        pos.y <= c.max.y
      ) {
        return true;
      }
    }
    return false;
  }
}
