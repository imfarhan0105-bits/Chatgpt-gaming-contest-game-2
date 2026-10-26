import type { HouseDefinition, NpcFaction, PlayerRole } from './types.ts';

// Big Map Dimensions: 260x260 meters town with multiple districts and ambush alleys
export const TOWN_SIZE = 260;
export const TOWN_WALL_HEIGHT = 8;

/**
 * Procedural Topographical 3D Terrain Heightfield function.
 * Deterministic, smooth, and physically continuous across client & server.
 * Returns elevation Y in meters for any world coordinate (X, Z).
 */
export function getTerrainHeight(x: number, z: number): number {
  const distFromCenter = Math.sqrt(x * x + z * z);

  // 1. Mountain Ridges & Foothills encircling town outside radius 112m
  if (distFromCenter > 112) {
    const factor = Math.min(1.0, (distFromCenter - 112) / 38);
    const angle = Math.atan2(z, x);
    const ridgeHarmonics = Math.sin(angle * 6) * 14 + Math.cos(angle * 12) * 6;
    const baseRise = factor * factor * 35;
    return Math.max(0, baseRise + ridgeHarmonics * factor);
  }

  // 2. Central Plaza: Flat level grade at y = 0
  if (distFromCenter <= 34) {
    return 0;
  }

  // 3. Flat Pavements for Grand Avenues & Secondary Streets
  const isAvenueX = Math.abs(x) <= 8.5;
  const isAvenueZ = Math.abs(z) <= 8.5;
  const isRingX = Math.abs(Math.abs(x) - 80) <= 6.5;
  const isRingZ = Math.abs(Math.abs(z) - 80) <= 6.5;

  // 4. Scenic River Canal (z between -52 and -38)
  const canalDistZ = Math.abs(z - (-45));
  if (canalDistZ <= 7.0) {
    // Check if crossing one of the 3 stone bridges
    const isBridge = Math.abs(x) <= 9.0 || Math.abs(x - 80) <= 6.5 || Math.abs(x - (-80)) <= 6.5;
    if (isBridge) {
      return 0.3; // Level bridge deck
    }
    // Smoothly carved riverbed drop
    const drop = 1 - canalDistZ / 7.0;
    return -1.6 * Math.sin(drop * Math.PI * 0.5);
  }

  if (isAvenueX || isAvenueZ || isRingX || isRingZ) {
    return 0;
  }

  // 5. Level Building Foundation Pads
  if (Math.abs(x - (-75)) < 19 && Math.abs(z) < 14) return 0; // Central Hospital
  if (Math.abs(x) < 16 && Math.abs(z - (-75)) < 12) return 0; // Bistro
  if (Math.abs(x) < 15 && Math.abs(z - 75) < 12) return 0; // Police HQ
  if (Math.abs(x - 75) < 18 && Math.abs(z) < 14) return 0; // City Hall & Bank
  if (Math.abs(Math.abs(x) - 80) < 12 && Math.abs(Math.abs(z) - 80) < 12) return 0; // 4 Estates

  // 6. Natural Rolling Grassy Knolls & Berms in parklands
  const knoll1 = Math.sin(x * 0.08) * Math.cos(z * 0.08) * 0.9;
  const knoll2 = Math.sin((x + 35) * 0.05) * Math.sin((z - 25) * 0.05) * 0.6;
  return Math.max(0, knoll1 + knoll2);
}

export const TICK_RATE = 20; // 20 ticks per second (50ms interval)
export const MATCH_DURATION_SECONDS = 8 * 60; // 8 minutes

// Movement Speeds
export const PLAYER_WALK_SPEED = 4.8;
export const PLAYER_SPRINT_SPEED = 8.5;
export const PLAYER_CROUCH_SPEED = 2.4;
export const ROOSTER_WALK_SPEED = 4.5;
export const ROOSTER_FLEE_SPEED = 9.5;
export const NPC_WALK_SPEED = 3.0;
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
export const HOUSE_ACCURATE_RIDDLES: Record<number, string[]> = {
  0: [
    'Beyond the central river crossing, head northwest towards the misty mountain ridge. Seek the cobalt estate nestled beneath the ancient spreading oak trees.',
    'Where the northern cobblestone avenue meets the western foothills, search for the cobalt estate whose stone porch gazes at the snow-capped northwestern peaks.',
    'Follow the riverbank northwest past the bistro to the botanical grove; your cobalt house door waits near the northwest stone perimeter wall.'
  ],
  1: [
    'Where the gothic cathedral clocktower points its eastward morning shadow, seek the grand crimson brick manor overlooking the river bridge.',
    'Head northeast across the town promenade toward the eastern mountain pass; search for the crimson estate flanked by stone lions and terracotta gables.',
    'Directly east of the central clocktower, cross the arched stone bridge into the northeastern estates to find the crimson manor doorway.'
  ],
  2: [
    'Southwest of the central tiered fountain, past the hospital gardens, an ivy-draped emerald villa doorway greets the valley breeze.',
    'Follow the western avenue south toward the pine-covered hills; locate the emerald villa with twin iron lanterns beside the garden stone wall.',
    'Take the path southwest between the central plaza and the hospital triage; your green estate stands before the southwestern mountain slopes.'
  ],
  3: [
    'Directly in the piercing gaze of the colossal Bronze Rooster monument, your golden timber amber lodge stands near the southeastern foothills.',
    'Head southeast from the grand fountain past the police headquarters; 40 meters east lies the warm amber lodge with its timber balcony.',
    'Where the southern river bends towards the morning sun, search the southeastern district for the golden amber lodge beside the military depot.'
  ]
};

