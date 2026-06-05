import { gameState, CANVAS_WIDTH, CANVAS_HEIGHT } from './state.js';
import { gameAudio, shootSound, pigPickupSound, chickenPickupSound} from './audio.js';
import { checkCollision } from './helpers.js';
import { player } from './player.js';

export function initInput() {
    window.onkeydown = e => {
        let k = e.key.toLowerCase();
        if (gameAudio.paused) gameAudio.play();
        if (k === 'r' && gameState.isGameOver) location.reload();
        if (k === 'arrowup') gameState.moveUp = true; if (k === 'arrowdown') gameState.moveDown = true;
        if (k === 'arrowleft') gameState.moveLeft = true; if (k === 'arrowright') gameState.moveRight = true;
        if (k === 's' && gameState.hasGun && gameState.ammo > 0) { gameState.isShooting = true; shootSound.play(); }
        if (k === 'p') gameState.isPaused = !gameState.isPaused;
        if (k === ' ') { 
            if (gameState.seedInventory > 0) { 
                gameState.plantedWatermelons.push({ x: gameState.playerX, y: gameState.playerY, fIdx: 0, fT: 0, done: false, width: 288, height: 288, hitboxOffsetX: 70, hitboxOffsetY: 70 }); 
                gameState.seedInventory--; 
            } 
        }
        if (k === 'd') {
            if (gameState.carryingPig) { gameState.carryingPig = null; }
            else if (gameState.carryingChicken) { gameState.carryingChicken = null; }
            else if (!gameState.carryingGrenade) {
                let grabbed = false;
                gameState.grenadesOnGround.forEach((g, i) => {
                    if (checkCollision(player, { x: g.x, y: g.y, width: 200, height: 200 })) {
                        gameState.carryingGrenade = true; gameState.grenadesOnGround.splice(i, 1); pigPickupSound.play(); grabbed = true;
                    }
                });
                if (!grabbed) {
                    gameState.pigs.forEach(p => {
                        if (!grabbed && checkCollision(player, { x: p.x, y: p.y, width: 240, height: 240 })) {
                            gameState.carryingPig = p; pigPickupSound.currentTime = 0; pigPickupSound.play(); grabbed = true;
                        }
                    });
                    gameState.chickens.forEach(c => {
                        if (!grabbed && checkCollision(player, { x: c.x, y: c.y, width: 240, height: 240 })) {
                            gameState.carryingChicken = c; chickenPickupSound.currentTime = 0; chickenPickupSound.play(); grabbed = true;
                        }
                    });
                }
            }
        }
    };

    window.onkeyup = e => {
        let k = e.key.toLowerCase();
        if (k === 'arrowup') gameState.moveUp = false; if (k === 'arrowdown') gameState.moveDown = false;
        if (k === 'arrowleft') gameState.moveLeft = false; if (k === 'arrowright') gameState.moveRight = false;
        if (k === 's') { gameState.isShooting = false; shootSound.pause(); }
        if (k === 'd' && gameState.carryingGrenade) {
            gameState.carryingGrenade = false;
            gameState.activeGrenades.push({ x: gameState.playerX + 144, y: gameState.playerY + 144, vX: player.facingRight ? 18 : -18, vY: -12, timer: 50, exploded: false });
        }
    };
}