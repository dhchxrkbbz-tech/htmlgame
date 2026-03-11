import Phaser from "phaser";
import { createDefaultProgression, grantProgressionXp } from "../../../shared/progression.js";

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, profile) {
    super(scene, x, y, `${profile.classKey}-idle-0`);

    this.scene = scene;
    this.profile = profile;
    this.classKey = profile.classKey;
    this.stats = { ...profile.stats };
    this.progression = createDefaultProgression(profile.progression);
    this.speed = this.stats.speed ?? 180;
    this.facing = "right";
    this.respawnPoint = { x, y };
    this.dead = false;
    this.respawnAt = 0;
    this.lastDamageAt = 0;
    this.effects = {
      shield: 0,
      shieldExpiresAt: 0,
      powerBuffMultiplier: 0,
      powerBuffExpiresAt: 0,
    };

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setScale(2.2);
    this.play(`${this.classKey}-idle`);
  }

  update(delta, cursors, wasd, allowMovement = true) {
    this.updateEffects();
    this.updateRegeneration(delta);

    if (this.dead) {
      this.setVelocity(0, 0);
      if (this.scene.time.now >= this.respawnAt) {
        this.respawn();
      }
      return;
    }

    const directionX = allowMovement ? Number(cursors.right.isDown || wasd.D.isDown) - Number(cursors.left.isDown || wasd.A.isDown) : 0;
    const directionY = allowMovement ? Number(cursors.down.isDown || wasd.S.isDown) - Number(cursors.up.isDown || wasd.W.isDown) : 0;

    const vector = new Phaser.Math.Vector2(directionX, directionY).normalize();
    this.setVelocity(vector.x * this.speed, vector.y * this.speed);

    if (vector.x < 0) {
      this.facing = "left";
      this.setFlipX(true);
    } else if (vector.x > 0) {
      this.facing = "right";
      this.setFlipX(false);
    }

    if (vector.lengthSq() > 0) {
      this.play(`${this.classKey}-walk`, true);
    } else if (!this.anims.isPlaying || this.anims.currentAnim?.key !== `${this.classKey}-idle`) {
      this.play(`${this.classKey}-idle`, true);
    }
  }

  setRespawnPoint(point) {
    this.respawnPoint = { x: point.x, y: point.y };
  }

  updateEffects() {
    const now = this.scene.time.now;

    if (this.effects.shield > 0 && now >= this.effects.shieldExpiresAt) {
      this.effects.shield = 0;
      this.effects.shieldExpiresAt = 0;
    }

    if (this.effects.powerBuffMultiplier > 0 && now >= this.effects.powerBuffExpiresAt) {
      this.effects.powerBuffMultiplier = 0;
      this.effects.powerBuffExpiresAt = 0;
    }
  }

  updateRegeneration(delta) {
    if (this.dead) {
      return;
    }

    if (this.scene.time.now - this.lastDamageAt < 3500) {
      return;
    }

    const deltaSeconds = delta / 1000;
    this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + Math.max(1, this.stats.maxHealth * 0.018) * deltaSeconds);
    this.stats.mana = Math.min(this.stats.maxMana, this.stats.mana + Math.max(2, this.stats.maxMana * 0.05) * deltaSeconds);
  }

  playAttackAnimation() {
    this.play(`${this.classKey}-attack`, true);
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.play(`${this.classKey}-idle`, true);
    });
  }

  applyDamage(amount) {
    if (this.dead) {
      return {
        absorbed: 0,
        healthLost: 0,
        remainingHealth: 0,
        defeated: true,
      };
    }

    const absorbed = Math.min(this.effects.shield, amount);
    this.effects.shield -= absorbed;
    const remainingDamage = Math.max(0, amount - absorbed);
    this.stats.health = Math.max(0, this.stats.health - remainingDamage);
    this.lastDamageAt = this.scene.time.now;
    this.showFloatingText(`-${remainingDamage}`, "#ffb4a8");

    if (this.stats.health <= 0) {
      this.die();
    }

    return {
      absorbed,
      healthLost: remainingDamage,
      remainingHealth: this.stats.health,
      defeated: this.dead,
    };
  }

  spendMana(amount) {
    if (this.stats.mana < amount) {
      return false;
    }

    this.stats.mana -= amount;
    return true;
  }

  heal(amount) {
    const before = this.stats.health;
    this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + amount);
    return this.stats.health - before;
  }

  die() {
    if (this.dead) {
      return;
    }

    this.dead = true;
    this.respawnAt = this.scene.time.now + 3000;
    this.setTint(0x6a7680);
    this.setAlpha(0.65);
    this.setVelocity(0, 0);
    this.scene.events.emit("player:defeated", {
      respawnAt: this.respawnAt,
    });
  }

  respawn() {
    this.dead = false;
    this.clearTint();
    this.setAlpha(1);
    this.setPosition(this.respawnPoint.x, this.respawnPoint.y);
    this.setVelocity(0, 0);
    this.stats.health = this.stats.maxHealth;
    this.stats.mana = this.stats.maxMana;
    this.effects.shield = 0;
    this.effects.shieldExpiresAt = 0;
    this.effects.powerBuffMultiplier = 0;
    this.effects.powerBuffExpiresAt = 0;
    this.lastDamageAt = this.scene.time.now;
    this.scene.events.emit("player:respawned");
  }

  gainXp(amount) {
    const result = grantProgressionXp(this.progression, amount);
    this.progression = result.progression;
    this.profile.progression = result.progression;

    if (result.levelsGained > 0) {
      for (let index = 0; index < result.levelsGained; index += 1) {
        this.stats.maxHealth += 12;
        this.stats.maxMana += 6;
        this.stats.power += 3;
        this.stats.defense += 2;
      }
      this.stats.health = this.stats.maxHealth;
      this.stats.mana = this.stats.maxMana;
      this.scene.events.emit("player:leveled", {
        level: this.progression.level,
        levelsGained: result.levelsGained,
      });
    }

    return {
      amount,
      level: this.progression.level,
      levelsGained: result.levelsGained,
      progression: this.progression,
    };
  }

  addShield(amount, durationMs) {
    this.effects.shield += amount;
    this.effects.shieldExpiresAt = Math.max(this.effects.shieldExpiresAt, this.scene.time.now + durationMs);
    return this.effects.shield;
  }

  addPowerBuff(multiplier, durationMs) {
    this.effects.powerBuffMultiplier = Math.max(this.effects.powerBuffMultiplier, multiplier);
    this.effects.powerBuffExpiresAt = Math.max(this.effects.powerBuffExpiresAt, this.scene.time.now + durationMs);
  }

  getCombatStats() {
    return {
      ...this.stats,
      power: Math.round((this.stats.power ?? 0) * (1 + this.effects.powerBuffMultiplier)),
    };
  }

  getShieldAmount() {
    return this.effects.shield;
  }

  dash(direction, distance) {
    const normalizedDirection = new Phaser.Math.Vector2(direction.x, direction.y).normalize();
    const fallbackDirection = normalizedDirection.lengthSq() > 0
      ? normalizedDirection
      : new Phaser.Math.Vector2(this.facing === "left" ? -1 : 1, 0);

    const worldBounds = this.scene.physics.world.bounds;
    const nextX = Phaser.Math.Clamp(this.x + fallbackDirection.x * distance, worldBounds.x + 16, worldBounds.right - 16);
    const nextY = Phaser.Math.Clamp(this.y + fallbackDirection.y * distance, worldBounds.y + 16, worldBounds.bottom - 16);
    const movedDistance = Phaser.Math.Distance.Between(this.x, this.y, nextX, nextY);

    this.setPosition(nextX, nextY);
    this.setVelocity(0, 0);

    return Math.round(movedDistance);
  }

  showFloatingText(content, color) {
    const text = this.scene.add.text(this.x, this.y - 38, content, {
      fontSize: "14px",
      color,
      stroke: "#08110e",
      strokeThickness: 4,
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(45);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 24,
      alpha: 0,
      duration: 650,
      onComplete: () => text.destroy(),
    });
  }
}