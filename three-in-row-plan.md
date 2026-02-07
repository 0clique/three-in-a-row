# 3-in-a-Row Game - Comprehensive Project Plan

**Version:** 1.0
**Date:** February 7, 2026
**Status:** Planning Phase

---

## 1. Project Overview

### 1.1 Game Description
A match-3 puzzle game where players swap gems to create matches of 3 or more gems of the same color in a row (horizontal or vertical). The goal is to complete a set number of matches within a time limit to advance to the next level.

### 1.2 Core Mechanics
- **Grid:** 10x10 playing field with square cells (buckets)
- **Pieces:** Round gems in 4 colors (green, yellow, red, blue)
- **Movement:** Swap adjacent gems (no diagonal)
- **Matching:** 3+ gems of same color in a row (horizontal/vertical)
- **Goal:** Complete X matches within time limit
- **Progression:** Each level increases difficulty

### 1.3 Technology Stack
- **Frontend:** Vanilla JavaScript, HTML5 Canvas
- **UI:** HTML/CSS overlays
- **No frameworks** (intentionally lightweight)
- **Platform:** Browser-based

---

## 2. Game Architecture

### 2.1 Core Components

```
src/
├── index.html              # Entry point, canvas, UI markup
├── style.css              # All styling
├── game.js                # Main game engine
├── constants.js           # Game constants (grid size, colors, etc.)
├── utils/
│   └── rng.js             # Random number generation
├── entities/
│   ├── Gem.js             # Gem class
│   └── Bucket.js          # Bucket (cell) class
├── systems/
│   ├── GridManager.js     # 10x10 grid management
│   ├── MatchDetector.js   # Match detection (3+ in row)
│   ├── InputHandler.js    # Mouse/touch input
│   ├── Animation.js       # Gem animations (swap, fall, clear)
│   ├── GameState.js       # State management
│   ├── LevelManager.js    # Level progression
│   ├── Timer.js          # Time limit tracking
│   └── ScoreManager.js   # Scoring system
└── ui/
    ├── HUD.js            # Heads-up display
    ├── Menu.js           # Main/splash/pause menus
    └── Modal.js          # Level complete, game over
```

### 2.2 File Structure

```
three-in-row/
├── index.html
├── style.css
├── game.js
├── constants.js
└── src/
    ├── entities/
    │   ├── Gem.js
    │   └── Bucket.js
    ├── systems/
    │   ├── GridManager.js
    │   ├── MatchDetector.js
    │   ├── InputHandler.js
    │   ├── Animation.js
    │   ├── GameState.js
    │   ├── LevelManager.js
    │   ├── Timer.js
    │   └── ScoreManager.js
    └── ui/
        ├── HUD.js
        ├── Menu.js
        └── Modal.js
```

---

## 3. Game Design Specifications

### 3.1 Grid System

| Parameter | Value | Notes |
|-----------|-------|-------|
| Grid Size | 10x10 | 100 buckets total |
| Bucket Size | 50px | Recommended, adjustable |
| Total Board | 500x500px | Canvas size |
| Gem Size | 40px | Slightly smaller than bucket |
| Gem Colors | 4 | Green, Yellow, Red, Blue |
| Initial Gems | 100 | One per bucket |

### 3.2 Gem Colors

| Color | Hex Code | Visual |
|-------|----------|--------|
| Green | #22C55E | Emerald |
| Yellow | #EAB308 | Gold |
| Red | #EF4444 | Ruby |
| Blue | #3B82F6 | Sapphire |

