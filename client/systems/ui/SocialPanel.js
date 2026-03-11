import { attachModalWindowBehavior, buildModalShell, modalBadgeStyle, modalButtonStyle, modalInputStyle, modalInsetStyle, modalSectionStyle } from "./modalTheme.js";

export class SocialPanel {
  constructor(scene, profile, handlers) {
    this.scene = scene;
    this.profile = profile;
    this.handlers = handlers;
    this.partyState = null;
    this.guildState = null;
    this.pendingPartyInvites = [];
    this.activityLog = ["Social systems ready."];
    this.mode = "party";
    this.root = scene.add.dom(1020, 372).createFromHTML(this.buildMarkup(profile));
    this.root.setScrollFactor(0);
    this.root.setDepth(1200);
    this.windowBehavior = attachModalWindowBehavior(this.root, {
      minWidth: 430,
      minHeight: 300,
      maxWidth: 920,
      maxHeight: 780,
    });
    this.windowBehavior.setSize(460, 540);
    this.getElement('[data-action="close-window"]')?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.handlers.onClose?.();
    });
    this.root.node.addEventListener("click", (event) => {
      this.handlers.onUiInteract?.("click");
      this.handleClick(event).catch((error) => {
        this.handlers.onStatus(error.message);
        this.setStatus(error.message);
      });
    });
    this.renderSnapshots();
    this.setVisibility({ partyVisible: false, guildVisible: false });
  }

  buildMarkup(profile) {
    const sectionStyle = modalSectionStyle();
    const inputStyle = modalInputStyle();
    const insetStyle = modalInsetStyle();
    const badgeStyle = modalBadgeStyle();

    return buildModalShell({
      title: "Social Console",
      subtitle: "Unified party and guild coordination for the vertical slice, with clearer snapshots and activity flow.",
      width: 460,
      body: `
        <div data-social-panel style="display: grid; gap: 12px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start;">
            <section data-party-section style="${sectionStyle}">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong>Party Wing</strong>
                <span data-party-badge style="${badgeStyle}">${profile.partyId}</span>
              </div>
              <input name="partyId" type="text" value="${profile.partyId}" placeholder="party-id" style="${inputStyle}" />
              <input name="partyMember" type="text" placeholder="invite username" style="${inputStyle}" />
              <input name="partyXp" type="number" min="0" value="25" placeholder="shared xp" style="${inputStyle}" />
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                <button type="button" data-action="party-create" style="${modalButtonStyle("success")}">Sync</button>
                <button type="button" data-action="party-invite" style="${modalButtonStyle("warning")}">Invite</button>
                <button type="button" data-action="party-award-xp" style="${modalButtonStyle("muted")}">XP</button>
              </div>
              <div data-party-snapshot style="${insetStyle}">No synchronized party state yet.</div>
              <div data-party-invites style="${insetStyle}">No pending invitations.</div>
            </section>
            <section data-guild-section style="${sectionStyle}">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong>Guild Wing</strong>
                <span data-guild-badge style="${badgeStyle}">${profile.guildId ?? "no guild"}</span>
              </div>
              <input name="guildName" type="text" placeholder="guild name" style="${inputStyle}" />
              <div style="display: grid; grid-template-columns: 1.35fr 0.85fr; gap: 8px;">
                <input name="guildId" type="text" placeholder="guild id to join" style="${inputStyle}" />
                <input name="guildTag" type="text" maxlength="5" placeholder="TAG" style="${inputStyle} text-transform: uppercase;" />
              </div>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                <button type="button" data-action="guild-create" style="${modalButtonStyle("success")}">Create</button>
                <button type="button" data-action="guild-join" style="${modalButtonStyle("warning")}">Join</button>
                <button type="button" data-action="guild-refresh" style="${modalButtonStyle("muted")}">Refresh</button>
              </div>
              <input name="guildMessage" type="text" placeholder="guild chat message" style="${inputStyle}" />
              <button type="button" data-action="guild-send" style="${modalButtonStyle("primary")}">Send Chat</button>
              <div data-guild-snapshot style="${insetStyle}">No guild joined.</div>
            </section>
          </div>
          <section style="${sectionStyle}">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>Activity Relay</strong>
              <span style="${badgeStyle}">Live</span>
            </div>
            <div data-social-activity style="${insetStyle} max-height: 180px; overflow: auto;"></div>
          </section>
        </div>
      `,
      footer: `<div data-social-status style="min-height: 18px; font-size: 13px; color: #b7d2c2;">Ready.</div>`,
    });
  }

  getElement(selector) {
    return this.root.node.querySelector(selector);
  }

  getValue(name) {
    return this.getElement(`[name="${name}"]`)?.value?.trim() ?? "";
  }

  setValue(name, value) {
    const element = this.getElement(`[name="${name}"]`);
    if (element) {
      element.value = value;
    }
  }

  setStatus(message) {
    const status = this.getElement("[data-social-status]");
    if (status) {
      status.textContent = message;
    }
  }

  pushActivity(message) {
    this.activityLog = [...this.activityLog, message].slice(-6);
    const container = this.getElement("[data-social-activity]");
    if (container) {
      container.innerHTML = this.activityLog.map((entry) => `<div>${entry}</div>`).join("");
    }
  }

  setProfile(profile) {
    this.profile = profile;
    const partyBadge = this.getElement("[data-party-badge]");
    const guildBadge = this.getElement("[data-guild-badge]");

    if (partyBadge) {
      partyBadge.textContent = profile.partyId;
    }

    if (guildBadge) {
      guildBadge.textContent = profile.guildId ?? "no guild";
    }

    this.setValue("partyId", profile.partyId ?? "");
    this.setValue("guildId", profile.guildId ?? "");
  }

  setPartyState(partyState) {
    this.partyState = partyState;
    const ownInvites = (partyState?.pendingInvites ?? []).filter((invite) => invite.username === this.profile.username);
    if (ownInvites.length) {
      this.pendingPartyInvites = ownInvites;
    }
    this.renderSnapshots();
  }

  setPendingInvites(invites) {
    this.pendingPartyInvites = [...(invites ?? [])];
    this.renderSnapshots();
  }

  setGuildState(guildState) {
    this.guildState = guildState;
    this.renderSnapshots();
  }

  renderSnapshots() {
    const partySnapshot = this.getElement("[data-party-snapshot]");
    const invitesSnapshot = this.getElement("[data-party-invites]");
    const guildSnapshot = this.getElement("[data-guild-snapshot]");

    if (partySnapshot) {
      partySnapshot.innerHTML = this.partyState
        ? `
          <div style="display:grid; gap:4px;">
            <strong>${this.partyState.partyId}</strong>
            <div>Leader: ${this.partyState.leader}</div>
            <div>Members: ${(this.partyState.memberProfiles ?? []).map((member) => `${member.username} (Lv ${member.level}, ${member.classKey})`).join(", ") || this.partyState.members.join(", ") || "none"}</div>
            <div>Shared XP: ${this.partyState.sharedXp}</div>
            <div>Shared Loot: ${(this.partyState.sharedLoot ?? []).slice(-3).map((item) => `${item.name} x${item.quantity ?? 1}`).join(", ") || "none"}</div>
          </div>
        `
        : "No synchronized party state yet.";
    }

    if (invitesSnapshot) {
      invitesSnapshot.innerHTML = this.pendingPartyInvites.length
        ? this.pendingPartyInvites.map((invite) => `
          <div style="display:grid; gap:6px; margin-bottom: 8px;">
            <strong>${invite.partyId}</strong>
            <div>Invited by ${invite.invitedBy}</div>
            <button type="button" data-action="party-accept-invite" data-party-id="${invite.partyId}" style="${modalButtonStyle("success")}">Accept</button>
          </div>
        `).join("")
        : "No pending invitations.";
    }

    if (guildSnapshot) {
      guildSnapshot.innerHTML = this.guildState
        ? `
          <div style="display:grid; gap:4px;">
            <strong>[${this.guildState.tag}] ${this.guildState.name}</strong>
            <div>Members: ${(this.guildState.memberProfiles ?? []).map((member) => `${member.username} (Lv ${member.level}, ${member.classKey})`).join(", ") || this.guildState.members.join(", ") || "none"}</div>
            <div>Recent chat: ${(this.guildState.chatLog ?? []).slice(-2).map((entry) => `${entry.author}: ${entry.message}`).join(" | ") || "none"}</div>
          </div>
        `
        : "No guild joined.";
    }
  }

  setVisibility({ partyVisible, guildVisible }) {
    const partySection = this.getElement("[data-party-section]");
    const guildSection = this.getElement("[data-guild-section]");
    const shouldShowPanel = partyVisible || guildVisible;

    this.root.setVisible(shouldShowPanel);
    this.root.node.style.display = shouldShowPanel ? "grid" : "none";
    this.root.node.style.pointerEvents = shouldShowPanel ? "auto" : "none";

    if (partySection) {
      partySection.style.display = shouldShowPanel && this.mode === "party" ? "grid" : "none";
    }

    if (guildSection) {
      guildSection.style.display = shouldShowPanel && this.mode === "guild" ? "grid" : "none";
    }
  }

  setMode(mode) {
    this.mode = mode;
  }

  async handleClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest("[data-action]");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const action = button.dataset.action;
    if (!action) {
      return;
    }

    if (action === "close-window") {
      this.handlers.onClose?.();
      return;
    }

    this.setStatus("Processing...");

    switch (action) {
      case "party-create":
        await this.handlers.onPartyCreate({
          partyId: this.getValue("partyId"),
        });
        break;
      case "party-invite":
        await this.handlers.onPartyInvite({
          partyId: this.getValue("partyId"),
          member: this.getValue("partyMember"),
        });
        break;
      case "party-accept-invite":
        await this.handlers.onPartyAcceptInvite({
          partyId: button.dataset.partyId,
        });
        break;
      case "party-award-xp":
        await this.handlers.onPartyAwardXp({
          partyId: this.getValue("partyId"),
          amount: Number(this.getValue("partyXp") || 0),
        });
        break;
      case "guild-create":
        await this.handlers.onGuildCreate({
          name: this.getValue("guildName"),
          tag: this.getValue("guildTag"),
        });
        break;
      case "guild-join":
        await this.handlers.onGuildJoin({
          guildId: this.getValue("guildId"),
        });
        break;
      case "guild-refresh":
        await this.handlers.onGuildRefresh({
          guildId: this.getValue("guildId") || this.profile.guildId,
        });
        break;
      case "guild-send":
        await this.handlers.onGuildSend({
          message: this.getValue("guildMessage"),
        });
        this.setValue("guildMessage", "");
        break;
      default:
        this.setStatus("Unknown action.");
        return;
    }
  }

  destroy() {
    this.windowBehavior?.destroy();
    this.root?.destroy();
  }
}