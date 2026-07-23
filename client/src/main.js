import './style.css';
import { GameRenderer } from './renderer.js';
import { PhysicsEngine } from './physics.js';
import { io } from 'socket.io-client';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// --- GLOBAL ENGINE STATE ---
const renderer = new GameRenderer();
const physics = new PhysicsEngine();
let socket = null;
let playerBody = null;
let mechaMesh = null;
const otherPlayers = {}; 
let isGameStarted = false;
let isFPP = false; 
let currentRoomCode = '';
let lastTime = performance.now();
const input = { keys: {} };

// --- RANDOM PIG CALL-SIGN GENERATOR ---
function generateRandomPigName() {
    const prefixes = ['Captain', 'Mister', 'Lord', 'Doctor', 'Agent', 'Major', 'Sgt', 'Sir', 'Chief'];
    const roots = ['Pig', 'Pork', 'Bacon', 'Hog', 'Boar', 'Swine', 'Snout', 'Trotter', 'Ham'];
    const suffixes = ['Lord', 'Master', 'Hunter', 'King', 'Boss', 'Runner', 'Blade', 'Vip', 'Unit'];

    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const root = roots[Math.floor(Math.random() * roots.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const num = Math.floor(Math.random() * 900) + 100;

    return Math.random() > 0.5 ? `${prefix}${root}${num}` : `${root}${suffix}${num}`;
}

// --- INPUT & PERSPECTIVE KEY LISTENERS ---
window.addEventListener('keydown', (e) => { 
    input.keys[e.code] = true; 
    if (!isGameStarted) return;
    if (e.code === 'KeyV') isFPP = !isFPP; 
});
window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });

// --- MOUSELOOK POINTER LOCK ENGINE ---
const sensitivity = 0.002;
const pitchObject = new THREE.Object3D(); 
const yawObject = new THREE.Object3D();   
yawObject.add(pitchObject);

document.addEventListener('DOMContentLoaded', () => {
    yawObject.position.copy(renderer.camera.position);
    renderer.scene.add(yawObject);
});

document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === document.body) {
        yawObject.rotation.y -= event.movementX * sensitivity;
        pitchObject.rotation.x -= event.movementY * sensitivity;
        
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

// --- REFACTORED CYBER-PIG SOLDIER (SLIM & PROPORTIONAL) ---
function createCyberPigSoldier() {
    const pigGroup = new THREE.Group();
    const pigPinkMat = new THREE.MeshStandardMaterial({ 
        color: 0xff0055, emissive: 0xff0055, emissiveIntensity: 0.6, wireframe: true, transparent: true, opacity: 0.9 
    });

    // 1. Torso Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1.1), pigPinkMat);
    body.position.y = 0.6; 
    pigGroup.add(body);

    // 2. Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), pigPinkMat);
    head.position.set(0, 0.85, -0.7); 
    pigGroup.add(head);

    // 3. Snout
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.18), pigPinkMat);
    snout.position.set(0, 0.8, -1.02); 
    pigGroup.add(snout);

    // 4. Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.4, 0.18);
    const legPositions = [[-0.3, 0.2, -0.35], [0.3, 0.2, -0.35], [-0.3, 0.2, 0.35], [0.3, 0.2, 0.35]];
    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeo, pigPinkMat);
        leg.position.set(pos[0], pos[1], pos[2]);
        pigGroup.add(leg);
    });

    // 5. Side-Mounted Blaster Rifle
    const rifleGroup = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8), pigPinkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -0.3);
    rifleGroup.add(barrel);
    rifleGroup.position.set(0.48, 0.8, -0.1); 
    pigGroup.add(rifleGroup);

    return pigGroup;
}

// --- 3D PIG POSE TRANSFORMATIONS ---
let currentPose = 'reset';

