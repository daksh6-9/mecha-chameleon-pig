import './style.css';
import { GameRenderer } from './renderer.js';
import { PhysicsEngine } from './physics.js';
import { io } from 'socket.io-client';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// --- INITIALIZATION ---
const renderer = new GameRenderer();
const physics = new PhysicsEngine();
let socket;
let playerBody;
let mechaMesh;
const otherPlayers = {}; 
let isGameStarted = false;
let isFPP = false; // Defaulting to TPP so you can see your pig immediately!
let isCamouflaged = false;

const clock = new THREE.Clock();
const input = { keys: {} };

// --- RANDOM PIG CALL-SIGN GENERATOR ---
function generateRandomPigName() {
    const prefixes = ['Captain', 'Mister', 'Lord', 'Doctor', 'Agent', 'Major', 'Sgt', 'Sir', 'Chief'];
    const roots = ['Pig', 'Pork', 'Bacon', 'Hog', 'Boar', 'Swine', 'Snout', 'Trotter', 'Ham'];
    const suffixes = ['Lord', 'Master', 'Hunter', 'King', 'Boss', 'Runner', 'Blade', 'Vip', 'Unit'];

    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const root = roots[Math.floor(Math.random() * roots.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const num = Math.floor(Math.random() * 900) + 100; // Generates a number between 100 and 999

    // Randomly picks between 2 naming formats: "MisterPig09" or "PorkLord101"
    if (Math.random() > 0.5) {
        return `${prefix}${root}${num}`;
    } else {
        return `${root}${suffix}${num}`;
    }
}

// --- INPUT & PERSPECTIVE KEY LISTENERS ---
window.addEventListener('keydown', (e) => { 
    input.keys[e.code] = true; 
    if (!isGameStarted) return;
    if (e.code === 'KeyC') isCamouflaged = !isCamouflaged; 
    if (e.code === 'KeyV') isFPP = !isFPP; 
});
window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });

// --- MOUSELOOK POINTER LOCK ENGINE ---
const sensitivity = 0.002;
const pitchObject = new THREE.Object3D(); // Handles up/down look
const yawObject = new THREE.Object3D();   // Handles left/right look
yawObject.add(pitchObject);

document.addEventListener('DOMContentLoaded', () => {
    yawObject.position.copy(renderer.camera.position);
    renderer.scene.add(yawObject);
});

// Captures your cursor movements to rotate your game camera view
document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === document.body) {
        yawObject.rotation.y -= event.movementX * sensitivity;
        pitchObject.rotation.x -= event.movementY * sensitivity;
        
        // Clamp up/down viewing so you don't flip upside down
        pitchObject.rotation.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, pitchObject.rotation.x));
        
        renderer.camera.quaternion.setFromEuler(new THREE.Euler(pitchObject.rotation.x, yawObject.rotation.y, 0, 'YXZ'));
    }
});

// --- PARKOUR CONSTRAINTS ---
let jumpCount = 0;
const MAX_JUMPS = 2;
const DASH_FORCE = 80;
let dashCooldown = 0;
let dashActiveTimer = 0;

// --- CYBER-PIG SOLDIER WITH GUN MODEL ---
function createCyberPigSoldier() {
    const pigGroup = new THREE.Group();
    const pigPinkMat = new THREE.MeshStandardMaterial({ 
        color: 0xff0055, emissive: 0xff0055, emissiveIntensity: 0.6, wireframe: true, transparent: true, opacity: 0.9 
    });

    // 1. Torso Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.7), pigPinkMat);
    body.position.y = 0.85; 
    pigGroup.add(body);

    // 2. Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.75), pigPinkMat);
    head.position.set(0, 1.15, -1.05); 
    pigGroup.add(head);

    // 3. Snout
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.25), pigPinkMat);
    snout.position.set(0, 1.05, -1.55); 
    pigGroup.add(snout);

    // 4. Legs
    const legGeo = new THREE.BoxGeometry(0.25, 0.5, 0.25);
    const legPositions = [[-0.45, 0.25, -0.6], [0.45, 0.25, -0.6], [-0.45, 0.25, 0.6], [0.45, 0.25, 0.6]];
    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeo, pigPinkMat);
        leg.position.set(pos[0], pos[1], pos[2]);
        pigGroup.add(leg);
    });

    // 5. Side-Mounted Blaster
    const rifleGroup = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1), pigPinkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -0.4);
    rifleGroup.add(barrel);
    rifleGroup.position.set(0.65, 1.1, -0.2); 
    pigGroup.add(rifleGroup);

    return pigGroup;
}