### 3.3 Game Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    GAME START                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────────────────┐   │
│  │ Title   │ → │ Level   │ → │   GAMEPLAY LOOP     │   │
│  │ Screen  │   │ Intro   │   │                     │   │
│  └─────────┘   └─────────┘   │  1. Wait for input  │   │
│                               │  2. Select gem      │   │
│                               │  3. Swap gems        │   │
│                               │  4. Check match      │   │
│                               │  5. If match: clear  │   │
│                               │  6. Drop gems down   │   │
│                               │  7. Fill empty       │   │
│                               │  8. Repeat 4-7      │   │
│                               └─────────────────────┘   │
│                                     │                     │
│                    ┌────────────────┼────────────────┐  │
│                    ▼                ▼                ▼  │
│            ┌──────────────┐  ┌──────────────┐ ┌─────────┐│
│            │  Goal Met!   │  │   Time's Up! │ │ Pause   ││
│            │ Level Complete│  │  Game Over  │ │ (ESC)   ││
│            └──────────────┘  └──────────────┘ └─────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Core Systems

### 4.1 GridManager

**Responsibilities:**
- Initialize 10x10 grid with gems
- Manage gem positions (x, y coordinates)
- Handle gem movement (swapping)
- Track empty buckets after matches

**Data Structure:**
```javascript
class GridManager {
    constructor(rows = 10, cols = 10) {
        this.rows = rows;
        this.cols = cols;
        this.grid = []; // 2D array [row][col]
        this.emptyCells = []; // Track cells that need filling
    }

    // Methods
    initialize()        // Fill grid with random gems
    getGem(row, col)    // Get gem at position
    setGem(row, col, gem) // Set gem at position
    swap(gem1, gem2)    // Swap two gems
    remove(gem)         // Remove gem from grid
    isValid(row, col)   // Check if position is valid
    getNeighbors(row, col) // Get adjacent cells (non-diagonal)
}
```

### 4.2 MatchDetector

**Responsibilities:**
- Scan grid for matches of 3+ gems
- Identify horizontal and vertical matches
- Return matched gems for removal

**Algorithm:**
```javascript
class MatchDetector {
    findMatches(grid) {
        const matches = {
            horizontal: [], // Arrays of gem positions
            vertical: []
        };

        // Check horizontal (row by row)
        for (let row = 0; row < grid.rows; row++) {
            const rowMatches = this.scanRow(grid, row);
            matches.horizontal.push(...rowMatches);
        }

        // Check vertical (column by column)
        for (let col = 0; col < grid.cols; col++) {
            const colMatches = this.scanColumn(grid, col);
            matches.vertical.push(...colMatches);
        }

        // Combine and deduplicate
        return this.combineMatches(matches);
    }

    scanRow(grid, row) {
        let match = [];
        for (let col = 0; col < grid.cols; col++) {
            if (match.length === 0) {
                match.push(grid[row][col]);
            } else if (grid[row][col].color === match[0].color) {
                match.push(grid[row][col]);
            } else {
                if (match.length >= 3) return [match];
                match = [grid[row][col]];
            }
        }
        return match.length >= 3 ? [match] : [];
    }
}
```

### 4.3 InputHandler

**Input Types:**
- Mouse click/touch to select gem
- Click adjacent bucket to swap
- Keyboard: ESC for pause

**Selection Logic:**
1. First click: Highlight selected gem
2. Second click:
   - If adjacent: Swap gems
   - If same gem: Deselect
   - If non-adjacent: Select new gem

**Visual Feedback:**
- Selected gem: Border highlight or glow
- Valid moves: Highlight adjacent buckets
- Invalid moves: Shake animation or red flash

### 4.4 Animation System

**Required Animations:**
1. **Swap Animation** - Smooth movement when swapping gems
2. **Match Animation** - Scale down or explode when clearing
3. **Fall Animation** - Gems fall to fill empty spaces
4. **Fill Animation** - New gems fade in at top

**Timing:**
| Animation | Duration |
|-----------|----------|
| Swap | 200ms |
| Match Clear | 300ms |
| Fall | 150ms per cell |
| Fill | 200ms |

### 4.5 Timer System

**Features:**
- Countdown timer per session
- Visual progress bar
- Warning at low time (last 10 seconds)
- Time bonus for combos (optional)

