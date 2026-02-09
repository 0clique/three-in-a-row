/**
 * Three-in-a-Row Game - Grid Manager
 * Handles grid initialization, gem spawning, and grid operations
 */

const CONFIG = {
    canvasWidth: 520,
    canvasHeight: 600,
    gridRows: 10,
    gridCols: 10,
    gemSize: 48,
    bucketPadding: 4,
    gemPadding: 2,
    backgroundColor: '#1a1a2e',
    bucketColor: '#2d3436',
    bucketBorderColor: '#4a4a6a',
    gridOffsetX: 20,
    gridOffsetY: 60
};

// Polyfill for roundRect if not available
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (typeof r === 'number') {
            r = [r, r, r, r];
        }
        const [tl, tr, br, bl] = r;
        this.beginPath();
        this.moveTo(x + tl, y);
        this.lineTo(x + w - tr, y);
        this.quadraticCurveTo(x + w, y, x + w, y + tr);
        this.lineTo(x + w, y + h - br);
        this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
        this.lineTo(x + bl, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - bl);
        this.lineTo(x, y + tl);
        this.quadraticCurveTo(x, y, x + tl, y);
        this.closePath();
        return this;
    };
}

// Gem colors (4 colors as per requirements)
const GEM_COLORS = [
    '#e74c3c', // Red
    '#3498db', // Blue
    '#2ecc71', // Green
    '#f1c40f'  // Yellow
];

// Power-up gem types (Feature #20)
const POWERUP_TYPES = {
    NONE: 'none',
    BOMB: 'bomb',       // Clears 3x3 area around it
    COLOR_CLEAR: 'color' // Clears all gems of one color
};

// Power-up configuration
const POWERUP_CONFIG = {
    bombRadius: 1,      // 1 = 3x3 area (clears center + 8 surrounding)
    scoreMultiplier: 2,  // Bonus score multiplier for power-up activation
    creationMatchSize: 4 // Minimum match size to create a power-up
};

// Game state constants
const GAME_STATE = {
    MENU: 'menu',
    PLAYING: 'playing',
    WON: 'won',
    LOST: 'lost',
    PAUSED: 'paused'  // Feature #17: Pause functionality
};

// Game state
const game = {
    canvas: null,
    ctx: null,
    grid: [],
    gridManager: null,
    selectedGem: null,
    isAnimating: false,
    isPaused: false,  // Feature #17: Pause state
    score: 0,
    level: 1,
    moves: 30,
    gameState: GAME_STATE.MENU,
    gridInitialized: false,
    targetScore: 1000,
    // Timer system - Feature #14
    timer: 60,           // Seconds remaining
    timerInterval: null,  // Timer interval ID
    // Animation system
    animations: [],
    animatingGems: new Set(),
    swapInProgress: null,
    lastMouseX: 0,
    lastMouseY: 0,
    // Feature #19: Combo system
    comboCount: 0,           // Current combo multiplier (1 = no combo)
    comboTimer: null,        // Timer to reset combo
    maxCombo: 0,             // Highest combo achieved this level
    comboMessages: [],        // Active combo popup messages
    // Currency - Feature #21
    gems: 0,                  // Premium currency
    coins: 0                   // Regular currency
};

// Feature #20: Power-up system
const powerUpSystem = {
    activeEffects: [],  // Active power-up effects for animation
    pendingPowerUps: [] // Power-ups to be created after match
};

// Feature #21: Currency system
const CURRENCY = {
    GEMS: 'gems',  // Premium currency
    COINS: 'coins' // Regular currency
};

// Feature #22: Achievements system
const ACHIEVEMENTS = {
    // Score achievements
    SCORE_1000: { id: 'score_1000', name: 'Getting Started', desc: 'Score 1,000 points', icon: '⭐', condition: (stats) => stats.totalScore >= 1000, reward: 50 },
    SCORE_5000: { id: 'score_5000', name: 'High Scorer', desc: 'Score 5,000 points', icon: '🌟', condition: (stats) => stats.totalScore >= 5000, reward: 100 },
    SCORE_10000: { id: 'score_10000', name: 'Master Player', desc: 'Score 10,000 points', icon: '💎', condition: (stats) => stats.totalScore >= 10000, reward: 200 },
    
    // Level achievements
    LEVEL_5: { id: 'level_5', name: 'Rising Star', desc: 'Reach level 5', icon: '📈', condition: (stats) => stats.maxLevel >= 5, reward: 50 },
    LEVEL_10: { id: 'level_10', name: 'Expert', desc: 'Reach level 10', icon: '🏆', condition: (stats) => stats.maxLevel >= 10, reward: 100 },
    LEVEL_25: { id: 'level_25', name: 'Legend', desc: 'Reach level 25', icon: '👑', condition: (stats) => stats.maxLevel >= 25, reward: 250 },
    
    // Combo achievements
    COMBO_5: { id: 'combo_5', name: 'Combo Breaker', desc: 'Get a 5x combo', icon: '🔥', condition: (stats) => stats.maxCombo >= 5, reward: 75 },
    COMBO_10: { id: 'combo_10', name: 'Chain Master', desc: 'Get a 10x combo', icon: '⚡', condition: (stats) => stats.maxCombo >= 10, reward: 150 },
    COMBO_20: { id: 'combo_20', name: 'Unstoppable', desc: 'Get a 20x combo', icon: '💥', condition: (stats) => stats.maxCombo >= 20, reward: 300 },
    
    // Gameplay achievements
    GAMES_PLAYED_10: { id: 'games_10', name: 'Regular Player', desc: 'Play 10 games', icon: '🎮', condition: (stats) => stats.gamesPlayed >= 10, reward: 50 },
    GAMES_PLAYED_50: { id: 'games_50', name: 'Dedicated', desc: 'Play 50 games', icon: '🎯', condition: (stats) => stats.gamesPlayed >= 50, reward: 150 },
    GAMES_PLAYED_100: { id: 'games_100', name: 'True Fan', desc: 'Play 100 games', icon: '🏅', condition: (stats) => stats.gamesPlayed >= 100, reward: 300 },
    
    // Special achievements
    PERFECT_GAME: { id: 'perfect', name: 'Perfect Game', desc: 'Complete a level with max score', icon: '💯', condition: (stats) => stats.perfectLevels >= 1, reward: 100 },
    NO_MOVES_LEFT: { id: 'no_moves', name: 'Last Ditch', desc: 'Win with 1 move left', icon: '😮', condition: (stats) => stats.winsWithOneMove >= 1, reward: 200 },
    
    // Power-up achievements
    USE_BOMB: { id: 'use_bomb', name: 'Boom!', desc: 'Use a bomb power-up', icon: '💣', condition: (stats) => stats.powerUpsUsed.bomb >= 1, reward: 50 },
    USE_COLOR_CLEAR: { id: 'use_color', name: 'Rainbow', desc: 'Use a color clear power-up', icon: '🌈', condition: (stats) => stats.powerUpsUsed.colorClear >= 1, reward: 75 },
    POWERUP_MASTER: { id: 'powerup_master', name: 'Power User', desc: 'Use 10 power-ups', icon: '🚀', condition: (stats) => (stats.powerUpsUsed.bomb + stats.powerUpsUsed.colorClear) >= 10, reward: 200 }
};

const AchievementManager = {
    stats: {
        totalScore: 0,
        maxLevel: 1,
        maxCombo: 0,
        gamesPlayed: 0,
        perfectLevels: 0,
        winsWithOneMove: 0,
        powerUpsUsed: { bomb: 0, colorClear: 0 }
    },
    unlocked: new Set(),
    
    init() {
        // Load from localStorage
        const saved = localStorage.getItem('threeInRow_achievements');
        if (saved) {
            const data = JSON.parse(saved);
            this.stats = data.stats || this.stats;
            this.unlocked = new Set(data.unlocked || []);
        }
    },
    
    save() {
        localStorage.setItem('threeInRow_achievements', JSON.stringify({
            stats: this.stats,
            unlocked: Array.from(this.unlocked)
        }));
    },
    
    updateStat(stat, value) {
        this.stats[stat] = value;
        this.checkAchievements();
        this.save();
    },
    
    incrementStat(stat) {
        if (typeof this.stats[stat] === 'number') {
            this.stats[stat]++;
            this.checkAchievements();
            this.save();
        }
    },
    
    checkAchievements() {
        for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
            if (!this.unlocked.has(achievement.id) && achievement.condition(this.stats)) {
                this.unlock(achievement);
            }
        }
    },
    
    unlock(achievement) {
        this.unlocked.add(achievement.id);
        // Award reward
        game.coins = (game.coins || 0) + achievement.reward;
        // Show notification
        showNotification(`🏆 Achievement: ${achievement.name}\n+${achievement.reward} coins!`, 4000);
        SoundManager.achievement();
    },
    
    getProgress() {
        const total = Object.keys(ACHIEVEMENTS).length;
        return {
            unlocked: this.unlocked.size,
            total: total,
            percentage: Math.round((this.unlocked.size / total) * 100)
        };
    },
    
    reset() {
        this.stats = {
            totalScore: 0,
            maxLevel: 1,
            maxCombo: 0,
            gamesPlayed: 0,
            perfectLevels: 0,
            winsWithOneMove: 0,
            powerUpsUsed: { bomb: 0, colorClear: 0 }
        };
        this.unlocked = new Set();
        this.save();
    }
};

// Feature #23: Shop system
const SHOP_ITEMS = {
    // One-time purchases
    EXTRA_MOVES_5: { id: 'extra_moves_5', name: '+5 Moves', desc: 'Start with 5 extra moves', icon: '👟', price: 50, type: 'start_bonus', value: 5 },
    STARTING_TIME_15: { id: 'start_time_15', name: '+15s Time', desc: 'Start with 15 extra seconds', icon: '⏱️', price: 75, type: 'start_bonus', value: 15 },
    SCORE_BOOST_2X: { id: 'score_2x', name: '2x Score', desc: '2x score multiplier for one game', icon: '✨', price: 150, type: 'one_time', value: 2 },
    
    // Consumables (buy with gems)
    GEMS_100: { id: 'gems_100', name: '100 Gems', desc: 'Get 100 premium gems', icon: '💎', price: 0, priceType: 'gems', type: 'currency', value: 100 },
    GEMS_500: { id: 'gems_500', name: '500 Gems', desc: 'Get 500 premium gems', icon: '💎', value: 500, price: 0, priceType: 'gems', type: 'currency' },
    
    // Permanent upgrades
    PERMANENT_MOVES_2: { id: 'perm_moves_2', name: 'Pro Moves', desc: '+2 moves permanently', icon: '💪', price: 500, type: 'permanent', stat: 'moves', value: 2 },
    PERMANENT_TIME_10: { id: 'perm_time_10', name: 'Time Master', desc: '+10s timer permanently', icon: '🕐', price: 750, type: 'permanent', stat: 'timer', value: 10 },
    PERMANENT_COMBO: { id: 'perm_combo', name: 'Combo King', desc: '+1 combo multiplier', icon: '👑', price: 1000, type: 'permanent', stat: 'combo', value: 1 }
};

const ShopManager = {
    purchased: new Set(),
    activeBoosts: {
        extraMoves: 0,
        extraTime: 0,
        scoreMultiplier: 1
    },
    permanentStats: {
        moves: 0,
        timer: 0,
        combo: 0
    },
    
    init() {
        const saved = localStorage.getItem('threeInRow_shop');
        if (saved) {
            const data = JSON.parse(saved);
            this.purchased = new Set(data.purchased || []);
            this.activeBoosts = data.activeBoosts || this.activeBoosts;
            this.permanentStats = data.permanentStats || this.permanentStats;
        }
    },
    
    save() {
        localStorage.setItem('threeInRow_shop', JSON.stringify({
            purchased: Array.from(this.purchased),
            activeBoosts: this.activeBoosts,
            permanentStats: this.permanentStats
        }));
    },
    
        canAfford(item) {
        if (item.price === 0) return true; // Free items
        const currency = (item.priceType === 'gems') ? (game.gems || 0) : (game.coins || 0);
        return currency >= item.price;
    },
    
    buy(itemId) {
        const item = SHOP_ITEMS[itemId];
        if (!item) return false;
        if (!this.canAfford(item)) {
            showNotification('Not enough currency!', 2000);
            return false;
        }
        
        // Deduct currency
        if (item.price > 0) {
            if (item.priceType === 'gems') {
                game.gems = (game.gems || 0) - item.price;
            } else {
                game.coins = (game.coins || 0) - item.price;
            }
        }
        
        // Apply purchase
        if (item.type === 'start_bonus') {
            this.activeBoosts.extraMoves += item.value;
        } else if (item.type === 'one_time') {
            this.activeBoosts.scoreMultiplier = item.value;
        } else if (item.type === 'permanent') {
            this.permanentStats[item.stat] += item.value;
            this.purchased.add(itemId);
        } else if (item.type === 'currency') {
            game.gems = (game.gems || 0) + item.value;
        }
        
        this.save();
        showNotification(`Purchased: ${item.name}!`, 2000);
        SoundManager.purchase();
        return true;
    },
    
    resetBoosts() {
        this.activeBoosts = { extraMoves: 0, extraTime: 0, scoreMultiplier: 1 };
        this.save();
    },
    
    resetAll() {
        this.purchased = new Set();
        this.activeBoosts = { extraMoves: 0, extraTime: 0, scoreMultiplier: 1 };
        this.permanentStats = { moves: 0, timer: 0, combo: 0 };
        this.save();
    },
    
    getBonusMoves() {
        return 30 + (this.activeBoosts.extraMoves || 0) + (this.permanentStats.moves || 0);
    },
    
    getBonusTime() {
        return 60 + (this.activeBoosts.extraTime || 0) + (this.permanentStats.timer || 0);
    },
    
    getComboBonus() {
        return this.permanentStats.combo || 0;
    }
};

