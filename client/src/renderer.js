import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export class GameRenderer {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x050510, 0.02);
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x050510);
        document.body.appendChild(this.renderer.domElement);

        // Cyberpunk Post-Processing (Neon Glow)
        const renderScene = new RenderPass(this.scene, this.camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0.2;
        bloomPass.strength = 1.2;
        bloomPass.radius = 0.5;

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
        this.composer.addPass(bloomPass);

        this.buildLevel();
        
        // Handle Window Resizing on Windows
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.composer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    buildLevel() {
        // Floor grid
        const gridHelper = new THREE.GridHelper(100, 100, 0x00ffff, 0x003333);
        this.scene.add(gridHelper);

        // Ambient cyber lighting
        const ambientLight = new THREE.AmbientLight(0x222244);
        this.scene.add(ambientLight);
    }

    render() {
        this.composer.render();
    }
    // --- WAITING ROOM & ARENA ENVIRONMENT BUILDER ---
    createWaitingRoom() {
        const roomGroup = new THREE.Group();
        roomGroup.name = "waitingRoom";

        // Common Materials
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x112b3c, roughness: 0.8 });
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x0b1d28, roughness: 0.5 });
        const stepMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 0.4 });
        const textPlaneMat = new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 0.2 });

        // 1. Floor Plane (30x30 units)
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMat);
        floor.rotation.x = -Math.PI / 2;
        roomGroup.add(floor);

        // 2. Enclosing 4 Walls (Height: 10 units)
        const wallGeo = new THREE.BoxGeometry(30, 10, 1);
        
        // Back Wall (Scoreboard Wall)
        const backWall = new THREE.Mesh(wallGeo, wallMat);
        backWall.position.set(0, 5, -15);
        roomGroup.add(backWall);

        // Front Wall (Title Wall)
        const frontWall = new THREE.Mesh(wallGeo, wallMat);
        frontWall.position.set(0, 5, 15);
        roomGroup.add(frontWall);

        // Left Wall
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 30), wallMat);
        leftWall.position.set(-15, 5, 0);
        roomGroup.add(leftWall);

        // Right Wall
        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 30), wallMat);
        rightWall.position.set(15, 5, 0);
        roomGroup.add(rightWall);

        // 3. Central "Hunter Step" (Square Step in the center)
        // Box dimensions: Width 4m, Height 0.6m, Depth 4m
        const hunterStep = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 4), stepMat);
        hunterStep.position.set(0, 0.3, 0);
        hunterStep.name = "hunterStep";
        roomGroup.add(hunterStep);

        // 4. Back Wall Scoreboard Display Banner
        const scoreboardBanner = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), textPlaneMat);
        scoreboardBanner.position.set(0, 5.5, -14.4);
        roomGroup.add(scoreboardBanner);

        // 5. Front Wall Title Banner ("MECHA CHAMELEON PIG PROTOCOL")
        const titleBanner = new THREE.Mesh(new THREE.PlaneGeometry(20, 4), textPlaneMat);
        titleBanner.position.set(0, 6, 14.4);
        titleBanner.rotation.y = Math.PI; // Face inward towards room
        roomGroup.add(titleBanner);

        this.scene.add(roomGroup);
        return { hunterStep, roomGroup };
    }
}