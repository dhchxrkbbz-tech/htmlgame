const OBJECTIVE_DEFINITIONS = [
  {
    id: "reach-crystal-path",
    label: "Reach Crystal Path from the camp.",
    prompt: "Move east from Adventurer Camp until you reach Crystal Path.",
  },
  {
    id: "defeat-grove-threats",
    label: "Defeat 2 grove enemies.",
    prompt: "Fight through the grove and defeat two enemies.",
  },
  {
    id: "collect-loot",
    label: "Pick up one loot drop.",
    prompt: "Press E near a drop to collect loot.",
  },
  {
    id: "complete-trade",
    label: "Sell or buy one market item.",
    prompt: "Open the trader and complete one buy or sell action.",
  },
  {
    id: "establish-guild",
    label: "Create or join a guild.",
    prompt: "Use the social panel to create or join a guild.",
  },
  {
    id: "send-guild-chat",
    label: "Send one guild chat message.",
    prompt: "Send a guild chat message to finish the social slice.",
  },
  {
    id: "confirm-second-client",
    label: "Bring a second client into the same instance.",
    prompt: "Open a second browser or launcher instance and join the same party instance.",
  },
];

export class DemoDirector {
  constructor(hud, callbacks = {}) {
    this.hud = hud;
    this.callbacks = callbacks;
    this.enemyDefeatCount = 0;
    this.state = new Map(OBJECTIVE_DEFINITIONS.map((objective) => [objective.id, false]));
    this.syncHud();
  }

  getActivePrompt() {
    const active = OBJECTIVE_DEFINITIONS.find((objective) => !this.state.get(objective.id));
    return active?.prompt ?? "Vertical slice complete. Manual second-client validation can still be repeated anytime.";
  }

  updatePlayerPosition(player, world) {
    if (this.state.get("reach-crystal-path")) {
      return;
    }

    const crystalPath = (world.landmarks ?? []).find((entry) => entry.label === "Crystal Path");
    if (!crystalPath) {
      if (player.x >= 640) {
        this.complete("reach-crystal-path", "Objective complete: Crystal Path reached.");
      }
      return;
    }

    const dx = player.x - crystalPath.x;
    const dy = player.y - crystalPath.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 150) {
      this.complete("reach-crystal-path", "Objective complete: Crystal Path reached.");
    }
  }

  recordEnemyDefeat() {
    this.enemyDefeatCount += 1;
    if (this.enemyDefeatCount >= 2) {
      this.complete("defeat-grove-threats", "Objective complete: Grove threats cleared.");
      return;
    }

    this.syncHud();
    this.callbacks.onObjectiveProgress?.(`Vertical slice progress: ${this.enemyDefeatCount}/2 enemies defeated.`);
  }

  recordLootPickup(itemName) {
    this.complete("collect-loot", `Objective complete: Picked up ${itemName}.`);
  }

  recordTrade(itemName, mode) {
    this.complete("complete-trade", `Objective complete: ${mode === "sell" ? "Listed" : "Bought"} ${itemName}.`);
  }

  recordGuildLink(guildName) {
    this.complete("establish-guild", `Objective complete: Guild linked (${guildName}).`);
  }

  recordGuildChat() {
    this.complete("send-guild-chat", "Objective complete: Guild chat sent.");
  }

  recordRemotePresence(remotePlayerCount) {
    if (remotePlayerCount > 0) {
      this.complete("confirm-second-client", "Objective complete: Second client detected in the same instance.");
    }
  }

  complete(id, message) {
    if (this.state.get(id)) {
      return;
    }

    this.state.set(id, true);
    this.syncHud();
    this.callbacks.onObjectiveCompleted?.(message);
  }

  buildObjectiveState() {
    const completedCount = OBJECTIVE_DEFINITIONS.filter((objective) => this.state.get(objective.id)).length;
    return {
      title: `Vertical Slice ${completedCount}/${OBJECTIVE_DEFINITIONS.length}`,
      activePrompt: this.getActivePrompt(),
      lines: OBJECTIVE_DEFINITIONS.map((objective) => {
        if (objective.id === "defeat-grove-threats" && !this.state.get(objective.id)) {
          return `[ ] ${objective.label} (${Math.min(this.enemyDefeatCount, 2)}/2)`;
        }

        return `${this.state.get(objective.id) ? "[x]" : "[ ]"} ${objective.label}`;
      }),
    };
  }

  syncHud() {
    this.hud.setObjectiveState(this.buildObjectiveState());
  }
}