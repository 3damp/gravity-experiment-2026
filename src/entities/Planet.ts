import Phaser from 'phaser';

export class Planet {
  readonly body: MatterJS.BodyType;
  readonly radius: number;
  readonly atmosphereRadius: number;
  readonly color: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    radius: number,
    color = 0xdd88cc,
  ) {
    this.radius = radius;
    this.atmosphereRadius = radius + radius * 0.2;
    this.color = color;

    this.body = scene.matter.add.circle(x, y, radius, {
      isStatic: true,
      isSensor: true,  // collisions handled by surface tile strip
      label: 'planet',
    }) as unknown as MatterJS.BodyType;

    // --- Visual ---
    const gfx = scene.add.graphics();

    // Atmosphere: concentric rings fading out
    const steps = 10;
    for (let i = steps; i >= 1; i--) {
      const t = i / steps; // 1 at surface edge, ~0 at atmo edge
      const r = radius + (this.atmosphereRadius - radius) * (1 - t);
      gfx.fillStyle(color, 0.1 * t);
      gfx.fillCircle(x, y, r);
    }

    // // Soft outer glow
    // gfx.fillStyle(color, 0.12);
    // gfx.fillCircle(x, y, radius + 18);

    // Planet body
    gfx.fillStyle(color, 1);
    gfx.fillCircle(x, y, radius);

    // Highlight (top-left)
    // gfx.fillStyle(0xffffff, 0.1);
    // gfx.fillCircle(x - radius * 0.28, y - radius * 0.28, radius * 0.52);
  }
}
