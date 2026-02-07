/**
 * Three-in-a-Row Game
 * A match-3 puzzle game built with vanilla JavaScript and HTML5 Canvas
 */

// Game configuration
const CONFIG = {
    canvasWidth: 480,
    canvasHeight: 640,
    gridRows: 8,
    gridCols: 6,
    gemSize: 64,
    gemPadding: 4,
    backgroundColor: '#16213e'
};

// Game state
const game = {
    canvas: null,
    ctx: null,
    grid: [],
    selectedGem: null,
    isAnimating: false,
    score: 0,
    level: 1,
    moves: 30
};

/**
 * Initialize the game
 */
function init() {
    game.canvas = document.getElementById('game-canvas');
    game.ctx = game.canvas.getContext('2d');
    
    // Set canvas dimensions
    game.canvas.width = CONFIG.canvasWidth;
    game.canvas.height = CONFIG.canvasHeight;
    
    // Initialize the grid
    initGrid();
    
    // Start the game loop
    gameLoop();
}

/**
 * Initialize the game grid with random gems
 */
function initGrid() {
    game.grid = [];
    
    for (let row = 0; row < CONFIG.gridRows; row++) {
        game.grid[row] = [];
        for (let col = 0; col < CONFIG.gridCols; col++) {
            game.grid[row][col] = {
                type: getRandomGemType(),
                x: col * CONFIG.gemSize,
                y: row * CONFIG.gemSize,
                row: row,
                col: col,
                alpha: 1
            };
        }
    }
}

/**
 * Get a random gem type (0-5 representing different colors)
 */
function getRandomGemType() {
    return Math.floor(Math.random() * 6);
}

/**
 * Draw a single gem
 */
function drawGem(gem) {
    const ctx = game.ctx;
    const colors = [
        '#e74c3c', // Red
        '#3498db', // Blue
        '#2ecc71', // Green
        '#f1c40f', // Yellow
        '#9b59b6', // Purple
        '#e67e22'  // Orange
    ];
    
    const x = gem.x + CONFIG.gemPadding;
    const y = gem.y + CONFIG.gemPadding;
    const size = CONFIG.gemSize - CONFIG.gemPadding * 2;
    
    ctx.save();
    ctx.globalAlpha = gem.alpha;
    
    // Draw gem background (rounded rectangle)
    ctx.fillStyle = colors[gem.type];
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 8);
    ctx.fill();
    
    // Draw gem highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, size - 8, size / 2, 4);
    ctx.fill();
    
    ctx.restore();
}

/**
 * Draw the game grid
 */
function drawGrid() {
    for (let row = 0; row < CONFIG.gridRows; row++) {
        for (let col = 0; col < CONFIG.gridCols; col++) {
            drawGem(game.grid[row][col]);
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
        const x = gem.x + CONFIG.gemPadding - 2;
        const y = gem.y + CONFIG.gemPadding - 2;
        const size = CONFIG.gemSize - CONFIG.gemPadding * 2 + 4;
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 10);
        ctx.stroke();
    }
}

/**
 * Clear the canvas
 */
function clearCanvas() {
    game.ctx.fillStyle = CONFIG.backgroundColor;
    game.ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
}

/**
 * Main game loop
 */
function gameLoop() {
    clearCanvas();
    drawGrid();
    drawSelection();
    
    requestAnimationFrame(gameLoop);
}

// Initialize the game when the page loads
window.addEventListener('load', init);
