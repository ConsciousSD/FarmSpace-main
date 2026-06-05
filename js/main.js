import { gameState, ctx, CANVAS_WIDTH, CANVAS_HEIGHT } from './state.js';
import { initInput } from './input.js';
import { player } from './player.js';
import { checkCollision, createEnemy, triggerGameOver } from './helpers.js';
import { gameAudio, moveSound, shootSound, seedPickupSound, tirePickupSound, watermelonPickupSound, pigWalkSound } from './audio.js';
import { corralSprite, grenadeSprite, seedSprite, tireSprite, ak47Idle, enemyDeathSprite, enemyDeathSprite2, pigIdle, pigWalk, chickenSprite, watermelonSprite } from './assets.js';

// Setup intervals scaling
setInterval(() => {
    if (!gameState.isPaused && !gameState.isGameOver) gameState.spawnRateMultiplier *= 0.90;
}, 60000);

function gameLoop() {
    if (gameState.isPaused) return requestAnimationFrame(gameLoop);
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    gameState.gameFrame++;

    if (gameState.isGameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.textAlign = 'center'; ctx.fillStyle = 'white'; ctx.font = 'bold 160px Arial';
        ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 150);
        ctx.font = '70px Arial';
        ctx.fillText(`Kills: ${gameState.enemyKillScore} (Best: ${gameState.highScore})`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.fillStyle = '#66ff66';
        ctx.fillText(`Pigs Saved: ${gameState.pigsSaved} | Chickens: ${gameState.chickensSaved}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100);
        ctx.fillStyle = 'white'; ctx.font = '50px Arial';
        ctx.fillText('Press [ R ] to Restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 250);
        return;
    }

    ctx.drawImage(corralSprite, gameState.corral.x, gameState.corral.y, gameState.corral.width, gameState.corral.height);

    gameState.grenadesOnGround.forEach(g => {
        let pulse = Math.sin(gameState.gameFrame * 0.1) * 5;
        ctx.drawImage(grenadeSprite, g.x - pulse, g.y - pulse, 160 + pulse * 2, 160 + pulse * 2);
    });

    if (gameState.isPowered && Date.now() - gameState.powerTimer > 10000) gameState.isPowered = false;

    let speed = gameState.isPowered ? 12 : 6;
    if (gameState.moveLeft) gameState.playerX -= speed; if (gameState.moveRight) gameState.playerX += speed;
    if (gameState.moveUp) gameState.playerY -= speed; if (gameState.moveDown) gameState.playerY += speed;
    gameState.playerX = Math.max(0, Math.min(CANVAS_WIDTH - 288, gameState.playerX));
    gameState.playerY = Math.max(0, Math.min(CANVAS_HEIGHT - 288, gameState.playerY));
    gameState.isMoving = (gameState.moveLeft || gameState.moveRight || gameState.moveUp || gameState.moveDown);
    if (gameState.isMoving) moveSound.play(); else moveSound.pause();

    player.update();
    player.draw(ctx);

    gameState.guns.forEach((g, i) => {
        ctx.drawImage(ak47Idle, g.x, g.y, 600, 600);
        if (checkCollision(player, { x: g.x, y: g.y, width: 600, height: 600, hitboxOffsetX: 50, hitboxOffsetY: 50 }, true)) { gameState.hasGun = true; gameState.ammo = 100; gameState.guns.splice(i, 1); seedPickupSound.play(); }
    });
    gameState.seeds.forEach((s, i) => {
        ctx.drawImage(seedSprite, 0, (Math.floor(gameState.gameFrame / 10) % 2) * 288, 288, 288, s.x, s.y, 288, 288);
        if (checkCollision(player, { x: s.x, y: s.y, width: 288, height: 288, hitboxOffsetX: 70, hitboxOffsetY: 70 }, true)) { gameState.seedInventory++; gameState.seeds.splice(i, 1); seedPickupSound.play(); }
    });
    gameState.tires.forEach((t, i) => {
        ctx.drawImage(tireSprite, 0, (Math.floor(gameState.gameFrame / 15) % 2) * 300, 300, 300, t.x, t.y, 300, 300);
        if (checkCollision(player, { x: t.x, y: t.y, width: 300, height: 300, hitboxOffsetX: 50, hitboxOffsetY: 50 }, true)) { gameState.isPowered = true; gameState.powerTimer = Date.now(); gameState.tires.splice(i, 1); tirePickupSound.play(); }
    });

    if (gameState.hasGun && gameState.isShooting) {
        gameState.ammo -= 0.15;
        if (gameState.ammo <= 0) { gameState.hasGun = false; gameState.isShooting = false; gameState.gunCoolDownActive = true; gameState.killsSinceEmpty = 0; shootSound.pause(); }
    }
    if (gameState.gunCoolDownActive && gameState.killsSinceEmpty >= 10) { gameState.gunCoolDownActive = false; gameState.killsSinceEmpty = 0; }

    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        let en = gameState.enemies[i];
        if (en.isDying) {
            en.deathTimer++; if (en.deathTimer % 6 === 0) en.deathFrame++;
            if (en.deathFrame < 6) {
                let col = en.deathFrame % 2, row = Math.floor(en.deathFrame / 2);
                let deathImg, sW, sH, dH;
                if (en.type === 2) { deathImg = enemyDeathSprite2; sW = 128; sH = 128; dH = 432; }
                else { deathImg = enemyDeathSprite; sW = 64; sH = 64; dH = 288; }
                ctx.drawImage(deathImg, col * sW, row * sH, sW, sH, en.x, en.y, 288, dH);
            } else gameState.enemies.splice(i, 1);
        } else {
            let dx = player.x - en.x, dy = player.y - en.y, dist = Math.hypot(dx, dy);
            let moveDir = (gameState.isPowered || (gameState.hasGun && gameState.isShooting)) ? -1 : 1;
            en.x += (dx / dist) * en.speed * moveDir; en.y += (dy / dist) * en.speed * moveDir;
            en.fT++; if (en.fT >= 10) { en.fIdx = (en.fIdx + 1) % (en.type === 2 ? 5 : 2); en.fT = 0; }
            if (en.type === 2) ctx.drawImage(en.img, (en.fIdx % 2) * 288, Math.floor(en.fIdx / 2) * 288, 288, 288, en.x, en.y, 288, 432);
            else if (en.type === 3) ctx.drawImage(en.img, 0, en.fIdx * 64, 64, 64, en.x, en.y, 300, 400);
            else ctx.drawImage(en.img, en.fIdx * 288, 0, 288, 288, en.x, en.y, 288, 288);

            if (gameState.hasGun && gameState.isShooting && Math.abs((en.y + (en.height / 2)) - (gameState.playerY + 144)) < 150) {
                let pDx = en.x - gameState.playerX;
                if (((player.facingRight && pDx > 0) || (!player.facingRight && pDx < 0)) && gameState.gameFrame % 15 === 0) {
                    en.health--; if (en.health <= 0) { en.isDying = true; en.deathFrame = 0; en.deathTimer = 0; gameState.enemyKillScore++; }
                }
            }
            if (checkCollision(player, en)) {
                if (gameState.isPowered) { en.health = 0; en.isDying = true; en.deathFrame = 0; en.deathTimer = 0; gameState.enemyKillScore++; if (gameState.gunCoolDownActive) gameState.killsSinceEmpty++; }
                else triggerGameOver();
            }
        }
    }

    let anyAnimalWalking = false;
    gameState.pigs.forEach((pig) => {
        if (pig === gameState.carryingPig) { pig.x = gameState.playerX + 50; pig.y = gameState.playerY + 50; }
        else {
            anyAnimalWalking = true; pig.x += pig.vx; pig.y += pig.vy;
            if (pig.x < 0 || pig.x > CANVAS_WIDTH - 240) pig.vx *= -1;
            if (pig.y < 0 || pig.y > CANVAS_HEIGHT - 240) pig.vy *= -1;
            pig.fT++; if (pig.fT > 15) { pig.fIdx = (pig.fIdx + 1) % 3; pig.fT = 0; }
        }
        ctx.save(); ctx.translate(pig.x + 120, pig.y + 120);
        if (pig !== gameState.carryingPig && pig.vx < 0) ctx.scale(-1, 1);
        if (pig === gameState.carryingPig) ctx.drawImage(pigIdle, -120, -120, 240, 240);
        else ctx.drawImage(pigWalk, (pig.fIdx % 2) * 64, Math.floor(pig.fIdx / 2) * 64, 64, 64, -120, -120, 240, 240);
        ctx.restore();
    });

    gameState.chickens.forEach((chicken) => {
        if (chicken === gameState.carryingChicken) { chicken.x = gameState.playerX + 50; chicken.y = gameState.playerY + 50; }
        else {
            anyAnimalWalking = true; chicken.x += chicken.vx; chicken.y += chicken.vy;
            if (chicken.x < 0 || chicken.x > CANVAS_WIDTH - 240) chicken.vx *= -1;
            if (chicken.y < 0 || chicken.y > CANVAS_HEIGHT - 240) chicken.vy *= -1;
            chicken.fT++; if (chicken.fT > 15) { chicken.fIdx = (chicken.fIdx + 1) % 1; chicken.fT = 0; }
        }
        ctx.save(); ctx.translate(chicken.x + 120, chicken.y + 120);
        if (chicken !== gameState.carryingChicken && chicken.vx < 0) ctx.scale(-1, 1);
        ctx.drawImage(chickenSprite, 0, 0, 64, 64, -120, -120, 240, 240);
        ctx.restore();
    });

    let now = Date.now();
    if (anyAnimalWalking && (now - gameState.lastPigSoundTime > 15000)) { pigWalkSound.currentTime = 0; pigWalkSound.play(); gameState.lastPigSoundTime = now; }

    if (gameState.carryingPig && checkCollision(player, gameState.corral)) {
        gameState.pigs.splice(gameState.pigs.indexOf(gameState.carryingPig), 1); gameState.carryingPig = null; gameState.pigsSaved++; watermelonPickupSound.play();
    }
    if (gameState.carryingChicken && checkCollision(player, gameState.corral)) {
        gameState.chickens.splice(gameState.chickens.indexOf(gameState.carryingChicken), 1); gameState.carryingChicken = null; gameState.chickensSaved++; watermelonPickupSound.play();
    }

    for (let i = gameState.plantedWatermelons.length - 1; i >= 0; i--) {
        let wm = gameState.plantedWatermelons[i];
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
            gameState.plantedWatermelons.splice(i, 1); watermelonPickupSound.play();
            let target = gameState.enemies.find(e => !e.isDying);
            if (target) { target.isDying = true; target.deathFrame = 0; target.deathTimer = 0; gameState.enemyKillScore++; if (gameState.gunCoolDownActive) gameState.killsSinceEmpty++; }
        }
    }

    gameState.activeGrenades.forEach((g, i) => {
        if (!g.exploded) {
            g.x += g.vX; g.y += g.vY; g.vY += 0.6; g.timer--;
            ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(gameState.gameFrame * 0.3);
            ctx.drawImage(grenadeSprite, -80, -80, 160, 160);
            ctx.restore();
            if (g.timer <= 0) {
                g.exploded = true; watermelonPickupSound.play();
                gameState.enemies.forEach(en => { if (Math.hypot(en.x - g.x, en.y - g.y) < 450) { en.health = 0; en.isDying = true; en.deathFrame = 0; gameState.enemyKillScore++; } });
            }
        } else {
            ctx.fillStyle = 'rgba(255, 165, 0, 0.7)'; ctx.beginPath(); ctx.arc(g.x, g.y, 150 + (Math.random() * 50), 0, Math.PI * 2); ctx.fill();
            g.timer--; if (g.timer < -15) gameState.activeGrenades.splice(i, 1);
        }
    });

    if (gameState.carryingGrenade) ctx.drawImage(grenadeSprite, gameState.playerX + (player.facingRight ? 200 : -20), gameState.playerY + 80, 160, 160);

    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(10, 10, 850, 240);
    ctx.fillStyle = 'white'; ctx.font = '40px Arial';
    ctx.fillText(`Seeds: ${gameState.seedInventory} | Kills: ${gameState.enemyKillScore} | Saved: ${gameState.pigsSaved} | Chickens: ${gameState.chickensSaved}`, 30, 60);
    if (gameState.hasGun) {
        ctx.fillText("AMMO:", 30, 210); ctx.fillStyle = 'black'; ctx.fillRect(180, 185, 200, 30);
        ctx.fillStyle = gameState.ammo > 30 ? '#00FF00' : '#FF0000'; ctx.fillRect(180, 185, gameState.ammo * 2, 30);
    } else if (gameState.gunCoolDownActive) {
        ctx.fillStyle = 'orange'; ctx.fillText(`RELOADING: ${gameState.killsSinceEmpty}/10 Kills`, 30, 210);
    }
    if (gameState.isPowered) {
        ctx.fillStyle = 'yellow'; let rem = Math.max(0, Math.ceil((10000 - (now - gameState.powerTimer)) / 1000));
        ctx.fillText(`TRACTOR: ${rem}s`, 350, 60);
    }
    requestAnimationFrame(gameLoop);
}

function spawnTick() {
    if (gameState.isPaused || gameState.isGameOver) return;
    const c1 = gameState.enemies.filter(e => e.type === 1).length, 
          c2 = gameState.enemies.filter(e => e.type === 2).length, 
          c3 = gameState.enemies.filter(e => e.type === 3).length;
    
    let possible = [];
    if (c1 < (40 + Math.floor(gameState.enemyKillScore / 10))) possible.push(1);
    if ((gameState.enemyKillScore >= 20 || gameState.pigsSaved >= 10) && c2 < 8) possible.push(2);
    if (gameState.enemyKillScore >= 40 && c3 < 4) possible.push(3);
    
    if (possible.length > 0) {
        gameState.enemies.push(createEnemy(possible[Math.floor(Math.random() * possible.length)]));
    }
    setTimeout(spawnTick, 3000 * gameState.spawnRateMultiplier);
}

const startButton = document.getElementById('start-button');
const startScreen = document.getElementById('start-screen');

function startGame() {
    if (startScreen.style.display === 'none') return;
    startScreen.style.display = 'none';
    gameAudio.play().catch(e => console.log("Audio blocked")); 
    
    initInput();
    spawnTick();
    
    setInterval(() => { if (!gameState.isGameOver && gameState.seeds.length < 5) gameState.seeds.push({ x: Math.random() * 2200, y: Math.random() * 2200 }); }, 12000);
    setInterval(() => {
        if (!gameState.isGameOver && gameState.pigs.length < 5 && !gameState.isPaused) gameState.pigs.push({ x: Math.random() * 2200, y: Math.random() * 2200, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, fIdx: 0, fT: 0, width: 240, height: 240 });
    }, 5000);
    setInterval(() => {
        if (!gameState.isGameOver && gameState.chickens.length < 5 && !gameState.isPaused) gameState.chickens.push({ x: Math.random() * 2200, y: Math.random() * 2200, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, fIdx: 0, fT: 0, width: 240, height: 240 });
    }, 5000);
    setInterval(() => { if (!gameState.isGameOver && gameState.tires.length < 1) gameState.tires.push({ x: Math.random() * 2200, y: Math.random() * 2200 }); }, 75000);
    setInterval(() => { if (!gameState.isGameOver && gameState.enemyKillScore >= 5 && !gameState.hasGun && !gameState.gunCoolDownActive && gameState.guns.length === 0) gameState.guns.push({ x: Math.random() * 2000, y: Math.random() * 2000 }); }, 4000);
    setInterval(() => {
        if (!gameState.isGameOver && gameState.enemies.length > 12 && gameState.grenadesOnGround.length < 1) {
            gameState.grenadesOnGround.push({ x: Math.random() * 2000 + 200, y: Math.random() * 2000 + 200 });
        }
    }, 5000);
    
    gameLoop();
}

startButton.addEventListener('click', startGame);
window.addEventListener('keydown', e => { if (e.key === 'Enter') startGame(); });