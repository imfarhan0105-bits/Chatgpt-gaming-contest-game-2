import { GameSnapshot, PlayerRole } from '../shared/types.ts';

export class UIManager {
  // Elements
  private hud: HTMLElement;
  private crosshair: HTMLElement;
  private interactionPrompt: HTMLElement;
  private clickToPlayOverlay: HTMLElement;
  private collapseOverlay: HTMLElement;
  private mainMenu: HTMLElement;
  private lobbyModal: HTMLElement;
  private gameOverModal: HTMLElement;

  // HUD Elements
  private roleNameEl: HTMLElement;
  private roomCodeEl: HTMLElement;
  private assignedHouseEl: HTMLElement;
  private matchTimerEl: HTMLElement;
  private playerCountEl: HTMLElement;
  private healthBarFill: HTMLElement;
  private healthTextEl: HTMLElement;
  private redMeterLabelEl: HTMLElement;
  private redMeterStatusEl: HTMLElement;
  private redMeterPips: HTMLElement[];
  private riddleBox: HTMLElement;
  private riddleText: HTMLElement;

  // Lobby Elements
  private lobbyRoomCodeEl: HTMLElement;
  private lobbyPlayerListEl: HTMLElement;
  private btnStartMatch: HTMLElement;
  private lobbyWaitingText: HTMLElement;

  // Game over elements
  private gameOverTitle: HTMLElement;
  private gameOverDesc: HTMLElement;

  // Inputs & Buttons
  public playerNameInput: HTMLInputElement;
  public roomCodeInput: HTMLInputElement;
  public btnCreateRoom: HTMLButtonElement;
  public btnJoinRoom: HTMLButtonElement;
  public btnSinglePlayer: HTMLButtonElement;
  public btnLeaveLobby: HTMLButtonElement;
  public btnPlayAgain: HTMLButtonElement;
  private menuErrorEl: HTMLElement;

  constructor() {
    this.hud = document.getElementById('hud')!;
    this.crosshair = document.getElementById('crosshair')!;
    this.interactionPrompt = document.getElementById('interaction-prompt')!;
    this.clickToPlayOverlay = document.getElementById('click-to-play-overlay')!;
    this.collapseOverlay = document.getElementById('collapse-overlay')!;
    this.mainMenu = document.getElementById('main-menu')!;
    this.lobbyModal = document.getElementById('lobby-modal')!;
    this.gameOverModal = document.getElementById('game-over-modal')!;

    this.roleNameEl = document.getElementById('hud-role-name')!;
    this.roomCodeEl = document.getElementById('hud-room-code')!;
    this.assignedHouseEl = document.getElementById('hud-assigned-house')!;
    this.matchTimerEl = document.getElementById('hud-match-timer')!;
    this.playerCountEl = document.getElementById('hud-player-count')!;
    this.healthBarFill = document.getElementById('health-bar-fill')!;
    this.healthTextEl = document.getElementById('hud-health-text')!;
    this.redMeterLabelEl = document.getElementById('hud-red-meter-label')!;
    this.redMeterStatusEl = document.getElementById('hud-red-meter-status')!;

    this.redMeterPips = [];
    for (let i = 1; i <= 8; i++) {
      const pip = document.getElementById(`pip-${i}`);
      if (pip) this.redMeterPips.push(pip);
    }

    this.riddleBox = document.getElementById('riddle-box')!;
    this.riddleText = document.getElementById('riddle-text')!;

    this.lobbyRoomCodeEl = document.getElementById('lobby-room-code')!;
    this.lobbyPlayerListEl = document.getElementById('lobby-player-list')!;
    this.btnStartMatch = document.getElementById('btn-start-match')!;
    this.lobbyWaitingText = document.getElementById('lobby-waiting-text')!;

    this.gameOverTitle = document.getElementById('game-over-title')!;
    this.gameOverDesc = document.getElementById('game-over-desc')!;

    this.playerNameInput = document.getElementById('player-name-input') as HTMLInputElement;
    this.roomCodeInput = document.getElementById('room-code-input') as HTMLInputElement;
    this.btnCreateRoom = document.getElementById('btn-create-room') as HTMLButtonElement;
    this.btnJoinRoom = document.getElementById('btn-join-room') as HTMLButtonElement;
    this.btnSinglePlayer = document.getElementById('btn-single-player') as HTMLButtonElement;
    this.btnLeaveLobby = document.getElementById('btn-leave-lobby') as HTMLButtonElement;
    this.btnPlayAgain = document.getElementById('btn-play-again') as HTMLButtonElement;
    this.menuErrorEl = document.getElementById('menu-error')!;
  }

  public showMainMenu() {
    this.mainMenu.style.display = 'flex';
    this.lobbyModal.style.display = 'none';
    this.gameOverModal.style.display = 'none';
    this.hud.style.display = 'none';
    this.crosshair.style.display = 'none';
    this.clickToPlayOverlay.style.display = 'none';
    this.collapseOverlay.classList.remove('active');
  }

  public showMenuError(msg: string) {
    this.menuErrorEl.textContent = msg;
    this.menuErrorEl.style.display = 'block';
  }

