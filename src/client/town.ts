import * as THREE from 'three';
import { checkObstacleCollision, getTerrainHeight, HOUSES, LANDMARKS, TOWN_SIZE, TOWN_WALL_HEIGHT } from '../shared/constants.ts';
import { ProceduralTextures } from './textures.ts';

export interface BoxCollider {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export interface InteractiveDoor {
  id: string;
  name: string;
  group: THREE.Group;
  hingePivot: THREE.Group;
  doorMesh: THREE.Mesh;
  isOpen: boolean;
  baseYaw: number;
  openYaw: number;
  pos: THREE.Vector3;
}

export class TownWorld {
  public group: THREE.Group;
  public colliders: BoxCollider[] = [];
  public houseDoorColliders: { houseId: number; pos: THREE.Vector3 }[] = [];
  public grassInstances: THREE.InstancedMesh | null = null;
  public doors: InteractiveDoor[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.buildLushLawnsAndGround();
    this.buildMountainValleysAndHills();
    this.buildRiverAndStoneBridges();
    this.buildRoadsAndPromenades();
    this.buildPerimeterWalls();
    this.buildInstancedGrassTufts();
    this.buildPlayerEstates();
    this.buildEnterableCivicBuildings();
    this.buildAmbushAlleysAndSlums();
    this.buildCentralParkAndPromenade();
    this.buildParkBenchesAndProps();
    this.buildRealisticTreesAndHidingBushes();
    this.buildTacticalMilitaryLootCrates();
  }

  public createHingedDoor(
    id: string,
    name: string,
    pos: THREE.Vector3,
    width: number = 2.4,
    height: number = 3.6,
    baseYaw: number = 0,
    openYaw: number = Math.PI / 2
  ): InteractiveDoor {
    const group = new THREE.Group();
    group.position.copy(pos);

    // Architectural Door Frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x271714, roughness: 0.8 });
    const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.14, height, 0.16), frameMat);
    leftPost.position.set(-width / 2, height / 2, 0);
    const rightPost = new THREE.Mesh(new THREE.BoxGeometry(0.14, height, 0.16), frameMat);
    rightPost.position.set(width / 2, height / 2, 0);
    const topLintel = new THREE.Mesh(new THREE.BoxGeometry(width + 0.28, 0.16, 0.16), frameMat);
    topLintel.position.set(0, height, 0);
    group.add(leftPost, rightPost, topLintel);

    // Hinge Pivot at Left Post
    const hingePivot = new THREE.Group();
    hingePivot.position.set(-width / 2, 0, 0);
    hingePivot.rotation.y = baseYaw;