// Animation configuration
const ANIMATION = {
    SWAP_DURATION: 200,          // ms for swap animation
    SWAP_EASE: 'ease-in-out',
    CLEAR_DURATION: 250,         // ms for match clear animation
    CLEAR_EASE: 'ease-in',
    FALL_DURATION: 150,          // ms per cell for falling gems
    SELECTION_PULSE_DURATION: 600 // ms for selection pulse animation
};

// Notification system
let notificationTimeout = null;
function showNotification(message, duration = 3000) {
    // Remove any existing notification
    const existing = document.getElementById('game-notification');
    if (existing) existing.remove();
    if (notificationTimeout) clearTimeout(notificationTimeout);
    
    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'game-notification';
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.85);
        color: #fff;
        padding: 20px 30px;
        border-radius: 12px;
        border: 2px solid #f1c40f;
        font-size: 16px;
        text-align: center;
        z-index: 200;
        max-width: 300px;
        white-space: pre-line;
        animation: notificationPopIn 0.3s ease-out;
    `;
    
    // Add animation keyframes
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes notificationPopIn {
                from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    notificationTimeout = setTimeout(() => {
        notification.remove();
    }, duration);
}

// Sound Manager - Feature #12: Sound Effects
const SoundManager = {
    audioContext: null,
    enabled: true,
    masterVolume: 0.3,
    musicVolume: 0.5,
    sfxVolume: 0.5,
    
    init() {
        // Initialize Web Audio API on first user interaction
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('Audio context initialized');
            } catch (e) {
                console.warn('Web Audio API not supported');
                this.enabled = false;
            }
        }
        // Resume audio context if suspended (browser policy)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    },
    
    play(frequency, duration, type = 'sine', volume = null) {
        if (!this.enabled || !this.audioContext) return;
        
        try {
            const osc = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            osc.type = type;
            osc.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            
            // Apply master and SFX volume
            const vol = volume !== null ? volume : this.masterVolume;
            gainNode.gain.setValueAtTime(vol * this.sfxVolume, this.audioContext.currentTime);
            
            // Sound envelope - fade out
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            osc.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            osc.start();
            osc.stop(this.audioContext.currentTime + duration);
        } catch (e) {
            // Silently fail if audio fails
        }
    },
    
    // Sound effects
    select() {
        // High-pitched blip for gem selection
        this.play(880, 0.1, 'sine', 0.2);
    },
    
    swap() {
        // Swishing sound for swap
        this.play(440, 0.15, 'triangle', 0.15);
    },
    
    swapFail() {
        // Lower "thud" for failed swap
        this.play(220, 0.2, 'square', 0.1);
    },
    
    match() {
        // Pleasant chime for match (ascending arpeggio)
        this.play(523.25, 0.1, 'sine', 0.25); // C5
        setTimeout(() => this.play(659.25, 0.1, 'sine', 0.25), 50);  // E5
        setTimeout(() => this.play(783.99, 0.15, 'sine', 0.25), 100); // G5
    },
    
    cascade() {
        // More dramatic sound for cascades/combos
        this.play(392, 0.08, 'sine', 0.2);   // G4
        setTimeout(() => this.play(523.25, 0.08, 'sine', 0.2), 40);  // C5
        setTimeout(() => this.play(659.25, 0.08, 'sine', 0.2), 80);  // E5
        setTimeout(() => this.play(783.99, 0.08, 'sine', 0.2), 120); // G5
        setTimeout(() => this.play(1046.5, 0.2, 'sine', 0.25), 160); // C6
    },
    
    levelComplete() {
        // Victory fanfare
        const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
        notes.forEach((freq, i) => {
            setTimeout(() => this.play(freq, 0.3, 'sine', 0.3), i * 100);
        });
    },
    
    gameOver() {
        // Sad descending sound
        this.play(392, 0.3, 'triangle', 0.2);
        setTimeout(() => this.play(349.23, 0.3, 'triangle', 0.2), 150);
        setTimeout(() => this.play(293.66, 0.4, 'triangle', 0.2), 300);
    },
    
    achievement() {
        // Triumphant achievement sound
        this.play(523.25, 0.15, 'sine', 0.3);
        setTimeout(() => this.play(659.25, 0.15, 'sine', 0.3), 100);
        setTimeout(() => this.play(783.99, 0.2, 'sine', 0.35), 200);
        setTimeout(() => this.play(1046.5, 0.4, 'sine', 0.4), 350);
    },
    
    purchase() {
        // Pleasant "ding" for purchase
        this.play(880, 0.1, 'sine', 0.3);
        setTimeout(() => this.play(1100, 0.15, 'sine', 0.25), 80);
    },
    
    toggle() {
        this.enabled = !this.enabled;
        console.log('Sound effects:', this.enabled ? 'enabled' : 'disabled');
        return this.enabled;
    }
};

// Feature #18: Settings Modal
const SettingsManager = {
    isOpen: false,
    
    toggle() {
        this.isOpen = !this.isOpen;
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.toggle('hidden', !this.isOpen);
        }
        console.log('Settings modal:', this.isOpen ? 'opened' : 'closed');
    },
    
    init() {
        const modal = document.getElementById('settings-modal');
        if (!modal) return;
        
        // Close button
        const closeBtn = document.getElementById('close-settings');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggle());
        }
        
        // Music volume slider
        const musicSlider = document.getElementById('music-volume');
        const musicValue = document.getElementById('music-value');
        if (musicSlider && musicValue) {
            musicSlider.addEventListener('input', (e) => {
                const val = e.target.value;
                SoundManager.musicVolume = val / 100;
                musicValue.textContent = val + '%';
            });
        }
        
        // SFX volume slider
        const sfxSlider = document.getElementById('sfx-volume');
        const sfxValue = document.getElementById('sfx-value');
        if (sfxSlider && sfxValue) {
            sfxSlider.addEventListener('input', (e) => {
                const val = e.target.value;
                SoundManager.sfxVolume = val / 100;
                sfxValue.textContent = val + '%';
            });
        }
        
        // Reset progress button
        const resetBtn = document.getElementById('reset-progress');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Reset all progress? This will clear your high scores, achievements, and shop data.')) {
                    localStorage.removeItem('threeInARowHighScore');
                    localStorage.removeItem('threeInARowTotalScore');
                    localStorage.removeItem('threeInRow_achievements');
                    localStorage.removeItem('threeInRow_shop');
                    console.log('Progress reset');
                    alert('Progress has been reset!');
                }
            });
        }
        
        console.log('Settings Manager initialized');
    }
};

// Achievement Manager - Feature #22
AchievementManager.toggle = function() {
    this.isOpen = !this.isOpen;
    const modal = document.getElementById('achievements-modal');
    if (modal) {
        modal.classList.toggle('hidden', !this.isOpen);
        if (this.isOpen) {
            this.render();
        }
    }
    console.log('Achievements modal:', this.isOpen ? 'opened' : 'closed');
};

AchievementManager.render = function() {
    const progressEl = document.getElementById('achievements-progress');
    const listEl = document.getElementById('achievements-list');
    if (!progressEl || !listEl) return;
    
    const progress = this.getProgress();
    progressEl.textContent = `Progress: ${progress.unlocked}/${progress.total} (${progress.percentage}%)`;
    
    listEl.innerHTML = '';
    for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
        const unlocked = this.unlocked.has(achievement.id);
        const item = document.createElement('div');
        item.className = `achievement-item ${unlocked ? 'unlocked' : 'locked'}`;
        item.innerHTML = `
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-info">
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-desc">${achievement.desc}</div>
                <div class="achievement-reward">+${achievement.reward} coins</div>
            </div>
        `;
        listEl.appendChild(item);
    }
};

AchievementManager.init = function() {
    // Load from localStorage
    const saved = localStorage.getItem('threeInRow_achievements');
    if (saved) {
        const data = JSON.parse(saved);
        this.stats = data.stats || this.stats;
        this.unlocked = new Set(data.unlocked || []);
    }
    const modal = document.getElementById('achievements-modal');
    if (modal) {
        const closeBtn = document.getElementById('close-achievements');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggle());
        }
    }
    console.log('Achievement Manager initialized');
};

// Shop Manager - Feature #23
ShopManager.toggle = function() {
    this.isOpen = !this.isOpen;
    const modal = document.getElementById('shop-modal');
    if (modal) {
        modal.classList.toggle('hidden', !this.isOpen);
        if (this.isOpen) {
            this.render();
        }
    }
    console.log('Shop modal:', this.isOpen ? 'opened' : 'closed');
};

ShopManager.render = function() {
    const gemsEl = document.getElementById('shop-gems');
    const coinsEl = document.getElementById('shop-coins');
    const listEl = document.getElementById('shop-list');
    if (!gemsEl || !coinsEl || !listEl) return;
    
    gemsEl.textContent = game.gems || 0;
    coinsEl.textContent = game.coins || 0;
    
    listEl.innerHTML = '';
    for (const [key, item] of Object.entries(SHOP_ITEMS)) {
        const canAfford = this.canAfford(item);
        const btnClass = canAfford ? 'shop-item-buy' : 'shop-item-buy disabled';
        const btnText = item.price > 0 
            ? (item.priceType === 'gems' ? `💎 ${item.price}` : `🪙 ${item.price}`)
            : 'FREE';
        
        const div = document.createElement('div');
        div.className = 'shop-item';
        div.innerHTML = `
            <div class="shop-item-icon">${item.icon}</div>
            <div class="shop-item-info">
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-desc">${item.desc}</div>
            </div>
            <button class="${btnClass}" data-id="${item.id}">${btnText}</button>
        `;
        
        if (canAfford) {
            div.querySelector('button').addEventListener('click', () => {
                this.buy(item.id);
                this.render();
            });
        }
        
        listEl.appendChild(div);
    }
};

ShopManager.init = function() {
    const saved = localStorage.getItem('threeInRow_shop');
    if (saved) {
        const data = JSON.parse(saved);
        this.purchased = new Set(data.purchased || []);
        this.activeBoosts = data.activeBoosts || this.activeBoosts;
        this.permanentStats = data.permanentStats || this.permanentStats;
    }
    const modal = document.getElementById('shop-modal');
    if (modal) {
        const closeBtn = document.getElementById('close-shop');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggle());
        }
    }
    console.log('Shop Manager initialized');
};

// Selection animation state
const selectionAnimation = {
    active: false,
    startTime: 0,
    pulsePhase: 0
};

/**
 * Feature #19: Combo System
 * Tracks cascading matches and applies score multipliers
 */

// Combo system configuration
const COMBO_CONFIG = {
    comboTimeout: 2000,      // ms before combo resets
    baseMultiplier: 1,       // Base score multiplier
    maxMultiplier: 10,       // Maximum combo multiplier
    showPopup: true          // Show combo popup messages
};

/**
 * Feature #20: Power-up System
 * Bomb gem - clears 3x3 area
 * Color clear gem - clears all gems of one color
 */

// Determine what power-up to create based on match
function getPowerUpForMatch(matchLength, direction) {
    if (matchLength < POWERUP_CONFIG.creationMatchSize) {
        return POWERUP_TYPES.NONE;
    }

    // 4-match = bomb
    if (matchLength === 4) {
        return POWERUP_TYPES.BOMB;
    }

    // 5+ match = color clear
    if (matchLength >= 5) {
        return POWERUP_TYPES.COLOR_CLEAR;
    }

    return POWERUP_TYPES.NONE;
}

// Create a power-up gem
function createPowerUpGem(row, col, type, powerUpType) {
    const gem = game.gridManager.createGem(row, col, type, powerUpType);
    gem.scale = 0.1; // Start small for spawn animation
    return gem;
}

// Activate a power-up gem
function activatePowerUp(gem) {
    if (gem.powerUpType === POWERUP_TYPES.NONE) {
        return [];
    }

    const gemsToClear = [];
    const targetColor = gem.type;

    if (gem.powerUpType === POWERUP_TYPES.BOMB) {
        // Bomb clears 3x3 area
        for (let row = gem.row - 1; row <= gem.row + 1; row++) {
            for (let col = gem.col - 1; col <= gem.col + 1; col++) {
                const targetGem = game.gridManager.getGem(row, col);
                if (targetGem && !gemsToClear.includes(targetGem)) {
                    gemsToClear.push(targetGem);
                }
            }
        }
        console.log(`💣 BOMB ACTIVATED! Clearing ${gemsToClear.length} gems`);
        SoundManager.play(200, 0.5, 'sawtooth', 0.3);
    } else if (gem.powerUpType === POWERUP_TYPES.COLOR_CLEAR) {
        // Color clear clears all gems of target color
        for (let row = 0; row < game.gridManager.rows; row++) {
            for (let col = 0; col < game.gridManager.cols; col++) {
                const targetGem = game.gridManager.getGem(row, col);
                if (targetGem && targetGem.type === targetColor && !gemsToClear.includes(targetGem)) {
                    gemsToClear.push(targetGem);
                }
            }
        }
        console.log(`🎨 COLOR CLEAR ACTIVATED! Clearing ${gemsToClear.length} ${GEM_COLORS[targetColor]} gems`);
        // Play special sound
        SoundManager.play(880, 0.1, 'sine', 0.2);
        setTimeout(() => SoundManager.play(1100, 0.1, 'sine', 0.2), 100);
        setTimeout(() => SoundManager.play(1320, 0.3, 'sine', 0.3), 200);
    }

    return gemsToClear;
}

// Add power-up creation to match processing
function processPowerUpCreation(matches) {
    const powerUpGems = [];

    // Group matches by type and direction
    const matchGroups = {};

    for (const match of matches) {
        const key = `${match.direction}-${match.matchType}-${match.gem.type}`;
        if (!matchGroups[key]) {
            matchGroups[key] = {
                direction: match.direction,
                matchType: match.matchType,
                color: match.gem.type,
                gems: []
            };
        }
        matchGroups[key].gems.push(match.gem);
    }

    // Create power-ups for qualifying matches
    for (const key in matchGroups) {
        const group = matchGroups[key];
        const powerUpType = getPowerUpForMatch(group.matchType, group.direction);

        if (powerUpType !== POWERUP_TYPES.NONE) {
            // Create power-up at the center of the match
            const centerIndex = Math.floor(group.gems.length / 2);
            const centerGem = group.gems[centerIndex];

            // Mark the position for power-up creation
            powerUpGems.push({
                row: centerGem.row,
                col: centerGem.col,
                type: group.color,
                powerUpType: powerUpType
            });

            console.log(`✨ Creating ${powerUpType} power-up at (${centerGem.row}, ${centerGem.col}) from ${group.matchType}-match`);
        }
    }

    return powerUpGems;
}

// Reset combo count (called when player makes a new move)
function resetCombo() {
    if (game.comboCount > 0) {
        console.log(`Combo ended at x${game.comboCount}`);
    }
    game.comboCount = 0;
    if (game.comboTimer) {
        clearTimeout(game.comboTimer);
        game.comboTimer = null;
    }
}

// Increment combo (called on cascade match)
function incrementCombo() {
    if (game.comboCount === 0) {
        // First cascade - start a new combo
        game.comboCount = 1;
    } else {
        game.comboCount++;
    }
    
    // Cap at max multiplier
    if (game.comboCount > COMBO_CONFIG.maxMultiplier) {
        game.comboCount = COMBO_CONFIG.maxMultiplier;
    }
    
    // Track max combo achieved
    if (game.comboCount > game.maxCombo) {
        game.maxCombo = game.comboCount;
    }
    
    console.log(`🔥 COMBO x${game.comboCount}!`);
    
    // Set/reset combo timeout
    if (game.comboTimer) {
        clearTimeout(game.comboTimer);
    }
    game.comboTimer = setTimeout(() => {
        console.log(`Combo expired at x${game.comboCount}`);
        game.comboCount = 0;
    }, COMBO_CONFIG.comboTimeout);
    
    // Add popup message
    if (game.comboCount > 1 && COMBO_CONFIG.showPopup) {
        addComboMessage(game.comboCount);
    }
    
    return game.comboCount;
}

// Get current combo multiplier
function getComboMultiplier() {
    return 1 + (game.comboCount - 1) * 0.5; // x1, x1.5, x2, x2.5, ...
}

// Calculate score with combo multiplier
function calculateScore(gemsCleared, basePoints = 10) {
    const baseScore = gemsCleared * basePoints;
    const multiplier = getComboMultiplier();
    return Math.floor(baseScore * multiplier);
}

// Add combo popup message
function addComboMessage(combo) {
    const messages = ['COMBO!', 'NICE!', 'AWESOME!', 'AMAZING!', 'INCREDIBLE!', 'UNBELIEVABLE!'];
    const msgIndex = Math.min(combo - 2, messages.length - 1);
    
    game.comboMessages.push({
        text: combo > 1 ? `${messages[msgIndex]} x${combo}` : messages[0],
        x: CONFIG.canvasWidth / 2,
        y: CONFIG.gridOffsetY + CONFIG.gridRows * CONFIG.gemSize / 2,
        alpha: 1,
        scale: 0.5,
        velocityY: -2,
        startTime: performance.now()
    });
}

// Update and draw combo messages
function updateComboMessages(ctx) {
    const currentTime = performance.now();
    const messagesToRemove = [];
    
    for (let i = 0; i < game.comboMessages.length; i++) {
        const msg = game.comboMessages[i];
        const elapsed = currentTime - msg.startTime;
        
        // Fade out and float up
        msg.alpha = Math.max(0, 1 - elapsed / 1500);
        msg.scale = Math.min(1.5, msg.scale + 0.02);
        msg.y += msg.velocityY;
        
        // Draw message
        if (msg.alpha > 0) {
            ctx.save();
            ctx.globalAlpha = msg.alpha;
            ctx.translate(msg.x, msg.y);
            ctx.scale(msg.scale, msg.scale);
            
            // Glow effect
            ctx.shadowColor = '#f1c40f';
            ctx.shadowBlur = 20;
            
            // Text
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#f1c40f';
            ctx.fillText(msg.text, 0, 0);
            
            ctx.restore();
        }
        
        // Mark for removal if faded out
        if (msg.alpha <= 0) {
            messagesToRemove.push(i);
        }
    }
    
    // Remove expired messages
    for (let i = messagesToRemove.length - 1; i >= 0; i--) {
        game.comboMessages.splice(messagesToRemove[i], 1);
    }
}

/**
 * Timer System - Feature #14: HUD with level, score, timer
 */

// Start the countdown timer
function startTimer() {
    stopTimer(); // Clear any existing timer
    game.timer = ShopManager.getBonusTime();
    
    game.timerInterval = setInterval(() => {
        if (game.gameState === GAME_STATE.PLAYING && !game.isAnimating) {
            game.timer--;
            
            // Play warning sound when time is low
            if (game.timer === 10) {
                SoundManager.play(440, 0.3, 'square', 0.1);
            }
            
            // Check if time has run out
            if (game.timer <= 0) {
                stopTimer();
                game.timer = 0;
                game.gameState = GAME_STATE.LOST;
                SoundManager.gameOver();
                console.log(`💀 TIME'S UP! Game Over! Score: ${game.score}/${game.targetScore}`);
            }
        }
    }, 1000);
}

