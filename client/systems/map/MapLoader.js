export class MapLoader {
  constructor(scene, mapCacheKey) {
    this.scene = scene;
    this.mapCacheKey = mapCacheKey;
    this.definition = scene.cache.json.get(mapCacheKey);
  }

  createInstance(partyId) {
    const baseSpawn = this.definition.spawnPoints[0];
    return {
      mapKey: this.mapCacheKey,
      instanceId: `${this.definition.id}:${partyId}`,
      tileSize: this.definition.tileSize,
      bounds: this.definition.bounds,
      spawn: { ...baseSpawn },
      enemySpawns: structuredClone(this.definition.enemySpawns),
      lootSpawns: structuredClone(this.definition.lootSpawns),
      terrain: structuredClone(this.definition.terrain ?? {}),
      props: structuredClone(this.definition.props ?? []),
      landmarks: structuredClone(this.definition.landmarks ?? []),
    };
  }

  renderWorld(world) {
    const { scene } = this;
    const baseTile = world.terrain?.baseTile ?? "env:tile-grass";
    const baseRows = Math.ceil(world.bounds.height / world.tileSize);
    const baseColumns = Math.ceil(world.bounds.width / world.tileSize);

    for (let row = 0; row < baseRows; row += 1) {
      for (let column = 0; column < baseColumns; column += 1) {
        scene.add.image(column * world.tileSize, row * world.tileSize, baseTile)
          .setOrigin(0)
          .setDisplaySize(world.tileSize, world.tileSize)
          .setDepth(-30);
      }
    }

    (world.terrain?.patches ?? []).forEach((patch) => {
      for (let row = 0; row < patch.rows; row += 1) {
        for (let column = 0; column < patch.columns; column += 1) {
          scene.add.image(patch.x + column * world.tileSize, patch.y + row * world.tileSize, patch.texture)
            .setOrigin(0)
            .setDisplaySize(world.tileSize, world.tileSize)
            .setDepth(-24);
        }
      }
    });

    (world.props ?? []).forEach((entry) => {
      scene.add.image(entry.x, entry.y, entry.texture)
        .setScale(entry.scale ?? 1)
        .setDepth(entry.depth ?? entry.y)
        .setAlpha(entry.alpha ?? 1);
    });

    (world.landmarks ?? []).forEach((entry) => {
      const accentColor = parseInt((entry.accent ?? "#d7c46e").replace("#", ""), 16);
      scene.add.circle(entry.x, entry.y - 10, 12, accentColor, 0.28)
        .setDepth(-5);
      scene.add.text(entry.x, entry.y, entry.label, {
        fontSize: "14px",
        color: entry.color ?? "#f6f2df",
        backgroundColor: "#08110ecc",
        padding: { x: 8, y: 3 },
      }).setOrigin(0.5).setDepth(5);
    });
  }
}