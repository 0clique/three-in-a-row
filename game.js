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
    swapInProgress: null
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

// Sound Manager - Feature #12: Sound Effects
const SoundManager = {
    audioContext: null,
    enabled: true,
    masterVolume: 0.3,
    
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
            
            // Apply master volume
            const vol = volume !== null ? volume : this.masterVolume;
            gainNode.gain.setValueAtTime(vol, this.audioContext.currentTime);
            
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
    
    toggle() {
        this.enabled = !this.enabled;
        console.log('Sound effects:', this.enabled ? 'enabled' : 'disabled');
        return this.enabled;
    }
};

// Selection animation state
const selectionAnimation = {
    active: false,
    startTime: 0,
    pulsePhase: 0
};

/**
 * Timer System - Feature #14: HUD with level, score, timer
 */

// Start the countdown timer
function startTimer() {
    stopTimer(); // Clear any existing timer
    game.timer = 60; // Reset to 60 seconds
    
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
    game.timer = 60;
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
    const elapsed = currentTime - animation.startTime;
    const progress = Math.min(elapsed / animation.duration, 1);
    const easedProgress = easeInOutQuad(progress);

    if (animation.type === 'swap') {
        // Animate gem1 from start to end position
        animation.gem1.x = lerp(animation.startX1, animation.endX1, easedProgress);
        animation.gem1.y = lerp(animation.startY1, animation.endY1, easedProgress);

        // Animate gem2 from start to end position
        animation.gem2.x = lerp(animation.startX2, animation.endX2, easedProgress);
        animation.gem2.y = lerp(animation.startY2, animation.endY2, easedProgress);
    }

    return progress >= 1;
}

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
     */
    createGem(row, col, type) {
        return {
            type: type,
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
     * Swap two gems
     */
    swapGems(gem1, gem2) {
        const tempType = gem1.type;
        const tempX = gem1.x;
        const tempY = gem1.y;

        gem1.type = gem2.type;
        gem1.x = gem2.x;
        gem1.y = gem2.y;

        gem2.type = tempType;
        gem2.x = tempX;
        gem2.y = tempY;
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
 */
function drawGem(gem) {
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
    ctx.fillText('PLAY', CONFIG.canvasWidth / 2, btnY + 33);

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
    const progressFill = Math.max(5, progressWidth * progress);
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
 * Main game loop - now with animation processing
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
    // Feature #8: Prevent interaction during animations
    if (game.isAnimating) {
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
            game.gameState = GAME_STATE.MENU;
            game.isPaused = false;
            stopTimer();
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
            // Start the game
            game.gameState = GAME_STATE.PLAYING;
            game.score = 0;
            game.level = 1;
            game.moves = 30;
            game.targetScore = 1000;
            resetTimer(); // Feature #14: Reset timer on new game
            startTimer(); // Feature #14: Start the timer

            // Initialize grid if not already done
            if (!game.gridInitialized) {
                game.gridManager.initialize();
                game.grid = game.gridManager.getGrid();
                game.gridInitialized = true;
            }

            console.log('\n🎮 Starting game! Level 1 - Target: 1000 points - Time: 60 seconds');
        }
        return;
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
            game.moves = 30;
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
            game.moves = 30;
            game.targetScore = 1000 + (game.level - 1) * 500;
            console.log(`\n🚀 Starting Level ${game.level}! Target: ${game.targetScore}`);
        } else {
            // Restart current level
            game.score = 0;
            game.moves = 30;
            console.log(`\n🔄 Restarting Level ${game.level}. Target: ${game.targetScore}`);
        }

        // Reset game state
        game.gameState = GAME_STATE.PLAYING;
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
 */
async function swapGems(gem1, gem2) {
    // Prevent interaction during animation
    if (game.isAnimating) {
        console.log('Animation in progress, ignoring swap request');
        return;
    }

    game.isAnimating = true;

    // Store original positions for grid update after animation
    const tempType = game.grid[gem1.row][gem1.col].type;
    const tempRow = gem1.row;
    const tempCol = gem1.col;

    console.log(`🔄 Starting swap animation: (${gem1.row}, ${gem1.col}) ↔ (${gem2.row}, ${gem2.col})`);

    // Animate the swap
    await animateSwap(gem1, gem2);

    console.log(`✅ Swap animation complete`);

    // Update grid after animation
    game.grid[gem1.row][gem1.col].type = game.grid[gem2.row][gem2.col].type;
    game.grid[gem2.row][gem2.col].type = tempType;

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

    // Check for matches after swap
    const matches = game.gridManager.findMatches();
    if (matches.length > 0) {
        console.log(`Match detected! Found ${matches.length} matched gems:`);
        matches.forEach((match, index) => {
            console.log(`  ${index + 1}. (${match.gem.row}, ${match.gem.col}) - ${match.direction} match of ${match.matchType}`);
        });

        const uniqueGems = game.gridManager.getMatchedGems();
        console.log(`Total unique gems to clear: ${uniqueGems.length}`);
        
        // Play match sound
        SoundManager.match();
        
        // Process the match cycle WITH animations - Feature #9
        console.log('\n--- Feature #9: Match Clear Animations ---');
        const cycleResult = await game.gridManager.animateMatchCycle();

        if (cycleResult.processed) {
            console.log('Match cycle result:', cycleResult);
        }

        // Decrement moves after a successful match
        game.moves--;
        console.log(`\nMoves remaining: ${game.moves}`);

        // Check for cascade matches WITH animations
        const totalCleared = await game.gridManager.animateCascade();
        if (totalCleared > 0) {
            // Play cascade sound for chain reactions
            SoundManager.cascade();
            console.log(`Animated cascade complete! Total gems cleared: ${totalCleared}`);
        }

        console.log('--- Feature #9: Complete ---\n');

        // Feature #7: Add score based on matches
        const scoreGained = uniqueGems.length * 10;
        game.score += scoreGained;
        console.log(`🎯 Score gained: ${scoreGained}, Total score: ${game.score}`);

        // Feature #7: Check win/lose conditions
        checkGameState();
    } else {
        // No match - animate swap back
        console.log('No match detected, swapping back...');
        SoundManager.swapFail();
        await animateSwap(gem1, gem2);

        // Swap back in grid
        game.grid[gem1.row][gem1.col].type = game.grid[gem2.row][gem2.col].type;
        game.grid[gem2.row][gem2.col].type = tempType;

        gem1.row = tempRow;
        gem1.col = tempCol;
        gem2.row = gem2.row;
        gem2.col = gem2.col;

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

    // Start the game loop
    gameLoop();
}

// Initialize the game when the page loads
window.addEventListener('load', init);
