import mongoose from "mongoose";

const guildSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, unique: true },
  tag: { type: String, required: true },
  members: [{ type: String }],
  chatLog: [{ author: String, message: String, sentAt: Date }],
}, { timestamps: true });

export const Guild = mongoose.models.Guild ?? mongoose.model("Guild", guildSchema);