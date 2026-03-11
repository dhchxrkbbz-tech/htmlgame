import { beforeEach, describe, expect, it } from "vitest";
import { inMemoryStore } from "../server/services/inMemoryStore.js";
import { acceptPartyInvite, addSharedLoot, awardSharedXp, createParty, getPartyState, inviteToParty, syncPartyState } from "../server/services/partyService.js";

describe("partyService", () => {
  beforeEach(() => {
    inMemoryStore.parties.clear();
    inMemoryStore.users.clear();
  });

  it("creates and syncs a shared party state", async () => {
    await createParty({
      partyId: "alpha-party",
      leader: "alpha",
      members: ["alpha", "beta"],
    });

    const synced = await syncPartyState({
      partyId: "alpha-party",
      leader: "alpha",
      members: ["alpha", "beta", "gamma"],
      sharedXp: 120,
    });

    expect(synced.members).toContain("gamma");
    expect(synced.sharedXp).toBe(120);
  });

  it("tracks shared loot and xp updates", async () => {
    await createParty({
      partyId: "beta-party",
      leader: "beta",
      members: ["beta"],
    });

    await addSharedLoot("beta-party", { itemId: "slime-gel", name: "Slime Gel", quantity: 1 });
    await awardSharedXp("beta-party", 45);

    const party = await getPartyState("beta-party");
    expect(party.sharedLoot).toHaveLength(1);
    expect(party.sharedXp).toBe(45);
  });

  it("updates known member profiles with the active party id", async () => {
    inMemoryStore.users.set("alpha", { username: "alpha", partyId: null, inventory: [], classKey: "warrior", progression: { level: 1 } });
    inMemoryStore.users.set("beta", { username: "beta", partyId: null, inventory: [], classKey: "mage", progression: { level: 2 } });

    await createParty({
      partyId: "alpha-party",
      leader: "alpha",
      members: ["alpha", "beta"],
    });

    expect(inMemoryStore.users.get("alpha")?.partyId).toBe("alpha-party");
    expect(inMemoryStore.users.get("beta")?.partyId).toBe("alpha-party");
  });

  it("tracks invite and accept flow with member summaries", async () => {
    inMemoryStore.users.set("alpha", { username: "alpha", partyId: null, inventory: [], classKey: "warrior", progression: { level: 4 } });
    inMemoryStore.users.set("beta", { username: "beta", partyId: null, inventory: [], classKey: "ranger", progression: { level: 3 } });

    await createParty({
      partyId: "alpha-party",
      leader: "alpha",
      members: ["alpha"],
    });

    const invited = await inviteToParty("alpha-party", "alpha", "beta");
    expect(invited.pendingInvites).toHaveLength(1);

    const accepted = await acceptPartyInvite("alpha-party", "beta");
    expect(accepted.members).toContain("beta");
    expect(accepted.pendingInvites).toHaveLength(0);
    expect(accepted.memberProfiles.find((member) => member.username === "beta")?.classKey).toBe("ranger");
  });
});