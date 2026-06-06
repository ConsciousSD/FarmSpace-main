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

        // --- 👩‍🌾 FARMER HOST SIDE (WIFE) ---
        if (gameState.playerRole === 'farmer') {
            if (data.type === 'CONTROL_MOVE') {
                let targetedAlien = gameState.enemies.find(e => e.id === data.id);
                
                if (!targetedAlien) {
                    targetedAlien = createEnemy(1);
                    targetedAlien.id = data.id;
                    gameState.enemies.push(targetedAlien);
                }
                
                targetedAlien.x = data.x;
                targetedAlien.y = data.y;
                targetedAlien.isLocallyControlled = true; 
            }
        }
        
        // --- 🛸 ALIEN MASTER CLIENT SIDE (YOU) ---
        if (gameState.playerRole === 'alien-master') {
            if (data.type === 'SYNC_ENEMIES') {
                // Reconstruct the synced aliens into native objects so your graphics processor can draw them
                let activeDrone = gameState.enemies.find(e => e.id === gameState.controlledEnemyId);
                
                gameState.enemies = data.enemies.map(networkEnemy => {
                    return {
                        id: networkEnemy.id,
                        type: networkEnemy.type,
                        x: networkEnemy.x,
                        y: networkEnemy.y,
                        fIdx: networkEnemy.fIdx,
                        fT: 0,
                        isDying: networkEnemy.isDying,
                        deathFrame: networkEnemy.deathFrame,
                        deathTimer: networkEnemy.deathTimer,
                        width: 288,
                        height: 288
                    };
                });
                
                if (activeDrone && !gameState.enemies.some(e => e.id === gameState.controlledEnemyId)) {
                    gameState.enemies.push(activeDrone);
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