import Phaser from "phaser";
import { createSocketManager } from "./network/socket.js";
import { createGameConfig } from "./gameConfig.js";
import { setAppServices, setAuthSession, setSessionProfile } from "./appContext.js";

const socketManager = createSocketManager();

const launcherSession = globalThis.launcherApi?.getSession?.();

if (launcherSession?.profile) {
  setSessionProfile(launcherSession.profile);
  setAuthSession({
    token: launcherSession.token,
    mode: launcherSession.mode ?? "account",
  });
  socketManager.setToken(launcherSession.token ?? null);
}

setAppServices({
  socketManager,
});

const game = new Phaser.Game(createGameConfig(document.getElementById("game-root")));

window.__HTMLGAME__ = {
  game,
  socketManager,
};