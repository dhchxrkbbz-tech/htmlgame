import { isDatabaseConnected } from "../config/database.js";
import { User } from "../models/User.js";
import { MarketListing } from "../models/MarketListing.js";
import { inMemoryStore } from "./inMemoryStore.js";
import { DEMO_MARKET_CATALOG, createTraderListing } from "../../shared/demoContent.js";

const ESCROW_WINDOW_MS = 5 * 60 * 1000;
const DEMO_TRADER_NAME = "Grove Trader";

function createListingId(itemId, seller) {
  return `${seller}-${itemId}-${Date.now()}`;
}

function normalizeListing(record) {
  if (!record) {
    return null;
  }

  const listing = typeof record.toObject === "function" ? record.toObject() : record;
  return {
    listingId: listing.listingId,
    itemId: listing.itemId,
    itemName: listing.itemName,
    quantity: listing.quantity,
    price: listing.price,
    rarity: listing.rarity ?? "common",
    category: listing.category ?? "misc",
    description: listing.description ?? "",
    value: Number(listing.value ?? 0),
    seller: listing.seller,
    owner: listing.owner ?? null,
    status: listing.status ?? "open",
    escrow: {
      reservedBy: listing.escrow?.reservedBy ?? null,
      reservedAt: listing.escrow?.reservedAt ?? null,
      expiresAt: listing.escrow?.expiresAt ?? null,
    },
    auditLog: [...(listing.auditLog ?? [])],
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  };
}

function validateListingPayload(payload) {
  if (!payload.itemId || !payload.seller) {
    throw new Error("itemId and seller are required.");
  }

  if (!Number.isFinite(Number(payload.quantity)) || Number(payload.quantity) <= 0) {
    throw new Error("quantity must be greater than zero.");
  }

  if (!Number.isFinite(Number(payload.price)) || Number(payload.price) <= 0) {
    throw new Error("price must be greater than zero.");
  }
}

function clearEscrow(listing) {
  listing.escrow = {
    reservedBy: null,
    reservedAt: null,
    expiresAt: null,
  };
  return listing;
}

function appendAuditEntry(listing, action, actor, details = {}) {
  listing.auditLog = [
    ...(listing.auditLog ?? []),
    {
      action,
      actor,
      at: new Date().toISOString(),
      details,
    },
  ];
  return listing;
}

function isEscrowExpired(listing) {
  const expiresAt = listing?.escrow?.expiresAt ? new Date(listing.escrow.expiresAt).getTime() : 0;
  return Boolean(expiresAt) && expiresAt <= Date.now();
}

function applyEscrowTimeout(listing) {
  if (!listing) {
    return listing;
  }

  if (listing.status === "reserved" && isEscrowExpired(listing)) {
    const reservedBy = listing.escrow?.reservedBy ?? null;
    listing.status = "open";
    clearEscrow(listing);
    appendAuditEntry(listing, "escrow-released", "system", {
      reason: "expired",
      reservedBy,
    });
  }

  return listing;
}

async function refreshListingRecord(listing) {
  if (!listing) {
    return null;
  }

  const beforeStatus = listing.status;
  const beforeReservedBy = listing.escrow?.reservedBy ?? null;
  applyEscrowTimeout(listing);

  if (listing.status === beforeStatus && (listing.escrow?.reservedBy ?? null) === beforeReservedBy) {
    return listing;
  }

  if (isDatabaseConnected()) {
    await listing.save();
    return listing;
  }

  inMemoryStore.marketListings.set(listing.listingId, listing);
  return listing;
}

async function getUserRecord(username) {
  if (isDatabaseConnected()) {
    return User.findOne({ username });
  }

  return inMemoryStore.users.get(username) ?? null;
}

async function saveUserRecord(user) {
  if (isDatabaseConnected()) {
    await user.save();
    return user;
  }

  inMemoryStore.users.set(user.username, user);
  return user;
}

