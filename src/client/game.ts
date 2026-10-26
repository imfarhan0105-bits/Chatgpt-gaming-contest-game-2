import * as THREE from 'three';
import { HOUSES, INTERACTION_DISTANCE, MELEE_ATTACK_DISTANCE } from '../shared/constants.ts';
import { GameSnapshot, PlayerRole } from '../shared/types.ts';
import { SoundEffects } from './audio.ts';
import { PlayerControls } from './controls.ts';
import { EntityMeshFactory } from './entities.ts';
import { NetworkClient } from './network.ts';
import { GameRenderer } from './renderer.ts';
import { TownWorld } from './town.ts';
import { UIManager } from './ui.ts';

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

  // Local game state
  private myRole: PlayerRole = 'pedestrian';
  private myAssignedHouse: number = 0;
  private hasKey: boolean = false;
  private hasGenuineKey: boolean = false;
  private isCollapsing: boolean = false;
  private hasRiddle: boolean = false;

  // Entity Meshes
  private remotePlayerMeshes: Map<string, THREE.Group> = new Map();
  private roosterMeshes: Map<string, THREE.Group> = new Map();
  private npcMeshes: Map<string, THREE.Group> = new Map();
  private pickupMeshes: Map<string, THREE.Group> = new Map();

  // Network sync throttling
  private lastInputSendTime: number = 0;
  private footstepTimer: number = 0;

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new GameRenderer(canvas);
    this.town = new TownWorld();
    this.renderer.scene.add(this.town.group);

    this.controls = new PlayerControls(this.renderer.camera, document.body, this.town);
    this.ui = new UIManager();
    this.audio = new SoundEffects();
    this.network = new NetworkClient();

    this.setupUIHandlers();
    this.setupNetworkHandlers();
    this.setupControlsCallbacks();

    // Start render loop
    this.isRunning = true;
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private setupUIHandlers() {
    this.ui.showMainMenu();

    // Create Room
    this.ui.btnCreateRoom.addEventListener('click', async () => {
      const name = this.ui.playerNameInput.value.trim() || 'Resident';
      try {
        await this.network.connect();
        this.network.createRoom(name);
      } catch (err) {
        this.ui.showMenuError('Could not connect to multiplayer server. Try again.');
      }
    });

    // Join Room
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
      } catch (err) {
        this.ui.showMenuError('Could not connect to multiplayer server.');
      }
    });

    // Offline Practice Mode
    this.ui.btnSinglePlayer.addEventListener('click', () => {
      this.startOfflinePractice();
    });

    // Start match button in lobby
    document.getElementById('btn-start-match')?.addEventListener('click', () => {
      this.network.startMatch();
    });

    // Leave lobby
    this.ui.btnLeaveLobby.addEventListener('click', () => {
      this.network.leaveRoom();
      this.ui.showMainMenu();
    });

    // Play again
    this.ui.btnPlayAgain.addEventListener('click', () => {
      this.ui.showMainMenu();
    });

    // Click to resume pointer lock
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
      this.audio.playPunch();
      if (!this.isOfflineMode) {
        this.network.sendAttack();
      } else {
        this.handleOfflineAttack();
      }
    };

    this.controls.onInteract = () => {
      this.handleInteract();
    };
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
      this.ui.showGameHUD(role, this.network.roomCode || '', assignedHouse);
      this.controls.pos.set(0, 1.7, 5);
      this.controls.requestLock();
      this.audio.playRoosterCall();
    };

    this.network.onSnapshot = (snapshot) => {
      this.syncFromSnapshot(snapshot);
    };

    this.network.onCollapseEvent = (riddle) => {
      this.triggerCollapseSequence(riddle);
    };

    this.network.onRedMeterAlert = (level, msg) => {
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
    this.controls.pos.set(0, 1.7, 10);
    this.controls.requestLock();

    // Spawn 8 offline practice roosters
    for (let i = 0; i < 8; i++) {
      const rooster = EntityMeshFactory.createRoosterMesh();
      const angle = (i / 8) * Math.PI * 2;
      const dist = 12 + (i % 3) * 6;
      rooster.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      this.renderer.scene.add(rooster);
      this.roosterMeshes.set(`offline_rooster_${i}`, rooster);
    }

    // Spawn 16 offline practice NPCs
    const factions: ('pedestrian' | 'waiter' | 'doctor' | 'lawyer' | 'guard' | 'merchant')[] = [
      'pedestrian', 'waiter', 'doctor', 'lawyer', 'guard', 'merchant'
    ];
    for (let i = 0; i < 16; i++) {
      const faction = factions[i % factions.length];
      const npc = EntityMeshFactory.createCharacterMesh(faction);
      const angle = (i / 16) * Math.PI * 2 + 0.3;
      const dist = 18 + (i % 4) * 8;
      npc.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      this.renderer.scene.add(npc);
      this.npcMeshes.set(`offline_npc_${i}`, npc);
    }
  }

  private handleOfflineAttack() {
    // Check melee distance to roosters in offline mode
    for (const [id, mesh] of this.roosterMeshes.entries()) {
      if (mesh.position.distanceTo(this.controls.pos) < MELEE_ATTACK_DISTANCE + 0.5) {
        this.audio.playRoosterCall();
        mesh.rotation.z = Math.PI / 2; // Knockout on side
        // Drop key
        const keyPickup = EntityMeshFactory.createPickupMesh('key', true);
        keyPickup.position.copy(mesh.position);
        keyPickup.position.y = 0.5;
        this.renderer.scene.add(keyPickup);
        this.pickupMeshes.set(`key_${id}`, keyPickup);
        break;
      }
    }
  }

  private handleInteract() {
    if (this.isOfflineMode) {
      // Check offline pickups
      for (const [id, mesh] of this.pickupMeshes.entries()) {
        if (mesh.position.distanceTo(this.controls.pos) < INTERACTION_DISTANCE) {
          this.audio.playPickup();
          this.renderer.scene.remove(mesh);
          this.pickupMeshes.delete(id);
          this.hasKey = true;

          // Trigger genuine key collapse demo
          this.triggerCollapseSequence(HOUSES[0].riddleClue);
          return;
        }
      }

      // Check house door
      HOUSES.forEach((h) => {
        const doorPos = new THREE.Vector3(h.doorPos.x, 1.5, h.doorPos.z + 5);
        if (this.controls.pos.distanceTo(doorPos) < INTERACTION_DISTANCE + 1) {
          if (this.hasKey && h.id === this.myAssignedHouse) {
            this.audio.playWin();
            this.ui.showGameOver('You (Solo)', 'You found the correct house using the riddle!', true);
            this.controls.unlock();
          }
        }
      });
      return;
    }

    // Multiplayer interactions: find nearest pickup or door
    let nearestPickupId: string | null = null;
    let minPickupDist = INTERACTION_DISTANCE;
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

    // Check door interaction
    HOUSES.forEach((h) => {
      const doorPos = new THREE.Vector3(h.doorPos.x, 1.5, h.doorPos.z + 5);
      if (this.controls.pos.distanceTo(doorPos) < INTERACTION_DISTANCE + 1.2) {
        this.network.sendInteract('door', `house_${h.id}`);
      }
    });
  }

  public triggerCollapseSequence(riddle: string) {
    if (this.isCollapsing) return;
    this.isCollapsing = true;
    this.hasRiddle = true;
    this.audio.playCollapse();
    this.ui.showCollapseScreen();

    // Knock camera sideways during collapse
    this.controls.pitch = 0.4;

    setTimeout(() => {
      this.ui.hideCollapseScreen();
      this.ui.showRiddle(riddle);
      this.isCollapsing = false;
    }, 3000);
  }

  private syncFromSnapshot(snapshot: GameSnapshot) {
    this.ui.updateTimer(snapshot.timerSeconds, snapshot.isOvertime);

    // Update local player from snapshot
    if (this.network.playerId && snapshot.players[this.network.playerId]) {
      const myState = snapshot.players[this.network.playerId];
      this.ui.updateHealth(myState.health, myState.maxHealth);
      this.ui.updateRedMeter(myState.redMeter);

      if (myState.hasMemoryLoss && myState.riddle && !this.hasRiddle) {
        this.hasRiddle = true;
        this.ui.showRiddle(myState.riddle);
      }
    }

    this.ui.updatePlayerCount(Object.keys(snapshot.players).length);

    // 1. Sync Remote Players
    const activePlayerIds = new Set<string>();
    for (const [id, p] of Object.entries(snapshot.players)) {
      if (id === this.network.playerId) continue; // Don't render local player mesh
      activePlayerIds.add(id);

      let mesh = this.remotePlayerMeshes.get(id);
      if (!mesh) {
        mesh = EntityMeshFactory.createCharacterMesh(p.role, true);
        this.renderer.scene.add(mesh);
        this.remotePlayerMeshes.set(id, mesh);
      }

      // Smooth interpolation
      mesh.position.lerp(new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z), 0.3);
      mesh.rotation.y = p.yaw;

      // Show smile if key carrier woke up
      const smile = mesh.getObjectByName('smileMesh');
      if (smile) smile.visible = p.isSmiling;

      // Knockout pose
      if (p.isKnockedOut) {
        mesh.rotation.z = Math.PI / 2;
      } else {
        mesh.rotation.z = 0;
      }
    }

    // Cleanup disconnected players
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
      if (beakKey) {
        beakKey.visible = r.carriedKeyId !== null;
      }

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

    // 3. Sync NPCs
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
      mesh.rotation.y = npc.yaw;
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
      mesh.rotation.y += 0.02; // Gentle spin for visibility
    }

    for (const [id, mesh] of this.pickupMeshes.entries()) {
      if (!activePickupIds.has(id)) {
        this.renderer.scene.remove(mesh);
        this.pickupMeshes.delete(id);
      }
    }
  }

  private updateInteractionPrompts() {
    let prompt: string | null = null;

    if (this.isOfflineMode) {
      for (const [_, mesh] of this.pickupMeshes.entries()) {
        if (mesh.position.distanceTo(this.controls.pos) < INTERACTION_DISTANCE) {
          prompt = 'Press [E] to Pick Up Key';
          break;
        }
      }
      if (!prompt) {
        HOUSES.forEach((h) => {
          const doorPos = new THREE.Vector3(h.doorPos.x, 1.5, h.doorPos.z + 5);
          if (this.controls.pos.distanceTo(doorPos) < INTERACTION_DISTANCE + 1) {
            prompt = `Press [E] to Unlock ${h.name}`;
          }
        });
      }
      this.ui.setInteractionPrompt(prompt);
      return;
    }

    // Multiplayer prompts
    if (this.network.latestSnapshot) {
      for (const [_, item] of Object.entries(this.network.latestSnapshot.pickups)) {
        const itemPos = new THREE.Vector3(item.pos.x, item.pos.y, item.pos.z);
        if (itemPos.distanceTo(this.controls.pos) < INTERACTION_DISTANCE) {
          prompt = `Press [E] to Pick Up ${item.name}`;
          break;
        }
      }

      if (!prompt) {
        HOUSES.forEach((h) => {
          const doorPos = new THREE.Vector3(h.doorPos.x, 1.5, h.doorPos.z + 5);
          if (this.controls.pos.distanceTo(doorPos) < INTERACTION_DISTANCE + 1.2) {
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

    // Update controls (unless collapsing)
    this.controls.update(delta, !this.isCollapsing);

    // Audio footstep cadence
    if (this.controls.isMoving() && this.controls.isLocked) {
      this.footstepTimer += delta;
      const stepRate = this.controls.isSprinting() ? 0.32 : 0.48;
      if (this.footstepTimer >= stepRate) {
        this.audio.playFootstep();
        this.footstepTimer = 0;
      }
    }

    // Interaction raycast / distance prompt
    this.updateInteractionPrompts();

    // Send player input to authoritative server at ~20Hz
    const now = performance.now();
    if (!this.isOfflineMode && this.network.playerId && now - this.lastInputSendTime > 45) {
      this.lastInputSendTime = now;
      this.network.sendInput(
        { x: this.controls.pos.x, y: this.controls.pos.y, z: this.controls.pos.z },
        this.controls.yaw,
        this.controls.pitch,
        this.controls.isMoving(),
        this.controls.isSprinting()
      );
    }

    // Render scene
    this.renderer.render();
  }
}
