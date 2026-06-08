import { gameState, ctx, CANVAS_WIDTH, CANVAS_HEIGHT } from './state.js';
import { initInput } from './input.js';
import { player } from './player.js';
import { checkCollision, triggerGameOver } from './helpers.js';
import { gameAudio, moveSound, shootSound, seedPickupSound, grenadeExplosionSound, tirePickupSound, watermelonPickupSound } from './audio.js';
import { corralSprite, grenadeSprite, scytheSprite, seedSprite, tireSprite, ak47Idle, watermelonSprite, charmSprite } from './assets.js';
import { initMultiplayer } from './network.js';
// 🎯 MODULAR COMPONENTS INTERFACE IMPORTS
import { updateAndDrawEnemies, createEnemyData } from './enemies.js';
import { updateAndDrawAnimals } from './animals.js';

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
    const y = 125;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(x, y, barWidth, barHeight);

    let currentFuel = gameState.rocketFuel || 0;
    let maxFuel = gameState.maxRocketFuel || 500;
    let fillPct = Math.max(0, Math.min(1, currentFuel / maxFuel));

    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(x + 3, y + 3, (barWidth - 6) * fillPct, barHeight - 6);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barWidth, barHeight);

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
        health: 50
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
    gameState.isGameWon = false;
    gameState.isPaused = false;
    gameState.enemyKillScore = 0;
    gameState.pigsSaved = 0;
    gameState.chickensSaved = 0;
    gameState.seedInventory = 0;
    gameState.rocketFuel = 0;
    gameState.ammo = 0;
    gameState.hasGun = false;
    gameState.gunCoolDownActive = false;
    gameState.killsSinceEmpty = 0;

    gameState.playerHealth = 3;
    gameState.isInvincible = false;
    gameState.invincibilityTimer = 0;

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
    gameState.spaceCows = [];
    gameState.charms = [];
    gameState.grenadesOnGround = [];
    gameState.activeGrenades = [];
    gameState.carryingGrenade = false;
    gameState.guns = [];
    gameState.enemyLasers = [];

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

    if (gameState.isInvincible && Date.now() > gameState.invincibilityTimer) {
        gameState.isInvincible = false;
    }

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

    // =======================================================
    // 👩‍🌾 UNIVERSAL PLAYER DRAW LAYER
    // =======================================================
    if (gameState.isMultiplayer && gameState.playerRole === 'alien-master') {
        if (gameState.targetPlayerX !== undefined) {
            gameState.playerX += (gameState.targetPlayerX - gameState.playerX) * 0.22;
            gameState.playerY += (gameState.targetPlayerY - gameState.playerY) * 0.22;
        }
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

    drawRocketFuelBar();

    if (gameState.isPaused) { requestAnimationFrame(gameLoop); return; }
    gameState.gameFrame++;

    // =======================================================
    // 🏆 VICTORY CONDITION & WIN SCREEN INTERCEPT
    // =======================================================
    let currentFuel = gameState.rocketFuel || 0;
    let maxFuel = gameState.maxRocketFuel || 500;
    if (currentFuel >= maxFuel) {
        gameState.isGameWon = true;
        ctx.fillStyle = 'rgba(10, 25, 50, 0.92)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd700'; ctx.font = 'bold 150px Arial';
        ctx.fillText('VICTORY ACHIEVED!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 150);
        ctx.fillStyle = 'white'; ctx.font = '60px Arial';
        ctx.fillText('The Rocket is Fueled! You Escaped the Alien Horde!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);
        ctx.fillStyle = '#66ff66'; ctx.font = '50px Arial';
        ctx.fillText(`Aliens Neutralized: ${gameState.enemyKillScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 70);
        ctx.fillText(`Pigs Saved: ${gameState.pigsSaved} | Chickens: ${gameState.chickensSaved}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 140);
        ctx.fillStyle = 'white'; ctx.font = '45px Arial';
        ctx.fillText('Press [ R ] to Play Again', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 250);
        ctx.fillStyle = '#00ffff';
        ctx.fillText('Press [ H ] for Home Start Menu', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 320);
        try { moveSound.pause(); } catch (e) { }
        return;
    }

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

    // --- WEAPON GROUND COLLISION MANAGEMENT CONTAINER ---
    let gunToDestroy = null;
    // 🎯 FIX: Added explicit index mapping tracking variables ('weaponIdx') into the execution signature
    gameState.guns.forEach((g, weaponIdx) => {
        ctx.drawImage(ak47Idle, g.x, g.y, 160, 160);

        if (checkCollision(player, { x: g.x, y: g.y, width: 160, height: 160, hitboxOffsetX: 20, hitboxOffsetY: 20 }, true)) {
            gameState.guns.splice(weaponIdx, 1);
            seedPickupSound.play().catch(() => { });
            gameState.ammo = 100;
            if (!gameState.inventory.includes('gun')) { let emptySlot = gameState.inventory.indexOf(null); if (emptySlot !== -1) gameState.inventory[emptySlot] = 'gun'; }
            gameState.hasGun = (gameState.inventory[gameState.activeSlot] === 'gun'); gameState.hasScythe = (gameState.inventory[gameState.activeSlot] === 'scythe');
        }
        else {
            gameState.enemies.forEach((en) => {
                if (en.type === 1 && !en.isDying && !en.hasGun) {
                    if (checkCollision(en, { x: g.x, y: g.y, width: 160, height: 160, hitboxOffsetX: 20, hitboxOffsetY: 20 }, true)) {
                        gunToDestroy = g;
                        en.hasGun = true;
                        en.pickupDone = false;
                        en.fIdx = 0;
                        en.fT = 0;
                        en.speed += 1.2;
                        seedPickupSound.currentTime = 0;
                        seedPickupSound.play().catch(() => { });
                    }
                }
            });
        }
    });

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

    // =======================================================
    // 🎯 MODULAR ALIEN ENGINE SUB-LAYER INTEGRATION
    // =======================================================
    updateAndDrawEnemies(createDamageNumber);

    // --- HOST-ONLY ALIEN COLLISION CALCULATION PASS ---
    if (gameState.playerRole === 'farmer') {
        gameState.enemies.forEach(en => {
            if (!en.isDying && checkCollision(player, en)) {
                if (gameState.isPowered) {
                    en.health = 0; en.isDying = true; en.deathFrame = 0; en.deathTimer = 0; gameState.enemyKillScore++; if (gameState.gunCoolDownActive) gameState.killsSinceEmpty++;
                } else {
                    if (!gameState.isInvincible) {
                        gameState.playerHealth--;
                        gameState.isInvincible = true;
                        gameState.invincibilityTimer = Date.now() + 1000;
                        if (gameState.playerHealth <= 0) {
                            if (gameState.isMultiplayer && gameState.peerConnection) {
                                try { gameState.peerConnection.send({ type: 'GAME_OVER_TRIGGER' }); } catch (e) { }
                            }
                            triggerGameOver();
                            window.focus();
                        }
                    }
                }
            }
        });
    }

    // --- GUN HIT SCAN CALC BLOCK ---
    if (gameState.hasGun && gameState.isShooting) {
        gameState.enemies.forEach(en => {
            if (en.isDying) return;
            if (Math.abs((en.y + (en.height / 2)) - (gameState.playerY + 144)) < 150) {
                let pDx = en.x - gameState.playerX;
                if (((player.facingRight && pDx > 0) || (!player.facingRight && pDx < 0))) {
                    if (!en.lastHitTime) en.lastHitTime = 0;
                    if (Date.now() - en.lastHitTime > 380) {
                        let isPlayerControlledDrone = (gameState.isMultiplayer && gameState.controlledEnemyId === en.id);
                        let baseMax = (isPlayerControlledDrone) ? 50 : 10;
                        if (en.health === undefined) en.health = baseMax;

                        let bulletDamage = 0.25;
                        en.health -= bulletDamage;
                        en.lastHitTime = Date.now();
                        createDamageNumber(en.x + 144, en.y, bulletDamage, false);

                        if (en.health <= 0) {
                            en.isDying = true; en.deathFrame = 0; en.deathTimer = 0; gameState.enemyKillScore++;
                        }
                    }
                }
            }
        });
    }

    // =======================================================
    // 🎯 MODULAR LIVESTOCK ENGINE SUB-LAYER INTEGRATION
    // =======================================================
    updateAndDrawAnimals();

    gameState.charms.forEach((charm, i) => {
        let bobbing = Math.sin(gameState.gameFrame * 0.08) * 12;
        ctx.drawImage(charmSprite, charm.x, charm.y + bobbing, charm.width, charm.height);
        if (checkCollision(player, { x: charm.x, y: charm.y, width: charm.width, height: charm.height }, true)) {
            gameState.charms.splice(i, 1);
            seedPickupSound.play().catch(() => { });
            gameState.enemyKillScore += 5;
        }
    });

    // --- CROP HARVEST LOOP ---
    for (let i = gameState.plantedWatermelons.length - 1; i >= 0; i--) {
        let wm = gameState.plantedWatermelons[i];
        if (!wm.done) { wm.fT++; if (wm.fT > 50) { wm.fIdx++; wm.fT = 0; if (wm.fIdx >= 8) wm.done = true; } }
        let wmCols = 3, wmSize = 288;
        ctx.drawImage(watermelonSprite, (wm.fIdx % wmCols) * wmSize, Math.floor(wm.fIdx / wmCols) * wmSize, wmSize, wmSize, wm.x, wm.y, 288, 288);

        if (wm.done && checkCollision(player, wm) && gameState.playerRole === 'farmer') {
            gameState.plantedWatermelons.splice(i, 1);
            watermelonPickupSound.play().catch(() => { });
            gameState.rocketFuel = (gameState.rocketFuel || 0) + 50;
            if (gameState.rocketFuel > gameState.maxRocketFuel) gameState.rocketFuel = gameState.maxRocketFuel;

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
            ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(gameState.gameFrame * 0.3); ctx.drawImage(grenadeSprite, -80, -80, 160, 160); ctx.restore();
            if (g.timer <= 0 && gameState.playerRole === 'farmer') {
                g.exploded = true; grenadeExplosionSound.play().catch(() => { });
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

    // --- POPUPS CONTAINER RENDER ---
    for (let k = gameState.damageNumbers.length - 1; k >= 0; k--) {
        let dmgNum = gameState.damageNumbers[k];
        dmgNum.y += dmgNum.vY; dmgNum.alpha -= 0.025;
        if (dmgNum.alpha <= 0) { gameState.damageNumbers.splice(k, 1); }
        else {
            ctx.save(); ctx.globalAlpha = dmgNum.alpha; ctx.fillStyle = dmgNum.color; ctx.font = `bold ${dmgNum.size}px Impact, Arial Black`;
            ctx.strokeStyle = 'black'; ctx.lineWidth = 4; ctx.strokeText(dmgNum.text, dmgNum.x, dmgNum.y); ctx.fillText(dmgNum.text, dmgNum.x, dmgNum.y); ctx.restore();
        }
    }

    // --- HUD PANEL SYSTEM ---
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(10, 10, 850, 240);
    ctx.fillStyle = 'white'; ctx.font = '40px Arial';

    if (gameState.isMultiplayer && gameState.playerRole === 'alien-master') {
        ctx.fillStyle = '#00ffff'; ctx.fillText(`神经网络链接: VERSUS PILOT ACTIVE`, 30, 60);
        if (gameState.isAlienDead) {
            let remainingTime = Math.max(0, Math.ceil((gameState.alienRespawnTimer - Date.now()) / 1000));
            ctx.save(); ctx.fillStyle = 'rgba(255, 0, 0, 0.4)'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); ctx.textAlign = 'center';
            ctx.fillStyle = 'white'; ctx.font = 'bold 70px Arial'; ctx.fillText(`MASTER VESSEL DESTROYED`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
            ctx.fillStyle = '#00ffff'; ctx.font = '50px Arial'; ctx.fillText(`RESPAWNING IN: ${remainingTime}s`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50); ctx.restore();
            if (Date.now() >= gameState.alienRespawnTimer) { dispatchMasterVesselSpawn(); }
        }
    } else {
        ctx.fillText(`Seeds: ${gameState.seedInventory} | Kills: ${gameState.enemyKillScore} | Saved: ${gameState.pigsSaved}`, 30, 60);
        if (gameState.playerRole === 'farmer') {
            let heartX = 680; let heartY = 55;
            for (let h = 0; h < gameState.maxPlayerHealth; h++) {
                ctx.font = '38px Arial';
                if (h < gameState.playerHealth) { ctx.fillStyle = '#ff2222'; ctx.fillText('♥', heartX + (h * 42), heartY); }
                else { ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'; ctx.fillText('♥', heartX + (h * 42), heartY); }
            }
        }
    }
    if (gameState.hasGun) {
        ctx.fillText("AMMO:", 30, 135); ctx.fillStyle = 'black'; ctx.fillRect(180, 110, 200, 30);
        ctx.fillStyle = gameState.ammo > 30 ? '#00FF00' : '#FF0000'; ctx.fillRect(180, 110, gameState.ammo * 2, 30);
    } else if (gameState.gunCoolDownActive) {
        ctx.fillStyle = 'orange'; ctx.fillText(`RELOADING: ${gameState.killsSinceEmpty}/10 Kills`, 30, 135);
    }
    if (gameState.hasScythe) {
        ctx.fillStyle = 'white'; ctx.fillText("SCYTHE:", 30, 210); ctx.fillStyle = 'black'; ctx.fillRect(210, 185, 200, 30);
        let durPct = gameState.scytheDurability / gameState.maxScytheDurability; ctx.fillStyle = durPct > 0.35 ? '#00bfff' : '#FFaa00'; ctx.fillRect(210, 185, 200 * durPct, 30);
    }

    // --- NETWORK CHANNEL INTERFACE HANDSHAKE payload ---
    if (gameState.isMultiplayer && gameState.playerRole === 'farmer' && gameState.peerConnection && gameState.gameFrame % 3 === 0) {
        try {
            gameState.peerConnection.send({
                type: 'SYNC_ENEMIES',
                enemies: gameState.enemies.map(en => ({
                    id: en.id, x: Math.round(en.x), y: Math.round(en.y), type: parseInt(en.type) || 1, isDying: en.isDying ? true : false, health: en.health
                }))
            });
            gameState.peerConnection.send({
                type: 'SYNC_FARMER',
                playerX: Math.round(gameState.playerX), playerY: Math.round(gameState.playerY), isShooting: gameState.isShooting, isMoving: localIsMoving,
                plowedPatches: gameState.plowedPatches.map(p => ({ x: p.x, y: p.y, size: p.size })),
                plantedWatermelons: gameState.plantedWatermelons.map(w => ({ x: w.x, y: w.y, fIdx: w.fIdx, done: w.done })),
                seeds: gameState.seeds.map(s => ({ x: s.x, y: s.y })),
                pigs: gameState.pigs.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), vx: p.vx, vy: p.vy, fIdx: p.fIdx })),
                chickens: gameState.chickens.map(c => ({ x: Math.round(c.x), y: Math.round(c.y), vx: c.vx, vy: c.vy, fIdx: c.fIdx })),
                spaceCows: gameState.spaceCows ? gameState.spaceCows.map(cow => ({ x: Math.round(cow.x), y: Math.round(cow.y), vx: cow.vx, vy: cow.vy })) : [],
                charms: gameState.charms.map(ch => ({ x: ch.x, y: ch.y, width: ch.width, height: ch.height })),
                grenadesOnGround: gameState.grenadesOnGround.map(g => ({ x: g.x, y: g.y })), activeGrenades: gameState.activeGrenades.map(ag => ({ x: ag.x, y: ag.y, exploded: ag.exploded })),
                carryingGrenade: gameState.carryingGrenade ? true : false, guns: gameState.guns.map(gu => ({ x: gu.x, y: gu.y })), activeSlot: parseInt(gameState.activeSlot) || 0,
                inventory: gameState.inventory, hasScythe: gameState.hasScythe, hasGun: gameState.hasGun, rocketFuel: gameState.rocketFuel, playerHealth: gameState.playerHealth
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

    const c2 = gameState.enemies.filter(e => e.type === 2).length,
        c3 = gameState.enemies.filter(e => e.type === 3).length;

    let possible = [];
    if ((gameState.enemyKillScore >= 20 || gameState.pigsSaved >= 10) && c2 < 8) possible.push(2);
    if (gameState.enemyKillScore >= 40 && c3 < 4) possible.push(3);

    if (possible.length > 0) {
        let spawnedEnemy = createEnemyData(possible[Math.floor(Math.random() * possible.length)]);
        if (spawnedEnemy) gameState.enemies.push(spawnedEnemy);
    }
    window.spawnTickTimeout = setTimeout(spawnTick, 3000 * gameState.spawnRateMultiplier);
}

function startTrackingIntervals() {
    gameIntervals.push(setInterval(() => { if (!gameState.isGameOver && gameState.seeds.length < 5) gameState.seeds.push({ x: Math.random() * 2200, y: Math.random() * 2200 }); }, 12000));
    gameIntervals.push(setInterval(() => { if (!gameState.isGameOver && gameState.pigs.length < 5 && !gameState.isPaused) gameState.pigs.push({ x: Math.random() * 2200, y: Math.random() * 2200, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, fIdx: 0, fT: 0, width: 240, height: 240 }); }, 5000));
    gameIntervals.push(setInterval(() => { if (!gameState.isGameOver && gameState.chickens.length < 5 && !gameState.isPaused) gameState.chickens.push({ x: Math.random() * 2200, y: Math.random() * 2200, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, fIdx: 0, fT: 0, width: 240, height: 240 }); }, 5000));

    gameIntervals.push(setInterval(() => {
        if (!gameState.isGameOver && gameState.spaceCows && gameState.spaceCows.length < 3 && !gameState.isPaused) {
            gameState.spaceCows.push({ x: Math.random() * 2200, y: Math.random() * 2200, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, width: 240, height: 240 });
        }
    }, 8000));

    // 🎯 INDEPENDENT ENEMY 1 (DRONE) SPAWNER LOOP
    gameIntervals.push(setInterval(() => {
        const currentDrones = gameState.enemies.filter(e => e.type === 1).length;
        const droneCap = 40 + Math.floor(gameState.enemyKillScore / 10);

        if (!gameState.isGameOver && !gameState.isPaused && currentDrones < droneCap) {
            let spawnedEnemy = createEnemyData(1);
            if (spawnedEnemy) gameState.enemies.push(spawnedEnemy);
        }
    }, 10000));

    gameIntervals.push(setInterval(() => { if (!gameState.isGameOver && gameState.tires.length < 1) gameState.tires.push({ x: Math.random() * 2200, y: Math.random() * 2200 }); }, 75000));
    gameIntervals.push(setInterval(() => { if (!gameState.isGameOver && gameState.enemyKillScore >= 5 && !gameState.hasGun && !gameState.gunCoolDownActive && gameState.guns.length === 0) gameState.guns.push({ x: Math.random() * 2000, y: Math.random() * 2000 }); }, 4000));
    gameIntervals.push(setInterval(() => { if (!gameState.isGameOver && gameState.enemies.length > 12 && gameState.grenadesOnGround.length < 1) gameState.grenadesOnGround.push({ x: Math.random() * 2000 + 200, y: Math.random() * 2000 + 200 }); }, 5000));
    gameIntervals.push(setInterval(() => { if (!gameState.isGameOver && !gameState.hasScythe && gameState.scythes.length < 1) gameState.scythes.push({ x: Math.random() * 2000 + 100, y: Math.random() * 2000 + 100 }); }, 30000));
}

// --- DOM SAFE INITIALIZATION WRAPPER ---
document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start-button');
    const startScreen = document.getElementById('start-screen');
    const hostFarmerBtn = document.getElementById('host-farmer-btn');
    const joinMasterBtn = document.getElementById('join-master-btn');
    const roomCodeInput = document.getElementById('room-code-input');

    // Define startGame inside the DOM wrapper so it has perfect access to everything
    function startGame() {
        if (!startScreen || startScreen.style.display === 'none') return;
        startScreen.style.display = 'none';
        gameAudio.play().catch(e => console.log("Audio blocked"));
        initInput();
        spawnTick();
        gameState.inventory[0] = 'scythe';
        gameState.hasScythe = true;
        startTrackingIntervals();
        gameLoop();
    }

    if (startButton) {
        startButton.addEventListener('click', startGame);
    }

    if (hostFarmerBtn && roomCodeInput) {
        hostFarmerBtn.addEventListener('click', () => {
            const roomCode = roomCodeInput.value.trim().toLowerCase();
            if (!roomCode) return alert("Please enter a room code first!");
            initMultiplayer('farmer', roomCode);
            startGame();
        });
    }

    if (joinMasterBtn && roomCodeInput) {
        joinMasterBtn.addEventListener('click', () => {
            const roomCode = roomCodeInput.value.trim().toLowerCase();
            if (!roomCode) return alert("Please enter a room code first!");
            initMultiplayer('alien-master', roomCode);
            if (startScreen) startScreen.style.display = 'none';
            initInput();
            gameLoop();
            dispatchMasterVesselSpawn();
        });
    }

    // Set up the universal keyboard hooks
    window.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            startGame();
        }
        if (e.key === 'r' || e.key === 'R' || e.keyCode === 82) {
            if (gameState.isGameOver || gameState.isGameWon) {
                console.log("🎯 R Key registered cleanly.");
                if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
                if (gameState.isMultiplayer && gameState.peerConnection && gameState.peerConnection.open) {
                    try { gameState.peerConnection.send({ type: 'REMOTE_SOFT_RESET' }); } catch (err) { }
                }
                resetGameSession();
            }
        }
    });
});

// Initialize global inputs
initInput();