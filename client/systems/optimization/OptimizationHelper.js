export class OptimizationHelper {
  constructor(scene, enemies) {
    this.scene = scene;
    this.enemies = enemies;
    this.lastNetworkSyncAt = 0;
  }

  update(time) {
    const cameraView = this.scene.cameras.main.worldView;
    this.enemies.children.each((enemy) => {
      enemy.setVisible(cameraView.contains(enemy.x, enemy.y));
      enemy.setActive(true);
    });

    this.time = time;
  }

  shouldSyncPosition(time) {
    if (time - this.lastNetworkSyncAt < 80) {
      return false;
    }

    this.lastNetworkSyncAt = time;
    return true;
  }
}