import * as THREE from 'three';
import { HOUSES, LANDMARKS, TOWN_SIZE, TOWN_WALL_HEIGHT } from '../shared/constants.ts';
import { ProceduralTextures } from './textures.ts';

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
    this.buildGroundAndRoads();
    this.buildPerimeterWalls();
    this.buildPlayerEstates();
    this.buildCivicDistricts();
    this.buildAmbushAlleysAndSlums();
    this.buildCentralParkAndPromenade();
    this.buildParkedVehicles();
    this.buildCityStreetlightsAndProps();
  }

  private addCollider(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
    this.colliders.push({
      min: new THREE.Vector3(minX, minY, minZ),
      max: new THREE.Vector3(maxX, maxY, maxZ)
    });
  }

  private buildGroundAndRoads() {
    // 1. Base grass / pavement ground
    const groundGeo = new THREE.PlaneGeometry(TOWN_SIZE, TOWN_SIZE);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.95
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    const roadTex = ProceduralTextures.getRoadTexture();
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.7
    });

    const sidewalkTex = ProceduralTextures.getSidewalkTexture();
    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: sidewalkTex,
      roughness: 0.8
    });

    // 2. North-South Grand Avenue (Width: 16m)
    const nsRoadGeo = new THREE.PlaneGeometry(16, TOWN_SIZE);
    const nsRoad = new THREE.Mesh(nsRoadGeo, roadMat);
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.position.y = 0.02;
    nsRoad.receiveShadow = true;
    this.group.add(nsRoad);

    // 3. East-West Grand Boulevard (Width: 16m)
    const ewRoadGeo = new THREE.PlaneGeometry(TOWN_SIZE, 16);
    const ewRoad = new THREE.Mesh(ewRoadGeo, roadMat);
    ewRoad.rotation.x = -Math.PI / 2;
    ewRoad.position.y = 0.02;
    ewRoad.receiveShadow = true;
    this.group.add(ewRoad);

    // 4. Secondary Streets (North ring and South ring)
    [-80, 80].forEach((zCoord) => {
      const ringRoad = new THREE.Mesh(new THREE.PlaneGeometry(TOWN_SIZE, 12), roadMat);
      ringRoad.rotation.x = -Math.PI / 2;
      ringRoad.position.set(0, 0.02, zCoord);
      this.group.add(ringRoad);
    });

    [-80, 80].forEach((xCoord) => {
      const ringRoad = new THREE.Mesh(new THREE.PlaneGeometry(12, TOWN_SIZE), roadMat);
      ringRoad.rotation.x = -Math.PI / 2;
      ringRoad.position.set(xCoord, 0.02, 0);
      this.group.add(ringRoad);
    });

    // 5. Sidewalks bordering main avenues
    const swWidth = 3;
    // NS Sidewalks
    const nsSwLeft = new THREE.Mesh(new THREE.BoxGeometry(swWidth, 0.2, TOWN_SIZE), sidewalkMat);
    nsSwLeft.position.set(-9.5, 0.1, 0);
    const nsSwRight = new THREE.Mesh(new THREE.BoxGeometry(swWidth, 0.2, TOWN_SIZE), sidewalkMat);
    nsSwRight.position.set(9.5, 0.1, 0);
    this.group.add(nsSwLeft, nsSwRight);

    // EW Sidewalks
    const ewSwTop = new THREE.Mesh(new THREE.BoxGeometry(TOWN_SIZE, 0.2, swWidth), sidewalkMat);
    ewSwTop.position.set(0, 0.1, -9.5);
    const ewSwBottom = new THREE.Mesh(new THREE.BoxGeometry(TOWN_SIZE, 0.2, swWidth), sidewalkMat);
    ewSwBottom.position.set(0, 0.1, 9.5);
    this.group.add(ewSwTop, ewSwBottom);
  }

  private buildPerimeterWalls() {
    const half = TOWN_SIZE / 2;
    const wallHeight = TOWN_WALL_HEIGHT;
    const wallThick = 2;
    const wallMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getBrickTexture('#334155', '#1e293b'),
      roughness: 0.8
    });

    // North
    const nWall = new THREE.Mesh(new THREE.BoxGeometry(TOWN_SIZE, wallHeight, wallThick), wallMat);
    nWall.position.set(0, wallHeight / 2, -half);
    this.group.add(nWall);
    this.addCollider(-half, 0, -half - 1, half, wallHeight, -half + 1);

    // South
    const sWall = nWall.clone();
    sWall.position.set(0, wallHeight / 2, half);
    this.group.add(sWall);
    this.addCollider(-half, 0, half - 1, half, wallHeight, half + 1);

    // West
    const wWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, TOWN_SIZE), wallMat);
    wWall.position.set(-half, wallHeight / 2, 0);
    this.group.add(wWall);
    this.addCollider(-half - 1, 0, -half, -half + 1, wallHeight, half);

    // East
    const eWall = wWall.clone();
    eWall.position.set(half, wallHeight / 2, 0);
    this.group.add(eWall);
    this.addCollider(half - 1, 0, -half, half + 1, wallHeight, half);
  }

  private buildPlayerEstates() {
    const brickMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getBrickTexture('#991b1b', '#d1d5db'),
      roughness: 0.7
    });

    const woodDoorMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getWoodTexture(),
      roughness: 0.5
    });

    HOUSES.forEach((house) => {
      const estateGroup = new THREE.Group();
      const w = 18;
      const h = 10;
      const d = 16;

      // Main Estate Manor
      const manorGeo = new THREE.BoxGeometry(w, h, d);
      const manor = new THREE.Mesh(manorGeo, brickMat);
      manor.position.y = h / 2;
      manor.castShadow = true;
      estateGroup.add(manor);

      // Mansard Roof with specific house color trim
      const roofGeo = new THREE.ConeGeometry(14, 5, 4);
      const roofMat = new THREE.MeshStandardMaterial({
        color: house.colorHex,
        roughness: 0.4,
        metalness: 0.2
      });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = h + 2.5;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      estateGroup.add(roof);

      // Front Porch & Portico
      const porch = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.4, 4),
        new THREE.MeshStandardMaterial({ color: 0x64748b })
      );
      porch.position.set(0, 0.2, d / 2 + 2);
      estateGroup.add(porch);

      // Grand Door (The winning target!)
      const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4.0, 0.3), woodDoorMat);
      door.position.set(0, 2.0, d / 2 + 0.15);
      estateGroup.add(door);

      // Glowing Welcome Lantern above Door
      const lantern = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.MeshStandardMaterial({ color: house.colorHex, emissive: house.colorHex, emissiveIntensity: 1.5 })
      );
      lantern.position.set(0, 4.5, d / 2 + 0.5);
      estateGroup.add(lantern);

      const lanternLight = new THREE.PointLight(house.colorHex, 2.0, 10);
      lanternLight.position.set(0, 4.5, d / 2 + 0.5);
      estateGroup.add(lanternLight);

      // Estate Name Banner Plaque
      const plaque = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.8, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 })
      );
      plaque.position.set(0, 5.2, d / 2 + 0.2);
      estateGroup.add(plaque);

      estateGroup.position.set(house.doorPos.x, 0, house.doorPos.z);
      this.group.add(estateGroup);

      // Collider
      this.addCollider(
        house.doorPos.x - w / 2,
        0,
        house.doorPos.z - d / 2,
        house.doorPos.x + w / 2,
        h + 5,
        house.doorPos.z + d / 2
      );

      this.houseDoorColliders.push({
        houseId: house.id,
        pos: new THREE.Vector3(house.doorPos.x, 1.5, house.doorPos.z + d / 2 + 2)
      });
    });
  }

  private buildCivicDistricts() {
    const facadeMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getBuildingFacadeTexture(),
      roughness: 0.6
    });

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.5
    });

    // 1. City Hall & Courthouse (+75, 0)
    const courtGroup = new THREE.Group();
    const courtBase = new THREE.Mesh(new THREE.BoxGeometry(32, 14, 24), stoneMat);
    courtBase.position.y = 7;
    courtBase.castShadow = true;
    courtGroup.add(courtBase);

    // Classical Columns
    for (let c = -12; c <= 12; c += 4) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.7, 10, 10),
        stoneMat
      );
      col.position.set(c, 5, 13);
      col.castShadow = true;
      courtGroup.add(col);
    }
    courtGroup.position.set(75, 0, 0);
    this.group.add(courtGroup);
    this.addCollider(75 - 16, 0, -12, 75 + 16, 15, 14);

    // 2. Central Hospital (-75, 0)
    const hospGroup = new THREE.Group();
    const hospBase = new THREE.Mesh(new THREE.BoxGeometry(34, 16, 24), stoneMat);
    hospBase.position.y = 8;
    hospBase.castShadow = true;
    hospGroup.add(hospBase);

    // Red Cross Neon Sign
    const cross1 = new THREE.Mesh(
      new THREE.BoxGeometry(4, 1.2, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0x991b1b, emissiveIntensity: 1.0 })
    );
    cross1.position.set(0, 12, 12.2);
    const cross2 = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 4, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0x991b1b, emissiveIntensity: 1.0 })
    );
    cross2.position.set(0, 12, 12.2);
    hospGroup.add(cross1, cross2);

    hospGroup.position.set(-75, 0, 0);
    this.group.add(hospGroup);
    this.addCollider(-75 - 17, 0, -12, -75 + 17, 17, 12);

    // 3. Le Grand Bistro Restaurant (0, -75)
    const restGroup = new THREE.Group();
    const restBase = new THREE.Mesh(
      new THREE.BoxGeometry(28, 10, 20),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
    );
    restBase.position.y = 5;
    restBase.castShadow = true;
    restGroup.add(restBase);

    // Striped Awning
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(26, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: 0xd97706 })
    );
    awning.position.set(0, 4.5, 11);
    restGroup.add(awning);

    // Outdoor dining tables and chairs
    for (let t = -8; t <= 8; t += 4) {
      const table = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: 0x334155 })
      );
      table.position.set(t, 0.45, 13);
      restGroup.add(table);
    }

    restGroup.position.set(0, 0, -75);
    this.group.add(restGroup);
    this.addCollider(-14, 0, -75 - 10, 14, 11, -75 + 14);

    // 4. Police Headquarters (0, 75)
    const policeGroup = new THREE.Group();
    const policeBase = new THREE.Mesh(
      new THREE.BoxGeometry(26, 12, 20),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
    );
    policeBase.position.y = 6;
    policeBase.castShadow = true;
    policeGroup.add(policeBase);

    // Blue/Red Lightbar on roof
    const siren = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.5, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x2563eb, emissiveIntensity: 1.5 })
    );
    siren.position.set(0, 12.4, 0);
    policeGroup.add(siren);

    policeGroup.position.set(0, 0, 75);
    this.group.add(policeGroup);
    this.addCollider(-13, 0, 75 - 10, 13, 13, 75 + 10);
  }

  private buildAmbushAlleysAndSlums() {
    // Narrow back alleys with brick walls, dumpsters, wooden crates, and steam vents
    const brickMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getBrickTexture('#571c18', '#374151'),
      roughness: 0.85
    });

    const dumpsterMat = new THREE.MeshStandardMaterial({
      color: 0x15803d, // Dark green industrial dumpster
      roughness: 0.6,
      metalness: 0.4
    });

    const crateMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getWoodTexture(),
      roughness: 0.7
    });

    // Create 4 distinct ambush alley complexes
    const alleyCoords = [
      { x: -35, z: -35 },
      { x: 35, z: -35 },
      { x: -35, z: 35 },
      { x: 35, z: 35 }
    ];

    alleyCoords.forEach((coord) => {
      const alleyGroup = new THREE.Group();

      // High flanking building walls creating narrow 3-meter blind passages
      const wall1 = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 4), brickMat);
      wall1.position.set(-5, 6, 0);
      wall1.castShadow = true;
      alleyGroup.add(wall1);
      this.addCollider(coord.x - 14, 0, coord.z - 2, coord.x + 4, 12, coord.z + 2);

      const wall2 = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 4), brickMat);
      wall2.position.set(5, 6, 8);
      wall2.castShadow = true;
      alleyGroup.add(wall2);
      this.addCollider(coord.x - 4, 0, coord.z + 6, coord.x + 14, 12, coord.z + 10);

      // Dumpster for cover & ambushing
      const dumpster = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.4), dumpsterMat);
      dumpster.position.set(-1, 0.7, 4);
      dumpster.castShadow = true;
      alleyGroup.add(dumpster);
      this.addCollider(coord.x - 2.2, 0, coord.z + 3.3, coord.x + 0.2, 1.5, coord.z + 4.7);

      // Wooden Crates stack
      const crate1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), crateMat);
      crate1.position.set(2, 0.5, 4);
      const crate2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), crateMat);
      crate2.position.set(2, 1.5, 4);
      alleyGroup.add(crate1, crate2);
      this.addCollider(coord.x + 1.5, 0, coord.z + 3.5, coord.x + 2.5, 2.0, coord.z + 4.5);

      alleyGroup.position.set(coord.x, 0, coord.z);
      this.group.add(alleyGroup);
    });
  }

  private buildCentralParkAndPromenade() {
    // Central Plaza & Park
    const clockGroup = new THREE.Group();
    // 1. Cathedral Clocktower (0, -25)
    const towerMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getBrickTexture('#475569', '#cbd5e1'),
      roughness: 0.6
    });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(10, 36, 10), towerMat);
    tower.position.y = 18;
    tower.castShadow = true;
    clockGroup.add(tower);

    // Glowing Clock Faces
    const clockFace = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 16),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    clockFace.position.set(0, 28, 5.05);
    clockGroup.add(clockFace);

    clockGroup.position.set(0, 0, -25);
    this.group.add(clockGroup);
    this.addCollider(-5, 0, -30, 5, 38, -20);

    // 2. Grand Promenade Tiered Fountain (0, 25)
    const fountainGroup = new THREE.Group();
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 1.4, 20),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4 })
    );
    basin.position.y = 0.7;
    basin.castShadow = true;
    fountainGroup.add(basin);

    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(7.6, 7.6, 0.2, 20),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, metalness: 0.7, transparent: true, opacity: 0.85 })
    );
    water.position.y = 1.3;
    fountainGroup.add(water);

    // Fountain Spire
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.6, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
    );
    spire.position.y = 2.5;
    fountainGroup.add(spire);

    fountainGroup.position.set(0, 0, 25);
    this.group.add(fountainGroup);
    this.addCollider(-8, 0, 17, 8, 4.5, 33);

    // 3. Ancient Oak Park (-50, -50)
    const treeGroup = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 2.4, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 })
    );
    trunk.position.y = 7;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    const canopy = new THREE.Mesh(
      new THREE.DodecahedronGeometry(8, 2),
      new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8 })
    );
    canopy.position.y = 15;
    canopy.castShadow = true;
    treeGroup.add(canopy);

    treeGroup.position.set(-50, 0, -50);
    this.group.add(treeGroup);
    this.addCollider(-53, 0, -53, -47, 18, -47);

    // 4. Colossal Bronze Rooster Monument (50, 50)
    const monumentGroup = new THREE.Group();
    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(5, 4, 5),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 })
    );
    pedestal.position.y = 2;
    pedestal.castShadow = true;
    monumentGroup.add(pedestal);

    const statue = new THREE.Mesh(
      new THREE.ConeGeometry(2.0, 4.5, 8),
      new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.85, roughness: 0.25 })
    );
    statue.position.y = 6.25;
    statue.castShadow = true;
    monumentGroup.add(statue);

    monumentGroup.position.set(50, 0, 50);
    this.group.add(monumentGroup);
    this.addCollider(47, 0, 47, 53, 9, 53);
  }

  private buildParkedVehicles() {
    // Realistic sedans and police cruisers parked along avenues for cover
    const vehicleSpots = [
      { x: -11, z: -15, type: 'sedan', color: 0x0284c7 },
      { x: 11, z: 18, type: 'police', color: 0x1e293b },
      { x: -11, z: 45, type: 'sedan', color: 0xb91c1c },
      { x: 11, z: -45, type: 'van', color: 0x475569 },
      { x: 35, z: 11, type: 'sedan', color: 0xf59e0b }
    ];

    vehicleSpots.forEach((v) => {
      const carGroup = new THREE.Group();

      // Chassis
      const chassis = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.9, 4.6),
        new THREE.MeshStandardMaterial({ color: v.color, roughness: 0.3, metalness: 0.6 })
      );
      chassis.position.y = 0.65;
      chassis.castShadow = true;
      carGroup.add(chassis);

      // Cabin / Roof
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.7, 2.4),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 })
      );
      cabin.position.set(0, 1.35, -0.2);
      cabin.castShadow = true;
      carGroup.add(cabin);

      // Wheels
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
      [
        { x: -1.1, z: 1.4 },
        { x: 1.1, z: 1.4 },
        { x: -1.1, z: -1.4 },
        { x: 1.1, z: -1.4 }
      ].forEach((wp) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 10), wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wp.x, 0.35, wp.z);
        carGroup.add(wheel);
      });

      // Police Lightbar if police
      if (v.type === 'police') {
        const lightbar = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.15, 0.3),
          new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x2563eb, emissiveIntensity: 1.5 })
        );
        lightbar.position.set(0, 1.75, -0.2);
        carGroup.add(lightbar);
      }

      carGroup.position.set(v.x, 0, v.z);
      this.group.add(carGroup);
      this.addCollider(v.x - 1.2, 0, v.z - 2.4, v.x + 1.2, 1.8, v.z + 2.4);
    });
  }

  private buildCityStreetlightsAndProps() {
    // Realistic Victorian style streetlamps
    const lampCoords = [
      { x: -11, z: -30 }, { x: 11, z: -30 },
      { x: -11, z: 0 }, { x: 11, z: 0 },
      { x: -11, z: 30 }, { x: 11, z: 30 },
      { x: -30, z: -11 }, { x: -30, z: 11 },
      { x: 30, z: -11 }, { x: 30, z: 11 }
    ];

    lampCoords.forEach((lp) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 5.0, 8),
        new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.3 })
      );
      pole.position.set(lp.x, 2.5, lp.z);
      this.group.add(pole);

      const lampHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfde047, emissiveIntensity: 1.2 })
      );
      lampHead.position.set(lp.x, 5.0, lp.z);
      this.group.add(lampHead);

      const light = new THREE.PointLight(0xfef08a, 0.8, 18);
      light.position.set(lp.x, 4.8, lp.z);
      this.group.add(light);
    });
  }

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
