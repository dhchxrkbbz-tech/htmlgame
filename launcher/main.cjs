const { app, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

let launcherWindow;
let gameWindow;

function getUpdateFeedUrl() {
  return process.env.UPDATE_FEED_URL || "http://localhost:3005/updates";
}

function emitUpdateStatus(payload) {
  launcherWindow?.webContents.send("launcher:update-status", payload);
}

function configureAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.forceDevUpdateConfig = true;
  autoUpdater.setFeedURL({ provider: "generic", url: getUpdateFeedUrl() });

  autoUpdater.on("checking-for-update", () => {
    emitUpdateStatus({ state: "checking", message: "Checking for updates..." });
  });

  autoUpdater.on("update-available", (info) => {
    emitUpdateStatus({ state: "available", message: `Update ${info.version} is available.`, info });
  });

  autoUpdater.on("update-not-available", (info) => {
    emitUpdateStatus({ state: "idle", message: `No updates available for ${info.version}.`, info });
  });

  autoUpdater.on("error", (error) => {
    emitUpdateStatus({ state: "error", message: error.message });
  });
}

function getGameUrl() {
  return process.env.LAUNCHER_URL || "http://localhost:5173";
}

function createLauncherWindow() {
  launcherWindow = new BrowserWindow({
    width: 520,
    height: 760,
    minWidth: 460,
    minHeight: 700,
    title: "HTMLGame Launcher",
    backgroundColor: "#08110e",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  launcherWindow.loadFile(path.join(__dirname, "index.html"));
  launcherWindow.on("closed", () => {
    launcherWindow = null;
  });
}

function createGameWindow(session) {
  if (gameWindow && !gameWindow.isDestroyed()) {
    gameWindow.focus();
    return gameWindow;
  }

  const sessionPayload = encodeURIComponent(JSON.stringify(session ?? {}));
  gameWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    title: "HTMLGame",
    backgroundColor: "#08110e",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      additionalArguments: [`--launcher-session=${sessionPayload}`],
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  gameWindow.loadURL(getGameUrl());
  gameWindow.on("closed", () => {
    gameWindow = null;
  });

  return gameWindow;
}

ipcMain.handle("launcher:getVersion", () => app.getVersion());
ipcMain.handle("launcher:getApiBase", () => getGameUrl().replace(/\/$/, "").replace(/:\d+$/, ":3000"));
ipcMain.handle("launcher:checkForUpdates", async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return {
      available: Boolean(result?.updateInfo && result.updateInfo.version !== app.getVersion()),
      checkedAt: new Date().toISOString(),
      channel: "generic",
      version: result?.updateInfo?.version ?? app.getVersion(),
      feedUrl: getUpdateFeedUrl(),
    };
  } catch (error) {
    return {
      available: false,
      checkedAt: new Date().toISOString(),
      channel: "generic",
      version: app.getVersion(),
      feedUrl: getUpdateFeedUrl(),
      error: error.message,
    };
  }
});
ipcMain.handle("launcher:launchGame", async (_event, session) => {
  createGameWindow(session);
  return { ok: true };
});

app.whenReady().then(() => {
  configureAutoUpdater();
  createLauncherWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLauncherWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});