// Stop the countdown timer
function stopTimer() {
    if (game.timerInterval) {
        clearInterval(game.timerInterval);
        game.timerInterval = null;
    }
}

// Reset the timer for a new level
function resetTimer() {
    stopTimer();
    game.timer = ShopManager.getBonusTime();
}

// Feature #17: Pause functionality
function togglePause() {
    if (game.gameState !== GAME_STATE.PLAYING) return;
    
    game.isPaused = !game.isPaused;
    
    if (game.isPaused) {
        // Pause the timer
        if (game.timerInterval) {
            clearInterval(game.timerInterval);
            game.timerInterval = null;
        }
        game.gameState = GAME_STATE.PAUSED;
        console.log('Game paused');
    } else {
        // Resume the timer
        startTimer();
        game.gameState = GAME_STATE.PLAYING;
        console.log('Game resumed');
    }
}

// Format time as MM:SS
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Animation System - Feature #8: Smooth Swap Animations
 */

// Easing function for smooth animations
function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Linear interpolation
function lerp(start, end, t) {
    return start + (end - start) * t;
}

// Create a swap animation between two gems
function createSwapAnimation(gem1, gem2) {
    const startX1 = gem1.x;
    const startY1 = gem1.y;
    const startX2 = gem2.x;
    const startY2 = gem2.y;

    const endX1 = gem2.x;
    const endY1 = gem2.y;
    const endX2 = gem1.x;
    const endY2 = gem1.y;

    const animation = {
        type: 'swap',
        gem1: gem1,
        gem2: gem2,
        startTime: performance.now(),
        duration: ANIMATION.SWAP_DURATION,
        startX1, startY1, startX2, startY2,
        endX1, endY1, endX2, endY2,
        complete: false,
        onComplete: null
    };

    return animation;
}

