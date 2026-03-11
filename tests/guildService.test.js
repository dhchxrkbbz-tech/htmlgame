import { beforeEach, describe, expect, it } from "vitest";
import { inMemoryStore } from "../server/services/inMemoryStore.js";
import { addGuildMessage, createGuild, getGuildState, joinGuild } from "../server/services/guildService.js";

describe("guildService", () => {
  beforeEach(() => {
    inMemoryStore.guilds.clear();
    inMemoryStore.users.clear();
  });

  it("creates guilds with normalized ids", async () => {
    const guild = await createGuild({
      name: "Night Watch",
      tag: "nw",
      founder: "warden",
    });

    expect(guild.guildId).toBe("night-watch");
    expect(guild.tag).toBe("NW");
  });

  it("adds members and chat history", async () => {
    inMemoryStore.users.set("oak", { username: "oak", guildId: null, inventory: [] });
    inMemoryStore.users.set("birch", { username: "birch", guildId: null, inventory: [] });

    await createGuild({
      name: "Iron Roots",
      tag: "root",
      founder: "oak",
    });

    await joinGuild("iron-roots", "birch");
    await addGuildMessage({ guildId: "iron-roots", author: "oak", message: "Ready for dungeon." });

    const guild = await getGuildState("iron-roots");
    expect(guild.members).toContain("birch");
    expect(guild.chatLog[0].message).toBe("Ready for dungeon.");
    expect(inMemoryStore.users.get("oak")?.guildId).toBe("iron-roots");
    expect(inMemoryStore.users.get("birch")?.guildId).toBe("iron-roots");
  });
});