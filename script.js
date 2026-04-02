const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');
const CANVAS_WIDTH = canvas.width = 2500;
const CANVAS_HEIGHT = canvas.height = 2500;

ctx.imageSmoothingEnabled = false;

// --- ASSETS ---
const gameAudio = new Audio('assets/skippy-mr-sunshine-fernweh-goldfish-main-version-02-32-7172.mp3');
gameAudio.loop = true;
gameAudio.volume = 0.3;

const moveSound = new Audio('assets/footsteps-walking-in-snow-glitchedtones-1-1-00-28.mp3');
const shootSound = new Audio('assets/Shotsound.mp3');
shootSound.loop = true;

const seedPickupSound = new Audio('assets/seed-pickup.mp3');
const tirePickupSound = new Audio('assets/tire-pickup.mp3');
const watermelonPickupSound = new Audio('assets/watermelon-pickup.mp3');

// --- NEW PIG ASSETS ---
const pigWalkSound = new Audio('assets/Pigwalkaudio.mp3');
pigWalkSound.volume = 0.2;
const pigPickupSound = new Audio('assets/Pigpickedup.mp3');
pigPickupSound.volume = 0.4;

// --- IMAGES ---
const playerImage = new Image(); playerImage.src = 'assets/farmer.png';
const enemySprite = new Image(); enemySprite.src = 'assets/Poltra.png';
const enemySprite2 = new Image(); enemySprite2.src = 'assets/SmartPoltra.png';
const enemySprite3 = new Image(); enemySprite3.src = 'assets/Poltra3FL.png';
const seedSprite = new Image(); seedSprite.src = 'assets/Seed.png';
const watermelonSprite = new Image(); watermelonSprite.src = 'assets/Watermelon.png';
const tractorSprite = new Image(); tractorSprite.src = "assets/Tractor.png";
const tireSprite = new Image(); tireSprite.src = "assets/Wheel.png";
const ak47Idle = new Image(); ak47Idle.src = "assets/AK47.png";
const ak47Shooting = new Image(); ak47Shooting.src = "assets/AK47-shooting.png";
const enemyDeathSprite = new Image(); enemyDeathSprite.src = "assets/Poltra-gets-shot.png";
const enemyDeathSprite2 = new Image(); enemyDeathSprite2.src = "assets/SmartPoltraShot.png";
const corralSprite = new Image(); corralSprite.src = 'assets/corral.png';
const pigIdle = new Image(); pigIdle.src = 'assets/SpacePig.png';
const pigWalk = new Image(); pigWalk.src = 'assets/SpacePigWalking.png';

// --- GAME STATE ---
let playerX = 1250, playerY = 1250;
let moveUp = false, moveDown = false, moveLeft = false, moveRight = false;
let isShooting = false, isMoving = false, gameFrame = 0;
let frameX = 0, frameY = 0;
let seedInventory = 0, enemyKillScore = 0, ammo = 0;
let hasGun = false, gunCoolDownActive = false, killsSinceEmpty = 0;
let isPowered = false, powerTimer = 0, isPaused = false;
const pigs = [];
let carryingPig = null;
let pigsSaved = 0;
let lastPigSoundTime = 0;
let isGameOver = false;
let highScore = localStorage.getItem('farmSpaceHighScore') || 0;
let pigHighScore = localStorage.getItem('farmSpacePigHighScore') || 0;

const corral = {
    x: 20,
    y: (CANVAS_HEIGHT / 2) - 150,
    width: 300,
    height: 300
};

const enemies = [], seeds = [], plantedWatermelons = [], tires = [], guns = [];

// --- DIFFICULTY SCALING ---
let spawnRateMultiplier = 1.0;
function increaseDifficulty() {
    if (isPaused || isGameOver) return;
    spawnRateMultiplier *= 0.90;
}
setInterval(increaseDifficulty, 60000);

