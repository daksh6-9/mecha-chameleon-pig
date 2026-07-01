import './style.css';
import { GameRenderer } from './renderer.js';
import { PhysicsEngine } from './physics.js';
import { io } from 'socket.io-client';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// --- ENGINE REFS ---
const renderer = new GameRenderer();
const physics = new PhysicsEngine();
let socket, playerBody, mechaMesh;
const otherPlayers = {};

let isGameStarted = false;
let isFPP = true;
let isCamouflaged = true; // Started as true for the lobby transparency look

const FPP_OFFSET = new THREE.Vector3(0, 0.6, 0);
const TPP_OFFSET = new THREE.Vector3(0, 1.5, 4);

const clock = new THREE.Clock();
const input = { keys: {} };

// --- USER PACKET TRACKERS ---
let jumpCount = 0;
const MAX_JUMPS = 2;
const DASH_FORCE = 80;
let dashCooldown = 0;
let dashActiveTimer = 0;

// --- CONTROLS LISTENERS ---
window.addEventListener('keydown', (e) => { 
    input.keys[e.code] = true; 
    if (!isGameStarted) return;
    if (e.code === 'KeyC') {
        isCamouflaged = !isCamouflaged;
        document.getElementById('ability-cooldown').innerText = isCamouflaged ? 'CAMO: ACTIVE' : 'CAMO: OFF';
    }
    if (e.code === 'KeyV') {
        isFPP = !isFPP;
        document.getElementById('view-mode').innerText = isFPP ? 'VIEW: FPP (V)' : 'VIEW: TPP (V)';
    }
});
window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });

// --- CYBER-PIG SOLDIER WITH GUN MODEL ---
function createCyberPigSoldier() {
    const pigGroup = new THREE.Group();
    
    // Cyber-Pig Neon Hot Pink Material with Chameleon Transparency
    const pigPinkMat = new THREE.MeshStandardMaterial({ 
        color: 0xff0055, 
        emissive: 0xff0055, 
        emissiveIntensity: 0.6, 
        wireframe: true,
        transparent: true,
        opacity: 0.25 // Chameleon cloak blend style
    });

    // 1. Chunky Main Body
    const bodyGeo = new THREE.BoxGeometry(1.1, 0.9, 1.7);
    const body = new THREE.Mesh(bodyGeo, pigPinkMat);
    body.position.y = 0.85; 
    pigGroup.add(body);

    // 2. Head
    const headGeo = new THREE.BoxGeometry(0.75, 0.75, 0.75);
    const head = new THREE.Mesh(headGeo, pigPinkMat);
    head.position.set(0, 1.15, -1.05); 
    pigGroup.add(head);

    // 3. Pig Snout
    const snoutGeo = new THREE.BoxGeometry(0.45, 0.35, 0.25);
    const snout = new THREE.Mesh(snoutGeo, pigPinkMat);
    snout.position.set(0, 1.05, -1.55); 
    pigGroup.add(snout);

    // 4. Quadruped Cyber-Legs
    const legGeo = new THREE.BoxGeometry(0.25, 0.5, 0.25);
    const legPositions = [
        [-0.45, 0.25, -0.6], // Front Left
        [0.45, 0.25, -0.6],  // Front Right
        [-0.45, 0.25, 0.6],  // Back Left
        [0.45, 0.25, 0.6]    // Back Right
    ];
    
    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeo, pigPinkMat);
        leg.position.set(pos[0], pos[1], pos[2]);
        pigGroup.add(leg);
    });

    // 5. Side-Mounted Cyber Rifle
    const rifleGroup = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1), pigPinkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -0.4);
    
    const battery = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.4), pigPinkMat);
    battery.position.set(0, 0.12, -0.1);
    
    rifleGroup.add(barrel, battery);
    rifleGroup.position.set(0.65, 1.1, -0.2); // Mounted to the right flank
    pigGroup.add(rifleGroup);

    return pigGroup;
}

// --- INITIALIZATION ---
function initLobbyView() {
    // Spawn local player mesh prominently at the origin for selection screen
    mechaMesh = createCyberPigSoldier(); //  Call the new pig constructor!
    renderer.scene.add(mechaMesh);

    // Anchor camera position in front looking slightly down at our Chameleon pig-soldier
    renderer.camera.position.set(0, 1.6, 2.8);
    renderer.camera.lookAt(0, 1.3, 0);

    // Initialize logic heartbeat loop
    animate();
}

function startActiveMatch(playerName) {
    isGameStarted = true;
    socket = io('http://localhost:3000');
    
    playerBody = physics.createPlayerBody();
    playerBody.addEventListener('collide', () => { jumpCount = 0; });

    // Snap UI profiles
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('action-panel').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    
    document.body.requestPointerLock();
}

