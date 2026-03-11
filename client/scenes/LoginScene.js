import Phaser from "phaser";
import { getAppServices, getAuthSession, getSessionProfile, setAuthSession, setSessionProfile } from "../appContext.js";
import { CLASS_KEYS } from "../systems/player/playerTextures.js";
import { createStarterInventory } from "../../shared/demoContent.js";
import { createDefaultProgression } from "../../shared/progression.js";

function createGuestProfile(selectedClass) {
  return {
    username: `guest-${selectedClass}`,
    classKey: selectedClass,
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
    inventory: createStarterInventory(selectedClass),
    partyId: "solo-party",
    guildId: null,
  };
}

function validateAccountPayload(payload) {
  if (payload.username.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }

  if (payload.password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
}

export class LoginScene extends Phaser.Scene {
  constructor() {
    super("LoginScene");
    this.formElement = null;
    this.connectionStatusText = null;
  }

  create() {
    const existingProfile = getSessionProfile();
    const existingAuth = getAuthSession();
    if (existingProfile && existingAuth) {
      this.enterGame(existingProfile);
      return;
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.formElement?.destroy();
    });

    this.cameras.main.fadeIn(180, 8, 17, 14);

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x10241c, 0.96);
    this.add.rectangle(width / 2, height / 2, width - 120, height - 120, 0x0d1d17, 0.92).setStrokeStyle(2, 0x395b4b, 0.9);
    this.add.text(112, 84, "HTMLGame Vertical Slice", {
      fontSize: "34px",
      color: "#f6f2df",
      fontStyle: "bold",
    });
    this.add.text(112, 126, "Boot -> Login -> Game is now aligned for a clean local demo handoff.", {
      fontSize: "16px",
      color: "#b7d2c2",
    });

    this.connectionStatusText = this.add.text(112, 164, "Checking local server...", {
      fontSize: "14px",
      color: "#d7c46e",
    });

    const scenario = [
      "3-5 minute demo route",
      "1. Login, register, or enter as guest.",
      "2. Spawn at Adventurer Camp and follow the path east.",
      "3. Fight the slimes and watch feedback for hits, stun, heals, and shields.",
      "4. Open inventory, market, party, and guild panels while staying in-world.",
      "5. Join with a second client for multiplayer validation.",
    ].join("\n");

    this.add.text(112, 214, scenario, {
      fontSize: "15px",
      color: "#d8e5db",
      backgroundColor: "#08110ecc",
      padding: { x: 18, y: 14 },
      lineSpacing: 8,
    });

    const options = CLASS_KEYS.map((classKey) => `<option value="${classKey}">${classKey}</option>`).join("");

    this.formElement = this.add.dom(910, 360).createFromHTML(`
      <form id="login-form" style="width: 380px; display: grid; gap: 12px; padding: 22px; border: 1px solid rgba(235, 230, 196, 0.28); background: rgba(8, 17, 14, 0.9); border-radius: 18px; box-shadow: 0 18px 60px rgba(0,0,0,0.38);">
        <div style="display: grid; gap: 4px;">
          <strong style="font-size: 24px; color: #f6f2df;">Enter Demo Session</strong>
          <span style="font-size: 13px; color: #b7d2c2;">Account mode uses the local server. Guest mode is instant and keeps the combat sandbox playable.</span>
        </div>
        <input name="username" type="text" placeholder="Username" value="tester" style="padding: 12px; border-radius: 10px; border: 1px solid #456557; background: #10241c; color: #f6f2df;" />
        <input name="password" type="password" placeholder="Password" value="secret123" style="padding: 12px; border-radius: 10px; border: 1px solid #456557; background: #10241c; color: #f6f2df;" />
        <select name="classKey" style="padding: 12px; border-radius: 10px; border: 1px solid #456557; background: #10241c; color: #f6f2df;">${options}</select>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
          <button type="submit" data-action="login" style="padding: 12px; border-radius: 10px; border: none; background: #4d8f6f; color: #08110e; font-weight: 700; cursor: pointer;">Login</button>
          <button type="button" data-action="register" style="padding: 12px; border-radius: 10px; border: none; background: #e0ba63; color: #08110e; font-weight: 700; cursor: pointer;">Register</button>
          <button type="button" data-action="guest" style="padding: 12px; border-radius: 10px; border: none; background: #9aa9a1; color: #08110e; font-weight: 700; cursor: pointer;">Guest</button>
        </div>
        <div style="font-size: 12px; color: #9fb4a6;">Recommended account flow for playtest: register once, then login with the same class and credentials.</div>
        <div id="login-status" style="min-height: 20px; color: #b7d2c2; font-size: 14px;">Choose an entry mode.</div>
      </form>
    `);

    const node = this.formElement.node;
    node.addEventListener("submit", (event) => {
      event.preventDefault();
      const submitter = event.submitter;
      const action = submitter instanceof HTMLElement ? submitter.dataset.action ?? "login" : "login";
      this.handleAuthAction(action).catch((error) => {
        this.setFormStatus(error.message, "#ffb4a8");
      });
    });
    node.addEventListener("click", (event) => {
      const button = event.target;
      if (!(button instanceof HTMLButtonElement) || button.type === "submit") {
        return;
      }

      this.handleAuthAction(button.dataset.action ?? "guest").catch((error) => {
        this.setFormStatus(error.message, "#ffb4a8");
      });
    });

    this.checkLocalServer();
  }

  getForm() {
    return this.formElement?.node?.querySelector("form") ?? null;
  }

  setButtonsDisabled(disabled) {
    this.formElement?.node?.querySelectorAll("button").forEach((button) => {
      button.disabled = disabled;
      button.style.opacity = disabled ? "0.7" : "1";
      button.style.cursor = disabled ? "progress" : "pointer";
    });
  }

  setFormStatus(message, color = "#b7d2c2") {
    const status = this.formElement?.node?.querySelector("#login-status");
    if (status) {
      status.textContent = message;
      status.style.color = color;
    }
  }

  async checkLocalServer() {
    const { socketManager } = getAppServices();

    try {
      await socketManager.request("/api/auth/health", null, { method: "GET" });
      this.connectionStatusText?.setText("Local server online. Account login, party, guild, and multiplayer sync are available.");
      this.connectionStatusText?.setColor("#9fe870");
    } catch {
      this.connectionStatusText?.setText("Local server offline. Guest mode still enters the map for combat and UI checks.");
      this.connectionStatusText?.setColor("#ffbf7b");
    }
  }

  async handleAuthAction(action) {
    const form = this.getForm();
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const payload = {
      username: String(formData.get("username") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
      classKey: String(formData.get("classKey") ?? "warrior"),
    };

    this.setButtonsDisabled(true);
    this.setFormStatus(action === "guest" ? "Preparing guest session..." : "Contacting local server...");

    try {
      if (action === "guest") {
        const profile = createGuestProfile(payload.classKey);
        setSessionProfile(profile);
        setAuthSession({ token: null, mode: "guest" });
        this.setFormStatus("Guest session ready. Entering the tutorial grove...", "#9fe870");
        this.enterGame(profile);
        return;
      }

      validateAccountPayload(payload);
      const { socketManager } = getAppServices();
      const response = action === "register"
        ? await socketManager.register(payload)
        : await socketManager.login(payload);

      socketManager.setToken(response.token);
      setAuthSession({ token: response.token, mode: "account" });
      setSessionProfile(response.profile);
      this.setFormStatus(`${action === "register" ? "Account created" : "Login successful"}. Entering the tutorial grove...`, "#9fe870");
      this.enterGame(response.profile);
    } catch (error) {
      const normalizedMessage = action === "register" && /already exists/i.test(error.message)
        ? "That username already exists. Use login or choose another name."
        : error.message;
      this.setFormStatus(normalizedMessage, "#ffb4a8");
      throw new Error(normalizedMessage);
    } finally {
      this.setButtonsDisabled(false);
    }
  }

  enterGame(profile) {
    this.cameras.main.fadeOut(180, 8, 17, 14);
    this.time.delayedCall(190, () => {
      this.scene.start("GameScene", { profile });
    });
  }
}