// --- 3D PIG POSE TRANSFORMATIONS ---
let currentPose = 'reset';

function applyPoseToPig(pigMesh, poseType) {
    if (!pigMesh) return;

    // Extract individual body parts from the pig group
    const [body, head, snout, legFL, legFR, legBL, legBR, rifleGroup] = pigMesh.children;

    // Reset all base mesh orientations first
    pigMesh.rotation.x = 0;
    pigMesh.rotation.z = 0;
    body.position.set(0, 0.85, 0);
    head.position.set(0, 1.15, -1.05);
    snout.position.set(0, 1.05, -1.55);
    head.rotation.set(0, 0, 0);

    legFL.position.set(-0.45, 0.25, -0.6);
    legFR.position.set(0.45, 0.25, -0.6);
    legBL.position.set(-0.45, 0.25, 0.6);
    legBR.position.set(0.45, 0.25, 0.6);

    legFL.rotation.set(0, 0, 0);
    legFR.rotation.set(0, 0, 0);
    legBL.rotation.set(0, 0, 0);
    legBR.rotation.set(0, 0, 0);

    if (rifleGroup) rifleGroup.position.set(0.65, 1.1, -0.2);

    switch (poseType) {
        case 'starfish': // 1. Flat face down on belly, legs splayed out sideways
            legFL.rotation.z = Math.PI / 2;
            legFR.rotation.z = -Math.PI / 2;
            legBL.rotation.z = Math.PI / 2;
            legBR.rotation.z = -Math.PI / 2;
            body.position.y = 0.4;
            head.position.y = 0.5;
            snout.position.y = 0.4;
            break;

        case 'kneel_sit': // 2. Sitting upright with legs tucked back
            pigMesh.rotation.x = -Math.PI / 4; // Rears torso back
            legBL.rotation.x = -Math.PI / 2;
            legBR.rotation.x = -Math.PI / 2;
            break;

        case 'side_sleep': // 3. Rolled $90^\circ$ onto its flank side
            pigMesh.rotation.z = Math.PI / 2;
            pigMesh.position.y = 0.4;
            break;

        case 'stretch': // 4. Arms/Front legs raised straight up forward
            legFL.rotation.x = -Math.PI;
            legFR.rotation.x = -Math.PI;
            legFL.position.y = 1.2;
            legFR.position.y = 1.2;
            break;

        case 'fetal': // 5. Curled into a tight compact ball
            head.position.set(0, 0.7, -0.5);
            snout.position.set(0, 0.5, -0.8);
            legFL.position.set(-0.2, 0.3, -0.3);
            legFR.position.set(0.2, 0.3, -0.3);
            legBL.position.set(-0.2, 0.3, 0.3);
            legBR.position.set(0.2, 0.3, 0.3);
            break;

        case 'reset':
        default: // 6. Standard Quadruped Stance
            break;
    }
}

// --- ACTIVE MATCH INITIALIZER ---
function initLobbyView() {
    mechaMesh = createCyberPigSoldier(); 
    renderer.scene.add(mechaMesh);
    renderer.camera.position.set(0, 1.6, 3.5);
    renderer.camera.lookAt(0, 1.3, 0);

    // Auto-fill the name field with a unique pig call-sign
    const nameInput = document.getElementById('playerName');
    if (nameInput) {
        nameInput.value = generateRandomPigName();
    }

    animate();
}

