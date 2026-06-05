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
        // --- SURVIVOR (WIFE / FARMER) SIDE INTERCEPTS PACKETS ---
        if (gameState.playerRole === 'farmer') {
            if (data.type === 'SPAWN_ALIEN') {
                const newEnemy = createEnemy(data.enemyType);
                newEnemy.id = data.id; 
                newEnemy.x = data.x;
                newEnemy.y = data.y;
                gameState.enemies.push(newEnemy);
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
        
        // --- HUSBAND (ALIEN MASTER) SIDE INTERCEPTS PACKETS ---
        if (gameState.playerRole === 'alien-master') {
            if (data.type === 'SEED_STOLEN') {
                gameState.alienMasterSeeds++;
                console.log(`An alien collected a seed! Spawns available: ${gameState.alienMasterSeeds}`);
            }
            if (data.type === 'SYNC_ENEMIES') {
                gameState.enemies = data.enemies;
            }
            // FIXED: Fully synchronized mirror to unpack livestock, weapons, and pickups
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
            }
        }
    });

    conn.on('close', () => {
        console.log("Opponent has disconnected.");
        gameState.isMultiplayer = false;
    });
}