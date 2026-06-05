// --- BACKGROUND MUSIC ---
export const gameAudio = new Audio('assets/skippy-mr-sunshine-fernweh-goldfish-main-version-02-32-7172.mp3');
gameAudio.loop = true;
gameAudio.volume = 0.3;

// --- MOVEMENT & COMBAT SOUNDS ---
export const moveSound = new Audio('assets/footsteps-walking-in-snow-glitchedtones-1-1-00-28.mp3');

export const shootSound = new Audio('assets/Shotsound.mp3');
shootSound.loop = true;

// --- ITEM PICKUP SOUNDS ---
export const seedPickupSound = new Audio('assets/seed-pickup.mp3');
export const tirePickupSound = new Audio('assets/tire-pickup.mp3');
export const watermelonPickupSound = new Audio('assets/watermelon-pickup.mp3');

// --- ANIMAL SOUNDS ---
export const pigWalkSound = new Audio('assets/Pigwalkaudio.mp3');
pigWalkSound.volume = 0.2;

export const pigPickupSound = new Audio('assets/Pigpickedup.mp3');
pigPickupSound.volume = 0.4;

export const chickenPickupSound = new Audio('assets/Chickenpickedup.mp3');
chickenPickupSound.volume = 0.4;

export const grenadeExplosionSound = new Audio('assets/grenade-explosion.mp3');
grenadeExplosionSound.volume = 0.6;