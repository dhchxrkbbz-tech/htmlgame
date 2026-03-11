const launcherApi = window.launcherApi;

const form = document.getElementById("launcher-form");
const statusElement = document.getElementById("launcher-status");
const updateResultElement = document.getElementById("update-result");
const versionElement = document.getElementById("launcher-version");
const updateButton = document.getElementById("check-updates");

function setStatus(message) {
  statusElement.textContent = message;
}

function createGuestProfile(classKey) {
  return {
    profile: {
      username: `guest-${classKey}`,
      classKey,
      stats: {
        maxHealth: 120,
        health: 120,
        maxMana: 80,
        mana: 80,
        power: 18,
        defense: 8,
        speed: 180,
      },
      inventory: [
        { id: "starter-potion", name: "Starter Potion", quantity: 3, rarity: "common" },
        { id: "field-ration", name: "Field Ration", quantity: 2, rarity: "common" },
        { id: "oak-wand", name: "Oak Wand", quantity: 1, rarity: "uncommon" },
      ],
      partyId: "solo-party",
      guildId: null,
    },
    token: null,
    mode: "guest",
  };
}

async function requestAuth(action, payload) {
  const apiBase = await launcherApi.getApiBase();
  const response = await fetch(`${apiBase}/api/auth/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Authentication failed.");
  }

  return {
    profile: data.profile,
    token: data.token,
    mode: "account",
  };
}

function getPayload() {
  const formData = new FormData(form);
  return {
    username: String(formData.get("username") ?? ""),
    password: String(formData.get("password") ?? ""),
    classKey: String(formData.get("classKey") ?? "warrior"),
  };
}

form.addEventListener("click", async (event) => {
  const button = event.target;
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const action = button.dataset.action;
  if (!action) {
    return;
  }

  const payload = getPayload();
  setStatus("Processing...");

  try {
    const session = action === "guest"
      ? createGuestProfile(payload.classKey)
      : await requestAuth(action, payload);

    await launcherApi.launchGame(session);
    setStatus(`${action} successful. Game window opened.`);
  } catch (error) {
    setStatus(error.message);
  }
});

updateButton.addEventListener("click", async () => {
  updateResultElement.textContent = "Checking for updates...";

  try {
    const result = await launcherApi.checkForUpdates();
    if (result.error) {
      updateResultElement.textContent = `Update check failed: ${result.error}`;
      return;
    }

    updateResultElement.textContent = result.available
      ? `Update ${result.version} available from ${result.feedUrl}.`
      : `No updates available. Checked at ${new Date(result.checkedAt).toLocaleTimeString()}.`;
  } catch (error) {
    updateResultElement.textContent = error.message;
  }
});

launcherApi.onUpdateStatus((payload) => {
  if (payload?.message) {
    updateResultElement.textContent = payload.message;
  }
});

launcherApi.getVersion().then((version) => {
  versionElement.textContent = `Launcher v${version}`;
});