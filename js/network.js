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
            // Master requested a real native alien entity built directly on the server host layout
            if (data.type === 'SPAWN_MASTER_VESSEL') {
                console.log(`Spawning real basic scout for Player 2 with ID: ${data.id}`);
                
                // CRITICAL: Uses her native factory function to construct a real asset wrapper
                const masterAlien = createEnemy(1); 
                if (masterAlien) {
                    masterAlien.id = data.id;
                    masterAlien.x = 1250; // Perfect map center positioning
                    masterAlien.y = 1250;
                    masterAlien.isLocallyControlled = true; // Halts her built-in AI pathfinding scripts
                    
                    gameState.enemies.push(masterAlien);
                }
            }

            if (data.type === 'CONTROL_MOVE') {
                let targetedAlien = gameState.enemies.find(e => e.id === data.id);
                if (targetedAlien) {
                    targetedAlien.x = data.x;
                    targetedAlien.y = data.y;
                    targetedAlien.isLocallyControlled = true; 
                }
            }
        }
        
        // --- 🛸 ALIEN MASTER CLIENT SIDE (YOU) ---
        if (gameState.playerRole === 'alien-master') {
            if (data.type === 'SYNC_ENEMIES') {
                // Keep your active avatar entity array safe from being cleared by network latency packets
                let activeDrone = gameState.enemies.find(e => e.id === gameState.controlledEnemyId);
                
                // Safely mirror all host-constructed entities down to your layout canvas screen
                gameState.enemies = data.enemies;
                
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