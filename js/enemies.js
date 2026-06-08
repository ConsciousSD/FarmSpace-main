import { gameState, ctx, CANVAS_WIDTH, CANVAS_HEIGHT } from './state.js';
import { player } from './player.js';
import { checkCollision } from './helpers.js';
import { 
    enemySprite, enemySprite2, enemySprite3, 
    enemyDeathSprite, enemyDeathSprite2,
    poltra_gets_gun, poltra_with_gun,
    lazer_bullet // 🎯 Direct module import for laser ammo asset
} from './assets.js';

// 📋 Global configurations for your balancing workflows
export const ENEMY_CONFIGS = {
    1: { id: 1, name: 'Drone', speed: 2.5, baseHealth: 2, width: 288, height: 288, sprite: enemySprite, deathSprite: enemyDeathSprite, sW: 64, sH: 64, dH: 288, maxFrames: 3, hitboxOffsetX: 40, hitboxOffsetY: 40 },
    2: { id: 2, name: 'Stomper', speed: 1.5, baseHealth: 3, width: 288, height: 432, sprite: enemySprite2, deathSprite: enemyDeathSprite2, sW: 128, sH: 128, dH: 432, maxFrames: 5, canEatAnimals: true, hitboxOffsetX: 50, hitboxOffsetY: 130 },
    3: { id: 3, name: 'Hunter', speed: 3.5, baseHealth: 5, width: 300, height: 400, sprite: enemySprite3, deathSprite: enemyDeathSprite, sW: 64, sH: 64, dH: 288, maxFrames: 2, canEatAnimals: true, hitboxOffsetX: 35, hitboxOffsetY: 45 }
};

// 🏭 Helper factory to generate raw enemy data structures mirroring your helpers.js logic
export function createEnemyData(type) {
    const config = ENEMY_CONFIGS[type];
    if (!config) return null;

    let x, y;
    if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? -config.width : CANVAS_WIDTH;
        y = Math.random() * CANVAS_HEIGHT;
    } else {
        x = Math.random() * CANVAS_WIDTH;
        y = Math.random() < 0.5 ? -config.height : CANVAS_HEIGHT;
    }

    return {
        id: "alien-" + Math.floor(Math.random() * 999999),
        type: type,
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        fIdx: 0,
        fT: 0,
        width: config.width,
        height: config.height,
        hitboxOffsetX: config.hitboxOffsetX || 0,
        hitboxOffsetY: config.hitboxOffsetY || 0,
        speed: config.speed,
        health: config.baseHealth,
        isDying: false,
        deathFrame: 0,
        deathTimer: 0,
        lastHitTime: 0,
        // 🎯 WEAPON & ATTACK FLAGS
        hasGun: false,
        isTransforming: false,
        transformFrame: 0,
        transformTimer: 0,
        pickupDone: false,
        shootCooldown: 0
    };
}