  public hideMenuError() {
    this.menuErrorEl.style.display = 'none';
  }

  public showLobby(roomCode: string, players: { id: string; name: string; isHost: boolean }[], isHost: boolean) {
    this.mainMenu.style.display = 'none';
    this.lobbyModal.style.display = 'flex';
    this.gameOverModal.style.display = 'none';
    this.hud.style.display = 'none';

    this.lobbyRoomCodeEl.textContent = roomCode;
    this.lobbyPlayerListEl.innerHTML = '';

    players.forEach((p) => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.background = '#1a1f2c';
      li.style.padding = '8px 12px';
      li.style.borderRadius = '6px';
      li.style.border = '1px solid #333';
      li.innerHTML = `
        <span style="font-weight: 600; color: #fff;">${p.name} ${p.isHost ? '<span style="color:#ffb703; font-size:11px;">(HOST)</span>' : ''}</span>
        <span style="color: #2a9d8f; font-size: 12px;">Ready</span>
      `;
      this.lobbyPlayerListEl.appendChild(li);
    });

    if (isHost) {
      this.btnStartMatch.style.display = 'block';
      this.lobbyWaitingText.style.display = 'none';
    } else {
      this.btnStartMatch.style.display = 'none';
      this.lobbyWaitingText.style.display = 'block';
    }
  }

  public showGameHUD(role: PlayerRole, roomCode: string, assignedHouse: number) {
    this.mainMenu.style.display = 'none';
    this.lobbyModal.style.display = 'none';
    this.gameOverModal.style.display = 'none';
    this.hud.style.display = 'block';
    this.crosshair.style.display = 'block';

    const roleNameCapitalized = role.charAt(0).toUpperCase() + role.slice(1);
    this.roleNameEl.textContent = `Role: ${roleNameCapitalized}`;
    this.roomCodeEl.textContent = `Room: ${roomCode}`;
    this.assignedHouseEl.textContent = `Assigned: House #${assignedHouse + 1}`;
  }

  public showClickToPlay(show: boolean) {
    this.clickToPlayOverlay.style.display = show ? 'flex' : 'none';
  }

  public setInteractionPrompt(text: string | null) {
    if (text) {
      this.interactionPrompt.textContent = text;
      this.interactionPrompt.style.display = 'block';
    } else {
      this.interactionPrompt.style.display = 'none';
    }
  }

  public updateHealth(current: number, max: number) {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    this.healthBarFill.style.width = `${pct}%`;
    this.healthTextEl.textContent = `${Math.ceil(current)} / ${max}`;
  }

  public updateRedMeter(level: number) {
    this.redMeterLabelEl.textContent = `${level} / 8`;
    this.redMeterPips.forEach((pip, idx) => {
      if (idx < level) {
        pip.classList.add('active');
      } else {
        pip.classList.remove('active');
      }
    });

    if (level === 0) {
      this.redMeterStatusEl.textContent = 'Status: Peaceful';
      this.redMeterStatusEl.style.color = '#888';
    } else if (level <= 4) {
      this.redMeterStatusEl.textContent = 'Status: Suspicious stares';
      this.redMeterStatusEl.style.color = '#ffd166';
    } else if (level <= 6) {
      this.redMeterStatusEl.textContent = 'Status: Faction Retaliation!';
      this.redMeterStatusEl.style.color = '#f77f00';
    } else if (level === 7) {
      this.redMeterStatusEl.textContent = 'Status: TOWN-WIDE HUNT!';
      this.redMeterStatusEl.style.color = '#d62828';
    } else {
      this.redMeterStatusEl.textContent = 'Status: DISQUALIFIED!';
      this.redMeterStatusEl.style.color = '#e63946';
    }
  }

  public showCollapseScreen() {
    this.collapseOverlay.classList.add('active');
  }

  public hideCollapseScreen() {
    this.collapseOverlay.classList.remove('active');
  }

  public showRiddle(riddleText: string) {
    this.riddleText.textContent = `"${riddleText}"`;
    this.riddleBox.style.display = 'block';
    this.assignedHouseEl.textContent = 'Assigned: ??? (Memory Lost)';
    this.assignedHouseEl.style.color = '#e63946';
  }

  public updateTimer(seconds: number, isOvertime: boolean) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    this.matchTimerEl.textContent = isOvertime ? `OVERTIME: ${timeStr}` : timeStr;
    this.matchTimerEl.style.color = isOvertime ? '#ff3344' : '#ffd166';
  }

  public updatePlayerCount(count: number) {
    this.playerCountEl.textContent = `Players: ${count}/4`;
  }

  public showGameOver(winnerName: string, reason: string, isWin: boolean) {
    this.gameOverTitle.textContent = isWin ? 'VICTORY!' : 'MATCH OVER';
    this.gameOverTitle.style.color = isWin ? '#ffb703' : '#e63946';
    this.gameOverDesc.textContent = `${winnerName} won the match! ${reason}`;
    this.gameOverModal.style.display = 'flex';
    this.clickToPlayOverlay.style.display = 'none';
  }
}
