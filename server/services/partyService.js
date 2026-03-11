import { isDatabaseConnected } from "../config/database.js";
import { Party } from "../models/Party.js";
import { listUserSummaries, updateUserProfile } from "./authService.js";
import { inMemoryStore } from "./inMemoryStore.js";

function uniqueMembers(members = []) {
  return [...new Set(members.filter(Boolean))];
}

function toPartyRecord(payload) {
  return {
    partyId: payload.partyId,
    leader: payload.leader,
    members: uniqueMembers(payload.members ?? [payload.leader]),
    pendingInvites: [...(payload.pendingInvites ?? [])],
    sharedLoot: [...(payload.sharedLoot ?? [])],
    sharedXp: Number(payload.sharedXp ?? 0),
  };
}

async function normalizeParty(record) {
  if (!record) {
    return null;
  }

  const memberProfiles = await listUserSummaries(record.members ?? []);

  return {
    partyId: record.partyId,
    leader: record.leader,
    members: [...(record.members ?? [])],
    memberProfiles,
    pendingInvites: [...(record.pendingInvites ?? [])],
    sharedLoot: [...(record.sharedLoot ?? [])],
    sharedXp: Number(record.sharedXp ?? 0),
  };
}

async function syncKnownMemberProfiles(partyId, members = []) {
  await Promise.all(members.map((member) => updateUserProfile(member, { partyId })));
}

export async function listParties() {
  if (isDatabaseConnected()) {
    const parties = await Party.find().sort({ updatedAt: -1 }).lean();
    return Promise.all(parties.map((party) => normalizeParty(party)));
  }

  return Promise.all([...inMemoryStore.parties.values()].map((party) => normalizeParty(party)));
}

export async function getPartyState(partyId) {
  if (!partyId) {
    return null;
  }

  if (isDatabaseConnected()) {
    return normalizeParty(await Party.findOne({ partyId }).lean());
  }

  return normalizeParty(inMemoryStore.parties.get(partyId));
}

export async function createParty(payload) {
  if (!payload.partyId || !payload.leader) {
    throw new Error("partyId and leader are required.");
  }

  const partyRecord = toPartyRecord(payload);

  if (isDatabaseConnected()) {
    const existing = await Party.findOne({ partyId: partyRecord.partyId }).lean();
    if (existing) {
      throw new Error("Party already exists.");
    }

    const created = await Party.create(partyRecord);
    await syncKnownMemberProfiles(created.partyId, created.members);
    return normalizeParty(created);
  }

  if (inMemoryStore.parties.has(partyRecord.partyId)) {
    throw new Error("Party already exists.");
  }

  inMemoryStore.parties.set(partyRecord.partyId, partyRecord);
  await syncKnownMemberProfiles(partyRecord.partyId, partyRecord.members);
  return normalizeParty(partyRecord);
}

export async function syncPartyState(payload) {
  const current = await getPartyState(payload.partyId);
  if (!current) {
    return createParty(payload);
  }

  const nextState = toPartyRecord({
    ...current,
    ...payload,
    members: payload.members ?? current.members,
    sharedLoot: payload.sharedLoot ?? current.sharedLoot,
    sharedXp: payload.sharedXp ?? current.sharedXp,
  });

  if (isDatabaseConnected()) {
    const party = await Party.findOne({ partyId: payload.partyId });
    Object.assign(party, nextState);
    await party.save();
    await syncKnownMemberProfiles(party.partyId, party.members);
    return normalizeParty(party);
  }

  inMemoryStore.parties.set(payload.partyId, nextState);
  await syncKnownMemberProfiles(payload.partyId, nextState.members);
  return normalizeParty(nextState);
}

export async function inviteToParty(partyId, invitedBy, username) {
  if (!partyId || !invitedBy || !username) {
    throw new Error("partyId, invitedBy and username are required.");
  }

  const party = await getPartyState(partyId);
  if (!party) {
    throw new Error("Party not found.");
  }

  if (!party.members.includes(invitedBy)) {
    throw new Error("Only party members can invite players.");
  }

  if (party.members.includes(username)) {
    throw new Error("Player is already in the party.");
  }

  if ((party.pendingInvites ?? []).some((invite) => invite.username === username)) {
    throw new Error("Player already has a pending invite.");
  }

  return syncPartyState({
    ...party,
    pendingInvites: [...(party.pendingInvites ?? []), {
      username,
      invitedBy,
      invitedAt: new Date().toISOString(),
    }],
  });
}

export async function acceptPartyInvite(partyId, username) {
  if (!partyId || !username) {
    throw new Error("partyId and username are required.");
  }

  const party = await getPartyState(partyId);
  if (!party) {
    throw new Error("Party not found.");
  }

  const invite = (party.pendingInvites ?? []).find((entry) => entry.username === username);
  if (!invite) {
    throw new Error("No pending invite found.");
  }

  return syncPartyState({
    ...party,
    members: [...party.members, username],
    pendingInvites: (party.pendingInvites ?? []).filter((entry) => entry.username !== username),
  });
}

export async function addSharedLoot(partyId, item) {
  const party = await getPartyState(partyId);
  if (!party) {
    throw new Error("Party not found.");
  }

  const sharedLoot = [...party.sharedLoot, item];
  return syncPartyState({ ...party, sharedLoot });
}

export async function awardSharedXp(partyId, amount) {
  const party = await getPartyState(partyId);
  if (!party) {
    throw new Error("Party not found.");
  }

  return syncPartyState({ ...party, sharedXp: party.sharedXp + Number(amount ?? 0) });
}