**Default Settings:**
| Level | Time Limit | Goal (Matches) |
|-------|------------|----------------|
| 1 | 120 seconds | 5 matches |
| 2 | 100 seconds | 7 matches |
| 3 | 90 seconds | 10 matches |
| 4+ | 60 seconds | 12 matches |

### 4.6 Level Manager

**Progression System:**
```javascript
class LevelManager {
    constructor() {
        this.currentLevel = 1;
        this.goal = 5;           // Matches needed
        this.matchesCompleted = 0;
        this.timeLimit = 120;    // Seconds
    }

    levelUp() {
        this.currentLevel++;
        this.goal = Math.min(5 + (this.currentLevel * 2), 20);
        this.timeLimit = Math.max(120 - (this.currentLevel * 10), 60);
        this.matchesCompleted = 0;
    }

    addMatch() {
        this.matchesCompleted++;
        if (this.matchesCompleted >= this.goal) {
            return this.levelUp();
        }
        return false; // Level not complete
    }
}
```

---

## 5. Scoring System

### 5.1 Points

| Action | Points |
|--------|--------|
| Match 3 gems | 100 |
| Match 4 gems | 200 |
| Match 5+ gems | 500 |
| Time bonus | (Remaining seconds) × 2 |
| Level complete bonus | Level × 500 |

### 5.2 Combo System (Optional)

- Chain reactions from falling gems give bonus multiplier
- Each subsequent match in chain: ×1.5 multiplier

---

## 6. User Interface

### 6.1 Start Screen

```
┌─────────────────────────────────────┐
│                                     │
│         🎮 THREE IN A ROW 🎮        │
│                                     │
│      [ START GAME ]                 │
│                                     │
│      [ HOW TO PLAY ]                │
│                                     │
│      [ SETTINGS ]                   │
│                                     │
└─────────────────────────────────────┘
```

### 6.2 HUD (During Gameplay)

```
┌─────────────────────────────────────────────────────┐
│  LEVEL: 3    GOAL: 7/10    ⏱️  1:45    SCORE: 2500 │
├─────────────────────────────────────────────────────┤
│                                                     │
│   ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐                            │
│   │●│ │●│ │●│ │ │ │ │ │                            │
│   ├─┼─┼─┼─┼─┼─┼─┼─┼─┼─┤                            │
│   │ │●│ │ │●│ │ │ │ │●│                            │
│   ├─┼─┼─┼─┼─┼─┼─┼─┼─┼─┤                            │
│   │ │ │●│ │ │●│ │ │●│ │                            │
│   ├─┼─┼─┼─┼─┼─┼─┼─┼─┼─┤                            │
│   │ │ │ │●│●│ │●│ │ │ │                            │
│   ├─┼─┼─┼─┼─┼─┼─┼─┼─┼─┤                            │
│   │ │ │ │ │ │ │ │ │●│ │                            │
│   ├─┼─┼─┼─┼─┼─┼─┼─┼─┼─┤                            │
│   │ │ │ │ │ │ │ │ │ │ │                            │
│   └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘                            │
│                                                     │
│   [ESC] Pause                                       │
└─────────────────────────────────────────────────────┘
```

### 6.3 Level Complete Screen

```
┌─────────────────────────────────────┐
│                                     │
│        ✨ LEVEL COMPLETE! ✨         │
│                                     │
│      Score: 3,750                  │
│      Time: 1:15 remaining           │
│      Bonus: 1,500                   │
│                                     │
│      TOTAL SCORE: 5,250             │
│                                     │
│      [ NEXT LEVEL ]                 │
│                                     │
└─────────────────────────────────────┘
```

### 6.4 Game Over Screen

```
┌─────────────────────────────────────┐
│                                     │
│          💀 GAME OVER 💀            │
│                                     │
│      Final Score: 2,800             │
│      Level Reached: 3               │
│      Matches Made: 18                │
│                                     │
│      [ TRY AGAIN ]                  │
│                                     │
└─────────────────────────────────────┘
```

---

## 7. Implementation Phases

