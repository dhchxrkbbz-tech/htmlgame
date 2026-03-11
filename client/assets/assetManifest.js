export const GENERATED_ENEMY_TYPES = ["slime", "mossling"];
export const GENERATED_PROP_TYPES = ["tree", "crystal", "brazier", "mushroom-ring", "obelisk"];

export const assetManifest = {
  json: [
    { key: "map:tutorial", path: "data/maps/tutorial-map.json" },
    { key: "enemy:slime", path: "data/enemies/slime.json" },
    { key: "enemy:mossling", path: "data/enemies/mossling.json" },
    { key: "loot:basic", path: "data/loot/basic-loot.json" },
    { key: "skills:classes", path: "data/skills/class-skills.json" },
  ],
  svg: [
    { key: "ui:panel", path: "ui/panel.svg" },
    { key: "ui:skill-slot", path: "ui/skill-slot.svg" },
    { key: "ui:health-fill", path: "ui/health-fill.svg" },
    { key: "ui:mana-fill", path: "ui/mana-fill.svg" },
    { key: "ui:frame-window", path: "generated/ui/frames/window.svg" },
    { key: "ui:frame-slot", path: "generated/ui/frames/slot.svg" },
    { key: "ui:frame-button", path: "generated/ui/frames/button.svg" },
    { key: "ui:frame-feed", path: "generated/ui/frames/feed.svg" },
    { key: "ui:icon-inventory", path: "generated/ui/icons/inventory.svg" },
    { key: "ui:icon-guild", path: "generated/ui/icons/guild.svg" },
    { key: "ui:icon-trader", path: "generated/ui/icons/trader.svg" },
    { key: "ui:icon-party", path: "generated/ui/icons/party.svg" },
    { key: "ui:icon-combat", path: "generated/ui/icons/combat.svg" },
    { key: "env:tile-grass", path: "generated/environment/tiles/grass.svg" },
    { key: "env:tile-path", path: "generated/environment/tiles/path.svg" },
    { key: "env:tile-platform", path: "generated/environment/tiles/platform.svg" },
    ...GENERATED_PROP_TYPES.map((propKey) => ({ key: `env:prop-${propKey}`, path: `generated/environment/props/${propKey}.svg` })),
  ],
  audio: [],
};

const classKeys = ["warrior", "mage", "ranger", "cleric"];
const actorStates = ["idle", "walk", "attack"];

classKeys.forEach((classKey) => {
  actorStates.forEach((state) => {
    for (let index = 0; index < 2; index += 1) {
      assetManifest.svg.push({
        key: `${classKey}-${state}-${index}`,
        path: `generated/sprites/classes/${classKey}/${state}-${index}.svg`,
      });
    }
  });
});

GENERATED_ENEMY_TYPES.forEach((enemyType) => {
  actorStates.forEach((state) => {
    for (let index = 0; index < 2; index += 1) {
      assetManifest.svg.push({
        key: `enemy-${enemyType}-${state}-${index}`,
        path: `generated/sprites/enemies/${enemyType}/${state}-${index}.svg`,
      });
    }
  });
});

export function loadAssetManifest(scene) {
  assetManifest.json.forEach((entry) => {
    scene.load.json(entry.key, entry.path);
  });

  assetManifest.svg.forEach((entry) => {
    scene.load.svg(entry.key, entry.path);
  });

  assetManifest.audio.forEach((entry) => {
    scene.load.audio(entry.key, entry.paths);
  });
}