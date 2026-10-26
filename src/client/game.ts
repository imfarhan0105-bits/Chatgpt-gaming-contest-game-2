import * as THREE from 'three';
import { checkObstacleCollision, getAccurateHouseRiddle, getTerrainHeight, HOUSES, INTERACTION_DISTANCE, NPC_RUN_SPEED, NPC_WALK_SPEED, ROOSTER_WALK_SPEED, WEAPON_STATS } from '../shared/constants.ts';
import type { GameSnapshot, ItemType, PlayerRole } from '../shared/types.ts';
import { SoundEffects } from './audio.ts';
import { PlayerControls } from './controls.ts';
import { EntityMeshFactory } from './entities.ts';
import { NetworkClient } from './network.ts';
import { PhysicsWorld } from './physics.ts';
import { GameRenderer } from './renderer.ts';
import { TownWorld } from './town.ts';
import { UIManager } from './ui.ts';
import { FPVViewModel } from './viewmodel.ts';

interface OfflineEntity {
  mesh: THREE.Group;
  yaw: number;
  twitchTimer: number;
  activity: 'walk' | 'sit' | 'chat' | 'patrol';
  target?: { x: number; z: number };
}

export class CockAndKeysGame {
  private renderer: GameRenderer;
  private town: TownWorld;
  private controls: PlayerControls;
  private ui: UIManager;
  private audio: SoundEffects;
  private network: NetworkClient;
  private physics: PhysicsWorld;
  private viewmodel: FPVViewModel;

  private clock: THREE.Clock = new THREE.Clock();
  private isRunning: boolean = false;
  private isOfflineMode: boolean = false;

  // Local player state
  private myRole: PlayerRole = 'pedestrian';
  private myAssignedHouse: number = 0;
  private localPlayerMesh: THREE.Group | null = null;
  private activeSlotIndex: number = 1;

  private hasKey: boolean = false;
  private hasGenuineKey: boolean = false;
  private isCollapsing: boolean = false;
  private hasRiddle: boolean = false;

  // Entity Meshes
  private remotePlayerMeshes: Map<string, THREE.Group> = new Map();
  private roosterMeshes: Map<string, THREE.Group> = new Map();
  private npcMeshes: Map<string, THREE.Group> = new Map();
  private pickupMeshes: Map<string, THREE.Group> = new Map();

  // Offline AI Entities
  private offlineNpcEntities: Map<string, OfflineEntity> = new Map();
  private offlineRoosterEntities: Map<string, OfflineEntity> = new Map();

  // Bullet tracers pool
  private activeBulletLines: { line: THREE.Line; expireTime: number }[] = [];

  // Offline local simulation inventory
  private offlineInventory = [
    { id: 'fists_local', type: 'fists' as ItemType, name: 'Fists' },
    { id: 'knife_local', type: 'knife' as ItemType, name: 'Tactical Knife' },
    null,
    null
  ];

  // Network sync throttling
  private lastInputSendTime: number = 0;
  private footstepTimer: number = 0;
  private npcAnimTimer: number = 0;

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new GameRenderer(canvas);
    this.town = new TownWorld();
    this.renderer.scene.add(this.town.group);

    this.physics = new PhysicsWorld();
    this.controls = new PlayerControls(this.renderer.camera, document.body, this.town);
    this.viewmodel = new FPVViewModel(this.renderer.camera);
    this.ui = new UIManager();
    this.audio = new SoundEffects();
    this.network = new NetworkClient();

    this.setupLocalPlayerMesh();
    this.setupUIHandlers();
    this.setupNetworkHandlers();
    this.setupControlsCallbacks();
    this.spawnTownCiviliansAndRoosters();

    this.isRunning = true;
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private setupLocalPlayerMesh() {
    this.localPlayerMesh = EntityMeshFactory.createCharacterMesh(this.myRole, true);
    this.renderer.scene.add(this.localPlayerMesh);
    this.updateLocalEquippedWeapon('knife');
  }

  private updateLocalEquippedWeapon(type: ItemType) {
    if (this.viewmodel) {
      this.viewmodel.setWeapon(type);
    }
    if (!this.localPlayerMesh) return;
    const socket = this.localPlayerMesh.getObjectByName('weaponSocket') as THREE.Group;
    if (!socket) return;

    while (socket.children.length > 0) {
      socket.remove(socket.children[0]);
    }

    if (type === 'knife') {
      const knife = EntityMeshFactory.createWeaponMesh('knife');
      socket.add(knife);
    } else if (type === 'pistol') {
      const pistol = EntityMeshFactory.createWeaponMesh('pistol');
      socket.add(pistol);
    }
  }

