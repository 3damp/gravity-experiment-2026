import Phaser from 'phaser';

export class Planet {
  readonly body: MatterJS.BodyType;
  readonly radius: number;
  readonly atmosphereRadius: number;
  /** Mass used only for the custom gravity formula — static bodies have Infinity physics mass */
  readonly gravitationalMass: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    radius: number,
    gravitationalMass: number,
    color = 0x3366cc,
  ) {
    this.radius = radius;
    this.atmosphereRadius = radius + radius * 0.2;
    this.gravitationalMass = gravitationalMass;

    this.body = scene.matter.add.circle(x, y, radius, {
      isStatic: true,
      label: 'planet',
      restitution: 0.2,
    }) as unknown as MatterJS.BodyType;

    // --- Visual ---
    const gfx = scene.add.graphics();

    // Atmosphere: concentric rings fading out
    const steps = 8;
    for (let i = steps; i >= 1; i--) {
      const t = i / steps; // 1 at surface edge, ~0 at atmo edge
      const r = radius + (this.atmosphereRadius - radius) * (1 - t);
      gfx.fillStyle(color, 0.06 * t);
      gfx.fillCircle(x, y, r);
    }

    // Soft outer glow
    gfx.fillStyle(color, 0.12);
    gfx.fillCircle(x, y, radius + 18);

    // Planet body
    gfx.fillStyle(color, 1);
    gfx.fillCircle(x, y, radius);

    // Highlight (top-left)
    gfx.fillStyle(0xffffff, 0.1);
    gfx.fillCircle(x - radius * 0.28, y - radius * 0.28, radius * 0.52);
  }
}
