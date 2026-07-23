import * as CANNON from 'cannon-es';

export class PhysicsEngine {
    constructor() {
        this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
        this.setupGround();
    }

    setupGround() {
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        
        // Rotate the plane to lay flat
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(groundBody);
    }

    createPlayerBody() {
        // Updated for Pig Proportions (Wider, Shorter, Longer)
        const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.4, 0.8)); 
        const body = new CANNON.Body({
            mass: 5,
            fixedRotation: true, 
            position: new CANNON.Vec3(0, 5, 0)
        });
        body.addShape(shape);
        body.linearDamping = 0.9; 
        this.world.addBody(body);
        return body;
    }

    step(deltaTime) {
        // Step the physics simulation forward
        this.world.step(1 / 60, deltaTime, 3);
    }
    // --- PHYSICS BOUNDS FOR WAITING ROOM ---
    createWaitingRoomPhysics() {
        const wallMaterial = new CANNON.Material({ friction: 0.0 });

        // 1. Floor Body
        const floorBody = new CANNON.Body({ mass: 0, material: wallMaterial });
        floorBody.addShape(new CANNON.Plane());
        floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(floorBody);

        // 2. Hunter Step Collider (Box: half-extents 2, 0.3, 2)
        const stepBody = new CANNON.Body({ mass: 0, material: wallMaterial });
        stepBody.addShape(new CANNON.Box(new CANNON.Vec3(2, 0.3, 2)));
        stepBody.position.set(0, 0.3, 0);
        this.world.addBody(stepBody);

        // 3. Boundary Walls
        const createWall = (x, y, z, hx, hy, hz) => {
            const wall = new CANNON.Body({ mass: 0, material: wallMaterial });
            wall.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
            wall.position.set(x, y, z);
            this.world.addBody(wall);
        };

        createWall(0, 5, -15, 15, 5, 0.5);  // Back
        createWall(0, 5, 15, 15, 5, 0.5);   // Front
        createWall(-15, 5, 0, 0.5, 5, 15);  // Left
        createWall(15, 5, 0, 0.5, 5, 15);   // Right
    }
}