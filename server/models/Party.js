import mongoose from "mongoose";

const partySchema = new mongoose.Schema({
  partyId: { type: String, required: true, unique: true },
  leader: { type: String, required: true },
  members: [{ type: String }],
  pendingInvites: [{ username: String, invitedBy: String, invitedAt: Date }],
  sharedLoot: [{ itemId: String, name: String, quantity: Number }],
  sharedXp: { type: Number, default: 0 },
}, { timestamps: true });

export const Party = mongoose.models.Party ?? mongoose.model("Party", partySchema);