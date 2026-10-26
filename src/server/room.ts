import {
  checkObstacleCollision,
  getAccurateHouseRiddle,
  getTerrainHeight,
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

  // NPC group metadata: pair partner IDs, waypoint targets
  private npcTargets: Map<string, { x: number; z: number }> = new Map();
  private roosterTwitchTimers: Map<string, number> = new Map();

  // Match timing
  public timerSeconds: number = MATCH_DURATION_SECONDS;
  public isOvertime: boolean = false;
  public winnerId: string | null = null;
  public winnerName: string | null = null;

  private tickInterval: NodeJS.Timeout | null = null;
  private lastTickTime: number = Date.now();

  constructor(roomCode: string) {
    this.roomCode = roomCode;
    this.initWorldEntities();
  }

  public initWorldEntities() {
    // 1. Initialize 8 Roosters and 8 Keys across the town
    this.roosters.clear();
    this.keys.clear();
    this.pickups.clear();
    this.roosterTwitchTimers.clear();

    for (let i = 0; i < 8; i++) {
      const keyId = `key_${i}`;
      const isGenuine = i < 4;
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
      const dist = 32 + (i % 3) * 18;
      let rx = Math.cos(angle) * dist;
      let rz = Math.sin(angle) * dist;

      if (checkObstacleCollision(rx, rz, 0.6)) {
        rx += 4;
        rz += 4;
      }

      const roosterState: RoosterState = {
        id: `rooster_${i}`,
        pos: { x: rx, y: getTerrainHeight(rx, rz), z: rz },
        yaw: Math.random() * Math.PI * 2,
        health: 50,
        maxHealth: 50,
        isKnockedOut: false,
        carriedKeyId: keyId
      };
      this.roosters.set(roosterState.id, roosterState);
      this.roosterTwitchTimers.set(roosterState.id, Math.random() * 1.5);
    }

    // 2. Populate 40 NPCs in Real City Sets: Pairs, Conversational Circles, Runners, Sitters
    this.npcs.clear();
    this.npcTargets.clear();

    for (let i = 0; i < 40; i++) {
      const faction = NPC_FACTIONS[i % NPC_FACTIONS.length];
      let activity: NpcActivity = 'walk';
      let nx = 0;
      let nz = 0;
      let yaw = Math.random() * Math.PI * 2;
      let ny = 0;

      if (i < 12) {
        // Pairs / Duos walking side by side
        const pairIndex = Math.floor(i / 2);
        const isSecondOfPair = (i % 2 === 1);
        const avenueCoord = -60 + pairIndex * 24;
        nx = isSecondOfPair ? 10.5 : 8.5; // Walking down the eastern sidewalk
        nz = avenueCoord;
        activity = 'walk';
        yaw = 0; // Walking south
        this.npcTargets.set(`npc_${i}`, { x: nx, z: 80 });
      } else if (i < 20) {
        // Conversational circles in Central Plaza and outside Bistro
        const circleGroup = i < 16 ? 0 : 1;
        const center = circleGroup === 0 ? { x: 0, z: 12 } : { x: 0, z: -62 };
        const circleAngle = ((i % 4) / 4) * Math.PI * 2;
        nx = center.x + Math.cos(circleAngle) * 2.2;
        nz = center.z + Math.sin(circleAngle) * 2.2;
        yaw = circleAngle + Math.PI; // Facing inward to talk
        activity = 'chat';
      } else if (i < 26) {
        // Sitting citizens on park benches (bench height y = 0.45)
        const benchSpots = [
          { x: -12, z: 20 }, { x: 12, z: 20 },
          { x: -12, z: 30 }, { x: 12, z: 30 },
          { x: -45, z: -45 }, { x: 45, z: 45 }
        ];
        const spot = benchSpots[i - 20];
        nx = spot.x;
        nz = spot.z;
        ny = 0.45;
        activity = 'sit';
      } else if (i < 30) {
        // Athletic Joggers / Runners
        const runnerOffset = (i - 26) * 30;
        nx = -9.5;
        nz = -40 + runnerOffset;
        activity = 'patrol'; // Runs fast
        this.npcTargets.set(`npc_${i}`, { x: -9.5, z: 90 });
      } else {
        // Purposeful solo walkers traversing town
        const angle = ((i - 30) / 10) * Math.PI * 2;
        nx = Math.cos(angle) * 45;
        nz = Math.sin(angle) * 45;
        activity = 'walk';
        this.npcTargets.set(`npc_${i}`, { x: -nx, z: -nz });
      }

      if (checkObstacleCollision(nx, nz, 0.6)) {
        nx += 2;
        nz += 2;
      }

      ny = activity === 'sit' ? getTerrainHeight(nx, nz) + 0.45 : getTerrainHeight(nx, nz);

      const npc: NpcState = {
        id: `npc_${i}`,
        faction,
        name: `${faction.charAt(0).toUpperCase() + faction.slice(1)} ${i + 1}`,
        pos: { x: nx, y: ny, z: nz },
        yaw,
        health: 80,
        maxHealth: 80,
        state: activity === 'sit' ? 'sitting' : (activity === 'chat' ? 'chatting' : 'patrol'),
        activity,
        targetPlayerId: null
      };
      this.npcs.set(npc.id, npc);
    }

    // 3. Distribute Weapons Everywhere Across the Town
    this.spawnWeaponsEverywhere();
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
        activeSlot: 1,
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

    this.initWorldEntities();
    this.startTick();
    return true;
  }

  private spawnWeaponsEverywhere() {
    const weaponSpots: { type: ItemType; name: string; ammo?: number; pos: Vector3D }[] = [
      // 1. Inside Le Grand Bistro Restaurant (0, -75)
      { type: 'pistol', name: '9mm Semi-Auto Pistol', ammo: 12, pos: { x: 0, y: 0.8, z: -82 } },
      { type: 'knife', name: 'Chef Combat Knife', pos: { x: -6, y: 0.8, z: -82 } },
      { type: 'knife', name: 'Steak Knife', pos: { x: 7, y: 0.8, z: -77 } },

      // 2. Inside Central Hospital (-75, 0)
      { type: 'bandage', name: 'Military Medical Kit', pos: { x: -80, y: 0.8, z: 6 } },
      { type: 'knife', name: 'Serrated Scalpel Knife', pos: { x: -85, y: 0.8, z: -6 } },
      { type: 'bandage', name: 'Trauma First Aid Kit', pos: { x: -65, y: 0.8, z: 0 } },

      // 3. Inside Police HQ & Courthouse (0, 75)
      { type: 'pistol', name: '9mm Tactical Police Pistol', ammo: 12, pos: { x: 0, y: 0.8, z: 83 } },
      { type: 'bandage', name: 'Police Medical Pack', pos: { x: 2, y: 0.8, z: 72 } },
      { type: 'pistol', name: 'Officer Backup Handgun', ammo: 12, pos: { x: -4, y: 0.8, z: 83 } },

      // 4. Inside City Hall & Bank (75, 0)
      { type: 'pistol', name: '9mm Vault Pistol', ammo: 12, pos: { x: 78, y: 0.8, z: 0 } },
      { type: 'knife', name: 'Bank Guard Dagger', pos: { x: 84, y: 0.8, z: 6 } },

      // 5. On the 4 Player Estate Porches & Grounds
      { type: 'pistol', name: 'Cobalt Estate Handgun', ammo: 12, pos: { x: -80, y: 0.4, z: -73 } },
      { type: 'knife', name: 'Crimson Manor Dirk', pos: { x: 80, y: 0.4, z: -73 } },
      { type: 'knife', name: 'Emerald Hunting Knife', pos: { x: -80, y: 0.4, z: 87 } },
      { type: 'pistol', name: 'Amber Lodge Pistol', ammo: 12, pos: { x: 80, y: 0.4, z: 87 } },

      // 6. Central Plaza & Promenade
      { type: 'pistol', name: 'Fountain Stash Pistol', ammo: 12, pos: { x: 0, y: 0.4, z: 18 } },
      { type: 'bandage', name: 'Park First Aid Kit', pos: { x: -12, y: 0.6, z: 20 } },
      { type: 'knife', name: 'Bronze Monument Trench Knife', pos: { x: 50, y: 0.4, z: 46 } },
      { type: 'bandage', name: 'Cathedral Medical Pack', pos: { x: 0, y: 0.4, z: -20 } },

      // 7. Ambush Alleys & Slums
      { type: 'knife', name: 'Northwest Alley Shiv', pos: { x: -35, y: 0.4, z: -30 } },
      { type: 'pistol', name: 'Underworld Alley Pistol', ammo: 12, pos: { x: 35, y: 0.4, z: -30 } },
      { type: 'knife', name: 'Southwest Alley Stiletto', pos: { x: -35, y: 0.4, z: 40 } },
      { type: 'knife', name: 'Southeast Ambush Blade', pos: { x: 35, y: 0.4, z: 40 } }
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
    }, 50);
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
        this.timerSeconds = 120;
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

    this.updateRoosters(delta);
    this.updateNpcs(delta);

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

      let twitchTimer = (this.roosterTwitchTimers.get(rooster.id) || 1.0) - delta;
      if (twitchTimer <= 0) {
        twitchTimer = 0.5 + Math.random() * 1.2;
        rooster.yaw += (Math.random() - 0.5) * 2.8;
      }
      this.roosterTwitchTimers.set(rooster.id, twitchTimer);

      let moveX = 0;
      let moveZ = 0;

      if (nearestDist < 8.0) {
        const zigZagAngle = Math.sin(Date.now() * 0.008) * 0.7;
        const finalFleeAngle = Math.atan2(fleeDirX, fleeDirZ) + zigZagAngle;
        moveX = Math.sin(finalFleeAngle) * speed * delta;
        moveZ = Math.cos(finalFleeAngle) * speed * delta;
        rooster.yaw = finalFleeAngle;
      } else {
        moveX = -Math.sin(rooster.yaw) * ROOSTER_WALK_SPEED * delta;
        moveZ = -Math.cos(rooster.yaw) * ROOSTER_WALK_SPEED * delta;
      }

      const testX = rooster.pos.x + moveX;
      const testZ = rooster.pos.z + moveZ;

      if (!checkObstacleCollision(testX, testZ, 0.45)) {
        rooster.pos.x = testX;
        rooster.pos.z = testZ;
        rooster.pos.y = getTerrainHeight(rooster.pos.x, rooster.pos.z);
      } else {
        rooster.yaw = Math.random() * Math.PI * 2;
      }

      const half = TOWN_SIZE / 2 - 6;
      rooster.pos.x = Math.max(-half, Math.min(half, rooster.pos.x));
      rooster.pos.z = Math.max(-half, Math.min(half, rooster.pos.z));
    }
  }

  private updateNpcs(delta: number) {
    for (const npc of this.npcs.values()) {
      if (npc.health <= 0) continue;

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
        npc.state = 'attack';
        npc.targetPlayerId = targetPlayer.id;

        const dx = targetPlayer.pos.x - npc.pos.x;
        const dz = targetPlayer.pos.z - npc.pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 1.4) {
          npc.yaw = Math.atan2(dx, dz);
          const moveX = (dx / dist) * (NPC_WALK_SPEED * 1.6) * delta;
          const moveZ = (dz / dist) * (NPC_WALK_SPEED * 1.6) * delta;
          if (!checkObstacleCollision(npc.pos.x + moveX, npc.pos.z + moveZ, 0.45)) {
            npc.pos.x += moveX;
            npc.pos.z += moveZ;
          }
        } else {
          targetPlayer.health -= 14 * delta;
          if (targetPlayer.health <= 0) {
            targetPlayer.health = 0;
            targetPlayer.isKnockedOut = true;
          }
        }
      } else {
        // Purposeful Activity Updates
        if (npc.activity === 'sit') {
          npc.state = 'sitting';
        } else if (npc.activity === 'chat') {
          npc.state = 'chatting';
          npc.yaw += Math.sin(Date.now() * 0.002) * 0.015;
        } else {
          // Walkers & Runners
          const isRunner = (npc.id.endsWith('6') || npc.id.endsWith('7') || npc.id.endsWith('8') || npc.id.endsWith('9')) && npc.activity === 'patrol';
          const speed = isRunner ? NPC_RUN_SPEED : NPC_WALK_SPEED;
          npc.state = 'patrol';

          const target = this.npcTargets.get(npc.id);
          if (target) {
            const tdx = target.x - npc.pos.x;
            const tdz = target.z - npc.pos.z;
            const tdist = Math.sqrt(tdx * tdx + tdz * tdz);

            if (tdist > 2.0) {
              npc.yaw = Math.atan2(tdx, tdz) - Math.PI;
              const moveX = (tdx / tdist) * speed * delta;
              const moveZ = (tdz / tdist) * speed * delta;

              if (!checkObstacleCollision(npc.pos.x + moveX, npc.pos.z + moveZ, 0.45)) {
                npc.pos.x += moveX;
                npc.pos.z += moveZ;
              } else {
                this.npcTargets.set(npc.id, { x: -target.x, z: -target.z });
              }
            } else {
              // Reached waypoint: pick opposite route
              this.npcTargets.set(npc.id, { x: -target.x, z: -target.z });
            }
          } else {
            // General patrol
            npc.yaw += (Math.random() - 0.5) * 1.0 * delta;
            const moveX = -Math.sin(npc.yaw) * speed * delta;
            const moveZ = -Math.cos(npc.yaw) * speed * delta;

            if (!checkObstacleCollision(npc.pos.x + moveX, npc.pos.z + moveZ, 0.45)) {
              npc.pos.x += moveX;
              npc.pos.z += moveZ;
            } else {
              npc.yaw += Math.PI * 0.75;
            }
          }
        }
      }

      const half = TOWN_SIZE / 2 - 6;
      npc.pos.x = Math.max(-half, Math.min(half, npc.pos.x));
      npc.pos.z = Math.max(-half, Math.min(half, npc.pos.z));
      if (npc.activity !== 'sit') {
        npc.pos.y = getTerrainHeight(npc.pos.x, npc.pos.z);
      }
    }
  }

  public handlePlayerInput(clientId: string, pos: Vector3D, yaw: number, pitch: number, isMoving: boolean, isSprinting: boolean, isCrouching: boolean, isAiming: boolean) {
    const player = this.players.get(clientId);
    if (!player || player.isKnockedOut || this.status !== 'playing') return;

    const half = TOWN_SIZE / 2 - 2;
    player.pos.x = Math.max(-half, Math.min(half, pos.x));
    player.pos.y = Math.max(-5.0, Math.min(25.0, pos.y));
    player.pos.z = Math.max(-half, Math.min(half, pos.z));
    player.yaw = yaw;
    player.pitch = pitch;
    player.isCrouching = isCrouching;
    player.isAiming = isAiming;
  }

  public handlePlayerAttack(clientId: string, aimOrigin?: Vector3D, aimDirection?: Vector3D) {
    const player = this.players.get(clientId);
    if (!player || player.isKnockedOut || this.status !== 'playing') return;

    if (player.hasGenuineKey) {
      return;
    }

    const currentItem = player.inventory[player.activeSlot];
    const weaponType: ItemType = currentItem ? currentItem.type : 'fists';

    if (weaponType === 'pistol') {
      if (!currentItem?.ammo || currentItem.ammo <= 0) {
        return;
      }
      currentItem.ammo--;

      const origin = aimOrigin || { x: player.pos.x, y: player.pos.y + 1.6, z: player.pos.z };
      const dirX = aimDirection ? aimDirection.x : -Math.sin(player.yaw) * Math.cos(player.pitch);
      const dirY = aimDirection ? aimDirection.y : -Math.sin(player.pitch);
      const dirZ = aimDirection ? aimDirection.z : -Math.cos(player.yaw) * Math.cos(player.pitch);

      this.broadcast({
        type: 'gunshot_event',
        shooterId: player.id,
        pos: origin
      });

      const dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
      const ndx = dirX / dirLen;
      const ndz = dirZ / dirLen;

      let hitSomething = false;
      let hitTargetPos = {
        x: origin.x + ndx * WEAPON_STATS.pistol.range,
        y: origin.y + dirY * WEAPON_STATS.pistol.range,
        z: origin.z + ndz * WEAPON_STATS.pistol.range
      };

      for (const rooster of this.roosters.values()) {
        if (rooster.isKnockedOut) continue;
        const dx = rooster.pos.x - origin.x;
        const dz = rooster.pos.z - origin.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 0.1 && dist <= WEAPON_STATS.pistol.range) {
          const dot = (dx * ndx + dz * ndz) / dist;
          if (dot > 0.88) {
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
      }

      if (!hitSomething) {
        for (const npc of this.npcs.values()) {
          if (npc.health <= 0) continue;
          const dx = npc.pos.x - origin.x;
          const dz = npc.pos.z - origin.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          if (dist > 0.1 && dist <= WEAPON_STATS.pistol.range) {
            const dot = (dx * ndx + dz * ndz) / dist;
            if (dot > 0.88) {
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
      }

      if (!hitSomething) {
        for (const other of this.players.values()) {
          if (other.id === player.id || other.isKnockedOut) continue;
          const dx = other.pos.x - origin.x;
          const dz = other.pos.z - origin.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          if (dist > 0.1 && dist <= WEAPON_STATS.pistol.range) {
            const dot = (dx * ndx + dz * ndz) / dist;
            if (dot > 0.88) {
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
      }

      this.recentBulletTraces.push({
        id: `bullet_${Date.now()}_${Math.random()}`,
        origin,
        target: hitTargetPos,
        hit: hitSomething
      });
      return;
    }

    const reach = (weaponType === 'knife') ? WEAPON_STATS.knife.range : WEAPON_STATS.fists.range;
    let baseDamage = (weaponType === 'knife') ? WEAPON_STATS.knife.damage : WEAPON_STATS.fists.damage;

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

    for (const npc of this.npcs.values()) {
      if (npc.health <= 0) continue;
      const dx = npc.pos.x - player.pos.x;
      const dz = npc.pos.z - player.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= reach + 0.6) {
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
            player.hasGenuineKey = true;
            player.hasMemoryLoss = true;
            player.isSmiling = true;

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
            const variation = Math.floor(Math.random() * 3);
            player.riddle = getAccurateHouseRiddle(houseDef.id, variation);

            this.sendTo(player.id, {
              type: 'collapse_event',
              riddle: player.riddle
            });
          } else {
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
    player.activeSlot = 0;
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
