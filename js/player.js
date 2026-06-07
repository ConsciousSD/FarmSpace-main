import { gameState } from './state.js';
// FIXED: Added scytheSprite to the asset imports
import { playerImage, tractorSprite, ak47Shooting, ak47Idle, scytheSprite } from './assets.js';

export const player = {
    width: 288,
    height: 288, // 📐 FIXED: Height restored to 288 square bounds
    hitboxOffsetX: 110,
    hitboxOffsetY: 110,
    facingRight: false,

    update() {
        this.x = gameState.playerX;
        this.y = gameState.playerY;
        if (gameState.moveLeft) this.facingRight = false;
        if (gameState.moveRight) this.facingRight = true;
    },

    draw(ctx) {
        if (gameState.isPowered) {
            ctx.save();
            if (this.facingRight) {
                ctx.translate(this.x + 288, this.y + 288);
                ctx.scale(-1, 1);
                ctx.translate(-(this.x + 288), -(this.y + 288));
            }
            let tractorFrame = Math.floor(gameState.gameFrame / 6) % 9;
            ctx.drawImage(tractorSprite, (tractorFrame % 3) * 288, Math.floor(tractorFrame / 3) * 288, 288, 288, this.x, this.y, 576, 576);
            ctx.restore();
        } else {
            let checksMoving = (gameState.moveLeft || gameState.moveRight || gameState.moveUp || gameState.moveDown);
            let frameYOffset = (checksMoving ? (Math.floor(gameState.gameFrame / 10) % 2) : 0) * 288;

            // --- 1. RENDER BASE FARMER PLAYER (FLIPPING EXACTLY LIKE THE GUN) ---
            ctx.save();
            ctx.translate(this.x + 144, this.y);
            
            if (!this.facingRight) {
                ctx.scale(-1, 1);
            }
            
            ctx.drawImage(
                playerImage,
                0, frameYOffset,  // Source Crop Box Start
                288, 288,         // Source Crop Cell Size
                -144, 0,          // Destination Offset (Centers it back over this.x)
                288, 288          // 📐 FIXED: Render target height set to 288 square
            );
            ctx.restore();

            // --- 2. WEAPON ATTACHMENT HUD SYSTEM ---
            if (gameState.hasGun) {
                ctx.save();
                // 📐 ADJUSTED: Height anchor shifted up to y + 160 to match the 288 square torso
                ctx.translate(this.x + 140, this.y + 160 + (checksMoving ? Math.sin(gameState.gameFrame * 0.2) * 5 : 0));
                
                if (!this.facingRight) ctx.scale(-1, 1);
                
                if (gameState.isShooting && gameState.ammo > 0) {
                    let sF = Math.floor(gameState.gameFrame / 4) % 4;
                    ctx.drawImage(ak47Shooting, (sF % 2) * 64, Math.floor(sF / 2) * 64, 64, 64, -100, -100, 200, 200);
                } else {
                    ctx.drawImage(ak47Idle, -100, -100, 200, 200);
                }
                ctx.restore();
            } 
            else if (gameState.hasScythe) {
                ctx.save();
                // 📐 ADJUSTED: Height anchor shifted up to y + 160 to match the 288 square torso
                ctx.translate(this.x + 140, this.y + 160 + (checksMoving ? Math.sin(gameState.gameFrame * 0.2) * 5 : 0));

                if (!this.facingRight) ctx.scale(-1, 1);

                ctx.drawImage(scytheSprite, -30, -100, 180, 180);
                ctx.restore();
            }
        }
    }
};