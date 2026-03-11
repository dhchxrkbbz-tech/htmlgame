import { beforeEach, describe, expect, it } from "vitest";
import { inMemoryStore } from "../server/services/inMemoryStore.js";
import { cancelListing, createMarketListing, finalizeListingPurchase, getListingAudit, listMarketListings, releaseReservedListing, reserveListing } from "../server/services/marketplaceService.js";

function createUser(username, inventory) {
  inMemoryStore.users.set(username, {
    username,
    inventory: [...inventory],
  });
}

describe("marketplaceService", () => {
  beforeEach(() => {
    inMemoryStore.marketListings.clear();
    inMemoryStore.users.clear();
  });

  it("moves seller inventory into an open listing", async () => {
    createUser("seller", [{ id: "starter-potion", name: "Starter Potion", quantity: 3, rarity: "common" }]);

    const listing = await createMarketListing({
      itemId: "starter-potion",
      itemName: "Starter Potion",
      quantity: 2,
      price: 15,
      seller: "seller",
    });

    expect(listing.status).toBe("open");
    expect(inMemoryStore.users.get("seller").inventory[0].quantity).toBe(1);
  });

  it("reserves and completes a purchase with escrow rules", async () => {
    createUser("seller", [{ id: "mana-herb", name: "Mana Herb", quantity: 2, rarity: "common" }]);
    createUser("buyer", []);

    const listing = await createMarketListing({
      itemId: "mana-herb",
      itemName: "Mana Herb",
      quantity: 1,
      price: 25,
      seller: "seller",
    });

    const reserved = await reserveListing(listing.listingId, "buyer");
    expect(reserved.status).toBe("reserved");

    const purchased = await finalizeListingPurchase(listing.listingId, "buyer");
    expect(purchased.status).toBe("sold");
    expect(inMemoryStore.users.get("buyer").inventory[0].id).toBe("mana-herb");
    expect(inMemoryStore.users.get("buyer").inventory[0].rarity).toBe("common");
  });

  it("returns items to the seller on cancellation", async () => {
    createUser("seller", [{ id: "iron-sword", name: "Iron Sword", quantity: 1, rarity: "uncommon" }]);

    const listing = await createMarketListing({
      itemId: "iron-sword",
      itemName: "Iron Sword",
      quantity: 1,
      price: 100,
      seller: "seller",
    });

    const cancelled = await cancelListing(listing.listingId, "seller");
    expect(cancelled.status).toBe("cancelled");
    expect(inMemoryStore.users.get("seller").inventory[0].id).toBe("iron-sword");
  });

  it("uses the seller-owned item metadata for listings", async () => {
    createUser("seller", [{
      id: "iron-sword",
      name: "Iron Sword",
      quantity: 1,
      rarity: "uncommon",
      category: "weapon",
      description: "A balanced training blade.",
      value: 52,
    }]);

    const listing = await createMarketListing({
      itemId: "iron-sword",
      itemName: "Fake Legendary Sword",
      quantity: 1,
      price: 100,
      rarity: "rare",
      category: "artifact",
      description: "spoofed",
      value: 999,
      seller: "seller",
    });

    expect(listing.itemName).toBe("Iron Sword");
    expect(listing.rarity).toBe("uncommon");
    expect(listing.category).toBe("weapon");
    expect(listing.value).toBe(52);
  });

  it("blocks cancelling an actively reserved listing", async () => {
    createUser("seller", [{ id: "mana-herb", name: "Mana Herb", quantity: 2, rarity: "common", category: "reagent" }]);
    createUser("buyer", []);

    const listing = await createMarketListing({
      itemId: "mana-herb",
      itemName: "Mana Herb",
      quantity: 1,
      price: 25,
      seller: "seller",
    });

    await reserveListing(listing.listingId, "buyer");

    await expect(cancelListing(listing.listingId, "seller")).rejects.toThrow(/reserved listings cannot be cancelled/i);
  });

  it("releases an active escrow back to open state", async () => {
    createUser("seller", [{ id: "mana-herb", name: "Mana Herb", quantity: 2, rarity: "common", category: "reagent" }]);
    createUser("buyer", []);

    const listing = await createMarketListing({
      itemId: "mana-herb",
      itemName: "Mana Herb",
      quantity: 1,
      price: 25,
      seller: "seller",
    });

    await reserveListing(listing.listingId, "buyer");
    const released = await releaseReservedListing(listing.listingId, "buyer", "changed-mind");

    expect(released.status).toBe("open");
    expect(released.escrow.reservedBy).toBeNull();
  });

  it("records an ownership audit trail for listing lifecycle events", async () => {
    createUser("seller", [{ id: "mana-herb", name: "Mana Herb", quantity: 2, rarity: "common", category: "reagent" }]);
    createUser("buyer", []);

    const listing = await createMarketListing({
      itemId: "mana-herb",
      itemName: "Mana Herb",
      quantity: 1,
      price: 25,
      seller: "seller",
    });

    await reserveListing(listing.listingId, "buyer");
    await finalizeListingPurchase(listing.listingId, "buyer");
    const auditLog = await getListingAudit(listing.listingId);

    expect(auditLog.map((entry) => entry.action)).toEqual([
      "listing-created",
      "listing-reserved",
      "listing-purchased",
    ]);
    expect(auditLog.at(-1)?.actor).toBe("buyer");
  });

  it("lists current market state with listing ids", async () => {
    createUser("seller", [{ id: "field-ration", name: "Field Ration", quantity: 2, rarity: "common" }]);
    await createMarketListing({
      itemId: "field-ration",
      itemName: "Field Ration",
      quantity: 1,
      price: 10,
      seller: "seller",
    });

    const listings = await listMarketListings();
    expect(listings.some((listing) => listing.listingId)).toBe(true);
    expect(listings.some((listing) => listing.seller === "Grove Trader")).toBe(true);
  });
});