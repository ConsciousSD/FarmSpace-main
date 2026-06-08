import { gameState, ctx, CANVAS_WIDTH, CANVAS_HEIGHT } from './state.js';
import { player } from './player.js';
import { checkCollision } from './helpers.js';
import { 
    enemySprite, enemySprite2, enemySprite3, 
    enemyDeathSprite, enemyDeathSprite2 
} from './assets.js';

// 📋 Global configurations for your balancing workflows
export const ENEMY_CONFIGS = {
    1: { id: 1, name: 'Drone', speed: 2.5, baseHealth: 2, width: 288, height: 288, sprite: enemySprite, deathSprite: enemyDeathSprite, sW: 64, sH: 64, dH: 288, maxFrames: 3, hitboxOffsetX: 40, hitboxOffsetY: 40 },
    // 🎯 ADJUSTED TYPE 2 HITBOX: Increased offsetY to shave height off the active zone
    2: { id: 2, name: 'Stomper', speed: 1.5, baseHealth: 3, width: 288, height: 432, sprite: enemySprite2, deathSprite: enemyDeathSprite2, sW: 128, sH: 128, dH: 432, maxFrames: 5, canEatAnimals: true, hitboxOffsetX: 50, hitboxOffsetY: 130 },
    3: { id: 3, name: 'Hunter', speed: 3.5, baseHealth: 5, width: 300, height: 400, sprite: enemySprite3, deathSprite: enemyDeathSprite, sW: 64, sH: 64, dH: 288, maxFrames: 2, canEatAnimals: true, hitboxOffsetX: 35, hitboxOffsetY: 45 }
};

// 🏭 Helper factory to generate raw enemy data structures mirroring your helpers.js logic
export function createEnemyData(type) {
    const config = ENEMY_CONFIGS[type];
    if (!config) return null;

    // Pick a random screen perimeter border side to spawn from
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
        // 🎯 THE HITBOX HOOKS: Attaching individual configurations
        hitboxOffsetX: config.hitboxOffsetX || 0,
        hitboxOffsetY: config.hitboxOffsetY || 0,
        speed: config.speed,
        health: config.baseHealth,
        isDying: false,
        deathFrame: 0,
        deathTimer: 0,
        lastHitTime: 0
    };
}

// 🦖 Core update loop processing all enemies simultaneously
export function updateAndDrawEnemies(createDamageNumber) {
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
                en.x += (dx / dist) * en.speed * moveDir;
                en.y += (dy / dist) * en.speed * moveDir;
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
            // Eat Pigs
            for (let pIdx = gameState.pigs.length - 1; pIdx >= 0; pIdx--) {
                let pig = gameState.pigs[pIdx];
                if (Math.hypot((en.x + 144) - (pig.x + 120), (en.y + (en.type === 2 ? 216 : 200)) - (pig.y + 120)) < 160) {
                    if (gameState.carryingPig === pig) gameState.carryingPig = null;
                    gameState.pigs.splice(pIdx, 1);
                    createDamageNumber(pig.x + 120, pig.y, "CRUNCH", true);
                }
            }
            // Eat Chickens
            for (let cIdx = gameState.chickens.length - 1; cIdx >= 0; cIdx--) {
                let chicken = gameState.chickens[cIdx];
                if (Math.hypot((en.x + 144) - (chicken.x + 120), (en.y + (en.type === 2 ? 216 : 200)) - (chicken.y + 120)) < 160) {
                    if (gameState.carryingChicken === chicken) gameState.carryingChicken = null;
                    gameState.chickens.splice(cIdx, 1);
                    createDamageNumber(chicken.x + 120, chicken.y, "GOBBLED", true);
                }
            }
            // Eat Space Cows
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

        // --- ANIMATION FRAME TICKER ---
        en.fT++;
        if (en.fT >= 10) {
            en.fIdx = (en.fIdx + 1) % config.maxFrames;
            en.fT = 0;
        }

        // --- RENDER CURRENT ALIEN UNIT ---
        if (en.type === 2) {
            ctx.drawImage(config.sprite, (en.fIdx % 2) * 288, Math.floor(en.fIdx / 2) * 288, 288, 288, en.x, en.y, 288, 432);
        } else if (en.type === 3) {
            ctx.drawImage(config.sprite, 0, en.fIdx * 64, 64, 64, en.x, en.y, 300, 400);
        } else {
            let trueFrame = (typeof en.fIdx === 'number' && !isNaN(en.fIdx)) ? en.fIdx : (Math.floor(gameState.gameFrame / 10) % 3);
            ctx.drawImage(config.sprite, (trueFrame % 2) * 288, Math.floor(trueFrame / 2) * 288, 288, 288, en.x, en.y, 288, 288);
        }
    }
}