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

        // --- 👩‍🌾 SURVIVOR / HOST SIDE (YOUR WIFE) ---
        if (gameState.playerRole === 'farmer') {
            if (data.type === 'CONTROL_MOVE') {
                let targetedAlien = gameState.enemies.find(e => e.id === data.id);
                
                // If your master alien isn't on her map yet, her machine builds it instantly
                if (!targetedAlien) {
                    targetedAlien = createEnemy(1); // Real live basic scout asset configuration
                    targetedAlien.id = data.id;
                    gameState.enemies.push(targetedAlien);
                }
                
                // Update your position on her screen frame loop
                targetedAlien.x = data.x;
                targetedAlien.y = data.y;
                targetedAlien.isLocallyControlled = true; // Prevents her AI scripts from overriding you
            }
        }
        
        // --- 🛸 ALIEN MASTER CLIENT SIDE (YOU) ---
        if (gameState.playerRole === 'alien-master') {
            if (data.type === 'SYNC_ENEMIES') {
                // Keep your player-controlled alien safe from getting wiped out by her empty single-player enemy array!
                let activeDrone = gameState.enemies.find(e => e.id === gameState.controlledEnemyId);
                
                // Read any background assets she has going on
                gameState.enemies = data.enemies.map(networkEnemy => {
                    return {
                        id: networkEnemy.id,
                        type: networkEnemy.type,
                        x: networkEnemy.x,
                        y: networkEnemy.y,
                        fIdx: networkEnemy.fIdx,
                        fT: 0,
                        isDying: networkEnemy.isDying,
                        width: 288,
                        height: 288
                    };
                });
                
                // Force-reinsert your playable vessel if her network packet left it out
                if (activeDrone && !gameState.enemies.some(e => e.id === gameState.controlledEnemyId)) {
                    gameState.enemies.push(activeDrone);
                }
            }
            if (data.type === 'SYNC_FARMER') {
                // Mirror her exact player movements onto your master monitor viewport canvas
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