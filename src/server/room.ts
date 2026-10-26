import {
  HOUSES,
  INTERACTION_DISTANCE,
  MATCH_DURATION_SECONDS,
  NPC_FACTIONS,
  NPC_RUN_SPEED,
  NPC_WALK_SPEED,
  PLAYER_ROLES,
  RED_METER_THRESHOLDS,
  ROOSTER_FLEE_SPEED,
  ROOSTER_WALK_SPEED,
  TOWN_SIZE,
  WEAPON_STATS
} from '../shared/constants.ts';
import type {
  BulletTrace,
  ClientMessage,
  GameSnapshot,
  ItemType,
  KeyItemState,
  NpcActivity,
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
  public recentBulletTraces: BulletTrace[] = [];

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
      const assignedHouse = index % 4;

      const spawnX = (index - clientArr.length / 2) * 6;
      const spawnZ = 12 + index * 4;

      const playerState: PlayerState = {
        id: c.id,
        name: c.name,
        role,
        pos: { x: spawnX, y: 0, z: spawnZ },
        yaw: 0,
        pitch: 0,
        health: 100,
        maxHealth: 100,
        isKnockedOut: false,
        isCrouching: false,
        isAiming: false,
        assignedHouse,
        redMeter: 0,
        attackedFactions: [],
        inventory: [
          { id: `fists_${c.id}`, type: 'fists', name: 'Fists' },
          { id: `knife_${c.id}`, type: 'knife', name: 'Tactical Knife' },
          null,
          null
        ],
        activeSlot: 1, // Start with knife drawn
        hasGenuineKey: false,
        hasMemoryLoss: false,
        riddle: null,
        isSmiling: false,
        isHost: c.isHost,
        connected: true
      };

      this.players.set(c.id, playerState);

      this.sendTo(c.id, {
        type: 'match_started',
        assignedRole: role,
        assignedHouse
      });
    });

    // 2. Initialize 8 Roosters and 8 Keys across the large map
    this.roosters.clear();
    this.keys.clear();
    this.pickups.clear();

    for (let i = 0; i < 8; i++) {
      const keyId = `key_${i}`;
      const isGenuine = i < 4; // 4 genuine, 4 decoy
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
      const dist = 35 + (i % 3) * 20;
      const rx = Math.cos(angle) * dist;
      const rz = Math.sin(angle) * dist;

      const roosterState: RoosterState = {
        id: `rooster_${i}`,
        pos: { x: rx, y: 0, z: rz },
        yaw: angle + Math.PI,
        health: 50,
        maxHealth: 50,
        isKnockedOut: false,
        carriedKeyId: keyId
      };
      this.roosters.set(roosterState.id, roosterState);
    }

    // 3. Populate Crowds with 40 NPCs across 6 factions and real city activities
    this.npcs.clear();
    const activities: NpcActivity[] = ['sit', 'chat', 'patrol', 'walk'];

    for (let i = 0; i < 40; i++) {
      const faction = NPC_FACTIONS[i % NPC_FACTIONS.length];
      const activity = activities[i % activities.length];

      const angle = (i / 40) * Math.PI * 2 + 0.15;
      const dist = 15 + (i % 6) * 16;
      const nx = Math.cos(angle) * dist;
      const nz = Math.sin(angle) * dist;

      const npc: NpcState = {
        id: `npc_${i}`,
        faction,
        name: `${faction.charAt(0).toUpperCase() + faction.slice(1)} ${i + 1}`,
        pos: { x: nx, y: 0, z: nz },
        yaw: angle,
        health: 80,
        maxHealth: 80,
        state: activity === 'sit' ? 'sitting' : (activity === 'chat' ? 'chatting' : 'patrol'),
        activity,
        targetPlayerId: null
      };
      this.npcs.set(npc.id, npc);
    }

    // 4. Spawn scavenged weapons (Knives, Semi-Auto Pistols, Bandages)
    this.spawnScavengedWeapons();

    // Start 20Hz Tick
    this.startTick();
    return true;
  }

  private spawnScavengedWeapons() {
    const weaponSpots: { type: ItemType; name: string; ammo?: number; pos: Vector3D }[] = [
      // Pistols with full 12 round magazines in alleys & cars
      { type: 'pistol', name: '9mm Semi-Auto Pistol', ammo: 12, pos: { x: -35, y: 0.3, z: -33 } },
      { type: 'pistol', name: '9mm Semi-Auto Pistol', ammo: 12, pos: { x: 35, y: 0.3, z: 37 } },
      { type: 'pistol', name: '9mm Tactical Pistol', ammo: 12, pos: { x: 0, y: 0.3, z: 70 } },
      // Tactical Knives in ambush corners
      { type: 'knife', name: 'Tactical Combat Knife', pos: { x: -37, y: 0.3, z: 35 } },
      { type: 'knife', name: 'Serrated Trench Knife', pos: { x: 37, y: 0.3, z: -35 } },
      // First Aid Kits
      { type: 'bandage', name: 'Military Medical Kit', pos: { x: -75, y: 0.3, z: -8 } },
      { type: 'bandage', name: 'Trauma First Aid Kit', pos: { x: 75, y: 0.3, z: -8 } }
    ];

    weaponSpots.forEach((spot, idx) => {
      const pickupId = `pickup_loot_${idx}`;
      this.pickups.set(pickupId, {
        id: pickupId,
        type: spot.type,
        name: spot.name,
        ammo: spot.ammo,
        pos: spot.pos
      });
    });
  }

  private startTick() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.lastTickTime = Date.now();

    this.tickInterval = setInterval(() => {
      this.tick();
    }, 50); // 20 Hz
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

    this.timerSeconds -= delta;
    if (this.timerSeconds <= 0) {
      if (!this.isOvertime) {
        this.isOvertime = true;
        this.timerSeconds = 120; // 2 minutes Sudden Death
      } else {
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

    // AI Updates
    this.updateRoosters(delta);
    this.updateNpcs(delta);

    // Broadcast snapshot
    this.broadcastSnapshot();
    this.recentBulletTraces = [];
  }

  private updateRoosters(delta: number) {
    const speed = this.isOvertime ? ROOSTER_FLEE_SPEED * 1.25 : ROOSTER_FLEE_SPEED;

    for (const rooster of this.roosters.values()) {
      if (rooster.isKnockedOut) continue;

      let nearestDist = 999;
      let fleeDirX = 0;
      let fleeDirZ = 0;

      for (const player of this.players.values()) {
        if (player.isKnockedOut) continue;
        const dx = rooster.pos.x - player.pos.x;
        const dz = rooster.pos.z - player.pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 8.0 && dist < nearestDist) {
          nearestDist = dist;
          fleeDirX = dx / (dist || 1);
          fleeDirZ = dz / (dist || 1);
        }
      }

      if (nearestDist < 8.0) {
        // Fleeing
        rooster.pos.x += fleeDirX * speed * delta;
        rooster.pos.z += fleeDirZ * speed * delta;
        rooster.yaw = Math.atan2(fleeDirX, fleeDirZ);
      } else {
        // Organic wander
        rooster.yaw += (Math.random() - 0.5) * 1.6 * delta;
        rooster.pos.x += Math.sin(rooster.yaw) * ROOSTER_WALK_SPEED * 0.4 * delta;
        rooster.pos.z += Math.cos(rooster.yaw) * ROOSTER_WALK_SPEED * 0.4 * delta;
      }

      const half = TOWN_SIZE / 2 - 6;
      rooster.pos.x = Math.max(-half, Math.min(half, rooster.pos.x));
      rooster.pos.z = Math.max(-half, Math.min(half, rooster.pos.z));
    }
  }

  private updateNpcs(delta: number) {
    for (const npc of this.npcs.values()) {
      if (npc.health <= 0) continue;

      // Hostility check
      let targetPlayer: PlayerState | null = null;
      let minThreatDist = 18.0;

      for (const player of this.players.values()) {
        if (player.isKnockedOut) continue;

        const dx = player.pos.x - npc.pos.x;
        const dz = player.pos.z - npc.pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        const isFactionHostile = player.redMeter >= RED_METER_THRESHOLDS.FACTION_RETALIATION && player.attackedFactions.includes(npc.faction);
        const isUniversalHostile = player.redMeter >= RED_METER_THRESHOLDS.UNIVERSAL_HOSTILITY;

        if ((isFactionHostile || isUniversalHostile) && dist < minThreatDist) {
          minThreatDist = dist;
          targetPlayer = player;
        }
      }

      if (targetPlayer) {
        // Attack Threat Player
        npc.state = 'attack';
        npc.targetPlayerId = targetPlayer.id;

        const dx = targetPlayer.pos.x - npc.pos.x;
        const dz = targetPlayer.pos.z - npc.pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 1.4) {
          npc.yaw = Math.atan2(dx, dz);
          npc.pos.x += (dx / dist) * (NPC_WALK_SPEED * 1.6) * delta;
          npc.pos.z += (dz / dist) * (NPC_WALK_SPEED * 1.6) * delta;
        } else {
          // Melee attack player
          targetPlayer.health -= 14 * delta;
          if (targetPlayer.health <= 0) {
            targetPlayer.health = 0;
            targetPlayer.isKnockedOut = true;
          }
        }
      } else {
        // City activities
        if (npc.activity === 'patrol' || npc.activity === 'walk') {
          npc.state = 'patrol';
          npc.yaw += (Math.random() - 0.5) * 0.7 * delta;
          npc.pos.x += Math.sin(npc.yaw) * NPC_WALK_SPEED * 0.5 * delta;
          npc.pos.z += Math.cos(npc.yaw) * NPC_WALK_SPEED * 0.5 * delta;
        } else if (npc.activity === 'sit') {
          npc.state = 'sitting';
        } else if (npc.activity === 'chat') {
          npc.state = 'chatting';
          npc.yaw += Math.sin(Date.now() * 0.002) * 0.02;
        }
      }

      const half = TOWN_SIZE / 2 - 6;
      npc.pos.x = Math.max(-half, Math.min(half, npc.pos.x));
      npc.pos.z = Math.max(-half, Math.min(half, npc.pos.z));
    }
  }

  public handlePlayerInput(clientId: string, pos: Vector3D, yaw: number, pitch: number, isMoving: boolean, isSprinting: boolean, isCrouching: boolean, isAiming: boolean) {
    const player = this.players.get(clientId);
    if (!player || player.isKnockedOut || this.status !== 'playing') return;

    const half = TOWN_SIZE / 2 - 2;
    player.pos.x = Math.max(-half, Math.min(half, pos.x));
    player.pos.y = Math.max(0, Math.min(10.0, pos.y));
    player.pos.z = Math.max(-half, Math.min(half, pos.z));
    player.yaw = yaw;
    player.pitch = pitch;
    player.isCrouching = isCrouching;
    player.isAiming = isAiming;
  }

  public handlePlayerAttack(clientId: string, aimOrigin?: Vector3D, aimDirection?: Vector3D) {
    const player = this.players.get(clientId);
    if (!player || player.isKnockedOut || this.status !== 'playing') return;

    // RULE: Genuine-key carrier cannot use weapons or attack
    if (player.hasGenuineKey) {
      return;
    }

    const currentItem = player.inventory[player.activeSlot];
    const weaponType: ItemType = currentItem ? currentItem.type : 'fists';

    if (weaponType === 'pistol') {
      // Fire Handgun
      if (!currentItem?.ammo || currentItem.ammo <= 0) {
        return; // Empty magazine
      }
      currentItem.ammo--;

      // Origin & Direction
      const origin = aimOrigin || { x: player.pos.x, y: player.pos.y + 1.6, z: player.pos.z };
      const dirX = aimDirection ? aimDirection.x : Math.sin(player.yaw) * Math.cos(player.pitch);
      const dirY = aimDirection ? aimDirection.y : -Math.sin(player.pitch);
      const dirZ = aimDirection ? aimDirection.z : Math.cos(player.yaw) * Math.cos(player.pitch);

      this.broadcast({
        type: 'gunshot_event',
        shooterId: player.id,
        pos: origin
      });

      // Raycast against roosters, NPCs, and players
      let hitSomething = false;
      let hitTargetPos = {
        x: origin.x + dirX * WEAPON_STATS.pistol.range,
        y: origin.y + dirY * WEAPON_STATS.pistol.range,
        z: origin.z + dirZ * WEAPON_STATS.pistol.range
      };

      // 1. Roosters
      for (const rooster of this.roosters.values()) {
        if (rooster.isKnockedOut) continue;
        const dx = rooster.pos.x - origin.x;
        const dz = rooster.pos.z - origin.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Check angle
        const angleToTarget = Math.atan2(dx, dz);
        const diff = Math.abs(angleToTarget - player.yaw);
        if (dist <= WEAPON_STATS.pistol.range && (diff < 0.25 || diff > Math.PI * 2 - 0.25)) {
          rooster.health -= WEAPON_STATS.pistol.damage;
          hitSomething = true;
          hitTargetPos = { x: rooster.pos.x, y: rooster.pos.y + 0.5, z: rooster.pos.z };

          if (rooster.health <= 0) {
            rooster.health = 0;
            rooster.isKnockedOut = true;
            this.dropRoosterKey(rooster);
          }
          break;
        }
      }

      // 2. NPCs (if no rooster hit)
      if (!hitSomething) {
        for (const npc of this.npcs.values()) {
          if (npc.health <= 0) continue;
          const dx = npc.pos.x - origin.x;
          const dz = npc.pos.z - origin.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const angleToTarget = Math.atan2(dx, dz);
          const diff = Math.abs(angleToTarget - player.yaw);

          if (dist <= WEAPON_STATS.pistol.range && (diff < 0.25 || diff > Math.PI * 2 - 0.25)) {
            npc.health -= WEAPON_STATS.pistol.damage;
            hitSomething = true;
            hitTargetPos = { x: npc.pos.x, y: npc.pos.y + 1.2, z: npc.pos.z };

            if (npc.health <= 0) {
              npc.health = 0;
              this.applyWrongfulKill(player, npc.faction);
            }
            break;
          }
        }
      }

      // 3. Other Players
      if (!hitSomething) {
        for (const other of this.players.values()) {
          if (other.id === player.id || other.isKnockedOut) continue;
          const dx = other.pos.x - origin.x;
          const dz = other.pos.z - origin.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const angleToTarget = Math.atan2(dx, dz);
          const diff = Math.abs(angleToTarget - player.yaw);

          if (dist <= WEAPON_STATS.pistol.range && (diff < 0.25 || diff > Math.PI * 2 - 0.25)) {
            other.health -= WEAPON_STATS.pistol.damage;
            hitSomething = true;
            hitTargetPos = { x: other.pos.x, y: other.pos.y + 1.2, z: other.pos.z };

            if (other.health <= 0) {
              other.health = 0;
              other.isKnockedOut = true;
              this.dropPlayerInventory(other);
            }
            break;
          }
        }
      }

      this.recentBulletTraces.push({
        id: `bullet_${Date.now()}_${Math.random()}`,
        origin,
        target: hitTargetPos,
        hit: hitSomething
      });
      return;
    }

    // Melee: Knife or Fists
    const reach = (weaponType === 'knife') ? WEAPON_STATS.knife.range : WEAPON_STATS.fists.range;
    let baseDamage = (weaponType === 'knife') ? WEAPON_STATS.knife.damage : WEAPON_STATS.fists.damage;

    // Check Roosters
    for (const rooster of this.roosters.values()) {
      if (rooster.isKnockedOut) continue;
      const dx = rooster.pos.x - player.pos.x;
      const dz = rooster.pos.z - player.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= reach + 0.6) {
        rooster.health -= baseDamage;
        if (rooster.health <= 0) {
          rooster.health = 0;
          rooster.isKnockedOut = true;
          this.dropRoosterKey(rooster);
        }
        return;
      }
    }

    // Check NPCs
    for (const npc of this.npcs.values()) {
      if (npc.health <= 0) continue;
      const dx = npc.pos.x - player.pos.x;
      const dz = npc.pos.z - player.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= reach + 0.6) {
        // Ambush Backstab bonus: if player is crouching or attacking from behind
        let damage = baseDamage;
        if (weaponType === 'knife' && player.isCrouching) {
          damage = WEAPON_STATS.knife.backstabDamage;
        }

        npc.health -= damage;
        if (npc.health <= 0) {
          npc.health = 0;
          this.applyWrongfulKill(player, npc.faction);
        }
        return;
      }
    }

    // Check other players
    for (const other of this.players.values()) {
      if (other.id === player.id || other.isKnockedOut) continue;
      const dx = other.pos.x - player.pos.x;
      const dz = other.pos.z - player.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= reach + 0.6) {
        let damage = baseDamage;
        if (weaponType === 'knife' && player.isCrouching) {
          damage = WEAPON_STATS.knife.backstabDamage;
        }
        other.health -= damage;
        if (other.health <= 0) {
          other.health = 0;
          other.isKnockedOut = true;
          this.dropPlayerInventory(other);
        }
        return;
      }
    }
  }

  private dropRoosterKey(rooster: RoosterState) {
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

  private applyWrongfulKill(player: PlayerState, faction: NpcFaction) {
    player.redMeter = Math.min(RED_METER_THRESHOLDS.GAME_OVER, player.redMeter + 1);
    if (!player.attackedFactions.includes(faction)) {
      player.attackedFactions.push(faction);
    }

    this.broadcast({
      type: 'red_meter_alert',
      level: player.redMeter,
      message: `${player.name} committed murder against a ${faction}! Red Meter: ${player.redMeter}/8`
    });

    if (player.redMeter >= RED_METER_THRESHOLDS.GAME_OVER) {
      player.isKnockedOut = true;
      this.broadcast({
        type: 'match_over',
        winnerId: '',
        winnerName: 'City Law Enforcement',
        reason: `${player.name} reached Red Meter 8 and was eliminated by SWAT!`
      });
      this.status = 'ended';
    }
  }

  public handlePlayerReload(clientId: string) {
    const player = this.players.get(clientId);
    if (!player || player.isKnockedOut || this.status !== 'playing') return;

    const currentItem = player.inventory[player.activeSlot];
    if (currentItem && currentItem.type === 'pistol') {
      currentItem.ammo = WEAPON_STATS.pistol.magSize;
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

      if (dist <= INTERACTION_DISTANCE + 1.5) {
        this.pickups.delete(targetId);

        if (pickup.type === 'key' && pickup.keyId) {
          const key = this.keys.get(pickup.keyId);
          if (!key) return;
          key.carriedByPlayerId = player.id;

          if (key.isGenuine) {
            // COMPLETE GENUINE-KEY SEQUENCE:
            player.hasGenuineKey = true;
            player.hasMemoryLoss = true;
            player.isSmiling = true;

            // Drop all weapons and gear at coordinates
            this.dropPlayerInventory(player, true);

            player.inventory[0] = {
              id: key.id,
              type: 'key',
              name: `Genuine Key (House #${key.targetHouseId + 1})`,
              keyId: key.id,
              isGenuineKey: true,
              targetHouseId: key.targetHouseId
            };
            player.activeSlot = 0;

            const houseDef = HOUSES[player.assignedHouse];
            player.riddle = houseDef.riddleClue;

            this.sendTo(player.id, {
              type: 'collapse_event',
              riddle: player.riddle
            });
          } else {
            // Decoy key: continue hunting
            player.inventory[3] = {
              id: key.id,
              type: 'key',
              name: 'Decoy Key',
              keyId: key.id,
              isGenuineKey: false,
              targetHouseId: key.targetHouseId
            };
          }
        } else {
          // Weapon / Ammo pickup
          for (let i = 1; i < player.inventory.length; i++) {
            if (!player.inventory[i]) {
              player.inventory[i] = {
                id: pickup.id,
                type: pickup.type,
                name: pickup.name,
                ammo: pickup.ammo,
                maxAmmo: 12
              };
              player.activeSlot = i;
              break;
            }
          }
        }
      }
    } else if (targetType === 'door') {
      const houseIdStr = targetId.replace('house_', '');
      const houseId = parseInt(houseIdStr, 10);
      const house = HOUSES[houseId];
      if (!house) return;

      const doorPos = { x: house.doorPos.x, y: 1.5, z: house.doorPos.z + 10 };
      const dx = doorPos.x - player.pos.x;
      const dz = doorPos.z - player.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= INTERACTION_DISTANCE + 2.5) {
        const carriedKey = player.inventory.find((item) => item?.type === 'key' && item.isGenuineKey);

        if (carriedKey && carriedKey.targetHouseId === houseId && player.assignedHouse === houseId) {
          // VALID WIN!
          this.status = 'ended';
          this.winnerId = player.id;
          this.winnerName = player.name;

          this.broadcast({
            type: 'match_over',
            winnerId: player.id,
            winnerName: player.name,
            reason: `${player.name} cracked the riddle and unlocked ${house.name} with the genuine key!`
          });
        }
      }
    }
  }

  public handleDropItem(clientId: string, slotIndex: number) {
    const player = this.players.get(clientId);
    if (!player || player.isKnockedOut || this.status !== 'playing') return;

    const item = player.inventory[slotIndex];
    if (!item || item.type === 'fists') return;

    // Drop item onto ground
    const pickupId = `drop_${item.id}_${Date.now()}`;
    this.pickups.set(pickupId, {
      id: pickupId,
      type: item.type,
      name: item.name,
      ammo: item.ammo,
      pos: { x: player.pos.x, y: 0.4, z: player.pos.z },
      keyId: item.keyId,
      isGenuineKey: item.isGenuineKey,
      targetHouseId: item.targetHouseId
    });

    player.inventory[slotIndex] = null;
    player.activeSlot = 0; // Fall back to fists
  }

  public handleSelectSlot(clientId: string, slotIndex: number) {
    const player = this.players.get(clientId);
    if (!player || player.isKnockedOut) return;

    if (slotIndex >= 0 && slotIndex < player.inventory.length) {
      player.activeSlot = slotIndex;
    }
  }

  private dropPlayerInventory(player: PlayerState, keepGenuineKey: boolean = false) {
    player.inventory.forEach((item, slotIndex) => {
      if (!item || item.type === 'fists') return;
      if (keepGenuineKey && item.type === 'key' && item.isGenuineKey) return;

      const pickupId = `dropped_${item.id}_${Date.now()}`;
      this.pickups.set(pickupId, {
        id: pickupId,
        type: item.type,
        name: item.name,
        ammo: item.ammo,
        pos: {
          x: player.pos.x + (Math.random() - 0.5) * 2,
          y: 0.4,
          z: player.pos.z + (Math.random() - 0.5) * 2
        },
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
      bulletTraces: this.recentBulletTraces,
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
