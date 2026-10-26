import * as THREE from 'three';
import { checkObstacleCollision, HOUSES, LANDMARKS, TOWN_SIZE, TOWN_WALL_HEIGHT } from '../shared/constants.ts';
import { ProceduralTextures } from './textures.ts';

export interface BoxCollider {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export class TownWorld {
  public group: THREE.Group;
  public colliders: BoxCollider[] = [];
  public houseDoorColliders: { houseId: number; pos: THREE.Vector3 }[] = [];
  public grassInstances: THREE.InstancedMesh | null = null;

  constructor() {
    this.group = new THREE.Group();
    this.buildLushLawnsAndGround();
    this.buildRoadsAndPromenades();
    this.buildPerimeterWalls();
    this.buildInstancedGrassTufts();
    this.buildPlayerEstates();
    this.buildEnterableCivicBuildings();
    this.buildAmbushAlleysAndSlums();
    this.buildCentralParkAndPromenade();
    this.buildParkBenchesAndProps();
  }

  public addCollider(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
    this.colliders.push({
      min: new THREE.Vector3(minX, minY, minZ),
      max: new THREE.Vector3(maxX, maxY, maxZ)
    });
  }

  private buildLushLawnsAndGround() {
    // 1. Lush Emerald Grass Base
    const grassGeo = new THREE.PlaneGeometry(TOWN_SIZE, TOWN_SIZE);
    const grassTex = ProceduralTextures.getLushGrassTexture();
    const grassMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      roughness: 0.85,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(grassGeo, grassMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  private buildRoadsAndPromenades() {
    const roadTex = ProceduralTextures.getRoadTexture();
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.65
    });

    const cobbleTex = ProceduralTextures.getCobblestoneTexture();
    const cobbleMat = new THREE.MeshStandardMaterial({
      map: cobbleTex,
      roughness: 0.6
    });

    const sidewalkTex = ProceduralTextures.getSidewalkTexture();
    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: sidewalkTex,
      roughness: 0.75
    });

    // North-South Grand Avenue (16m wide)
    const nsRoad = new THREE.Mesh(new THREE.PlaneGeometry(16, TOWN_SIZE), roadMat);
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.position.y = 0.03;
    nsRoad.receiveShadow = true;
    this.group.add(nsRoad);

    // East-West Grand Boulevard (16m wide)
    const ewRoad = new THREE.Mesh(new THREE.PlaneGeometry(TOWN_SIZE, 16), roadMat);
    ewRoad.rotation.x = -Math.PI / 2;
    ewRoad.position.y = 0.03;
    ewRoad.receiveShadow = true;
    this.group.add(ewRoad);

    // Secondary Cross Streets
    [-80, 80].forEach((zCoord) => {
      const ringRoad = new THREE.Mesh(new THREE.PlaneGeometry(TOWN_SIZE, 12), roadMat);
      ringRoad.rotation.x = -Math.PI / 2;
      ringRoad.position.set(0, 0.03, zCoord);
      ringRoad.receiveShadow = true;
      this.group.add(ringRoad);
    });

    [-80, 80].forEach((xCoord) => {
      const ringRoad = new THREE.Mesh(new THREE.PlaneGeometry(12, TOWN_SIZE), roadMat);
      ringRoad.rotation.x = -Math.PI / 2;
      ringRoad.position.set(xCoord, 0.03, 0);
      ringRoad.receiveShadow = true;
      this.group.add(ringRoad);
    });

    // Cobblestone Central Plaza Promenade (Round circle at center)
    const plazaGeo = new THREE.CircleGeometry(36, 32);
    const plaza = new THREE.Mesh(plazaGeo, cobbleMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.04;
    plaza.receiveShadow = true;
    this.group.add(plaza);

    // Sidewalks
    const swWidth = 3;
    const nsSwLeft = new THREE.Mesh(new THREE.BoxGeometry(swWidth, 0.22, TOWN_SIZE), sidewalkMat);
    nsSwLeft.position.set(-9.5, 0.11, 0);
    const nsSwRight = new THREE.Mesh(new THREE.BoxGeometry(swWidth, 0.22, TOWN_SIZE), sidewalkMat);
    nsSwRight.position.set(9.5, 0.11, 0);
    this.group.add(nsSwLeft, nsSwRight);

    const ewSwTop = new THREE.Mesh(new THREE.BoxGeometry(TOWN_SIZE, 0.22, swWidth), sidewalkMat);
    ewSwTop.position.set(0, 0.11, -9.5);
    const ewSwBottom = new THREE.Mesh(new THREE.BoxGeometry(TOWN_SIZE, 0.22, swWidth), sidewalkMat);
    ewSwBottom.position.set(0, 0.11, 9.5);
    this.group.add(ewSwTop, ewSwBottom);
  }

