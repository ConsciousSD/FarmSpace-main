import { gameState } from './state.js';
import { createEnemy } from './helpers.js';

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

        // --- SURVIVOR (WIFE / FARMER) SIDE INTERCEPTS PACKETS ---
        if (gameState.playerRole === 'farmer') {
            // Catches your move packets and forces her map to move your puppet drone
            if (data.type === 'CONTROL_MOVE') {
                let targetedAlien = gameState.enemies.find(e => e.id === data.id);
                
                if (!targetedAlien) {
                    // If her machine doesn't have this drone in her list yet, 
                    // force her system to append it instantly!
                    targetedAlien = createEnemy(1);
                    targetedAlien.id = data.id;
                    gameState.enemies.push(targetedAlien);
                }
                
                targetedAlien.x = data.x;
                targetedAlien.y = data.y;
                targetedAlien.isLocallyControlled = true; 
            }
        }
        
        // --- HUSBAND (ALIEN MASTER) SIDE INTERCEPTS PACKETS ---
        if (gameState.playerRole === 'alien-master') {
            if (data.type === 'SEED_STOLEN') {
                gameState.alienMasterSeeds++;
            }
            if (data.type === 'SYNC_ENEMIES') {
                // If you are already controlling a local puppet drone, 
                // protect it from getting overwritten by her empty list arrays!
                if (gameState.controlledEnemyId) {
                    let activeDrone = gameState.enemies.find(e => e.id === gameState.controlledEnemyId);
                    gameState.enemies = data.enemies;
                    if (activeDrone && !gameState.enemies.some(e => e.id === gameState.controlledEnemyId)) {
                        gameState.enemies.push(activeDrone);
                    }
                } else {
                    gameState.enemies = data.enemies;
                }
            }
            if (data.type === 'SYNC_FARMER') {
                gameState.playerX = data.playerX;
                gameState.playerY = data.playerY;
                gameState.plowedPatches = data.plowedPatches;
                gameState.plantedWatermelons = data.plantedWatermelons;
                gameState.seeds = data.seeds;
                gameState.pigs = data.pigs;
                gameState.chickens = data.chickens;
                gameState.charms = data.charms;
                gameState.grenadesOnGround = data.grenadesOnGround;
                gameState.activeGrenades = data.activeGrenades;
                gameState.carryingGrenade = data.carryingGrenade;
                gameState.guns = data.guns;
                gameState.activeSlot = data.activeSlot;
                gameState.inventory = data.inventory;
                gameState.hasScythe = data.hasScythe;
                gameState.hasGun = data.hasGun;
            }
        }
    });

    conn.on('close', () => {
        console.log("Opponent has disconnected.");
        gameState.isMultiplayer = false;
    });
}