export function getAccurateHouseRiddle(houseId: number, variationIndex: number = 0): string {
  const pool = HOUSE_ACCURATE_RIDDLES[houseId] || HOUSE_ACCURATE_RIDDLES[0];
  const idx = Math.abs(variationIndex) % pool.length;
  return pool[idx];
}

export const HOUSES: HouseDefinition[] = [
  {
    id: 0,
    name: 'Cobalt Estate (House #1)',
    doorPos: { x: -80, y: 1.0, z: -80 },
    colorHex: 0x1d4ed8, // Royal Blue
    landmarkNear: 'Ancient Oak Park & Northwest Mountains',
    riddleClue: HOUSE_ACCURATE_RIDDLES[0][0]
  },
  {
    id: 1,
    name: 'Crimson Manor (House #2)',
    doorPos: { x: 80, y: 1.0, z: -80 },
    colorHex: 0xb91c1c, // Deep Red
    landmarkNear: 'Grand Cathedral Clocktower & Stone Bridge',
    riddleClue: HOUSE_ACCURATE_RIDDLES[1][0]
  },
  {
    id: 2,
    name: 'Emerald Villa (House #3)',
    doorPos: { x: -80, y: 1.0, z: 80 },
    colorHex: 0x047857, // Deep Emerald
    landmarkNear: 'Central Grand Fountain & Hospital Grounds',
    riddleClue: HOUSE_ACCURATE_RIDDLES[2][0]
  },
  {
    id: 3,
    name: 'Amber Lodge (House #4)',
    doorPos: { x: 80, y: 1.0, z: 80 },
    colorHex: 0xb45309, // Rich Amber
    landmarkNear: 'Colossal Bronze Rooster Monument & Police HQ',
    riddleClue: HOUSE_ACCURATE_RIDDLES[3][0]
  }
];

// Major City Landmarks
export const LANDMARKS = [
  { name: 'Cathedral Clocktower', pos: { x: 0, y: 0, z: -25 }, size: { w: 10, h: 36, d: 10 }, color: 0x64748b },
  { name: 'Grand Promenade Fountain', pos: { x: 0, y: 0, z: 25 }, size: { w: 16, h: 3.5, d: 16 }, color: 0x0284c7 },
  { name: 'Ancient Oak Park', pos: { x: -50, y: 0, z: -50 }, size: { w: 8, h: 16, d: 8 }, color: 0x15803d },
  { name: 'Bronze Rooster Monument', pos: { x: 50, y: 0, z: 50 }, size: { w: 6, h: 10, d: 6 }, color: 0xd97706 },
  { name: 'City Hall & Bank', pos: { x: 75, y: 0, z: 0 }, size: { w: 32, h: 14, d: 24 }, color: 0xe2e8f0 },
  { name: 'Central Hospital', pos: { x: -75, y: 0, z: 0 }, size: { w: 34, h: 16, d: 24 }, color: 0xf8fafc },
  { name: 'Le Grand Bistro Restaurant', pos: { x: 0, y: 0, z: -75 }, size: { w: 28, h: 10, d: 20 }, color: 0x78350f },
  { name: 'Police Headquarters', pos: { x: 0, y: 0, z: 75 }, size: { w: 26, h: 12, d: 20 }, color: 0x1e293b }
];

