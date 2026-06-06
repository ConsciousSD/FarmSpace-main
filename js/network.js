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
            // Master requested an official puppet drone built in the host room
            if (data.type === 'FORCE_HOST_SPAWN') {
                console.log("Master requested a live puppet drone asset.");
                const newEnemy = createEnemy(1); // Spawns a real Basic Scout with full graphics
                if (newEnemy) {
                    newEnemy.id = data.id;
                    newEnemy.x = 1250;
                    newEnemy.y = 1250;
                    newEnemy.speed = 4; // Give it some speed to chase her!
                    newEnemy.isLocallyControlled = true; // Tells her AI engine not to override your movement
                    gameState.enemies.push(newEnemy);

                    // Send a message back to you confirming you own this alien id
                    conn.send({ type: 'CONFIRM_POSSESSION', id: data.id });
                }
            }

            // Listens to your arrow key move inputs and updates her screen coordinates
            if (data.type === 'CONTROL_MOVE') {
                let targetedAlien = gameState.enemies.find(e => e.id === data.id);
                if (targetedAlien) {
                    targetedAlien.x = data.x;
                    targetedAlien.y = data.y;
                    targetedAlien.isLocallyControlled = true;
                }
            }
        }
        
        // --- 🛸 ALIEN MASTER SIDE (YOU) ---
        if (gameState.playerRole === 'alien-master') {
            if (data.type === 'CONFIRM_POSSESSION') {
                gameState.controlledEnemyId = data.id;
                console.log(`Neural link secure! Possessing host alien: ${data.id}`);
            }
            if (data.type === 'SYNC_ENEMIES') {
                // Instantly syncs her real alien positions and sprites to your screen
                gameState.enemies = data.enemies;
            }
            if (data.type === 'SYNC_FARMER') {
                // Streams her coordinates and items straight to your monitor viewport
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