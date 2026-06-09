import { gameState } from './state.js';
import { createEnemy, triggerGameOver } from './helpers.js';
import { shootSound, moveSound } from './audio.js';
import { resetGameSession } from './main.js'; 

export function initMultiplayer(role, roomCode) {
    gameState.isMultiplayer = true;
    gameState.playerRole = role;
    gameState.connectionId = roomCode;

    const peer = role === 'farmer' ? new Peer(roomCode) : new Peer();

    peer.on('open', (id) => {
        console.log(`Lobby Open. Role: ${role}. ID: ${id}`);
        if (role === 'alien-master') {
            const conn = peer.connect(roomCode);
            setupConnection(conn);
        }
    });

    peer.on('peerConnection', (conn) => {
        setupConnection(conn);
    });
}

function setupConnection(conn) {
    gameState.peerConnection = conn;
    console.log("Direct P2P multiplayer link synchronized!");

    conn.on('data', (data) => {
        if (!data || !data.type) return;

        // --- 👩‍🌾 SURVIVOR / HOST SIDE (YOUR WIFE) ---
        if (gameState.playerRole === 'farmer') {
            if (data.type === 'SPAWN_MASTER_VESSEL') {
                console.log(`Spawning host puppet instance for Master Drone: ${data.id}`);
                
                gameState.enemies = gameState.enemies.filter(e => !e.id.startsWith("master-drone-"));

                let masterAlien = createEnemy(1); 
                if (masterAlien) {
                    masterAlien.id = data.id;
                    masterAlien.x = 1250; 
                    masterAlien.y = 1250;
                    masterAlien.speed = 0; 
                    masterAlien.isLocallyControlled = true; 
                    
                    masterAlien.hasGun = false;      
                    masterAlien.pickupDone = false;
                    
                    gameState.enemies.push(masterAlien);
                }
            }

            if (data.type === 'CONTROL_MOVE') {
                let targetedAlien = gameState.enemies.find(e => e.id === data.id);
                if (!targetedAlien) {
                    targetedAlien = createEnemy(1);
                    if (targetedAlien) {
                        targetedAlien.id = data.id;
                        targetedAlien.speed = 0;
                        targetedAlien.isLocallyControlled = true;
                        gameState.enemies.push(targetedAlien);
                    }
                }
                if (targetedAlien) {
                    targetedAlien.x = Math.round(data.x);
                    targetedAlien.y = Math.round(data.y);
                    targetedAlien.isLocallyControlled = true; 
                }
            }

            if (data.type === 'ALIEN_MANUAL_FIRE') {
                let shooter = gameState.enemies.find(e => e.id === data.id);
                if (shooter && !shooter.isDying) {
                    if (!shooter.lastManualFire) shooter.lastManualFire = 0;
                    if (Date.now() - shooter.lastManualFire > 500) { 
                        let dx = data.tx - shooter.x;
                        let dy = data.ty - shooter.y;
                        let angle = Math.atan2(dy, dx);
                        let laserSpeed = 5; 

                        if (!gameState.enemyLasers) gameState.enemyLasers = [];
                        gameState.enemyLasers.push({
                            x: shooter.x + 144,
                            y: shooter.y + 144,
                            vX: Math.cos(angle) * laserSpeed,
                            vY: Math.sin(angle) * laserSpeed,
                            width: 90,
                            height: 90
                        });
                        shooter.lastManualFire = Date.now();
                    }
                }
            }

            if (data.type === 'SEED_STOLEN') {
                let possible = [1];
                if (gameState.enemyKillScore >= 20) possible.push(2);
                if (gameState.enemyKillScore >= 40) possible.push(3);

                let chosenType = possible[Math.floor(Math.random() * possible.length)];
                let uncontrolledAlien = createEnemy(chosenType);
                
                if (uncontrolledAlien) {
                    uncontrolledAlien.id = `stolen-seed-spawn-${Math.floor(Math.random() * 9999999)}`;
                    uncontrolledAlien.isLocallyControlled = false; 
                    
                    gameState.enemies.push(uncontrolledAlien);
                    console.log(`📡 SEED STOLEN: Deployed Unique Level ${chosenType} Grunt (ID: ${uncontrolledAlien.id})`);
                }
            }

            if (data.type === 'REMOTE_SOFT_RESET') {
                console.log("Peer network soft-reset packet verified.");
                resetGameSession();
            }
        }
        
        // --- 🛸 ALIEN MASTER CLIENT SIDE (YOU) ---
        if (gameState.playerRole === 'alien-master') {
            if (data.type === 'GAME_OVER_TRIGGER') {
                console.log("Host reports a fatal collision! Freezing client field.");
                gameState.isGameOver = true; 
                if (typeof triggerGameOver === 'function') triggerGameOver();
            }

            if (data.type === 'REMOTE_SOFT_RESET') {
                console.log("Host soft-reset packet verified.");
                resetGameSession();
            }

            if (data.type === 'SYNC_ENEMIES') {
                data.enemies.forEach(ne => {
                    let localEn = gameState.enemies.find(e => e.id === ne.id);
                    if (!localEn) {
                        localEn = {
                            id: ne.id,
                            type: parseInt(ne.type) || 1,
                            x: parseInt(ne.x),
                            y: parseInt(ne.y),
                            targetX: parseInt(ne.x),
                            targetY: parseInt(ne.y),
                            fIdx: 0,
                            fT: 0,
                            isDying: ne.isDying,
                            health: ne.health,
                            width: 288,
                            height: 288,
                            hasGun: ne.hasGun ? true : false,
                            pickupDone: ne.pickupDone ? true : false
                        };
                        gameState.enemies.push(localEn);
                    } else {
                        localEn.targetX = ne.x;
                        localEn.targetY = ne.y;
                        localEn.isDying = ne.isDying;
                        localEn.hasGun = ne.hasGun ? true : false;
                        localEn.pickupDone = ne.pickupDone ? true : false;
                    }
                });
                
                gameState.enemies = gameState.enemies.filter(le => data.enemies.some(ne => ne.id === le.id) || le.id === gameState.controlledEnemyId);
            }
            
            // 🏎️ FAST LANE TRAFFIC INGEST
            if (data.type === 'SYNC_FARMER') {
                gameState.targetPlayerX = parseInt(data.playerX); 
                gameState.targetPlayerY = parseInt(data.playerY);
                gameState.activeSlot = parseInt(data.activeSlot) || 0;
                gameState.hasGun = data.hasGun;
                gameState.enemyLasers = data.enemyLasers || [];
                
                // 🎯 REWARD TRACKING INGEST: Links financial, experience, and custom loadouts to both connected screens!
                gameState.coins = parseInt(data.coins) || 0;
                gameState.xp = parseInt(data.xp) || 0;
                gameState.selectedWeapon = data.selectedWeapon || null;

                if (data.isShooting) {
                    gameState.isShooting = true;
                    if (shootSound.paused) shootSound.play().catch(() => {});
                } else {
                    gameState.isShooting = false;
                    try { shootSound.pause(); } catch(e) {}
                }

                if (data.isMoving) {
                    if (moveSound.paused) moveSound.play().catch(() => {});
                } else {
                    try { moveSound.pause(); } catch(e) {}
                }
            }

            //  snails SLOW LANE TRAFFIC INGEST
            if (data.type === 'SYNC_FARMER_SLOW') {
                gameState.plowedPatches = data.plowedPatches || [];
                gameState.plantedWatermelons = data.plantedWatermelons || [];
                gameState.seeds = data.seeds || [];
                gameState.tires = data.tires || [];
                if (data.corral) {
                    gameState.corral = data.corral;
                }
                gameState.pigs = data.pigs || [];
                gameState.chickens = data.chickens || [];
                gameState.charms = data.charms || [];
                gameState.grenadesOnGround = data.grenadesOnGround || [];
                gameState.activeGrenades = data.activeGrenades || [];
                gameState.carryingGrenade = data.carryingGrenade;
                gameState.guns = data.guns || [];
                gameState.inventory = data.inventory;
                gameState.hasScythe = data.hasScythe;
                
                if (data.rocketFuel !== undefined) {
                    gameState.rocketFuel = data.rocketFuel;
                }
            }
        }
    });

    conn.on('close', () => {
        console.log("Opponent has disconnected.");
        gameState.isMultiplayer = false;
    });
}