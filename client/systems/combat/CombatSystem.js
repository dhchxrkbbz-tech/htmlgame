import { getAppServices } from "../../appContext.js";
import { calculateDamage, getFacingUnitVector, getSkillTargetPoint, hitTestCircle, sortTargetsByDistance } from "./combatMath.js";

export class CombatSystem {
  constructor(scene, player, enemies, skillSystem) {
    this.scene = scene;
    this.player = player;
    this.enemies = enemies;
    this.skillSystem = skillSystem;
    this.cooldowns = new Map();
  }

  update(delta) {
    for (const [key, remaining] of this.cooldowns.entries()) {
      const next = Math.max(0, remaining - delta);
      this.cooldowns.set(key, next);
    }
  }

  performBasicAttack() {
    return this.resolveSkill(this.skillSystem.getBasicAttack());
  }

  performSkill(index) {
    const skill = this.skillSystem.getSkill(index);
    if (!skill) {
      return null;
    }

    return this.resolveSkill(skill);
  }

  getCooldownRemaining(skillId) {
    return this.cooldowns.get(skillId) ?? 0;
  }

  resolveSkill(skill) {
    const cooldownKey = skill.id;
    if ((this.cooldowns.get(cooldownKey) ?? 0) > 0) {
      return { summary: `${skill.name} is on cooldown.` };
    }

    if (!this.player.spendMana(skill.manaCost ?? 0)) {
      return { summary: `${skill.name} requires more mana.` };
    }

    this.player.playAttackAnimation();
    const direction = getFacingUnitVector(this.player.facing);
    const targetPoint = getSkillTargetPoint(this.player, this.player.facing, skill);
    const selfEffects = this.applySelfEffects(skill, direction);
    const targets = this.getTargetsForSkill(skill, targetPoint);
    const impacted = targets.map((enemy) => {
      const damage = calculateDamage(this.player.getCombatStats(), enemy.stats, skill);
      const damageResult = enemy.applyDamage(damage);
      const effectResults = this.applyEnemyEffects(skill, enemy, direction, damage);

      if (damageResult.defeated) {
        this.scene.events.emit("enemy:defeated", {
          enemy,
          skill,
          damage,
        });
      }

      return {
        id: enemy.spawnConfig.id,
        damage,
        defeated: damageResult.defeated,
        effects: effectResults,
      };
    });

    this.cooldowns.set(cooldownKey, skill.cooldown ?? 1000);
    this.createCastFeedback(skill, targetPoint, direction, impacted.length);
    if (impacted.length) {
      this.scene.audioSystem?.playHit({ impactedCount: impacted.length, effect: skill.effect });
    }

    const { socketManager } = getAppServices();
    socketManager.emitCombat({
      skillId: skill.id,
      impacted,
    });

    const effectLabels = new Set(impacted.flatMap((entry) => entry.effects ?? []));
    const summaryParts = [];

    if (selfEffects.length) {
      summaryParts.push(selfEffects.join(", "));
    }

    if (impacted.length) {
      summaryParts.push(`hit ${impacted.length} target(s)`);
    }

    if (effectLabels.size) {
      summaryParts.push(Array.from(effectLabels).join(", "));
    }

    if (!summaryParts.length) {
      summaryParts.push("missed");
    }

    if (!impacted.length && skill.offensive !== false) {
      this.scene.audioSystem?.playUiClick({ tone: "soft" });
    }

    return {
      summary: `${skill.name}: ${summaryParts.join(" | ")}.`,
      impacted,
      selfEffects,
    };
  }

  getTargetsForSkill(skill, targetPoint) {
    if (skill.offensive === false) {
      return [];
    }

    const targets = hitTestCircle(targetPoint, this.enemies.getChildren(), skill.radius ?? 70);
    const sortedTargets = sortTargetsByDistance(targetPoint, targets);

    if (Number.isFinite(skill.maxTargets)) {
      return sortedTargets.slice(0, skill.maxTargets);
    }

    return sortedTargets;
  }

