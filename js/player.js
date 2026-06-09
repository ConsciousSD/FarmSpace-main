import { gameState } from './state.js';
import { playerImage, tractorSprite, ak47Shooting, ak47Idle, scytheSprite, serpentSword, swingingSword } from './assets.js';

export const player = {
    width: 288,
    height: 288,
    hitboxOffsetX: 110,
    hitboxOffsetY: 110,
    facingRight: false,

    update() {
        this.x = gameState.playerX;
        this.y = gameState.playerY;

        // 🎯 FIX: Explicitly check all active keys so he faces where he's running
        if (gameState.moveLeft || gameState.moveUp) {
            this.facingRight = false;
        }
        if (gameState.moveRight || gameState.moveDown) {
            this.facingRight = true;
        }
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
            // 🎯 FIX: Detect movement keys to determine if the run-cycle animation rows should play
            let checksMoving = (gameState.moveLeft || gameState.moveRight || gameState.moveUp || gameState.moveDown);
            let frameYOffset = (checksMoving ? (Math.floor(gameState.gameFrame / 10) % 2) : 0) * 288;

            // --- 1. RENDER BASE FARMER PLAYER ---
            ctx.save();
            ctx.translate(this.x + 144, this.y);

            // Mirror the body horizontally when moving left or up
            if (!this.facingRight) {
                ctx.scale(-1, 1);
            }

            ctx.drawImage(
                playerImage,
                0, frameYOffset,  // Source Crop Box Start (Animates rows perfectly!)
                288, 288,         // Source Crop Cell Size
                -144, 0,          // Destination Offset (Centers back over this.x)
                288, 288          // Render Target Size
            );
            ctx.restore();


            // --- 2. WEAPON RENDER SYSTEM ---
            let currentItem = gameState.inventory[gameState.activeSlot];

            // 🎯 COOLDOWN HIDE CHECK: Sword vanishes completely from frame layers if weapon is shattered/recharging
            if ((currentItem === 'serpent_sword' || (gameState.selectedWeapon === 'serpent_sword' && gameState.activeSlot === 1)) && !gameState.swordCooldownActive) {
                ctx.save();

                // Position offset variables shift weapon placement horizontally to the side of the body
                let weaponXOffset = this.facingRight ? 190 : 90;
                ctx.translate(this.x + weaponXOffset, this.y + 160 + (checksMoving ? Math.sin(gameState.gameFrame * 0.2) * 5 : 0));

                // 🎯 DIRECTION FLIP FIX: Render base frames standard left-to-right, flip horizontally ONLY when moving left!
                if (!this.facingRight) {
                    ctx.scale(-1, 1);
                }

                // 🎯 SPRITE SHEET INTERACTION ANIMATOR ROUTINE
                if (gameState.isSwordSwinging) {
                    // Update animation trackers (stagger frame steps every 4 frames)
                    gameState.swordAnimTimer++;
                    if (gameState.swordAnimTimer >= 4) {
                        gameState.swordAnimFrame++;
                        gameState.swordAnimTimer = 0;

                        // Melee cutting logic intercept executes precisely on frame 2 of arc swing
                        if (gameState.swordAnimFrame === 2) {
                            window.dispatchEvent(new CustomEvent('sword-slice-impact'));
                        }

                        // Kill swing sequence loop once frame sheet reaches boundary ceiling
                        if (gameState.swordAnimFrame >= 4) {
                            gameState.isSwordSwinging = false;
                            gameState.swordAnimFrame = 0;
                        }
                    }

                    // Split the 2048px width columns out into neat 512x512 canvas cells
                    let frameWidth = 512;
                    let sourceX = gameState.swordAnimFrame * frameWidth;

                    ctx.drawImage(
                        swingingSword,
                        sourceX, 0,          // Source clip bounding starts (X, Y)
                        frameWidth, 512,     // Source bounding size card variables
                        -150, -150,          // Destination offset centers block directly onto arm coordinates
                        300, 300             // Render scaling size on field layer
                    );

                } else {
                    // Default idle weapon rendering posture if player isn't actively slashing
                    ctx.drawImage(serpentSword, -100, -100, 200, 200);
                }

                ctx.restore();
            }
            else if (gameState.hasGun) {
                ctx.save();
                ctx.translate(this.x + 140, this.y + 160 + (checksMoving ? Math.sin(gameState.gameFrame * 0.2) * 5 : 0));

                // Flip the gun container layer on right/down keys to handle the backward graphic alignment
                if (this.facingRight) ctx.scale(-1, 1);

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
                ctx.translate(this.x + 140, this.y + 160 + (checksMoving ? Math.sin(gameState.gameFrame * 0.2) * 5 : 0));

                // Mirror the tool layer cleanly alongside the firearm asset structure
                if (this.facingRight) ctx.scale(-1, 1);

                ctx.drawImage(scytheSprite, -100, -100, 200, 200);
                ctx.restore();
            }
        }
    }
};