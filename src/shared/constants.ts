import type { HouseDefinition, NpcFaction, PlayerRole } from './types.ts';

// Big Map Dimensions: 260x260 meters town with multiple districts and ambush alleys
export const TOWN_SIZE = 260;
export const TOWN_WALL_HEIGHT = 8;

export const TICK_RATE = 20; // 20 ticks per second (50ms interval)
export const MATCH_DURATION_SECONDS = 8 * 60; // 8 minutes

// Movement Speeds
export const PLAYER_WALK_SPEED = 4.8;
export const PLAYER_SPRINT_SPEED = 8.5;
export const PLAYER_CROUCH_SPEED = 2.4;
export const ROOSTER_WALK_SPEED = 4.0;
export const ROOSTER_FLEE_SPEED = 9.0;
export const NPC_WALK_SPEED = 2.6;
export const NPC_RUN_SPEED = 7.5;

// Combat & Weapons
export const INTERACTION_DISTANCE = 4.2;

export const WEAPON_STATS = {
  fists: { damage: 15, range: 2.2, cooldown: 0.4 },
  knife: { damage: 40, backstabDamage: 85, range: 2.4, cooldown: 0.35 },
  pistol: { damage: 35, headshotMultiplier: 1.8, range: 65, magSize: 12, reloadTime: 1.8, fireRate: 0.25 }
};

export const PLAYER_ROLES: PlayerRole[] = ['pedestrian', 'waiter', 'doctor', 'lawyer'];
export const NPC_FACTIONS: NpcFaction[] = ['pedestrian', 'waiter', 'doctor', 'lawyer', 'guard', 'merchant'];

// 4 Distinct Player Estates/Manors in the 4 corners of the large city
export const HOUSES: HouseDefinition[] = [
  {
    id: 0,
    name: 'Cobalt Estate (House #1)',
    doorPos: { x: -80, y: 1.0, z: -80 },
    colorHex: 0x1d4ed8, // Royal Blue
    landmarkNear: 'Ancient Oak Park & Conservatory',
    riddleClue: 'Beneath the ancient botanical oak whose branches sweep northwest, find the azure estate where the roosters rest.'
  },
  {
    id: 1,
    name: 'Crimson Manor (House #2)',
    doorPos: { x: 80, y: 1.0, z: -80 },
    colorHex: 0xb91c1c, // Deep Red
    landmarkNear: 'Grand Cathedral Clocktower',
    riddleClue: 'Where the grand cathedral clocktower casts its eastward midday shadow, seek the ruby manor overlooking the plaza.'
  },
  {
    id: 2,
    name: 'Emerald Villa (House #3)',
    doorPos: { x: -80, y: 1.0, z: 80 },
    colorHex: 0x047857, // Deep Emerald
    landmarkNear: 'Central Grand Promenade Fountain',
    riddleClue: 'Southwest of the grand tiered promenade fountain, an emerald villa doorway greets the evening breeze.'
  },
  {
    id: 3,
    name: 'Amber Lodge (House #4)',
    doorPos: { x: 80, y: 1.0, z: 80 },
    colorHex: 0xb45309, // Rich Amber
    landmarkNear: 'Colossal Bronze Rooster Monument',
    riddleClue: 'Directly in the piercing gaze of the colossal Bronze Rooster monument, your golden lodge awaits its master.'
  }
];

// Major City Landmarks
export const LANDMARKS = [
  { name: 'Cathedral Clocktower', pos: { x: 0, y: 0, z: -25 }, size: { w: 10, h: 36, d: 10 }, color: 0x64748b },
  { name: 'Grand Promenade Fountain', pos: { x: 0, y: 0, z: 25 }, size: { w: 16, h: 3.5, d: 16 }, color: 0x0284c7 },
  { name: 'Ancient Oak Park', pos: { x: -50, y: 0, z: -50 }, size: { w: 8, h: 16, d: 8 }, color: 0x15803d },
  { name: 'Bronze Rooster Monument', pos: { x: 50, y: 0, z: 50 }, size: { w: 6, h: 10, d: 6 }, color: 0xd97706 },
  { name: 'City Hall & Courthouse', pos: { x: 75, y: 0, z: 0 }, size: { w: 32, h: 14, d: 24 }, color: 0xe2e8f0 },
  { name: 'Central Hospital', pos: { x: -75, y: 0, z: 0 }, size: { w: 34, h: 16, d: 24 }, color: 0xf8fafc },
  { name: 'Le Grand Bistro Restaurant', pos: { x: 0, y: 0, z: -75 }, size: { w: 28, h: 10, d: 20 }, color: 0x78350f },
  { name: 'Police Headquarters', pos: { x: 0, y: 0, z: 75 }, size: { w: 26, h: 12, d: 20 }, color: 0x1e293b }
];

export const RED_METER_THRESHOLDS = {
  SUSPICION: 1, // 1-4: NPCs stare suspiciously
  FACTION_RETALIATION: 5, // 5-6: NPCs of attacked factions retaliate
  UNIVERSAL_HOSTILITY: 7, // 7: All NPCs attack on sight
  GAME_OVER: 8 // 8: Instant Match Disqualification
};
