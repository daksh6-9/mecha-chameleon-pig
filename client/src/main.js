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

// --- ACTIVE MATCH INITIALIZER ---
function initLobbyView() {
    mechaMesh = createCyberPigSoldier(); 
    renderer.scene.add(mechaMesh);
    renderer.camera.position.set(0, 1.6, 3.5);
    renderer.camera.lookAt(0, 1.3, 0);
    animate();
}

function startActiveMatch(playerName) {
    isGameStarted = true;
    socket = io('http://localhost:3000');
    
    playerBody = physics.createPlayerBody();
    playerBody.addEventListener('collide', () => { jumpCount = 0; });

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('action-panel').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    
    document.body.requestPointerLock();
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
                        // Keeps the snout pointing forward in your direction of travel
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

// --- UI BUTTON BINDINGS ---
const joinBtn = document.getElementById('joinBtn');
const nameInput = document.getElementById('playerName');

joinBtn.addEventListener('click', () => { startActiveMatch(nameInput.value || 'HunterPig'); });
initLobbyView();