  private setupUIHandlers() {
    this.ui.showMainMenu();

    this.ui.btnCreateRoom.addEventListener('click', async () => {
      const name = this.ui.playerNameInput.value.trim() || 'Resident';
      try {
        await this.network.connect();
        this.network.createRoom(name);
      } catch {
        this.ui.showMenuError('Could not connect to multiplayer server.');
      }
    });

    this.ui.btnJoinRoom.addEventListener('click', async () => {
      const name = this.ui.playerNameInput.value.trim() || 'Resident';
      const code = this.ui.roomCodeInput.value.trim().toUpperCase();
      if (code.length !== 4) {
        this.ui.showMenuError('Please enter a valid 4-letter room code.');
        return;
      }
      try {
        await this.network.connect();
        this.network.joinRoom(code, name);
      } catch {
        this.ui.showMenuError('Could not connect to multiplayer server.');
      }
    });

    this.ui.btnSinglePlayer.addEventListener('click', () => {
      this.startOfflinePractice();
    });

    document.getElementById('btn-start-match')?.addEventListener('click', () => {
      this.network.startMatch();
    });

    this.ui.btnLeaveLobby.addEventListener('click', () => {
      this.network.leaveRoom();
      this.ui.showMainMenu();
    });

    this.ui.btnPlayAgain.addEventListener('click', () => {
      this.ui.showMainMenu();
    });

    document.getElementById('click-to-play-overlay')?.addEventListener('click', () => {
      this.controls.requestLock();
    });
  }

  private setupControlsCallbacks() {
    this.controls.onUnlockChange = (locked) => {
      if (this.isRunning && (this.network.roomCode || this.isOfflineMode)) {
        this.ui.showClickToPlay(!locked);
      }
    };

    this.controls.onAttack = () => {
      this.handleAttackAction();
    };

    this.controls.onInteract = () => {
      this.handleInteractAction();
    };

    this.controls.onReload = () => {
      this.audio.playReload();
      if (!this.isOfflineMode) {
        this.network.sendReload();
      } else {
        const item = this.offlineInventory[this.activeSlotIndex];
        if (item && item.type === 'pistol') {
          item.ammo = 12;
          this.ui.updateInventory(this.offlineInventory, this.activeSlotIndex);
        }
      }
    };

    this.controls.onDropItem = () => {
      if (!this.isOfflineMode) {
        this.network.sendDropItem(this.activeSlotIndex);
      }
    };

    this.controls.onSelectSlot = (slot) => {
      if (typeof slot === 'number') {
        if (slot >= 0 && slot < 4) {
          this.activeSlotIndex = slot;
        } else {
          this.activeSlotIndex = (this.activeSlotIndex + (slot > 0 ? 1 : 3)) % 4;
        }

        if (!this.isOfflineMode) {
          this.network.sendSelectSlot(this.activeSlotIndex);
        } else {
          const item = this.offlineInventory[this.activeSlotIndex];
          this.updateLocalEquippedWeapon(item ? item.type : 'fists');
          this.ui.updateInventory(this.offlineInventory, this.activeSlotIndex);
        }
      }
    };
  }

  private handleAttackAction() {
    if (this.hasGenuineKey) return;

    const activeItem = this.isOfflineMode
      ? this.offlineInventory[this.activeSlotIndex]
      : (this.network.latestSnapshot?.players[this.network.playerId || '']?.inventory[this.activeSlotIndex]);

    const weaponType = activeItem ? activeItem.type : 'fists';
    this.viewmodel.triggerAttack(weaponType);

    if (weaponType === 'pistol') {
      if (activeItem && activeItem.ammo && activeItem.ammo <= 0) {
        this.audio.playFootstep();
        return;
      }
      this.audio.playGunshot();

      const camDir = new THREE.Vector3();
      this.renderer.camera.getWorldDirection(camDir);
      const origin = this.controls.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
      const target = origin.clone().add(camDir.clone().multiplyScalar(50));
      this.spawnBulletTracer(origin, target);

      if (!this.isOfflineMode) {
        this.network.sendAttack(origin, camDir);
      } else {
        if (activeItem && activeItem.ammo) activeItem.ammo--;
        this.ui.updateInventory(this.offlineInventory, this.activeSlotIndex);
        this.checkOfflineHit(target, true);
      }
    } else if (weaponType === 'knife') {
      this.audio.playKnifeSlash();
      if (!this.isOfflineMode) {
        this.network.sendAttack();
      } else {
        this.checkOfflineMeleeHit(WEAPON_STATS.knife.damage);
      }
    } else {
      this.audio.playPunch();
      if (!this.isOfflineMode) {
        this.network.sendAttack();
      } else {
        this.checkOfflineMeleeHit(WEAPON_STATS.fists.damage);
      }
    }
  }

  private checkOfflineMeleeHit(damage: number) {
    for (const [id, mesh] of this.roosterMeshes.entries()) {
      if (mesh.position.distanceTo(this.controls.pos) < 3.2) {
        this.audio.playRoosterCall();
        mesh.rotation.z = Math.PI / 2;
        const keyPickup = EntityMeshFactory.createPickupMesh('key', true);
        keyPickup.position.copy(mesh.position);
        keyPickup.position.y = 0.5;
        this.renderer.scene.add(keyPickup);
        this.pickupMeshes.set(`offline_key_${id}`, keyPickup);

        // Physical drop
        this.physics.addDroppedLootBody(`offline_key_${id}`, keyPickup, mesh.position);
        break;
      }
    }
  }

