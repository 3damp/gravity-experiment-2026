import Phaser from "phaser";
import { Planet } from "../entities/Planet";
import { Ship } from "../entities/Ship";
import {
  DEBUG,
  MIN_ZOOM, MAX_ZOOM,
  G,
  AIR_FRICTION, AIR_DENSITY_PER_UNIT, AERO_TORQUE,
  TILE_COUNT, TILE_ARC, TILE_THICKNESS_FRAC,
  TILE_NOISE_ANGLE, TILE_NOISE_RADIAL,
  TILE_ACTIVATE_FRAC, TILE_RADIAL_OFFSET,
} from "../constants";

export class GameScene extends Phaser.Scene {
  private planets!: Planet[];
  private ship!: Ship;
  /** Each tile tracks the integer grid index k where theta = k * (TILE_ARC / TILE_COUNT) */
  private surfaceTiles: { body: MatterJS.BodyType; slotIndex: number }[] = [];
  private surfaceTileGfx!: Phaser.GameObjects.Graphics;
  private debugText!: Phaser.GameObjects.Text;
  private hudText!: Phaser.GameObjects.Text;
  private lastGravityForce = { x: 0, y: 0 };
  private lastDragForce = { x: 0, y: 0 };

  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    this.planets = [new Planet(this, 0, 0, 4000, 4000, 0xaa6544)];

    this.ship = new Ship(this, 0, -4020);
    this.surfaceTileGfx = this.add.graphics();
    if (DEBUG) {
      this.debugText = this.add
        .text(12, 12, "", {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#ffffff",
          backgroundColor: "#00000099",
          padding: { x: 8, y: 6 },
        })
        .setDepth(100);
    }