async function ensureDemoMarketListings() {
  if (isDatabaseConnected()) {
    const traderCount = await MarketListing.countDocuments({ seller: DEMO_TRADER_NAME });
    if (!traderCount) {
      await MarketListing.insertMany(DEMO_MARKET_CATALOG.map((entry) => createTraderListing(entry, DEMO_TRADER_NAME)));
    }
    return;
  }

  const hasTraderListings = [...inMemoryStore.marketListings.values()].some((listing) => listing.seller === DEMO_TRADER_NAME);
  if (hasTraderListings) {
    return;
  }

  DEMO_MARKET_CATALOG.forEach((entry) => {
    const listing = createTraderListing(entry, DEMO_TRADER_NAME);
    inMemoryStore.marketListings.set(listing.listingId, listing);
  });
}

function findInventoryItem(user, itemId) {
  return user.inventory.find((item) => item.id === itemId) ?? null;
}

function snapshotOwnedListingItem(user, itemId, quantity) {
  const item = findInventoryItem(user, itemId);
  if (!item || item.quantity < quantity) {
    throw new Error("Seller does not own enough of this item.");
  }

  return {
    itemId: item.id,
    itemName: item.name,
    quantity: Number(quantity),
    rarity: item.rarity ?? "common",
    category: item.category ?? "misc",
    description: item.description ?? "",
    value: Number(item.value ?? 0),
  };
}

async function removeInventoryItem(username, itemId, quantity) {
  const user = await getUserRecord(username);
  if (!user) {
    throw new Error("Seller not found.");
  }

  const item = findInventoryItem(user, itemId);
  if (!item || item.quantity < quantity) {
    throw new Error("Seller does not own enough of this item.");
  }

  item.quantity -= quantity;
  if (item.quantity <= 0) {
    user.inventory = user.inventory.filter((entry) => entry.id !== itemId);
  }

  await saveUserRecord(user);
}

async function addInventoryItem(username, item) {
  const user = await getUserRecord(username);
  if (!user) {
    throw new Error("User not found.");
  }

  const existing = findInventoryItem(user, item.id);
  if (existing && existing.stackable !== false && item.stackable !== false) {
    existing.quantity += item.quantity;
  } else {
    user.inventory.push(item);
  }

  await saveUserRecord(user);
}

async function readAllListings() {
  await ensureDemoMarketListings();

  if (isDatabaseConnected()) {
    const listings = await MarketListing.find().sort({ createdAt: -1 });
    return Promise.all(listings.map((listing) => refreshListingRecord(listing)));
  }

  return Promise.all([...inMemoryStore.marketListings.values()].map((listing) => refreshListingRecord(listing)));
}

async function getListingRecord(listingId) {
  if (isDatabaseConnected()) {
    return refreshListingRecord(await MarketListing.findOne({ listingId }));
  }

  return refreshListingRecord(inMemoryStore.marketListings.get(listingId));
}

async function persistListing(listing) {
  if (isDatabaseConnected()) {
    await listing.save();
    return normalizeListing(listing);
  }

  inMemoryStore.marketListings.set(listing.listingId, listing);
  return normalizeListing(listing);
}

export async function listMarketListings() {
  const listings = await readAllListings();
  return listings.map((listing) => normalizeListing(listing));
}

export async function createMarketListing(payload) {
  validateListingPayload(payload);

  const seller = await getUserRecord(payload.seller);
  if (!seller) {
    throw new Error("Seller not found.");
  }

  const itemSnapshot = snapshotOwnedListingItem(seller, payload.itemId, Number(payload.quantity));

  await removeInventoryItem(payload.seller, payload.itemId, Number(payload.quantity));

  const listingPayload = {
    listingId: payload.listingId ?? createListingId(payload.itemId, payload.seller),
    itemId: itemSnapshot.itemId,
    itemName: itemSnapshot.itemName,
    quantity: itemSnapshot.quantity,
    price: Number(payload.price),
    rarity: itemSnapshot.rarity,
    category: itemSnapshot.category,
    description: itemSnapshot.description,
    value: itemSnapshot.value,
    seller: payload.seller,
    owner: null,
    status: "open",
    escrow: clearEscrow({}).escrow,
    auditLog: [{
      action: "listing-created",
      actor: payload.seller,
      at: new Date().toISOString(),
      details: {
        quantity: itemSnapshot.quantity,
        price: Number(payload.price),
      },
    }],
  };

  if (isDatabaseConnected()) {
    return normalizeListing(await MarketListing.create(listingPayload));
  }

  inMemoryStore.marketListings.set(listingPayload.listingId, listingPayload);
  return normalizeListing(listingPayload);
}

