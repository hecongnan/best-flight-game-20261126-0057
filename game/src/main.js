// Ember Canyon bootstrap: build the game on the #app element and
// expose it for debugging. The module script is deferred, so the DOM
// is ready when this runs.

import { CanyonRunGame } from './game.js';

const root = document.getElementById('app');
const game = new CanyonRunGame(root);
window.__emberGame = game;
