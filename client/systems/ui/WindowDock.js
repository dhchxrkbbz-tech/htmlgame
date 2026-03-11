export class WindowDock {
  constructor(scene, handlers) {
    this.scene = scene;
    this.handlers = handlers;
    this.buttons = new Map();
    this.container = scene.add.container(1050, 642).setScrollFactor(0).setDepth(1300);
    this.build();
  }

  build() {
    const backdrop = this.scene.add.rectangle(0, 0, 248, 76, 0x08110e, 0.86).setOrigin(0, 0);
    backdrop.setStrokeStyle(1, 0xd7c46e, 0.45);
    const accent = this.scene.add.rectangle(0, 0, 248, 4, 0xd7c46e, 1).setOrigin(0, 0);
    this.container.add([backdrop, accent]);

    const definitions = [
      { key: "inventory", label: "Pack", iconKey: "ui:icon-inventory", x: 16 },
      { key: "market", label: "Trade", iconKey: "ui:icon-trader", x: 74 },
      { key: "party", label: "Party", iconKey: "ui:icon-party", x: 132 },
      { key: "guild", label: "Guild", iconKey: "ui:icon-guild", x: 190 },
    ];

    definitions.forEach((definition) => {
      const background = this.scene.add.rectangle(definition.x, 12, 42, 52, 0x1a2d24, 0.95).setOrigin(0, 0);
      background.setStrokeStyle(1, 0x456557, 0.8);
      background.setInteractive({ useHandCursor: true });
      const icon = this.scene.add.image(definition.x + 21, 28, definition.iconKey).setDisplaySize(18, 18).setOrigin(0.5);
      const label = this.scene.add.text(definition.x + 21, 46, definition.label, {
        fontSize: "10px",
        color: "#dbe6de",
      }).setOrigin(0.5, 0);

      background.on("pointerdown", () => {
        this.handlers[definition.key]?.();
      });

      this.container.add([background, icon, label]);
      this.buttons.set(definition.key, { background, icon, label });
    });
  }

  setActiveStates(activeStates) {
    this.buttons.forEach((button, key) => {
      const active = Boolean(activeStates[key]);
      button.background.setFillStyle(active ? 0x355842 : 0x1a2d24, 0.95);
      button.background.setStrokeStyle(1, active ? 0xd7c46e : 0x456557, active ? 1 : 0.8);
      button.label.setColor(active ? "#f6f2df" : "#dbe6de");
      button.icon.setAlpha(active ? 1 : 0.82);
    });
  }

  destroy() {
    this.container?.destroy(true);
  }
}