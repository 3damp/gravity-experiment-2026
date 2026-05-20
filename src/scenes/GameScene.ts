import Phaser from 'phaser';
import { Planet } from '../entities/Planet';
import { Ship } from '../entities/Ship';

/** Gravitational constant — tune this to change overall gravity strength */
const G = 0.01;
const AIR_FRICTION = 0.00012;

// ── Surface tile colliders ────────────────────────────────────────────────────
// The planet circle is a sensor; a strip of thin rectangles approximates the
// local surface and handles all ship–ground collisions.
const TILE_COUNT          = 11;
const TILE_ARC            = Math.PI * 0.3;             // arc covered by the tile strip; centered on ship, extends in both directions
const TILE_THICKNESS_FRAC = 0.05;                     // height = radius × this
const TILE_NOISE_ANGLE    = 0.05;                     // ± radian rotation per tile
const TILE_NOISE_RADIAL   = 0.001;                     // ± fraction-of-radius height offset
const TILE_ACTIVATE_FRAC  = 1.2;                       // activate when dist < radius × this
const TILE_RADIAL_OFFSET  = 5;                         // extra outward offset in world units

export class GameScene extends Phaser.Scene {

  private planets!: Planet[];
  private ship!: Ship;
  /** Each tile tracks the integer grid index k where theta = k * (TILE_ARC / TILE_COUNT) */
  private surfaceTiles: { body: MatterJS.BodyType; slotIndex: number }[] = [];
  private surfaceTileGfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.planets = [
      new Planet(this, 0,  0,  2000, 1000, 0xaa6544),
    ];

    this.ship = new Ship(this, 0, -2300);
    this.surfaceTileGfx = this.add.graphics();

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
    this.updateSurfaceTiles();
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
      if (dist <= planet.radius) continue; // inside planet — tiles will push ship out

      const mag = (G * planet.radius) / distSq;
      this.matter.applyForce(this.ship.body, {
        x: (dx / dist) * mag,
        y: (dy / dist) * mag,
      });
    }
  }

  /**
   * Maintains a strip of thin static rectangles approximating the planet surface
   * near the ship.  Tiles are assigned to integer grid slots (k), where each
   * slot's world angle is k × step.  Because noise is computed solely from k,
   * the same world patch always looks identical no matter when the tile was last
   * recycled.  Only tiles that have drifted outside the desired window are
   * removed and recreated at the new leading edge — the rest are untouched.
   */
  private updateSurfaceTiles(): void {
    const planet = this.planets[0];
    const { x: px, y: py } = planet.body.position;
    const { x: sx, y: sy } = this.ship.body.position;
    const dist = Math.hypot(sx - px, sy - py);

    // Too far from the surface — remove all tiles and bail
    if (dist > planet.radius * TILE_ACTIVATE_FRAC) {
      if (this.surfaceTiles.length > 0) {
        for (const t of this.surfaceTiles) this.matter.world.remove(t.body);
        this.surfaceTiles = [];
        this.surfaceTileGfx.clear();
      }
      return;
    }

    const step      = TILE_ARC / TILE_COUNT;
    const tileH     = planet.radius * TILE_THICKNESS_FRAC;
    const tileW     = 2 * planet.radius * Math.sin(step / 2) * 1.15;
    const shipAngle = Math.atan2(sy - py, sx - px);

    // Desired window: TILE_COUNT consecutive integer slots centred on the ship
    const centerK   = Math.round(shipAngle / step);
    const half      = Math.floor(TILE_COUNT / 2);
    const desiredKs = new Set<number>();
    for (let i = 0; i < TILE_COUNT; i++) desiredKs.add(centerK - half + i);

    // Which tiles are stale, which slots are missing?
    const occupiedKs = new Set(this.surfaceTiles.map(t => t.slotIndex));
    const toRemove   = this.surfaceTiles.filter(t => !desiredKs.has(t.slotIndex));
    const missingKs  = [...desiredKs].filter(k => !occupiedKs.has(k));

    if (toRemove.length === 0 && missingKs.length === 0) return;

    // Destroy bodies that slid out of range
    for (const t of toRemove) this.matter.world.remove(t.body);
    this.surfaceTiles = this.surfaceTiles.filter(t => desiredKs.has(t.slotIndex));

    // Spawn new bodies for every missing slot
    for (const k of missingKs) {
      // theta is the canonical world angle for this slot — always the same for a given k
      const theta = k * step;

      // Deterministic noise seeded by slot index — identical every time this slot is visited
      const h1 = Math.sin(theta * 10007.3);
      const h2 = Math.sin(theta *  9997.1);
      const angleNoise  = h1 * TILE_NOISE_ANGLE;
      const radialNoise = h2 * planet.radius * TILE_NOISE_RADIAL;

      const r  = planet.radius - tileH / 2 + radialNoise + TILE_RADIAL_OFFSET;
      const cx = px + r * Math.cos(theta);
      const cy = py + r * Math.sin(theta);

      const body = this.matter.add.rectangle(cx, cy, tileW, tileH, {
        isStatic: true, angle: theta + Math.PI / 2 + angleNoise,
        label: 'surface', friction: 0.6, frictionStatic: 0.4, restitution: 0.15,
      }) as unknown as MatterJS.BodyType;

      this.surfaceTiles.push({ body, slotIndex: k });
    }

    // Redraw all tile graphics (only runs when at least one tile changed)
    this.surfaceTileGfx.clear();
    const hw = tileW / 2;
    const hh = tileH / 2;
    this.surfaceTileGfx.fillStyle(planet.color, 1);
    for (const { body } of this.surfaceTiles) {
      const cx  = body.position.x;
      const cy  = body.position.y;
      const a   = body.angle;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      this.surfaceTileGfx.fillPoints([
        new Phaser.Math.Vector2(cx + (-hw) * cos - (-hh) * sin, cy + (-hw) * sin + (-hh) * cos),
        new Phaser.Math.Vector2(cx + ( hw) * cos - (-hh) * sin, cy + ( hw) * sin + (-hh) * cos),
        new Phaser.Math.Vector2(cx + ( hw) * cos - ( hh) * sin, cy + ( hw) * sin + ( hh) * cos),
        new Phaser.Math.Vector2(cx + (-hw) * cos - ( hh) * sin, cy + (-hw) * sin + ( hh) * cos),
      ], true);
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
