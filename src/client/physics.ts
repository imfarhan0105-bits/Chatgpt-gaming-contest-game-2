import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { SOLID_OBSTACLE_BOUNDS, TOWN_SIZE } from '../shared/constants.ts';

export class PhysicsWorld {
  public world: CANNON.World;
  public defaultMaterial: CANNON.Material;
  public playerMaterial: CANNON.Material;
  public lootMaterial: CANNON.Material;

  // Track dynamic bodies mapped to Three.js meshes
  public dynamicBodies: Map<string, { body: CANNON.Body; mesh: THREE.Object3D }> = new Map();

  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -18.0, 0) // Punchy responsive gravity
    });

    this.defaultMaterial = new CANNON.Material('default');
    this.playerMaterial = new CANNON.Material('player');
    this.lootMaterial = new CANNON.Material('loot');

    // Contact material interactions
    const playerContact = new CANNON.ContactMaterial(this.playerMaterial, this.defaultMaterial, {
      friction: 0.1,
      restitution: 0.0
    });
    const lootContact = new CANNON.ContactMaterial(this.lootMaterial, this.defaultMaterial, {
      friction: 0.4,
      restitution: 0.35 // Bouncy dropped loot
    });

    this.world.addContactMaterial(playerContact);
    this.world.addContactMaterial(lootContact);

    this.buildStaticWorldColliders();
  }

  private buildStaticWorldColliders() {
    // Ground plane
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
      material: this.defaultMaterial
    });
    // Rotate plane to face upwards in Y
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(groundBody);

    // Add static box colliders for all buildings and town obstacles
    SOLID_OBSTACLE_BOUNDS.forEach((b) => {
      const halfX = (b.maxX - b.minX) / 2;
      const halfZ = (b.maxZ - b.minZ) / 2;
      const halfY = 5.0; // Standard building height

      const posX = b.minX + halfX;
      const posZ = b.minZ + halfZ;
      const posY = halfY;

      const body = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(halfX, halfY, halfZ)),
        material: this.defaultMaterial,
        position: new CANNON.Vec3(posX, posY, posZ)
      });
      this.world.addBody(body);
    });
  }

  /**
   * Spawns a physical dynamic rigid body for dropped loot that bounces and settles on the ground.
   */
  public addDroppedLootBody(id: string, mesh: THREE.Object3D, origin: { x: number; y: number; z: number }) {
    const body = new CANNON.Body({
      mass: 1.5,
      shape: new CANNON.Box(new CANNON.Vec3(0.25, 0.15, 0.25)),
      material: this.lootMaterial,
      position: new CANNON.Vec3(origin.x, origin.y, origin.z),
      linearDamping: 0.2,
      angularDamping: 0.3
    });

    // Random toss impulse
    body.velocity.set(
      (Math.random() - 0.5) * 3.5,
      2.5 + Math.random() * 2.0,
      (Math.random() - 0.5) * 3.5
    );
    body.angularVelocity.set(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10
    );

    this.world.addBody(body);
    this.dynamicBodies.set(id, { body, mesh });
  }

  public removeDynamicBody(id: string) {
    const item = this.dynamicBodies.get(id);
    if (item) {
      this.world.removeBody(item.body);
      this.dynamicBodies.delete(id);
    }
  }

  public step(delta: number) {
    const timeStep = Math.min(delta, 0.05);
    this.world.step(1 / 60, timeStep, 3);

    // Sync mesh transforms from physics bodies
    for (const [_, item] of this.dynamicBodies.entries()) {
      item.mesh.position.set(item.body.position.x, item.body.position.y, item.body.position.z);
      item.mesh.quaternion.set(
        item.body.quaternion.x,
        item.body.quaternion.y,
        item.body.quaternion.z,
        item.body.quaternion.w
      );
    }
  }
}