  private checkOfflineHit(targetPos: THREE.Vector3, isGun: boolean) {
    for (const [id, mesh] of this.roosterMeshes.entries()) {
      if (mesh.position.distanceTo(targetPos) < 4.5 || mesh.position.distanceTo(this.controls.pos) < 16.0) {
        this.audio.playRoosterCall();
        mesh.rotation.z = Math.PI / 2;
        const keyPickup = EntityMeshFactory.createPickupMesh('key', true);
        keyPickup.position.copy(mesh.position);
        keyPickup.position.y = 0.5;
        this.renderer.scene.add(keyPickup);
        this.pickupMeshes.set(`offline_key_${id}`, keyPickup);

        this.physics.addDroppedLootBody(`offline_key_${id}`, keyPickup, mesh.position);
        break;
      }
    }
  }

  private spawnBulletTracer(origin: THREE.Vector3, target: THREE.Vector3) {
    const points = [origin, target];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xfef08a, linewidth: 2 });
    const line = new THREE.Line(geo, mat);
    this.renderer.scene.add(line);
    this.activeBulletLines.push({ line, expireTime: performance.now() + 100 });
  }

  private setupNetworkHandlers() {
    this.network.onConnected = () => {
      this.ui.hideMenuError();
    };

    this.network.onError = (msg) => {
      this.ui.showMenuError(msg);
    };

    this.network.onLobbyUpdate = (players) => {
      this.ui.showLobby(this.network.roomCode || '', players, this.network.isHost);
    };

    this.network.onMatchStarted = (role, assignedHouse) => {
      this.myRole = role;
      this.myAssignedHouse = assignedHouse;

      if (this.localPlayerMesh) {
        this.renderer.scene.remove(this.localPlayerMesh);
      }
      this.localPlayerMesh = EntityMeshFactory.createCharacterMesh(role, true);
      this.renderer.scene.add(this.localPlayerMesh);
      this.updateLocalEquippedWeapon('knife');

      this.ui.showGameHUD(role, this.network.roomCode || '', assignedHouse);
      this.controls.pos.set(0, 0, 10);
      this.controls.requestLock();
      this.audio.playRoosterCall();
    };

    this.network.onSnapshot = (snapshot) => {
      this.syncFromSnapshot(snapshot);
    };

    this.network.onCollapseEvent = (riddle) => {
      this.triggerCollapseSequence(riddle);
    };

    this.network.onGunshotEvent = (_shooterId, _pos) => {
      this.audio.playGunshot();
    };

    this.network.onRedMeterAlert = (level, _msg) => {
      this.ui.updateRedMeter(level);
    };

    this.network.onMatchOver = (winnerId, winnerName, reason) => {
      const isMe = winnerId === this.network.playerId;
      if (isMe) {
        this.audio.playWin();
      }
      this.ui.showGameOver(winnerName, reason, isMe);
      this.controls.unlock();
    };
  }

  public spawnTownCiviliansAndRoosters() {
    if (this.offlineNpcEntities.size > 0) return;

    // 1. Spawn 8 Roosters
    for (let i = 0; i < 8; i++) {
      const rooster = EntityMeshFactory.createRoosterMesh();
      const angle = (i / 8) * Math.PI * 2;
      const dist = 32 + (i % 3) * 16;
      let rx = Math.cos(angle) * dist;
      let rz = Math.sin(angle) * dist;
      if (checkObstacleCollision(rx, rz, 0.6)) {
        rx += 3;
        rz += 3;
      }
      rooster.position.set(rx, getTerrainHeight(rx, rz), rz);
      this.renderer.scene.add(rooster);
      this.roosterMeshes.set(`offline_rooster_${i}`, rooster);
      this.offlineRoosterEntities.set(`offline_rooster_${i}`, {
        mesh: rooster,
        yaw: Math.random() * Math.PI * 2,
        twitchTimer: Math.random() * 1.5,
        activity: 'patrol'
      });
    }

    // 2. Spawn 40 NPCs in Real City Sets: Pairs, Conversational Groups, Sitters, Runners
    const factions: ('pedestrian' | 'waiter' | 'doctor' | 'lawyer' | 'guard' | 'merchant')[] = [
      'pedestrian', 'waiter', 'doctor', 'lawyer', 'guard', 'merchant'
    ];

    for (let i = 0; i < 40; i++) {
      const faction = factions[i % factions.length];
      const npc = EntityMeshFactory.createCharacterMesh(faction);
      let nx = 0;
      let nz = 0;
      let yaw = 0;
      let activity: 'walk' | 'sit' | 'chat' | 'patrol' = 'walk';
      let target: { x: number; z: number } | undefined;

      if (i < 12) {
        // Pairs walking side-by-side
        const pairIndex = Math.floor(i / 2);
        const isSecondOfPair = (i % 2 === 1);
        const avenueCoord = -60 + pairIndex * 24;
        nx = isSecondOfPair ? 10.5 : 8.5;
        nz = avenueCoord;
        activity = 'walk';
        yaw = 0;
        target = { x: nx, z: 80 };
      } else if (i < 20) {
        // Conversational circles
        const circleGroup = i < 16 ? 0 : 1;
        const center = circleGroup === 0 ? { x: 0, z: 12 } : { x: 0, z: -62 };
        const circleAngle = ((i % 4) / 4) * Math.PI * 2;
        nx = center.x + Math.cos(circleAngle) * 2.2;
        nz = center.z + Math.sin(circleAngle) * 2.2;
        yaw = circleAngle + Math.PI;
        activity = 'chat';
      } else if (i < 26) {
        // Sitting citizens on park benches (bench seat at y = 0.45)
        const benchSpots = [
          { x: -12, z: 20 }, { x: 12, z: 20 },
          { x: -12, z: 30 }, { x: 12, z: 30 },
          { x: -45, z: -45 }, { x: 45, z: 45 }
        ];
        const spot = benchSpots[i - 20];
        nx = spot.x;
        nz = spot.z;
        activity = 'sit';
        EntityMeshFactory.animateSittingNpcWithPhone(npc, 0);
        npc.position.y = 0.45;
      } else if (i < 30) {
        // Athletic runners
        const offset = (i - 26) * 30;
        nx = -9.5;
        nz = -40 + offset;
        activity = 'patrol';
        target = { x: -9.5, z: 90 };
      } else {
        // Purposeful solo walkers
        const angle = ((i - 30) / 10) * Math.PI * 2;
        nx = Math.cos(angle) * 45;
        nz = Math.sin(angle) * 45;
        activity = 'walk';
        target = { x: -nx, z: -nz };
      }

      if (checkObstacleCollision(nx, nz, 0.6)) {
        nx += 3;
        nz += 3;
      }
      const ny = activity === 'sit' ? getTerrainHeight(nx, nz) + 0.45 : getTerrainHeight(nx, nz);
      npc.position.set(nx, ny, nz);
      this.renderer.scene.add(npc);
      this.npcMeshes.set(`offline_npc_${i}`, npc);
      this.offlineNpcEntities.set(`offline_npc_${i}`, {
        mesh: npc,
        yaw,
        twitchTimer: Math.random() * 2.0,
        activity,
        target
      });
    }

    // 3. Spawn Weapons Everywhere Across Town
    const offlineWeaponSpots: { type: ItemType; name: string; ammo?: number; pos: THREE.Vector3 }[] = [
      // Restaurant (0, -75)
      { type: 'pistol', name: '9mm Semi-Auto Pistol', ammo: 12, pos: new THREE.Vector3(0, 0.8, -82) },
      { type: 'knife', name: 'Chef Combat Knife', pos: new THREE.Vector3(-6, 0.8, -82) },
      // Hospital (-75, 0)
      { type: 'bandage', name: 'Military Medical Kit', pos: new THREE.Vector3(-80, 0.8, 6) },
      { type: 'knife', name: 'Scalpel Knife', pos: new THREE.Vector3(-85, 0.8, -6) },
      // Police HQ (0, 75)
      { type: 'pistol', name: '9mm Tactical Police Pistol', ammo: 12, pos: new THREE.Vector3(0, 0.8, 83) },
      { type: 'bandage', name: 'Police Medical Pack', pos: new THREE.Vector3(2, 0.8, 72) },
      // City Hall & Bank (75, 0)
      { type: 'pistol', name: '9mm Vault Pistol', ammo: 12, pos: new THREE.Vector3(78, 0.8, 0) },
      // Estate Porches
      { type: 'pistol', name: 'Cobalt Estate Handgun', ammo: 12, pos: new THREE.Vector3(-80, 0.4, -73) },
      { type: 'knife', name: 'Crimson Manor Dirk', pos: new THREE.Vector3(80, 0.4, -73) },
      // Central Plaza
      { type: 'pistol', name: 'Fountain Stash Pistol', ammo: 12, pos: new THREE.Vector3(0, 0.4, 18) },
      { type: 'knife', name: 'Bronze Monument Trench Knife', pos: new THREE.Vector3(50, 0.4, 46) }
    ];

    offlineWeaponSpots.forEach((spot, idx) => {
      const mesh = EntityMeshFactory.createPickupMesh(spot.type, false);
      mesh.position.copy(spot.pos);
      this.renderer.scene.add(mesh);
      this.pickupMeshes.set(`offline_pickup_${idx}`, mesh);
    });
  }

  private startOfflinePractice() {
    this.isOfflineMode = true;
    this.myRole = 'pedestrian';
    this.myAssignedHouse = 0;
    this.ui.showGameHUD('pedestrian', 'SOLO', 0);
    this.ui.updateInventory(this.offlineInventory, this.activeSlotIndex);
    this.controls.pos.set(0, 0, 15);
    this.controls.requestLock();
  }

  private handleInteractAction() {
    // 1. Interactive Door Breach & Close (PUBG Style Door Operation)
    const toggledDoor = this.town.tryToggleNearestDoor(this.controls.pos);
    if (toggledDoor) {
      this.audio.playDoorSound(toggledDoor.isOpen);
      return;
    }

    if (this.isOfflineMode) {
      for (const [id, mesh] of this.pickupMeshes.entries()) {
        if (mesh.position.distanceTo(this.controls.pos) < INTERACTION_DISTANCE + 1.2) {
          this.audio.playPickup();
          this.renderer.scene.remove(mesh);
          this.pickupMeshes.delete(id);
          this.physics.removeDynamicBody(id);

          if (id.includes('key')) {
            this.hasKey = true;
            const houseId = this.myAssignedHouse ?? 0;
            const variation = Math.floor(Math.random() * 3);
            const riddle = getAccurateHouseRiddle(houseId, variation);
            this.triggerCollapseSequence(riddle);
          } else {
            this.offlineInventory[2] = {
              id: 'scavenged_pistol',
              type: 'pistol',
              name: '9mm Semi-Auto Pistol',
              ammo: 12,
              maxAmmo: 12
            };
            this.activeSlotIndex = 2;
            this.updateLocalEquippedWeapon('pistol');
            this.ui.updateInventory(this.offlineInventory, this.activeSlotIndex);
          }
          return;
        }
      }

      HOUSES.forEach((h) => {
        const doorPos = new THREE.Vector3(h.doorPos.x, 1.5, h.doorPos.z + 10);
        if (this.controls.pos.distanceTo(doorPos) < INTERACTION_DISTANCE + 1.8) {
          if (this.hasKey && h.id === this.myAssignedHouse) {
            this.audio.playWin();
            this.ui.showGameOver('You (Solo)', 'You cracked the riddle and unlocked your estate!', true);
            this.controls.unlock();
          }
        }
      });
      return;
    }

    // Multiplayer interactions
    let nearestPickupId: string | null = null;
    let minPickupDist = INTERACTION_DISTANCE + 1.2;
    if (this.network.latestSnapshot) {
      for (const [id, p] of Object.entries(this.network.latestSnapshot.pickups)) {
        const dist = this.controls.pos.distanceTo(new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z));
        if (dist < minPickupDist) {
          minPickupDist = dist;
          nearestPickupId = id;
        }
      }
    }

    if (nearestPickupId) {
      this.network.sendInteract('pickup', nearestPickupId);
      return;
    }

    HOUSES.forEach((h) => {
      const doorPos = new THREE.Vector3(h.doorPos.x, 1.5, h.doorPos.z + 10);
      if (this.controls.pos.distanceTo(doorPos) < INTERACTION_DISTANCE + 2.0) {
        this.network.sendInteract('door', `house_${h.id}`);
      }
    });
  }

  public triggerCollapseSequence(riddle: string) {
    if (this.isCollapsing) return;
    this.isCollapsing = true;
    this.hasRiddle = true;
    this.hasGenuineKey = true;
    this.audio.playCollapse();
    this.ui.showCollapseScreen();

    if (this.localPlayerMesh) {
      const smile = this.localPlayerMesh.getObjectByName('smileMesh');
      if (smile) smile.visible = true;
      const socket = this.localPlayerMesh.getObjectByName('weaponSocket');
      if (socket) socket.clear();
    }

    setTimeout(() => {
      this.ui.hideCollapseScreen();
      this.ui.showRiddle(riddle);
      this.isCollapsing = false;
    }, 3000);
  }

  private syncFromSnapshot(snapshot: GameSnapshot) {
    this.ui.updateTimer(snapshot.timerSeconds, snapshot.isOvertime);

    if (this.network.playerId && snapshot.players[this.network.playerId]) {
      const myState = snapshot.players[this.network.playerId];
      this.ui.updateHealth(myState.health, myState.maxHealth);
      this.ui.updateRedMeter(myState.redMeter);
      this.ui.updateInventory(myState.inventory, myState.activeSlot);

      const activeItem = myState.inventory[myState.activeSlot];
      this.updateLocalEquippedWeapon(activeItem ? activeItem.type : 'fists');

      if (myState.hasMemoryLoss && myState.riddle && !this.hasRiddle) {
        this.hasRiddle = true;
        this.ui.showRiddle(myState.riddle);
      }
    }

    this.ui.updatePlayerCount(Object.keys(snapshot.players).length);

    if (snapshot.bulletTraces) {
      snapshot.bulletTraces.forEach((trace) => {
        this.spawnBulletTracer(
          new THREE.Vector3(trace.origin.x, trace.origin.y, trace.origin.z),
          new THREE.Vector3(trace.target.x, trace.target.y, trace.target.z)
        );
      });
    }

    // 1. Sync Remote Players
    const activePlayerIds = new Set<string>();
    for (const [id, p] of Object.entries(snapshot.players)) {
      if (id === this.network.playerId) continue;
      activePlayerIds.add(id);

      let mesh = this.remotePlayerMeshes.get(id);
      if (!mesh) {
        mesh = EntityMeshFactory.createCharacterMesh(p.role, true);
        this.renderer.scene.add(mesh);
        this.remotePlayerMeshes.set(id, mesh);
      }

      mesh.position.lerp(new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z), 0.35);
      mesh.rotation.y = p.yaw + Math.PI;

      const smile = mesh.getObjectByName('smileMesh');
      if (smile) smile.visible = p.isSmiling;

      if (p.isKnockedOut) {
        mesh.rotation.z = Math.PI / 2;
      } else {
        mesh.rotation.z = 0;
      }
    }

    for (const [id, mesh] of this.remotePlayerMeshes.entries()) {
      if (!activePlayerIds.has(id)) {
        this.renderer.scene.remove(mesh);
        this.remotePlayerMeshes.delete(id);
      }
    }

    // 2. Sync Roosters
    const activeRoosterIds = new Set<string>();
    for (const [id, r] of Object.entries(snapshot.roosters)) {
      activeRoosterIds.add(id);
      let mesh = this.roosterMeshes.get(id);
      if (!mesh) {
        mesh = EntityMeshFactory.createRoosterMesh();
        this.renderer.scene.add(mesh);
        this.roosterMeshes.set(id, mesh);
      }

      mesh.position.lerp(new THREE.Vector3(r.pos.x, r.pos.y, r.pos.z), 0.35);
      mesh.rotation.y = r.yaw;

      const beakKey = mesh.getObjectByName('beakKey');
      if (beakKey) beakKey.visible = r.carriedKeyId !== null;

      if (r.isKnockedOut) {
        mesh.rotation.z = Math.PI / 2;
      } else {
        mesh.rotation.z = 0;
      }
    }

    if (activeRoosterIds.size > 0) {
      for (const [id, mesh] of this.roosterMeshes.entries()) {
        if (!activeRoosterIds.has(id)) {
          this.renderer.scene.remove(mesh);
          this.roosterMeshes.delete(id);
        }
      }
    }

    // 3. Sync NPCs & Animate Real Walking Limbs
    const activeNpcIds = new Set<string>();
    for (const [id, npc] of Object.entries(snapshot.npcs)) {
      activeNpcIds.add(id);
      let mesh = this.npcMeshes.get(id);
      if (!mesh) {
        mesh = EntityMeshFactory.createCharacterMesh(npc.faction, false);
        this.renderer.scene.add(mesh);
        this.npcMeshes.set(id, mesh);
      }

      mesh.position.lerp(new THREE.Vector3(npc.pos.x, npc.pos.y, npc.pos.z), 0.25);
      mesh.rotation.y = npc.yaw + Math.PI;

      if (npc.state === 'sitting') {
        EntityMeshFactory.animateSittingNpcWithPhone(mesh, this.npcAnimTimer);
      } else if (npc.state === 'chatting') {
        const leftLeg = mesh.getObjectByName('leftLeg');
        const rightLeg = mesh.getObjectByName('rightLeg');
        const rightArm = mesh.getObjectByName('rightArm');
        const leftArm = mesh.getObjectByName('leftArm');
        if (leftLeg) leftLeg.rotation.x = 0;
        if (rightLeg) rightLeg.rotation.x = 0;
        const gesture = Math.sin(this.npcAnimTimer * 0.7) * 0.3;
        if (rightArm) rightArm.rotation.x = -0.5 + gesture;
        if (leftArm) leftArm.rotation.x = 0;
      } else {
        const isRunner = id.endsWith('6') || id.endsWith('7') || id.endsWith('8') || id.endsWith('9');
        EntityMeshFactory.animateWalkingHuman(mesh, this.npcAnimTimer + parseInt(id.replace(/\D/g, '') || '0', 10), isRunner);
      }
    }

    if (activeNpcIds.size > 0) {
      for (const [id, mesh] of this.npcMeshes.entries()) {
        if (!activeNpcIds.has(id)) {
          this.renderer.scene.remove(mesh);
          this.npcMeshes.delete(id);
        }
      }
    }

    // 4. Sync World Pickups
    const activePickupIds = new Set<string>();
    for (const [id, item] of Object.entries(snapshot.pickups)) {
      activePickupIds.add(id);
      let mesh = this.pickupMeshes.get(id);
      if (!mesh) {
        mesh = EntityMeshFactory.createPickupMesh(item.type, item.type === 'key', item.targetHouseId);
        this.renderer.scene.add(mesh);
        this.pickupMeshes.set(id, mesh);
        this.physics.addDroppedLootBody(id, mesh, item.pos);
      }

      mesh.position.set(item.pos.x, item.pos.y, item.pos.z);
      mesh.rotation.y += 0.03;
    }

    for (const [id, mesh] of this.pickupMeshes.entries()) {
      if (!activePickupIds.has(id)) {
        this.renderer.scene.remove(mesh);
        this.pickupMeshes.delete(id);
        this.physics.removeDynamicBody(id);
      }
    }
  }

  private updateOfflineAI(delta: number) {
    // 1. Move all Offline NPCs along paths
    for (const [_, entity] of this.offlineNpcEntities.entries()) {
      const mesh = entity.mesh;

      if (entity.activity === 'sit') {
        EntityMeshFactory.animateSittingNpcWithPhone(mesh, this.npcAnimTimer);
        continue;
      }

      if (entity.activity === 'chat') {
        entity.yaw += Math.sin(Date.now() * 0.002) * 0.015;
        mesh.rotation.y = entity.yaw;
        const rArm = mesh.getObjectByName('rightArm');
        if (rArm) rArm.rotation.x = -0.5 + Math.sin(this.npcAnimTimer * 0.6) * 0.3;
        continue;
      }

      const isRunner = entity.activity === 'patrol';
      const speed = isRunner ? NPC_RUN_SPEED : NPC_WALK_SPEED;

      if (entity.target) {
        const tdx = entity.target.x - mesh.position.x;
        const tdz = entity.target.z - mesh.position.z;
        const dist = Math.sqrt(tdx * tdx + tdz * tdz);

        if (dist > 2.0) {
          entity.yaw = Math.atan2(tdx, tdz) - Math.PI;
          const moveX = (tdx / dist) * speed * delta;
          const moveZ = (tdz / dist) * speed * delta;

          if (!checkObstacleCollision(mesh.position.x + moveX, mesh.position.z + moveZ, 0.45)) {
            mesh.position.x += moveX;
            mesh.position.z += moveZ;
            mesh.position.y = getTerrainHeight(mesh.position.x, mesh.position.z);
          } else {
            entity.target = { x: -entity.target.x, z: -entity.target.z };
          }
        } else {
          entity.target = { x: -entity.target.x, z: -entity.target.z };
        }
      } else {
        entity.yaw += (Math.random() - 0.5) * 1.0 * delta;
        const moveX = -Math.sin(entity.yaw) * speed * delta;
        const moveZ = -Math.cos(entity.yaw) * speed * delta;

        if (!checkObstacleCollision(mesh.position.x + moveX, mesh.position.z + moveZ, 0.45)) {
          mesh.position.x += moveX;
          mesh.position.z += moveZ;
          mesh.position.y = getTerrainHeight(mesh.position.x, mesh.position.z);
        } else {
          entity.yaw += Math.PI * 0.75;
        }
      }

      mesh.rotation.y = entity.yaw + Math.PI;
      EntityMeshFactory.animateWalkingHuman(mesh, this.npcAnimTimer, isRunner);
    }

    // 2. Move Roosters
    for (const [_, entity] of this.offlineRoosterEntities.entries()) {
      const mesh = entity.mesh;
      entity.twitchTimer -= delta;
      if (entity.twitchTimer <= 0) {
        entity.twitchTimer = 0.5 + Math.random() * 1.5;
        entity.yaw += (Math.random() - 0.5) * 3.0;
      }

      const distToPlayer = mesh.position.distanceTo(this.controls.pos);
      let moveX = 0;
      let moveZ = 0;

      if (distToPlayer < 8.0) {
        const dx = mesh.position.x - this.controls.pos.x;
        const dz = mesh.position.z - this.controls.pos.z;
        const fleeAngle = Math.atan2(dx, dz) + Math.sin(Date.now() * 0.008) * 0.6;
        moveX = Math.sin(fleeAngle) * 9.5 * delta;
        moveZ = Math.cos(fleeAngle) * 9.5 * delta;
        entity.yaw = fleeAngle;
      } else {
        moveX = -Math.sin(entity.yaw) * ROOSTER_WALK_SPEED * delta;
        moveZ = -Math.cos(entity.yaw) * ROOSTER_WALK_SPEED * delta;
      }

      const nextX = mesh.position.x + moveX;
      const nextZ = mesh.position.z + moveZ;

      if (!checkObstacleCollision(nextX, nextZ, 0.45)) {
        mesh.position.x = nextX;
        mesh.position.z = nextZ;
        mesh.position.y = getTerrainHeight(mesh.position.x, mesh.position.z);
      } else {
        entity.yaw = Math.random() * Math.PI * 2;
      }
      mesh.rotation.y = entity.yaw;
    }
  }

  private updateInteractionPrompts() {
    let prompt: string | null = null;

    // 1. Check Interactive Hinged Doors (PUBG Breach & Close)
    for (const d of this.town.doors) {
      if (d.pos.distanceTo(this.controls.pos) < 3.6) {
        prompt = d.isOpen ? `Press [E] to Close ${d.name}` : `Press [E] to Open ${d.name}`;
        break;
      }
    }

    if (!prompt && this.isOfflineMode) {
      for (const [id, mesh] of this.pickupMeshes.entries()) {
        if (mesh.position.distanceTo(this.controls.pos) < INTERACTION_DISTANCE + 1.2) {
          prompt = id.includes('key') ? 'Press [E] to Pick Up Key' : 'Press [E] to Pick Up Weapon';
          break;
        }
      }
      if (!prompt) {
        HOUSES.forEach((h) => {
          const doorPos = new THREE.Vector3(h.doorPos.x, 1.5, h.doorPos.z + 10);
          if (this.controls.pos.distanceTo(doorPos) < INTERACTION_DISTANCE + 1.8) {
            prompt = `Press [E] to Unlock ${h.name}`;
          }
        });
      }
      this.ui.setInteractionPrompt(prompt);
      return;
    }

    if (!prompt && this.network.latestSnapshot) {
      for (const [_, item] of Object.entries(this.network.latestSnapshot.pickups)) {
        const itemPos = new THREE.Vector3(item.pos.x, item.pos.y, item.pos.z);
        if (itemPos.distanceTo(this.controls.pos) < INTERACTION_DISTANCE + 1.2) {
          prompt = `Press [E] to Pick Up ${item.name}`;
          break;
        }
      }

      if (!prompt) {
        HOUSES.forEach((h) => {
          const doorPos = new THREE.Vector3(h.doorPos.x, 1.5, h.doorPos.z + 10);
          if (this.controls.pos.distanceTo(doorPos) < INTERACTION_DISTANCE + 2.0) {
            prompt = `Press [E] to Unlock ${h.name}`;
          }
        });
      }
    }

    this.ui.setInteractionPrompt(prompt);
  }

  private gameLoop() {
    if (!this.isRunning) return;
    requestAnimationFrame(this.gameLoop.bind(this));

    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.npcAnimTimer += delta * 6.5;

    // Step Real Physics Simulation
    this.physics.step(delta);

    // Update Visual Effects (Wind leaf particles, fountain water spray, grass sway)
    this.renderer.updateVisualEffects(delta);

    this.controls.update(delta, !this.isCollapsing);

    // Update First-Person Viewmodel (Arms, weapon bobbing, recoil, sway)
    this.viewmodel.update(
      delta,
      this.controls.isThirdPerson,
      this.controls.isMoving(),
      this.controls.isSprinting(),
      this.controls.isAiming,
      this.controls.walkCycleTimer,
      this.controls.yaw,
      this.controls.pitch
    );

    if (this.isOfflineMode) {
      this.updateOfflineAI(delta);
    }

    // Local player mesh in Third-Person mode
    if (this.localPlayerMesh) {
      this.localPlayerMesh.visible = this.controls.isThirdPerson;
      this.localPlayerMesh.position.set(this.controls.pos.x, this.controls.pos.y, this.controls.pos.z);
      this.localPlayerMesh.rotation.y = this.controls.yaw + Math.PI;

      if (this.controls.isMoving()) {
        EntityMeshFactory.animateWalkingHuman(this.localPlayerMesh, this.controls.walkCycleTimer, this.controls.isSprinting());
        if (this.controls.isAiming) {
          const rightArm = this.localPlayerMesh.getObjectByName('rightArm');
          if (rightArm) rightArm.rotation.x = -Math.PI / 2;
        }
      } else if (this.controls.isCrouching) {
        const leftLeg = this.localPlayerMesh.getObjectByName('leftLeg');
        const rightLeg = this.localPlayerMesh.getObjectByName('rightLeg');
        const leftKnee = this.localPlayerMesh.getObjectByName('leftKnee');
        const rightKnee = this.localPlayerMesh.getObjectByName('rightKnee');
        const rightArm = this.localPlayerMesh.getObjectByName('rightArm');
        if (leftLeg) leftLeg.rotation.x = -0.65;
        if (rightLeg) rightLeg.rotation.x = -0.65;
        if (leftKnee) leftKnee.rotation.x = 0.65;
        if (rightKnee) rightKnee.rotation.x = 0.65;
        if (rightArm) rightArm.rotation.x = this.controls.isAiming ? -Math.PI / 2 : 0;
      } else {
        const leftLeg = this.localPlayerMesh.getObjectByName('leftLeg');
        const rightLeg = this.localPlayerMesh.getObjectByName('rightLeg');
        const leftKnee = this.localPlayerMesh.getObjectByName('leftKnee');
        const rightKnee = this.localPlayerMesh.getObjectByName('rightKnee');
        const leftArm = this.localPlayerMesh.getObjectByName('leftArm');
        const rightArm = this.localPlayerMesh.getObjectByName('rightArm');
        if (leftLeg) leftLeg.rotation.x = 0;
        if (rightLeg) rightLeg.rotation.x = 0;
        if (leftKnee) leftKnee.rotation.x = 0;
        if (rightKnee) rightKnee.rotation.x = 0;
        if (leftArm) leftArm.rotation.x = 0;
        if (rightArm) rightArm.rotation.x = this.controls.isAiming ? -Math.PI / 2 : 0;
      }
    }

    // Bullet lines decay
    const nowMs = performance.now();
    for (let i = this.activeBulletLines.length - 1; i >= 0; i--) {
      const bl = this.activeBulletLines[i];
      if (nowMs > bl.expireTime) {
        this.renderer.scene.remove(bl.line);
        this.activeBulletLines.splice(i, 1);
      }
    }

    // Footstep audio
    if (this.controls.isMoving() && this.controls.isLocked) {
      this.footstepTimer += delta;
      const stepRate = this.controls.isSprinting() ? 0.3 : 0.45;
      if (this.footstepTimer >= stepRate) {
        this.audio.playFootstep();
        this.footstepTimer = 0;
      }
    }

    this.updateInteractionPrompts();

    // 20Hz Network Sync
    const now = performance.now();
    if (!this.isOfflineMode && this.network.playerId && now - this.lastInputSendTime > 45) {
      this.lastInputSendTime = now;
      this.network.sendInput(
        { x: this.controls.pos.x, y: this.controls.pos.y, z: this.controls.pos.z },
        this.controls.yaw,
        this.controls.pitch,
        this.controls.isMoving(),
        this.controls.isSprinting(),
        this.controls.isCrouching,
        this.controls.isAiming
      );
    }

    this.renderer.render();
  }
}
