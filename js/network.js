import { gameState } from './state.js';
import { createEnemy, triggerGameOver } from './helpers.js';
import { shootSound, moveSound } from './audio.js';
import { resetGameSession } from './main.js'; // Imported session reset wrapper

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

    peer.on('connection', (conn) => {
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
                let masterAlien = gameState.enemies.find(e => e.id === data.id);
                if (!masterAlien) {
                    masterAlien = createEnemy(1); 
                    if (masterAlien) {
                        masterAlien.id = data.id;
                        masterAlien.x = 1250; 
                        masterAlien.y = 1250;
                        masterAlien.speed = 0; 
                        masterAlien.isLocallyControlled = true; 
                        gameState.enemies.push(masterAlien);
                    }
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

            // Catch remote restart request on host machine
            if (data.type === 'EXECUTE_SHARED_RESTART') {
                console.log("Remote client requested session soft-reset.");
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

            // Catch remote restart instruction from host machine
            if (data.type === 'EXECUTE_SHARED_RESTART') {
                console.log("Host executed session soft-reset.");
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
                            fIdx: 0,
                            fT: 0,
                            isDying: ne.isDying,
                            health: 5,
                            width: 288,
                            height: 288
                        };
                        gameState.enemies.push(localEn);
                    } else {
                        localEn.x = ne.x;
                        localEn.y = ne.y;
                        localEn.isDying = ne.isDying;
                    }
                });
                gameState.enemies = gameState.enemies.filter(le => data.enemies.some(ne => ne.id === le.id) || le.id === gameState.controlledEnemyId);
            }
            if (data.type === 'SYNC_FARMER') {
                gameState.playerX = parseInt(data.playerX);
                gameState.playerY = parseInt(data.playerY);
                gameState.plowedPatches = data.plowedPatches || [];
                gameState.plantedWatermelons = data.plantedWatermelons || [];
                gameState.seeds = data.seeds || [];
                gameState.pigs = data.pigs || [];
                gameState.chickens = data.chickens || [];
                gameState.charms = data.charms || [];
                gameState.grenadesOnGround = data.grenadesOnGround || [];
                gameState.activeGrenades = data.activeGrenades || [];
                gameState.carryingGrenade = data.carryingGrenade;
                gameState.guns = data.guns || [];
                gameState.activeSlot = parseInt(data.activeSlot) || 0;
                gameState.inventory = data.inventory;
                gameState.hasScythe = data.hasScythe;
                
                if (data.isShooting) {
                    gameState.isShooting = true;
                    if (shootSound.paused) shootSound.play().catch(() => {});
                } else {
                    gameState.isShooting = false;
                    shootSound.pause();
                }

                if (data.isMoving) {
                    if (moveSound.paused) moveSound.play().catch(() => {});
                } else {
                    moveSound.pause();
                }
                gameState.hasGun = data.hasGun;
            }
        }
    });

    conn.on('close', () => {
        console.log("Opponent has disconnected.");
        gameState.isMultiplayer = false;
    });
}