import Phaser from 'phaser';
import { Planet } from '../entities/Planet';
import { Ship } from '../entities/Ship';

/** Gravitational constant — tune this to change overall gravity strength */
const G = 0.01;
const AIR_FRICTION = 0.00012;

export class GameScene extends Phaser.Scene {

  private planets!: Planet[];
  private ship!: Ship;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.planets = [
      new Planet(this, 0,  0,  600, 10, 0xaa6544),
    ];

    this.ship = new Ship(this, 0, -1000);

    this.setupZoom();
  }

  private setupZoom(): void {
    const cam = this.cameras.main;
    const MIN_ZOOM = 0.25;
    const MAX_ZOOM = 4;

    // --- Slider ---
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(MIN_ZOOM);
    slider.max = String(MAX_ZOOM);
    slider.step = '0.01';
    slider.value = '1';
    Object.assign(slider.style, {
      position:    'fixed',
      bottom:      '24px',
      right:       '24px',
      width:       '130px',
      accentColor: '#4488cc',
      cursor:      'pointer',
      zIndex:      '10',
    });
    document.body.appendChild(slider);
    slider.addEventListener('input', () => {
      cam.zoom = parseFloat(slider.value);
    });

    // --- Mouse wheel ---
    // dy is ~±100 per tick; multiply by 0.001 → ±0.1 zoom per notch
    this.input.on('wheel',
      (_p: unknown, _g: unknown, _dx: unknown, dy: number) => {
        const next = Phaser.Math.Clamp(cam.zoom - dy * 0.001, MIN_ZOOM, MAX_ZOOM);
        cam.zoom = next;
        slider.value = String(next);
      },
    );

    // Clean up the DOM element if the scene ever shuts down
    this.events.once('shutdown', () => slider.remove());
  }

  update(): void {
    this.ship.update();
    this.applyGravity();
    this.applyAtmosphere();
    // this.wrapShip();
    const { x, y } = this.ship.body.position;
    this.cameras.main.centerOn(x, y);
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

      const mag = (G * planet.radius) / distSq;
      this.matter.applyForce(this.ship.body, {
        x: (dx / dist) * mag,
        y: (dy / dist) * mag,
      });
    }
  }

  /** Atmospheric drag: linear falloff from planet surface to atmosphereRadius */
  private applyAtmosphere(): void {
    const DRAG = AIR_FRICTION;
    const body = this.ship.body;
    const { x: sx, y: sy } = body.position;

    for (const planet of this.planets) {
      const { x: px, y: py } = planet.body.position;
      const dist = Math.hypot(px - sx, py - sy);
      if (dist >= planet.atmosphereRadius) continue;

      // 0 at atmosphere edge, 1 at planet surface
      const density = (planet.atmosphereRadius - dist) * 0.001;
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

}
