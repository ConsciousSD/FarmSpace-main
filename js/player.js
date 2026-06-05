import { gameState } from './state.js';
// FIXED: Added scytheSprite to the asset imports
import { playerImage, tractorSprite, ak47Shooting, ak47Idle, scytheSprite } from './assets.js';

export const player = {
    width: 288, height: 288,
    hitboxOffsetX: 110, hitboxOffsetY: 110,
    facingRight: false,
    update() {
        this.x = gameState.playerX; this.y = gameState.playerY;
        if (gameState.moveLeft) this.facingRight = false;
        if (gameState.moveRight) this.facingRight = true;
    },
    draw(ctx) {
        if (gameState.isPowered) {
            ctx.save();
            if (this.facingRight) { ctx.translate(this.x + 288, this.y + 288); ctx.scale(-1, 1); ctx.translate(-(this.x + 288), -(this.y + 288)); }
            let tractorFrame = Math.floor(gameState.gameFrame / 6) % 9;
            ctx.drawImage(tractorSprite, (tractorFrame % 3) * 288, Math.floor(tractorFrame / 3) * 288, 288, 288, this.x, this.y, 576, 576);
            ctx.restore();
        } else {
            // Draw base farmer sprite
            ctx.drawImage(playerImage, 0, (gameState.isMoving ? (Math.floor(gameState.gameFrame / 10) % 2) : 0) * 288, 288, 288, this.x, this.y, 288, 288);
            
            // --- WEAPON RENDER SYSTEM ---
            if (gameState.hasGun) {
                ctx.save();
                ctx.translate(this.x + 140, this.y + 160 + (gameState.isMoving ? Math.sin(gameState.gameFrame * 0.2) * 5 : 0));
                if (this.facingRight) ctx.scale(-1, 1);
                if (gameState.isShooting && gameState.ammo > 0) {
                    let sF = Math.floor(gameState.gameFrame / 4) % 4;
                    ctx.drawImage(ak47Shooting, (sF % 2) * 64, Math.floor(sF / 2) * 64, 64, 64, -100, -100, 200, 200);
                } else { ctx.drawImage(ak47Idle, -100, -100, 200, 200); }
                ctx.restore();
            } 
            // FIXED: Added check to visually render scythe when holding it
            else if (gameState.hasScythe) {
                ctx.save();
                // Anchors and bobs weapon dynamically with the player's movement animation
                ctx.translate(this.x + 140, this.y + 160 + (gameState.isMoving ? Math.sin(gameState.gameFrame * 0.2) * 5 : 0));
                if (this.facingRight) ctx.scale(-1, 1);
                
                // Draws your custom scythe image asset relative to the hand position
                ctx.drawImage(scytheSprite, -100, -100, 200, 200);
                ctx.restore();
            }
        }
    }
};