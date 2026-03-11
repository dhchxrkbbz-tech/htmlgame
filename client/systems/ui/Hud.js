import { WindowDock } from "./WindowDock.js";
import { NotificationCenter } from "./NotificationCenter.js";

function formatCooldown(milliseconds) {
  if (!milliseconds || milliseconds <= 0) {
    return "Ready";
  }

  return `${(milliseconds / 1000).toFixed(1)}s`;
}

export class Hud {
  constructor(scene, player, skillSystem, inventorySystem, combatSystem, dockHandlers = {}) {
    this.scene = scene;
    this.player = player;
    this.skillSystem = skillSystem;
    this.inventorySystem = inventorySystem;
    this.combatSystem = combatSystem;
    this.statusMessage = "";
    this.inventoryVisible = false;
    this.marketVisible = false;
    this.partyVisible = false;
    this.guildVisible = false;
    this.partyState = null;
    this.guildState = null;
    this.guildMessages = [];
    this.pendingPartyInvites = [];
    this.presenceSummary = {
      onlineCount: 1,
      remotePlayers: [],
    };
    this.objectiveState = {
      title: "Vertical Slice 0/7",
      activePrompt: "Move east from Adventurer Camp until you reach Crystal Path.",
      lines: ["[ ] Reach Crystal Path from the camp."],
    };
    this.combatFeed = [];
    this.socialFeed = [];

    this.root = scene.add.container(18, 18).setScrollFactor(0).setDepth(1000);
    this.dock = new WindowDock(scene, dockHandlers);
    this.notifications = new NotificationCenter(scene);

    this.mainPanel = scene.add.rectangle(0, 0, 392, 282, 0x08110e, 0.86).setOrigin(0);
    this.mainAccent = scene.add.rectangle(0, 0, 392, 4, 0xd7c46e, 1).setOrigin(0);
    this.healthBarBg = scene.add.rectangle(20, 44, 220, 14, 0x22372d, 1).setOrigin(0);
    this.healthBarFill = scene.add.rectangle(20, 44, 220, 14, 0x8edb83, 1).setOrigin(0);
    this.manaBarBg = scene.add.rectangle(20, 74, 220, 12, 0x22372d, 1).setOrigin(0);
    this.manaBarFill = scene.add.rectangle(20, 74, 220, 12, 0x78b9ff, 1).setOrigin(0);
    this.xpBarBg = scene.add.rectangle(20, 98, 220, 10, 0x22372d, 1).setOrigin(0);
    this.xpBarFill = scene.add.rectangle(20, 98, 220, 10, 0xd7c46e, 1).setOrigin(0);

    this.vitalsLabel = scene.add.text(20, 14, "Vitals", {
      fontSize: "11px",
      color: "#d7c46e",
      fontStyle: "bold",
    }).setScrollFactor(0);
    this.titleText = scene.add.text(84, 12, `${player.classKey.toUpperCase()} Adventurer`, {
      fontSize: "17px",
      color: "#f6f2df",
      fontStyle: "bold",
    }).setScrollFactor(0);
    this.healthText = scene.add.text(20, 42, "HP", { fontSize: "13px", color: "#f6f2df" }).setScrollFactor(0);
    this.manaText = scene.add.text(20, 70, "MP", { fontSize: "12px", color: "#d7ebff" }).setScrollFactor(0);
    this.shieldText = scene.add.text(252, 42, "Shield 0", { fontSize: "12px", color: "#a8d7ff" }).setScrollFactor(0);
    this.xpText = scene.add.text(252, 95, "Lv 1", { fontSize: "12px", color: "#f2dc93" }).setScrollFactor(0);
    this.statusLabel = scene.add.text(20, 122, "Status", {
      fontSize: "11px",
      color: "#d7c46e",
      fontStyle: "bold",
    }).setScrollFactor(0);
    this.statusText = scene.add.text(20, 140, "", {
      fontSize: "13px",
      color: "#d8e5db",
      wordWrap: { width: 330 },
    }).setScrollFactor(0);
    this.quickbarLabel = scene.add.text(20, 186, "Quickbar", {
      fontSize: "11px",
      color: "#d7c46e",
      fontStyle: "bold",
    }).setScrollFactor(0);
    this.hintText = scene.add.text(20, 250, "LMB basic | E loot | 1-4 skills | I inventory | M market | P/G social", {
      fontSize: "11px",
      color: "#9fb4a6",
      wordWrap: { width: 330 },
    }).setScrollFactor(0);
    this.skillLabels = skillSystem.getQuickbar().map((skill, index) => scene.add.text(20, 204 + index * 14, "", {
      fontSize: "12px",
      color: "#f6f2df",
    }).setScrollFactor(0));

    this.groupPanel = scene.add.text(0, 300, "", {
      fontSize: "12px",
      color: "#dbe6de",
      backgroundColor: "#08110ed9",
      padding: { x: 12, y: 10 },
      wordWrap: { width: 368 },
    }).setScrollFactor(0);
    this.objectivePanel = scene.add.text(700, 522, "", {
      fontSize: "12px",
      color: "#f6f2df",
      backgroundColor: "#10241ce3",
      padding: { x: 12, y: 10 },
      wordWrap: { width: 286 },
    }).setScrollFactor(0);

    this.root.add([
      this.mainPanel,
      this.mainAccent,
      this.vitalsLabel,
      this.healthBarBg,
      this.healthBarFill,
      this.manaBarBg,
      this.manaBarFill,
      this.xpBarBg,
      this.xpBarFill,
      this.titleText,
      this.healthText,
      this.manaText,
      this.shieldText,
      this.xpText,
      this.statusLabel,
      this.statusText,
      this.quickbarLabel,
      this.hintText,
      ...this.skillLabels,
      this.groupPanel,
      this.objectivePanel,
    ]);

    this.updateDockStates();
  }