// Update animation positions
function updateAnimation(animation, currentTime) {

// Process all active animations
function processAnimations() {
    if (game.animations.length === 0) {
        return;
    }

    const currentTime = performance.now();
    const remainingAnimations = [];

    for (const animation of game.animations) {
        const isComplete = updateAnimation(animation, currentTime);

        if (!isComplete) {
            remainingAnimations.push(animation);
        } else {
            // Snap to final positions
            if (animation.type === 'swap') {
                animation.gem1.x = animation.endX1;
                animation.gem1.y = animation.endY1;
                animation.gem2.x = animation.endX2;
                animation.gem2.y = animation.endY2;
            }

            // Execute callback if present
            if (animation.onComplete) {
                animation.onComplete();
            }
        }
    }

    game.animations = remainingAnimations;

    // Check if all animations are complete
    if (game.animations.length === 0 && game.swapInProgress) {
        const swapCompleteCallback = game.swapInProgress;
        game.swapInProgress = null;
        game.isAnimating = false;

        // Execute the swap completion logic
        if (swapCompleteCallback) {
            swapCompleteCallback();
        }
    }
}

// Start a swap animation and return a promise
function animateSwap(gem1, gem2) {
    return new Promise((resolve) => {
        game.isAnimating = true;
        game.animatingGems.add(gem1);
        game.animatingGems.add(gem2);

        const animation = createSwapAnimation(gem1, gem2);

        animation.onComplete = () => {
            game.animatingGems.delete(gem1);
            game.animatingGems.delete(gem2);
            resolve();
        };

        game.animations.push(animation);
        game.swapInProgress = resolve;
    });
}

// Check if any animation is in progress
function isCurrentlyAnimating() {
    return game.animations.length > 0;
}

/**
 * Animation System - Feature #9: Match Clear Animations
 */

// Create a clear animation for a gem (shrink and fade out)
function createClearAnimation(gem) {
    const animation = {
        type: 'clear',
        gem: gem,
        startTime: performance.now(),
        duration: ANIMATION.CLEAR_DURATION,
        startAlpha: gem.alpha,
        startScale: gem.scale,
        endAlpha: 0,
        endScale: 0,
        complete: false,
        onComplete: null
    };

    return animation;
}

// Create a fall animation for a gem
function createFallAnimation(gem, targetY, startY) {
    const distance = targetY - startY;
    const duration = Math.abs(distance / CONFIG.gemSize) * ANIMATION.FALL_DURATION;

    const animation = {
        type: 'fall',
        gem: gem,
        startTime: performance.now(),
        duration: duration,
        startY: startY,
        targetY: targetY,
        complete: false,
        onComplete: null
    };

    return animation;
}

// Update clear animation
function updateClearAnimation(animation, currentTime) {
    const elapsed = currentTime - animation.startTime;
    const progress = Math.min(elapsed / animation.duration, 1);
    const easedProgress = easeInOutQuad(progress);

    // Shrink and fade out
    animation.gem.alpha = lerp(animation.startAlpha, animation.endAlpha, easedProgress);
    animation.gem.scale = lerp(animation.startScale, animation.endScale, easedProgress);

    return progress >= 1;
}

// Update fall animation
function updateFallAnimation(animation, currentTime) {
    const elapsed = currentTime - animation.startTime;
    const progress = Math.min(elapsed / animation.duration, 1);
    const easedProgress = easeInOutQuad(progress);

    // Fall to target position
    animation.gem.y = lerp(animation.startY, animation.targetY, easedProgress);

    return progress >= 1;
}

// Enhanced animation update function to handle clear and fall animations
function updateAnimation(animation, currentTime) {
    if (animation.type === 'swap') {
        const elapsed = currentTime - animation.startTime;
        const progress = Math.min(elapsed / animation.duration, 1);
        const easedProgress = easeInOutQuad(progress);

        // Animate gem1 from start to end position
        animation.gem1.x = lerp(animation.startX1, animation.endX1, easedProgress);
        animation.gem1.y = lerp(animation.startY1, animation.endY1, easedProgress);

        // Animate gem2 from start to end position
        animation.gem2.x = lerp(animation.startX2, animation.endX2, easedProgress);
        animation.gem2.y = lerp(animation.startY2, animation.endY2, easedProgress);

        return progress >= 1;  // ✅ FIX: Return completion status
    } else if (animation.type === 'clear') {
        return updateClearAnimation(animation, currentTime);
    } else if (animation.type === 'fall') {
        return updateFallAnimation(animation, currentTime);
    }

    return false;
}

// Animate matched gems clearing - returns a promise
function animateClearMatch(matchedGems) {
    return new Promise((resolve) => {
        if (matchedGems.length === 0) {
            resolve();
            return;
        }

        game.isAnimating = true;

        matchedGems.forEach(gem => {
            game.animatingGems.add(gem);
            const animation = createClearAnimation(gem);
            animation.onComplete = () => {
                game.animatingGems.delete(gem);
            };
            game.animations.push(animation);
        });

        // Wait for all clear animations to complete
        const checkComplete = setInterval(() => {
            if (game.animations.length === 0 ||
                !game.animations.some(a => matchedGems.includes(a.gem))) {
                clearInterval(checkComplete);
                game.isAnimating = false;
                resolve();
            }
        }, 16);
    });
}

// Animate gems falling down - returns a promise
function animateFall(gemsToFall) {
    return new Promise((resolve) => {
        if (gemsToFall.length === 0) {
            resolve();
            return;
        }

        game.isAnimating = true;

        gemsToFall.forEach(({ gem, targetY }) => {
            game.animatingGems.add(gem);
            const animation = createFallAnimation(gem, targetY, gem.y);
            animation.onComplete = () => {
                game.animatingGems.delete(gem);
            };
            game.animations.push(animation);
        });

        // Wait for all fall animations to complete
        const checkComplete = setInterval(() => {
            if (game.animations.length === 0 ||
                !game.animations.some(a => a.type === 'fall')) {
                clearInterval(checkComplete);
                game.isAnimating = false;
                resolve();
            }
        }, 16);
    });
}

/**
 * GridManager Class - Manages the game grid
 */
class GridManager {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.grid = [];
        this.gemSize = CONFIG.gemSize;
        this.gemColors = GEM_COLORS;
    }

    /**
     * Initialize the grid with random gems, ensuring no initial matches
     */
    initialize() {
        this.grid = [];

        for (let row = 0; row < this.rows; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.cols; col++) {
                let gemType;
                do {
                    gemType = this.getRandomGemType();
                } while (this.wouldCreateMatch(row, col, gemType));

                this.grid[row][col] = this.createGem(row, col, gemType);
            }
        }
    }

    /**
     * Create a gem object at the specified position
     * Feature #20: Added powerUpType parameter for power-up gems
     */
    createGem(row, col, type, powerUpType = POWERUP_TYPES.NONE) {
        return {
            type: type,
            powerUpType: powerUpType,
            x: col * this.gemSize,
            y: row * this.gemSize,
            row: row,
            col: col,
            alpha: 1,
            scale: 1
        };
    }

    /**
     * Get a random gem type (0-3 representing 4 colors)
     */
    getRandomGemType() {
        return Math.floor(Math.random() * this.gemColors.length);
    }

    /**
     * Check if placing a gem at (row, col) would create a match
     */
    wouldCreateMatch(row, col, gemType) {
        // Check horizontal (left)
        if (col >= 2) {
            if (this.grid[row][col - 1].type === gemType &&
                this.grid[row][col - 2].type === gemType) {
                return true;
            }
        }

        // Check vertical (up)
        if (row >= 2) {
            if (this.grid[row - 1][col].type === gemType &&
                this.grid[row - 2][col].type === gemType) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get gem at specific grid position
     */
    getGem(row, col) {
        if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
            return this.grid[row][col];
        }
        return null;
    }

    /**
     * Get the grid data (for external use)
     */
    getGrid() {
        return this.grid;
    }

    /**
     * Check if grid has any matches
     */
    hasMatches() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const gem = this.grid[row][col];
                if (gem) {
                    // Check horizontal
                    if (col < this.cols - 2) {
                        const next1 = this.grid[row][col + 1];
                        const next2 = this.grid[row][col + 2];
                        if (next1 && next2 && gem.type === next1.type && gem.type === next2.type) {
                            return true;
                        }
                    }
                    // Check vertical
                    if (row < this.rows - 2) {
                        const next1 = this.grid[row + 1][col];
                        const next2 = this.grid[row + 2][col];
                        if (next1 && next2 && gem.type === next1.type && gem.type === next2.type) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    /**
     * Find all matches of 3+ gems in a row (horizontal and vertical)
     * Returns array of matched gem objects with match type and direction
     */
    findMatches() {
        const matches = [];

        // Find horizontal matches
        for (let row = 0; row < this.rows; row++) {
            let matchStart = 0;
            let matchLength = 1;

            for (let col = 1; col <= this.cols; col++) {
                const currentGem = this.grid[row][col];
                const prevGem = this.grid[row][col - 1];

                if (col < this.cols && currentGem && prevGem && currentGem.type === prevGem.type) {
                    matchLength++;
                } else {
                    // End of run, check if we have a match
                    if (matchLength >= 3) {
                        for (let i = 0; i < matchLength; i++) {
                            matches.push({
                                gem: this.grid[row][matchStart + i],
                                matchType: matchLength,
                                direction: 'horizontal'
                            });
                        }
                    }
                    matchStart = col;
                    matchLength = 1;
                }
            }
        }

        // Find vertical matches
        for (let col = 0; col < this.cols; col++) {
            let matchStart = 0;
            let matchLength = 1;

            for (let row = 1; row <= this.rows; row++) {
                const currentGem = this.grid[row] ? this.grid[row][col] : null;
                const prevGem = this.grid[row - 1] ? this.grid[row - 1][col] : null;

                if (row < this.rows && currentGem && prevGem && currentGem.type === prevGem.type) {
                    matchLength++;
                } else {
                    // End of run, check if we have a match
                    if (matchLength >= 3) {
                        for (let i = 0; i < matchLength; i++) {
                            const gem = this.grid[matchStart + i][col];
                            // Don't add if already matched horizontally (avoid duplicates)
                            const alreadyMatched = matches.some(m => m.gem === gem);
                            if (!alreadyMatched) {
                                matches.push({
                                    gem: gem,
                                    matchType: matchLength,
                                    direction: 'vertical'
                                });
                            }
                        }
                    }
                    matchStart = row;
                    matchLength = 1;
                }
            }
        }

        return matches;
    }

    /**
     * Get unique matched gems from findMatches result
     */
    getMatchedGems() {
        const matches = this.findMatches();
        const uniqueGems = [];
        const seen = new Set();

        for (const match of matches) {
            const gemKey = `${match.gem.row},${match.gem.col}`;
            if (!seen.has(gemKey)) {
                seen.add(gemKey);
                uniqueGems.push(match.gem);
            }
        }

        return uniqueGems;
    }

    /**
     * Remove matched gems from the grid (set to null)
     * Returns the number of gems removed
     */
    removeMatchedGems(matchedGems) {
        let removedCount = 0;

        for (const gem of matchedGems) {
            if (this.grid[gem.row] && this.grid[gem.row][gem.col]) {
                this.grid[gem.row][gem.col] = null;
                removedCount++;
            }
        }

        console.log(`Removed ${removedCount} matched gems`);
        return removedCount;
    }

    /**
     * Remove matched gems with animation
     * Returns a promise that resolves when animation is complete
     */
    async animateRemoveMatchedGems(matchedGems) {
        console.log(`🎬 Starting match clear animations for ${matchedGems.length} gems`);
        await animateClearMatch(matchedGems);
        const removed = this.removeMatchedGems(matchedGems);
        console.log(`✅ Clear animations complete, removed ${removed} gems`);
        return removed;
    }

    /**
     * Drop gems down to fill empty spaces
     * Returns the number of gems that dropped
     */
    dropGems() {
        let droppedCount = 0;

        // Process each column
        for (let col = 0; col < this.cols; col++) {
            let emptyRow = this.rows - 1;

            // Start from the bottom, move gems down
            for (let row = this.rows - 1; row >= 0; row--) {
                if (this.grid[row][col] !== null) {
                    // If there's a gap below, move this gem down
                    if (row !== emptyRow) {
                        this.grid[emptyRow][col] = this.grid[row][col];
                        this.grid[emptyRow][col].row = emptyRow;
                        this.grid[emptyRow][col].y = emptyRow * this.gemSize;
                        this.grid[row][col] = null;
                        droppedCount++;
                    }
                    emptyRow--;
                }
            }
        }

        console.log(`Dropped ${droppedCount} gems down`);
        return droppedCount;
    }

    /**
     * Drop gems down to fill empty spaces (version for animation)
     * Returns array of {gem, targetY} for gems that need to fall
     */
    calculateGemsToFall() {
        const gemsToFall = [];

        // Process each column
        for (let col = 0; col < this.cols; col++) {
            let emptyRow = this.rows - 1;

            // Start from the bottom, move gems down
            for (let row = this.rows - 1; row >= 0; row--) {
                if (this.grid[row][col] !== null) {
                    // If there's a gap below, this gem needs to fall
                    if (row !== emptyRow) {
                        const gem = this.grid[row][col];
                        const targetY = emptyRow * this.gemSize;
                        gemsToFall.push({ gem, targetY, startY: gem.y });
                    }
                    emptyRow--;
                }
            }
        }

        return gemsToFall;
    }

    /**
     * Animate gems falling down - version that calculates and animates
     * Returns a promise that resolves when animation is complete
     */
    async animateDropGems() {
        const gemsToFall = this.calculateGemsToFall();

        if (gemsToFall.length === 0) {
            return 0;
        }

        console.log(`🎬 Starting fall animations for ${gemsToFall.length} gems`);

        // Store the animation promises
        const animationPromises = [];

        for (const { gem, targetY } of gemsToFall) {
            // Calculate target row BEFORE updating
            const targetRow = Math.floor(targetY / this.gemSize);
            
            // Update grid: remove from old position, add to new position
            this.grid[gem.row][gem.col] = null;
            gem.row = targetRow;
            gem.y = targetY; // Update visual position for animation
            this.grid[gem.row][gem.col] = gem;

            // Calculate start Y for animation (where gem is visually now)
            const startY = gem.y;
            // Reset gem.y to start position for animation
            gem.y = startY;

            game.animatingGems.add(gem);
            
            const animation = createFallAnimation(gem, targetY, startY);
            
            const promise = new Promise((resolve) => {
                animation.onComplete = () => {
                    game.animatingGems.delete(gem);
                    resolve();
                };
            });
            
            game.animations.push(animation);
            animationPromises.push(promise);
        }

        // Wait for all fall animations to complete
        await Promise.all(animationPromises);

        console.log(`✅ Fall animations complete`);
        return gemsToFall.length;
    }

    /**
     * Animate new gems spawning from above the grid
     * Returns a promise that resolves when animation is complete
     */
    async animateSpawnGems() {
        const gemsToSpawn = [];

        // Find all empty cells and create gems that will fall in
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.grid[row][col] === null) {
                    const gemType = this.getRandomGemType();
                    const newGem = this.createGem(row, col, gemType);

                    // Position new gems above the grid for animation effect
                    const targetY = row * this.gemSize;
                    newGem.y = -this.gemSize * (this.rows - row);

                    this.grid[row][col] = newGem;
                    gemsToSpawn.push({ gem: newGem, targetY });
                }
            }
        }

        if (gemsToSpawn.length === 0) {
            return 0;
        }

        console.log(`🎬 Starting spawn animations for ${gemsToSpawn.length} new gems`);

        // Create fall animations for spawned gems
        const animationPromises = [];

        for (const { gem, targetY } of gemsToSpawn) {
            game.animatingGems.add(gem);
            
            const animation = createFallAnimation(gem, targetY, gem.y);
            
            const promise = new Promise((resolve) => {
                animation.onComplete = () => {
                    game.animatingGems.delete(gem);
                    resolve();
                };
            });
            
            game.animations.push(animation);
            animationPromises.push(promise);
        }

        // Wait for all spawn animations to complete
        await Promise.all(animationPromises);

        console.log(`✅ Spawn animations complete`);
        return gemsToSpawn.length;
    }

    /**
     * Refill the grid with new random gems in empty spaces (instant - use animateSpawnGems for animation)
     * Returns the number of new gems spawned
     */
    refillGrid() {
        let spawnedCount = 0;

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.grid[row][col] === null) {
                    const gemType = this.getRandomGemType();
                    const newGem = this.createGem(row, col, gemType);
                    this.grid[row][col] = newGem;
                    spawnedCount++;
                }
            }
        }

        return spawnedCount;
    }

    /**
     * Process a complete match cycle: remove matches, drop gems, and refill
     * Returns info about what happened
     */
    processMatchCycle() {
        const matches = this.findMatches();

        if (matches.length === 0) {
            return { processed: false, removed: 0, dropped: 0, spawned: 0 };
        }

        const matchedGems = this.getMatchedGems();

        // Remove matched gems
        const removed = this.removeMatchedGems(matchedGems);

        // Drop existing gems
        const dropped = this.dropGems();

        // Spawn new gems
        const spawned = this.refillGrid();

        console.log(`Match cycle complete: removed ${removed}, dropped ${dropped}, spawned ${spawned}`);

        return {
            processed: true,
            removed: removed,
            dropped: dropped,
            spawned: spawned,
            matchedGems: matchedGems
        };
    }

    /**
     * Process a complete match cycle WITH animations (Feature #9)
     * Returns info about what happened
     */
    async animateMatchCycle() {
        const matches = this.findMatches();

        if (matches.length === 0) {
            return { processed: false, removed: 0, dropped: 0, spawned: 0 };
        }

        const matchedGems = this.getMatchedGems();

        // Remove matched gems with animation
        const removed = await this.animateRemoveMatchedGems(matchedGems);

        // Drop existing gems with animation
        const dropped = await this.animateDropGems();

        // Spawn new gems with animation
        const spawned = await this.animateSpawnGems();

        console.log(`Animated match cycle complete: removed ${removed}, dropped ${dropped}, spawned ${spawned}`);

        return {
            processed: true,
            removed: removed,
            dropped: dropped,
            spawned: spawned,
            matchedGems: matchedGems
        };
    }

    /**
     * Check if there are any matches after a cycle and process recursively
     * Returns total gems cleared in all cascades
     */
    processCascade() {
        let totalCleared = 0;
        let cycleCount = 0;
        let result = this.processMatchCycle();

        while (result.processed) {
            totalCleared += result.removed;
            cycleCount++;

            // Check for new matches after refill
            result = this.processMatchCycle();
        }

        if (cycleCount > 0) {
            console.log(`Cascade complete: ${cycleCount} cycles, ${totalCleared} total gems cleared`);
        }

        return totalCleared;
    }

    /**
     * Check if there are any matches after a cycle and process recursively WITH animations
     * Returns total gems cleared in all cascades
     */
    async animateCascade() {
        let totalCleared = 0;
        let cycleCount = 0;
        let result = await this.animateMatchCycle();

        while (result.processed) {
            totalCleared += result.removed;
            cycleCount++;

            // Brief pause between cascades for visual effect
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check for new matches after refill
            result = await this.animateMatchCycle();
        }

        if (cycleCount > 0) {
            console.log(`Animated cascade complete: ${cycleCount} cycles, ${totalCleared} total gems cleared`);
        }

        return totalCleared;
    }
}

