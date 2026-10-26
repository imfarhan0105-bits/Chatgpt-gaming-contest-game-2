import { HouseDefinition, NpcFaction, PlayerRole } from './types.ts';

export const TOWN_SIZE = 120; // 120x120 meters town
export const TOWN_WALL_HEIGHT = 6;

export const TICK_RATE = 20; // 20 ticks per second (50ms interval)
export const MATCH_DURATION_SECONDS = 8 * 60; // 8 minutes

export const PLAYER_WALK_SPEED = 5.0;
export const PLAYER_SPRINT_SPEED = 8.5;
export const ROOSTER_WALK_SPEED = 4.2;
export const ROOSTER_FLEE_SPEED = 8.0;
export const NPC_WALK_SPEED = 2.8;

export const INTERACTION_DISTANCE = 3.0;
export const MELEE_ATTACK_DISTANCE = 2.2;
export const MELEE_DAMAGE = 25;

export const PLAYER_ROLES: PlayerRole[] = ['pedestrian', 'waiter', 'doctor', 'lawyer'];
export const NPC_FACTIONS: NpcFaction[] = ['pedestrian', 'waiter', 'doctor', 'lawyer', 'guard', 'merchant'];

// 4 Distinct Player Houses placed at key sectors of the town
export const HOUSES: HouseDefinition[] = [
  {
    id: 0,
    name: 'Cobalt Cottage (House #1)',
    doorPos: { x: -36, y: 1.0, z: -36 },
    colorHex: 0x3a86ff, // Blue
    landmarkNear: 'Ancient Oak Tree',
    riddleClue: 'Beneath the ancient oak whose branches point northwest, stands the azure door where weary roosters rest.'
  },
  {
    id: 1,
    name: 'Crimson Manor (House #2)',
    doorPos: { x: 36, y: 1.0, z: -36 },
    colorHex: 0xe63946, // Red
    landmarkNear: 'Town Clocktower',
    riddleClue: 'Where the grand clocktower casts its eastward midday shadow, seek the ruby door overlooking the square.'
  },
  {
    id: 2,
    name: 'Emerald Villa (House #3)',
    doorPos: { x: -36, y: 1.0, z: 36 },
    colorHex: 0x2a9d8f, // Green
    landmarkNear: 'Central Marble Fountain',
    riddleClue: 'Southwest of the splashing marble fountain, an emerald doorway greets the evening breeze.'
  },
  {
    id: 3,
    name: 'Amber Lodge (House #4)',
    doorPos: { x: 36, y: 1.0, z: 36 },
    colorHex: 0xf4a261, // Amber/Orange
    landmarkNear: 'Bronze Rooster Monument',
    riddleClue: 'Directly in the gaze of the grand Bronze Rooster monument, your golden home awaits its master.'
  }
];

// Major Town Landmarks
export const LANDMARKS = [
  { name: 'Clocktower', pos: { x: 0, y: 0, z: -10 }, size: { w: 6, h: 22, d: 6 }, color: 0x8d99ae },
  { name: 'Central Fountain', pos: { x: 0, y: 0, z: 10 }, size: { w: 8, h: 2, d: 8 }, color: 0x48cae4 },
  { name: 'Ancient Oak Tree', pos: { x: -25, y: 0, z: -25 }, size: { w: 4, h: 10, d: 4 }, color: 0x2b9348 },
  { name: 'Bronze Rooster Monument', pos: { x: 25, y: 0, z: 25 }, size: { w: 3, h: 5, d: 3 }, color: 0xd4a373 },
  { name: 'Courthouse', pos: { x: 35, y: 0, z: 0 }, size: { w: 18, h: 9, d: 14 }, color: 0xd9dcd6 },
  { name: 'Hospital', pos: { x: -35, y: 0, z: 0 }, size: { w: 18, h: 9, d: 14 }, color: 0xf8f9fa },
  { name: 'Restaurant', pos: { x: 0, y: 0, z: -40 }, size: { w: 16, h: 8, d: 12 }, color: 0xbc6c25 }
];

export const RED_METER_THRESHOLDS = {
  SUSPICION: 1, // 1-4: NPCs stare suspiciously
  FACTION_RETALIATION: 5, // 5-6: NPCs of attacked factions retaliate
  UNIVERSAL_HOSTILITY: 7, // 7: All NPCs attack on sight
  GAME_OVER: 8 // 8: Instant Match Disqualification
};