// --- PLAYER OBJECT ---
const player = {
    x: playerX, y: playerY, width: 288, height: 288,
    hitboxOffsetX: 110, hitboxOffsetY: 110,
    facingRight: false,
    update() {
        this.x = playerX; this.y = playerY;
        if (moveLeft) this.facingRight = false;
        if (moveRight) this.facingRight = true;
        if (isMoving && !isPowered) {
            if (gameFrame % 10 === 0) frameY = (frameY === 0 ? 1 : 0);
        } else { frameY = 0; }
    },
    draw(ctx) {
        if (isPowered) {
            ctx.save();
            if (this.facingRight) { ctx.translate(this.x + 288, this.y + 288); ctx.scale(-1, 1); ctx.translate(-(this.x + 288), -(this.y + 288)); }
            let tractorFrame = Math.floor(gameFrame / 6) % 9;
            ctx.drawImage(tractorSprite, (tractorFrame % 3) * 288, Math.floor(tractorFrame / 3) * 288, 288, 288, this.x, this.y, 576, 576);
            ctx.restore();
        } else {
            ctx.drawImage(playerImage, 0, frameY * 288, 288, 288, this.x, this.y, 288, 288);
            if (hasGun) {
                ctx.save();
                ctx.translate(this.x + 140, this.y + 160 + (isMoving ? Math.sin(gameFrame * 0.2) * 5 : 0));
                if (this.facingRight) ctx.scale(-1, 1);
                if (isShooting && ammo > 0) {
                    let sF = Math.floor(gameFrame / 4) % 4;
                    ctx.drawImage(ak47Shooting, (sF % 2) * 64, Math.floor(sF / 2) * 64, 64, 64, -100, -100, 200, 200);
                } else { ctx.drawImage(ak47Idle, -100, -100, 200, 200); }
                ctx.restore();
            }
        }
    }
};

// --- COLLISION HELPER ---
function checkCollision(a, b, isItem = false) {
    let padding = isItem ? 60 : 0;
    let aW = (isPowered && a === player) ? 576 : 288;
    let aH = (isPowered && a === player) ? 576 : 288;
    let ax1 = a.x + (a.hitboxOffsetX || 0) - padding;
    let ay1 = a.y + (a.hitboxOffsetY || 0) - padding;
    let ax2 = a.x + aW - (a.hitboxOffsetX || 0) + padding;
    let ay2 = a.y + aH - (a.hitboxOffsetY || 0) + padding;
    let bx1 = b.x + (b.hitboxOffsetX || 0);
    let by1 = b.y + (b.hitboxOffsetY || 0);
    let bx2 = b.x + (b.width || 288) - (b.hitboxOffsetX || 0);
    let by2 = b.y + (b.height || 288) - (b.hitboxOffsetY || 0);
    return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
}

// --- ENEMY SPAWNER ---
function createEnemy(type = 1) {
    let ex, ey;
    do { ex = Math.random() * 2200; ey = Math.random() * 2200; } while (Math.hypot(playerX - ex, playerY - ey) < 700);
    let img = type === 1 ? enemySprite : (type === 2 ? enemySprite2 : enemySprite3);
    return {
        x: ex, y: ey, type, img,
        width: 288, height: type === 2 ? 432 : 288,
        speed: type === 1 ? 2 : (type === 2 ? 2.4 : 3.5),
        health: type === 2 ? 5 : 1,
        fIdx: 0, fT: 0, hitboxOffsetX: 90, hitboxOffsetY: 90,
        isDying: false, deathFrame: 0, deathTimer: 0
    };
}

// --- GAME OVER HANDLER ---
function triggerGameOver() {
    if (isGameOver) return;
    isGameOver = true;
    moveSound.pause();
    shootSound.pause();
    gameAudio.volume = 0.1;

    if (enemyKillScore > highScore) {
        highScore = enemyKillScore;
        localStorage.setItem('farmSpaceHighScore', highScore);
    }
    // --- ADD THIS: Save Pig High Score ---
    if (pigsSaved > pigHighScore) {
        pigHighScore = pigsSaved;
        localStorage.setItem('farmSpacePigHighScore', pigHighScore);
    }
}

// --- INPUTS ---
window.onkeydown = e => {
    let k = e.key.toLowerCase();
    if (gameAudio.paused) gameAudio.play();

    // Restart logic
    if (k === 'r' && isGameOver) {
        location.reload(); // Simplest way to reset all arrays and timers
    }

    if (k === 'arrowup') moveUp = true; if (k === 'arrowdown') moveDown = true;
    if (k === 'arrowleft') moveLeft = true; if (k === 'arrowright') moveRight = true;
    if (k === 's' && hasGun && ammo > 0) { isShooting = true; shootSound.play(); }
    if (k === ' ') { if (seedInventory > 0) { plantedWatermelons.push({ x: playerX, y: playerY, fIdx: 0, fT: 0, done: false, width: 288, height: 288, hitboxOffsetX: 70, hitboxOffsetY: 70 }); seedInventory--; } }
    if (k === 'p') isPaused = !isPaused;
    if (k === 'd') {
        if (carryingPig) {
            carryingPig = null;
        } else {
            pigs.forEach(p => {
                if (checkCollision(player, { x: p.x, y: p.y, width: 240, height: 240 })) {
                    carryingPig = p;
                    pigPickupSound.currentTime = 0;
                    pigPickupSound.play();
                }
            });
        }
    }
};
window.onkeyup = e => {
    let k = e.key.toLowerCase();
    if (k === 'arrowup') moveUp = false; if (k === 'arrowdown') moveDown = false;
    if (k === 'arrowleft') moveLeft = false; if (k === 'arrowright') moveRight = false;
    if (k === 's') { isShooting = false; shootSound.pause(); }
};

