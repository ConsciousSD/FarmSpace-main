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

// --- IMAGES ---
const playerImage = new Image(); playerImage.src = 'assets/Farmer (1).png';
const enemySprite = new Image(); enemySprite.src = 'assets/Poltra.png';
const enemySprite2 = new Image(); enemySprite2.src = 'assets/SmartPoltra.png';
const enemySprite3 = new Image(); enemySprite3.src = 'assets/Poltra3FL.png';
const seedSprite = new Image(); seedSprite.src = 'assets/Seed.png';
const watermelonSprite = new Image(); watermelonSprite.src = 'assets/Watermelon.png';
const tractorSprite = new Image(); tractorSprite.src = "assets/Tractor.png";
const tireSprite = new Image(); tireSprite.src = "assets/Wheel.png";
const ak47Idle = new Image(); ak47Idle.src = "assets/AK47.png";
const ak47Shooting = new Image(); ak47Shooting.src = "assets/AK47-shooting.png";

// --- GAME STATE ---
let playerX = 1250, playerY = 1250;
let moveUp = false, moveDown = false, moveLeft = false, moveRight = false;
let isShooting = false, isMoving = false, gameFrame = 0;
let frameX = 0, frameY = 0; 
let seedInventory = 0, enemyKillScore = 0, ammo = 0;
let hasGun = false, gunCoolDownActive = false, killsSinceEmpty = 0;
let isPowered = false, powerTimer = 0, isPaused = false;

const enemies = [], seeds = [], plantedWatermelons = [], tires = [], guns = [];

// --- DIFFICULTY SCALING ---
let spawnRateMultiplier = 1.0; 
function increaseDifficulty() {
    if (isPaused) return;
    spawnRateMultiplier *= 0.95;
}
setInterval(increaseDifficulty, 120000); 

