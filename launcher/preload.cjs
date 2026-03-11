const { contextBridge, ipcRenderer } = require("electron");

function readLauncherSession() {
  const arg = process.argv.find((entry) => entry.startsWith("--launcher-session="));
  if (!arg) {
    return null;
  }

  try {
    const encoded = arg.slice("--launcher-session=".length);
    return JSON.parse(decodeURIComponent(encoded));
  } catch {
    return null;
  }
}

contextBridge.exposeInMainWorld("launcherApi", {
  getVersion: () => ipcRenderer.invoke("launcher:getVersion"),
  getApiBase: () => ipcRenderer.invoke("launcher:getApiBase"),
  checkForUpdates: () => ipcRenderer.invoke("launcher:checkForUpdates"),
  launchGame: (session) => ipcRenderer.invoke("launcher:launchGame", session),
  getSession: () => readLauncherSession(),
  onUpdateStatus: (listener) => {
    const subscription = (_event, payload) => listener(payload);
    ipcRenderer.on("launcher:update-status", subscription);
    return () => ipcRenderer.off("launcher:update-status", subscription);
  },
});