/**
 * Start the game (called from PLAY button)
 */
function startGame() {
    // Hide overlay button
    const overlayBtn = document.getElementById('start-button-overlay');
    if (overlayBtn) {
        overlayBtn.style.display = 'none';
    }
    
    game.gameState = GAME_STATE.PLAYING;
    game.score = 0;
    game.level = 1;
    game.moves = ShopManager.getBonusMoves();
    game.targetScore = 1000;
    resetTimer();
    startTimer();

    // Initialize grid if not already done
    if (!game.gridInitialized) {
        game.gridManager.initialize();
        game.grid = game.gridManager.getGrid();
        game.gridInitialized = true;
    }

    game.isAnimating = false;
    game.selectedGem = null;

    console.log('\n🎮 Starting game! Level 1 - Target: 1000 points');
}

/**
 * Return to menu
 */
function returnToMenu() {
    game.gameState = GAME_STATE.MENU;
    game.isAnimating = false;
    game.selectedGem = null;
    
    // Show overlay button again
    const overlayBtn = document.getElementById('start-button-overlay');
    if (overlayBtn) {
        overlayBtn.style.display = 'block';
    }
    
    stopTimer();
}

// Global function for overlay play button
function handleOverlayPlayClick() {
    startGame();
}

/**
 * Draw a bucket (container for gems)
 */
function drawBucket(x, y, width, height) {
    const ctx = game.ctx;

    // Bucket background
    ctx.fillStyle = CONFIG.bucketColor;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 6);
    ctx.fill();

    // Bucket border
    ctx.strokeStyle = CONFIG.bucketBorderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bucket inner shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.roundRect(x + 4, y + height - 8, width - 8, 4, 2);
    ctx.fill();
}

/**
 * Draw a single gem with visual effects
 * Feature #20: Added power-up visual indicators
 */
