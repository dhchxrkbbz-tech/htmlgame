import { attachModalWindowBehavior, buildModalShell, modalBadgeStyle, modalInsetStyle, modalSectionStyle } from "./modalTheme.js";

function rarityColor(rarity) {
  switch (rarity) {
    case "rare":
      return "#7fd1ff";
    case "uncommon":
      return "#a8eb84";
    default:
      return "#e7d7a8";
  }
}

function formatCategory(category) {
  return category ? `${category[0].toUpperCase()}${category.slice(1)}` : "Misc";
}

export class InventoryPanel {
  constructor(scene, inventorySystem, handlers) {
    this.scene = scene;
    this.inventorySystem = inventorySystem;
    this.handlers = handlers;
    this.selectedInventoryItemId = null;
    this.dragHoverMode = null;

    this.root = scene.add.dom(860, 410).createFromHTML(this.buildMarkup());
    this.root.setScrollFactor(0);
    this.root.setDepth(1200);
    this.windowBehavior = attachModalWindowBehavior(this.root, {
      minWidth: 420,
      minHeight: 300,
      maxWidth: 860,
      maxHeight: 760,
    });
    this.windowBehavior.setSize(460, 520);

    const node = this.root.node;
    this.getElement('[data-action="close-window"]')?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.handlers.onClose?.();
    });
    node.addEventListener("click", (event) => {
      this.handlers.onUiInteract?.("click");
      this.handleClick(event);
    });
    node.addEventListener("dragstart", (event) => this.handleDragStart(event));
    node.addEventListener("dragover", (event) => this.handleDragOver(event));
    node.addEventListener("dragleave", () => {
      this.dragHoverMode = null;
      this.renderInventory();
    });
    node.addEventListener("drop", (event) => this.handleDrop(event));

    this.renderInventory();
    this.setVisibility(false);
  }

  buildMarkup() {
    const sectionStyle = modalSectionStyle();
    const insetStyle = modalInsetStyle();
    const badgeStyle = modalBadgeStyle();

    return buildModalShell({
      title: "Inventory Satchel",
      subtitle: "Reorder your items here, inspect details, and prepare items for trade or combat.",
      width: 460,
      body: `
        <section style="${sectionStyle}">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong>Pack Layout</strong>
            <span data-selected-item style="${badgeStyle}">No selection</span>
          </div>
          <div data-inventory-grid style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;"></div>
        </section>
        <section style="${sectionStyle}">
          <strong>Selected Item</strong>
          <div data-selected-details style="min-height: 144px; ${insetStyle}">Select an item to inspect it.</div>
        </section>
      `,
      footer: `<div data-inventory-status style="min-height: 18px; font-size: 13px; color: #b7d2c2;">Ready.</div>`,
    });
  }

  getElement(selector) {
    return this.root.node.querySelector(selector);
  }

  setStatus(message) {
    const status = this.getElement("[data-inventory-status]");
    if (status) {
      status.textContent = message;
    }
  }

  setVisibility(visible) {
    this.root.setVisible(visible);
    this.root.node.style.display = visible ? "grid" : "none";
    this.root.node.style.pointerEvents = visible ? "auto" : "none";
  }

  syncInventory() {
    this.renderInventory();
  }

  renderInventory() {
    const grid = this.getElement("[data-inventory-grid]");
    const selected = this.getElement("[data-selected-item]");
    const details = this.getElement("[data-selected-details]");
    if (!grid) {
      return;
    }

    const items = this.inventorySystem.list();
    grid.innerHTML = items.map((item) => {
      const isSelected = item.id === this.selectedInventoryItemId;
      const borderColor = isSelected ? rarityColor(item.rarity) : this.dragHoverMode === item.id ? "#d7c46e" : "#456557";
      const background = isSelected ? "#1d382c" : this.dragHoverMode === item.id ? "#183126" : "#10241c";
      return `
        <button
          type="button"
          draggable="true"
          data-action="inventory-select"
          data-item-id="${item.id}"
          style="min-height: 90px; display: grid; gap: 4px; align-content: start; padding: 8px; border-radius: 14px; border: 1px solid ${borderColor}; background: ${background}; color: #f6f2df; cursor: grab; text-align: left;"
        >
          <span style="font-size: 10px; color: ${rarityColor(item.rarity)}; text-transform: uppercase; letter-spacing: 0.4px;">${item.rarity}</span>
          <strong style="font-size: 12px; line-height: 1.2;">${item.name}</strong>
          <span style="font-size: 11px; color: #b7d2c2;">x${item.quantity} • ${formatCategory(item.category)}</span>
          <span style="font-size: 10px; color: #8ea89a;">${item.value ?? 0}g trader value</span>
        </button>
      `;
    }).join("");

    const selectedItem = this.inventorySystem.getItem(this.selectedInventoryItemId) ?? items[0] ?? null;
    if (!this.selectedInventoryItemId && selectedItem) {
      this.selectedInventoryItemId = selectedItem.id;
    }

    if (selected) {
      selected.textContent = selectedItem ? `${selectedItem.name} selected` : "No selection";
    }

    if (details) {
      details.innerHTML = selectedItem
        ? `
          <div style="display: grid; gap: 6px;">
            <strong style="font-size: 15px; color: ${rarityColor(selectedItem.rarity)};">${selectedItem.name}</strong>
            <div style="font-size: 11px; color: #b7d2c2; text-transform: uppercase; letter-spacing: 0.4px;">${selectedItem.rarity} ${formatCategory(selectedItem.category)}</div>
            <div style="font-size: 12px; color: #d8e5db;">${selectedItem.description || "No item lore yet."}</div>
            <div style="font-size: 12px; color: #9fb4a6;">Stack: ${selectedItem.quantity} • Trader value: ${selectedItem.value ?? 0}g</div>
            <div style="font-size: 11px; color: #8ea89a;">Drag onto another slot to reorder items inside the pack.</div>
          </div>
        `
        : "Select an item to inspect it.";
    }
  }

  handleDragStart(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const itemElement = target.closest("[data-item-id]");
    const itemId = itemElement instanceof HTMLElement ? itemElement.dataset.itemId : null;
    if (!itemId) {
      return;
    }

    event.dataTransfer?.setData("text/plain", itemId);
    event.dataTransfer.effectAllowed = "move";
    this.inventorySystem.beginDrag(itemId);
    this.selectedInventoryItemId = itemId;
    this.dragHoverMode = itemId;
    this.renderInventory();
  }

  handleDragOver(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.closest("[data-item-id]")) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      const hoverItem = target.closest("[data-item-id]");
      this.dragHoverMode = hoverItem instanceof HTMLElement ? hoverItem.dataset.itemId ?? null : null;
      this.renderInventory();
    }
  }

  handleDrop(event) {
    const sourceItemId = event.dataTransfer?.getData("text/plain") || this.inventorySystem.endDrag();
    const target = event.target;
    if (!sourceItemId || !(target instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    try {
      const targetItem = target.closest("[data-item-id]");
      if (targetItem instanceof HTMLElement) {
        const targetItemId = targetItem.dataset.itemId;
        if (targetItemId && targetItemId !== sourceItemId) {
          this.handlers.onMoveItem?.({ itemId: sourceItemId, targetItemId });
          this.setStatus("Inventory reordered.");
        }
      }
    } finally {
      this.dragHoverMode = null;
      this.inventorySystem.endDrag();
      this.renderInventory();
    }
  }

  handleClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest("[data-action]");
    if (!(button instanceof HTMLElement)) {
      return;
    }

    const action = button.dataset.action;
    if (!action) {
      return;
    }

    if (action === "close-window") {
      this.handlers.onClose?.();
      return;
    }

    if (action === "inventory-select") {
      this.selectedInventoryItemId = button.dataset.itemId ?? null;
      this.renderInventory();
    }
  }

  destroy() {
    this.windowBehavior?.destroy();
    this.root?.destroy();
  }
}