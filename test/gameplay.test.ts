import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { HOUSES, WEAPON_STATS } from '../src/shared/constants.ts';
import { GameRoom } from '../src/server/room.ts';

function createMockSocket() {
  const sent: string[] = [];
  return {
    send: (msg: string) => sent.push(msg),
    readyState: 1,
    sent
  };
}

describe('Cock & Keys — Advanced Weapons, PvP & Game Rule Tests', () => {
  test('1. Room creation, joining, and player role assignment', () => {
    const room = new GameRoom('TEST');
    const ws1 = createMockSocket();
    const ws2 = createMockSocket();

    const client1 = room.addClient('p1', 'Player 1', ws1);
    assert.equal(client1.isHost, true);

    const client2 = room.addClient('p2', 'Player 2', ws2);
    assert.equal(client2.isHost, false);
    assert.equal(room.clients.size, 2);

    const started = room.startMatch('p1');
    assert.equal(started, true);
    assert.equal(room.status, 'playing');

    const p1State = room.players.get('p1');
    const p2State = room.players.get('p2');
    assert.ok(p1State);
    assert.ok(p2State);
    assert.notEqual(p1State.assignedHouse, undefined);
    assert.notEqual(p2State.assignedHouse, undefined);
    room.stop();
  });

  test('2. 8 Roosters and 8 Keys generated with 40 crowd NPCs', () => {
    const room = new GameRoom('TEST');
    room.addClient('p1', 'Player 1', createMockSocket());
    room.startMatch('p1');

    assert.equal(room.roosters.size, 8, 'Must spawn exactly 8 roosters');
    assert.equal(room.keys.size, 8, 'Must create exactly 8 keys');
    assert.equal(room.npcs.size, 40, 'Must populate dense crowd of 40 NPCs');

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

  test('3. Weapons: Knife slash, Pistol firing with ammo and reload', () => {
    const room = new GameRoom('TEST');
    room.addClient('p1', 'Player 1', createMockSocket());
    room.startMatch('p1');

    const player = room.players.get('p1')!;
    // Equip pistol
    player.inventory[2] = { id: 'pistol_test', type: 'pistol', name: '9mm Pistol', ammo: 12, maxAmmo: 12 };
    player.activeSlot = 2;

    const rooster = Array.from(room.roosters.values())[0];
    rooster.pos = { x: player.pos.x, y: player.pos.y, z: player.pos.z - 10 };
    player.yaw = 0; // Facing forward down -Z towards rooster
    player.pitch = 0;

    const initialHealth = rooster.health;
    room.handlePlayerAttack('p1');

    assert.equal(player.inventory[2]!.ammo, 11, 'Pistol should expend 1 round');
    assert.equal(rooster.health, initialHealth - WEAPON_STATS.pistol.damage, 'Pistol bullet should deal damage');

    // Reload
    room.handlePlayerReload('p1');
    assert.equal(player.inventory[2]!.ammo, 12, 'Pistol should reload to full magazine');
    room.stop();
  });

  test('4. Ambush stealth backstab bonus damage with Knife', () => {
    const room = new GameRoom('TEST');
    room.addClient('p1', 'Player 1', createMockSocket());
    room.startMatch('p1');

    const player = room.players.get('p1')!;
    player.activeSlot = 1; // Tactical Knife

    const npc = Array.from(room.npcs.values())[0];
    npc.pos = { x: player.pos.x, y: player.pos.y, z: player.pos.z + 1.5 };
    npc.health = 100;

    // Normal knife attack
    player.isCrouching = false;
    room.handlePlayerAttack('p1');
    assert.equal(npc.health, 100 - WEAPON_STATS.knife.damage);

    // Crouching stealth ambush backstab attack
    npc.health = 100;
    player.isCrouching = true;
    room.handlePlayerAttack('p1');
    assert.equal(npc.health, 100 - WEAPON_STATS.knife.backstabDamage, 'Ambush attack deals critical backstab damage');
    room.stop();
  });

  test('5. Genuine key triggers complete collapse, memory loss, inventory drop, riddle & smile', () => {
    const room = new GameRoom('TEST');
    room.addClient('p1', 'Player 1', createMockSocket());
    room.startMatch('p1');

    const player = room.players.get('p1')!;
    player.inventory[2] = { id: 'pistol_loot', type: 'pistol', name: '9mm Pistol', ammo: 12 };

    room.pickups.set('pickup_genuine', {
      id: 'pickup_genuine',
      type: 'key',
      name: 'Genuine Key',
      pos: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
      keyId: 'key_0',
      isGenuineKey: true,
      targetHouseId: 0
    });

    room.handlePlayerInteract('p1', 'pickup', 'pickup_genuine');

    assert.equal(player.hasGenuineKey, true);
    assert.equal(player.hasMemoryLoss, true);
    assert.equal(player.isSmiling, true);
    assert.ok(player.riddle);
    assert.equal(player.riddle, HOUSES[player.assignedHouse].riddleClue);

    // Weapons dropped
    assert.equal(player.inventory[2], null, 'Weapons must drop at collapse location');
    const droppedGuns = Array.from(room.pickups.values()).filter((p) => p.name === '9mm Pistol');
    assert.equal(droppedGuns.length, 1, 'Pistol must spawn as world pickup');

    // Unarmed escape phase: cannot attack
    player.activeSlot = 0;
    const rooster = Array.from(room.roosters.values())[0];
    const initialHealth = rooster.health;
    rooster.pos = { x: player.pos.x, y: player.pos.y, z: player.pos.z };
    room.handlePlayerAttack('p1');
    assert.equal(rooster.health, initialHealth, 'Key carrier cannot use weapons or attack');
    room.stop();
  });

  test('6. Estate door unlock: wrong house fails, correct house wins', () => {
    const room = new GameRoom('TEST');
    room.addClient('p1', 'Player 1', createMockSocket());
    room.startMatch('p1');

    const player = room.players.get('p1')!;
    player.assignedHouse = 0; // Cobalt Estate

    // Unlock without key fails
    room.handlePlayerInteract('p1', 'door', 'house_0');
    assert.notEqual(room.status, 'ended');

    // Unlock with matching genuine key wins
    player.inventory[0] = {
      id: 'key_0',
      type: 'key',
      name: 'Genuine Key 1',
      isGenuineKey: true,
      targetHouseId: 0
    };
    player.hasGenuineKey = true;
    player.pos = { x: HOUSES[0].doorPos.x, y: 0, z: HOUSES[0].doorPos.z + 10 };
    room.handlePlayerInteract('p1', 'door', 'house_0');

    assert.equal(room.status, 'ended', 'Unlocking assigned estate with genuine key wins match');
    assert.equal(room.winnerId, 'p1');
    room.stop();
  });

  test('7. Red Meter permanent escalation and game over at 8', () => {
    const room = new GameRoom('TEST');
    room.addClient('p1', 'Player 1', createMockSocket());
    room.startMatch('p1');

    const player = room.players.get('p1')!;
    assert.equal(player.redMeter, 0);

    for (let i = 0; i < 7; i++) {
      const npc = Array.from(room.npcs.values())[i];
      npc.pos = { x: player.pos.x, y: player.pos.y, z: player.pos.z };
      npc.health = 20;
      room.handlePlayerAttack('p1');
    }
    assert.equal(player.redMeter, 7, 'Universal hostility reached');
    assert.notEqual(room.status, 'ended');

    // 8th kill causes instant game over
    const lastNpc = Array.from(room.npcs.values())[7];
    lastNpc.pos = { x: player.pos.x, y: player.pos.y, z: player.pos.z };
    lastNpc.health = 20;
    room.handlePlayerAttack('p1');

    assert.equal(player.redMeter, 8);
    assert.equal(room.status, 'ended');
    room.stop();
  });
});
