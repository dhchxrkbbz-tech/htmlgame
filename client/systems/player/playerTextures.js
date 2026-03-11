const CLASS_COLOR_MAP = {
  warrior: { primary: "#d96b49", accent: "#ffe1b2" },
  mage: { primary: "#4ba3f2", accent: "#cbe8ff" },
  ranger: { primary: "#62bf6d", accent: "#dcffc5" },
  cleric: { primary: "#d7c46e", accent: "#fff6c9" },
};

export const CLASS_KEYS = Object.keys(CLASS_COLOR_MAP);

const ACTOR_STATES = {
  idle: { frameRate: 3, repeat: -1 },
  walk: { frameRate: 8, repeat: -1 },
  attack: { frameRate: 10, repeat: 0 },
};

const ENEMY_COLOR_MAP = {
  slime: {
    idle: ["#8e5cff", "#efe1ff", "#efe1ff", "#7f53ef", "#ffffff", "#efe1ff"],
    walk: ["#9f72ff", "#ffffff", "#efe1ff", "#7447dc", "#e2d1ff", "#efe1ff"],
    attack: ["#f16b7f", "#ffffff", "#ffe5a0", "#ce4459", "#ffe5a0", "#ffe5a0"],
  },
  mossling: {
    idle: ["#4ea364", "#dff6d2", "#f0ffd5", "#3d8651", "#f7ffe5", "#e6ffd1"],
    walk: ["#61b96f", "#efffdc", "#f3ffcf", "#3f8b4e", "#dcffcd", "#edffd9"],
    attack: ["#bf8a43", "#fff0c8", "#ffe07d", "#9b6734", "#ffe8b3", "#ffe07d"],
  },
};

function generateActorTexture(scene, key, primary, accent, weaponColor) {
  if (scene.textures.exists(key)) {
    return;
  }

  scene.textures.generate(key, {
    pixelWidth: 4,
    palette: {
      ".": "rgba(0,0,0,0)",
      A: accent,
      P: primary,
      W: weaponColor,
      O: "#111111",
    },
    data: [
      "...AA...",
      "..AAAA..",
      "..AOOA..",
      "...PP...",
      "..PPPP..",
      ".PWPWWP.",
      ".P....P.",
      "P......P",
    ],
  });
}

function createAnimation(scene, key, frames, frameRate, repeat = -1) {
  if (scene.anims.exists(key)) {
    return;
  }

  scene.anims.create({
    key,
    frames: frames.map((frame) => ({ key: frame })),
    frameRate,
    repeat,
  });
}

function hasExternalFrames(scene, baseKey) {
  return scene.textures.exists(`${baseKey}-0`) && scene.textures.exists(`${baseKey}-1`);
}

function createExternalAnimations(scene, baseKeyPrefix) {
  Object.entries(ACTOR_STATES).forEach(([state, config]) => {
    const baseKey = `${baseKeyPrefix}-${state}`;
    if (!hasExternalFrames(scene, baseKey)) {
      return;
    }

    createAnimation(scene, `${baseKeyPrefix}-${state}`, [`${baseKey}-0`, `${baseKey}-1`], config.frameRate, config.repeat);
  });
}

function buildClassTextures(scene, classKey, colors) {
  if (hasExternalFrames(scene, `${classKey}-idle`)) {
    createExternalAnimations(scene, classKey);
    return;
  }

  generateActorTexture(scene, `${classKey}-idle-0`, colors.primary, colors.accent, "#67421f");
  generateActorTexture(scene, `${classKey}-idle-1`, colors.primary, colors.accent, "#8b5d2d");
  generateActorTexture(scene, `${classKey}-walk-0`, colors.primary, colors.accent, "#604020");
  generateActorTexture(scene, `${classKey}-walk-1`, colors.primary, colors.accent, "#9d6c37");
  generateActorTexture(scene, `${classKey}-attack-0`, colors.primary, colors.accent, "#cfd5db");
  generateActorTexture(scene, `${classKey}-attack-1`, colors.primary, colors.accent, "#ffd45f");

  createAnimation(scene, `${classKey}-idle`, [`${classKey}-idle-0`, `${classKey}-idle-1`], 3);
  createAnimation(scene, `${classKey}-walk`, [`${classKey}-walk-0`, `${classKey}-walk-1`], 8);
  createAnimation(scene, `${classKey}-attack`, [`${classKey}-attack-0`, `${classKey}-attack-1`], 10, 0);
}

function buildEnemyTextureFamily(scene, enemyKey, colors) {
  const prefix = `enemy-${enemyKey}`;
  if (hasExternalFrames(scene, `${prefix}-idle`)) {
    createExternalAnimations(scene, prefix);
    return;
  }

  generateActorTexture(scene, `${prefix}-idle-0`, colors.idle[0], colors.idle[1], colors.idle[2]);
  generateActorTexture(scene, `${prefix}-idle-1`, colors.idle[3], colors.idle[4], colors.idle[5]);
  generateActorTexture(scene, `${prefix}-walk-0`, colors.walk[0], colors.walk[1], colors.walk[2]);
  generateActorTexture(scene, `${prefix}-walk-1`, colors.walk[3], colors.walk[4], colors.walk[5]);
  generateActorTexture(scene, `${prefix}-attack-0`, colors.attack[0], colors.attack[1], colors.attack[2]);
  generateActorTexture(scene, `${prefix}-attack-1`, colors.attack[3], colors.attack[4], colors.attack[5]);

  createAnimation(scene, `${prefix}-idle`, [`${prefix}-idle-0`, `${prefix}-idle-1`], 3);
  createAnimation(scene, `${prefix}-walk`, [`${prefix}-walk-0`, `${prefix}-walk-1`], 6);
  createAnimation(scene, `${prefix}-attack`, [`${prefix}-attack-0`, `${prefix}-attack-1`], 9, 0);
}

function buildEnemyTextures(scene) {
  Object.entries(ENEMY_COLOR_MAP).forEach(([enemyKey, colors]) => {
    buildEnemyTextureFamily(scene, enemyKey, colors);
  });
}

export function buildGeneratedTextures(scene) {
  Object.entries(CLASS_COLOR_MAP).forEach(([classKey, colors]) => {
    buildClassTextures(scene, classKey, colors);
  });
  buildEnemyTextures(scene);
}