import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  classKey: { type: String, required: true },
  stats: {
    maxHealth: Number,
    health: Number,
    maxMana: Number,
    mana: Number,
    power: Number,
    defense: Number,
    speed: Number,
  },
  progression: {
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    xpToNextLevel: { type: Number, default: 100 },
  },
  inventory: [{
    id: String,
    name: String,
    quantity: Number,
    rarity: String,
    category: String,
    description: String,
    value: Number,
    stackable: Boolean,
  }],
  partyId: { type: String, default: null },
  guildId: { type: String, default: null },
}, { timestamps: true });

export const User = mongoose.models.User ?? mongoose.model("User", userSchema);