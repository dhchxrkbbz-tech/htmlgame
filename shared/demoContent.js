export const DEMO_ITEM_DEFINITIONS = {
  "starter-potion": {
    id: "starter-potion",
    name: "Starter Potion",
    rarity: "common",
    category: "consumable",
    description: "A cheap red tonic used by fresh recruits to patch up after a rough pull.",
    value: 12,
    stackable: true,
  },
  "field-ration": {
    id: "field-ration",
    name: "Field Ration",
    rarity: "common",
    category: "consumable",
    description: "Dry travel food packed for tutorial runs and safe camp breaks.",
    value: 8,
    stackable: true,
  },
  "mana-herb": {
    id: "mana-herb",
    name: "Mana Herb",
    rarity: "common",
    category: "reagent",
    description: "A soft blue herb that sharpens focus and keeps spellcasting sustainable.",
    value: 14,
    stackable: true,
  },
  "arcane-shard": {
    id: "arcane-shard",
    name: "Arcane Shard",
    rarity: "uncommon",
    category: "crafting",
    description: "A crystal splinter humming with tutorial-grove leyline residue.",
    value: 28,
    stackable: true,
  },
  "ward-scroll": {
    id: "ward-scroll",
    name: "Ward Scroll",
    rarity: "uncommon",
    category: "utility",
    description: "A single-use blessing script prized by party leaders before a pull.",
    value: 36,
    stackable: true,
  },
  "crystal-tonic": {
    id: "crystal-tonic",
    name: "Crystal Tonic",
    rarity: "rare",
    category: "consumable",
    description: "An expensive shimmering draught distilled from grove crystal dust.",
    value: 64,
    stackable: true,
  },
  "iron-sword": {
    id: "iron-sword",
    name: "Iron Sword",
    rarity: "uncommon",
    category: "weapon",
    description: "A balanced training blade issued to warrior initiates.",
    value: 52,
    stackable: false,
  },
  "oak-wand": {
    id: "oak-wand",
    name: "Oak Wand",
    rarity: "uncommon",
    category: "weapon",
    description: "A carved wand that stabilizes low-tier arcane bolts.",
    value: 50,
    stackable: false,
  },
  "trailbow-kit": {
    id: "trailbow-kit",
    name: "Trailbow Kit",
    rarity: "uncommon",
    category: "weapon",
    description: "A ranger field kit with spare string, fletching wax, and a compact bow.",
    value: 49,
    stackable: false,
  },
  "sun-cloth": {
    id: "sun-cloth",
    name: "Sun Cloth",
    rarity: "uncommon",
    category: "armor",
    description: "A light sacred mantle woven for cleric novices and camp healers.",
    value: 46,
    stackable: false,
  },
  "camp-bandage": {
    id: "camp-bandage",
    name: "Camp Bandage",
    rarity: "common",
    category: "utility",
    description: "A quick-wrap field bandage stocked near the campfire for safe tutorial resets.",
    value: 11,
    stackable: true,
  },
  "hunter-charm": {
    id: "hunter-charm",
    name: "Hunter Charm",
    rarity: "rare",
    category: "trinket",
    description: "A polished grove token worn by scouts to sharpen focus during fast pulls.",
    value: 68,
    stackable: false,
  },
};

const STARTER_LOADOUT_BY_CLASS = {
  warrior: [
    ["starter-potion", 3],
    ["field-ration", 2],
    ["camp-bandage", 1],
    ["mana-herb", 2],
    ["arcane-shard", 1],
    ["ward-scroll", 1],
    ["iron-sword", 1],
  ],
  mage: [
    ["starter-potion", 3],
    ["field-ration", 2],
    ["mana-herb", 3],
    ["arcane-shard", 2],
    ["hunter-charm", 1],
    ["ward-scroll", 1],
    ["oak-wand", 1],
  ],
  ranger: [
    ["starter-potion", 3],
    ["field-ration", 3],
    ["mana-herb", 1],
    ["hunter-charm", 1],
    ["arcane-shard", 1],
    ["ward-scroll", 1],
    ["trailbow-kit", 1],
  ],
  cleric: [
    ["starter-potion", 2],
    ["field-ration", 2],
    ["camp-bandage", 2],
    ["mana-herb", 2],
    ["arcane-shard", 1],
    ["ward-scroll", 2],
    ["sun-cloth", 1],
  ],
};

export const DEMO_MARKET_CATALOG = [
  { listingId: "trader-starter-potion", itemId: "starter-potion", quantity: 4, price: 16 },
  { listingId: "trader-field-ration", itemId: "field-ration", quantity: 5, price: 10 },
  { listingId: "trader-mana-herb", itemId: "mana-herb", quantity: 4, price: 20 },
  { listingId: "trader-arcane-shard", itemId: "arcane-shard", quantity: 2, price: 42 },
  { listingId: "trader-ward-scroll", itemId: "ward-scroll", quantity: 2, price: 54 },
  { listingId: "trader-crystal-tonic", itemId: "crystal-tonic", quantity: 1, price: 88 },
  { listingId: "trader-camp-bandage", itemId: "camp-bandage", quantity: 5, price: 15 },
  { listingId: "trader-hunter-charm", itemId: "hunter-charm", quantity: 1, price: 96 },
];

export function getDemoItemDefinition(itemId) {
  const definition = DEMO_ITEM_DEFINITIONS[itemId];
  if (!definition) {
    throw new Error(`Unknown demo item: ${itemId}`);
  }

  return { ...definition };
}

export function createInventoryItem(itemId, quantity = 1, overrides = {}) {
  const definition = getDemoItemDefinition(itemId);
  return {
    ...definition,
    quantity,
    ...overrides,
  };
}

export function createStarterInventory(classKey) {
  const loadout = STARTER_LOADOUT_BY_CLASS[classKey] ?? STARTER_LOADOUT_BY_CLASS.warrior;
  return loadout.map(([itemId, quantity]) => createInventoryItem(itemId, quantity));
}

export function createTraderListing(entry, seller = "Grove Trader") {
  const item = createInventoryItem(entry.itemId, entry.quantity);
  return {
    listingId: entry.listingId,
    itemId: item.id,
    itemName: item.name,
    quantity: item.quantity,
    price: entry.price,
    seller,
    owner: null,
    rarity: item.rarity,
    category: item.category,
    description: item.description,
    value: item.value,
    status: "open",
    escrow: {
      reservedBy: null,
      reservedAt: null,
      expiresAt: null,
    },
  };
}