export interface SharedAABB {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

// Authoritative obstacle collision bounds shared across Client and Server
// Enterable buildings have wall colliders that leave the doorways open!
export const SOLID_OBSTACLE_BOUNDS: SharedAABB[] = [
  // 1. Perimeter Walls
  { minX: -130, minZ: -131, maxX: 130, maxZ: -129 },
  { minX: -130, minZ: 129, maxX: 130, maxZ: 131 },
  { minX: -131, minZ: -130, maxX: -129, maxZ: 130 },
  { minX: 129, minZ: -130, maxX: 131, maxZ: 130 },

  // 2. Cathedral Clocktower (0, -25)
  { minX: -5, minZ: -30, maxX: 5, maxZ: -20 },

  // 3. Central Fountain (0, 25)
  { minX: -8, minZ: 17, maxX: 8, maxZ: 33 },

  // 4. Ancient Oak Trunk (-50, -50)
  { minX: -52, minZ: -52, maxX: -48, maxZ: -48 },

  // 5. Bronze Rooster Monument (50, 50)
  { minX: 47, minZ: 47, maxX: 53, maxZ: 53 },

  // 6. Enterable Restaurant (0, -75) - Size: 28 x 20. Door opening: x in [-3, 3] at z = -65
  // Left front wall: x from -14 to -3
  { minX: -14, minZ: -66, maxX: -3, maxZ: -64 },
  // Right front wall: x from 3 to 14
  { minX: 3, minZ: -66, maxX: 14, maxZ: -64 },
  // Back wall
  { minX: -14, minZ: -86, maxX: 14, maxZ: -84 },
  // Left wall
  { minX: -15, minZ: -86, maxX: -13, maxZ: -64 },
  // Right wall
  { minX: 13, minZ: -86, maxX: 15, maxZ: -64 },

  // 7. Enterable Hospital (-75, 0) - Size: 34 x 24. Door opening: z in [-3, 3] at x = -58
  // Front left wall: z from 3 to 12
  { minX: -59, minZ: 3, maxX: -57, maxZ: 12 },
  // Front right wall: z from -12 to -3
  { minX: -59, minZ: -12, maxX: -57, maxZ: -3 },
  // Back wall
  { minX: -93, minZ: -12, maxX: -91, maxZ: 12 },
  // North wall
  { minX: -92, minZ: -13, maxX: -58, maxZ: -11 },
  // South wall
  { minX: -92, minZ: 11, maxX: -58, maxZ: 13 },

  // 8. Enterable Police HQ (0, 75) - Size: 26 x 20. Door opening: x in [-3, 3] at z = 65
  // Front left wall: x from -13 to -3
  { minX: -13, minZ: 64, maxX: -3, maxZ: 66 },
  // Front right wall: x from 3 to 13
  { minX: 3, minZ: 64, maxX: 13, maxZ: 66 },
  // Back wall
  { minX: -13, minZ: 84, maxX: 13, maxZ: 86 },
  // Left wall
  { minX: -14, minZ: 64, maxX: -12, maxZ: 86 },
  // Right wall
  { minX: 12, minZ: 64, maxX: 14, maxZ: 86 },

  // 9. Enterable City Hall & Bank (75, 0) - Size: 32 x 24. Door opening: z in [-3, 3] at x = 59
  // Front top wall: z from 3 to 12
  { minX: 58, minZ: 3, maxX: 60, maxZ: 12 },
  // Front bottom wall: z from -12 to -3
  { minX: 58, minZ: -12, maxX: 60, maxZ: -3 },
  // Back wall
  { minX: 90, minZ: -12, maxX: 92, maxZ: 12 },
  // North wall
  { minX: 59, minZ: -13, maxX: 91, maxZ: -11 },
  // South wall
  { minX: 59, minZ: 11, maxX: 91, maxZ: 13 },

  // 10. Ambush Alleys Walls & Dumpsters
  // (-35, -35)
  { minX: -49, minZ: -37, maxX: -31, maxZ: -33 },
  { minX: -39, minZ: -29, maxX: -21, maxZ: -25 },
  // (35, -35)
  { minX: 21, minZ: -37, maxX: 39, maxZ: -33 },
  { minX: 31, minZ: -29, maxX: 49, maxZ: -25 },
  // (-35, 35)
  { minX: -49, minZ: 33, maxX: -31, maxZ: 37 },
  { minX: -39, minZ: 41, maxX: -21, maxZ: 45 },
  // (35, 35)
  { minX: 21, minZ: 33, maxX: 39, maxZ: 37 },
  { minX: 31, minZ: 41, maxX: 49, maxZ: 45 }
];

export function checkObstacleCollision(x: number, z: number, radius: number = 0.45): boolean {
  for (let i = 0; i < SOLID_OBSTACLE_BOUNDS.length; i++) {
    const b = SOLID_OBSTACLE_BOUNDS[i];
    if (
      x + radius > b.minX &&
      x - radius < b.maxX &&
      z + radius > b.minZ &&
      z - radius < b.maxZ
    ) {
      return true;
    }
  }
  return false;
}

export const RED_METER_THRESHOLDS = {
  SUSPICION: 1, // 1-4: NPCs stare suspiciously
  FACTION_RETALIATION: 5, // 5-6: NPCs of attacked factions retaliate
  UNIVERSAL_HOSTILITY: 7, // 7: All NPCs attack on sight
  GAME_OVER: 8 // 8: Instant Match Disqualification
};
