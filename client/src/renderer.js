import * as THREE from 'three';

// --- HELPER FUNCTION: DYNAMIC CANVAS TEXTURE GENERATOR ---
function createTextTexture(text, bgColor = '#112b3c', textColor = '#00ffcc') {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = textColor;
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    ctx.fillStyle = textColor;
    ctx.font = 'bold 54px Impact, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = text.split('\n');
    if (lines.length === 1) {
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    } else {
        lines.forEach((line, idx) => {
            ctx.fillText(line, canvas.width / 2, 80 + idx * 60);
        });
    }

    return new THREE.CanvasTexture(canvas);
}

// --- HELPER FUNCTION: HUMAN HUNTER MODEL BUILDER ---
export function createHumanHunterModel() {
    const hunterGroup = new THREE.Group();
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffcc99, roughness: 0.8 });
    const clothMat = new THREE.MeshStandardMaterial({ color: 0x0055ff, roughness: 0.6 });

    // Torso / Jacket
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), clothMat);
    torso.position.y = 1.15;
    hunterGroup.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), skinMat);
    head.position.y = 1.8;
    hunterGroup.add(head);

    // Legs
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 0.3), armorMat);
    legL.position.set(-0.2, 0.35, 0);
    const legR = legL.clone();
    legR.position.x = 0.2;
    hunterGroup.add(legL);
    hunterGroup.add(legR);

    // Arms holding shotgun
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), clothMat);
    armL.position.set(-0.45, 1.2, 0);
    armL.rotation.x = -Math.PI / 4;
    hunterGroup.add(armL);

    // Shotgun weapon
    const shotgun = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2), armorMat);
    barrel.rotation.x = Math.PI / 2;
    shotgun.add(barrel);
    shotgun.position.set(0.3, 1.2, -0.4);
    hunterGroup.add(shotgun);

    return hunterGroup;
}

// --- HELPER FUNCTION: PROCEDURAL HOUSE MAP BUILDER ---
export function buildHouseMap(scene) {
    const houseGroup = new THREE.Group();
    houseGroup.name = "houseMap";

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
    const couchMat = new THREE.MeshStandardMaterial({ color: 0xcc3333 });

    // Living Room Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), woodMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(50, 0, 0);
    houseGroup.add(floor);

    // Outer Boundary Walls
    const wallGeo = new THREE.BoxGeometry(40, 8, 1);
    const bWall1 = new THREE.Mesh(wallGeo, wallMat); bWall1.position.set(50, 4, -20);
    const bWall2 = new THREE.Mesh(wallGeo, wallMat); bWall2.position.set(50, 4, 20);
    const bWall3 = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 40), wallMat); bWall3.position.set(30, 4, 0);
    const bWall4 = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 40), wallMat); bWall4.position.set(70, 4, 0);
    houseGroup.add(bWall1, bWall2, bWall3, bWall4);

    // Furniture Props (Couch, Tables for Hiding)
    const couch = new THREE.Mesh(new THREE.BoxGeometry(6, 1.5, 3), couchMat);
    couch.position.set(45, 0.75, -10);
    houseGroup.add(couch);

    const table = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 4), woodMat);
    table.position.set(55, 0.6, 5);
    houseGroup.add(table);

    scene.add(houseGroup);
}

// --- MAIN GAME RENDERER CLASS ---
export class GameRenderer {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0b1d28);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);

        // Lighting Setup
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        this.scene.add(dirLight);

        // Handle Window Resizing
        window.addEventListener('resize', () => this.onWindowResize());
    }

    // Class Method: Build Waiting Room
    createWaitingRoom() {
        const roomGroup = new THREE.Group();
        roomGroup.name = "waitingRoom";

        const wallMat = new THREE.MeshStandardMaterial({ color: 0x112b3c, roughness: 0.8 });
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x0b1d28, roughness: 0.5 });
        const stepMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 0.4 });

        // Floor (30x30)
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMat);
        floor.rotation.x = -Math.PI / 2;
        roomGroup.add(floor);

        // Enclosing Walls
        const wallGeo = new THREE.BoxGeometry(30, 10, 1);
        const backWall = new THREE.Mesh(wallGeo, wallMat); backWall.position.set(0, 5, -15);
        const frontWall = new THREE.Mesh(wallGeo, wallMat); frontWall.position.set(0, 5, 15);
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 30), wallMat); leftWall.position.set(-15, 5, 0);
        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 30), wallMat); rightWall.position.set(15, 5, 0);

        roomGroup.add(backWall, frontWall, leftWall, rightWall);

        // Central Hunter Step Box
        const hunterStep = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 4), stepMat);
        hunterStep.position.set(0, 0.3, 0);
        hunterStep.name = "hunterStep";
        roomGroup.add(hunterStep);

        // Scoreboard Banner on Back Wall
        const scoreTex = createTextTexture("SCOREBOARD\n1. PORKLORD: 300\n2. BAKEBOI: 150", "#0b1d28", "#ffcc00");
        const scoreboard = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), new THREE.MeshBasicMaterial({ map: scoreTex }));
        scoreboard.position.set(0, 5.5, -14.4);
        roomGroup.add(scoreboard);

        // Game Title Banner on Front Wall
        const titleTex = createTextTexture("MECHA CHAMELEON: PIG PROTOCOL", "#0b1d28", "#00ffcc");
        const titleBanner = new THREE.Mesh(new THREE.PlaneGeometry(18, 4), new THREE.MeshBasicMaterial({ map: titleTex }));
        titleBanner.position.set(0, 6, 14.4);
        titleBanner.rotation.y = Math.PI;
        roomGroup.add(titleBanner);

        this.scene.add(roomGroup);
        return { hunterStep, roomGroup };
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}