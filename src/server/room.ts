import {
  HOUSES,
  INTERACTION_DISTANCE,
  MATCH_DURATION_SECONDS,
  MELEE_ATTACK_DISTANCE,
  MELEE_DAMAGE,
  NPC_FACTIONS,
  NPC_WALK_SPEED,
  PLAYER_ROLES,
  RED_METER_THRESHOLDS,
  ROOSTER_FLEE_SPEED,
  ROOSTER_WALK_SPEED,
  TOWN_SIZE
} from '../shared/constants.ts';
import type {
  ClientMessage,
  GameSnapshot,
  KeyItemState,
  NpcFaction,
  NpcState,
  PlayerRole,
  PlayerState,
  RoosterState,
  ServerMessage,
  Vector3D,
  WorldPickup
} from '../shared/types.ts';

export interface ConnectedClient {
  id: string;
  name: string;
  isHost: boolean;
  ws: {
    send: (data: string) => void;
    readyState: number;
  };
}

export class GameRoom {
  public roomCode: string;
  public clients: Map<string, ConnectedClient> = new Map();
  public status: 'lobby' | 'playing' | 'ended' = 'lobby';

  // Game state
  public players: Map<string, PlayerState> = new Map();
  public roosters: Map<string, RoosterState> = new Map();
  public keys: Map<string, KeyItemState> = new Map();
  public npcs: Map<string, NpcState> = new Map();
  public pickups: Map<string, WorldPickup> = new Map();

  // Match timing
  public timerSeconds: number = MATCH_DURATION_SECONDS;
  public isOvertime: boolean = false;
  public winnerId: string | null = null;
  public winnerName: string | null = null;

  private tickInterval: NodeJS.Timeout | null = null;
  private lastTickTime: number = Date.now();

  constructor(roomCode: string) {
    this.roomCode = roomCode;
  }

  public addClient(id: string, name: string, ws: ConnectedClient['ws']): ConnectedClient {
    const isHost = this.clients.size === 0;
    const client: ConnectedClient = { id, name, isHost, ws };
    this.clients.set(id, client);

    this.broadcastLobby();
    return client;
  }

  public removeClient(id: string) {
    const wasHost = this.clients.get(id)?.isHost ?? false;
    this.clients.delete(id);

    if (this.players.has(id)) {
      const p = this.players.get(id)!;
      p.connected = false;
    }

    // Reassign host if host left
    if (wasHost && this.clients.size > 0) {
      const nextHost = this.clients.values().next().value;
      if (nextHost) {
        nextHost.isHost = true;
      }
    }

    if (this.status === 'lobby') {
      this.broadcastLobby();
    }

    if (this.clients.size === 0) {
      this.stop();
    }
  }

  public broadcastLobby() {
    const playersList = Array.from(this.clients.values()).map((c) => ({
      id: c.id,
      name: c.name,
      isHost: c.isHost
    }));

    const msg: ServerMessage = {
      type: 'lobby_update',
      players: playersList
    };
    this.broadcast(msg);
  }

