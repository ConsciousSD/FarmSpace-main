import { gameState, CANVAS_WIDTH, CANVAS_HEIGHT } from './state.js';
import { gameAudio, shootSound, pigPickupSound, chickenPickupSound, watermelonPickupSound, seedPickupSound } from './audio.js';
import { checkCollision } from './helpers.js';
import { player } from './player.js';

export function initInput() {
    window.onkeydown = e => {
        let k = e.key.toLowerCase();
        if (gameAudio.paused) gameAudio.play();
        if (k === 'r' && gameState.isGameOver) location.reload();
        if (k === 'arrowup') gameState.moveUp = true; if (k === 'arrowdown') gameState.moveDown = true;
        if (k === 'arrowleft') gameState.moveLeft = true; if (k === 'arrowright') gameState.moveRight = true;
        if (k === 'p') gameState.isPaused = !gameState.isPaused;

        // Hotbar Slot Selection (Keys 1-5)
        if (['1', '2', '3', '4', '5'].includes(k)) {
            let slotIndex = parseInt(k) - 1;
            gameState.activeSlot = slotIndex;
            
            // Sync legacy engine flags based on active slot contents
            gameState.hasGun = (gameState.inventory[slotIndex] === 'gun');
            gameState.hasScythe = (gameState.inventory[slotIndex] === 'scythe');
        }

        // Shoot check bound dynamically to active item type 'gun'
        if (k === 's') {
            if (gameState.inventory[gameState.activeSlot] === 'gun' && gameState.ammo > 0) {
                gameState.isShooting = true; 
                shootSound.play(); 
            }
        }

        // Key 'A' specifically handles plowing the ground
        if (k === 'a') {
            if (gameState.hasScythe) {
                // 1. Calculate tile coordinates centered near player feet
                let patchX = Math.floor((gameState.playerX + 94) / 100) * 100;
                let patchY = Math.floor((gameState.playerY + 144) / 100) * 100;

                // 2. Only plow if this exact spot isn't already a dirt patch
                let alreadyPlowed = gameState.plowedPatches.some(p => p.x === patchX && p.y === patchY);

                if (!alreadyPlowed) {
                    gameState.plowedPatches.push({ x: patchX, y: patchY, size: 150 });
                    seedPickupSound.currentTime = 0;
                    seedPickupSound.play(); 
                }
            }
        }

        // Spacebar now ONLY plants watermelons if standing inside a plowed patch
        if (k === ' ') {
            if (gameState.seedInventory > 0) {
                let playerFeetX = gameState.playerX + 144; // Mid-axis of player footprint
                let playerFeetY = gameState.playerY + 200; // Y coordinate near player feet

                // Check if the player's coordinate rests inside ANY plowed patch square element bounds
                let targetedPatch = gameState.plowedPatches.find(patch => {
                    return playerFeetX >= patch.x && 
                           playerFeetX <= patch.x + patch.size && 
                           playerFeetY >= patch.y && 
                           playerFeetY <= patch.y + patch.size;
                });

                if (targetedPatch) {
                    // Snaps and centers the 288px watermelon asset inside the 150px dirt patch perfectly
                    gameState.plantedWatermelons.push({
                        x: targetedPatch.x + (targetedPatch.size / 2) - 144,
                        y: targetedPatch.y + (targetedPatch.size / 2) - 144,
                        fIdx: 0,
                        fT: 0,
                        done: false,
                        width: 288,
                        height: 288,
                        hitboxOffsetX: 70,
                        hitboxOffsetY: 70
                    });
                    gameState.seedInventory--;
                }
            }
        }

        if (k === 'd') {
            if (gameState.carryingPig) { gameState.carryingPig = null; }
            else if (gameState.carryingChicken) { gameState.carryingChicken = null; }
            else if (!gameState.carryingGrenade) {
                let grabbed = false;
                gameState.grenadesOnGround.forEach((g, i) => {
                    if (checkCollision(player, { x: g.x, y: g.y, width: 200, height: 200 })) {
                        gameState.carryingGrenade = true; gameState.grenadesOnGround.splice(i, 1); watermelonPickupSound.play(); grabbed = true;
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

    // FIXED: Hooked up DOM listeners to run the Manual modal window
    const modal = document.getElementById('instructions-modal');
    const openBtn = document.getElementById('help-button');
    const closeBtn = document.getElementById('close-modal-btn');

    if (openBtn && modal && closeBtn) {
        // Tapping button freezes the environment layout metrics and blurs background
        openBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
            gameState.isPaused = true;
        });

        // Unfreezes engine frames and hides manual overlay card
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            gameState.isPaused = false;
        });

        // Click outside the box container boundary fallback
        window.addEventListener('click', e => {
            if (e.target === modal) {
                modal.style.display = 'none';
                gameState.isPaused = false;
            }
        });
    }
}
