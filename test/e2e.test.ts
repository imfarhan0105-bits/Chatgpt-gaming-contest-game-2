import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { WebSocket } from 'ws';
import { fork } from 'node:child_process';

describe('Cock & Keys — Live Server E2E Tests', () => {
  test('Live HTTP and WebSocket E2E room flow', async () => {
    const serverProcess = fork('src/server/index.ts', [], {
      execArgv: ['--experimental-strip-types'],
      env: { ...process.env, PORT: '3456' }
    });

    // Wait 500ms for server to bind
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      // 1. Test HTTP Health Endpoint
      const healthRes = await fetch('http://localhost:3456/health');
      assert.equal(healthRes.status, 200);
      const healthJson = await healthRes.json();
      assert.equal(healthJson.status, 'ok');
      assert.equal(healthJson.game, 'Cock & Keys');

      // 2. Test HTTP Index Serving
      const indexRes = await fetch('http://localhost:3456/');
      assert.equal(indexRes.status, 200);
      const indexHtml = await indexRes.text();
      assert.ok(indexHtml.includes('COCK &amp; KEYS') || indexHtml.includes('Cock &amp; Keys'));

      // 3. Test Real WebSocket Room Creation & Multiplayer Join
      const client1 = new WebSocket('ws://localhost:3456');
      const client2 = new WebSocket('ws://localhost:3456');

      await new Promise<void>((resolve) => client1.once('open', () => resolve()));
      await new Promise<void>((resolve) => client2.once('open', () => resolve()));

      // Player 1 creates room
      const roomCreatedPromise = new Promise<{ roomCode: string; playerId: string }>((resolve) => {
        client1.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'room_created') {
            resolve({ roomCode: msg.roomCode, playerId: msg.playerId });
          }
        });
      });

      client1.send(JSON.stringify({ type: 'create_room', playerName: 'Player One' }));
      const { roomCode, playerId: p1Id } = await roomCreatedPromise;

      assert.ok(roomCode, 'Room code must be generated');
      assert.equal(roomCode.length, 4, 'Room code must be 4 characters');

      // Player 2 joins room with room code
      const roomJoinedPromise = new Promise<void>((resolve) => {
        client2.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'room_joined') {
            assert.equal(msg.roomCode, roomCode);
            resolve();
          }
        });
      });

      client2.send(JSON.stringify({ type: 'join_room', roomCode, playerName: 'Player Two' }));
      await roomJoinedPromise;

      // Start match
      const matchStartedPromise = new Promise<void>((resolve) => {
        let count = 0;
        const check = () => {
          count++;
          if (count === 2) resolve();
        };
        client1.on('message', (d) => {
          if (JSON.parse(d.toString()).type === 'match_started') check();
        });
        client2.on('message', (d) => {
          if (JSON.parse(d.toString()).type === 'match_started') check();
        });
      });

      client1.send(JSON.stringify({ type: 'start_match' }));
      await matchStartedPromise;

      // Clean up clients
      client1.close();
      client2.close();
    } finally {
      serverProcess.kill('SIGKILL');
    }
  });
});
