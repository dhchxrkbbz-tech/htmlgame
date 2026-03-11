export class AudioSystem {
  constructor(scene) {
    this.scene = scene;
    this.context = null;
    this.masterGain = null;
    this.ambientNodes = [];
    this.pendingAmbient = false;
    this.unlocked = false;
  }

  ensureContext() {
    if (this.context) {
      return this.context;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    this.context = new AudioContextClass();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.22;
    this.masterGain.connect(this.context.destination);
    return this.context;
  }

  unlock() {
    const context = this.ensureContext();
    if (!context) {
      return;
    }

    context.resume().catch(() => {});
    this.unlocked = context.state === "running" || context.state === "suspended";
    if (this.pendingAmbient) {
      this.pendingAmbient = false;
      this.startAmbient();
    }
  }

  playUiClick(options = {}) {
    if (this.playAsset("ui:click", { volume: 0.12 })) {
      return;
    }

    this.playTone({
      frequency: options.tone === "soft" ? 480 : 620,
      durationMs: 80,
      type: "triangle",
      gain: 0.055,
    });
  }

  playHit({ impactedCount = 1, effect = "hit" } = {}) {
    if (this.playAsset("combat:hit", { volume: 0.14 })) {
      return;
    }

    const frequency = effect === "stun" ? 160 : effect === "dot" ? 210 : 185;
    this.playTone({
      frequency,
      durationMs: 110,
      type: "square",
      gain: Math.min(0.09, 0.05 + impactedCount * 0.01),
    });
  }

  playLootPickup() {
    if (this.playAsset("loot:pickup", { volume: 0.16 })) {
      return;
    }

    this.playTone({ frequency: 740, durationMs: 90, type: "triangle", gain: 0.06 });
    this.playTone({ frequency: 920, durationMs: 110, type: "triangle", gain: 0.05, delayMs: 45 });
  }

  startAmbient() {
    if (this.playAsset("ambient:grove", { loop: true, volume: 0.08 })) {
      return;
    }

    const context = this.ensureContext();
    if (!context || !this.masterGain) {
      return;
    }

    if (context.state !== "running") {
      this.pendingAmbient = true;
      return;
    }

    if (this.ambientNodes.length) {
      return;
    }

    [110, 165].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      gainNode.gain.value = index === 0 ? 0.012 : 0.007;
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);
      oscillator.start();
      this.ambientNodes.push({ oscillator, gainNode });
    });
  }

  playAsset(key, config) {
    if (!this.scene.cache.audio.exists(key)) {
      return false;
    }

    try {
      this.scene.sound.play(key, config);
      return true;
    } catch {
      return false;
    }
  }

  playTone({ frequency, durationMs, type, gain, delayMs = 0 }) {
    const context = this.ensureContext();
    if (!context || !this.masterGain || context.state !== "running") {
      return;
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const startAt = context.currentTime + delayMs / 1000;
    const endAt = startAt + durationMs / 1000;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(gain, startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.02);
  }

  destroy() {
    this.ambientNodes.forEach(({ oscillator, gainNode }) => {
      try {
        oscillator.stop();
      } catch {
        // Ignore already-stopped nodes during teardown.
      }
      oscillator.disconnect();
      gainNode.disconnect();
    });
    this.ambientNodes = [];
  }
}