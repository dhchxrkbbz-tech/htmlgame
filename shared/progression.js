export function getXpRequiredForLevel(level) {
  const safeLevel = Math.max(1, Number(level) || 1);
  return 100 + (safeLevel - 1) * 45;
}

export function createDefaultProgression(overrides = {}) {
  const level = Math.max(1, Number(overrides.level) || 1);
  const xp = Math.max(0, Number(overrides.xp) || 0);
  return {
    level,
    xp,
    xpToNextLevel: Number(overrides.xpToNextLevel) || getXpRequiredForLevel(level),
  };
}

export function grantProgressionXp(currentProgression, amount) {
  const progression = createDefaultProgression(currentProgression);
  let remainingXp = progression.xp + Math.max(0, Number(amount) || 0);
  let level = progression.level;
  let xpToNextLevel = progression.xpToNextLevel;
  let levelsGained = 0;

  while (remainingXp >= xpToNextLevel) {
    remainingXp -= xpToNextLevel;
    level += 1;
    levelsGained += 1;
    xpToNextLevel = getXpRequiredForLevel(level);
  }

  return {
    progression: {
      level,
      xp: remainingXp,
      xpToNextLevel,
    },
    levelsGained,
  };
}