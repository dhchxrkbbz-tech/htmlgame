import { expect, test } from "@playwright/test";

function trackPageErrors(page, errors) {
  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
}

async function enterGuest(page, classKey) {
  await page.goto("/");
  await page.waitForSelector("#login-form");
  await page.selectOption('select[name="classKey"]', classKey);
  await page.click('button[data-action="guest"]');
  await page.waitForFunction(() => Boolean(window.__HTMLGAME__?.game?.scene?.keys?.GameScene?.player), undefined, { timeout: 20_000 });
}

test("vertical slice smoke covers login, market, guild, and two-client presence", async ({ browser }) => {
  test.slow();

  const pageOneErrors = [];
  const pageTwoErrors = [];

  const contextOne = await browser.newContext();
  const pageOne = await contextOne.newPage();
  trackPageErrors(pageOne, pageOneErrors);

  const contextTwo = await browser.newContext();
  const pageTwo = await contextTwo.newPage();
  trackPageErrors(pageTwo, pageTwoErrors);

  await enterGuest(pageOne, "warrior");
  await enterGuest(pageTwo, "mage");

  await pageOne.waitForFunction(() => window.__HTMLGAME__.game.scene.keys.GameScene.remotePlayers.size >= 1);
  await pageTwo.waitForFunction(() => window.__HTMLGAME__.game.scene.keys.GameScene.remotePlayers.size >= 1);

  const initialRemoteX = await pageOne.evaluate(() => {
    const scene = window.__HTMLGAME__.game.scene.keys.GameScene;
    return [...scene.remotePlayers.values()][0]?.sprite?.x ?? null;
  });

  await pageTwo.evaluate(() => {
    const scene = window.__HTMLGAME__.game.scene.keys.GameScene;
    const nextX = scene.player.x + 180;
    const nextY = scene.player.y + 24;
    scene.player.setPosition(nextX, nextY);
    scene.player.body.reset(nextX, nextY);
    window.__HTMLGAME__.socketManager.emitMovement({
      x: nextX,
      y: nextY,
      velocityX: 180,
      velocityY: 24,
      clientTime: performance.now(),
    });
  });

  await pageOne.waitForFunction((previousX) => {
    const scene = window.__HTMLGAME__.game.scene.keys.GameScene;
    const remote = [...scene.remotePlayers.values()][0];
    return Boolean(remote && Math.abs(remote.sprite.x - previousX) > 40);
  }, initialRemoteX);

  const partyState = await pageOne.evaluate(async () => {
    const scene = window.__HTMLGAME__.game.scene.keys.GameScene;
    await scene.handlePartyCreate("duo-party");
    await scene.handlePartyAddMember("duo-party", "guest-mage");
    await scene.handlePartyAwardXp("duo-party", 50);
    return scene.hud.partyState;
  });

  expect(partyState.partyId).toBe("duo-party");
  expect(partyState.members).toContain("guest-warrior");
  expect(partyState.members).toContain("guest-mage");
  expect(partyState.sharedXp).toBe(50);

  const mirroredPartyState = await pageTwo.evaluate(async () => {
    const scene = window.__HTMLGAME__.game.scene.keys.GameScene;
    const partyState = await window.__HTMLGAME__.socketManager.getParty("duo-party");
    scene.processPartyState(partyState, { source: "e2e" });
    return scene.hud.partyState;
  });

  expect(mirroredPartyState.sharedXp).toBe(50);

  const createdGuild = await pageOne.evaluate(async () => {
    const scene = window.__HTMLGAME__.game.scene.keys.GameScene;
    const suffix = String(Date.now()).slice(-6);
    const name = `Smoke Guild ${suffix}`;
    const tag = `S${suffix.slice(-4)}`.slice(0, 5).toUpperCase();
    await scene.handleGuildCreate(name, tag);
    return scene.hud.guildState;
  });

  expect(createdGuild.name).toContain("Smoke Guild");

  const joinedGuild = await pageTwo.evaluate(async (guildId) => {
    const scene = window.__HTMLGAME__.game.scene.keys.GameScene;
    await scene.handleGuildJoin(guildId);
    return scene.hud.guildState;
  }, createdGuild.guildId);

  expect(joinedGuild.guildId).toBe(createdGuild.guildId);

  const guildMessage = `smoke-ping-${Date.now()}`;
  await pageOne.evaluate(async (message) => {
    const scene = window.__HTMLGAME__.game.scene.keys.GameScene;
    await scene.handleGuildSend(message);
  }, guildMessage);

  await pageTwo.waitForFunction((message) => {
    const scene = window.__HTMLGAME__.game.scene.keys.GameScene;
    return (scene.hud.guildMessages ?? []).some((entry) => entry.message === message);
  }, guildMessage);

  const marketState = await pageOne.evaluate(async () => {
    const scene = window.__HTMLGAME__.game.scene.keys.GameScene;
    await scene.refreshMarketListings();
    const startingInventoryCount = scene.inventorySystem.list().length;
    const sellable = scene.inventorySystem.list().find((item) => item.stackable !== false);
    await scene.handleSellItem(sellable.id, 33);
    const ownListing = scene.marketPanel.listings.find((entry) => entry.seller === scene.profile.username);
    await scene.handleCancelListing(ownListing.listingId);
    const buyable = scene.marketPanel.listings.find((entry) => entry.seller === "Grove Trader" && entry.status === "open");
    await scene.handleBuyListing(buyable.listingId);
    return {
      inventoryCount: scene.inventorySystem.list().length,
      startingInventoryCount,
      hasBoughtItem: scene.inventorySystem.list().some((item) => item.id === buyable.itemId),
    };
  });

  expect(marketState.hasBoughtItem).toBe(true);
  expect(marketState.inventoryCount).toBeGreaterThanOrEqual(marketState.startingInventoryCount);

  const objectiveState = await pageOne.evaluate(() => window.__HTMLGAME__.game.scene.keys.GameScene.hud.objectiveState);
  expect(objectiveState.lines.find((line) => line.includes("Reach Crystal Path"))).toContain("[x]");
  expect(objectiveState.lines.find((line) => line.includes("Defeat 2 grove enemies"))).toContain("[x]");
  expect(objectiveState.lines.find((line) => line.includes("Pick up one loot drop"))).toContain("[x]");
  expect(objectiveState.lines.find((line) => line.includes("Sell or buy one market item"))).toContain("[x]");
  expect(objectiveState.lines.find((line) => line.includes("Create or join a guild"))).toContain("[x]");
  expect(objectiveState.lines.find((line) => line.includes("Send one guild chat message"))).toContain("[x]");
  expect(objectiveState.lines.find((line) => line.includes("Bring a second client"))).toContain("[x]");

  expect(pageOneErrors).toEqual([]);
  expect(pageTwoErrors).toEqual([]);

  await contextOne.close();
  await contextTwo.close();
});