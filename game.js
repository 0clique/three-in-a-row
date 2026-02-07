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

// Gem colors (4 colors as per requirements)
const GEM_COLORS = [
    '#e74c3c', // Red
    '#3498db', // Blue
    '#2ecc71', // Green
    '#f1c40f'  // Yellow
];

// Game state constants
const GAME_STATE = {
    PLAYING: 'playing',
    WON: 'won',
    LOST: 'lost'
};

// Game state
const game = {
    canvas: null,
    ctx: null,
    grid: [],
    gridManager: null,
    selectedGem: null,
    isAnimating: false,
    score: 0,
    level: 1,
    moves: 30,
    gameState: GAME_STATE.PLAYING,
    targetScore: 1000,
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
    FALL_DURATION: 150           // ms per cell for falling gems
};

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

    const x = gem.x + CONFIG.gridOffsetX + CONFIG.bucketPadding + CONFIG.gemPadding;
    const y = gem.y + CONFIG.gridOffsetY + CONFIG.bucketPadding + CONFIG.gemPadding;
    const size = CONFIG.gemSize - CONFIG.gemPadding * 2 - CONFIG.bucketPadding * 2;

    ctx.save();
    ctx.globalAlpha = gem.alpha;
    ctx.translate(x + size / 2, y + size / 2);
    ctx.scale(gem.scale, gem.scale);

    // Draw gem shape (rounded rectangle)
    ctx.fillStyle = colors[gem.type];
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 2, size, size, 8);
    ctx.fill();

    // Draw gem border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
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
function drawSelection() {
    if (game.selectedGem) {
        const ctx = game.ctx;
        const gem = game.selectedGem;

        const x = gem.x + CONFIG.gridOffsetX - 4;
        const y = gem.y + CONFIG.gridOffsetY - 4;
        const size = CONFIG.gemSize + 8;

        // Selection glow
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 10);
        ctx.stroke();

        ctx.shadowBlur = 0;
    }
}

/**
 * Draw game HUD
 */
function drawHUD() {
    const ctx = game.ctx;

    // HUD background
    ctx.fillStyle = CONFIG.bucketColor;
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.gridOffsetY - 10);

    // Level
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Level: ${game.level}`, 30, 35);

    // Score
    ctx.textAlign = 'center';
    ctx.fillText(`Score: ${game.score}`, CONFIG.canvasWidth / 2, 35);

    // Moves
    ctx.textAlign = 'right';
    ctx.fillText(`Moves: ${game.moves}`, CONFIG.canvasWidth - 30, 35);

    // Target score display
    ctx.textAlign = 'center';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(`Target: ${game.targetScore}`, CONFIG.canvasWidth / 2, 55);
}

/**
 * Check win/lose conditions
 */
function checkGameState() {
    // Check win condition
    if (game.score >= game.targetScore) {
        game.gameState = GAME_STATE.WON;
        console.log(`🎉 LEVEL COMPLETE! You reached ${game.score} points!`);
        return true;
    }

    // Check lose condition
    if (game.moves <= 0 && game.score < game.targetScore) {
        game.gameState = GAME_STATE.LOST;
        console.log(`💀 GAME OVER! Score: ${game.score}/${game.targetScore}`);
        return true;
    }

    return false;
}

/**
 * Draw game over overlay
 */
function drawGameOverOverlay() {
    const ctx = game.ctx;
    const overlayWidth = 300;
    const overlayHeight = 200;
    const x = (CONFIG.canvasWidth - overlayWidth) / 2;
    const y = (CONFIG.canvasHeight - overlayHeight) / 2;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    // Modal background
    ctx.fillStyle = CONFIG.bucketColor;
    ctx.beginPath();
    ctx.roundRect(x, y, overlayWidth, overlayHeight, 12);
    ctx.fill();
    ctx.strokeStyle = CONFIG.bucketBorderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Title
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CONFIG.canvasWidth / 2, y + 60);

    // Score display
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.fillText(`Final Score: ${game.score}`, CONFIG.canvasWidth / 2, y + 100);
    ctx.fillText(`Target: ${game.targetScore}`, CONFIG.canvasWidth / 2, y + 130);

    // Restart hint
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '16px Arial';
    ctx.fillText('Click to restart', CONFIG.canvasWidth / 2, y + 170);
}

/**
 * Draw level complete overlay
 */
function drawLevelCompleteOverlay() {
    const ctx = game.ctx;
    const overlayWidth = 320;
    const overlayHeight = 220;
    const x = (CONFIG.canvasWidth - overlayWidth) / 2;
    const y = (CONFIG.canvasHeight - overlayHeight) / 2;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    // Modal background
    ctx.fillStyle = CONFIG.bucketColor;
    ctx.beginPath();
    ctx.roundRect(x, y, overlayWidth, overlayHeight, 12);
    ctx.fill();
    ctx.strokeStyle = CONFIG.bucketBorderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Title
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL COMPLETE!', CONFIG.canvasWidth / 2, y + 60);

    // Score display
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.fillText(`Final Score: ${game.score}`, CONFIG.canvasWidth / 2, y + 110);
    ctx.fillText(`Target: ${game.targetScore}`, CONFIG.canvasWidth / 2, y + 140);

    // Restart hint
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '16px Arial';
    ctx.fillText('Click to continue to next level', CONFIG.canvasWidth / 2, y + 180);
}

/**
 * Draw overlays based on game state
 */
function drawOverlays() {
    if (game.gameState === GAME_STATE.WON) {
        drawLevelCompleteOverlay();
    } else if (game.gameState === GAME_STATE.LOST) {
        drawGameOverOverlay();
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
    drawHUD();
    drawGrid();
    drawSelection();
    drawOverlays();

    // Process any active animations
    processAnimations();

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

    // Feature #7: Handle game over/restart clicks
    if (game.gameState !== GAME_STATE.PLAYING) {
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
            swapGems(selectedGem, clickedGem);
        } else {
            // Not adjacent - select the new gem instead
            game.selectedGem = clickedGem;
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
    game.gridManager.initialize();
    game.grid = game.gridManager.getGrid();

    // Set initial target score
    game.targetScore = 1000;

    // Add click event listener
    game.canvas.addEventListener('click', handleCanvasClick);

    // Log initialization for debugging
    console.log('Grid initialized with no matches:', !game.gridManager.hasMatches());
    console.log('Grid size:', CONFIG.gridRows, 'x', CONFIG.gridCols);
    console.log('Gem colors:', GEM_COLORS.length);
    console.log('Match detection enabled - Feature #5 implemented');
    console.log('Gem removal and grid refilling enabled - Feature #6 implemented');
    console.log('Win/lose conditions enabled - Feature #7 implemented');
    console.log('Smooth swap animations enabled - Feature #8 implemented');
    console.log('Match clear animations enabled - Feature #9 implemented');
    console.log('Gem falling animation enabled - Feature #10 implemented');
    console.log('Target score:', game.targetScore);
    console.log('Click handling enabled for gem selection and swapping');

    // Start the game loop
    gameLoop();
}

// Initialize the game when the page loads
window.addEventListener('load', init);
