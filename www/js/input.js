import { gameState, canvas } from './state.js';
import { gameAudio, shootSound, pigPickupSound, chickenPickupSound, watermelonPickupSound, seedPickupSound } from './audio.js';
import { checkCollision } from './helpers.js';
import { player } from './player.js';

export function initInput() {
    // Keyboard Listeners
    window.onkeydown = e => {
        if (!e || !e.key) return; 
        let k = e.key.toLowerCase();

        // 🛸 ALIEN MASTER: MIND CONTROL LOCK-ON OVERRIDE
        if (gameState.isMultiplayer && gameState.playerRole === 'alien-master') {
            if (k === 's') {
                if (gameState.enemies.length > 0) {
                    let freeAlien = gameState.enemies.find(en => en.id !== gameState.controlledEnemyId && !en.isDying);
                    gameState.controlledEnemyId = freeAlien ? freeAlien.id : gameState.enemies[0].id;
                }
            }
            if (gameState.controlledEnemyId && gameState.peerConnection?.open) {
                let activeAlien = gameState.enemies.find(en => en.id === gameState.controlledEnemyId);
                if (activeAlien) {
                    let alienSpeed = 35;
                    if (k === 'arrowup') activeAlien.y -= alienSpeed;
                    if (k === 'arrowdown') activeAlien.y += alienSpeed;
                    if (k === 'arrowleft') activeAlien.x -= alienSpeed;
                    if (k === 'arrowright') activeAlien.x += alienSpeed;

                    gameState.peerConnection.send({ type: 'CONTROL_MOVE', id: gameState.controlledEnemyId, x: activeAlien.x, y: activeAlien.y });
                }
            }
            return;
        }

        // 👩‍🌾 STANDARD SURVIVOR (FARMER) CONTROLS
        if (gameAudio.paused) gameAudio.play();
        if (k === 'r' && gameState.isGameOver) location.reload();
        if (k === 'arrowup') gameState.moveUp = true; if (k === 'arrowdown') gameState.moveDown = true;
        if (k === 'arrowleft') gameState.moveLeft = true; if (k === 'arrowright') gameState.moveRight = true;
        if (k === 'p') gameState.isPaused = !gameState.isPaused;

        // Weapon Selection
        if (['1', '2', '3', '4', '5'].includes(k)) {
            let slotIndex = parseInt(k) - 1;
            gameState.activeSlot = slotIndex;
            gameState.hasGun = (gameState.inventory[slotIndex] === 'gun');
            gameState.hasScythe = (gameState.inventory[slotIndex] === 'scythe');
        }

        // Combat Hub
        if (k === 's') {
            let activeWeapon = gameState.inventory[gameState.activeSlot];
            if (activeWeapon === 'gun' && gameState.ammo > 0) { gameState.isShooting = true; shootSound.play(); } 
            else if (activeWeapon === 'serpent_sword' || (gameState.selectedWeapon === 'serpent_sword' && gameState.activeSlot === 1)) { gameState.isShooting = true; }
        }

        // Farming/Interaction
        if (k === 'a') { /* ... existing scythe logic ... */ }
        if (k === ' ') { /* ... existing planting logic ... */ }
        if (k === 'd') { /* ... existing pickup logic ... */ }
    };

    window.onkeyup = e => {
        if (!e || !e.key) return; 
        if (gameState.isMultiplayer && gameState.playerRole === 'alien-master') return;

        let k = e.key.toLowerCase();
        if (k === 'arrowup') gameState.moveUp = false; if (k === 'arrowdown') gameState.moveDown = false;
        if (k === 'arrowleft') gameState.moveLeft = false; if (k === 'arrowright') gameState.moveRight = false;
        if (k === 's') { gameState.isShooting = false; try { shootSound.pause(); } catch(err) {} }
        if (k === 'd' && gameState.carryingGrenade) { /* ... grenade logic ... */ }
    };

    // Initialize Touch Controls
    initTouchInput();

    // Mouse logic remains the same...
    window.addEventListener('mousedown', e => { /* ... existing mouse logic ... */ });
    window.addEventListener('contextmenu', e => { if (gameState.isMultiplayer && gameState.playerRole === 'alien-master') e.preventDefault(); });
}

function initTouchInput() {
    function handleTouch(e, isPressed) {
        // Prevent browser zoom/scroll
        if (e.cancelable) e.preventDefault();
        
        const touch = e.touches[0] || e.changedTouches[0];
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const x = touch.clientX;
        const y = touch.clientY;

        // Reset if released
        if (!isPressed) {
            gameState.moveUp = gameState.moveDown = gameState.moveLeft = gameState.moveRight = false;
            return;
        }

        // Directional Zones (Simple D-Pad layout)
        gameState.moveLeft = (x < screenWidth * 0.33);
        gameState.moveRight = (x > screenWidth * 0.66);
        gameState.moveUp = (y < screenHeight * 0.33);
        gameState.moveDown = (y > screenHeight * 0.66);
    }

    canvas.addEventListener('touchstart', (e) => handleTouch(e, true), { passive: false });
    canvas.addEventListener('touchmove', (e) => handleTouch(e, true), { passive: false });
    canvas.addEventListener('touchend', (e) => handleTouch(e, false), { passive: false });
}