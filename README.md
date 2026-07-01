# 🐖 Mecha Chameleon: Pig Protocol

A fast-paced, networked 3D multiplayer hide-and-seek game built using **Three.js**, **Cannon-es (Physics)**, **Vite**, and **Socket.IO**. Control a low-poly Cyber-Pig equipped with active camouflage and advanced parkour mechanics!

## 🎮 Controls
* **WASD**: RPG-Style steering relative to the camera view.
* **Mouse**: Fluid third-person orbital camera / mouselook.
* **Spacebar**: Double Jump.
* **Left Shift**: Dash Forward (2-second cooldown).
* **C Key**: Toggle Chameleon Active Camouflage (Turns 95% invisible to other players).
* **V Key**: Toggle Perspective between First-Person (FPP) and Third-Person (TPP).

---

## 🛠️ Developer Setup (How to run on your laptop)

Follow these steps exactly to pull the project and spin up the environment:

### 1. Clone the Project
```bash
git clone https://github.com/daksh6-9/mecha-chameleon-pig.git
cd mecha-chameleon-pig

### 2. Setup the Mainframe Server
```bash
cd server
npm install
node index.js

The server will boot up and spin up a Socket.IO gateway on port 3000.

### 3. Setup the Simulation Client
Open a new, separate terminal window, go back to the root directory, and run:

```bash
cd client
npm install
npm run dev

Vite will compile the assets. Click the http://localhost:5173 link generated in your terminal to drop into the grid!