// 🦖 Core update loop processing all enemies simultaneously
export function updateAndDrawEnemies(createDamageNumber) {
    // Check asset safety status before executing frame slices
    const poltraGetsGunSprite = (poltra_gets_gun && poltra_gets_gun.complete && poltra_gets_gun.width > 0) ? poltra_gets_gun : enemySprite;
    const poltraWithGunSprite = (poltra_with_gun && poltra_with_gun.complete && poltra_with_gun.width > 0) ? poltra_with_gun : enemySprite;

    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        let en = gameState.enemies[i];
        if (!en) continue;

        // --- DEATH RENDER SEQUENCER ---
        if (en.isDying) {
            en.deathTimer++; 
            if (en.deathTimer % 6 === 0) en.deathFrame++;
            
            const config = ENEMY_CONFIGS[en.type] || ENEMY_CONFIGS[1];
            if (en.deathFrame < 6) {
                let col = en.deathFrame % 2;
                let row = Math.floor(en.deathFrame / 2);
                ctx.drawImage(config.deathSprite, col * config.sW, row * config.sH, config.sW, config.sH, en.x, en.y, 288, config.dH);
            } else {
                if (gameState.isMultiplayer && gameState.playerRole === 'alien-master' && en.id === gameState.controlledEnemyId) {
                    gameState.isAlienDead = true;
                    gameState.alienRespawnTimer = Date.now() + 10000;
                }
                gameState.enemies.splice(i, 1);
            }
            continue;
        }

        // --- PATHFINDING & AI MOTIONS ---
        let dx = player.x - en.x;
        let dy = player.y - en.y;
        let dist = Math.hypot(dx, dy);
        let moveDir = (gameState.isPowered || (gameState.hasGun && gameState.isShooting)) ? -1 : 1;
        let isPlayerControlledDrone = (gameState.isMultiplayer && gameState.controlledEnemyId === en.id);

        if (gameState.isMultiplayer && gameState.playerRole === 'alien-master') {
            if (en.targetX !== undefined && !isPlayerControlledDrone) {
                en.x += (en.targetX - en.x) * 0.18; 
                en.y += (en.targetY - en.y) * 0.18;
            }
        } else {
            if (!isPlayerControlledDrone && !en.isLocallyControlled && gameState.playerRole === 'farmer') {
                // Freeze coordinates only while mid-transformation state plays
                if (!en.isTransforming) {
                    en.x += (dx / dist) * en.speed * moveDir;
                    en.y += (dy / dist) * en.speed * moveDir;
                }
            }
        }

        // --- STEAL SEEDS INTERCEPT ---
        gameState.seeds.forEach((s, sIdx) => {
            if (Math.hypot((en.x + 144) - s.x, (en.y + 144) - s.y) < 150) {
                gameState.seeds.splice(sIdx, 1);
                if (gameState.isMultiplayer && gameState.peerConnection) {
                    try { gameState.peerConnection.send({ type: 'SEED_STOLEN' }); } catch (e) { }
                }
            }
        });

        // =======================================================
        // 🦖 LIVESTOCK HUNTER CRUNCH LOGIC
        // =======================================================
        const config = ENEMY_CONFIGS[en.type] || ENEMY_CONFIGS[1];
        if (config.canEatAnimals) {
            for (let pIdx = gameState.pigs.length - 1; pIdx >= 0; pIdx--) {
                let pig = gameState.pigs[pIdx];
                if (Math.hypot((en.x + 144) - (pig.x + 120), (en.y + (en.type === 2 ? 216 : 200)) - (pig.y + 120)) < 160) {
                    if (gameState.carryingPig === pig) gameState.carryingPig = null;
                    gameState.pigs.splice(pIdx, 1);
                    createDamageNumber(pig.x + 120, pig.y, "CRUNCH", true);
                }
            }
            for (let cIdx = gameState.chickens.length - 1; cIdx >= 0; cIdx--) {
                let chicken = gameState.chickens[cIdx];
                if (Math.hypot((en.x + 144) - (chicken.x + 120), (en.y + (en.type === 2 ? 216 : 200)) - (chicken.y + 120)) < 160) {
                    if (gameState.carryingChicken === chicken) gameState.carryingChicken = null;
                    gameState.chickens.splice(cIdx, 1);
                    createDamageNumber(chicken.x + 120, chicken.y, "GOBBLED", true);
                }
            }
            if (gameState.spaceCows) {
                for (let cowIdx = gameState.spaceCows.length - 1; cowIdx >= 0; cowIdx--) {
                    let cow = gameState.spaceCows[cowIdx];
                    if (Math.hypot((en.x + 144) - (cow.x + 120), (en.y + (en.type === 2 ? 216 : 200)) - (cow.y + 120)) < 160) {
                        gameState.spaceCows.splice(cowIdx, 1);
                        createDamageNumber(cow.x + 120, cow.y, "MOO-CHED", true);
                    }
                }
            }
        }

        // =======================================================
        // 🔫 DRONE LASER ATTACK TRACKER (Type 1 Shoots back)
        // =======================================================
        if (en.type === 1 && en.hasGun && en.pickupDone && !en.isDying) {
            if (!en.shootCooldown) en.shootCooldown = 0;
            en.shootCooldown++;

            if (en.shootCooldown >= 90) { 
                let pDx = player.x - en.x;
                let pDy = player.y - en.y;
                let pDist = Math.hypot(pDx, pDy);

                if (pDist < 800 && gameState.enemyLasers) {
                    let angle = Math.atan2(pDy, pDx);

                    gameState.enemyLasers.push({
                        x: en.x + 144,
                        y: en.y + 144,
                        vx: (pDx / pDist) * 8, 
                        vy: (pDy / pDist) * 8,
                        width: 96,   
                        height: 96,
                        angle: angle,
                        fIdx: 0,     
                        fT: 0        
                    });
                }
                en.shootCooldown = 0;
            }
        }

        // =======================================================
        // 🔄 ANIMATION STATE ENGINE & PATHFINDING OVERRIDES
        // =======================================================
        en.fT++;
        
        if (en.hasGun && en.isTransforming) {
            en.speed = 0; 

            // 🎯 Play 4-frame transformation (2x2 Grid)
            if (en.fT >= 12) { 
                en.transformFrame = (en.transformFrame || 0) + 1;
                en.fT = 0;

                if (en.transformFrame > 3) {
                    en.isTransforming = false;
                    en.pickupDone = true;
                    en.fIdx = 0;
                    en.speed = (ENEMY_CONFIGS[1].speed) + 1.2; 
                }
            }
        } else if (en.fT >= 10) {
            let maxFrames = config.maxFrames;
            
            // 🎯 LOCKED FRAME CLIP: Limits loops to the 4 real visual artwork frames
            if (en.type === 1 && en.hasGun && en.pickupDone) maxFrames = 4; 
            
            en.fIdx = (en.fIdx + 1) % maxFrames;
            en.fT = 0;
        }

        // =======================================================
        // 🎨 GRID CORNER RENDERING SYSTEM
        // =======================================================
        if (en.type === 2) {
            ctx.drawImage(config.sprite, (en.fIdx % 2) * 288, Math.floor(en.fIdx / 2) * 288, 288, 288, en.x, en.y, 288, 432);
        } else if (en.type === 3) {
            ctx.drawImage(config.sprite, 0, en.fIdx * 64, 64, 64, en.x, en.y, 300, 400);
        } else {
            // --- TYPE 1: DRONE / POLTRA ---
            if (en.hasGun) {
                if (poltraGetsGunSprite === enemySprite || poltraWithGunSprite === enemySprite) {
                    let trueFrame = (typeof en.fIdx === 'number' && !isNaN(en.fIdx)) ? en.fIdx : 0;
                    ctx.drawImage(enemySprite, (trueFrame % 2) * 288, Math.floor(trueFrame / 2) * 288, 288, 288, en.x, en.y, 288, 288);
                } else {
                    // 🎯 UNIFORM CANVAS DISPLAY SCALE BOUNDS
                    let drawWidth = 432;  
                    let drawHeight = 432; 
                    
                    let offsetX = en.x - (drawWidth - en.width) / 2;
                    let offsetY = en.y - (drawHeight - en.height) / 2;

                    if (en.isTransforming) {
                        // 🎯 SLICE 2x2 GRID: poltra_gets_gun.png (1728 x 1728 frames)
                        let currentFrame = en.transformFrame || 0;
                        let col = currentFrame % 2;
                        let row = Math.floor(currentFrame / 2);
                        
                        ctx.drawImage(
                            poltraGetsGunSprite,
                            col * 1728, row * 1728, 1728, 1728, 
                            offsetX, offsetY, drawWidth, drawHeight 
                        );
                    } else {
                        // 🎯 FIXED SQUARE MATH SLICE: poltra_with_gun.png
                        // Slices exact 1728x1728 grid cells, snapping the head onto the body cleanly!
                        let col = en.fIdx % 2;
                        let row = Math.floor(en.fIdx / 2);

                        ctx.drawImage(
                            poltraWithGunSprite,
                            col * 1728, row * 1728, 1728, 1728, // 🎯 Changed 1152 to 1728 square dimensions
                            offsetX, offsetY, drawWidth, drawHeight 
                        );
                    }
                }
            } else {
                let trueFrame = (typeof en.fIdx === 'number' && !isNaN(en.fIdx)) ? en.fIdx : 0;
                ctx.drawImage(config.sprite, (trueFrame % 2) * 288, Math.floor(trueFrame / 2) * 288, 288, 288, en.x, en.y, 288, 288);
            }
        }
    }

    // =======================================================
    // 🎯 PROCESS & RENDER ACTIVE LASER PROJECTILES
    // =======================================================
    if (gameState.enemyLasers) {
        for (let lIdx = gameState.enemyLasers.length - 1; lIdx >= 0; lIdx--) {
            let laser = gameState.enemyLasers[lIdx];
            if (!laser) continue;
            
            laser.x += laser.vx;
            laser.y += laser.vy;

            laser.fT++;
            if (laser.fT >= 6) {
                laser.fIdx = (laser.fIdx + 1) % 4; 
                laser.fT = 0;
            }

            if (laser.x < -200 || laser.x > CANVAS_WIDTH + 200 || laser.y < -200 || laser.y > CANVAS_HEIGHT + 200) {
                gameState.enemyLasers.splice(lIdx, 1);
                continue;
            }

            ctx.save();
            ctx.translate(laser.x, laser.y);
            ctx.rotate(laser.angle);
            
            if (typeof lazer_bullet !== 'undefined' && lazer_bullet.complete) {
                let frameWidth = lazer_bullet.width / 4 || 128; 
                ctx.drawImage(
                    lazer_bullet,
                    laser.fIdx * frameWidth, 0, frameWidth, lazer_bullet.height, 
                    -laser.width / 2, -laser.height / 2, laser.width, laser.height 
                );
            } else {
                ctx.fillStyle = '#ff0055';
                ctx.fillRect(-laser.width / 2, -laser.height / 2, laser.width, laser.height);
            }
            ctx.restore();

            // --- FARMER DAMAGE COLLISION PASS ---
            if (checkCollision(player, { x: laser.x - 16, y: laser.y - 16, width: 32, height: 32 }, true)) {
                if (!gameState.isInvincible && !gameState.isGameOver) {
                    gameState.playerHealth--;
                    gameState.isInvincible = true;
                    gameState.invincibilityTimer = Date.now() + 1000;
                    createDamageNumber(player.x + 144, player.y, "HIT!", true);
                    
                    gameState.enemyLasers.splice(lIdx, 1);
                }
            }
        }
    }
}