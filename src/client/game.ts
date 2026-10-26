import * as THREE from 'three';
import { checkObstacleCollision, HOUSES, INTERACTION_DISTANCE, NPC_WALK_SPEED, ROOSTER_WALK_SPEED, WEAPON_STATS } from '../shared/constants.ts';
import type { GameSnapshot, ItemType, PlayerRole } from '../shared/types.ts';
import { SoundEffects } from './audio.ts';
import { PlayerControls } from './controls.ts';
import { EntityMeshFactory } from './entities.ts';
import { NetworkClient } from './network.ts';
import { GameRenderer } from './renderer.ts';
import { TownWorld } from './town.ts';
import { UIManager } from './ui.ts';

interface OfflineEntity {
  mesh: THREE.Group;
  yaw: number;
  twitchTimer: number;
}

export class CockAndKeysGame {
  private renderer: GameRenderer;
  private town: TownWorld;
  private controls: PlayerControls;
  private ui: UIManager;
  private audio: SoundEffects;
  private network: NetworkClient;

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

  // Offline local simulation
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

    this.controls = new PlayerControls(this.renderer.camera, document.body, this.town);
    this.ui = new UIManager();
    this.audio = new SoundEffects();
    this.network = new NetworkClient();

    this.setupLocalPlayerMesh();
    this.setupUIHandlers();
    this.setupNetworkHandlers();
    this.setupControlsCallbacks();

    this.isRunning = true;
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private setupLocalPlayerMesh() {
    this.localPlayerMesh = EntityMeshFactory.createCharacterMesh(this.myRole, true);
    this.renderer.scene.add(this.localPlayerMesh);
    this.updateLocalEquippedWeapon('knife');
  }

