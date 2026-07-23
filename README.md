# 🐖 Mecha Chameleon: Pig Protocol

A web-based 3D multiplayer stealth hide-and-seek game built with **Three.js**, **Cannon-es**, **Socket.IO**, and **Vite**.

## 🎮 Core Game Loop
* **The Waiting Room (Lobby Arena):** Stand on the central elevated step to claim the **Hunter** role before the countdown timer expires!
* **RGB Body Painting System (C Key):** Open an active color wheel and eyedropper tool to paint your pig model to match surrounding surface textures.
* **GTA-Style Posture Wheel (Tab Key):** Morph into 6 distinct physical postures (Star Spread, Kneel Sit, Fetal Curl, Side Sleep, etc.) to mimic props.
* **Surface Adhesion / Wall Stick:** Latch onto vertical walls and elevated surfaces to blend seamlessly into walls.
* **Bot Matchmaking:** Spin up single-player sessions against AI bots or host private multiplayer parties!

## 📂 System Documentation (`/docs`)
- [Product Requirement Document (PRD)](docs/PRD.md)
- [Technical Requirement Document (TRD)](docs/TRD.md)
- [System Architecture & Data Airflow](docs/ARCHITECTURE_AIRFLOW.md)
- [UI/UX Specification](docs/UI_UX_SPECIFICATION.md)
- [Backend & Database Schema](docs/BACKEND_DATABASE_SCHEMA.md)
- [Step-by-Step Implementation Plan](docs/IMPLEMENTATION_PLAN.md)

## 🚀 Quickstart
```bash
# Start Server
cd server && npm install && node index.js

# Start Client (In a new terminal)
cd client && npm install && npm run dev