function establishMatchConnection(playerName, partyCode, isCreating) {
    isGameStarted = true;
    socket = io('http://localhost:3000');
    
    socket.on('connect', () => {
        socket.emit('joinRoom', {
            username: playerName,
            roomCode: partyCode.trim().toUpperCase(),
            isHost: isCreating
        });
    });

    // Network Multi-Room Listener bindings
    socket.on('roomJoined', (confirmedRoomCode) => {
        console.log(`Successfully locked into Party: ${confirmedRoomCode}`);
        document.getElementById('ability-cooldown').innerText = `ROOM: ${confirmedRoomCode}`;
    });

    socket.on('init', (data) => {
        console.log(`Connected to room session as: ${data.role}`);
    });

    socket.on('currentPlayers', (serverPlayers) => {
        Object.keys(serverPlayers).forEach((id) => {
            if (id !== socket.id && !otherPlayers[id]) {
                addOtherPlayer(serverPlayers[id]);
            }
        });
    });

    socket.on('newPlayer', (playerData) => {
        if (!otherPlayers[playerData.id]) {
            addOtherPlayer(playerData);
        }
    });

    socket.on('playerMoved', (playerData) => {
        if (otherPlayers[playerData.id]) {
            const enemy = otherPlayers[playerData.id];
            enemy.position.copy(playerData.position);
            
            // Handle enemy mesh rotations
            if (playerData.rotation) {
                enemy.quaternion.copy(playerData.rotation);
            }

            enemy.traverse((child) => {
                if (child.isMesh) {
                    child.material.transparent = true;
                    child.material.opacity = playerData.isCamouflaged ? 0.05 : 0.9;
                }
            });
        }
    });

    socket.on('playerDisconnected', (id) => {
        if (otherPlayers[id]) {
            renderer.scene.remove(otherPlayers[id]);
            delete otherPlayers[id];
        }
    });

    playerBody = physics.createPlayerBody();
    playerBody.addEventListener('collide', () => { jumpCount = 0; });

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('action-panel').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    
    document.body.requestPointerLock();
}

function addOtherPlayer(playerData) {
    const pigMesh = createCyberPigSoldier();
    pigMesh.position.copy(playerData.position);
    renderer.scene.add(pigMesh);
    otherPlayers[playerData.id] = pigMesh;
}

