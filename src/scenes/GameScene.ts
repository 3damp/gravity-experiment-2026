import Phaser from 'phaser';
import { Planet } from '../entities/Planet';
import { Ship } from '../entities/Ship';

/** Gravitational constant — tune this to change overall gravity strength */
const G = 0.1;

export class GameScene extends Phaser.Scene {
  private spawnX!: number;
  private spawnY!: number;

  private planets!: Planet[];
  private ship!: Ship;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    this.spawnX = width * 0.5;
    this.spawnY = height * 0.5 - 220;

    this.planets = [
      new Planet(this, width * 0.5,  height * 0.5,  60, 10, 0x2255bb),
    //   new Planet(this, width * 0.25, height * 0.35, 35,  400, 0x883311),
    ];

    this.ship = new Ship(this, this.spawnX, this.spawnY);

    this.add
      .text(16, 16, 'W / ↑  Thrust      A D / ← →  Rotate', {
        color: '#ffffff',
        fontSize: '13px',
      })
      .setAlpha(0.35);
  }

  update(): void {
    this.ship.update();
    this.applyGravity();
    this.applyAtmosphere();
    this.wrapShip();
  }

  /** Pull the ship toward every planet: F = G·M / r² */
  private applyGravity(): void {
    const { x: sx, y: sy } = this.ship.body.position;

    for (const planet of this.planets) {
      const { x: px, y: py } = planet.body.position;
      const dx = px - sx;
      const dy = py - sy;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);
      if (dist < 1) continue;

      const mag = (G * planet.gravitationalMass) / distSq;
      this.matter.applyForce(this.ship.body, {
        x: (dx / dist) * mag,
        y: (dy / dist) * mag,
      });
    }
  }

  /** Atmospheric drag: linear falloff from planet surface to atmosphereRadius */
  private applyAtmosphere(): void {
    const DRAG = 0.00012;
    const body = this.ship.body;
    const { x: sx, y: sy } = body.position;

    for (const planet of this.planets) {
      const { x: px, y: py } = planet.body.position;
      const dist = Math.hypot(px - sx, py - sy);
      if (dist >= planet.atmosphereRadius) continue;

      // 0 at atmosphere edge, 1 at planet surface
      const density = 1 - (dist - planet.radius) / (planet.atmosphereRadius - planet.radius);
      const clamped = Math.max(0, Math.min(1, density));

      const { x: vx, y: vy } = body.velocity;
      this.matter.applyForce(body, {
        x: -vx * DRAG * clamped,
        y: -vy * DRAG * clamped,
      });

      // Angular drag in atmosphere
      body.torque -= body.angularVelocity * 0.04 * clamped;
    }
  }

  /** Toroidal screen wrapping so the ship never disappears */
  private wrapShip(): void {
    const { width, height } = this.scale;
    const body = this.ship.body;
    const { x, y } = body.position;

    let nx = x;
    let ny = y;
    if (x < -20)        nx = width  + 20;
    else if (x > width  + 20) nx = -20;
    if (y < -20)        ny = height + 20;
    else if (y > height + 20) ny = -20;

    if (nx !== x || ny !== y) {
      this.ship.reset(nx, ny);
      // Re-apply current velocity after teleport (reset() zeroes it)
      // — skip velocity restore intentionally: arriving at the other side
      // with zero velocity is a deliberate design choice to avoid cheating gravity.
    }
  }
}
