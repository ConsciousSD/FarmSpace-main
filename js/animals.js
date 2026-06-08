import { gameState, ctx, CANVAS_WIDTH, CANVAS_HEIGHT } from './state.js';
import { checkCollision } from './helpers.js';
import { player } from './player.js';
import { pigIdle, pigWalk, chickenSprite, spaceCowSprite } from './assets.js';
import { watermelonPickupSound } from './audio.js';

export function updateAndDrawAnimals() {
    // --- 1. PIGS LAYER ---
    gameState.pigs.forEach((pig) => {
        if (pig === gameState.carryingPig) { 
            pig.x = gameState.playerX + 50; 
            pig.y = gameState.playerY + 50; 
        } else {
            pig.x += pig.vx; pig.y += pig.vy;
            if (pig.x < 0 || pig.x > CANVAS_WIDTH - 240) pig.vx *= -1;
            if (pig.y < 0 || pig.y > CANVAS_HEIGHT - 240) pig.vy *= -1;
            pig.fT++; 
            if (pig.fT > 15) { pig.fIdx = (pig.fIdx + 1) % 3; pig.fT = 0; }
        }
        ctx.save(); 
        ctx.translate(pig.x + 120, pig.y + 120);
        if (pig !== gameState.carryingPig && pig.vx < 0) ctx.scale(-1, 1);
        if (pig === gameState.carryingPig) ctx.drawImage(pigIdle, -120, -120, 240, 240);
        else ctx.drawImage(pigWalk, (pig.fIdx % 2) * 64, Math.floor(pig.fIdx / 2) * 64, 64, 64, -120, -120, 240, 240);
        ctx.restore();
    });

    // --- 2. CHICKENS LAYER ---
    gameState.chickens.forEach((chicken) => {
        if (chicken === gameState.carryingChicken) { 
            chicken.x = gameState.playerX + 50; 
            chicken.y = gameState.playerY + 50; 
        } else {
            chicken.x += chicken.vx; chicken.y += chicken.vy;
            if (chicken.x < 0 || chicken.x > CANVAS_WIDTH - 240) chicken.vx *= -1;
            if (chicken.y < 0 || chicken.y > CANVAS_HEIGHT - 240) chicken.vy *= -1;
            chicken.fT++; 
            if (chicken.fT > 15) { chicken.fIdx = (chicken.fIdx + 1) % 1; chicken.fT = 0; }
        }
        ctx.save(); 
        ctx.translate(chicken.x + 120, chicken.y + 120);
        if (chicken !== gameState.carryingChicken && chicken.vx < 0) ctx.scale(-1, 1);
        ctx.drawImage(chickenSprite, 0, 0, 64, 64, -120, -120, 240, 240);
        ctx.restore();
    });

    // --- 3. CORRAL DELIVERY DROP CHUTES ---
    if (gameState.carryingPig && checkCollision(player, gameState.corral)) {
        gameState.pigs.splice(gameState.pigs.indexOf(gameState.carryingPig), 1); 
        gameState.carryingPig = null; 
        gameState.pigsSaved++;
        watermelonPickupSound.play().catch(() => { });
        gameState.charms.push({ x: gameState.corral.x + gameState.corral.width + 20, y: gameState.corral.y + (gameState.corral.height / 2) - 50, width: 120, height: 120 });
    }
    if (gameState.carryingChicken && checkCollision(player, gameState.corral)) {
        gameState.chickens.splice(gameState.chickens.indexOf(gameState.carryingChicken), 1); 
        gameState.carryingChicken = null; 
        gameState.chickensSaved++;
        watermelonPickupSound.play().catch(() => { });
        gameState.charms.push({ x: gameState.corral.x + gameState.corral.width + 20, y: gameState.corral.y + (gameState.corral.height / 2) - 50, width: 120, height: 120 });
    }

    // --- 4. SPACE COWS LAYER ---
    if (gameState.spaceCows) {
        gameState.spaceCows.forEach((cow) => {
            cow.x += cow.vx; 
            cow.y += cow.vy;
            if (cow.x < 0 || cow.x > CANVAS_WIDTH - 240) cow.vx *= -1;
            if (cow.y < 0 || cow.y > CANVAS_HEIGHT - 240) cow.vy *= -1;
            ctx.save();
            ctx.translate(cow.x + 120, cow.y + 120);
            if (cow.vx > 0) ctx.scale(-1, 1);
            ctx.drawImage(spaceCowSprite, 0, 0, 1280, 1280, -120, -120, 240, 240);
            ctx.restore();
        });
    }
}