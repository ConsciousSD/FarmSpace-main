import { gameState, canvas } from './state.js';
import { gameAudio, shootSound, pigPickupSound, chickenPickupSound, watermelonPickupSound, seedPickupSound } from './audio.js';
import { checkCollision } from './helpers.js';
import { player } from './player.js';

export function initInput() {
    window.onkeydown = e => {
        if (!e || !e.key) return; 
        let k = e.key.toLowerCase();

        // =======================================================
        // 🛸 ALIEN MASTER: MIND CONTROL LOCK-ON OVERRIDE
        // =======================================================
        if (gameState.isMultiplayer && gameState.playerRole === 'alien-master') {
            
            // Key S instantly locks onto the nearest free alien running on the field!
            if (k === 's') {
                if (gameState.enemies.length > 0) {
                    // Look for an alien that isn't dead and isn't your currently selected one
                    let freeAlien = gameState.enemies.find(en => en.id !== gameState.controlledEnemyId && !en.isDying);
                    
                    if (freeAlien) {
                        gameState.controlledEnemyId = freeAlien.id;
                        console.log(`Target acquired! Controlling alien: ${freeAlien.id}`);
                    } else {
                        // If only one alien exists, re-lock onto it to be safe
                        gameState.controlledEnemyId = gameState.enemies[0].id;
                    }
                } else {
                    console.log("No aliens on the field yet! Waiting for automatic wave spawns...");
                }
            }

            // Arrow keys move your possessed alien across the board
            if (gameState.controlledEnemyId && gameState.peerConnection && gameState.peerConnection.open) {
                let activeAlien = gameState.enemies.find(en => en.id === gameState.controlledEnemyId);
                if (activeAlien) {
                    let alienSpeed = 35; // Manual driving speed
                    if (e.key === 'ArrowUp') activeAlien.y -= alienSpeed;
                    if (e.key === 'ArrowDown') activeAlien.y += alienSpeed;
                    if (e.key === 'ArrowLeft') activeAlien.x -= alienSpeed;
                    if (e.key === 'ArrowRight') activeAlien.x += alienSpeed;

                    gameState.peerConnection.send({
                        type: 'CONTROL_MOVE',
                        id: gameState.controlledEnemyId,
                        x: activeAlien.x,
                        y: activeAlien.y
                    });
                }
            }
            return; // 🛑 CRITICAL: Exits here so your machine never runs farmer gun mechanics!
        }

        // =======================================================
        // 👩‍🌾 STANDARD SURVIVOR (FARMER) CONTROLS
        // =======================================================
        if (gameAudio.paused) gameAudio.play();
        if (k === 'r' && gameState.isGameOver) location.reload();
        if (k === 'arrowup') gameState.moveUp = true; if (k === 'arrowdown') gameState.moveDown = true;
        if (k === 'arrowleft') gameState.moveLeft = true; if (k === 'arrowright') gameState.moveRight = true;
        if (k === 'p') gameState.isPaused = !gameState.isPaused;

        if (['1', '2', '3', '4', '5'].includes(k)) {
            let slotIndex = parseInt(k) - 1;
            gameState.activeSlot = slotIndex;
            gameState.hasGun = (gameState.inventory[slotIndex] === 'gun');
            gameState.hasScythe = (gameState.inventory[slotIndex] === 'scythe');
        }

        if (k === 's') {
            if (gameState.inventory[gameState.activeSlot] === 'gun' && gameState.ammo > 0) {
                gameState.isShooting = true; shootSound.play(); 
            }
        }

        if (k === 'a') {
            if (gameState.hasScythe && gameState.scytheDurability > 0) {
                let patchX = Math.floor((gameState.playerX + 94) / 100) * 100;
                let patchY = Math.floor((gameState.playerY + 144) / 100) * 100;
                let alreadyPlowed = gameState.plowedPatches.some(p => p.x === patchX && p.y === patchY);

                if (!alreadyPlowed) {
                    gameState.plowedPatches.push({ x: patchX, y: patchY, size: 150, createdAt: Date.now() });
                    seedPickupSound.currentTime = 0; seedPickupSound.play(); 
                    gameState.scytheDurability--;

                    if (gameState.scytheDurability <= 0) {
                        let scytheSlot = gameState.inventory.indexOf('scythe');
                        if (scytheSlot !== -1) gameState.inventory[scytheSlot] = null;
                        gameState.hasScythe = false;
                    }
                }
            }
        }

        if (k === ' ') {
            if (gameState.seedInventory > 0) {
                let playerFeetX = gameState.playerX + 144;
                let playerFeetY = gameState.playerY + 200;
                let targetedPatch = gameState.plowedPatches.find(patch => {
                    return playerFeetX >= patch.x && playerFeetX <= patch.x + patch.size && playerFeetY >= patch.y && playerFeetY <= patch.y + patch.size;
                });

                if (targetedPatch) {
                    gameState.plantedWatermelons.push({
                        x: targetedPatch.x + (targetedPatch.size / 2) - 144, y: targetedPatch.y + (targetedPatch.size / 2) - 144,
                        fIdx: 0, fT: 0, done: false, width: 288, height: 288, hitboxOffsetX: 70, hitboxOffsetY: 70
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
        if (!e || !e.key) return; 
        if (gameState.isMultiplayer && gameState.playerRole === 'alien-master') return;

        let k = e.key.toLowerCase();
        if (k === 'arrowup') gameState.moveUp = false; if (k === 'arrowdown') gameState.moveDown = false;
        if (k === 'arrowleft') gameState.moveLeft = false; if (k === 'arrowright') gameState.moveRight = false;
        if (k === 's') { gameState.isShooting = false; shootSound.pause(); }
        if (k === 'd' && gameState.carryingGrenade) {
            gameState.carryingGrenade = false;
            gameState.activeGrenades.push({ x: gameState.playerX + 144, y: gameState.playerY + 144, vX: player.facingRight ? 18 : -18, vY: -12, timer: 50, exploded: false });
        }
    };

    // =======================================================
    // MOUSE DOWN LEFT-CLICK RE-SELECTION (BACKUP SYSTEM)
    // =======================================================
    window.addEventListener('mousedown', e => {
        if (gameState.isMultiplayer && gameState.playerRole === 'alien-master') {
            const rect = canvas.getBoundingClientRect();
            const clickX = (e.clientX - rect.left) * (2500 / rect.width);
            const clickY = (e.clientY - rect.top) * (2500 / rect.height);

            if (e.button === 0) { 
                let clickedAlien = gameState.enemies.find(en => {
                    let distance = Math.hypot((en.x + 144) - clickX, (en.y + 144) - clickY);
                    return distance < 180; 
                });

                if (clickedAlien) {
                    gameState.controlledEnemyId = clickedAlien.id;
                    console.log(`Successfully mind-controlled target alien via click: ${clickedAlien.id}`);
                }
            }
        }
    });

    const modal = document.getElementById('instructions-modal');
    const openBtn = document.getElementById('help-button');
    const closeBtn = document.getElementById('close-modal-btn');
    if (openBtn && modal && closeBtn) {
        openBtn.addEventListener('click', () => { modal.style.display = 'flex'; gameState.isPaused = true; });
        closeBtn.addEventListener('click', () => { modal.style.display = 'none'; gameState.isPaused = false; });
        window.addEventListener('click', e => { if (e.target === modal) { modal.style.display = 'none'; gameState.isPaused = false; } });
    }
}