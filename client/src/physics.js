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
}