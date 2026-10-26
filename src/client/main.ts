import { CockAndKeysGame } from './game.ts';

window.addEventListener('DOMContentLoaded', () => {
  const game = new CockAndKeysGame();
  (window as unknown as { __game: CockAndKeysGame }).__game = game;
});
