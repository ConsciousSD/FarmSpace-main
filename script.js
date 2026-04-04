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
const grenadeSprite = new Image(); grenadeSprite.src = 'assets/Grenade.png';
const chickenSprite = new Image(); chickenSprite.src = 'assets/SpaceChicken.png';


// --- GAME STATE ---
let playerX = 1250, playerY = 1250;
let moveUp = false, moveDown = false, moveLeft = false, moveRight = false;
let isShooting = false, isMoving = false, gameFrame = 0;
let seedInventory = 0, enemyKillScore = 0, ammo = 0;
let hasGun = false, gunCoolDownActive = false, killsSinceEmpty = 0;
let isPowered = false, powerTimer = 0, isPaused = false, isGameOver = false;

const pigs = [];
let carryingPig = null;
let pigsSaved = 0;
let lastPigSoundTime = 0;

const chickens = [];
let carryingChicken = null;
let chickensSaved = 0;

const enemies = [], seeds = [], plantedWatermelons = [], tires = [], guns = [];
const grenadesOnGround = [];
const activeGrenades = [];
let carryingGrenade = false;

let highScore = localStorage.getItem('farmSpaceHighScore') || 0;
let pigHighScore = localStorage.getItem('farmSpacePigHighScore') || 0;
let chickenHighScore = localStorage.getItem('farmSpaceChickenHighScore') || 0; // Added this

const corral = { x: 20, y: (CANVAS_HEIGHT / 2) - 150, width: 300, height: 300 };

// --- DIFFICULTY SCALING ---
let spawnRateMultiplier = 1.0;
setInterval(() => {
    if (!isPaused && !isGameOver) spawnRateMultiplier *= 0.90;
}, 60000);

// --- HELPERS ---
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

function triggerGameOver() {
    if (isGameOver) return;
    isGameOver = true;
    moveSound.pause(); shootSound.pause();
    gameAudio.volume = 0.1;
    if (enemyKillScore > highScore) { highScore = enemyKillScore; localStorage.setItem('farmSpaceHighScore', highScore); }
    if (pigsSaved > pigHighScore) { pigHighScore = pigsSaved; localStorage.setItem('farmSpacePigHighScore', pigHighScore); }
    if (chickensSaved > chickenHighScore) { chickenHighScore = chickensSaved; localStorage.setItem('farmSpaceChickenHighScore', chickenHighScore); }
}

