// 1. Import gameState and CANVAS_HEIGHT from state.js
import { gameState, CANVAS_HEIGHT } from './state.js';

// 2. Import the audio files from audio.js
import { moveSound, shootSound, gameAudio } from './audio.js';

// 3. Import the player object from player.js
import { player } from './player.js';

// FIXED: Import the sprites from assets.js instead of state.js
import { enemySprite, enemySprite2, enemySprite3 } from './assets.js';

export function checkCollision(a, b, isItem = false) {
    let padding = isItem ? 60 : 0;
    let aW = (gameState.isPowered && a === player) ? 576 : 288;
    let aH = (gameState.isPowered && a === player) ? 576 : 288;
    let ax1 = a.x + (a.hitboxOffsetX || 0) - padding;
    let ay1 = a.y + (a.hitboxOffsetY || 0) - padding;
    let ax2 = a.x + aW - (a.hitboxOffsetX || 0) + padding;
    let ay2 = a.y + aH - (a.hitboxOffsetY || 0) + padding;
    let bx1 = b.x + (b.hitboxOffsetX || 0);
    let by1 = b.y + (b.hitboxOffsetY || 0);
    let bx2 = b.x + (b.width || 288) - (b.hitboxOffsetX || 0);
    let by2 = b.y + (b.height || 288) - (b.hitboxOffsetY || 0);
    return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
}

export function createEnemy(type = 1) {
    let ex, ey;
    do { 
        ex = Math.random() * 2200; 
        ey = Math.random() * 2200; 
    } while (Math.hypot(gameState.playerX - ex, gameState.playerY - ey) < 700);
    
    let img = type === 1 ? enemySprite : (type === 2 ? enemySprite2 : enemySprite3);
    return {
        x: ex, y: ey, type, img,
        width: 288, height: type === 2 ? 432 : 288,
        speed: type === 1 ? 2 : (type === 2 ? 2.4 : 3.5),
        health: type === 2 ? 5 : 1,
        fIdx: 0, fT: 0, hitboxOffsetX: 90, hitboxOffsetY: 90,
        isDying: false, deathFrame: 0, deathTimer: 0
    };
}

export function triggerGameOver() {
    if (gameState.isGameOver) return;
    gameState.isGameOver = true;
    moveSound.pause(); shootSound.pause();
    gameAudio.volume = 0.1;
    if (gameState.enemyKillScore > gameState.highScore) { 
        gameState.highScore = gameState.enemyKillScore; localStorage.setItem('farmSpaceHighScore', gameState.highScore); 
    }
    if (gameState.pigsSaved > gameState.pigHighScore) { 
        gameState.pigHighScore = gameState.pigsSaved; localStorage.setItem('farmSpacePigHighScore', gameState.pigHighScore); 
    }
    if (gameState.chickensSaved > gameState.chickenHighScore) { 
        gameState.chickenHighScore = gameState.chickensSaved; localStorage.setItem('farmSpaceChickenHighScore', gameState.chickenHighScore); 
    }
}