    const doorMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getWoodTexture(),
      roughness: 0.5,
      metalness: 0.1
    });
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.12), doorMat);
    doorMesh.position.set(width / 2, height / 2, 0); // Offset so hinge is at left edge
    doorMesh.castShadow = true;
    hingePivot.add(doorMesh);

    // Brass Doorknob Handle
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 })
    );
    knob.position.set(width - 0.2, height * 0.45, 0.09);
    doorMesh.add(knob);

    group.add(hingePivot);
    this.group.add(group);

    const door: InteractiveDoor = {
      id,
      name,
      group,
      hingePivot,
      doorMesh,
      isOpen: false,
      baseYaw,
      openYaw,
      pos: pos.clone()
    };
    this.doors.push(door);
    return door;
  }

  public tryToggleNearestDoor(playerPos: THREE.Vector3, reach: number = 3.6): InteractiveDoor | null {
    let nearest: InteractiveDoor | null = null;
    let minDist = reach;
    for (const d of this.doors) {
      const dist = d.pos.distanceTo(playerPos);
      if (dist < minDist) {
        minDist = dist;
        nearest = d;
      }
    }
    if (nearest) {
      nearest.isOpen = !nearest.isOpen;
      nearest.hingePivot.rotation.y = nearest.isOpen ? nearest.openYaw : nearest.baseYaw;
      return nearest;
    }
    return null;
  }

  public addCollider(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
    this.colliders.push({
      min: new THREE.Vector3(minX, minY, minZ),
      max: new THREE.Vector3(maxX, maxY, maxZ)
    });
  }

  private buildLushLawnsAndGround() {
    // 1. High-Density Topographical 3D Terrain with hills, knolls, canal bed & mountain rises
    const terrainGeo = new THREE.PlaneGeometry(310, 310, 128, 128);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = getTerrainHeight(vx, vz);
      posAttr.setY(i, vy);
    }
    terrainGeo.computeVertexNormals();

    const grassTex = ProceduralTextures.getLushGrassTexture();
    const terrainMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      roughness: 0.82,
      metalness: 0.05
    });

    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    this.group.add(terrainMesh);
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

      // Interactive Hinged Estate Entrance Door
      this.createHingedDoor(
        `estate_door_${house.id}`,
        house.name,
        new THREE.Vector3(house.doorPos.x, 0, house.doorPos.z + d / 2 + 0.15),
        2.4,
        4.0
      );

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

    // Front Window Panes
    const windowMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getGlassWindowTexture(),
      roughness: 0.1,
      metalness: 0.7,
      transparent: true,
      opacity: 0.85
    });
    [-8.5, 8.5].forEach((wx) => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.6, 0.1), windowMat);
      win.position.set(wx, 4.2, 10.55);
      restGroup.add(win);
    });

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

    // Interactive Hinged Bistro Entrance Door
    this.createHingedDoor('bistro_door', 'Le Grand Bistro Entrance', new THREE.Vector3(0, 0, -65), 2.8, 3.8);

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

    [-7.5, 7.5].forEach((wz) => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 3.6), windowMat);
      win.position.set(17.1, 4.2, wz);
      hospGroup.add(win);
    });

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

    // Interactive Hinged Hospital Emergency Entrance
    this.createHingedDoor('hospital_door', 'Central Hospital Emergency Door', new THREE.Vector3(-58, 0, 0), 2.8, 3.8, Math.PI / 2, 0);

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

    [-8, 8].forEach((wx) => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.6, 0.1), windowMat);
      win.position.set(wx, 4.2, -10.55);
      policeGroup.add(win);
    });

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

    // Interactive Hinged Police Precinct Door
    this.createHingedDoor('police_door', 'Police Precinct Entrance', new THREE.Vector3(0, 0, 65), 2.8, 3.8);

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

    // Interactive Hinged City Hall & Bank Entrance Door
    this.createHingedDoor('bank_door', 'City Hall & Bank Entrance', new THREE.Vector3(59, 0, 0), 2.8, 3.8, -Math.PI / 2, -Math.PI);
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
    // 1. Cathedral Clocktower (0, -25) - Majestic Gothic Cathedral with 4 Working Clock Faces
    const clockGroup = new THREE.Group();

    // Cathedral Nave Base
    const baseMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getBrickTexture('#334155', '#94a3b8'),
      roughness: 0.65
    });
    const nave = new THREE.Mesh(new THREE.BoxGeometry(20, 14, 26), baseMat);
    nave.position.set(0, 7, 8);
    nave.castShadow = true;
    nave.receiveShadow = true;
    clockGroup.add(nave);

    // Gothic Cathedral Transept Portal
    const portalMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getWoodTexture(),
      roughness: 0.5
    });
    const cathedralDoor = new THREE.Mesh(new THREE.BoxGeometry(4.5, 7.5, 0.4), portalMat);
    cathedralDoor.position.set(0, 3.75, 21.1);
    clockGroup.add(cathedralDoor);

    // Main Tower Shaft
    const towerMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getBrickTexture('#475569', '#cbd5e1'),
      roughness: 0.6
    });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(11, 40, 11), towerMat);
    tower.position.y = 20;
    tower.castShadow = true;
    clockGroup.add(tower);

    // Corner Stone Buttresses
    const buttressMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    [-5.6, 5.6].forEach((bx) => {
      [-5.6, 5.6].forEach((bz) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 32, 1.6), buttressMat);
        b.position.set(bx, 16, bz);
        clockGroup.add(b);
      });
    });

    // 4 Ornate Roman Numeral Clock Faces (North, South, East, West)
    const clockFaceTex = ProceduralTextures.getClockFaceTexture();
    const clockMat = new THREE.MeshStandardMaterial({
      map: clockFaceTex,
      roughness: 0.3,
      metalness: 0.1
    });

    const clockRadius = 3.6;
    const clockY = 32;

    // North Face (facing +Z into town plaza)
    const northClock = new THREE.Mesh(new THREE.CircleGeometry(clockRadius, 32), clockMat);
    northClock.position.set(0, clockY, 5.56);
    // South Face (facing -Z towards mountain ridge)
    const southClock = new THREE.Mesh(new THREE.CircleGeometry(clockRadius, 32), clockMat);
    southClock.rotation.y = Math.PI;
    southClock.position.set(0, clockY, -5.56);
    // East Face (facing +X)
    const eastClock = new THREE.Mesh(new THREE.CircleGeometry(clockRadius, 32), clockMat);
    eastClock.rotation.y = Math.PI / 2;
    eastClock.position.set(5.56, clockY, 0);
    // West Face (facing -X)
    const westClock = new THREE.Mesh(new THREE.CircleGeometry(clockRadius, 32), clockMat);
    westClock.rotation.y = -Math.PI / 2;
    westClock.position.set(-5.56, clockY, 0);

    clockGroup.add(northClock, southClock, eastClock, westClock);

    // Warm Clocktower ambient lantern
    const clockLight = new THREE.PointLight(0xfef08a, 1.5, 35);
    clockLight.position.set(0, clockY, 0);
    clockGroup.add(clockLight);

    // Belfry with Bronze Church Bell
    const belfryMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const belfry = new THREE.Mesh(new THREE.BoxGeometry(9.6, 8, 9.6), belfryMat);
    belfry.position.y = 44;
    clockGroup.add(belfry);

    const bronzeBell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.8, 2.2, 12),
      new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.25 })
    );
    bronzeBell.position.set(0, 43.5, 0);
    clockGroup.add(bronzeBell);

    // Copper Cathedral Spire & Weather Cross
    const copperRoofMat = new THREE.MeshStandardMaterial({
      color: 0x0d9488, // Weathered copper verdigris green
      roughness: 0.45,
      metalness: 0.3
    });
    const spire = new THREE.Mesh(new THREE.ConeGeometry(6.2, 22, 8), copperRoofMat);
    spire.position.y = 59;
    spire.castShadow = true;
    clockGroup.add(spire);

    const crossMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.1 });
    const crossPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8, 6), crossMat);
    crossPole.position.y = 71;
    const crossArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), crossMat);
    crossArm.rotation.z = Math.PI / 2;
    crossArm.position.y = 71.5;
    clockGroup.add(crossPole, crossArm);

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

    const fountainPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.6, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
    );
    fountainPillar.position.y = 2.5;
    fountainGroup.add(fountainPillar);

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

  private buildMountainValleysAndHills() {
    const mountainMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getMountainRockTexture(),
      roughness: 0.9,
      metalness: 0.05
    });

    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.4
    });

    // 12 Alpine Mountain Peaks encircling the town valley (GTA / PUBG mountainous landscape)
    const peakCoords = [
      { angle: 0, dist: 185, h: 72, r: 42 },
      { angle: Math.PI / 6, dist: 195, h: 84, r: 48 },
      { angle: Math.PI / 3, dist: 180, h: 68, r: 38 },
      { angle: Math.PI / 2, dist: 190, h: 78, r: 44 },
      { angle: (2 * Math.PI) / 3, dist: 185, h: 82, r: 46 },
      { angle: (5 * Math.PI) / 6, dist: 200, h: 90, r: 52 },
      { angle: Math.PI, dist: 185, h: 75, r: 40 },
      { angle: (7 * Math.PI) / 6, dist: 195, h: 88, r: 50 },
      { angle: (4 * Math.PI) / 3, dist: 180, h: 70, r: 42 },
      { angle: (3 * Math.PI) / 2, dist: 190, h: 80, r: 46 },
      { angle: (5 * Math.PI) / 3, dist: 185, h: 85, r: 48 },
      { angle: (11 * Math.PI) / 6, dist: 195, h: 76, r: 44 }
    ];

    peakCoords.forEach((p) => {
      const px = Math.cos(p.angle) * p.dist;
      const pz = Math.sin(p.angle) * p.dist;

      const cone = new THREE.Mesh(new THREE.ConeGeometry(p.r, p.h, 7), mountainMat);
      cone.position.set(px, p.h / 2, pz);
      cone.rotation.y = p.angle;
      cone.castShadow = true;
      cone.receiveShadow = true;
      this.group.add(cone);

      // Snow-capped peak summit
      const snow = new THREE.Mesh(new THREE.ConeGeometry(p.r * 0.35, p.h * 0.28, 7), snowMat);
      snow.position.set(px, p.h - (p.h * 0.28) / 2, pz);
      snow.rotation.y = p.angle;
      this.group.add(snow);
    });

    // Rolling green foothills
    const foothillMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getLushGrassTexture(),
      roughness: 0.85
    });
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const fx = Math.cos(angle) * 145;
      const fz = Math.sin(angle) * 145;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(22, 10, 8), foothillMat);
      hill.scale.set(1.4, 0.45, 1.2);
      hill.position.set(fx, 3, fz);
      this.group.add(hill);
    }
  }

  private buildRiverAndStoneBridges() {
    // River Canal running across town at z = -45
    const riverY = -0.35;
    const riverZ = -45;
    const riverWidth = 14;

    const riverBed = new THREE.Mesh(
      new THREE.PlaneGeometry(TOWN_SIZE, riverWidth),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 })
    );
    riverBed.rotation.x = -Math.PI / 2;
    riverBed.position.set(0, -0.7, riverZ);
    this.group.add(riverBed);

    const waterMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getWaterTexture(),
      roughness: 0.1,
      metalness: 0.6,
      transparent: true,
      opacity: 0.88
    });
    const riverWater = new THREE.Mesh(new THREE.PlaneGeometry(TOWN_SIZE, riverWidth), waterMat);
    riverWater.rotation.x = -Math.PI / 2;
    riverWater.position.set(0, riverY, riverZ);
    this.group.add(riverWater);

    // Stone Embankments along north and south riverbanks
    const bankMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getCobblestoneTexture(),
      roughness: 0.7
    });
    const northBank = new THREE.Mesh(new THREE.BoxGeometry(TOWN_SIZE, 0.8, 1.2), bankMat);
    northBank.position.set(0, 0.05, riverZ - riverWidth / 2);
    const southBank = new THREE.Mesh(new THREE.BoxGeometry(TOWN_SIZE, 0.8, 1.2), bankMat);
    southBank.position.set(0, 0.05, riverZ + riverWidth / 2);
    this.group.add(northBank, southBank);

    // 3 Arched Stone Bridges: West Bridge (-80), Central Grand Promenade Bridge (0), East Bridge (80)
    [-80, 0, 80].forEach((bx) => {
      const bridgeGroup = new THREE.Group();
      bridgeGroup.position.set(bx, 0, riverZ);

      const bridgeWidth = bx === 0 ? 18 : 12;

      const deckMat = new THREE.MeshStandardMaterial({
        map: ProceduralTextures.getCobblestoneTexture(),
        roughness: 0.6
      });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(bridgeWidth, 0.6, riverWidth + 3), deckMat);
      deck.position.y = 0.25;
      deck.receiveShadow = true;
      bridgeGroup.add(deck);

      // Balustrades (left and right stone railings)
      const railMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
      const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, riverWidth + 3), railMat);
      leftRail.position.set(-bridgeWidth / 2 + 0.25, 0.85, 0);
      const rightRail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, riverWidth + 3), railMat);
      rightRail.position.set(bridgeWidth / 2 - 0.25, 0.85, 0);
      bridgeGroup.add(leftRail, rightRail);

      // Streetlamps on bridge corners
      [-bridgeWidth / 2 + 0.5, bridgeWidth / 2 - 0.5].forEach((lx) => {
        [-riverWidth / 2, riverWidth / 2].forEach((lz) => {
          const lamp = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.1, 2.8, 6),
            new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 })
          );
          lamp.position.set(lx, 1.6, lz);
          const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 6, 6),
            new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfde047, emissiveIntensity: 1.2 })
          );
          bulb.position.set(lx, 3.0, lz);
          bridgeGroup.add(lamp, bulb);
        });
      });

      this.group.add(bridgeGroup);
    });
  }

  private buildRealisticTreesAndHidingBushes() {
    const barkMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getBarkTexture(),
      roughness: 0.85
    });
    const leafMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getFoliageTexture(),
      roughness: 0.75
    });

    // 36 Organic 3D Trees with branching trunks & multi-tier layered foliage
    const treeLocations = [
      { x: -110, z: -55 }, { x: -95, z: -35 }, { x: -60, z: -55 }, { x: -35, z: -35 },
      { x: -18, z: -55 }, { x: 20, z: -35 }, { x: 45, z: -55 }, { x: 65, z: -35 },
      { x: 100, z: -55 }, { x: 115, z: -35 },
      { x: -25, z: 15 }, { x: 25, z: 15 }, { x: -25, z: 35 }, { x: 25, z: 35 },
      { x: -35, z: 0 }, { x: 35, z: 0 },
      { x: -65, z: -95 }, { x: -95, z: -65 }, { x: -98, z: -98 },
      { x: 65, z: -95 }, { x: 95, z: -65 }, { x: 98, z: -98 },
      { x: -65, z: 95 }, { x: -95, z: 65 }, { x: -98, z: 98 },
      { x: 65, z: 95 }, { x: 95, z: 65 }, { x: 98, z: 98 },
      { x: -50, z: -15 }, { x: 50, z: -15 }, { x: -50, z: 15 }, { x: 50, z: 15 },
      { x: -15, z: -85 }, { x: 15, z: -85 }, { x: -15, z: 85 }, { x: 15, z: 85 }
    ];

    treeLocations.forEach((loc, idx) => {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(loc.x, 0, loc.z);

      const height = 9 + (idx % 4) * 1.5;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.65, height, 8),
        barkMat
      );
      trunk.position.y = height / 2;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      const crown1 = new THREE.Mesh(new THREE.DodecahedronGeometry(3.4, 1), leafMat);
      crown1.position.set(0, height + 1.2, 0);
      crown1.castShadow = true;

      const crown2 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 1), leafMat);
      crown2.position.set(1.4, height + 0.4, 0.8);
      crown2.castShadow = true;

      const crown3 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4, 1), leafMat);
      crown3.position.set(-1.2, height + 0.6, -0.7);
      crown3.castShadow = true;

      treeGroup.add(crown1, crown2, crown3);
      this.group.add(treeGroup);
    });

    // 55 Dense Camouflage Bushes (PUBG Tactical Hiding Spots)
    const bushMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getFoliageTexture(),
      roughness: 0.8
    });

    for (let i = 0; i < 55; i++) {
      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 1), bushMat);
      bush.scale.set(1.2 + (i % 3) * 0.2, 0.9, 1.1 + (i % 2) * 0.2);

      const angle = (i / 55) * Math.PI * 2;
      const r = 25 + (i % 5) * 18;
      const bx = Math.cos(angle) * r + (((i * 17) % 11) - 5);
      const bz = Math.sin(angle) * r + (((i * 13) % 11) - 5);

      bush.position.set(bx, 0.8, bz);
      bush.castShadow = true;
      this.group.add(bush);
    }
  }

  private buildTacticalMilitaryLootCrates() {
    const crateMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getMilitaryCrateTexture(),
      roughness: 0.5,
      metalness: 0.3
    });

    const crateSpots = [
      { x: -33, z: -33 }, { x: 33, z: -33 },
      { x: -33, z: 33 }, { x: 33, z: 33 },
      { x: 0, z: -62 }, { x: -56, z: 0 },
      { x: 56, z: 0 }, { x: 0, z: 62 }
    ];

    crateSpots.forEach((s) => {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.4), crateMat);
      crate.position.set(s.x, 0.7, s.z);
      crate.castShadow = true;
      crate.receiveShadow = true;
      this.group.add(crate);
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
