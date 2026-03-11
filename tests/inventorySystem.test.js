import { describe, expect, it } from "vitest";
import { InventorySystem } from "../client/systems/inventory/InventorySystem.js";

describe("InventorySystem", () => {
  it("adds, updates and removes items", () => {
    const inventory = new InventorySystem();
    inventory.addItem({ id: "potion", name: "Potion", quantity: 1 });
    inventory.addItem({ id: "potion", name: "Potion", quantity: 2 });
    inventory.updateItem("potion", { quantity: 3 });

    expect(inventory.list()[0].quantity).toBe(3);
    expect(inventory.removeItem("potion").name).toBe("Potion");
    expect(inventory.list()).toHaveLength(0);
  });

  it("supports partial stack removal for loot and market flows", () => {
    const inventory = new InventorySystem([
      { id: "mana-herb", name: "Mana Herb", quantity: 3, stackable: true },
    ]);

    const removed = inventory.removeItem("mana-herb", 1);

    expect(removed.quantity).toBe(1);
    expect(inventory.list()[0].quantity).toBe(2);
  });

  it("supports reordering items for drag and drop flows", () => {
    const inventory = new InventorySystem([
      { id: "a", name: "A", quantity: 1 },
      { id: "b", name: "B", quantity: 1 },
    ]);

    inventory.moveItem(0, 1);
    expect(inventory.list()[1].id).toBe("a");
  });
});