// --- MAIN LOOP ---
function gameLoop() {
    if (isPaused) return requestAnimationFrame(gameLoop);
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    gameFrame++;

    // --- CHECK GAME OVER ---
    if (isGameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.font = 'bold 160px Arial';
        ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 100);

        ctx.font = '80px Arial';
        ctx.fillText(`Kills: ${enemyKillScore}  |  Pigs Saved: ${pigsSaved}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);

        ctx.fillStyle = '#FFD700'; // Gold color for high score
        ctx.fillText(`PERSONAL BEST: ${highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 160);

        ctx.fillStyle = '#66ff66'; // Light green for the rescue score
        ctx.fillText(`Pigs Saved: ${pigsSaved} (Best: ${pigHighScore})`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 260);

        ctx.fillStyle = 'white';
        ctx.font = '50px Arial';
        ctx.fillText('Press [ R ] to Restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 350);
        return; // Stop processing the rest of the game
    }

    // --- DRAW CORRAL ---
    ctx.drawImage(corralSprite, corral.x, corral.y, corral.width, corral.height);

    // 1. TRACTOR EXPIRATION
    if (isPowered && Date.now() - powerTimer > 10000) { isPowered = false; }

    // 2. PLAYER MOVEMENT
    let speed = isPowered ? 12 : 6;
    if (moveLeft) playerX -= speed; if (moveRight) playerX += speed;
    if (moveUp) playerY -= speed; if (moveDown) playerY += speed;
    playerX = Math.max(0, Math.min(CANVAS_WIDTH - 288, playerX));
    playerY = Math.max(0, Math.min(CANVAS_HEIGHT - 288, playerY));
    isMoving = (moveLeft || moveRight || moveUp || moveDown);
    if (isMoving) moveSound.play(); else moveSound.pause();

    player.update();
    player.draw(ctx);

    // 3. PICKUPS
    guns.forEach((g, i) => {
        ctx.drawImage(ak47Idle, g.x, g.y, 600, 600);
        if (checkCollision(player, { x: g.x, y: g.y, width: 600, height: 600, hitboxOffsetX: 50, hitboxOffsetY: 50 }, true)) { hasGun = true; ammo = 100; guns.splice(i, 1); seedPickupSound.play(); }
    });
    seeds.forEach((s, i) => {
        ctx.drawImage(seedSprite, 0, (Math.floor(gameFrame / 10) % 2) * 288, 288, 288, s.x, s.y, 288, 288);
        if (checkCollision(player, { x: s.x, y: s.y, width: 288, height: 288, hitboxOffsetX: 70, hitboxOffsetY: 70 }, true)) { seedInventory++; seeds.splice(i, 1); seedPickupSound.play(); }
    });
    tires.forEach((t, i) => {
        ctx.drawImage(tireSprite, 0, (Math.floor(gameFrame / 15) % 2) * 300, 300, 300, t.x, t.y, 300, 300);
        if (checkCollision(player, { x: t.x, y: t.y, width: 300, height: 300, hitboxOffsetX: 50, hitboxOffsetY: 50 }, true)) { isPowered = true; powerTimer = Date.now(); tires.splice(i, 1); tirePickupSound.play(); }
    });

    // 4. RELOAD LOGIC
    if (hasGun && isShooting) {
        ammo -= 0.15;
        if (ammo <= 0) { hasGun = false; isShooting = false; gunCoolDownActive = true; killsSinceEmpty = 0; shootSound.pause(); }
    }
    if (gunCoolDownActive && killsSinceEmpty >= 10) { gunCoolDownActive = false; killsSinceEmpty = 0; }


    // 5. ENEMIES LOOP
    for (let i = enemies.length - 1; i >= 0; i--) {
        let en = enemies[i];

        // --- DEATH ANIMATION LOGIC ---
        if (en.isDying) {
            en.deathTimer++;
            if (en.deathTimer % 6 === 0) en.deathFrame++;

            if (en.deathFrame < 6) {
                let col = en.deathFrame % 2;
                let row = Math.floor(en.deathFrame / 2);

                // Determine which sprite and frame size to use
                let deathImg, sW, sH, dH;
                if (en.type === 2) {
                    deathImg = enemyDeathSprite2; // Your 256x384 sheet
                    sW = 128; // 256 / 2 columns
                    sH = 128; // 384 / 3 rows
                    dH = 288; // Match the Smart Poltra's living height
                } else {
                    deathImg = enemyDeathSprite;  // Your original 64x64 sheet
                    sW = 64;
                    sH = 64;
                    dH = 288; // Match the standard Poltra height
                }

                ctx.drawImage(
                    deathImg,
                    col * sW, row * sH, sW, sH, // Source
                    en.x, en.y, 288, dH         // Destination
                );
            } else {
                enemies.splice(i, 1);
            }
        } else {
            // --- MOVEMENT & AI ---
            let dx = player.x - en.x, dy = player.y - en.y, dist = Math.hypot(dx, dy);
            let moveDir = (isPowered || (hasGun && isShooting)) ? -1 : 1;
            en.x += (dx / dist) * en.speed * moveDir; en.y += (dy / dist) * en.speed * moveDir;
            en.fT++; if (en.fT >= 10) { en.fIdx = (en.fIdx + 1) % (en.type === 2 ? 5 : 2); en.fT = 0; }

            // --- DRAW LIVING ENEMIES ---
            if (en.type === 2) {
                let col = en.fIdx % 2, row = Math.floor(en.fIdx / 2);
                ctx.drawImage(en.img, col * 288, row * 288, 288, 288, en.x, en.y, 288, 432);
            } else if (en.type === 3) {
                ctx.drawImage(en.img, 0, en.fIdx * 64, 64, 64, en.x, en.y, 300, 400);
            } else {
                ctx.drawImage(en.img, en.fIdx * 288, 0, 288, 288, en.x, en.y, 288, 288);
            }

            // --- SHOOT DETECTION ---
            if (hasGun && isShooting && Math.abs((en.y + (en.height / 2)) - (playerY + 144)) < 150) {
                let pDx = en.x - playerX;
                if (((player.facingRight && pDx > 0) || (!player.facingRight && pDx < 0)) && gameFrame % 15 === 0) {
                    en.health--;
                    if (en.health <= 0) {
                        en.isDying = true;
                        en.deathFrame = 0;
                        en.deathTimer = 0;
                        enemyKillScore++;
                    }
                }
            }

            // --- COLLISION DETECTION ---
            if (checkCollision(player, en)) {
                if (isPowered) {
                    en.health = 0;
                    en.isDying = true;
                    en.deathFrame = 0;
                    en.deathTimer = 0;
                    enemyKillScore++;
                    if (gunCoolDownActive) killsSinceEmpty++;
                } else {
                    triggerGameOver();
                }
            }
        }
    }

    // 6. PIGS LOOP
    let anyPigWalking = false;
    pigs.forEach((pig) => {
        if (pig === carryingPig) {
            pig.x = playerX + 50;
            pig.y = playerY + 50;
        } else {
            anyPigWalking = true;
            pig.x += pig.vx; pig.y += pig.vy;
            if (pig.x < 0 || pig.x > CANVAS_WIDTH - 240) pig.vx *= -1;
            if (pig.y < 0 || pig.y > CANVAS_HEIGHT - 240) pig.vy *= -1;
            pig.fT++; if (pig.fT > 15) { pig.fIdx = (pig.fIdx + 1) % 3; pig.fT = 0; }
        }

        ctx.save();
        ctx.translate(pig.x + 120, pig.y + 120);
        if (pig !== carryingPig && pig.vx < 0) { ctx.scale(-1, 1); }
        if (pig === carryingPig) {
            ctx.drawImage(pigIdle, -120, -120, 240, 240);
        } else {
            let col = pig.fIdx % 2; let row = Math.floor(pig.fIdx / 2);
            ctx.drawImage(pigWalk, col * 64, row * 64, 64, 64, -120, -120, 240, 240);
        }
        ctx.restore();
    });

    // Play walk audio every 15 seconds
    let now = Date.now();
    if (anyPigWalking && (now - lastPigSoundTime > 15000)) {
        pigWalkSound.currentTime = 0;
        pigWalkSound.play();
        lastPigSoundTime = now;
    }

    // 7. CORRAL DELIVERY
    if (carryingPig && checkCollision(player, corral)) {
        const pigIndex = pigs.indexOf(carryingPig);
        if (pigIndex > -1) pigs.splice(pigIndex, 1);
        carryingPig = null;
        pigsSaved++;
        watermelonPickupSound.play();
    }

    // 8. WATERMELONS
    for (let i = plantedWatermelons.length - 1; i >= 0; i--) {
        let wm = plantedWatermelons[i];
        if (!wm.done) { wm.fT++; if (wm.fT > 50) { wm.fIdx++; wm.fT = 0; if (wm.fIdx >= 8) wm.done = true; } }
        ctx.drawImage(watermelonSprite, (wm.fIdx % 3) * 288, Math.floor(wm.fIdx / 3) * 288, 288, 288, wm.x, wm.y, 288, 288);
        if (wm.done && checkCollision(player, wm)) {
            plantedWatermelons.splice(i, 1); watermelonPickupSound.play();
            let target = enemies.find(e => !e.isDying);
            if (target) { target.isDying = true; enemyKillScore++; if (gunCoolDownActive) killsSinceEmpty++; }
        }
    }

    // 9. HUD
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(10, 10, 850, 240);
    ctx.fillStyle = 'white'; ctx.font = '40px Arial';
    ctx.fillText(`Seeds: ${seedInventory} | Kills: ${enemyKillScore} | Saved: ${pigsSaved}`, 30, 60);

    if (hasGun) {
        ctx.fillText("AMMO:", 30, 210);
        ctx.fillStyle = 'black'; ctx.fillRect(180, 185, 200, 30);
        ctx.fillStyle = ammo > 30 ? '#00FF00' : '#FF0000';
        ctx.fillRect(180, 185, ammo * 2, 30);
    } else if (gunCoolDownActive) {
        ctx.fillStyle = 'orange'; ctx.fillText(`RELOADING: ${killsSinceEmpty}/10 Kills`, 30, 210);
    }

    if (isPowered) {
        ctx.fillStyle = 'yellow';
        let rem = Math.max(0, Math.ceil((10000 - (Date.now() - powerTimer)) / 1000));
        ctx.fillText(`TRACTOR: ${rem}s`, 350, 60);
    }

    requestAnimationFrame(gameLoop);
}

// --- SPAWN TIMER ---
function spawnTick() {
    if (isPaused || isGameOver) return;

    const c1 = enemies.filter(e => e.type === 1).length;
    const c2 = enemies.filter(e => e.type === 2).length;
    const c3 = enemies.filter(e => e.type === 3).length;

    // We create an array of "Possible Spawns" based on your current score
    let possibleTypes = [];

    // Always allow Type 1 if under the limit
    if (c1 < 8) possibleTypes.push(1);

    // Allow Type 2 if score is 20+ and under the limit
    if ((enemyKillScore >= 20 || pigsSaved >= 10)&& c2< 4) {
        possibleTypes.push(2);
    }

    // Allow Type 3 if score is 40+ and under the limit
    if (enemyKillScore >= 40 && c3 < 2) possibleTypes.push(3);

    // If we have any valid types to spawn, pick one at random from the allowed list
    if (possibleTypes.length > 0) {
        let chosenType = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];
        enemies.push(createEnemy(chosenType));
    }

    // This ensures the timer NEVER stops, even if the screen is full
    setTimeout(spawnTick, 3000 * spawnRateMultiplier);
}

