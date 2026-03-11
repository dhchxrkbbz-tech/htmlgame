import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { isDatabaseConnected } from "../config/database.js";
import { User } from "../models/User.js";
import { inMemoryStore } from "./inMemoryStore.js";
import { createStarterInventory } from "../../shared/demoContent.js";
import { createDefaultProgression } from "../../shared/progression.js";

const registerSchema = z.object({
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(64),
  classKey: z.enum(["warrior", "mage", "ranger", "cleric"]),
});

const loginSchema = registerSchema.omit({ classKey: true });

function createDefaultProfile(payload) {
  return {
    username: payload.username,
    classKey: payload.classKey,
    stats: {
      maxHealth: 120,
      health: 120,
      maxMana: 80,
      mana: 80,
      power: 18,
      defense: 8,
      speed: 180,
    },
    progression: createDefaultProgression(),
    inventory: createStarterInventory(payload.classKey),
    partyId: `${payload.username}-party`,
    guildId: null,
  };
}

function signToken(profile) {
  return jwt.sign({ sub: profile.username, classKey: profile.classKey }, env.jwtSecret, { expiresIn: "12h" });
}

function toPublicProfile(stored) {
  if (!stored) {
    return null;
  }

  return {
    username: stored.username,
    classKey: stored.classKey,
    stats: stored.stats,
    progression: stored.progression,
    inventory: stored.inventory,
    partyId: stored.partyId,
    guildId: stored.guildId,
  };
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

export async function registerUser(payload) {
  const parsed = registerSchema.parse(payload);
  const passwordHash = await bcrypt.hash(parsed.password, 10);
  const profile = createDefaultProfile(parsed);

  if (isDatabaseConnected()) {
    const existing = await User.findOne({ username: parsed.username }).lean();
    if (existing) {
      throw new Error("Username already exists.");
    }

    await User.create({ ...profile, passwordHash });
  } else {
    if (inMemoryStore.users.has(parsed.username)) {
      throw new Error("Username already exists.");
    }

    inMemoryStore.users.set(parsed.username, { ...profile, passwordHash });
  }

  return {
    token: signToken(profile),
    profile,
  };
}

export async function loginUser(payload) {
  const parsed = loginSchema.parse(payload);
  const stored = isDatabaseConnected()
    ? await User.findOne({ username: parsed.username })
    : inMemoryStore.users.get(parsed.username);

  if (!stored) {
    throw new Error("Invalid credentials.");
  }

  const passwordHash = stored.passwordHash;
  const validPassword = await bcrypt.compare(parsed.password, passwordHash);
  if (!validPassword) {
    throw new Error("Invalid credentials.");
  }

  const profile = toPublicProfile(stored);

  return {
    token: signToken(profile),
    profile,
  };
}

export async function updateUserProfile(username, patch) {
  if (!username) {
    return null;
  }

  const allowedPatch = Object.fromEntries(
    Object.entries(patch ?? {}).filter(([, value]) => value !== undefined),
  );

  if (isDatabaseConnected()) {
    const user = await User.findOne({ username });
    if (!user) {
      return null;
    }

    Object.assign(user, allowedPatch);
    await user.save();
    return toPublicProfile(user);
  }

  const user = inMemoryStore.users.get(username);
  if (!user) {
    return null;
  }

  Object.assign(user, allowedPatch);
  inMemoryStore.users.set(username, user);
  return toPublicProfile(user);
}

export async function listUserSummaries(usernames = []) {
  const uniqueUsernames = [...new Set(usernames.filter(Boolean))];
  if (!uniqueUsernames.length) {
    return [];
  }

  if (isDatabaseConnected()) {
    const users = await User.find({ username: { $in: uniqueUsernames } }).lean();
    return uniqueUsernames.map((username) => {
      const user = users.find((candidate) => candidate.username === username);
      return {
        username,
        classKey: user?.classKey ?? "unknown",
        level: user?.progression?.level ?? 1,
      };
    });
  }

  return uniqueUsernames.map((username) => {
    const user = inMemoryStore.users.get(username);
    return {
      username,
      classKey: user?.classKey ?? "unknown",
      level: user?.progression?.level ?? 1,
    };
  });
}