### Phase 1: Core Game (MVP)
- [ ] Basic HTML structure with Canvas
- [ ] Grid initialization with gems
- [ ] Basic rendering (no animations)
- [ ] Gem selection and swapping
- [ ] Match detection (3+ in row)
- [ ] Gem removal and grid refilling
- [ ] Win/lose conditions

**Duration:** 2-3 hours

### Phase 2: Animations & Polish
- [ ] Smooth swap animations
- [ ] Match clear animations
- [ ] Gem falling animation
- [ ] Visual feedback for selection
- [ ] Sound effects (optional)

**Duration:** 2-3 hours

### Phase 3: UI & Progression
- [ ] Start screen
- [ ] HUD with level, score, timer
- [ ] Level complete screen
- [ ] Game over screen
- [ ] Pause functionality
- [ ] Settings menu

**Duration:** 2-3 hours

### Phase 4: Bonus Features (Optional)
- [ ] Combo system
- [ ] Power-ups (bomb gem, color clear)
- [ ] Special gems (4-match creates super gem)
- [ ] Leaderboards
- [ ] Daily challenges
- [ ] Mobile touch controls

**Duration:** 4-8 hours

---

## 8. Technical Implementation Details

### 8.1 Constants

```javascript
// constants.js
const GRID_SIZE = 10;
const GEM_SIZE = 40;
const BUCKET_SIZE = 50;
const PADDING = 5;
const CANVAS_SIZE = GRID_SIZE * BUCKET_SIZE;

const COLORS = {
    GREEN: '#22C55E',
    YELLOW: '#EAB308',
    RED: '#EF4444',
    BLUE: '#3B82F6'
};

const ANIMATION_DURATION = {
    SWAP: 200,
    CLEAR: 300,
    FALL: 150,
    FILL: 200
};

const LEVEL_CONFIG = [
    { timeLimit: 120, goal: 5 },    // Level 1
    { timeLimit: 100, goal: 7 },   // Level 2
    { timeLimit: 90, goal: 10 },   // Level 3
    { timeLimit: 80, goal: 12 },   // Level 4
    { timeLimit: 60, goal: 15 },   // Level 5+
];
```

### 8.2 Gem Entity

```javascript
// entities/Gem.js
class Gem {
    constructor(color, row, col) {
        this.color = color;
        this.row = row;
        this.col = col;
        this.x = col * BUCKET_SIZE;
        this.y = row * BUCKET_SIZE;
        this.selected = false;
        this.matched = false;
        this.animationOffset = 0;
    }

    draw(ctx) {
        if (this.matched) return;

        const centerX = this.x + BUCKET_SIZE / 2;
        const centerY = this.y + BUCKET_SIZE / 2;
        const radius = GEM_SIZE / 2;

        // Draw gem
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        // Selection highlight
        if (this.selected) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // Shine effect
        ctx.beginPath();
        ctx.arc(centerX - radius/3, centerY - radius/3, radius/4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
    }
}
```

### 8.3 Main Game Loop

