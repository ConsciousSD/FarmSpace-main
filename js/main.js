import { gameState, ctx, CANVAS_WIDTH, CANVAS_HEIGHT } from './state.js';
import { initInput } from './input.js';
import { player } from './player.js';
import { checkCollision, createEnemy, triggerGameOver } from './helpers.js';
import { gameAudio, moveSound, shootSound, seedPickupSound, grenadeExplosionSound, tirePickupSound, watermelonPickupSound, pigWalkSound } from './audio.js';
import { enemySprite, enemySprite2, enemySprite3, corralSprite, grenadeSprite, scytheSprite, seedSprite, tireSprite, ak47Idle, enemyDeathSprite, enemyDeathSprite2, pigIdle, pigWalk, chickenSprite, watermelonSprite, charmSprite, poltraGetsGun, poltraWithGun, laserBullet } from './assets.js';
import { initMultiplayer } from './network.js';

// Global reference array to completely track and destroy intervals on reset
let gameIntervals = [];

// Initialize damage number tracker array globally if not present in baseline state
if (!gameState.damageNumbers) gameState.damageNumbers = [];

// Setup difficulty scaling intervals
setInterval(() => {
    if (!gameState.isPaused && !gameState.isGameOver && !gameState.isMultiplayer) {
        gameState.spawnRateMultiplier *= 0.90;
    }
}, 60000);

// Helper function to spin up a floating particle number over a target
function createDamageNumber(x, y, amount, isCritical = false) {
    gameState.damageNumbers.push({
        x: x + Math.random() * 60 - 30,
        y: y - 10,
        text: amount,
        color: isCritical ? '#ffcc00' : '#00ffff',
        size: isCritical ? 38 : 28,
        alpha: 1.0,
        vY: -2.5 - Math.random() * 1.5
    });
}

// UI RENDERING METHOD: Draws a clean sci-fi Rocket Fuel bar right below the hotbar slots
function drawRocketFuelBar() {
    const barWidth = 400;
    const barHeight = 26;
    const x = (CANVAS_WIDTH - barWidth) / 2;
    const y = 125; // Sits neatly under hotbar slots container background

    // Background Panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Progression Clamp Math
    let currentFuel = gameState.rocketFuel || 0;
    let maxFuel = gameState.maxRocketFuel || 500;
    let fillPct = Math.max(0, Math.min(1, currentFuel / maxFuel));

    // Fill Color: Rocket Fire Orange
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(x + 3, y + 3, (barWidth - 6) * fillPct, barHeight - 6);

    // Frame Border Strokes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barWidth, barHeight);

    // Centered Typography Text Data
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText(`ROCKET FUEL: ${currentFuel} / ${maxFuel}`, x + barWidth / 2, y + barHeight / 2);
}

// Helper method to execute a client master drone respawn over the link lane
function dispatchMasterVesselSpawn() {
    let uniqueDroneId = "master-drone-" + Math.floor(Math.random() * 99999);
    gameState.controlledEnemyId = uniqueDroneId;
    gameState.isAlienDead = false;
    gameState.alienRespawnTimer = 0;

    gameState.enemies.push({
        id: uniqueDroneId,
        type: 1,
        x: 1250,
        y: 1250,
        fIdx: 0,
        fT: 0,
        width: 288,
        height: 288,
        health: 50, // ADJUSTED: Enemy player health set to a 50 HP pool limit
        hasGun: true,
        pickupDone: true
    });

    if (gameState.peerConnection && gameState.peerConnection.open) {
        try {
            gameState.peerConnection.send({
                type: 'SPAWN_MASTER_VESSEL',
                id: uniqueDroneId
            });
            console.log("Sent fresh master vessel spawn request to host.");
        } catch (err) {
            console.warn("Could not sync master vessel spawn over network:", err);
        }
    }
}

// Reset game variables safely in memory without killing the room session connection
export function resetGameSession() {
    gameIntervals.forEach(clearInterval);
    gameIntervals = [];

    gameState.isGameOver = false;
    gameState.isGameWon = false; // SYSTEM RESET: Lower the victory flag configuration
    gameState.isPaused = false;
    gameState.enemyKillScore = 0;
    gameState.pigsSaved = 0;
    gameState.chickensSaved = 0;
    gameState.seedInventory = 0;
    gameState.rocketFuel = 0; // SYSTEM RESET: Resets rocket fuel back to 0 points
    gameState.ammo = 0;
    gameState.hasGun = false;
    gameState.gunCoolDownActive = false;
    gameState.killsSinceEmpty = 0;

    gameState.isAlienDead = false;
    gameState.alienRespawnTimer = 0;

    gameState.playerX = 500;
    gameState.playerY = 500;
    player.x = 500;
    player.y = 500;

    gameState.inventory = ['scythe', null, null, null, null];
    gameState.activeSlot = 0;
    gameState.hasScythe = true;
    gameState.scytheDurability = gameState.maxScytheDurability;

    gameState.enemies = [];
    gameState.damageNumbers = [];
    gameState.plowedPatches = [];
    gameState.plantedWatermelons = [];
    gameState.seeds = [];
    gameState.pigs = [];
    gameState.chickens = [];
    gameState.charms = [];
    gameState.grenadesOnGround = [];
    gameState.activeGrenades = [];
    gameState.carryingGrenade = false;
    gameState.guns = [];
    gameState.enemyLasers = []; // 🎯 Clean projectile arrays out safely

    if (gameState.playerRole === 'alien-master') {
        dispatchMasterVesselSpawn();
    }

    if (gameState.playerRole === 'farmer') {
        clearTimeout(window.spawnTickTimeout);
        spawnTick();
        startTrackingIntervals();
    }

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    gameLoop();

    window.focus();
    console.log("LOBBY RETAINED: Soft session restart processed cleanly.");
}

