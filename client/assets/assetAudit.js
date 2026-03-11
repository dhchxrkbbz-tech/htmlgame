import { assetManifest, GENERATED_ENEMY_TYPES, GENERATED_PROP_TYPES } from "./assetManifest.js";

const REQUIRED_JSON_KEYS = ["map:tutorial", "enemy:slime", "enemy:mossling", "loot:basic", "skills:classes"];
const REQUIRED_SVG_KEYS = [
  "ui:frame-window",
  "ui:frame-slot",
  "ui:frame-button",
  "ui:frame-feed",
  "ui:icon-inventory",
  "ui:icon-guild",
  "ui:icon-trader",
  "ui:icon-party",
  "ui:icon-combat",
  ...GENERATED_PROP_TYPES.map((propType) => `env:prop-${propType}`),
  ...GENERATED_ENEMY_TYPES.flatMap((enemyType) => [
    `enemy-${enemyType}-idle-0`,
    `enemy-${enemyType}-idle-1`,
    `enemy-${enemyType}-walk-0`,
    `enemy-${enemyType}-walk-1`,
    `enemy-${enemyType}-attack-0`,
    `enemy-${enemyType}-attack-1`,
  ]),
];

export function validateAssetManifest() {
  const jsonKeys = new Set(assetManifest.json.map((entry) => entry.key));
  const svgKeys = new Set(assetManifest.svg.map((entry) => entry.key));
  const issues = [];

  REQUIRED_JSON_KEYS.forEach((key) => {
    if (!jsonKeys.has(key)) {
      issues.push(`Manifest missing JSON key ${key}.`);
    }
  });

  REQUIRED_SVG_KEYS.forEach((key) => {
    if (!svgKeys.has(key)) {
      issues.push(`Manifest missing SVG key ${key}.`);
    }
  });

  return issues;
}

export function auditLoadedAssets(scene) {
  const missing = [];

  assetManifest.json.forEach((entry) => {
    if (!scene.cache.json.exists(entry.key)) {
      missing.push(entry.key);
    }
  });

  assetManifest.svg.forEach((entry) => {
    if (!scene.textures.exists(entry.key)) {
      missing.push(entry.key);
    }
  });

  assetManifest.audio.forEach((entry) => {
    if (!scene.cache.audio.exists(entry.key)) {
      missing.push(entry.key);
    }
  });

  return { missing };
}