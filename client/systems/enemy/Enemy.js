import Phaser from "phaser";
import { EnemyAI } from "./EnemyAI.js";
import { calculateDamage } from "../combat/combatMath.js";

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, spawnConfig) {
    const animationPrefix = spawnConfig.animationPrefix ?? `enemy-${spawnConfig.type ?? "slime"}`;
    super(scene, x, y, `${animationPrefix}-idle-0`);

    this.scene = scene;
    this.spawnConfig = spawnConfig;
    this.animationPrefix = animationPrefix;
    this.stats = {
      ...spawnConfig.stats,
      maxHealth: spawnConfig.stats.maxHealth ?? 80,
      health: spawnConfig.stats.health ?? spawnConfig.stats.maxHealth ?? 80,
    };
    this.behavior = {
      moveSpeed: 55,
      chaseRadius: 220,
      attackRadius: 44,
      ...spawnConfig.behavior,
    };
    this.statusEffects = {
      stunUntil: 0,
      slowUntil: 0,
      slowMultiplier: 1,
      knockbackUntil: 0,
      dotUntil: 0,
      dotIntervalMs: 0,
      nextDotAt: 0,
      dotDamage: 0,
    };
    this.healthIndicatorVisibleUntil = 0;
    this.lastAttackAt = 0;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(2);
    this.setCollideWorldBounds(true);
    this.ai = new EnemyAI(this);
    this.healthBar = scene.add.graphics().setDepth(40);
    this.stateText = scene.add.text(this.x, this.y - 34, "", {
      fontSize: "11px",
      color: "#f6f2df",
      backgroundColor: "#08110ecc",
      padding: { x: 6, y: 2 },
    }).setOrigin(0.5).setDepth(41).setVisible(false);
    this.play(`${this.animationPrefix}-idle`);
    this.syncFeedbackUi();
  }

  getXpReward() {
    return this.spawnConfig.xpReward ?? Math.round((this.stats.maxHealth ?? 40) * 0.6 + (this.stats.power ?? 6) * 3 + (this.stats.defense ?? 2) * 2);
  }

  updateAI(player, delta) {
    if (!this.active) {
      return;
    }

    this.updateStatusEffects();
    this.ai.update(player, delta);
    this.syncFeedbackUi();
  }

  updateStatusEffects() {
    const now = this.scene.time.now;

    if (this.statusEffects.dotUntil > now && now >= this.statusEffects.nextDotAt) {
      this.statusEffects.nextDotAt = now + this.statusEffects.dotIntervalMs;
      this.applyDamage(this.statusEffects.dotDamage, { color: "#9fe870", source: "dot" });
    }

    if (this.statusEffects.slowUntil <= now) {
      this.statusEffects.slowMultiplier = 1;
    }

    if (this.statusEffects.dotUntil <= now) {
      this.statusEffects.dotDamage = 0;
      this.statusEffects.dotIntervalMs = 0;
      this.statusEffects.nextDotAt = 0;
    }
  }

  applyDamage(amount, options = {}) {
    this.stats.health = Math.max(0, this.stats.health - amount);
    this.healthIndicatorVisibleUntil = this.scene.time.now + 2200;
    this.showFloatingText(`-${amount}`, options.color ?? "#ffb4a8");
    this.flashHit();

    if (this.stats.health <= 0) {
      this.playDeathFeedback();
      this.disableBody(true, true);
      this.healthBar.clear();
      this.stateText.setVisible(false);
      return { defeated: true, remainingHealth: 0 };
    }

    return {
      defeated: false,
      remainingHealth: this.stats.health,
    };
  }

  applyStatus(effect, payload = {}) {
    const now = this.scene.time.now;

    switch (effect) {
      case "stun":
        this.statusEffects.stunUntil = Math.max(this.statusEffects.stunUntil, now + (payload.durationMs ?? 1200));
        this.showStateText("Stunned");
        break;
      case "slow":
        this.statusEffects.slowUntil = Math.max(this.statusEffects.slowUntil, now + (payload.durationMs ?? 1800));
        this.statusEffects.slowMultiplier = Math.min(this.statusEffects.slowMultiplier, payload.multiplier ?? 0.55);
        this.showStateText("Slowed");
        break;
      case "dot":
        this.statusEffects.dotUntil = Math.max(this.statusEffects.dotUntil, now + (payload.durationMs ?? 2400));
        this.statusEffects.dotIntervalMs = payload.intervalMs ?? 600;
        this.statusEffects.dotDamage = Math.max(this.statusEffects.dotDamage, payload.damagePerTick ?? 2);
        this.statusEffects.nextDotAt = now + this.statusEffects.dotIntervalMs;
        this.showStateText("Poisoned");
        break;
      default:
        break;
    }

    this.healthIndicatorVisibleUntil = now + 2200;
  }

  applyKnockback(forceX, forceY, durationMs = 160) {
    this.setVelocity(forceX, forceY);
    this.statusEffects.knockbackUntil = Math.max(this.statusEffects.knockbackUntil, this.scene.time.now + durationMs);
    this.showStateText("Shoved");
  }

  tryAttackPlayer(player) {
    if (!player || player.dead) {
      return null;
    }

    const attackCooldown = this.spawnConfig.attackCooldownMs ?? 1100;
    if (this.scene.time.now - this.lastAttackAt < attackCooldown) {
      return null;
    }

    this.lastAttackAt = this.scene.time.now;
    const damage = calculateDamage(this.stats, player.getCombatStats(), { power: this.spawnConfig.attackPowerMultiplier ?? 1 });
    const result = player.applyDamage(damage);
    this.showFloatingText(`${damage}`, "#ffcf99");
    return { damage, result };
  }

  isStunned() {
    return this.scene.time.now < this.statusEffects.stunUntil;
  }

  isControlled() {
    return this.isStunned() || this.scene.time.now < this.statusEffects.knockbackUntil;
  }

  getMoveSpeedMultiplier() {
    return this.scene.time.now < this.statusEffects.slowUntil ? this.statusEffects.slowMultiplier : 1;
  }

  flashHit() {
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.active) {
        this.clearTint();
      }
    });
  }

  playDeathFeedback() {
    const burst = this.scene.add.circle(this.x, this.y, 12, 0xffd27a, 0.7).setDepth(38);
    const text = this.scene.add.text(this.x, this.y - 18, "Defeated", {
      fontSize: "12px",
      color: "#ffe3a3",
      stroke: "#4e2d0b",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(39);

    this.scene.tweens.add({
      targets: burst,
      alpha: 0,
      scale: 3,
      duration: 320,
      onComplete: () => burst.destroy(),
    });
    this.scene.tweens.add({
      targets: text,
      alpha: 0,
      y: text.y - 24,
      duration: 700,
      onComplete: () => text.destroy(),
    });
  }

  showFloatingText(content, color) {
    const text = this.scene.add.text(this.x, this.y - 24, content, {
      fontSize: "15px",
      color,
      stroke: "#08110e",
      strokeThickness: 4,
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(42);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 26,
      alpha: 0,
      duration: 600,
      ease: "Cubic.easeOut",
      onComplete: () => text.destroy(),
    });
  }

  showStateText(content) {
    this.stateText.setText(content);
    this.stateText.setVisible(true);
    this.healthIndicatorVisibleUntil = this.scene.time.now + 2200;
  }

  syncFeedbackUi() {
    const shouldShow = this.active && (this.scene.time.now < this.healthIndicatorVisibleUntil || this.stats.health < this.stats.maxHealth);
    this.healthBar.clear();

    if (!shouldShow) {
      this.stateText.setVisible(false);
      return;
    }

    const ratio = Phaser.Math.Clamp(this.stats.health / this.stats.maxHealth, 0, 1);
    const width = 48;
    const height = 7;
    const offsetY = 32;
    const x = this.x - width / 2;
    const y = this.y - offsetY;

    this.healthBar.fillStyle(0x08110e, 0.84);
    this.healthBar.fillRoundedRect(x - 1, y - 1, width + 2, height + 2, 4);
    this.healthBar.fillStyle(0x3f5648, 0.95);
    this.healthBar.fillRoundedRect(x, y, width, height, 4);
    this.healthBar.fillStyle(ratio > 0.45 ? 0x8edb83 : 0xe07c6b, 1);
    this.healthBar.fillRoundedRect(x, y, Math.max(6, width * ratio), height, 4);

    this.stateText.setPosition(this.x, y - 10);
    this.stateText.setVisible(this.stateText.text.length > 0 && this.scene.time.now < this.healthIndicatorVisibleUntil);
  }

  destroy(fromScene) {
    this.healthBar?.destroy();
    this.stateText?.destroy();
    super.destroy(fromScene);
  }
}