export type PlayerRole = 'pedestrian' | 'waiter' | 'doctor' | 'lawyer';

export type NpcFaction = 'pedestrian' | 'waiter' | 'doctor' | 'lawyer' | 'guard' | 'merchant';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type ItemType = 'fists' | 'crowbar' | 'bat' | 'pistol' | 'key' | 'bandage';

export interface InventoryItem {
  id: string;
  type: ItemType;
  name: string;
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
  state: 'idle' | 'patrol' | 'stare' | 'flee' | 'attack';
  targetPlayerId: string | null;
}

export interface WorldPickup {
  id: string;
  type: ItemType;
  name: string;
  pos: Vector3D;
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

export interface GameSnapshot {
  timestamp: number;
  status: MatchStatus;
  timerSeconds: number;
  isOvertime: boolean;
  players: Record<string, PlayerState>;
  roosters: Record<string, RoosterState>;
  npcs: Record<string, NpcState>;
  pickups: Record<string, WorldPickup>;
  winnerId: string | null;
  winnerName: string | null;
  winReason?: string;
}

// Client -> Server Messages
export type ClientMessage =
  | { type: 'create_room'; playerName: string }
  | { type: 'join_room'; roomCode: string; playerName: string }
  | { type: 'start_match' }
  | { type: 'player_input'; pos: Vector3D; yaw: number; pitch: number; isMoving: boolean; isSprinting: boolean }
  | { type: 'player_attack' }
  | { type: 'player_interact'; targetType: 'pickup' | 'door'; targetId: string }
  | { type: 'select_slot'; slotIndex: number }
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
  | { type: 'match_over'; winnerId: string; winnerName: string; reason: string };
