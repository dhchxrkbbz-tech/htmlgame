import { beforeEach, describe, expect, it } from "vitest";
import { inMemoryStore } from "../server/services/inMemoryStore.js";
import { loginUser, registerUser, updateUserProfile } from "../server/services/authService.js";

describe("authService", () => {
  beforeEach(() => {
    inMemoryStore.users.clear();
  });

  it("allows login without requiring class selection again", async () => {
    await registerUser({
      username: "tester",
      password: "secret123",
      classKey: "warrior",
    });

    const result = await loginUser({
      username: "tester",
      password: "secret123",
    });

    expect(result.profile.username).toBe("tester");
    expect(result.profile.classKey).toBe("warrior");
  });

  it("updates persisted user profile fields in memory mode", async () => {
    await registerUser({
      username: "warden",
      password: "secret123",
      classKey: "mage",
    });

    const profile = await updateUserProfile("warden", {
      guildId: "night-watch",
      partyId: "warden-party",
    });

    expect(profile.guildId).toBe("night-watch");
    expect(profile.partyId).toBe("warden-party");
  });

  it("creates profiles with level progression metadata", async () => {
    const result = await registerUser({
      username: "rookie",
      password: "secret123",
      classKey: "cleric",
    });

    expect(result.profile.progression.level).toBe(1);
    expect(result.profile.progression.xp).toBe(0);
    expect(result.profile.progression.xpToNextLevel).toBeGreaterThan(0);
  });
});