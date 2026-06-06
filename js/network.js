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
            if (data.type === 'SPAWN_MASTER_VESSEL') {
                console.log(`Spawning real basic scout for Player 2 with ID: ${data.id}`);
                
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
                    // Use Math.round to guarantee no floating decimal numbers trip binarypack
                    targetedAlien.x = Math.round(data.x);
                    targetedAlien.y = Math.round(data.y);
                    targetedAlien.isLocallyControlled = true; 
                }
            }
        }
        
        // --- 🛸 ALIEN MASTER CLIENT SIDE (YOU) ---
        if (gameState.playerRole === 'alien-master') {
            if (data.type === 'SYNC_ENEMIES') {
                // Safeguard against over-writing your local master target array slot
                let activeDrone = gameState.enemies.find(e => e.id === gameState.controlledEnemyId);
                
                // Unpack only sanitized network integers cleanly back into structural map arrays
                gameState.enemies = data.enemies.map(ne => {
                    return {
                        id: ne.id,
                        type: parseInt(ne.type) || 1,
                        x: parseInt(ne.x),
                        y: parseInt(ne.y),
                        fIdx: parseInt(ne.fIdx) || 0,
                        fT: 0,
                        isDying: ne.isDying ? true : false,
                        health: 5,
                        width: 288,
                        height: 288
                    };
                });
                
                if (activeDrone && !gameState.enemies.some(e => e.id === gameState.controlledEnemyId)) {
                    gameState.enemies.push(activeDrone);
                }
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
                gameState.hasGun = data.hasGun;
            }
        }
    });

    conn.on('close', () => {
        console.log("Opponent has disconnected.");
        gameState.isMultiplayer = false;
    });
}