```javascript
// game.js
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.gridManager = new GridManager();
        this.matchDetector = new MatchDetector();
        this.inputHandler = new InputHandler(this);
        this.levelManager = new LevelManager();
        this.timer = new Timer();
        this.scoreManager = new ScoreManager();
        this.animation = new Animation(this);

        this.state = 'MENU'; // MENU, PLAYING, ANIMATING, PAUSED, LEVEL_COMPLETE, GAME_OVER
    }

    start() {
        this.state = 'PLAYING';
        this.levelManager.startLevel(1);
        this.gridManager.initialize();
        this.timer.start(this.levelManager.timeLimit);
        this.gameLoop();
    }

    gameLoop() {
        if (this.state === 'MENU') return;

        this.update();
        this.render();

        requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        if (this.state !== 'PLAYING' && this.state !== 'ANIMATING') return;

        this.timer.update();
        if (this.timer.isExpired()) {
            this.state = 'GAME_OVER';
        }
    }

    render() {
        this.ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        this.gridManager.render(this.ctx);
        // ... render UI overlays
    }

    handleSwap(gem1, gem2) {
        this.state = 'ANIMATING';
        
        this.animation.animateSwap(gem1, gem2, () => {
            this.gridManager.swap(gem1, gem2);
            
            const matches = this.matchDetector.findMatches(this.gridManager.grid);
            if (matches.length > 0) {
                this.handleMatches(matches);
            } else {
                // Swap back if no match
                this.animation.animateSwap(gem1, gem2, () => {
                    this.gridManager.swap(gem1, gem2);
                    this.state = 'PLAYING';
                });
            }
        });
    }

    handleMatches(matches) {
        // Score matches
        this.scoreManager.addPoints(matches);

        // Clear matched gems
        matches.forEach(gem => gem.matched = true);

        this.animation.animateClear(matches, () => {
            this.gridManager.removeMatched(matches);
            this.animation.animateFall(() => {
                this.gridManager.fillEmpty();
                this.animation.animateFill(() => {
                    // Check for chain reactions
                    const newMatches = this.matchDetector.findMatches(this.gridManager.grid);
                    if (newMatches.length > 0) {
                        this.handleMatches(newMatches);
                    } else {
                        this.state = 'PLAYING';
                        this.checkLevelComplete();
                    }
                });
            });
        });
    }
}
```

---

## 9. Testing Plan

### 9.1 Unit Tests

| Component | Test Cases |
|-----------|------------|
| MatchDetector | Horizontal 3-match, Vertical 4-match, L-shape, No match |
| GridManager | Swap boundary, Invalid position, Empty cell |
| Timer | Expiration, Pause/Resume |
| LevelManager | Progression, Goal tracking |

### 9.2 Integration Tests

| Scenario | Expected Result |
|----------|----------------|
| Swap creates match | Gems clear, new gems fall |
| Swap no match | Gems swap back |
| Chain reaction | Multiple clears cascade |
| Timer expires | Game over state |
| Goal reached | Level complete state |

### 9.3 Manual Tests

| Test | Description |
|------|-------------|
| Selection | Click gem → Highlight |
| Swap valid | Click adjacent → Swap |
| Swap invalid | Click distant → Select new |
| Match 3 | Three same-color in row → Clear |
| Match 4 | Four same-color in row → Clear + bonus |
| Timer | Countdown works, zero → Game over |
| Level up | Goal reached → Next level |

---

## 10. Future Extensions

### 10.1 Power-ups

| Power-up | Trigger | Effect |
|----------|---------|--------|
| Bomb | Match 4 | Clees 3×3 area |
| Rainbow | Match 5 | Clears all of one color |
| Line | Create T/L shape | Clears row and column |

### 10.2 Visual Themes

- Default: Classic gems
- Halloween: Orange/purple pumpkins
- Christmas: Red/green ornaments
- Valentine: Pink/red hearts

### 10.3 Game Modes

- **Timed:** As implemented
- **Moves:** Limited swaps, no timer
- **Endless:** No timer, goal increases slowly
- **Zen:** No timer, no score, relaxing

---

## 11. Estimated Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 | 3 hours | Playable core game |
| Phase 2 | 3 hours | Smooth animations |
| Phase 3 | 3 hours | Full UI |
| Phase 4 | 8 hours | Bonus features |
| **Total** | **17 hours** | Complete game |

---

## 12. Open Questions

1. **Should matches be required to be exactly 3, or 3+?** → Plan says 3+ (matches of 4 and 5 give bonus)
2. **Should diagonal swaps be allowed?** → Plan says NO (adjacent only, non-diagonal)
3. **What happens with initial matches?** → Should clear them without counting toward goal
4. **Should gems fall instantly or animate?** → Plan says animate for better feel
5. **Should there be special gems?** → Optional Phase 4 feature

---

*This document will be updated as development progresses.*