function drawGem(gem) {
    if (!gem) return;
    const ctx = game.ctx;
    const colors = GEM_COLORS;
    const isSelected = game.selectedGem === gem;

    const x = gem.x + CONFIG.gridOffsetX + CONFIG.bucketPadding + CONFIG.gemPadding;
    const y = gem.y + CONFIG.gridOffsetY + CONFIG.bucketPadding + CONFIG.gemPadding;
    const size = CONFIG.gemSize - CONFIG.gemPadding * 2 - CONFIG.bucketPadding * 2;

    ctx.save();
    ctx.globalAlpha = gem.alpha;

    // Apply selection pulse animation
    let scaleOffset = 0;
    if (isSelected && selectionAnimation.active) {
        const elapsed = performance.now() - selectionAnimation.startTime;
        const pulse = (Math.sin(elapsed / ANIMATION.SELECTION_PULSE_DURATION * Math.PI * 2) + 1) / 2;
        scaleOffset = pulse * 0.05; // Subtle scale pulse
    }

    ctx.translate(x + size / 2, y + size / 2);
    ctx.scale(gem.scale + scaleOffset, gem.scale + scaleOffset);

    // Draw selection glow behind gem
    if (isSelected) {
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 15 + (scaleOffset * 200);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    // Feature #20: Draw power-up indicator first (behind gem)
    if (gem.powerUpType === POWERUP_TYPES.BOMB) {
        // Bomb glow effect
        const pulseTime = performance.now() / 200;
        const glowSize = size / 2 + Math.sin(pulseTime) * 3;

        ctx.shadowColor = '#e74c3c';
        ctx.shadowBlur = 20;
    } else if (gem.powerUpType === POWERUP_TYPES.COLOR_CLEAR) {
        // Color clear rainbow glow
        const hue = (performance.now() / 10) % 360;
        ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
        ctx.shadowBlur = 20;
    }

    // Draw gem shape (rounded rectangle)
    ctx.fillStyle = colors[gem.type];
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 2, size, size, 8);
    ctx.fill();

    // Reset shadow for other elements
    ctx.shadowBlur = 0;

    // Draw gem border
    ctx.strokeStyle = isSelected ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();

    // Draw gem highlight (top-left)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.ellipse(-size / 4, -size / 4, size / 4, size / 6, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw gem shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.roundRect(-size / 2 + 4, -size / 2 + 2, size - 8, size / 3, 4);
    ctx.fill();

    // Feature #20: Draw power-up icon on top
    if (gem.powerUpType === POWERUP_TYPES.BOMB) {
        // Bomb icon
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(0, 2, size / 4, 0, Math.PI * 2);
        ctx.fill();

        // Fuse
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.moveTo(0, -size / 4 + 2);
        ctx.lineTo(4, -size / 3);
        ctx.lineTo(-4, -size / 3);
        ctx.closePath();
        ctx.fill();

        // Spark
        const sparkColor = ['#e74c3c', '#f39c12', '#f1c40f'][Math.floor(performance.now() / 100) % 3];
        ctx.fillStyle = sparkColor;
        ctx.beginPath();
        ctx.arc(0, -size / 3 - 3, 3, 0, Math.PI * 2);
        ctx.fill();

        // Border to indicate power-up
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
        ctx.stroke();
    } else if (gem.powerUpType === POWERUP_TYPES.COLOR_CLEAR) {
        // Color palette icon
        const iconSize = size / 3;
        ctx.fillStyle = colors[gem.type];
        ctx.beginPath();
        ctx.arc(-iconSize / 2, -iconSize / 4, iconSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(iconSize / 2, -iconSize / 4, iconSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = colors[(gem.type + 1) % colors.length];
        ctx.beginPath();
        ctx.arc(0, iconSize / 4, iconSize / 2, 0, Math.PI * 2);
        ctx.fill();

        // Border to indicate power-up
        ctx.strokeStyle = '#9b59b6';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    ctx.restore();
}

/**
 * Draw the game grid with buckets
 */
function drawGrid() {
    const ctx = game.ctx;
    const bucketWidth = CONFIG.gemSize - CONFIG.bucketPadding * 2;
    const bucketHeight = CONFIG.gemSize - CONFIG.bucketPadding * 2;

    // Draw each bucket and gem
    for (let row = 0; row < CONFIG.gridRows; row++) {
        for (let col = 0; col < CONFIG.gridCols; col++) {
            const bucketX = col * CONFIG.gemSize + CONFIG.gridOffsetX;
            const bucketY = row * CONFIG.gemSize + CONFIG.gridOffsetY;

            // Draw bucket
            drawBucket(bucketX, bucketY, bucketWidth, bucketHeight);

            // Draw gem
            if (game.grid[row][col]) {
                drawGem(game.grid[row][col]);
            }
        }
    }
}

/**
 * Draw selection highlight on selected gem
 */
/**
 * Draw enhanced selection highlight with animated pulse rings
 */
function drawSelection() {
    if (game.selectedGem) {
        const ctx = game.ctx;
        const gem = game.selectedGem;

        const centerX = gem.x + CONFIG.gridOffsetX + CONFIG.gemSize / 2;
        const centerY = gem.y + CONFIG.gridOffsetY + CONFIG.gemSize / 2;
        const baseSize = CONFIG.gemSize / 2 + 4;

        // Calculate pulse effect
        const elapsed = selectionAnimation.active ? performance.now() - selectionAnimation.startTime : 0;
        const pulse = (Math.sin(elapsed / ANIMATION.SELECTION_PULSE_DURATION * Math.PI * 2) + 1) / 2;

        // Draw multiple animated rings for dynamic effect
        for (let i = 3; i >= 0; i--) {
            const ringScale = 1 + (i * 0.15) + (pulse * 0.1);
            const ringAlpha = 0.3 - (i * 0.07);

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.scale(ringScale, ringScale);

            ctx.strokeStyle = `rgba(255, 255, 255, ${ringAlpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(-baseSize, -baseSize, baseSize * 2, baseSize * 2, 8);
            ctx.stroke();

            ctx.restore();
        }

        // Draw corner accents for visual emphasis
        const accentSize = 8;
        const offset = baseSize - 2;

        ctx.fillStyle = '#ffffff';
        const corners = [
            [-offset, -offset], [offset, -offset],
            [-offset, offset], [offset, offset]
        ];

        for (const [cx, cy] of corners) {
            ctx.beginPath();
            ctx.arc(centerX + cx, centerY + cy, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Inner highlight ring
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 + pulse * 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(
            gem.x + CONFIG.gridOffsetX - 2,
            gem.y + CONFIG.gridOffsetY - 2,
            CONFIG.gemSize + 4,
            CONFIG.gemSize + 4,
            8
        );
        ctx.stroke();
    }
}

/**
 * Update selection animation state
 */
function updateSelectionAnimation() {
    if (game.selectedGem) {
        if (!selectionAnimation.active) {
            selectionAnimation.active = true;
            selectionAnimation.startTime = performance.now();
        }
    } else {
        selectionAnimation.active = false;
    }
}

/**
 * Feature #13: Draw start screen
 */
function drawStartScreen() {
    const ctx = game.ctx;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(26, 26, 46, 0.95)';
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    // Decorative gems
    const gemPositions = [
        { x: 80, y: 150, color: GEM_COLORS[0], scale: 1.2 },
        { x: 440, y: 150, color: GEM_COLORS[1], scale: 1.2 },
        { x: 80, y: 450, color: GEM_COLORS[2], scale: 1.2 },
        { x: 440, y: 450, color: GEM_COLORS[3], scale: 1.2 },
        { x: 260, y: 100, color: GEM_COLORS[0], scale: 0.8 },
        { x: 260, y: 500, color: GEM_COLORS[1], scale: 0.8 },
    ];

    gemPositions.forEach(gem => {
        ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 1000 + gem.x) * 0.1;
        ctx.beginPath();
        ctx.arc(gem.x, gem.y, CONFIG.gemSize * gem.scale / 2, 0, Math.PI * 2);
        ctx.fillStyle = gem.color;
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Game title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('THREE', CONFIG.canvasWidth / 2, 180);
    ctx.fillText('IN A ROW', CONFIG.canvasWidth / 2, 240);

    // Decorative line
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(160, 260);
    ctx.lineTo(360, 260);
    ctx.stroke();

    // Subtitle
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '18px Arial';
    ctx.fillText('Match 3 gems to win!', CONFIG.canvasWidth / 2, 310);

    // Play button
    const btnWidth = 180;
    const btnHeight = 50;
    const btnX = (CONFIG.canvasWidth - btnWidth) / 2;
    const btnY = 380;

    // Button shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.roundRect(btnX + 3, btnY + 3, btnWidth, btnHeight, 8);
    ctx.fill();

    // Button background
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnWidth, btnHeight, 8);
    ctx.fill();

    // Button text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PLAY', CONFIG.canvasWidth / 2, btnY + 33);

    // Settings button (smaller, below play button)
    const settingsBtnWidth = 120;
    const settingsBtnHeight = 36;
    const settingsBtnX = (CONFIG.canvasWidth - settingsBtnWidth) / 2;
    const settingsBtnY = btnY + 65;

    // Settings button shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.roundRect(settingsBtnX + 3, settingsBtnY + 3, settingsBtnWidth, settingsBtnHeight, 6);
    ctx.fill();

    // Settings button background
    ctx.fillStyle = '#4a4a6a';
    ctx.beginPath();
    ctx.roundRect(settingsBtnX, settingsBtnY, settingsBtnWidth, settingsBtnHeight, 6);
    ctx.fill();

    // Settings button text
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.fillText('⚙️ Settings', CONFIG.canvasWidth / 2, settingsBtnY + 24);

    // Achievements button (left side)
    const achBtnWidth = 100;
    const achBtnHeight = 36;
    const achBtnX = 20;
    const achBtnY = btnY + 65;
    const achBtnCenterX = achBtnX + achBtnWidth / 2;

    // Achievements button shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.roundRect(achBtnX + 3, achBtnY + 3, achBtnWidth, achBtnHeight, 6);
    ctx.fill();

    // Achievements button background
    const achProgress = AchievementManager.getProgress();
    ctx.fillStyle = achProgress.unlocked > 0 ? '#f1c40f' : '#4a4a6a';
    ctx.beginPath();
    ctx.roundRect(achBtnX, achBtnY, achBtnWidth, achBtnHeight, 6);
    ctx.fill();

    // Achievements button text
    ctx.fillStyle = achProgress.unlocked > 0 ? '#1a1a2e' : '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`🏆 ${achProgress.unlocked}/${achProgress.total}`, achBtnCenterX, achBtnY + 24);

    // Shop button (right side)
    const shopBtnWidth = 100;
    const shopBtnHeight = 36;
    const shopBtnX = CONFIG.canvasWidth - shopBtnWidth - 20;
    const shopBtnY = btnY + 65;

    // Shop button shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.roundRect(shopBtnX + 3, shopBtnY + 3, shopBtnWidth, shopBtnHeight, 6);
    ctx.fill();

    // Shop button background
    ctx.fillStyle = '#9b59b6';
    ctx.beginPath();
    ctx.roundRect(shopBtnX, shopBtnY, shopBtnWidth, shopBtnHeight, 6);
    ctx.fill();

    // Shop button text
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.fillText('💎 Shop', CONFIG.canvasWidth - 70, shopBtnY + 24);

    // Currency display
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`💎 ${game.gems || 0}`, 20, 30);
    ctx.fillText(`🪙 ${game.coins || 0}`, 20, 55);

    // Instructions
    ctx.fillStyle = '#666666';
    ctx.font = '14px Arial';
    ctx.fillText('Click adjacent gems to swap and match 3 in a row', CONFIG.canvasWidth / 2, 480);
    ctx.fillText('Match as many as you can before time runs out!', CONFIG.canvasWidth / 2, 500);

    // Version
    ctx.fillStyle = '#444444';
    ctx.font = '12px Arial';
    ctx.fillText('v1.0', CONFIG.canvasWidth / 2, 560);
}

/**
 * Feature #14: Draw game HUD with level, score, moves, timer, and target
 * Feature #19: Updated to show combo information
 */
function drawHUD() {
    const ctx = game.ctx;

    // HUD background
    ctx.fillStyle = CONFIG.bucketColor;
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.gridOffsetY - 10);

    // Level - left side
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Level: ${game.level}`, 20, 32);

    // Score - center left
    ctx.textAlign = 'center';
    ctx.font = '16px Arial';
    ctx.fillText(`Score: ${game.score}`, 130, 32);

    // Timer - center with prominent display
    ctx.font = 'bold 20px Arial';
    const timerColor = game.timer <= 10 ? '#ff6b6b' : '#ffffff';
    ctx.fillStyle = timerColor;
    ctx.fillText(`Time: ${formatTime(game.timer)}`, CONFIG.canvasWidth / 2, 32);

    // Moves - center right
    ctx.textAlign = 'center';
    ctx.font = '16px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Moves: ${game.moves}`, CONFIG.canvasWidth - 130, 32);

    // Target score - right side
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f1c40f';
    ctx.fillText(`Target: ${game.targetScore}`, CONFIG.canvasWidth - 20, 32);

    // Feature #19: Combo display
    if (game.comboCount > 1) {
        const comboMultiplier = getComboMultiplier();
        
        // Combo background pill
        ctx.fillStyle = 'rgba(241, 196, 15, 0.3)';
        ctx.beginPath();
        ctx.roundRect(CONFIG.canvasWidth / 2 - 50, 38, 100, 24, 12);
        ctx.fill();
        
        // Combo border
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Combo text
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText(`🔥 x${comboMultiplier.toFixed(1)}`, CONFIG.canvasWidth / 2, 55);
    }
}

/**
 * Check win/lose conditions - Feature #7 & Feature #14 (timer)
 */
function checkGameState() {
    // Check win condition
    if (game.score >= game.targetScore) {
        stopTimer(); // Stop timer on win
        game.gameState = GAME_STATE.WON;
        SoundManager.levelComplete();
        initConfetti(); // Feature #15: Start confetti celebration
        console.log(`🎉 LEVEL COMPLETE! You reached ${game.score} points!`);
        return true;
    }

    // Check lose condition - no moves
    if (game.moves <= 0 && game.score < game.targetScore) {
        game.gameState = GAME_STATE.LOST;
        SoundManager.gameOver();
        console.log(`💀 GAME OVER! Out of moves! Score: ${game.score}/${game.targetScore}`);
        return true;
    }

    // Check lose condition - time ran out
    if (game.timer <= 0 && game.score < game.targetScore) {
        game.gameState = GAME_STATE.LOST;
        SoundManager.gameOver();
        console.log(`💀 GAME OVER! Time's up! Score: ${game.score}/${game.targetScore}`);
        return true;
    }

    return false;
}

/**
 * Feature #16: Enhanced Game Over Screen with polish, stats, and restart options
 */
function drawGameOverOverlay() {
    const ctx = game.ctx;
    const overlayWidth = 360;
    const overlayHeight = 320;
    const x = (CONFIG.canvasWidth - overlayWidth) / 2;
    const y = (CONFIG.canvasHeight - overlayHeight) / 2;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    // Modal background with gradient (dark, serious tone for loss)
    const gradient = ctx.createLinearGradient(x, y, x, y + overlayHeight);
    gradient.addColorStop(0, '#2d3436');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, overlayWidth, overlayHeight, 16);
    ctx.fill();

    // Modal border with red accent (loss indicator)
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Animated "GAME OVER" title with red glow
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CONFIG.canvasWidth / 2, y + 55);
    ctx.shadowBlur = 0;

    // Draw skull icon above text (simple visual)
    const skullY = y + 35;
    const skullSize = 16;
    ctx.fillStyle = 'rgba(231, 76, 60, 0.8)';
    ctx.beginPath();
    ctx.arc(CONFIG.canvasWidth / 2, skullY - 15, skullSize, 0, Math.PI * 2);
    ctx.fill();

    // Divider line
    const dividerY = y + 85;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 40, dividerY);
    ctx.lineTo(x + overlayWidth - 40, dividerY);
    ctx.stroke();

    // Score display with nice formatting
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Arial';
    ctx.fillText(`Final Score: ${game.score}`, CONFIG.canvasWidth / 2, y + 125);

    // Target info
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '16px Arial';
    ctx.fillText(`Target: ${game.targetScore}`, CONFIG.canvasWidth / 2, y + 155);

    // Progress bar showing how close they got
    const progressY = y + 180;
    const progressWidth = 200;
    const progressHeight = 12;
    const progressX = CONFIG.canvasWidth / 2 - progressWidth / 2;

    // Progress background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.roundRect(progressX, progressY, progressWidth, progressHeight, 6);
    ctx.fill();

    // Progress fill (red since failed)
    const progress = Math.min(1, game.score / game.targetScore);
    const progressFill = Math.max(2, progressWidth * progress);
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.roundRect(progressX, progressY, progressFill, progressHeight, 6);
    ctx.fill();

    // Progress percentage
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '14px Arial';
    ctx.fillText(`${Math.floor(progress * 100)}% of target`, CONFIG.canvasWidth / 2, progressY + 30);

    // Restart button
    const buttonY = y + 250;
    const buttonWidth = 160;
    const buttonHeight = 44;
    const buttonX = CONFIG.canvasWidth / 2 - buttonWidth / 2;

    // Button hover effect
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur = 10;

    // Button background
    const buttonGradient = ctx.createLinearGradient(buttonX, buttonY, buttonX, buttonY + buttonHeight);
    buttonGradient.addColorStop(0, '#e74c3c');
    buttonGradient.addColorStop(1, '#c0392b');
    ctx.fillStyle = buttonGradient;
    ctx.beginPath();
    ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Button border
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Button text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('Try Again', CONFIG.canvasWidth / 2, buttonY + 28);

    // Restart hint
    ctx.fillStyle = '#888888';
    ctx.font = '14px Arial';
    ctx.fillText('or click anywhere to restart', CONFIG.canvasWidth / 2, y + overlayHeight - 15);
}

// Level complete animation state
const levelCompleteAnimation = {
    starsEarned: 0,
    starDelay: 0,
    confetti: [],
    showConfetti: false
};

// Calculate stars based on score (1-3 stars)
function calculateStars(score, target) {
    const ratio = score / target;
    if (ratio >= 2) return 3;      // Double target = 3 stars
    if (ratio >= 1.5) return 2.5;  // 1.5x target = 2.5 stars
    if (ratio >= 1) return 2;      // At target = 2 stars
    return 1;                       // Below target = 1 star (minimum)
}

// Confetti particle class
class ConfettiParticle {
    constructor() {
        this.x = Math.random() * CONFIG.canvasWidth;
        this.y = -10;
        this.size = Math.random() * 8 + 4;
        this.speedY = Math.random() * 3 + 2;
        this.speedX = (Math.random() - 0.5) * 2;
        this.color = GEM_COLORS[Math.floor(Math.random() * GEM_COLORS.length)];
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
    }

    update() {
        this.y += this.speedY;
        this.x += this.speedX;
        this.rotation += this.rotationSpeed;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
}

// Initialize confetti for level complete
function initConfetti() {
    levelCompleteAnimation.confetti = [];
    for (let i = 0; i < 50; i++) {
        levelCompleteAnimation.confetti.push(new ConfettiParticle());
    }
    levelCompleteAnimation.showConfetti = true;
}

// Update and draw confetti
function updateConfetti(ctx) {
    if (!levelCompleteAnimation.showConfetti) return;

    const remaining = [];
    for (const particle of levelCompleteAnimation.confetti) {
        particle.update();
        particle.draw(ctx);
        if (particle.y < CONFIG.canvasHeight + 10) {
            remaining.push(particle);
        }
    }
    levelCompleteAnimation.confetti = remaining;
}

// Stop confetti when animation ends
function stopConfetti() {
    levelCompleteAnimation.showConfetti = false;
}

/**
 * Feature #15: Enhanced Level Complete Screen with stars, stats, and animations
 */
function drawLevelCompleteOverlay() {
    const ctx = game.ctx;
    const overlayWidth = 360;
    const overlayHeight = 340;
    const x = (CONFIG.canvasWidth - overlayWidth) / 2;
    const y = (CONFIG.canvasHeight - overlayHeight) / 2;

    // Draw confetti in background
    updateConfetti(ctx);

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    // Modal background with gradient
    const gradient = ctx.createLinearGradient(x, y, x, y + overlayHeight);
    gradient.addColorStop(0, '#2d3436');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, overlayWidth, overlayHeight, 16);
    ctx.fill();

    // Modal border
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Animated "LEVEL COMPLETE!" title with glow
    ctx.shadowColor = '#2ecc71';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL COMPLETE!', CONFIG.canvasWidth / 2, y + 50);
    ctx.shadowBlur = 0;

    // Draw star rating
    const starsY = y + 100;
    const starSpacing = 50;
    const starsX = CONFIG.canvasWidth / 2 - starSpacing;

    // Calculate stars based on performance
    const stars = calculateStars(game.score, game.targetScore);
    levelCompleteAnimation.starsEarned = stars;

    // Draw star containers (empty stars)
    for (let i = 0; i < 3; i++) {
        const starX = starsX + i * starSpacing;
        ctx.beginPath();
        ctx.arc(starX, starsY, 20, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fill();
    }

    // Animate stars filling in
    const starRevealDelay = 300; // ms between each star
    const elapsed = performance.now();
    const starReveals = Math.min(3, Math.floor(elapsed / starRevealDelay) + 1);

    for (let i = 0; i < 3; i++) {
        const starX = starsX + i * starSpacing;

        // Determine if this star should be shown
        let showStar = false;
        if (i < Math.floor(stars)) {
            showStar = true; // Full stars always show
        } else if (i === Math.floor(stars) && stars % 1 >= 0.5) {
            showStar = true; // Half star
        }

        if (showStar) {
            // Star glow effect
            ctx.shadowColor = '#f1c40f';
            ctx.shadowBlur = 15;

            // Draw filled star
            ctx.beginPath();
            for (let j = 0; j < 5; j++) {
                const angle = (j * 4 * Math.PI) / 5 - Math.PI / 2;
                const radius = j % 2 === 0 ? 20 : 10;
                const px = starX + Math.cos(angle) * radius;
                const py = starsY + Math.sin(angle) * radius;
                if (j === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = stars % 1 >= 0.5 && i === Math.floor(stars) ?
                'url(#halfStarGradient)' : '#f1c40f';
            ctx.fill();

            // Solid gold fill for full stars
            if (!(stars % 1 >= 0.5 && i === Math.floor(stars))) {
                ctx.fillStyle = '#f1c40f';
                ctx.fill();
            }

            ctx.shadowBlur = 0;

            // Star outline
            ctx.strokeStyle = '#d4a312';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    // Score display with nice formatting
    const scoreY = y + 160;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`${game.score}`, CONFIG.canvasWidth / 2, scoreY);

    // Score label
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '14px Arial';
    ctx.fillText('FINAL SCORE', CONFIG.canvasWidth / 2, scoreY + 20);

    // Stats row - time and moves
    const statsY = y + 220;
    ctx.fillStyle = '#888888';
    ctx.font = '12px Arial';

    // Time bonus
    const timeBonus = game.timer * 10;
    ctx.fillStyle = game.timer > 10 ? '#2ecc71' : '#f1c40f';
    ctx.fillText(`Time Bonus: +${timeBonus}`, CONFIG.canvasWidth / 2 - 80, statsY);

    // Divider
    ctx.fillStyle = '#444444';
    ctx.fillRect(CONFIG.canvasWidth / 2 - 10, statsY - 15, 2, 30);

    // Moves remaining
    ctx.fillStyle = '#3498db';
    ctx.fillText(`Moves Left: ${game.moves}`, CONFIG.canvasWidth / 2 + 80, statsY);

    // Next Level button
    const btnWidth = 200;
    const btnHeight = 45;
    const btnX = (CONFIG.canvasWidth - btnWidth) / 2;
    const btnY = y + 260;

    // Button hover effect
    const rect = game.canvas.getBoundingClientRect();
    const mouseX = (game.lastMouseX || 0) - rect.left;
    const mouseY = (game.lastMouseY || 0) - rect.top;
    const isHovering = mouseX >= btnX && mouseX <= btnX + btnWidth &&
                       mouseY >= btnY && mouseY <= btnY + btnHeight;

    // Button shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.roundRect(btnX + 3, btnY + 3, btnWidth, btnHeight, 8);
    ctx.fill();

    // Button background with gradient
    const btnGradient = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnHeight);
    btnGradient.addColorStop(0, isHovering ? '#27ae60' : '#2ecc71');
    btnGradient.addColorStop(1, isHovering ? '#1e8449' : '#27ae60');
    ctx.fillStyle = btnGradient;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnWidth, btnHeight, 8);
    ctx.fill();

    // Button text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('NEXT LEVEL →', CONFIG.canvasWidth / 2, btnY + 29);
}

// Store mouse position for hover effects
if (typeof game !== 'undefined') {
    game.lastMouseX = 0;
    game.lastMouseY = 0;
}

/**
 * Feature #17: Pause Overlay with resume and quit options
 */
function drawPauseOverlay() {
    const ctx = game.ctx;
    const overlayWidth = 320;
    const overlayHeight = 280;
    const x = (CONFIG.canvasWidth - overlayWidth) / 2;
    const y = (CONFIG.canvasHeight - overlayHeight) / 2;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    // Modal background with gradient
    const gradient = ctx.createLinearGradient(x, y, x, y + overlayHeight);
    gradient.addColorStop(0, '#2d3436');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, overlayWidth, overlayHeight, 16);
    ctx.fill();

    // Modal border with yellow accent (pause indicator)
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 3;
    ctx.stroke();

    // "PAUSED" title with glow
    ctx.shadowColor = '#f1c40f';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', CONFIG.canvasWidth / 2, y + 50);
    ctx.shadowBlur = 0;

    // Divider line
    const dividerY = y + 70;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 40, dividerY);
    ctx.lineTo(x + overlayWidth - 40, dividerY);
    ctx.stroke();

    // Stats display (frozen)
    const statsY = y + 110;
    ctx.fillStyle = '#ecf0f1';
    ctx.font = '16px Arial';
    ctx.fillText(`Score: ${game.score}`, CONFIG.canvasWidth / 2, statsY);
    ctx.fillText(`Moves: ${game.moves}`, CONFIG.canvasWidth / 2, statsY + 30);
    ctx.fillText(`Time: ${formatTime(game.timer)}`, CONFIG.canvasWidth / 2, statsY + 60);

    // Resume button
    const resumeBtnWidth = 200;
    const resumeBtnHeight = 40;
    const resumeBtnX = (CONFIG.canvasWidth - resumeBtnWidth) / 2;
    const resumeBtnY = y + 190;

    // Button hover effect
    const rect = game.canvas.getBoundingClientRect();
    const mouseX = (game.lastMouseX || 0) - rect.left;
    const mouseY = (game.lastMouseY || 0) - rect.top;
    const isHoveringResume = mouseX >= resumeBtnX && mouseX <= resumeBtnX + resumeBtnWidth &&
                              mouseY >= resumeBtnY && mouseY <= resumeBtnY + resumeBtnHeight;

    // Button shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.roundRect(resumeBtnX + 3, resumeBtnY + 3, resumeBtnWidth, resumeBtnHeight, 8);
    ctx.fill();

    // Button background
    const btnGradient = ctx.createLinearGradient(resumeBtnX, resumeBtnY, resumeBtnX, resumeBtnY + resumeBtnHeight);
    btnGradient.addColorStop(0, isHoveringResume ? '#27ae60' : '#2ecc71');
    btnGradient.addColorStop(1, isHoveringResume ? '#1e8449' : '#27ae60');
    ctx.fillStyle = btnGradient;
    ctx.beginPath();
    ctx.roundRect(resumeBtnX, resumeBtnY, resumeBtnWidth, resumeBtnHeight, 8);
    ctx.fill();

    // Button text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('RESUME', CONFIG.canvasWidth / 2, resumeBtnY + 27);

    // Quit button
    const quitBtnWidth = 160;
    const quitBtnHeight = 36;
    const quitBtnX = (CONFIG.canvasWidth - quitBtnWidth) / 2;
    const quitBtnY = y + 240;

    const isHoveringQuit = mouseX >= quitBtnX && mouseX <= quitBtnX + quitBtnWidth &&
                            mouseY >= quitBtnY && mouseY <= quitBtnY + quitBtnHeight;

    // Button shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.roundRect(quitBtnX + 3, quitBtnY + 3, quitBtnWidth, quitBtnHeight, 8);
    ctx.fill();

    // Button background (red for quit)
    const quitBtnGradient = ctx.createLinearGradient(quitBtnX, quitBtnY, quitBtnX, quitBtnY + quitBtnHeight);
    quitBtnGradient.addColorStop(0, isHoveringQuit ? '#c0392b' : '#e74c3c');
    quitBtnGradient.addColorStop(1, isHoveringQuit ? '#922b21' : '#c0392b');
    ctx.fillStyle = quitBtnGradient;
    ctx.beginPath();
    ctx.roundRect(quitBtnX, quitBtnY, quitBtnWidth, quitBtnHeight, 8);
    ctx.fill();

    // Button text
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.fillText('QUIT TO MENU', CONFIG.canvasWidth / 2, quitBtnY + 24);
    
    // Pause hint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '12px Arial';
    ctx.fillText('Press ESC or P to unpause', CONFIG.canvasWidth / 2, y + overlayHeight - 15);
}

/**
 * Draw overlays based on game state
 */
function drawOverlays() {
    if (game.gameState === GAME_STATE.MENU) {
        drawStartScreen();
    } else if (game.gameState === GAME_STATE.WON) {
        drawLevelCompleteOverlay();
    } else if (game.gameState === GAME_STATE.LOST) {
        drawGameOverOverlay();
    } else if (game.gameState === GAME_STATE.PAUSED) {
        drawPauseOverlay();
    }
}

/**
 * Clear the canvas
 */
function clearCanvas() {
    const ctx = game.ctx;
    ctx.fillStyle = CONFIG.backgroundColor;
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
}

/**
 * Main game loop - now with animation processing and combo messages
 */
function gameLoop() {
    clearCanvas();

    if (game.gameState === GAME_STATE.MENU) {
        // Feature #13: Show start screen
        drawStartScreen();
    } else if (game.gameState === GAME_STATE.PAUSED) {
        // Feature #17: Show game state behind pause overlay
        drawHUD();
        drawGrid();
        drawSelection();
        drawPauseOverlay();
    } else {
        drawHUD();
        drawGrid();
        drawSelection();
        
        // Feature #19: Draw combo popup messages
        if (game.comboMessages.length > 0) {
            updateComboMessages(game.ctx);
        }
        
        drawOverlays();

        // Update selection animation state
        updateSelectionAnimation();

        // Process any active animations
        processAnimations();
    }

    requestAnimationFrame(gameLoop);
}

/**
 * Handle click events on the game canvas
 */
function handleCanvasClick(event) {
    // Feature #8: Prevent interaction during animations (only when playing)
    if (game.gameState === GAME_STATE.PLAYING && game.isAnimating) {
        console.log('Animation in progress, ignoring click');
        return;
    }

    // Feature #17: Handle pause overlay clicks
    if (game.gameState === GAME_STATE.PAUSED) {
        const rect = game.canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        const overlayWidth = 320;
        const overlayHeight = 280;
        const overlayX = (CONFIG.canvasWidth - overlayWidth) / 2;
        const overlayY = (CONFIG.canvasHeight - overlayHeight) / 2;

        // Resume button
        const resumeBtnWidth = 200;
        const resumeBtnHeight = 40;
        const resumeBtnX = (CONFIG.canvasWidth - resumeBtnWidth) / 2;
        const resumeBtnY = overlayY + 190;

        if (clickX >= resumeBtnX && clickX <= resumeBtnX + resumeBtnWidth &&
            clickY >= resumeBtnY && clickY <= resumeBtnY + resumeBtnHeight) {
            togglePause(); // Resume game
            return;
        }

        // Quit button
        const quitBtnWidth = 160;
        const quitBtnHeight = 36;
        const quitBtnX = (CONFIG.canvasWidth - quitBtnWidth) / 2;
        const quitBtnY = overlayY + 240;

        if (clickX >= quitBtnX && clickX <= quitBtnX + quitBtnWidth &&
            clickY >= quitBtnY && clickY <= quitBtnY + quitBtnHeight) {
            // Quit to menu
            returnToMenu();
            return;
        }
        return;
    }

    // Feature #13: Handle start screen clicks
    if (game.gameState === GAME_STATE.MENU) {
        const rect = game.canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        // Check if play button was clicked
        const btnWidth = 180;
        const btnHeight = 50;
        const btnX = (CONFIG.canvasWidth - btnWidth) / 2;
        const btnY = 380;

        if (clickX >= btnX && clickX <= btnX + btnWidth &&
            clickY >= btnY && clickY <= btnY + btnHeight) {
            console.log('Canvas PLAY button clicked!');
            // Start the game
            startGame();
            return;
        }

        // Settings button
        const settingsBtnWidth = 120;
        const settingsBtnHeight = 36;
        const settingsBtnX = (CONFIG.canvasWidth - settingsBtnWidth) / 2;
        const settingsBtnY = 445;

        if (clickX >= settingsBtnX && clickX <= settingsBtnX + settingsBtnWidth &&
            clickY >= settingsBtnY && clickY <= settingsBtnY + settingsBtnHeight) {
            // Open settings
            SoundManager.init();
            SettingsManager.toggle();
            return;
        }

        // Achievements button
        const achBtnWidth = 100;
        const achBtnHeight = 36;
        const achBtnX = 20;
        const achBtnY = 445;

        if (clickX >= achBtnX && clickX <= achBtnX + achBtnWidth &&
            clickY >= achBtnY && clickY <= achBtnY + achBtnHeight) {
            SoundManager.init();
            AchievementManager.toggle();
            return;
        }

        // Shop button
        const shopBtnWidth = 100;
        const shopBtnHeight = 36;
        const shopBtnX = CONFIG.canvasWidth - shopBtnWidth - 20;
        const shopBtnY = 445;

        if (clickX >= shopBtnX && clickX <= shopBtnX + shopBtnWidth &&
            clickY >= shopBtnY && clickY <= shopBtnY + shopBtnHeight) {
            SoundManager.init();
            ShopManager.toggle();
            return;
        }
    }

    // Feature #15: Handle level complete screen clicks
    if (game.gameState === GAME_STATE.WON) {
        const rect = game.canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        // Check if Next Level button was clicked
        const overlayWidth = 360;
        const overlayHeight = 340;
        const overlayX = (CONFIG.canvasWidth - overlayWidth) / 2;
        const overlayY = (CONFIG.canvasHeight - overlayHeight) / 2;
        const btnWidth = 200;
        const btnHeight = 45;
        const btnX = (CONFIG.canvasWidth - btnWidth) / 2;
        const btnY = overlayY + 260;

        if (clickX >= btnX && clickX <= btnX + btnWidth &&
            clickY >= btnY && clickY <= btnY + btnHeight) {
            // Next Level button clicked - play sound and advance
            SoundManager.play(659.25, 0.1, 'sine', 0.3);

            // Stop confetti
            stopConfetti();

            // Advance to next level
            game.level++;
            game.moves = ShopManager.getBonusMoves();
            game.targetScore = 1000 + (game.level - 1) * 500;
            console.log(`\n🚀 Starting Level ${game.level}! Target: ${game.targetScore}`);

            // Reset game state
            game.gameState = GAME_STATE.PLAYING;
            resetTimer();
            startTimer();

            // Reinitialize the grid
            game.gridManager.initialize();
            game.grid = game.gridManager.getGrid();
            game.selectedGem = null;
        }
        return;
    }

    // Feature #7: Handle game over/restart clicks
    if (game.gameState !== GAME_STATE.PLAYING) {
        // Stop any running timer
        stopTimer();
        
        if (game.gameState === GAME_STATE.WON) {
            // Advance to next level
            game.level++;
            game.moves = ShopManager.getBonusMoves();
            game.targetScore = 1000 + (game.level - 1) * 500;
            console.log(`\n🚀 Starting Level ${game.level}! Target: ${game.targetScore}`);
        } else {
            // Restart current level
            game.score = 0;
            game.moves = ShopManager.getBonusMoves();
            console.log(`\n🔄 Restarting Level ${game.level}. Target: ${game.targetScore}`);
        }

        // Reset game state
        game.gameState = GAME_STATE.PLAYING;
        game.isAnimating = false;
        game.selectedGem = null;
        resetTimer(); // Feature #14: Reset timer
        startTimer(); // Feature #14: Start timer for new level

        // Reinitialize the grid
        game.gridManager.initialize();
        game.grid = game.gridManager.getGrid();
        game.selectedGem = null;

        return;
    }

    const rect = game.canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Calculate grid position
    const gridX = clickX - CONFIG.gridOffsetX;
    const gridY = clickY - CONFIG.gridOffsetY;

    // Check if click is within grid bounds
    if (gridX < 0 || gridY < 0 || 
        gridX >= CONFIG.gridCols * CONFIG.gemSize || 
        gridY >= CONFIG.gridRows * CONFIG.gemSize) {
        // Click outside grid, deselect
        game.selectedGem = null;
        return;
    }

    const col = Math.floor(gridX / CONFIG.gemSize);
    const row = Math.floor(gridY / CONFIG.gemSize);

    const clickedGem = game.gridManager.getGem(row, col);

    if (!clickedGem) return;

    if (!game.selectedGem) {
        // First click - select the gem
        game.selectedGem = clickedGem;
        // Reset selection animation for fresh pulse
        selectionAnimation.startTime = performance.now();
        // Initialize audio context on first interaction
        SoundManager.init();
        // Play selection sound
        SoundManager.select();
    } else {
        // Second click - try to swap
        const selectedGem = game.selectedGem;

        // Check if clicking on the same gem (deselect)
        if (selectedGem.row === row && selectedGem.col === col) {
            game.selectedGem = null;
            return;
        }

        // Check if gems are adjacent (horizontally or vertically)
        const rowDiff = Math.abs(selectedGem.row - row);
        const colDiff = Math.abs(selectedGem.col - col);

        if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
            // Adjacent - perform swap with animation
            game.selectedGem = null;
            SoundManager.swap();
            swapGems(selectedGem, clickedGem);
        } else {
            // Not adjacent - select the new gem instead
            game.selectedGem = clickedGem;
            // Reset selection animation for fresh pulse
            selectionAnimation.startTime = performance.now();
        }
    }
}

