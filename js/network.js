import { gameState } from './state.js';
import { createEnemy } from './helpers.js';
import { shootSound, moveSound } from './audio.js';

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
                console.log(`Spawning host-authoritative puppet drone for Player 2: ${data.id}`);
                const masterAlien = createEnemy(1); 
                if (masterAlien) {
                    masterAlien.id = data.id;
                    masterAlien.x = 1250; 
                    masterAlien.y = 1250;
                    masterAlien.isLocallyControlled = true; 
                    gameState.enemies.push(masterAlien);
                }
            }

            if (data.type === 'CONTROL_MOVE') {
                let targetedAlien = gameState.enemies.find(e => e.id === data.id);
                if (targetedAlien) {
                    targetedAlien.x = Math.round(data.x);
                    targetedAlien.y = Math.round(data.y);
                    targetedAlien.isLocallyControlled = true; 
                }
            }
        }
        
        // --- 🛸 ALIEN MASTER CLIENT SIDE (YOU) ---
        if (gameState.playerRole === 'alien-master') {
            if (data.type === 'SYNC_ENEMIES') {
                // FIXED: Protect your player-controlled alien structure
                let activeDrone = gameState.enemies.find(e => e.id === gameState.controlledEnemyId);
                
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
                        // FIXED: Smooth updates! Only map location markers across the link.
                        // We do NOT overwrite fIdx or fT here so your local animation cycle walks smoothly!
                        localEn.x = ne.x;
                        localEn.y = ne.y;
                        localEn.isDying = ne.isDying;
                    }
                });

                // Filter out destroyed targets dynamically
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