function applyPoseToPig(pigMesh, poseType) {
    if (!pigMesh) return;

    const [body, head, snout, legFL, legFR, legBL, legBR, rifleGroup] = pigMesh.children;

    pigMesh.rotation.x = 0;
    pigMesh.rotation.z = 0;
    body.position.set(0, 0.6, 0);
    head.position.set(0, 0.85, -0.7);
    snout.position.set(0, 0.8, -1.02);
    head.rotation.set(0, 0, 0);

    legFL.position.set(-0.3, 0.2, -0.35);
    legFR.position.set(0.3, 0.2, -0.35);
    legBL.position.set(-0.3, 0.2, 0.35);
    legBR.position.set(0.3, 0.2, 0.35);

    legFL.rotation.set(0, 0, 0);
    legFR.rotation.set(0, 0, 0);
    legBL.rotation.set(0, 0, 0);
    legBR.rotation.set(0, 0, 0);

    if (rifleGroup) rifleGroup.position.set(0.48, 0.8, -0.1);

    switch (poseType) {
        case 'starfish':
            legFL.rotation.z = Math.PI / 2;
            legFR.rotation.z = -Math.PI / 2;
            legBL.rotation.z = Math.PI / 2;
            legBR.rotation.z = -Math.PI / 2;
            body.position.y = 0.3;
            head.position.y = 0.4;
            snout.position.y = 0.3;
            break;

        case 'kneel_sit':
            pigMesh.rotation.x = -Math.PI / 4;
            legBL.rotation.x = -Math.PI / 2;
            legBR.rotation.x = -Math.PI / 2;
            break;

        case 'side_sleep':
            pigMesh.rotation.z = Math.PI / 2;
            pigMesh.position.y = 0.3;
            break;

        case 'stretch':
            legFL.rotation.x = -Math.PI;
            legFR.rotation.x = -Math.PI;
            legFL.position.y = 0.8;
            legFR.position.y = 0.8;
            break;

        case 'fetal':
            head.position.set(0, 0.5, -0.4);
            snout.position.set(0, 0.4, -0.6);
            legFL.position.set(-0.15, 0.2, -0.2);
            legFR.position.set(0.15, 0.2, -0.2);
            legBL.position.set(-0.15, 0.2, 0.2);
            legBR.position.set(0.15, 0.2, 0.2);
            break;

        case 'reset':
        default:
            break;
    }
}

// --- ACTIVE MATCH INITIALIZER & NETWORK SOCKET CONNECT ---
function initLobbyView() {
    mechaMesh = createCyberPigSoldier(); 
    renderer.scene.add(mechaMesh);
    renderer.camera.position.set(0, 1.4, 3.0);
    renderer.camera.lookAt(0, 1.0, 0);

    const nameInput = document.getElementById('playerName');
    if (nameInput) {
        nameInput.value = generateRandomPigName();
    }

    animate();
}

function establishMatchConnection(playerName, partyCode, isCreating) {
    isGameStarted = true;
    
    const serverUrl = `http://${window.location.hostname}:3000`;
    socket = io(serverUrl);
    
    currentRoomCode = partyCode.trim().toUpperCase();

    // 1. ATTACH LISTENERS BEFORE EMITTING JOIN EVENT
    socket.on('roomJoined', (confirmedCode) => {
        console.log(`[NET] Room Joined Confirmed: ${confirmedCode}`);
        const roomHud = document.getElementById('ability-cooldown');
        if (roomHud) roomHud.innerText = `ROOM: ${confirmedCode}`;
    });

    socket.on('currentPlayers', (serverPlayers) => {
        console.log('[NET] Received current players list:', serverPlayers);
        Object.keys(serverPlayers).forEach((id) => {
            if (id !== socket.id && !otherPlayers[id]) {
                addOtherPlayer(serverPlayers[id]);
            }
        });
    });

    socket.on('newPlayer', (playerData) => {
        console.log('[NET] New player joined:', playerData);
        if (playerData.id !== socket.id && !otherPlayers[playerData.id]) {
            addOtherPlayer(playerData);
        }
    });

    socket.on('playerMoved', (playerData) => {
        if (otherPlayers[playerData.id]) {
            const peerMesh = otherPlayers[playerData.id];
            
            // Explicit positional copy
            peerMesh.position.set(playerData.position.x, playerData.position.y, playerData.position.z);

            // Safe quaternion extraction (Fixes Three.js _x, _y NaN bug)
            if (playerData.rotation) {
                const r = playerData.rotation;
                peerMesh.quaternion.set(
                    r.x !== undefined ? r.x : (r._x || 0),
                    r.y !== undefined ? r.y : (r._y || 0),
                    r.z !== undefined ? r.z : (r._z || 0),
                    r.w !== undefined ? r.w : (r._w || 1)
                );
            }

            if (playerData.posture) {
                applyPoseToPig(peerMesh, playerData.posture);
            }
        }
    });

    socket.on('hunterCandidateUpdate', ({ candidateName }) => {
        const hudTimer = document.getElementById('timer');
        if (hudTimer && hudTimer.innerText.indexOf("CANDIDATE") === -1) {
            hudTimer.innerText = `HUNTER CANDIDATE: ${candidateName}`;
        }
    });

    socket.on('playerDisconnected', (id) => {
        console.log('[NET] Player disconnected:', id);
        if (otherPlayers[id]) {
            renderer.scene.remove(otherPlayers[id]);
            delete otherPlayers[id];
        }
    });

    // 2. NOW EMIT JOIN ROOM
    socket.on('connect', () => {
        console.log(`[NET] Socket connected (${socket.id}). Joining room ${currentRoomCode}...`);
        socket.emit('joinRoom', {
            username: playerName,
            roomCode: currentRoomCode,
            isHost: isCreating
        });
    });

    // Create Waiting Room Geometry and Physics Colliders
    renderer.createWaitingRoom();
    physics.createWaitingRoomPhysics();

    playerBody = physics.createPlayerBody();
    playerBody.addEventListener('collide', () => { jumpCount = 0; });

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('action-panel').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    
    document.body.requestPointerLock();
}