/**
 * Swap two gems with smooth animation - Feature #8
 * Feature #19: Updated with combo system
 * Feature #20: Updated with power-up system
 */
async function swapGems(gem1, gem2) {
    // Prevent interaction during animation
    if (game.isAnimating) {
        console.log('Animation in progress, ignoring swap request');
        return;
    }

    game.isAnimating = true;

    // Feature #19: Reset combo at start of new move
    resetCombo();

    // Store original positions for grid update after animation
    const tempType = game.grid[gem1.row][gem1.col].type;
    const tempPowerUp = gem1.powerUpType;
    const tempRow = gem1.row;
    const tempCol = gem1.col;

    console.log(`🔄 Starting swap animation: (${gem1.row}, ${gem1.col}) ↔ (${gem2.row}, ${gem2.col})`);

    // Animate the swap
    await animateSwap(gem1, gem2);

    console.log(`✅ Swap animation complete`);

    // Update grid after animation
    game.grid[gem1.row][gem1.col].type = game.grid[gem2.row][gem2.col].type;
    game.grid[gem1.row][gem1.col].powerUpType = game.grid[gem2.row][gem2.col].powerUpType;
    game.grid[gem2.row][gem2.col].type = tempType;
    game.grid[gem2.row][gem2.col].powerUpType = tempPowerUp;

    // Update gem row/col properties
    gem1.row = gem2.row;
    gem1.col = gem2.col;
    gem2.row = tempRow;
    gem2.col = tempCol;

    // Update gem x/y positions to match new grid positions
    gem1.x = gem1.col * game.gridManager.gemSize;
    gem1.y = gem1.row * game.gridManager.gemSize;
    gem2.x = gem2.col * game.gridManager.gemSize;
    gem2.y = gem2.row * game.gridManager.gemSize;

    console.log(`Swapped gems at (${gem2.row}, ${gem2.col}) and (${gem1.row}, ${gem1.col})`);

    // Feature #20: Check if power-up was activated (swapped with another gem)
    let powerUpActivated = false;
    let powerUpGemsToClear = [];
    let powerUpGems = [gem1, gem2];

    for (const gem of powerUpGems) {
        if (gem.powerUpType !== POWERUP_TYPES.NONE) {
            console.log(`✨ Power-up activated at (${gem.row}, ${gem.col}): ${gem.powerUpType}`);
            powerUpActivated = true;
            const activatedGems = activatePowerUp(gem);
            powerUpGemsToClear.push(...activatedGems);
        }
    }

    // Check for matches after swap
    const matches = game.gridManager.findMatches();
    const allGemsToClear = [...powerUpGemsToClear];

    // Add matched gems to clear list (avoid duplicates)
    if (matches.length > 0) {
        const uniqueGems = game.gridManager.getMatchedGems();
        for (const gem of uniqueGems) {
            if (!allGemsToClear.includes(gem)) {
                allGemsToClear.push(gem);
            }
        }
    }

    // Process if there's something to clear (match or power-up)
    if (allGemsToClear.length > 0) {
        if (matches.length > 0) {
            console.log(`Match detected! Found ${matches.length} matched gems:`);
            matches.forEach((match, index) => {
                console.log(`  ${index + 1}. (${match.gem.row}, ${match.gem.col}) - ${match.direction} match of ${match.matchType}`);
            });

            const uniqueGems = game.gridManager.getMatchedGems();
            console.log(`Total unique gems to clear: ${uniqueGems.length}`);
        }

        // Feature #20: Play appropriate sound
        if (powerUpActivated) {
            // Power-up sound is played in activatePowerUp
        }
        // Play match sound for regular matches
        if (matches.length > 0 && !powerUpActivated) {
            SoundManager.match();
        }

        // Process the match cycle WITH animations - Feature #9
        console.log('\n--- Feature #9: Match Clear Animations ---');

        // Feature #20: Handle power-up creation from matches
        let powerUpsToCreate = [];
        if (matches.length > 0) {
            powerUpsToCreate = processPowerUpCreation(matches);
        }

        // Clear matched gems
        const cycleResult = await game.gridManager.animateMatchCycle();

        // Feature #20: Create power-ups if any were earned
        for (const pu of powerUpsToCreate) {
            // Check if position is empty (not already filled)
            if (game.grid[pu.row] && game.grid[pu.row][pu.col] === null) {
                const powerUpGem = createPowerUpGem(pu.row, pu.col, pu.type, pu.powerUpType);
                game.grid[pu.row][pu.col] = powerUpGem;
                console.log(`✨ Created ${pu.powerUpType} power-up at (${pu.row}, ${pu.col})`);
            }
        }

        if (cycleResult.processed) {
            console.log('Match cycle result:', cycleResult);
        }

        // Decrement moves after a successful match
        if (matches.length > 0) {
            game.moves--;
            console.log(`\nMoves remaining: ${game.moves}`);
        }

        // Check for cascade matches WITH animations
        let cascadeCount = 0;
        const totalCleared = await game.gridManager.animateCascade();
        if (totalCleared > 0) {
            // Play cascade sound for chain reactions
            SoundManager.cascade();
            console.log(`Animated cascade complete! Total gems cleared: ${totalCleared}`);

            // Feature #19: Increment combo on cascade
            cascadeCount = incrementCombo();

            // Bonus: Add more time for combos
            game.timer += cascadeCount > 1 ? cascadeCount : 1;
            console.log(`⏱️ Cascade bonus! +${cascadeCount > 1 ? cascadeCount : 1}s, Timer: ${game.timer}s`);
        }

        console.log('--- Feature #9: Complete ---\n');

        // Feature #19: Add score based on matches WITH combo multiplier
        // Feature #20: Bonus for power-up activation
        let baseScore = allGemsToClear.length * 10;
        const comboMultiplier = getComboMultiplier();
        let scoreGained = Math.floor(baseScore * comboMultiplier);

        // Bonus points for power-up activation
        if (powerUpActivated) {
            const powerUpBonus = powerUpGemsToClear.length * 5;
            scoreGained += powerUpBonus;
            console.log(`💥 Power-up bonus: +${powerUpBonus} points`);
        }

        game.score += scoreGained;

        if (game.comboCount > 1) {
            console.log(`🎯 Score gained: ${baseScore} × ${comboMultiplier.toFixed(1)} = ${scoreGained}, Total: ${game.score}`);
        } else {
            console.log(`🎯 Score gained: ${scoreGained}, Total score: ${game.score}`);
        }

        // Add 1 second to timer for successful match (combo adds more)
        game.timer += 1;
        console.log(`⏱️ +1 second bonus! Timer: ${game.timer}s`);

        // Feature #7: Check win/lose conditions
        checkGameState();
    } else if (powerUpActivated) {
        // Power-up activated but no match - still count as a move
        game.moves--;
        console.log(`\nMoves remaining: ${game.moves}`);

        // Feature #19: Increment combo on power-up activation
        incrementCombo();

        // Bonus: Add more time for power-ups
        game.timer += 2;
        console.log(`⏱️ Power-up bonus! +2s, Timer: ${game.timer}s`);

        // Check win/lose conditions
        checkGameState();
    } else {
        // No match - animate swap back
        console.log('No match detected, swapping back...');
        SoundManager.swapFail();
        await animateSwap(gem1, gem2);

        // Swap back in grid
        game.grid[gem1.row][gem1.col].type = game.grid[gem2.row][gem2.col].type;
        game.grid[gem1.row][gem1.col].powerUpType = game.grid[gem2.row][gem2.col].powerUpType;
        game.grid[gem2.row][gem2.col].type = tempType;
        game.grid[gem2.row][gem2.col].powerUpType = tempPowerUp;

        gem1.row = tempRow;
        gem1.col = tempCol;
        gem2.row = tempRow;
        gem2.col = tempCol;

        gem1.x = gem1.col * game.gridManager.gemSize;
        gem1.y = gem1.row * game.gridManager.gemSize;
        gem2.x = gem2.col * game.gridManager.gemSize;
        gem2.y = gem2.row * game.gridManager.gemSize;

        console.log('Swap back complete');
    }

    game.isAnimating = false;
}