  toggleInventory() {
    this.inventoryVisible = !this.inventoryVisible;
    this.updateDockStates();
  }

  setInventoryVisible(visible) {
    this.inventoryVisible = visible;
    this.updateDockStates();
  }

  toggleMarket() {
    this.marketVisible = !this.marketVisible;
    this.updateDockStates();
  }

  setMarketVisible(visible) {
    this.marketVisible = visible;
    this.updateDockStates();
  }

  toggleParty() {
    this.partyVisible = !this.partyVisible;
    this.updateDockStates();
  }

  setPartyVisible(visible) {
    this.partyVisible = visible;
    this.updateDockStates();
  }

  toggleGuild() {
    this.guildVisible = !this.guildVisible;
    this.updateDockStates();
  }

  setGuildVisible(visible) {
    this.guildVisible = visible;
    this.updateDockStates();
  }

  closeTradeWindows() {
    this.inventoryVisible = false;
    this.marketVisible = false;
    this.updateDockStates();
  }

  closeSocialWindows() {
    this.partyVisible = false;
    this.guildVisible = false;
    this.updateDockStates();
  }

  updateDockStates() {
    this.dock?.setActiveStates({
      inventory: this.inventoryVisible,
      market: this.marketVisible,
      party: this.partyVisible,
      guild: this.guildVisible,
    });
  }

  setStatus(message) {
    this.statusMessage = message;
  }

  pushToast(title, body = "", options = {}) {
    this.notifications?.push({ title, body, ...options });
  }

  pushCombatEvent(message) {
    this.combatFeed = [...this.combatFeed, message].slice(-6);
  }

  pushSocialEvent(message) {
    this.socialFeed = [...this.socialFeed, message].slice(-7);
  }

  setPresenceSummary(summary) {
    this.presenceSummary = summary;
  }

  setObjectiveState(objectiveState) {
    this.objectiveState = objectiveState;
  }

  setPartyState(partyState) {
    this.partyState = partyState;
  }

  setPendingPartyInvites(invites) {
    this.pendingPartyInvites = [...(invites ?? [])];
  }

  setGuildState(guildState) {
    this.guildState = guildState;
    this.guildMessages = [...(guildState?.chatLog ?? [])].slice(-6);
  }

  addGuildMessage(message) {
    this.guildMessages = [...this.guildMessages, message].slice(-6);
  }