function addOtherPlayer(playerData) {
    console.log(`[SCENE] Spawning remote pig mesh for: ${playerData.username} (${playerData.id})`);
    const peerPigMesh = createCyberPigSoldier();
    
    if (playerData.position) {
        peerPigMesh.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
    }
    
    renderer.scene.add(peerPigMesh);
    otherPlayers[playerData.id] = peerPigMesh;
}

// --- ENGINE HEARTBEAT LOOP ---
function animate() {
    requestAnimationFrame(animate);
    // Calculate delta time in seconds
    const currentTime = performance.now();
    const dt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    if (!isGameStarted) {
        if (mechaMesh) mechaMesh.rotation.y += 0.005; 
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

            // WASD Movement Steered by Camera Vector
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

            // Camera Tracking Handler
            const pos = new THREE.Vector3(playerBody.position.x, playerBody.position.y, playerBody.position.z);
            yawObject.position.copy(pos);

            if (isFPP) {
                const fppCamPos = pos.clone().add(new THREE.Vector3(0, 0.85, -0.7)); 
                renderer.camera.position.copy(fppCamPos);
            } else {
                const backDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(renderer.camera.quaternion);
                backDirection.y = 0; backDirection.normalize();

                const tppCamPos = pos.clone().add(backDirection.multiplyScalar(3.5)).add(new THREE.Vector3(0, 1.2, 0));
                renderer.camera.position.copy(tppCamPos);
                renderer.camera.lookAt(pos.clone().add(new THREE.Vector3(0, 0.6, 0))); 
            }

            // --- HUNTER STEP BOUNDS INTERSECTION CHECK ---
            const px = playerBody.position.x;
            const py = playerBody.position.y;
            const pz = playerBody.position.z;

            const isStandingOnHunterStep = (px >= -2.0 && px <= 2.0) && 
                                           (pz >= -2.0 && pz <= 2.0) && 
                                           (py >= 0.5);

            const hudTimer = document.getElementById('timer');
            if (isStandingOnHunterStep) {
                if (hudTimer) {
                    hudTimer.innerText = "ROLE: HUNTER CANDIDATE 👑";
                    hudTimer.style.color = "#ffcc00";
                }
            } else {
                if (hudTimer) {
                    hudTimer.innerText = "ROLE: RUNNER PIG 🐖";
                    hudTimer.style.color = "#00ffcc";
                }
            }

            // --- EXPLICITLY SERIALIZED POSITION & ROTATION TO SOCKET ---
            if (socket) {
                const q = renderer.camera.quaternion;
                socket.emit('updateState', {
                    position: { x: playerBody.position.x, y: playerBody.position.y, z: playerBody.position.z },
                    rotation: { x: q.x, y: q.y, z: q.z, w: q.w },
                    posture: currentPose
                });

                socket.emit('checkHunterStep', {
                    roomCode: currentRoomCode,
                    isOnStep: isStandingOnHunterStep
                });
            }
        }
        physics.step(dt);
    }
    renderer.render();
}

// --- UI BUTTON BINDINGS & TAB POSE WHEEL ENGINE ---
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
        alert("Please enter a valid 4-letter Party Code!");
        return;
    }
    const userTag = nameInput.value || 'ClientPig';
    establishMatchConnection(userTag, enteredCode, false);
});

// TAB KEY WHEEL CONTROLLER
const poseOverlay = document.getElementById('pose-wheel-overlay');
const poseTitle = document.getElementById('selected-pose-title');
const sectors = document.querySelectorAll('.wheel-sector');
let pendingPose = currentPose;

window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') {
        e.preventDefault();
        if (isGameStarted && poseOverlay && poseOverlay.classList.contains('hidden')) {
            poseOverlay.classList.remove('hidden');
            document.exitPointerLock();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Tab') {
        e.preventDefault();
        if (isGameStarted && poseOverlay && !poseOverlay.classList.contains('hidden')) {
            applyPoseToPig(mechaMesh, pendingPose);
            currentPose = pendingPose;

            poseOverlay.classList.add('hidden');
            document.body.requestPointerLock();
        }
    }
});

sectors.forEach(sector => {
    sector.addEventListener('mouseenter', () => {
        const pose = sector.getAttribute('data-pose');
        pendingPose = pose;
        if (poseTitle) poseTitle.innerText = sector.innerText;
        
        sectors.forEach(s => s.classList.remove('active'));
        sector.classList.add('active');
    });

    sector.addEventListener('click', (e) => {
        e.stopPropagation();
        const pose = sector.getAttribute('data-pose');
        currentPose = pose;
        pendingPose = pose;
        applyPoseToPig(mechaMesh, pose);

        if (poseOverlay) poseOverlay.classList.add('hidden');
        document.body.requestPointerLock();
    });
});

initLobbyView();