  applySelfEffects(skill, direction) {
    const messages = [];

    switch (skill.effect) {
      case "heal": {
        const healAmount = Math.round((this.player.stats.maxHealth ?? 120) * (skill.healRatio ?? 0.18));
        const restored = this.player.heal(healAmount);
        if (restored > 0) {
          this.spawnFloatingPlayerText(`+${restored}`, "#9fe870");
          messages.push(`healed ${restored}`);
        }
        break;
      }
      case "shield": {
        const shieldAmount = Math.round((this.player.stats.maxHealth ?? 120) * (skill.shieldRatio ?? 0.2));
        this.player.addShield(shieldAmount, skill.durationMs ?? 3600);
        this.spawnFloatingPlayerText(`Shield +${shieldAmount}`, "#9fd9ff");
        messages.push(`shield +${shieldAmount}`);
        break;
      }
      case "buff":
        this.player.addPowerBuff(skill.powerBuff ?? 0.2, skill.durationMs ?? 3200);
        this.spawnFloatingPlayerText("Battle Focus", "#ffd27a");
        messages.push("power buff");
        break;
      case "mobility": {
        const movedDistance = this.player.dash(direction, skill.range ?? 140);
        this.spawnFloatingPlayerText("Blink", "#9fd9ff");
        messages.push(`blinked ${movedDistance}px`);
        break;
      }
      case "evade": {
        const movedDistance = this.player.dash(direction, skill.range ?? 120);
        this.spawnFloatingPlayerText("Smoke Step", "#d6e6dd");
        messages.push(`repositioned ${movedDistance}px`);
        break;
      }
      default:
        break;
    }

    return messages;
  }

  applyEnemyEffects(skill, enemy, direction, damage) {
    const labels = [];

    switch (skill.effect) {
      case "stun":
        enemy.applyStatus("stun", { durationMs: skill.durationMs ?? 1200 });
        labels.push("stunned");
        break;
      case "slow":
        enemy.applyStatus("slow", {
          durationMs: skill.durationMs ?? 1800,
          multiplier: skill.slowMultiplier ?? 0.55,
        });
        labels.push("slowed");
        break;
      case "dot":
        enemy.applyStatus("dot", {
          durationMs: skill.durationMs ?? 2400,
          intervalMs: skill.intervalMs ?? 600,
          damagePerTick: Math.max(2, Math.round(damage * (skill.dotRatio ?? 0.35))),
        });
        labels.push("poisoned");
        break;
      default:
        break;
    }

    if (skill.knockbackForce) {
      enemy.applyKnockback(direction.x * skill.knockbackForce, 0, skill.knockbackDurationMs ?? 180);
      labels.push("pushed");
    }

    return labels;
  }

  createCastFeedback(skill, targetPoint, direction, impactedCount) {
    const colorMap = {
      stun: 0xe8bf6a,
      aoe: 0xf27d63,
      slow: 0x79c8ff,
      dot: 0x8ddc6f,
      heal: 0xc7f088,
      shield: 0xa1d8ff,
      buff: 0xf8d87b,
      mobility: 0x7ec9ff,
      evade: 0xdde7df,
      burst: 0xff9f6a,
    };
    const color = colorMap[skill.effect] ?? 0xf6f2df;
    const radius = Math.max(18, Math.min(skill.radius ?? 70, 140));
    const ring = this.scene.add.circle(targetPoint.x, targetPoint.y, radius, color, 0.14).setDepth(34);
    ring.setStrokeStyle(3, color, 0.75);

    const tracer = this.scene.add.graphics().setDepth(33);
    tracer.lineStyle(2, color, 0.5);
    tracer.beginPath();
    tracer.moveTo(this.player.x, this.player.y - 10);
    tracer.lineTo(targetPoint.x, targetPoint.y);
    tracer.strokePath();

    const pulse = impactedCount > 1 ? 1.28 : 1.12;

    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      scale: pulse,
      duration: 260,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    this.scene.tweens.add({
      targets: tracer,
      alpha: 0,
      duration: 220,
      onComplete: () => tracer.destroy(),
    });

    if (skill.effect === "mobility" || skill.effect === "evade") {
      const afterImage = this.scene.add.circle(this.player.x - direction.x * 18, this.player.y, 16, color, 0.16).setDepth(32);
      this.scene.tweens.add({
        targets: afterImage,
        alpha: 0,
        scale: 1.8,
        duration: 260,
        onComplete: () => afterImage.destroy(),
      });
    }
  }

  spawnFloatingPlayerText(content, color) {
    const text = this.scene.add.text(this.player.x, this.player.y - 46, content, {
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