// --- ENGINE HEARTBEAT LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    if (!isGameStarted) {
        if (mechaMesh) mechaMesh.rotation.y += 0.005; // Spin on home screen
    } else {
        if (playerBody) {
            if (dashCooldown > 0) dashCooldown -= dt;
            if (dashActiveTimer > 0) dashActiveTimer -= dt;

            // Double Jump handling
            if (input.keys['Space'] && jumpCount < MAX_JUMPS) {
                playerBody.velocity.y = 15;
                jumpCount++;
                input.keys['Space'] = false;
            }

            // Dash handling
            if (input.keys['ShiftLeft'] && dashCooldown <= 0) {
                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(renderer.camera.quaternion);
                forward.y = 0; forward.normalize();
                playerBody.velocity.x = forward.x * DASH_FORCE;
                playerBody.velocity.z = forward.z * DASH_FORCE;
                dashActiveTimer = 0.2;
                dashCooldown = 2.0;
            }

            // WASD Movement Steered dynamically by Camera angle
            if (dashActiveTimer <= 0) {
                const speed = 35;
                const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(renderer.camera.quaternion);
                camForward.y = 0; camForward.normalize();
                const camRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

                let moveDirection = new THREE.Vector3();
                if (input.keys['KeyW']) moveDirection.add(camForward);
                if (input.keys['KeyS']) moveDirection.sub(camForward);
                if (input.keys['KeyD']) moveDirection.add(camRight);
                if (input.keys['KeyA']) moveDirection.sub(camRight);

                if (moveDirection.lengthSq() > 0) {
                    moveDirection.normalize();
                    playerBody.velocity.x = moveDirection.x * speed;
                    playerBody.velocity.z = moveDirection.z * speed;
                    
                    if (!isFPP) {
                        const targetAngle = Math.atan2(moveDirection.x, moveDirection.z) + Math.PI;
                        mechaMesh.rotation.y = targetAngle;
                    }
                } else {
                    playerBody.velocity.x = 0;
                    playerBody.velocity.z = 0;
                }
            }

            // Sync graphics position to physics engine coordinates
            mechaMesh.position.copy(playerBody.position);
            mechaMesh.visible = !isFPP; 

            // Handle camouflage transparency styling
            mechaMesh.traverse((child) => {
                if (child.isMesh) {
                    child.material.transparent = true;
                    child.material.opacity = isCamouflaged ? 0.05 : 0.9;
                }
            });

            // Camera Tracking Handler
            const pos = new THREE.Vector3(playerBody.position.x, playerBody.position.y, playerBody.position.z);
            yawObject.position.copy(pos);

            if (isFPP) {
                const fppCamPos = pos.clone().add(new THREE.Vector3(0, 1.15, -1.05)); 
                renderer.camera.position.copy(fppCamPos);
            } else {
                const backDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(renderer.camera.quaternion);
                backDirection.y = 0; backDirection.normalize();

                const tppCamPos = pos.clone().add(backDirection.multiplyScalar(4)).add(new THREE.Vector3(0, 1.5, 0));
                renderer.camera.position.copy(tppCamPos);
                renderer.camera.lookAt(pos.clone().add(new THREE.Vector3(0, 0.8, 0))); 
            }

            socket.emit('updateState', {
                position: playerBody.position,
                rotation: renderer.camera.quaternion,
                isCamouflaged: isCamouflaged
            });
        }
        physics.step(dt);
    }
    renderer.render();
}

const poseOverlay = document.getElementById('pose-wheel-overlay');
const poseTitle = document.getElementById('selected-pose-title');
const sectors = document.querySelectorAll('.wheel-sector');

// TAB KEY TOGGLE: Press and Hold or Tap TAB to trigger wheel
window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') {
        e.preventDefault(); // Stop browser from focusing address bar
        if (isGameStarted && poseOverlay.classList.contains('hidden')) {
            poseOverlay.classList.remove('hidden');
            document.exitPointerLock(); // Free mouse cursor for wheel selection
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Tab') {
        e.preventDefault();
        if (isGameStarted && !poseOverlay.classList.contains('hidden')) {
            poseOverlay.classList.add('hidden');
            document.body.requestPointerLock(); // Re-lock cursor back to game control
        }
    }
});

// Wheel Sector Selection Clicks
sectors.forEach(sector => {
    sector.addEventListener('mouseenter', () => {
        poseTitle.innerText = sector.innerText;
    });

    sector.addEventListener('click', () => {
        const chosenPose = sector.getAttribute('data-pose');
        currentPose = chosenPose;
        applyPoseToPig(mechaMesh, chosenPose);
        
        // Hide wheel and lock back to camera
        poseOverlay.classList.add('hidden');
        document.body.requestPointerLock();
    });
});

// --- UI BUTTON BINDINGS ---
const createPartyBtn = document.getElementById('createPartyBtn');
const joinPartyBtn = document.getElementById('joinPartyBtn');
const partyCodeInput = document.getElementById('partyCodeInput');
const nameInput = document.getElementById('playerName');

createPartyBtn.addEventListener('click', () => {
    const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const userTag = nameInput.value || 'HostPig';
    establishMatchConnection(userTag, randomCode, true);
});

joinPartyBtn.addEventListener('click', () => {
    const enteredCode = partyCodeInput.value;
    if (!enteredCode) {
        alert("Please punch in a valid 4-letter Party Code!");
        return;
    }
    const userTag = nameInput.value || 'ClientPig';
    establishMatchConnection(userTag, enteredCode, false);
});

initLobbyView();