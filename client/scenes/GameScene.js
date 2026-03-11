import Phaser from "phaser";
import { getAppServices, getAuthSession, getSessionProfile, patchSessionProfile } from "../appContext.js";
import { Player } from "../systems/player/Player.js";
import { Enemy } from "../systems/enemy/Enemy.js";
import { CombatSystem } from "../systems/combat/CombatSystem.js";
import { InventorySystem } from "../systems/inventory/InventorySystem.js";
import { SkillSystem } from "../systems/skills/SkillSystem.js";
import { MapLoader } from "../systems/map/MapLoader.js";
import { LootSystem } from "../systems/loot/LootSystem.js";
import { Hud } from "../systems/ui/Hud.js";
import { InventoryPanel } from "../systems/ui/InventoryPanel.js";
import { MarketPanel } from "../systems/ui/MarketPanel.js";
import { SocialPanel } from "../systems/ui/SocialPanel.js";
import { DemoDirector } from "../systems/demo/DemoDirector.js";
import { AudioSystem } from "../systems/audio/AudioSystem.js";
import { OptimizationHelper } from "../systems/optimization/OptimizationHelper.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.player = null;
    this.enemies = null;
    this.mapLoader = null;
    this.remotePlayers = new Map();
    this.world = null;
    this.pendingLootPickups = new Set();
    this.pendingPartyInvites = [];
    this.lastPartySharedXp = 0;
    this.remoteInterpolation = {
      snapDistance: 96,
      smoothingMs: 120,
      staleAfterMs: 450,
      extrapolationWindowMs: 180,
      reconcileCooldownMs: 650,
      removeAfterMs: 3200,
    };
    this.lastRemoteReconcileAt = 0;
    this.latestWorldSnapshotSequence = 0;
    this.socketSubscriptions = [];
  }

  init(data) {
    this.profile = data.profile ?? getSessionProfile();
  }

  create() {
    const profile = this.profile;
    if (!profile) {
      this.scene.start("LoginScene");
      return;
    }

    const authSession = getAuthSession();
    const { socketManager } = getAppServices();
    this.socketSubscriptions = [];

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.shutdown();
    });
    this.cameras.main.fadeIn(200, 8, 17, 14);

    this.mapLoader = new MapLoader(this, "map:tutorial");
    const world = this.mapLoader.createInstance(profile.partyId ?? profile.username);
    this.world = world;

    this.mapLoader.renderWorld(world);

    this.player = new Player(this, world.spawn.x, world.spawn.y, profile);
    this.player.setRespawnPoint(world.spawn);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBounds(0, 0, world.bounds.width, world.bounds.height);
    this.physics.world.setBounds(0, 0, world.bounds.width, world.bounds.height);

    this.enemies = this.physics.add.group({ classType: Enemy, runChildUpdate: true });
    world.enemySpawns.forEach((spawn) => {
      const enemy = new Enemy(this, spawn.x, spawn.y, spawn);
      this.enemies.add(enemy);
    });

    this.inventorySystem = new InventorySystem(profile.inventory ?? []);
    this.audioSystem = new AudioSystem(this);
    this.lootSystem = new LootSystem(this);
    this.lootSystem.initializeSpawns(world.lootSpawns);
    this.skillSystem = new SkillSystem(this, profile.classKey, this.cache.json.get("skills:classes"));
    this.combatSystem = new CombatSystem(this, this.player, this.enemies, this.skillSystem);
    this.optimizationHelper = new OptimizationHelper(this, this.enemies);
    this.hud = new Hud(this, this.player, this.skillSystem, this.inventorySystem, this.combatSystem, {
      inventory: () => {
        this.audioSystem.playUiClick();
        this.toggleInventoryUi();
      },
      market: () => {
        this.audioSystem.playUiClick();
        this.toggleMarketUi();
      },
      party: () => {
        this.audioSystem.playUiClick();
        this.togglePartyUi();
      },
      guild: () => {
        this.audioSystem.playUiClick();
        this.toggleGuildUi();
      },
    });
    this.inventoryPanel = new InventoryPanel(this, this.inventorySystem, {
      onMoveItem: ({ itemId, targetItemId }) => this.handleInventoryMove(itemId, targetItemId),
      onClose: () => this.closeInventoryUi(),
      onUiInteract: () => this.audioSystem.playUiClick(),
    });
    this.marketPanel = new MarketPanel(this, this.inventorySystem, profile, {
      onMoveItem: async ({ itemId, targetItemId }) => this.handleInventoryMove(itemId, targetItemId),
      onSellItem: async ({ itemId, price }) => this.handleSellItem(itemId, price),
      onRefresh: async () => this.refreshMarketListings(),
      onBuyListing: async ({ listingId }) => this.handleBuyListing(listingId),
      onCancelListing: async ({ listingId }) => this.handleCancelListing(listingId),
      onClose: () => this.closeMarketUi(),
      onUiInteract: () => this.audioSystem.playUiClick(),
      onStatus: (message) => this.hud.setStatus(message),
    });
    this.socialPanel = new SocialPanel(this, profile, {
      onPartyCreate: async ({ partyId }) => this.handlePartyCreate(partyId),
      onPartyInvite: async ({ partyId, member }) => this.handlePartyInvite(partyId, member),
      onPartyAcceptInvite: async ({ partyId }) => this.handlePartyAcceptInvite(partyId),
      onPartyAwardXp: async ({ partyId, amount }) => this.handlePartyAwardXp(partyId, amount),
      onGuildCreate: async ({ name, tag }) => this.handleGuildCreate(name, tag),
      onGuildJoin: async ({ guildId }) => this.handleGuildJoin(guildId),
      onGuildRefresh: async ({ guildId }) => this.handleGuildRefresh(guildId),
      onGuildSend: async ({ message }) => this.handleGuildSend(message),
      onClose: () => this.closeSocialUi(),
      onUiInteract: () => this.audioSystem.playUiClick(),
      onStatus: (message) => this.hud.setStatus(message),
    });
    this.demoDirector = new DemoDirector(this.hud, {
      onObjectiveCompleted: (message) => {
        this.hud.setStatus(message);
        this.hud.pushSocialEvent(message);
        this.socialPanel.pushActivity(message);
      },
      onObjectiveProgress: (message) => {
        this.hud.pushSocialEvent(message);
      },
    });

    this.physics.add.collider(this.player, this.enemies);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D,Q,E,R,F,I,M,P,G");

    this.input.on("pointerdown", (pointer) => {
      this.audioSystem.unlock();
      if (pointer.leftButtonDown()) {
        const result = this.combatSystem.performBasicAttack();
        if (result) {
          this.hud.setStatus(result.summary);
          this.hud.pushCombatEvent(result.summary);
        }
      }
    });

    this.input.keyboard.on("keydown-ONE", () => this.castQuickSlot(0));
    this.input.keyboard.on("keydown-TWO", () => this.castQuickSlot(1));
    this.input.keyboard.on("keydown-THREE", () => this.castQuickSlot(2));
    this.input.keyboard.on("keydown-FOUR", () => this.castQuickSlot(3));
    this.input.keyboard.on("keydown-E", () => this.handleLootPickup());
    this.input.keyboard.on("keydown-I", () => {
      this.audioSystem.playUiClick();
      this.toggleInventoryUi();
    });
    this.input.keyboard.on("keydown-M", () => {
      this.audioSystem.playUiClick();
      this.toggleMarketUi();
    });
    this.input.keyboard.on("keydown-P", () => {
      this.audioSystem.playUiClick();
      this.togglePartyUi();
    });
    this.input.keyboard.on("keydown-G", () => {
      this.audioSystem.playUiClick();
      this.toggleGuildUi();
    });

    this.audioSystem.startAmbient();

    const socket = socketManager.connect();
    socketManager.joinInstance({
      token: authSession?.token,
      partyId: profile.partyId ?? profile.username,
      mapKey: world.mapKey,
      player: {
        username: profile.username,
        classKey: profile.classKey,
        level: profile.progression?.level ?? 1,
        guildId: profile.guildId,
        x: this.player.x,
        y: this.player.y,
      },
    });

    this.bindSocketEvent("connect", () => {
      this.hud.setStatus("Connected to local demo server.");
      this.hud.pushToast("Connected", "Local instance sync ready.", { tint: 0x8edb83 });
    });

    this.bindSocketEvent("connect_error", () => {
      this.hud.setStatus("Server unavailable. Local combat sandbox remains playable; account/social sync requires the local server.");
    });

    this.bindSocketEvent("disconnect", () => {
      this.hud.setStatus("Disconnected from local server. Reconnect or continue local combat sandbox.");
    });

    this.bindSocketEvent("world:state", (state) => {
      const snapshotSequence = Number(state?.snapshotSequence ?? 0);
      if (snapshotSequence && snapshotSequence < this.latestWorldSnapshotSequence) {
        return;
      }

      this.latestWorldSnapshotSequence = Math.max(this.latestWorldSnapshotSequence, snapshotSequence);
      if (snapshotSequence) {
        socketManager.emitSnapshotAck(snapshotSequence);
      }

      const remotePlayers = (state?.players ?? []).filter((entry) => entry.socketId !== socket.id);
      this.syncRemotePlayers(remotePlayers);
      this.demoDirector.recordRemotePresence(remotePlayers.length);
      this.hud.setPresenceSummary({
        onlineCount: (state?.players ?? []).length,
        remotePlayers: remotePlayers.map((entry) => ({
          username: entry.username,
          classKey: entry.classKey,
          guildId: entry.guildId,
        })),
      });
      this.hud.setStatus(`Players online in instance: ${(state?.players ?? []).length}`);
    });

    this.bindSocketEvent("combat:resolved", ({ summary }) => {
      this.hud.setStatus(summary);
      this.hud.pushToast("Combat", summary, { tint: 0xe0ba63, lifetime: 1800 });
    });

    this.bindSocketEvent("player:moved", (payload) => {
      this.updateRemotePlayer(payload);
    });

    this.bindSocketEvent("party:state", (partyState) => {
      this.processPartyState(partyState);
      if (partyState?.partyId) {
        this.socialPanel.setProfile({ ...this.profile, partyId: partyState.partyId });
      }
    });

    this.bindSocketEvent("party:invite-received", ({ partyId, invitedBy, partyState }) => {
      const invite = { partyId, invitedBy, username: this.profile.username };
      this.pendingPartyInvites = [...this.pendingPartyInvites.filter((entry) => entry.partyId !== partyId), invite];
      this.hud.setPendingPartyInvites(this.pendingPartyInvites);
      this.socialPanel.setPendingInvites(this.pendingPartyInvites);
      if (partyState) {
        this.socialPanel.setPartyState(partyState);
      }
      this.hud.pushToast("Party Invite", `${invitedBy} invited you to ${partyId}.`, { tint: 0x79c8ff, lifetime: 3200 });
    });

    this.bindSocketEvent("party:invite-accepted", ({ partyState }) => {
      this.processPartyState(partyState);
    });

    this.bindSocketEvent("guild:message", (message) => {
      this.hud.addGuildMessage(message);
      this.hud.setStatus(`[Guild] ${message.author}: ${message.message}`);
      this.hud.pushToast(`Guild: ${message.author}`, message.message, { tint: 0x79c8ff });
      this.socialPanel.pushActivity(`[Guild] ${message.author}: ${message.message}`);
    });

    this.bindSocketEvent("guild:state", (guildState) => {
      this.processGuildState(guildState, { source: "socket" });
    });

    this.bindSocketEvent("market:updated", ({ listings }) => {
      this.marketPanel.setListings(listings ?? []);
      this.marketPanel.setStatus(`Loaded ${(listings ?? []).length} listing(s).`);
    });

    this.bindSocketEvent("loot:updated", (payload) => {
      if (payload?.dropId && !this.pendingLootPickups.has(payload.dropId)) {
        this.lootSystem.applyRemotePickup(payload.dropId);
      }

      if (payload?.dropId && this.pendingLootPickups.has(payload.dropId)) {
        this.pendingLootPickups.delete(payload.dropId);
      }

      if (payload?.item && payload?.pickedBy === this.profile.username && !payload?.appliedLocally) {
        this.inventorySystem.addItem(payload.item);
        this.inventoryPanel.syncInventory();
        this.marketPanel.syncInventory();
      }

      if (payload?.item) {
        const message = payload.pickedBy
          ? `${payload.pickedBy} picked up ${payload.item.name} x${payload.item.quantity}.`
          : `Shared loot updated: ${payload.item.name}`;
        this.hud.setStatus(message);
        this.hud.pushToast(payload.item.name, message, { tint: 0x8edb83 });
        this.socialPanel.pushActivity(message);
      }
    });

    this.bindSocketEvent("socket:error", ({ error }) => {
      this.hud.setStatus(error);
      this.hud.pushToast("Socket error", error, { tint: 0xe07c6b });
    });

    this.initializeSocialState(profile);
    this.events.on("enemy:defeated", this.handleEnemyDefeated, this);
    this.events.on("player:defeated", this.handlePlayerDefeated, this);
    this.events.on("player:respawned", this.handlePlayerRespawned, this);
    this.events.on("player:leveled", this.handlePlayerLeveled, this);
    this.syncSocialPanelVisibility();
    this.syncInventoryPanelVisibility();
    this.syncMarketPanelVisibility();
    this.refreshMarketListings().catch((error) => {
      this.marketPanel.setStatus(error.message);
    });

    this.hud.setStatus(this.demoDirector.getActivePrompt());
  }

  bindSocketEvent(eventName, handler) {
    const { socketManager } = getAppServices();
    socketManager.connect().on(eventName, handler);
    this.socketSubscriptions.push({ eventName, handler });
  }

  handleEnemyDefeated(payload) {
    const drop = this.lootSystem.spawnEnemyDrop(payload.enemy);
    const message = `Dropped ${drop.item.name} near ${payload.enemy.spawnConfig.id}.`;
    const xpAward = payload.enemy.getXpReward?.() ?? 18;
    const xpResult = this.player.gainXp(xpAward);
    this.hud.setStatus(message);
    this.hud.pushToast(`Loot: ${drop.item.name}`, `+${drop.item.quantity} item  •  +${xpAward} XP`, { tint: 0xd7c46e });
    this.updateProfile({ progression: xpResult.progression, stats: this.player.stats });
    this.demoDirector.recordEnemyDefeat();
  }

  handlePlayerDefeated() {
    this.hud.setStatus("You were defeated. Respawning at camp...");
    this.hud.pushToast("Defeated", "Respawning in 3 seconds.", { tint: 0xe07c6b, lifetime: 3000 });
  }

  handlePlayerRespawned() {
    this.hud.setStatus("Recovered at Adventurer Camp.");
    this.hud.pushToast("Respawned", "Health and mana restored.", { tint: 0x8edb83 });
  }

  handlePlayerLeveled(payload) {
    this.hud.pushToast("Level Up", `Now level ${payload.level}.`, { tint: 0xf2dc93, lifetime: 3200 });
    this.hud.setStatus(`Level ${payload.level} reached.`);
  }

  handleLootPickup() {
    const pickup = this.lootSystem.tryPickupNearest(this.player);
    if (!pickup) {
      this.hud.setStatus("No loot nearby. Move closer and press E.");
      return;
    }

    this.inventorySystem.addItem(pickup.item);
    this.inventoryPanel.syncInventory();
    this.marketPanel.syncInventory();
    this.pendingLootPickups.add(pickup.dropId);
    this.audioSystem.playLootPickup();
    this.demoDirector.recordLootPickup(pickup.item.name);
    this.hud.setStatus(`Picked up ${pickup.item.name} x${pickup.item.quantity}.`);
    this.hud.pushToast(`Received ${pickup.item.name}`, `x${pickup.item.quantity}`, { tint: 0x8edb83 });
    this.socialPanel.pushActivity(`Loot shared to party: ${pickup.item.name} x${pickup.item.quantity}`);

    const { socketManager } = getAppServices();
    socketManager.emitLoot({
      dropId: pickup.dropId,
      item: pickup.item,
      pickedBy: this.profile.username,
      partyId: this.profile.partyId,
      appliedLocally: true,
    });
  }

  async initializeSocialState(profile) {
    const { socketManager } = getAppServices();

    try {
      const partyState = await socketManager.getParty(profile.partyId);
      this.processPartyState(partyState, { silent: true });
    } catch {
      try {
        const partyState = await socketManager.syncParty({
          partyId: profile.partyId,
          leader: profile.username,
          members: [profile.username],
          sharedLoot: [],
          sharedXp: 0,
        });
        this.processPartyState(partyState, { silent: true });
      } catch {
        this.hud.setStatus("Party sync unavailable until the local server is running.");
      }
    }

    socketManager.requestPartyState(profile.partyId);

    if (profile.guildId) {
      try {
        const guildState = await socketManager.getGuild(profile.guildId);
        this.processGuildState(guildState, { silent: true, source: "bootstrap" });
        socketManager.requestGuildState(profile.guildId);
      } catch {
        this.hud.setStatus("Guild profile found, but no guild state could be loaded.");
      }
      return;
    }

    this.processGuildState(null, { silent: true, source: "bootstrap" });
  }

  processPartyState(partyState, options = {}) {
    const previousPartyState = this.hud.partyState;
    this.hud.setPartyState(partyState);
    this.hud.setPendingPartyInvites(this.pendingPartyInvites);
    this.socialPanel.setPartyState(partyState);
    this.socialPanel.setPendingInvites(this.pendingPartyInvites);

    if (!partyState) {
      return;
    }

    if ((partyState.members ?? []).includes(this.profile.username)) {
      this.pendingPartyInvites = this.pendingPartyInvites.filter((invite) => invite.partyId !== partyState.partyId);
      this.hud.setPendingPartyInvites(this.pendingPartyInvites);
      this.socialPanel.setPendingInvites(this.pendingPartyInvites);
    }

    const previousMembers = new Set(previousPartyState?.members ?? []);
    const nextMembers = new Set(partyState.members ?? []);
    const addedMembers = [...nextMembers].filter((member) => !previousMembers.has(member));
    const sharedLoot = partyState.sharedLoot ?? [];
    const previousLootCount = previousPartyState?.sharedLoot?.length ?? 0;
    const newLootEntries = sharedLoot.slice(previousLootCount);
    const xpDelta = partyState.sharedXp - (previousPartyState?.sharedXp ?? 0);

    if (!options.silent) {
      addedMembers.forEach((member) => {
        const message = `Party member synced: ${member}`;
        this.hud.pushSocialEvent(message);
        this.socialPanel.pushActivity(message);
      });

      if (xpDelta > 0) {
        const message = `Shared XP +${xpDelta} to ${partyState.partyId}`;
        this.hud.pushSocialEvent(message);
        this.socialPanel.pushActivity(message);
      }

      newLootEntries.forEach((item) => {
        const message = `Party loot log: ${item.name} x${item.quantity ?? 1}`;
        this.hud.pushSocialEvent(message);
        this.socialPanel.pushActivity(message);
      });
    }

    this.lastPartySharedXp = partyState.sharedXp;
  }

  processGuildState(guildState, options = {}) {
    const previousGuildState = this.hud.guildState;
    this.hud.setGuildState(guildState);
    this.socialPanel.setGuildState(guildState);

    if (!guildState) {
      return;
    }

    const previousMembers = new Set(previousGuildState?.members ?? []);
    const addedMembers = guildState.members.filter((member) => !previousMembers.has(member));

    if (!options.silent) {
      addedMembers.forEach((member) => {
        const message = `Guild roster updated: ${member} joined ${guildState.name}`;
        this.hud.pushSocialEvent(message);
        this.socialPanel.pushActivity(message);
      });

      if (options.source === "manual-refresh") {
        const message = `Guild refreshed: ${guildState.name}`;
        this.hud.pushSocialEvent(message);
        this.socialPanel.pushActivity(message);
      }
    }
  }

  toggleInventoryUi() {
    this.hud.toggleInventory();
    this.syncInventoryPanelVisibility();
  }

  toggleMarketUi() {
    this.hud.toggleMarket();
    this.syncMarketPanelVisibility();
  }

  togglePartyUi() {
    const nextVisible = !this.hud.partyVisible;
    this.hud.setPartyVisible(nextVisible);
    if (nextVisible) {
      this.hud.setGuildVisible(false);
      this.socialPanel.setMode("party");
    }
    this.syncSocialPanelVisibility();
  }

  toggleGuildUi() {
    const nextVisible = !this.hud.guildVisible;
    this.hud.setGuildVisible(nextVisible);
    if (nextVisible) {
      this.hud.setPartyVisible(false);
      this.socialPanel.setMode("guild");
    }
    this.syncSocialPanelVisibility();
  }

  syncSocialPanelVisibility() {
    this.socialPanel?.setVisibility({
      partyVisible: this.hud.partyVisible,
      guildVisible: this.hud.guildVisible,
    });
  }

  syncInventoryPanelVisibility() {
    this.inventoryPanel?.setVisibility(this.hud.inventoryVisible);
  }

  syncMarketPanelVisibility() {
    this.marketPanel?.setVisibility(this.hud.marketVisible);
  }

  closeInventoryUi() {
    this.hud.setInventoryVisible(false);
    this.syncInventoryPanelVisibility();
    this.hud.setStatus("Inventory window closed.");
  }

  closeMarketUi() {
    this.hud.setMarketVisible(false);
    this.syncMarketPanelVisibility();
    this.hud.setStatus("Trader window closed.");
  }

  closeSocialUi() {
    if (this.socialPanel?.mode === "guild") {
      this.hud.setGuildVisible(false);
    } else {
      this.hud.setPartyVisible(false);
    }
    this.syncSocialPanelVisibility();
    this.hud.setStatus("Social window closed.");
  }

  updateProfile(patch) {
    this.profile = patchSessionProfile(patch);
    this.player.profile = this.profile;
    this.socialPanel?.setProfile(this.profile);
    this.marketPanel.profile = this.profile;
    return this.profile;
  }

  rejoinCurrentInstance() {
    const { socketManager } = getAppServices();
    socketManager.joinInstance({
      partyId: this.profile.partyId ?? this.profile.username,
      mapKey: this.world.mapKey,
      player: {
        username: this.profile.username,
        classKey: this.profile.classKey,
        level: this.player.progression?.level ?? this.profile.progression?.level ?? 1,
        guildId: this.profile.guildId,
        x: this.player.x,
        y: this.player.y,
      },
    });
  }

  async handlePartyCreate(partyId) {
    const { socketManager } = getAppServices();
    const nextPartyId = partyId || `${this.profile.username}-party`;
    const partyState = await socketManager.syncParty({
      partyId: nextPartyId,
      leader: this.profile.username,
      members: [this.profile.username],
      sharedLoot: this.hud.partyState?.sharedLoot ?? [],
      sharedXp: this.hud.partyState?.sharedXp ?? 0,
    });

    this.updateProfile({ partyId: nextPartyId });
    this.processPartyState(partyState);
    socketManager.emitParty(partyState);
    socketManager.requestPartyState(nextPartyId);
    this.rejoinCurrentInstance();
    this.socialPanel.setStatus(`Party synchronized: ${nextPartyId}`);
    this.hud.setStatus(`Party synchronized: ${nextPartyId}`);
    this.hud.pushSocialEvent(`Party synchronized: ${nextPartyId}`);
    this.socialPanel.pushActivity(`Party synchronized: ${nextPartyId}`);
  }

  async handlePartyInvite(partyId, member) {
    if (!member) {
      throw new Error("Member username is required.");
    }

    const { socketManager } = getAppServices();
    const activePartyId = partyId || this.profile.partyId;
    const partyState = await socketManager.inviteParty({
      partyId: activePartyId,
      invitedBy: this.profile.username,
      username: member,
    });

    this.processPartyState(partyState);
    socketManager.emitPartyInviteNotice({ partyId: activePartyId, invitedBy: this.profile.username, username: member });
    this.socialPanel.setStatus(`Invite sent to ${member}`);
    this.hud.setStatus(`Invite sent to ${member}.`);
    this.hud.pushToast("Party Invite Sent", `${member} invited to ${activePartyId}.`, { tint: 0x79c8ff });
  }

  async handlePartyAcceptInvite(partyId) {
    if (!partyId) {
      throw new Error("Party id is required.");
    }

    const { socketManager } = getAppServices();
    const partyState = await socketManager.acceptPartyInvite({
      partyId,
      username: this.profile.username,
    });

    this.updateProfile({ partyId });
    this.processPartyState(partyState);
    socketManager.emitPartyAcceptNotice({ partyId, username: this.profile.username });
    socketManager.requestPartyState(partyId);
    this.rejoinCurrentInstance();
    this.socialPanel.setStatus(`Joined party ${partyId}`);
    this.hud.setStatus(`Joined party ${partyId}.`);
    this.hud.pushToast("Party Joined", `${partyId} accepted.`, { tint: 0x8edb83 });
  }

  async handlePartyAwardXp(partyId, amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Shared XP amount must be greater than zero.");
    }

    const { socketManager } = getAppServices();
    const activePartyId = partyId || this.profile.partyId;
    const currentSharedXp = this.hud.partyState?.sharedXp ?? 0;
    const partyState = await socketManager.syncParty({
      partyId: activePartyId,
      leader: this.hud.partyState?.leader ?? this.profile.username,
      members: this.hud.partyState?.members ?? [this.profile.username],
      sharedLoot: this.hud.partyState?.sharedLoot ?? [],
      sharedXp: currentSharedXp + amount,
    });

    this.processPartyState(partyState);
    socketManager.emitParty(partyState);
    this.socialPanel.setStatus(`Shared XP updated by ${amount}`);
    this.hud.setStatus(`Shared XP updated by ${amount}`);
  }

  async handleGuildCreate(name, tag) {
    if (!name || !tag) {
      throw new Error("Guild name and tag are required.");
    }

    const { socketManager } = getAppServices();
    const guildState = await socketManager.createGuild({
      name,
      tag,
      founder: this.profile.username,
    });

    this.updateProfile({ guildId: guildState.guildId });
    this.processGuildState(guildState);
    this.demoDirector.recordGuildLink(guildState.name);
    socketManager.requestGuildState(guildState.guildId);
    socketManager.emitGuildSync(guildState.guildId);
    this.rejoinCurrentInstance();
    this.socialPanel.setStatus(`Guild created: ${guildState.name}`);
    this.hud.setStatus(`Guild created: ${guildState.name}`);
    this.hud.pushSocialEvent(`Guild created: ${guildState.name}`);
    this.socialPanel.pushActivity(`Guild created: ${guildState.name}`);
  }

  async handleGuildJoin(guildId) {
    if (!guildId) {
      throw new Error("Guild id is required.");
    }

    const { socketManager } = getAppServices();
    const guildState = await socketManager.joinGuild({ guildId, username: this.profile.username });
    this.updateProfile({ guildId: guildState.guildId });
    this.processGuildState(guildState);
    this.demoDirector.recordGuildLink(guildState.name);
    socketManager.requestGuildState(guildState.guildId);
    socketManager.emitGuildSync(guildState.guildId);
    this.rejoinCurrentInstance();
    this.socialPanel.setStatus(`Joined guild: ${guildState.name}`);
    this.hud.setStatus(`Joined guild: ${guildState.name}`);
    this.hud.pushSocialEvent(`Joined guild: ${guildState.name}`);
    this.socialPanel.pushActivity(`Joined guild: ${guildState.name}`);
  }

  async handleGuildRefresh(guildId) {
    if (!guildId) {
      throw new Error("Guild id is required.");
    }

    const { socketManager } = getAppServices();
    const guildState = await socketManager.getGuild(guildId);
    this.processGuildState(guildState, { source: "manual-refresh" });
    socketManager.requestGuildState(guildId);
    socketManager.emitGuildSync(guildId);
    this.socialPanel.setStatus(`Guild refreshed: ${guildState.name}`);
  }

  async handleGuildSend(message) {
    if (!this.profile.guildId) {
      throw new Error("Join or create a guild first.");
    }

    if (!message) {
      throw new Error("Guild chat message is required.");
    }

    const { socketManager } = getAppServices();
    socketManager.emitGuildChat({
      guildId: this.profile.guildId,
      author: this.profile.username,
      message,
    });
    this.demoDirector.recordGuildChat();
    this.socialPanel.setStatus("Guild message sent.");
    this.socialPanel.pushActivity(`[You] ${message}`);
  }

  async refreshMarketListings() {
    const { socketManager } = getAppServices();
    const listings = await socketManager.listMarketListings();
    this.marketPanel.setListings(listings);
    this.marketPanel.setStatus(`Loaded ${listings.length} listing(s).`);
  }

  async handleInventoryMove(itemId, targetItemId) {
    this.inventorySystem.moveItemById(itemId, targetItemId);
    this.inventoryPanel.syncInventory();
    this.marketPanel.syncInventory();
    this.marketPanel.setStatus(`Moved ${itemId} in inventory.`);
  }

  async handleSellItem(itemId, price) {
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("Listing price must be greater than zero.");
    }

    const item = this.inventorySystem.getItem(itemId);
    if (!item) {
      throw new Error("Inventory item not found.");
    }

    const { socketManager } = getAppServices();
    const listing = await socketManager.createMarketListing({
      itemId: item.id,
      itemName: item.name,
      quantity: item.quantity,
      price,
      rarity: item.rarity,
      category: item.category,
      description: item.description,
      value: item.value,
      seller: this.profile.username,
      owner: null,
    });

    this.inventorySystem.removeItem(itemId);
    this.inventoryPanel.syncInventory();
    this.marketPanel.syncInventory();
    await this.refreshMarketListings();
    getAppServices().socketManager.emitMarketRefresh();
    this.demoDirector.recordTrade(listing.itemName, "sell");
    this.hud.setStatus(`Listed ${listing.itemName} for ${listing.price}g.`);
  }

  async handleBuyListing(listingId) {
    const { socketManager } = getAppServices();
    let reserved = false;
    let purchase;

    try {
      await socketManager.reserveMarketListing({
        listingId,
        buyer: this.profile.username,
      });
      reserved = true;
      purchase = await socketManager.buyMarketListing({
        listingId,
        buyer: this.profile.username,
      });
    } catch (error) {
      if (reserved) {
        try {
          await socketManager.releaseMarketListing({
            listingId,
            buyer: this.profile.username,
            reason: "buy-failed",
          });
          getAppServices().socketManager.emitMarketRefresh();
        } catch {
          // Keep the original purchase error as the primary failure surfaced to the player.
        }
      }

      throw error;
    }

    this.inventorySystem.addItem({
      id: purchase.itemId,
      name: purchase.itemName,
      quantity: purchase.quantity,
      rarity: purchase.rarity,
      category: purchase.category,
      description: purchase.description,
      value: purchase.value,
      stackable: purchase.category !== "weapon" && purchase.category !== "armor",
    });
    this.inventoryPanel.syncInventory();
    this.marketPanel.syncInventory();
    await this.refreshMarketListings();
    getAppServices().socketManager.emitMarketRefresh();
    this.demoDirector.recordTrade(purchase.itemName, "buy");
    this.hud.setStatus(`Bought ${purchase.itemName} from market.`);
  }

  async handleCancelListing(listingId) {
    const { socketManager } = getAppServices();
    const cancelled = await socketManager.cancelMarketListing({
      listingId,
      seller: this.profile.username,
    });

    this.inventorySystem.addItem({
      id: cancelled.itemId,
      name: cancelled.itemName,
      quantity: cancelled.quantity,
      rarity: cancelled.rarity,
      category: cancelled.category,
      description: cancelled.description,
      value: cancelled.value,
      stackable: cancelled.category !== "weapon" && cancelled.category !== "armor",
    });
    this.inventoryPanel.syncInventory();
    this.marketPanel.syncInventory();
    await this.refreshMarketListings();
    getAppServices().socketManager.emitMarketRefresh();
    this.hud.setStatus(`Cancelled listing for ${cancelled.itemName}.`);
  }

  syncRemotePlayers(players) {
    const activeSocketIds = new Set(players.map((entry) => entry.socketId));

    this.remotePlayers.forEach((remotePlayer, socketId) => {
      if (!activeSocketIds.has(socketId)) {
        this.removeRemotePlayer(socketId);
      }
    });

    players.forEach((entry) => {
      this.upsertRemotePlayer(entry);
    });
  }

  upsertRemotePlayer(entry) {
    let remotePlayer = this.remotePlayers.get(entry.socketId);

    if (!remotePlayer) {
      const sprite = this.add.sprite(entry.x ?? this.player.x + 48, entry.y ?? this.player.y + 48, `${entry.classKey}-idle-0`);
      sprite.setScale(2.2);
      sprite.setAlpha(0.82);
      const label = this.add.text(sprite.x, sprite.y - 38, entry.username ?? "remote", {
        fontSize: "11px",
        color: "#f6f2df",
        backgroundColor: "#08110ecc",
        padding: { x: 6, y: 2 },
      }).setOrigin(0.5).setDepth(46);
      remotePlayer = { sprite, label };
      remotePlayer.sprite.setData("classKey", entry.classKey);
      remotePlayer.sprite.setData("baseTargetX", entry.x ?? remotePlayer.sprite.x);
      remotePlayer.sprite.setData("baseTargetY", entry.y ?? remotePlayer.sprite.y);
      remotePlayer.sprite.setData("targetX", entry.x ?? remotePlayer.sprite.x);
      remotePlayer.sprite.setData("targetY", entry.y ?? remotePlayer.sprite.y);
      remotePlayer.sprite.setData("velocityX", entry.velocityX ?? 0);
      remotePlayer.sprite.setData("velocityY", entry.velocityY ?? 0);
      remotePlayer.sprite.setData("lastClientTime", entry.clientTime ?? 0);
      remotePlayer.sprite.setData("lastMessageAt", this.time.now);
      remotePlayer.sprite.setData("lastServerSequence", entry.serverSequence ?? entry.snapshotSequence ?? 0);
      remotePlayer.label.setText(entry.username ?? "remote");
      this.remotePlayers.set(entry.socketId, remotePlayer);
      this.hud.pushSocialEvent(`Remote player visible: ${entry.username ?? entry.socketId}`);
      this.socialPanel.pushActivity(`Remote player visible: ${entry.username ?? entry.socketId}`);
    }

    const targetX = entry.x ?? remotePlayer.sprite.x;
    const targetY = entry.y ?? remotePlayer.sprite.y;

    remotePlayer.sprite.setData("targetX", targetX);
    remotePlayer.sprite.setData("targetY", targetY);
    remotePlayer.sprite.setData("baseTargetX", targetX);
    remotePlayer.sprite.setData("baseTargetY", targetY);
    remotePlayer.sprite.setData("velocityX", entry.velocityX ?? 0);
    remotePlayer.sprite.setData("velocityY", entry.velocityY ?? 0);
    remotePlayer.sprite.setData("lastClientTime", entry.clientTime ?? 0);
    remotePlayer.sprite.setData("lastMessageAt", this.time.now);
    remotePlayer.sprite.setData("lastServerSequence", entry.serverSequence ?? entry.snapshotSequence ?? remotePlayer.sprite.getData("lastServerSequence") ?? 0);
    remotePlayer.sprite.setData("classKey", entry.classKey);
    remotePlayer.label.setText(entry.username ?? remotePlayer.label.text);
    remotePlayer.sprite.setAlpha(0.82);
    remotePlayer.label.setAlpha(1);

    if (Phaser.Math.Distance.Between(remotePlayer.sprite.x, remotePlayer.sprite.y, targetX, targetY) > this.remoteInterpolation.snapDistance) {
      remotePlayer.sprite.setPosition(targetX, targetY);
      remotePlayer.label.setPosition(targetX, targetY - 38);
    }
  }

  updateRemotePlayer(payload) {
    const remotePlayer = this.remotePlayers.get(payload.socketId);
    if (!remotePlayer) {
      this.requestRemoteReconciliation();
      return;
    }

    const lastClientTime = remotePlayer.sprite.getData("lastClientTime") ?? 0;
    if ((payload.clientTime ?? 0) < lastClientTime) {
      return;
    }

    const lastServerSequence = remotePlayer.sprite.getData("lastServerSequence") ?? 0;
    if ((payload.snapshotSequence ?? 0) < lastServerSequence) {
      return;
    }

    const nextTargetX = payload.x ?? remotePlayer.sprite.getData("targetX") ?? remotePlayer.sprite.x;
    const nextTargetY = payload.y ?? remotePlayer.sprite.getData("targetY") ?? remotePlayer.sprite.y;

    remotePlayer.sprite.setData("baseTargetX", nextTargetX);
    remotePlayer.sprite.setData("baseTargetY", nextTargetY);
    remotePlayer.sprite.setData("targetX", nextTargetX);
    remotePlayer.sprite.setData("targetY", nextTargetY);
    remotePlayer.sprite.setData("velocityX", payload.velocityX ?? 0);
    remotePlayer.sprite.setData("velocityY", payload.velocityY ?? 0);
    remotePlayer.sprite.setData("lastClientTime", payload.clientTime ?? lastClientTime);
    remotePlayer.sprite.setData("lastMessageAt", this.time.now);
    remotePlayer.sprite.setData("lastServerSequence", payload.snapshotSequence ?? lastServerSequence);
  }

  requestRemoteReconciliation() {
    if (this.time.now - this.lastRemoteReconcileAt < this.remoteInterpolation.reconcileCooldownMs) {
      return;
    }

    this.lastRemoteReconcileAt = this.time.now;
    getAppServices().socketManager.requestInstanceState(this.latestWorldSnapshotSequence);
  }

  removeRemotePlayer(socketId) {
    const remotePlayer = this.remotePlayers.get(socketId);
    if (!remotePlayer) {
      return;
    }

    remotePlayer.sprite.destroy();
    remotePlayer.label.destroy();
    this.remotePlayers.delete(socketId);
  }

  updateRemoteInterpolations(delta) {
    const interpolationFactor = Math.min(1, delta / this.remoteInterpolation.smoothingMs);
    const socketsToRemove = [];

    this.remotePlayers.forEach((remotePlayer, socketId) => {
      const baseTargetX = remotePlayer.sprite.getData("baseTargetX") ?? remotePlayer.sprite.getData("targetX") ?? remotePlayer.sprite.x;
      const baseTargetY = remotePlayer.sprite.getData("baseTargetY") ?? remotePlayer.sprite.getData("targetY") ?? remotePlayer.sprite.y;
      const velocityX = remotePlayer.sprite.getData("velocityX") ?? 0;
      const velocityY = remotePlayer.sprite.getData("velocityY") ?? 0;
      const lastMessageAt = remotePlayer.sprite.getData("lastMessageAt") ?? this.time.now;
      const classKey = remotePlayer.sprite.getData("classKey");
      const messageAge = Math.max(0, this.time.now - lastMessageAt);
      const extrapolationMs = Math.min(messageAge, this.remoteInterpolation.extrapolationWindowMs);
      const targetX = baseTargetX + (velocityX * extrapolationMs) / 1000;
      const targetY = baseTargetY + (velocityY * extrapolationMs) / 1000;
      const isStale = messageAge > this.remoteInterpolation.staleAfterMs;
      const shouldCull = messageAge > this.remoteInterpolation.removeAfterMs;

      remotePlayer.sprite.setData("targetX", targetX);
      remotePlayer.sprite.setData("targetY", targetY);

      if (shouldCull) {
        socketsToRemove.push(socketId);
        this.requestRemoteReconciliation();
        return;
      }

      if (Phaser.Math.Distance.Between(remotePlayer.sprite.x, remotePlayer.sprite.y, targetX, targetY) > this.remoteInterpolation.snapDistance) {
        remotePlayer.sprite.setPosition(targetX, targetY);
        this.requestRemoteReconciliation();
      } else {
        remotePlayer.sprite.x = Phaser.Math.Linear(remotePlayer.sprite.x, targetX, interpolationFactor);
        remotePlayer.sprite.y = Phaser.Math.Linear(remotePlayer.sprite.y, targetY, interpolationFactor);
      }

      if (!isStale && (Math.abs(velocityX) > 2 || Math.abs(velocityY) > 2)) {
        remotePlayer.sprite.play(`${classKey}-walk`, true);
      } else {
        remotePlayer.sprite.play(`${classKey}-idle`, true);
      }

      remotePlayer.sprite.setFlipX(velocityX < 0);
      remotePlayer.sprite.setAlpha(isStale ? 0.48 : 0.82);
      remotePlayer.label.setAlpha(isStale ? 0.68 : 1);
      remotePlayer.label.setPosition(remotePlayer.sprite.x, remotePlayer.sprite.y - 38);

      if (isStale) {
        this.requestRemoteReconciliation();
      }
    });

    socketsToRemove.forEach((socketId) => this.removeRemotePlayer(socketId));
  }

  castQuickSlot(index) {
    const result = this.combatSystem.performSkill(index);
    if (result) {
      this.hud.setStatus(result.summary);
      this.hud.pushToast("Skill", result.summary, { tint: 0xe0ba63, lifetime: 1800 });
    }
  }

  update(time, delta) {
    if (!this.player) {
      return;
    }

    this.player.update(delta, this.cursors, this.wasd);
    this.demoDirector?.updatePlayerPosition(this.player, this.world);
    this.enemies.children.each((enemy) => enemy.updateAI(this.player, delta));
    this.combatSystem.update(delta);
    this.optimizationHelper.update(time);
    this.lootSystem.update(this.player);
    this.hud.update();

    const { socketManager } = getAppServices();
    if (this.optimizationHelper.shouldSyncPosition(time)) {
      socketManager.emitMovement({
        x: this.player.x,
        y: this.player.y,
        velocityX: this.player.body.velocity.x,
        velocityY: this.player.body.velocity.y,
        level: this.player.progression?.level ?? 1,
        clientTime: time,
      });
    }

    this.updateRemoteInterpolations(delta);
  }

  shutdown() {
    const { socketManager } = getAppServices();
    this.socketSubscriptions.forEach(({ eventName, handler }) => {
      socketManager.off(eventName, handler);
    });
    this.socketSubscriptions = [];
    socketManager.disconnect();
    this.remotePlayers.forEach((remotePlayer) => {
      remotePlayer.sprite.destroy();
      remotePlayer.label.destroy();
    });
    this.remotePlayers.clear();
    this.events.off("enemy:defeated", this.handleEnemyDefeated, this);
    this.events.off("player:defeated", this.handlePlayerDefeated, this);
    this.events.off("player:respawned", this.handlePlayerRespawned, this);
    this.events.off("player:leveled", this.handlePlayerLeveled, this);
    this.lootSystem?.destroy();
    this.inventoryPanel?.destroy();
    this.marketPanel?.destroy();
    this.socialPanel?.destroy();
    this.hud?.destroy();
    this.audioSystem?.destroy();
  }
}