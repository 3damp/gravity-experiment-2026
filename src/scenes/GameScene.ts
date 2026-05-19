import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Placeholder: draw a circle as a stand-in for a planet
    const { width, height } = this.scale;

    this.add
      .graphics()
      .fillStyle(0x4488ff, 1)
      .fillCircle(width / 2, height / 2, 60);

    // Placeholder: draw a triangle as a stand-in for the ship
    const ship = this.add.graphics();
    ship.fillStyle(0xffffff, 1);
    ship.fillTriangle(
      width / 2,      height / 2 - 200,   // tip
      width / 2 - 12, height / 2 - 175,   // bottom-left
      width / 2 + 12, height / 2 - 175,   // bottom-right
    );

    // Placeholder text
    this.add
      .text(16, 16, 'Gravity Experiment 2026', { color: '#ffffff', fontSize: '14px' })
      .setAlpha(0.5);
  }

  update(_time: number, _delta: number): void {
    // Game loop — physics + input will go here
  }
}