// --- MOBILE DETECTION ---
function isMobile() {
    return /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
}

// --- START SCREEN & INITIALIZATION ---
const startButton = document.getElementById('start-button');
const startScreen = document.getElementById('start-screen');
const mobileControls = document.getElementById('mobile-controls');

startButton.addEventListener('click', () => {
    startScreen.style.display = 'none';
    if (isMobile() && mobileControls) { mobileControls.style.display = 'block'; }
    gameAudio.play().catch(e => console.log("Audio blocked", e));
    spawnTick();

    setInterval(() => { if (!isGameOver && seeds.length < 5) seeds.push({ x: Math.random() * 2200, y: Math.random() * 2200 }); }, 12000);

    setInterval(() => {
        if (!isGameOver && pigs.length < 5 && !isPaused) {
            pigs.push({
                x: Math.random() * 2200, y: Math.random() * 2200,
                vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
                fIdx: 0, fT: 0, width: 240, height: 240
            });
        }
    }, 5000);

    setInterval(() => { if (!isGameOver && tires.length < 1) tires.push({ x: Math.random() * 2200, y: Math.random() * 2200 }); }, 75000);
    setInterval(() => {
        if (!isGameOver && enemyKillScore >= 5 && !hasGun && !gunCoolDownActive && guns.length === 0) {
            guns.push({ x: Math.random() * 2000, y: Math.random() * 2000 });
        }
    }, 4000);

    gameLoop();
});

playerImage.onload = () => {
    console.log("Farm Space assets loaded. Standing by for start...");
};