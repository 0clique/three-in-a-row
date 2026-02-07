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
    moves: 30
};

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
 * Main game loop
 */
function gameLoop() {
    clearCanvas();
    drawHUD();
    drawGrid();
    drawSelection();

    requestAnimationFrame(gameLoop);
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

    // Log initialization for debugging
    console.log('Grid initialized with no matches:', !game.gridManager.hasMatches());
    console.log('Grid size:', CONFIG.gridRows, 'x', CONFIG.gridCols);
    console.log('Gem colors:', GEM_COLORS.length);

    // Start the game loop
    gameLoop();
}

/**
 * Handle click events on the game canvas
 */
function handleCanvasClick(event) {
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
            // Adjacent - perform swap
            swapGems(selectedGem, clickedGem);
            game.selectedGem = null;
        } else {
            // Not adjacent - select the new gem instead
            game.selectedGem = clickedGem;
        }
    }
}

/**
 * Swap two gems with animation flag
 */
function swapGems(gem1, gem2) {
    // Update grid positions in the grid array
    const tempType = game.grid[gem1.row][gem1.col].type;
    
    game.grid[gem1.row][gem1.col].type = game.grid[gem2.row][gem2.col].type;
    game.grid[gem2.row][gem2.col].type = tempType;

    // Update gem objects' positions
    const tempX = gem1.x;
    const tempY = gem1.y;
    
    gem1.x = gem2.x;
    gem1.y = gem2.y;
    gem2.x = tempX;
    gem2.y = tempY;

    // Update row/col properties
    const tempRow = gem1.row;
    const tempCol = gem1.col;
    gem1.row = gem2.row;
    gem1.col = gem2.col;
    gem2.row = tempRow;
    gem2.col = tempCol;

    console.log(`Swapped gems at (${gem2.row}, ${gem2.col}) and (${gem1.row}, ${gem1.col})`);
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

    // Add click event listener
    game.canvas.addEventListener('click', handleCanvasClick);

    // Log initialization for debugging
    console.log('Grid initialized with no matches:', !game.gridManager.hasMatches());
    console.log('Grid size:', CONFIG.gridRows, 'x', CONFIG.gridCols);
    console.log('Gem colors:', GEM_COLORS.length);
    console.log('Click handling enabled for gem selection and swapping');

    // Start the game loop
    gameLoop();
}

// Initialize the game when the page loads
window.addEventListener('load', init);