/**
 * Initialize the game
 */
function init() {
    game.canvas = document.getElementById('game-canvas');
    game.ctx = game.canvas.getContext('2d');

    // Set canvas dimensions
    game.canvas.width = CONFIG.canvasWidth;
    game.canvas.height = CONFIG.canvasHeight;

    // Initialize the grid manager
    game.gridManager = new GridManager(CONFIG.gridRows, CONFIG.gridCols);
    // Feature #13: Grid initialized on first play, not at load time
    game.gridInitialized = false;

    // Add click event listener
    game.canvas.addEventListener('click', handleCanvasClick);

    // Add mouse move listener for hover effects
    game.canvas.addEventListener('mousemove', (event) => {
        const rect = game.canvas.getBoundingClientRect();
        game.lastMouseX = event.clientX - rect.left;
        game.lastMouseY = event.clientY - rect.top;
    });

    // Log initialization for debugging
    console.log('Three-in-a-Row Game initialized');
    console.log('Grid size:', CONFIG.gridRows, 'x', CONFIG.gridCols);
    console.log('Gem colors:', GEM_COLORS.length);
    console.log('Match detection enabled - Feature #5 implemented');
    console.log('Gem removal and grid refilling enabled - Feature #6 implemented');
    console.log('Win/lose conditions enabled - Feature #7 implemented');
    console.log('Smooth swap animations enabled - Feature #8 implemented');
    console.log('Match clear animations enabled - Feature #9 implemented');
    console.log('Gem falling animation enabled - Feature #10 implemented');
    console.log('Sound effects enabled - Feature #12 implemented');
    console.log('Start screen enabled - Feature #13 implemented');
    console.log('HUD with timer enabled - Feature #14 implemented');
    console.log('Level complete screen enabled - Feature #15 implemented');
    console.log('Game over screen enabled - Feature #16 implemented');
    console.log('Pause functionality enabled - Feature #17 implemented');
    console.log('Settings modal enabled - Feature #18 implemented');
    console.log('Combo system enabled - Feature #19 implemented');
    console.log('Power-ups enabled - Feature #20 implemented');
    console.log('  - 💣 Bomb gems: Match 4 to create, clears 3x3 area');
    console.log('  - 🎨 Color Clear gems: Match 5+ to create, clears all gems of one color');
    console.log('\n🎮 Click "PLAY" to start the game! 60 seconds on the clock!');
    console.log('Press ESC or P to pause the game');
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Feature #17: Pause toggle with ESC or P
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
            togglePause();
            return;
        }
        
        // Sound toggle with M
        if (e.key === 'm' || e.key === 'M') {
            SoundManager.init();
            SoundManager.toggle();
        }
    });

    // Initialize settings modal
    SettingsManager.init();
    
    // Initialize achievements and shop
    AchievementManager.init();
    ShopManager.init();

    // Set up overlay play button click handler
    const overlayBtn = document.getElementById('start-button-overlay');
    if (overlayBtn) {
        overlayBtn.addEventListener('click', function() {
            startGame();
        });
    }

    // Start the game loop
    gameLoop();
}

// Initialize the game when the page loads
window.addEventListener('load', init);
}
