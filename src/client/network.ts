import { ClientMessage, GameSnapshot, PlayerRole, ServerMessage } from '../shared/types.ts';

export class NetworkClient {
  private ws: WebSocket | null = null;
  public playerId: string | null = null;
  public roomCode: string | null = null;
  public isHost: boolean = false;
  public assignedRole: PlayerRole | null = null;
  public assignedHouse: number = 0;
  public latestSnapshot: GameSnapshot | null = null;

  // Event callbacks
  public onLobbyUpdate?: (players: { id: string; name: string; isHost: boolean }[]) => void;
  public onMatchStarted?: (role: PlayerRole, assignedHouse: number) => void;
  public onSnapshot?: (snapshot: GameSnapshot) => void;
  public onCollapseEvent?: (riddle: string) => void;
  public onRedMeterAlert?: (level: number, message: string) => void;
  public onMatchOver?: (winnerId: string, winnerName: string, reason: string) => void;
  public onError?: (msg: string) => void;
  public onConnected?: () => void;
  public onDisconnected?: () => void;

  constructor() {}

  public connect(url?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      // Default to current host port 3000 if not specified
      if (!url) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // In local development Vite runs on 5173 and server on 3000
        const host = window.location.hostname;
        const port = window.location.port === '5173' ? '3000' : (window.location.port ? window.location.port : (protocol === 'wss:' ? '443' : '80'));
        url = `${protocol}//${host}:${port}`;
      }

      try {
        this.ws = new WebSocket(url);
      } catch (err) {
        reject(err);
        return;
      }

      this.ws.onopen = () => {
        if (this.onConnected) this.onConnected();
        resolve();
      };

      this.ws.onclose = () => {
        if (this.onDisconnected) this.onDisconnected();
      };

      this.ws.onerror = (err) => {
        reject(err);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }

  private handleMessage(data: string) {
    try {
      const msg: ServerMessage = JSON.parse(data);

      switch (msg.type) {
        case 'room_created':
        case 'room_joined':
          this.roomCode = msg.roomCode;
          this.playerId = msg.playerId;
          this.isHost = msg.isHost;
          break;

        case 'room_error':
          if (this.onError) this.onError(msg.message);
          break;

        case 'lobby_update':
          if (this.onLobbyUpdate) this.onLobbyUpdate(msg.players);
          break;

        case 'match_started':
          this.assignedRole = msg.assignedRole;
          this.assignedHouse = msg.assignedHouse;
          if (this.onMatchStarted) this.onMatchStarted(msg.assignedRole, msg.assignedHouse);
          break;

        case 'game_snapshot':
          this.latestSnapshot = msg.snapshot;
          if (this.onSnapshot) this.onSnapshot(msg.snapshot);
          break;

        case 'collapse_event':
          if (this.onCollapseEvent) this.onCollapseEvent(msg.riddle);
          break;

        case 'red_meter_alert':
          if (this.onRedMeterAlert) this.onRedMeterAlert(msg.level, msg.message);
          break;

        case 'match_over':
          if (this.onMatchOver) this.onMatchOver(msg.winnerId, msg.winnerName, msg.reason);
          break;
      }
    } catch (e) {
      console.error('Error parsing server message:', e);
    }
  }

  public send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public createRoom(playerName: string) {
    this.send({ type: 'create_room', playerName });
  }

  public joinRoom(roomCode: string, playerName: string) {
    this.send({ type: 'join_room', roomCode, playerName });
  }

  public startMatch() {
    this.send({ type: 'start_match' });
  }

  public sendInput(pos: { x: number; y: number; z: number }, yaw: number, pitch: number, isMoving: boolean, isSprinting: boolean) {
    this.send({
      type: 'player_input',
      pos,
      yaw,
      pitch,
      isMoving,
      isSprinting
    });
  }

  public sendAttack() {
    this.send({ type: 'player_attack' });
  }

  public sendInteract(targetType: 'pickup' | 'door', targetId: string) {
    this.send({ type: 'player_interact', targetType, targetId });
  }

  public leaveRoom() {
    this.send({ type: 'leave_room' });
    this.roomCode = null;
    this.playerId = null;
  }
}