// --- PLAYER ---
const player = {
    x: playerX, y: playerY, width: 288, height: 288,
    // Hitbox is shrunk significantly (110px off each side)
    hitboxOffsetX: 110, 
    hitboxOffsetY: 110, 
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
            
            /* --- HITBOX DEBUGGER (Uncomment to see your hitbox) ---
            ctx.strokeStyle = "red";
            ctx.strokeRect(this.x + this.hitboxOffsetX, this.y + this.hitboxOffsetY, this.width - (this.hitboxOffsetX * 2), this.height - (this.hitboxOffsetY * 2));
            */

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

// --- COLLISION ---
function checkCollision(a, b, isItem = false) {
    let padding = isItem ? 60 : 0; 
    let aW = (isPowered && a === player) ? 576 : 288;
    let aH = (isPowered && a === player) ? 576 : 288;

    // A's bounds
    let ax1 = a.x + (a.hitboxOffsetX || 0) - padding;
    let ay1 = a.y + (a.hitboxOffsetY || 0) - padding;
    let ax2 = a.x + aW - (a.hitboxOffsetX || 0) + padding;
    let ay2 = a.y + aH - (a.hitboxOffsetY || 0) + padding;

    // B's bounds
    let bx1 = b.x + (b.hitboxOffsetX || 0);
    let by1 = b.y + (b.hitboxOffsetY || 0);
    let bx2 = b.x + (b.width || 288) - (b.hitboxOffsetX || 0);
    let by2 = b.y + (b.height || 288) - (b.hitboxOffsetY || 0);

    return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
}

// --- SPAWNING ---
function createEnemy(type = 1) {
    let ex, ey;
    do { ex = Math.random() * 2200; ey = Math.random() * 2200; } while (Math.hypot(playerX - ex, playerY - ey) < 800);
    let img = type === 1 ? enemySprite : (type === 2 ? enemySprite2 : enemySprite3);
    return { x: ex, y: ey, type, img, width: 288, height: type === 2 ? 432 : 288, speed: type === 1 ? 2 : (type === 2 ? 2.4 : 3.5), fIdx: 0, fT: 0, hitboxOffsetX: 90, hitboxOffsetY: 90 };
}

// --- INPUTS ---
window.onkeydown = e => {
    let k = e.key.toLowerCase();
    if (gameAudio.paused) gameAudio.play();
    if (k === 'arrowup') moveUp = true; if (k === 'arrowdown') moveDown = true;
    if (k === 'arrowleft') moveLeft = true; if (k === 'arrowright') moveRight = true;
    if (k === 's' && hasGun && ammo > 0) { isShooting = true; shootSound.play(); }
    if (k === ' ') { if (seedInventory > 0) { plantedWatermelons.push({ x: playerX, y: playerY, fIdx: 0, fT: 0, done: false, width: 288, height: 288, hitboxOffsetX: 70, hitboxOffsetY: 70 }); seedInventory--; } }
    if (k === 'p') isPaused = !isPaused;
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

    let speed = isPowered ? 12 : 6;
    if (moveLeft) playerX -= speed; if (moveRight) playerX += speed;
    if (moveUp) playerY -= speed; if (moveDown) playerY += speed;
    playerX = Math.max(0, Math.min(CANVAS_WIDTH - 288, playerX));
    playerY = Math.max(0, Math.min(CANVAS_HEIGHT - 288, playerY));
    isMoving = (moveLeft || moveRight || moveUp || moveDown);
    if (isMoving) moveSound.play(); else moveSound.pause();

    player.update();
    player.draw(ctx);

    // PICKUPS
    guns.forEach((g, i) => {
        ctx.drawImage(ak47Idle, g.x, g.y, 600, 600);
        if (checkCollision(player, {x:g.x, y:g.y, width:600, height:600, hitboxOffsetX: 50, hitboxOffsetY: 50}, true)) { hasGun = true; ammo = 100; guns.splice(i, 1); seedPickupSound.play(); }
    });
    seeds.forEach((s, i) => {
        ctx.drawImage(seedSprite, 0, (Math.floor(gameFrame/10)%2)*288, 288, 288, s.x, s.y, 288, 288);
        if (checkCollision(player, {x:s.x, y:s.y, width:288, height:288, hitboxOffsetX: 70, hitboxOffsetY: 70}, true)) { seedInventory++; seeds.splice(i, 1); seedPickupSound.play(); }
    });
    tires.forEach((t, i) => {
        ctx.drawImage(tireSprite, 0, (Math.floor(gameFrame/15)%2)*300, 300, 300, t.x, t.y, 300, 300);
        if (checkCollision(player, {x:t.x, y:t.y, width:300, height:300, hitboxOffsetX: 50, hitboxOffsetY: 50}, true)) { isPowered = true; powerTimer = Date.now(); tires.splice(i, 1); tirePickupSound.play(); }
    });

    // SHOOTING & ENEMIES
    if (hasGun && isShooting) {
        ammo -= 0.15;
        if (ammo <= 0) { hasGun = false; isShooting = false; gunCoolDownActive = true; killsSinceEmpty = 0; shootSound.pause(); }
        enemies.forEach((en, i) => {
            if (Math.abs((en.y + (en.height/2)) - (playerY + 144)) < 150) {
                let dx = en.x - playerX;
                if (((player.facingRight && dx > 0) || (!player.facingRight && dx < 0)) && gameFrame % 15 === 0) {
                    enemies.splice(i, 1); enemyKillScore++; if (gunCoolDownActive) killsSinceEmpty++;
                }
            }
        });
    }

    enemies.forEach((en, i) => {
        let dx = player.x - en.x, dy = player.y - en.y, dist = Math.hypot(dx, dy);
        let moveDir = (isPowered || (hasGun && isShooting)) ? -1 : 1;
        en.x += (dx / dist) * en.speed * moveDir; en.y += (dy / dist) * en.speed * moveDir;
        en.fT++; if (en.fT >= 10) { en.fIdx = (en.fIdx + 1) % (en.type === 2 ? 5 : 2); en.fT = 0; }
        
        if (en.type === 2) {
            const col = en.fIdx % 2, row = Math.floor(en.fIdx / 2);
            ctx.drawImage(en.img, col * 288, row * 288, 288, 288, en.x, en.y, 288, 432);
        } else if (en.type === 3) {
            ctx.drawImage(en.img, 0, en.fIdx * 64, 64, 64, en.x, en.y, 300, 400);
        } else {
            ctx.drawImage(en.img, en.fIdx * 288, 0, 288, 288, en.x, en.y, 288, 288);
        }
        if (checkCollision(player, en)) {
            if (isPowered) { enemies.splice(i, 1); enemyKillScore++; if (gunCoolDownActive) killsSinceEmpty++; }
            else { location.reload(); }
        }
    });

    if (gunCoolDownActive && killsSinceEmpty >= 10) { gunCoolDownActive = false; killsSinceEmpty = 0; }
    if (isPowered && Date.now() - powerTimer > 10000) isPowered = false;

    // WATERMELONS
    for (let i = plantedWatermelons.length - 1; i >= 0; i--) {
        let wm = plantedWatermelons[i];
        if (!wm.done) { wm.fT++; if (wm.fT > 50) { wm.fIdx++; wm.fT = 0; if (wm.fIdx >= 8) wm.done = true; } }
        ctx.drawImage(watermelonSprite, (wm.fIdx % 3) * 288, Math.floor(wm.fIdx / 3) * 288, 288, 288, wm.x, wm.y, 288, 288);
        if (wm.done && checkCollision(player, wm)) {
            plantedWatermelons.splice(i, 1); watermelonPickupSound.play();
            if (enemies.length > 0) { enemies.shift(); enemyKillScore++; if (gunCoolDownActive) killsSinceEmpty++; }
        }
    }

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(10, 10, 750, 240);
    ctx.fillStyle = 'white'; ctx.font = '40px Arial';
    ctx.fillText(`Seeds: ${seedInventory} | Kills: ${enemyKillScore}`, 30, 60);
    if (hasGun) {
        ctx.fillText("AMMO:", 30, 210);
        ctx.fillStyle = 'black'; ctx.fillRect(180, 185, 200, 30);
        ctx.fillStyle = ammo > 30 ? '#00FF00' : '#FF0000';
        ctx.fillRect(180, 185, ammo * 2, 30);
    } else if (gunCoolDownActive) {
        ctx.fillStyle = 'orange'; ctx.fillText(`RELOADING: ${killsSinceEmpty}/10 Kills`, 30, 210);
    } else if (enemyKillScore < 5) {
        ctx.fillStyle = 'gray'; ctx.fillText(`GUN LOCKED: ${enemyKillScore}/5`, 30, 210);
    }
    if (isPowered) { ctx.fillStyle = 'yellow'; ctx.fillText(`TRACTOR: ${Math.ceil((10000-(Date.now()-powerTimer))/1000)}s`, 350, 60); }

    requestAnimationFrame(gameLoop);
}

// --- SPAWN TIMER ---
function spawnTick() {
    if (isPaused) return;
    if (enemies.length < 15) enemies.push(createEnemy(1));
    if (enemyKillScore >= 10 && enemies.length < 25) enemies.push(createEnemy(2));
    if (enemyKillScore >= 20 && enemies.length < 30) enemies.push(createEnemy(3));
    setTimeout(spawnTick, 5000 * spawnRateMultiplier);
}

// START
playerImage.onload = () => {
    spawnTick();
    setInterval(() => { if (seeds.length < 5) seeds.push({x: Math.random()*2200, y: Math.random()*2200}); }, 10000);
    setInterval(() => { if (tires.length < 1) tires.push({x: Math.random()*2200, y: Math.random()*2200}); }, 90000);
    setInterval(() => { if (enemyKillScore >= 5 && !hasGun && !gunCoolDownActive && guns.length === 0) guns.push({x: Math.random()*2000, y: Math.random()*2000}); }, 5000);
    gameLoop();
};