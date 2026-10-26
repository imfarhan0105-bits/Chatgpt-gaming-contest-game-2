export type PlayerRole = 'pedestrian' | 'waiter' | 'doctor' | 'lawyer';

export type NpcFaction = 'pedestrian' | 'waiter' | 'doctor' | 'lawyer' | 'guard' | 'merchant';

export type NpcActivity = 'walk' | 'sit' | 'chat' | 'patrol' | 'flee' | 'cower' | 'attack';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type ItemType = 'fists' | 'knife' | 'pistol' | 'ammo' | 'key' | 'bandage';

export interface InventoryItem {
  id: string;
  type: ItemType;
  name: string;
  ammo?: number;
  maxAmmo?: number;
  keyId?: string;
  isGenuineKey?: boolean;
  targetHouseId?: number;
}

export interface PlayerState {
  id: string;
  name: string;
  role: PlayerRole;
  pos: Vector3D;
  yaw: number;
  pitch: number;
  health: number;
  maxHealth: number;
  isKnockedOut: boolean;
  isCrouching: boolean;
  isAiming: boolean;
  assignedHouse: number; // 0, 1, 2, 3
  redMeter: number; // 0 to 8
  attackedFactions: NpcFaction[];
  inventory: (InventoryItem | null)[];
  activeSlot: number;
  hasGenuineKey: boolean;
  hasMemoryLoss: boolean;
  riddle: string | null;
  isSmiling: boolean;
  isHost: boolean;
  connected: boolean;
}

export interface RoosterState {
  id: string;
  pos: Vector3D;
  yaw: number;
  health: number;
  maxHealth: number;
  isKnockedOut: boolean;
  carriedKeyId: string | null;
}

export interface KeyItemState {
  id: string;
  targetHouseId: number; // 0, 1, 2, 3
  isGenuine: boolean;
  carriedByRoosterId: string | null;
  carriedByPlayerId: string | null;
  worldPos: Vector3D | null;
}

export interface NpcState {
  id: string;
  faction: NpcFaction;
  name: string;
  pos: Vector3D;
  yaw: number;
  health: number;
  maxHealth: number;
  state: 'idle' | 'patrol' | 'stare' | 'flee' | 'attack' | 'sitting' | 'chatting';
  activity: NpcActivity;
  targetPlayerId: string | null;
}

export interface WorldPickup {
  id: string;
  type: ItemType;
  name: string;
  pos: Vector3D;
  ammo?: number;
  keyId?: string;
  isGenuineKey?: boolean;
  targetHouseId?: number;
}

export interface HouseDefinition {
  id: number;
  name: string;
  doorPos: Vector3D;
  colorHex: number;
  landmarkNear: string;
  riddleClue: string;
}

export type MatchStatus = 'lobby' | 'playing' | 'ended';

export interface BulletTrace {
  id: string;
  origin: Vector3D;
  target: Vector3D;
  hit: boolean;
}

export interface GameSnapshot {
  timestamp: number;
  status: MatchStatus;
  timerSeconds: number;
  isOvertime: boolean;
  players: Record<string, PlayerState>;
  roosters: Record<string, RoosterState>;
  npcs: Record<string, NpcState>;
  pickups: Record<string, WorldPickup>;
  bulletTraces?: BulletTrace[];
  winnerId: string | null;
  winnerName: string | null;
  winReason?: string;
}

// Client -> Server Messages
export type ClientMessage =
  | { type: 'create_room'; playerName: string }
  | { type: 'join_room'; roomCode: string; playerName: string }
  | { type: 'start_match' }
  | { type: 'player_input'; pos: Vector3D; yaw: number; pitch: number; isMoving: boolean; isSprinting: boolean; isCrouching: boolean; isAiming: boolean }
  | { type: 'player_attack'; aimOrigin?: Vector3D; aimDirection?: Vector3D }
  | { type: 'player_reload' }
  | { type: 'player_interact'; targetType: 'pickup' | 'door'; targetId: string }
  | { type: 'select_slot'; slotIndex: number }
  | { type: 'drop_item'; slotIndex: number }
  | { type: 'leave_room' };

// Server -> Client Messages
export type ServerMessage =
  | { type: 'room_created'; roomCode: string; playerId: string; isHost: boolean }
  | { type: 'room_joined'; roomCode: string; playerId: string; isHost: boolean }
  | { type: 'room_error'; message: string }
  | { type: 'lobby_update'; players: { id: string; name: string; isHost: boolean }[] }
  | { type: 'match_started'; assignedRole: PlayerRole; assignedHouse: number }
  | { type: 'game_snapshot'; snapshot: GameSnapshot }
  | { type: 'collapse_event'; riddle: string }
  | { type: 'red_meter_alert'; level: number; message: string }
  | { type: 'gunshot_event'; shooterId: string; pos: Vector3D; targetPos?: Vector3D }
  | { type: 'match_over'; winnerId: string; winnerName: string; reason: string };
