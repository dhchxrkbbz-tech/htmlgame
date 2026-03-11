import mongoose from "mongoose";

const marketListingSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  itemName: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  rarity: { type: String, default: "common" },
  category: { type: String, default: "misc" },
  description: { type: String, default: "" },
  value: { type: Number, default: 0 },
  seller: { type: String, required: true },
  owner: { type: String, default: null },
  listingId: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ["open", "reserved", "sold", "cancelled"],
    default: "open",
    index: true,
  },
  escrow: {
    reservedBy: { type: String, default: null },
    reservedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  auditLog: [
    {
      action: { type: String, required: true },
      actor: { type: String, required: true },
      at: { type: Date, required: true },
      details: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
  ],
}, { timestamps: true });

export const MarketListing = mongoose.models.MarketListing ?? mongoose.model("MarketListing", marketListingSchema);