  public broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    for (const client of this.clients.values()) {
      if (client.ws.readyState === 1) {
        client.ws.send(data);
      }
    }
  }

  public sendTo(clientId: string, msg: ServerMessage) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(msg));
    }
  }

  public startMatch(requestingClientId: string): boolean {
    const client = this.clients.get(requestingClientId);
    if (!client || !client.isHost) {
      return false;
    }

    this.status = 'playing';
    this.timerSeconds = MATCH_DURATION_SECONDS;
    this.isOvertime = false;
    this.winnerId = null;
    this.winnerName = null;

    // 1. Initialize Player states
    const clientArr = Array.from(this.clients.values());
    clientArr.forEach((c, index) => {
      const role: PlayerRole = PLAYER_ROLES[index % PLAYER_ROLES.length];
      const assignedHouse = index % 4; // 0, 1, 2, 3

      // Spawn player in town center or near their starting role activity
      const spawnX = (index - clientArr.length / 2) * 4;
      const spawnZ = 8 + index * 2;

      const playerState: PlayerState = {
        id: c.id,
        name: c.name,
        role,
        pos: { x: spawnX, y: 1.7, z: spawnZ },
        yaw: 0,
        pitch: 0,
        health: 100,
        maxHealth: 100,
        isKnockedOut: false,
        assignedHouse,
        redMeter: 0,
        attackedFactions: [],
        inventory: [
          { id: `fists_${c.id}`, type: 'fists', name: 'Fists' },
          null,
          null,
          null
        ],
        activeSlot: 0,
        hasGenuineKey: false,
        hasMemoryLoss: false,
        riddle: null,
        isSmiling: false,
        isHost: c.isHost,
        connected: true
      };

      this.players.set(c.id, playerState);

      // Notify player of their assigned role and assigned house
      this.sendTo(c.id, {
        type: 'match_started',
        assignedRole: role,
        assignedHouse
      });
    });

    // 2. Initialize 8 Roosters and 8 Keys (4 genuine, 4 decoy)
    this.roosters.clear();
    this.keys.clear();
    this.pickups.clear();

    for (let i = 0; i < 8; i++) {
      const keyId = `key_${i}`;
      const isGenuine = i < 4; // First 4 are genuine keys for houses 0, 1, 2, 3
      const targetHouseId = i % 4;

      const keyState: KeyItemState = {
        id: keyId,
        targetHouseId,
        isGenuine,
        carriedByRoosterId: `rooster_${i}`,
        carriedByPlayerId: null,
        worldPos: null
      };
      this.keys.set(keyId, keyState);

      const angle = (i / 8) * Math.PI * 2;
      const dist = 14 + (i % 3) * 6;
      const rx = Math.cos(angle) * dist;
      const rz = Math.sin(angle) * dist;

      const roosterState: RoosterState = {
        id: `rooster_${i}`,
        pos: { x: rx, y: 0.5, z: rz },
        yaw: angle + Math.PI,
        health: 50,
        maxHealth: 50,
        isKnockedOut: false,
        carriedKeyId: keyId
      };
      this.roosters.set(roosterState.id, roosterState);
    }

    // 3. Initialize 18 town NPCs across 6 factions
    this.npcs.clear();
    for (let i = 0; i < 18; i++) {
      const faction = NPC_FACTIONS[i % NPC_FACTIONS.length];
      const angle = (i / 18) * Math.PI * 2 + 0.2;
      const dist = 20 + (i % 4) * 7;
      const nx = Math.cos(angle) * dist;
      const nz = Math.sin(angle) * dist;

      const npc: NpcState = {
        id: `npc_${i}`,
        faction,
        name: `${faction.charAt(0).toUpperCase() + faction.slice(1)} ${i + 1}`,
        pos: { x: nx, y: 1.7, z: nz },
        yaw: angle,
        health: 80,
        maxHealth: 80,
        state: 'patrol',
        targetPlayerId: null
      };
      this.npcs.set(npc.id, npc);
    }

    // Spawn scavenged weapons in town
    this.spawnScavengedWeapons();

    // Start 20Hz Authoritative Game Tick
    this.startTick();
    return true;
  }

  private spawnScavengedWeapons() {
    const weaponSpots: { type: 'crowbar' | 'bat' | 'bandage'; name: string; pos: Vector3D }[] = [
      { type: 'crowbar', name: 'Iron Crowbar', pos: { x: -8, y: 0.3, z: -15 } },
      { type: 'bat', name: 'Wooden Bat', pos: { x: 12, y: 0.3, z: -18 } },
      { type: 'crowbar', name: 'Heavy Crowbar', pos: { x: -16, y: 0.3, z: 20 } },
      { type: 'bandage', name: 'First Aid Kit', pos: { x: -30, y: 0.3, z: 5 } },
      { type: 'bandage', name: 'First Aid Kit', pos: { x: 28, y: 0.3, z: -8 } }
    ];

    weaponSpots.forEach((spot, idx) => {
      const pickupId = `pickup_loot_${idx}`;
      this.pickups.set(pickupId, {
        id: pickupId,
        type: spot.type,
        name: spot.name,
        pos: spot.pos
      });
    });
  }

  private startTick() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.lastTickTime = Date.now();

    this.tickInterval = setInterval(() => {
      this.tick();
    }, 50); // 20 Hz (50ms)
  }

  public stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private tick() {
    const now = Date.now();
    const delta = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    if (this.status !== 'playing') return;

    // 1. Update Match Timer
    this.timerSeconds -= delta;
    if (this.timerSeconds <= 0) {
      if (!this.isOvertime) {
        this.isOvertime = true;
        this.timerSeconds = 120; // 2 minutes Sudden Death Overtime
      } else {
        // Sudden death expired with no winner
        this.status = 'ended';
        this.broadcast({
          type: 'match_over',
          winnerId: '',
          winnerName: 'Nobody',
          reason: 'Time expired in Sudden Death overtime!'
        });
        return;
      }
    }

    // 2. Update Roosters AI
    this.updateRoosters(delta);

    // 3. Update NPCs AI & Hostility
    this.updateNpcs(delta);

    // 4. Broadcast Authoritative Snapshot to Clients
    this.broadcastSnapshot();
  }

  private updateRoosters(delta: number) {
    const speed = this.isOvertime ? ROOSTER_FLEE_SPEED * 1.25 : ROOSTER_FLEE_SPEED;

    for (const rooster of this.roosters.values()) {
      if (rooster.isKnockedOut) continue;

      // Check if any player is nearby (flee trigger)
      let nearestDist = 999;
      let fleeDirX = 0;
      let fleeDirZ = 0;

      for (const player of this.players.values()) {
        if (player.isKnockedOut) continue;
        const dx = rooster.pos.x - player.pos.x;
        const dz = rooster.pos.z - player.pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 6.0 && dist < nearestDist) {
          nearestDist = dist;
          fleeDirX = dx / (dist || 1);
          fleeDirZ = dz / (dist || 1);
        }
      }

      if (nearestDist < 6.0) {
        // Fleeing from player
        rooster.pos.x += fleeDirX * speed * delta;
        rooster.pos.z += fleeDirZ * speed * delta;
        rooster.yaw = Math.atan2(fleeDirX, fleeDirZ);
      } else {
        // Casual wander
        rooster.yaw += (Math.random() - 0.5) * 1.5 * delta;
        rooster.pos.x += Math.sin(rooster.yaw) * ROOSTER_WALK_SPEED * 0.4 * delta;
        rooster.pos.z += Math.cos(rooster.yaw) * ROOSTER_WALK_SPEED * 0.4 * delta;
      }

      // Keep rooster inside town bounds
      const half = TOWN_SIZE / 2 - 4;
      rooster.pos.x = Math.max(-half, Math.min(half, rooster.pos.x));
      rooster.pos.z = Math.max(-half, Math.min(half, rooster.pos.z));
    }
  }

  private updateNpcs(delta: number) {
    for (const npc of this.npcs.values()) {
      if (npc.health <= 0) continue;

      // Check player hostility based on Red Meter rules
      let highestThreatPlayer: PlayerState | null = null;
      let minThreatDist = 12.0;

      for (const player of this.players.values()) {
        if (player.isKnockedOut) continue;

        const dx = player.pos.x - npc.pos.x;
        const dz = player.pos.z - npc.pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Hostility Rule Check:
        // Red Meter >= 7: Universal hostility against that player
        // Red Meter >= 5: Hostile if player attacked this NPC's faction
        const isFactionHostile = player.redMeter >= RED_METER_THRESHOLDS.FACTION_RETALIATION && player.attackedFactions.includes(npc.faction);
        const isUniversalHostile = player.redMeter >= RED_METER_THRESHOLDS.UNIVERSAL_HOSTILITY;

        if ((isFactionHostile || isUniversalHostile) && dist < minThreatDist) {
          minThreatDist = dist;
          highestThreatPlayer = player;
        }
      }

      if (highestThreatPlayer) {
        // Attack / Chase threat
        npc.state = 'attack';
        npc.targetPlayerId = highestThreatPlayer.id;

        const dx = highestThreatPlayer.pos.x - npc.pos.x;
        const dz = highestThreatPlayer.pos.z - npc.pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 1.2) {
          npc.yaw = Math.atan2(dx, dz);
          npc.pos.x += (dx / dist) * (NPC_WALK_SPEED * 1.5) * delta;
          npc.pos.z += (dz / dist) * (NPC_WALK_SPEED * 1.5) * delta;
        } else {
          // Melee attack player
          highestThreatPlayer.health -= 12 * delta;
          if (highestThreatPlayer.health <= 0) {
            highestThreatPlayer.health = 0;
            highestThreatPlayer.isKnockedOut = true;
          }
        }
      } else {
        // Normal patrol routine
        npc.state = 'patrol';
        npc.targetPlayerId = null;
        npc.yaw += (Math.random() - 0.5) * 0.8 * delta;
        npc.pos.x += Math.sin(npc.yaw) * NPC_WALK_SPEED * 0.5 * delta;
        npc.pos.z += Math.cos(npc.yaw) * NPC_WALK_SPEED * 0.5 * delta;
      }

      // Bounds
      const half = TOWN_SIZE / 2 - 4;
      npc.pos.x = Math.max(-half, Math.min(half, npc.pos.x));
      npc.pos.z = Math.max(-half, Math.min(half, npc.pos.z));
    }
  }

  public handlePlayerInput(clientId: string, pos: Vector3D, yaw: number, pitch: number, isMoving: boolean, isSprinting: boolean) {
    const player = this.players.get(clientId);
    if (!player || player.isKnockedOut || this.status !== 'playing') return;

    // Movement validation: ensure player stays within town boundaries
    const half = TOWN_SIZE / 2 - 1.5;
    player.pos.x = Math.max(-half, Math.min(half, pos.x));
    player.pos.y = Math.max(1.0, Math.min(10.0, pos.y));
    player.pos.z = Math.max(-half, Math.min(half, pos.z));
    player.yaw = yaw;
    player.pitch = pitch;
  }

  public handlePlayerAttack(clientId: string) {
    const player = this.players.get(clientId);
    if (!player || player.isKnockedOut || this.status !== 'playing') return;

    // RULE: Genuine-key carrier cannot use weapons or attack!
    if (player.hasGenuineKey) {
      return;
    }

    const reach = MELEE_ATTACK_DISTANCE + 0.6;

    // 1. Check Roosters
    for (const rooster of this.roosters.values()) {
      if (rooster.isKnockedOut) continue;
      const dx = rooster.pos.x - player.pos.x;
      const dz = rooster.pos.z - player.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= reach) {
        rooster.health -= MELEE_DAMAGE;
        if (rooster.health <= 0) {
          rooster.health = 0;
          rooster.isKnockedOut = true;

          // Drop key as a World Pickup
          if (rooster.carriedKeyId) {
            const key = this.keys.get(rooster.carriedKeyId);
            if (key) {
              const pickupId = `pickup_${key.id}`;
              this.pickups.set(pickupId, {
                id: pickupId,
                type: 'key',
                name: key.isGenuine ? `Genuine Key (House #${key.targetHouseId + 1})` : `Decoy Key`,
                pos: { x: rooster.pos.x, y: 0.5, z: rooster.pos.z },
                keyId: key.id,
                isGenuineKey: key.isGenuine,
                targetHouseId: key.targetHouseId
              });
              key.carriedByRoosterId = null;
              rooster.carriedKeyId = null;
            }
          }
        }
        return; // Attack handled
      }
    }

    // 2. Check NPCs (Wrongful kill tracking -> Red Meter)
    for (const npc of this.npcs.values()) {
      if (npc.health <= 0) continue;
      const dx = npc.pos.x - player.pos.x;
      const dz = npc.pos.z - player.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= reach) {
        npc.health -= MELEE_DAMAGE;
        if (npc.health <= 0) {
          npc.health = 0;

          // Wrongful kill! Increment Red Meter exactly once
          player.redMeter = Math.min(RED_METER_THRESHOLDS.GAME_OVER, player.redMeter + 1);
          if (!player.attackedFactions.includes(npc.faction)) {
            player.attackedFactions.push(npc.faction);
          }

          this.broadcast({
            type: 'red_meter_alert',
            level: player.redMeter,
            message: `${player.name} committed violence against a ${npc.faction}! Red Meter: ${player.redMeter}/8`
          });

          // Red Meter 8 = Automatic Match Disqualification!
          if (player.redMeter >= RED_METER_THRESHOLDS.GAME_OVER) {
            player.isKnockedOut = true;
            this.broadcast({
              type: 'match_over',
              winnerId: '',
              winnerName: 'Law & Order',
              reason: `${player.name} reached Red Meter 8 and was permanently disqualified!`
            });
            this.status = 'ended';
          }
        }
        return;
      }
    }

    // 3. Check other players
    for (const other of this.players.values()) {
      if (other.id === player.id || other.isKnockedOut) continue;
      const dx = other.pos.x - player.pos.x;
      const dz = other.pos.z - player.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= reach) {
        other.health -= MELEE_DAMAGE;
        if (other.health <= 0) {
          other.health = 0;
          other.isKnockedOut = true;
          // Drop player inventory items
          this.dropPlayerInventory(other);
        }
        return;
      }
    }
  }

  public handlePlayerInteract(clientId: string, targetType: 'pickup' | 'door', targetId: string) {
    const player = this.players.get(clientId);
    if (!player || player.isKnockedOut || this.status !== 'playing') return;

    if (targetType === 'pickup') {
      const pickup = this.pickups.get(targetId);
      if (!pickup) return;

      const dx = pickup.pos.x - player.pos.x;
      const dz = pickup.pos.z - player.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= INTERACTION_DISTANCE + 1.0) {
        // Collect pickup
        this.pickups.delete(targetId);

        if (pickup.type === 'key' && pickup.keyId) {
          const key = this.keys.get(pickup.keyId);
          if (!key) return;
          key.carriedByPlayerId = player.id;

          if (key.isGenuine) {
            // EXECUTE COMPLETE GENUINE-KEY SEQUENCE:
            // Step 1: Dramatic collapse
            // Step 2: Drop all weapons/gadgets at collapse location
            // Step 3: Memory loss + cryptic riddle based on observable landmarks
            // Step 4: Subtle smiling face
            // Step 5: Unarmed escape phase
            player.hasGenuineKey = true;
            player.hasMemoryLoss = true;
            player.isSmiling = true;

            // Drop all other items from inventory
            this.dropPlayerInventory(player, true);

            // Put genuine key in inventory slot 0
            player.inventory[0] = {
              id: key.id,
              type: 'key',
              name: `Genuine Key (House #${key.targetHouseId + 1})`,
              keyId: key.id,
              isGenuineKey: true,
              targetHouseId: key.targetHouseId
            };

            // Riddle pointing to assigned house
            const houseDef = HOUSES[player.assignedHouse];
            player.riddle = houseDef.riddleClue;

            // Notify player of collapse & riddle
            this.sendTo(player.id, {
              type: 'collapse_event',
              riddle: player.riddle
            });
          } else {
            // Decoy key: player keeps hunting! No collapse, no memory loss
            player.inventory[1] = {
              id: key.id,
              type: 'key',
              name: 'Decoy Key',
              keyId: key.id,
              isGenuineKey: false,
              targetHouseId: key.targetHouseId
            };
          }
        } else {
          // Normal weapon/item pickup
          for (let i = 1; i < player.inventory.length; i++) {
            if (!player.inventory[i]) {
              player.inventory[i] = {
                id: pickup.id,
                type: pickup.type,
                name: pickup.name
              };
              break;
            }
          }
        }
      }
    } else if (targetType === 'door') {
      // Check house unlocking
      // Format: house_0, house_1, house_2, house_3
      const houseIdStr = targetId.replace('house_', '');
      const houseId = parseInt(houseIdStr, 10);
      const house = HOUSES[houseId];
      if (!house) return;

      const doorPos = { x: house.doorPos.x, y: 1.5, z: house.doorPos.z + 5 };
      const dx = doorPos.x - player.pos.x;
      const dz = doorPos.z - player.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= INTERACTION_DISTANCE + 1.5) {
        // Authoritative Win Check:
        // 1. Must carry genuine key
        // 2. Key must match target house
        // 3. House must be player's assigned house
        const carriedKeyItem = player.inventory.find((item) => item?.type === 'key' && item.isGenuineKey);

        if (carriedKeyItem && carriedKeyItem.targetHouseId === houseId && player.assignedHouse === houseId) {
          // VALID VICTORY!
          this.status = 'ended';
          this.winnerId = player.id;
          this.winnerName = player.name;

          this.broadcast({
            type: 'match_over',
            winnerId: player.id,
            winnerName: player.name,
            reason: `${player.name} solved their riddle and unlocked ${house.name} with the genuine key!`
          });
        }
      }
    }
  }

  private dropPlayerInventory(player: PlayerState, keepGenuineKey: boolean = false) {
    player.inventory.forEach((item, slotIndex) => {
      if (!item) return;
      if (keepGenuineKey && item.type === 'key' && item.isGenuineKey) {
        return; // Retain genuine key
      }

      // Spawn world pickup at collapse location
      const pickupId = `dropped_${item.id}_${Date.now()}`;
      const dropPos: Vector3D = {
        x: player.pos.x + (Math.random() - 0.5) * 1.5,
        y: 0.4,
        z: player.pos.z + (Math.random() - 0.5) * 1.5
      };

      this.pickups.set(pickupId, {
        id: pickupId,
        type: item.type,
        name: item.name,
        pos: dropPos,
        keyId: item.keyId,
        isGenuineKey: item.isGenuineKey,
        targetHouseId: item.targetHouseId
      });

      player.inventory[slotIndex] = null;
    });

    if (!keepGenuineKey) {
      player.hasGenuineKey = false;
    }
  }

  public broadcastSnapshot() {
    const playersObj: Record<string, PlayerState> = {};
    for (const [id, p] of this.players.entries()) {
      playersObj[id] = p;
    }

    const roostersObj: Record<string, RoosterState> = {};
    for (const [id, r] of this.roosters.entries()) {
      roostersObj[id] = r;
    }

    const npcsObj: Record<string, NpcState> = {};
    for (const [id, n] of this.npcs.entries()) {
      npcsObj[id] = n;
    }

    const pickupsObj: Record<string, WorldPickup> = {};
    for (const [id, pick] of this.pickups.entries()) {
      pickupsObj[id] = pick;
    }

    const snapshot: GameSnapshot = {
      timestamp: Date.now(),
      status: this.status,
      timerSeconds: Math.max(0, Math.ceil(this.timerSeconds)),
      isOvertime: this.isOvertime,
      players: playersObj,
      roosters: roostersObj,
      npcs: npcsObj,
      pickups: pickupsObj,
      winnerId: this.winnerId,
      winnerName: this.winnerName
    };

    const msg: ServerMessage = {
      type: 'game_snapshot',
      snapshot
    };

    this.broadcast(msg);
  }
}
