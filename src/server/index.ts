import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import type { ClientMessage, ServerMessage } from '../shared/types.ts';
import { GameRoom } from './room.ts';

const PORT = parseInt(process.env.PORT || '3000', 10);
const DIST_DIR = join(process.cwd(), 'dist');

const rooms: Map<string, GameRoom> = new Map();
const clientToRoom: Map<WebSocket, { roomCode: string; clientId: string }> = new Map();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

// MIME types for static asset serving
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// HTTP Server serving static dist files
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  // Health check / API status
  if (req.url === '/health' || req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      game: 'Cock & Keys',
      activeRooms: rooms.size,
      uptime: process.uptime()
    }));
    return;
  }

  // Serve static files if dist exists
  if (existsSync(DIST_DIR)) {
    let filePath = join(DIST_DIR, req.url === '/' ? 'index.html' : req.url || 'index.html');
    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      filePath = join(DIST_DIR, 'index.html');
    }

    const ext = filePath.slice(filePath.lastIndexOf('.'));
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Cock & Keys Server Running</h1><p>Client build not found in dist/. Run <code>pnpm run build:client</code></p>');
  }
});

// WebSocket Server
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws: WebSocket) => {
  const clientId = `usr_${Math.random().toString(36).substring(2, 9)}`;

  ws.on('message', (rawData: string) => {
    try {
      const msg: ClientMessage = JSON.parse(rawData.toString());

      switch (msg.type) {
        case 'create_room': {
          const roomCode = generateRoomCode();
          const room = new GameRoom(roomCode);
          rooms.set(roomCode, room);

          const client = room.addClient(clientId, msg.playerName || 'Resident', ws);
          clientToRoom.set(ws, { roomCode, clientId });

          const resp: ServerMessage = {
            type: 'room_created',
            roomCode,
            playerId: clientId,
            isHost: client.isHost
          };
          ws.send(JSON.stringify(resp));
          break;
        }

        case 'join_room': {
          const code = msg.roomCode.toUpperCase();
          const room = rooms.get(code);

          if (!room) {
            const errResp: ServerMessage = {
              type: 'room_error',
              message: `Room code "${code}" not found.`
            };
            ws.send(JSON.stringify(errResp));
            return;
          }

          if (room.status !== 'lobby') {
            const errResp: ServerMessage = {
              type: 'room_error',
              message: `Match already in progress in room "${code}".`
            };
            ws.send(JSON.stringify(errResp));
            return;
          }

          if (room.clients.size >= 4) {
            const errResp: ServerMessage = {
              type: 'room_error',
              message: `Room "${code}" is full (maximum 4 players).`
            };
            ws.send(JSON.stringify(errResp));
            return;
          }

          const client = room.addClient(clientId, msg.playerName || 'Resident', ws);
          clientToRoom.set(ws, { roomCode: code, clientId });

          const joinResp: ServerMessage = {
            type: 'room_joined',
            roomCode: code,
            playerId: clientId,
            isHost: client.isHost
          };
          ws.send(JSON.stringify(joinResp));
          break;
        }

        case 'start_match': {
          const mapping = clientToRoom.get(ws);
          if (!mapping) return;
          const room = rooms.get(mapping.roomCode);
          if (room) {
            room.startMatch(mapping.clientId);
          }
          break;
        }

        case 'player_input': {
          const mapping = clientToRoom.get(ws);
          if (!mapping) return;
          const room = rooms.get(mapping.roomCode);
          if (room) {
            room.handlePlayerInput(mapping.clientId, msg.pos, msg.yaw, msg.pitch, msg.isMoving, msg.isSprinting);
          }
          break;
        }

        case 'player_attack': {
          const mapping = clientToRoom.get(ws);
          if (!mapping) return;
          const room = rooms.get(mapping.roomCode);
          if (room) {
            room.handlePlayerAttack(mapping.clientId);
          }
          break;
        }

        case 'player_interact': {
          const mapping = clientToRoom.get(ws);
          if (!mapping) return;
          const room = rooms.get(mapping.roomCode);
          if (room) {
            room.handlePlayerInteract(mapping.clientId, msg.targetType, msg.targetId);
          }
          break;
        }

        case 'leave_room': {
          const mapping = clientToRoom.get(ws);
          if (mapping) {
            const room = rooms.get(mapping.roomCode);
            if (room) {
              room.removeClient(mapping.clientId);
              if (room.clients.size === 0) {
                rooms.delete(mapping.roomCode);
              }
            }
            clientToRoom.delete(ws);
          }
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    const mapping = clientToRoom.get(ws);
    if (mapping) {
      const room = rooms.get(mapping.roomCode);
      if (room) {
        room.removeClient(mapping.clientId);
        if (room.clients.size === 0) {
          rooms.delete(mapping.roomCode);
        }
      }
      clientToRoom.delete(ws);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[Cock & Keys] Authoritative Multiplayer Server running on port ${PORT}`);
  console.log(`[Cock & Keys] Static Web Client: http://localhost:${PORT}`);
  console.log(`[Cock & Keys] WebSocket Endpoint: ws://localhost:${PORT}`);
});
