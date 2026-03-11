function rarityColor(rarity) {
  switch (rarity) {
    case "rare":
      return 0x74c7ff;
    case "uncommon":
      return 0x99df7c;
    default:
      return 0xe6d5a0;
  }
}

export class LootSystem {
  constructor(scene) {
    this.scene = scene;
    this.lootTables = new Map();
    this.lootById = new Map();
    this.dropCounter = 0;
    this.highlightedDropId = null;
    this.pickupPrompt = scene.add.text(0, 0, "", {
      fontSize: "12px",
      color: "#f6f2df",
      backgroundColor: "#08110ecc",
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(55).setVisible(false);

    const baseTable = scene.cache.json.get("loot:basic");
    if (baseTable?.tableId) {
      this.lootTables.set(baseTable.tableId, baseTable.entries ?? []);
    }
  }

  initializeSpawns(lootSpawns = []) {
    lootSpawns.forEach((spawn) => {
      const item = this.rollDemoItem(spawn.table, this.dropCounter + 1);
      this.spawnDrop({
        dropId: spawn.id,
        x: spawn.x,
        y: spawn.y,
        item,
        source: "map",
      });
    });
  }

  spawnEnemyDrop(enemy) {
    const item = this.rollDemoItem("basic-loot", this.dropCounter + 1);
    const dropId = `${enemy.spawnConfig.id}-drop-${this.dropCounter}`;
    return this.spawnDrop({
      dropId,
      x: enemy.x,
      y: enemy.y,
      item,
      source: enemy.spawnConfig.id,
    });
  }

  rollDemoItem(tableId, seedIndex) {
    const table = this.lootTables.get(tableId) ?? this.lootTables.get("basic-loot") ?? [];
    if (!table.length) {
      return {
        id: "starter-potion",
        name: "Starter Potion",
        quantity: 1,
        rarity: "common",
        category: "consumable",
        description: "Fallback demo drop.",
        value: 12,
        stackable: true,
      };
    }

    const selected = table[(seedIndex - 1) % table.length];
    this.dropCounter += 1;

    return {
      id: selected.id,
      name: selected.name,
      quantity: selected.quantity ?? 1,
      rarity: selected.rarity ?? "common",
      category: selected.category ?? "misc",
      description: selected.description ?? "",
      value: selected.value ?? 0,
      stackable: selected.stackable ?? (selected.category !== "weapon" && selected.category !== "armor"),
    };
  }

  spawnDrop({ dropId, x, y, item, source }) {
    if (this.lootById.has(dropId)) {
      return this.lootById.get(dropId);
    }

    const color = rarityColor(item.rarity);
    const ring = this.scene.add.circle(x, y, 14, color, 0.26).setDepth(28);
    ring.setStrokeStyle(2, color, 0.9);
    const label = this.scene.add.text(x, y + 20, `${item.name} x${item.quantity}`, {
      fontSize: "11px",
      color: "#f6f2df",
      backgroundColor: "#08110ecc",
      padding: { x: 6, y: 2 },
    }).setOrigin(0.5).setDepth(29);

    const drop = { dropId, x, y, item, source, ring, label };
    this.lootById.set(dropId, drop);
    return drop;
  }

  update(player) {
    const nearest = this.getNearestDrop(player);
    if (!nearest) {
      this.highlightDrop(null);
      this.pickupPrompt.setVisible(false);
      return;
    }

    this.highlightDrop(nearest.dropId);
    this.pickupPrompt
      .setPosition(nearest.x, nearest.y - 28)
      .setText(`E Pick up ${nearest.item.name}`)
      .setVisible(true);
  }

  getNearestDrop(player, maxDistance = 70) {
    let bestDrop = null;
    let bestDistance = maxDistance;

    this.lootById.forEach((drop) => {
      const distance = Math.hypot(player.x - drop.x, player.y - drop.y);
      if (distance <= bestDistance) {
        bestDrop = drop;
        bestDistance = distance;
      }
    });

    return bestDrop;
  }

  tryPickupNearest(player) {
    const drop = this.getNearestDrop(player);
    if (!drop) {
      return null;
    }

    this.removeDrop(drop.dropId);
    return {
      dropId: drop.dropId,
      item: drop.item,
      source: drop.source,
    };
  }

  applyRemotePickup(dropId) {
    if (!dropId) {
      return;
    }

    this.removeDrop(dropId);
  }

  removeDrop(dropId) {
    const drop = this.lootById.get(dropId);
    if (!drop) {
      return null;
    }

    drop.ring.destroy();
    drop.label.destroy();
    this.lootById.delete(dropId);
    if (this.highlightedDropId === dropId) {
      this.highlightedDropId = null;
      this.pickupPrompt.setVisible(false);
    }

    return drop;
  }

  highlightDrop(dropId) {
    if (this.highlightedDropId === dropId) {
      return;
    }

    if (this.highlightedDropId && this.lootById.has(this.highlightedDropId)) {
      const previous = this.lootById.get(this.highlightedDropId);
      previous.ring.setScale(1);
      previous.label.setScale(1);
    }

    this.highlightedDropId = dropId;
    if (dropId && this.lootById.has(dropId)) {
      const next = this.lootById.get(dropId);
      next.ring.setScale(1.12);
      next.label.setScale(1.04);
    }
  }

  destroy() {
    this.lootById.forEach((drop) => {
      drop.ring.destroy();
      drop.label.destroy();
    });
    this.lootById.clear();
    this.pickupPrompt.destroy();
  }
}