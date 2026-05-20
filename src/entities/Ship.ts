import Phaser from 'phaser';

const THRUST = 0.00006;
const TORQUE = 0.0003;
const ANGULAR_DAMPING = 0.002;

export class Ship {
  readonly body: MatterJS.BodyType;

  private readonly scene: Phaser.Scene;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly flameGfx: Phaser.GameObjects.Graphics;
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly keys: { w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    this.body = scene.matter.add.fromVertices(x, y, [
      { x:  0, y: -16 },
      { x: -9, y:   8 },
      { x:  9, y:   8 },
    ], {
      frictionAir: 0,
      friction: 0.01,
      label: 'ship',
      mass: 1,
      restitution: 0.15,
    });

    this.gfx = scene.add.graphics();
    this.flameGfx = scene.add.graphics();

    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.keys = {
      w: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  update(): void {
    const { body, cursors, keys, scene } = this;
    const angle = body.angle;
    const thrusting = cursors.up.isDown || keys.w.isDown;
    const reversing = cursors.down.isDown || keys.s.isDown;

    // Rotation — torque-based so collisions can tumble the ship
    // Always counter the current spin (angular damping)
    body.torque = -body.angularVelocity * ANGULAR_DAMPING;
    if (cursors.left.isDown || keys.a.isDown) {
      body.torque -= TORQUE;
    } else if (cursors.right.isDown || keys.d.isDown) {
      body.torque += TORQUE;
    }

    // Thrust in the direction the ship points
    // angle=0 → facing up → force (0, -1)
    if (thrusting) {
      scene.matter.applyForce(body, {
        x:  Math.sin(angle) * THRUST,
        y: -Math.cos(angle) * THRUST,
      });
    } else if (reversing) {
      scene.matter.applyForce(body, {
        x: -Math.sin(angle) * THRUST,
        y:  Math.cos(angle) * THRUST,
      });
    }

    // Hard speed cap
    // const vel = body.velocity;
    // const speed = Math.hypot(vel.x, vel.y);
    // if (speed > MAX_SPEED) {
    //   scene.matter.setVelocity(body, (vel.x / speed) * MAX_SPEED, (vel.y / speed) * MAX_SPEED);
    // }

    this.draw(thrusting, reversing, angle);
  }

  private draw(thrusting: boolean, reversing: boolean, angle: number): void {
    const { x, y } = this.body.position;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Transform local point to world
    const t = (lx: number, ly: number) => ({
      x: x + lx * cos - ly * sin,
      y: y + lx * sin + ly * cos,
    });

    // Ship triangle
    this.gfx.clear();
    this.gfx.fillStyle(0xddeeff, 1);
    const tip = t(0, -16);
    const bl  = t(-9,   8);
    const br  = t( 9,   8);
    this.gfx.fillTriangle(tip.x, tip.y, bl.x, bl.y, br.x, br.y);

    // Wing lines
    this.gfx.lineStyle(1, 0x6699cc, 0.6);
    this.gfx.beginPath();
    this.gfx.moveTo(bl.x, bl.y);
    this.gfx.lineTo(t(0, 0).x, t(0, 0).y);
    this.gfx.lineTo(br.x, br.y);
    this.gfx.strokePath();

    // Engine flame
    this.flameGfx.clear();
    if (thrusting) {
      const len = 9 + Math.random() * 10;
      const fl  = t(-4, 8);
      const fr  = t( 4, 8);
      const ft  = t( 0, 8 + len);
      this.flameGfx.fillStyle(0xff6600, 0.9);
      this.flameGfx.fillTriangle(fl.x, fl.y, fr.x, fr.y, ft.x, ft.y);
      const ftInner = t(0, 8 + len * 0.5);
      this.flameGfx.fillStyle(0xffee44, 0.75);
      this.flameGfx.fillTriangle(fl.x, fl.y, fr.x, fr.y, ftInner.x, ftInner.y);
    } else if (reversing) {
      const len = 6 + Math.random() * 7;
      const rl  = t(-3, -16);
      const rr  = t( 3, -16);
      const rt  = t( 0, -16 - len);
      this.flameGfx.fillStyle(0xff6600, 0.9);
      this.flameGfx.fillTriangle(rl.x, rl.y, rr.x, rr.y, rt.x, rt.y);
      const rtInner = t(0, -16 - len * 0.5);
      this.flameGfx.fillStyle(0xffee44, 0.75);
      this.flameGfx.fillTriangle(rl.x, rl.y, rr.x, rr.y, rtInner.x, rtInner.y);
    }
  }

  reset(x: number, y: number): void {
    const body = this.body;

    // Translate physics vertices and bounds before updating the position field
    const dx = x - body.position.x;
    const dy = y - body.position.y;

    if (body.vertices) {
      for (const v of body.vertices) {
        v.x += dx;
        v.y += dy;
      }
    }
    body.bounds.min.x += dx;
    body.bounds.min.y += dy;
    body.bounds.max.x += dx;
    body.bounds.max.y += dy;

    body.position.x = x;
    body.position.y = y;
    body.positionPrev.x = x;
    body.positionPrev.y = y;

    // Zero velocities
    this.scene.matter.setVelocity(body, 0, 0);
    this.scene.matter.setAngularVelocity(body, 0);

    // Reset rotation
    body.angle = 0;
    body.anglePrev = 0;
  }
}
