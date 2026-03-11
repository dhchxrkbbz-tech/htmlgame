import { attachModalWindowBehavior, buildModalShell, modalBadgeStyle, modalButtonStyle, modalInputStyle, modalInsetStyle, modalSectionStyle } from "./modalTheme.js";

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

export class MarketPanel {
  constructor(scene, inventorySystem, profile, handlers) {
    this.scene = scene;
    this.inventorySystem = inventorySystem;
    this.profile = profile;
    this.handlers = handlers;
    this.listings = [];
    this.selectedInventoryItemId = null;
    this.transactionLog = ["Trader stall ready."];

    this.root = scene.add.dom(1020, 472).createFromHTML(this.buildMarkup());
    this.root.setScrollFactor(0);
    this.root.setDepth(1200);
    this.windowBehavior = attachModalWindowBehavior(this.root, {
      minWidth: 460,
      minHeight: 320,
      maxWidth: 980,
      maxHeight: 820,
    });
    this.windowBehavior.setSize(500, 560);

    const node = this.root.node;
    this.getElement('[data-action="close-window"]')?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.handlers.onClose?.();
    });
    node.addEventListener("click", (event) => {
      this.handlers.onUiInteract?.("click");
      this.handleClick(event).catch((error) => {
        this.setStatus(error.message);
        this.handlers.onStatus(error.message);
      });
    });
    node.addEventListener("dragstart", (event) => this.handleDragStart(event));
    node.addEventListener("dragover", (event) => this.handleDragOver(event));
    node.addEventListener("dragleave", () => {
      this.dragHoverMode = null;
      this.renderInventory();
    });
    node.addEventListener("drop", (event) => {
      this.handlers.onUiInteract?.("click");
      this.handleDrop(event).catch((error) => {
        this.setStatus(error.message);
        this.handlers.onStatus(error.message);
      });
    });

    this.render();
    this.setVisibility(false);
  }

  buildMarkup() {
    const inventorySectionStyle = modalSectionStyle();
    const inputStyle = modalInputStyle();
    const insetStyle = modalInsetStyle();
    const badgeStyle = modalBadgeStyle();

    return buildModalShell({
      title: "Grove Trader",
      subtitle: "Buy, sell, and cancel listings from a dedicated trader window.",
      width: 500,
      body: `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start;">
          <section style="${inventorySectionStyle}">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>Sale Stock</strong>
              <span data-selected-item style="${badgeStyle}">No selection</span>
            </div>
            <div data-inventory-grid style="display: grid; gap: 8px; max-height: 198px; overflow: auto;"></div>
            <div data-selected-details style="min-height: 126px; ${insetStyle}">Select an item to inspect it.</div>
          </section>
          <section style="${inventorySectionStyle}">
            <strong>Trade Crate</strong>
            <div style="min-height: 124px; display: grid; gap: 6px; align-content: start; padding: 12px; border: 1px dashed #6f8d7c; border-radius: 14px; color: #b7d2c2; background: rgba(10, 20, 16, 0.6);">
              <strong style="font-size: 14px; color: #f6f2df;">Selected stock</strong>
              <span data-sell-summary style="font-size: 12px; color: #b7d2c2;">Choose an item from your pack to create a listing.</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center;">
              <input name="listingPrice" type="number" min="1" value="25" placeholder="price" style="${inputStyle}" />
              <button type="button" data-action="sell-selected" style="${modalButtonStyle("warning")}">List</button>
            </div>
            <button type="button" data-action="refresh-market" style="${modalButtonStyle("muted")}">Refresh</button>
            <div data-transaction-log style="${insetStyle}"></div>
          </section>
        </div>
        <section style="${inventorySectionStyle}">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong>Trader Wall</strong>
            <span style="${badgeStyle}">Buy / Reserve / Cancel</span>
          </div>
          <div data-market-listings style="display: grid; gap: 8px; max-height: 320px; overflow: auto;"></div>
        </section>
      `,
      footer: `<div data-market-status style="min-height: 18px; font-size: 13px; color: #b7d2c2;">Ready.</div>`,
    });
  }

  getElement(selector) {
    return this.root.node.querySelector(selector);
  }

  getListingPrice() {
    return Number(this.getElement('[name="listingPrice"]')?.value ?? 0);
  }

  setStatus(message) {
    const status = this.getElement("[data-market-status]");
    if (status) {
      status.textContent = message;
    }
  }

  pushTransaction(message) {
    this.transactionLog = [...this.transactionLog, message].slice(-4);
    const log = this.getElement("[data-transaction-log]");
    if (log) {
      log.innerHTML = this.transactionLog.map((entry) => `<div>${entry}</div>`).join("");
    }
  }

  setVisibility(visible) {
    this.root.setVisible(visible);
    this.root.node.style.display = visible ? "grid" : "none";
    this.root.node.style.pointerEvents = visible ? "auto" : "none";
  }

  setListings(listings) {
    this.listings = listings;
    this.renderListings();
  }

  syncInventory() {
    this.renderInventory();
  }

  render() {
    this.renderInventory();
    this.renderListings();
    this.pushTransaction(this.transactionLog[this.transactionLog.length - 1]);
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
      const borderColor = isSelected ? rarityColor(item.rarity) : "#456557";
      const background = isSelected ? "#1d382c" : "#10241c";
      return `
        <button
          type="button"
          data-action="inventory-select"
          data-item-id="${item.id}"
          style="display: grid; gap: 4px; align-content: start; padding: 8px; border-radius: 14px; border: 1px solid ${borderColor}; background: ${background}; color: #f6f2df; cursor: pointer; text-align: left;"
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
            <div style="font-size: 11px; color: #8ea89a;">Use the List button to create a trader entry from this stock.</div>
          </div>
        `
        : "Select an item to inspect it.";
    }

    const sellSummary = this.getElement("[data-sell-summary]");
    if (sellSummary) {
      sellSummary.textContent = selectedItem
        ? `${selectedItem.name} x${selectedItem.quantity} ready for listing.`
        : "Choose an item from your pack to create a listing.";
    }
  }

  renderListings() {
    const container = this.getElement("[data-market-listings]");
    if (!container) {
      return;
    }

    if (!this.listings.length) {
      container.innerHTML = `<div style="${modalInsetStyle()}">No listings yet.</div>`;
      return;
    }

    container.innerHTML = this.listings.map((listing) => `
      <div style="display: grid; gap: 8px; padding: 12px; border-radius: 14px; background: rgba(16, 36, 28, 0.8); border: 1px solid rgba(111, 141, 124, 0.4);">
        <div style="display: flex; justify-content: space-between; gap: 8px; align-items: start;">
          <div style="display: grid; gap: 2px;">
            <strong style="color: ${rarityColor(listing.rarity)};">${listing.itemName}</strong>
            <span style="font-size: 11px; color: #b7d2c2; text-transform: uppercase;">${listing.rarity ?? "common"} ${formatCategory(listing.category)}</span>
          </div>
          <span style="font-size: 16px; color: #f6f2df;">${listing.price}g</span>
        </div>
        <div style="font-size: 12px; color: #d8e5db;">${listing.description || "No description."}</div>
        <div style="font-size: 12px; color: #b7d2c2;">Seller: ${listing.seller} • Qty: ${listing.quantity} • Status: ${listing.status}</div>
        <div style="font-size: 11px; color: #99b9a6;">${listing.escrow?.reservedBy ? `Reserved by ${listing.escrow.reservedBy}` : "Open for trading"}</div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
          <button type="button" data-action="buy-listing" data-listing-id="${listing.listingId}" ${this.isBuyDisabled(listing) ? "disabled" : ""} style="${modalButtonStyle("primary")} ${this.isBuyDisabled(listing) ? "opacity: 0.45; cursor: not-allowed;" : ""}">${this.getBuyLabel(listing)}</button>
          <button type="button" data-action="cancel-listing" data-listing-id="${listing.listingId}" ${this.isCancelDisabled(listing) ? "disabled" : ""} style="${modalButtonStyle("muted")} ${this.isCancelDisabled(listing) ? "opacity: 0.45; cursor: not-allowed;" : ""}">Cancel</button>
        </div>
      </div>
    `).join("");
  }

  isBuyDisabled(listing) {
    return listing.seller === this.profile.username
      || listing.status === "sold"
      || listing.status === "cancelled"
      || (listing.status === "reserved" && listing.escrow?.reservedBy !== this.profile.username);
  }

  isCancelDisabled(listing) {
    return listing.seller !== this.profile.username || listing.status === "sold" || listing.status === "cancelled";
  }

  getBuyLabel(listing) {
    if (listing.owner) {
      return `Owned by ${listing.owner}`;
    }

    if (listing.status === "reserved" && listing.escrow?.reservedBy === this.profile.username) {
      return "Finalize";
    }

    return listing.seller === "Grove Trader" ? "Buy" : "Reserve / Buy";
  }

  handleDragStart() {}

  handleDragOver() {}

  async handleDrop() {}

  async handleClick(event) {
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
      return;
    }

    if (action === "refresh-market") {
      await this.handlers.onRefresh();
      this.pushTransaction("Trader inventory refreshed.");
      return;
    }

    if (action === "sell-selected") {
      if (!this.selectedInventoryItemId) {
        this.setStatus("Choose an item first.");
        return;
      }

      const item = this.inventorySystem.getItem(this.selectedInventoryItemId);
      await this.handlers.onSellItem({
        itemId: this.selectedInventoryItemId,
        price: this.getListingPrice(),
      });
      this.pushTransaction(`Listed ${item?.name ?? this.selectedInventoryItemId} for ${this.getListingPrice()}g.`);
      this.selectedInventoryItemId = null;
      this.renderInventory();
      return;
    }

    if (action === "buy-listing") {
      const listingId = button.dataset.listingId;
      const listing = this.listings.find((entry) => entry.listingId === listingId);
      if (listingId) {
        await this.handlers.onBuyListing({ listingId });
        this.pushTransaction(`Bought ${listing?.itemName ?? listingId}.`);
      }
      return;
    }

    if (action === "cancel-listing") {
      const listingId = button.dataset.listingId;
      const listing = this.listings.find((entry) => entry.listingId === listingId);
      if (listingId) {
        await this.handlers.onCancelListing({ listingId });
        this.pushTransaction(`Cancelled ${listing?.itemName ?? listingId}.`);
      }
    }
  }

  destroy() {
    this.windowBehavior?.destroy();
    this.root?.destroy();
  }
}