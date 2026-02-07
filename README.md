# Three-in-a-Row

A match-3 puzzle game built with vanilla JavaScript and HTML5 Canvas.

**Repository:** https://github.com/0clique/three-in-a-row

## Quick Start
```bash
# Clone and run
git clone https://github.com/0clique/three-in-a-row.git
cd three-in-a-row
# Open index.html in browser
```

## Development

This project uses an automated orchestrator agent that runs every 30 minutes to:
1. Fix GitHub issues
2. Implement planned features
3. Update documentation

**Orchestrator Files (local only):**
- `.orchestrator/state.json` - Progress tracking
- `.orchestrator/feature-queue.md` - Feature roadmap
- `.orchestrator/orchestrator.md` - Agent instructions

## Game Features

### Phase 1: Core Game (MVP)
- 10x10 grid with 4-colored gems
- Swap mechanics (adjacent only)
- Match-3 detection (horizontal/vertical)
- Timer and level progression

### Phase 2: Animations & Polish
- Smooth gem swapping
- Match clearing animations
- Falling gem physics

### Phase 3: UI & Progression
- Start screen and menus
- HUD with level/score/timer
- Level complete and game over screens

### Phase 4: Bonus Features
- Combo system
- Power-ups
- Leaderboards
- Mobile touch controls

## Architecture

```
src/
├── entities/          # Gem, Bucket classes
├── systems/          # GridManager, MatchDetector, Timer, etc.
└── ui/               # HUD, Menu, Modal components
```

**No frameworks** - Vanilla JavaScript + HTML5 Canvas only.

---

Built with 🤖 by the Three-in-a-Row Orchestrator Agent