  private updateLocalEquippedWeapon(type: ItemType) {
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

    this.network.onGunshotEvent = (_shooterId, pos) => {
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

  private startOfflinePractice() {
    this.isOfflineMode = true;
    this.myRole = 'pedestrian';
    this.myAssignedHouse = 0;
    this.ui.showGameHUD('pedestrian', 'SOLO', 0);
    this.ui.updateInventory(this.offlineInventory, this.activeSlotIndex);
    this.controls.pos.set(0, 0, 15);
    this.controls.requestLock();

    // Spawn 8 Roosters with unpredictable pathing
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
      rooster.position.set(rx, 0, rz);
      this.renderer.scene.add(rooster);
      this.roosterMeshes.set(`offline_rooster_${i}`, rooster);
      this.offlineRoosterEntities.set(`offline_rooster_${i}`, {
        mesh: rooster,
        yaw: Math.random() * Math.PI * 2,
        twitchTimer: Math.random() * 1.5
      });
    }

    // Spawn 35 Active Moving NPCs
    const factions: ('pedestrian' | 'waiter' | 'doctor' | 'lawyer' | 'guard' | 'merchant')[] = [
      'pedestrian', 'waiter', 'doctor', 'lawyer', 'guard', 'merchant'
    ];
    for (let i = 0; i < 35; i++) {
      const faction = factions[i % factions.length];
      const npc = EntityMeshFactory.createCharacterMesh(faction);
      const angle = (i / 35) * Math.PI * 2 + 0.2;
      const dist = 18 + (i % 5) * 16;
      let nx = Math.cos(angle) * dist;
      let nz = Math.sin(angle) * dist;
      if (checkObstacleCollision(nx, nz, 0.6)) {
        nx += 3;
        nz += 3;
      }
      npc.position.set(nx, 0, nz);
      this.renderer.scene.add(npc);
      this.npcMeshes.set(`offline_npc_${i}`, npc);
      this.offlineNpcEntities.set(`offline_npc_${i}`, {
        mesh: npc,
        yaw: Math.random() * Math.PI * 2,
        twitchTimer: Math.random() * 2.0
      });
    }

    // Spawn Weapons INSIDE Different Buildings
    const offlineWeaponSpots: { type: ItemType; name: string; ammo?: number; pos: THREE.Vector3 }[] = [
      // Inside Restaurant (0, -75) on bar counter
      { type: 'pistol', name: '9mm Semi-Auto Pistol', ammo: 12, pos: new THREE.Vector3(0, 0.8, -82) },
      // Inside Central Hospital (-75, 0) on bed
      { type: 'bandage', name: 'Military Medical Kit', pos: new THREE.Vector3(-80, 0.8, 6) },
      // Inside Police HQ (0, 75) in evidence locker
      { type: 'pistol', name: '9mm Tactical Police Pistol', ammo: 12, pos: new THREE.Vector3(0, 0.8, 83) },
      // Inside City Hall & Bank (75, 0) behind teller counter
      { type: 'pistol', name: '9mm Vault Pistol', ammo: 12, pos: new THREE.Vector3(78, 0.8, 0) }
    ];

    offlineWeaponSpots.forEach((spot, idx) => {
      const mesh = EntityMeshFactory.createPickupMesh(spot.type, false);
      mesh.position.copy(spot.pos);
      this.renderer.scene.add(mesh);
      this.pickupMeshes.set(`offline_pickup_${idx}`, mesh);
    });
  }

  private handleInteractAction() {
    if (this.isOfflineMode) {
      // Offline pickup collection
      for (const [id, mesh] of this.pickupMeshes.entries()) {
        if (mesh.position.distanceTo(this.controls.pos) < INTERACTION_DISTANCE + 1.2) {
          this.audio.playPickup();
          this.renderer.scene.remove(mesh);
          this.pickupMeshes.delete(id);

          if (id.includes('key')) {
            this.hasKey = true;
            this.triggerCollapseSequence(HOUSES[0].riddleClue);
          } else {
            // Weapon pickup
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

      // Offline estate door unlock
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

    // Check estate doors
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

    // Sync bullet traces
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

    for (const [id, mesh] of this.roosterMeshes.entries()) {
      if (!activeRoosterIds.has(id)) {
        this.renderer.scene.remove(mesh);
        this.roosterMeshes.delete(id);
      }
    }

    // 3. Sync NPCs & Animate Walking Limbs
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

      // Animate NPC walking limbs
      const leftLeg = mesh.getObjectByName('leftLeg');
      const rightLeg = mesh.getObjectByName('rightLeg');
      const leftArm = mesh.getObjectByName('leftArm');
      const rightArm = mesh.getObjectByName('rightArm');

      const swing = Math.sin(this.npcAnimTimer + parseInt(id.replace(/\D/g, '') || '0', 10)) * 0.5;
      if (leftLeg) leftLeg.rotation.x = swing;
      if (rightLeg) rightLeg.rotation.x = -swing;
      if (leftArm) leftArm.rotation.x = -swing * 0.7;
      if (rightArm) rightArm.rotation.x = swing * 0.7;
    }

    for (const [id, mesh] of this.npcMeshes.entries()) {
      if (!activeNpcIds.has(id)) {
        this.renderer.scene.remove(mesh);
        this.npcMeshes.delete(id);
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
      }

      mesh.position.set(item.pos.x, item.pos.y, item.pos.z);
      mesh.rotation.y += 0.03;
    }

    for (const [id, mesh] of this.pickupMeshes.entries()) {
      if (!activePickupIds.has(id)) {
        this.renderer.scene.remove(mesh);
        this.pickupMeshes.delete(id);
      }
    }
  }

  private updateOfflineAI(delta: number) {
    // 1. Move all Offline NPCs actively along streets with obstacle avoidance
    for (const [_, entity] of this.offlineNpcEntities.entries()) {
      const mesh = entity.mesh;
      entity.yaw += (Math.random() - 0.5) * 1.2 * delta;

      const moveX = -Math.sin(entity.yaw) * NPC_WALK_SPEED * delta;
      const moveZ = -Math.cos(entity.yaw) * NPC_WALK_SPEED * delta;

      const nextX = mesh.position.x + moveX;
      const nextZ = mesh.position.z + moveZ;

      if (!checkObstacleCollision(nextX, nextZ, 0.45)) {
        mesh.position.x = nextX;
        mesh.position.z = nextZ;
      } else {
        entity.yaw += Math.PI * 0.75;
      }
      mesh.rotation.y = entity.yaw + Math.PI;

      // Animate limbs
      const leftLeg = mesh.getObjectByName('leftLeg');
      const rightLeg = mesh.getObjectByName('rightLeg');
      const leftArm = mesh.getObjectByName('leftArm');
      const rightArm = mesh.getObjectByName('rightArm');
      const swing = Math.sin(this.npcAnimTimer) * 0.5;
      if (leftLeg) leftLeg.rotation.x = swing;
      if (rightLeg) rightLeg.rotation.x = -swing;
      if (leftArm) leftArm.rotation.x = -swing * 0.7;
      if (rightArm) rightArm.rotation.x = swing * 0.7;
    }

    // 2. Move all Offline Roosters with erratic unpredictable pathing and obstacle avoidance
    for (const [_, entity] of this.offlineRoosterEntities.entries()) {
      const mesh = entity.mesh;
      entity.twitchTimer -= delta;
      if (entity.twitchTimer <= 0) {
        entity.twitchTimer = 0.5 + Math.random() * 1.5;
        entity.yaw += (Math.random() - 0.5) * 3.0; // Random twitch
      }

      // Check player proximity
      const distToPlayer = mesh.position.distanceTo(this.controls.pos);
      let moveX = 0;
      let moveZ = 0;

      if (distToPlayer < 8.0) {
        // Fleeing frantically with zig-zag
        const dx = mesh.position.x - this.controls.pos.x;
        const dz = mesh.position.z - this.controls.pos.z;
        const fleeAngle = Math.atan2(dx, dz) + Math.sin(Date.now() * 0.008) * 0.6;
        moveX = Math.sin(fleeAngle) * 9.0 * delta;
        moveZ = Math.cos(fleeAngle) * 9.0 * delta;
        entity.yaw = fleeAngle;
      } else {
        moveX = -Math.sin(entity.yaw) * ROOSTER_WALK_SPEED * delta;
        moveZ = -Math.cos(entity.yaw) * ROOSTER_WALK_SPEED * delta;
      }

      const nextX = mesh.position.x + moveX;
      const nextZ = mesh.position.z + moveZ;

      // Obstacle collision check: Roosters NEVER enter obstacles!
      if (!checkObstacleCollision(nextX, nextZ, 0.45)) {
        mesh.position.x = nextX;
        mesh.position.z = nextZ;
      } else {
        entity.yaw = Math.random() * Math.PI * 2;
      }
      mesh.rotation.y = entity.yaw;
    }
  }

  private updateInteractionPrompts() {
    let prompt: string | null = null;

    if (this.isOfflineMode) {
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

    if (this.network.latestSnapshot) {
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

    this.controls.update(delta, !this.isCollapsing);

    if (this.isOfflineMode) {
      this.updateOfflineAI(delta);
    }

    // Local player mesh in Third-Person PvP mode
    if (this.localPlayerMesh) {
      this.localPlayerMesh.visible = this.controls.isThirdPerson;
      this.localPlayerMesh.position.set(this.controls.pos.x, this.controls.pos.y, this.controls.pos.z);
      this.localPlayerMesh.rotation.y = this.controls.yaw + Math.PI;

      const leftLeg = this.localPlayerMesh.getObjectByName('leftLeg');
      const rightLeg = this.localPlayerMesh.getObjectByName('rightLeg');
      const leftArm = this.localPlayerMesh.getObjectByName('leftArm');
      const rightArm = this.localPlayerMesh.getObjectByName('rightArm');

      if (this.controls.isMoving()) {
        const angle = Math.sin(this.controls.walkCycleTimer) * 0.55;
        if (leftLeg) leftLeg.rotation.x = angle;
        if (rightLeg) rightLeg.rotation.x = -angle;
        if (leftArm) leftArm.rotation.x = -angle * 0.8;
        if (rightArm) rightArm.rotation.x = this.controls.isAiming ? -Math.PI / 2 : angle * 0.8;
      } else {
        if (leftLeg) leftLeg.rotation.x = 0;
        if (rightLeg) rightLeg.rotation.x = 0;
        if (leftArm) leftArm.rotation.x = 0;
        if (rightArm) rightArm.rotation.x = this.controls.isAiming ? -Math.PI / 2 : 0;
      }
    }

    // Bullet line decay
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