  update() {
    const healthRatio = Math.max(0, this.player.stats.health / this.player.stats.maxHealth);
    const manaRatio = Math.max(0, this.player.stats.mana / this.player.stats.maxMana);
    const progression = this.player.progression ?? { level: 1, xp: 0, xpToNextLevel: 100 };
    const xpRatio = progression.xpToNextLevel > 0 ? Math.max(0, progression.xp / progression.xpToNextLevel) : 0;

    this.healthBarFill.width = 220 * healthRatio;
    this.manaBarFill.width = 220 * manaRatio;
    this.xpBarFill.width = 220 * xpRatio;
    this.healthText.setText(`HP ${this.player.stats.health}/${this.player.stats.maxHealth}`);
    this.manaText.setText(`MP ${this.player.stats.mana}/${this.player.stats.maxMana}`);
    this.shieldText.setText(`Shield ${this.player.getShieldAmount()}`);
    this.xpText.setText(`Lv ${progression.level}  XP ${Math.floor(progression.xp)}/${progression.xpToNextLevel}`);
    this.titleText.setText(`${this.player.profile.username}  •  ${this.player.classKey.toUpperCase()}`);
    this.statusText.setText(this.statusMessage);

    this.skillSystem.getQuickbar().forEach((skill, index) => {
      const cooldown = this.combatSystem.getCooldownRemaining(skill.id);
      this.skillLabels[index].setText(`${index + 1}. ${skill.name}  ${formatCooldown(cooldown)}`);
      this.skillLabels[index].setColor(cooldown > 0 ? "#b7d2c2" : "#f6f2df");
    });

    this.groupPanel.setText(this.getPartyCardText());
    this.objectivePanel.setText(this.getObjectiveText());
  }

  getSocialText() {
    const remoteNames = this.presenceSummary.remotePlayers.map((entry) => entry.username).join(", ") || "none";
    return `Presence\nPlayers online: ${this.presenceSummary.onlineCount}\nRemote party: ${remoteNames}\n\nSocial Feed\n${this.socialFeed.join("\n")}`;
  }

  getPartyText() {
    if (!this.partyState) {
      return "Party\nNo synchronized party state yet.";
    }

    const members = this.partyState.members.map((member) => `- ${member}`).join("\n") || "- none";
    const loot = this.partyState.sharedLoot.slice(-4).map((item) => `- ${item.name} x${item.quantity ?? 1}`).join("\n") || "- none";

    return `Party ${this.partyState.partyId}\nLeader: ${this.partyState.leader}\nShared XP: ${this.partyState.sharedXp}\nMembers\n${members}\nRecent Shared Loot\n${loot}`;
  }

  getGuildText() {
    if (!this.guildState) {
      return "Guild\nNo guild joined.";
    }

    const members = this.guildState.members.map((member) => `- ${member}`).join("\n") || "- none";
    const messages = this.guildMessages.map((entry) => `[${entry.author}] ${entry.message}`).join("\n") || "No chat yet.";

    return `Guild [${this.guildState.tag}] ${this.guildState.name}\nMembers\n${members}\nChat Log\n${messages}`;
  }

  getObjectiveText() {
    return `${this.objectiveState.title}\nCurrent\n${this.objectiveState.activePrompt}\n\nChecklist\n${this.objectiveState.lines.join("\n")}`;
  }

  getPartyCardText() {
    if (this.pendingPartyInvites.length) {
      const invite = this.pendingPartyInvites[0];
      return `Party Invite\n${invite.partyId}\nfrom ${invite.invitedBy}\nOpen Party panel to accept.`;
    }

    if (!this.partyState?.members?.length || (this.partyState.members.length === 1 && this.partyState.members[0] === this.player.profile.username)) {
      return `Profile\n${this.player.profile.username}\nClass: ${this.player.classKey}\nLevel: ${this.player.progression?.level ?? 1}`;
    }

    const members = (this.partyState.memberProfiles?.length ? this.partyState.memberProfiles : this.partyState.members.map((member) => ({ username: member })))
      .map((member) => {
        const isSelf = member.username === this.player.profile.username;
        return `- ${member.username}  Lv ${member.level ?? (isSelf ? this.player.progression?.level : 1)}  ${member.classKey ?? (isSelf ? this.player.classKey : "unknown")}`;
      })
      .join("\n");

    return `Party: ${this.partyState.partyId}\n${members}`;
  }

  destroy() {
    this.notifications?.destroy();
    this.dock?.destroy();
    this.root?.destroy(true);
  }
}