export async function reserveListing(listingId, buyer) {
  const listing = await getListingRecord(listingId);
  if (!listing) {
    throw new Error("Listing not found.");
  }

  if (listing.seller === buyer) {
    throw new Error("Seller cannot reserve their own listing.");
  }

  if (listing.status === "sold" || listing.status === "cancelled") {
    throw new Error("Listing is closed.");
  }

  if (listing.status === "reserved" && listing.escrow?.reservedBy !== buyer) {
    throw new Error("Listing is already reserved.");
  }

  const reservedAt = new Date();
  listing.status = "reserved";
  listing.escrow = {
    reservedBy: buyer,
    reservedAt,
    expiresAt: new Date(reservedAt.getTime() + ESCROW_WINDOW_MS),
  };
  appendAuditEntry(listing, "listing-reserved", buyer, {
    seller: listing.seller,
    expiresAt: listing.escrow.expiresAt,
  });

  return persistListing(listing);
}

export async function releaseReservedListing(listingId, buyer, reason = "manual") {
  const listing = await getListingRecord(listingId);
  if (!listing) {
    throw new Error("Listing not found.");
  }

  if (listing.status !== "reserved") {
    throw new Error("Only reserved listings can be released.");
  }

  if (listing.escrow?.reservedBy !== buyer) {
    throw new Error("Only the active buyer can release this escrow.");
  }

  listing.status = "open";
  clearEscrow(listing);
  appendAuditEntry(listing, "escrow-released", buyer, { reason });
  return persistListing(listing);
}

export async function getListingAudit(listingId) {
  const listing = await getListingRecord(listingId);
  if (!listing) {
    throw new Error("Listing not found.");
  }

  return [...(listing.auditLog ?? [])];
}

export async function finalizeListingPurchase(listingId, buyer) {
  const listing = await getListingRecord(listingId);
  if (!listing) {
    throw new Error("Listing not found.");
  }

  if (listing.seller === buyer) {
    throw new Error("Seller cannot buy their own listing.");
  }

  if (listing.status === "sold" || listing.status === "cancelled") {
    throw new Error("Listing is closed.");
  }

  if (listing.status === "reserved" && listing.escrow?.reservedBy !== buyer) {
    throw new Error("Listing is reserved by another buyer.");
  }

  if (listing.status === "open") {
    await reserveListing(listingId, buyer);
    return finalizeListingPurchase(listingId, buyer);
  }

  await addInventoryItem(buyer, {
    id: listing.itemId,
    name: listing.itemName,
    quantity: listing.quantity,
    rarity: listing.rarity ?? "market",
    category: listing.category ?? "misc",
    description: listing.description ?? "",
    value: Number(listing.value ?? 0),
    stackable: listing.category !== "weapon" && listing.category !== "armor",
  });

  listing.owner = buyer;
  listing.status = "sold";
  clearEscrow(listing);
  appendAuditEntry(listing, "listing-purchased", buyer, {
    seller: listing.seller,
    quantity: listing.quantity,
  });
  return persistListing(listing);
}

export async function cancelListing(listingId, seller) {
  const listing = await getListingRecord(listingId);
  if (!listing) {
    throw new Error("Listing not found.");
  }

  if (listing.seller !== seller) {
    throw new Error("Only the seller can cancel this listing.");
  }

  if (listing.status === "sold") {
    throw new Error("Sold listings cannot be cancelled.");
  }

  if (listing.status === "reserved" && listing.escrow?.reservedBy) {
    throw new Error("Reserved listings cannot be cancelled while escrow is active.");
  }

  await addInventoryItem(seller, {
    id: listing.itemId,
    name: listing.itemName,
    quantity: listing.quantity,
    rarity: listing.rarity ?? "market",
    category: listing.category ?? "misc",
    description: listing.description ?? "",
    value: Number(listing.value ?? 0),
    stackable: listing.category !== "weapon" && listing.category !== "armor",
  });

  listing.status = "cancelled";
  clearEscrow(listing);
  appendAuditEntry(listing, "listing-cancelled", seller, {
    owner: listing.owner ?? null,
  });

  return persistListing(listing);
}
