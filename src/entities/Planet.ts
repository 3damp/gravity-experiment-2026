import Phaser from 'phaser';

export class Planet {
  readonly body: MatterJS.BodyType;
  readonly radius: number;
  readonly atmosphereRadius: number;
  readonly color: number;
  readonly gfx: Phaser.GameObjects.Graphics;

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

    // Visual drawn at local origin so gfx.setPosition() moves the whole thing
    this.gfx = scene.add.graphics();
    this.gfx.setPosition(x, y);

    // Atmosphere: concentric rings fading out
    const steps = 10;
    for (let i = steps; i >= 1; i--) {
      const t = i / steps;
      const r = radius + (this.atmosphereRadius - radius) * (1 - t);
      this.gfx.fillStyle(color, 0.1 * t);
      this.gfx.fillCircle(0, 0, r);
    }

    // Planet body
    this.gfx.fillStyle(color, 1);
    this.gfx.fillCircle(0, 0, radius);
  }

  /** Reposition the planet (body + visual together). */
  setPosition(x: number, y: number): void {
    this.body.position.x = x;
    this.body.position.y = y;
    this.gfx.setPosition(x, y);
  }
}
