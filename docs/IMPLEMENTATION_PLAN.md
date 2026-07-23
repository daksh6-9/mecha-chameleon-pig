```markdown
# 🛠️ Step-by-Step Implementation Plan

## Phase 1: Model Resizing & Home UI Expansion
- [ ] Reduce Pig mesh geometry box bounds in `createCyberPigSoldier()` to create a slimmer pig model.
- [ ] Add the 3rd **"PLAY VS BOTS (10-20 AI)"** button to `index.html` and `style.css`.

## Phase 2: The Waiting Room & Hunter Step Engine
- [ ] Build the 4-wall Waiting Room scene in `renderer.js` with the front Scoreboard wall and title wall.
- [ ] Implement the elevated central "Hunter Step" box.
- [ ] Add server-side 30-second countdown logic and step intersection checks to assign the Hunter.

## Phase 3: RGB Spray Painter (Replacing Camo Toggle)
- [ ] Replace `C` key camouflage opacity toggle with an RGB Color Picker HUD overlay.
- [ ] Implement 3D canvas/raycast eyedropper tool to sample world colors and apply hex colors to the pig's material.

## Phase 4: Wall Adhesion Mechanics
- [ ] Add horizontal raycasting to detect nearby vertical wall structures when the player jumps.
- [ ] Bind a wall-stick constraint that sets gravity velocity to zero while latched to a wall plane.

## Phase 5: AI Bot Engine & Final Polish
- [ ] Develop simple bot controller to instantiate 10-20 AI pigs in single-player mode.
- [ ] Add shotgun weapon mesh to the designated Hunter player.