// --- CORE FRAME LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    if (!isGameStarted) {
        // Subtle spinning rotation animation inside selector menu lobby
        if (mechaMesh) mechaMesh.rotation.y += 0.005;
    } else {
        // --- MOVEMENT CALCULATIONS ---
        if (playerBody) {
            if (dashCooldown > 0) dashCooldown -= dt;
            if (dashActiveTimer > 0) dashActiveTimer -= dt;

            if (input.keys['Space'] && jumpCount < MAX_JUMPS) {
                playerBody.velocity.y = 15;
                jumpCount++;
                input.keys['Space'] = false;
            }

            if (input.keys['ShiftLeft'] && dashCooldown <= 0) {
                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(renderer.camera.quaternion);
                forward.y = 0; forward.normalize();
                playerBody.velocity.x = forward.x * DASH_FORCE;
                playerBody.velocity.z = forward.z * DASH_FORCE;
                dashActiveTimer = 0.2;
                dashCooldown = 2.0;
            }

            // WASD Movement (Steered dynamically by Camera view)
        if (dashActiveTimer <= 0) {
            const speed = 35;
            
            // 1. Find the horizontal direction the camera is pointing
            const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(renderer.camera.quaternion);
            camForward.y = 0; // Keep movement completely flat on the ground plane
            camForward.normalize();
            
            // 2. Find the camera's right-hand side vector
            const camRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

            let moveDirection = new THREE.Vector3();

            // 3. Build movement intent relative to where you are LOOKING
            if (input.keys['KeyW']) moveDirection.add(camForward); // Move toward camera view
            if (input.keys['KeyS']) moveDirection.sub(camForward); // Move away from camera view
            if (input.keys['KeyD']) moveDirection.add(camRight);   // Strafe right relative to camera
            if (input.keys['KeyA']) moveDirection.sub(camRight);   // Strafe left relative to camera

            if (moveDirection.lengthSq() > 0) {
                moveDirection.normalize();
                
                // Apply the steered velocity directly to your physical character
                playerBody.velocity.x = moveDirection.x * speed;
                playerBody.velocity.z = moveDirection.z * speed;
                
                // 4. Force the pig's snout to look exactly where it is moving!
                if (!isFPP) {
                    // Math.atan2 uses X and Z coordinates to find the radian angle
                    const targetAngle = Math.atan2(moveDirection.x, moveDirection.z);
                    mechaMesh.rotation.y = targetAngle;
                }
            } else {
                // Instantly brake on key release for snappy platforming response
                playerBody.velocity.x = 0;
                playerBody.velocity.z = 0;
            }
        }
            // Bind mesh translation to physics engine simulation
            mechaMesh.position.copy(playerBody.position);
            mechaMesh.visible = !isFPP; // Transparent hide optimization for FPP eyes

            // Dynamic Chameleon Opacity Changes 
            mechaMesh.traverse((child) => {
                if (child.isMesh) {
                    child.material.transparent = true;
                    child.material.opacity = isCamouflaged ? 0.05 : 0.9;
                    child.material.emissiveIntensity = isCamouflaged ? 0.1 : 0.8;
                }
            });

           // --- DYNAMIC CAMERA & CHARACTER ORIENTATION LOOP ---
        const pos = new THREE.Vector3(playerBody.position.x, playerBody.position.y, playerBody.position.z);
        
       if (isFPP) {
            const fppCamPos = pos.clone().add(new THREE.Vector3(0, 1.15, -1.05)); 
            renderer.camera.position.copy(fppCamPos);
            
            const camEuler = new THREE.Euler().setFromQuaternion(renderer.camera.quaternion, 'YXZ');
            mechaMesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), camEuler.y);
        } else {
            // TPP Orbit: Calculate back offset based directly on current mouse-controlled camera orientation
            const targetCamOffset = new THREE.Vector3(0, 1.8, 4).applyQuaternion(renderer.camera.quaternion);
            
            // Keep the offset anchored at a stable height relative to the pig
            targetCamOffset.y = 1.8; 
            
            const tppCamPos = pos.clone().add(targetCamOffset);
            renderer.camera.position.lerp(tppCamPos, 0.25); // Crisp camera tracking speed
            
            // Camera constantly points at the torso center of the pig
            renderer.camera.lookAt(pos.clone().add(new THREE.Vector3(0, 0.8, 0))); 
        }
        }
        physics.step(dt);
    }

    renderer.render();
}

// --- BIND CLICKS ---
const joinBtn = document.getElementById('joinBtn');
const nameInput = document.getElementById('playerName');

joinBtn.addEventListener('click', () => {
    startActiveMatch(nameInput.value || 'HunterPig');
});

// Fire layout view right away
initLobbyView();