// --- PLAYER OBJECT ---
const player = {
    x: playerX, y: playerY, width: 288, height: 288,
    hitboxOffsetX: 110, hitboxOffsetY: 110,
    facingRight: false,
    update() {
        this.x = playerX; this.y = playerY;
        if (moveLeft) this.facingRight = false;
        if (moveRight) this.facingRight = true;
    },
    draw(ctx) {
        if (isPowered) {
            ctx.save();
            if (this.facingRight) { ctx.translate(this.x + 288, this.y + 288); ctx.scale(-1, 1); ctx.translate(-(this.x + 288), -(this.y + 288)); }
            let tractorFrame = Math.floor(gameFrame / 6) % 9;
            ctx.drawImage(tractorSprite, (tractorFrame % 3) * 288, Math.floor(tractorFrame / 3) * 288, 288, 288, this.x, this.y, 576, 576);
            ctx.restore();
        } else {
            ctx.drawImage(playerImage, 0, (isMoving ? (Math.floor(gameFrame / 10) % 2) : 0) * 288, 288, 288, this.x, this.y, 288, 288);
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

// --- INPUTS ---
window.onkeydown = e => {
    let k = e.key.toLowerCase();
    if (gameAudio.paused) gameAudio.play();
    if (k === 'r' && isGameOver) location.reload();
    if (k === 'arrowup') moveUp = true; if (k === 'arrowdown') moveDown = true;
    if (k === 'arrowleft') moveLeft = true; if (k === 'arrowright') moveRight = true;
    if (k === 's' && hasGun && ammo > 0) { isShooting = true; shootSound.play(); }
    if (k === 'p') isPaused = !isPaused;
    if (k === ' ') { 
        if (seedInventory > 0) { 
            plantedWatermelons.push({ x: playerX, y: playerY, fIdx: 0, fT: 0, done: false, width: 288, height: 288, hitboxOffsetX: 70, hitboxOffsetY: 70 }); 
            seedInventory--; 
        } 
    }
    if (k === 'd') {
        if (carryingPig) { carryingPig = null; }
        else if (carryingChicken) { carryingChicken = null; }
        else if (!carryingGrenade) {
            let grabbed = false;
            grenadesOnGround.forEach((g, i) => {
                if (checkCollision(player, { x: g.x, y: g.y, width: 200, height: 200 })) {
                    carryingGrenade = true; grenadesOnGround.splice(i, 1); pigPickupSound.play(); grabbed = true;
                }
            });
            if (!grabbed) {
                // Try to grab pig
                pigs.forEach(p => {
                    if (!grabbed && checkCollision(player, { x: p.x, y: p.y, width: 240, height: 240 })) {
                        carryingPig = p; pigPickupSound.currentTime = 0; pigPickupSound.play(); grabbed = true;
                    }
                });
                // Try to grab chicken
                chickens.forEach(c => {
                    if (!grabbed && checkCollision(player, { x: c.x, y: c.y, width: 240, height: 240 })) {
                        carryingChicken = c; pigPickupSound.currentTime = 0; pigPickupSound.play(); grabbed = true;
                    }
                });
            }
        }
    }
};

window.onkeyup = e => {
    let k = e.key.toLowerCase();
    if (k === 'arrowup') moveUp = false; if (k === 'arrowdown') moveDown = false;
    if (k === 'arrowleft') moveLeft = false; if (k === 'arrowright') moveRight = false;
    if (k === 's') { isShooting = false; shootSound.pause(); }
    if (k === 'd' && carryingGrenade) {
        carryingGrenade = false;
        activeGrenades.push({ x: playerX + 144, y: playerY + 144, vX: player.facingRight ? 18 : -18, vY: -12, timer: 50, exploded: false });
    }
};

// --- MAIN LOOP ---
function gameLoop() {
    if (isPaused) return requestAnimationFrame(gameLoop);
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    gameFrame++;

    if (isGameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.textAlign = 'center'; ctx.fillStyle = 'white'; ctx.font = 'bold 160px Arial';
        ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 150);
        ctx.font = '70px Arial';
        ctx.fillText(`Kills: ${enemyKillScore} (Best: ${highScore})`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.fillStyle = '#66ff66';
        ctx.fillText(`Pigs Saved: ${pigsSaved} | Chickens: ${chickensSaved}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100);
        ctx.fillStyle = 'white'; ctx.font = '50px Arial';
        ctx.fillText('Press [ R ] to Restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 250);
        return;
    }

    ctx.drawImage(corralSprite, corral.x, corral.y, corral.width, corral.height);

    grenadesOnGround.forEach(g => {
        let pulse = Math.sin(gameFrame * 0.1) * 5;
        ctx.drawImage(grenadeSprite, g.x - pulse, g.y - pulse, 160 + pulse * 2, 160 + pulse * 2);
    });

    if (isPowered && Date.now() - powerTimer > 10000) isPowered = false;

    let speed = isPowered ? 12 : 6;
    if (moveLeft) playerX -= speed; if (moveRight) playerX += speed;
    if (moveUp) playerY -= speed; if (moveDown) playerY += speed;
    playerX = Math.max(0, Math.min(CANVAS_WIDTH - 288, playerX));
    playerY = Math.max(0, Math.min(CANVAS_HEIGHT - 288, playerY));
    isMoving = (moveLeft || moveRight || moveUp || moveDown);
    if (isMoving) moveSound.play(); else moveSound.pause();

    player.update();
    player.draw(ctx);

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

    if (hasGun && isShooting) {
        ammo -= 0.15;
        if (ammo <= 0) { hasGun = false; isShooting = false; gunCoolDownActive = true; killsSinceEmpty = 0; shootSound.pause(); }
    }
    if (gunCoolDownActive && killsSinceEmpty >= 10) { gunCoolDownActive = false; killsSinceEmpty = 0; }

    for (let i = enemies.length - 1; i >= 0; i--) {
        let en = enemies[i];
        if (en.isDying) {
            en.deathTimer++; if (en.deathTimer % 6 === 0) en.deathFrame++;
            if (en.deathFrame < 6) {
                let col = en.deathFrame % 2, row = Math.floor(en.deathFrame / 2);
                let deathImg, sW, sH, dH;
                if (en.type === 2) { deathImg = enemyDeathSprite2; sW = 128; sH = 128; dH = 432; }
                else { deathImg = enemyDeathSprite; sW = 64; sH = 64; dH = 288; }
                ctx.drawImage(deathImg, col * sW, row * sH, sW, sH, en.x, en.y, 288, dH);
            } else enemies.splice(i, 1);
        } else {
            let dx = player.x - en.x, dy = player.y - en.y, dist = Math.hypot(dx, dy);
            let moveDir = (isPowered || (hasGun && isShooting)) ? -1 : 1;
            en.x += (dx / dist) * en.speed * moveDir; en.y += (dy / dist) * en.speed * moveDir;
            en.fT++; if (en.fT >= 10) { en.fIdx = (en.fIdx + 1) % (en.type === 2 ? 5 : 2); en.fT = 0; }
            if (en.type === 2) ctx.drawImage(en.img, (en.fIdx % 2) * 288, Math.floor(en.fIdx / 2) * 288, 288, 288, en.x, en.y, 288, 432);
            else if (en.type === 3) ctx.drawImage(en.img, 0, en.fIdx * 64, 64, 64, en.x, en.y, 300, 400);
            else ctx.drawImage(en.img, en.fIdx * 288, 0, 288, 288, en.x, en.y, 288, 288);

            if (hasGun && isShooting && Math.abs((en.y + (en.height / 2)) - (playerY + 144)) < 150) {
                let pDx = en.x - playerX;
                if (((player.facingRight && pDx > 0) || (!player.facingRight && pDx < 0)) && gameFrame % 15 === 0) {
                    en.health--; if (en.health <= 0) { en.isDying = true; en.deathFrame = 0; en.deathTimer = 0; enemyKillScore++; }
                }
            }
            if (checkCollision(player, en)) {
                if (isPowered) { en.health = 0; en.isDying = true; en.deathFrame = 0; en.deathTimer = 0; enemyKillScore++; if (gunCoolDownActive) killsSinceEmpty++; }
                else triggerGameOver();
            }
        }
    }

    let anyAnimalWalking = false;
    pigs.forEach((pig) => {
        if (pig === carryingPig) { pig.x = playerX + 50; pig.y = playerY + 50; }
        else {
            anyAnimalWalking = true; pig.x += pig.vx; pig.y += pig.vy;
            if (pig.x < 0 || pig.x > CANVAS_WIDTH - 240) pig.vx *= -1;
            if (pig.y < 0 || pig.y > CANVAS_HEIGHT - 240) pig.vy *= -1;
            pig.fT++; if (pig.fT > 15) { pig.fIdx = (pig.fIdx + 1) % 3; pig.fT = 0; }
        }
        ctx.save(); ctx.translate(pig.x + 120, pig.y + 120);
        if (pig !== carryingPig && pig.vx < 0) ctx.scale(-1, 1);
        if (pig === carryingPig) ctx.drawImage(pigIdle, -120, -120, 240, 240);
        else ctx.drawImage(pigWalk, (pig.fIdx % 2) * 64, Math.floor(pig.fIdx / 2) * 64, 64, 64, -120, -120, 240, 240);
        ctx.restore();
    });

    chickens.forEach((chicken) => {
        if (chicken === carryingChicken) { chicken.x = playerX + 50; chicken.y = playerY + 50; }
        else {
            anyAnimalWalking = true; chicken.x += chicken.vx; chicken.y += chicken.vy;
            if (chicken.x < 0 || chicken.x > CANVAS_WIDTH - 240) chicken.vx *= -1;
            if (chicken.y < 0 || chicken.y > CANVAS_HEIGHT - 240) chicken.vy *= -1;
            chicken.fT++; if (chicken.fT > 15) { chicken.fIdx = (chicken.fIdx + 1) % 1; chicken.fT = 0; }
        }
        ctx.save(); ctx.translate(chicken.x + 120, chicken.y + 120);
        if (chicken !== carryingChicken && chicken.vx < 0) ctx.scale(-1, 1);
        // Uses SpaceChicken.png asset
        ctx.drawImage(chickenSprite, 0, 0, 64, 64, -120, -120, 240, 240);
        ctx.restore();
    });
    

    let now = Date.now();
    if (anyAnimalWalking && (now - lastPigSoundTime > 15000)) { pigWalkSound.currentTime = 0; pigWalkSound.play(); lastPigSoundTime = now; }

    if (carryingPig && checkCollision(player, corral)) {
        pigs.splice(pigs.indexOf(carryingPig), 1); carryingPig = null; pigsSaved++; watermelonPickupSound.play();
    }
    if (carryingChicken && checkCollision(player, corral)) {
        chickens.splice(chickens.indexOf(carryingChicken), 1); carryingChicken = null; chickensSaved++; watermelonPickupSound.play();
    }

    // --- 8. WATERMELONS (FIXED ANIMATION) ---
    for (let i = plantedWatermelons.length - 1; i >= 0; i--) {
        let wm = plantedWatermelons[i];
        if (!wm.done) {
            wm.fT++;
            if (wm.fT > 50) {
                wm.fIdx++;
                wm.fT = 0;
                if (wm.fIdx >= 8) wm.done = true;
            }
        }
        let wmCols = 3, wmSize = 288;
        ctx.drawImage(watermelonSprite, (wm.fIdx % wmCols) * wmSize, Math.floor(wm.fIdx / wmCols) * wmSize, wmSize, wmSize, wm.x, wm.y, 288, 288);
        if (wm.done && checkCollision(player, wm)) {
            plantedWatermelons.splice(i, 1); watermelonPickupSound.play();
            let target = enemies.find(e => !e.isDying);
            if (target) { target.isDying = true; target.deathFrame = 0; target.deathTimer = 0; enemyKillScore++; if (gunCoolDownActive) killsSinceEmpty++; }
        }
    }

    activeGrenades.forEach((g, i) => {
        if (!g.exploded) {
            g.x += g.vX; g.y += g.vY; g.vY += 0.6; g.timer--;
            ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(gameFrame * 0.3);
            ctx.drawImage(grenadeSprite, -80, -80, 160, 160);
            ctx.restore();
            if (g.timer <= 0) {
                g.exploded = true; watermelonPickupSound.play();
                enemies.forEach(en => { if (Math.hypot(en.x - g.x, en.y - g.y) < 450) { en.health = 0; en.isDying = true; en.deathFrame = 0; enemyKillScore++; } });
            }
        } else {
            ctx.fillStyle = 'rgba(255, 165, 0, 0.7)'; ctx.beginPath(); ctx.arc(g.x, g.y, 150 + (Math.random() * 50), 0, Math.PI * 2); ctx.fill();
            g.timer--; if (g.timer < -15) activeGrenades.splice(i, 1);
        }
    });

    if (carryingGrenade) ctx.drawImage(grenadeSprite, playerX + (player.facingRight ? 200 : -20), playerY + 80, 160, 160);

    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(10, 10, 850, 240);
    ctx.fillStyle = 'white'; ctx.font = '40px Arial';
    ctx.fillText(`Seeds: ${seedInventory} | Kills: ${enemyKillScore} | Saved: ${pigsSaved} | Chickens: ${chickensSaved}`, 30, 60);
    if (hasGun) {
        ctx.fillText("AMMO:", 30, 210); ctx.fillStyle = 'black'; ctx.fillRect(180, 185, 200, 30);
        ctx.fillStyle = ammo > 30 ? '#00FF00' : '#FF0000'; ctx.fillRect(180, 185, ammo * 2, 30);
    } else if (gunCoolDownActive) {
        ctx.fillStyle = 'orange'; ctx.fillText(`RELOADING: ${killsSinceEmpty}/10 Kills`, 30, 210);
    }
    if (isPowered) {
        ctx.fillStyle = 'yellow'; let rem = Math.max(0, Math.ceil((10000 - (now - powerTimer)) / 1000));
        ctx.fillText(`TRACTOR: ${rem}s`, 350, 60);
    }
    requestAnimationFrame(gameLoop);
}

// --- SPAWN TIMER ---
function spawnTick() {
    if (isPaused || isGameOver) return;
    const c1 = enemies.filter(e => e.type === 1).length, 
          c2 = enemies.filter(e => e.type === 2).length, 
          c3 = enemies.filter(e => e.type === 3).length;
    
    let possible = [];
    if (c1 < (40 + Math.floor(enemyKillScore / 10))) possible.push(1);
    if ((enemyKillScore >= 20 || pigsSaved >= 10) && c2 < 8) possible.push(2);
    if (enemyKillScore >= 40 && c3 < 4) possible.push(3);
    
    if (possible.length > 0) {
        enemies.push(createEnemy(possible[Math.floor(Math.random() * possible.length)]));
    }
    setTimeout(spawnTick, 3000 * spawnRateMultiplier);
}

// --- START SCREEN & INITIALIZATION ---
const startButton = document.getElementById('start-button');
const startScreen = document.getElementById('start-screen');

function startGame() {
    if (startScreen.style.display === 'none') return;
    startScreen.style.display = 'none';
    gameAudio.play().catch(e => console.log("Audio blocked")); 
    
    spawnTick();
    
    setInterval(() => { if (!isGameOver && seeds.length < 5) seeds.push({ x: Math.random() * 2200, y: Math.random() * 2200 }); }, 12000);
    setInterval(() => {
        if (!isGameOver && pigs.length < 5 && !isPaused) pigs.push({ x: Math.random() * 2200, y: Math.random() * 2200, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, fIdx: 0, fT: 0, width: 240, height: 240 });
    }, 5000);
    setInterval(() => {
        if (!isGameOver && chickens.length < 5 && !isPaused) chickens.push({ x: Math.random() * 2200, y: Math.random() * 2200, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, fIdx: 0, fT: 0, width: 240, height: 240 });
    }, 5000);
    setInterval(() => { if (!isGameOver && tires.length < 1) tires.push({ x: Math.random() * 2200, y: Math.random() * 2200 }); }, 75000);
    setInterval(() => { if (!isGameOver && enemyKillScore >= 5 && !hasGun && !gunCoolDownActive && guns.length === 0) guns.push({ x: Math.random() * 2000, y: Math.random() * 2000 }); }, 4000);
    setInterval(() => {
        if (!isGameOver && enemies.length > 12 && grenadesOnGround.length < 1) {
            grenadesOnGround.push({ x: Math.random() * 2000 + 200, y: Math.random() * 2000 + 200 });
        }
    }, 5000);
    
    gameLoop();
}

startButton.addEventListener('click', startGame);
window.addEventListener('keydown', e => { if (e.key === 'Enter') startGame(); });

playerImage.onload = () => { console.log("Farm Space assets loaded."); };