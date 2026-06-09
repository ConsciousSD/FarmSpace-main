import { gameState } from './state.js';

// 🌌 THE SPACE CANTINA CATALOG
export const spaceCantinaCatalog = [
    // 🪙 COIN CATEGORIES (Earned from Rescuing Pigs/Chickens)
    { id: 'cyborg_farmer', name: 'Cyborg Farmer', cost: 25, currency: 'coins', type: 'skin', description: 'Harvests with mechanical precision.' },
    { id: 'heavy_boots', name: 'Heavy Boots', cost: 15, currency: 'coins', type: 'powerup', description: 'Permanent +1.5 speed boost on the field.' },
    
    // 💵 PREMIUM CATEGORIES (Real Money Unlocks)
    { id: 'neon_hunter', name: 'Neon Hunter', cost: 1.99, currency: 'usd', type: 'skin', description: 'Glow-in-the-dark armor plating.' },
    { id: 'plasma_shotgun', name: 'Plasma Shotgun', cost: 2.99, currency: 'usd', type: 'weapon', description: 'Wide horizontal energy blast pattern.' }
];

// Active tab tracker
let currentTab = 'skin';

export function renderShop() {
    const container = document.getElementById('shop-items-container');
    const coinDisplay = document.getElementById('shop-coin-count');
    if (!container || !coinDisplay) return;

    // 1. Update the display with how many coins they currently have from animal saves
    coinDisplay.innerText = gameState.coins || 0;
    container.innerHTML = ''; // Clear out the grid to render fresh cards

    // 2. Filter the catalog so we only display items matching the selected tab
    const activeItems = spaceCantinaCatalog.filter(item => item.type === currentTab);

    // 3. Loop through and build the visual layout cards
    activeItems.forEach(item => {
        const isUnlocked = gameState.unlockedCharacters?.includes(item.id) || false;
        const isEquipped = gameState.selectedCharacter === item.id;
        
        // Setup button tags based on whether it costs coins or real USD
        let buttonText = item.currency === 'coins' ? `Buy: ${item.cost} 💰` : `Purchase: $${item.cost} 💳`;
        let buttonColor = item.currency === 'coins' ? '#22c55e' : '#a855f7'; // Green for coins, Purple for premium
        
        if (isEquipped) {
            buttonText = "Active Choice";
            buttonColor = "#3b82f6"; // Blue for equipped
        } else if (isUnlocked) {
            buttonText = "Equip Asset";
            buttonColor = "#eab308"; // Yellow for owned but unequipped
        }

        const card = document.createElement('div');
        card.className = 'shop-card';
        card.style = `background: rgba(255,255,255,0.04); border: 2px solid ${buttonColor}; border-radius: 12px; padding: 20px; width: 220px; text-align: center; color: white; display: flex; flex-direction: column; justify-content: space-between;`;
        
        card.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #ffd700; font-size: 20px;">${item.name}</h3>
            <p style="font-size: 14px; color: #ccc; margin-bottom: 20px; min-height: 40px;">${item.description}</p>
            <button id="shop-btn-${item.id}" style="background: ${buttonColor}; color: white; border: none; padding: 12px; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 15px; width: 100%; transition: 0.2s;">${buttonText}</button>
        `;

        container.appendChild(card);

        // Bind clicking interaction to our process verification router
        document.getElementById(`shop-btn-${item.id}`).addEventListener('click', () => {
            handlePurchaseOrEquip(item);
        });
    });
}

// Switches categories (Skins, Weapons, Powerups) when you click the menu headers
export function switchShopTab(tabType) {
    currentTab = tabType;
    renderShop();
}

function handlePurchaseOrEquip(item) {
    if (!gameState.unlockedCharacters) gameState.unlockedCharacters = ['farmer'];
    const isUnlocked = gameState.unlockedCharacters.includes(item.id);

    // ACTION A: Item is already owned, simply toggle it on!
    if (isUnlocked) {
        if (item.type === 'skin') gameState.selectedCharacter = item.id;
        console.log(`Equipped item: ${item.name}`);
        renderShop();
        return;
    }

    // ACTION B: Processing a standard game currency purchase
    if (item.currency === 'coins') {
        if (gameState.coins >= item.cost) {
            gameState.coins -= item.cost;
            gameState.unlockedCharacters.push(item.id);
            if (item.type === 'skin') gameState.selectedCharacter = item.id;
            console.log(`Unlocked via Cantina coins: ${item.name}`);
        } else {
            alert("Insufficient animal rescue credits! Guide more pigs or chickens safely to the corral.");
        }
    } 
    
    // ACTION C: Processing a premium fiat transaction hook
    else if (item.currency === 'usd') {
        // Mock Gateway prompt for baseline desktop verification testing
        const confirmPay = confirm(`Secure Space Checkout:\nWould you like to process a safe transaction of $${item.cost} to unlock the ${item.name}?`);
        if (confirmPay) {
            gameState.unlockedCharacters.push(item.id);
            if (item.type === 'skin') gameState.selectedCharacter = item.id;
            console.log(`Premium payment verification logged for: ${item.name}`);
        }
    }

    renderShop();
}