function gameLoop() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // --- BASE BACKGROUND LAYER ---
    ctx.drawImage(corralSprite, gameState.corral.x, gameState.corral.y, gameState.corral.width, gameState.corral.height);

    // Filter empty plowed patches older than 15s
    let patchLifetime = 15000;
    gameState.plowedPatches = gameState.plowedPatches.filter(patch => {
        let hasCrop = gameState.plantedWatermelons.some(wm => {
            return Math.abs((wm.x + 144) - (patch.x + 75)) < 80 &&
                Math.abs((wm.y + 144) - (patch.y + 75)) < 80;
        });
        if (hasCrop) return true;
        return (Date.now() - patch.createdAt) < patchLifetime;
    });

    gameState.plowedPatches.forEach(patch => {
        ctx.fillStyle = '#5c4033'; ctx.fillRect(patch.x, patch.y, patch.size, patch.size);
        ctx.strokeStyle = '#4a3329'; ctx.lineWidth = 4; ctx.strokeRect(patch.x, patch.y, patch.size, patch.size);

        let hasCrop = gameState.plantedWatermelons.some(wm => {
            return Math.abs((wm.x + 144) - (patch.x + 75)) < 80 && Math.abs((wm.y + 144) - (patch.y + 75)) < 80;
        });
        if (!hasCrop) {
            let elapsed = Date.now() - patch.createdAt;
            let pctLeft = Math.max(0, (patchLifetime - elapsed) / patchLifetime);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(patch.x + 15, patch.y + patch.size - 20, patch.size - 30, 8);
            ctx.fillStyle = pctLeft > 0.4 ? '#00FF00' : '#FF5500'; ctx.fillRect(patch.x + 15, patch.y + patch.size - 20, (patch.size - 30) * pctLeft, 8);
        }
    });

    // --- GAME ITEMS & REWARDS LAYER ---
    gameState.grenadesOnGround.forEach(g => {
        let pulse = Math.sin(gameState.gameFrame * 0.1) * 5;
        ctx.drawImage(grenadeSprite, g.x - pulse, g.y - pulse, 160 + pulse * 2, 160 + pulse * 2);
    });

    // --- PLAYER DRAW LAYER ---
    if (gameState.isMultiplayer && gameState.playerRole === 'alien-master') {
        player.x = gameState.playerX;
        player.y = gameState.playerY;
        if (gameState.moveLeft) player.facingRight = false;
        if (gameState.moveRight) player.facingRight = true;
        player.draw(ctx);
    } else {
        player.update();
        player.draw(ctx);
    }

    // --- HOTBAR HUD SYSTEM ---
    let boxSize = 80; let boxPadding = 15;
    let totalWidth = (boxSize * 5) + (boxPadding * 4);
    let startX = (CANVAS_WIDTH / 2) - (totalWidth / 2); let startY = 30;

    for (let j = 0; j < 5; j++) {
        let boxX = startX + (j * (boxSize + boxPadding));
        if (j === gameState.activeSlot) {
            ctx.fillStyle = 'rgba(230, 180, 40, 0.85)'; ctx.fillRect(boxX - 4, startY - 4, boxSize + 8, boxSize + 8);
            ctx.fillStyle = 'rgba(60, 50, 40, 0.9)';
        } else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; ctx.fillRect(boxX - 2, startY - 2, boxSize + 4, boxSize + 4);
            ctx.fillStyle = 'rgba(20, 20, 20, 0.8)';
        }
        ctx.fillRect(boxX, startY, boxSize, boxSize);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; ctx.font = '22px Arial'; ctx.fillText(j + 1, boxX + 8, startY + 24);

        let item = gameState.inventory[j];
        if (item === 'scythe') ctx.drawImage(scytheSprite, boxX + 10, startY + 10, boxSize - 20, boxSize - 20);
        else if (item === 'gun') ctx.drawImage(ak47Idle, boxX + 5, startY + 5, boxSize - 10, boxSize - 10);
    }

    // --- DRAW ROCKET FUEL METRIC ---
    drawRocketFuelBar();

    if (gameState.isPaused) { requestAnimationFrame(gameLoop); return; }
    gameState.gameFrame++;

    // =======================================================
    // 🏆 VICTORY CONDITION & WIN SCREEN INTERCEPT
    // =======================================================
    let currentFuel = gameState.rocketFuel || 0;
    let maxFuel = gameState.maxRocketFuel || 500;
    if (currentFuel >= maxFuel) {
        gameState.isGameWon = true; // Raise the flag for input frameworks to read

        // Deep space blue semi-transparent backdrop overlay
        ctx.fillStyle = 'rgba(10, 25, 50, 0.92)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.textAlign = 'center';

        // Shiny gold victory font header
        ctx.fillStyle = '#ffd700'; ctx.font = 'bold 150px Arial';
        ctx.fillText('VICTORY ACHIEVED!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 150);

        // Subtitle mission completion tag
        ctx.fillStyle = 'white'; ctx.font = '60px Arial';
        ctx.fillText('The Rocket is Fueled! You Escaped the Alien Horde!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);

        // Player performance stats layout metrics
        ctx.fillStyle = '#66ff66'; ctx.font = '50px Arial';
        ctx.fillText(`Aliens Neutralized: ${gameState.enemyKillScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 70);
        ctx.fillText(`Pigs Saved: ${gameState.pigsSaved} | Chickens: ${gameState.chickensSaved}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 140);

        // Control layout instructions
        ctx.fillStyle = 'white'; ctx.font = '45px Arial';
        ctx.fillText('Press [ R ] to Play Again', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 250);
        ctx.fillStyle = '#00ffff';
        ctx.fillText('Press [ H ] for Home Start Menu', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 320);

        try { moveSound.pause(); } catch (e) { }
        return; // 🛑 Stops everything behind it from updating
    }

    // --- SHARED GAME OVER UI ---
    if (gameState.isGameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.textAlign = 'center'; ctx.fillStyle = 'white'; ctx.font = 'bold 160px Arial';
        ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 150);
        ctx.font = '70px Arial'; ctx.fillText(`Kills: ${gameState.enemyKillScore} (Best: ${gameState.highScore})`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.fillStyle = '#66ff66'; ctx.fillText(`Pigs Saved: ${gameState.pigsSaved} | Chickens: ${gameState.chickensSaved}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100);

        ctx.fillStyle = 'white'; ctx.font = '50px Arial';
        ctx.fillText('Press [ R ] to Restart Session', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 250);
        ctx.fillStyle = '#00ffff';
        ctx.fillText('Press [ H ] for Home Start Menu', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 320);

        try { moveSound.pause(); } catch (e) { }
        return;
    }

    if (gameState.isPowered && Date.now() - gameState.powerTimer > 10000) gameState.isPowered = false;
    let speed = gameState.isPowered ? 12 : 6;
    if (gameState.moveLeft) gameState.playerX -= speed; if (gameState.moveRight) gameState.playerX += speed;
    if (gameState.moveUp) gameState.playerY -= speed; if (gameState.moveDown) gameState.playerY += speed;
    gameState.playerX = Math.max(0, Math.min(CANVAS_WIDTH - 288, gameState.playerX));
    gameState.playerY = Math.max(0, Math.min(CANVAS_HEIGHT - 288, gameState.playerY));

    let localIsMoving = (gameState.moveLeft || gameState.moveRight || gameState.moveUp || gameState.moveDown);
    if (gameState.playerRole === 'farmer') {
        if (localIsMoving) {
            moveSound.play().catch(() => { });
        } else {
            try { moveSound.pause(); } catch (e) { }
        }
    }

    // --- ALIEN MASTER CONTROLLER TRACKING INTERCEPT ---
    if (gameState.isMultiplayer && gameState.playerRole === 'alien-master' && gameState.peerConnection && gameState.peerConnection.open) {
        if (!gameState.isAlienDead) {
            let myDrone = gameState.enemies.find(e => e.id === gameState.controlledEnemyId);
            if (myDrone) {
                if (gameState.moveLeft) myDrone.x -= 7; if (gameState.moveRight) myDrone.x += 7;
                if (gameState.moveUp) myDrone.y -= 7; if (gameState.moveDown) myDrone.y += 7;

                myDrone.x = Math.max(0, Math.min(CANVAS_WIDTH - 288, myDrone.x));
                myDrone.y = Math.max(0, Math.min(CANVAS_HEIGHT - 288, myDrone.y));

                try {
                    gameState.peerConnection.send({
                        type: 'CONTROL_MOVE',
                        id: gameState.controlledEnemyId,
                        x: Math.round(myDrone.x),
                        y: Math.round(myDrone.y)
                    });
                } catch (e) { }
            }
        }
    }
    
    // Weapon ground collisions
    let gunToDestroy = null;
    gameState.guns.forEach((g, i) => {
        ctx.drawImage(ak47Idle, g.x, g.y, 160, 160);

        // Check if the FARMER picks up the gun
        if (checkCollision(player, { x: g.x, y: g.y, width: 160, height: 160, hitboxOffsetX: 20, hitboxOffsetY: 20 }, true)) {
            gunToDestroy = g;
            seedPickupSound.play().catch(() => { });
            gameState.ammo = 100;
            if (!gameState.inventory.includes('gun')) { let emptySlot = gameState.inventory.indexOf(null); if (emptySlot !== -1) gameState.inventory[emptySlot] = 'gun'; }
            gameState.hasGun = (gameState.inventory[gameState.activeSlot] === 'gun'); gameState.hasScythe = (gameState.inventory[gameState.activeSlot] === 'scythe');
        }
        // 🎯 Check if an ALIEN GRUNT (Type 1) grabs the gun instead
        else {
            gameState.enemies.forEach((en) => {
                if (en.type === 1 && !en.isDying && !en.hasGun && !gunToDestroy) {
                    if (checkCollision(en, { x: g.x, y: g.y, width: 160, height: 160, hitboxOffsetX: 20, hitboxOffsetY: 20 }, true)) {
                        gunToDestroy = g;
                        en.hasGun = true;       // Flips this specific alien's flag to true!
                        en.pickupDone = false;   // 🏁 False tells the frame updater to play the intro animation sheet first!
                        en.fIdx = 0;             // Reset current frame to 0 to prevent cutting into the middle of the animation
                        en.fT = 0;               // Reset frame tick timer
                        en.speed += 1.2;         // Give the grunt a slight speed boost
                        seedPickupSound.play().catch(() => { });
                    }
                }
            });
        }
    });

    // Safely remove the gun from the map array after checking collisions
    if (gunToDestroy) {
        let destroyIdx = gameState.guns.indexOf(gunToDestroy);
        if (destroyIdx !== -1) gameState.guns.splice(destroyIdx, 1);
    }
    gameState.seeds.forEach((s, i) => {
        ctx.drawImage(seedSprite, 0, (Math.floor(gameState.gameFrame / 10) % 2) * 288, 288, 288, s.x, s.y, 288, 288);
        if (checkCollision(player, { x: s.x, y: s.y, width: 288, height: 288, hitboxOffsetX: 70, hitboxOffsetY: 70 }, true)) {
            gameState.seedInventory++;
            gameState.seeds.splice(i, 1);
            seedPickupSound.play().catch(() => { });
        }
    });
    gameState.tires.forEach((t, i) => {
        ctx.drawImage(tireSprite, 0, (Math.floor(gameState.gameFrame / 15) % 2) * 300, 300, 300, t.x, t.y, 300, 300);
        if (checkCollision(player, { x: t.x, y: t.y, width: 300, height: 300, hitboxOffsetX: 50, hitboxOffsetY: 50 }, true)) {
            gameState.isPowered = true;
            gameState.powerTimer = Date.now();
            gameState.tires.splice(i, 1);
            tirePickupSound.play().catch(() => { });
        }
    });

    gameState.scythes.forEach((s, i) => {
        ctx.drawImage(scytheSprite, s.x, s.y, 300, 300);
        if (checkCollision(player, { x: s.x, y: s.y, width: 300, height: 300, hitboxOffsetX: 30, hitboxOffsetY: 30 }, true)) {
            gameState.scythes.splice(i, 1);
            seedPickupSound.play().catch(() => { });
            if (!gameState.inventory.includes('scythe')) { let emptySlot = gameState.inventory.indexOf(null); if (emptySlot !== -1) gameState.inventory[emptySlot] = 'scythe'; }
            gameState.scytheDurability = gameState.maxScytheDurability;
            gameState.hasGun = (gameState.inventory[gameState.activeSlot] === 'gun'); gameState.hasScythe = (gameState.inventory[gameState.activeSlot] === 'scythe');
        }
    });

    if (gameState.hasGun && gameState.isShooting) {
        gameState.ammo -= 0.15;
        if (gameState.ammo <= 0) {
            gameState.hasGun = false;
            gameState.isShooting = false;
            gameState.gunCoolDownActive = true;
            gameState.killsSinceEmpty = 0;
            try { shootSound.pause(); } catch (e) { }
        }
    }
    if (gameState.gunCoolDownActive && gameState.killsSinceEmpty >= 10) { gameState.gunCoolDownActive = false; gameState.killsSinceEmpty = 0; }

    // --- ENEMIES LAYER ---
    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        let en = gameState.enemies[i];
        if (!en) continue;

        if (en.isDying) {
            en.deathTimer++; if (en.deathTimer % 6 === 0) en.deathFrame++;
            if (en.deathFrame < 6) {
                let col = en.deathFrame % 2, row = Math.floor(en.deathFrame / 2);
                let deathImg, sW, sH, dH;
                if (en.type === 2) { deathImg = enemyDeathSprite2; sW = 128; sH = 128; dH = 432; } else { deathImg = enemyDeathSprite; sW = 64; sH = 64; dH = 288; }
                ctx.drawImage(deathImg, col * sW, row * sH, sW, sH, en.x, en.y, 288, dH);
            } else {
                if (gameState.isMultiplayer && gameState.playerRole === 'alien-master' && en.id === gameState.controlledEnemyId) {
                    gameState.isAlienDead = true;
                    gameState.alienRespawnTimer = Date.now() + 10000;
                }
                gameState.enemies.splice(i, 1);
            }
        } else {
            let dx = player.x - en.x, dy = player.y - en.y, dist = Math.hypot(dx, dy);
            let moveDir = (gameState.isPowered || (gameState.hasGun && gameState.isShooting)) ? -1 : 1;

            let isPlayerControlledDrone = (gameState.isMultiplayer && gameState.controlledEnemyId === en.id);

            if (gameState.isMultiplayer && gameState.playerRole === 'alien-master') {
                if (en.targetX !== undefined && !isPlayerControlledDrone) {
                    en.x += (en.targetX - en.x) * 0.18;
                    en.y += (en.targetY - en.y) * 0.18;
                }
            } else {
                if (!isPlayerControlledDrone && !en.isLocallyControlled && gameState.playerRole === 'farmer') {
                    en.x += (dx / dist) * en.speed * moveDir;
                    en.y += (dy / dist) * en.speed * moveDir;
                }
            }

            // 🎯 AI AUTONOMOUS LINEAR LASER PROJECTILE LOGIC (Single Player & Uncontrolled Grunts)
            if (en.hasGun && en.pickupDone && gameState.playerRole === 'farmer') {
                if (!en.laserCooldown) en.laserCooldown = 0;
                en.laserCooldown++;

                if (en.laserCooldown >= 90 && dist < 900) { 
                    let angle = Math.atan2(dy, dx);
                    let laserSpeed = 8;

                    gameState.enemyLasers.push({
                        x: en.x + 144, 
                        y: en.y + 144,
                        vX: Math.cos(angle) * laserSpeed,
                        vY: Math.sin(angle) * laserSpeed,
                        width: 90,     
                        height: 90
                    });
                    en.laserCooldown = 0; 
                }
            }

            gameState.seeds.forEach((s, sIdx) => {
                if (Math.hypot((en.x + 144) - s.x, (en.y + 144) - s.y) < 150) {
                    gameState.seeds.splice(sIdx, 1);
                    if (gameState.isMultiplayer && gameState.peerConnection) {
                        try { gameState.peerConnection.send({ type: 'SEED_STOLEN' }); } catch (e) { }
                    }
                }
            });

            // 📐 DETAILED ANIMATION STATE FRAME TICK LIMIT ENGINE
            en.fT++;
            if (en.fT >= 10) {
                if (en.hasGun) {
                    if (!en.pickupDone) {
                        // Intro Step Sheet sequence (4 frames total: 0, 1, 2, 3)
                        en.fIdx++;
                        if (en.fIdx >= 4) {
                            en.pickupDone = true; // 🏁 Intro is done! Swap states permanently
                            en.fIdx = 0;          // Reset pointer index cleanly for the next asset file
                        }
                    } else {
                        // Persistent loop sequence (6 frames total: 0 to 5)
                        en.fIdx = (en.fIdx + 1) % 6;
                    }
                } else {
                    // Baseline standard unarmed loop boundary triggers
                    en.fIdx = (en.fIdx + 1) % (en.type === 2 ? 5 : (en.type === 1 ? 3 : 2));
                }
                en.fT = 0;
            }

            let enemyImage;
            if (en.type === 2) enemyImage = enemySprite2;
            else if (en.type === 3) enemyImage = enemySprite3;
            else enemyImage = enemySprite;

            let currentSpriteHeight = 288;

            if (en.type === 2) {
                currentSpriteHeight = 432;
                ctx.drawImage(enemyImage, (en.fIdx % 2) * 288, Math.floor(en.fIdx / 2) * 288, 288, 288, en.x, en.y, 288, 432);
            } else if (en.type === 3) {
                currentSpriteHeight = 400;
                ctx.drawImage(enemyImage, 0, en.fIdx * 64, 64, 64, en.x, en.y, 300, 400);
            } else {
                currentSpriteHeight = 288;
                let trueFrame = (typeof en.fIdx === 'number' && !isNaN(en.fIdx)) ? en.fIdx : 0;

                if (en.hasGun) {
                    // 📐 RENDERING LAYER: STATE A (Playing intro sequence pickup animation)
                    if (!en.pickupDone && poltraGetsGun.complete && poltraGetsGun.naturalWidth !== 0) {
                        let gunCol = trueFrame % 2;
                        let gunRow = Math.floor(trueFrame / 2);
                        
                        ctx.drawImage(
                            poltraGetsGun,
                            gunCol * 1764, gunRow * 1764,
                            1764, 1764,
                            en.x, en.y,
                            288, 288
                        );
                    } 
                    // 📐 RENDERING LAYER: STATE B (Switching to the 1800x1640 loop layout sheet matrix)
                    else if (en.pickupDone && poltraWithGun.complete && poltraWithGun.naturalWidth !== 0) {
                        let loopCol = trueFrame % 2;
                        let loopRow = Math.floor(trueFrame / 2);

                        ctx.drawImage(
                            poltraWithGun,
                            loopCol * 1800, loopRow * 1640, 
                            1800, 1640,                     
                            en.x, en.y,                     
                            288, 288                        
                        );
                    }
                } else {
                    let spriteCol = trueFrame % 2;
                    let spriteRow = Math.floor(trueFrame / 2);

                    ctx.drawImage(
                        enemyImage,
                        spriteCol * 288, spriteRow * 288,
                        288, 288,
                        en.x, en.y,
                        288, 288
                    );
                }
            }

            // --- WEAPON DAMAGE CONTROLLER ---
            if (gameState.hasGun && gameState.isShooting && Math.abs((en.y + (en.height / 2)) - (gameState.playerY + 144)) < 150) {
                let pDx = en.x - gameState.playerX;
                if (((player.facingRight && pDx > 0) || (!player.facingRight && pDx < 0))) {

                    if (!en.lastHitTime) en.lastHitTime = 0;

                    if (Date.now() - en.lastHitTime > 380) {
                        let baseMax = (isPlayerControlledDrone) ? 50 : 10;
                        if (en.health === undefined) en.health = baseMax;

                        let bulletDamage = 0.25;
                        en.health -= bulletDamage;
                        en.lastHitTime = Date.now();

                        createDamageNumber(en.x + 144, en.y, bulletDamage, false);

                        if (en.health <= 0) {
                            en.isDying = true;
                            en.deathFrame = 0;
                            en.deathTimer = 0;
                            gameState.enemyKillScore++;
                        }
                    }
                }
            }

            // --- UNIVERSAL ALIEN PLAYER HEALTH BAR OVERLAY ---
            if (gameState.isMultiplayer && en.id === gameState.controlledEnemyId) {
                let maxAlienHP = 50;
                let currentHP = en.health !== undefined ? en.health : maxAlienHP;

                let barWidth = 140;
                let barHeight = 12;

                let spriteRenderWidth = (en.type === 3) ? 300 : 288;
                let barX = en.x + (spriteRenderWidth / 2) - (barWidth / 2);
                let barY = en.y - 20;

                ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
                ctx.fillRect(barX, barY, barWidth, barHeight);

                let hpPercentage = Math.max(0, Math.min(1, currentHP / maxAlienHP));
                ctx.fillStyle = hpPercentage > 0.4 ? '#00ffff' : '#ff3333';
                ctx.fillRect(barX + 2, barY + 2, (barWidth - 4) * hpPercentage, barHeight - 4);

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1;
                ctx.strokeRect(barX, barY, barWidth, barHeight);
            }

            // COLLISION RESOLUTION: Executed solely on Host Machine
            if (checkCollision(player, en) && gameState.playerRole === 'farmer') {
                if (gameState.isPowered) {
                    en.health = 0; en.isDying = true; en.deathFrame = 0; en.deathTimer = 0; gameState.enemyKillScore++; if (gameState.gunCoolDownActive) gameState.killsSinceEmpty++;
                } else {
                    if (gameState.isMultiplayer && gameState.peerConnection) {
                        try { gameState.peerConnection.send({ type: 'GAME_OVER_TRIGGER' }); } catch (e) { }
                    }
                    triggerGameOver();
                    window.focus();
                }
            }
        }
    }

    // =======================================================
    // ⚡ ENEMY LASER SIMULATION SUB-SYSTEM
    // =======================================================
    if (!gameState.enemyLasers) gameState.enemyLasers = [];
    for (let l = gameState.enemyLasers.length - 1; l >= 0; l--) {
        let laser = gameState.enemyLasers[l];
        
        laser.x += laser.vX;
        laser.y += laser.vY;

        // Render laser bullet scaled down cleanly out of full 448x448 source footprint
        if (laserBullet.complete && laserBullet.naturalWidth !== 0) {
            ctx.drawImage(laserBullet, 0, 0, 448, 448, laser.x - 45, laser.y - 45, laser.width, laser.height);
        } else {
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(laser.x - 10, laser.y - 10, 20, 20);
        }

        // Farmer collision hitbox intercept tracking
        if (gameState.playerRole === 'farmer') {
            let hitTarget = { x: laser.x - 20, y: laser.y - 20, width: 40, height: 40 };
            if (checkCollision(player, hitTarget, true)) {
                gameState.enemyLasers.splice(l, 1);
                if (gameState.isMultiplayer && gameState.peerConnection) {
                    try { gameState.peerConnection.send({ type: 'GAME_OVER_TRIGGER' }); } catch (e) { }
                }
                triggerGameOver();
                break;
            }
        }

        // Boundary map check cleanup loop to prevent memory leaks
        if (laser.x < -500 || laser.x > 3000 || laser.y < -500 || laser.y > 3000) {
            gameState.enemyLasers.splice(l, 1);
        }
    }

    // --- ANIMALS & CHARMS LAYER ---
    gameState.pigs.forEach((pig) => {
        if (pig === gameState.carryingPig) { pig.x = gameState.playerX + 50; pig.y = gameState.playerY + 50; }
        else {
            pig.x += pig.vx; pig.y += pig.vy;
            if (pig.x < 0 || pig.x > CANVAS_WIDTH - 240) pig.vx *= -1;
            if (pig.y < 0 || pig.y > CANVAS_HEIGHT - 240) pig.vy *= -1;
            pig.fT++; if (pig.fT > 15) { pig.fIdx = (pig.fIdx + 1) % 3; pig.fT = 0; }
        }
        ctx.save(); ctx.translate(pig.x + 120, pig.y + 120);
        if (pig !== gameState.carryingPig && pig.vx < 0) ctx.scale(-1, 1);
        if (pig === gameState.carryingPig) ctx.drawImage(pigIdle, -120, -120, 240, 240);
        else ctx.drawImage(pigWalk, (pig.fIdx % 2) * 64, Math.floor(pig.fIdx / 2) * 64, 64, 64, -120, -120, 240, 240);
        ctx.restore();
    });

    gameState.chickens.forEach((chicken) => {
        if (chicken === gameState.carryingChicken) { chicken.x = gameState.playerX + 50; chicken.y = gameState.playerY + 50; }
        else {
            chicken.x += chicken.vx; chicken.y += chicken.vy;
            if (chicken.x < 0 || chicken.x > CANVAS_WIDTH - 240) chicken.vx *= -1;
            if (chicken.y < 0 || chicken.y > CANVAS_HEIGHT - 240) chicken.vy *= -1;
            chicken.fT++; if (chicken.fT > 15) { chicken.fIdx = (chicken.fIdx + 1) % 1; chicken.fT = 0; }
        }
        ctx.save(); ctx.translate(chicken.x + 120, chicken.y + 120);
        if (chicken !== gameState.carryingChicken && chicken.vx < 0) ctx.scale(-1, 1);
        ctx.drawImage(chickenSprite, 0, 0, 64, 64, -120, -120, 240, 240);
        ctx.restore();
    });

    if (gameState.carryingPig && checkCollision(player, gameState.corral)) {
        gameState.pigs.splice(gameState.pigs.indexOf(gameState.carryingPig), 1); gameState.carryingPig = null; gameState.pigsSaved++;
        watermelonPickupSound.play().catch(() => { });
        gameState.charms.push({ x: gameState.corral.x + gameState.corral.width + 20, y: gameState.corral.y + (gameState.corral.height / 2) - 50, width: 120, height: 120 });
    }
    if (gameState.carryingChicken && checkCollision(player, gameState.corral)) {
        gameState.chickens.splice(gameState.chickens.indexOf(gameState.carryingChicken), 1); gameState.carryingChicken = null; gameState.chickensSaved++;
        watermelonPickupSound.play().catch(() => { });
        gameState.charms.push({ x: gameState.corral.x + gameState.corral.width + 20, y: gameState.corral.y + (gameState.corral.height / 2) - 50, width: 120, height: 120 });
    }

    gameState.charms.forEach((charm, i) => {
        let bobbing = Math.sin(gameState.gameFrame * 0.08) * 12;
        ctx.drawImage(charmSprite, charm.x, charm.y + bobbing, charm.width, charm.height);
        if (checkCollision(player, { x: charm.x, y: charm.y, width: charm.width, height: charm.height }, true)) {
            gameState.charms.splice(i, 1);
            seedPickupSound.play().catch(() => { });
            gameState.enemyKillScore += 5;
        }
    });

    // --- CROP HARVEST & ROCKET FUEL ACCUMULATION LOOP ---
    for (let i = gameState.plantedWatermelons.length - 1; i >= 0; i--) {
        let wm = gameState.plantedWatermelons[i];
        if (!wm.done) { wm.fT++; if (wm.fT > 50) { wm.fIdx++; wm.fT = 0; if (wm.fIdx >= 8) wm.done = true; } }
        let wmCols = 3, wmSize = 288;
        ctx.drawImage(watermelonSprite, (wm.fIdx % wmCols) * wmSize, Math.floor(wm.fIdx / wmCols) * wmSize, wmSize, wmSize, wm.x, wm.y, 288, 288);

        if (wm.done && checkCollision(player, wm) && gameState.playerRole === 'farmer') {
            gameState.plantedWatermelons.splice(i, 1);
            watermelonPickupSound.play().catch(() => { });

            gameState.rocketFuel = (gameState.rocketFuel || 0) + 50;
            if (gameState.rocketFuel > gameState.maxRocketFuel) {
                gameState.rocketFuel = gameState.maxRocketFuel; 
            }

            let target = gameState.enemies.find(e => !e.isDying);
            if (target) {
                let cropDamage = 25;
                target.health = (target.health !== undefined) ? target.health - cropDamage : 0;
                createDamageNumber(target.x + 144, target.y, cropDamage, true);

                if (target.health <= 0) {
                    target.isDying = true; target.deathFrame = 0; target.deathTimer = 0; gameState.enemyKillScore++; if (gameState.gunCoolDownActive) gameState.killsSinceEmpty++;
                }
            }
        }
    }

    gameState.activeGrenades.forEach((g, i) => {
        if (!g.exploded) {
            g.x += g.vX; g.y += g.vY; g.vY += 0.6; g.timer--;
            ctx.save();
            ctx.translate(g.x, g.y);
            ctx.rotate(gameState.gameFrame * 0.3);
            ctx.drawImage(grenadeSprite, -80, -80, 160, 160);
            ctx.restore();
            if (g.timer <= 0 && gameState.playerRole === 'farmer') {
                g.exploded = true;
                grenadeExplosionSound.play().catch(() => { });
                gameState.enemies.forEach(en => {
                    if (Math.hypot(en.x - g.x, en.y - g.y) < 450) {
                        let grenadeDamage = 20;
                        en.health = (en.health !== undefined) ? en.health - grenadeDamage : 0;
                        createDamageNumber(en.x + 144, en.y, grenadeDamage, true);

                        if (en.health <= 0) { en.isDying = true; en.deathFrame = 0; gameState.enemyKillScore++; }
                    }
                });
            }
        } else {
            ctx.fillStyle = 'rgba(255, 165, 0, 0.7)'; ctx.beginPath(); ctx.arc(g.x, g.y, 150 + (Math.random() * 50), 0, Math.PI * 2); ctx.fill();
            g.timer--; if (g.timer < -15) gameState.activeGrenades.splice(i, 1);
        }
    });

    if (gameState.carryingGrenade) ctx.drawImage(grenadeSprite, gameState.playerX + (player.facingRight ? 200 : -20), gameState.playerY + 80, 160, 160);

    // --- RENDER FLOATING DAMAGE POPUPS ---
    for (let k = gameState.damageNumbers.length - 1; k >= 0; k--) {
        let dmgNum = gameState.damageNumbers[k];
        dmgNum.y += dmgNum.vY;
        dmgNum.alpha -= 0.025;

        if (dmgNum.alpha <= 0) {
            gameState.damageNumbers.splice(k, 1);
        } else {
            ctx.save();
            ctx.globalAlpha = dmgNum.alpha;
            ctx.fillStyle = dmgNum.color;
            ctx.font = `bold ${dmgNum.size}px Impact, Arial Black`;
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 4;
            ctx.strokeText(dmgNum.text, dmgNum.x, dmgNum.y);
            ctx.fillText(dmgNum.text, dmgNum.x, dmgNum.y);
            ctx.restore();
        }
    }

    // --- HUD AND METRIC PRINTS ---
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(10, 10, 850, 240);
    ctx.fillStyle = 'white'; ctx.font = '40px Arial';

    if (gameState.isMultiplayer && gameState.playerRole === 'alien-master') {
        ctx.fillStyle = '#00ffff'; ctx.fillText(`神经网络链接: VERSUS PILOT ACTIVE`, 30, 60);

        if (gameState.isAlienDead) {
            let remainingTime = Math.max(0, Math.ceil((gameState.alienRespawnTimer - Date.now()) / 1000));
            ctx.save();
            ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.textAlign = 'center';
            ctx.fillStyle = 'white';
            ctx.font = 'bold 70px Arial';
            ctx.fillText(`MASTER VESSEL DESTROYED`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
            ctx.fillStyle = '#00ffff';
            ctx.font = '50px Arial';
            ctx.fillText(`RESPAWNING IN: ${remainingTime}s`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
            ctx.restore();

            if (Date.now() >= gameState.alienRespawnTimer) {
                dispatchMasterVesselSpawn();
            }
        }
    } else {
        ctx.fillText(`Seeds: ${gameState.seedInventory} | Kills: ${gameState.enemyKillScore} | Saved: ${gameState.pigsSaved}`, 30, 60);
    }

    if (gameState.hasGun) {
        ctx.fillText("AMMO:", 30, 135); ctx.fillStyle = 'black'; ctx.fillRect(180, 110, 200, 30);
        ctx.fillStyle = gameState.ammo > 30 ? '#00FF00' : '#FF0000'; ctx.fillRect(180, 110, gameState.ammo * 2, 30);
    } else if (gameState.gunCoolDownActive) {
        ctx.fillStyle = 'orange'; ctx.fillText(`RELOADING: ${gameState.killsSinceEmpty}/10 Kills`, 30, 135);
    }

    if (gameState.hasScythe) {
        ctx.fillStyle = 'white'; ctx.fillText("SCYTHE:", 30, 210); ctx.fillStyle = 'black'; ctx.fillRect(210, 185, 200, 30);
        let durPct = gameState.scytheDurability / gameState.maxScytheDurability;
        ctx.fillStyle = durPct > 0.35 ? '#00bfff' : '#FFaa00'; ctx.fillRect(210, 185, 200 * durPct, 30);
    }

    if (gameState.isMultiplayer && gameState.playerRole === 'farmer' && gameState.peerConnection && gameState.gameFrame % 3 === 0) {
        try {
            gameState.peerConnection.send({
                type: 'SYNC_ENEMIES',
                enemies: gameState.enemies.map(en => ({
                    id: en.id,
                    x: Math.round(en.x),
                    y: Math.round(en.y),
                    type: parseInt(en.type) || 1,
                    isDying: en.isDying ? true : false,
                    health: en.health
                }))
            });

            gameState.peerConnection.send({
                type: 'SYNC_FARMER',
                playerX: Math.round(gameState.playerX),
                playerY: Math.round(gameState.playerY),
                isShooting: gameState.isShooting,
                isMoving: localIsMoving,
                plowedPatches: gameState.plowedPatches.map(p => ({ x: p.x, y: p.y, size: p.size })),
                plantedWatermelons: gameState.plantedWatermelons.map(w => ({ x: w.x, y: w.y, fIdx: w.fIdx, done: w.done })),
                seeds: gameState.seeds.map(s => ({ x: s.x, y: s.y })),
                pigs: gameState.pigs.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), vx: p.vx, vy: p.vy, fIdx: p.fIdx })),
                chickens: gameState.chickens.map(c => ({ x: Math.round(c.x), y: Math.round(c.y), vx: c.vx, vy: c.vy, fIdx: c.fIdx })),
                charms: gameState.charms.map(ch => ({ x: ch.x, y: ch.y, width: ch.width, height: ch.height })),
                grenadesOnGround: gameState.grenadesOnGround.map(g => ({ x: g.x, y: g.y })),
                activeGrenades: gameState.activeGrenades.map(ag => ({ x: ag.x, y: ag.y, exploded: ag.exploded })),
                carryingGrenade: gameState.carryingGrenade ? true : false,
                guns: gameState.guns.map(gu => ({ x: gu.x, y: gu.y })),
                enemyLasers: gameState.enemyLasers.map(l => ({ x: Math.round(l.x), y: Math.round(l.y), width: l.width, height: l.height })), // Sync lasers over datachannel Link
                activeSlot: parseInt(gameState.activeSlot) || 0,
                inventory: gameState.inventory,
                hasScythe: gameState.hasScythe,
                hasGun: gameState.hasGun,
                rocketFuel: gameState.rocketFuel 
            });
        } catch (e) { }
    }

    requestAnimationFrame(gameLoop);
}

function spawnTick() {
    if (gameState.isPaused || gameState.isGameOver) return;

    if (gameState.isMultiplayer) {
        window.spawnTickTimeout = setTimeout(spawnTick, 8000 * gameState.spawnRateMultiplier);
        return;
    }

    const c1 = gameState.enemies.filter(e => e.type === 1).length,
        c2 = gameState.enemies.filter(e => e.type === 2).length,
        c3 = gameState.enemies.filter(e => e.type === 3).length;

    let possible = [];
    if (c1 < (40 + Math.floor(gameState.enemyKillScore / 10))) possible.push(1);
    if ((gameState.enemyKillScore >= 20 || gameState.pigsSaved >= 10) && c2 < 8) possible.push(2);
    if (gameState.enemyKillScore >= 40 && c3 < 4) possible.push(3);

    if (possible.length > 0) {
        let spawnedEnemy = createEnemy(possible[Math.floor(Math.random() * possible.length)]);
        if (spawnedEnemy) {
            spawnedEnemy.health = spawnedEnemy.type === 2 ? 3 : (spawnedEnemy.type === 3 ? 5 : 2);
            gameState.enemies.push(spawnedEnemy);
        }
    }

    window.spawnTickTimeout = setTimeout(spawnTick, 8000 * gameState.spawnRateMultiplier);
}

function startTrackingIntervals() {
    gameIntervals.push(setInterval(() => { if (!gameState.isGameOver && gameState.seeds.length < 5) gameState.seeds.push({ x: Math.random() * 2200, y: Math.random() * 2200 }); }, 12000));
    gameIntervals.push(setInterval(() => { if (!gameState.isGameOver && gameState.pigs.length < 5 && !gameState.isPaused) gameState.pigs.push({ x: Math.random() * 2200, y: Math.random() * 2200, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, fIdx: 0, fT: 0, width: 240, height: 240 }); }, 5000));
    gameIntervals.push(setInterval(() => { if (!gameState.isGameOver && gameState.chickens.length < 5 && !gameState.isPaused) gameState.chickens.push({ x: Math.random() * 2200, y: Math.random() * 2200, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, fIdx: 0, fT: 0, width: 240, height: 240 }); }, 5000));
    gameIntervals.push(setInterval(() => { if (!gameState.isGameOver && gameState.tires.length < 1) gameState.tires.push({ x: Math.random() * 2200, y: Math.random() * 2200 }); }, 75000));
    gameIntervals.push(setInterval(() => { if (!gameState.isGameOver && gameState.enemyKillScore >= 5 && !gameState.hasGun && !gameState.gunCoolDownActive && gameState.guns.length === 0) gameState.guns.push({ x: Math.random() * 2000, y: Math.random() * 2000 }); }, 4000));
    gameIntervals.push(setInterval(() => { if (!gameState.isGameOver && gameState.enemies.length > 12 && gameState.grenadesOnGround.length < 1) gameState.grenadesOnGround.push({ x: Math.random() * 2000 + 200, y: Math.random() * 2000 + 200 }); }, 5000));
    gameIntervals.push(setInterval(() => { if (!gameState.isGameOver && !gameState.hasScythe && gameState.scythes.length < 1) gameState.scythes.push({ x: Math.random() * 2000 + 100, y: Math.random() * 2000 + 100 }); }, 30000));
}

const startButton = document.getElementById('start-button');
const startScreen = document.getElementById('start-screen');
const hostFarmerBtn = document.getElementById('host-farmer-btn');
const joinMasterBtn = document.getElementById('join-master-btn');
const roomCodeInput = document.getElementById('room-code-input');

function startGame() {
    if (startScreen.style.display === 'none') return;
    startScreen.style.display = 'none';
    gameAudio.play().catch(e => console.log("Audio blocked"));
    initInput(); spawnTick();
    gameState.inventory[0] = 'scythe'; gameState.hasScythe = true;

    startTrackingIntervals();
    gameLoop();
}

startButton.addEventListener('click', startGame);

hostFarmerBtn.addEventListener('click', () => {
    const roomCode = roomCodeInput.value.trim().toLowerCase();
    if (!roomCode) return alert("Please enter a room code first!");
    initMultiplayer('farmer', roomCode);
    startGame();
});

joinMasterBtn.addEventListener('click', () => {
    const roomCode = roomCodeInput.value.trim().toLowerCase();
    if (!roomCode) return alert("Please enter a room code first!");

    initMultiplayer('alien-master', roomCode);
    startScreen.style.display = 'none';
    initInput();
    gameLoop();

    dispatchMasterVesselSpawn();
});

window.addEventListener('keydown', e => {
    if (e.key === 'Enter') startGame();

    if (e.key === 'r' || e.key === 'R' || e.keyCode === 82) {
        if (gameState.isGameOver || gameState.isGameWon) {
            console.log("🎯 R Key registered cleanly.");
            if (document.activeElement && document.activeElement.blur) {
                document.activeElement.blur();
            }

            if (gameState.isMultiplayer && gameState.peerConnection && gameState.peerConnection.open) {
                try {
                    gameState.peerConnection.send({ type: 'REMOTE_SOFT_RESET' });
                } catch (err) {
                    console.error("PeerJS sync reset frame dropped:", err);
                }
            }
            resetGameSession();
        }
    }
});

initInput();