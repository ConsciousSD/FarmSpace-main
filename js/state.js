export const canvas = document.getElementById('canvas1');
export const ctx = canvas.getContext('2d');
export const CANVAS_WIDTH = canvas.width = 2500;
export const CANVAS_HEIGHT = canvas.height = 2500;

ctx.imageSmoothingEnabled = false;

export const gameState = {
    playerX: 1250, playerY: 1250,
    moveUp: false, moveDown: false, moveLeft: false, moveRight: false,
    isShooting: false, isMoving: false, gameFrame: 0,
    seedInventory: 0, enemyKillScore: 0, ammo: 0,
    hasGun: false, gunCoolDownActive: false, killsSinceEmpty: 0,
    isPowered: false, powerTimer: 0, isPaused: false, isGameOver: false,
    
    // --- ❤️ FARMER HEALTH SYSTEM ---
    playerHealth: 3,                             // The active structural life point counter
    maxPlayerHealth: 3,                          // Baseline scale cap ceiling for hearts panel
    isInvincible: false,                         // Safety switch to prevent single-frame death loops
    invincibilityTimer: 0,                       // Timestamp tracking window for hit tracking cooldowns

    // --- SPACE ROCKET FUEL MECHANICS ---
    rocketFuel: 0,                               // Current accumulated engine fuel points
    maxRocketFuel: 500, 
    isGameWon: false,                            // Peak storage container threshold cap

    // --- WEAPONS, PLOWING & HOTBAR SYSTEM ---
    hasScythe: false, 
    plowedPatches: [], 
    scythes: [],
    inventory: [null, null, null, null, null],   // Slots 0-4 mapping to Hotkeys 1-5
    activeSlot: 0,                               // The currently selected index
    scytheDurability: 3,                         // Swings remaining on current tool
    maxScytheDurability: 3,                      // Total baseline maximum capacity

    // --- ANIMALS & COLLECTIBLES ---
    pigs: [], carryingPig: null, pigsSaved: 0, lastPigSoundTime: 0,
    chickens: [], carryingChicken: null, chickensSaved: 0,
    spaceCows: [], carryingSpaceCow: null, spaceCowsSaved: 0,
    charms: [],
    
    // --- MAP OBJECTS & THROWABLES ---
    enemies: [], seeds: [], plantedWatermelons: [], tires: [], guns: [],
    grenadesOnGround: [], activeGrenades: [], carryingGrenade: false,
    
    // --- LOCAL MULTIPLAYER SYSTEM ---
    isMultiplayer: false,
    playerRole: 'farmer',                        // Can be 'farmer' or 'alien-master'
    connectionId: null,                          // Room code string to link browsers
    peerConnection: null,                        // Direct network communication channel object
    spawnCooldown: 0,                            // Interval counter to stagger alien drops
    alienMasterSeeds: 0,                         // Stolen seed count to spend on spawns
    controlledEnemyId: null,                     // Network ID of the currently possessed alien

    // --- PERSISTENT STATE DATA ---
    highScore: localStorage.getItem('farmSpaceHighScore') || 0,
    pigHighScore: localStorage.getItem('farmSpacePigHighScore') || 0,
    chickenHighScore: localStorage.getItem('farmSpaceChickenHighScore') || 0,
    
    spawnRateMultiplier: 1.0,
    corral: { x: 20, y: (CANVAS_HEIGHT / 2) - 150, width: 300, height: 300 }
};