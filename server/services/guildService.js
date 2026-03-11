import { isDatabaseConnected } from "../config/database.js";
import { Guild } from "../models/Guild.js";
import { listUserSummaries, updateUserProfile } from "./authService.js";
import { inMemoryStore } from "./inMemoryStore.js";

function toGuildId(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

async function normalizeGuild(record) {
  if (!record) {
    return null;
  }

  const memberProfiles = await listUserSummaries(record.members ?? []);

  return {
    guildId: record.guildId,
    name: record.name,
    tag: record.tag,
    members: [...(record.members ?? [])],
    memberProfiles,
    chatLog: [...(record.chatLog ?? [])],
  };
}

export async function listGuilds() {
  if (isDatabaseConnected()) {
    const guilds = await Guild.find().sort({ updatedAt: -1 }).lean();
    return Promise.all(guilds.map((guild) => normalizeGuild(guild)));
  }

  return Promise.all([...inMemoryStore.guilds.values()].map((guild) => normalizeGuild(guild)));
}

export async function getGuildState(guildId) {
  if (!guildId) {
    return null;
  }

  if (isDatabaseConnected()) {
    return normalizeGuild(await Guild.findOne({ guildId }).lean());
  }

  return normalizeGuild(inMemoryStore.guilds.get(guildId));
}

export async function createGuild(payload) {
  if (!payload.name || !payload.tag || !payload.founder) {
    throw new Error("name, tag and founder are required.");
  }

  const guild = {
    guildId: payload.guildId ?? toGuildId(payload.name),
    name: payload.name,
    tag: String(payload.tag).toUpperCase().slice(0, 5),
    members: [payload.founder],
    chatLog: [],
  };

  if (isDatabaseConnected()) {
    const existing = await Guild.findOne({ guildId: guild.guildId }).lean();
    if (existing) {
      throw new Error("Guild already exists.");
    }

    const created = await Guild.create(guild);
    await updateUserProfile(payload.founder, { guildId: created.guildId });
    return normalizeGuild(created);
  }

  if (inMemoryStore.guilds.has(guild.guildId)) {
    throw new Error("Guild already exists.");
  }

  inMemoryStore.guilds.set(guild.guildId, guild);
  await updateUserProfile(payload.founder, { guildId: guild.guildId });
  return normalizeGuild(guild);
}

export async function joinGuild(guildId, username) {
  const guild = await getGuildState(guildId);
  if (!guild) {
    throw new Error("Guild not found.");
  }

  const members = [...new Set([...guild.members, username])];

  if (isDatabaseConnected()) {
    const guildDoc = await Guild.findOne({ guildId });
    guildDoc.members = members;
    await guildDoc.save();
    await updateUserProfile(username, { guildId });
    return normalizeGuild(guildDoc);
  }

  const next = { ...guild, members };
  inMemoryStore.guilds.set(guildId, next);
  await updateUserProfile(username, { guildId });
  return normalizeGuild(next);
}

export async function addGuildMessage(payload) {
  if (!payload.guildId || !payload.author || !payload.message) {
    throw new Error("guildId, author and message are required.");
  }

  const guild = await getGuildState(payload.guildId);
  if (!guild) {
    throw new Error("Guild not found.");
  }

  const entry = {
    author: payload.author,
    message: payload.message,
    sentAt: payload.sentAt ?? new Date().toISOString(),
  };

  const chatLog = [...guild.chatLog.slice(-24), entry];

  if (isDatabaseConnected()) {
    const guildDoc = await Guild.findOne({ guildId: payload.guildId });
    guildDoc.chatLog = chatLog;
    await guildDoc.save();
    return entry;
  }

  inMemoryStore.guilds.set(payload.guildId, { ...guild, chatLog });
  return entry;
}