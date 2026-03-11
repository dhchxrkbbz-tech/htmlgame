import Phaser from "phaser";

export class EnemyAI {
  constructor(enemy) {
    this.enemy = enemy;
    this.state = "patrol";
    this.origin = { x: enemy.x, y: enemy.y };
    this.patrolAngle = Math.random() * Math.PI * 2;
  }

  update(player, delta) {
    const enemy = this.enemy;
    const animationPrefix = enemy.animationPrefix ?? "enemy-slime";
    if (enemy.isControlled()) {
      enemy.play(`${animationPrefix}-idle`, true);
      enemy.setFlipX(enemy.body.velocity.x < 0);
      return;
    }

    const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y);
    const moveSpeed = enemy.behavior.moveSpeed * enemy.getMoveSpeedMultiplier();

    if (enemy.stats.health / enemy.stats.maxHealth < 0.25 && distance < enemy.behavior.chaseRadius) {
      this.state = "flee";
    } else if (distance <= enemy.behavior.attackRadius) {
      this.state = "attack";
    } else if (distance <= enemy.behavior.chaseRadius) {
      this.state = "chase";
    } else {
      this.state = "patrol";
    }

    switch (this.state) {
      case "attack":
        enemy.setVelocity(0, 0);
        enemy.play(`${animationPrefix}-attack`, true);
        enemy.tryAttackPlayer(player);
        break;
      case "chase":
        enemy.scene.physics.moveToObject(enemy, player, moveSpeed);
        enemy.play(`${animationPrefix}-walk`, true);
        break;
      case "flee": {
        const angle = Phaser.Math.Angle.Between(player.x, player.y, enemy.x, enemy.y);
        enemy.scene.physics.velocityFromRotation(angle, moveSpeed * 1.2, enemy.body.velocity);
        enemy.play(`${animationPrefix}-walk`, true);
        break;
      }
      default:
        this.patrolAngle += 0.0015 * delta;
        enemy.body.velocity.x = Math.cos(this.patrolAngle) * moveSpeed * 0.35;
        enemy.body.velocity.y = Math.sin(this.patrolAngle) * moveSpeed * 0.35;
        enemy.play(`${animationPrefix}-idle`, true);
        break;
    }

    enemy.setFlipX(enemy.body.velocity.x < 0);
  }
}