  private buildInstancedGrassTufts() {
    // 1500 3D blade tufts scattered on the park lawns
    const grassCount = 1500;
    const bladeGeo = new THREE.ConeGeometry(0.08, 0.55, 4);
    bladeGeo.translate(0, 0.27, 0);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      roughness: 0.6,
      side: THREE.DoubleSide
    });

    this.grassInstances = new THREE.InstancedMesh(bladeGeo, bladeMat, grassCount);
    const dummy = new THREE.Object3D();

    let placed = 0;
    while (placed < grassCount) {
      const rx = (Math.random() - 0.5) * 220;
      const rz = (Math.random() - 0.5) * 220;

      // Avoid paved roads
      if (Math.abs(rx) > 12 && Math.abs(rz) > 12 && !checkObstacleCollision(rx, rz, 0.5)) {
        dummy.position.set(rx, 0, rz);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        dummy.rotation.z = (Math.random() - 0.5) * 0.25;
        const scale = 0.7 + Math.random() * 0.6;
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        this.grassInstances.setMatrixAt(placed, dummy.matrix);
        placed++;
      }
    }

    this.grassInstances.receiveShadow = true;
    this.group.add(this.grassInstances);
  }

  private buildPerimeterWalls() {
    const half = TOWN_SIZE / 2;
    const wallHeight = TOWN_WALL_HEIGHT;
    const wallThick = 2;
    const wallMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getBrickTexture('#475569', '#94a3b8'),
      roughness: 0.75
    });

    // North
    const nWall = new THREE.Mesh(new THREE.BoxGeometry(TOWN_SIZE, wallHeight, wallThick), wallMat);
    nWall.position.set(0, wallHeight / 2, -half);
    this.group.add(nWall);

    // South
    const sWall = nWall.clone();
    sWall.position.set(0, wallHeight / 2, half);
    this.group.add(sWall);

    // West
    const wWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, TOWN_SIZE), wallMat);
    wWall.position.set(-half, wallHeight / 2, 0);
    this.group.add(wWall);

    // East
    const eWall = wWall.clone();
    eWall.position.set(half, wallHeight / 2, 0);
    this.group.add(eWall);
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

      const manor = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), brickMat);
      manor.position.y = h / 2;
      manor.castShadow = true;
      manor.receiveShadow = true;
      estateGroup.add(manor);

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(14, 5, 4),
        new THREE.MeshStandardMaterial({ color: house.colorHex, roughness: 0.4, metalness: 0.2 })
      );
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

      // Target Estate Door
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

      estateGroup.position.set(house.doorPos.x, 0, house.doorPos.z);
      this.group.add(estateGroup);

      this.houseDoorColliders.push({
        houseId: house.id,
        pos: new THREE.Vector3(house.doorPos.x, 1.5, house.doorPos.z + d / 2 + 2)
      });
    });
  }

  private buildEnterableCivicBuildings() {
    const wallBrick = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getBrickTexture('#78350f', '#d1d5db'),
      roughness: 0.7
    });

    const hospitalWall = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35
    });

    const policeWall = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5
    });

    const bankWall = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.5
    });

    const parquetFloorMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getWoodTexture(),
      roughness: 0.4
    });

    const tileFloorMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.3
    });

    // 1. ENTERABLE RESTAURANT: Le Grand Bistro (0, -75)
    const restGroup = new THREE.Group();
    restGroup.position.set(0, 0, -75);

    const restFloor = new THREE.Mesh(new THREE.PlaneGeometry(28, 20), parquetFloorMat);
    restFloor.rotation.x = -Math.PI / 2;
    restFloor.position.y = 0.05;
    restFloor.receiveShadow = true;
    restGroup.add(restFloor);

    const restRoof = new THREE.Mesh(new THREE.BoxGeometry(29, 0.6, 21), wallBrick);
    restRoof.position.y = 8;
    restGroup.add(restRoof);

    const restBack = new THREE.Mesh(new THREE.BoxGeometry(28, 8, 1), wallBrick);
    restBack.position.set(0, 4, -10);
    restGroup.add(restBack);

    const restLeft = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 20), wallBrick);
    restLeft.position.set(-14, 4, 0);
    restGroup.add(restLeft);

    const restRight = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 20), wallBrick);
    restRight.position.set(14, 4, 0);
    restGroup.add(restRight);

    const restFrontLeft = new THREE.Mesh(new THREE.BoxGeometry(11, 8, 1), wallBrick);
    restFrontLeft.position.set(-8.5, 4, 10);
    const restFrontRight = new THREE.Mesh(new THREE.BoxGeometry(11, 8, 1), wallBrick);
    restFrontRight.position.set(8.5, 4, 10);
    restGroup.add(restFrontLeft, restFrontRight);

    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.4, 3),
      new THREE.MeshStandardMaterial({ color: 0xd97706 })
    );
    awning.position.set(0, 5, 11.5);
    restGroup.add(awning);

    const restLight = new THREE.PointLight(0xffedd5, 1.5, 16);
    restLight.position.set(0, 6, 0);
    restGroup.add(restLight);

    const barCounter = new THREE.Mesh(
      new THREE.BoxGeometry(14, 1.2, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.3 })
    );
    barCounter.position.set(0, 0.6, -7);
    restGroup.add(barCounter);

    [-7, 7].forEach((tx) => {
      [-2, 4].forEach((tz) => {
        const table = new THREE.Mesh(
          new THREE.CylinderGeometry(1.0, 1.0, 0.9, 10),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 })
        );
        table.position.set(tx, 0.45, tz);
        restGroup.add(table);
      });
    });

    this.group.add(restGroup);

    // 2. ONLY ONE SINGLE CENTRAL HOSPITAL: Central Hospital (-75, 0)
    const hospGroup = new THREE.Group();
    hospGroup.position.set(-75, 0, 0);

    const hospFloor = new THREE.Mesh(new THREE.PlaneGeometry(34, 24), tileFloorMat);
    hospFloor.rotation.x = -Math.PI / 2;
    hospFloor.position.y = 0.05;
    hospFloor.receiveShadow = true;
    hospGroup.add(hospFloor);

    const hospRoof = new THREE.Mesh(new THREE.BoxGeometry(35, 0.6, 25), hospitalWall);
    hospRoof.position.y = 8;
    hospGroup.add(hospRoof);

    const hospBack = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 24), hospitalWall);
    hospBack.position.set(-17, 4, 0);
    hospGroup.add(hospBack);

    const hospNorth = new THREE.Mesh(new THREE.BoxGeometry(34, 8, 1), hospitalWall);
    hospNorth.position.set(0, 4, -12);
    hospGroup.add(hospNorth);

    const hospSouth = new THREE.Mesh(new THREE.BoxGeometry(34, 8, 1), hospitalWall);
    hospSouth.position.set(0, 4, 12);
    hospGroup.add(hospSouth);

    const hospFrontTop = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 9), hospitalWall);
    hospFrontTop.position.set(17, 4, 7.5);
    const hospFrontBottom = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 9), hospitalWall);
    hospFrontBottom.position.set(17, 4, -7.5);
    hospGroup.add(hospFrontTop, hospFrontBottom);

    // Luminous Red Cross Sign
    const cross1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 1.2, 3),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xb91c1c, emissiveIntensity: 1.5 })
    );
    cross1.position.set(17.2, 6, 0);
    const cross2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 3, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xb91c1c, emissiveIntensity: 1.5 })
    );
    cross2.position.set(17.2, 6, 0);
    hospGroup.add(cross1, cross2);

    const hospDesk = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1.1, 7),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3 })
    );
    hospDesk.position.set(11, 0.55, 0);
    hospGroup.add(hospDesk);

    [-10, -4].forEach((bx) => {
      [-6, 6].forEach((bz) => {
        const bed = new THREE.Mesh(
          new THREE.BoxGeometry(3.6, 0.8, 1.8),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
        );
        bed.position.set(bx, 0.4, bz);
        hospGroup.add(bed);
      });
    });

    const hospLight = new THREE.PointLight(0xe0f2fe, 1.8, 20);
    hospLight.position.set(0, 6.5, 0);
    hospGroup.add(hospLight);

    this.group.add(hospGroup);

    // 3. ENTERABLE POLICE HQ (0, 75)
    const policeGroup = new THREE.Group();
    policeGroup.position.set(0, 0, 75);

    const policeFloor = new THREE.Mesh(new THREE.PlaneGeometry(26, 20), parquetFloorMat);
    policeFloor.rotation.x = -Math.PI / 2;
    policeFloor.position.y = 0.05;
    policeFloor.receiveShadow = true;
    policeGroup.add(policeFloor);

    const policeRoof = new THREE.Mesh(new THREE.BoxGeometry(27, 0.6, 21), policeWall);
    policeRoof.position.y = 8;
    policeGroup.add(policeRoof);

    const polBack = new THREE.Mesh(new THREE.BoxGeometry(26, 8, 1), policeWall);
    polBack.position.set(0, 4, 10);
    policeGroup.add(polBack);

    const polLeft = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 20), policeWall);
    polLeft.position.set(-13, 4, 0);
    policeGroup.add(polLeft);

    const polRight = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 20), policeWall);
    polRight.position.set(13, 4, 0);
    policeGroup.add(polRight);

    const polFrontLeft = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 1), policeWall);
    polFrontLeft.position.set(-8, 4, -10);
    const polFrontRight = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 1), policeWall);
    polFrontRight.position.set(8, 4, -10);
    policeGroup.add(polFrontLeft, polFrontRight);

    const polDesk = new THREE.Mesh(
      new THREE.BoxGeometry(6, 1.1, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
    );
    polDesk.position.set(0, 0.55, -3);
    policeGroup.add(polDesk);

    const locker = new THREE.Mesh(
      new THREE.BoxGeometry(10, 3.5, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 })
    );
    locker.position.set(0, 1.75, 8.5);
    policeGroup.add(locker);

    const polLight = new THREE.PointLight(0xbfdbfe, 1.5, 18);
    polLight.position.set(0, 6.5, 0);
    policeGroup.add(polLight);

    this.group.add(policeGroup);

    // 4. ENTERABLE CITY HALL & BANK (75, 0)
    const bankGroup = new THREE.Group();
    bankGroup.position.set(75, 0, 0);

    const bankFloor = new THREE.Mesh(new THREE.PlaneGeometry(32, 24), tileFloorMat);
    bankFloor.rotation.x = -Math.PI / 2;
    bankFloor.position.y = 0.05;
    bankFloor.receiveShadow = true;
    bankGroup.add(bankFloor);

    const bankRoof = new THREE.Mesh(new THREE.BoxGeometry(33, 0.6, 25), bankWall);
    bankRoof.position.y = 8;
    bankGroup.add(bankRoof);

    const bankBack = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 24), bankWall);
    bankBack.position.set(16, 4, 0);
    bankGroup.add(bankBack);

    const bankNorth = new THREE.Mesh(new THREE.BoxGeometry(32, 8, 1), bankWall);
    bankNorth.position.set(0, 4, -12);
    bankGroup.add(bankNorth);

    const bankSouth = new THREE.Mesh(new THREE.BoxGeometry(32, 8, 1), bankWall);
    bankSouth.position.set(0, 4, 12);
    bankGroup.add(bankSouth);

    const bankFrontTop = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 9), bankWall);
    bankFrontTop.position.set(-16, 4, 7.5);
    const bankFrontBottom = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 9), bankWall);
    bankFrontBottom.position.set(-16, 4, -7.5);
    bankGroup.add(bankFrontTop, bankFrontBottom);

    const tellerCounter = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1.3, 14),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4 })
    );
    tellerCounter.position.set(0, 0.65, 0);
    bankGroup.add(tellerCounter);

    const bankLight = new THREE.PointLight(0xfef9c3, 1.6, 20);
    bankLight.position.set(0, 6.5, 0);
    bankGroup.add(bankLight);

    this.group.add(bankGroup);
  }

  private buildAmbushAlleysAndSlums() {
    const brickMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getBrickTexture('#571c18', '#374151'),
      roughness: 0.85
    });

    const dumpsterMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.6,
      metalness: 0.4
    });

    const crateMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getWoodTexture(),
      roughness: 0.7
    });

    const alleyCoords = [
      { x: -35, z: -35 },
      { x: 35, z: -35 },
      { x: -35, z: 35 },
      { x: 35, z: 35 }
    ];

    alleyCoords.forEach((coord) => {
      const alleyGroup = new THREE.Group();

      const wall1 = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 4), brickMat);
      wall1.position.set(-5, 6, 0);
      wall1.castShadow = true;
      alleyGroup.add(wall1);

      const wall2 = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 4), brickMat);
      wall2.position.set(5, 6, 8);
      wall2.castShadow = true;
      alleyGroup.add(wall2);

      const dumpster = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.4), dumpsterMat);
      dumpster.position.set(-1, 0.7, 4);
      dumpster.castShadow = true;
      alleyGroup.add(dumpster);

      const crate1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), crateMat);
      crate1.position.set(2, 0.5, 4);
      const crate2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), crateMat);
      crate2.position.set(2, 1.5, 4);
      alleyGroup.add(crate1, crate2);

      alleyGroup.position.set(coord.x, 0, coord.z);
      this.group.add(alleyGroup);
    });
  }

  private buildCentralParkAndPromenade() {
    // 1. Cathedral Clocktower (0, -25)
    const clockGroup = new THREE.Group();
    const towerMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getBrickTexture('#475569', '#cbd5e1'),
      roughness: 0.6
    });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(10, 36, 10), towerMat);
    tower.position.y = 18;
    tower.castShadow = true;
    clockGroup.add(tower);

    const clockFace = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 16),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    clockFace.position.set(0, 28, 5.05);
    clockGroup.add(clockFace);

    clockGroup.position.set(0, 0, -25);
    this.group.add(clockGroup);

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

    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.6, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
    );
    spire.position.y = 2.5;
    fountainGroup.add(spire);

    fountainGroup.position.set(0, 0, 25);
    this.group.add(fountainGroup);

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
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 })
    );
    canopy.position.y = 15;
    canopy.castShadow = true;
    treeGroup.add(canopy);

    treeGroup.position.set(-50, 0, -50);
    this.group.add(treeGroup);

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
  }

  private buildParkBenchesAndProps() {
    const woodMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getWoodTexture(),
      roughness: 0.5
    });
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.3
    });

    // Park Benches around fountain and parks
    const benchPositions = [
      { x: -12, z: 20, rot: Math.PI / 4 },
      { x: 12, z: 20, rot: -Math.PI / 4 },
      { x: -12, z: 30, rot: 3 * Math.PI / 4 },
      { x: 12, z: 30, rot: -3 * Math.PI / 4 },
      { x: -45, z: -45, rot: 0 },
      { x: 45, z: 45, rot: Math.PI }
    ];

    benchPositions.forEach((bp) => {
      const benchGroup = new THREE.Group();
      // Seat
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.7), woodMat);
      seat.position.y = 0.55;
      // Backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.08), woodMat);
      back.position.set(0, 0.95, -0.32);
      // Iron legs
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.6), ironMat);
      leg1.position.set(-1.0, 0.275, 0);
      const leg2 = leg1.clone();
      leg2.position.set(1.0, 0.275, 0);

      benchGroup.add(seat, back, leg1, leg2);
      benchGroup.position.set(bp.x, 0, bp.z);
      benchGroup.rotation.y = bp.rot;
      this.group.add(benchGroup);
    });

    // Streetlamps
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

  public checkCollision(pos: THREE.Vector3, radius: number = 0.45): boolean {
    if (checkObstacleCollision(pos.x, pos.z, radius)) {
      return true;
    }
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
