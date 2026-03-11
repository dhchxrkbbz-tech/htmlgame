export function calculateDamage(attackerStats, defenderStats, skill = {}) {
  const basePower = attackerStats.power ?? 10;
  const skillPower = skill.power ?? 1;
  const defense = defenderStats.defense ?? 0;
  return Math.max(1, Math.round(basePower * skillPower - defense * 0.45));
}

export function getFacingUnitVector(facing) {
  return {
    x: facing === "left" ? -1 : 1,
    y: 0,
  };
}

export function getSkillTargetPoint(origin, facing, skill = {}) {
  if (skill.target === "self") {
    return { x: origin.x, y: origin.y };
  }

  const direction = getFacingUnitVector(facing);
  const radius = skill.radius ?? 70;
  const range = skill.range ?? radius;
  const offset = Math.max(0, range - radius * 0.45);

  return {
    x: origin.x + direction.x * offset,
    y: origin.y + direction.y * offset,
  };
}

export function hitTestCircle(origin, targets, radius) {
  return targets.filter((target) => {
    if (!target.active) {
      return false;
    }

    const deltaX = origin.x - target.x;
    const deltaY = origin.y - target.y;
    return Math.hypot(deltaX, deltaY) <= radius;
  });
}

export function sortTargetsByDistance(origin, targets) {
  return [...targets].sort((left, right) => {
    const leftDistance = Math.hypot(origin.x - left.x, origin.y - left.y);
    const rightDistance = Math.hypot(origin.x - right.x, origin.y - right.y);
    return leftDistance - rightDistance;
  });
}