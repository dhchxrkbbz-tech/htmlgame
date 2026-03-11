export class InventorySystem {
  constructor(initialItems = []) {
    this.items = [];
    this.dragState = null;
    initialItems.forEach((item) => this.addItem(item));
  }

  list() {
    return [...this.items];
  }

  getItem(itemId) {
    return this.items.find((item) => item.id === itemId) ?? null;
  }

  getItemIndex(itemId) {
    return this.items.findIndex((item) => item.id === itemId);
  }

  addItem(item) {
    const normalized = {
      quantity: 1,
      rarity: "common",
      category: "misc",
      description: "",
      value: 0,
      stackable: true,
      ...item,
    };

    const existing = normalized.stackable !== false
      ? this.items.find((entry) => entry.id === normalized.id && entry.stackable !== false)
      : null;

    if (existing) {
      existing.quantity += normalized.quantity;
      return existing;
    }

    this.items.push(normalized);
    return normalized;
  }

  removeItem(itemId, quantity = null) {
    const index = this.items.findIndex((item) => item.id === itemId);
    if (index === -1) {
      return null;
    }

    const item = this.items[index];
    if (quantity && quantity > 0 && item.quantity > quantity) {
      item.quantity -= quantity;
      return { ...item, quantity };
    }

    const [removed] = this.items.splice(index, 1);
    return removed;
  }

  updateItem(itemId, patch) {
    const item = this.items.find((entry) => entry.id === itemId);
    if (!item) {
      return null;
    }

    Object.assign(item, patch);
    return item;
  }

  moveItem(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= this.items.length || toIndex >= this.items.length) {
      return this.list();
    }

    const [item] = this.items.splice(fromIndex, 1);
    this.items.splice(toIndex, 0, item);
    return this.list();
  }

  beginDrag(itemId) {
    this.dragState = itemId;
  }

  moveItemById(itemId, targetItemId) {
    return this.moveItem(this.getItemIndex(itemId), this.getItemIndex(targetItemId));
  }

  endDrag() {
    const itemId = this.dragState;
    this.dragState = null;
    return itemId;
  }
}