    this.hudText = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#e8d5b0",
        backgroundColor: "#00000099",
        padding: { x: 10, y: 7 },
        align: "right",
      })
      .setDepth(100);

    this.setupZoom();
  }

  private setupZoom(): void {
    const cam = this.cameras.main;

    // --- Slider ---
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(0);
    slider.max = String(1);
    slider.step = "0.01";
    slider.value = "0.9";
    Object.assign(slider.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      width: "130px",
      accentColor: "#4488cc",
      cursor: "pointer",
      zIndex: "10",
    });

    const mapValueToZoom = (value: number) => {
      const normalized =
        (value - parseFloat(slider.min)) /
        (parseFloat(slider.max) - parseFloat(slider.min));
      const zoom = MIN_ZOOM * Math.pow(MAX_ZOOM / MIN_ZOOM, normalized);
      return zoom;
    };

    document.body.appendChild(slider);
    slider.addEventListener("input", () => {
      cam.zoom = mapValueToZoom(parseFloat(slider.value));
    });

    // --- Mouse wheel ---
    // dy is ~±100 per tick; multiply by 0.001 → ±0.1 zoom per notch
    this.input.on(
      "wheel",
      (_p: unknown, _g: unknown, _dx: unknown, dy: number) => {
        const next = Phaser.Math.Clamp(
          parseFloat(slider.value) - dy * 0.0005,
          0,
          1,
        );
        cam.zoom = mapValueToZoom(next);
        slider.value = String(next);
      },
    );
    cam.zoom = mapValueToZoom(parseFloat(slider.value));

    // Clean up the DOM element if the scene ever shuts down
    this.events.once("shutdown", () => slider.remove());
  }

  update(): void {
    this.ship.update();
    this.applyGravity();
    this.applyAtmosphere();
    this.updateSurfaceTiles();
    // this.wrapShip();
    const { x, y } = this.ship.body.position;
    this.cameras.main.centerOn(x, y);
    this.updateUIText();
  }

  /** Pull the ship toward every planet: F = G·M / r² */
  private applyGravity(): void {
    const { x: sx, y: sy } = this.ship.body.position;
    this.lastGravityForce = { x: 0, y: 0 };

    for (const planet of this.planets) {
      const { x: px, y: py } = planet.body.position;
      const dx = px - sx;
      const dy = py - sy;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);
      if (dist < 1) continue;
      if (dist <= planet.radius) continue; // inside planet — tiles will push ship out

      const mag = (G * (planet.radius * planet.radius)) / distSq;
      const fx = (dx / dist) * mag;
      const fy = (dy / dist) * mag;
      this.lastGravityForce.x += fx;
      this.lastGravityForce.y += fy;
      this.matter.applyForce(this.ship.body, { x: fx, y: fy });
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

    const step = TILE_ARC / TILE_COUNT;
    const tileH = planet.radius * TILE_THICKNESS_FRAC;
    const tileW = 2 * planet.radius * Math.sin(step / 2) * 1.15;
    const shipAngle = Math.atan2(sy - py, sx - px);

    // Desired window: TILE_COUNT consecutive integer slots centred on the ship
    const centerK = Math.round(shipAngle / step);
    const half = Math.floor(TILE_COUNT / 2);
    const desiredKs = new Set<number>();
    for (let i = 0; i < TILE_COUNT; i++) desiredKs.add(centerK - half + i);

    // Which tiles are stale, which slots are missing?
    const occupiedKs = new Set(this.surfaceTiles.map((t) => t.slotIndex));
    const toRemove = this.surfaceTiles.filter(
      (t) => !desiredKs.has(t.slotIndex),
    );
    const missingKs = [...desiredKs].filter((k) => !occupiedKs.has(k));

    if (toRemove.length === 0 && missingKs.length === 0) return;

    // Destroy bodies that slid out of range
    for (const t of toRemove) this.matter.world.remove(t.body);
    this.surfaceTiles = this.surfaceTiles.filter((t) =>
      desiredKs.has(t.slotIndex),
    );

    // Spawn new bodies for every missing slot
    for (const k of missingKs) {
      // theta is the canonical world angle for this slot — always the same for a given k
      const theta = k * step;

      // Deterministic noise seeded by slot index — identical every time this slot is visited
      const h1 = Math.sin(theta * 10007.3);
      const h2 = Math.sin(theta * 9997.1);
      const angleNoise = h1 * TILE_NOISE_ANGLE;
      const radialNoise = h2 * planet.radius * TILE_NOISE_RADIAL;

      const r = planet.radius - tileH / 2 + radialNoise + TILE_RADIAL_OFFSET;
      const cx = px + r * Math.cos(theta);
      const cy = py + r * Math.sin(theta);

      const body = this.matter.add.rectangle(cx, cy, tileW, tileH, {
        isStatic: true,
        angle: theta + Math.PI / 2 + angleNoise,
        label: "surface",
        friction: 0.6,
        frictionStatic: 0.4,
        restitution: 0.15,
      }) as unknown as MatterJS.BodyType;

      this.surfaceTiles.push({ body, slotIndex: k });
    }

    // Redraw all tile graphics (only runs when at least one tile changed)
    this.surfaceTileGfx.clear();
    const hw = tileW / 2;
    const hh = tileH / 2;
    this.surfaceTileGfx.fillStyle(planet.color, 1);
    for (const { body } of this.surfaceTiles) {
      const cx = body.position.x;
      const cy = body.position.y;
      const a = body.angle;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      this.surfaceTileGfx.fillPoints(
        [
          new Phaser.Math.Vector2(
            cx + -hw * cos - -hh * sin,
            cy + -hw * sin + -hh * cos,
          ),
          new Phaser.Math.Vector2(
            cx + hw * cos - -hh * sin,
            cy + hw * sin + -hh * cos,
          ),
          new Phaser.Math.Vector2(
            cx + hw * cos - hh * sin,
            cy + hw * sin + hh * cos,
          ),
          new Phaser.Math.Vector2(
            cx + -hw * cos - hh * sin,
            cy + -hw * sin + hh * cos,
          ),
        ],
        true,
      );
    }
  }

  /** Atmospheric drag: linear falloff from planet surface to atmosphereRadius */
  private applyAtmosphere(): void {
    const body = this.ship.body;
    const { x: sx, y: sy } = body.position;
    this.lastDragForce = { x: 0, y: 0 };

    for (const planet of this.planets) {
      const { x: px, y: py } = planet.body.position;
      const dist = Math.hypot(px - sx, py - sy);
      if (dist >= planet.atmosphereRadius) continue;

      // 0 at atmosphere edge, 1 at planet surface
      const density = (planet.atmosphereRadius - dist) * AIR_DENSITY_PER_UNIT;
      const clamped = Math.max(0, Math.min(1, density));

      const { x: velx, y: vely } = body.velocity;
      const speed = Math.hypot(velx, vely);
      // Drag opposes velocity: F = -v̂ · speed² · k  (quadratic, correct sign)
      const fx = -velx * speed * AIR_FRICTION * clamped;
      const fy = -vely * speed * AIR_FRICTION * clamped;
      this.lastDragForce.x += fx;
      this.lastDragForce.y += fy;
      this.matter.applyForce(body, { x: fx, y: fy });

      // Angular drag in atmosphere
      body.torque -= body.angularVelocity * 0.04 * clamped;

      // Weathervane: nudge the ship to align its nose with the velocity vector
      if (speed > 0.0001) {
        const velAngle = Math.atan2(vely, velx); // standard math angle of velocity
        const headingAngle = body.angle - Math.PI / 2; // ship nose in same convention
        let diff = velAngle - headingAngle;
        // Normalise to [-π, π] so we always take the shortest arc
        diff =
          ((((diff + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) -
          Math.PI;
        body.torque += diff * speed * speed * AERO_TORQUE * clamped;
      }
    }
  }

  private updateUIText(): void {
    const vel = this.ship.body.velocity;
    const speed = Math.hypot(vel.x, vel.y);
    const gMag = Math.hypot(this.lastGravityForce.x, this.lastGravityForce.y);
    const dMag = Math.hypot(this.lastDragForce.x, this.lastDragForce.y);
    const fmt = (n: number) => (Math.round(n * 10) / 10).toFixed(1).padStart(6);
    const fmtM = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
    const fmtInt = (n: number) => Math.round(n);
    const cam = this.cameras.main;
    const zoom = cam.zoom;
    // Phaser zooms around the camera centre, so the world coord of screen (0,0) is:
    //   scrollX + width/2 * (1 - 1/zoom)
    const worldLeft = cam.scrollX + cam.width * 0.5 * (1 - 1 / zoom);
    const worldTop = cam.scrollY + cam.height * 0.5 * (1 - 1 / zoom);

    if (DEBUG) {
      this.debugText.setScale(1 / zoom);
      this.debugText.setPosition(worldLeft + 12 / zoom, worldTop + 12 / zoom);
      this.debugText.setText([
        `velocity  vx ${fmt(vel.x)}   vy ${fmt(vel.y)}   |v| ${fmtM(speed)}`,
        `gravity   fx ${fmt(this.lastGravityForce.x)}   fy ${fmt(this.lastGravityForce.y)}   |F| ${fmtM(gMag)}`,
        `drag      fx ${fmt(this.lastDragForce.x)}   fy ${fmt(this.lastDragForce.y)}   |F| ${fmtM(dMag)}`,
      ]);
    }

    // HUD — top-right, right-aligned
    const CONVERSION = 10 * 3600 * 0.001; // convert physics units to something more human-readable
    const hudLines = [
      `${fmtInt(speed * CONVERSION)} km/h`,
      `${fmtM(dMag * CONVERSION)}`,
    ];
    this.hudText.setText(hudLines);
    this.hudText.setScale(1 / zoom);
    const hudW = this.hudText.width / zoom;
    this.hudText.setPosition(
      worldLeft + cam.width / zoom - hudW - 12 / zoom,
      worldTop + 12 / zoom,
    );
  }
}
