import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { HOUSES, RED_METER_THRESHOLDS } from '../src/shared/constants.ts';
import { GameRoom } from '../src/server/room.ts';

function createMockSocket() {
  const sent: string[] = [];
  return {
    send: (msg: string) => sent.push(msg),
    readyState: 1,
    sent
  };
}

describe('Cock & Keys — Authoritative Multiplayer & Game Rule Tests', () => {
  test('1. Room creation, joining, and player role assignment', () => {
    const room = new GameRoom('TEST');
    const ws1 = createMockSocket();
    const ws2 = createMockSocket();

    const client1 = room.addClient('p1', 'Player 1', ws1);
    assert.equal(client1.isHost, true, 'First player should be host');

    const client2 = room.addClient('p2', 'Player 2', ws2);
    assert.equal(client2.isHost, false, 'Second player should not be host');
    assert.equal(room.clients.size, 2);

    const started = room.startMatch('p1');
    assert.equal(started, true, 'Host should be able to start match');
    assert.equal(room.status, 'playing');

    const p1State = room.players.get('p1');
    const p2State = room.players.get('p2');
    assert.ok(p1State);
    assert.ok(p2State);
    assert.notEqual(p1State.assignedHouse, undefined);
    assert.notEqual(p2State.assignedHouse, undefined);
    room.stop();
  });

  test('2. 8 Roosters and 8 Keys generated (4 genuine, 4 decoy)', () => {
    const room = new GameRoom('TEST');
    room.addClient('p1', 'Player 1', createMockSocket());
    room.startMatch('p1');

    assert.equal(room.roosters.size, 8, 'Must spawn exactly 8 roosters');
    assert.equal(room.keys.size, 8, 'Must create exactly 8 keys');

    let genuineCount = 0;
    let decoyCount = 0;
    for (const key of room.keys.values()) {
      if (key.isGenuine) genuineCount++;
      else decoyCount++;
    }

    assert.equal(genuineCount, 4, 'Must have exactly 4 genuine keys');
    assert.equal(decoyCount, 4, 'Must have exactly 4 decoy keys');
    room.stop();
  });

  test('3. Decoy key does NOT trigger memory loss or collapse', () => {
    const room = new GameRoom('TEST');
    room.addClient('p1', 'Player 1', createMockSocket());
    room.startMatch('p1');

    const player = room.players.get('p1')!;
    // Place a decoy key pickup near player
    room.pickups.set('pickup_decoy', {
      id: 'pickup_decoy',
      type: 'key',
      name: 'Decoy Key',
      pos: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
      keyId: 'key_4', // Decoy
      isGenuineKey: false,
      targetHouseId: 0
    });

    room.handlePlayerInteract('p1', 'pickup', 'pickup_decoy');

    assert.equal(player.hasGenuineKey, false, 'Decoy key should not set hasGenuineKey');
    assert.equal(player.hasMemoryLoss, false, 'Decoy key must NOT trigger memory loss');
    assert.equal(player.isSmiling, false, 'Decoy key must NOT trigger smiling face');
    assert.equal(player.riddle, null, 'Decoy key must NOT generate riddle');
    room.stop();
  });

  test('4. Genuine key triggers collapse, memory loss, inventory drop, riddle & smile', () => {
    const room = new GameRoom('TEST');
    room.addClient('p1', 'Player 1', createMockSocket());
    room.startMatch('p1');

    const player = room.players.get('p1')!;
    player.inventory[1] = { id: 'weapon_1', type: 'crowbar', name: 'Crowbar' };

    // Place genuine key pickup near player
    room.pickups.set('pickup_genuine', {
      id: 'pickup_genuine',
      type: 'key',
      name: 'Genuine Key',
      pos: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
      keyId: 'key_0', // Genuine key for House 0
      isGenuineKey: true,
      targetHouseId: 0
    });

    room.handlePlayerInteract('p1', 'pickup', 'pickup_genuine');

    assert.equal(player.hasGenuineKey, true, 'Genuine key acquired');
    assert.equal(player.hasMemoryLoss, true, 'Must trigger memory loss');
    assert.equal(player.isSmiling, true, 'Must trigger subtle smiling face');
    assert.ok(player.riddle, 'Cryptic riddle must be generated');
    assert.equal(player.riddle, HOUSES[player.assignedHouse].riddleClue, 'Riddle must point to player assigned house');

    // Weapons must have dropped at collapse location
    assert.equal(player.inventory[1], null, 'Weapon must be dropped from inventory');
    const droppedPickups = Array.from(room.pickups.values()).filter((p) => p.name === 'Crowbar');
    assert.equal(droppedPickups.length, 1, 'Weapon must be spawned in world pickups');

    // Unarmed escape phase: cannot attack
    const rooster = Array.from(room.roosters.values())[0];
    const initialRoosterHealth = rooster.health;
    rooster.pos = { x: player.pos.x, y: player.pos.y, z: player.pos.z };
    room.handlePlayerAttack('p1');
    assert.equal(rooster.health, initialRoosterHealth, 'Key carrier cannot use weapons or attack');
    room.stop();
  });

  test('5. House unlock validation: wrong house fails, correct house wins', () => {
    const room = new GameRoom('TEST');
    room.addClient('p1', 'Player 1', createMockSocket());
    room.startMatch('p1');

    const player = room.players.get('p1')!;
    player.assignedHouse = 0; // Assigned house is House #1 (id 0)

    // Case A: Trying to unlock without genuine key
    room.handlePlayerInteract('p1', 'door', 'house_0');
    assert.notEqual(room.status, 'ended', 'Cannot win without key');

    // Case B: Player has genuine key for House 1, but tries unlocking House 2
    player.inventory[0] = {
      id: 'key_1',
      type: 'key',
      name: 'Genuine Key 2',
      isGenuineKey: true,
      targetHouseId: 1
    };
    player.hasGenuineKey = true;
    player.pos = { x: HOUSES[1].doorPos.x, y: 1.5, z: HOUSES[1].doorPos.z + 5 };
    room.handlePlayerInteract('p1', 'door', 'house_1');
    assert.notEqual(room.status, 'ended', 'Cannot win unlocking a house that is not assigned to player');

    // Case C: Player unlocks assigned House 0 with matching Genuine Key 0
    player.inventory[0] = {
      id: 'key_0',
      type: 'key',
      name: 'Genuine Key 1',
      isGenuineKey: true,
      targetHouseId: 0
    };
    player.pos = { x: HOUSES[0].doorPos.x, y: 1.5, z: HOUSES[0].doorPos.z + 5 };
    room.handlePlayerInteract('p1', 'door', 'house_0');
    assert.equal(room.status, 'ended', 'Unlocking correct assigned house with genuine key triggers victory');
    assert.equal(room.winnerId, 'p1');
    room.stop();
  });

  test('6. Red Meter: wrongful NPC kills increment meter, never decreases, causes game over at 8', () => {
    const room = new GameRoom('TEST');
    room.addClient('p1', 'Player 1', createMockSocket());
    room.startMatch('p1');

    const player = room.players.get('p1')!;
    assert.equal(player.redMeter, 0);

    const npc = Array.from(room.npcs.values())[0];
    npc.pos = { x: player.pos.x, y: player.pos.y, z: player.pos.z };

    // Attack NPC until death
    npc.health = 20; // 1 hit left
    room.handlePlayerAttack('p1');

    assert.equal(npc.health, 0, 'NPC should be killed');
    assert.equal(player.redMeter, 1, 'Wrongful kill increments Red Meter exactly once');
    assert.ok(player.attackedFactions.includes(npc.faction), 'Attacked faction must be recorded');

    // Simulate 7 more kills
    for (let i = 2; i <= 7; i++) {
      const nextNpc = Array.from(room.npcs.values())[i];
      nextNpc.pos = { x: player.pos.x, y: player.pos.y, z: player.pos.z };
      nextNpc.health = 20;
      room.handlePlayerAttack('p1');
      assert.equal(player.redMeter, i);
    }

    assert.equal(player.redMeter, 7, 'Universal hostility threshold reached');
    assert.notEqual(room.status, 'ended', 'Still playable at Red Meter 7');

    // 8th kill: Instant Game Over
    const lastNpc = Array.from(room.npcs.values())[8];
    lastNpc.pos = { x: player.pos.x, y: player.pos.y, z: player.pos.z };
    lastNpc.health = 20;
    room.handlePlayerAttack('p1');

    assert.equal(player.redMeter, 8, 'Red Meter reached 8');
    assert.equal(room.status, 'ended', 'Red Meter 8 must trigger immediate game over');
    room.stop();
  });

  test('7. Faction hostility rule check at Red Meter 5 vs universal hostility at 7', () => {
    const room = new GameRoom('TEST');
    room.addClient('p1', 'Player 1', createMockSocket());
    room.startMatch('p1');

    const player = room.players.get('p1')!;
    player.redMeter = 5;
    player.attackedFactions = ['lawyer'];

    // Lawyer NPC sees player
    const lawyerNpc = Array.from(room.npcs.values()).find((n) => n.faction === 'lawyer')!;
    const doctorNpc = Array.from(room.npcs.values()).find((n) => n.faction === 'doctor')!;

    lawyerNpc.pos = { x: player.pos.x + 2, y: player.pos.y, z: player.pos.z + 2 };
    doctorNpc.pos = { x: player.pos.x + 2, y: player.pos.y, z: player.pos.z + 2 };

    // Tick AI update
    (room as unknown as { updateNpcs: (d: number) => void }).updateNpcs(0.1);

    assert.equal(lawyerNpc.state, 'attack', 'Lawyer NPC must retaliate at Red Meter 5');
    assert.notEqual(doctorNpc.state, 'attack', 'Doctor NPC must NOT attack at Red Meter 5 if doctor was never attacked');

    // At Red Meter 7, Doctor NPC becomes hostile too
    player.redMeter = 7;
    (room as unknown as { updateNpcs: (d: number) => void }).updateNpcs(0.1);
    assert.equal(doctorNpc.state, 'attack', 'Doctor NPC must become hostile at Red Meter 7 (universal hostility)');
    room.stop();
  });
});
